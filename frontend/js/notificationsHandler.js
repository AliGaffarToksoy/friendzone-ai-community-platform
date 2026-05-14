let notificationsCache = [];
let activeStatusFilter = 'all';
let activeTypeFilter = 'all';
let notificationSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  ensureNotificationElements();
  bindNotificationEvents();

  await loadNotifications();
});

function ensureNotificationElements() {
  let list = document.getElementById('notificationsList');

  if (!list) {
    const main = document.querySelector('main') || document.body;

    list = document.createElement('div');
    list.id = 'notificationsList';
    list.className = 'notifications-list';

    main.appendChild(list);
  }

  injectNotificationPageStyles();
}

function bindNotificationEvents() {
  const refreshBtn =
    document.getElementById('refreshNotificationsBtn') ||
    findButtonByText(['Yenile']);

  const markAllBtn =
    document.getElementById('markAllReadBtn') ||
    findButtonByText(['Tümünü Okundu Yap', 'Tumunu Okundu Yap']);

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadNotifications);
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', markAllNotificationsAsRead);
  }

  bindStatusFilterButtons();
  bindSearchInput();
  bindTypeSelect();
}

function bindStatusFilterButtons() {
  const buttons = Array.from(document.querySelectorAll('button'));

  buttons.forEach((button) => {
    const text = normalizeNotificationText(button.textContent || '');

    if (text === 'tumu') {
      button.dataset.notificationStatusFilter = 'all';
      button.addEventListener('click', () => setStatusFilter('all'));
    }

    if (text === 'okunmamis') {
      button.dataset.notificationStatusFilter = 'unread';
      button.addEventListener('click', () => setStatusFilter('unread'));
    }

    if (text === 'okunmus') {
      button.dataset.notificationStatusFilter = 'read';
      button.addEventListener('click', () => setStatusFilter('read'));
    }
  });
}

function bindSearchInput() {
  const searchInput =
    document.getElementById('notificationSearchInput') ||
    document.getElementById('notificationsSearch') ||
    document.querySelector('input[placeholder*="Bildirim"]') ||
    document.querySelector('input[placeholder*="bildirim"]') ||
    document.querySelector('input[type="search"]');

  if (!searchInput) {
    return;
  }

  searchInput.addEventListener('input', () => {
    notificationSearchQuery = normalizeNotificationText(searchInput.value || '');
    renderNotifications();
  });
}

function bindTypeSelect() {
  const typeSelect =
    document.getElementById('notificationTypeFilter') ||
    document.getElementById('notificationsTypeFilter') ||
    findNotificationTypeSelect();

  if (!typeSelect) {
    return;
  }

  typeSelect.addEventListener('change', () => {
    activeTypeFilter = normalizeTypeFilterValue(typeSelect.value || typeSelect.options[typeSelect.selectedIndex]?.text || 'all');
    renderNotifications();
  });

  activeTypeFilter = normalizeTypeFilterValue(typeSelect.value || typeSelect.options[typeSelect.selectedIndex]?.text || 'all');
}

function findNotificationTypeSelect() {
  const selects = Array.from(document.querySelectorAll('select'));

  if (!selects.length) {
    return null;
  }

  return selects.find((select) => {
    const optionsText = Array.from(select.options)
      .map((option) => normalizeNotificationText(option.textContent || option.value || ''))
      .join(' ');

    return (
      optionsText.includes('rozet') ||
      optionsText.includes('sertifika') ||
      optionsText.includes('etkinlik') ||
      optionsText.includes('sponsor') ||
      optionsText.includes('topluluk') ||
      optionsText.includes('puan')
    );
  }) || selects[0];
}

function findButtonByText(textCandidates) {
  const normalizedCandidates = textCandidates.map((item) => normalizeNotificationText(item));

  return Array.from(document.querySelectorAll('button')).find((button) => {
    const text = normalizeNotificationText(button.textContent || '');
    return normalizedCandidates.includes(text);
  });
}

