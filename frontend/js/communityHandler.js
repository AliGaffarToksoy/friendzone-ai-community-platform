let allCommunitiesCache = [];
let recommendedCommunitiesCache = [];
let myCommunitiesCache = [];
let currentUserProfile = null;
let communitySponsorsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');

  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }

  bindCommunityEvents();

  await Promise.all([
  loadCommunityDetails(),
  loadMyCommunitiesForChat(),
  loadMessages(),
  loadCommunityEvents(),
  loadCommunityMembers(),
  loadCommunityRooms(),
  loadCommunitySponsors()
  ]);

  applyFilters();
});

function bindCommunityEvents() {
  const searchInput = document.getElementById('communitySearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const scopeFilter = document.getElementById('scopeFilter');
  const openModalBtn = document.getElementById('openCreateCommunityBtn');
  const closeModalBtn = document.getElementById('closeCreateCommunityBtn');
  const modal = document.getElementById('createCommunityModal');
  const form = document.getElementById('createCommunityForm');
  const scopeSelect = document.getElementById('communityScope');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
  if (scopeFilter) scopeFilter.addEventListener('change', applyFilters);

  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('hidden');
      prefillCreateCommunityForm();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.add('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', createCommunity);
  }

  if (scopeSelect) {
    scopeSelect.addEventListener('change', handleScopeFormChange);
  }
}

async function loadCommunitySponsors() {
  const container = document.getElementById('communitySponsorsList');

  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-mini">
      Sponsorlar yükleniyor...
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/brands/communities/${activeCommunityId}/sponsors`);

  if (!response || !response.success) {
    communitySponsorsCache = [];

    container.innerHTML = `
      <div class="empty-state-mini">
        ${response?.message || 'Sponsorlar yüklenemedi.'}
      </div>
    `;
    return;
  }

  communitySponsorsCache = response.data || [];
  renderCommunitySponsors();
}

function renderCommunitySponsors() {
  const container = document.getElementById('communitySponsorsList');

  if (!container) return;

  container.innerHTML = '';

  if (!communitySponsorsCache.length) {
    container.innerHTML = `
      <div class="empty-state-mini">
        Bu topluluk için henüz sponsor eklenmemiş.
      </div>
    `;
    return;
  }

  communitySponsorsCache.slice(0, 4).forEach((sponsor) => {
    const brand = sponsor.brand || {};

    const card = document.createElement('article');
    card.className = sponsor.is_featured
      ? 'community-sponsor-mini-card featured'
      : 'community-sponsor-mini-card';

    const logo = document.createElement('div');
    logo.className = 'community-sponsor-logo';

    if (brand.logo_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${brand.logo_image_url}`;
      img.alt = brand.name || 'Sponsor logosu';
      logo.appendChild(img);
    } else {
      logo.textContent = getInitials(brand.name || 'SP');
    }

    const info = document.createElement('div');
    info.className = 'community-sponsor-info';

    const title = document.createElement('strong');
    title.textContent = sponsor.title || brand.name || 'Sponsor';

    const meta = document.createElement('span');
    meta.textContent = [
      brand.name,
      getSponsorshipTypeLabel(sponsor.sponsorship_type),
      sponsor.is_featured ? 'Öne çıkan' : null
    ].filter(Boolean).join(' · ');

    info.appendChild(title);
    info.appendChild(meta);

    card.appendChild(logo);
    card.appendChild(info);

    if (brand.website_url) {
      const website = document.createElement('a');
      website.href = brand.website_url;
      website.target = '_blank';
      website.rel = 'noopener noreferrer';
      website.className = 'community-sponsor-link';
      website.textContent = 'Git';

      card.appendChild(website);
    }

    container.appendChild(card);
  });
}

function getSponsorshipTypeLabel(type) {
  const map = {
    sponsor: 'Sponsor',
    main_sponsor: 'Ana Sponsor',
    gold_sponsor: 'Gold Sponsor',
    silver_sponsor: 'Silver Sponsor',
    bronze_sponsor: 'Bronze Sponsor',
    media_sponsor: 'Medya Sponsoru',
    education_partner: 'Eğitim Partneri',
    technology_partner: 'Teknoloji Partneri',
    community_partner: 'Topluluk Partneri'
  };

  return map[type] || 'Sponsor';
}


