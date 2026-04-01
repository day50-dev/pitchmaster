async function init() {
  await loadAuth();
  await loadNotifications();
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

async function loadNotifications() {
  const res = await fetch('/api/me/notifications');
  const notifications = await res.json();
  
  renderNotifications(notifications);
  updateNotificationBadge(notifications);
}

function renderNotifications(notifications) {
  const list = document.getElementById('notifications-list');
  const noNotifications = document.getElementById('no-notifications');
  
  if (notifications.length === 0) {
    list.classList.add('hidden');
    noNotifications.classList.remove('hidden');
    return;
  }
  
  list.classList.remove('hidden');
  noNotifications.classList.add('hidden');
  
  list.innerHTML = notifications.map(n => `
    <div class="notification-card ${n.isRead ? 'read' : 'unread'}" data-id="${n.id}">
      <div class="notification-content">
        <div class="notification-icon">${getNotificationIcon(n.type)}</div>
        <div class="notification-body">
          <h4 class="notification-title">${escapeHtml(n.title)}</h4>
          <p class="notification-message">${escapeHtml(n.message)}</p>
          <span class="notification-time">${timeAgo(new Date(n.createdAt))}</span>
        </div>
      </div>
      <div class="notification-actions">
        ${n.url ? `<a href="${escapeHtml(n.url)}" class="btn btn-sm btn-primary">View</a>` : ''}
        ${!n.isRead ? `<button class="btn btn-sm btn-secondary" onclick="markAsRead(${n.id})">Mark read</button>` : ''}
      </div>
    </div>
  `).join('');
}

function getNotificationIcon(type) {
  switch(type) {
    case 'response': return '💬';
    case 'rating': return '✓';
    case 'mention': return '@';
    default: return '🔔';
  }
}

function updateNotificationBadge(notifications) {
  const badge = document.getElementById('notification-badge');
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function markAsRead(notificationId) {
  await fetch(`/api/me/notifications/${notificationId}/read`, { method: 'PATCH' });
  loadNotifications();
}

document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
  await fetch('/api/me/notifications/read-all', { method: 'POST' });
  loadNotifications();
});

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

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
