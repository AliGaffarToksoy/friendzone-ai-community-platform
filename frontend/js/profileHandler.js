let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  const userId = localStorage.getItem('user_id');

  if (!userId) {
    logout();
    return;
  }

  bindProfileEvents();

  await Promise.all([
    loadProfile(userId),
    loadSimilarUsers(userId)
  ]);
});

function bindProfileEvents() {
  const profileForm = document.getElementById('profileForm');
  const refreshSimilarBtn = document.getElementById('refreshSimilarBtn');

  if (profileForm) {
    profileForm.addEventListener('submit', updateProfile);
  }

  if (refreshSimilarBtn) {
    refreshSimilarBtn.addEventListener('click', async () => {
      const userId = localStorage.getItem('user_id');
      await loadSimilarUsers(userId);
      showToast('Benzer kullanıcılar güncellendi.', 'success');
    });
  }
}

async function loadProfile(userId) {
  const response = await authFetch(`${API_BASE}/api/user/profile/${userId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Profil bilgileri alınamadı.', 'error');
    return;
  }

  currentProfile = response.data;
  renderProfile(currentProfile);
  fillProfileForm(currentProfile);
}

function renderProfile(profile) {
  const avatar = document.getElementById('profileAvatar');
  const heroName = document.getElementById('profileNameHero');
  const subtitle = document.getElementById('profileSubtitle');

  const metricPersonality = document.getElementById('metricPersonality');
  const metricHobbyCount = document.getElementById('metricHobbyCount');
  const metricCompletion = document.getElementById('metricCompletion');

  const hobbyTags = document.getElementById('hobbyTags');
  const hobbyCountBadge = document.getElementById('hobbyCountBadge');

  const personalityBadge = document.getElementById('personalityBadge');
  const personalityDescription = document.getElementById('personalityDescription');

  const hobbies = Array.isArray(profile.hobbies) ? profile.hobbies : [];
  const completion = calculateCompletion(profile);

  if (avatar) avatar.textContent = getInitials(profile.name);
  if (heroName) heroName.textContent = profile.name || 'İsimsiz Kullanıcı';

  if (subtitle) {
    subtitle.textContent = `${profile.university || 'Üniversite bilgisi yok'} · ${profile.department || 'Bölüm bilgisi yok'} · ${profile.email}`;
  }

  if (metricPersonality) metricPersonality.textContent = profile.personality_type || '-';
  if (metricHobbyCount) metricHobbyCount.textContent = hobbies.length;
  if (metricCompletion) metricCompletion.textContent = `${completion}%`;

  if (hobbyCountBadge) hobbyCountBadge.textContent = hobbies.length;

  if (hobbyTags) {
    hobbyTags.innerHTML = '';

    if (!hobbies.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-soft';
      empty.textContent = 'Henüz hobi seçilmemiş.';
      hobbyTags.appendChild(empty);
    } else {
      hobbies.forEach((hobby) => {
        const tag = document.createElement('span');
        tag.className = 'hobby-tag';
        tag.textContent = hobby;
        hobbyTags.appendChild(tag);
      });
    }
  }

  if (personalityBadge) {
    personalityBadge.textContent = profile.personality_type || '-';
  }

  if (personalityDescription) {
    personalityDescription.textContent = getPersonalityDescription(profile.personality_type);
  }
}

function fillProfileForm(profile) {
  const fields = ['name', 'university', 'department', 'year', 'bio'];

  fields.forEach((field) => {
    const input = document.getElementById(field);
    if (input) input.value = profile[field] || '';
  });
}

async function updateProfile(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('name').value.trim(),
    university: document.getElementById('university').value.trim(),
    department: document.getElementById('department').value.trim(),
    year: document.getElementById('year').value.trim(),
    bio: document.getElementById('bio').value.trim()
  };

  if (!payload.name) {
    showToast('Ad Soyad alanı boş bırakılamaz.', 'error');
    return;
  }

  const response = await authFetch(`${API_BASE}/api/user/profile/update`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Profil güncellenemedi.', 'error');
    return;
  }

  showToast('Profil başarıyla güncellendi.', 'success');

  const userId = localStorage.getItem('user_id');
  await loadProfile(userId);
}

async function loadSimilarUsers(userId) {
  const response = await authFetch(`${API_BASE}/api/user/similar/${userId}`);
  const container = document.getElementById('similarUsers');

  if (!container) return;

  container.innerHTML = '';

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="empty-similar">
        <strong>Benzer kullanıcılar alınamadı</strong>
        <p>Backend bağlantısını veya kullanıcı hobilerini kontrol et.</p>
      </div>
    `;
    return;
  }

  if (!response.data.length) {
    container.innerHTML = `
      <div class="empty-similar">
        <strong>Henüz benzer kullanıcı bulunamadı</strong>
        <p>Daha iyi eşleşmeler için hobi sayını artırabilir veya başka kullanıcılar ekleyebilirsin.</p>
      </div>
    `;
    return;
  }

  response.data.forEach((user) => {
    const card = document.createElement('article');
    card.className = 'similar-card';

    const avatar = document.createElement('div');
    avatar.className = 'similar-avatar';
    avatar.textContent = getInitials(user.name);

    const body = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = user.name || 'İsimsiz Kullanıcı';

    const meta = document.createElement('p');
    meta.textContent = `${user.university || 'Üniversite yok'} · ${user.department || 'Bölüm yok'}`;

    const badge = document.createElement('span');
    badge.className = 'similar-badge';
    badge.textContent = user.personality_type || 'MBTI yok';

    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(badge);

    card.appendChild(avatar);
    card.appendChild(body);

    container.appendChild(card);
  });
}

