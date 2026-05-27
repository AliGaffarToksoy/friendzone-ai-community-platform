let liveRoomId = null;
let liveRoomCache = null;
let jitsiApi = null;
let jitsiParticipants = [];
let friendZoneParticipants = [];
let participantsInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    logout();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  liveRoomId = params.get('id');

  if (!liveRoomId) {
    showToast('Canlı oda ID bilgisi bulunamadı.', 'error');
    setFrameState('Canlı oda bulunamadı. Sosyal odalara geri dönebilirsin.');
    return;
  }

  bindLiveRoomEvents();

  try {
    await ensureLiveRoomJoined();
    await loadLiveRoom();

    participantsInterval = setInterval(async () => {
      await ensureLiveRoomJoined();
      await loadParticipants();
      await refreshLiveRoomMeta();
      updateJitsiParticipants();
    }, 8000);
  } catch (error) {
    console.error('Live room init error:', error);
    showToast('Canlı oda başlatılırken hata oluştu.', 'error');
    setFrameState(`Canlı oda başlatılamadı: ${error.message}`);
  }
});

function bindLiveRoomEvents() {
  const refreshBtn = document.getElementById('refreshLiveRoomBtn');
  const leaveBtn = document.getElementById('leaveLiveRoomBtn');
  const copyTopBtn = document.getElementById('copyLiveRoomLinkBtn');
  const copyFriendZoneBtn = document.getElementById('copyFriendZoneJoinLinkBtn');
  const copyJitsiBtn = document.getElementById('copyJitsiJoinLinkBtn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadLiveRoom();
      showToast('Canlı oda yenilendi.', 'success');
    });
  }

  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => leaveLiveRoom(true));
  }

  if (copyTopBtn) {
    copyTopBtn.addEventListener('click', () => copyText(getFriendZoneJoinUrl(), 'Katılım linki kopyalandı.'));
  }

  if (copyFriendZoneBtn) {
    copyFriendZoneBtn.addEventListener('click', () => copyText(getFriendZoneJoinUrl(), 'FriendZone katılım linki kopyalandı.'));
  }

  if (copyJitsiBtn) {
    copyJitsiBtn.addEventListener('click', () => {
      const url = getSafeMeetingUrl(liveRoomCache);
      copyText(url, 'Jitsi linki kopyalandı.');
    });
  }

  window.addEventListener('beforeunload', () => {
    if (participantsInterval) {
      clearInterval(participantsInterval);
    }

    if (jitsiApi) {
      try {
        jitsiApi.dispose();
      } catch (error) {
        console.warn('Jitsi dispose error:', error);
      }
    }
  });
}

