let notificationsCache = [];
let userWarningsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    logout();
    return;
  }

  bindNotificationPageEvents();

  await Promise.all([
    loadNotifications(),
    loadUserWarnings(),
  ]);
});

function bindNotificationPageEvents() {
  const refreshNotificationsBtn = document.getElementById('refreshNotificationsBtn');
  const markAllReadBtn = document.getElementById('markAllNotificationsReadBtn');
  const refreshWarningsBtn = document.getElementById('refreshWarningsBtn');
  const statusFilter = document.getElementById('notificationStatusFilter');
  const typeFilter = document.getElementById('notificationTypeFilter');

  if (refreshNotificationsBtn) {
    refreshNotificationsBtn.addEventListener('click', async () => {
      await loadNotifications();
      showToast('Bildirimler yenilendi.', 'success');
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
  }

  if (refreshWarningsBtn) {
    refreshWarningsBtn.addEventListener('click', async () => {
      await loadUserWarnings();
      showToast('Moderasyon uyarıları yenilendi.', 'success');
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', renderNotifications);
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', renderNotifications);
  }
}

async function loadNotifications() {
  const container = document.getElementById('notificationsList');

  if (container) {
    container.innerHTML = `
      <div class="notification-empty-state">
        Bildirimler yükleniyor...
      </div>
    `;
  }

  const response = await authFetch(`${API_BASE}/api/notifications?limit=100`);

  if (!response || !response.success) {
    if (container) {
      container.innerHTML = `
        <div class="notification-empty-state">
          Bildirimler alınamadı.
        </div>
      `;
    }

    return;
  }

  notificationsCache = response.data?.items || [];

  renderNotificationStats(response.data || {});
  renderNotifications();
}

function renderNotificationStats(payload = {}) {
  const totalCount = notificationsCache.length;
  const unreadCount = Number(payload.unread_count ?? notificationsCache.filter((item) => !item.is_read).length);
  const moderationCount = notificationsCache.filter((item) => {
    return item.notification_type === 'moderation_action';
  }).length;

  setText('totalNotificationCount', totalCount);
  setText('unreadNotificationCount', unreadCount);
  setText('warningNotificationCount', moderationCount);
}

function renderNotifications() {
  const container = document.getElementById('notificationsList');

  if (!container) {
    return;
  }

  const statusFilter = document.getElementById('notificationStatusFilter')?.value || '';
  const typeFilter = document.getElementById('notificationTypeFilter')?.value || '';

  let filtered = [...notificationsCache];

  if (statusFilter === 'unread') {
    filtered = filtered.filter((item) => !item.is_read);
  }

  if (statusFilter === 'read') {
    filtered = filtered.filter((item) => item.is_read);
  }

  if (typeFilter) {
    filtered = filtered.filter((item) => item.notification_type === typeFilter);
  }

  container.innerHTML = '';

  if (!filtered.length) {
    container.innerHTML = `
      <div class="notification-empty-state">
        Bu filtrelere uygun bildirim bulunamadı.
      </div>
    `;
    return;
  }

  filtered.forEach((notification) => {
    container.appendChild(createNotificationCard(notification));
  });
}

function createNotificationCard(notification) {
  const card = document.createElement('article');

  card.className = notification.is_read
    ? 'notification-card'
    : 'notification-card unread';

  const icon = document.createElement('div');
  icon.className = 'notification-card-icon';
  icon.textContent = notification.icon || getNotificationIcon(notification.notification_type);

  const body = document.createElement('div');
  body.className = 'notification-card-body';

  const top = document.createElement('div');
  top.className = 'notification-card-top';

  const titleWrap = document.createElement('div');

  const type = document.createElement('span');
  type.className = `notification-type-pill ${notification.notification_type || 'system'}`;
  type.textContent = getNotificationTypeLabel(notification.notification_type);

  const title = document.createElement('h3');
  title.textContent = notification.title || 'Bildirim';

  titleWrap.appendChild(type);
  titleWrap.appendChild(title);

  const date = document.createElement('time');
  date.textContent = formatNotificationDate(notification.created_at);

  top.appendChild(titleWrap);
  top.appendChild(date);

  const message = document.createElement('p');
  message.textContent = notification.message || '';

  const footer = document.createElement('div');
  footer.className = 'notification-card-footer';

  const status = document.createElement('span');
  status.className = notification.is_read
    ? 'notification-read-status read'
    : 'notification-read-status unread';

  status.textContent = notification.is_read ? 'Okundu' : 'Okunmamış';

  footer.appendChild(status);

  const actions = document.createElement('div');
  actions.className = 'notification-card-actions';

  if (!notification.is_read) {
    const readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'secondary-action mini-notification-action';
    readBtn.textContent = 'Okundu Yap';

    readBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await markNotificationAsRead(notification.id);
    });

    actions.appendChild(readBtn);
  }

  if (notification.action_url) {
    const goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'primary-action mini-notification-action';
    goBtn.textContent = 'Git';

    goBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!notification.is_read) {
        await markNotificationAsRead(notification.id, false);
      }

      window.location.href = notification.action_url;
    });

    actions.appendChild(goBtn);
  }

  footer.appendChild(actions);

  body.appendChild(top);
  body.appendChild(message);
  body.appendChild(footer);

  card.appendChild(icon);
  card.appendChild(body);

  return card;
}

