let brandsCache = [];
let activeBrandCategory = '';

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  bindBrandEvents();

  await loadBrands();
});

function bindBrandEvents() {
  const openCreateBrandBtn = document.getElementById('openCreateBrandBtn');
  const closeCreateBrandBtn = document.getElementById('closeCreateBrandBtn');
  const createBrandModal = document.getElementById('createBrandModal');
  const createBrandForm = document.getElementById('createBrandForm');

  const closeBrandDetailBtn = document.getElementById('closeBrandDetailBtn');
  const brandDetailModal = document.getElementById('brandDetailModal');

  const refreshBrandsBtn = document.getElementById('refreshBrandsBtn');
  const brandSearchInput = document.getElementById('brandSearchInput');
  const brandVerifiedFilter = document.getElementById('brandVerifiedFilter');
  const sponsorLinkForm = document.getElementById('sponsorLinkForm');
  const loadSponsorsBtn = document.getElementById('loadSponsorsBtn');
  const sponsorTargetType = document.getElementById('sponsorTargetType');

  document.querySelectorAll('.brand-filter').forEach((button) => {
    button.addEventListener('click', async () => {
      document.querySelectorAll('.brand-filter').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');
      activeBrandCategory = button.dataset.category || '';

      await loadBrands();
    });
  });

  if (openCreateBrandBtn) {
    openCreateBrandBtn.addEventListener('click', () => {
      if (createBrandModal) {
        createBrandModal.classList.remove('hidden');
      }
    });
  }

  if (sponsorLinkForm) {
  sponsorLinkForm.addEventListener('submit', createSponsorLink);
}

if (loadSponsorsBtn) {
  loadSponsorsBtn.addEventListener('click', loadSponsorsForTarget);
}

if (sponsorTargetType) {
  sponsorTargetType.addEventListener('change', updateSponsorTargetPlaceholder);
  updateSponsorTargetPlaceholder();
}

  if (closeCreateBrandBtn) {
    closeCreateBrandBtn.addEventListener('click', () => {
      if (createBrandModal) {
        createBrandModal.classList.add('hidden');
      }
    });
  }

  if (createBrandModal) {
    createBrandModal.addEventListener('click', (event) => {
      if (event.target === createBrandModal) {
        createBrandModal.classList.add('hidden');
      }
    });
  }

  if (createBrandForm) {
    createBrandForm.addEventListener('submit', createBrand);
  }

  if (closeBrandDetailBtn) {
    closeBrandDetailBtn.addEventListener('click', () => {
      if (brandDetailModal) {
        brandDetailModal.classList.add('hidden');
      }
    });
  }

  if (brandDetailModal) {
    brandDetailModal.addEventListener('click', (event) => {
      if (event.target === brandDetailModal) {
        brandDetailModal.classList.add('hidden');
      }
    });
  }

  if (refreshBrandsBtn) {
    refreshBrandsBtn.addEventListener('click', async () => {
      await loadBrands();
      showToast('Markalar yenilendi.', 'success');
    });
  }

  if (brandSearchInput) {
    let searchTimeout = null;

    brandSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(async () => {
        await loadBrands();
      }, 350);
    });
  }

  if (brandVerifiedFilter) {
    brandVerifiedFilter.addEventListener('change', loadBrands);
  }
}

async function loadBrands() {
  const container = document.getElementById('brandsList');
  const brandSearchInput = document.getElementById('brandSearchInput');
  const brandVerifiedFilter = document.getElementById('brandVerifiedFilter');

  if (!container) return;

  container.innerHTML = `
    <div class="brands-empty-state">
      Markalar yükleniyor...
    </div>
  `;

  const params = new URLSearchParams();

  if (activeBrandCategory) {
    params.set('category', activeBrandCategory);
  }

  if (brandSearchInput && brandSearchInput.value.trim()) {
    params.set('q', brandSearchInput.value.trim());
  }

  if (brandVerifiedFilter && brandVerifiedFilter.value) {
    params.set('verified', brandVerifiedFilter.value);
  }

  const queryString = params.toString();
  const url = queryString
    ? `${API_BASE}/api/brands?${queryString}`
    : `${API_BASE}/api/brands`;

  const response = await authFetch(url);

  if (!response || !response.success) {
    brandsCache = [];

    container.innerHTML = `
      <div class="brands-empty-state error">
        ${response?.message || 'Markalar yüklenemedi.'}
      </div>
    `;

    updateBrandStats();
    return;
  }

  brandsCache = response.data || [];

  renderBrands();
  updateBrandStats();
  populateSponsorBrandSelect();
}

