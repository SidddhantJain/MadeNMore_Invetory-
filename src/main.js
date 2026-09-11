/**
 * Made N More — Main Application Entry
 * App bootstrap, routing, sidebar, global search, keyboard shortcuts
 */

import './styles/main.css';
import { initStore, undo, search } from './data/store.js';
import { seedDatabase } from './data/seed.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderInventory } from './pages/inventory.js';
import { renderOrders } from './pages/orders.js';
import { renderPrinters } from './pages/printers.js';
import { renderTransactions } from './pages/transactions.js';
import { renderCalculator } from './pages/calculator.js';
import { renderSettings } from './pages/settings.js';
import { showToast } from './components/toast.js';
import { ICONS } from './utils/icons.js';
import { debounce, escapeHtml } from './utils/helpers.js';

// ─── Routes ─────────────────────────────────────────────────
const ROUTES = [
  { hash: '#/',              label: 'Dashboard',    icon: 'dashboard',    render: renderDashboard,    section: 'main' },
  { hash: '#/inventory',     label: 'Inventory',    icon: 'inventory',    render: renderInventory,    section: 'main' },
  { hash: '#/orders',        label: 'Orders',       icon: 'order',        render: renderOrders,       section: 'main' },
  { hash: '#/printers',      label: 'Printers',     icon: 'printer',      render: renderPrinters,     section: 'main' },
  { hash: '#/transactions',  label: 'Transactions', icon: 'transactions', render: renderTransactions, section: 'main' },
  { hash: '#/calculator',    label: 'Calculator',   icon: 'calculator',   render: renderCalculator,   section: 'tools' },
  { hash: '#/settings',      label: 'Settings',     icon: 'settings',     render: renderSettings,     section: 'system' },
];

