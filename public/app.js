const authSection = document.getElementById('auth-section');
const projectsList = document.getElementById('projects-list');
const addProjectBtn = document.getElementById('add-project-btn');
const importDevpostBtn = document.getElementById('import-devpost-btn');
const projectModal = document.getElementById('project-modal');
const importModal = document.getElementById('import-modal');

// Hackathon elements
const addHackathonBtn = document.getElementById('add-hackathon-btn');
const hackathonsList = document.getElementById('hackathons-list');
const hackathonModal = document.getElementById('hackathon-modal');
const closeHackathon = document.getElementById('close-hackathon');
const hackathonForm = document.getElementById('hackathon-form');
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
const deselectAllBtn = document.getElementById('deselect-all-btn');
const importSelectedBtn = document.getElementById('import-selected-btn');
const importProgress = document.getElementById('import-progress');

let currentUser = null;
let importedData = null;
let profileProjects = [];

async function checkAuth() {
  const res = await fetch('/api/me');
  currentUser = await res.json();
  loadProjects();
  loadHackathons();
}

async function loadNotifications() {
  const res = await fetch('/api/me/notifications');
  const notifications = await res.json();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const badge = document.getElementById('notification-badge');
  const navNotification = document.getElementById('nav-notifications');
  const notificationIcon = document.getElementById('notification-icon');

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.remove('hidden');
      if (navNotification) navNotification.classList.add('has-unread');
      if (notificationIcon) notificationIcon.style.color = '';
    } else {
      badge.classList.add('hidden');
      if (navNotification) navNotification.classList.remove('has-unread');
    }
  }
}

function renderAuth() {
  if (currentUser) {
    addProjectBtn?.classList.remove('hidden');
    importDevpostBtn?.classList.remove('hidden');
  } else {
    addProjectBtn?.classList.add('hidden');
    importDevpostBtn?.classList.add('hidden');
  }
}

let currentPage = 1;
const projectsPerPage = 15;

async function loadProjects(page = 1) {
  currentPage = page;
  const res = await fetch(`/api/projects?page=${page}&limit=${projectsPerPage}`);
  const data = await res.json();
  renderProjects(data.projects, data.pagination);
}

