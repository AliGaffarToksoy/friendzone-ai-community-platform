const API_BASE = 'http://localhost:5001';
const ADMIN_AUTH_KEY = 'friendzone_admin_auth';

let moderationOverviewCache = null;
let moderationReportsCache = [];
let moderationActionsCache = [];
let moderationUsersCache = [];
let moderationWarningsCache = [];
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

  window.clearTimeout(showToast.timeoutId);

  showToast.timeoutId = window.setTimeout(() => {
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
    refreshBtn.addEventListener('click', async () => {
      await loadModerationCenter();
      await loadUsers();
      showToast('Moderasyon verileri yenilendi.', 'success');
    });
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
    loadWarnings(),
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
    Number(stats.inactive_events || 0) +
    Number(stats.inactive_users || 0);

  setText('statHiddenContent', hiddenContent);
  setText('statUnacknowledgedWarnings', stats.unacknowledged_warnings || 0);
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

  if (selectedReport && selectedReport.id) {
    const updatedSelected = moderationReportsCache.find((item) => Number(item.id) === Number(selectedReport.id));

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

  if (!tbody) return;

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

    if (selectedReport && Number(selectedReport.id) === Number(report.id)) {
      tr.classList.add('active');
    }

    tr.innerHTML = `
      <td>#${escapeHtml(report.id)}</td>
      <td>
        <span class="target-title">${escapeHtml(target.title || getTargetTypeLabel(report.target_type))}</span>
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
      <td><span class="badge ${escapeHtml(report.status)}">${escapeHtml(getStatusLabel(report.status))}</span></td>
      <td><span class="badge ${escapeHtml(report.severity)}">${escapeHtml(getSeverityLabel(report.severity))}</span></td>
      <td>${escapeHtml(formatDate(report.created_at))}</td>
    `;

    tr.addEventListener('click', () => {
      selectReport(report.id);
    });

    tbody.appendChild(tr);
  });
}

function selectReport(reportId) {
  const report = moderationReportsCache.find((item) => Number(item.id) === Number(reportId));

  if (!report) return;

  selectedReport = report;
  renderReports();
  renderSelectedReport(report);
  loadReportDetail(report.id);
}

async function loadReportDetail(reportId) {
  const response = await adminFetch(`${API_BASE}/api/moderation/admin/reports/${reportId}`);

  if (!response || !response.success) {
    return;
  }

  selectedReport = response.data;
  renderSelectedReport(selectedReport);
}

function renderSelectedReport(report) {
  const empty = document.getElementById('reportDetailEmpty');
  const panel = document.getElementById('reportDetailPanel');
  const selectedText = document.getElementById('selectedReportText');
  const targetBox = document.getElementById('targetSummaryBox');
  const reportBox = document.getElementById('reportInfoBox');
  const actionsBox = document.getElementById('reportActionsBox');

  if (empty) empty.classList.add('hidden');
  if (panel) panel.classList.remove('hidden');

  if (selectedText) {
    selectedText.textContent = `#${report.id || 'Manuel'} · ${getStatusLabel(report.status)} · ${getSeverityLabel(report.severity)}`;
  }

  const target = report.target_summary || {};

  if (targetBox) {
    targetBox.innerHTML = `
      ${createKv('Hedef Tipi', getTargetTypeLabel(report.target_type))}
      ${createKv('Hedef ID', report.target_id)}
      ${createKv('Başlık', target.title || '-')}
      ${createKv('Aktif mi?', target.is_active === false ? 'Pasif / Gizli' : 'Aktif')}
      ${createKv('Sahip ID', report.reported_user_id || target.user_id || target.created_by || '-')}
      ${createKv('Sahip', report.reported_user?.name || '-')}
    `;
  }

  if (reportBox) {
    reportBox.innerHTML = `
      ${createKv('Rapor Nedeni', getReasonLabel(report.reason))}
      ${createKv('Durum', getStatusLabel(report.status))}
      ${createKv('Önem', getSeverityLabel(report.severity))}
      ${createKv('Raporlayan', report.reporter?.name || 'Admin Manuel İşlem')}
      ${createKv('Tarih', formatDate(report.created_at))}
      ${createKv('Admin Notu', report.admin_note || '-')}
      ${createKv('Açıklama', report.description || '-')}
    `;
  }

  if (actionsBox) {
    renderReportActions(report.actions || []);
  }

  populateActionsForReport(report);
}

function renderReportActions(actions) {
  const actionsBox = document.getElementById('reportActionsBox');

  if (!actionsBox) {
    return;
  }

  if (!actions.length) {
    actionsBox.innerHTML = `
      <div class="detail-card">
        <p>Bu rapor için henüz aksiyon uygulanmadı.</p>
      </div>
    `;
    return;
  }

  actionsBox.innerHTML = actions.map((action) => `
    <article class="action-log-item">
      <strong>${escapeHtml(getActionTypeLabel(action.action_type))}</strong>
      <small>
        ${escapeHtml(getTargetTypeLabel(action.target_type))} #${escapeHtml(action.target_id)}
        · ${escapeHtml(formatDate(action.created_at))}
      </small>
      <small style="margin-top:6px;">
        ${escapeHtml(action.note || action.reason || 'Not yok')}
      </small>
    </article>
  `).join('');
}