async function ensureLiveRoomJoined() {
  if (!liveRoomId) return;

  const response = await authFetch(`${API_BASE}/api/rooms/${liveRoomId}/join`, {
    method: 'POST'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Canlı odaya katılım kaydı oluşturulamadı.', 'error');
  }
}

async function loadLiveRoom() {
  setFrameState('Canlı oda bilgileri yükleniyor...');

  const response = await authFetch(`${API_BASE}/api/rooms/${liveRoomId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Canlı oda yüklenemedi.', 'error');
    setFrameState(response?.message || 'Canlı oda yüklenemedi.');
    return;
  }

  liveRoomCache = response.data;

  renderLiveRoom(liveRoomCache);
  await loadParticipants();
}

async function refreshLiveRoomMeta() {
  if (!liveRoomId) return;

  const response = await authFetch(`${API_BASE}/api/rooms/${liveRoomId}`);

  if (!response || !response.success) {
    return;
  }

  liveRoomCache = response.data;
  renderLiveRoomMetaOnly(liveRoomCache);
  renderJoinLinks(liveRoomCache);
}

function renderLiveRoom(room) {
  const title = document.getElementById('liveRoomTitle');
  const subtitle = document.getElementById('liveRoomSubtitle');
  const experienceBadge = document.getElementById('liveRoomExperienceBadge');

  if (experienceBadge) {
    experienceBadge.textContent = getLiveExperienceBadgeText(room);
    experienceBadge.className = `live-room-experience-badge type-${room.room_type || 'default'}`;
  }

  if (title) {
    title.textContent = room.name || 'Canlı Oda';
  }

  if (subtitle) {
    subtitle.textContent = [
      getRoomTypeLabel(room.room_type),
      room.community_name,
      room.event_title,
      room.creator_name ? `Oluşturan: ${room.creator_name}` : ''
    ].filter(Boolean).join(' · ') || 'FriendZone canlı oda';
  }

  renderLiveRoomMetaOnly(room);
  renderJoinLinks(room);
  renderMeetingFrame(room);
}

function renderLiveRoomMetaOnly(room) {
  const meta = document.getElementById('liveRoomMeta');

  if (!meta || !room) return;

  const jitsiCount = jitsiParticipants.length || 0;
  const fzCount = friendZoneParticipants.length || room.current_participants || 0;
  const guestCount = Math.max(0, jitsiCount - fzCount);

  meta.innerHTML = '';

  meta.appendChild(createMetaItem('Durum', room.is_live ? 'Canlı' : 'Hazır'));
  meta.appendChild(createMetaItem('Oda Tipi', getRoomTypeLabel(room.room_type)));
  meta.appendChild(createMetaItem('Görünürlük', getVisibilityLabel(room.visibility)));
  meta.appendChild(createMetaItem('FriendZone Katılımcı', `${fzCount}/${room.max_participants || 0}`));
  meta.appendChild(createMetaItem(getLiveConnectionLabel(room), `${jitsiCount} kişi`));
  meta.appendChild(createMetaItem('Misafir', `${guestCount} kişi`));
  meta.appendChild(createMetaItem('Topluluk', room.community_name || '-'));
  meta.appendChild(createMetaItem('Sağlayıcı', getMeetingProviderLabel(room.meeting_provider)));
  meta.appendChild(createMetaItem('Deneyim', getLiveExperienceLabel(room)));

  if (room.room_type === 'event') {
    meta.appendChild(createMetaItem('Yayın Modu', 'Online etkinlik / webinar'));
  }

  updateParticipantCountLabel();
}

function renderJoinLinks(room) {
  const friendZoneInput = document.getElementById('friendZoneJoinLink');
  const jitsiInput = document.getElementById('jitsiJoinLink');

  if (friendZoneInput) {
    friendZoneInput.value = getFriendZoneJoinUrl();
  }

  if (jitsiInput) {
    jitsiInput.value = getSafeMeetingUrl(room) || 'Jitsi linki bulunamadı';
  }
}

function renderMeetingFrame(room) {
  const container = document.getElementById('jitsiContainer');

  if (!container) return;

  const meetingUrl = getSafeMeetingUrl(room);

  if (!meetingUrl) {
    container.classList.add('hidden');
    setFrameState('Bu oda için geçerli bir canlı görüşme bağlantısı bulunamadı.');
    return;
  }

  if (jitsiApi || container.querySelector('iframe')) {
    setFrameState('');
    return;
  }

  const roomName = extractJitsiRoomName(meetingUrl);

  if (!roomName) {
    renderIframeFallback(container, meetingUrl);
    return;
  }

  container.classList.remove('hidden');
  setFrameState('');

  if (typeof JitsiMeetExternalAPI === 'undefined') {
    console.warn('JitsiMeetExternalAPI yüklenemedi. Iframe fallback kullanılacak.');
    renderIframeFallback(container, meetingUrl);
    return;
  }

  const currentUser = getCurrentUserFromStorage();

  try {
    jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
      roomName,
      parentNode: container,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: currentUser?.name || 'FriendZone Kullanıcısı',
        email: currentUser?.email || undefined
      },
      configOverwrite: buildJitsiConfig(room),
      interfaceConfigOverwrite: buildJitsiInterfaceConfig(room)
    });

    jitsiApi.addListener('videoConferenceJoined', async () => {
      await ensureLiveRoomJoined();
      await loadParticipants();
      updateJitsiParticipants();
      await enforceVoiceOnlyMode(room);
    });

    jitsiApi.addListener('participantJoined', () => {
      setTimeout(updateJitsiParticipants, 500);
      setTimeout(() => enforceVoiceOnlyMode(room), 700);
    });

    jitsiApi.addListener('participantLeft', () => {
      setTimeout(updateJitsiParticipants, 800);
    });

    jitsiApi.addListener('displayNameChange', () => {
      setTimeout(updateJitsiParticipants, 600);
    });

    jitsiApi.addListener('readyToClose', async () => {
      await leaveLiveRoom(false);
    });

    setTimeout(updateJitsiParticipants, 1400);
  } catch (error) {
    console.error('Jitsi API init error:', error);
    renderIframeFallback(container, meetingUrl);
  }
}

function buildJitsiConfig(room) {
  const isVoiceRoom = room?.room_type === 'voice';
  const isEventRoom = room?.room_type === 'event';

  return {
    prejoinPageEnabled: false,
    disableDeepLinking: true,
    enableWelcomePage: false,
    enableClosePage: false,
    disableInviteFunctions: false,
    toolbarButtons: buildJitsiToolbarButtons(room),

    startWithAudioMuted: isEventRoom,
    startWithVideoMuted: isVoiceRoom ? true : false,

    ...(isVoiceRoom ? {
      startAudioOnly: true,
      startWithVideoMuted: true,
      disableInitialGUM: false,
      enableNoisyMicDetection: true,
      disableSimulcast: true,
      disableLocalVideoFlip: true,
      constraints: {
        video: false,
        audio: true
      }
    } : {}),

    ...(isEventRoom ? {
      startAudioOnly: false,
      startWithAudioMuted: true,
      startWithVideoMuted: false,
      enableLayerSuspension: true,
      enableNoisyMicDetection: true
    } : {})
  };
}

function buildJitsiInterfaceConfig(room) {
  return {
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    DEFAULT_REMOTE_DISPLAY_NAME: 'FriendZone Katılımcısı',
    TOOLBAR_BUTTONS: buildJitsiToolbarButtons(room)
  };
}

function buildJitsiToolbarButtons(room) {
  if (room?.room_type === 'voice') {
    return [
      'microphone',
      'hangup',
      'chat',
      'raisehand',
      'settings'
    ];
  }

  if (room?.room_type === 'event') {
    return [
      'microphone',
      'camera',
      'desktop',
      'fullscreen',
      'hangup',
      'chat',
      'raisehand',
      'tileview',
      'settings',
      'videoquality'
    ];
  }

  return [
    'microphone',
    'camera',
    'desktop',
    'fullscreen',
    'fodeviceselection',
    'hangup',
    'chat',
    'raisehand',
    'tileview',
    'settings',
    'videoquality'
  ];
}

async function enforceVoiceOnlyMode(room) {
  if (!jitsiApi || room?.room_type !== 'voice') return;

  try {
    if (typeof jitsiApi.isVideoMuted === 'function') {
      const isMuted = await jitsiApi.isVideoMuted();

      if (!isMuted) {
        jitsiApi.executeCommand('toggleVideo');
      }
    } else {
      jitsiApi.executeCommand('toggleVideo');
    }

    if (typeof jitsiApi.executeCommand === 'function') {
      jitsiApi.executeCommand('setTileView', true);
    }
  } catch (error) {
    console.warn('Voice-only video enforcement failed:', error);
  }
}

function renderIframeFallback(container, meetingUrl) {
  container.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = meetingUrl;
  iframe.allow = 'camera; microphone; fullscreen; display-capture; autoplay';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.className = 'live-room-jitsi-fallback-frame';

  container.appendChild(iframe);
  container.classList.remove('hidden');

  setFrameState('');
}

function updateJitsiParticipants() {
  if (!jitsiApi) return;

  try {
    const participants = jitsiApi.getParticipantsInfo() || [];
    jitsiParticipants = normalizeJitsiParticipants(participants);

    renderLiveRoomMetaOnly(liveRoomCache);
    renderParticipants(friendZoneParticipants);
  } catch (error) {
    console.warn('Jitsi participants could not be read:', error);
  }
}

function normalizeJitsiParticipants(participants) {
  return (participants || []).map((participant, index) => {
    return {
      id: participant.participantId || participant.id || `jitsi-${index}`,
      displayName: participant.displayName || participant.formattedDisplayName || 'Jitsi Misafiri',
      avatarURL: participant.avatarURL || null,
      email: participant.email || null
    };
  });
}

function updateParticipantCountLabel() {
  const count = document.getElementById('liveRoomParticipantCount');

  if (!count) return;

  const fzCount = friendZoneParticipants.length || liveRoomCache?.current_participants || 0;
  const jitsiCount = jitsiParticipants.length || 0;
  const guestCount = Math.max(0, jitsiCount - fzCount);

  count.textContent = `${fzCount} FZ · ${jitsiCount} Jitsi · ${guestCount} misafir`;
}

function getFriendZoneJoinUrl() {
  return `${window.location.origin}/live-room.html?id=${encodeURIComponent(liveRoomId || '')}`;
}

function getSafeMeetingUrl(room) {
  const rawUrl = room?.meeting_url ? String(room.meeting_url).trim() : '';

  if (
    rawUrl &&
    !['none', 'null', 'undefined', 'false', '#'].includes(rawUrl.toLowerCase()) &&
    (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))
  ) {
    return rawUrl;
  }

  if (['event', 'meet', 'voice'].includes(room?.room_type)) {
    const slug = slugify(`${room.name || 'friendzone-room'}-${room.id}`);
    return `https://meet.jit.si/friendzone-${slug}`;
  }

  return null;
}

function extractJitsiRoomName(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (!host.includes('meet.jit.si')) {
      return null;
    }

    return parsed.pathname.replace(/^\/+/, '').split('?')[0].trim();
  } catch (error) {
    return null;
  }
}

