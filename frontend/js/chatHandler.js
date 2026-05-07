let socket = null;
let activeCommunity = null;
let activeCommunityId = null;
let currentUserId = null;
let typingTimer = null;
let isTyping = false;
let communityEventsCache = [];
let communityMembersCache = [];

let communityMembersPermission = {
  can_manage_members: false,
  can_moderate: false,
  viewer_role: 'member'
};

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
    loadMessages(),
    loadCommunityEvents(),
    loadCommunityMembers()
  ]);

  initSocket();
});

function bindChatEvents() {
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const refreshBtn = document.getElementById('refreshMessagesBtn');
  const assistantBtn = document.getElementById('assistantBtn');
  const assistantBtnPanel = document.getElementById('assistantBtnPanel');

  const openCreateEventBtn = document.getElementById('openCreateEventBtn');
  const closeCreateEventBtn = document.getElementById('closeCreateEventBtn');
  const createEventModal = document.getElementById('createEventModal');
  const createEventForm = document.getElementById('createEventForm');

  const closeEditEventBtn = document.getElementById('closeEditEventBtn');
  const editEventModal = document.getElementById('editEventModal');
  const editEventForm = document.getElementById('editEventForm');

  const closeParticipantsBtn = document.getElementById('closeParticipantsBtn');
  const eventParticipantsModal = document.getElementById('eventParticipantsModal');

  const closeEventDetailBtn = document.getElementById('closeEventDetailBtn');
  const eventDetailModal = document.getElementById('eventDetailModal');
  const eventReviewForm = document.getElementById('eventReviewForm');

  const refreshMembersBtn = document.getElementById('refreshMembersBtn');

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

  if (openCreateEventBtn) {
    openCreateEventBtn.addEventListener('click', () => {
      prefillCreateEventForm();

      if (createEventModal) {
        createEventModal.classList.remove('hidden');
      }
    });
  }

  if (closeCreateEventBtn) {
    closeCreateEventBtn.addEventListener('click', () => {
      if (createEventModal) {
        createEventModal.classList.add('hidden');
      }
    });
  }

  if (createEventModal) {
    createEventModal.addEventListener('click', (event) => {
      if (event.target === createEventModal) {
        createEventModal.classList.add('hidden');
      }
    });
  }

  if (createEventForm) {
    createEventForm.addEventListener('submit', createCommunityEvent);
  }

  if (closeEditEventBtn) {
    closeEditEventBtn.addEventListener('click', () => {
      if (editEventModal) {
        editEventModal.classList.add('hidden');
      }
    });
  }

  if (editEventModal) {
    editEventModal.addEventListener('click', (event) => {
      if (event.target === editEventModal) {
        editEventModal.classList.add('hidden');
      }
    });
  }

  if (editEventForm) {
    editEventForm.addEventListener('submit', updateCommunityEvent);
  }

  if (closeParticipantsBtn) {
    closeParticipantsBtn.addEventListener('click', () => {
      if (eventParticipantsModal) {
        eventParticipantsModal.classList.add('hidden');
      }
    });
  }

  if (eventParticipantsModal) {
    eventParticipantsModal.addEventListener('click', (event) => {
      if (event.target === eventParticipantsModal) {
        eventParticipantsModal.classList.add('hidden');
      }
    });
  }

  if (closeEventDetailBtn) {
    closeEventDetailBtn.addEventListener('click', () => {
      if (eventDetailModal) {
        eventDetailModal.classList.add('hidden');
      }
    });
  }

  if (eventDetailModal) {
    eventDetailModal.addEventListener('click', (event) => {
      if (event.target === eventDetailModal) {
        eventDetailModal.classList.add('hidden');
      }
    });
  }

  if (eventReviewForm) {
    eventReviewForm.addEventListener('submit', submitEventReview);
  }

  if (refreshMembersBtn) {
    refreshMembersBtn.addEventListener('click', async () => {
      await loadCommunityMembers();
      showToast('Üye listesi yenilendi.', 'success');
    });
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
  const scope = document.getElementById('communityScope');
  const city = document.getElementById('communityCity');

  const scopePill = document.getElementById('communityScopePill');
  const cityPill = document.getElementById('communityCityPill');
  const universityPill = document.getElementById('communityUniversityPill');

  if (name) name.textContent = activeCommunity.name;
  if (description) description.textContent = activeCommunity.description || 'Topluluk açıklaması bulunmuyor.';
  if (avatar) avatar.textContent = getInitials(activeCommunity.name);
  if (category) category.textContent = activeCommunity.category || 'Genel';
  if (memberCount) memberCount.textContent = `${activeCommunity.member_count || 0} üye`;

  if (scope) scope.textContent = getScopeLabel(activeCommunity.scope);
  if (city) city.textContent = activeCommunity.city || getScopeFallbackCity(activeCommunity.scope);

  if (scopePill) {
    scopePill.textContent = `Kapsam: ${getScopeLabel(activeCommunity.scope)}`;
  }

  if (cityPill) {
    cityPill.textContent = `Şehir: ${activeCommunity.city || getScopeFallbackCity(activeCommunity.scope)}`;
  }

  if (universityPill) {
    universityPill.textContent = `Üniversite: ${activeCommunity.university || getScopeFallbackUniversity(activeCommunity.scope)}`;
  }
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
    meta.textContent = `${community.category || 'Topluluk'} · ${getScopeLabel(community.scope)}`;

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

async function loadCommunityEvents() {
  const container = document.getElementById('communityEventsList');
  const count = document.getElementById('communityEventCount');

  if (!container) return;

  container.innerHTML = `<div class="empty-state-mini">Etkinlikler yükleniyor...</div>`;

  const response = await authFetch(`${API_BASE}/api/events/community/${activeCommunityId}`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="empty-state-mini">
        ${response?.message || 'Etkinlikler yüklenemedi.'}
      </div>
    `;

    if (count) count.textContent = '0 etkinlik';
    return;
  }

  communityEventsCache = response.data || [];

  if (count) count.textContent = `${communityEventsCache.length} etkinlik`;

  renderCommunityEvents();
}

function renderCommunityEvents() {
  const container = document.getElementById('communityEventsList');

  if (!container) return;

  container.innerHTML = '';

  if (!communityEventsCache.length) {
    container.innerHTML = `
      <div class="empty-state-mini">
        Bu topluluk için henüz etkinlik oluşturulmadı.
      </div>
    `;
    return;
  }

  communityEventsCache.forEach((event) => {
    const card = document.createElement('article');
    card.className = 'community-event-card';

    const poster = document.createElement('div');
    poster.className = 'community-event-poster';

    if (event.poster_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${event.poster_image_url}`;
      img.alt = event.title;
      poster.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = `community-event-poster-fallback type-${event.event_type || 'offline'}`;
      fallback.textContent = getEventTypeIcon(event.event_type);
      poster.appendChild(fallback);
    }

    const content = document.createElement('div');
    content.className = 'community-event-content';

    const top = document.createElement('div');
    top.className = 'community-event-top';

    const type = document.createElement('span');
    type.className = `event-type-mini type-${event.event_type || 'offline'}`;
    type.textContent = getEventTypeLabel(event.event_type);

    const date = document.createElement('span');
    date.className = 'event-date-mini';
    date.textContent = formatEventDateShort(event.event_date);

    top.appendChild(type);
    top.appendChild(date);

    const title = document.createElement('strong');
    title.textContent = event.title;

    const meta = document.createElement('p');
    meta.textContent = `${event.city || getEventTypeFallbackCity(event.event_type)} · ${event.location || getEventTypeFallbackLocation(event.event_type)}`;

    const stats = document.createElement('div');
    stats.className = 'community-event-stats';

    const participant = document.createElement('span');
    participant.textContent = `${event.participant_count || 0}${event.capacity ? `/${event.capacity}` : ''} katılım`;

    const rating = document.createElement('span');
    rating.textContent = event.average_rating ? `⭐ ${event.average_rating}/5` : '⭐ Puan yok';

    stats.appendChild(participant);
    stats.appendChild(rating);

    const actions = document.createElement('div');
    actions.className = 'community-event-actions';

    const goingBtn = document.createElement('button');
    goingBtn.type = 'button';
    goingBtn.textContent = event.user_status === 'going' ? 'Katıldın' : 'Katılıyorum';
    goingBtn.addEventListener('click', () => updateCommunityEventStatus(event.id, 'going'));

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.textContent = 'Detay';
    detailBtn.addEventListener('click', () => openEventDetail(event.id));

    actions.appendChild(goingBtn);
    actions.appendChild(detailBtn);

    if (event.can_view_participants) {
      const participantsBtn = document.createElement('button');
      participantsBtn.type = 'button';
      participantsBtn.textContent = 'Katılımcılar';
      participantsBtn.addEventListener('click', () => openEventParticipants(event.id));
      actions.appendChild(participantsBtn);
    }

    if (event.can_manage_event) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Düzenle';
      editBtn.addEventListener('click', () => openEditEventModal(event.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'danger-event-button';
      deleteBtn.textContent = 'Sil';
      deleteBtn.addEventListener('click', () => deleteCommunityEvent(event.id, event.title));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    }

    content.appendChild(top);
    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(stats);
    content.appendChild(actions);

    card.appendChild(poster);
    card.appendChild(content);

    container.appendChild(card);
  });
}

async function loadCommunityMembers() {
  const container = document.getElementById('communityMembersList');
  const count = document.getElementById('communityMembersCount');

  if (!container) {
    console.warn('communityMembersList elementi bulunamadı.');
    return;
  }

  container.innerHTML = `
    <div class="empty-state-mini">
      Üyeler yükleniyor...
    </div>
  `;

  try {
    const response = await authFetch(`${API_BASE}/api/community/${activeCommunityId}/members`);

    if (!response || !response.success) {
      container.innerHTML = `
        <div class="empty-state-mini">
          ${response?.message || 'Üyeler yüklenemedi. Backend cevabı alınamadı.'}
        </div>
      `;

      if (count) count.textContent = '0 üye';
      return;
    }

    const responseData = response.data || {};
    const members = Array.isArray(responseData.members) ? responseData.members : [];

    communityMembersCache = members;

    communityMembersPermission = {
      can_manage_members: Boolean(responseData.can_manage_members),
      can_moderate: Boolean(responseData.can_moderate),
      viewer_role: responseData.viewer_role || 'member'
    };

    if (count) count.textContent = `${communityMembersCache.length} üye`;

    renderCommunityMembers();
  } catch (error) {
    console.error('Üyeler yüklenirken hata oluştu:', error);

    container.innerHTML = `
      <div class="empty-state-mini">
        Üyeler yüklenirken hata oluştu: ${error.message}
      </div>
    `;

    if (count) count.textContent = '0 üye';
  }
}

function renderCommunityMembers() {
  const container = document.getElementById('communityMembersList');

  if (!container) return;

  container.innerHTML = '';

  if (!communityMembersCache.length) {
    container.innerHTML = `
      <div class="empty-state-mini">
        Bu toplulukta aktif üye bulunamadı.
      </div>
    `;
    return;
  }

  communityMembersCache.forEach((member) => {
    const card = document.createElement('article');
    card.className = 'community-member-card';

    const top = document.createElement('div');
    top.className = 'community-member-top';

    const avatar = document.createElement('div');
    avatar.className = `member-avatar role-${member.role || 'member'}`;

    if (member.profile_image) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/uploads/profile_images/${member.profile_image}`;
      img.alt = member.name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(member.name);
    }

    const identity = document.createElement('div');
    identity.className = 'member-identity';

    const name = document.createElement('strong');
    name.textContent = member.name || 'FriendZone Kullanıcısı';

    const meta = document.createElement('span');
    meta.textContent = buildMemberMeta(member);

    identity.appendChild(name);
    identity.appendChild(meta);

    const roleBadge = document.createElement('span');
    roleBadge.className = `member-role-badge role-${member.role || 'member'}`;
    roleBadge.textContent = getMemberRoleLabel(member.role);

    top.appendChild(avatar);
    top.appendChild(identity);
    top.appendChild(roleBadge);

    const details = document.createElement('div');
    details.className = 'member-detail-grid';

    details.appendChild(createMemberDetail('Üniversite', member.university || '-'));
    details.appendChild(createMemberDetail('Bölüm', member.department || '-'));
    details.appendChild(createMemberDetail('Şehir', member.city || '-'));
    details.appendChild(createMemberDetail('Kişilik', member.personality_type || '-'));

    card.appendChild(top);
    card.appendChild(details);

    if (communityMembersPermission.can_manage_members) {
      const actions = document.createElement('div');
      actions.className = 'member-management-actions';

      const roleSelect = document.createElement('select');
      roleSelect.className = 'member-role-select';

      roleSelect.innerHTML = `
        <option value="admin">Admin</option>
        <option value="moderator">Moderator</option>
        <option value="member">Member</option>
      `;

      roleSelect.value = member.role || 'member';

      roleSelect.addEventListener('change', () => {
        updateMemberRole(member.user_id, roleSelect.value);
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'member-remove-button';
      removeBtn.textContent = 'Çıkar';

      removeBtn.addEventListener('click', () => {
        removeCommunityMember(member.user_id, member.name);
      });

      actions.appendChild(roleSelect);
      actions.appendChild(removeBtn);

      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}

function initSocket() {
  socket = io(API_BASE, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
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

      if (!input) return;

      input.value = suggestion;
      input.focus();
    });

    list.appendChild(item);
  });

  suggestionsBox.appendChild(list);
}

function prefillCreateEventForm() {
  const cityInput = document.getElementById('eventCity');
  const locationInput = document.getElementById('eventLocation');

  if (cityInput && !cityInput.value) {
    cityInput.value = activeCommunity?.city || '';
  }

  if (locationInput && !locationInput.value && activeCommunity?.scope === 'online') {
    locationInput.placeholder = 'Google Meet, Zoom veya Discord linki';
  }
}

async function createCommunityEvent(event) {
  event.preventDefault();

  const button = document.getElementById('createEventSubmitBtn');
  const originalText = button ? button.textContent : 'Etkinliği Oluştur';

  const formData = new FormData();

  formData.append('community_id', activeCommunityId);
  formData.append('title', document.getElementById('eventTitle')?.value.trim() || '');
  formData.append('description', document.getElementById('eventDescription')?.value.trim() || '');
  formData.append('event_type', document.getElementById('eventType')?.value || 'offline');
  formData.append('city', document.getElementById('eventCity')?.value.trim() || '');
  formData.append('location', document.getElementById('eventLocation')?.value.trim() || '');
  formData.append('event_date', document.getElementById('eventDate')?.value || '');
  formData.append('capacity', document.getElementById('eventCapacity')?.value || '');

  const posterInput = document.getElementById('eventPoster');
  const posterFile = posterInput?.files?.[0];

  if (posterFile) {
    formData.append('poster', posterFile);
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Oluşturuluyor...';
  }

  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE}/api/events/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message || 'Etkinlik oluşturulamadı.', 'error');
      return;
    }

    showToast('Etkinlik oluşturuldu.', 'success');

    const modal = document.getElementById('createEventModal');
    const form = document.getElementById('createEventForm');

    if (modal) modal.classList.add('hidden');
    if (form) form.reset();

    await loadCommunityEvents();
  } catch (error) {
    showToast(`Bağlantı hatası: ${error.message}`, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function openEditEventModal(eventId) {
  const event = communityEventsCache.find((item) => String(item.id) === String(eventId));

  if (!event) {
    showToast('Etkinlik bulunamadı.', 'error');
    return;
  }

  const modal = document.getElementById('editEventModal');

  document.getElementById('editEventId').value = event.id;
  document.getElementById('editEventTitle').value = event.title || '';
  document.getElementById('editEventDescription').value = event.description || '';
  document.getElementById('editEventType').value = event.event_type || 'offline';
  document.getElementById('editEventDate').value = toDateTimeLocalValue(event.event_date);
  document.getElementById('editEventCity').value = event.city || '';
  document.getElementById('editEventLocation').value = event.location || '';
  document.getElementById('editEventCapacity').value = event.capacity || '';

  const posterInput = document.getElementById('editEventPoster');
  if (posterInput) posterInput.value = '';

  if (modal) modal.classList.remove('hidden');
}

async function updateCommunityEvent(event) {
  event.preventDefault();

  const eventId = document.getElementById('editEventId')?.value;
  const button = document.getElementById('editEventSubmitBtn');
  const originalText = button ? button.textContent : 'Etkinliği Güncelle';

  if (!eventId) {
    showToast('Etkinlik ID bulunamadı.', 'error');
    return;
  }

  const formData = new FormData();

  formData.append('title', document.getElementById('editEventTitle')?.value.trim() || '');
  formData.append('description', document.getElementById('editEventDescription')?.value.trim() || '');
  formData.append('event_type', document.getElementById('editEventType')?.value || 'offline');
  formData.append('city', document.getElementById('editEventCity')?.value.trim() || '');
  formData.append('location', document.getElementById('editEventLocation')?.value.trim() || '');
  formData.append('event_date', document.getElementById('editEventDate')?.value || '');
  formData.append('capacity', document.getElementById('editEventCapacity')?.value || '');

  const posterInput = document.getElementById('editEventPoster');
  const posterFile = posterInput?.files?.[0];

  if (posterFile) {
    formData.append('poster', posterFile);
  }

  if (button) {
    button.disabled = true;
    button.textContent = 'Güncelleniyor...';
  }

  try {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message || 'Etkinlik güncellenemedi.', 'error');
      return;
    }

    showToast('Etkinlik güncellendi.', 'success');

    const modal = document.getElementById('editEventModal');
    const form = document.getElementById('editEventForm');

    if (modal) modal.classList.add('hidden');
    if (form) form.reset();

    await loadCommunityEvents();
  } catch (error) {
    showToast(`Bağlantı hatası: ${error.message}`, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function deleteCommunityEvent(eventId, title) {
  const confirmed = confirm(`"${title || 'Bu etkinlik'}" silinsin mi?`);

  if (!confirmed) return;

  const response = await authFetch(`${API_BASE}/api/events/${eventId}`, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlik silinemedi.', 'error');
    return;
  }

  showToast('Etkinlik silindi.', 'success');
  await loadCommunityEvents();
}

async function openEventParticipants(eventId) {
  const modal = document.getElementById('eventParticipantsModal');
  const container = document.getElementById('eventParticipantsList');

  if (!modal || !container) return;

  container.innerHTML = `
    <div class="empty-card-state">
      Katılımcılar yükleniyor...
    </div>
  `;

  modal.classList.remove('hidden');

  const response = await authFetch(`${API_BASE}/api/events/${eventId}/participants`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="empty-card-state">
        ${response?.message || 'Katılımcılar yüklenemedi.'}
      </div>
    `;
    return;
  }

  renderEventParticipants(response.data || []);
}

function renderEventParticipants(participants) {
  const container = document.getElementById('eventParticipantsList');

  if (!container) return;

  container.innerHTML = '';

  if (!participants.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Bu etkinlik için henüz katılımcı yok.
      </div>
    `;
    return;
  }

  participants.forEach((participant) => {
    const user = participant.user || {};

    const card = document.createElement('article');
    card.className = 'participant-card';

    const avatar = document.createElement('div');
    avatar.className = 'participant-avatar';

    if (user.profile_image) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/uploads/profile_images/${user.profile_image}`;
      img.alt = user.name || 'Katılımcı';
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(user.name || 'FZ');
    }

    const info = document.createElement('div');
    info.className = 'participant-info';

    const name = document.createElement('strong');
    name.textContent = user.name || 'Bilinmeyen Kullanıcı';

    const meta = document.createElement('span');
    meta.textContent = [
      user.university,
      user.department,
      user.city
    ].filter(Boolean).join(' · ') || 'Katılımcı';

    const status = document.createElement('small');
    status.textContent = getParticipationStatusLabel(participant.status);

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(status);

    card.appendChild(avatar);
    card.appendChild(info);

    container.appendChild(card);
  });
}

