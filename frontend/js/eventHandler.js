let allEventsCache = [];
let selectedEventId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');

  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }

  bindEventPageEvents();
  await loadEvents();
});

function bindEventPageEvents() {
  const searchInput = document.getElementById('eventSearch');
  const typeFilter = document.getElementById('eventTypeFilter');
  const cityFilter = document.getElementById('cityFilter');
  const closeModalBtn = document.getElementById('closeEventDetailBtn');
  const modal = document.getElementById('eventDetailModal');
  const reviewForm = document.getElementById('eventReviewForm');

  if (searchInput) searchInput.addEventListener('input', applyEventFilters);
  if (typeFilter) typeFilter.addEventListener('change', applyEventFilters);
  if (cityFilter) cityFilter.addEventListener('input', applyEventFilters);

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

  if (reviewForm) {
    reviewForm.addEventListener('submit', submitEventReview);
  }
}

async function loadEvents() {
  const response = await authFetch(`${API_BASE}/api/events`);

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlikler yüklenemedi.', 'error');
    allEventsCache = [];
    renderEvents([]);
    return;
  }

  allEventsCache = response.data || [];

  const totalCount = document.getElementById('totalEventsCount');
  if (totalCount) totalCount.textContent = allEventsCache.length;

  applyEventFilters();
}

function applyEventFilters() {
  const query = normalizeText(document.getElementById('eventSearch')?.value || '');
  const type = document.getElementById('eventTypeFilter')?.value || '';
  const city = normalizeText(document.getElementById('cityFilter')?.value || '');

  const filtered = allEventsCache.filter((event) => {
    const matchesType = !type || event.event_type === type;
    const matchesCity = !city || normalizeText(event.city || '').includes(city);

    const searchable = normalizeText([
      event.title,
      event.description,
      event.city,
      event.location,
      event.event_type
    ].join(' '));

    const matchesQuery = !query || searchable.includes(query);

    return matchesType && matchesCity && matchesQuery;
  });

  renderEvents(filtered);
}

function renderEvents(events) {
  const container = document.getElementById('eventsGrid');
  const count = document.getElementById('filteredEventsCount');

  if (count) count.textContent = `${events.length} etkinlik`;

  if (!container) return;

  container.innerHTML = '';

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Bu filtrelere uygun etkinlik bulunamadı.
      </div>
    `;
    return;
  }

  events.forEach((event) => {
    const card = document.createElement('article');
    card.className = 'event-card';

    const poster = document.createElement('div');
    poster.className = 'event-poster';

    if (event.poster_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${event.poster_image_url}`;
      img.alt = event.title;
      poster.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = `event-poster-fallback type-${event.event_type || 'offline'}`;
      fallback.innerHTML = `
        <span>${getEventTypeIcon(event.event_type)}</span>
        <strong>${getEventTypeLabel(event.event_type)}</strong>
      `;
      poster.appendChild(fallback);
    }

    const body = document.createElement('div');
    body.className = 'event-card-body';

    const top = document.createElement('div');
    top.className = 'event-card-top';

    const typeBadge = document.createElement('span');
    typeBadge.className = `event-type-badge type-${event.event_type || 'offline'}`;
    typeBadge.textContent = getEventTypeLabel(event.event_type);

    const dateBadge = document.createElement('span');
    dateBadge.className = 'event-date-badge';
    dateBadge.textContent = formatEventDateShort(event.event_date);

    top.appendChild(typeBadge);
    top.appendChild(dateBadge);

    const title = document.createElement('h3');
    title.textContent = event.title;

    const description = document.createElement('p');
    description.className = 'event-description';
    description.textContent = event.description || 'Etkinlik açıklaması bulunmuyor.';

    const meta = document.createElement('div');
    meta.className = 'event-meta-grid';

    meta.appendChild(createMetaItem('Şehir', event.city || getEventTypeFallbackCity(event.event_type)));
    meta.appendChild(createMetaItem('Konum', event.location || getEventTypeFallbackLocation(event.event_type)));
    meta.appendChild(createMetaItem('Katılım', `${event.participant_count || 0}${event.capacity ? `/${event.capacity}` : ''}`));
    meta.appendChild(createMetaItem('Puan', event.average_rating ? `${event.average_rating}/5` : 'Henüz yok'));

    const status = document.createElement('div');
    status.className = 'event-status-row';

    const currentStatus = document.createElement('span');
    currentStatus.className = `event-status-pill status-${event.user_status || 'none'}`;
    currentStatus.textContent = getUserStatusLabel(event.user_status);

    status.appendChild(currentStatus);

    const footer = document.createElement('div');
    footer.className = 'event-card-footer';

    const participationActions = document.createElement('div');
    participationActions.className = 'event-actions';

    const goingBtn = createEventActionButton('Katılıyorum', () => updateEventStatus(event.id, 'going'));
    const interestedBtn = createEventActionButton('İlgileniyorum', () => updateEventStatus(event.id, 'interested'));
    const cancelBtn = createEventActionButton('İptal', () => updateEventStatus(event.id, 'cancelled'), true);

    participationActions.appendChild(goingBtn);
    participationActions.appendChild(interestedBtn);
    participationActions.appendChild(cancelBtn);

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'secondary-action event-detail-button';
    detailBtn.textContent = 'Detay & Yorumlar';
    detailBtn.addEventListener('click', () => openEventDetail(event.id));

    footer.appendChild(participationActions);
    footer.appendChild(detailBtn);

    body.appendChild(top);
    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(meta);
    body.appendChild(status);
    body.appendChild(footer);

    card.appendChild(poster);
    card.appendChild(body);

    container.appendChild(card);
  });
}