function setStatusFilter(status) {
  activeStatusFilter = status;

  const buttons = document.querySelectorAll('[data-notification-status-filter]');

  buttons.forEach((button) => {
    const isActive = button.dataset.notificationStatusFilter === status;
    button.classList.toggle('active', isActive);
  });

  renderNotifications();
}

async function loadNotifications() {
  const list = document.getElementById('notificationsList');

  if (list) {
    list.innerHTML = `
      <div class="notification-empty-state">
        <strong>Bildirimler yükleniyor...</strong>
        <span>Son aktiviteler getiriliyor.</span>
      </div>
    `;
  }

  const response = await authFetch(`${API_BASE}/api/notifications?limit=100`);

  if (!response || !response.success) {
    notificationsCache = [];
    renderNotifications();
    showToast(response?.message || 'Bildirimler yüklenemedi.', 'error');
    return;
  }

  notificationsCache = response.data?.items || [];

  renderNotifications();

  if (typeof setNotificationBadgeCount === 'function') {
    setNotificationBadgeCount(response.data?.unread_count || 0);
  }
}

function renderNotifications() {
  updateNotificationStats();

  const list = document.getElementById('notificationsList');

  if (!list) {
    return;
  }

  const filtered = getFilteredNotifications();

  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = `
      <div class="notification-empty-state">
        <strong>Bildirim bulunamadı</strong>
        <span>Seçili filtreye veya arama metnine uygun bildirim yok.</span>
      </div>
    `;
    return;
  }

  filtered.forEach((notification) => {
    list.appendChild(createNotificationCard(notification));
  });
}

function getFilteredNotifications() {
  return notificationsCache.filter((notification) => {
    if (activeStatusFilter === 'unread' && notification.is_read) {
      return false;
    }

    if (activeStatusFilter === 'read' && !notification.is_read) {
      return false;
    }

    if (!matchesTypeFilter(notification)) {
      return false;
    }

    if (!notificationSearchQuery) {
      return true;
    }

    const searchable = normalizeNotificationText([
      notification.title,
      notification.message,
      notification.notification_type,
      notification.reference_type,
      notification.reference_id,
    ].join(' '));

    return searchable.includes(notificationSearchQuery);
  });
}

function matchesTypeFilter(notification) {
  const type = notification.notification_type || '';
  const ref = notification.reference_type || '';

  if (!activeTypeFilter || activeTypeFilter === 'all' || activeTypeFilter === 'tum' || activeTypeFilter === 'tumu') {
    return true;
  }

  if (activeTypeFilter === 'points') {
    return type === 'points_added';
  }

  if (activeTypeFilter === 'badge' || activeTypeFilter === 'rozet') {
    return type === 'badge_awarded';
  }

  if (activeTypeFilter === 'certificate' || activeTypeFilter === 'sertifika') {
    return type === 'certificate_awarded';
  }

  if (activeTypeFilter === 'community' || activeTypeFilter === 'topluluk') {
    return type.includes('community') || ref.includes('community');
  }

  if (activeTypeFilter === 'event' || activeTypeFilter === 'etkinlik') {
    return type.includes('event') || ref.includes('event');
  }

  if (activeTypeFilter === 'sponsor') {
    return type.includes('sponsor') || ref.includes('sponsor');
  }

  if (activeTypeFilter === 'room' || activeTypeFilter === 'oda' || activeTypeFilter === 'sosyal-oda') {
    return type.includes('room');
  }

  return normalizeNotificationText(type).includes(activeTypeFilter);
}