function renderBrands() {
  const container = document.getElementById('brandsList');

  if (!container) return;

  container.innerHTML = '';

  if (!brandsCache.length) {
    container.innerHTML = `
      <div class="brands-empty-state">
        Bu filtreye uygun marka bulunmuyor. İlk marka profilini oluşturabilirsin.
      </div>
    `;
    return;
  }

  brandsCache.forEach((brand) => {
    container.appendChild(createBrandCard(brand));
  });
}

function createBrandCard(brand) {
  const card = document.createElement('article');
  card.className = 'brand-card';

  const top = document.createElement('div');
  top.className = 'brand-card-top';

  const logo = document.createElement('div');
  logo.className = 'brand-logo-box';

  if (brand.logo_image_url) {
    const img = document.createElement('img');
    img.src = `${API_BASE}${brand.logo_image_url}`;
    img.alt = brand.name || 'Marka logosu';
    logo.appendChild(img);
  } else {
    logo.textContent = getBrandInitials(brand.name);
  }

  const titleWrap = document.createElement('div');
  titleWrap.className = 'brand-title-wrap';

  const title = document.createElement('h3');
  title.textContent = brand.name || 'Marka';

const meta = document.createElement('span');
meta.textContent = [
  brand.category || 'Kategori yok',
  brand.is_verified ? 'Onaylı marka' : 'Onay bekliyor'
].join(' · ');

  titleWrap.appendChild(title);
  titleWrap.appendChild(meta);

  const verifiedBadge = document.createElement('span');
  verifiedBadge.className = brand.is_verified ? 'brand-verified-badge active' : 'brand-verified-badge';
  verifiedBadge.textContent = brand.is_verified ? 'Onaylı' : 'Onaysız';

  top.appendChild(logo);
  top.appendChild(titleWrap);
  top.appendChild(verifiedBadge);

  const description = document.createElement('p');
  description.className = 'brand-description';
  description.textContent = brand.description || 'Bu marka için henüz açıklama eklenmemiş.';

  const chips = document.createElement('div');
  chips.className = 'brand-chip-list';

  chips.appendChild(createBrandChip('🏷️', shortenText(brand.category || 'Kategori yok', 28)));

if (brand.target_audience) {
  chips.appendChild(createBrandChip('🎯', shortenText(brand.target_audience, 44)));
}

if (brand.discount_code) {
  chips.appendChild(createBrandChip('🎁', shortenText(brand.discount_code, 24)));
}

  if (brand.campaign_url) {
    chips.appendChild(createBrandChip('🚀', 'Kampanya var'));
  }

  const actions = document.createElement('div');
  actions.className = 'brand-actions';

  const detailBtn = document.createElement('button');
  detailBtn.type = 'button';
  detailBtn.className = 'brand-action-button primary';
  detailBtn.textContent = 'Detay';
  detailBtn.addEventListener('click', () => openBrandDetail(brand.id));

  actions.appendChild(detailBtn);

  if (brand.website_url) {
    const websiteLink = document.createElement('a');
    websiteLink.className = 'brand-action-button secondary';
    websiteLink.href = brand.website_url;
    websiteLink.target = '_blank';
    websiteLink.rel = 'noopener noreferrer';
    websiteLink.textContent = 'Website';

    actions.appendChild(websiteLink);
  }

  if (brand.campaign_url) {
    const campaignLink = document.createElement('a');
    campaignLink.className = 'brand-action-button accent';
    campaignLink.href = brand.campaign_url;
    campaignLink.target = '_blank';
    campaignLink.rel = 'noopener noreferrer';
    campaignLink.textContent = 'Kampanya';

    actions.appendChild(campaignLink);
  }

  card.appendChild(top);
  card.appendChild(description);
  card.appendChild(chips);
  card.appendChild(actions);

  return card;
}

function createBrandChip(icon, value) {
  const chip = document.createElement('span');
  chip.className = 'brand-chip';
  chip.textContent = `${icon} ${value}`;
  return chip;
}