function populateActionsForReport(report) {
  const select = document.getElementById('moderationActionType');

  if (!select) return;

  const actionsByTarget = {
    user: [
      ['warn_user', 'Kullanıcıyı Uyar'],
      ['deactivate_user', 'Kullanıcıyı Pasifleştir'],
      ['reactivate_user', 'Kullanıcıyı Aktifleştir'],
    ],
    feed_post: [
      ['hide_feed_post', 'Feed Gönderisini Gizle'],
      ['restore_feed_post', 'Feed Gönderisini Geri Al'],
      ['warn_user', 'İçerik Sahibine Uyarı Gönder'],
      ['deactivate_user', 'İçerik Sahibinin Hesabını Pasifleştir'],
    ],
    feed_comment: [
      ['hide_feed_comment', 'Feed Yorumunu Gizle'],
      ['restore_feed_comment', 'Feed Yorumunu Geri Al'],
      ['warn_user', 'Yorum Sahibine Uyarı Gönder'],
      ['deactivate_user', 'Yorum Sahibinin Hesabını Pasifleştir'],
    ],
    community: [
      ['deactivate_community', 'Topluluğu Pasifleştir'],
      ['reactivate_community', 'Topluluğu Aktifleştir'],
      ['warn_user', 'Topluluk Sahibine Uyarı Gönder'],
      ['deactivate_user', 'Topluluk Sahibinin Hesabını Pasifleştir'],
    ],
    event: [
      ['deactivate_event', 'Etkinliği Pasifleştir'],
      ['reactivate_event', 'Etkinliği Aktifleştir'],
      ['warn_user', 'Etkinlik Sahibine Uyarı Gönder'],
      ['deactivate_user', 'Etkinlik Sahibinin Hesabını Pasifleştir'],
    ],
    social_room: [
      ['close_social_room', 'Sosyal Odayı Kapat'],
      ['warn_user', 'Oda Sahibine Uyarı Gönder'],
      ['deactivate_user', 'Oda Sahibinin Hesabını Pasifleştir'],
    ],
  };

  const list = actionsByTarget[report.target_type] || [
    ['warn_user', 'Kullanıcıyı Uyar'],
  ];

  select.innerHTML = `<option value="">Aksiyon seç</option>`;

  list.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  const defaultMap = {
    user: 'warn_user',
    feed_post: 'hide_feed_post',
    feed_comment: 'hide_feed_comment',
    community: 'deactivate_community',
    event: 'deactivate_event',
    social_room: 'close_social_room',
  };

  select.value = defaultMap[report.target_type] || '';
}

async function applyModerationAction(event) {
  event.preventDefault();

  if (!selectedReport) {
    showToast('Önce bir rapor veya kullanıcı seçmelisin.', 'error');
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

  if (!confirmed) return;

  const payload = {
    action_type: actionType,
    target_type: actionTarget.target_type,
    target_id: actionTarget.target_id,
    reason: reason || selectedReport.reason || 'manual_admin_review',
    note: note || selectedReport.description || '',
  };

  if (selectedReport.id) {
    payload.report_id = selectedReport.id;
  }

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/action`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Moderasyon aksiyonu uygulanamadı.', 'error');
    return;
  }

  showToast('Moderasyon aksiyonu başarıyla uygulandı.', 'success');

  clearActionForm();

  await loadModerationCenter();
  await loadUsers();

  if (selectedReport?.id) {
    await loadReportDetail(selectedReport.id);
  }
}

function resolveActionTarget(report, actionType) {
  if (actionType.includes('user')) {
    const targetUserId =
      report.reported_user_id ||
      report.target_summary?.user_id ||
      report.target_summary?.created_by ||
      report.target_id;

    if (!targetUserId) return null;

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
  if (!selectedReport || !selectedReport.id) {
    showToast('Önce kayıtlı bir rapor seçmelisin.', 'error');
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
  await loadReportDetail(selectedReport.id);
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

  if (!list) return;

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
      <small style="margin-top:6px;">
        ${escapeHtml(action.note || action.reason || 'Not yok')}
      </small>
    `;

    list.appendChild(item);
  });
}

async function loadWarnings() {
  const response = await adminFetch(`${API_BASE}/api/moderation/admin/warnings?limit=50`);

  if (!response || !response.success) {
    moderationWarningsCache = [];
    renderWarnings();
    return;
  }

  moderationWarningsCache = response.data?.items || [];
  renderWarnings();
}

