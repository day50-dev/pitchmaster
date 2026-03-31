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
  
  // Update video - embed YouTube
  const videoContainer = document.getElementById('video-embed-container');
  const videoLink = document.getElementById('revision-video');
  const githubLink = document.getElementById('revision-github');
  const websiteLink = document.getElementById('revision-website');
  
  if (revision.videoUrl) {
    // Extract video ID and embed
    const videoIdMatch = revision.videoUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      videoContainer.classList.remove('hidden');
      videoLink.classList.add('hidden'); // Hide link when embed is shown
    } else {
      videoContainer.classList.add('hidden');
      videoContainer.innerHTML = '';
      videoLink.href = revision.videoUrl;
      videoLink.classList.remove('hidden');
    }
  } else {
    videoContainer.classList.add('hidden');
    videoContainer.innerHTML = '';
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
    responsesList.innerHTML = '<p class="no-responses">No responses yet. Be the first to describe what you think this is!</p>';
    return;
  }
  
  responsesList.innerHTML = currentRevision.responses.map(resp => {
    const isCorrect = resp.isCorrect;
    const ratingButtons = isCorrect === null ? `
      <div class="rating-buttons">
        <button class="btn btn-rate correct" onclick="rateResponse(${resp.id}, 1)">✓ Correct</button>
        <button class="btn btn-rate incorrect" onclick="rateResponse(${resp.id}, 0)">✗ Incorrect</button>
      </div>
    ` : `
      <div class="rating-result ${isCorrect ? 'correct' : 'incorrect'}">
        ${isCorrect ? '✓ Marked as correct' : '✗ Marked as incorrect'}
      </div>
    `;
    
    return `
      <div class="response-card">
        <div class="response-author">
          <img src="https://github.com/ghost.png" alt="${escapeHtml(resp.username)}">
          <span>${escapeHtml(resp.displayName || resp.username)}</span>
        </div>
        <div class="response-content">
          <p>${escapeHtml(resp.description)}</p>
        </div>
        ${ratingButtons}
      </div>
    `;
  }).join('');
}

// Form step navigation for progressive disclosure (project page)
document.querySelectorAll('#response-form, #revision-form').forEach(form => {
  form.addEventListener('click', (e) => {
    if (e.target.classList.contains('next-step')) {
      const currentStep = form.querySelector('.form-step.active');
      const nextStep = currentStep.nextElementSibling;
      if (nextStep && nextStep.classList.contains('form-step')) {
        currentStep.classList.remove('active');
        nextStep.classList.add('active');
      }
    } else if (e.target.classList.contains('prev-step')) {
      const currentStep = form.querySelector('.form-step.active');
      const prevStep = currentStep.previousElementSibling;
      if (prevStep && prevStep.classList.contains('form-step')) {
        currentStep.classList.remove('active');
        prevStep.classList.add('active');
      }
    }
  });
});

// Reset form steps when section collapses
document.getElementById('audience-section').addEventListener('click', (e) => {
  if (e.target.classList.contains('toggle-icon') || e.target.closest('.audience-header')) {
    setTimeout(() => {
      const section = document.getElementById('audience-section');
      if (section.classList.contains('collapsed')) {
        section.querySelectorAll('.form-step').forEach((step, i) => {
          step.classList.toggle('active', i === 0);
        });
      }
    }, 300);
  }
});

document.getElementById('add-revision-section').addEventListener('click', (e) => {
  if (e.target.classList.contains('toggle-icon') || e.target.closest('.add-revision-header')) {
    setTimeout(() => {
      const section = document.getElementById('add-revision-section');
      if (section.classList.contains('collapsed')) {
        section.querySelectorAll('.form-step').forEach((step, i) => {
          step.classList.toggle('active', i === 0);
        });
      }
    }, 300);
  }
});

// Response form handler
document.getElementById('response-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const revisionId = currentRevision.id;
  const data = {
    description: document.getElementById('description').value
  };
  
  const res = await fetch(`/api/revisions/${revisionId}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    // Clear form and reset steps
    document.getElementById('response-form').reset();
    document.querySelectorAll('#response-form .form-step').forEach((step, i) => {
      step.classList.toggle('active', i === 0);
    });
    // Collapse the section
    document.getElementById('audience-section').classList.add('collapsed');
    // Reload project to get updated responses
    await loadProject();
    // Re-select current revision and render responses
    if (currentRevision) {
      const rev = project.revisions.find(r => r.id === currentRevision.id);
      selectRevision(rev);
      renderResponses();
    }
  } else {
    const err = await res.json();
    alert('Failed to submit response: ' + (err.error || 'Unknown error'));
  }
});

// Reset form steps after submission and close
async function resetFormSteps() {
  // Collapse sections and reset forms
  const audienceSection = document.getElementById('audience-section');
  const revisionSection = document.getElementById('add-revision-section');
  
  audienceSection.classList.add('collapsed');
  revisionSection.classList.add('collapsed');
  
  // Reset step positions
  audienceSection.querySelectorAll('.form-step').forEach((step, i) => {
    step.classList.toggle('active', i === 0);
  });
  revisionSection.querySelectorAll('.form-step').forEach((step, i) => {
    step.classList.toggle('active', i === 0);
  });
}

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
    // Reset form and collapse section
    document.getElementById('revision-form').reset();
    await resetFormSteps();
    // Reload project
    await loadProject();
  } else {
    const err = await res.json();
    alert('Failed to add revision: ' + (err.error || 'Unknown error'));
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rate a response (hacker marks it correct or incorrect)
async function rateResponse(responseId, isCorrect) {
  const res = await fetch(`/api/responses/${responseId}/rate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCorrect })
  });
  
  if (res.ok) {
    // Reload to show updated ratings
    await loadProject();
    if (currentRevision) {
      const rev = project.revisions.find(r => r.id === currentRevision.id);
      selectRevision(rev);
      renderResponses();
    }
  } else {
    const err = await res.json();
    alert('Failed to rate: ' + (err.error || 'Unknown error'));
  }
}

init();