function createEventActionButton(text, handler, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'event-action danger-event-action' : 'event-action';
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
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

async function updateEventStatus(eventId, status) {
  const response = await authFetch(`${API_BASE}/api/events/${eventId}/join`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlik katılım durumu güncellenemedi.', 'error');
    return;
  }

  showToast('Etkinlik katılım durumu güncellendi.', 'success');

  const updatedEvent = response.data;

  allEventsCache = allEventsCache.map((item) => {
    if (String(item.id) === String(updatedEvent.id)) {
      return updatedEvent;
    }

    return item;
  });

  applyEventFilters();
}

async function openEventDetail(eventId) {
  selectedEventId = eventId;

  const response = await authFetch(`${API_BASE}/api/events/${eventId}`);

  if (!response || !response.success) {
    showToast(response?.message || 'Etkinlik detayı yüklenemedi.', 'error');
    return;
  }

  const event = response.data;

  const modal = document.getElementById('eventDetailModal');
  const title = document.getElementById('modalEventTitle');
  const content = document.getElementById('modalEventContent');
  const reviewEventId = document.getElementById('reviewEventId');

  if (title) title.textContent = event.title;
  if (reviewEventId) reviewEventId.value = event.id;

  if (content) {
    content.innerHTML = '';

    const posterWrap = document.createElement('div');
    posterWrap.className = 'modal-poster-wrap';

    if (event.poster_image_url) {
      const img = document.createElement('img');
      img.src = `${API_BASE}${event.poster_image_url}`;
      img.alt = event.title;
      posterWrap.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = `modal-poster-fallback type-${event.event_type || 'offline'}`;
      fallback.innerHTML = `<span>${getEventTypeIcon(event.event_type)}</span>`;
      posterWrap.appendChild(fallback);
    }

    const detail = document.createElement('div');
    detail.className = 'modal-event-detail';

    const description = document.createElement('p');
    description.textContent = event.description;

    const meta = document.createElement('div');
    meta.className = 'event-meta-grid';

    meta.appendChild(createMetaItem('Tarih', formatEventDateLong(event.event_date)));
    meta.appendChild(createMetaItem('Tip', getEventTypeLabel(event.event_type)));
    meta.appendChild(createMetaItem('Şehir', event.city || getEventTypeFallbackCity(event.event_type)));
    meta.appendChild(createMetaItem('Konum', event.location || getEventTypeFallbackLocation(event.event_type)));
    meta.appendChild(createMetaItem('Katılım', `${event.participant_count || 0}${event.capacity ? `/${event.capacity}` : ''}`));
    meta.appendChild(createMetaItem('Puan', event.average_rating ? `${event.average_rating}/5` : 'Henüz yok'));

    detail.appendChild(description);
    detail.appendChild(meta);

    content.appendChild(posterWrap);
    content.appendChild(detail);
  }

  if (modal) modal.classList.remove('hidden');

  await loadEventReviews(event.id);
}

async function loadEventReviews(eventId) {
  const response = await authFetch(`${API_BASE}/api/events/${eventId}/reviews`);
  const container = document.getElementById('eventReviewsList');

  if (!container) return;

  container.innerHTML = '';

  if (!response || !response.success || !response.data.length) {
    container.innerHTML = `
      <div class="empty-card-state">
        Henüz yorum yapılmadı.
      </div>
    `;
    return;
  }

  response.data.forEach((review) => {
    const card = document.createElement('div');
    card.className = 'review-card';

    const top = document.createElement('div');
    top.className = 'review-card-top';

    const user = document.createElement('strong');
    user.textContent = review.user_name || 'FriendZone Kullanıcısı';

    const rating = document.createElement('span');
    rating.textContent = `⭐ ${review.rating}/5`;

    top.appendChild(user);
    top.appendChild(rating);

    const comment = document.createElement('p');
    comment.textContent = review.comment || 'Yorum eklenmedi.';

    card.appendChild(top);
    card.appendChild(comment);

    container.appendChild(card);
  });
}

async function submitEventReview(event) {
  event.preventDefault();

  const eventId = document.getElementById('reviewEventId')?.value;
  const rating = document.getElementById('eventRating')?.value;
  const comment = document.getElementById('eventComment')?.value.trim();

  if (!eventId) {
    showToast('Etkinlik seçilemedi.', 'error');
    return;
  }

  const response = await authFetch(`${API_BASE}/api/events/${eventId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      rating,
      comment
    })
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Yorum kaydedilemedi.', 'error');
    return;
  }

  showToast('Değerlendirme kaydedildi.', 'success');

  const form = document.getElementById('eventReviewForm');
  if (form) form.reset();

  await loadEventReviews(eventId);
  await loadEvents();
}

function getEventTypeLabel(type) {
  const map = {
    offline: 'Offline',
    online: 'Online',
    hybrid: 'Hybrid'
  };

  return map[type] || 'Offline';
}

function getEventTypeIcon(type) {
  const map = {
    offline: '📍',
    online: '💻',
    hybrid: '🌐'
  };

  return map[type] || '📍';
}

function getUserStatusLabel(status) {
  const map = {
    going: 'Katılıyorum',
    interested: 'İlgileniyorum',
    cancelled: 'İptal edildi',
    none: 'Durum yok'
  };

  return map[status || 'none'] || 'Durum yok';
}

function getEventTypeFallbackCity(type) {
  if (type === 'online') return 'Online';
  return '-';
}

function getEventTypeFallbackLocation(type) {
  if (type === 'online') return 'Online etkinlik';
  return '-';
}

function formatEventDateShort(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short'
  });
}

function formatEventDateLong(value) {
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