async function loadCurrentUserProfile() {
  const userId = localStorage.getItem('user_id');
  const response = await authFetch(`${API_BASE}/api/user/profile/${userId}`);

  if (!response || !response.success) {
    return;
  }

  currentUserProfile = response.data;
  renderDiscoveryScope(currentUserProfile);
}

function renderDiscoveryScope(profile) {
  const title = document.getElementById('discoveryScopeTitle');
  const text = document.getElementById('discoveryScopeText');

  const scope = profile?.visibility_scope || 'university';

  const map = {
    university: {
      title: 'Kendi Üniversitem',
      text: `${profile?.university || 'Üniversiten'} içindeki topluluklar, Türkiye geneli ve online topluluklar gösterilir.`
    },
    city: {
      title: 'Şehir Bazlı Keşif',
      text: `${profile?.city || 'Bulunduğun şehir'} içindeki üniversite toplulukları, Türkiye geneli ve online topluluklar gösterilir.`
    },
    country: {
      title: 'Türkiye Geneli',
      text: 'Tüm aktif üniversite, şehir, ülke geneli ve online toplulukları keşfedebilirsin.'
    }
  };

  const selected = map[scope] || map.university;

  if (title) title.textContent = selected.title;
  if (text) text.textContent = selected.text;
}

async function loadMyCommunities() {
  const userId = localStorage.getItem('user_id');
  const response = await authFetch(`${API_BASE}/api/community/user/${userId}`);

  if (!response || !response.success) {
    myCommunitiesCache = [];
    renderMyCommunities();
    return;
  }

  myCommunitiesCache = response.data || [];
  renderMyCommunities();
}

async function loadRecommendedCommunities() {
  const userId = localStorage.getItem('user_id');
  const response = await authFetch(`${API_BASE}/api/community/recommendations/${userId}`);

  if (!response || !response.success) {
    recommendedCommunitiesCache = [];
    renderRecommendedCommunities([]);
    return;
  }

  recommendedCommunitiesCache = response.data || [];
  renderRecommendedCommunities(recommendedCommunitiesCache);
}

async function loadAllCommunities() {
  const response = await authFetch(`${API_BASE}/api/community`);

  if (!response || !response.success) {
    allCommunitiesCache = [];
    renderAllCommunities([]);
    return;
  }

  allCommunitiesCache = response.data || [];
  renderAllCommunities(allCommunitiesCache);
}

function applyFilters() {
  const query = normalizeText(document.getElementById('communitySearch')?.value || '');
  const category = document.getElementById('categoryFilter')?.value || '';
  const scope = document.getElementById('scopeFilter')?.value || '';

  const filteredAll = allCommunitiesCache.filter((community) => {
    const matchesCategory = !category || community.category === category;
    const matchesScope = !scope || community.scope === scope;

    const searchable = normalizeText([
      community.name,
      community.description,
      community.category,
      community.university,
      community.city,
      community.scope,
      ...(community.tags || [])
    ].join(' '));

    const matchesQuery = !query || searchable.includes(query);

    return matchesCategory && matchesScope && matchesQuery;
  });

  const filteredRecommended = recommendedCommunitiesCache.filter((community) => {
    const matchesCategory = !category || community.category === category;
    const matchesScope = !scope || community.scope === scope;

    const searchable = normalizeText([
      community.name,
      community.description,
      community.category,
      community.university,
      community.city,
      community.scope,
      ...(community.tags || [])
    ].join(' '));

    const matchesQuery = !query || searchable.includes(query);

    return matchesCategory && matchesScope && matchesQuery;
  });

  renderRecommendedCommunities(filteredRecommended);
  renderAllCommunities(filteredAll);
}

