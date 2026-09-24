/**
 * Made N More — Main Application Entry
 * App bootstrap, routing, sidebar, global search, keyboard shortcuts
 */

import './styles/main.css';
import { initStore, undo, search, getSettings, create, getStats } from './data/store.js';
import { seedDatabase, MATERIAL_TYPES } from './data/seed.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderInventory } from './pages/inventory.js';
import { renderOrders } from './pages/orders.js';
import { renderPrinters } from './pages/printers.js';
import { renderTransactions } from './pages/transactions.js';
import { renderAccounts } from './pages/accounts.js';
import { renderCalculator } from './pages/calculator.js';
import { renderSettings } from './pages/settings.js';
import { showToast } from './components/toast.js';
import { showModal, closeModal } from './components/modal.js';
import { ICONS } from './utils/icons.js';
import { debounce, escapeHtml, formatCurrency } from './utils/helpers.js';
import { openTareCalculatorModal } from './utils/tareCalculator.js';
import { fetchPrinterTelemetry } from './services/moonrakerService.js';

// ─── Routes ─────────────────────────────────────────────────
const ROUTES = [
  { hash: '#/',              label: 'Dashboard',    icon: 'dashboard',    render: renderDashboard,    section: 'main' },
  { hash: '#/inventory',     label: 'Inventory',    icon: 'inventory',    render: renderInventory,    section: 'main' },
  { hash: '#/orders',        label: 'Orders',       icon: 'order',        render: renderOrders,       section: 'main' },
  { hash: '#/printers',      label: 'Printers',     icon: 'printer',      render: renderPrinters,     section: 'main' },
  { hash: '#/transactions',  label: 'Transactions', icon: 'transactions', render: renderTransactions, section: 'main' },
  { hash: '#/accounts',      label: 'Treasury & Accounts', icon: 'account', render: renderAccounts,   section: 'main' },
  { hash: '#/calculator',    label: 'Calculator',   icon: 'calculator',   render: renderCalculator,   section: 'tools' },
  { hash: '#/settings',      label: 'Settings',     icon: 'settings',     render: renderSettings,     section: 'system' },
];

function openLANServerModal() {
  const host = (window.location && window.location.hostname) || '192.168.0.143';
  const port = (window.location && window.location.port) || '3000';
  const lanUrl = `http://${host}:${port}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(lanUrl)}`;

  showModal({
    title: '📱 Mobile & Tablet LAN Server Access',
    body: `
      <div style="text-align:center;padding:12px 0;">
        <div style="background:#fff;padding:16px;border-radius:12px;display:inline-block;margin-bottom:14px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <img src="${qrUrl}" alt="LAN QR" style="width:200px;height:200px;display:block;" />
        </div>
        <div style="font-size:1.15rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;">
          Scan with your Phone / Tablet Camera
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);max-width:400px;margin:0 auto 16px;">
          This system is running as your workshop server. Connect any device to your Wi-Fi and open:
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;max-width:400px;margin:0 auto;">
          <a href="${lanUrl}" target="_blank" style="font-size:0.95rem;color:#4ade80;font-family:monospace;font-weight:700;text-decoration:none;">
            ${lanUrl}
          </a>
          <button class="btn btn-ghost btn-sm" id="btn-copy-lan-url">Copy</button>
        </div>
      </div>
    `,
    confirmText: 'Close',
    onReady: () => {
      document.getElementById('btn-copy-lan-url')?.addEventListener('click', () => {
        navigator.clipboard.writeText(lanUrl).then(() => {
          showToast('Copied LAN Server URL to clipboard!', 'success');
        });
      });
    },
  });
}

