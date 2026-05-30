/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let chats = {};
let activeChatId = null;
let sidebarOpen = true;
let ctxTargetId = null;
let renameTargetId = null;
let selectedFiles = [];
let msgCounter = 0;

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  createNewChat();
  document.addEventListener('click', handleGlobalClick);
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('resize', handleResize);
  handleResize();
});

function handleResize() {
  if (window.innerWidth <= 680 && sidebarOpen) setSidebar(false, false);
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
function toggleSidebar() { setSidebar(!sidebarOpen); }

function setSidebar(open, animate = true) {
  sidebarOpen = open;
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mobile = window.innerWidth <= 680;
  if (open) {
    sidebar.classList.remove('collapsed');
    if (mobile) overlay.classList.add('active');
  } else {
    sidebar.classList.add('collapsed');
    overlay.classList.remove('active');
  }
}

/* ═══════════════════════════════════════════════════════════
   CHAT MANAGEMENT
═══════════════════════════════════════════════════════════ */
function generateId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function createNewChat() {
  const id = generateId();
  const num = Object.keys(chats).length + 1;
  chats[id] = { id, name: `New chat ${num}`, messages: [] };
  switchToChat(id);
  renderChatList();
}

function switchToChat(id) {
  activeChatId = id;
  renderChatList();
  renderChatArea();
  clearAttachmentPreviews();
  selectedFiles = [];
  const inp = document.getElementById('message-input');
  if (inp) { inp.value = ''; inp.style.height = 'auto'; updateSendBtn(); }
  if (window.innerWidth <= 680) setSidebar(false);
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  Object.keys(chats).reverse().forEach(id => {
    const chat = chats[id];
    const item = document.createElement('div');
    item.className = 'chat-item' + (id === activeChatId ? ' active' : '');
    item.dataset.id = id;

    const nameEl = document.createElement('span');
    nameEl.className = 'chat-item-name';
    nameEl.textContent = chat.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'chat-delete-btn';
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteChat(id); });

    item.appendChild(nameEl);
    item.appendChild(delBtn);
    item.addEventListener('click', () => switchToChat(id));
    nameEl.addEventListener('dblclick', e => { e.stopPropagation(); startInlineRename(id, nameEl); });
    item.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(e, id); });
    list.appendChild(item);
  });
}

function deleteChat(id) {
  delete chats[id];
  if (activeChatId === id) {
    const remaining = Object.keys(chats);
    if (remaining.length === 0) createNewChat();
    else switchToChat(remaining[remaining.length - 1]);
  } else {
    renderChatList();
  }
}

function autoNameChat(id, text, hasImage) {
  if (!chats[id]) return;
  let name;
  if (text) {
    const words = text.trim().split(/\s+/).slice(0, 6).join(' ');
    name = words.length > 40 ? words.slice(0, 40) + '…' : words;
  } else if (hasImage) {
    name = '📷 Chemistry Image';
  } else {
    name = 'New chat';
  }
  chats[id].name = name;
  renderChatList();
}

/* ═══════════════════════════════════════════════════════════
   INLINE RENAME
═══════════════════════════════════════════════════════════ */
function startInlineRename(id, nameEl) {
  const current = chats[id].name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-item-name editing';
  input.value = current;
  nameEl.replaceWith(input);
  input.focus(); input.select();
  const commit = () => { const val = input.value.trim(); if (val) chats[id].name = val; renderChatList(); };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { chats[id].name = current; renderChatList(); }
  });
}

/* ═══════════════════════════════════════════════════════════
   CONTEXT MENU
═══════════════════════════════════════════════════════════ */
function showContextMenu(e, id) {
  ctxTargetId = id;
  const menu = document.getElementById('context-menu');
  menu.style.top = e.clientY + 'px';
  menu.style.left = e.clientX + 'px';
  menu.classList.add('open');
}
function closeContextMenu() { document.getElementById('context-menu').classList.remove('open'); ctxTargetId = null; }
function renameFromCtx() { if (!ctxTargetId) return; openRenameModal(ctxTargetId); closeContextMenu(); }
function deleteFromCtx() { if (!ctxTargetId) return; deleteChat(ctxTargetId); closeContextMenu(); }
function handleGlobalClick(e) {
  if (!e.target.closest('#context-menu')) closeContextMenu();
  if (!e.target.closest('.model-dropdown')) closeModelMenu();
}

