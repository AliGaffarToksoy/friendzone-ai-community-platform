const API_BASE = 'http://localhost:5001';
const ADMIN_AUTH_KEY = 'friendzone_admin_auth';

let moderationOverviewCache = null;
let moderationReportsCache = [];
let moderationActionsCache = [];
let moderationUsersCache = [];
let selectedReport = null;

document.addEventListener('DOMContentLoaded', async () => {
  bindAdminModerationEvents();
  await loadModerationCenter();
});

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');

  if (!toast) {
    console.log(`[${type}] ${message}`);
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3600);
}

function getAdminAuthHeader() {
  let encoded = sessionStorage.getItem(ADMIN_AUTH_KEY);

  if (!encoded) {
    const username = window.prompt('Admin kullanıcı adı:', 'admin');
    const password = window.prompt('Admin şifresi:', 'admin123');

    if (!username || !password) {
      showToast('Admin girişi iptal edildi.', 'error');
      return null;
    }

    encoded = btoa(`${username}:${password}`);
    sessionStorage.setItem(ADMIN_AUTH_KEY, encoded);
  }

  return `Basic ${encoded}`;
}

async function adminFetch(url, options = {}) {
  const authHeader = getAdminAuthHeader();

  if (!authHeader) {
    return null;
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', authHeader);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      showToast('Admin bilgileri hatalı. Tekrar giriş yap.', 'error');
      return null;
    }

    return data;
  } catch (error) {
    console.error('adminFetch error:', error);
    showToast(`Bağlantı hatası: ${error.message}`, 'error');
    return null;
  }
}

function bindAdminModerationEvents() {
  const refreshBtn = document.getElementById('refreshModerationBtn');
  const clearAuthBtn = document.getElementById('clearAdminAuthBtn');
  const reportSearch = document.getElementById('reportSearchInput');
  const reportStatus = document.getElementById('reportStatusFilter');
  const reportSeverity = document.getElementById('reportSeverityFilter');
  const reportTarget = document.getElementById('reportTargetTypeFilter');
  const actionForm = document.getElementById('moderationActionForm');
  const reviewingBtn = document.getElementById('markReportReviewingBtn');
  const resolveBtn = document.getElementById('resolveReportBtn');
  const rejectBtn = document.getElementById('rejectReportBtn');
  const searchUsersBtn = document.getElementById('searchUsersBtn');
  const userSearchInput = document.getElementById('userSearchInput');
  const userStatusFilter = document.getElementById('userStatusFilter');
  const testReportBtn = document.getElementById('openCreateTestReportBtn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadModerationCenter);
  }

  if (clearAuthBtn) {
    clearAuthBtn.addEventListener('click', () => {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      showToast('Admin oturumu sıfırlandı.', 'success');
    });
  }

  [reportSearch, reportStatus, reportSeverity, reportTarget].forEach((element) => {
    if (!element) return;

    const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
    element.addEventListener(eventName, debounce(loadReports, 260));
  });

  if (actionForm) {
    actionForm.addEventListener('submit', applyModerationAction);
  }

  if (reviewingBtn) {
    reviewingBtn.addEventListener('click', () => updateSelectedReportStatus('reviewing'));
  }

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => updateSelectedReportStatus('resolved'));
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => updateSelectedReportStatus('rejected'));
  }

  if (searchUsersBtn) {
    searchUsersBtn.addEventListener('click', loadUsers);
  }

  if (userSearchInput) {
    userSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        loadUsers();
      }
    });
  }

  if (userStatusFilter) {
    userStatusFilter.addEventListener('change', loadUsers);
  }

  if (testReportBtn) {
    testReportBtn.addEventListener('click', createQuickTestReportHint);
  }
}

async function loadModerationCenter() {
  await Promise.all([
    loadOverview(),
    loadReports(),
    loadActions(),
  ]);
}

async function loadOverview() {
  const response = await adminFetch(`${API_BASE}/api/moderation/admin/overview`);

  if (!response || !response.success) {
    showToast(response?.message || 'Moderasyon özeti alınamadı.', 'error');
    return;
  }

  moderationOverviewCache = response.data;
  renderOverview(moderationOverviewCache);
}

function renderOverview(data) {
  const stats = data?.stats || {};

  setText('statTotalReports', stats.total_reports || 0);
  setText('statPendingReports', stats.pending_reports || 0);
  setText('statReviewingReports', stats.reviewing_reports || 0);
  setText('statCriticalReports', stats.critical_reports || 0);

  const hiddenContent =
    Number(stats.hidden_posts || 0) +
    Number(stats.hidden_comments || 0) +
    Number(stats.inactive_communities || 0) +
    Number(stats.inactive_events || 0);

  setText('statHiddenContent', hiddenContent);
}