async function loadParticipants() {
  const response = await authFetch(`${API_BASE}/api/rooms/${liveRoomId}/participants`);

  if (!response || !response.success) {
    friendZoneParticipants = [];
    renderParticipants([]);
    return;
  }

  friendZoneParticipants = response.data || [];
  renderParticipants(friendZoneParticipants);
}

function renderParticipants(participants) {
  const list = document.getElementById('liveRoomParticipants');

  updateParticipantCountLabel();

  if (!list) return;

  list.innerHTML = '';

  const section = document.createElement('div');
  section.className = 'live-room-participant-section';

  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'live-room-section-title';
  sectionTitle.innerHTML = `
    <strong>${getFriendZoneParticipantSectionTitle()}</strong>
    <span>${participants.length} kişi</span>
  `;

  section.appendChild(sectionTitle);

  if (!participants.length) {
    section.innerHTML += `
      <div class="live-room-empty">
        Bu odada FriendZone hesabıyla aktif katılımcı yok.
      </div>
    `;
  } else {
    participants.forEach((participant) => {
      section.appendChild(createFriendZoneParticipantCard(participant));
    });
  }

  list.appendChild(section);

  const guests = getJitsiGuests(participants);

  const guestSection = document.createElement('div');
  guestSection.className = 'live-room-participant-section';

  const guestTitle = document.createElement('div');
  guestTitle.className = 'live-room-section-title';
  guestTitle.innerHTML = `
    <strong>${getGuestParticipantSectionTitle()}</strong>
    <span>${guests.length} kişi</span>
  `;

  guestSection.appendChild(guestTitle);

  if (!guests.length) {
    guestSection.innerHTML += `
      <div class="live-room-empty">
        FriendZone dışı misafir bulunmuyor.
      </div>
    `;
  } else {
    guests.forEach((guest) => {
      guestSection.appendChild(createJitsiGuestCard(guest));
    });
  }

  list.appendChild(guestSection);
}

