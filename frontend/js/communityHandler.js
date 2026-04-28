let allCommunitiesCache = [];
let recommendedCache = [];
let myCommunitiesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const userId = localStorage.getItem('user_id');

  if (!userId) {
    logout();
    return;
  }

  bindCommunityPageEvents();
  await loadCommunityPage(userId);
});

function bindCommunityPageEvents() {
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('communitySearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const createCommunityBtn = document.getElementById('createCommunityBtn');

  const closeModalBtn = document.getElementById('closeCreateCommunityModal');
  const cancelCreateBtn = document.getElementById('cancelCreateCommunity');
  const createCommunityForm = document.getElementById('createCommunityForm');
  const createCommunityModal = document.getElementById('createCommunityModal');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const userId = localStorage.getItem('user_id');
      await loadCommunityPage(userId);
      showToast('Topluluklar güncellendi.', 'success');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyCommunityFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyCommunityFilters);
  }

  if (createCommunityBtn) {
    createCommunityBtn.addEventListener('click', openCreateCommunityModal);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeCreateCommunityModal);
  }

  if (cancelCreateBtn) {
    cancelCreateBtn.addEventListener('click', closeCreateCommunityModal);
  }

  if (createCommunityForm) {
    createCommunityForm.addEventListener('submit', createCommunity);
  }

  if (createCommunityModal) {
    createCommunityModal.addEventListener('click', (event) => {
      if (event.target === createCommunityModal) {
        closeCreateCommunityModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCreateCommunityModal();
    }
  });
}

async function loadCommunityPage(userId) {
  await Promise.all([
    loadRecommendedCommunities(userId),
    loadAllCommunities(),
    loadMyCommunities(userId)
  ]);

  updateStats();
  applyCommunityFilters();
}

