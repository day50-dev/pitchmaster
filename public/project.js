// Get project ID and optional revision number from URL
const pathParts = window.location.pathname.split('/').filter(p => p);
const projectId = pathParts.find(p => !isNaN(p));
const urlParams = new URLSearchParams(window.location.search);
const requestedRevisionNum = urlParams.get('rev');

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
  document.getElementById('project-author').innerHTML = `by <a href="/profile/${project.userId}">${project.displayName || project.username}</a>`;
  if (project.provenanceUrl) {
    document.getElementById('project-provenance').textContent = `from ${project.provenanceUrl}`;
  }
  
  // Show revision tabs
  renderRevisionTabs();
  
  // Select requested revision (from ?rev=N param) or default to latest
  let revToSelect;
  if (requestedRevisionNum) {
    revToSelect = project.revisions.find(r => r.revisionNumber == requestedRevisionNum);
  }
  if (!revToSelect && project.revisions.length > 0) {
    revToSelect = project.revisions[0];
  }
  if (revToSelect) {
    selectRevision(revToSelect);
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
    <a href="/project/${project.id}?rev=${rev.revisionNumber}" class="revision-tab ${currentRevision && currentRevision.id === rev.id ? 'active' : ''}">
      Revision ${rev.revisionNumber}
      <span class="response-count">${rev.responseCount || 0} responses</span>
    </a>
  `).join('');
  
  // Revision tabs are now links - no click handlers needed
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
  const descriptionText = escapeHtml(revision.description || '');
  document.getElementById('revision-description-text').innerHTML = descriptionText.replace(/\n\n/g, '</p><p class="mb-3">').replace(/\n/g, '<br>');

  // Update story
  const storySection = document.getElementById('revision-story-section');
  const storyText = document.getElementById('revision-story-text');
  if (revision.story) {
    const formattedStory = escapeHtml(revision.story).replace(/\n\n/g, '</p><p class="mb-3">').replace(/\n/g, '<br>');
    storyText.innerHTML = `<p class="mb-3">${formattedStory}</p>`;
    storySection.classList.remove('hidden');
  } else {
    storySection.classList.add('hidden');
  }
  
  // Update form action
  document.getElementById('response-form').dataset.revisionId = revision.id;
}

function renderResponses() {
  const responsesList = document.getElementById('responses-list');
  document.getElementById('response-count').textContent = currentRevision ? currentRevision.responses.length : 0;
  
  if (!currentRevision || !currentRevision.responses || currentRevision.responses.length === 0) {
    responsesList.innerHTML = '<p class="no-responses">No descriptions yet. Be the first to describe what you think this is!</p>';
    return;
  }
  
  // Map field names to their corresponding rating field names in the database
  const ratingFieldMap = {
    'whatDoesItDo': 'isCorrectWhatDoesItDo',
    'problemItSolves': 'isCorrectProblem',
    'whoIsItFor': 'isCorrectWhoIsFor',
    'howToUse': 'isCorrectHowToUse'
  };
  
  responsesList.innerHTML = currentRevision.responses.map(resp => {
    // Generate rating buttons for each field (only if the field has content)
    const renderRatingButtons = (fieldName, label, value) => {
      if (!value) return '';
      const ratingField = ratingFieldMap[fieldName];
      const isCorrect = resp[ratingField];
      
      if (isCorrect === null || isCorrect === undefined) {
        return `
          <div class="rating-row">
            <label>${label}</label>
            <div class="rating-buttons">
              <button class="btn btn-rate correct" onclick="rateResponse(${resp.id}, '${fieldName}', 1)">✓</button>
              <button class="btn btn-rate incorrect" onclick="rateResponse(${resp.id}, '${fieldName}', 0)">✗</button>
            </div>
          </div>
        `;
      }
      return `
        <div class="rating-row">
          <label>${label}</label>
          <div class="rating-result ${isCorrect ? 'correct' : 'incorrect'}">
            ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </div>
        </div>
      `;
    };
    
    // Build response fields only if they have content
    let fieldsHtml = '';
    if (resp.whatDoesItDo) {
      fieldsHtml += `<div class="response-field"><label>What does this do?</label><p>${escapeHtml(resp.whatDoesItDo)}</p></div>`;
    }
    if (resp.problemItSolves) {
      fieldsHtml += `<div class="response-field"><label>What problem does it solve?</label><p>${escapeHtml(resp.problemItSolves)}</p></div>`;
    }
    if (resp.whoIsItFor) {
      fieldsHtml += `<div class="response-field"><label>Who is this for?</label><p>${escapeHtml(resp.whoIsItFor)}</p></div>`;
    }
    if (resp.howToUse) {
      fieldsHtml += `<div class="response-field"><label>How do you use it?</label><p>${escapeHtml(resp.howToUse)}</p></div>`;
    }
    
    const ratingsHtml = 
      renderRatingButtons('whatDoesItDo', 'What does this do?', resp.whatDoesItDo) +
      renderRatingButtons('problemItSolves', 'Problem it solves?', resp.problemItSolves) +
      renderRatingButtons('whoIsItFor', 'Who is this for?', resp.whoIsItFor) +
      renderRatingButtons('howToUse', 'How do you use it?', resp.howToUse);
    
    return `
      <div class="response-card">
        <div class="response-author">
          <img src="https://github.com/ghost.png" alt="${escapeHtml(resp.username)}">
          <span>${escapeHtml(resp.displayName || resp.username)}</span>
        </div>
        <div class="response-fields">
          ${fieldsHtml}
        </div>
        <div class="response-ratings">
          ${ratingsHtml}
        </div>
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
    whatDoesItDo: document.getElementById('whatDoesItDo').value,
    problemItSolves: document.getElementById('problemItSolves').value,
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
    document.getElementById('whatDoesItDo').value = '';
    document.getElementById('problemItSolves').value = '';
    document.getElementById('whoIsItFor').value = '';
    document.getElementById('howToUse').value = '';
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

// Rate a response (hacker marks each answer correct or incorrect)
async function rateResponse(responseId, fieldName, isCorrect) {
  // Map field names to API param names
  const paramMap = {
    'whatDoesItDo': 'isCorrectWhatDoesItDo',
    'problemItSolves': 'isCorrectProblem',
    'whoIsItFor': 'isCorrectWhoIsFor',
    'howToUse': 'isCorrectHowToUse'
  };
  
  const apiParam = paramMap[fieldName];
  const body = {};
  body[apiParam] = isCorrect;
  
  const res = await fetch(`/api/responses/${responseId}/rate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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