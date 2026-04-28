const MIN_HOBBIES = 3;
const MAX_HOBBIES = 8;

let hobbyCategoriesCache = {};
let selectedHobbies = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  bindHobbyEvents();
  await loadHobbyCategories();
  updateSelectionUI();
});

function bindHobbyEvents() {
  const form = document.getElementById('hobbiesForm');
  const searchInput = document.getElementById('hobbySearch');
  const clearBtn = document.getElementById('clearSelectionBtn');

  if (form) {
    form.addEventListener('submit', submitHobbies);
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderHobbyCategories);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearSelections);
  }
}

async function loadHobbyCategories() {
  const container = document.getElementById('hobbyContainer');

  if (container) {
    container.innerHTML = `
      <div class="hobby-loading-card">
        <strong>Hobiler yükleniyor...</strong>
        <p>Kategoriler backend üzerinden alınıyor.</p>
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE}/api/test/hobbies`);
    const data = await response.json();

    if (!data.success) {
      showToast(data.message || 'Hobi kategorileri yüklenemedi.', 'error');
      hobbyCategoriesCache = {};
      renderHobbyCategories();
      return;
    }

    hobbyCategoriesCache = data.data || {};
    renderHobbyCategories();
  } catch (error) {
    showToast(`Hobi verileri alınamadı: ${error.message}`, 'error');
    hobbyCategoriesCache = {};
    renderHobbyCategories();
  }
}

function renderHobbyCategories() {
  const container = document.getElementById('hobbyContainer');
  const search = document.getElementById('hobbySearch')?.value.toLowerCase().trim() || '';

  if (!container) return;

  container.innerHTML = '';

  const categoryNames = Object.keys(hobbyCategoriesCache);

  if (!categoryNames.length) {
    container.innerHTML = `
      <div class="hobby-loading-card">
        <strong>Hobi kategorisi bulunamadı</strong>
        <p>Backend bağlantısını veya /api/test/hobbies endpointini kontrol et.</p>
      </div>
    `;
    return;
  }

  let visibleItemCount = 0;

  categoryNames.forEach((categoryName) => {
    const activities = hobbyCategoriesCache[categoryName] || [];

    const filteredActivities = activities.filter((activity) => {
      const text = `${categoryName} ${activity}`.toLowerCase();
      return text.includes(search);
    });

    if (!filteredActivities.length) return;

    visibleItemCount += filteredActivities.length;

    const categoryCard = document.createElement('article');
    categoryCard.className = 'hobby-category-card';

    const header = document.createElement('div');
    header.className = 'hobby-category-header';

    const icon = document.createElement('div');
    icon.className = 'hobby-category-icon';
    icon.textContent = getCategoryIcon(categoryName);

    const titleBlock = document.createElement('div');

    const title = document.createElement('h3');
    title.textContent = categoryName;

    const subtitle = document.createElement('p');
    subtitle.textContent = `${filteredActivities.length} aktivite`;

    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);

    header.appendChild(icon);
    header.appendChild(titleBlock);

    const grid = document.createElement('div');
    grid.className = 'activity-grid';

    filteredActivities.forEach((activity) => {
      const isSelected = selectedHobbies.includes(activity);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = isSelected ? 'activity-chip selected' : 'activity-chip';
      button.textContent = activity;

      button.addEventListener('click', () => {
        toggleHobby(activity);
      });

      grid.appendChild(button);
    });

    categoryCard.appendChild(header);
    categoryCard.appendChild(grid);

    container.appendChild(categoryCard);
  });

  if (visibleItemCount === 0) {
    container.innerHTML = `
      <div class="hobby-loading-card">
        <strong>Aramana uygun hobi bulunamadı</strong>
        <p>Farklı bir anahtar kelimeyle tekrar deneyebilirsin.</p>
      </div>
    `;
  }
}

function toggleHobby(hobby) {
  const isSelected = selectedHobbies.includes(hobby);

  if (isSelected) {
    selectedHobbies = selectedHobbies.filter((item) => item !== hobby);
  } else {
    if (selectedHobbies.length >= MAX_HOBBIES) {
      showToast(`En fazla ${MAX_HOBBIES} hobi seçebilirsin.`, 'error');
      return;
    }

    selectedHobbies.push(hobby);
  }

  renderHobbyCategories();
  updateSelectionUI();
}

