document.addEventListener('DOMContentLoaded', () => {
  bindCertificateVerifyEvents();
  prefillCertificateNumberFromQuery();
  updatePublicVerifyPageState();
});

function updatePublicVerifyPageState() {
  const logoutBtn = document.getElementById('logoutBtn');
  const currentUserId = localStorage.getItem('user_id');

  if (logoutBtn && !currentUserId) {
    logoutBtn.textContent = 'Giriş Yap';
    logoutBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
}

function bindCertificateVerifyEvents() {
  const form = document.getElementById('certificateVerifyForm');

  if (form) {
    form.addEventListener('submit', verifyCertificate);
  }
}

function prefillCertificateNumberFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const certificateNumber = params.get('number');

  if (!certificateNumber) return;

  const input = document.getElementById('certificateNumberInput');

  if (input) {
    input.value = certificateNumber;
  }

  verifyCertificateByNumber(certificateNumber);
}

async function verifyCertificate(event) {
  event.preventDefault();

  const input = document.getElementById('certificateNumberInput');
  const certificateNumber = input?.value.trim();

  await verifyCertificateByNumber(certificateNumber);
}


async function verifyCertificateByNumber(certificateNumber) {
  const button = document.getElementById('verifyCertificateBtn');

  if (!certificateNumber) {
    showToast('Sertifika numarası girilmelidir.', 'error');
    return;
  }

  const originalText = button ? button.textContent : 'Sertifikayı Doğrula';

  if (button) {
    button.disabled = true;
    button.textContent = 'Doğrulanıyor...';
  }

const response = await fetch(
  `${API_BASE}/api/certificates/verify?number=${encodeURIComponent(certificateNumber)}`
)
  .then((res) => res.json())
  .catch(() => null);

  if (button) {
    button.disabled = false;
    button.textContent = originalText;
  }

  if (!response || !response.success) {
    renderInvalidCertificate(response?.message || 'Sertifika doğrulanamadı.');
    showToast(response?.message || 'Sertifika doğrulanamadı.', 'error');
    return;
  }

  renderValidCertificate(response.data);
  showToast('Sertifika başarıyla doğrulandı.', 'success');
}


  const originalText = button ? button.textContent : 'Sertifikayı Doğrula';

  if (button) {
    button.disabled = true;
    button.textContent = 'Doğrulanıyor...';
  }

const response = await fetch(
  `${API_BASE}/api/certificates/verify?number=${encodeURIComponent(certificateNumber)}`
)
  .then((res) => res.json())
  .catch(() => null);

  if (button) {
    button.disabled = false;
    button.textContent = originalText;
  }

  if (!response || !response.success) {
    renderInvalidCertificate(response?.message || 'Sertifika doğrulanamadı.');
    showToast(response?.message || 'Sertifika doğrulanamadı.', 'error');
    return;
  }

  renderValidCertificate(response.data);
  showToast('Sertifika başarıyla doğrulandı.', 'success');
}

function renderValidCertificate(data) {
  const result = document.getElementById('certificateResult');
  const content = document.getElementById('certificateResultContent');

  if (!result || !content) return;

  const user = data.user || {};
  const certificate = data.certificate || {};

  content.innerHTML = '';

  const status = document.createElement('div');
  status.className = 'verify-status success';
  status.innerHTML = `
    <span>✅</span>
    <div>
      <strong>Sertifika Geçerli</strong>
      <p>Bu sertifika FriendZone sistemi tarafından doğrulandı.</p>
    </div>
  `;

  const preview = document.createElement('div');
  preview.className = 'verified-certificate-preview';

  preview.innerHTML = `
    <div class="verified-certificate-top">
      <div class="verified-certificate-icon">${certificate.icon || '🎓'}</div>
      <div>
        <span>${certificate.issuer_name || 'FriendZone'}</span>
        <strong>${certificate.title || 'FriendZone Sertifikası'}</strong>
      </div>
    </div>

    <div class="verified-certificate-body">
      <p>Bu sertifika</p>
      <h3>${escapeHtml(user.name || 'FriendZone Kullanıcısı')}</h3>
      <p>adına düzenlenmiştir.</p>
      <h4>${certificate.title || 'FriendZone Sertifikası'}</h4>
      <p>${certificate.description || ''}</p>
    </div>

    <div class="verified-certificate-meta">
      <div>
        <span>Sertifika No</span>
        <strong>${data.certificate_number || '-'}</strong>
      </div>

      <div>
        <span>Kazanılma Tarihi</span>
        <strong>${formatDate(data.earned_at)}</strong>
      </div>

      <div>
        <span>Geçerlilik</span>
        <strong>${data.is_valid ? 'Geçerli' : 'Geçersiz'}</strong>
      </div>
    </div>
  `;

  const owner = document.createElement('div');
  owner.className = 'certificate-owner-card';

  owner.innerHTML = `
    <strong>Sertifika Sahibi</strong>

    <div class="owner-grid">
      <div>
        <span>Ad Soyad</span>
        <b>${escapeHtml(user.name || '-')}</b>
      </div>

      <div>
        <span>Üniversite</span>
        <b>${escapeHtml(user.university || '-')}</b>
      </div>

      <div>
        <span>Bölüm</span>
        <b>${escapeHtml(user.department || '-')}</b>
      </div>

      <div>
        <span>Şehir</span>
        <b>${escapeHtml(user.city || '-')}</b>
      </div>
    </div>
  `;

  content.appendChild(status);
  content.appendChild(preview);
  content.appendChild(owner);

  result.classList.remove('hidden');
}

function renderInvalidCertificate(message) {
  const result = document.getElementById('certificateResult');
  const content = document.getElementById('certificateResultContent');

  if (!result || !content) return;

  content.innerHTML = `
    <div class="verify-status error">
      <span>❌</span>
      <div>
        <strong>Sertifika Doğrulanamadı</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;

  result.classList.remove('hidden');
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}