// ─── Global Fast Quoter Modal ──────────────────────────────
function openQuickQuoteModal() {
  const settings = getSettings();
  let quoteData = {
    name: 'Quick 3D Prototype',
    material: 'PLA+',
    weight: 60,
    hours: 2.5,
    markup: 30,
    total: 0
  };

  function computeQuote() {
    const costPerKg = (settings.materialCosts && settings.materialCosts[quoteData.material]) || 700;
    const materialCost = (quoteData.weight / 1000) * costPerKg;
    const electricityCost = quoteData.hours * 0.35 * (settings.electricityRate || 8.5);
    const machineWear = quoteData.hours * 25; // ₹25/hr depreciation & maintenance reserve
    const baseCost = materialCost + electricityCost + machineWear;
    const finalPrice = Math.round(baseCost * (1 + quoteData.markup / 100));
    const profit = finalPrice - baseCost;

    quoteData.total = finalPrice;
    return { materialCost, electricityCost, machineWear, baseCost, finalPrice, profit };
  }

  function updateOutput() {
    const res = computeQuote();
    const outEl = document.getElementById('qq-output-container');
    if (!outEl) return;

    outEl.innerHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.84rem;color:var(--text-secondary);">
          <span>Material Cost (${quoteData.weight}g ${quoteData.material}):</span>
          <span style="font-weight:600;color:var(--text-primary);">${formatCurrency(res.materialCost)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.84rem;color:var(--text-secondary);">
          <span>Power & Wear (${quoteData.hours}h):</span>
          <span style="font-weight:600;color:var(--text-primary);">${formatCurrency(res.electricityCost + res.machineWear)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.84rem;color:var(--text-secondary);">
          <span>Net Margin (${quoteData.markup}%):</span>
          <span style="font-weight:600;color:#4ade80;">+${formatCurrency(res.profit)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:10px;margin-top:6px;">
          <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary);">Total Client Price:</span>
          <span style="font-size:1.35rem;font-weight:800;color:#fff;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            ${formatCurrency(res.finalPrice)}
          </span>
        </div>
      </div>
    `;
  }

  showModal({
    title: '⚡ Fast Commercial 3D Print Quoter',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Part / Reference Name</label>
            <input class="form-input" id="qq-part-name" value="${quoteData.name}" />
          </div>
          <div class="form-group">
            <label class="form-label">Material</label>
            <select class="form-select" id="qq-material">
              ${MATERIAL_TYPES.map(m => `<option value="${m}" ${m === quoteData.material ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Part Weight (grams)</label>
            <input class="form-input" type="number" id="qq-weight" min="1" step="1" value="${quoteData.weight}" />
          </div>
          <div class="form-group">
            <label class="form-label">Print Time (hours)</label>
            <input class="form-input" type="number" id="qq-hours" min="0.25" step="0.25" value="${quoteData.hours}" />
          </div>
        </div>

        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <label class="form-label" style="margin:0;">Target Margin (%)</label>
            <span id="qq-markup-label" style="font-size:0.8rem;font-weight:700;color:var(--accent);">${quoteData.markup}%</span>
          </div>
          <input class="form-input" type="range" id="qq-markup" min="10" max="150" step="5" value="${quoteData.markup}" />
        </div>

        <div id="qq-output-container"></div>

        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary flex-1" id="btn-qq-copy-wa">
            📋 Copy WhatsApp Text
          </button>
          <button class="btn btn-primary flex-1" id="btn-qq-create-order">
            🚀 Save as Order
          </button>
        </div>
      </div>
    `,
    confirmText: 'Done',
    onReady: () => {
      updateOutput();

      const nameInput = document.getElementById('qq-part-name');
      const matSelect = document.getElementById('qq-material');
      const weightInput = document.getElementById('qq-weight');
      const hoursInput = document.getElementById('qq-hours');
      const markupInput = document.getElementById('qq-markup');
      const markupLabel = document.getElementById('qq-markup-label');

      const rebind = () => {
        quoteData.name = nameInput?.value || 'Quick 3D Prototype';
        quoteData.material = matSelect?.value || 'PLA+';
        quoteData.weight = parseFloat(weightInput?.value) || 0;
        quoteData.hours = parseFloat(hoursInput?.value) || 0;
        quoteData.markup = parseFloat(markupInput?.value) || 30;
        if (markupLabel) markupLabel.textContent = `${quoteData.markup}%`;
        updateOutput();
      };

      nameInput?.addEventListener('input', rebind);
      matSelect?.addEventListener('change', rebind);
      weightInput?.addEventListener('input', rebind);
      hoursInput?.addEventListener('input', rebind);
      markupInput?.addEventListener('input', rebind);

      document.getElementById('btn-qq-copy-wa')?.addEventListener('click', () => {
        const text = `*Made N More 3D Printing Quote*\n` +
          `──────────────────────────\n` +
          `📦 *Item:* ${quoteData.name}\n` +
          `🧵 *Material:* ${quoteData.material}\n` +
          `⚖️ *Estimated Weight:* ${quoteData.weight}g\n` +
          `⏱️ *Print Duration:* ~${quoteData.hours} hours\n` +
          `💵 *Commercial Quote:* ${formatCurrency(quoteData.total)}\n` +
          `⚡ *Lead Time:* 24-48 Business Hours\n` +
          `──────────────────────────\n` +
          `_Precision Manufactured at Made N More Labs_`;

        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied WhatsApp Quote to clipboard!', 'success');
        });
      });

      document.getElementById('btn-qq-create-order')?.addEventListener('click', () => {
        create('orders', {
          clientName: 'Direct Quote Client',
          phone: '',
          date: new Date().toISOString().split('T')[0],
          deadline: '',
          notes: `Fast Quote for ${quoteData.name} (${quoteData.weight}g, ${quoteData.material})`,
          status: 'quote',
          kanbanStage: 'quote',
          priority: 'standard',
          items: [{
            name: quoteData.name,
            material: quoteData.material,
            color: 'Default',
            quantity: 1,
            unitPrice: quoteData.total,
            subtotal: quoteData.total,
          }],
          subtotal: quoteData.total,
          taxPercent: 0,
          taxAmount: 0,
          shippingCost: 0,
          totalAmount: quoteData.total,
          payments: [],
        });

        closeModal();
        showToast('Created Draft Order from Quote!', 'success');
        window.location.hash = '#/orders';
      });
    }
  });
}

// ─── Executive Top Header ──────────────────────────────────
function renderTopHeader() {
  const header = document.getElementById('top-header');
  if (!header) return;

  header.innerHTML = `
    <div class="top-header-left">
      <div class="top-search-trigger" id="top-search-btn" title="Global Search (Ctrl+K)">
        <span style="font-size:0.95rem;display:flex;align-items:center;">${ICONS.search || '🔍'}</span>
        <span>Search filaments, jobs, orders, spools...</span>
        <span class="top-search-kbd">Ctrl+K</span>
      </div>
    </div>

    <div class="top-header-center">
      <a href="#/printers" class="top-fleet-pill" id="top-fleet-telemetry-pill" title="Click to view Fleet Hub">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px #3b82f6;"></span>
        <span style="font-weight:700;">Snapmaker U1:</span>
        <span id="top-printer-status-text">Online • 192.168.0.144</span>
      </a>
    </div>

    <div class="top-header-right">
      <a href="#/accounts" class="top-action-btn" id="btn-header-treasury" title="Workshop Liquid Treasury & Cash" style="text-decoration:none;">
        <span style="font-size:1rem;">💰</span>
        <span style="font-weight:700;" id="top-treasury-val">${formatCurrency(getStats().totalLiquidCapital || 0)}</span>
      </a>

      <button class="top-action-btn primary" id="btn-quick-quote-header" title="Instant Part Price Estimator">
        <span style="font-size:1rem;">⚡</span>
        <span>Quick Quote</span>
      </button>

      <button class="top-action-btn" id="btn-header-new-order" title="Create New Client Order">
        <span style="font-size:1rem;">📦</span>
        <span>New Order</span>
      </button>

      <button class="top-action-btn" id="btn-header-tare-scale" title="Tare Digital Scale for Spool">
        <span style="font-size:1rem;">⚖️</span>
        <span>Tare Scale</span>
      </button>

      <button class="top-action-btn" id="btn-header-lan-qr" title="Mobile/Tablet QR Access">
        <span style="font-size:1rem;">📱</span>
        <span>LAN</span>
      </button>
    </div>
  `;

  // Bind click handlers
  header.querySelector('#top-search-btn')?.addEventListener('click', showGlobalSearch);
  header.querySelector('#btn-quick-quote-header')?.addEventListener('click', openQuickQuoteModal);
  header.querySelector('#btn-header-new-order')?.addEventListener('click', () => {
    window.location.hash = '#/orders';
    setTimeout(() => {
      document.getElementById('btn-new-order')?.click();
    }, 200);
  });
  header.querySelector('#btn-header-tare-scale')?.addEventListener('click', () => {
    openTareCalculatorModal(null, () => navigate());
  });
  header.querySelector('#btn-header-lan-qr')?.addEventListener('click', openLANServerModal);
}

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
      <img src="/Logo/logo.png" alt="Made N More" style="height:40px;width:auto;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(139,92,246,0.3));" />
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

    <div class="sidebar-footer" style="padding:14px 16px;border-top:1px solid var(--border);">
      <div class="lan-server-badge" id="btn-lan-portal" style="margin-bottom:10px;width:100%;justify-content:center;" title="Click to view Phone/Tablet QR Code">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;"></span>
        <span>LAN: ${(window.location && window.location.hostname) || '192.168.0.143'}:${(window.location && window.location.port) || '3000'}</span>
      </div>
      <div class="sidebar-footer-info">
        Made N More v1.0<br/>
        <span style="opacity:0.5">Ctrl+K search • Ctrl+Z undo</span>
      </div>
    </div>
  `;

  // Bind nav clicks
  sidebar.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      window.location.hash = item.dataset.route;
    });
  });

  // Bind LAN server portal modal
  sidebar.querySelector('#btn-lan-portal')?.addEventListener('click', () => {
    openLANServerModal();
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
      undo().then(undone => {
        if (undone) {
          showToast(`Undone: ${undone.action} in ${undone.collection}`, 'info');
          navigate(); // Re-render
        }
      });
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
async function init() {
  // Initialize data store from REST API
  await initStore();

  // Render executive top header
  renderTopHeader();

  // Render sidebar
  renderSidebar();

  // Set up routing
  window.addEventListener('hashchange', navigate);
  if (!window.location.hash) window.location.hash = '#/';
  navigate();

  // Keyboard shortcuts
  initKeyboardShortcuts();

  // Periodically refresh header printer telemetry
  async function refreshHeaderTelemetry() {
    try {
      const data = await fetchPrinterTelemetry('192.168.0.144', 80);
      const textEl = document.getElementById('top-printer-status-text');
      const pill = document.getElementById('top-fleet-telemetry-pill');
      if (textEl && data) {
        if (data.online) {
          const ext = Math.round(data.extruderTemp || 0);
          const bed = Math.round(data.bedTemp || 0);
          const state = data.printState || 'Online';
          textEl.textContent = `${state} (${ext}°C / ${bed}°C)`;
          if (pill) {
            pill.style.borderColor = data.printState === 'printing' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.4)';
          }
        } else {
          textEl.textContent = '192.168.0.144 (Standby)';
        }
      }
    } catch {
      // Ignore background telemetry errors
    }
  }

  // Initial check & interval every 15s
  refreshHeaderTelemetry();
  setInterval(refreshHeaderTelemetry, 15000);

  console.log('%c Made N More %c v1.0 ', 
    'background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: white; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
    'background: #1a1a2e; color: #8b5cf6; padding: 4px 8px; border-radius: 0 4px 4px 0;'
  );
}

init();

