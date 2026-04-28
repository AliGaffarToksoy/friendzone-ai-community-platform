const API_BASE = 'http://localhost:5001';

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
  }, 3500);
}

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

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

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');

      if (!window.location.pathname.endsWith('login.html')) {
        showToast('Oturum süren doldu. Tekrar giriş yapmalısın.', 'error');

        setTimeout(() => {
          window.location.href = 'login.html';
        }, 800);
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
  sessionStorage.removeItem('friendzone_admin_auth');
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});