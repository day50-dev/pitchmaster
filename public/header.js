// Header dropdown and notifications functionality
let currentUser = null;

async function initHeader() {
  await loadAuth();
  loadNotifications();
}

async function loadAuth() {
  try {
    const res = await fetch('/api/me');
    currentUser = await res.json();

    const avatarNav = document.getElementById('user-avatar-nav');
    const nameNav = document.getElementById('user-name-nav');
    const dropdownToggle = document.getElementById('user-dropdown-toggle');
    const dropdownMenu = document.getElementById('user-dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    if (currentUser) {
      if (avatarNav) {
        avatarNav.src = currentUser.avatarUrl || 'https://github.com/ghost.png';
        avatarNav.alt = currentUser.displayName || currentUser.username;
      }
      if (nameNav) {
        nameNav.textContent = currentUser.displayName || currentUser.username;
      }

      // Toggle dropdown
      if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownMenu.classList.toggle('hidden');
        });
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== dropdownToggle) {
          dropdownMenu.classList.add('hidden');
        }
      });

      // Logout handler
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await logout();
        });
      }
    }
  } catch (err) {
    console.error('Failed to load user:', err);
  }
}

async function loadNotifications() {
  try {
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
      } else {
        badge.classList.add('hidden');
        if (navNotification) navNotification.classList.remove('has-unread');
      }
    }
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeader);
} else {
  initHeader();
}
