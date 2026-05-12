let notificationsCache = [];
let activeNotificationFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  bindNotificationEvents();

  await loadNotifications();
});

function bindNotificationEvents() {
  const refreshBtn = document.getElementById('refreshNotificationsBtn');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const typeFilter = document.getElementById('notificationTypeFilter');
  const searchInput = document.getElementById('notificationSearchInput');

  document.querySelectorAll('.notification-filter').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.notification-filter').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');
      activeNotificationFilter = button.dataset.filter || 'all';

      renderNotifications();
    });
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadNotifications();
      showToast('Bildirimler yenilendi.', 'success');
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', renderNotifications);
  }

  if (searchInput) {
    let searchTimeout = null;

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(() => {
        renderNotifications();
      }, 250);
    });
  }
}

async function loadNotifications() {
  const container = document.getElementById('notificationsList');

  if (!container) return;

  container.innerHTML = `
    <div class="notifications-empty-state">
      Bildirimler yükleniyor...
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/notifications?limit=100`);

  if (!response || !response.success) {
    notificationsCache = [];

    container.innerHTML = `
      <div class="notifications-empty-state error">
        ${response?.message || 'Bildirimler yüklenemedi.'}
      </div>
    `;

    updateNotificationStats([]);
    return;
  }

  const data = response.data || {};
  notificationsCache = data.items || [];

  renderNotifications();
}

function renderNotifications() {
  const container = document.getElementById('notificationsList');

  if (!container) return;

  const filtered = getFilteredNotifications();

  container.innerHTML = '';

  updateNotificationStats(filtered);

  if (!filtered.length) {
    container.innerHTML = `
      <div class="notifications-empty-state">
        Bu filtreye uygun bildirim bulunmuyor.
      </div>
    `;
    return;
  }

  filtered.forEach((notification) => {
    container.appendChild(createNotificationCard(notification));
  });
}