function renderMyCommunities() {
  const container = document.getElementById('myCommunities');

  if (!container) return;

  container.innerHTML = '';

  if (!myCommunitiesCache.length) {
    container.innerHTML = `
      <div class="empty-sidebar-state">
        Henüz bir topluluğa katılmadın.
      </div>
    `;
    return;
  }

  myCommunitiesCache.forEach((community) => {
    const link = document.createElement('a');
    link.className = 'my-community-link';
    link.href = `community.html?id=${community.id}`;

    const avatar = document.createElement('div');
    avatar.className = 'community-mini-avatar';
    avatar.textContent = getInitials(community.name);

    const content = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = community.name;

    const meta = document.createElement('span');
    meta.textContent = getCommunityLocationText(community);

    content.appendChild(title);
    content.appendChild(meta);

    link.appendChild(avatar);
    link.appendChild(content);

    container.appendChild(link);
  });
}

function renderRecommendedCommunities(list) {
  const container = document.getElementById('recommendedCommunities');
  const count = document.getElementById('recommendedCount');

  if (count) count.textContent = `${list.length} topluluk`;

  renderCommunities(list, container, true);
}

function renderAllCommunities(list) {
  const container = document.getElementById('allCommunities');
  const count = document.getElementById('allCount');

  if (count) count.textContent = `${list.length} topluluk`;

  renderCommunities(list, container, false);
}