async function loadReports() {
  const params = new URLSearchParams();

  const q = document.getElementById('reportSearchInput')?.value.trim();
  const status = document.getElementById('reportStatusFilter')?.value;
  const severity = document.getElementById('reportSeverityFilter')?.value;
  const targetType = document.getElementById('reportTargetTypeFilter')?.value;

  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (targetType) params.set('target_type', targetType);

  params.set('limit', '100');

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/reports?${params.toString()}`);

  if (!response || !response.success) {
    moderationReportsCache = [];
    renderReports();
    showToast(response?.message || 'Raporlar alınamadı.', 'error');
    return;
  }

  moderationReportsCache = response.data?.items || [];
  renderReports();

  if (selectedReport) {
    const updatedSelected = moderationReportsCache.find((item) => item.id === selectedReport.id);

    if (updatedSelected) {
      selectReport(updatedSelected.id);
    }
  }
}

function renderReports() {
  const tbody = document.getElementById('reportsTableBody');
  const countText = document.getElementById('reportsCountText');

  if (countText) {
    countText.textContent = `${moderationReportsCache.length} rapor`;
  }

  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  if (!moderationReportsCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Bu filtrelere uygun rapor yok.</td>
      </tr>
    `;
    return;
  }

  moderationReportsCache.forEach((report) => {
    const target = report.target_summary || {};
    const tr = document.createElement('tr');

    if (selectedReport && selectedReport.id === report.id) {
      tr.classList.add('active');
    }

    tr.innerHTML = `
      <td>#${escapeHtml(report.id)}</td>
      <td>
        <span class="target-title">${escapeHtml(target.title || report.target_type)}</span>
        <span class="target-subtitle">${escapeHtml(target.subtitle || `${report.target_type}:${report.target_id}`)}</span>
      </td>
      <td>
        <span class="target-title">${escapeHtml(report.reporter?.name || '-')}</span>
        <span class="target-subtitle">${escapeHtml(report.reporter?.email || '')}</span>
      </td>
      <td>
        <span class="target-title">${escapeHtml(report.reported_user?.name || '-')}</span>
        <span class="target-subtitle">${escapeHtml(report.reported_user?.email || '')}</span>
      </td>
      <td><span class="badge ${escapeHtml(report.status)}">${getStatusLabel(report.status)}</span></td>
      <td><span class="badge ${escapeHtml(report.severity)}">${getSeverityLabel(report.severity)}</span></td>
      <td>${formatDate(report.created_at)}</td>
    `;

    tr.addEventListener('click', () => {
      selectReport(report.id);
    });

    tbody.appendChild(tr);
  });
}

function selectReport(reportId) {
  const report = moderationReportsCache.find((item) => Number(item.id) === Number(reportId));

  if (!report) {
    return;
  }

  selectedReport = report;
  renderReports();
  renderSelectedReport(report);
}

function renderSelectedReport(report) {
  const empty = document.getElementById('reportDetailEmpty');
  const panel = document.getElementById('reportDetailPanel');
  const selectedText = document.getElementById('selectedReportText');
  const targetBox = document.getElementById('targetSummaryBox');
  const reportBox = document.getElementById('reportInfoBox');

  if (empty) empty.classList.add('hidden');
  if (panel) panel.classList.remove('hidden');

  if (selectedText) {
    selectedText.textContent = `#${report.id} · ${getStatusLabel(report.status)} · ${getSeverityLabel(report.severity)}`;
  }

  const target = report.target_summary || {};

  if (targetBox) {
    targetBox.innerHTML = `
      ${createKv('Hedef Tipi', getTargetTypeLabel(report.target_type))}
      ${createKv('Hedef ID', report.target_id)}
      ${createKv('Başlık', target.title || '-')}
      ${createKv('Aktif mi?', target.is_active === false ? 'Pasif / Gizli' : 'Aktif')}
      ${createKv('Sahip ID', report.reported_user_id || '-')}
      ${createKv('Sahip', report.reported_user?.name || '-')}
    `;
  }

  if (reportBox) {
    reportBox.innerHTML = `
      ${createKv('Rapor Nedeni', getReasonLabel(report.reason))}
      ${createKv('Durum', getStatusLabel(report.status))}
      ${createKv('Önem', getSeverityLabel(report.severity))}
      ${createKv('Raporlayan', report.reporter?.name || '-')}
      ${createKv('Tarih', formatDate(report.created_at))}
      ${createKv('Açıklama', report.description || '-')}
    `;
  }

  preselectActionForReport(report);
}

function preselectActionForReport(report) {
  const select = document.getElementById('moderationActionType');

  if (!select) {
    return;
  }

  const map = {
    user: 'warn_user',
    feed_post: 'hide_feed_post',
    feed_comment: 'hide_feed_comment',
    community: 'deactivate_community',
    event: 'deactivate_event',
    social_room: 'close_social_room',
  };

  select.value = map[report.target_type] || '';
}

