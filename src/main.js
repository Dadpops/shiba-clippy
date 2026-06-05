const { app, BrowserWindow, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

let mainWindow;
let tray;
let conversationHistory = [];
let reminders = [];

// Initialize Anthropic client (reads from ANTHROPIC_API_KEY env var)
const anthropic = new Anthropic();

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    x: width - 420,
    y: height - 560,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setIgnoreMouseEvents(false);

  // Allow dragging the window
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Use a simple default icon (Electron built-in)
  tray = new Tray(path.join(__dirname, '..', 'assets', 'tray-icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Shiba', click: () => mainWindow.show() },
    { label: 'Hide Shiba', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); process.exit(0); } },
  ]);

  tray.setToolTip('Shiba Assistant');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// Handle AI chat messages
ipcMain.handle('send-message', async (event, userMessage) => {
  conversationHistory.push({ role: 'user', content: userMessage });

  const systemPrompt = `You are Shiba, an enthusiastic and helpful desktop assistant who looks like a cartoon Shiba Inu dog. You help users be more productive.

Your personality:
- Energetic, warm, and occasionally use dog-like expressions ("Woof!", "Such helpful!", "Much efficient!")
- Brief responses (2-4 sentences max unless asked for more)
- Genuinely useful — you can help draft emails, set reminders, give quick advice, summarize tasks

Capabilities you can help with:
- Draft emails (output the email text clearly)
- Set reminders (reply with JSON in this format on its own line: REMINDER:{"text":"reminder text","minutes":N})
- Productivity tips
- Quick answers and lookups
- Task planning

When setting a reminder, always include the REMINDER: JSON line so the app can schedule it.
When drafting an email, format it clearly with Subject:, To:, and Body: sections.

Current reminders set: ${JSON.stringify(reminders)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: conversationHistory,
    });

    const assistantMessage = response.content[0].text;
    conversationHistory.push({ role: 'assistant', content: assistantMessage });

    // Parse reminder commands from response
    const reminderMatch = assistantMessage.match(/REMINDER:(\{[^\n]+\})/);
    if (reminderMatch) {
      try {
        const reminderData = JSON.parse(reminderMatch[1]);
        scheduleReminder(reminderData.text, reminderData.minutes);
        reminders.push({ text: reminderData.text, minutes: reminderData.minutes, set: new Date() });
      } catch (e) {
        console.error('Failed to parse reminder:', e);
      }
    }

    // Keep history manageable
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-16);
    }

    return { success: true, message: assistantMessage };
  } catch (error) {
    console.error('Anthropic API error:', error);
    return { success: false, message: 'Woof... something went wrong. Check your API key!' };
  }
});

function scheduleReminder(text, minutes) {
  setTimeout(() => {
    mainWindow.show();
    mainWindow.webContents.send('reminder-trigger', text);
  }, minutes * 60 * 1000);
}

// Handle window dragging
ipcMain.on('start-drag', () => {
  mainWindow.setMovable(true);
});

ipcMain.handle('clear-history', () => {
  conversationHistory = [];
  return true;
});

ipcMain.handle('get-reminders', () => reminders);

function makeColorPNG(w, h, r, g, b) {
  const zlib = require('zlib');
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c;
  }
  function crc32(buf) {
    let c = -1;
    for (const byte of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ byte) & 0xff];
    return (c ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcBuf]);
  }
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const base = y * (1 + w * 3);
    raw[base] = 0;
    for (let x = 0; x < w; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

app.whenReady().then(() => {
  createWindow();

  const fs = require('fs');
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  if (!fs.existsSync(iconPath)) {
    fs.writeFileSync(iconPath, makeColorPNG(16, 16, 0xe6, 0x8a, 0x00));
  }

  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