// ─── Sidebar ────────────────────────────────────────────────
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const currentHash = window.location.hash || '#/';

  const mainRoutes = ROUTES.filter(r => r.section === 'main');
  const toolRoutes = ROUTES.filter(r => r.section === 'tools');
  const systemRoutes = ROUTES.filter(r => r.section === 'system');

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">M</div>
      <div class="sidebar-logo-text">
        <h2>Made N More</h2>
        <span>3D Print Manager</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Main</div>
      ${mainRoutes.map(r => `
        <div class="nav-item ${currentHash === r.hash ? 'active' : ''}" data-route="${r.hash}">
          <span class="nav-icon">${ICONS[r.icon] || ''}</span>
          ${r.label}
        </div>
      `).join('')}

      <div class="sidebar-section-label" style="margin-top:var(--space-md);">Tools</div>
      ${toolRoutes.map(r => `
        <div class="nav-item ${currentHash === r.hash ? 'active' : ''}" data-route="${r.hash}">
          <span class="nav-icon">${ICONS[r.icon] || ''}</span>
          ${r.label}
        </div>
      `).join('')}

      <div class="sidebar-section-label" style="margin-top:var(--space-md);">System</div>
      ${systemRoutes.map(r => `
        <div class="nav-item ${currentHash === r.hash ? 'active' : ''}" data-route="${r.hash}">
          <span class="nav-icon">${ICONS[r.icon] || ''}</span>
          ${r.label}
        </div>
      `).join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-footer-info">
        Made N More v1.0<br/>
        <span style="opacity:0.5">Ctrl+K to search • Ctrl+Z to undo</span>
      </div>
    </div>
  `;

  // Bind nav clicks
  sidebar.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      window.location.hash = item.dataset.route;
    });
  });
}

// ─── Router ─────────────────────────────────────────────────
function navigate() {
  const hash = window.location.hash || '#/';
  const route = ROUTES.find(r => r.hash === hash) || ROUTES[0];

  const content = document.getElementById('content');
  if (!content) return;

  // Smooth page transition
  content.style.opacity = '0';
  content.style.transform = 'translateY(8px)';

  setTimeout(() => {
    content.scrollTop = 0;
    route.render(content);
    renderSidebar(); // Update active state

    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    });
  }, 150);
}

// ─── Global Search Modal ────────────────────────────────────
function showGlobalSearch() {
  const root = document.getElementById('modal-root');
  if (!root) return;

  root.innerHTML = `
    <div class="modal-overlay" id="search-overlay" style="align-items:flex-start;padding-top:15vh;">
      <div class="modal" style="max-width:600px;">
        <div style="padding:var(--space-md) var(--space-lg);">
          <div class="search-bar" style="max-width:100%;">
            <span class="search-icon">${ICONS.search}</span>
            <input type="text" id="global-search-input" placeholder="Search filaments, transactions..." style="font-size:1rem;padding:12px 14px 12px 40px;" autofocus />
          </div>
        </div>
        <div id="global-search-results" style="max-height:400px;overflow-y:auto;padding:0 var(--space-lg) var(--space-lg);"></div>
      </div>
    </div>
  `;

  const overlay = root.querySelector('#search-overlay');
  const input = root.querySelector('#global-search-input');
  const results = root.querySelector('#global-search-results');

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) root.innerHTML = '';
  });

  const doSearch = debounce((q) => {
    if (!q.trim()) { results.innerHTML = ''; return; }
    const res = search(q);
    let html = '';

    if (res.filaments.length > 0) {
      html += `<div class="sidebar-section-label" style="padding:8px 0 4px;">Filaments</div>`;
      res.filaments.slice(0, 5).forEach(f => {
        html += `
          <div class="recent-item" style="cursor:pointer;padding:10px;border-radius:8px;" data-goto="#/inventory">
            <div class="recent-item-left">
              <div class="color-swatch" style="background-color:${f.hex || '#888'};width:24px;height:24px;"></div>
              <div>
                <div class="recent-item-desc">${escapeHtml(f.name)}</div>
                <div class="recent-item-date">${f.material} • ${f.spools} spool(s)</div>
              </div>
            </div>
          </div>
        `;
      });
    }

    if (res.transactions.length > 0) {
      html += `<div class="sidebar-section-label" style="padding:8px 0 4px;">Transactions</div>`;
      res.transactions.slice(0, 5).forEach(t => {
        html += `
          <div class="recent-item" style="cursor:pointer;padding:10px;border-radius:8px;" data-goto="#/transactions">
            <div class="recent-item-left">
              <div class="recent-item-icon ${t.type}" style="width:24px;height:24px;font-size:0.7rem;">${t.type === 'sale' ? '↑' : '↓'}</div>
              <div>
                <div class="recent-item-desc">${escapeHtml(t.description)}</div>
                <div class="recent-item-date">${t.category || ''}</div>
              </div>
            </div>
          </div>
        `;
      });
    }

    if (!html) {
      html = '<div class="text-muted text-center" style="padding:20px;font-size:0.85rem;">No results found</div>';
    }

    results.innerHTML = html;

    // Bind result clicks
    results.querySelectorAll('[data-goto]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = el.dataset.goto;
        root.innerHTML = '';
      });
    });
  }, 200);

  input?.addEventListener('input', (e) => doSearch(e.target.value));
  input?.focus();

  // Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      root.innerHTML = '';
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ─── Keyboard Shortcuts ─────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K / Cmd+K — Global search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      showGlobalSearch();
    }

    // Ctrl+Z / Cmd+Z — Undo (only when not in an input)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isInputFocused()) {
      e.preventDefault();
      const undone = undo();
      if (undone) {
        showToast(`Undone: ${undone.action} in ${undone.collection}`, 'info');
        navigate(); // Re-render
      }
    }

    // Quick nav: 1-5
    if (e.altKey && !isInputFocused()) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= ROUTES.length) {
        e.preventDefault();
        window.location.hash = ROUTES[num - 1].hash;
      }
    }
  });
}

function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

// ─── Initialize ─────────────────────────────────────────────
function init() {
  // Initialize data store
  initStore();

  // Seed on first run
  seedDatabase();

  // Render sidebar
  renderSidebar();

  // Set up routing
  window.addEventListener('hashchange', navigate);
  if (!window.location.hash) window.location.hash = '#/';
  navigate();

  // Keyboard shortcuts
  initKeyboardShortcuts();

  console.log('%c Made N More %c v1.0 ', 
    'background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: white; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
    'background: #1a1a2e; color: #8b5cf6; padding: 4px 8px; border-radius: 0 4px 4px 0;'
  );
}

init();