function getFriendZoneParticipantSectionTitle() {
  if (liveRoomCache?.room_type === 'event') {
    return 'FriendZone Katılımcıları / İzleyiciler';
  }

  return 'FriendZone Katılımcıları';
}

function getGuestParticipantSectionTitle() {
  if (liveRoomCache?.room_type === 'event') {
    return 'Jitsi Misafir İzleyiciler';
  }

  return 'Jitsi Misafirleri';
}

function createFriendZoneParticipantCard(participant) {
  const user = participant.user || {};

  const item = document.createElement('article');
  item.className = 'live-room-participant';

  const avatar = document.createElement('div');
  avatar.className = 'live-room-avatar';
  avatar.textContent = getInitials(user.name || 'FZ');

  const info = document.createElement('div');
  info.className = 'live-room-participant-info';

  const nameRow = document.createElement('div');
  nameRow.className = 'live-room-name-row';

  const name = document.createElement('strong');
  name.textContent = user.name || 'FriendZone Kullanıcısı';

  const badge = document.createElement('span');
  badge.className = `live-room-role-badge role-${participant.display_role || participant.role || 'participant'}`;
  badge.textContent = getParticipantRoleLabel(participant);

  nameRow.appendChild(name);
  nameRow.appendChild(badge);

  const meta = document.createElement('span');
  meta.textContent = [
    user.university,
    user.department
  ].filter(Boolean).join(' · ') || 'Profil bilgisi yok';

  info.appendChild(nameRow);
  info.appendChild(meta);

  item.appendChild(avatar);
  item.appendChild(info);

  return item;
}

function createJitsiGuestCard(guest) {
  const item = document.createElement('article');
  item.className = 'live-room-participant guest';

  const avatar = document.createElement('div');
  avatar.className = 'live-room-avatar guest';
  avatar.textContent = getInitials(guest.displayName || 'JM');

  const info = document.createElement('div');
  info.className = 'live-room-participant-info';

  const nameRow = document.createElement('div');
  nameRow.className = 'live-room-name-row';

  const name = document.createElement('strong');
  name.textContent = guest.displayName || 'Jitsi Misafiri';

  const badge = document.createElement('span');
  badge.className = 'live-room-role-badge role-guest';
  badge.textContent = 'Misafir';

  nameRow.appendChild(name);
  nameRow.appendChild(badge);

  const meta = document.createElement('span');
  meta.textContent = 'Jitsi üzerinden bağlı · FriendZone hesabı eşleşmedi';

  info.appendChild(nameRow);
  info.appendChild(meta);

  item.appendChild(avatar);
  item.appendChild(info);

  return item;
}