async function loadRecommendedCommunities(userId) {
  const response = await authFetch(`${API_BASE}/api/community/recommendations/${userId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Önerilen topluluklar alınamadı.', 'error');
    recommendedCache = [];
    return;
  }

  recommendedCache = response.data || [];
  renderCommunities(recommendedCache, document.getElementById('recommended'), true);
}

async function loadAllCommunities() {
  const response = await authFetch(`${API_BASE}/api/community`);

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluklar alınamadı.', 'error');
    allCommunitiesCache = [];
    return;
  }

  allCommunitiesCache = response.data || [];
  renderCommunities(allCommunitiesCache, document.getElementById('allCommunities'), false);
}

async function loadMyCommunities(userId) {
  const response = await authFetch(`${API_BASE}/api/community/user/${userId}`);

  if (!response || !response.success) {
    myCommunitiesCache = [];
    renderMyCommunities([]);
    return;
  }

  myCommunitiesCache = response.data || [];
  renderMyCommunities(myCommunitiesCache);
}

function updateStats() {
  const recommendedCount = document.getElementById('recommendedCount');
  const totalCount = document.getElementById('totalCount');

  if (recommendedCount) {
    recommendedCount.textContent = recommendedCache.length;
  }

  if (totalCount) {
    totalCount.textContent = allCommunitiesCache.length;
  }
}

function applyCommunityFilters() {
  const search = document.getElementById('communitySearch')?.value.toLowerCase().trim() || '';
  const category = document.getElementById('categoryFilter')?.value || 'all';

  const filteredAll = allCommunitiesCache.filter((community) => {
    const text = `${community.name || ''} ${community.description || ''} ${community.category || ''}`.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesCategory = category === 'all' || community.category === category;
    return matchesSearch && matchesCategory;
  });

  const filteredRecommended = recommendedCache.filter((community) => {
    const text = `${community.name || ''} ${community.description || ''} ${community.category || ''}`.toLowerCase();
    const matchesSearch = text.includes(search);
    const matchesCategory = category === 'all' || community.category === category;
    return matchesSearch && matchesCategory;
  });

  renderCommunities(filteredRecommended, document.getElementById('recommended'), true);
  renderCommunities(filteredAll, document.getElementById('allCommunities'), false);
}

function renderMyCommunities(list) {
  const container = document.getElementById('myCommunities');

  if (!container) return;

  container.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state-mini';
    empty.textContent = 'Henüz topluluğa katılmadın.';
    container.appendChild(empty);
    return;
  }

  list.forEach((community) => {
    const link = document.createElement('a');
    link.className = 'my-community-link';
    link.href = `community.html?id=${community.id}`;

    const avatar = document.createElement('div');
    avatar.className = 'community-avatar';
    avatar.textContent = getInitials(community.name);

    const info = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = community.name;

    const meta = document.createElement('span');
    meta.textContent = community.category || 'Topluluk';

    info.appendChild(name);
    info.appendChild(meta);

    link.appendChild(avatar);
    link.appendChild(info);

    container.appendChild(link);
  });
}

function renderCommunities(list, container, isRecommended = false) {
  if (!container) return;

  container.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state-card';
    empty.innerHTML = `
      <strong>Topluluk bulunamadı</strong>
      <p>Arama veya filtre kriterlerini değiştirerek tekrar deneyebilirsin.</p>
    `;
    container.appendChild(empty);
    return;
  }

  list.forEach((community) => {
    const isMember = myCommunitiesCache.some((item) => Number(item.id) === Number(community.id));

    const card = document.createElement('article');
    card.className = 'community-card pro-card';

    const top = document.createElement('div');
    top.className = 'community-card-top';

    const avatar = document.createElement('div');
    avatar.className = 'community-card-avatar';
    avatar.textContent = getInitials(community.name);

    const titleBlock = document.createElement('div');

    const title = document.createElement('h4');
    title.textContent = community.name;

    const category = document.createElement('span');
    category.className = 'community-category';
    category.textContent = community.category || 'Genel';

    titleBlock.appendChild(title);
    titleBlock.appendChild(category);

    top.appendChild(avatar);
    top.appendChild(titleBlock);

    const description = document.createElement('p');
    description.className = 'community-description';
    description.textContent = community.description || 'Bu topluluğun açıklaması henüz eklenmemiş.';

    const meta = document.createElement('div');
    meta.className = 'community-meta';

    const memberCount = document.createElement('span');
    memberCount.textContent = `👥 ${community.member_count || 0} üye`;

    const score = document.createElement('span');
    const compatibility = Number(community.compatibility_score || 0);
    const compatibilityPercent = compatibility > 0 ? Math.min(100, compatibility * 25) : 75;
    score.textContent = isRecommended ? `⚡ Uyum: ${compatibilityPercent}%` : '🌐 Aktif';

    meta.appendChild(memberCount);
    meta.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'community-actions';

    const openBtn = document.createElement('a');
    openBtn.className = 'action-button primary';
    openBtn.href = `community.html?id=${community.id}`;
    openBtn.textContent = isMember ? 'Sohbete Gir' : 'Topluluğu İncele';

    const joinBtn = document.createElement('button');
    joinBtn.type = 'button';
    joinBtn.className = isMember ? 'action-button joined' : 'action-button secondary';
    joinBtn.textContent = isMember ? 'Katıldın' : 'Katıl';
    joinBtn.disabled = isMember;

    joinBtn.addEventListener('click', async () => {
      await joinCommunity(community.id);
    });

    actions.appendChild(openBtn);
    actions.appendChild(joinBtn);

    card.appendChild(top);
    card.appendChild(description);
    card.appendChild(meta);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

async function joinCommunity(id) {
  const response = await authFetch(`${API_BASE}/api/community/join`, {
    method: 'POST',
    body: JSON.stringify({ community_id: id })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluğa katılım başarısız.', 'error');
    return;
  }

  showToast('Topluluğa başarıyla katıldın.', 'success');

  const userId = localStorage.getItem('user_id');
  await loadMyCommunities(userId);
  applyCommunityFilters();
}

function openCreateCommunityModal() {
  const modal = document.getElementById('createCommunityModal');

  if (!modal) return;

  modal.classList.remove('hidden');

  const nameInput = document.getElementById('communityNameInput');

  if (nameInput) {
    setTimeout(() => nameInput.focus(), 100);
  }
}

function closeCreateCommunityModal() {
  const modal = document.getElementById('createCommunityModal');
  const form = document.getElementById('createCommunityForm');

  if (!modal) return;

  modal.classList.add('hidden');

  if (form) {
    form.reset();
  }

  const maxMembersInput = document.getElementById('communityMaxMembersInput');

  if (maxMembersInput) {
    maxMembersInput.value = 100;
  }
}

async function createCommunity(event) {
  event.preventDefault();

  const name = document.getElementById('communityNameInput').value.trim();
  const description = document.getElementById('communityDescriptionInput').value.trim();
  const category = document.getElementById('communityCategoryInput').value;
  const maxMembers = Number(document.getElementById('communityMaxMembersInput').value);
  const tagsRaw = document.getElementById('communityTagsInput').value.trim();

  if (!name || !description || !category || !tagsRaw) {
    showToast('Lütfen tüm alanları doldur.', 'error');
    return;
  }

  if (name.length < 3) {
    showToast('Topluluk adı en az 3 karakter olmalı.', 'error');
    return;
  }

  if (description.length < 20) {
    showToast('Açıklama en az 20 karakter olmalı.', 'error');
    return;
  }

  if (maxMembers < 10 || maxMembers > 1000) {
    showToast('Maksimum üye sayısı 10 ile 1000 arasında olmalı.', 'error');
    return;
  }

  const tags = tagsRaw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (tags.length < 2) {
    showToast('En az 2 etiket eklemelisin.', 'error');
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = 'Oluşturuluyor...';

  const response = await authFetch(`${API_BASE}/api/community/create`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      category,
      tags,
      max_members: maxMembers
    })
  });

  submitButton.disabled = false;
  submitButton.textContent = originalText;

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluk oluşturulamadı.', 'error');
    return;
  }

  showToast('Topluluk başarıyla oluşturuldu.', 'success');
  closeCreateCommunityModal();

  const userId = localStorage.getItem('user_id');
  await loadCommunityPage(userId);

  if (response.data?.community_id) {
    setTimeout(() => {
      window.location.href = `community.html?id=${response.data.community_id}`;
    }, 600);
  }
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