const REPORT_API_BASE = window.API_BASE || 'http://localhost:5001';

let activeReportTarget = null;

document.addEventListener('DOMContentLoaded', () => {
  injectReportModalStyles();
  ensureReportModal();
  bindAutoReportButtons();
});

function openReportModal(targetType, targetId, targetTitle = '') {
  activeReportTarget = {
    target_type: targetType,
    target_id: Number(targetId),
    target_title: targetTitle || `${targetType} #${targetId}`,
  };

  const modal = document.getElementById('reportModal');
  const title = document.getElementById('reportTargetTitle');
  const reason = document.getElementById('reportReason');
  const severity = document.getElementById('reportSeverity');
  const description = document.getElementById('reportDescription');

  if (title) title.textContent = activeReportTarget.target_title;
  if (reason) reason.value = 'spam';
  if (severity) severity.value = 'medium';
  if (description) description.value = '';

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeReportModal() {
  const modal = document.getElementById('reportModal');

  if (modal) {
    modal.classList.add('hidden');
  }

  activeReportTarget = null;
}

function ensureReportModal() {
  if (document.getElementById('reportModal')) {
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'reportModal';
  modal.className = 'report-modal-overlay hidden';

  modal.innerHTML = `
    <div class="report-modal-card">
      <div class="report-modal-header">
        <div>
          <span>Moderasyon Raporu</span>
          <h2>Rapor Et</h2>
          <p id="reportTargetTitle">Hedef seçilmedi</p>
        </div>

        <button id="closeReportModalBtn" type="button" aria-label="Kapat">×</button>
      </div>

      <form id="reportForm" class="report-form">
        <label>
          Rapor nedeni
          <select id="reportReason" required>
            <option value="spam">Spam</option>
            <option value="harassment">Taciz / Rahatsız Etme</option>
            <option value="hate_speech">Nefret Söylemi</option>
            <option value="violence">Şiddet İçeriği</option>
            <option value="sexual_content">Uygunsuz / Cinsel İçerik</option>
            <option value="misinformation">Yanlış Bilgi</option>
            <option value="scam">Dolandırıcılık</option>
            <option value="privacy">Gizlilik İhlali</option>
            <option value="impersonation">Taklit / Sahte Profil</option>
            <option value="off_topic">Konu Dışı İçerik</option>
            <option value="other">Diğer</option>
          </select>
        </label>

        <label>
          Önem seviyesi
          <select id="reportSeverity" required>
            <option value="low">Düşük</option>
            <option value="medium" selected>Orta</option>
            <option value="high">Yüksek</option>
            <option value="critical">Kritik</option>
          </select>
        </label>

        <label>
          Açıklama
          <textarea id="reportDescription" maxlength="1000" placeholder="Lütfen rapor nedenini kısaca açıklayın..."></textarea>
        </label>

        <div class="report-modal-actions">
          <button type="button" id="cancelReportBtn" class="report-secondary-btn">Vazgeç</button>
          <button type="submit" id="submitReportBtn" class="report-primary-btn">Raporu Gönder</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('closeReportModalBtn');
  const cancelBtn = document.getElementById('cancelReportBtn');
  const form = document.getElementById('reportForm');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeReportModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeReportModal);
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeReportModal();
    }
  });

  if (form) {
    form.addEventListener('submit', submitReport);
  }
}

async function submitReport(event) {
  event.preventDefault();

  if (!activeReportTarget) {
    showReportToast('Rapor hedefi bulunamadı.', 'error');
    return;
  }

  const token = localStorage.getItem('token');

  if (!token) {
    showReportToast('Rapor göndermek için giriş yapmalısın.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitReportBtn');
  const originalText = submitBtn ? submitBtn.textContent : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';
  }

  const payload = {
    target_type: activeReportTarget.target_type,
    target_id: activeReportTarget.target_id,
    reason: document.getElementById('reportReason')?.value || 'other',
    severity: document.getElementById('reportSeverity')?.value || 'medium',
    description: document.getElementById('reportDescription')?.value.trim() || '',
  };

  try {
    const response = await fetch(`${REPORT_API_BASE}/api/moderation/reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.success) {
      showReportToast(data?.message || 'Rapor gönderilemedi.', 'error');
      return;
    }

    showReportToast('Rapor başarıyla gönderildi. Moderasyon ekibi inceleyecek.', 'success');
    closeReportModal();
  } catch (error) {
    console.error('submitReport error:', error);
    showReportToast(`Bağlantı hatası: ${error.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

function bindAutoReportButtons() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-report-target-type][data-report-target-id]');

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetType = button.dataset.reportTargetType;
    const targetId = button.dataset.reportTargetId;
    const targetTitle = button.dataset.reportTargetTitle || button.getAttribute('aria-label') || '';

    openReportModal(targetType, targetId, targetTitle);
  });
}

function createReportButton(targetType, targetId, targetTitle = '', className = 'report-inline-btn') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.reportTargetType = targetType;
  button.dataset.reportTargetId = String(targetId);
  button.dataset.reportTargetTitle = targetTitle;
  button.textContent = 'Rapor Et';

  return button;
}

function showReportToast(message, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(message, type);
    return;
  }

  let toast = document.getElementById('reportToast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'reportToast';
    toast.className = 'report-toast hidden';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `report-toast ${type}`;

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3600);
}

function injectReportModalStyles() {
  if (document.getElementById('reportModalStyles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'reportModalStyles';

  style.textContent = `
    .report-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.74);
      backdrop-filter: blur(12px);
    }

    .report-modal-overlay.hidden {
      display: none;
    }

    .report-modal-card {
      width: min(560px, 100%);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 26px;
      background:
        radial-gradient(circle at top left, rgba(239, 68, 68, 0.12), transparent 34%),
        rgba(15, 23, 42, 0.98);
      box-shadow: 0 30px 90px rgba(2, 6, 23, 0.48);
      color: #f8fafc;
      overflow: hidden;
    }

    .report-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 22px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    .report-modal-header span {
      display: block;
      margin-bottom: 6px;
      color: #f87171;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .report-modal-header h2 {
      margin: 0;
      font-size: 28px;
      letter-spacing: -0.05em;
    }

    .report-modal-header p {
      margin: 8px 0 0;
      color: rgba(203, 213, 225, 0.74);
      font-size: 13px;
      line-height: 1.45;
    }

    #closeReportModalBtn {
      width: 34px;
      height: 34px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.64);
      color: #f8fafc;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }

    #closeReportModalBtn:hover {
      border-color: rgba(239, 68, 68, 0.42);
      background: rgba(239, 68, 68, 0.16);
    }

    .report-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 22px;
    }

    .report-form label {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: rgba(226, 232, 240, 0.86);
      font-size: 13px;
      font-weight: 800;
    }

    .report-form select,
    .report-form textarea {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      background: rgba(2, 6, 23, 0.42);
      color: #f8fafc;
      outline: none;
      font: inherit;
    }

    .report-form select {
      min-height: 44px;
      padding: 0 12px;
    }

    .report-form textarea {
      min-height: 110px;
      padding: 12px;
      resize: vertical;
    }

    .report-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 4px;
    }

    .report-primary-btn,
    .report-secondary-btn,
    .report-inline-btn {
      min-height: 40px;
      border-radius: 14px;
      padding: 0 14px;
      cursor: pointer;
      font-weight: 900;
      transition: 0.16s ease;
    }

    .report-primary-btn {
      border: 1px solid rgba(239, 68, 68, 0.42);
      background: rgba(239, 68, 68, 0.22);
      color: #ffffff;
    }

    .report-primary-btn:hover {
      background: rgba(239, 68, 68, 0.34);
    }

    .report-secondary-btn {
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.62);
      color: #f8fafc;
    }

    .report-inline-btn {
      border: 1px solid rgba(239, 68, 68, 0.24);
      background: rgba(239, 68, 68, 0.10);
      color: #fecaca;
      font-size: 12px;
    }

    .report-inline-btn:hover {
      background: rgba(239, 68, 68, 0.18);
      color: #ffffff;
    }

    .report-toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 10001;
      max-width: 440px;
      padding: 14px 16px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.98);
      color: #f8fafc;
      box-shadow: 0 24px 80px rgba(2, 6, 23, 0.38);
    }

    .report-toast.hidden {
      display: none;
    }

    .report-toast.success {
      border-color: rgba(34, 197, 94, 0.42);
    }

    .report-toast.error {
      border-color: rgba(239, 68, 68, 0.42);
    }

    @media (max-width: 640px) {
      .report-modal-card {
        border-radius: 22px;
      }

      .report-modal-actions {
        flex-direction: column;
      }

      .report-primary-btn,
      .report-secondary-btn {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}

window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.createReportButton = createReportButton;