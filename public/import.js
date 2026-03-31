// Import page functionality

async function init() {
  loadAuth();
  
  // Devpost form handler
  document.getElementById('devpost-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('devpost-url').value;
    const status = document.getElementById('devpost-status');
    
    status.innerHTML = '<p class="loading">Importing from Devpost...</p>';
    
    try {
      const res = await fetch('/api/import/devpost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!res.ok) {
        const err = await res.json();
        status.innerHTML = `<p class="error">${err.error || 'Import failed'}</p>`;
        return;
      }
      
      const data = await res.json();
      
      // Fill in the manual form with imported data
      document.getElementById('title').value = data.title || '';
      document.getElementById('description').value = data.description || '';
      document.getElementById('story').value = data.story || '';
      document.getElementById('videoUrl').value = data.videoUrl || '';
      document.getElementById('githubUrl').value = data.githubUrl || '';
      document.getElementById('websiteUrl').value = data.websiteUrl || '';
      document.getElementById('provenanceUrl').value = data.provenanceUrl || url;
      
      status.innerHTML = '<p class="success">Imported! Fill in any remaining details and submit.</p>';
    } catch (err) {
      status.innerHTML = `<p class="error">Failed to import: ${err.message}</p>`;
    }
  });
  
  // Manual form handler
  document.getElementById('manual-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      title: document.getElementById('title').value,
      description: document.getElementById('description').value,
      story: document.getElementById('story').value,
      videoUrl: document.getElementById('videoUrl').value,
      githubUrl: document.getElementById('githubUrl').value,
      websiteUrl: document.getElementById('websiteUrl').value,
      provenanceUrl: document.getElementById('provenanceUrl').value
    };
    
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (res.ok) {
      const result = await res.json();
      window.location.href = `/project/${result.id}`;
    } else {
      const err = await res.json();
      alert('Failed to create project: ' + (err.error || 'Unknown error'));
    }
  });
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

init();