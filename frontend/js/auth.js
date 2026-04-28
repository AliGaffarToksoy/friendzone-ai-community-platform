document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();
  bindPasswordToggles();
  bindLoginForm();
  bindSignupForm();
});

function redirectIfAuthenticated() {
  const token = localStorage.getItem('token');
  const currentPage = window.location.pathname.split('/').pop();

  if (token && (currentPage === 'login.html' || currentPage === 'signup.html')) {
    window.location.href = 'communities.html';
  }
}

function bindPasswordToggles() {
  const toggles = document.querySelectorAll('.password-toggle');

  toggles.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      const input = document.getElementById(targetId);

      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.textContent = isPassword ? 'Gizle' : 'Göster';
    });
  });
}

function bindLoginForm() {
  const loginForm = document.getElementById('loginForm');

  if (!loginForm) return;

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!validateEmail(email)) {
      showToast('Lütfen geçerli bir e-posta adresi gir.', 'error');
      return;
    }

    if (!password || password.length < 6) {
      showToast('Şifre en az 6 karakter olmalı.', 'error');
      return;
    }

    const submitBtn = document.getElementById('loginSubmitBtn');
    const originalText = submitBtn.textContent;

    setButtonLoading(submitBtn, 'Giriş Yapılıyor...');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || 'Giriş başarısız.', 'error');
        return;
      }

      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user_id', data.data.user_id);

      showToast('Giriş başarılı. Yönlendiriliyorsun...', 'success');

      setTimeout(() => {
        window.location.href = data.data.next || 'communities.html';
      }, 500);
    } catch (error) {
      showToast(`Bağlantı hatası: ${error.message}`, 'error');
    } finally {
      resetButton(submitBtn, originalText);
    }
  });
}

function bindSignupForm() {
  const signupForm = document.getElementById('signupForm');

  if (!signupForm) return;

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const university = document.getElementById('university').value.trim();
    const department = document.getElementById('department').value.trim();
    const year = document.getElementById('year').value.trim();

    if (!name || name.length < 2) {
      showToast('Ad Soyad en az 2 karakter olmalı.', 'error');
      return;
    }

    if (!validateEmail(email)) {
      showToast('Lütfen geçerli bir e-posta adresi gir.', 'error');
      return;
    }

    if (!validateEduEmail(email)) {
      showToast('Sadece .edu.tr uzantılı üniversite e-postaları kabul edilir.', 'error');
      return;
    }

    if (!password || password.length < 6) {
      showToast('Şifre en az 6 karakter olmalı.', 'error');
      return;
    }

    const submitBtn = document.getElementById('signupSubmitBtn');
    const originalText = submitBtn.textContent;

    setButtonLoading(submitBtn, 'Hesap Oluşturuluyor...');

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          password,
          university,
          department,
          year
        })
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message || 'Kayıt başarısız.', 'error');
        return;
      }

      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user_id', data.data.user_id);

      showToast('Kayıt başarılı. Kişilik testine yönlendiriliyorsun...', 'success');

      setTimeout(() => {
        window.location.href = 'personality_test.html';
      }, 600);
    } catch (error) {
      showToast(`Bağlantı hatası: ${error.message}`, 'error');
    } finally {
      resetButton(submitBtn, originalText);
    }
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateEduEmail(email) {
  return email.endsWith('.edu.tr');
}

function setButtonLoading(button, text) {
  if (!button) return;

  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = text;
  button.classList.add('is-loading');
}

function resetButton(button, fallbackText) {
  if (!button) return;

  button.disabled = false;
  button.textContent = button.dataset.originalText || fallbackText;
  button.classList.remove('is-loading');
}