function createNotificationCard(notification) {
  const card = document.createElement('article');
  card.className = notification.is_read ? 'notification-card' : 'notification-card unread';
  card.dataset.notificationId = notification.id;

  const icon = document.createElement('div');
  icon.className = 'notification-icon';
  icon.textContent = notification.icon || getNotificationTypeIcon(notification.notification_type);

  const content = document.createElement('div');
  content.className = 'notification-content';

  const title = document.createElement('strong');
  title.textContent = notification.title || 'Bildirim';

  const message = document.createElement('p');
  message.textContent = notification.message || '';

  const meta = document.createElement('div');
  meta.className = 'notification-meta';

  const typeChip = document.createElement('span');
  typeChip.className = 'notification-type-chip';
  typeChip.textContent = getNotificationTypeLabel(notification.notification_type);

  const date = document.createElement('span');
  date.textContent = formatNotificationDate(notification.created_at);

  const reference = document.createElement('span');
  reference.textContent = notification.reference_type ? `· ${notification.reference_type}` : '';

  meta.appendChild(typeChip);
  meta.appendChild(date);

  if (reference.textContent) {
    meta.appendChild(reference);
  }

  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  const readBtn = document.createElement('button');
  readBtn.type = 'button';
  readBtn.className = 'notification-action-btn';
  readBtn.textContent = '✓';
  readBtn.title = notification.is_read ? 'Zaten okundu' : 'Okundu yap';
  readBtn.disabled = Boolean(notification.is_read);

  readBtn.addEventListener('click', async (event) => {
    event.stopPropagation();

    if (!notification.is_read) {
      await markNotificationAsRead(notification.id, false);
    }
  });

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'notification-action-btn';
  openBtn.textContent = '↗';
  openBtn.title = 'Aç';

  openBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    await openNotification(notification);
  });

  const archiveBtn = document.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.className = 'notification-action-btn danger';
  archiveBtn.textContent = '×';
  archiveBtn.title = 'Arşivle';

  archiveBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    await archiveNotification(notification.id);
  });

  actions.appendChild(readBtn);
  actions.appendChild(openBtn);
  actions.appendChild(archiveBtn);

  card.appendChild(icon);
  card.appendChild(content);
  card.appendChild(actions);

  card.addEventListener('click', async () => {
    await openNotification(notification);
  });

  return card;
}

async function openNotification(notification) {
  if (!notification.is_read) {
    await markNotificationAsRead(notification.id, true);
  }

  if (notification.action_url) {
    window.location.href = notification.action_url;
  }
}

async function markNotificationAsRead(notificationId, silent = false) {
  const response = await callFirstSuccessfulEndpoint([
    {
      url: `${API_BASE}/api/notifications/${notificationId}/read`,
      options: { method: 'PATCH' },
    },
    {
      url: `${API_BASE}/api/notifications/${notificationId}/read`,
      options: { method: 'POST' },
    },
    {
      url: `${API_BASE}/api/notifications/${notificationId}`,
      options: {
        method: 'PATCH',
        body: JSON.stringify({ is_read: true }),
      },
    },
  ]);

  if (!response || !response.success) {
    if (!silent) {
      showToast(response?.message || 'Bildirim okundu yapılamadı.', 'error');
    }
    return;
  }

  notificationsCache = notificationsCache.map((notification) => {
    if (Number(notification.id) === Number(notificationId)) {
      return {
        ...notification,
        is_read: true,
        read_at: notification.read_at || new Date().toISOString(),
      };
    }

    return notification;
  });

  renderNotifications();
  refreshBadgeAfterLocalChange();

  if (!silent) {
    showToast('Bildirim okundu olarak işaretlendi.', 'success');
  }
}

async function markAllNotificationsAsRead() {
  const response = await callFirstSuccessfulEndpoint([
    {
      url: `${API_BASE}/api/notifications/read-all`,
      options: { method: 'PATCH' },
    },
    {
      url: `${API_BASE}/api/notifications/read-all`,
      options: { method: 'POST' },
    },
    {
      url: `${API_BASE}/api/notifications/mark-all-read`,
      options: { method: 'PATCH' },
    },
    {
      url: `${API_BASE}/api/notifications/mark-all-read`,
      options: { method: 'POST' },
    },
  ]);

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirimler okundu yapılamadı.', 'error');
    return;
  }

  notificationsCache = notificationsCache.map((notification) => ({
    ...notification,
    is_read: true,
    read_at: notification.read_at || new Date().toISOString(),
  }));

  renderNotifications();
  refreshBadgeAfterLocalChange();

  showToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
}

