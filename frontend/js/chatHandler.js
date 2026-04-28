let socket = null;
let activeCommunity = null;
let activeCommunityId = null;
let currentUserId = null;
let typingTimer = null;
let isTyping = false;

const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏'];

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  activeCommunityId = params.get('id');
  currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  if (!activeCommunityId) {
    showToast('Topluluk ID bulunamadı.', 'error');
    window.location.href = 'communities.html';
    return;
  }

  bindChatEvents();

  await Promise.all([
    loadCommunityDetails(),
    loadMyCommunitiesForChat(),
    loadMessages()
  ]);

  initSocket();
});

function bindChatEvents() {
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const refreshBtn = document.getElementById('refreshMessagesBtn');
  const assistantBtn = document.getElementById('assistantBtn');
  const assistantBtnPanel = document.getElementById('assistantBtnPanel');

  if (messageForm) {
    messageForm.addEventListener('submit', sendMessage);
  }

  if (messageInput) {
    messageInput.addEventListener('input', handleTyping);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadMessages();
      showToast('Mesajlar yenilendi.', 'success');
    });
  }

  if (assistantBtn) {
    assistantBtn.addEventListener('click', generateAssistantSuggestions);
  }

  if (assistantBtnPanel) {
    assistantBtnPanel.addEventListener('click', generateAssistantSuggestions);
  }
}

