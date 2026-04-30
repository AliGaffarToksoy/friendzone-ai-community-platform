let currentProfile = null;
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');

  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }

  bindProfileEvents();

  await loadProfile();
  await loadSimilarUsers();
});

function bindProfileEvents() {
  const form = document.getElementById('profileForm');
  const bio = document.getElementById('bio');
  const chooseImageBtn = document.getElementById('chooseImageBtn');
  const imageInput = document.getElementById('profileImageInput');
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const deleteImageBtn = document.getElementById('deleteImageBtn');

  if (form) {
    form.addEventListener('submit', updateProfile);
  }

  if (bio) {
    bio.addEventListener('input', updateBioCounter);
  }

  if (chooseImageBtn && imageInput) {
    chooseImageBtn.addEventListener('click', () => imageInput.click());
  }

  if (imageInput) {
    imageInput.addEventListener('change', handleImageSelection);
  }

  if (uploadImageBtn) {
    uploadImageBtn.addEventListener('click', uploadProfileImage);
  }

  if (deleteImageBtn) {
    deleteImageBtn.addEventListener('click', deleteProfileImage);
  }
}

async function loadProfile() {
  const userId = localStorage.getItem('user_id');
  const response = await authFetch(`${API_BASE}/api/user/profile/${userId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Profil yüklenemedi.', 'error');
    return;
  }

  currentProfile = response.data;
  renderProfile(currentProfile);
}

function renderProfile(profile) {
  setValue('name', profile.name);
  setValue('university', profile.university);
  setValue('department', profile.department);
  setValue('year', profile.year);
  setValue('city', profile.city);
  setValue('bio', profile.bio);
  setValue('visibilityScope', profile.visibility_scope || 'university');
  setValue('profileVisibility', String(profile.profile_visibility !== false));

  const profileName = document.getElementById('profileName');
  const profileMeta = document.getElementById('profileMeta');
  const personalityPill = document.getElementById('personalityPill');
  const communityCountPill = document.getElementById('communityCountPill');
  const cityPill = document.getElementById('cityPill');
  const summaryPersonality = document.getElementById('summaryPersonality');

  if (profileName) profileName.textContent = profile.name || 'Profil';
  if (profileMeta) {
    profileMeta.textContent = `${profile.university || 'Üniversite bilgisi yok'} · ${profile.department || 'Bölüm bilgisi yok'}`;
  }

  if (personalityPill) personalityPill.textContent = `MBTI: ${profile.personality_type || '-'}`;
  if (communityCountPill) communityCountPill.textContent = `${profile.joined_community_count || 0} topluluk`;
  if (cityPill) cityPill.textContent = `Şehir: ${profile.city || '-'}`;
  if (summaryPersonality) summaryPersonality.textContent = profile.personality_type || '-';

  renderHobbies(profile.hobbies || []);
  renderProfileImage(profile.profile_image_url);
  updateScopeSidebar(profile.visibility_scope);
  updateBioCounter();
}

function renderProfileImage(imageUrl) {
  const fullUrl = imageUrl ? `${API_BASE}${imageUrl}` : null;

  const profilePhoto = document.getElementById('profilePhoto');
  const profileFallback = document.getElementById('profilePhotoFallback');
  const preview = document.getElementById('photoPreview');
  const previewFallback = document.getElementById('photoPreviewFallback');

  if (fullUrl) {
    if (profilePhoto) {
      profilePhoto.src = fullUrl;
      profilePhoto.classList.remove('hidden');
    }

    if (profileFallback) profileFallback.classList.add('hidden');

    if (preview) {
      preview.src = fullUrl;
      preview.classList.remove('hidden');
    }

    if (previewFallback) previewFallback.classList.add('hidden');
  } else {
    if (profilePhoto) {
      profilePhoto.src = '';
      profilePhoto.classList.add('hidden');
    }

    if (profileFallback) {
      profileFallback.textContent = getInitials(currentProfile?.name || 'FZ');
      profileFallback.classList.remove('hidden');
    }

    if (preview) {
      preview.src = '';
      preview.classList.add('hidden');
    }

    if (previewFallback) {
      previewFallback.textContent = getInitials(currentProfile?.name || 'FZ');
      previewFallback.classList.remove('hidden');
    }
  }
}

function renderHobbies(hobbies) {
  const container = document.getElementById('summaryHobbies');

  if (!container) return;

  container.innerHTML = '';

  if (!hobbies.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-mini';
    empty.textContent = 'Henüz hobi seçilmedi.';
    container.appendChild(empty);
    return;
  }

  hobbies.forEach((hobby) => {
    const pill = document.createElement('span');
    pill.className = 'hobby-pill';
    pill.textContent = hobby;
    container.appendChild(pill);
  });
}

function updateScopeSidebar(scope) {
  const title = document.getElementById('sidebarScopeTitle');
  const text = document.getElementById('sidebarScopeText');

  const map = {
    university: {
      title: 'Kendi Üniversitem',
      text: 'Öncelikli olarak kendi üniversitendeki toplulukları keşfedersin.'
    },
    city: {
      title: 'Şehir Bazlı Keşif',
      text: 'Bulunduğun şehirdeki farklı üniversite topluluklarını da keşfedersin.'
    },
    country: {
      title: 'Türkiye Geneli',
      text: 'Türkiye genelindeki üniversite topluluklarını keşfedebilirsin.'
    }
  };

  const selected = map[scope] || map.university;

  if (title) title.textContent = selected.title;
  if (text) text.textContent = selected.text;
}

async function updateProfile(event) {
  event.preventDefault();

  const payload = {
    name: getValue('name'),
    university: getValue('university'),
    department: getValue('department'),
    year: getValue('year'),
    city: getValue('city'),
    bio: getValue('bio'),
    visibility_scope: getValue('visibilityScope'),
    profile_visibility: getValue('profileVisibility') === 'true',
  };

  const button = document.getElementById('saveProfileBtn');
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Kaydediliyor...';

  const response = await authFetch(`${API_BASE}/api/user/profile/update`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  button.disabled = false;
  button.textContent = originalText;

  if (!response || !response.success) {
    showToast(response?.message || 'Profil güncellenemedi.', 'error');
    return;
  }

  currentProfile = response.data;
  renderProfile(currentProfile);
  showToast('Profil başarıyla güncellendi.', 'success');
}

function handleImageSelection(event) {
  const file = event.target.files[0];

  selectedImageFile = null;

  const fileName = document.getElementById('selectedFileName');
  const uploadBtn = document.getElementById('uploadImageBtn');

  if (!file) {
    if (fileName) fileName.textContent = 'Henüz dosya seçilmedi.';
    if (uploadBtn) uploadBtn.disabled = true;
    return;
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    showToast('Sadece PNG, JPG, JPEG veya WEBP görsel seçebilirsin.', 'error');
    event.target.value = '';
    if (uploadBtn) uploadBtn.disabled = true;
    return;
  }

  const maxSize = 4 * 1024 * 1024;

  if (file.size > maxSize) {
    showToast('Profil fotoğrafı en fazla 4MB olabilir.', 'error');
    event.target.value = '';
    if (uploadBtn) uploadBtn.disabled = true;
    return;
  }

  selectedImageFile = file;

  if (fileName) fileName.textContent = file.name;
  if (uploadBtn) uploadBtn.disabled = false;

  const reader = new FileReader();

  reader.onload = () => {
    const preview = document.getElementById('photoPreview');
    const previewFallback = document.getElementById('photoPreviewFallback');

    if (preview) {
      preview.src = reader.result;
      preview.classList.remove('hidden');
    }

    if (previewFallback) {
      previewFallback.classList.add('hidden');
    }
  };

  reader.readAsDataURL(file);
}

async function uploadProfileImage() {
  if (!selectedImageFile) {
    showToast('Önce bir görsel seçmelisin.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('image', selectedImageFile);

  const token = localStorage.getItem('token');
  const button = document.getElementById('uploadImageBtn');
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Yükleniyor...';

  try {
    const response = await fetch(`${API_BASE}/api/user/profile/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message || 'Profil fotoğrafı yüklenemedi.', 'error');
      return;
    }

    selectedImageFile = null;

    const input = document.getElementById('profileImageInput');
    const fileName = document.getElementById('selectedFileName');

    if (input) input.value = '';
    if (fileName) fileName.textContent = 'Henüz dosya seçilmedi.';

    currentProfile.profile_image_url = data.data.profile_image_url;
    renderProfileImage(data.data.profile_image_url);

    showToast('Profil fotoğrafı yüklendi.', 'success');
  } catch (error) {
    showToast(`Bağlantı hatası: ${error.message}`, 'error');
  } finally {
    button.disabled = true;
    button.textContent = originalText;
  }
}

