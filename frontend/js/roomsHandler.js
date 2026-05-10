let roomsCache = [];
let activeRoomScope = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  bindRoomEvents();
  prefillRoomCommunityFromQuery();

  await loadRooms();
});

function bindRoomEvents() {
  const openCreateRoomBtn = document.getElementById('openCreateRoomBtn');
  const closeCreateRoomBtn = document.getElementById('closeCreateRoomBtn');
  const createRoomModal = document.getElementById('createRoomModal');
  const createRoomForm = document.getElementById('createRoomForm');
  const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
  const roomTypeFilter = document.getElementById('roomTypeFilter');

  document.querySelectorAll('.room-filter').forEach((button) => {
    button.addEventListener('click', async () => {
      document.querySelectorAll('.room-filter').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');
      activeRoomScope = button.dataset.scope || 'all';

      await loadRooms();
    });
  });

  if (openCreateRoomBtn) {
    openCreateRoomBtn.addEventListener('click', () => {
      if (createRoomModal) {
        createRoomModal.classList.remove('hidden');
      }
    });
  }

  if (closeCreateRoomBtn) {
    closeCreateRoomBtn.addEventListener('click', () => {
      if (createRoomModal) {
        createRoomModal.classList.add('hidden');
      }
    });
  }

  if (createRoomModal) {
    createRoomModal.addEventListener('click', (event) => {
      if (event.target === createRoomModal) {
        createRoomModal.classList.add('hidden');
      }
    });
  }

  if (createRoomForm) {
    createRoomForm.addEventListener('submit', createRoom);
  }

  if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener('click', async () => {
      await loadRooms();
      showToast('Sosyal odalar yenilendi.', 'success');
    });
  }

  if (roomTypeFilter) {
    roomTypeFilter.addEventListener('change', loadRooms);
  }
}

function prefillRoomCommunityFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const communityId = params.get('community_id');

  if (!communityId) return;

  const input = document.getElementById('roomCommunityId');

  if (input) {
    input.value = communityId;
  }
}

async function loadRooms() {
  const container = document.getElementById('roomsList');
  const roomTypeFilter = document.getElementById('roomTypeFilter');

  if (!container) return;

  container.innerHTML = `
    <div class="rooms-empty-state">
      Sosyal odalar yükleniyor...
    </div>
  `;

  const params = new URLSearchParams();

  params.set('scope', activeRoomScope || 'all');

  if (roomTypeFilter && roomTypeFilter.value) {
    params.set('room_type', roomTypeFilter.value);
  }

  const response = await authFetch(`${API_BASE}/api/rooms?${params.toString()}`);

  if (!response || !response.success) {
    roomsCache = [];
    container.innerHTML = `
      <div class="rooms-empty-state error">
        ${response?.message || 'Sosyal odalar yüklenemedi.'}
      </div>
    `;
    return;
  }

  roomsCache = response.data || [];
  renderRooms();
}

function renderRooms() {
  const container = document.getElementById('roomsList');

  if (!container) return;

  container.innerHTML = '';

  if (!roomsCache.length) {
    container.innerHTML = `
      <div class="rooms-empty-state">
        Henüz bu filtreye uygun sosyal oda bulunmuyor. İlk odayı sen oluşturabilirsin.
      </div>
    `;
    return;
  }

  roomsCache.forEach((room) => {
    container.appendChild(createRoomCard(room));
  });
}