function getFilteredNotifications() {
  const typeFilter = document.getElementById('notificationTypeFilter');
  const searchInput = document.getElementById('notificationSearchInput');

  const selectedType = typeFilter ? typeFilter.value : '';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  return notificationsCache.filter((notification) => {
    if (activeNotificationFilter === 'unread' && notification.is_read) {
      return false;
    }

    if (activeNotificationFilter === 'read' && !notification.is_read) {
      return false;
    }

    if (selectedType && notification.notification_type !== selectedType) {
      return false;
    }

    if (searchTerm) {
      const haystack = [
        notification.title,
        notification.message,
        notification.notification_type,
        notification.reference_type,
        notification.action_url
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}

function createNotificationCard(notification) {
  const card = document.createElement('article');
  card.className = notification.is_read
    ? 'notification-card read'
    : 'notification-card unread';

  const icon = document.createElement('div');
  icon.className = `notification-icon type-${notification.notification_type || 'system'}`;
  icon.textContent = notification.icon || getNotificationFallbackIcon(notification.notification_type);

  const content = document.createElement('div');
  content.className = 'notification-content';

  const top = document.createElement('div');
  top.className = 'notification-card-top';

  const title = document.createElement('strong');
  title.textContent = notification.title || 'Bildirim';

  const time = document.createElement('span');
  time.textContent = formatNotificationRelativeTime(notification.created_at);

  top.appendChild(title);
  top.appendChild(time);

  const message = document.createElement('p');
  message.textContent = notification.message || 'Bildirim mesajı bulunmuyor.';

  const meta = document.createElement('div');
  meta.className = 'notification-meta';

  meta.appendChild(createNotificationChip(getNotificationTypeLabel(notification.notification_type)));

  if (notification.reference_type) {
    meta.appendChild(createNotificationChip(`Ref: ${notification.reference_type}${notification.reference_id ? ` #${notification.reference_id}` : ''}`));
  }

  meta.appendChild(createNotificationChip(notification.is_read ? 'Okundu' : 'Okunmamış'));

  content.appendChild(top);
  content.appendChild(message);
  content.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  if (!notification.is_read) {
    const readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'notification-action-button primary';
    readBtn.textContent = 'Okundu';
    readBtn.addEventListener('click', () => markNotificationAsRead(notification.id));

    actions.appendChild(readBtn);
  }

  if (notification.action_url) {
    const goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'notification-action-button secondary';
    goBtn.textContent = 'Git';
    goBtn.addEventListener('click', async () => {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id, false);
      }

      window.location.href = notification.action_url;
    });

    actions.appendChild(goBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'notification-action-button danger';
  deleteBtn.textContent = 'Arşivle';
  deleteBtn.addEventListener('click', () => archiveNotification(notification.id));

  actions.appendChild(deleteBtn);

  card.appendChild(icon);
  card.appendChild(content);
  card.appendChild(actions);

  return card;
}

function createNotificationChip(value) {
  const chip = document.createElement('span');
  chip.className = 'notification-chip';
  chip.textContent = value;
  return chip;
}

async function markNotificationAsRead(notificationId, rerender = true) {
  const response = await authFetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
    method: 'PATCH'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirim okundu yapılamadı.', 'error');
    return;
  }

  const index = notificationsCache.findIndex((item) => item.id === notificationId);

  if (index !== -1) {
    notificationsCache[index] = response.data;
  }

  if (rerender) {
    renderNotifications();
    showToast('Bildirim okundu olarak işaretlendi.', 'success');
  }
}

async function markAllNotificationsAsRead() {
  const unreadCount = notificationsCache.filter((item) => !item.is_read).length;

  if (!unreadCount) {
    showToast('Okunmamış bildirim bulunmuyor.', 'info');
    return;
  }

  const response = await authFetch(`${API_BASE}/api/notifications/mark-all-read`, {
    method: 'PATCH'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirimler okundu yapılamadı.', 'error');
    return;
  }

  notificationsCache = notificationsCache.map((notification) => ({
    ...notification,
    is_read: true,
    read_at: notification.read_at || new Date().toISOString()
  }));

  renderNotifications();
  showToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
}

async function archiveNotification(notificationId) {
  const confirmed = window.confirm('Bu bildirimi arşivlemek istediğine emin misin?');

  if (!confirmed) return;

  const response = await authFetch(`${API_BASE}/api/notifications/${notificationId}`, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Bildirim arşivlenemedi.', 'error');
    return;
  }

  notificationsCache = notificationsCache.filter((notification) => notification.id !== notificationId);

  renderNotifications();
  showToast('Bildirim arşivlendi.', 'success');
}

function updateNotificationStats(items) {
  const totalNotificationsStat = document.getElementById('totalNotificationsStat');
  const unreadNotificationsStat = document.getElementById('unreadNotificationsStat');
  const readNotificationsStat = document.getElementById('readNotificationsStat');
  const notificationTypesStat = document.getElementById('notificationTypesStat');

  const total = items.length;
  const unread = items.filter((notification) => !notification.is_read).length;
  const read = items.filter((notification) => notification.is_read).length;
  const types = new Set(
    items
      .map((notification) => notification.notification_type)
      .filter(Boolean)
  ).size;

  if (totalNotificationsStat) totalNotificationsStat.textContent = total;
  if (unreadNotificationsStat) unreadNotificationsStat.textContent = unread;
  if (readNotificationsStat) readNotificationsStat.textContent = read;
  if (notificationTypesStat) notificationTypesStat.textContent = types;
}

function getNotificationFallbackIcon(type) {
  const map = {
    badge_awarded: '🏅',
    certificate_awarded: '🎓',
    points_added: '⭐',
    community_joined: '🌐',
    community_role_updated: '🛡️',
    event_created: '📅',
    event_joined: '✅',
    event_review_created: '💬',
    sponsor_added: '🤝',
    social_room_created: '🎙️',
    social_room_joined: '🎧',
    system: '🔔'
  };

  return map[type] || '🔔';
}

function getNotificationTypeLabel(type) {
  const map = {
    badge_awarded: 'Rozet',
    certificate_awarded: 'Sertifika',
    points_added: 'Puan',
    community_joined: 'Topluluk',
    community_role_updated: 'Rol Güncellemesi',
    event_created: 'Etkinlik',
    event_joined: 'Etkinlik Katılımı',
    event_review_created: 'Yorum',
    sponsor_added: 'Sponsor',
    social_room_created: 'Sosyal Oda',
    social_room_joined: 'Oda Katılımı',
    system: 'Sistem'
  };

  return map[type] || 'Bildirim';
}

function formatNotificationRelativeTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Az önce';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} dk önce`;
  }

  if (diffHours < 24) {
    return `${diffHours} saat önce`;
  }

  if (diffDays < 7) {
    return `${diffDays} gün önce`;
  }

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}