/* ═══════════════════════════════════════════════════════════
   RENAME MODAL
═══════════════════════════════════════════════════════════ */
function openRenameModal(id) {
  renameTargetId = id;
  const inp = document.getElementById('rename-input');
  inp.value = chats[id]?.name || '';
  document.getElementById('rename-modal').classList.add('open');
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
}
function closeRenameModal() { document.getElementById('rename-modal').classList.remove('open'); renameTargetId = null; }
function confirmRename() {
  const val = document.getElementById('rename-input').value.trim();
  if (val && renameTargetId && chats[renameTargetId]) { chats[renameTargetId].name = val; renderChatList(); }
  closeRenameModal();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('rename-modal').classList.contains('open')) confirmRename();
});

/* ═══════════════════════════════════════════════════════════
   MODEL DROPDOWN
═══════════════════════════════════════════════════════════ */
function toggleModelMenu() { document.getElementById('model-menu').classList.toggle('open'); }
function closeModelMenu() { document.getElementById('model-menu').classList.remove('open'); }
function selectModel(name) {
  document.getElementById('selected-model').textContent = name;
  document.getElementById('message-input').placeholder = `Message ${name}…`;
  document.querySelector('.footer-note').textContent = `${name} can make mistakes. Please double-check responses.`;
  closeModelMenu();
}

/* ═══════════════════════════════════════════════════════════
   RENDER CHAT AREA
═══════════════════════════════════════════════════════════ */
function renderChatArea() {
  const area = document.getElementById('chat-area');
  const chat = chats[activeChatId];
  if (!chat || chat.messages.length === 0) {
    area.innerHTML = `
      <div class="welcome">
        <svg class="welcome-icon" width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
        </svg>
        <h1>Good evening</h1>
        <p>Start a new conversation — your thoughts are yours alone here.</p>
      </div>`;
  } else {
    area.innerHTML = '<div class="messages" id="messages"></div>';
    const msgs = document.getElementById('messages');
    chat.messages.forEach(m => appendMessageEl(msgs, m));
    area.scrollTop = area.scrollHeight;
  }
}

/* ═══════════════════════════════════════════════════════════
   SEND MESSAGE
═══════════════════════════════════════════════════════════ */
async function sendMessage() {
  const inp = document.getElementById('message-input');
  const text = inp.value.trim();
  if (!text && selectedFiles.length === 0) return;

  const chat = chats[activeChatId];
  if (!chat) return;

  const filesToSend = [...selectedFiles];

  const userMsg = {
    role: 'user',
    text,
    images: filesToSend.map(f => ({ url: URL.createObjectURL(f), name: f.name })),
    id: ++msgCounter
  };

  if (chat.messages.length === 0) autoNameChat(activeChatId, text, filesToSend.length > 0);

  chat.messages.push(userMsg);

  const area = document.getElementById('chat-area');
  if (!document.getElementById('messages')) {
    area.innerHTML = '<div class="messages" id="messages"></div>';
  }

  const msgs = document.getElementById('messages');
  appendMessageEl(msgs, userMsg);

  inp.value = '';
  inp.style.height = 'auto';
  updateSendBtn();
  clearAttachmentPreviews();
  selectedFiles = [];
  area.scrollTop = area.scrollHeight;

  const typingEl = createTypingEl();
  msgs.appendChild(typingEl);
  area.scrollTop = area.scrollHeight;

  try {
    const formData = new FormData();
    formData.append("question", text);
    if (filesToSend.length > 0) formData.append("image", filesToSend[0]);

    const response = await fetch("http://127.0.0.1:8000/ask", { method: "POST", body: formData });
    const data = await response.json();
    typingEl.remove();

    const aiMsg = {
      role: 'ai',
      text: data.answer,
      molecules: data.molecules || [],
      id: ++msgCounter
    };

    chat.messages.push(aiMsg);
    appendMessageEl(msgs, aiMsg);
    area.scrollTop = area.scrollHeight;

  } catch (error) {
    typingEl.remove();
    const errorMsg = { role: 'ai', text: "⚠️ Backend connection failed. Make sure FastAPI and Ollama are running.", molecules: [], id: ++msgCounter };
    chat.messages.push(errorMsg);
    appendMessageEl(msgs, errorMsg);
    area.scrollTop = area.scrollHeight;
    console.error(error);
  }
}