function calculateCompletion(profile) {
  const fields = [
    profile.name,
    profile.email,
    profile.university,
    profile.department,
    profile.year,
    profile.bio,
    profile.personality_type,
    Array.isArray(profile.hobbies) && profile.hobbies.length >= 3 ? 'hobbies' : ''
  ];

  const completed = fields.filter(Boolean).length;

  return Math.round((completed / fields.length) * 100);
}

function getPersonalityDescription(type) {
  const descriptions = {
    INTJ: 'Stratejik, analitik ve uzun vadeli düşünen bir profil. Planlı ekiplerde güçlü katkı sağlar.',
    INTP: 'Meraklı, teorik ve problem çözmeye odaklı bir profil. Teknik tartışmalarda öne çıkar.',
    ENTJ: 'Liderlik odaklı, kararlı ve hedef merkezli bir profil. Grup organizasyonlarında güçlüdür.',
    ENTP: 'Yaratıcı, tartışmayı seven ve yeni fikirlere açık bir profil. Beyin fırtınalarında etkilidir.',
    INFJ: 'Anlam odaklı, empatik ve vizyoner bir profil. Derin sohbetlerde güçlü bağ kurar.',
    INFP: 'Yaratıcı, değer odaklı ve içgörülü bir profil. Sanat ve fikir topluluklarında parlayabilir.',
    ENFJ: 'İnsan odaklı, destekleyici ve sosyal bir profil. Topluluk yönetiminde güçlüdür.',
    ENFP: 'Enerjik, yaratıcı ve sosyal bağlantılara açık bir profil. Etkinliklerde doğal katalizör olur.',
    ISTJ: 'Düzenli, sorumluluk sahibi ve pratik bir profil. Planlı projelerde güvenilir katkı sağlar.',
    ISFJ: 'Destekleyici, dikkatli ve uyumlu bir profil. Güvenli sosyal ortamlar kurmayı sever.',
    ESTJ: 'Organize, net ve liderlik eğilimli bir profil. Takım süreçlerini düzenlemekte başarılıdır.',
    ESFJ: 'Sıcakkanlı, işbirlikçi ve topluluk odaklı bir profil. Grup içi uyumu güçlendirir.',
    ISTP: 'Pratik, sakin ve çözüm odaklı bir profil. Teknik ve deneysel konularda güçlüdür.',
    ISFP: 'Estetik duyarlılığı yüksek, sakin ve özgün bir profil. Yaratıcı topluluklarda rahat eder.',
    ESTP: 'Enerjik, hızlı karar alan ve aksiyona dönük bir profil. Etkinlik ve spor ortamlarında aktiftir.',
    ESFP: 'Sosyal, eğlenceli ve deneyim odaklı bir profil. Grup enerjisini yükseltir.'
  };

  return descriptions[type] || 'Kişilik testi tamamlandığında burada profilinle ilgili kısa bir analiz görünecek.';
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