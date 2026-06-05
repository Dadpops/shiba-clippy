# 🐕 Shiba Clippy — AI Desktop Assistant

A cartoon Shiba Inu that lives on your desktop, powered by Claude AI. Set reminders, draft emails, get productivity tips — just like Clippy, but much cuter and actually smart.

## Features

- 🐕 **Animated Shiba** floats in your taskbar corner (always on top)
- ✉️ **Email drafting** — describe what you need, get a ready-to-send draft
- ⏰ **Reminders** — "remind me to review the PR in 30 minutes"
- 💡 **Productivity tips** — quick advice on demand
- 🌟 **Idle nudges** — Shiba pokes you if you've been quiet too long
- 🖱️ **Draggable** — move it anywhere on screen

## Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- An [Anthropic API key](https://console.anthropic.com/)

### 2. Install dependencies
```bash
cd shiba-clippy
npm install
```

### 3. Set your API key
```bash
# macOS/Linux
export ANTHROPIC_API_KEY=sk-ant-...

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."

# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `.env` file and add a dotenv loader (see below).

### 4. Run it
```bash
npm start
```

Shiba will appear in the **bottom-right corner** of your screen. Click him to chat!

## Usage Examples

| What you type | What Shiba does |
|---|---|
| `"Draft an email to my manager saying I'll be late"` | Writes a complete email with Subject/Body |
| `"Remind me to take a break in 25 minutes"` | Sets a timed reminder that pops up |
| `"Give me a productivity tip"` | Shares a quick actionable tip |
| `"Help me plan my afternoon"` | Helps you think through your tasks |

## Tips

- **Quick actions** — when the chat opens, use the ✉️ Email, ⏰ Reminder, and 💡 Tip buttons for fast shortcuts
- **Drag Shiba** — click and drag the character to reposition it anywhere
- **System tray** — right-click the tray icon to show/hide or quit
- **Idle nudges** — after 10 minutes of inactivity, Shiba will bounce and say hello

## Optional: Auto-load API key from .env

Install dotenv:
```bash
npm install dotenv
```

Add to the top of `src/main.js`:
```js
require('dotenv').config();
```

Create `.env` in the project root:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Project Structure

```
shiba-clippy/
├── src/
│   ├── main.js          # Electron main process (window, IPC, AI calls)
│   ├── preload.js       # Secure bridge between main and renderer
│   └── renderer/
│       ├── index.html   # Shiba UI + SVG character
│       └── renderer.js  # UI interactions, chat, animations
├── assets/
│   └── tray-icon.png    # System tray icon (auto-generated)
├── package.json
└── README.md
```

## Packaging for Distribution

To build a standalone `.app` or `.exe`:
```bash
npm install --save-dev electron-builder
npx electron-builder build --mac   # macOS
npx electron-builder build --win   # Windows
npx electron-builder build --linux # Linux
```