async function archiveNotification(notificationId) {
  const response = await callFirstSuccessfulEndpoint([
    {
      url: `${API_BASE}/api/notifications/${notificationId}/archive`,
      options: { method: 'PATCH' },
    },
    {
      url: `${API_BASE}/api/notifications/${notificationId}/archive`,
      options: { method: 'POST' },
    },
    {
      url: `${API_BASE}/api/notifications/${notificationId}`,
      options: { method: 'DELETE' },
    },
  ]);

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirim arşivlenemedi.', 'error');
    return;
  }

  notificationsCache = notificationsCache.filter(
    (notification) => Number(notification.id) !== Number(notificationId)
  );

  renderNotifications();
  refreshBadgeAfterLocalChange();

  showToast('Bildirim arşivlendi.', 'success');
}

async function callFirstSuccessfulEndpoint(candidates) {
  let lastResponse = null;

  for (const candidate of candidates) {
    const response = await authFetch(candidate.url, candidate.options);

    if (response && response.success) {
      return response;
    }

    lastResponse = response;
  }

  return lastResponse;
}

function updateNotificationStats() {
  const total = notificationsCache.length;
  const unread = notificationsCache.filter((item) => !item.is_read).length;
  const read = notificationsCache.filter((item) => item.is_read).length;
  const types = new Set(notificationsCache.map((item) => item.notification_type).filter(Boolean)).size;

  setStatCardValue(['toplam'], total);
  setStatCardValue(['okunmamis'], unread);
  setStatCardValue(['okunmus'], read);
  setStatCardValue(['turler', 'türler'], types);
}

function setStatCardValue(labelCandidates, value) {
  const normalizedCandidates = labelCandidates.map((item) => normalizeNotificationText(item));

  const cards = Array.from(document.querySelectorAll('section, article, div'));

  const card = cards.find((element) => {
    const text = normalizeNotificationText(element.textContent || '');

    return normalizedCandidates.some((candidate) => text.includes(candidate));
  });

  if (!card) {
    return;
  }

  const valueEl =
    card.querySelector('.stat-value') ||
    Array.from(card.querySelectorAll('strong, h2, h3, p, span')).find((child) => {
      const childText = normalizeNotificationText(child.textContent || '');
      return /^\d+$/.test(childText);
    });

  if (valueEl) {
    valueEl.textContent = String(value);
  }
}

function refreshBadgeAfterLocalChange() {
  const unread = notificationsCache.filter((notification) => !notification.is_read).length;

  if (typeof setNotificationBadgeCount === 'function') {
    setNotificationBadgeCount(unread);
    return;
  }

  if (typeof refreshNotificationBadge === 'function') {
    refreshNotificationBadge();
  }
}

function normalizeTypeFilterValue(value) {
  const normalized = normalizeNotificationText(value || '');

  const map = {
    '': 'all',
    all: 'all',
    tum: 'all',
    tumu: 'all',
    tumtipler: 'all',
    tumturler: 'all',
    bildirimtipi: 'all',
    bildirimturu: 'all',

    puan: 'points',
    points: 'points',
    point: 'points',
    pointsadded: 'points',

    rozet: 'badge',
    rozetler: 'badge',
    badge: 'badge',
    badges: 'badge',
    badgeawarded: 'badge',

    sertifika: 'certificate',
    sertifikalar: 'certificate',
    certificate: 'certificate',
    certificates: 'certificate',
    certificateawarded: 'certificate',

    topluluk: 'community',
    topluluklar: 'community',
    community: 'community',
    communities: 'community',

    etkinlik: 'event',
    etkinlikler: 'event',
    event: 'event',
    events: 'event',

    sponsor: 'sponsor',
    sponsorlar: 'sponsor',
    sponsorship: 'sponsor',

    sosyaloda: 'room',
    sosyalodalar: 'room',
    oda: 'room',
    odalar: 'room',
    room: 'room',
    rooms: 'room',
  };

  return map[normalized] || normalized || 'all';
}

