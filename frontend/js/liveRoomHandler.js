let liveRoomId = null;
let liveRoomCache = null;
let jitsiApi = null;
let jitsiParticipants = [];

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

  await ensureLiveRoomJoined();
  await loadLiveRoom();

  setInterval(async () => {
    await ensureLiveRoomJoined();
    await loadParticipants();
    await refreshLiveRoomMeta();
  }, 8000);
});

function bindLiveRoomEvents() {
  const refreshBtn = document.getElementById('refreshLiveRoomBtn');
  const leaveBtn = document.getElementById('leaveLiveRoomBtn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadLiveRoom();
      showToast('Canlı oda yenilendi.', 'success');
    });
  }

  if (leaveBtn) {
    leaveBtn.addEventListener('click', leaveLiveRoom);
  }

  window.addEventListener('beforeunload', () => {
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
}

function renderLiveRoom(room) {
  const title = document.getElementById('liveRoomTitle');
  const subtitle = document.getElementById('liveRoomSubtitle');

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
  renderMeetingFrame(room);
}

function renderLiveRoomMetaOnly(room) {
  const meta = document.getElementById('liveRoomMeta');

  if (!meta || !room) return;

  meta.innerHTML = '';

  meta.appendChild(createMetaItem('Durum', room.is_live ? 'Canlı' : 'Hazır'));
  meta.appendChild(createMetaItem('Oda Tipi', getRoomTypeLabel(room.room_type)));
  meta.appendChild(createMetaItem('Görünürlük', getVisibilityLabel(room.visibility)));
  meta.appendChild(createMetaItem('FriendZone Katılımcı', `${room.current_participants || 0}/${room.max_participants || 0}`));
  meta.appendChild(createMetaItem('Jitsi Katılımcı', `${jitsiParticipants.length || 0} kişi`));
  meta.appendChild(createMetaItem('Topluluk', room.community_name || '-'));
  meta.appendChild(createMetaItem('Sağlayıcı', getMeetingProviderLabel(room.meeting_provider)));
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

  if (jitsiApi) {
    return;
  }

  const roomName = extractJitsiRoomName(meetingUrl);

  if (!roomName) {
    container.classList.add('hidden');
    setFrameState('Jitsi oda adı çözümlenemedi.');
    return;
  }

  container.classList.remove('hidden');
  setFrameState('');

  const parentNode = container;

  const currentUser = getCurrentUserFromStorage();

  jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
    roomName,
    parentNode,
    width: '100%',
    height: '100%',
    userInfo: {
      displayName: currentUser?.name || 'FriendZone Kullanıcısı',
      email: currentUser?.email || undefined
    },
    configOverwrite: {
      prejoinPageEnabled: false,
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      disableDeepLinking: true
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DEFAULT_REMOTE_DISPLAY_NAME: 'FriendZone Katılımcısı',
      TOOLBAR_BUTTONS: [
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
      ]
    }
  });

  jitsiApi.addListener('videoConferenceJoined', async () => {
    await ensureLiveRoomJoined();
    updateJitsiParticipants();
  });

  jitsiApi.addListener('participantJoined', () => {
    updateJitsiParticipants();
  });

  jitsiApi.addListener('participantLeft', () => {
    setTimeout(updateJitsiParticipants, 500);
  });

  jitsiApi.addListener('readyToClose', async () => {
    await leaveLiveRoom(false);
  });

  setTimeout(updateJitsiParticipants, 1200);
}

function updateJitsiParticipants() {
  if (!jitsiApi) return;

  try {
    const participants = jitsiApi.getParticipantsInfo() || [];
    jitsiParticipants = participants;

    renderLiveRoomMetaOnly(liveRoomCache);
    updateJitsiParticipantCountLabel();
  } catch (error) {
    console.warn('Jitsi participants could not be read:', error);
  }
}

function updateJitsiParticipantCountLabel() {
  const count = document.getElementById('liveRoomParticipantCount');

  if (count) {
    const friendZoneCount = liveRoomCache?.current_participants || 0;
    count.textContent = `${friendZoneCount} FZ · ${jitsiParticipants.length || 0} Jitsi`;
  }
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
    renderParticipants([]);
    return;
  }

  renderParticipants(response.data || []);
}

function renderParticipants(participants) {
  const list = document.getElementById('liveRoomParticipants');
  const count = document.getElementById('liveRoomParticipantCount');

  if (count) {
    count.textContent = `${participants.length} FZ · ${jitsiParticipants.length || 0} Jitsi`;
  }

  if (!list) return;

  list.innerHTML = '';

  if (!participants.length) {
    list.innerHTML = `
      <div class="live-room-empty">
        Bu odada FriendZone hesabıyla aktif katılımcı yok.
      </div>
    `;
    return;
  }

  participants.forEach((participant) => {
    const user = participant.user || {};

    const item = document.createElement('article');
    item.className = 'live-room-participant';

    const avatar = document.createElement('div');
    avatar.className = 'live-room-avatar';
    avatar.textContent = getInitials(user.name || 'FZ');

    const info = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = user.name || 'FriendZone Kullanıcısı';

    const meta = document.createElement('span');
    meta.textContent = [
      getParticipantRoleLabel(participant),
      user.university,
      user.department
    ].filter(Boolean).join(' · ') || 'Katılımcı';

    info.appendChild(name);
    info.appendChild(meta);

    item.appendChild(avatar);
    item.appendChild(info);

    list.appendChild(item);
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

function getInitials(name) {
  return String(name || 'FZ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FZ';
}
