const ADMIN_AUTH_KEY = 'friendzone_admin_auth';

let registrationChartInstance = null;
let personalityChartInstance = null;

let usersCache = [];
let communitiesCache = [];
let personalityStatsCache = [];
let hobbyStatsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  bindAdminEvents();

  const savedAdminAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);

  if (savedAdminAuth) {
    showDashboard();
    loadAdminDashboard();
  }
});

function bindAdminEvents() {
  const loginForm = document.getElementById('adminLoginForm');
  const refreshBtn = document.getElementById('refreshAdminBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const exportBtn = document.getElementById('exportBtn');
  const hideExportBtn = document.getElementById('hideExportBtn');
  const userSearch = document.getElementById('userSearch');
  const communitySearch = document.getElementById('communitySearch');

  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLogin);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadAdminDashboard();
      showToast('Admin verileri güncellendi.', 'success');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      window.location.href = 'admin.html';
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  if (hideExportBtn) {
    hideExportBtn.addEventListener('click', () => {
      document.getElementById('exportSection')?.classList.add('hidden');
    });
  }

  if (userSearch) {
    userSearch.addEventListener('input', renderUsersTable);
  }

  if (communitySearch) {
    communitySearch.addEventListener('input', renderCommunitiesTable);
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value.trim();

  if (!username || !password) {
    showToast('Admin kullanıcı adı ve şifre zorunludur.', 'error');
    return;
  }

  const encodedAuth = btoa(`${username}:${password}`);
  sessionStorage.setItem(ADMIN_AUTH_KEY, encodedAuth);

  const response = await adminFetch('/admin/api/dashboard/stats');

  if (!response || !response.success) {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    showToast('Admin kullanıcı adı veya şifre hatalı.', 'error');
    return;
  }

  showDashboard();
  await loadAdminDashboard();
}

function showDashboard() {
  document.getElementById('adminLoginView')?.classList.add('hidden');
  document.getElementById('adminDashboardView')?.classList.remove('hidden');
}

async function adminFetch(path, options = {}) {
  const encodedAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);

  if (!encodedAuth) {
    return null;
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Basic ${encodedAuth}`);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      mode: 'cors',
    });

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      showToast('Admin oturumu geçersiz. Tekrar giriş yap.', 'error');

      document.getElementById('adminLoginView')?.classList.remove('hidden');
      document.getElementById('adminDashboardView')?.classList.add('hidden');

      return null;
    }

    return data;
  } catch (error) {
    showToast(`Admin API hatası: ${error.message}`, 'error');
    return null;
  }
}

async function loadAdminDashboard() {
  await Promise.all([
    loadStats(),
    loadUsers(),
    loadCommunities(),
    loadPersonalityStats(),
    loadHobbyStats(),
  ]);
}

async function loadStats() {
  const response = await adminFetch('/admin/api/dashboard/stats');

  if (!response || !response.success) return;

  const stats = response.data || {};

  setText('userCount', stats.user_count || 0);
  setText('communityCount', stats.community_count || 0);
  setText('messageCount', stats.message_count || 0);

  renderRegistrationChart(stats.registrations_last_7_days || []);
}

async function loadUsers() {
  const response = await adminFetch('/admin/api/user');

  if (!response || !response.success) return;

  usersCache = response.data || [];
  renderUsersTable();
}

async function loadCommunities() {
  const response = await adminFetch('/admin/api/communities');

  if (!response || !response.success) return;

  communitiesCache = response.data || [];
  renderCommunitiesTable();
}

async function loadPersonalityStats() {
  const response = await adminFetch('/admin/api/personality-stats');

  if (!response || !response.success) return;

  personalityStatsCache = response.data || [];

  const total = personalityStatsCache.reduce((sum, item) => {
    return sum + Number(item.count || 0);
  }, 0);

  setText('personalityCount', total);

  renderPersonalityChart(personalityStatsCache);
}

async function loadHobbyStats() {
  const response = await adminFetch('/admin/api/hobby-stats');

  if (!response || !response.success) return;

  hobbyStatsCache = response.data || [];
  renderHobbyStats();
}

function renderRegistrationChart(data) {
  const canvas = document.getElementById('registrationChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = data.map((item) => item.date);
  const values = data.map((item) => item.count);

  if (registrationChartInstance) {
    registrationChartInstance.destroy();
  }

  registrationChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Kayıt Sayısı',
          data: values,
          tension: 0.38,
          borderWidth: 3,
          pointRadius: 4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#cbd5e1',
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94a3b8',
            precision: 0,
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
          },
        },
      },
    },
  });
}

function renderPersonalityChart(data) {
  const canvas = document.getElementById('personalityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = data.map((item) => item.type);
  const values = data.map((item) => item.count);

  if (personalityChartInstance) {
    personalityChartInstance.destroy();
  }

  personalityChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          label: 'Kişilik Tipleri',
          data: values,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#cbd5e1',
            padding: 16,
          },
        },
      },
    },
  });
}

function renderHobbyStats() {
  const container = document.getElementById('hobbyStats');

  if (!container) return;

  container.innerHTML = '';

  if (!hobbyStatsCache.length) {
    container.innerHTML = `
      <div class="admin-empty-state">
        <strong>Hobi verisi bulunamadı</strong>
        <p>Kullanıcılar hobi seçtikçe burada görünecek.</p>
      </div>
    `;
    return;
  }

  const maxCount = Math.max(...hobbyStatsCache.map((item) => Number(item.count || 0)), 1);

  hobbyStatsCache.slice(0, 10).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'hobby-stat-row';

    const top = document.createElement('div');
    top.className = 'hobby-stat-top';

    const name = document.createElement('strong');
    name.textContent = item.hobby || '-';

    const count = document.createElement('span');
    count.textContent = `${item.count || 0} kullanıcı`;

    top.appendChild(name);
    top.appendChild(count);

    const bar = document.createElement('div');
    bar.className = 'hobby-stat-bar';

    const fill = document.createElement('div');
    fill.style.width = `${Math.max(8, (Number(item.count || 0) / maxCount) * 100)}%`;

    bar.appendChild(fill);

    row.appendChild(top);
    row.appendChild(bar);

    container.appendChild(row);
  });
}

function renderUsersTable() {
  const container = document.getElementById('adminUsers');
  const search = document.getElementById('userSearch')?.value.toLowerCase().trim() || '';

  if (!container) return;

  const filtered = usersCache.filter((user) => {
    const text = `${user.name || ''} ${user.email || ''} ${user.university || ''} ${user.department || ''} ${user.personality_type || ''}`.toLowerCase();
    return text.includes(search);
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="admin-empty-state">
        <strong>Kullanıcı bulunamadı</strong>
        <p>Arama kriterini değiştirerek tekrar deneyebilirsin.</p>
      </div>
    `;
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Kullanıcı</th>
        <th>Üniversite</th>
        <th>Bölüm</th>
        <th>Sınıf</th>
        <th>MBTI</th>
        <th>Durum</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  filtered.forEach((user) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>#${escapeHtml(user.id)}</td>
      <td>
        <div class="table-user-cell">
          <div class="table-avatar">${escapeHtml(getInitials(user.name))}</div>
          <div>
            <strong>${escapeHtml(user.name || 'İsimsiz Kullanıcı')}</strong>
            <span>${escapeHtml(user.email || '-')}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.university || '-')}</td>
      <td>${escapeHtml(user.department || '-')}</td>
      <td>${escapeHtml(user.year || '-')}</td>
      <td><span class="admin-badge">${escapeHtml(user.personality_type || '-')}</span></td>
      <td>${user.is_active ? '<span class="status-badge active">Aktif</span>' : '<span class="status-badge passive">Pasif</span>'}</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  container.innerHTML = '';
  container.appendChild(table);
}