async function deleteProfileImage() {
  const response = await authFetch(`${API_BASE}/api/user/profile/delete-image`, {
    method: 'POST',
    body: JSON.stringify({})
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Profil fotoğrafı kaldırılamadı.', 'error');
    return;
  }

  if (currentProfile) {
    currentProfile.profile_image_url = null;
  }

  renderProfileImage(null);
  showToast('Profil fotoğrafı kaldırıldı.', 'success');
}

async function loadSimilarUsers() {
  const userId = localStorage.getItem('user_id');
  const response = await authFetch(`${API_BASE}/api/user/similar/${userId}`);
  const container = document.getElementById('similarUsers');

  if (!container) return;

  container.innerHTML = '';

  if (!response || !response.success || !response.data.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Henüz benzer kullanıcı bulunamadı. Hobilerini seçtikten sonra burada öneriler görünebilir.
      </div>
    `;
    return;
  }

  response.data.forEach((user) => {
    const card = document.createElement('div');
    card.className = 'similar-user-card';

    const avatar = document.createElement('div');
    avatar.className = 'similar-avatar';

    if (user.profile_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${user.profile_image_url}`;
      img.alt = user.name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(user.name);
    }

    const info = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = user.name;

    const meta = document.createElement('span');
    meta.textContent = `${user.university || 'Üniversite yok'} · ${user.personality_type || '-'}`;

    info.appendChild(name);
    info.appendChild(meta);

    card.appendChild(avatar);
    card.appendChild(info);

    container.appendChild(card);
  });
}

function updateBioCounter() {
  const bio = document.getElementById('bio');
  const counter = document.getElementById('bioCounter');

  if (!bio || !counter) return;

  counter.textContent = `${bio.value.length}/600`;
}

function setValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value || '';
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

function getInitials(name) {
  if (!name) return 'FZ';

  return name
    .split(' ')
    .filter(Boolean)
    .map((item) => item[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}