function updateSelectionUI() {
  const selectedCount = selectedHobbies.length;
  const progressPercent = Math.min(100, (selectedCount / MAX_HOBBIES) * 100);

  const selectedCountEl = document.getElementById('selectedCount');
  const selectedBadge = document.getElementById('selectedBadge');
  const selectionStatus = document.getElementById('selectionStatus');
  const selectionProgress = document.getElementById('selectionProgress');
  const selectedList = document.getElementById('selectedHobbiesList');
  const submitBtn = document.getElementById('submitHobbiesBtn');
  const submitHint = document.getElementById('submitHint');

  if (selectedCountEl) {
    selectedCountEl.textContent = selectedCount;
  }

  if (selectedBadge) {
    selectedBadge.textContent = selectedCount;
  }

  if (selectionProgress) {
    selectionProgress.style.width = `${progressPercent}%`;
  }

  if (selectionStatus) {
    if (selectedCount < MIN_HOBBIES) {
      selectionStatus.textContent = `${MIN_HOBBIES - selectedCount} seçim daha yapmalısın.`;
    } else if (selectedCount === MAX_HOBBIES) {
      selectionStatus.textContent = 'Maksimum seçim sınırına ulaştın.';
    } else {
      selectionStatus.textContent = 'Harika! Devam etmeye hazırsın.';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = selectedCount < MIN_HOBBIES || selectedCount > MAX_HOBBIES;
    submitBtn.textContent = selectedCount >= MIN_HOBBIES
      ? 'Topluluk Atamasını Başlat'
      : `${MIN_HOBBIES - selectedCount} Seçim Kaldı`;
  }

  if (submitHint) {
    if (selectedCount < MIN_HOBBIES) {
      submitHint.textContent = `Devam etmek için en az ${MIN_HOBBIES} hobi seçmelisin.`;
    } else {
      submitHint.textContent = 'Seçimlerin hazır. Otomatik topluluk atamasını başlatabilirsin.';
    }
  }

  renderSelectedHobbies(selectedList);
}

function renderSelectedHobbies(container) {
  if (!container) return;

  container.innerHTML = '';

  if (!selectedHobbies.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-selected';
    empty.textContent = 'Henüz seçim yapmadın.';
    container.appendChild(empty);
    return;
  }

  selectedHobbies.forEach((hobby) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'selected-hobby-pill';
    chip.textContent = hobby;

    const remove = document.createElement('span');
    remove.textContent = '×';

    chip.appendChild(remove);

    chip.addEventListener('click', () => {
      toggleHobby(hobby);
    });

    container.appendChild(chip);
  });
}

function clearSelections() {
  selectedHobbies = [];
  renderHobbyCategories();
  updateSelectionUI();
  showToast('Seçimler temizlendi.', 'success');
}

async function submitHobbies(event) {
  event.preventDefault();

  if (selectedHobbies.length < MIN_HOBBIES) {
    showToast(`En az ${MIN_HOBBIES} hobi seçmelisin.`, 'error');
    return;
  }

  if (selectedHobbies.length > MAX_HOBBIES) {
    showToast(`En fazla ${MAX_HOBBIES} hobi seçebilirsin.`, 'error');
    return;
  }

  const submitBtn = document.getElementById('submitHobbiesBtn');
  const originalText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Atama Yapılıyor...';

  const response = await authFetch(`${API_BASE}/api/test/hobbies`, {
    method: 'POST',
    body: JSON.stringify({
      hobbies: selectedHobbies
    })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;

  if (!response || !response.success) {
    showToast(response?.message || 'Hobiler kaydedilemedi.', 'error');
    return;
  }

  showToast('Hobiler kaydedildi ve topluluk ataması yapıldı.', 'success');
  showAssignmentModal(response.data);
}

function showAssignmentModal(data) {
  const modal = document.getElementById('assignmentModal');
  const communityName = document.getElementById('assignedCommunityName');
  const description = document.getElementById('assignmentDescription');
  const goBtn = document.getElementById('goAssignedCommunityBtn');

  if (communityName) {
    communityName.textContent = data?.community_name || 'Topluluk';
  }

  if (description) {
    description.textContent = `${selectedHobbies.length} hobi analiz edildi ve sana en uygun topluluk belirlendi. Artık sohbet etmeye başlayabilirsin.`;
  }

  if (goBtn && data?.community_id) {
    goBtn.href = `community.html?id=${data.community_id}`;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function getCategoryIcon(categoryName) {
  const icons = {
    Teknoloji: '💻',
    Spor: '🏃',
    Sanat: '🎨',
    Doğa: '🌿',
    Eğitim: '📚',
    Sosyal: '🤝'
  };

  return icons[categoryName] || '✨';
}