async function markNotificationAsRead(notificationId, showSuccess = true) {
  const response = await authFetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirim okundu olarak işaretlenemedi.', 'error');
    return;
  }

  notificationsCache = notificationsCache.map((notification) => {
    if (Number(notification.id) === Number(notificationId)) {
      return {
        ...notification,
        is_read: true,
        read_at: new Date().toISOString(),
      };
    }

    return notification;
  });

  renderNotificationStats({
    unread_count: notificationsCache.filter((item) => !item.is_read).length,
  });

  renderNotifications();

  if (typeof refreshNotificationBadge === 'function') {
    refreshNotificationBadge();
  }

  if (showSuccess) {
    showToast('Bildirim okundu olarak işaretlendi.', 'success');
  }
}

async function markAllNotificationsAsRead() {
  const unreadNotifications = notificationsCache.filter((item) => !item.is_read);

  if (!unreadNotifications.length) {
    showToast('Okunmamış bildirim bulunmuyor.', 'info');
    return;
  }

  const confirmed = window.confirm('Tüm okunmamış bildirimler okundu olarak işaretlensin mi?');

  if (!confirmed) {
    return;
  }

  for (const notification of unreadNotifications) {
    await authFetch(`${API_BASE}/api/notifications/${notification.id}/read`, {
      method: 'PATCH',
    });
  }

  notificationsCache = notificationsCache.map((notification) => ({
    ...notification,
    is_read: true,
    read_at: notification.read_at || new Date().toISOString(),
  }));

  renderNotificationStats({
    unread_count: 0,
  });

  renderNotifications();

  if (typeof refreshNotificationBadge === 'function') {
    refreshNotificationBadge();
  }

  showToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
}

async function loadUserWarnings() {
  const container = document.getElementById('userWarningsList');

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="notification-empty-state">
      Uyarılar yükleniyor...
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/moderation/warnings/me`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="notification-empty-state">
        Moderasyon uyarıları alınamadı.
      </div>
    `;
    return;
  }

  userWarningsCache = response.data?.items || [];
  renderUserWarnings();
}

function renderUserWarnings() {
  const container = document.getElementById('userWarningsList');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!userWarningsCache.length) {
    container.innerHTML = `
      <div class="notification-empty-state">
        Henüz moderasyon uyarın bulunmuyor.
      </div>
    `;
    return;
  }

  userWarningsCache.forEach((warning) => {
    const card = document.createElement('article');
    card.className = warning.is_acknowledged
      ? 'user-warning-card acknowledged'
      : 'user-warning-card unread';

    const top = document.createElement('div');
    top.className = 'user-warning-top';

    const titleWrap = document.createElement('div');

    const severity = document.createElement('span');
    severity.className = `warning-severity ${warning.severity || 'medium'}`;
    severity.textContent = getWarningSeverityLabel(warning.severity);

    const title = document.createElement('h3');
    title.textContent = warning.title || 'Moderasyon uyarısı';

    titleWrap.appendChild(severity);
    titleWrap.appendChild(title);

    const status = document.createElement('span');
    status.className = warning.is_acknowledged
      ? 'warning-status read'
      : 'warning-status unread';
    status.textContent = warning.is_acknowledged ? 'Okundu' : 'Yeni';

    top.appendChild(titleWrap);
    top.appendChild(status);

    const message = document.createElement('p');
    message.textContent = warning.message || '-';

    const footer = document.createElement('div');
    footer.className = 'user-warning-footer';

    const date = document.createElement('span');
    date.textContent = formatNotificationDate(warning.created_at);

    footer.appendChild(date);

    if (!warning.is_acknowledged) {
      const acknowledgeBtn = document.createElement('button');
      acknowledgeBtn.type = 'button';
      acknowledgeBtn.className = 'secondary-action mini-warning-action';
      acknowledgeBtn.textContent = 'Okundu İşaretle';

      acknowledgeBtn.addEventListener('click', async () => {
        await acknowledgeWarning(warning.id);
      });

      footer.appendChild(acknowledgeBtn);
    }

    card.appendChild(top);
    card.appendChild(message);
    card.appendChild(footer);

    container.appendChild(card);
  });
}

async function acknowledgeWarning(warningId) {
  const response = await authFetch(`${API_BASE}/api/moderation/warnings/${warningId}/acknowledge`, {
    method: 'PATCH',
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Uyarı güncellenemedi.', 'error');
    return;
  }

  userWarningsCache = userWarningsCache.map((warning) => {
    if (Number(warning.id) === Number(warningId)) {
      return response.data;
    }

    return warning;
  });

  renderUserWarnings();
  showToast('Uyarı okundu olarak işaretlendi.', 'success');
}

function getWarningSeverityLabel(severity) {
  const map = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    critical: 'Kritik',
  };

  return map[severity] || 'Orta';
}

function getNotificationIcon(type) {
  const map = {
    moderation_action: '🛡️',
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

function getNotificationTypeLabel(type) {
  const map = {
    moderation_action: 'Moderasyon',
    points_added: 'Puan',
    badge_awarded: 'Rozet',
    certificate_awarded: 'Sertifika',
    community_joined: 'Topluluk',
    community_created: 'Topluluk',
    community_role_updated: 'Rol',
    event_created: 'Etkinlik',
    event_joined: 'Katılım',
    event_review_created: 'Değerlendirme',
    sponsor_added: 'Sponsor',
    community_sponsor_added: 'Sponsor',
    event_sponsor_added: 'Sponsor',
    social_room_created: 'Sosyal Oda',
    social_room_joined: 'Sosyal Oda',
    feed_post_created: 'Paylaşım',
    feed_comment_created: 'Yorum',
    system: 'Sistem',
  };

  return map[type] || 'Bildirim';
}

function formatNotificationDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = String(value);
  }
}