async function updateCommunityEventStatus(eventId, status) {
  const response = await authFetch(`${API_BASE}/api/events/${eventId}/join`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlik katılım durumu güncellenemedi.', 'error');
    return;
  }

  showToast('Etkinlik katılım durumu güncellendi.', 'success');

  const updatedEvent = response.data;

  communityEventsCache = communityEventsCache.map((item) => {
    if (String(item.id) === String(updatedEvent.id)) {
      return updatedEvent;
    }

    return item;
  });

  renderCommunityEvents();
}

async function openEventDetail(eventId) {
  const response = await authFetch(`${API_BASE}/api/events/${eventId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlik detayı yüklenemedi.', 'error');
    return;
  }

  const event = response.data;

  const modal = document.getElementById('eventDetailModal');
  const title = document.getElementById('modalEventTitle');
  const content = document.getElementById('modalEventContent');
  const reviewEventId = document.getElementById('reviewEventId');

  if (title) title.textContent = event.title;
  if (reviewEventId) reviewEventId.value = event.id;

  if (content) {
    content.innerHTML = '';

    const posterWrap = document.createElement('div');
    posterWrap.className = 'modal-poster-wrap';

    if (event.poster_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${event.poster_image_url}`;
      img.alt = event.title;
      posterWrap.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = `modal-poster-fallback type-${event.event_type || 'offline'}`;
      fallback.innerHTML = `<span>${getEventTypeIcon(event.event_type)}</span>`;
      posterWrap.appendChild(fallback);
    }

    const detail = document.createElement('div');
    detail.className = 'modal-event-detail';

    const description = document.createElement('p');
    description.textContent = event.description;

    const meta = document.createElement('div');
    meta.className = 'event-meta-grid';

    meta.appendChild(createMetaItem('Tarih', formatEventDateLong(event.event_date)));
    meta.appendChild(createMetaItem('Tip', getEventTypeLabel(event.event_type)));
    meta.appendChild(createMetaItem('Şehir', event.city || getEventTypeFallbackCity(event.event_type)));
    meta.appendChild(createMetaItem('Konum', event.location || getEventTypeFallbackLocation(event.event_type)));
    meta.appendChild(createMetaItem('Katılım', `${event.participant_count || 0}${event.capacity ? `/${event.capacity}` : ''}`));
    meta.appendChild(createMetaItem('Puan', event.average_rating ? `${event.average_rating}/5` : 'Henüz yok'));

    detail.appendChild(description);
    detail.appendChild(meta);

    content.appendChild(posterWrap);
    content.appendChild(detail);
  }

  if (modal) modal.classList.remove('hidden');

  await loadEventReviews(event.id);
}