function createRoomCard(room) {
  const card = document.createElement('article');
  card.className = room.is_live ? 'room-card live' : 'room-card';

  const top = document.createElement('div');
  top.className = 'room-card-top';

  const icon = document.createElement('div');
  icon.className = `room-type-icon type-${room.room_type || 'casual'}`;
  icon.textContent = getRoomTypeIcon(room.room_type);

  const titleWrap = document.createElement('div');
  titleWrap.className = 'room-title-wrap';

  const title = document.createElement('h3');
  title.textContent = room.name || 'Sosyal Oda';

  const meta = document.createElement('span');
  meta.textContent = buildRoomMeta(room);

  titleWrap.appendChild(title);
  titleWrap.appendChild(meta);

  const liveBadge = document.createElement('span');
  liveBadge.className = room.is_live ? 'room-live-badge active' : 'room-live-badge';
  liveBadge.textContent = room.is_live ? 'Canlı' : 'Pasif';

  top.appendChild(icon);
  top.appendChild(titleWrap);
  top.appendChild(liveBadge);

  const description = document.createElement('p');
  description.className = 'room-description';
  description.textContent = room.description || 'Bu oda için açıklama eklenmemiş.';

  const stats = document.createElement('div');
  stats.className = 'room-stats';

  stats.appendChild(createRoomStat('👥', `${room.current_participants || 0}/${room.max_participants || 0}`));
  stats.appendChild(createRoomStat('🏷️', getRoomTypeLabel(room.room_type)));
  stats.appendChild(createRoomStat('🔒', getVisibilityLabel(room.visibility)));

  if (room.community_name) {
    stats.appendChild(createRoomStat('🌐', room.community_name));
  }

  if (room.event_title) {
    stats.appendChild(createRoomStat('📅', room.event_title));
  }

  if (room.language) {
    stats.appendChild(createRoomStat('🗣️', room.language));
  }

  if (room.game_title) {
    stats.appendChild(createRoomStat('🎮', room.game_title));
  }

  const actions = document.createElement('div');
  actions.className = 'room-actions';

  const joinBtn = document.createElement('button');
  joinBtn.type = 'button';
  joinBtn.className = room.viewer_status === 'joined'
    ? 'room-action-button danger'
    : 'room-action-button primary';

  joinBtn.textContent = room.viewer_status === 'joined'
    ? 'Odadan Ayrıl'
    : 'Odaya Katıl';

  joinBtn.addEventListener('click', async () => {
    if (room.viewer_status === 'joined') {
      await leaveRoom(room.id);
    } else {
      await joinRoom(room.id);
    }
  });

  actions.appendChild(joinBtn);

  if (room.meeting_url) {
    const meetingBtn = document.createElement('a');
    meetingBtn.className = 'room-action-button secondary';
    meetingBtn.href = room.meeting_url;
    meetingBtn.target = '_blank';
    meetingBtn.rel = 'noopener noreferrer';
    meetingBtn.textContent = getMeetingButtonText(room.meeting_provider);
    actions.appendChild(meetingBtn);
  }

  const participantsBtn = document.createElement('button');
  participantsBtn.type = 'button';
  participantsBtn.className = 'room-action-button ghost';
  participantsBtn.textContent = 'Katılımcılar';
  participantsBtn.addEventListener('click', () => {
    loadRoomParticipants(room.id, room.name);
  });

  actions.appendChild(participantsBtn);

  if (room.can_manage_room) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'room-action-button danger ghost';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener('click', () => {
      deleteRoom(room.id, room.name);
    });

    actions.appendChild(deleteBtn);
  }

  card.appendChild(top);
  card.appendChild(description);
  card.appendChild(stats);
  card.appendChild(actions);

  return card;
}

function createRoomStat(icon, value) {
  const item = document.createElement('span');
  item.className = 'room-stat';
  item.textContent = `${icon} ${value}`;
  return item;
}

