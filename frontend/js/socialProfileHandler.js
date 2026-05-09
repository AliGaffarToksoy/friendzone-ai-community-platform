let socialProfileUser = null;
let socialProfilePosts = [];
let socialProfileCommunities = [];
let socialGamification = null;
let selectedCertificate = null;

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  await Promise.all([
    loadSocialProfile(),
    loadProfileCommunities(),
    loadProfilePosts(),
    loadGamificationSummary()
  ]);

renderSocialScore();
renderBadges();
renderPointHistory();
renderCertificates();
bindCertificateModalEvents();
});

async function loadSocialProfile() {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  const response = await authFetch(`${API_BASE}/api/users/profile/${currentUserId}`);

  if (!response || !response.success) {
    const fallbackResponse = await authFetch(`${API_BASE}/api/user/profile/${currentUserId}`);

    if (!fallbackResponse || !fallbackResponse.success) {
      showToast(
        fallbackResponse?.message || response?.message || 'Profil bilgileri alınamadı.',
        'error'
      );

      renderFallbackProfile();
      return;
    }

    socialProfileUser = fallbackResponse.data;
  } else {
    socialProfileUser = response.data;
  }

  renderProfileHeader();
  renderAboutSection();
  renderHobbies();
}

async function loadProfileCommunities() {
  const currentUserId = localStorage.getItem('user_id');

  const response = await authFetch(`${API_BASE}/api/community/user/${currentUserId}`);

  if (!response || !response.success) {
    socialProfileCommunities = [];
    renderProfileCommunities();
    return;
  }

  socialProfileCommunities = response.data || [];
  renderProfileCommunities();
}

async function loadProfilePosts() {
  const response = await authFetch(`${API_BASE}/api/feed?scope=me&limit=8`);

  if (!response || !response.success) {
    socialProfilePosts = [];
    renderProfilePosts();
    return;
  }

  socialProfilePosts = response.data || [];
  renderProfilePosts();
}

async function loadGamificationSummary() {
  const response = await authFetch(`${API_BASE}/api/gamification/me`);

  if (!response || !response.success) {
    socialGamification = null;
    return;
  }

  socialGamification = response.data;
}