/* ═══════════════════════════════════════════════════════════
   MESSAGE ELEMENTS
═══════════════════════════════════════════════════════════ */
function appendMessageEl(container, msg) {
  const el = document.createElement('div');
  el.className = `message ${msg.role}`;
  el.dataset.id = msg.id;

  if (msg.role === 'user') {
    let imagesHtml = '';
    if (msg.images && msg.images.length > 0) {
      const imgs = msg.images.map(i => `<img src="${i.url}" alt="${i.name}" style="max-width:200px;border-radius:8px;" />`).join('');
      imagesHtml = `<div class="user-images">${imgs}</div>`;
    }
    const textHtml = msg.text ? `<div class="bubble">${escHtml(msg.text)}</div>` : '';
    el.innerHTML = `<div class="message-inner">${imagesHtml}${textHtml}</div>`;
  } else {
    const formatted = formatAiText(msg.text);

    // Build molecule images HTML if any
    let molHtml = '';
    if (msg.molecules && msg.molecules.length > 0) {
      const molImgs = msg.molecules.map(m => `
        <div style="display:inline-block;text-align:center;margin:6px;">
          <img src="${m.image}" alt="molecule" style="width:180px;height:120px;border-radius:8px;border:1px solid #333;background:#fff;" />
          <div style="font-size:10px;color:#888;margin-top:4px;">${escHtml(m.smiles)}</div>
        </div>`).join('');
      molHtml = `<div style="margin:10px 0;padding:10px;background:#1a1a2e;border-radius:8px;border:1px solid #2a2a3e;">${molImgs}</div>`;
    }

    el.innerHTML = `
      <div class="message-inner">
        <div class="ai-avatar-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
        </div>
        <div class="ai-content">
          ${formatted}
          ${molHtml}
          <div class="message-actions">
            <button class="msg-btn" onclick="copyMsg(this, ${msg.id})">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button class="msg-btn" title="Good response">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            </button>
            <button class="msg-btn" title="Bad response">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }
  container.appendChild(el);
}

function createTypingEl() {
  const el = document.createElement('div');
  el.className = 'message ai';
  el.innerHTML = `
    <div class="message-inner">
      <div class="ai-avatar-wrap">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
      </div>
      <div class="ai-content">
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  return el;
}

/* ═══════════════════════════════════════════════════════════
   COPY
═══════════════════════════════════════════════════════════ */
function copyMsg(btn, msgId) {
  const chat = chats[activeChatId];
  const msg = chat?.messages.find(m => m.id === msgId);
  if (!msg) return;
  navigator.clipboard.writeText(msg.text || '').then(() => {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg> Copied`;
    setTimeout(() => {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  });
}

/* ═══════════════════════════════════════════════════════════
   FILE HANDLING
═══════════════════════════════════════════════════════════ */
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    selectedFiles.push(file);
    addPreviewThumb(file);
  });
  event.target.value = '';
  updateSendBtn();
}

function addPreviewThumb(file) {
  const bar = document.getElementById('attachment-preview-bar');
  const reader = new FileReader();
  reader.onload = e => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-thumb';
    wrap.dataset.name = file.name;
    wrap.innerHTML = `<img src="${e.target.result}" alt="${file.name}" /><button class="preview-remove" onclick="removePreview(this, '${file.name}')" title="Remove">✕</button>`;
    bar.appendChild(wrap);
  };
  reader.readAsDataURL(file);
}

function removePreview(btn, fileName) {
  selectedFiles = selectedFiles.filter(f => f.name !== fileName);
  btn.closest('.preview-thumb').remove();
  updateSendBtn();
}

function clearAttachmentPreviews() {
  document.getElementById('attachment-preview-bar').innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════
   INPUT HELPERS
═══════════════════════════════════════════════════════════ */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

function updateSendBtn() {
  const inp = document.getElementById('message-input');
  const btn = document.getElementById('send-btn');
  btn.disabled = inp.value.trim() === '' && selectedFiles.length === 0;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const btn = document.getElementById('send-btn');
    if (!btn.disabled) sendMessage();
  }
}

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatAiText(text) {
  if (!text) return '<p></p>';
  return text
    .split('\n\n')
    .map(block => {
      const lines = block.split('\n');
      const escaped = lines.map(l => escHtml(l)).join('<br>');
      const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
      return `<p>${withCode}</p>`;
    })
    .join('');
}