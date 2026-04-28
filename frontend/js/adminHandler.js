let adminCredentials = null;
let registrationChartInstance = null;
let personalityChartInstance = null;

let usersCache = [];
let communitiesCache = [];
let personalityStatsCache = [];
let hobbyStatsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  bindAdminEvents();

  const savedAdmin = sessionStorage.getItem('friendzone_admin_auth');

  if (savedAdmin) {
    try {
      adminCredentials = JSON.parse(savedAdmin);
      showDashboard();
      loadAdminDashboard();
    } catch {
      sessionStorage.removeItem('friendzone_admin_auth');
    }
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
      sessionStorage.removeItem('friendzone_admin_auth');
      adminCredentials = null;
      location.reload();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  if (hideExportBtn) {
    hideExportBtn.addEventListener('click', () => {
      document.getElementById('exportSection').classList.add('hidden');
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

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  adminCredentials = { username, password };

  const response = await adminFetch('/admin/api/dashboard/stats');

  if (!response || !response.success) {
    showToast('Admin kullanıcı adı veya şifre hatalı.', 'error');
    adminCredentials = null;
    return;
  }

  sessionStorage.setItem('friendzone_admin_auth', JSON.stringify(adminCredentials));

  showDashboard();
  await loadAdminDashboard();
}

function showDashboard() {
  document.getElementById('adminLoginView').classList.add('hidden');
  document.getElementById('adminDashboardView').classList.remove('hidden');
}

async function loadAdminDashboard() {
  await Promise.all([
    loadStats(),
    loadUsers(),
    loadCommunities(),
    loadPersonalityStats(),
    loadHobbyStats()
  ]);
}

async function adminFetch(path) {
  if (!adminCredentials) return null;

  const headers = new Headers();
  const token = btoa(`${adminCredentials.username}:${adminCredentials.password}`);

  headers.set('Authorization', `Basic ${token}`);

  try {
    const response = await fetch(`${API_BASE}${path}`, { headers });

    if (response.status === 401) {
      showToast('Admin oturumu geçersiz.', 'error');
      return null;
    }

    return await response.json();
  } catch (error) {
    showToast(`Admin API hatası: ${error.message}`, 'error');
    return null;
  }
}

async function loadStats() {
  const response = await adminFetch('/admin/api/dashboard/stats');

  if (!response || !response.success) return;

  const stats = response.data;

  document.getElementById('userCount').textContent = stats.user_count || 0;
  document.getElementById('communityCount').textContent = stats.community_count || 0;
  document.getElementById('messageCount').textContent = stats.message_count || 0;

  renderRegistrationChart(stats.registrations_last_7_days || []);
}

async function loadUsers() {
  const response = await adminFetch('/admin/api/users');

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

  const total = personalityStatsCache.reduce((sum, item) => sum + item.count, 0);
  document.getElementById('personalityCount').textContent = total;

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
  if (!canvas) return;

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
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#cbd5e1'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94a3b8',
            precision: 0
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        }
      }
    }
  });
}

function renderPersonalityChart(data) {
  const canvas = document.getElementById('personalityChart');
  if (!canvas) return;

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
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#cbd5e1',
            padding: 16
          }
        }
      }
    }
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

  const maxCount = Math.max(...hobbyStatsCache.map((item) => item.count));

  hobbyStatsCache.slice(0, 10).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'hobby-stat-row';

    const top = document.createElement('div');
    top.className = 'hobby-stat-top';

    const name = document.createElement('strong');
    name.textContent = item.hobby;

    const count = document.createElement('span');
    count.textContent = `${item.count} kullanıcı`;

    top.appendChild(name);
    top.appendChild(count);

    const bar = document.createElement('div');
    bar.className = 'hobby-stat-bar';

    const fill = document.createElement('div');
    fill.style.width = `${Math.max(8, (item.count / maxCount) * 100)}%`;

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
    const text = `${user.name} ${user.email} ${user.university} ${user.department} ${user.personality_type}`.toLowerCase();
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
      <td>#${user.id}</td>
      <td>
        <div class="table-user-cell">
          <div class="table-avatar">${getInitials(user.name)}</div>
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
    const text = `${community.name} ${community.category} ${community.description}`.toLowerCase();
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
      <td>#${community.id}</td>
      <td>
        <div class="table-user-cell">
          <div class="table-avatar">${getInitials(community.name)}</div>
          <div>
            <strong>${escapeHtml(community.name || '-')}</strong>
            <span>${escapeHtml(community.description || '-')}</span>
          </div>
        </div>
      </td>
      <td><span class="admin-badge">${escapeHtml(community.category || '-')}</span></td>
      <td>${community.member_count || 0}</td>
      <td>${community.max_members || '-'}</td>
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

  section.classList.remove('hidden');
  pre.textContent = JSON.stringify(response.data, null, 2);

  section.scrollIntoView({ behavior: 'smooth' });

  showToast('Export başarıyla hazırlandı.', 'success');
}

function getInitials(name) {
  if (!name) return 'FZ';

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}