function renderWarnings() {
  const list = document.getElementById('warningsList');
  const countText = document.getElementById('warningsCountText');

  if (countText) {
    const unacknowledged = moderationWarningsCache.filter((warning) => !warning.is_acknowledged).length;
    countText.textContent = `${moderationWarningsCache.length} uyarı · ${unacknowledged} okunmamış`;
  }

  if (!list) return;

  list.innerHTML = '';

  if (!moderationWarningsCache.length) {
    list.innerHTML = `
      <div class="detail-card">
        <p>Henüz kullanıcı uyarısı yok.</p>
      </div>
    `;
    return;
  }

  moderationWarningsCache.forEach((warning) => {
    const item = document.createElement('article');
    item.className = warning.is_acknowledged
      ? 'warning-log-item read'
      : 'warning-log-item unread';

    item.innerHTML = `
      <strong>${escapeHtml(warning.title || 'Moderasyon uyarısı')}</strong>
      <small>
        ${escapeHtml(warning.user?.name || `Kullanıcı #${warning.user_id}`)}
        · ${escapeHtml(warning.user?.email || '')}
      </small>
      <small style="margin-top:6px;">
        ${escapeHtml(warning.message || '-')}
      </small>
      <small style="margin-top:6px;">
        ${escapeHtml(getSeverityLabel(warning.severity))}
        · ${escapeHtml(warning.is_acknowledged ? 'Okundu' : 'Okunmadı')}
        · ${escapeHtml(formatDate(warning.created_at))}
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

  if (!list) return;

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
    card.className = 'user-card moderation-user-card';

    const statusLabel = user.is_active ? 'Aktif' : 'Pasif';
    const statusClass = user.is_active ? 'active' : 'passive';

    card.innerHTML = `
      <div class="moderation-user-card-main">
        <div class="moderation-user-avatar">${escapeHtml(getInitials(user.name))}</div>

        <div class="moderation-user-content">
          <div class="moderation-user-title-row">
            <strong>${escapeHtml(user.name || '-')}</strong>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>

          <span class="moderation-user-email">${escapeHtml(user.email || '')}</span>

          <div class="moderation-user-meta">
            <span>${escapeHtml(user.university || 'Üniversite yok')}</span>
            <span>${escapeHtml(user.department || 'Bölüm yok')}</span>
            <span>#${escapeHtml(user.id)}</span>
          </div>
        </div>
      </div>

      <div class="moderation-user-actions">
        <button type="button" data-user-action="warn_user">
          Uyar
        </button>

        ${
          user.is_active
            ? `<button type="button" class="danger" data-user-action="deactivate_user">
                Pasifleştir
              </button>`
            : `<button type="button" class="success" data-user-action="reactivate_user">
                Aktifleştir
              </button>`
        }

        <button type="button" data-user-action="load_panel">
          Panele Yükle
        </button>
      </div>
    `;

    const actionButtons = card.querySelectorAll('[data-user-action]');

    actionButtons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const actionType = button.dataset.userAction;

        if (actionType === 'load_panel') {
          selectUserForQuickAction(user);
          return;
        }

        await applyUserQuickAction(user, actionType);
      });
    });

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
  showToast(`${user.name || user.email} aksiyon paneline yüklendi.`, 'success');
}

async function applyUserQuickAction(user, actionType) {
  if (!user || !user.id) {
    showToast('Kullanıcı seçilemedi.', 'error');
    return;
  }

  const actionLabel = getActionTypeLabel(actionType);

  const defaultReasonMap = {
    warn_user: 'Admin kullanıcı yönetimi üzerinden uyarı.',
    deactivate_user: 'Admin kullanıcı yönetimi üzerinden pasifleştirme.',
    reactivate_user: 'Admin kullanıcı yönetimi üzerinden yeniden aktifleştirme.',
  };

  const defaultNoteMap = {
    warn_user: 'Lütfen FriendZone topluluk kurallarına uygun davran.',
    deactivate_user: 'Hesabın moderasyon tarafından geçici olarak pasifleştirildi.',
    reactivate_user: 'Hesabın yeniden aktifleştirildi.',
  };

  const confirmed = window.confirm(
    `${actionLabel} aksiyonu uygulanacak.\n\nKullanıcı: ${user.name || user.email || `#${user.id}`}\n\nDevam edilsin mi?`
  );

  if (!confirmed) return;

  const response = await adminFetch(`${API_BASE}/api/moderation/admin/action`, {
    method: 'POST',
    body: JSON.stringify({
      action_type: actionType,
      target_type: 'user',
      target_id: user.id,
      reason: defaultReasonMap[actionType] || 'Admin kullanıcı yönetimi aksiyonu.',
      note: defaultNoteMap[actionType] || '',
    }),
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Kullanıcı aksiyonu uygulanamadı.', 'error');
    return;
  }

  showToast(`${actionLabel} başarıyla uygulandı.`, 'success');

  await Promise.all([
    loadOverview(),
    loadActions(),
    loadWarnings(),
    loadUsers(),
  ]);
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
  showToast('Test raporu oluşturmak için kullanıcı tarafında Rapor Et butonunu kullanabilir veya /api/moderation/reports endpointini terminalden çağırabilirsin.', 'success');
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

function getInitials(name) {
  if (!name) return 'FZ';

  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
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
  if (!value) return '-';

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