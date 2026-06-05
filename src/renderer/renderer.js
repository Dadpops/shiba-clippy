const shibaContainer  = document.getElementById('shiba-container');
const bubble          = document.getElementById('bubble');
const bubbleText      = document.getElementById('bubble-text');
const bubbleTag       = document.getElementById('bubble-tag');
const chatPanel       = document.getElementById('chat-panel');
const messagesDiv     = document.getElementById('messages');
const userInput       = document.getElementById('user-input');
const sendBtn         = document.getElementById('send-btn');
const quickActions    = document.getElementById('quick-actions');
const typingIndicator = document.getElementById('typing-indicator');

let chatOpen      = false;
let bubbleTimeout = null;
let isTyping      = false;
let appMode       = 'ai';
let activeTab     = 'chat';
let activeReminders = [];

// ── Bark sound ──
const barkAudio = new Audio(`file:///${window.shibaAPI.assetsPath}/bark.wav`);
barkAudio.volume = 0.7;

function playBark() {
  barkAudio.currentTime = 0;
  barkAudio.play().catch(() => {});
}

// ── Mode detection ──
window.shibaAPI.getMode().then((mode) => {
  appMode = mode;
  updateModeUI();
});

function updateModeUI() {
  const headerSpan = document.querySelector('#chat-header span');
  headerSpan.textContent = appMode === 'offline' ? '🐕 Shiba — Offline Mode' : '🐕 Shiba Assistant';
  userInput.placeholder = appMode === 'offline' ? 'Set reminders, draft emails, get tips...' : 'Ask Shiba anything...';
}

// ── Reminders sync ──
window.shibaAPI.getActiveReminders().then(list => {
  activeReminders = list;
  updateReminderBadge();
});

window.shibaAPI.onRemindersUpdated((list) => {
  activeReminders = list;
  updateReminderBadge();
  if (activeTab === 'reminders') renderReminders();
});

// ── Greeting ──
const greetings = [
  "Such ready to help! Much efficiency! 🐾",
  "Woof! Shiba is here to optimize your day! ✨",
  "Hello! Click me to chat, set reminders, or draft emails! 🐕",
  "Very helpful. Such assistant. Wow! 🌟",
];
setTimeout(() => showBubble(greetings[Math.floor(Math.random() * greetings.length)], 'chat'), 800);

// ── Bubble helpers ──
function showBubble(text, type = 'chat', duration = 4000) {
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  const tagMap = {
    chat:     { label: '🐕 Shiba',    cls: 'tag-chat'     },
    reminder: { label: '⏰ Reminder', cls: 'tag-reminder' },
    email:    { label: '✉️ Email',    cls: 'tag-email'    },
  };
  const tag = tagMap[type] || tagMap.chat;
  bubbleTag.textContent = tag.label;
  bubbleTag.className = `bubble-tag ${tag.cls}`;
  bubbleText.textContent = text;
  bubble.classList.add('visible');
  if (duration > 0) bubbleTimeout = setTimeout(() => bubble.classList.remove('visible'), duration);
}

function hideBubble() {
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  bubble.classList.remove('visible');
}

// ── Tab switching ──
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
  if (tab === 'reminders') renderReminders();
  if (tab === 'settings') loadSettings();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    switchTab(btn.dataset.tab);
  });
});

// ── Chat open/close ──
function openChat() {
  chatOpen = true;
  switchTab('chat');
  chatPanel.classList.add('visible');
  quickActions.classList.add('visible');
  hideBubble();
  animateShiba('bounce');
  setTimeout(() => userInput.focus(), 100);
  if (messagesDiv.children.length === 0) {
    if (appMode === 'offline') {
      addMessage('assistant', "Woof! 🐾 Running in offline mode.\n\nI can help with:\n⏰ Reminders — \"remind me to X in N minutes\"\n✉️ Email drafts — \"draft email to X about Y\"\n💡 Tips — \"give me a tip\"\n\nAdd your API key in ⚙️ Settings to unlock full AI! 🔑");
    } else {
      addMessage('assistant', "Woof! 🐾 I'm Shiba, your productivity pal!\n\nI can help you:\n• Draft emails ✉️\n• Set reminders ⏰\n• Answer questions 💡\n• Plan your tasks 📋\n\nWhat can I do for you?");
    }
  }
}

function closeChat() {
  chatOpen = false;
  chatPanel.classList.remove('visible');
  quickActions.classList.remove('visible');
}

shibaContainer.addEventListener('click', () => chatOpen ? closeChat() : openChat());

document.getElementById('close-chat').addEventListener('click', (e) => {
  e.stopPropagation();
  closeChat();
});

// ── Message rendering ──
function addMessage(role, text) {
  const displayText = text.replace(/REMINDER:\{[^\n]+\}\n?/g, '').trim();
  if (!displayText) return;
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  msg.textContent = displayText;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  typingIndicator.classList.remove('visible');
}

function addSystemMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'msg system';
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ── Send message ──
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isTyping) return;
  userInput.value = '';
  userInput.style.height = 'auto';
  addMessage('user', text);
  isTyping = true;
  sendBtn.disabled = true;
  typingIndicator.classList.add('visible');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  animateShiba('excited');

  try {
    const result = await window.shibaAPI.sendMessage(text);
    if (result.success) {
      addMessage('assistant', result.message);
      if (result.message.toLowerCase().includes('subject:') && result.message.toLowerCase().includes('body:')) {
        showBubble('Email draft ready! Copy it above. ✉️', 'email', 5000);
      } else if (result.message.includes('REMINDER:')) {
        const match = result.message.match(/REMINDER:\{"text":"([^"]+)"/);
        if (match) showBubble(`Reminder set: "${match[1]}" ⏰`, 'reminder', 5000);
      }
    } else {
      addMessage('assistant', result.message);
    }
  } catch (err) {
    addMessage('assistant', 'Woof... something went wrong. Are you connected? 🐾');
    console.error(err);
  }

  isTyping = false;
  sendBtn.disabled = false;
  typingIndicator.classList.remove('visible');
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 80) + 'px';
});

document.querySelectorAll('.quick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt;
    userInput.value = prompt;
    userInput.focus();
    if (!prompt.endsWith(' ')) sendMessage();
  });
});

// ── Reminders tab ──
function updateReminderBadge() {
  const btn = document.getElementById('reminders-tab-btn');
  const count = activeReminders.length;
  btn.innerHTML = count > 0
    ? `⏰ Reminders <span class="badge">${count}</span>`
    : '⏰ Reminders';
}

function formatTimeLeft(triggersAt) {
  const ms = new Date(triggersAt) - Date.now();
  if (ms <= 0) return 'now';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMin}m`;
}

function renderReminders() {
  const list = document.getElementById('reminders-list');
  list.querySelectorAll('.reminder-item').forEach(el => el.remove());
  const noReminders = document.getElementById('no-reminders');

  if (activeReminders.length === 0) {
    noReminders.style.display = 'block';
    return;
  }
  noReminders.style.display = 'none';

  activeReminders.forEach(r => {
    const item = document.createElement('div');
    item.className = 'reminder-item';
    const timeStr = formatTimeLeft(r.triggersAt);
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="reminder-item-text">${r.text}</div>
        <div class="reminder-item-time">⏰ in ${timeStr}</div>
      </div>
      <button class="reminder-cancel-btn" title="Cancel reminder">✕</button>
    `;
    item.querySelector('.reminder-cancel-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.shibaAPI.cancelReminder(r.id);
    });
    list.appendChild(item);
  });
}

// Refresh countdowns every 30s while reminders tab is open
setInterval(() => { if (activeTab === 'reminders') renderReminders(); }, 30000);

// ── Settings tab ──
async function loadSettings() {
  const s = await window.shibaAPI.getSettings();
  document.getElementById('api-key-input').value = s.apiKey || '';
  document.getElementById('auto-launch-toggle').checked = s.autoLaunch;
}

document.getElementById('save-settings-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const apiKey = document.getElementById('api-key-input').value.trim();
  const autoLaunch = document.getElementById('auto-launch-toggle').checked;
  const result = await window.shibaAPI.saveSettings({ apiKey, autoLaunch });
  if (result.success) {
    appMode = result.mode;
    updateModeUI();
    const status = document.getElementById('save-status');
    status.textContent = appMode === 'ai' ? '✓ Saved — AI mode active!' : '✓ Saved — offline mode';
    setTimeout(() => { status.textContent = ''; }, 3000);
    // Reset chat so welcome message reflects new mode
    messagesDiv.innerHTML = '';
  }
});

// ── Reminder trigger ──
window.shibaAPI.onReminderTrigger((text) => {
  playBark();
  showBubble(`⏰ Reminder: ${text}`, 'reminder', 0);
  animateShiba('excited');
  if (!chatOpen) openChat();
  addSystemMessage(`⏰ Reminder: ${text}`);
});

// ── Shiba animations ──
function animateShiba(type) {
  shibaContainer.classList.remove('bounce', 'excited');
  void shibaContainer.offsetWidth;
  shibaContainer.classList.add(type);
  setTimeout(() => shibaContainer.classList.remove(type), 900);
}

// ── Dragging ──
shibaContainer.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  window.shibaAPI.startDrag();
});

// ── Idle poke ──
const idleMessages = [
  "Such quiet... Is everything okay? 🐾",
  "Woof! Don't forget about Shiba! 🐕",
  "Productivity check! How's your day going? ✨",
  "Shiba noticed you've been busy. Need help with anything? 🌟",
];
let idleTimer;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!chatOpen) {
      showBubble(idleMessages[Math.floor(Math.random() * idleMessages.length)], 'chat', 6000);
      animateShiba('bounce');
    }
    resetIdleTimer();
  }, 10 * 60 * 1000);
}
document.addEventListener('mousemove', resetIdleTimer);
document.addEventListener('keydown', resetIdleTimer);
resetIdleTimer();