function renderCommunities(list, container, isRecommended = false) {
  if (!container) return;

  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Bu filtrelere uygun topluluk bulunamadı.
      </div>
    `;
    return;
  }

  list.forEach((community) => {
    const card = document.createElement('article');
    card.className = 'community-card';

    const top = document.createElement('div');
    top.className = 'community-card-top';

    const avatar = document.createElement('div');
    avatar.className = `community-avatar scope-${community.scope || 'country'}`;
    avatar.textContent = getInitials(community.name);

    const scopeBadge = document.createElement('span');
    scopeBadge.className = `scope-badge scope-${community.scope || 'country'}`;
    scopeBadge.textContent = getScopeLabel(community.scope);

    top.appendChild(avatar);
    top.appendChild(scopeBadge);

    const title = document.createElement('h3');
    title.textContent = community.name;

    const description = document.createElement('p');
    description.className = 'community-description';
    description.textContent = community.description || 'Topluluk açıklaması bulunmuyor.';

    const meta = document.createElement('div');
    meta.className = 'community-meta-grid';

    meta.appendChild(createMetaItem('Kategori', community.category || '-'));
    meta.appendChild(createMetaItem('Kapsam', getScopeLabel(community.scope)));
    meta.appendChild(createMetaItem('Üniversite', community.university || getScopeFallbackUniversity(community.scope)));
    meta.appendChild(createMetaItem('Şehir', community.city || getScopeFallbackCity(community.scope)));

    const tags = document.createElement('div');
    tags.className = 'community-tags';

    (community.tags || []).slice(0, 5).forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.textContent = tag;
      tags.appendChild(tagEl);
    });

    const footer = document.createElement('div');
    footer.className = 'community-card-footer';

    const stats = document.createElement('div');
    stats.className = 'community-stats';

    const members = document.createElement('span');
    members.textContent = `${community.member_count || 0} üye`;

    const score = document.createElement('span');
    score.textContent = isRecommended
      ? `${Math.round(community.compatibility_score || 0)}% uyum`
      : `${community.max_members || 0} kapasite`;

    stats.appendChild(members);
    stats.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'community-actions';

    const joined = isUserJoined(community.id);

    const joinBtn = document.createElement('button');
    joinBtn.className = joined ? 'secondary-action joined-button' : 'primary-action';
    joinBtn.type = 'button';
    joinBtn.textContent = joined ? 'Katıldın' : 'Katıl';
    joinBtn.disabled = joined;
    joinBtn.addEventListener('click', () => joinCommunity(community.id));

    const openBtn = document.createElement('a');
    openBtn.className = 'secondary-action';
    openBtn.href = `community.html?id=${community.id}`;
    openBtn.textContent = 'Sohbete Gir';

    actions.appendChild(joinBtn);
    actions.appendChild(openBtn);

    footer.appendChild(stats);
    footer.appendChild(actions);

    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(meta);
    card.appendChild(tags);
    card.appendChild(footer);

    container.appendChild(card);
  });
}

function createMetaItem(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value;

  item.appendChild(span);
  item.appendChild(strong);

  return item;
}

async function joinCommunity(communityId) {
  const response = await authFetch(`${API_BASE}/api/community/join`, {
    method: 'POST',
    body: JSON.stringify({
      community_id: communityId
    })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluğa katılım başarısız.', 'error');
    return;
  }

  showToast(response.message || 'Topluluğa katıldın.', 'success');

  await Promise.all([
    loadMyCommunities(),
    loadRecommendedCommunities(),
    loadAllCommunities()
  ]);

  applyFilters();
}

function prefillCreateCommunityForm() {
  if (!currentUserProfile) return;

  const universityInput = document.getElementById('communityUniversity');
  const cityInput = document.getElementById('communityCity');

  if (universityInput && !universityInput.value) {
    universityInput.value = currentUserProfile.university || '';
  }

  if (cityInput && !cityInput.value) {
    cityInput.value = currentUserProfile.city || '';
  }

  handleScopeFormChange();
}

function handleScopeFormChange() {
  const scope = document.getElementById('communityScope')?.value || 'university';
  const universityInput = document.getElementById('communityUniversity');
  const cityInput = document.getElementById('communityCity');

  if (!universityInput || !cityInput) return;

  universityInput.disabled = false;
  cityInput.disabled = false;

  if (scope === 'country' || scope === 'online') {
    universityInput.value = '';
    cityInput.value = '';
    universityInput.disabled = true;
    cityInput.disabled = true;
  }

  if (scope === 'city') {
    universityInput.value = '';
    universityInput.disabled = true;
    cityInput.disabled = false;
  }

  if (scope === 'university') {
    universityInput.disabled = false;
    cityInput.disabled = false;
  }
}

async function createCommunity(event) {
  event.preventDefault();

  const button = document.getElementById('createCommunitySubmitBtn');
  const originalText = button.textContent;

  const tags = (document.getElementById('communityTags')?.value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const payload = {
    name: document.getElementById('communityName')?.value.trim(),
    description: document.getElementById('communityDescription')?.value.trim(),
    category: document.getElementById('communityCategory')?.value,
    scope: document.getElementById('communityScope')?.value,
    university: document.getElementById('communityUniversity')?.value.trim(),
    city: document.getElementById('communityCity')?.value.trim(),
    tags,
    max_members: Number(document.getElementById('communityMaxMembers')?.value || 100)
  };

  button.disabled = true;
  button.textContent = 'Oluşturuluyor...';

  const response = await authFetch(`${API_BASE}/api/community/create`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  button.disabled = false;
  button.textContent = originalText;

  if (!response || !response.success) {
    showToast(response?.message || 'Topluluk oluşturulamadı.', 'error');
    return;
  }

  showToast('Topluluk oluşturuldu.', 'success');

  const modal = document.getElementById('createCommunityModal');
  const form = document.getElementById('createCommunityForm');

  if (modal) modal.classList.add('hidden');
  if (form) form.reset();

  await Promise.all([
    loadMyCommunities(),
    loadRecommendedCommunities(),
    loadAllCommunities()
  ]);

  applyFilters();
}

function isUserJoined(communityId) {
  return myCommunitiesCache.some((community) => String(community.id) === String(communityId));
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

function getScopeFallbackUniversity(scope) {
  if (scope === 'city') return 'Şehir geneli';
  if (scope === 'country') return 'Türkiye geneli';
  if (scope === 'online') return 'Online';
  return '-';
}

function getScopeFallbackCity(scope) {
  if (scope === 'country') return 'Türkiye';
  if (scope === 'online') return 'Online';
  return '-';
}

function getCommunityLocationText(community) {
  if (community.scope === 'university') {
    return `${community.university || 'Üniversite'} · ${community.city || '-'}`;
  }

  if (community.scope === 'city') {
    return `${community.city || 'Şehir'} · şehir geneli`;
  }

  if (community.scope === 'online') {
    return 'Online topluluk';
  }

  return 'Türkiye geneli';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .trim();
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