// Import page functionality - unified interface for projects and usernames

let importedData = null;
let profileProjects = [];
let importModalInstance = null;

async function init() {
  importModalInstance = new bootstrap.Modal(document.getElementById('import-modal'));

  // Unified import form handler
  document.getElementById('import-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('devpost-input').value.trim();
    const status = document.getElementById('import-status');
    const btn = document.getElementById('import-btn');

    if (!input) {
      status.innerHTML = '<p class="error">Please enter a URL or username</p>';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Importing...';
    status.innerHTML = '<p class="loading">Fetching from Devpost...</p>';

    try {
      // Check if it's a URL or username
      const isProjectUrl = input.match(/devpost\.com\/software\//i);
      const isProfileUrl = input.match(/devpost\.com\/(?!software\/)/i);
      
      let res, data;
      
      if (isProjectUrl || isProfileUrl) {
        // It's a URL - determine if project or profile
        if (isProjectUrl) {
          res = await fetch('/api/import/devpost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: input })
          });
          data = await res.json();
          showProjectPreview(data);
        } else {
          // Extract username from profile URL
          const usernameMatch = input.match(/devpost\.com\/([^/?#]+)/i);
          if (usernameMatch) {
            await loadProfile(usernameMatch[1]);
          }
        }
      } else {
        // It's a username
        await loadProfile(input);
      }

      if (res && !res.ok) {
        const err = await res.json();
        status.innerHTML = `<p class="error">${err.error || 'Import failed'}</p>`;
      }
    } catch (err) {
      status.innerHTML = `<p class="error">Failed to import: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import';
    }
  });

  // Save single project
  document.getElementById('save-import-btn')?.addEventListener('click', async () => {
    if (!importedData) return;
    await saveProject(importedData);
  });

  // Edit single project
  document.getElementById('edit-import-btn')?.addEventListener('click', () => {
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('import-form').querySelector('input').disabled = false;
  });

  // Profile import handlers
  document.getElementById('select-all-btn')?.addEventListener('click', () => {
    const checkboxes = document.getElementById('project-select-list').querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(c => c.checked = true);
  });

  document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
    const checkboxes = document.getElementById('project-select-list').querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(c => c.checked = false);
  });

  document.getElementById('import-selected-btn')?.addEventListener('click', async () => {
    await importSelectedProjects();
  });

  // Modal form handlers (for homepage import button)
  document.getElementById('modal-import-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('modal-devpost-url').value;
    const btn = document.getElementById('modal-import-btn');

    btn.disabled = true;
    btn.textContent = 'Importing...';

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
      showModalPreview(importedData);
    } catch (err) {
      alert('Failed to import');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Import';
    }
  });

  document.getElementById('modal-save-import-btn')?.addEventListener('click', async () => {
    if (!importedData) return;
    await saveProject(importedData, true);
  });

  document.getElementById('modal-edit-import-btn')?.addEventListener('click', () => {
    document.getElementById('modal-import-preview').classList.add('hidden');
    document.getElementById('modal-import-form').querySelector('.form-step').classList.add('active');
  });
}

async function loadProfile(username) {
  const status = document.getElementById('import-status');
  
  try {
    const res = await fetch('/api/import/devpost/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (!res.ok) {
      const err = await res.json();
      status.innerHTML = `<p class="error">${err.error || 'Failed to fetch profile'}</p>`;
      return;
    }

    const data = await res.json();
    profileProjects = data.projects;
    showProfileProjects(data);
  } catch (err) {
    status.innerHTML = `<p class="error">Failed to fetch profile: ${err.message}</p>`;
  }
}

function showProjectPreview(data) {
  importedData = data;
  document.getElementById('import-preview').classList.remove('hidden');
  document.getElementById('import-status').innerHTML = '';
  document.getElementById('import-form').querySelector('input').disabled = true;

  document.getElementById('preview-title').textContent = data.title || 'Untitled';
  document.getElementById('preview-description').textContent = data.description ? 
    (data.description.substring(0, 200) + (data.description.length > 200 ? '...' : '')) : 'No description';

  document.getElementById('preview-github').textContent = data.githubUrl ? 'GitHub' : '';
  document.getElementById('preview-github').style.display = data.githubUrl ? 'inline-block' : 'none';

  document.getElementById('preview-video').textContent = data.videoUrl ? 'Video' : '';
  document.getElementById('preview-video').style.display = data.videoUrl ? 'inline-block' : 'none';

  document.getElementById('preview-website').textContent = data.websiteUrl ? 'Site' : '';
  document.getElementById('preview-website').style.display = data.websiteUrl ? 'inline-block' : 'none';
}

function showProfileProjects(data) {
  document.getElementById('profile-user-name').textContent = data.displayName || data.username;
  document.getElementById('profile-count').textContent = data.projects.length;

  document.getElementById('project-select-list').innerHTML = data.projects.map((p, i) => `
    <div class="project-select-item">
      <label>
        <input type="checkbox" value="${i}" checked>
        <span class="project-select-title">${escapeHtml(p.title || p.url)}</span>
        <span class="project-select-url">${escapeHtml(p.url)}</span>
      </label>
    </div>
  `).join('');

  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('profile-preview').classList.remove('hidden');
  document.getElementById('import-status').innerHTML = '';
  document.getElementById('import-form').querySelector('input').disabled = true;
}

async function importSelectedProjects() {
  const checkboxes = document.getElementById('project-select-list').querySelectorAll('input[type="checkbox"]:checked');
  const selectedProjects = Array.from(checkboxes).map(c => profileProjects[c.value]);

  if (selectedProjects.length === 0) {
    alert('Please select at least one project');
    return;
  }

  document.getElementById('profile-preview').classList.add('hidden');
  document.getElementById('import-progress').classList.remove('hidden');

  const progressFill = document.getElementById('progress-fill');
  const importStatus = document.getElementById('import-status');

  let successCount = 0;
  const total = selectedProjects.length;

  for (let i = 0; i < total; i++) {
    const project = selectedProjects[i];
    importStatus.textContent = `Importing ${i + 1} of ${total}: ${project.title || project.url}`;
    progressFill.style.width = `${((i) / total) * 100}%`;

    try {
      const res = await fetch('/api/import/devpost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: project.url })
      });

      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const saveRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          story: data.story,
          imageUrl: data.imageUrl,
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

    progressFill.style.width = `${((i + 1) / total) * 100}%`;
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  importStatus.textContent = `Successfully imported ${successCount} of ${total} projects`;

  setTimeout(() => {
    document.getElementById('import-progress').classList.add('hidden');
    document.getElementById('import-form').querySelector('input').value = '';
    document.getElementById('import-form').querySelector('input').disabled = false;
    document.getElementById('profile-preview').classList.add('hidden');
    window.location.href = '/';
  }, 1500);
}

async function saveProject(data, isModal = false) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      story: data.story,
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
      githubUrl: data.githubUrl,
      websiteUrl: data.websiteUrl,
      provenanceUrl: data.provenanceUrl || ''
    })
  });

  if (res.ok) {
    const result = await res.json();
    if (isModal) {
      importModalInstance.hide();
      document.getElementById('modal-import-preview').classList.add('hidden');
      document.getElementById('modal-import-form').querySelector('.form-step').classList.add('active');
    } else {
      document.getElementById('import-preview').classList.add('hidden');
      document.getElementById('import-form').querySelector('input').disabled = false;
    }
    window.location.href = `/project/${result.id}`;
  } else {
    const err = await res.json();
    alert('Failed to save project: ' + (err.error || res.statusText));
  }
}

function showModalPreview(data) {
  document.getElementById('modal-import-form').querySelector('.form-step').classList.remove('active');
  document.getElementById('modal-import-preview').classList.remove('hidden');

  document.getElementById('modal-preview-title').textContent = data.title || 'Untitled';
  document.getElementById('modal-preview-description').textContent = data.description ?
    (data.description.substring(0, 200) + (data.description.length > 200 ? '...' : '')) : 'No description';

  document.getElementById('modal-preview-github').textContent = data.githubUrl ? 'GitHub' : '';
  document.getElementById('modal-preview-github').style.display = data.githubUrl ? 'inline-block' : 'none';
  document.getElementById('modal-preview-video').textContent = data.videoUrl ? 'Video' : '';
  document.getElementById('modal-preview-video').style.display = data.videoUrl ? 'inline-block' : 'none';
  document.getElementById('modal-preview-website').textContent = data.websiteUrl ? 'Site' : '';
  document.getElementById('modal-preview-website').style.display = data.websiteUrl ? 'inline-block' : 'none';
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
