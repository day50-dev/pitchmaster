// Get project/revision ID from URL if editing
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');
const revisionId = urlParams.get('revisionId');

let existingData = null;

async function init() {
  loadAuth();
  
  if (projectId && revisionId) {
    // Editing existing revision
    document.getElementById('page-title').textContent = 'Edit Pitch';
    await loadExistingRevision();
  } else if (projectId) {
    // Adding new revision to existing project
    document.getElementById('page-title').textContent = 'Add New Revision';
    await loadExistingProject();
  } else {
    // New project
    document.getElementById('page-title').textContent = 'Add New Pitch';
  }
  
  setupPreview();
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

async function loadExistingProject() {
  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) return;
  
  const project = await res.json();
  existingData = { project };
  
  // Pre-fill with latest revision data
  if (project.revisions && project.revisions.length > 0) {
    const latest = project.revisions[0];
    document.getElementById('description').value = latest.description || '';
    document.getElementById('videoUrl').value = latest.videoUrl || '';
    document.getElementById('githubUrl').value = latest.githubUrl || '';
    document.getElementById('websiteUrl').value = latest.websiteUrl || '';
    document.getElementById('provenanceUrl').value = project.provenanceUrl || '';
    document.getElementById('title').value = project.title || '';
    updatePreview();
  }
}

async function loadExistingRevision() {
  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) return;
  
  const project = await res.json();
  const revision = project.revisions.find(r => r.id == revisionId);
  if (!revision) return;
  
  existingData = { project, revision };
  
  document.getElementById('title').value = project.title || '';
  document.getElementById('description').value = revision.description || '';
  document.getElementById('videoUrl').value = revision.videoUrl || '';
  document.getElementById('githubUrl').value = revision.githubUrl || '';
  document.getElementById('websiteUrl').value = revision.websiteUrl || '';
  document.getElementById('provenanceUrl').value = project.provenanceUrl || '';
  
  updatePreview();
}

function setupPreview() {
  const inputs = ['title', 'description', 'videoUrl', 'githubUrl', 'websiteUrl'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', updatePreview);
  });
}

function updatePreview() {
  const title = document.getElementById('title').value;
  document.getElementById('project-header').querySelector('h2').textContent = title || 'Your Project';
  
  const description = document.getElementById('description').value;
  document.getElementById('preview-description-text').textContent = description || 'No description yet...';
  
  const videoUrl = document.getElementById('videoUrl').value;
  const videoContainer = document.getElementById('video-preview-container');
  const videoLink = document.getElementById('preview-video-link');
  
  if (videoUrl) {
    const videoIdMatch = videoUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (videoIdMatch) {
      videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoIdMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
      videoContainer.classList.remove('hidden');
      videoLink.classList.add('hidden');
    } else {
      videoContainer.classList.add('hidden');
      videoLink.href = videoUrl;
      videoLink.classList.remove('hidden');
    }
  } else {
    videoContainer.classList.add('hidden');
    videoContainer.innerHTML = '';
    videoLink.classList.add('hidden');
  }
  
  const githubUrl = document.getElementById('githubUrl').value;
  const githubLink = document.getElementById('preview-github-link');
  if (githubUrl) {
    githubLink.href = githubUrl;
    githubLink.classList.remove('hidden');
  } else {
    githubLink.classList.add('hidden');
  }
  
  const websiteUrl = document.getElementById('websiteUrl').value;
  const websiteLink = document.getElementById('preview-website-link');
  if (websiteUrl) {
    websiteLink.href = websiteUrl;
    websiteLink.classList.remove('hidden');
  } else {
    websiteLink.classList.add('hidden');
  }
}

document.getElementById('pitch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    videoUrl: document.getElementById('videoUrl').value,
    githubUrl: document.getElementById('githubUrl').value,
    websiteUrl: document.getElementById('websiteUrl').value,
    provenanceUrl: document.getElementById('provenanceUrl').value
  };
  
  let res;
  if (projectId && revisionId) {
    // Update existing revision - need to add new revision
    res = await fetch(`/api/projects/${projectId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
  } else if (projectId) {
    // Add new revision to existing project
    res = await fetch(`/api/projects/${projectId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
  } else {
    // Create new project
    res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
  }
  
  if (res.ok) {
    const result = await res.json();
    // Go to project page
    window.location.href = `/project/${projectId || result.id}`;
  } else {
    const err = await res.json();
    alert('Failed to save: ' + (err.error || 'Unknown error'));
  }
});

init();