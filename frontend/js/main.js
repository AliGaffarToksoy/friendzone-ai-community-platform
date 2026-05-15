const API_BASE = 'http://localhost:5001';

let notificationDropdownCache = [];
let notificationDropdownOpen = false;
const NOTIFICATION_DROPDOWN_DISMISS_KEY = 'friendzone_notification_dropdown_dismiss_signature';

let moderationWarningsCache = [];
let moderationWarningModalOpen = false;

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');

  if (!toast) {
    console.log(`[${type}] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;

  window.clearTimeout(showToast.timeoutId);

  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });

    const data = await response.json().catch(() => null);

    const message = String(data?.message || data?.msg || '').toLowerCase();

    const isSessionExpired = response.status === 401;

    const isAccountBlocked =
      response.status === 403 &&
      (
        message.includes('devre dışı') ||
        message.includes('erişim yetkiniz') ||
        message.includes('yetkiniz kaldırılmıştır') ||
        message.includes('disabled') ||
        message.includes('forbidden')
      );

    if (isSessionExpired || isAccountBlocked) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('friendzone_user');
      sessionStorage.removeItem(NOTIFICATION_DROPDOWN_DISMISS_KEY);

      if (!window.location.pathname.endsWith('login.html')) {
        const toastMessage = isAccountBlocked
          ? 'Hesabın devre dışı bırakıldı veya erişim yetkin kaldırıldı. Lütfen yöneticiyle iletişime geç.'
          : 'Oturum süren doldu. Tekrar giriş yapmalısın.';

        showToast(toastMessage, 'error');

        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1000);
      }

      return data;
    }

    return data;
  } catch (error) {
    console.error('authFetch error:', error);
    showToast(`Bağlantı hatası: ${error.message}`, 'error');
    return null;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('friendzone_user');
  sessionStorage.removeItem('friendzone_admin_auth');
  sessionStorage.removeItem(NOTIFICATION_DROPDOWN_DISMISS_KEY);
  window.location.href = 'login.html';
}

function getCurrentPageName() {
  const path = window.location.pathname || '';
  const parts = path.split('/').filter(Boolean);

  return parts.length ? parts[parts.length - 1] : 'index.html';
}

function isAuthPage() {
  const page = getCurrentPageName();

  return [
    'login.html',
    'signup.html',
    'register.html',
    'index.html',
    '',
  ].includes(page);
}

function findSidebarNav() {
  return (
    document.querySelector('.sidebar-nav') ||
    document.querySelector('.chat-sidebar .sidebar-nav') ||
    document.querySelector('aside nav') ||
    document.querySelector('nav')
  );
}

function findNotificationLink() {
  return (
    document.querySelector('a[href="notifications.html"]') ||
    document.querySelector('a[href="./notifications.html"]') ||
    document.querySelector('a[href="/notifications.html"]')
  );
}

function ensureNotificationLink() {
  let notificationLink = findNotificationLink();

  if (notificationLink) {
    return notificationLink;
  }

  const nav = findSidebarNav();

  if (!nav) {
    return null;
  }

  notificationLink = document.createElement('a');
  notificationLink.href = 'notifications.html';

  if (nav.classList.contains('sidebar-nav')) {
    notificationLink.className = 'chat-nav-link';
  } else {
    notificationLink.className = 'nav-link';
  }

  notificationLink.innerHTML = `
    <span>🔔</span>
    Bildirimler
  `;

  const insertBeforeLink =
    nav.querySelector('a[href="social-profile.html"]') ||
    nav.querySelector('a[href="profile.html"]') ||
    nav.querySelector('a[href="brands.html"]');

  if (insertBeforeLink && insertBeforeLink.parentElement === nav) {
    nav.insertBefore(notificationLink, insertBeforeLink);
  } else {
    nav.appendChild(notificationLink);
  }

  return notificationLink;
}

function ensureNotificationBadgeElement() {
  const notificationLink = ensureNotificationLink();

  if (!notificationLink) {
    return null;
  }

  notificationLink.classList.add('notification-nav-link');

  let badge = notificationLink.querySelector('.notification-count-badge');

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'notification-count-badge hidden';
    badge.textContent = '0';
    notificationLink.appendChild(badge);
  }

  return badge;
}

function setNotificationBadgeCount(count) {
  const badge = ensureNotificationBadgeElement();

  if (!badge) {
    return;
  }

  const safeCount = Number(count || 0);

  if (safeCount <= 0) {
    badge.textContent = '0';
    badge.classList.add('hidden');
    return;
  }

  badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
  badge.classList.remove('hidden');
}

function getNotificationDismissSignature() {
  const unreadIds = notificationDropdownCache
    .filter((item) => !item.is_read)
    .map((item) => Number(item.id))
    .filter(Boolean)
    .sort((a, b) => b - a);

  if (!unreadIds.length) {
    return 'no-unread';
  }

  return unreadIds.join(',');
}

function dismissNotificationDropdownUntilNewNotification() {
  const signature = getNotificationDismissSignature();
  sessionStorage.setItem(NOTIFICATION_DROPDOWN_DISMISS_KEY, signature);
}

function hasNewNotificationSinceDismiss() {
  const dismissedSignature = sessionStorage.getItem(NOTIFICATION_DROPDOWN_DISMISS_KEY);
  const currentSignature = getNotificationDismissSignature();

  if (!dismissedSignature) {
    return true;
  }

  return dismissedSignature !== currentSignature;
}

async function refreshNotificationBadge() {
  const token = localStorage.getItem('token');

  if (!token || isAuthPage()) {
    return;
  }

  const response = await authFetch(`${API_BASE}/api/notifications?limit=5`);

  if (!response || !response.success) {
    return;
  }

  const payload = response.data || {};
  const unreadCount = payload.unread_count || 0;

  notificationDropdownCache = payload.items || [];

  setNotificationBadgeCount(unreadCount);
  renderNotificationDropdown();
}

function ensureNotificationDropdown() {
  const notificationLink = ensureNotificationLink();

  if (!notificationLink) {
    return null;
  }

  notificationLink.classList.add('notification-nav-link');

  let dropdown = document.getElementById('notificationMiniDropdown');

  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'notificationMiniDropdown';
    dropdown.className = 'notification-mini-dropdown hidden';

    dropdown.innerHTML = `
      <div class="notification-mini-header">
        <div>
          <strong>Bildirimler</strong>
          <span id="notificationMiniSummary">Son aktiviteler</span>
        </div>

        <button id="notificationMiniCloseBtn" type="button" aria-label="Kapat">
          ×
        </button>
      </div>

      <div id="notificationMiniList" class="notification-mini-list">
        <div class="notification-mini-empty">
          Bildirimler yükleniyor...
        </div>
      </div>

      <button id="notificationMiniViewAllBtn" type="button" class="notification-mini-view-all">
        Tüm bildirimleri gör
      </button>
    `;

    document.body.appendChild(dropdown);

    const closeBtn = document.getElementById('notificationMiniCloseBtn');
    const viewAllBtn = document.getElementById('notificationMiniViewAllBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeNotificationDropdown(true);
      });
    }

    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        window.location.href = 'notifications.html';
      });
    }
  }

  return dropdown;
}

function positionNotificationDropdown() {
  const notificationLink = ensureNotificationLink();
  const dropdown = ensureNotificationDropdown();

  if (!notificationLink || !dropdown) {
    return;
  }

  const rect = notificationLink.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 24);

  let top = rect.bottom + 10;
  let left = rect.left;

  if (left + width > window.innerWidth - 12) {
    left = window.innerWidth - width - 12;
  }

  if (left < 12) {
    left = 12;
  }

  dropdown.style.width = `${width}px`;
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
}

function openNotificationDropdown(forceOpen = false) {
  const dropdown = ensureNotificationDropdown();

  if (!dropdown) {
    return;
  }

  if (!forceOpen && !hasNewNotificationSinceDismiss()) {
    return;
  }

  notificationDropdownOpen = true;

  renderNotificationDropdown();
  positionNotificationDropdown();

  dropdown.classList.remove('hidden');

  refreshNotificationBadge();
}

function closeNotificationDropdown(rememberDismiss = false) {
  const dropdown = ensureNotificationDropdown();

  if (!dropdown) {
    return;
  }

  notificationDropdownOpen = false;
  dropdown.classList.add('hidden');

  if (rememberDismiss) {
    dismissNotificationDropdownUntilNewNotification();
  }
}

function toggleNotificationDropdown(event) {
  event.preventDefault();
  event.stopPropagation();

  if (notificationDropdownOpen) {
    closeNotificationDropdown(true);
    return;
  }

  openNotificationDropdown(true);
}

function renderNotificationDropdown() {
  const list = document.getElementById('notificationMiniList');
  const summary = document.getElementById('notificationMiniSummary');

  if (!list) {
    return;
  }

  const unreadCount = notificationDropdownCache.filter((item) => !item.is_read).length;

  if (summary) {
    summary.textContent = `${unreadCount} okunmamış`;
  }

  list.innerHTML = '';

  if (!notificationDropdownCache.length) {
    list.innerHTML = `
      <div class="notification-mini-empty">
        Henüz bildirimin yok.
      </div>
    `;
    return;
  }

  notificationDropdownCache.slice(0, 5).forEach((notification) => {
    list.appendChild(createNotificationMiniItem(notification));
  });
}

function createNotificationMiniItem(notification) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = notification.is_read
    ? 'notification-mini-item'
    : 'notification-mini-item unread';

  const icon = document.createElement('span');
  icon.className = 'notification-mini-icon';
  icon.textContent = notification.icon || getMiniNotificationIcon(notification.notification_type);

  const content = document.createElement('span');
  content.className = 'notification-mini-content';

  const title = document.createElement('strong');
  title.textContent = notification.title || 'Bildirim';

  const message = document.createElement('small');
  message.textContent = notification.message || '';

  const date = document.createElement('em');
  date.textContent = formatMiniNotificationDate(notification.created_at);

  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(date);

  item.appendChild(icon);
  item.appendChild(content);

  item.addEventListener('click', async () => {
    await handleMiniNotificationClick(notification);
  });

  return item;
}

async function handleMiniNotificationClick(notification) {
  if (!notification.is_read) {
    await authFetch(`${API_BASE}/api/notifications/${notification.id}/read`, {
      method: 'PATCH',
    });

    notificationDropdownCache = notificationDropdownCache.map((item) => {
      if (Number(item.id) === Number(notification.id)) {
        return {
          ...item,
          is_read: true,
          read_at: new Date().toISOString(),
        };
      }

      return item;
    });

    const unreadCount = notificationDropdownCache.filter((item) => !item.is_read).length;
    setNotificationBadgeCount(unreadCount);
  }

  if (notification.action_url) {
    window.location.href = notification.action_url;
    return;
  }

  window.location.href = 'notifications.html';
}

function bindNotificationDropdownEvents() {
  const notificationLink = ensureNotificationLink();

  if (!notificationLink) {
    return;
  }

  notificationLink.addEventListener('click', toggleNotificationDropdown);

  notificationLink.addEventListener('mouseenter', () => {
    if (window.innerWidth >= 900 && hasNewNotificationSinceDismiss()) {
      openNotificationDropdown(false);
    }
  });

  const dropdown = ensureNotificationDropdown();

  if (dropdown) {
    dropdown.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    dropdown.addEventListener('mouseenter', () => {
      notificationDropdownOpen = true;
    });

    dropdown.addEventListener('mouseleave', () => {
      if (window.innerWidth >= 900) {
        setTimeout(() => {
          closeNotificationDropdown(false);
        }, 220);
      }
    });
  }

  document.addEventListener('click', () => {
    closeNotificationDropdown(false);
  });

  window.addEventListener('resize', () => {
    if (notificationDropdownOpen) {
      positionNotificationDropdown();
    }
  });

  window.addEventListener('scroll', () => {
    if (notificationDropdownOpen) {
      positionNotificationDropdown();
    }
  }, true);
}

function getMiniNotificationIcon(type) {
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
    moderation_action: '🛡️',
    system: '🔔',
  };

  return map[type] || '🔔';
}

function formatMiniNotificationDate(value) {
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
  });
}

/* =========================================================
   Moderation Warnings - User Facing
   ========================================================= */

async function loadMyModerationWarnings() {
  const token = localStorage.getItem('token');

  if (!token || isAuthPage()) {
    return;
  }

  const response = await authFetch(`${API_BASE}/api/moderation/warnings/me`);

  if (!response || !response.success) {
    return;
  }

  const payload = response.data || {};
  moderationWarningsCache = payload.items || [];

  const unreadWarnings = moderationWarningsCache.filter((warning) => !warning.is_acknowledged);

  if (unreadWarnings.length) {
    openModerationWarningModal(unreadWarnings[0]);
  }
}

function ensureModerationWarningModal() {
  let modal = document.getElementById('moderationWarningModal');

  if (modal) {
    return modal;
  }

  modal = document.createElement('div');
  modal.id = 'moderationWarningModal';
  modal.className = 'moderation-warning-overlay hidden';

  modal.innerHTML = `
    <div class="moderation-warning-card" role="dialog" aria-modal="true" aria-labelledby="moderationWarningTitle">
      <div class="moderation-warning-icon">🛡️</div>

      <div class="moderation-warning-content">
        <p class="moderation-warning-eyebrow">Moderasyon Uyarısı</p>
        <h2 id="moderationWarningTitle">FriendZone moderasyon uyarısı</h2>
        <p id="moderationWarningMessage">
          Lütfen topluluk kurallarına uygun davran.
        </p>

        <div class="moderation-warning-meta">
          <span id="moderationWarningSeverity">Seviye: Orta</span>
          <span id="moderationWarningDate">Tarih yok</span>
        </div>
      </div>

      <div class="moderation-warning-actions">
        <button id="moderationWarningAcknowledgeBtn" type="button">
          Okudum ve Anladım
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const acknowledgeBtn = document.getElementById('moderationWarningAcknowledgeBtn');

  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', acknowledgeCurrentModerationWarning);
  }

  return modal;
}