function getNotificationTypeLabel(type) {
  const map = {
    points_added: 'Puan',
    badge_awarded: 'Rozet',
    certificate_awarded: 'Sertifika',
    community_joined: 'Topluluk',
    community_created: 'Topluluk',
    community_role_updated: 'Rol',
    event_created: 'Etkinlik',
    event_joined: 'Etkinlik',
    event_review_created: 'Değerlendirme',
    sponsor_added: 'Sponsor',
    community_sponsor_added: 'Sponsor',
    event_sponsor_added: 'Sponsor',
    social_room_created: 'Sosyal Oda',
    social_room_joined: 'Sosyal Oda',
    feed_post_created: 'Akış',
    feed_comment_created: 'Yorum',
    system: 'Sistem',
  };

  return map[type] || 'Bildirim';
}

function getNotificationTypeIcon(type) {
  const map = {
    points_added: '⭐',
    badge_awarded: '🏅',
    certificate_awarded: '🎓',
    community_joined: '🌐',
    community_created: '🌐',
    community_role_updated: '🛡️',
    event_created: '📅',
    event_joined: '✅',
    event_review_created: '💬',
    sponsor_added: '🤝',
    community_sponsor_added: '🤝',
    event_sponsor_added: '🤝',
    social_room_created: '🎙️',
    social_room_joined: '🎧',
    feed_post_created: '💡',
    feed_comment_created: '💬',
    system: '🔔',
  };

  return map[type] || '🔔';
}

function formatNotificationDate(value) {
  if (!value) {
    return 'Tarih yok';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeNotificationText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/\s+/g, '')
    .trim();
}

function injectNotificationPageStyles() {
  if (document.getElementById('notificationPageRuntimeStyles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'notificationPageRuntimeStyles';
  style.textContent = `
    [data-notification-status-filter] {
      cursor: pointer;
    }

    [data-notification-status-filter].active {
      border-color: rgba(99, 102, 241, 0.55) !important;
      background: rgba(99, 102, 241, 0.22) !important;
      color: #ffffff !important;
    }

    .notification-card {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: flex-start;
      gap: 14px;
      padding: 18px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.76);
      transition: 0.18s ease;
      cursor: pointer;
    }

    .notification-card:hover {
      transform: translateY(-1px);
      border-color: rgba(99, 102, 241, 0.34);
      background: rgba(15, 23, 42, 0.92);
    }

    .notification-card.unread {
      border-color: rgba(99, 102, 241, 0.46);
      background:
        linear-gradient(135deg, rgba(99, 102, 241, 0.13), rgba(15, 23, 42, 0.82)),
        rgba(15, 23, 42, 0.84);
    }

    .notification-icon {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(99, 102, 241, 0.14);
      font-size: 22px;
    }

    .notification-content strong {
      display: block;
      margin-bottom: 6px;
      color: #f8fafc;
      font-size: 15px;
    }

    .notification-content p {
      margin: 0;
      color: rgba(226, 232, 240, 0.76);
      font-size: 14px;
      line-height: 1.55;
    }

    .notification-meta {
      margin-top: 9px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      color: rgba(148, 163, 184, 0.86);
      font-size: 12px;
    }

    .notification-type-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(148, 163, 184, 0.12);
      color: rgba(226, 232, 240, 0.82);
      font-size: 11px;
      font-weight: 800;
    }

    .notification-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .notification-action-btn {
      min-width: 36px;
      min-height: 36px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.28);
      color: rgba(226, 232, 240, 0.78);
      cursor: pointer;
      font-weight: 900;
    }

    .notification-action-btn:hover {
      background: rgba(99, 102, 241, 0.18);
      color: #ffffff;
    }

    .notification-action-btn.danger:hover {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.32);
    }

    .notification-empty-state {
      padding: 34px 22px;
      border: 1px dashed rgba(148, 163, 184, 0.24);
      border-radius: 24px;
      text-align: center;
      color: rgba(226, 232, 240, 0.76);
      background: rgba(15, 23, 42, 0.52);
    }

    .notification-empty-state strong {
      display: block;
      margin-bottom: 8px;
      color: #f8fafc;
      font-size: 18px;
    }

    @media (max-width: 760px) {
      .notification-card {
        grid-template-columns: auto 1fr;
      }

      .notification-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
      }
    }
  `;

  document.head.appendChild(style);
}