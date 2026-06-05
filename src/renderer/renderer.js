const shibaContainer = document.getElementById('shiba-container');
const bubble         = document.getElementById('bubble');
const bubbleText     = document.getElementById('bubble-text');
const bubbleTag      = document.getElementById('bubble-tag');
const chatPanel      = document.getElementById('chat-panel');
const messagesDiv    = document.getElementById('messages');
const userInput      = document.getElementById('user-input');
const sendBtn        = document.getElementById('send-btn');
const quickActions   = document.getElementById('quick-actions');
const typingIndicator = document.getElementById('typing-indicator');

let chatOpen = false;
let bubbleTimeout = null;
let isTyping = false;
let appMode = 'ai';

// Detect mode and update UI accordingly
window.shibaAPI.getMode().then((mode) => {
  appMode = mode;
  if (mode === 'offline') {
    document.querySelector('#chat-header span').textContent = '🐕 Shiba — Offline Mode';
    userInput.placeholder = 'Set reminders, draft emails, get tips...';
  }
});

// ── Greeting messages Shiba shows on startup ──
const greetings = [
  "Such ready to help! Much efficiency! 🐾",
  "Woof! Shiba is here to optimize your day! ✨",
  "Hello! Click me to chat, set reminders, or draft emails! 🐕",
  "Very helpful. Such assistant. Wow! 🌟",
];

// Show a greeting bubble after a moment
setTimeout(() => {
  showBubble(greetings[Math.floor(Math.random() * greetings.length)], 'chat');
}, 800);

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
  if (duration > 0) {
    bubbleTimeout = setTimeout(() => bubble.classList.remove('visible'), duration);
  }
}

function hideBubble() {
  if (bubbleTimeout) clearTimeout(bubbleTimeout);
  bubble.classList.remove('visible');
}

// ── Chat open/close ──
function openChat() {
  chatOpen = true;
  chatPanel.classList.add('visible');
  quickActions.classList.add('visible');
  hideBubble();
  animateShiba('bounce');
  setTimeout(() => userInput.focus(), 100);

  // Show a welcome message if chat is empty
  if (messagesDiv.children.length === 0) {
    if (appMode === 'offline') {
      addMessage('assistant', "Woof! 🐾 Running in offline mode — no API key found.\n\nI can still help with:\n⏰ Reminders — \"remind me to X in N minutes\"\n✉️ Email drafts — \"draft email to boss@work.com about Y\"\n💡 Tips — \"give me a tip\"\n\nAdd ANTHROPIC_API_KEY to unlock full AI chat! 🔑");
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

// ── Shiba click toggle ──
shibaContainer.addEventListener('click', () => {
  if (chatOpen) {
    closeChat();
  } else {
    openChat();
  }
});

document.getElementById('close-chat').addEventListener('click', (e) => {
  e.stopPropagation();
  closeChat();
});

// ── Message rendering ──
function addMessage(role, text) {
  // Hide REMINDER: JSON lines from display
  const displayText = text.replace(/REMINDER:\{[^\n]+\}\n?/g, '').trim();
  if (!displayText) return;

  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  msg.textContent = displayText;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Remove typing indicator if present
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

  // Show typing dots
  typingIndicator.classList.add('visible');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // Animate Shiba
  animateShiba('excited');

  try {
    const result = await window.shibaAPI.sendMessage(text);

    if (result.success) {
      addMessage('assistant', result.message);

      // Detect email drafts and show bubble hint
      if (result.message.toLowerCase().includes('subject:') && result.message.toLowerCase().includes('body:')) {
        showBubble('Email draft ready! You can copy it above. ✉️', 'email', 5000);
      }
      // Detect reminders
      else if (result.message.includes('REMINDER:')) {
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
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 80) + 'px';
});

// ── Quick action buttons ──
document.querySelectorAll('.quick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt;
    userInput.value = prompt;
    userInput.focus();

    // If it's the "tip" button (no trailing space), send immediately
    if (!prompt.endsWith(' ')) {
      sendMessage();
    }
  });
});

// ── Shiba animations ──
function animateShiba(type) {
  shibaContainer.classList.remove('bounce', 'excited');
  void shibaContainer.offsetWidth; // reflow trick
  shibaContainer.classList.add(type);
  setTimeout(() => shibaContainer.classList.remove(type), 900);
}

// ── Reminder trigger from main process ──
window.shibaAPI.onReminderTrigger((text) => {
  showBubble(`⏰ Reminder: ${text}`, 'reminder', 0); // persist until dismissed
  animateShiba('excited');
  if (!chatOpen) openChat();
  addSystemMessage(`⏰ Reminder: ${text}`);
});

// ── Dragging ──
let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

shibaContainer.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragOffsetX = e.screenX;
  dragOffsetY = e.screenY;
  window.shibaAPI.startDrag();
});

// ── Idle poke: Shiba nudges you if you haven't typed in 10 min ──
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
  }, 10 * 60 * 1000); // 10 minutes
}

document.addEventListener('mousemove', resetIdleTimer);
document.addEventListener('keydown', resetIdleTimer);
resetIdleTimer();