function openModerationWarningModal(warning) {
  if (!warning || moderationWarningModalOpen) {
    return;
  }

  const modal = ensureModerationWarningModal();

  modal.dataset.warningId = String(warning.id);

  const title = document.getElementById('moderationWarningTitle');
  const message = document.getElementById('moderationWarningMessage');
  const severity = document.getElementById('moderationWarningSeverity');
  const date = document.getElementById('moderationWarningDate');

  if (title) {
    title.textContent = warning.title || 'FriendZone moderasyon uyarısı';
  }

  if (message) {
    message.textContent = warning.message || 'Lütfen topluluk kurallarına uygun davran.';
  }

  if (severity) {
    severity.textContent = `Seviye: ${getModerationWarningSeverityLabel(warning.severity)}`;
  }

  if (date) {
    date.textContent = formatMiniNotificationDate(warning.created_at);
  }

  moderationWarningModalOpen = true;
  modal.classList.remove('hidden');
}

function closeModerationWarningModal() {
  const modal = document.getElementById('moderationWarningModal');

  if (!modal) {
    return;
  }

  moderationWarningModalOpen = false;
  modal.classList.add('hidden');
  modal.dataset.warningId = '';
}

async function acknowledgeCurrentModerationWarning() {
  const modal = document.getElementById('moderationWarningModal');

  if (!modal) {
    return;
  }

  const warningId = Number(modal.dataset.warningId);

  if (!warningId) {
    closeModerationWarningModal();
    return;
  }

  const button = document.getElementById('moderationWarningAcknowledgeBtn');

  if (button) {
    button.disabled = true;
    button.textContent = 'İşaretleniyor...';
  }

  const response = await authFetch(`${API_BASE}/api/moderation/warnings/${warningId}/acknowledge`, {
    method: 'PATCH',
  });

  if (button) {
    button.disabled = false;
    button.textContent = 'Okudum ve Anladım';
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Uyarı okundu olarak işaretlenemedi.', 'error');
    return;
  }

  moderationWarningsCache = moderationWarningsCache.map((warning) => {
    if (Number(warning.id) === warningId) {
      return {
        ...warning,
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      };
    }

    return warning;
  });

  closeModerationWarningModal();
  showToast('Moderasyon uyarısı okundu olarak işaretlendi.', 'success');

  const nextUnreadWarning = moderationWarningsCache.find((warning) => !warning.is_acknowledged);

  if (nextUnreadWarning) {
    setTimeout(() => {
      openModerationWarningModal(nextUnreadWarning);
    }, 450);
  }
}

