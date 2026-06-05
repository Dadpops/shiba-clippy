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

app.whenReady().then(() => {
  createWindow();

  // Create a simple tray icon (1x1 transparent PNG as fallback)
  const fs = require('fs');
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  if (!fs.existsSync(iconPath)) {
    // Create a minimal valid PNG (8x8 orange square)
    const pngData = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000080000000808020000004b6d29580000001849444154789c6360f8cf' +
      'c0c0c0c8c0480100000000ffff03004b6d58780000000049454e44ae426082',
      'hex'
    );
    fs.writeFileSync(iconPath, pngData);
  }

  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
