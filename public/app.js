const authSection = document.getElementById('auth-section');
const projectsList = document.getElementById('projects-list');
const addProjectBtn = document.getElementById('add-project-btn');
const importDevpostBtn = document.getElementById('import-devpost-btn');
const projectModal = document.getElementById('project-modal');
const importModal = document.getElementById('import-modal');
const projectForm = document.getElementById('project-form');
const importForm = document.getElementById('import-form');
const closeModal = document.querySelector('.close-modal');
const closeImport = document.getElementById('close-import');
const importPreview = document.getElementById('import-preview');
const saveImportBtn = document.getElementById('save-import-btn');
const profileImportBtn = document.getElementById('import-profile-btn');
const profileImportModal = document.getElementById('profile-import-modal');
const closeProfileImport = document.getElementById('close-profile-import');
const profileImportForm = document.getElementById('profile-import-form');
const profilePreview = document.getElementById('profile-preview');
const projectSelectList = document.getElementById('project-select-list');
const selectAllBtn = document.getElementById('select-all-btn');
const importSelectedBtn = document.getElementById('import-selected-btn');
const importProgress = document.getElementById('import-progress');

let currentUser = null;
let importedData = null;
let profileProjects = [];

async function checkAuth() {
  const res = await fetch('/api/me');
  currentUser = await res.json();
  renderAuth();
  loadProjects();
}