async function createBrand(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('createBrandSubmitBtn');
  const modal = document.getElementById('createBrandModal');

  const name = getInputValue('brandName');
  const category = getInputValue('brandCategory');

  if (!name || name.length < 2) {
    showToast('Marka adı en az 2 karakter olmalıdır.', 'error');
    return;
  }

  if (!category) {
    showToast('Kategori seçilmelidir.', 'error');
    return;
  }

  const formData = new FormData();

  formData.append('name', name);
  formData.append('category', category);
  formData.append('description', getInputValue('brandDescription'));
  formData.append('website_url', getInputValue('brandWebsiteUrl'));
  formData.append('contact_email', getInputValue('brandContactEmail'));
  formData.append('campaign_url', getInputValue('brandCampaignUrl'));
  formData.append('discount_code', getInputValue('brandDiscountCode'));
  formData.append('target_audience', getInputValue('brandTargetAudience'));

  const logoInput = document.getElementById('brandLogo');

  if (logoInput && logoInput.files && logoInput.files[0]) {
    formData.append('logo', logoInput.files[0]);
  }

  const originalText = submitBtn ? submitBtn.textContent : 'Markayı Oluştur';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Oluşturuluyor...';
  }

  const response = await authFetch(`${API_BASE}/api/brands/create`, {
    method: 'POST',
    body: formData,
    skipJsonContentType: true
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Marka oluşturulamadı.', 'error');
    return;
  }

  showToast('Marka oluşturuldu.', 'success');

  if (modal) {
    modal.classList.add('hidden');
  }

  const form = document.getElementById('createBrandForm');

  if (form) {
    form.reset();
  }

  await loadBrands();
}

