let feedScope = 'all';
let feedPostsCache = [];
let myCommunitiesCache = [];
let activeCommentPostId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const currentUserId = localStorage.getItem('user_id');

  if (!currentUserId) {
    logout();
    return;
  }

  bindFeedEvents();

  await Promise.all([
    loadMyCommunitiesForComposer(),
    loadFeed()
  ]);
});

function bindFeedEvents() {
  const feedPostForm = document.getElementById('feedPostForm');
  const feedPostContent = document.getElementById('feedPostContent');
  const refreshFeedBtn = document.getElementById('refreshFeedBtn');
  const tabs = document.querySelectorAll('.feed-tab');

  const closeCommentsModalBtn = document.getElementById('closeCommentsModalBtn');
  const commentsModal = document.getElementById('commentsModal');
  const commentForm = document.getElementById('commentForm');

  if (feedPostForm) {
    feedPostForm.addEventListener('submit', createFeedPost);
  }

  if (feedPostContent) {
    feedPostContent.addEventListener('input', updateComposerCounter);
  }

  if (refreshFeedBtn) {
    refreshFeedBtn.addEventListener('click', async () => {
      await loadFeed();
      showToast('Ana akış yenilendi.', 'success');
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');

      feedScope = tab.dataset.scope || 'all';

      await loadFeed();
    });
  });

  if (closeCommentsModalBtn) {
    closeCommentsModalBtn.addEventListener('click', closeCommentsModal);
  }

  if (commentsModal) {
    commentsModal.addEventListener('click', (event) => {
      if (event.target === commentsModal) {
        closeCommentsModal();
      }
    });
  }

  if (commentForm) {
    commentForm.addEventListener('submit', createComment);
  }
}

async function loadMyCommunitiesForComposer() {
  const currentUserId = localStorage.getItem('user_id');
  const select = document.getElementById('feedCommunitySelect');

  if (!select || !currentUserId) return;

  const response = await authFetch(`${API_BASE}/api/community/user/${currentUserId}`);

  if (!response || !response.success) {
    return;
  }

  myCommunitiesCache = response.data || [];

  select.innerHTML = `<option value="">Topluluk seçme</option>`;

  myCommunitiesCache.forEach((community) => {
    const option = document.createElement('option');
    option.value = community.id;
    option.textContent = `${community.name}${community.category ? ` · ${community.category}` : ''}`;
    select.appendChild(option);
  });
}

