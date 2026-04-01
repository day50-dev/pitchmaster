let currentUser = null;
let deleteModalInstance = null;

async function init() {
  await loadUser();
  deleteModalInstance = new bootstrap.Modal(document.getElementById('delete-modal'));
}

async function loadUser() {
  const res = await fetch('/api/me');
  currentUser = await res.json();

  // Update header dropdown
  const avatarNav = document.getElementById('user-avatar-nav');
  const nameNav = document.getElementById('user-name-nav');
  const dropdownToggle = document.getElementById('user-dropdown-toggle');
  const dropdownMenu = document.getElementById('user-dropdown-menu');
  const logoutBtn = document.getElementById('logout-btn');
  
  if (avatarNav) {
    avatarNav.src = currentUser.avatarUrl || 'https://github.com/ghost.png';
    avatarNav.alt = currentUser.displayName || currentUser.username;
  }
  if (nameNav) {
    nameNav.textContent = currentUser.displayName || currentUser.username;
  }
  
  // Update settings page
  document.getElementById('settings-username').textContent = '@' + (currentUser.username || 'user');
  document.getElementById('settings-display-name').textContent = currentUser.displayName || currentUser.username;
  
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
  
  // Delete account handler
  document.getElementById('delete-account-btn')?.addEventListener('click', () => {
    deleteModalInstance.show();
  });
  
  // Confirm delete handler
  document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
    const confirmInput = document.getElementById('confirm-username');
    if (confirmInput.value !== currentUser.username) {
      alert('Username does not match. Please type your username exactly.');
      return;
    }
    
    try {
      const res = await fetch('/api/me/account', { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const err = await res.json();
        alert('Failed to delete account: ' + (err.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to delete account');
    }
  });
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

init();