function renderAuth() {
  if (currentUser) {
    authSection.innerHTML = `
      <div class="user-info">
        <img src="${currentUser.avatarUrl || 'https://github.com/ghost.png'}" alt="${currentUser.displayName}">
        <span>${currentUser.displayName || currentUser.username}</span>
      </div>
      <button class="btn btn-logout" id="logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
    addProjectBtn.classList.remove('hidden');
    importDevpostBtn.classList.remove('hidden');
  } else {
    authSection.innerHTML = `
      <a href="/auth/github" class="btn btn-github">Sign in with GitHub</a>
    `;
    addProjectBtn.classList.add('hidden');
    importDevpostBtn.classList.add('hidden');
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  currentUser = null;
  renderAuth();
}

async function loadProjects() {
  const res = await fetch('/api/projects');
  const projects = await res.json();
  renderProjects(projects);
}

function renderProjects(projects) {
  if (projects.length === 0) {
    projectsList.innerHTML = `
      <div class="empty-state">
        <p>No projects yet. ${currentUser ? 'Be the first to add one!' : 'Sign in to add a project.'}</p>
        ${currentUser ? '<button class="btn btn-primary" id="empty-add-btn">Add Project</button>' : ''}
      </div>
    `;
    if (currentUser) {
      document.getElementById('empty-add-btn')?.addEventListener('click', () => projectModal.classList.remove('hidden'));
    }
    return;
  }

  projectsList.innerHTML = projects.map(p => `
    <a href="/project/${p.id}" class="project-card">
      <div class="project-header">
        <h3 class="project-title">${escapeHtml(p.title)}</h3>
        <div class="project-author">
          <img src="${p.avatarUrl || 'https://github.com/ghost.png'}" alt="${p.displayName}">
          <span>${p.displayName || p.username}</span>
        </div>
      </div>
      <p class="project-description">${escapeHtml(p.latestDescription || '')}</p>
      <div class="project-meta-row">
        <span class="revision-badge">Rev ${p.revisionNumber || 1}</span>
        <span class="response-badge">${p.responseCount || 0} responses</span>
      </div>
      <div class="project-links">
        ${p.latestVideoUrl ? `<span class="project-link youtube">Watch</span>` : ''}
        ${p.latestGithubUrl ? `<span class="project-link github">Code</span>` : ''}
        ${p.latestWebsiteUrl ? `<span class="project-link website">Visit</span>` : ''}
      </div>
    </a>
  `).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Project modal handlers
addProjectBtn.addEventListener('click', () => projectModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => projectModal.classList.add('hidden'));
projectModal.addEventListener('click', (e) => {
  if (e.target === projectModal) projectModal.classList.add('hidden');
});

projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(projectForm);
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    videoUrl: formData.get('videoUrl'),
    githubUrl: formData.get('githubUrl'),
    websiteUrl: formData.get('websiteUrl')
  };

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    projectForm.reset();
    projectModal.classList.add('hidden');
    loadProjects();
  } else {
    alert('Failed to add project');
  }
});

// Import modal handlers
importDevpostBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
closeImport.addEventListener('click', () => {
  importModal.classList.add('hidden');
  resetImportForm();
});
importModal.addEventListener('click', (e) => {
  if (e.target === importModal) {
    importModal.classList.add('hidden');
    resetImportForm();
  }
});

importForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('devpost-url').value;
  const importBtn = document.getElementById('import-btn');
  
  importBtn.textContent = 'Importing...';
  importBtn.disabled = true;

  try {
    const res = await fetch('/api/import/devpost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to import');
      return;
    }
    
    importedData = await res.json();
    showImportPreview(importedData);
  } catch (err) {
    alert('Failed to import from Devpost');
  } finally {
    importBtn.textContent = 'Import';
    importBtn.disabled = false;
  }
});

function showImportPreview(data) {
  document.getElementById('preview-title').textContent = data.title || '(none)';
  document.getElementById('preview-description').textContent = data.description ? (data.description.substring(0, 100) + (data.description.length > 100 ? '...' : '')) : '(none)';
  document.getElementById('preview-github').textContent = data.githubUrl || '(none)';
  document.getElementById('preview-video').textContent = data.videoUrl || '(none)';
  document.getElementById('preview-website').textContent = data.websiteUrl || '(none)';
  importPreview.classList.remove('hidden');
}

function resetImportForm() {
  importForm.reset();
  importPreview.classList.add('hidden');
  importedData = null;
}

saveImportBtn.addEventListener('click', async () => {
  if (!importedData) return;
  
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: importedData.title,
      description: importedData.description,
      videoUrl: importedData.videoUrl,
      githubUrl: importedData.githubUrl,
      websiteUrl: importedData.websiteUrl,
      provenanceUrl: importedData.provenanceUrl || ''
    })
  });

  if (res.ok) {
    const result = await res.json();
    importModal.classList.add('hidden');
    resetImportForm();
    loadProjects();
    // Navigate to project page
    window.location.href = `/project/${result.id}`;
  } else {
    alert('Failed to save project');
  }
});

// Profile import handlers
profileImportBtn.addEventListener('click', () => profileImportModal.classList.remove('hidden'));
closeProfileImport.addEventListener('click', () => {
  profileImportModal.classList.add('hidden');
  resetProfileForm();
});
profileImportModal.addEventListener('click', (e) => {
  if (e.target === profileImportModal) {
    profileImportModal.classList.add('hidden');
    resetProfileForm();
  }
});

profileImportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('devpost-username').value;
  const btn = document.getElementById('profile-import-btn');
  
  btn.textContent = 'Loading...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/import/devpost/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to fetch profile');
      return;
    }
    
    const data = await res.json();
    profileProjects = data.projects;
    showProfileProjects(data);
  } catch (err) {
    alert('Failed to fetch Devpost profile');
  } finally {
    btn.textContent = 'Find Projects';
    btn.disabled = false;
  }
});

function showProfileProjects(data) {
  document.getElementById('profile-user-name').textContent = data.displayName || data.username;
  document.getElementById('profile-count').textContent = data.projects.length;
  
  projectSelectList.innerHTML = data.projects.map((p, i) => `
    <div class="project-select-item">
      <label>
        <input type="checkbox" value="${i}" checked>
        <span class="project-select-title">${escapeHtml(p.title || p.url)}</span>
        <span class="project-select-url">${escapeHtml(p.url)}</span>
      </label>
    </div>
  `).join('');
  
  profilePreview.classList.remove('hidden');
}

function resetProfileForm() {
  profileImportForm.reset();
  profilePreview.classList.add('hidden');
  importProgress.classList.add('hidden');
  profileProjects = [];
}

selectAllBtn.addEventListener('click', () => {
  const checkboxes = projectSelectList.querySelectorAll('input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  checkboxes.forEach(c => c.checked = !allChecked);
});

importSelectedBtn.addEventListener('click', async () => {
  const checkboxes = projectSelectList.querySelectorAll('input[type="checkbox"]:checked');
  const selectedProjects = Array.from(checkboxes).map(c => profileProjects[c.value]);
  
  if (selectedProjects.length === 0) {
    alert('Please select at least one project');
    return;
  }
  
  profilePreview.classList.add('hidden');
  importProgress.classList.remove('hidden');
  
  const progressFill = document.getElementById('progress-fill');
  const importStatus = document.getElementById('import-status');
  
  let successCount = 0;
  const total = selectedProjects.length;
  
  // Sequential import with progress updates (non-blocking)
  for (let i = 0; i < total; i++) {
    const project = selectedProjects[i];
    
    importStatus.textContent = `Importing ${i + 1} of ${total}: ${project.title || project.url}`;
    progressFill.style.width = `${((i) / total) * 100}%`;
    
    try {
      // Fetch project data from Devpost
      const res = await fetch('/api/import/devpost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: project.url })
      });
      
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      
      // Save to database with provenance URL
      const saveRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          videoUrl: data.videoUrl,
          githubUrl: data.githubUrl,
          websiteUrl: data.websiteUrl,
          provenanceUrl: project.url || ''
        })
      });
      
      if (saveRes.ok) successCount++;
    } catch (err) {
      console.error(`Failed to import ${project.url}:`, err);
    }
    
    // Update progress bar
    progressFill.style.width = `${((i + 1) / total) * 100}%`;
    
    // Rate limiting - wait 300ms between requests to avoid IP blocking
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  importStatus.textContent = `Successfully imported ${successCount} of ${total} projects`;
  
  setTimeout(() => {
    profileImportModal.classList.add('hidden');
    resetProfileForm();
    loadProjects();
  }, 1500);
});

checkAuth();