async function applyModerationAction(event) {
  event.preventDefault();

  if (!selectedReport) {
    showToast('Önce bir rapor seçmelisin.', 'error');
    return;
  }

  const actionType = document.getElementById('moderationActionType')?.value;
  const reason = document.getElementById('moderationReasonInput')?.value.trim();
  const note = document.getElementById('moderationNoteInput')?.value.trim();

  if (!actionType) {
    showToast('Aksiyon seçmelisin.', 'error');
    return;
  }

  const actionTarget = resolveActionTarget(selectedReport, actionType);

  if (!actionTarget) {
    showToast('Bu aksiyon için uygun hedef belirlenemedi.', 'error');
    return;
  }

  const confirmed = window.confirm(
    `Bu aksiyon uygulanacak:\n\n${getActionTypeLabel(actionType)}\nHedef: ${getTargetTypeLabel(actionTarget.target_type)} #${actionTarget.target_id}\n\nDevam edilsin mi?`
  );

  if (!confirmed) {
    return;
  }

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/action`, {
    method: 'POST',
    body: JSON.stringify({
      action_type: actionType,
      target_type: actionTarget.target_type,
      target_id: actionTarget.target_id,
      report_id: selectedReport.id,
      reason: reason || selectedReport.reason,
      note: note || selectedReport.description || '',
    }),
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Moderasyon aksiyonu uygulanamadı.', 'error');
    return;
  }

  showToast('Moderasyon aksiyonu başarıyla uygulandı.', 'success');

  clearActionForm();

  await loadModerationCenter();
}

function resolveActionTarget(report, actionType) {
  if (actionType.includes('user')) {
    const targetUserId = report.reported_user_id || report.target_id;

    if (!targetUserId) {
      return null;
    }

    return {
      target_type: 'user',
      target_id: targetUserId,
    };
  }

  if (actionType.includes('feed_post')) {
    return {
      target_type: 'feed_post',
      target_id: report.target_id,
    };
  }

  if (actionType.includes('feed_comment')) {
    return {
      target_type: 'feed_comment',
      target_id: report.target_id,
    };
  }

  if (actionType.includes('community')) {
    return {
      target_type: 'community',
      target_id: report.target_id,
    };
  }

  if (actionType.includes('event')) {
    return {
      target_type: 'event',
      target_id: report.target_id,
    };
  }

  if (actionType.includes('social_room')) {
    return {
      target_type: 'social_room',
      target_id: report.target_id,
    };
  }

  return {
    target_type: report.target_type,
    target_id: report.target_id,
  };
}

async function updateSelectedReportStatus(status) {
  if (!selectedReport) {
    showToast('Önce bir rapor seçmelisin.', 'error');
    return;
  }

  const note = document.getElementById('moderationNoteInput')?.value.trim();

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/reports/${selectedReport.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      admin_note: note || '',
    }),
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Rapor durumu güncellenemedi.', 'error');
    return;
  }

  showToast(`Rapor durumu güncellendi: ${getStatusLabel(status)}`, 'success');

  await loadModerationCenter();
}

async function loadActions() {
  const response = await adminFetch(`${API_BASE}/api/moderation/admin/actions?limit=50`);

  if (!response || !response.success) {
    moderationActionsCache = [];
    renderActions();
    return;
  }

  moderationActionsCache = response.data?.items || [];
  renderActions();
}

function renderActions() {
  const list = document.getElementById('actionsList');
  const countText = document.getElementById('actionsCountText');

  if (countText) {
    countText.textContent = `${moderationActionsCache.length} aksiyon`;
  }

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!moderationActionsCache.length) {
    list.innerHTML = `
      <div class="detail-card">
        <p>Henüz admin aksiyonu yok.</p>
      </div>
    `;
    return;
  }

  moderationActionsCache.forEach((action) => {
    const item = document.createElement('article');
    item.className = 'action-log-item';

    item.innerHTML = `
      <strong>${escapeHtml(getActionTypeLabel(action.action_type))}</strong>
      <small>
        ${escapeHtml(getTargetTypeLabel(action.target_type))} #${escapeHtml(action.target_id)}
        · ${escapeHtml(formatDate(action.created_at))}
      </small>
      <small style="display:block;margin-top:6px;">
        ${escapeHtml(action.note || action.reason || 'Not yok')}
      </small>
    `;

    list.appendChild(item);
  });
}

async function loadUsers() {
  const params = new URLSearchParams();

  const q = document.getElementById('userSearchInput')?.value.trim();
  const status = document.getElementById('userStatusFilter')?.value;

  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/users?${params.toString()}`);

  if (!response || !response.success) {
    moderationUsersCache = [];
    renderUsers();
    showToast(response?.message || 'Kullanıcılar alınamadı.', 'error');
    return;
  }

  moderationUsersCache = response.data?.items || [];
  renderUsers();
}

