const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell } = require('electron');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

let mainWindow;
let tray;
let conversationHistory = [];
let reminders = [];

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const anthropic = hasApiKey ? new Anthropic() : null;

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

function handleLocalMessage(text) {
  const lower = text.toLowerCase();

  // REMINDERS: "remind me to X in N minutes/hours"
  const rm = text.match(
    /(?:remind(?:\s+me)?(?:\s+to)?|set\s+(?:a\s+)?reminder(?:\s+(?:to|for))?)\s+(.+?)\s+in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)/i
  );
  if (rm) {
    const reminderText = rm[1].trim();
    const amount = parseInt(rm[2]);
    const unit = rm[3].toLowerCase();
    const minutes = unit.startsWith('h') ? amount * 60 : amount;
    const label = unit.startsWith('h')
      ? `${amount} hour${amount !== 1 ? 's' : ''}`
      : `${amount} minute${amount !== 1 ? 's' : ''}`;
    scheduleReminder(reminderText, minutes);
    reminders.push({ text: reminderText, minutes, set: new Date() });
    return {
      success: true,
      message: `REMINDER:{"text":"${reminderText}","minutes":${minutes}}\nWoof! Reminder set for ${label}: "${reminderText}" ⏰ I'll bark at you when it's time!`,
    };
  }

  // EMAIL DRAFTS
  if (/(?:draft|compose|write|send)\s+(?:an?\s+)?email/i.test(lower)) {
    const toMatch = text.match(/\bto\s+([^\s,]+@[^\s,]+)/i);
    const aboutMatch = text.match(/\b(?:about|regarding|re:?)\s+(.+)/i);
    const to = toMatch ? toMatch[1] : '';
    const subject = aboutMatch ? aboutMatch[1].trim() : '';
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent('Hello,\n\n\n\nBest regards')}`;
    shell.openExternal(mailtoUrl);
    return {
      success: true,
      message: `Email draft ready — opening your mail client! ✉️\n\nTo: ${to || '(add recipient)'}\nSubject: ${subject || '(add subject)'}\nBody: Hello, ...\n\nTip: Add ANTHROPIC_API_KEY for AI-written emails! 🐾`,
    };
  }

  // PRODUCTIVITY TIPS
  if (/\b(?:tip|advice|productive|focus|hack)\b/i.test(lower)) {
    const tips = [
      "Try the Pomodoro technique: 25 min work, 5 min break. Much focus! 🍅",
      "Tackle your hardest task first — peak energy = peak output. Very smart! 💪",
      "Keep a short daily list: 3 must-dos, 3 nice-to-dos. Such simple! 📋",
      "Turn off notifications during deep work. Distractions cost 20+ min to recover from! 🔕",
      "2-minute rule: if it takes under 2 minutes, do it now. Wow efficiency! ⚡",
      "End each day by writing tomorrow's top 3 priorities. Future-you says thank you! 🌙",
      "Batch similar tasks — reply to all emails at once, not one by one. Much smart! 📬",
      "Take real breaks — step outside, don't just switch tabs. Brain needs rest! 🌿",
      "If stuck, set a 10-minute timer and just start. Starting is the hardest part! 🚀",
    ];
    return {
      success: true,
      message: tips[Math.floor(Math.random() * tips.length)],
    };
  }

  // HELP
  if (/\b(?:help|what can you|what do you|capabilities?)\b/i.test(lower)) {
    return {
      success: true,
      message: `Woof! Running in offline mode. Here's what I can do:\n\n⏰ Reminders — "remind me to take a break in 25 minutes"\n✉️ Email drafts — "draft an email to boss@work.com about the meeting"\n💡 Productivity tips — "give me a tip"\n\nAdd ANTHROPIC_API_KEY to your environment and restart to unlock full AI chat! 🐾`,
    };
  }

  // DEFAULT
  return {
    success: true,
    message: `Woof! I'm in offline mode — no API key found.\n\nI can help with:\n⏰ Reminders — "remind me to X in N minutes"\n✉️ Email drafts — "draft email to X about Y"\n💡 Tips — "give me a tip"\n\nAdd ANTHROPIC_API_KEY to unlock full AI! 🐾`,
  };
}

// Handle AI chat messages
ipcMain.handle('send-message', async (event, userMessage) => {
  if (!hasApiKey) {
    return handleLocalMessage(userMessage);
  }

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
ipcMain.handle('get-mode', () => (hasApiKey ? 'ai' : 'offline'));

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

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

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
