let currentUser = null;
let deleteModalInstance = null;

async function init() {
  await loadUser();
  deleteModalInstance = new bootstrap.Modal(document.getElementById('delete-modal'));
}

async function loadUser() {
  const res = await fetch('/api/me');
  currentUser = await res.json();

  // Update settings page
  document.getElementById('settings-username').textContent = '@' + (currentUser.username || 'user');
  document.getElementById('settings-display-name').textContent = currentUser.displayName || currentUser.username;

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

init();