function renderCommunitiesTable() {
  const container = document.getElementById('adminCommunities');
  const search = document.getElementById('communitySearch')?.value.toLowerCase().trim() || '';

  if (!container) return;

  const filtered = communitiesCache.filter((community) => {
    const text = `${community.name || ''} ${community.category || ''} ${community.description || ''}`.toLowerCase();
    return text.includes(search);
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="admin-empty-state">
        <strong>Topluluk bulunamadı</strong>
        <p>Arama kriterini değiştirerek tekrar deneyebilirsin.</p>
      </div>
    `;
    return;
  }

  const table = document.createElement('table');
  table.className = 'admin-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Topluluk</th>
        <th>Kategori</th>
        <th>Üye</th>
        <th>Limit</th>
        <th>Durum</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  filtered.forEach((community) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>#${escapeHtml(community.id)}</td>
      <td>
        <div class="table-user-cell">
          <div class="table-avatar">${escapeHtml(getInitials(community.name))}</div>
          <div>
            <strong>${escapeHtml(community.name || '-')}</strong>
            <span>${escapeHtml(community.description || '-')}</span>
          </div>
        </div>
      </td>
      <td><span class="admin-badge">${escapeHtml(community.category || '-')}</span></td>
      <td>${escapeHtml(community.member_count || 0)}</td>
      <td>${escapeHtml(community.max_members || '-')}</td>
      <td>${community.is_active ? '<span class="status-badge active">Aktif</span>' : '<span class="status-badge passive">Pasif</span>'}</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  container.innerHTML = '';
  container.appendChild(table);
}

async function exportData() {
  const response = await adminFetch('/admin/api/export');

  if (!response || !response.success) {
    showToast('Export alınamadı.', 'error');
    return;
  }

  const section = document.getElementById('exportSection');
  const pre = document.getElementById('exportData');

  if (!section || !pre) return;

  section.classList.remove('hidden');
  pre.textContent = JSON.stringify(response.data, null, 2);

  section.scrollIntoView({ behavior: 'smooth' });

  showToast('Export başarıyla hazırlandı.', 'success');
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = String(value);
  }
}

function getInitials(name) {
  if (!name) return 'FZ';

  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}