async function createRoom(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('createRoomSubmitBtn');
  const modal = document.getElementById('createRoomModal');

  const payload = {
    name: getInputValue('roomName'),
    description: getInputValue('roomDescription'),
    room_type: getInputValue('roomType') || 'casual',
    community_id: getInputValue('roomCommunityId') || null,
    max_participants: Number(getInputValue('roomMaxParticipants') || 20),
    meeting_provider: getInputValue('roomMeetingProvider') || null,
    meeting_url: getInputValue('roomMeetingUrl') || null,
    language: getInputValue('roomLanguage') || null,
    game_title: getInputValue('roomGameTitle') || null
  };

  if (!payload.name || payload.name.length < 3) {
    showToast('Oda adı en az 3 karakter olmalıdır.', 'error');
    return;
  }

  const originalText = submitBtn ? submitBtn.textContent : 'Odayı Oluştur';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Oluşturuluyor...';
  }

  const response = await authFetch(`${API_BASE}/api/rooms/create`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Oda oluşturulamadı.', 'error');
    return;
  }

  showToast('Sosyal oda oluşturuldu.', 'success');

  if (modal) {
    modal.classList.add('hidden');
  }

  const form = document.getElementById('createRoomForm');

  if (form) {
    form.reset();
  }

  await loadRooms();
}

async function joinRoom(roomId) {
  const response = await authFetch(`${API_BASE}/api/rooms/${roomId}/join`, {
    method: 'POST'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Odaya katılamadınız.', 'error');
    return;
  }

  showToast('Odaya katıldınız.', 'success');
  await loadRooms();
}

async function leaveRoom(roomId) {
  const response = await authFetch(`${API_BASE}/api/rooms/${roomId}/leave`, {
    method: 'POST'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Odadan ayrılamadınız.', 'error');
    return;
  }

  showToast('Odadan ayrıldınız.', 'success');
  await loadRooms();
}

async function deleteRoom(roomId, roomName) {
  const confirmed = window.confirm(`"${roomName}" odasını silmek istediğine emin misin?`);

  if (!confirmed) return;

  const response = await authFetch(`${API_BASE}/api/rooms/${roomId}`, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Oda silinemedi.', 'error');
    return;
  }

  showToast('Oda silindi.', 'success');
  await loadRooms();
}

async function loadRoomParticipants(roomId, roomName) {
  const response = await authFetch(`${API_BASE}/api/rooms/${roomId}/participants`);

  if (!response || !response.success) {
    showToast(response?.message || 'Katılımcılar alınamadı.', 'error');
    return;
  }

  const participants = response.data || [];

  if (!participants.length) {
    showToast(`${roomName} odasında aktif katılımcı yok.`, 'info');
    return;
  }

  const names = participants
    .map((participant) => participant.user?.name || 'FriendZone Kullanıcısı')
    .join(', ');

  showToast(`${roomName}: ${names}`, 'success');
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? String(element.value || '').trim() : '';
}

function getRoomTypeIcon(type) {
  const map = {
    casual: '💬',
    language: '🗣️',
    gaming: '🎮',
    study: '📚',
    event: '📅',
    voice: '🎙️',
    meet: '🔗'
  };

  return map[type] || '💬';
}

function getRoomTypeLabel(type) {
  const map = {
    casual: 'Sohbet',
    language: 'Dil Pratiği',
    gaming: 'Oyun',
    study: 'Ders Çalışma',
    event: 'Etkinlik',
    voice: 'Sesli',
    meet: 'Meet'
  };

  return map[type] || 'Sohbet';
}

function getVisibilityLabel(visibility) {
  const map = {
    public: 'Public',
    community: 'Topluluk',
    private: 'Private'
  };

  return map[visibility] || 'Topluluk';
}

function getMeetingButtonText(provider) {
  const map = {
    internal: 'Platform İçi Katıl',
    jitsi: 'Jitsi’ye Katıl',
    google_meet: 'Meet’e Katıl',
    zoom: 'Zoom’a Katıl',
    livekit: 'LiveKit’e Katıl',
    external: 'Linke Git'
  };

  return map[provider] || 'Toplantıya Katıl';
}

function buildRoomMeta(room) {
  const parts = [];

  parts.push(getRoomTypeLabel(room.room_type));

  if (room.community_name) {
    parts.push(room.community_name);
  }

  if (room.creator_name) {
    parts.push(`Oluşturan: ${room.creator_name}`);
  }

  return parts.join(' · ');
}