async function openBrandDetail(brandId) {
  const modal = document.getElementById('brandDetailModal');
  const title = document.getElementById('brandDetailTitle');
  const content = document.getElementById('brandDetailContent');

  if (content) {
    content.innerHTML = `
      <div class="brands-empty-state">
        Marka detayı yükleniyor...
      </div>
    `;
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  const response = await authFetch(`${API_BASE}/api/brands/${brandId}`);

  if (!response || !response.success) {
    if (content) {
      content.innerHTML = `
        <div class="brands-empty-state error">
          ${response?.message || 'Marka detayı alınamadı.'}
        </div>
      `;
    }

    showToast(response?.message || 'Marka detayı alınamadı.', 'error');
    return;
  }

  const brand = response.data;

  if (title) {
    title.textContent = brand.name || 'Marka Detayı';
  }

  renderBrandDetail(brand);
}

function renderBrandDetail(brand) {
  const content = document.getElementById('brandDetailContent');

  if (!content) return;

  content.innerHTML = '';

  const header = document.createElement('section');
  header.className = 'brand-detail-hero';

  const logo = document.createElement('div');
  logo.className = 'brand-detail-logo';

  if (brand.logo_image_url) {
    const img = document.createElement('img');
    img.src = `${API_BASE}${brand.logo_image_url}`;
    img.alt = brand.name || 'Marka logosu';
    logo.appendChild(img);
  } else {
    logo.textContent = getBrandInitials(brand.name);
  }

  const info = document.createElement('div');
  info.className = 'brand-detail-info';

  const category = document.createElement('span');
  category.textContent = brand.category || 'Kategori yok';

  const name = document.createElement('h3');
  name.textContent = brand.name || 'Marka';

  const description = document.createElement('p');
  description.textContent = brand.description || 'Bu marka için açıklama eklenmemiş.';

  info.appendChild(category);
  info.appendChild(name);
  info.appendChild(description);

  header.appendChild(logo);
  header.appendChild(info);

  const metaGrid = document.createElement('section');
  metaGrid.className = 'brand-detail-grid';

  metaGrid.appendChild(createBrandDetailMeta('Durum', brand.is_verified ? 'Doğrulanmış' : 'Doğrulanmamış'));
  metaGrid.appendChild(createBrandDetailMeta('Kategori', brand.category || '-'));
  metaGrid.appendChild(createBrandDetailMeta('Hedef Kitle', brand.target_audience || '-'));
  metaGrid.appendChild(createBrandDetailMeta('İletişim', brand.contact_email || '-'));
  metaGrid.appendChild(createBrandDetailMeta('İndirim Kodu', brand.discount_code || '-'));
  metaGrid.appendChild(createBrandDetailMeta('Oluşturulma', formatBrandDate(brand.created_at)));

  const actions = document.createElement('section');
  actions.className = 'brand-detail-actions';

  if (brand.website_url) {
    actions.appendChild(createBrandExternalLink('Website Aç', brand.website_url, 'secondary'));
  }

  if (brand.campaign_url) {
    actions.appendChild(createBrandExternalLink('Kampanyaya Git', brand.campaign_url, 'accent'));
  }

  const sponsorNote = document.createElement('div');
  sponsorNote.className = 'brand-sponsor-note';
  sponsorNote.innerHTML = `
    <strong>Sponsor Kullanımı</strong>
    <p>
      Bu marka profili topluluk veya etkinlik sponsorluğu sırasında seçilebilir.
      Sonraki adımda Sponsor Marketplace üzerinden bu markayı doğrudan etkinliklere ve topluluklara bağlayacağız.
    </p>
  `;

  content.appendChild(header);
  content.appendChild(metaGrid);
  content.appendChild(actions);
  content.appendChild(sponsorNote);
}

function createBrandDetailMeta(label, value) {
  const item = document.createElement('div');

  const span = document.createElement('span');
  span.textContent = label;

  const strong = document.createElement('strong');
  strong.textContent = value || '-';

  item.appendChild(span);
  item.appendChild(strong);

  return item;
}

function createBrandExternalLink(label, url, variant = 'secondary') {
  const link = document.createElement('a');
  link.className = `brand-detail-button ${variant}`;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;

  return link;
}

function updateBrandStats() {
  const totalBrandsStat = document.getElementById('totalBrandsStat');
  const verifiedBrandsStat = document.getElementById('verifiedBrandsStat');
  const campaignBrandsStat = document.getElementById('campaignBrandsStat');
  const brandCategoriesStat = document.getElementById('brandCategoriesStat');

  const total = brandsCache.length;
  const verified = brandsCache.filter((brand) => brand.is_verified).length;
  const campaign = brandsCache.filter((brand) => brand.campaign_url || brand.discount_code).length;
  const categories = new Set(
    brandsCache
      .map((brand) => brand.category)
      .filter(Boolean)
  ).size;

  if (totalBrandsStat) totalBrandsStat.textContent = total;
  if (verifiedBrandsStat) verifiedBrandsStat.textContent = verified;
  if (campaignBrandsStat) campaignBrandsStat.textContent = campaign;
  if (brandCategoriesStat) brandCategoriesStat.textContent = categories;
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? String(element.value || '').trim() : '';
}

function getBrandInitials(name) {
  return String(name || 'FZ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FZ';
}

function formatBrandDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}
function shortenText(value, maxLength = 42) {
  const text = String(value || '').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function populateSponsorBrandSelect() {
  const select = document.getElementById('sponsorBrandSelect');

  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Marka seç</option>
  `;

  brandsCache.forEach((brand) => {
    const option = document.createElement('option');
    option.value = brand.id;
    option.textContent = `${brand.name} ${brand.category ? `· ${brand.category}` : ''}`;
    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

function updateSponsorTargetPlaceholder() {
  const targetType = getInputValue('sponsorTargetType') || 'community';
  const targetInput = document.getElementById('sponsorTargetId');

  if (!targetInput) return;

  targetInput.placeholder = targetType === 'event'
    ? 'Örn: Etkinlik ID 1'
    : 'Örn: Topluluk ID 38';
}

async function createSponsorLink(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('createSponsorSubmitBtn');

  const brandId = getInputValue('sponsorBrandSelect');
  const targetType = getInputValue('sponsorTargetType') || 'community';
  const targetId = getInputValue('sponsorTargetId');

  if (!brandId) {
    showToast('Sponsor için marka seçilmelidir.', 'error');
    return;
  }

  if (!targetId) {
    showToast('Topluluk veya etkinlik ID girilmelidir.', 'error');
    return;
  }

  const payload = {
    brand_id: Number(brandId),
    sponsorship_type: getInputValue('sponsorshipType') || 'sponsor',
    title: getInputValue('sponsorTitle'),
    description: getInputValue('sponsorDescription'),
    display_order: Number(getInputValue('sponsorDisplayOrder') || 0),
    is_featured: Boolean(document.getElementById('sponsorFeatured')?.checked)
  };

  const endpoint = targetType === 'event'
    ? `${API_BASE}/api/brands/events/${targetId}/sponsors`
    : `${API_BASE}/api/brands/communities/${targetId}/sponsors`;

  const originalText = submitBtn ? submitBtn.textContent : 'Sponsor Bağlantısı Oluştur';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kaydediliyor...';
  }

  const response = await authFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Sponsor bağlantısı oluşturulamadı.', 'error');
    return;
  }

  showToast('Sponsor bağlantısı oluşturuldu.', 'success');

  await loadSponsorsForTarget();
}

async function loadSponsorsForTarget() {
  const targetType = getInputValue('sponsorTargetType') || 'community';
  const targetId = getInputValue('sponsorTargetId');
  const container = document.getElementById('sponsorsList');

  if (!container) return;

  if (!targetId) {
    showToast('Sponsorları listelemek için hedef ID girilmelidir.', 'error');
    return;
  }

  container.innerHTML = `
    <div class="brands-empty-state small">
      Sponsor kayıtları yükleniyor...
    </div>
  `;

  const endpoint = targetType === 'event'
    ? `${API_BASE}/api/brands/events/${targetId}/sponsors`
    : `${API_BASE}/api/brands/communities/${targetId}/sponsors`;

  const response = await authFetch(endpoint);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="brands-empty-state error small">
        ${response?.message || 'Sponsor kayıtları yüklenemedi.'}
      </div>
    `;

    showToast(response?.message || 'Sponsor kayıtları yüklenemedi.', 'error');
    return;
  }

  renderSponsors(response.data || [], targetType, targetId);
}

function renderSponsors(sponsors, targetType, targetId) {
  const container = document.getElementById('sponsorsList');

  if (!container) return;

  container.innerHTML = '';

  if (!sponsors.length) {
    container.innerHTML = `
      <div class="brands-empty-state small">
        Bu hedef için henüz sponsor kaydı yok.
      </div>
    `;
    return;
  }

  sponsors.forEach((sponsor) => {
    container.appendChild(createSponsorCard(sponsor, targetType, targetId));
  });
}

function createSponsorCard(sponsor, targetType, targetId) {
  const brand = sponsor.brand || {};

  const card = document.createElement('article');
  card.className = sponsor.is_featured ? 'sponsor-card featured' : 'sponsor-card';

  const logo = document.createElement('div');
  logo.className = 'sponsor-logo';

  if (brand.logo_image_url) {
    const img = document.createElement('img');
    img.src = `${API_BASE}${brand.logo_image_url}`;
    img.alt = brand.name || 'Sponsor logosu';
    logo.appendChild(img);
  } else {
    logo.textContent = getBrandInitials(brand.name || 'SP');
  }

  const info = document.createElement('div');
  info.className = 'sponsor-info';

  const title = document.createElement('strong');
  title.textContent = sponsor.title || brand.name || 'Sponsor';

  const meta = document.createElement('span');
  meta.textContent = [
    brand.name,
    getSponsorshipTypeLabel(sponsor.sponsorship_type),
    sponsor.is_featured ? 'Öne çıkan' : null
  ].filter(Boolean).join(' · ');

  const description = document.createElement('p');
  description.textContent = sponsor.description || brand.description || 'Sponsor açıklaması bulunmuyor.';

  info.appendChild(title);
  info.appendChild(meta);
  info.appendChild(description);

  const actions = document.createElement('div');
  actions.className = 'sponsor-card-actions';

  if (brand.website_url) {
    const website = document.createElement('a');
    website.href = brand.website_url;
    website.target = '_blank';
    website.rel = 'noopener noreferrer';
    website.className = 'sponsor-mini-button secondary';
    website.textContent = 'Website';
    actions.appendChild(website);
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'sponsor-mini-button danger';
  removeBtn.textContent = 'Kaldır';
  removeBtn.addEventListener('click', () => {
    removeSponsor(sponsor.id, targetType, targetId);
  });

  actions.appendChild(removeBtn);

  card.appendChild(logo);
  card.appendChild(info);
  card.appendChild(actions);

  return card;
}

async function removeSponsor(sponsorId, targetType, targetId) {
  const confirmed = window.confirm('Bu sponsor bağlantısını kaldırmak istediğine emin misin?');

  if (!confirmed) return;

  const endpoint = targetType === 'event'
    ? `${API_BASE}/api/brands/events/${targetId}/sponsors/${sponsorId}`
    : `${API_BASE}/api/brands/communities/${targetId}/sponsors/${sponsorId}`;

  const response = await authFetch(endpoint, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Sponsor kaldırılamadı.', 'error');
    return;
  }

  showToast('Sponsor bağlantısı kaldırıldı.', 'success');

  await loadSponsorsForTarget();
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