function renderProjects(projects, pagination) {
  if (projects.length === 0) {
    projectsList.innerHTML = `
      <div class="text-center py-5">
        <p class="text-muted mb-3">No projects yet. ${currentUser ? 'Be the first to add one!' : 'Sign in to add a project.'}</p>
        ${currentUser ? '<button class="btn btn-primary" id="empty-add-btn">Add Project</button>' : ''}
      </div>
    `;
    if (currentUser) {
      document.getElementById('empty-add-btn')?.addEventListener('click', () => new bootstrap.Modal(projectModal).show());
    }
    return;
  }

  let html = '<div class="row g-4">' + projects.map(p => {
    const imageUrl = p.latestImageUrl || 'https://placehold.co/600x400?text=No+Image';
    return `
      <div class="col-12 col-md-6 col-lg-6 col-xl-4">
        <a href="/project/${p.id}" class="text-decoration-none">
          <div class="card h-100 shadow-sm border-0 overflow-hidden card-hover">
            <img src="${escapeHtml(imageUrl)}" class="card-img-top" alt="${escapeHtml(p.title)}" style="height: 180px; object-fit: cover;">
            <div class="card-body">
              <h5 class="card-title mb-2">${escapeHtml(p.title)}</h5>
              <p class="card-text text-muted small mb-3">${escapeHtml(p.latestDescription || '').substring(0, 100)}${(p.latestDescription || '').length > 100 ? '...' : ''}</p>
              <div class="d-flex align-items-center">
                <img src="${p.avatarUrl || 'https://github.com/ghost.png'}" class="rounded-circle me-2" alt="${p.displayName}" width="24" height="24">
                <span class="small text-muted">${p.displayName || p.username}</span>
                <span class="ms-auto badge bg-secondary">Rev ${p.revisionNumber || 1}</span>
              </div>
            </div>
          </div>
        </a>
      </div>
    `;
  }).join('') + '</div>';

  // Add pagination
  if (pagination.totalPages > 1) {
    html += `
      <nav class="pagination-nav mt-4" aria-label="Project pagination">
        <ul class="pagination justify-content-center">
          <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${pagination.page - 1}" aria-label="Previous">
              <span aria-hidden="true">&laquo;</span>
            </a>
          </li>
          ${Array.from({ length: pagination.totalPages }, (_, i) => `
            <li class="page-item ${pagination.page === i + 1 ? 'active' : ''}">
              <a class="page-link" href="#" data-page="${i + 1}">${i + 1}</a>
            </li>
          `).join('')}
          <li class="page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${pagination.page + 1}" aria-label="Next">
              <span aria-hidden="true">&raquo;</span>
            </a>
          </li>
        </ul>
      </nav>
    `;
  }

  projectsList.innerHTML = html;

  // Add pagination click handlers
  projectsList.querySelectorAll('.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(e.target.dataset.page);
      if (page && page !== currentPage) {
        loadProjects(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Project modal handlers - use Bootstrap Modal API
addProjectBtn.addEventListener('click', () => new bootstrap.Modal(projectModal).show());
projectModal.addEventListener('hidden.bs.modal', () => {
  // Reset form steps when modal closes
  projectForm.querySelectorAll('.form-step').forEach((step, i) => {
    step.classList.toggle('active', i === 0);
  });
});

// Form step navigation for progressive disclosure
document.querySelectorAll('form').forEach(form => {
  const steps = form.querySelectorAll('.form-step');
  
  form.addEventListener('click', (e) => {
    if (e.target.classList.contains('next-step')) {
      const currentStep = form.querySelector('.form-step.active');
      const nextStep = currentStep.nextElementSibling;
      if (nextStep && nextStep.classList.contains('form-step')) {
        // Validate current step
        const inputs = currentStep.querySelectorAll('input, textarea');
        let valid = true;
        inputs.forEach(input => {
          if (input.hasAttribute('required') && !input.value.trim()) {
            input.style.borderColor = '#ef4444';
            valid = false;
          } else {
            input.style.borderColor = '';
          }
        });
        if (valid) {
          currentStep.classList.remove('active');
          nextStep.classList.add('active');
        }
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

// Reset form steps when modal closes
[projectModal, importModal, profileImportModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.querySelectorAll('.form-step').forEach((step, i) => {
        step.classList.toggle('active', i === 0);
      });
    }
  });
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
    // Reset steps
    projectForm.querySelectorAll('.form-step').forEach((step, i) => {
      step.classList.toggle('active', i === 0);
    });
    loadProjects();
  } else {
    const err = await res.json();
    alert('Failed to add project: ' + (err.error || res.statusText));
  }
});

// Import modal handlers - use Bootstrap Modal API
importDevpostBtn.addEventListener('click', () => new bootstrap.Modal(importModal).show());
importModal.addEventListener('hidden.bs.modal', () => resetImportForm());

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
  // Hide form, show preview
  importForm.querySelector('.form-step').classList.remove('active');
  
  document.getElementById('preview-title').textContent = data.title || 'Untitled';
  const descEl = document.getElementById('preview-description');
  descEl.textContent = data.description ? (data.description.substring(0, 200) + (data.description.length > 200 ? '...' : '')) : 'No description';
  
  const githubEl = document.getElementById('preview-github');
  githubEl.textContent = data.githubUrl ? 'GitHub' : '';
  githubEl.style.display = data.githubUrl ? 'inline-block' : 'none';
  
  const videoEl = document.getElementById('preview-video');
  videoEl.textContent = data.videoUrl ? 'Video' : '';
  videoEl.style.display = data.videoUrl ? 'inline-block' : 'none';
  
  const websiteEl = document.getElementById('preview-website');
  websiteEl.textContent = data.websiteUrl ? 'Site' : '';
  websiteEl.style.display = data.websiteUrl ? 'inline-block' : 'none';
  
  importPreview.classList.remove('hidden');
}

function resetImportForm() {
  importForm.reset();
  importPreview.classList.add('hidden');
  importedData = null;
  // Reset to step 1
  importForm.querySelector('.form-step').classList.add('active');
}

// Edit import button - go back to edit
document.getElementById('edit-import-btn')?.addEventListener('click', () => {
  importPreview.classList.add('hidden');
  importForm.querySelector('.form-step').classList.add('active');
});

// Save import button handler is now inline in HTML click handler
document.getElementById('save-import-btn').addEventListener('click', async () => {
  if (!importedData) return;

  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: importedData.title,
      description: importedData.description,
      story: importedData.story,
      imageUrl: importedData.imageUrl,
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
    const err = await res.json();
    alert('Failed to save project: ' + (err.error || res.statusText));
  }
});

// Profile import handlers - use Bootstrap Modal API
profileImportBtn.addEventListener('click', () => new bootstrap.Modal(profileImportModal).show());
profileImportModal.addEventListener('hidden.bs.modal', () => resetProfileForm());

profileImportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let username = document.getElementById('devpost-username').value.trim();
  
  // Extract username from URL if full URL was entered
  const urlMatch = username.match(/devpost\.com\/(?:software\/[^/]+\/)?([^/?#]+)/i);
  if (urlMatch) {
    username = urlMatch[1];
  }
  
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
    
    if (!data.projects || data.projects.length === 0) {
      alert('No projects found for this user');
      return;
    }
    
    profileProjects = data.projects;
    showProfileProjects(data);
  } catch (err) {
    console.error('Profile import error:', err);
    alert('Failed to fetch Devpost profile: ' + (err.message || 'Unknown error'));
  } finally {
    btn.textContent = 'Find Projects';
    btn.disabled = false;
  }
});

function showProfileProjects(data) {
  const userNameEl = document.getElementById('profile-user-name');
  const profileCountEl = document.getElementById('profile-count');
  
  if (userNameEl) {
    userNameEl.textContent = data.displayName || data.username;
  }
  if (profileCountEl) {
    profileCountEl.textContent = data.projects.length;
  }

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
  checkboxes.forEach(c => c.checked = true);
});

deselectAllBtn.addEventListener('click', () => {
  const checkboxes = projectSelectList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(c => c.checked = false);
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

// Hackathon functions
async function loadHackathons() {
  const res = await fetch('/api/hackathons/upcoming');
  const hackathons = await res.json();
  await renderHackathons(hackathons);
}

async function renderHackathons(hackathons) {
  if (hackathons.length === 0) {
    hackathonsList.innerHTML = '<p class="empty-state">No upcoming hackathons. Add one from Luma!</p>';
    return;
  }

  // Check attendance for all hackathons
  const attendancePromises = hackathons.map(async h => {
    try {
      const res = await fetch(`/api/hackathons/${h.id}/attendees`);
      const attendees = await res.json();
      return attendees.some(a => a.id === 1); // Demo user ID
    } catch {
      return false;
    }
  });

  const attendanceStatus = await Promise.all(attendancePromises);

  hackathonsList.innerHTML = hackathons.map((h, i) => {
    const startDate = h.startDate ? new Date(h.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
    const isAttending = attendanceStatus[i];
    return `
      <div class="hackathon-card">
        ${h.imageUrl ? `<a href="/events/${h.id}" class="hackathon-image-link"><div class="hackathon-image" style="background-image: url('${escapeHtml(h.imageUrl)}')"></div></a>` : ''}
        <div class="hackathon-info">
          <a href="/events/${h.id}" class="hackathon-link">
            <h3 class="hackathon-title">${escapeHtml(h.title || 'Hackathon')}</h3>
          </a>
          <p class="hackathon-date">${startDate}</p>
          <p class="hackathon-description">${escapeHtml(h.description || '').substring(0, 100)}${(h.description || '').length > 100 ? '...' : ''}</p>
          <div class="hackathon-actions">
            <a href="/events/${h.id}" class="attendee-count">${h.attendeeCount || 0} attending</a>
            <button class="btn btn-small btn-attend ${isAttending ? 'btn-outline-danger' : 'btn-secondary'}" data-id="${h.id}">${isAttending ? 'Cancel' : "I'm going"}</button>
            <button class="btn btn-small btn-meetup" data-id="${h.id}">Add meetup</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add attend button handlers
  hackathonsList.querySelectorAll('.btn-attend').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const isCurrentlyAttending = btn.classList.contains('btn-outline-danger');

      if (isCurrentlyAttending) {
        await fetch(`/api/hackathons/${id}/attend`, { method: 'DELETE' });
      } else {
        await fetch(`/api/hackathons/${id}/attend`, { method: 'POST' });
      }
      loadHackathons();
    });
  });
  
  // Add meetup button handlers
  hackathonsList.querySelectorAll('.btn-meetup').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const meetupModal = document.getElementById('meetup-modal');
      const meetupModalInstance = new bootstrap.Modal(meetupModal);
      meetupModalInstance.show();
      
      // Load meetups for this hackathon
      const meetupsList = document.getElementById('meetups-list');
      const res = await fetch(`/api/hackathons/${id}/meetups`);
      const meetups = await res.json();
      
      if (meetups.length === 0) {
        meetupsList.innerHTML = '<p class="empty-state">No meetups yet. Add one!</p>';
      } else {
        meetupsList.innerHTML = meetups.map(m => `
          <div class="meetup-item">
            <div class="meetup-header">
              <strong>${escapeHtml(m.displayName || m.username)}</strong>
              ${m.location ? `<span class="meetup-location">📍 ${escapeHtml(m.location)}</span>` : ''}
            </div>
            ${m.comment ? `<p class="meetup-comment">${escapeHtml(m.comment)}</p>` : ''}
          </div>
        `).join('');
      }
      
      // Store hackathon ID for form submission
      window.currentHackathonId = id;
    });
  });
}

// Hackathon modal handlers - use Bootstrap Modal API
let hackathonModalInstance = null;
addHackathonBtn?.addEventListener('click', () => {
  hackathonModalInstance = new bootstrap.Modal(hackathonModal);
  hackathonModalInstance.show();
});
hackathonModal.addEventListener('hidden.bs.modal', () => {
  hackathonForm.reset();
  hackathonModalInstance = null;
});

hackathonForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('hackathon-url').value;

  try {
    const res = await fetch('/api/hackathons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (res.ok) {
      hackathonForm.reset();
      if (hackathonModalInstance) {
        hackathonModalInstance.hide();
      }
      loadHackathons();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to add hackathon');
    }
  } catch (err) {
    alert('Failed to add hackathon');
  }
});

// Meetup modal
let currentHackathonId = null;
let meetupModalInstance = null;
const meetupModal = document.getElementById('meetup-modal');
const closeMeetup = document.getElementById('close-meetup');
const meetupForm = document.getElementById('meetup-form');
const meetupsList = document.getElementById('meetups-list');

hackathonsList.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-meetup')) {
    currentHackathonId = e.target.dataset.id;
    meetupModalInstance = new bootstrap.Modal(meetupModal);
    meetupModalInstance.show();
    loadMeetups(currentHackathonId);
  }
});

meetupModal.addEventListener('hidden.bs.modal', () => {
  meetupForm.reset();
  meetupModalInstance = null;
});

async function loadMeetups(hackathonId) {
  const res = await fetch(`/api/hackathons/${hackathonId}/meetups`);
  const meetups = await res.json();
  renderMeetups(meetups);
}

function renderMeetups(meetups) {
  if (meetups.length === 0) {
    meetupsList.innerHTML = '<p class="empty-state">No meetups yet. Add one!</p>';
    return;
  }
  
  meetupsList.innerHTML = meetups.map(m => `
    <div class="meetup-item">
      <div class="meetup-header">
        <strong>${escapeHtml(m.displayName || m.username)}</strong>
        ${m.location ? `<span class="meetup-location">📍 ${escapeHtml(m.location)}</span>` : ''}
      </div>
      ${m.comment ? `<p class="meetup-comment">${escapeHtml(m.comment)}</p>` : ''}
    </div>
  `).join('');
}

meetupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const location = document.getElementById('meetup-location').value;
  const comment = document.getElementById('meetup-comment').value;
  const hackathonId = window.currentHackathonId || currentHackathonId;

  const res = await fetch(`/api/hackathons/${hackathonId}/meetups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, comment })
  });

  if (res.ok) {
    meetupForm.reset();
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('meetup-modal'));
    if (modal) modal.hide();
    // Reload meetups if on event page
    if (window.location.pathname.startsWith('/events/')) {
      location.reload();
    }
  }
});

checkAuth();