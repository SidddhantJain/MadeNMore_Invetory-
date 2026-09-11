/**
 * Made N More — Modal Component
 * Reusable modal dialog system
 */

let _currentOnConfirm = null;

export function showModal({ title, body, confirmText = 'Confirm', confirmClass = 'btn-primary', modalClass = '', onConfirm, onReady }) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  _currentOnConfirm = onConfirm;

  root.innerHTML = `
    <div class="modal-overlay ${modalClass}" id="modal-overlay">
      <div class="modal ${modalClass}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="modal-close-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
          <button class="btn ${confirmClass}" id="modal-confirm-btn">${confirmText}</button>
        </div>
      </div>
    </div>
  `;

  // Bind events
  root.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
  root.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);
  root.querySelector('#modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  root.querySelector('#modal-confirm-btn')?.addEventListener('click', () => {
    if (_currentOnConfirm) _currentOnConfirm();
  });

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Focus first input
  setTimeout(() => {
    const firstInput = root.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    if (onReady) onReady();
  }, 100);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  _currentOnConfirm = null;
}
