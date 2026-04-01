async function init() {
  // Get user ID from URL if viewing someone else's profile
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const profileUserId = pathParts.includes('profile') ? pathParts[pathParts.indexOf('profile') + 1] : null;

  let user, projects, attempts, events;

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
    const projectsRes = await fetch('/api/projects');
    const projectsData = await projectsRes.json();
    projects = projectsData.projects || projectsData;
    attempts = await fetch('/api/me/attempts').then(r => r.json());
    events = await fetch('/api/me/events').then(r => r.json());
  }

  // Update profile header
  document.getElementById('user-name').textContent = user.displayName || user.username || 'User';
  document.getElementById('user-username').textContent = '@' + (user.username || 'user');
  if (user.avatarUrl) {
    document.getElementById('user-avatar').src = user.avatarUrl;
  }

  // Only show attempts and events on own profile
  const isOwnProfile = !pathParts.includes('profile') || !pathParts[pathParts.indexOf('profile') + 1];
  if (isOwnProfile) {
    renderAttempts(attempts || []);
    renderEvents(events || []);
  } else {
    // Hide sections for other users' profiles
    document.getElementById('my-events-section').style.display = 'none';
    document.getElementById('attempts-section').style.display = 'none';
  }

  renderProjects(projects);
}

function renderEvents(events) {
  const list = document.getElementById('events-list');

  if (events.length === 0) {
    list.innerHTML = '<p class="empty-state">Not attending any events yet.</p>';
    return;
  }

  list.innerHTML = events.map(e => {
    const startDate = e.startDate ? new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
    return `
      <div class="event-card">
        ${e.imageUrl ? `<div class="event-card-image" style="background-image: url('${escapeHtml(e.imageUrl)}')"></div>` : ''}
        <div class="event-card-info">
          <a href="/events/${e.id}" class="event-card-title">${escapeHtml(e.title || 'Event')}</a>
          <p class="event-card-date">${startDate}</p>
          <p class="event-card-description">${escapeHtml(e.description || '').substring(0, 100)}${(e.description || '').length > 100 ? '...' : ''}</p>
          <a href="/events/${e.id}" class="btn btn-small btn-secondary">View Details</a>
        </div>
      </div>
    `;
  }).join('');
}

function renderAttempts(attempts) {
  const list = document.getElementById('attempts-list');

  if (attempts.length === 0) {
    list.innerHTML = '<p class="empty-state">No attempts yet. <a href="/">Browse projects</a> and describe what they do!</p>';
    return;
  }

  list.innerHTML = attempts.map(a => {
    const date = new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Show feedback reason if provided, otherwise show answers
    let contentHtml = '';
    if (a.feedbackReason) {
      const reasonLabels = {
        'bored': 'Got bored / lost interest',
        'dont-care': "Don't care about this problem",
        'too-difficult': 'Too difficult/complicated to understand',
        'hard-to-hear': 'Hard to hear/understand (audio/video issues)',
        'not-interesting': 'Not interesting to me',
        'other': a.feedbackOther || 'Other'
      };
      contentHtml = `
        <div class="attempt-feedback">
          <span class="feedback-badge">⚠️ ${escapeHtml(reasonLabels[a.feedbackReason] || a.feedbackReason)}</span>
        </div>
      `;
    } else {
      const answers = [];
      if (a.whatDoesItDo) answers.push('What it does');
      if (a.problemItSolves) answers.push('Problem it solves');
      if (a.whoIsItFor) answers.push('Who it\'s for');
      if (a.howToUse) answers.push('How to use');
      
      contentHtml = `
        <div class="attempt-answers">
          <span class="answers-count">${answers.length} question${answers.length !== 1 ? 's' : ''} answered</span>
          <div class="answer-tags">
            ${answers.map(a => `<span class="answer-tag">${escapeHtml(a)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="attempt-card">
        <div class="attempt-header">
          <div class="attempt-project">
            <a href="/project/${a.projectId}">${escapeHtml(a.projectTitle || 'Untitled Project')}</a>
          </div>
          <span class="attempt-date">${date}</span>
        </div>
        <div class="attempt-content">
          ${contentHtml}
        </div>
      </div>
    `;
  }).join('');
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
