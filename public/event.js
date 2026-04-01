const pathParts = window.location.pathname.split('/').filter(p => p);
const eventId = pathParts.find(p => !isNaN(p));

let event = null;
let meetupModalInstance = null;

async function init() {
  await loadAuth();
  await loadEvent();
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

async function loadEvent() {
  const res = await fetch(`/api/hackathons/${eventId}`);
  if (!res.ok) {
    document.getElementById('event-title').textContent = 'Event not found';
    return;
  }

  event = await res.json();

  // Update page title
  document.title = `${event.title} - Pitch///asters`;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${event.title} - Pitch///asters`);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', event.description || '');
  if (event.imageUrl) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', event.imageUrl);
  }

  // Update header
  document.getElementById('event-title').textContent = event.title;
  document.getElementById('event-description').textContent = event.description || '';
  
  if (event.imageUrl) {
    document.getElementById('event-cover').style.backgroundImage = `url('${event.imageUrl}')`;
  }
  
  if (event.startDate) {
    const startDate = new Date(event.startDate).toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    const endDate = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', { 
      hour: 'numeric',
      minute: '2-digit'
    }) : '';
    document.getElementById('event-date').textContent = endDate ? `${startDate} - ${endDate}` : startDate;
  }
  
  if (event.url) {
    document.getElementById('event-luma-link').href = event.url;
  }
  
  document.getElementById('attendee-count').textContent = event.attendeeCount || 0;
  
  // Load attendees and meetups
  loadAttendees();
  loadMeetups();
}

async function loadAttendees() {
  const res = await fetch(`/api/hackathons/${eventId}/attendees`);
  const attendees = await res.json();
  
  document.getElementById('attendees-count').textContent = attendees.length;
  
  if (attendees.length === 0) {
    document.getElementById('attendees-list').innerHTML = '<p class="empty-state">No attendees yet. Be the first!</p>';
    return;
  }
  
  document.getElementById('attendees-list').innerHTML = attendees.map(a => `
    <div class="attendee-card">
      <img src="${a.avatarUrl || 'https://github.com/ghost.png'}" alt="${a.displayName}">
      <div class="attendee-info">
        <strong>${escapeHtml(a.displayName || a.username)}</strong>
        <span class="attendee-username">@${escapeHtml(a.username)}</span>
      </div>
    </div>
  `).join('');
}

async function loadMeetups() {
  const res = await fetch(`/api/hackathons/${eventId}/meetups`);
  const meetups = await res.json();
  renderMeetups(meetups);
}

function renderMeetups(meetups) {
  if (meetups.length === 0) {
    document.getElementById('meetups-list').innerHTML = '<p class="empty-state">No meetups yet. Add one!</p>';
    return;
  }

  document.getElementById('meetups-list').innerHTML = meetups.map(m => `
    <div class="meetup-card">
      <div class="meetup-header">
        <div class="meetup-author">
          <img src="${m.avatarUrl || 'https://github.com/ghost.png'}" alt="${m.displayName}">
          <strong>${escapeHtml(m.displayName || m.username)}</strong>
        </div>
        <span class="meetup-time">${timeAgo(new Date(m.createdAt))}</span>
      </div>
      ${m.location ? `<p class="meetup-location">📍 ${escapeHtml(m.location)}</p>` : ''}
      ${m.comment ? `<p class="meetup-comment">${escapeHtml(m.comment)}</p>` : ''}
    </div>
  `).join('');
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';
  return 'Just now';
}

// Attend button handler
document.getElementById('event-attend-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('event-attend-btn');
  
  try {
    const res = await fetch(`/api/hackathons/${eventId}/attend`, { method: 'POST' });
    if (res.ok) {
      btn.textContent = 'Going!';
      btn.disabled = true;
      document.getElementById('attendee-count').textContent = parseInt(document.getElementById('attendee-count').textContent) + 1;
      loadAttendees();
    }
  } catch (err) {
    alert('Failed to mark attendance');
  }
});

// Meetup modal handlers
document.getElementById('add-meetup-btn')?.addEventListener('click', () => {
  meetupModalInstance = new bootstrap.Modal(document.getElementById('meetup-modal'));
  meetupModalInstance.show();
});

document.getElementById('meetup-modal')?.addEventListener('hidden.bs.modal', () => {
  document.getElementById('meetup-form').reset();
  meetupModalInstance = null;
});

document.getElementById('meetup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const location = document.getElementById('meetup-location').value;
  const comment = document.getElementById('meetup-comment').value;

  try {
    const res = await fetch(`/api/hackathons/${eventId}/meetups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, comment })
    });

    if (res.ok) {
      document.getElementById('meetup-form').reset();
      if (meetupModalInstance) {
        meetupModalInstance.hide();
      }
      loadMeetups();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to add meetup');
    }
  } catch (err) {
    alert('Failed to add meetup');
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
