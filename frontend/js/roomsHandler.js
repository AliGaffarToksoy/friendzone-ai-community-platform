let roomsCache = [];
let activeRoomScope = 'all';
let selectedRoomId = null;

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
  const communityFilterInput = document.getElementById('communityFilterInput');
  const eventFilterInput = document.getElementById('eventFilterInput');

  const roomTypeSelect = document.getElementById('roomType');

  const closeRoomParticipantsBtn = document.getElementById('closeRoomParticipantsBtn');
  const roomParticipantsModal = document.getElementById('roomParticipantsModal');

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

  document.querySelectorAll('.room-category-card').forEach((button) => {
    button.addEventListener('click', async () => {
      document.querySelectorAll('.room-category-card').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');

      const selectedType = button.dataset.roomType || '';

      if (roomTypeFilter) {
        roomTypeFilter.value = selectedType;
      }

      await loadRooms();
    });
  });

  if (openCreateRoomBtn) {
    openCreateRoomBtn.addEventListener('click', () => {
      updateSmartRoomFields();

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
    roomTypeFilter.addEventListener('change', async () => {
      syncCategoryCardsWithType(roomTypeFilter.value);
      await loadRooms();
    });
  }

  if (communityFilterInput) {
    communityFilterInput.addEventListener('change', loadRooms);
  }

  if (eventFilterInput) {
    eventFilterInput.addEventListener('change', loadRooms);
  }

  if (roomTypeSelect) {
    roomTypeSelect.addEventListener('change', () => {
      updateSmartRoomFields();
      updateRoomTypeHelp();
    });
    updateSmartRoomFields();
    updateRoomTypeHelp();
  }

  if (closeRoomParticipantsBtn) {
    closeRoomParticipantsBtn.addEventListener('click', () => {
      if (roomParticipantsModal) {
        roomParticipantsModal.classList.add('hidden');
      }
    });
  }

  if (roomParticipantsModal) {
    roomParticipantsModal.addEventListener('click', (event) => {
      if (event.target === roomParticipantsModal) {
        roomParticipantsModal.classList.add('hidden');
      }
    });
  }
}

function prefillRoomCommunityFromQuery() {
  const params = new URLSearchParams(window.location.search);

  const communityId = params.get('community_id');
  const eventId = params.get('event_id');

  const createCommunityInput = document.getElementById('roomCommunityId');
  const filterCommunityInput = document.getElementById('communityFilterInput');
  const eventFilterInput = document.getElementById('eventFilterInput');

  if (communityId) {
    if (createCommunityInput) {
      createCommunityInput.value = communityId;
    }

    if (filterCommunityInput) {
      filterCommunityInput.value = communityId;
    }
  }

  if (eventId && eventFilterInput) {
    eventFilterInput.value = eventId;
  }
}

async function loadRooms() {
  const container = document.getElementById('roomsList');
  const roomTypeFilter = document.getElementById('roomTypeFilter');
  const communityFilterInput = document.getElementById('communityFilterInput');
  const eventFilterInput = document.getElementById('eventFilterInput');

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

  if (communityFilterInput && communityFilterInput.value) {
    params.set('community_id', communityFilterInput.value);
  }

  if (eventFilterInput && eventFilterInput.value) {
    params.set('event_id', eventFilterInput.value);
  }

  const response = await authFetch(`${API_BASE}/api/rooms?${params.toString()}`);

  if (!response || !response.success) {
    roomsCache = [];

    container.innerHTML = `
      <div class="rooms-empty-state error">
        ${response?.message || 'Sosyal odalar yüklenemedi.'}
      </div>
    `;

    renderRoomDetail(null);
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
    selectedRoomId = null;

    container.innerHTML = `
      <div class="rooms-empty-state">
        Henüz bu filtreye uygun sosyal oda bulunmuyor. İlk odayı sen oluşturabilirsin.
      </div>
    `;

    renderRoomDetail(null);
    return;
  }

  if (!selectedRoomId || !roomsCache.some((room) => room.id === selectedRoomId)) {
    selectedRoomId = roomsCache[0].id;
  }

  roomsCache.forEach((room) => {
    container.appendChild(createRoomCard(room));
  });

  const selectedRoom = roomsCache.find((room) => room.id === selectedRoomId);

  renderRoomDetail(selectedRoom || roomsCache[0]);
}

function createRoomCard(room) {
  const card = document.createElement('article');
  card.className = room.is_live ? 'room-card live' : 'room-card';

  if (selectedRoomId === room.id) {
    card.classList.add('selected');
  }

  card.addEventListener('click', (event) => {
    if (
      event.target.closest('button') ||
      event.target.closest('a')
    ) {
      return;
    }

    selectedRoomId = room.id;
    renderRooms();
  });

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

  const activity = createRoomStat('⏱️', formatRelativeTime(room.last_activity_at));
  activity.classList.add(getRoomActivityClass(room));
  stats.appendChild(activity);

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

  if (isLiveRoomCapable(room)) {
    const meetingBtn = document.createElement('button');
    meetingBtn.type = 'button';
    meetingBtn.className = 'room-action-button secondary';
    meetingBtn.textContent = getLiveRoomActionText(room);

    meetingBtn.addEventListener('click', async () => {
      await openLiveRoom(room);
    });

    actions.appendChild(meetingBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'room-action-button ghost';
    copyBtn.textContent = getLiveRoomShareText(room);

    copyBtn.addEventListener('click', async () => {
      await copyRoomJoinLink(room);
    });

    actions.appendChild(copyBtn);
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

function renderRoomDetail(room) {
  const panel = document.getElementById('roomDetailPanel');

  if (!panel) return;

  if (!room) {
    panel.innerHTML = `
      <div class="room-detail-empty">
        <div class="room-detail-empty-icon">🎙️</div>
        <strong>Bir oda seç</strong>
        <p>
          Oda kartlarından birine tıklayarak detayları, katılım durumunu ve toplantı linkini burada görüntüleyebilirsin.
        </p>
      </div>
    `;
    return;
  }

  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'room-detail-header';

  const icon = document.createElement('div');
  icon.className = `room-detail-icon type-${room.room_type || 'casual'}`;
  icon.textContent = getRoomTypeIcon(room.room_type);

  const titleWrap = document.createElement('div');
  titleWrap.className = 'room-detail-title';

  const eyebrow = document.createElement('span');
  eyebrow.textContent = getRoomTypeLabel(room.room_type);

  const title = document.createElement('h2');
  title.textContent = room.name || 'Sosyal Oda';

  titleWrap.appendChild(eyebrow);
  titleWrap.appendChild(title);

  header.appendChild(icon);
  header.appendChild(titleWrap);

  const live = document.createElement('div');
  live.className = room.is_live ? 'room-detail-live active' : 'room-detail-live';
  live.textContent = room.is_live ? 'Canlı Oda' : 'Pasif Oda';

  const description = document.createElement('p');
  description.className = 'room-detail-description';
  description.textContent = room.description || 'Bu oda için açıklama eklenmemiş.';

  const metaGrid = document.createElement('div');
  metaGrid.className = 'room-detail-meta-grid';

  metaGrid.appendChild(createRoomDetailMeta('Katılımcı', `${room.current_participants || 0}/${room.max_participants || 0}`));
  metaGrid.appendChild(createRoomDetailMeta('Görünürlük', getVisibilityLabel(room.visibility)));
  metaGrid.appendChild(createRoomDetailMeta('Topluluk', room.community_name || '-'));
  metaGrid.appendChild(createRoomDetailMeta('Oluşturan', room.creator_name || '-'));
  metaGrid.appendChild(createRoomDetailMeta('Son Aktivite', formatRelativeTime(room.last_activity_at)));

  if (room.language) {
    metaGrid.appendChild(createRoomDetailMeta('Dil', room.language));
  }

  if (room.game_title) {
    metaGrid.appendChild(createRoomDetailMeta('Oyun', room.game_title));
  }

  if (room.meeting_provider) {
    metaGrid.appendChild(createRoomDetailMeta('Sağlayıcı', getMeetingProviderLabel(room.meeting_provider)));
  }

  if (isLiveRoomCapable(room)) {
    metaGrid.appendChild(createRoomDetailMeta('FriendZone Link', getLiveRoomUrl(room.id)));
    metaGrid.appendChild(createRoomDetailMeta('Deneyim', getRoomExperienceDescription(room)));
  }

  if (room.event_title) {
    metaGrid.appendChild(createRoomDetailMeta('Etkinlik', room.event_title));
  }

  const actions = document.createElement('div');
  actions.className = 'room-detail-actions';

  const joinBtn = document.createElement('button');
  joinBtn.type = 'button';
  joinBtn.className = room.viewer_status === 'joined'
    ? 'room-detail-button danger'
    : 'room-detail-button primary';

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

  if (isLiveRoomCapable(room)) {
    const meetingBtn = document.createElement('button');
    meetingBtn.type = 'button';
    meetingBtn.className = 'room-detail-button secondary';
    meetingBtn.textContent = getLiveRoomActionText(room);

    meetingBtn.addEventListener('click', async () => {
      await openLiveRoom(room);
    });

    actions.appendChild(meetingBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'room-detail-button ghost';
    copyBtn.textContent = getLiveRoomShareText(room);

    copyBtn.addEventListener('click', async () => {
      await copyRoomJoinLink(room);
    });

    actions.appendChild(copyBtn);
  }

  const participantsBtn = document.createElement('button');
  participantsBtn.type = 'button';
  participantsBtn.className = 'room-detail-button ghost';
  participantsBtn.textContent = 'Katılımcıları Göster';
  participantsBtn.addEventListener('click', () => {
    loadRoomParticipants(room.id, room.name);
  });

  actions.appendChild(participantsBtn);

  panel.appendChild(header);
  panel.appendChild(live);
  panel.appendChild(description);
  panel.appendChild(metaGrid);
  panel.appendChild(actions);
}

function createRoomStat(icon, value) {
  const item = document.createElement('span');
  item.className = 'room-stat';
  item.textContent = `${icon} ${value}`;
  return item;
}

function createRoomDetailMeta(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value || '-';

  item.appendChild(span);
  item.appendChild(strong);

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
    meeting_provider: getInputValue('roomMeetingProvider') || '',
    meeting_url: getInputValue('roomMeetingUrl') || '',
    language: getInputValue('roomLanguage') || '',
    game_title: getInputValue('roomGameTitle') || ''
  };

  if (!payload.name || payload.name.length < 3) {
    showToast('Oda adı en az 3 karakter olmalıdır.', 'error');
    return;
  }

  if (payload.room_type === 'language' && !payload.language) {
    showToast('Dil pratiği odası için dil bilgisi girilmelidir.', 'error');
    return;
  }

  if (payload.room_type === 'gaming' && !payload.game_title) {
    showToast('Oyun odası için oyun adı girilmelidir.', 'error');
    return;
  }

  if (['event', 'meet', 'voice'].includes(payload.room_type) && !payload.meeting_provider) {
    payload.meeting_provider = 'jitsi';
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

  updateSmartRoomFields();

  selectedRoomId = response.data?.id || selectedRoomId;

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

  selectedRoomId = roomId;

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

  selectedRoomId = roomId;

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

  if (selectedRoomId === roomId) {
    selectedRoomId = null;
  }

  showToast('Oda silindi.', 'success');

  await loadRooms();
}

async function loadRoomParticipants(roomId, roomName) {
  const modal = document.getElementById('roomParticipantsModal');
  const title = document.getElementById('roomParticipantsModalTitle');
  const list = document.getElementById('roomParticipantsList');

  if (title) {
    title.textContent = `${roomName || 'Oda'} Katılımcıları`;
  }

  if (list) {
    list.innerHTML = `
      <div class="rooms-empty-state">
        Katılımcılar yükleniyor...
      </div>
    `;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  const response = await authFetch(`${API_BASE}/api/rooms/${roomId}/participants`);

  if (!response || !response.success) {
    if (list) {
      list.innerHTML = `
        <div class="rooms-empty-state error">
          ${response?.message || 'Katılımcılar alınamadı.'}
        </div>
      `;
    }

    showToast(response?.message || 'Katılımcılar alınamadı.', 'error');
    return;
  }

  const participants = response.data || [];

  renderRoomParticipants(participants);
}

function renderRoomParticipants(participants) {
  const list = document.getElementById('roomParticipantsList');

  if (!list) return;

  list.innerHTML = '';

  if (!participants.length) {
    list.innerHTML = `
      <div class="rooms-empty-state">
        Bu odada şu anda aktif katılımcı yok.
      </div>
    `;
    return;
  }

  participants.forEach((participant) => {
    const user = participant.user || {};

    const card = document.createElement('article');
    card.className = 'room-participant-card';

    const avatar = document.createElement('div');
    avatar.className = 'room-participant-avatar';

    if (user.profile_image) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/uploads/profile_images/${user.profile_image}`;
      img.alt = user.name || 'FriendZone Kullanıcısı';
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(user.name || 'FZ');
    }

    const info = document.createElement('div');
    info.className = 'room-participant-info';

    const name = document.createElement('strong');
    name.textContent = user.name || 'FriendZone Kullanıcısı';

    const meta = document.createElement('span');
    meta.textContent = [
      user.university,
      user.department,
      user.city
    ].filter(Boolean).join(' · ') || 'Profil bilgisi yok';

    info.appendChild(name);
    info.appendChild(meta);

    const role = document.createElement('span');
    role.className = `room-participant-role role-${participant.role || 'participant'}`;
    role.textContent = participant.role === 'host' ? 'Host' : 'Katılımcı';

    card.appendChild(avatar);
    card.appendChild(info);
    card.appendChild(role);

    list.appendChild(card);
  });
}

function updateRoomTypeHelp() {
  const roomType = getInputValue('roomType') || 'casual';
  const help = document.getElementById('roomTypeHelp');

  if (!help) return;

  const map = {
    casual: 'Genel sohbet odasıdır. Canlı görüşme açmaz, topluluk içinde sosyal alan olarak listelenir.',
    language: 'Dil pratiği odasıdır. Dil bilgisi zorunludur; canlı görüşme açmaz.',
    gaming: 'Oyun buluşma odasıdır. Oyun adı zorunludur; canlı görüşme açmaz.',
    study: 'Ders çalışma odasıdır. Çalışma grubu olarak listelenir; canlı görüşme açmaz.',
    voice: 'Sesli muhabbet odasıdır. Otomatik canlı bağlantı üretir ve kamera kapalı başlar.',
    meet: 'Video görüşme odasıdır. Zoom / Google Meet mantığıyla FriendZone içinde açılır.',
    event: 'Canlı yayın veya online etkinlik odasıdır. Webinar/seminer gibi kullanılabilir.'
  };

  help.textContent = map[roomType] || map.casual;
}

function updateSmartRoomFields() {
  const roomType = getInputValue('roomType') || 'casual';

  const meetingFields = document.getElementById('meetingFields');
  const languageField = document.getElementById('languageField');
  const gameField = document.getElementById('gameField');

  const showMeeting = ['event', 'meet', 'voice'].includes(roomType);
  const showLanguage = roomType === 'language';
  const showGame = roomType === 'gaming';

  if (meetingFields) {
    meetingFields.classList.toggle('smart-hidden', !showMeeting);
  }

  if (languageField) {
    languageField.classList.toggle('smart-hidden', !showLanguage);
  }

  if (gameField) {
    gameField.classList.toggle('smart-hidden', !showGame);
  }

  const provider = document.getElementById('roomMeetingProvider');
  const meetingUrl = document.getElementById('roomMeetingUrl');

  if (showMeeting && provider && !provider.value) {
    provider.value = 'jitsi';
  }

  if (showMeeting && meetingUrl && !meetingUrl.value) {
    meetingUrl.placeholder = 'Boş bırakılırsa FriendZone otomatik güvenli Jitsi odası oluşturur.';
  }

  if (!showMeeting && provider) {
    provider.value = '';
  }

  if (!showMeeting && meetingUrl) {
    meetingUrl.value = '';
  }
}

function syncCategoryCardsWithType(roomType) {
  document.querySelectorAll('.room-category-card').forEach((button) => {
    const buttonType = button.dataset.roomType || '';
    button.classList.toggle('active', buttonType === (roomType || ''));
  });
}

function getLiveRoomUrl(roomId) {
  return `${window.location.origin}/live-room.html?id=${encodeURIComponent(roomId)}`;
}

async function copyRoomJoinLink(room) {
  if (!room || !room.id) {
    showToast('Kopyalanacak oda linki bulunamadı.', 'error');
    return;
  }

  const value = getLiveRoomUrl(room.id);

  try {
    await navigator.clipboard.writeText(value);
    showToast('FriendZone katılım linki kopyalandı.', 'success');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();

    showToast('FriendZone katılım linki kopyalandı.', 'success');
  }
}

function isSafeMeetingUrl(value) {
  if (!value) return false;

  const text = String(value).trim();

  if (!text) return false;

  if (['none', 'null', 'undefined', 'false', '#'].includes(text.toLowerCase())) {
    return false;
  }

  return text.startsWith('https://') || text.startsWith('http://');
}

function isLiveRoomCapable(room) {
  if (!room) return false;

  if (['event', 'meet', 'voice'].includes(room.room_type)) {
    return true;
  }
  return Boolean(room.meeting_provider || isSafeMeetingUrl(room.meeting_url));
}

async function openLiveRoom(room) {
  if (!room || !room.id) {
    showToast('Oda bilgisi bulunamadı.', 'error');
    return;
  }

  if (room.viewer_status !== 'joined') {
    const response = await authFetch(`${API_BASE}/api/rooms/${room.id}/join`, {
      method: 'POST'
    });

    if (!response || !response.success) {
      showToast(response?.message || 'Canlı odaya katılamadınız.', 'error');
      return;
    }
  }

  window.location.href = `live-room.html?id=${encodeURIComponent(room.id)}`;
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

function getLiveRoomActionText(room) {
  const map = {
    voice: 'Sesli Odaya Gir',
    meet: 'Video Meet’e Gir',
    event: 'Canlı Yayına Katıl'
  };

  return map[room?.room_type] || 'Canlı Odaya Gir';
}

function getLiveRoomShareText(room) {
  const map = {
    voice: 'Sesli Oda Linkini Kopyala',
    meet: 'Meet Linkini Kopyala',
    event: 'Yayın Linkini Kopyala'
  };

  return map[room?.room_type] || 'Link Kopyala';
}

function getRoomExperienceDescription(room) {
  const map = {
    voice: 'Bu oda sesli muhabbet için tasarlandı. Katılımcılar FriendZone içinden canlı konuşmaya katılabilir.',
    meet: 'Bu oda video görüşme için tasarlandı. Katılım linki paylaşılabilir ve görüşme FriendZone içinde açılır.',
    event: 'Bu oda online etkinlik veya canlı yayın için tasarlandı. Katılımcılar yayın linkiyle etkinliğe katılabilir.'
  };

  return map[room?.room_type] || 'Bu sosyal oda FriendZone içinde canlı etkileşim için kullanılabilir.';
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

function getMeetingProviderLabel(provider) {
  const map = {
    internal: 'Platform İçi',
    jitsi: 'Jitsi Meet',
    google_meet: 'Google Meet',
    zoom: 'Zoom',
    livekit: 'LiveKit',
    external: 'Harici Link'
  };

  return map[provider] || '-';
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

function formatRelativeTime(value) {
  if (!value) return 'Aktivite yok';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Aktivite yok';
  }

  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Az önce aktif';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} dk önce aktif`;
  }

  if (diffHours < 24) {
    return `${diffHours} saat önce aktif`;
  }

  if (diffDays < 7) {
    return `${diffDays} gün önce aktif`;
  }

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getRoomActivityClass(room) {
  if (room.is_live) return 'activity-live';

  if (!room.last_activity_at) return 'activity-stale';

  const date = new Date(room.last_activity_at);

  if (Number.isNaN(date.getTime())) return 'activity-stale';

  const diffHours = (new Date() - date) / (1000 * 60 * 60);

  if (diffHours < 1) return 'activity-recent';
  if (diffHours < 24) return 'activity-today';

  return 'activity-stale';
}

function getInitials(name) {
  return String(name || 'FZ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FZ';
}