function getModerationWarningSeverityLabel(severity) {
  const map = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    critical: 'Kritik',
  };

  return map[severity] || severity || 'Orta';
}

function injectNotificationBadgeStyles() {
  if (document.getElementById('notificationBadgeRuntimeStyles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'notificationBadgeRuntimeStyles';
  style.textContent = `
    .notification-nav-link {
      position: relative;
    }

    .notification-count-badge {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      background: #ef4444;
      color: #ffffff;
      box-shadow: 0 10px 24px rgba(239, 68, 68, 0.28);
    }

    .notification-count-badge.hidden {
      display: none;
    }

    .notification-mini-dropdown {
      position: fixed;
      z-index: 9999;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 22px;
      background:
        radial-gradient(circle at top left, rgba(99, 102, 241, 0.14), transparent 32%),
        rgba(15, 23, 42, 0.98);
      box-shadow:
        0 28px 80px rgba(2, 6, 23, 0.46),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(18px);
      overflow: hidden;
    }

    .notification-mini-dropdown.hidden {
      display: none;
    }

    .notification-mini-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .notification-mini-header strong {
      display: block;
      color: #f8fafc;
      font-size: 15px;
      margin-bottom: 2px;
    }

    .notification-mini-header span {
      color: rgba(203, 213, 225, 0.72);
      font-size: 12px;
    }

    #notificationMiniCloseBtn {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.58);
      color: rgba(226, 232, 240, 0.84);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }

    #notificationMiniCloseBtn:hover {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.28);
      color: #ffffff;
    }

    .notification-mini-list {
      max-height: 360px;
      overflow-y: auto;
      padding: 8px;
    }

    .notification-mini-item {
      width: 100%;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      padding: 12px;
      border: 1px solid transparent;
      border-radius: 16px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: 0.18s ease;
    }

    .notification-mini-item:hover {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.22);
    }

    .notification-mini-item.unread {
      background: rgba(99, 102, 241, 0.10);
      border-color: rgba(99, 102, 241, 0.20);
    }

    .notification-mini-icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(148, 163, 184, 0.12);
      font-size: 17px;
    }

    .notification-mini-content {
      min-width: 0;
    }

    .notification-mini-content strong {
      display: block;
      color: #f8fafc;
      font-size: 13px;
      line-height: 1.3;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notification-mini-content small {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      color: rgba(203, 213, 225, 0.72);
      font-size: 12px;
      line-height: 1.35;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .notification-mini-content em {
      color: rgba(148, 163, 184, 0.82);
      font-size: 11px;
      font-style: normal;
    }

    .notification-mini-empty {
      padding: 24px 16px;
      text-align: center;
      color: rgba(203, 213, 225, 0.76);
      font-size: 13px;
    }

    .notification-mini-view-all {
      width: calc(100% - 16px);
      margin: 0 8px 8px;
      min-height: 42px;
      border: 1px solid rgba(99, 102, 241, 0.28);
      border-radius: 16px;
      background: rgba(99, 102, 241, 0.16);
      color: #ffffff;
      cursor: pointer;
      font-weight: 800;
    }

    .notification-mini-view-all:hover {
      background: rgba(99, 102, 241, 0.26);
    }

    .moderation-warning-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(10px);
    }

    .moderation-warning-overlay.hidden {
      display: none;
    }

    .moderation-warning-card {
      width: min(100%, 520px);
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 28px;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(245, 158, 11, 0.14), transparent 34%),
        radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.16), transparent 34%),
        rgba(15, 23, 42, 0.98);
      box-shadow:
        0 34px 100px rgba(2, 6, 23, 0.58),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
      color: #f8fafc;
    }

    .moderation-warning-icon {
      width: 58px;
      height: 58px;
      border-radius: 20px;
      display: grid;
      place-items: center;
      margin-bottom: 18px;
      background: rgba(245, 158, 11, 0.16);
      border: 1px solid rgba(245, 158, 11, 0.28);
      font-size: 26px;
    }

    .moderation-warning-eyebrow {
      margin: 0 0 8px;
      color: #fbbf24;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .moderation-warning-content h2 {
      margin: 0 0 10px;
      color: #ffffff;
      font-size: 26px;
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    .moderation-warning-content p {
      color: rgba(226, 232, 240, 0.84);
      line-height: 1.65;
    }

    .moderation-warning-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .moderation-warning-meta span {
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0 10px;
      background: rgba(148, 163, 184, 0.12);
      color: rgba(226, 232, 240, 0.82);
      font-size: 12px;
      font-weight: 800;
    }

    .moderation-warning-actions {
      margin-top: 22px;
    }

    #moderationWarningAcknowledgeBtn {
      width: 100%;
      min-height: 46px;
      border: 1px solid rgba(245, 158, 11, 0.34);
      border-radius: 16px;
      background: rgba(245, 158, 11, 0.18);
      color: #ffffff;
      cursor: pointer;
      font-weight: 900;
    }

    #moderationWarningAcknowledgeBtn:hover {
      background: rgba(245, 158, 11, 0.26);
    }

    #moderationWarningAcknowledgeBtn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    @media (max-width: 680px) {
      .notification-mini-dropdown {
        left: 12px !important;
        right: 12px !important;
        width: auto !important;
      }

      .moderation-warning-card {
        padding: 20px;
        border-radius: 24px;
      }

      .moderation-warning-content h2 {
        font-size: 22px;
      }
    }
  `;

  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  injectNotificationBadgeStyles();

  if (!isAuthPage()) {
    ensureNotificationLink();
    ensureNotificationBadgeElement();
    ensureNotificationDropdown();
    bindNotificationDropdownEvents();
    refreshNotificationBadge();
    loadMyModerationWarnings();

    window.addEventListener('focus', () => {
      refreshNotificationBadge();
      loadMyModerationWarnings();
    });

    setInterval(() => {
      refreshNotificationBadge();
    }, 60000);

    setInterval(() => {
      loadMyModerationWarnings();
    }, 90000);
  }
});