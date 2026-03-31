// Get project ID from URL
const projectId = window.location.pathname.split('/').pop();
let project = null;
let currentRevision = null;

async function init() {
  await loadProject();
  loadAuth();
}

async function loadAuth() {
  const res = await fetch('/api/me');
  const user = await res.json();
  
  const authSection = document.getElementById('auth-section');
  if (user) {
    authSection.innerHTML = `
      <div class="user-info">
        <img src="${user.avatarUrl || 'https://github.com/ghost.png'}" alt="${user.displayName}">
        <span>${user.displayName || user.username}</span>
      </div>
    `;
  }
}

async function loadProject() {
  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) {
    document.getElementById('project-title').textContent = 'Project not found';
    return;
  }
  
  project = await res.json();
  
  // Update header
  document.getElementById('project-title').textContent = project.title;
  document.getElementById('project-author').textContent = `by ${project.displayName || project.username}`;
  if (project.provenanceUrl) {
    document.getElementById('project-provenance').textContent = `from ${project.provenanceUrl}`;
  }
  
  // Show revision tabs
  renderRevisionTabs();
  
  // Select latest revision
  if (project.revisions.length > 0) {
    selectRevision(project.revisions[0]);
  }
  
  // Show responses for latest revision
  renderResponses();
}

function renderRevisionTabs() {
  const tabsContainer = document.getElementById('revision-tabs');
  
  if (project.revisions.length === 0) {
    tabsContainer.innerHTML = '<p class="no-revisions">No revisions yet</p>';
    return;
  }
  
  tabsContainer.innerHTML = project.revisions.map((rev, i) => `
    <button class="revision-tab ${currentRevision && currentRevision.id === rev.id ? 'active' : ''}" 
            data-revision-id="${rev.id}">
      Revision ${rev.revisionNumber}
      <span class="response-count">${rev.responseCount || 0} responses</span>
    </button>
  `).join('');
  
  // Add click handlers
  tabsContainer.querySelectorAll('.revision-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const revId = parseInt(tab.dataset.revisionId);
      const rev = project.revisions.find(r => r.id === revId);
      selectRevision(rev);
      renderResponses();
    });
  });
}

function selectRevision(revision) {
  currentRevision = revision;
  
  // Update active tab
  document.querySelectorAll('.revision-tab').forEach(tab => {
    tab.classList.toggle('active', parseInt(tab.dataset.revisionId) === revision.id);
  });
  
  // Update links
  const videoLink = document.getElementById('revision-video');
  const githubLink = document.getElementById('revision-github');
  const websiteLink = document.getElementById('revision-website');
  
  if (revision.videoUrl) {
    videoLink.href = revision.videoUrl;
    videoLink.classList.remove('hidden');
  } else {
    videoLink.classList.add('hidden');
  }
  
  if (revision.githubUrl) {
    githubLink.href = revision.githubUrl;
    githubLink.classList.remove('hidden');
  } else {
    githubLink.classList.add('hidden');
  }
  
  if (revision.websiteUrl) {
    websiteLink.href = revision.websiteUrl;
    websiteLink.classList.remove('hidden');
  } else {
    websiteLink.classList.add('hidden');
  }
  
  // Update description
  document.getElementById('revision-description-text').innerHTML = escapeHtml(revision.description || '').replace(/\n/g, '<br>');
  
  // Update form action
  document.getElementById('response-form').dataset.revisionId = revision.id;
}

function renderResponses() {
  const responsesList = document.getElementById('responses-list');
  document.getElementById('response-count').textContent = currentRevision ? currentRevision.responses.length : 0;
  
  if (!currentRevision || !currentRevision.responses || currentRevision.responses.length === 0) {
    responsesList.innerHTML = '<p class="no-responses">No responses yet. Be the first to decode!</p>';
    return;
  }
  
  responsesList.innerHTML = currentRevision.responses.map(resp => `
    <div class="response-card">
      <div class="response-author">
        <img src="https://github.com/ghost.png" alt="${escapeHtml(resp.username)}">
        <span>${escapeHtml(resp.displayName || resp.username)}</span>
      </div>
      <div class="response-fields">
        <div class="response-field">
          <label>What does it do?</label>
          <p>${escapeHtml(resp.whatDoesItDo)}</p>
        </div>
        <div class="response-field">
          <label>Why is it valuable?</label>
          <p>${escapeHtml(resp.whyValuable)}</p>
        </div>
        <div class="response-field">
          <label>Who is it for?</label>
          <p>${escapeHtml(resp.whoIsItFor)}</p>
        </div>
        <div class="response-field">
          <label>How to use</label>
          <p>${escapeHtml(resp.howToUse)}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Response form handler
document.getElementById('response-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const revisionId = currentRevision.id;
  const data = {
    whatDoesItDo: document.getElementById('whatDoesItDo').value,
    whyValuable: document.getElementById('whyValuable').value,
    whoIsItFor: document.getElementById('whoIsItFor').value,
    howToUse: document.getElementById('howToUse').value
  };
  
  const res = await fetch(`/api/revisions/${revisionId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    // Clear form
    document.getElementById('response-form').reset();
    // Reload project to get updated responses
    await loadProject();
    // Re-select current revision and render responses
    if (currentRevision) {
      const rev = project.revisions.find(r => r.id === currentRevision.id);
      selectRevision(rev);
      renderResponses();
    }
  } else {
    alert('Failed to submit response');
  }
});

// Add revision form handler
document.getElementById('revision-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    description: document.getElementById('rev-description').value,
    videoUrl: document.getElementById('rev-video').value,
    githubUrl: document.getElementById('rev-github').value,
    websiteUrl: document.getElementById('rev-website').value
  };
  
  const res = await fetch(`/api/projects/${projectId}/revisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    const result = await res.json();
    alert(`Revision ${result.revisionNumber} added!`);
    // Clear form
    document.getElementById('revision-form').reset();
    // Reload project
    await loadProject();
  } else {
    alert('Failed to add revision');
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();