function getJitsiGuests(friendZoneItems) {
  const friendZoneNames = new Set(
    (friendZoneItems || [])
      .map((item) => normalizeName(item?.user?.name))
      .filter(Boolean)
  );

  return (jitsiParticipants || []).filter((participant) => {
    const displayName = normalizeName(participant.displayName);

    if (!displayName) {
      return true;
    }

    return !friendZoneNames.has(displayName);
  });
}

async function leaveLiveRoom(redirect = true) {
  if (!liveRoomId) return;

  if (jitsiApi) {
    try {
      jitsiApi.dispose();
      jitsiApi = null;
    } catch (error) {
      console.warn('Jitsi dispose error:', error);
    }
  }

  const response = await authFetch(`${API_BASE}/api/rooms/${liveRoomId}/leave`, {
    method: 'POST'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Odadan ayrılma işlemi tamamlanamadı.', 'error');
    return;
  }

  showToast('Odadan ayrıldın.', 'success');

  if (redirect) {
    setTimeout(() => {
      window.location.href = 'rooms.html';
    }, 700);
  }
}

async function copyText(value, successMessage) {
  if (!value) {
    showToast('Kopyalanacak link bulunamadı.', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage || 'Link kopyalandı.', 'success');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();

    showToast(successMessage || 'Link kopyalandı.', 'success');
  }
}

function setFrameState(message) {
  const state = document.getElementById('liveRoomFrameState');

  if (!state) return;

  if (!message) {
    state.classList.add('hidden');
    state.textContent = '';
    return;
  }

  state.classList.remove('hidden');
  state.textContent = message;
}

function createMetaItem(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value || '-';

  item.appendChild(span);
  item.appendChild(strong);

  return item;
}

function getLiveExperienceBadgeText(room) {
  const map = {
    voice: '🎙️ Sesli Muhabbet Odası',
    meet: '🎥 Video Meet Odası',
    event: '📡 Canlı Yayın / Online Etkinlik'
  };

  return map[room?.room_type] || '✨ Canlı Sosyal Oda';
}

function getLiveConnectionLabel(room) {
  const map = {
    voice: 'Ses Bağlantısı',
    meet: 'Video Bağlantısı',
    event: 'Yayın Bağlantısı'
  };

  return map[room?.room_type] || 'Jitsi Bağlantısı';
}

function getLiveExperienceLabel(room) {
  const map = {
    voice: 'Sesli muhabbet odası · kamera kapalı başlar',
    meet: 'Video görüşme odası',
    event: 'Canlı yayın / online etkinlik · mikrofon kapalı başlar'
  };

  return map[room?.room_type] || 'Canlı sosyal oda';
}

function getRoomTypeLabel(type) {
  const map = {
    casual: 'Sohbet',
    language: 'Dil Pratiği',
    gaming: 'Oyun',
    study: 'Ders Çalışma',
    event: 'Etkinlik',
    voice: 'Sesli Oda',
    meet: 'Video Meet'
  };

  return map[type] || 'Sosyal Oda';
}

function getVisibilityLabel(visibility) {
  const map = {
    public: 'Herkese Açık',
    community: 'Topluluk',
    private: 'Özel'
  };

  return map[visibility] || 'Topluluk';
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

  return map[provider] || 'Jitsi Meet';
}

function getParticipantRoleLabel(participant) {
  const role = participant?.display_role || participant?.role || 'participant';

  const map = {
    host: 'Host',
    admin: 'Topluluk Admini',
    moderator: 'Moderatör',
    participant: 'Katılımcı'
  };

  return map[role] || 'Katılımcı';
}

function getCurrentUserFromStorage() {
  try {
    const user = JSON.parse(localStorage.getItem('friendzone_user') || '{}');

    if (user && Object.keys(user).length) {
      return user;
    }
  } catch (error) {
    console.warn('User storage parse error:', error);
  }

  return {
    name: localStorage.getItem('user_name') || '',
    email: localStorage.getItem('user_email') || ''
  };
}

function slugify(value) {
  return String(value || 'friendzone-room')
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'friendzone-room';
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getInitials(name) {
  return String(name || 'FZ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FZ';
}