async function loadFeed() {
  const container = document.getElementById('feedPostsList');

  if (!container) return;

  container.innerHTML = `
    <div class="feed-empty-state">
      <strong>Akış yükleniyor...</strong>
      <p>Paylaşımlar getiriliyor.</p>
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/feed?scope=${encodeURIComponent(feedScope)}&limit=50`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="feed-empty-state">
        <strong>Akış yüklenemedi</strong>
        <p>${response?.message || 'Backend bağlantısını kontrol et.'}</p>
      </div>
    `;
    return;
  }

  feedPostsCache = response.data || [];

  renderFeedPosts();
}

function renderFeedPosts() {
  const container = document.getElementById('feedPostsList');

  if (!container) return;

  container.innerHTML = '';

  if (!feedPostsCache.length) {
    container.innerHTML = `
      <div class="feed-empty-state">
        <strong>Henüz paylaşım yok</strong>
        <p>Bu akışta ilk paylaşımı sen yapabilirsin.</p>
      </div>
    `;
    return;
  }

  feedPostsCache.forEach((post) => {
    container.appendChild(createPostCard(post));
  });
}

function createPostCard(post) {
  const card = document.createElement('article');
  card.className = 'feed-post-card';

  const header = document.createElement('div');
  header.className = 'feed-post-header';

  const avatar = document.createElement('div');
  avatar.className = 'feed-post-avatar';

  if (post.user?.profile_image) {
    const img = document.createElement('img');
    img.src = `${API_BASE}/uploads/profile_images/${post.user.profile_image}`;
    img.alt = post.user.name || 'Kullanıcı';
    avatar.appendChild(img);
  } else {
    avatar.textContent = getInitials(post.user?.name || 'FZ');
  }

  const identity = document.createElement('div');
  identity.className = 'feed-post-identity';

  const name = document.createElement('strong');
  name.textContent = post.user?.name || 'FriendZone Kullanıcısı';

  const meta = document.createElement('span');
  meta.textContent = buildPostMeta(post);

  identity.appendChild(name);
  identity.appendChild(meta);

  const badge = document.createElement('span');
  badge.className = `feed-type-badge type-${post.post_type || 'text'}`;
  badge.textContent = getPostTypeLabel(post.post_type);

  header.appendChild(avatar);
  header.appendChild(identity);
  header.appendChild(badge);

  const content = document.createElement('div');
  content.className = 'feed-post-content';
  content.textContent = post.content;

  card.appendChild(header);
  card.appendChild(content);

  if (post.community || post.event || post.link_url) {
    const context = document.createElement('div');
    context.className = 'feed-context-box';

    if (post.community) {
      const community = document.createElement('span');
      community.textContent = `🌐 ${post.community.name}`;
      context.appendChild(community);
    }

    if (post.event) {
      const event = document.createElement('span');
      event.textContent = `📅 ${post.event.title}`;
      context.appendChild(event);
    }

    if (post.link_url) {
      const link = document.createElement('a');
      link.href = post.link_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `🔗 ${post.link_url}`;
      context.appendChild(link);
    }

    card.appendChild(context);
  }

  const stats = document.createElement('div');
  stats.className = 'feed-post-stats';

  const likeText = document.createElement('span');
  likeText.textContent = `${post.like_count || 0} beğeni`;

  const commentText = document.createElement('span');
  commentText.textContent = `${post.comment_count || 0} yorum`;

  stats.appendChild(likeText);
  stats.appendChild(commentText);

  const actions = document.createElement('div');
  actions.className = 'feed-post-actions';

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = post.is_liked_by_me ? 'feed-action liked' : 'feed-action';
  likeBtn.textContent = post.is_liked_by_me ? '❤️ Beğendin' : '🤍 Beğen';
  likeBtn.addEventListener('click', () => toggleLike(post.id));

  const commentsBtn = document.createElement('button');
  commentsBtn.type = 'button';
  commentsBtn.className = 'feed-action';
  commentsBtn.textContent = '💬 Yorumlar';
  commentsBtn.addEventListener('click', () => openComments(post.id));

  actions.appendChild(likeBtn);
  actions.appendChild(commentsBtn);

  if (post.can_delete) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'feed-action danger';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener('click', () => deletePost(post.id));
    actions.appendChild(deleteBtn);
  }

  card.appendChild(stats);
  card.appendChild(actions);

  return card;
}

async function createFeedPost(event) {
  event.preventDefault();

  const content = document.getElementById('feedPostContent')?.value.trim() || '';
  const postType = document.getElementById('feedPostType')?.value || 'text';
  const visibility = document.getElementById('feedVisibility')?.value || 'public';
  const communityId = document.getElementById('feedCommunitySelect')?.value || '';
  const linkUrl = document.getElementById('feedLinkUrl')?.value.trim() || '';

  if (!content || content.length < 2) {
    showToast('Paylaşım içeriği en az 2 karakter olmalıdır.', 'error');
    return;
  }

  const button = document.getElementById('feedPostSubmitBtn');
  const originalText = button ? button.textContent : 'Paylaş';

  if (button) {
    button.disabled = true;
    button.textContent = 'Paylaşılıyor...';
  }

  const response = await authFetch(`${API_BASE}/api/feed/posts`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      post_type: postType,
      visibility,
      community_id: communityId ? Number(communityId) : null,
      link_url: linkUrl
    })
  });

  if (button) {
    button.disabled = false;
    button.textContent = originalText;
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Paylaşım oluşturulamadı.', 'error');
    return;
  }

  showToast('Paylaşım oluşturuldu.', 'success');

  const form = document.getElementById('feedPostForm');
  if (form) form.reset();

  updateComposerCounter();

  feedScope = 'all';
  document.querySelectorAll('.feed-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.scope === 'all');
  });

  await loadFeed();
}

async function toggleLike(postId) {
  const response = await authFetch(`${API_BASE}/api/feed/posts/${postId}/like`, {
    method: 'POST'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Beğeni güncellenemedi.', 'error');
    return;
  }

  feedPostsCache = feedPostsCache.map((post) => {
    if (String(post.id) !== String(postId)) return post;

    return {
      ...post,
      is_liked_by_me: response.data.liked,
      like_count: response.data.like_count
    };
  });

  renderFeedPosts();
}

async function deletePost(postId) {
  const confirmed = confirm('Bu paylaşım silinsin mi?');

  if (!confirmed) return;

  const response = await authFetch(`${API_BASE}/api/feed/posts/${postId}`, {
    method: 'DELETE'
  });

  if (!response || !response.success) {
    showToast(response?.message || 'Paylaşım silinemedi.', 'error');
    return;
  }

  showToast('Paylaşım silindi.', 'success');

  feedPostsCache = feedPostsCache.filter((post) => String(post.id) !== String(postId));
  renderFeedPosts();
}

async function openComments(postId) {
  activeCommentPostId = postId;

  const modal = document.getElementById('commentsModal');
  const postIdInput = document.getElementById('commentPostId');

  if (postIdInput) postIdInput.value = postId;
  if (modal) modal.classList.remove('hidden');

  await loadComments(postId);
}

function closeCommentsModal() {
  const modal = document.getElementById('commentsModal');
  const form = document.getElementById('commentForm');

  if (modal) modal.classList.add('hidden');
  if (form) form.reset();

  activeCommentPostId = null;
}

async function loadComments(postId) {
  const container = document.getElementById('commentsList');

  if (!container) return;

  container.innerHTML = `
    <div class="feed-empty-state">
      Yorumlar yükleniyor...
    </div>
  `;

  const response = await authFetch(`${API_BASE}/api/feed/posts/${postId}/comments`);

  if (!response || !response.success) {
    container.innerHTML = `
      <div class="feed-empty-state">
        ${response?.message || 'Yorumlar yüklenemedi.'}
      </div>
    `;
    return;
  }

  renderComments(response.data || []);
}

function renderComments(comments) {
  const container = document.getElementById('commentsList');

  if (!container) return;

  container.innerHTML = '';

  if (!comments.length) {
    container.innerHTML = `
      <div class="feed-empty-state">
        Henüz yorum yok. İlk yorumu sen yaz.
      </div>
    `;
    return;
  }

  comments.forEach((comment) => {
    const card = document.createElement('article');
    card.className = 'comment-card';

    const avatar = document.createElement('div');
    avatar.className = 'comment-avatar';

    if (comment.user?.profile_image) {
      const img = document.createElement('img');
      img.src = `${API_BASE}/uploads/profile_images/${comment.user.profile_image}`;
      img.alt = comment.user.name || 'Kullanıcı';
      avatar.appendChild(img);
    } else {
      avatar.textContent = getInitials(comment.user?.name || 'FZ');
    }

    const body = document.createElement('div');
    body.className = 'comment-body';

    const top = document.createElement('div');
    top.className = 'comment-top';

    const name = document.createElement('strong');
    name.textContent = comment.user?.name || 'FriendZone Kullanıcısı';

    const date = document.createElement('span');
    date.textContent = formatDate(comment.created_at);

    top.appendChild(name);
    top.appendChild(date);

    const content = document.createElement('p');
    content.textContent = comment.content;

    body.appendChild(top);
    body.appendChild(content);

    card.appendChild(avatar);
    card.appendChild(body);

    container.appendChild(card);
  });
}

async function createComment(event) {
  event.preventDefault();

  const postId = document.getElementById('commentPostId')?.value || activeCommentPostId;
  const content = document.getElementById('commentContent')?.value.trim() || '';

  if (!postId) {
    showToast('Paylaşım seçilemedi.', 'error');
    return;
  }

  if (!content) {
    showToast('Yorum boş olamaz.', 'error');
    return;
  }

  const button = document.getElementById('commentSubmitBtn');
  const originalText = button ? button.textContent : 'Yorumu Gönder';

  if (button) {
    button.disabled = true;
    button.textContent = 'Gönderiliyor...';
  }

  const response = await authFetch(`${API_BASE}/api/feed/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });

  if (button) {
    button.disabled = false;
    button.textContent = originalText;
  }

  if (!response || !response.success) {
    showToast(response?.message || 'Yorum eklenemedi.', 'error');
    return;
  }

  const input = document.getElementById('commentContent');
  if (input) input.value = '';

  await loadComments(postId);
  await loadFeed();
}

function updateComposerCounter() {
  const textarea = document.getElementById('feedPostContent');
  const counter = document.getElementById('composerCounter');

  if (!textarea || !counter) return;

  counter.textContent = `${textarea.value.length}/3000`;
}

function buildPostMeta(post) {
  const parts = [];

  if (post.user?.university) parts.push(post.user.university);
  if (post.user?.department) parts.push(post.user.department);

  parts.push(formatDate(post.created_at));

  return parts.filter(Boolean).join(' · ');
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