async function loadEventReviews(eventId) {
  const response = await authFetch(`${API_BASE}/api/events/${eventId}/reviews`);
  const container = document.getElementById('eventReviewsList');

  if (!container) return;

  container.innerHTML = '';

  if (!response || !response.success || !response.data.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Henüz yorum yapılmadı.
      </div>
    `;
    return;
  }

  response.data.forEach((review) => {
    const card = document.createElement('div');
    card.className = 'review-card';

    const top = document.createElement('div');
    top.className = 'review-card-top';

    const user = document.createElement('strong');
    user.textContent = review.user_name || 'FriendZone Kullanıcısı';

    const rating = document.createElement('span');
    rating.textContent = `⭐ ${review.rating}/5`;

    top.appendChild(user);
    top.appendChild(rating);

    const comment = document.createElement('p');
    comment.textContent = review.comment || 'Yorum eklenmedi.';

    card.appendChild(top);
    card.appendChild(comment);

    container.appendChild(card);
  });
}

async function submitEventReview(event) {
  event.preventDefault();

  const eventId = document.getElementById('reviewEventId')?.value;
  const rating = document.getElementById('eventRating')?.value;
  const comment = document.getElementById('eventComment')?.value.trim();

  if (!eventId) {
    showToast('Etkinlik seçilemedi.', 'error');
    return;
  }

  const response = await authFetch(`${API_BASE}/api/events/${eventId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      rating,
      comment
    })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Yorum kaydedilemedi.', 'error');
    return;
  }

  showToast('Değerlendirme kaydedildi.', 'success');

  const form = document.getElementById('eventReviewForm');

  if (form) form.reset();

  await loadEventReviews(eventId);
  await loadCommunityEvents();
}

