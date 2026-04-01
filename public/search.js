// Get search query from URL
const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('q') || '';

async function init() {
  // Pre-fill search input if there's a query
  const searchInput = document.getElementById('search-input');
  if (searchInput && query) {
    searchInput.value = query;
  }

  // Display search term
  document.getElementById('search-term').textContent = query;
  document.getElementById('no-results-term').textContent = query;

  if (!query.trim()) {
    // No query - just show the search box
    document.getElementById('search-results').classList.add('d-none');
    document.getElementById('no-results').classList.add('d-none');
    return;
  }

  // Has query - search across all types
  const results = await Promise.all([
    searchProjects(query),
    searchEvents(query),
    searchUsers(query)
  ]);

  const [projects, events, users] = results;
  const hasResults = projects.length > 0 || events.length > 0 || users.length > 0;

  if (hasResults) {
    document.getElementById('search-results').classList.remove('d-none');
    document.getElementById('no-results').classList.add('d-none');
  } else {
    document.getElementById('search-results').classList.add('d-none');
    document.getElementById('no-results').classList.remove('d-none');
  }
}

async function searchProjects(query) {
  const res = await fetch(`/api/search/projects?q=${encodeURIComponent(query)}`);
  const projects = await res.json();
  renderProjectsResults(projects);
  return projects;
}

async function searchEvents(query) {
  const res = await fetch(`/api/search/events?q=${encodeURIComponent(query)}`);
  const events = await res.json();
  renderEventsResults(events);
  return events;
}

async function searchUsers(query) {
  const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`);
  const users = await res.json();
  renderUsersResults(users);
}

function renderProjectsResults(projects) {
  const container = document.getElementById('projects-results');
  
  if (projects.length === 0) {
    container.innerHTML = '<p class="no-results-in-section">No projects found</p>';
    return;
  }
  
  container.innerHTML = projects.map(p => {
    const imageUrl = p.latestImageUrl || 'https://placehold.co/600x400?text=No+Image';
    return `
      <a href="/project/${p.id}" class="search-result-card">
        ${imageUrl ? `<div class="result-card-image" style="background-image: url('${escapeHtml(imageUrl)}')"></div>` : ''}
        <div class="result-card-info">
          <h4 class="result-card-title">${highlightMatch(escapeHtml(p.title), query)}</h4>
          <p class="result-card-description">${escapeHtml(p.latestDescription || '').substring(0, 100)}${(p.latestDescription || '').length > 100 ? '...' : ''}</p>
          <span class="result-card-meta">By ${escapeHtml(p.displayName || p.username)}</span>
        </div>
      </a>
    `;
  }).join('');
}

function renderEventsResults(events) {
  const container = document.getElementById('events-results');
  
  if (events.length === 0) {
    container.innerHTML = '<p class="no-results-in-section">No events found</p>';
    return;
  }
  
  container.innerHTML = events.map(e => {
    const startDate = e.startDate ? new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
    return `
      <a href="/events/${e.id}" class="search-result-card">
        ${e.imageUrl ? `<div class="result-card-image" style="background-image: url('${escapeHtml(e.imageUrl)}')"></div>` : ''}
        <div class="result-card-info">
          <h4 class="result-card-title">${highlightMatch(escapeHtml(e.title), query)}</h4>
          <p class="result-card-date">${startDate}</p>
          <p class="result-card-description">${escapeHtml(e.description || '').substring(0, 100)}${(e.description || '').length > 100 ? '...' : ''}</p>
        </div>
      </a>
    `;
  }).join('');
}

function renderUsersResults(users) {
  const container = document.getElementById('users-results');
  
  if (users.length === 0) {
    container.innerHTML = '<p class="no-results-in-section">No users found</p>';
    return;
  }
  
  container.innerHTML = users.map(u => `
    <a href="/profile/${u.id}" class="search-result-card user-result-card">
      <img src="${u.avatarUrl || 'https://github.com/ghost.png'}" alt="${u.displayName}" class="user-avatar">
      <div class="result-card-info">
        <h4 class="result-card-title">${highlightMatch(escapeHtml(u.displayName || u.username), query)}</h4>
        <p class="result-card-meta">@${escapeHtml(u.username)}</p>
      </div>
    </a>
  `).join('');
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function showNoResults() {
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('no-results').classList.remove('hidden');
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
