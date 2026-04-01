async function init() {
  // Get user ID from URL if viewing someone else's profile
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const profileUserId = pathParts.includes('profile') ? pathParts[pathParts.indexOf('profile') + 1] : null;
  
  let user, projects;
  
  if (profileUserId && !isNaN(profileUserId)) {
    // Viewing another user's profile
    const userRes = await fetch(`/api/users/${profileUserId}`);
    if (!userRes.ok) {
      document.getElementById('user-name').textContent = 'User not found';
      return;
    }
    user = await userRes.json();
    const projectsRes = await fetch(`/api/users/${profileUserId}/projects`);
    projects = await projectsRes.json();
  } else {
    // Viewing own profile
    user = await fetch('/api/me').then(r => r.json());
    projects = await fetch('/api/projects').then(r => r.json());
  }
  
  // Update profile header
  document.getElementById('user-name').textContent = user.displayName || user.username || 'User';
  document.getElementById('user-username').textContent = '@' + (user.username || 'user');
  if (user.avatarUrl) {
    document.getElementById('user-avatar').src = user.avatarUrl;
  }
  
  renderProjects(projects);
}

function renderProjects(projects) {
  const list = document.getElementById('projects-list');
  
  // Check if viewing own profile
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const isOwnProfile = !pathParts.includes('profile') || !pathParts[pathParts.indexOf('profile') + 1];
  
  if (projects.length === 0) {
    const noProjectsMsg = isOwnProfile 
      ? 'No projects yet. <a href="/edit">Create your first pitch!</a>'
      : 'No projects yet.';
    list.innerHTML = `<p class="no-projects">${noProjectsMsg}</p>`;
    return;
  }
  
  list.innerHTML = projects.map(p => `
    <div class="project-card">
      <h4><a href="/project/${p.id}">${escapeHtml(p.title)}</a></h4>
      <p class="project-description">${escapeHtml(p.latestDescription || '').substring(0, 150)}${(p.latestDescription || '').length > 150 ? '...' : ''}</p>
      <div class="project-meta">
        <span>Revision ${p.revisionNumber}</span>
        <span>${p.responseCount || 0} responses</span>
      </div>
      ${p.provenanceUrl ? `<a href="${escapeHtml(p.provenanceUrl)}" class="provenance-link" target="_blank">Original</a>` : ''}
    </div>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();