async function updateMemberRole(userId, role) {
  const confirmed = confirm(`Bu kullanıcının rolünü "${getMemberRoleLabel(role)}" yapmak istediğine emin misin?`);

  if (!confirmed) {
    await loadCommunityMembers();
    return;
  }

  const response = await authFetch(`${API_BASE}/api/community/${activeCommunityId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({
      role
    })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Rol güncellenemedi.', 'error');
    await loadCommunityMembers();
    return;
  }

  showToast('Üye rolü güncellendi.', 'success');

  await loadCommunityMembers();
  await loadCommunityDetails();
}

async function removeCommunityMember(userId, name) {
  const confirmed = confirm(`${name || 'Bu kullanıcı'} topluluktan çıkarılsın mı?`);

  if (!confirmed) return;

  const response = await authFetch(`${API_BASE}/api/community/${activeCommunityId}/members/${userId}`, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Üye çıkarılamadı.', 'error');
    return;
  }

  showToast('Üye topluluktan çıkarıldı.', 'success');

  await loadCommunityMembers();
  await loadCommunityDetails();
  await loadMyCommunitiesForChat();
}

function createMetaItem(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value;

  item.appendChild(span);
  item.appendChild(strong);

  return item;
}

function createMemberDetail(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value;

  item.appendChild(span);
  item.appendChild(strong);

  return item;
}

function buildMemberMeta(member) {
  const parts = [];

  if (member.year) parts.push(member.year);
  if (member.message_count !== undefined) parts.push(`${member.message_count} mesaj`);

  return parts.length ? parts.join(' · ') : 'Topluluk üyesi';
}

function getMemberRoleLabel(role) {
  const map = {
    admin: 'Admin',
    moderator: 'Moderator',
    member: 'Member'
  };

  return map[role] || 'Member';
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

function formatEventDateShort(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short'
  });
}

function formatEventDateLong(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function toDateTimeLocalValue(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getEventTypeLabel(type) {
  const map = {
    offline: 'Offline',
    online: 'Online',
    hybrid: 'Hybrid'
  };

  return map[type] || 'Offline';
}

function getEventTypeIcon(type) {
  const map = {
    offline: '📍',
    online: '💻',
    hybrid: '🌐'
  };

  return map[type] || '📍';
}

function getEventTypeFallbackCity(type) {
  if (type === 'online') return 'Online';

  return '-';
}

function getEventTypeFallbackLocation(type) {
  if (type === 'online') return 'Online etkinlik';

  return '-';
}

function getScopeLabel(scope) {
  const map = {
    university: 'University',
    city: 'City',
    country: 'Country',
    online: 'Online'
  };

  return map[scope] || 'Country';
}

function getScopeFallbackUniversity(scope) {
  if (scope === 'city') return 'Şehir geneli';
  if (scope === 'country') return 'Türkiye geneli';
  if (scope === 'online') return 'Online';

  return '-';
}

function getScopeFallbackCity(scope) {
  if (scope === 'country') return 'Türkiye';
  if (scope === 'online') return 'Online';

  return '-';
}

function getParticipationStatusLabel(status) {
  const map = {
    going: 'Katılıyor',
    interested: 'İlgileniyor',
    cancelled: 'İptal etti'
  };

  return map[status] || 'Katılımcı';
}

function getInitials(name) {
  if (!name) return 'FZ';

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}