function renderUsers() {
  const list = document.getElementById('usersList');

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!moderationUsersCache.length) {
    list.innerHTML = `
      <div class="detail-card">
        <p>Kullanıcı bulunamadı.</p>
      </div>
    `;
    return;
  }

  moderationUsersCache.forEach((user) => {
    const card = document.createElement('article');
    card.className = 'user-card';

    card.innerHTML = `
      <strong>${escapeHtml(user.name || '-')}</strong>
      <span>${escapeHtml(user.email || '')}</span>
      <span>${escapeHtml(user.university || '')}</span>
      <span>Durum: ${user.is_active ? 'Aktif' : 'Pasif'}</span>
    `;

    card.addEventListener('click', () => {
      selectUserForQuickAction(user);
    });

    list.appendChild(card);
  });
}

function selectUserForQuickAction(user) {
  selectedReport = {
    id: null,
    target_type: 'user',
    target_id: user.id,
    reported_user_id: user.id,
    reason: 'manual_admin_review',
    description: 'Admin kullanıcı yönetimi üzerinden manuel işlem.',
    status: 'reviewing',
    severity: 'medium',
    reporter: null,
    reported_user: user,
    target_summary: {
      id: user.id,
      type: 'user',
      title: user.name,
      subtitle: user.email,
      is_active: user.is_active,
    },
  };

  renderSelectedReport(selectedReport);
  showToast(`${user.name} aksiyon paneline yüklendi.`, 'success');
}

function clearActionForm() {
  const actionType = document.getElementById('moderationActionType');
  const reason = document.getElementById('moderationReasonInput');
  const note = document.getElementById('moderationNoteInput');

  if (actionType) actionType.value = '';
  if (reason) reason.value = '';
  if (note) note.value = '';
}

function createQuickTestReportHint() {
  showToast('Test raporu için terminalden /api/moderation/reports endpointini kullanabilirsin. Backend testin zaten başarılı.', 'success');
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = String(value);
  }
}

function createKv(label, value) {
  return `
    <div class="kv">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value === null || value === undefined ? '-' : value)}</strong>
    </div>
  `;
}

function getStatusLabel(status) {
  const map = {
    pending: 'Bekleyen',
    reviewing: 'İncelemede',
    resolved: 'Çözüldü',
    rejected: 'Reddedildi',
  };

  return map[status] || status || '-';
}

function getSeverityLabel(severity) {
  const map = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
    critical: 'Kritik',
  };

  return map[severity] || severity || '-';
}

function getTargetTypeLabel(type) {
  const map = {
    user: 'Kullanıcı',
    feed_post: 'Feed Gönderisi',
    feed_comment: 'Feed Yorumu',
    community: 'Topluluk',
    event: 'Etkinlik',
    social_room: 'Sosyal Oda',
    chat_message: 'Sohbet Mesajı',
  };

  return map[type] || type || '-';
}

function getReasonLabel(reason) {
  const map = {
    spam: 'Spam',
    harassment: 'Taciz',
    hate_speech: 'Nefret Söylemi',
    violence: 'Şiddet',
    sexual_content: 'Cinsel İçerik',
    misinformation: 'Yanlış Bilgi',
    scam: 'Dolandırıcılık',
    privacy: 'Gizlilik İhlali',
    impersonation: 'Taklit',
    off_topic: 'Konu Dışı',
    other: 'Diğer',
    manual_admin_review: 'Manuel Admin İncelemesi',
  };

  return map[reason] || reason || '-';
}

function getActionTypeLabel(type) {
  const map = {
    warn_user: 'Kullanıcıyı Uyar',
    deactivate_user: 'Kullanıcıyı Pasifleştir',
    reactivate_user: 'Kullanıcıyı Aktifleştir',
    hide_feed_post: 'Feed Gönderisini Gizle',
    restore_feed_post: 'Feed Gönderisini Geri Al',
    hide_feed_comment: 'Feed Yorumunu Gizle',
    restore_feed_comment: 'Feed Yorumunu Geri Al',
    deactivate_community: 'Topluluğu Pasifleştir',
    reactivate_community: 'Topluluğu Aktifleştir',
    deactivate_event: 'Etkinliği Pasifleştir',
    reactivate_event: 'Etkinliği Aktifleştir',
    close_social_room: 'Sosyal Odayı Kapat',
    resolve_report: 'Raporu Çöz',
    reject_report: 'Raporu Reddet',
    review_report: 'Raporu İncelemeye Al',
  };

  return map[type] || type || '-';
}

function formatDate(value) {
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function debounce(callback, wait = 250) {
  let timeoutId;

  return (...args) => {
    window.clearTimeout(timeoutId);

    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}