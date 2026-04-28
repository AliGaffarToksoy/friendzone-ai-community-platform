// GPT assistant handler

document.addEventListener('DOMContentLoaded', () => {
  const assistantBtn = document.getElementById('assistantBtn');
  const suggestionsDiv = document.getElementById('assistantSuggestions');
  if (assistantBtn) {
    assistantBtn.addEventListener('click', async () => {
      // Determine category or community name from page
      const params = new URLSearchParams(window.location.search);
      const communityId = params.get('id');
      let category = null;
      let community_name = null;
      // Fetch community details to get category
      const details = await authFetch(`${API_BASE}/api/community/${communityId}`);
      if (details && details.success) {
        category = details.data.category;
        community_name = details.data.name;
      }
      const res = await authFetch(`${API_BASE}/api/assistant/community-suggestion`, {
        method: 'POST',
        body: JSON.stringify({ category, community_name })
      });
      if (res && res.success) {
        suggestionsDiv.innerHTML = '';
        const list = document.createElement('ul');
        res.data.suggestions.forEach(s => {
          const li = document.createElement('li');
          li.textContent = s;
          list.appendChild(li);
        });
        suggestionsDiv.appendChild(list);
        suggestionsDiv.classList.remove('hidden');
      } else {
        showToast(res ? res.message : 'Öneriler getirilemedi.', 'error');
      }
    });
  }
});