async function loadCommunityDetails() {
  const response = await authFetch(`${API_BASE}/api/community/${activeCommunityId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluk bilgileri alınamadı.', 'error');
    return;
  }

  activeCommunity = response.data;

  const name = document.getElementById('communityName');
  const description = document.getElementById('communityDescription');
  const avatar = document.getElementById('communityAvatar');
  const category = document.getElementById('communityCategory');
  const memberCount = document.getElementById('memberCount');

  if (name) name.textContent = activeCommunity.name;
  if (description) description.textContent = activeCommunity.description || 'Topluluk açıklaması bulunmuyor.';
  if (avatar) avatar.textContent = getInitials(activeCommunity.name);
  if (category) category.textContent = activeCommunity.category || 'Genel';
  if (memberCount) memberCount.textContent = `${activeCommunity.member_count || 0} üye`;
}

async function loadMyCommunitiesForChat() {
  const response = await authFetch(`${API_BASE}/api/community/user/${currentUserId}`);
  const container = document.getElementById('chatMyCommunities');

  if (!container) return;

  container.innerHTML = '';

  if (!response || !response.success || !response.data.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state-mini';
    empty.textContent = 'Henüz topluluğa katılmadın.';
    container.appendChild(empty);
    return;
  }

  response.data.forEach((community) => {
    const link = document.createElement('a');
    link.className = community.id == activeCommunityId
      ? 'my-community-link active-community'
      : 'my-community-link';

    link.href = `community.html?id=${community.id}`;

    const avatar = document.createElement('div');
    avatar.className = 'community-avatar';
    avatar.textContent = getInitials(community.name);

    const info = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = community.name;

    const meta = document.createElement('span');
    meta.textContent = community.category || 'Topluluk';

    info.appendChild(title);
    info.appendChild(meta);

    link.appendChild(avatar);
    link.appendChild(info);
    container.appendChild(link);
  });
}

async function loadMessages() {
  const container = document.getElementById('chatMessages');

  if (!container) return;

  container.innerHTML = `
    <div class="empty-chat-state">
      <strong>Mesajlar yükleniyor...</strong>
      <p>Topluluğun son mesajları getiriliyor.</p>
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/chat/${activeCommunityId}/messages`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="empty-chat-state">
        <strong>Mesajlar alınamadı</strong>
        <p>${response?.message || 'Backend bağlantısı kontrol edilmeli.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  if (!response.data.length) {
    container.innerHTML = `
      <div class="empty-chat-state">
        <strong>Henüz mesaj yok</strong>
        <p>Bu toplulukta ilk mesajı sen gönder.</p>
      </div>
    `;
    return;
  }

  response.data.forEach((message) => {
    appendMessage(message);
  });

  scrollChatToBottom();
}

function initSocket() {
  socket = io(API_BASE, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);

    setConnectionStatus(true);

    socket.emit('join_room', {
      room_id: activeCommunityId,
      user_id: currentUserId
    });
  });

  socket.on('disconnect', () => {
    setConnectionStatus(false);
  });

  socket.on('receive_message', (message) => {
    console.log('Message received via socket:', message);

    if (String(message.community_id) !== String(activeCommunityId)) return;

    removeEmptyChatState();
    appendMessage(message);
    scrollChatToBottom();
  });

  socket.on('typing', (data) => {
    if (String(data.user_id) === String(currentUserId)) return;
    showTypingIndicator();
  });

  socket.on('stop_typing', (data) => {
    if (String(data.user_id) === String(currentUserId)) return;
    hideTypingIndicator();
  });

  socket.on('reaction_updated', (data) => {
    console.log('Reaction updated:', data);

    if (String(data.community_id) !== String(activeCommunityId)) return;

    updateReactionView(data.message_id, data.reactions || {});
  });

  socket.on('reaction_error', (data) => {
    showToast(data?.message || 'Reaction güncellenemedi.', 'error');
  });
}

function setConnectionStatus(isConnected) {
  const status = document.getElementById('connectionStatus');

  if (!status) return;

  if (isConnected) {
    status.className = 'connection-pill online';
    status.textContent = 'Online';
  } else {
    status.className = 'connection-pill offline';
    status.textContent = 'Offline';
  }
}

async function sendMessage(event) {
  event.preventDefault();

  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) return;

  const response = await authFetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    body: JSON.stringify({
      community_id: activeCommunityId,
      content,
      message_type: 'text'
    })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Mesaj gönderilemedi.', 'error');
    return;
  }

  input.value = '';

  if (socket) {
    socket.emit('stop_typing', {
      room_id: activeCommunityId,
      user_id: currentUserId
    });
  }
}

function handleTyping() {
  if (!socket) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', {
      room_id: activeCommunityId,
      user_id: currentUserId
    });
  }

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    isTyping = false;

    socket.emit('stop_typing', {
      room_id: activeCommunityId,
      user_id: currentUserId
    });
  }, 900);
}

function appendMessage(message) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const messageRow = document.createElement('div');
  messageRow.className = String(message.user_id) === String(currentUserId)
    ? 'message-row own-message'
    : 'message-row';

  messageRow.dataset.messageId = message.id;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = String(message.user_id || '?').slice(0, 2);

  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'message-bubble-wrap';

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const sender = document.createElement('strong');
  sender.textContent = String(message.user_id) === String(currentUserId)
    ? 'Sen'
    : `Kullanıcı #${message.user_id}`;

  const time = document.createElement('span');
  time.textContent = formatMessageTime(message.timestamp);

  meta.appendChild(sender);
  meta.appendChild(time);

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message.content;

  const reactionPanel = document.createElement('div');
  reactionPanel.className = 'message-reaction-panel';

  const reactionPicker = document.createElement('div');
  reactionPicker.className = 'reaction-picker';

  AVAILABLE_REACTIONS.forEach((emoji) => {
    const button = document.createElement('button');
    button.className = 'reaction-button';
    button.type = 'button';
    button.textContent = emoji;
    button.title = `${emoji} reaction ekle`;
    button.addEventListener('click', () => addReaction(message.id, emoji));

    reactionPicker.appendChild(button);
  });

  const reactionSummary = document.createElement('div');
  reactionSummary.className = 'reaction-summary';
  reactionSummary.dataset.messageId = message.id;

  reactionPanel.appendChild(reactionPicker);
  reactionPanel.appendChild(reactionSummary);

  bubbleWrap.appendChild(meta);
  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(reactionPanel);

  messageRow.appendChild(avatar);
  messageRow.appendChild(bubbleWrap);

  container.appendChild(messageRow);

  renderReactionSummary(message.id, message.reactions || {});
}

function addReaction(messageId, reaction) {
  if (!socket) {
    showToast('Socket bağlantısı yok.', 'error');
    return;
  }

  socket.emit('add_reaction', {
    message_id: messageId,
    reaction,
    user_id: currentUserId,
    room_id: activeCommunityId
  });
}

function updateReactionView(messageId, reactions) {
  renderReactionSummary(messageId, reactions);
}

function renderReactionSummary(messageId, reactions) {
  const summary = document.querySelector(`.reaction-summary[data-message-id="${messageId}"]`);

  if (!summary) return;

  summary.innerHTML = '';

  const entries = Object.entries(reactions || {}).filter(([, users]) => {
    return Array.isArray(users) && users.length > 0;
  });

  if (!entries.length) {
    summary.classList.add('empty');
    return;
  }

  summary.classList.remove('empty');

  entries.forEach(([emoji, users]) => {
    const normalizedUsers = users.map((user) => String(user));
    const isMine = normalizedUsers.includes(String(currentUserId));

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = isMine ? 'reaction-chip reacted' : 'reaction-chip';
    chip.textContent = `${emoji} ${users.length}`;
    chip.title = isMine ? 'Reaction kaldır' : 'Reaction ekle';

    chip.addEventListener('click', () => {
      addReaction(messageId, emoji);
    });

    summary.appendChild(chip);
  });
}

async function generateAssistantSuggestions() {
  const suggestionsBox = document.getElementById('assistantSuggestions');

  if (!suggestionsBox) return;

  suggestionsBox.classList.remove('hidden');
  suggestionsBox.innerHTML = `
    <div class="assistant-loading">
      AI öneriler oluşturuluyor...
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/assistant/community-suggestion`, {
    method: 'POST',
  body: JSON.stringify({
  community_id: activeCommunityId,
  category: activeCommunity?.category,
  community_name: activeCommunity?.name
})
  });

  if (!response || !response.success) {
    suggestionsBox.innerHTML = `
      <div class="assistant-error">
        Öneriler oluşturulamadı.
      </div>
    `;
    return;
  }

  suggestionsBox.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'suggestion-list';

  response.data.suggestions.forEach((suggestion) => {
    const item = document.createElement('button');
    item.className = 'suggestion-item';
    item.type = 'button';
    item.textContent = suggestion;

    item.addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      input.value = suggestion;
      input.focus();
    });

    list.appendChild(item);
  });

  suggestionsBox.appendChild(list);
}

function showTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (!indicator) return;

  indicator.classList.remove('hidden');

  clearTimeout(indicator._timer);
  indicator._timer = setTimeout(() => {
    hideTypingIndicator();
  }, 1600);
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (!indicator) return;

  indicator.classList.add('hidden');
}

function removeEmptyChatState() {
  const empty = document.querySelector('.empty-chat-state');
  if (empty) empty.remove();
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  container.scrollTop = container.scrollHeight;
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);

  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getInitials(name) {
  if (!name) return 'FZ';

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}