function renderProfileHeader() {
  const user = socialProfileUser || {};

  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const headline = document.getElementById('profileHeadline');
  const university = document.getElementById('profileUniversity');
  const department = document.getElementById('profileDepartment');
  const city = document.getElementById('profileCity');
  const personality = document.getElementById('profilePersonality');

  const displayName = user.name || user.full_name || 'FriendZone Kullanıcısı';

  if (avatar) {
    avatar.innerHTML = '';

    if (user.profile_image) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/uploads/profile_images/${user.profile_image}`;
      img.alt = displayName;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(displayName);
    }
  }

  if (name) name.textContent = displayName;

  if (headline) {
    headline.textContent = buildProfileHeadline(user);
  }

  if (university) {
    university.textContent = `Üniversite: ${user.university || '-'}`;
  }

  if (department) {
    department.textContent = `Bölüm: ${user.department || '-'}`;
  }

  if (city) {
    city.textContent = `Şehir: ${user.city || '-'}`;
  }

  if (personality) {
    personality.textContent = `Kişilik: ${user.personality_type || '-'}`;
  }
}

function renderAboutSection() {
  const user = socialProfileUser || {};
  const about = document.getElementById('profileAbout');

  if (!about) return;

  if (user.bio || user.about) {
    about.textContent = user.bio || user.about;
    return;
  }

  const pieces = [];

  if (user.university) {
    pieces.push(`${user.university} öğrencisi`);
  }

  if (user.department) {
    pieces.push(`${user.department} alanında gelişiyor`);
  }

  if (user.personality_type) {
    pieces.push(`${user.personality_type} kişilik profiline sahip`);
  }

  if (pieces.length) {
    about.textContent = `${pieces.join(', ')}. FriendZone üzerinde topluluklara katılarak, etkinliklere dahil olarak ve sosyal paylaşımlar yaparak kendini geliştiriyor.`;
    return;
  }

  about.textContent = 'Bu kullanıcı henüz hakkımda alanını doldurmadı. Topluluklara katıldıkça, etkinliklere dahil oldukça ve paylaşım yaptıkça profili daha güçlü görünecek.';
}

function renderHobbies() {
  const user = socialProfileUser || {};
  const container = document.getElementById('profileHobbiesList');

  if (!container) return;

  container.innerHTML = '';

  const hobbies = normalizeHobbies(user.hobbies);

  if (!hobbies.length) {
    container.innerHTML = `<span>Henüz ilgi alanı eklenmedi.</span>`;
    return;
  }

  hobbies.forEach((hobby) => {
    const tag = document.createElement('span');
    tag.textContent = hobby;
    container.appendChild(tag);
  });
}

function renderProfileCommunities() {
  const container = document.getElementById('profileCommunitiesList');

  if (!container) return;

  container.innerHTML = '';

  if (!socialProfileCommunities.length) {
    container.innerHTML = `
      <div class="profile-empty-state">
        Henüz topluluğa katılım görünmüyor.
      </div>
    `;
    return;
  }

  socialProfileCommunities.slice(0, 6).forEach((community) => {
    const link = document.createElement('a');
    link.href = `community.html?id=${community.id}`;
    link.className = 'profile-community-card';

    const avatar = document.createElement('div');
    avatar.className = 'profile-community-avatar';
    avatar.textContent = getInitials(community.name);

    const info = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = community.name || 'Topluluk';

    const meta = document.createElement('span');
    meta.textContent = [
      community.category || 'Genel',
      getScopeLabel(community.scope)
    ].filter(Boolean).join(' · ');

    info.appendChild(name);
    info.appendChild(meta);

    link.appendChild(avatar);
    link.appendChild(info);

    container.appendChild(link);
  });
}

function renderProfilePosts() {
  const container = document.getElementById('profilePostsList');

  if (!container) return;

  container.innerHTML = '';

  if (!socialProfilePosts.length) {
    container.innerHTML = `
      <div class="profile-empty-state">
        Henüz paylaşım yok. Ana akışta ilk paylaşımını yapabilirsin.
      </div>
    `;
    return;
  }

  socialProfilePosts.forEach((post) => {
    const card = document.createElement('article');
    card.className = 'profile-post-card';

    const top = document.createElement('div');
    top.className = 'profile-post-top';

    const badge = document.createElement('span');
    badge.className = `profile-post-badge type-${post.post_type || 'text'}`;
    badge.textContent = getPostTypeLabel(post.post_type);

    const date = document.createElement('span');
    date.textContent = formatDate(post.created_at);

    top.appendChild(badge);
    top.appendChild(date);

    const content = document.createElement('p');
    content.textContent = post.content;

    const stats = document.createElement('div');
    stats.className = 'profile-post-stats';

    const likes = document.createElement('span');
    likes.textContent = `❤️ ${post.like_count || 0}`;

    const comments = document.createElement('span');
    comments.textContent = `💬 ${post.comment_count || 0}`;

    stats.appendChild(likes);
    stats.appendChild(comments);

    if (post.community) {
      const community = document.createElement('span');
      community.textContent = `🌐 ${post.community.name}`;
      stats.appendChild(community);
    }

    card.appendChild(top);
    card.appendChild(content);
    card.appendChild(stats);

    container.appendChild(card);
  });
}

function renderSocialScore() {
  const scoreValue = document.getElementById('socialScoreValue');
  const progress = document.getElementById('socialScoreProgress');
  const level = document.getElementById('socialScoreLevel');

  const points = socialGamification?.points || {};
  const totalPoints = Number(points.total_points || 0);
  const levelText = points.level || 'Başlangıç Seviyesi';

  if (scoreValue) scoreValue.textContent = totalPoints;

  const progressValue = socialGamification?.progress_to_next_badge;
  const percentage = progressValue !== null && progressValue !== undefined
    ? Number(progressValue)
    : Math.min(100, totalPoints);

  if (progress) {
    progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }

  if (level) {
    const nextBadge = socialGamification?.next_badge;

    if (nextBadge) {
      level.textContent = `${levelText} · Sıradaki rozet: ${nextBadge.name}`;
    } else {
      level.textContent = `${levelText} · Tüm rozetler kazanıldı`;
    }
  }
}

function renderBadges() {
  const container = document.getElementById('profileBadgesList');

  if (!container) return;

  container.innerHTML = '';

  const badges = socialGamification?.badges || [];

  if (!badges.length) {
    container.innerHTML = `
      <div class="profile-empty-state">
        Henüz rozet bilgisi bulunmuyor.
      </div>
    `;
    return;
  }

  badges.forEach((badge) => {
    const card = document.createElement('div');
    card.className = badge.earned ? 'badge-card earned' : 'badge-card locked';

    const icon = document.createElement('span');
    icon.textContent = badge.icon || '🏅';

    const name = document.createElement('strong');
    name.textContent = badge.name;

    const description = document.createElement('small');

    if (badge.earned) {
      description.textContent = badge.earned_at
        ? `Kazanıldı · ${formatDate(badge.earned_at)}`
        : 'Kazanıldı';
    } else {
      description.textContent = `${badge.required_points || 0} puanda açılır`;
    }

    const detail = document.createElement('small');
    detail.textContent = badge.description || '';

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(description);

    if (detail.textContent) {
      card.appendChild(detail);
    }

    container.appendChild(card);
  });
}

function renderCertificates() {
  const container = document.getElementById('profileCertificatesList');

  if (!container) return;

  container.innerHTML = '';

  const certificates = socialGamification?.certificates || [];

  if (!certificates.length) {
    container.innerHTML = `
      <div class="profile-empty-state">
        Henüz sertifika bilgisi bulunmuyor.
      </div>
    `;
    return;
  }

  certificates.forEach((certificate) => {
    const card = document.createElement('article');
    card.className = certificate.earned
      ? 'certificate-card earned'
      : 'certificate-card locked';

    card.tabIndex = 0;
    card.role = 'button';
    card.title = certificate.earned
      ? 'Sertifika detayını görüntüle'
      : 'Sertifika kazanım şartlarını görüntüle';

    card.addEventListener('click', () => {
      openCertificateModal(certificate);
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCertificateModal(certificate);
      }
    });

    const top = document.createElement('div');
    top.className = 'certificate-card-top';

    const icon = document.createElement('div');
    icon.className = 'certificate-icon';
    icon.textContent = certificate.icon || '🎓';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'certificate-title-wrap';

    const title = document.createElement('strong');
    title.textContent = certificate.title || 'FriendZone Sertifikası';

    const issuer = document.createElement('span');
    issuer.textContent = certificate.issuer_name
      ? `${certificate.issuer_name} tarafından`
      : 'FriendZone tarafından';

    titleWrap.appendChild(title);
    titleWrap.appendChild(issuer);

    top.appendChild(icon);
    top.appendChild(titleWrap);

    const description = document.createElement('p');
    description.textContent = certificate.description || '';

    const meta = document.createElement('div');
    meta.className = 'certificate-meta';

    const status = document.createElement('span');

    if (certificate.earned) {
      status.textContent = certificate.earned_at
        ? `Kazanıldı · ${formatDate(certificate.earned_at)}`
        : 'Kazanıldı';
      status.className = 'certificate-status earned';
    } else {
      status.textContent = `${certificate.required_points || 0} puanda açılır`;
      status.className = 'certificate-status locked';
    }

    meta.appendChild(status);

    if (certificate.certificate_number) {
      const number = document.createElement('span');
      number.className = 'certificate-number';
      number.textContent = certificate.certificate_number;
      meta.appendChild(number);
    }

    card.appendChild(top);

    if (description.textContent) {
      card.appendChild(description);
    }

    card.appendChild(meta);

    container.appendChild(card);
  });
}

function bindCertificateModalEvents() {
  const modal = document.getElementById('certificateModal');
  const closeBtn = document.getElementById('closeCertificateModalBtn');
  const printBtn = document.getElementById('printCertificateBtn');
  const verifyBtn = document.getElementById('verifySelectedCertificateBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeCertificateModal);
  }

  if (printBtn) {
    printBtn.addEventListener('click', printSelectedCertificate);
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', goToCertificateVerification);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeCertificateModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCertificateModal();
    }
  });
}

function openCertificateModal(certificate) {
  selectedCertificate = certificate;

  const modal = document.getElementById('certificateModal');
  const modalTitle = document.getElementById('certificateModalTitle');
  const preview = document.getElementById('certificatePreview');
  const lockedNotice = document.getElementById('certificateLockedNotice');

  const previewIcon = document.getElementById('certificatePreviewIcon');
  const ownerName = document.getElementById('certificateOwnerName');
  const previewTitle = document.getElementById('certificatePreviewTitle');
  const previewDescription = document.getElementById('certificatePreviewDescription');
  const previewNumber = document.getElementById('certificatePreviewNumber');
  const previewDate = document.getElementById('certificatePreviewDate');
  const previewIssuer = document.getElementById('certificatePreviewIssuer');

  const user = socialProfileUser || {};
  const displayName = user.name || user.full_name || 'FriendZone Kullanıcısı';

  if (modalTitle) {
    modalTitle.textContent = certificate.title || 'FriendZone Sertifikası';
  }

  if (previewIcon) {
    previewIcon.textContent = certificate.icon || '🎓';
  }

  if (ownerName) {
    ownerName.textContent = certificate.earned ? displayName : 'Henüz Kazanılmadı';
  }

  if (previewTitle) {
    previewTitle.textContent = certificate.title || 'FriendZone Sertifikası';
  }

  if (previewDescription) {
    previewDescription.textContent = certificate.description || '';
  }

  if (previewNumber) {
    previewNumber.textContent = certificate.certificate_number || 'Kilitli';
  }

  if (previewDate) {
    previewDate.textContent = certificate.earned_at ? formatDate(certificate.earned_at) : '-';
  }

  if (previewIssuer) {
    previewIssuer.textContent = certificate.issuer_name || 'FriendZone';
  }

  if (preview) {
    preview.classList.toggle('locked', !certificate.earned);
  }

  if (lockedNotice) {
    lockedNotice.classList.toggle('hidden', Boolean(certificate.earned));

    if (!certificate.earned) {
      lockedNotice.textContent = `${certificate.required_points || 0} puana ulaşınca ve gerekli rozet şartını tamamlayınca bu sertifika otomatik olarak açılacak.`;
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeCertificateModal() {
  const modal = document.getElementById('certificateModal');

  if (modal) {
    modal.classList.add('hidden');
  }

  selectedCertificate = null;
}

function printSelectedCertificate() {
  if (!selectedCertificate) {
    showToast('Sertifika seçilemedi.', 'error');
    return;
  }

  if (!selectedCertificate.earned) {
    showToast('Kilitli sertifikalar yazdırılamaz.', 'error');
    return;
  }

  window.print();
}

function goToCertificateVerification() {
  if (!selectedCertificate) {
    showToast('Sertifika seçilemedi.', 'error');
    return;
  }

  if (!selectedCertificate.earned || !selectedCertificate.certificate_number) {
    showToast('Kilitli sertifikalar doğrulama sayfasına gönderilemez.', 'error');
    return;
  }

  const certificateNumber = encodeURIComponent(selectedCertificate.certificate_number);

  window.location.href = `certificate-verify.html?number=${certificateNumber}`;
}


function renderPointHistory() {
  const container = document.getElementById('profilePointHistoryList');

  if (!container) return;

  container.innerHTML = '';

  const transactions = socialGamification?.recent_transactions || [];

  if (!transactions.length) {
    container.innerHTML = `
      <div class="profile-empty-state">
        Henüz puan geçmişi bulunmuyor. Paylaşım yaparak, etkinliğe katılarak veya topluluklarda aktif olarak puan kazanabilirsin.
      </div>
    `;
    return;
  }

  transactions.forEach((transaction) => {
    const item = document.createElement('article');
    item.className = 'point-history-item';

    const icon = document.createElement('div');
    icon.className = 'point-history-icon';
    icon.textContent = getPointActionIcon(transaction.action_type);

    const body = document.createElement('div');
    body.className = 'point-history-body';

    const title = document.createElement('strong');
    title.textContent = transaction.description || getPointActionLabel(transaction.action_type);

    const meta = document.createElement('span');
    meta.textContent = formatDate(transaction.created_at);

    body.appendChild(title);
    body.appendChild(meta);

    const points = document.createElement('div');
    points.className = transaction.points >= 0
      ? 'point-history-points positive'
      : 'point-history-points negative';

    points.textContent = `${transaction.points >= 0 ? '+' : ''}${transaction.points}`;

    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(points);

    container.appendChild(item);
  });
}

function getPointActionIcon(actionType) {
  const map = {
    profile_view: '👤',
    profile_completed: '✅',
    feed_post_created: '📝',
    feed_comment_created: '💬',
    feed_post_liked: '❤️',
    feed_post_received_like: '💜',
    feed_post_received_comment: '💭',
    community_joined: '🌐',
    community_created: '🚀',
    event_joined: '📅',
    event_created: '🎤',
    event_review_created: '⭐',
    sponsor_added: '🤝',
    member_role_updated: '🛡️',
    manual_test: '🧪'
  };

  return map[actionType] || '🏅';
}

function getPointActionLabel(actionType) {
  const map = {
    profile_view: 'Profil görüntüleme',
    profile_completed: 'Profil tamamlama',
    feed_post_created: 'Paylaşım oluşturma',
    feed_comment_created: 'Yorum yapma',
    feed_post_liked: 'Paylaşım beğenme',
    feed_post_received_like: 'Paylaşım beğeni aldı',
    feed_post_received_comment: 'Paylaşım yorum aldı',
    community_joined: 'Topluluğa katılma',
    community_created: 'Topluluk oluşturma',
    event_joined: 'Etkinliğe katılma',
    event_created: 'Etkinlik oluşturma',
    event_review_created: 'Etkinlik değerlendirme',
    sponsor_added: 'Sponsor ekleme',
    member_role_updated: 'Rol güncelleme',
    manual_test: 'Test puanı'
  };

  return map[actionType] || 'Sosyal puan işlemi';
}

function renderFallbackProfile() {
  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const headline = document.getElementById('profileHeadline');
  const about = document.getElementById('profileAbout');
  const hobbies = document.getElementById('profileHobbiesList');

  if (avatar) avatar.textContent = 'FZ';
  if (name) name.textContent = 'FriendZone Kullanıcısı';
  if (headline) headline.textContent = 'Profil bilgileri şu anda alınamadı.';
  if (about) about.textContent = 'Profil bilgileri backend üzerinden alınamadı. API bağlantısını kontrol etmek gerekebilir.';
  if (hobbies) hobbies.innerHTML = `<span>Bilgi yok</span>`;
}

function buildProfileHeadline(user) {
  const parts = [];

  if (user.department) parts.push(user.department);
  if (user.university) parts.push(user.university);
  if (user.city) parts.push(user.city);

  if (parts.length) {
    return parts.join(' · ');
  }

  return 'Topluluklara katılan, etkinliklere dahil olan ve sosyal becerilerini geliştiren FriendZone üyesi.';
}

function normalizeHobbies(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (error) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (typeof value === 'object') {
    return Object.values(value).flat().filter(Boolean);
  }

  return [];
}

function getPostTypeLabel(type) {
  const map = {
    text: 'Paylaşım',
    event: 'Etkinlik',
    achievement: 'Başarı',
    community_update: 'Topluluk',
    question: 'Soru',
    idea: 'Fikir'
  };

  return map[type] || 'Paylaşım';
}

function getScopeLabel(scope) {
  const map = {
    university: 'University',
    city: 'City',
    country: 'Country',
    online: 'Online'
  };

  return map[scope] || 'Country';
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getInitials(name) {
  if (!name) return 'FZ';

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}