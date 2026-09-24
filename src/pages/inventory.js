/**
 * Made N More — Inventory Page
 * Filament inventory manager with Numakers 3D Spool visualizer, 50x30mm thermal QR labels,
 * and Workshop Consumables & Hardware Tracking (brass inserts, nozzles, IPA, resin)
 */

import { getAll, create, update, remove, duplicate } from '../data/store.js';
import { MATERIAL_TYPES, MATERIAL_BADGES, getSwatchClass } from '../data/seed.js';
import { escapeHtml, debounce, formatCurrency } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { renderNumakersSpool, NUMAKERS_PHOTO_MAP } from '../utils/spoolRenderer.js';
import { openTareCalculatorModal } from '../utils/tareCalculator.js';

let _activeTab = 'filaments'; // filaments | consumables
let _view = 'grid'; // grid | table
let _filterMaterial = '';
let _filterUsable = '';
let _filterConsumableCat = '';
let _searchQuery = '';
let _sortField = 'name';
let _sortDir = 'asc';

const CONSUMABLE_CATEGORIES = [
  'Fasteners & Inserts',
  'Maintenance & Spare Parts',
  'Chemicals & Post-Processing',
  'Tools & Accessories',
];

export function renderInventory(container) {
  render(container);
}

function getFilteredFilaments() {
  let items = getAll('filaments');

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.material?.toLowerCase().includes(q) ||
      f.brand?.toLowerCase().includes(q)
    );
  }
  if (_filterMaterial) {
    items = items.filter(f => f.material === _filterMaterial);
  }
  if (_filterUsable === 'yes') {
    items = items.filter(f => f.usable === true);
  } else if (_filterUsable === 'no') {
    items = items.filter(f => f.usable === false);
  }

  items.sort((a, b) => {
    let valA = a[_sortField] ?? '';
    let valB = b[_sortField] ?? '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return _sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return items;
}

function getFilteredConsumables() {
  let items = getAll('consumables');

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.specs?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q)
    );
  }
  if (_filterConsumableCat) {
    items = items.filter(c => c.category === _filterConsumableCat);
  }

  return items;
}

function render(container) {
  const filaments = getFilteredFilaments();
  const totalSpools = filaments.reduce((s, f) => s + (f.spools || 0), 0);
  const consumables = getFilteredConsumables();
  const lowStockConsumables = consumables.filter(c => (c.stock || 0) <= (c.minStock || 0));

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Workshop Inventory</h1>
        <p class="text-secondary">Raw filament library, 50x30mm thermal rack labels, and shop consumables tracking</p>
      </div>
      <div class="page-header-actions">
        ${_activeTab === 'filaments' ? `
          <button class="btn btn-secondary" id="btn-scale-tare">
            <span style="font-size:1.05rem;">⚖️</span>
            Digital Scale Tare
          </button>
          <button class="btn btn-primary" id="btn-add-filament">
            <span class="nav-icon">${ICONS.plus}</span>
            Add Filament
          </button>
        ` : `
          <button class="btn btn-primary" id="btn-add-consumable">
            <span class="nav-icon">${ICONS.plus}</span>
            Add Hardware / Consumable
          </button>
        `}
      </div>
    </div>

    <!-- Sub-tab Switcher -->
    <div class="filter-pills animate-in animate-delay-1" style="margin-bottom: var(--space-md);">
      <button class="filter-pill ${_activeTab === 'filaments' ? 'active' : ''}" data-tab="filaments">
        🧵 Filament Spools (${filaments.length})
      </button>
      <button class="filter-pill ${_activeTab === 'consumables' ? 'active' : ''}" data-tab="consumables">
        🔩 Workshop Consumables & Hardware (${consumables.length})
        ${lowStockConsumables.length > 0 ? `<span class="badge badge-danger" style="margin-left:6px;font-size:0.7rem;">${lowStockConsumables.length} low</span>` : ''}
      </button>
    </div>

    ${_activeTab === 'filaments' ? renderFilamentToolbar(filaments, totalSpools) : renderConsumableToolbar(consumables)}

    <!-- Content -->
    <div id="inv-content" class="animate-in animate-delay-2">
      ${_activeTab === 'filaments' 
        ? (_view === 'grid' ? renderFilamentGrid(filaments) : renderFilamentTable(filaments))
        : renderConsumablesView(consumables, lowStockConsumables)
      }
    </div>
  `;

  bindEvents(container);
}

function renderFilamentToolbar(items, totalSpools) {
  return `
    <div class="toolbar animate-in animate-delay-1">
      <div class="toolbar-left">
        <div class="search-bar">
          <span class="search-icon">${ICONS.search}</span>
          <input type="text" id="inv-search" placeholder="Search filaments by color, material, brand..." value="${escapeHtml(_searchQuery)}"/>
        </div>
        <select class="filter-select" id="inv-filter-material">
          <option value="">All Materials</option>
          ${MATERIAL_TYPES.map(m => `<option value="${m}" ${_filterMaterial === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select class="filter-select" id="inv-filter-usable">
          <option value="" ${_filterUsable === '' ? 'selected' : ''}>All Status</option>
          <option value="yes" ${_filterUsable === 'yes' ? 'selected' : ''}>Usable</option>
          <option value="no" ${_filterUsable === 'no' ? 'selected' : ''}>Not Usable</option>
        </select>
      </div>
      <div class="toolbar-right">
        <span class="badge" style="background:rgba(139,92,246,0.12);color:var(--accent);font-size:0.8rem;padding:6px 12px;border:1px solid rgba(139,92,246,0.25);">
          Stock Valuation: ${formatCurrency(totalSpools * 750)} (${totalSpools} spools)
        </span>
        <div class="view-toggle">
          <button class="view-toggle-btn ${_view === 'grid' ? 'active' : ''}" data-view="grid" title="Spool Grid view">
            <span style="width:16px;height:16px;">${ICONS.grid}</span> Grid
          </button>
          <button class="view-toggle-btn ${_view === 'table' ? 'active' : ''}" data-view="table" title="Table view">
            <span style="width:16px;height:16px;">${ICONS.list}</span> Table
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderConsumableToolbar(items) {
  return `
    <div class="toolbar animate-in animate-delay-1">
      <div class="toolbar-left">
        <div class="search-bar">
          <span class="search-icon">${ICONS.search}</span>
          <input type="text" id="inv-search" placeholder="Search brass inserts, nozzles, IPA, resin, locations..." value="${escapeHtml(_searchQuery)}"/>
        </div>
        <select class="filter-select" id="inv-filter-consumable-cat">
          <option value="">All Categories</option>
          ${CONSUMABLE_CATEGORIES.map(c => `<option value="${c}" ${_filterConsumableCat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="text-secondary" style="font-size:0.85rem;">${items.length} consumables tracked</span>
      </div>
    </div>
  `;
}

function getMaterialBadge(material) {
  const cls = MATERIAL_BADGES[material] || 'badge-pla';
  return `<span class="badge ${cls}">${escapeHtml(material)}</span>`;
}

function renderFilamentGrid(items) {
  if (items.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">${ICONS.spool}</div><p>No filaments found. Try adjusting your filters or add a new filament.</p></div>`;
  }

  return `
    <div class="filament-grid">
      ${items.map(f => {
        return `
        <div class="card filament-card" data-id="${f.id}">
          <!-- Numakers Spool Showcase Hero -->
          <div class="filament-spool-hero">
            <div class="filament-card-actions" style="position:absolute;top:10px;right:10px;display:flex;gap:4px;z-index:10;">
              <button class="btn-icon btn-sm" data-action="thermal-label" data-id="${f.id}" title="Print 50x30mm Thermal QR Label">🏷️</button>
              <button class="btn-icon btn-sm" data-action="tare" data-id="${f.id}" title="Weigh & Tare Spool">⚖️</button>
              <button class="btn-icon btn-sm" data-action="edit" data-id="${f.id}" title="Edit filament">${ICONS.edit}</button>
              <button class="btn-icon btn-sm" data-action="duplicate" data-id="${f.id}" title="Duplicate">${ICONS.copy}</button>
              <button class="btn-icon btn-sm" data-action="delete" data-id="${f.id}" title="Delete" style="color:var(--danger);">${ICONS.trash}</button>
            </div>
            ${renderNumakersSpool(f, 'card')}
          </div>

          <div class="filament-card-body">
            <div class="filament-card-title-row">
              <div class="filament-card-name">${escapeHtml(f.name)}</div>
            </div>

            <div class="filament-card-meta" style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              ${getMaterialBadge(f.material)}
              <span class="badge ${f.usable !== false ? 'badge-yes' : 'badge-no'}">${f.usable !== false ? 'Usable' : 'Not Usable'}</span>
              <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);font-size:0.7rem;">${escapeHtml(f.brand || 'Numakers')}</span>
            </div>

            <div class="filament-card-bottom">
              <span class="text-secondary" style="font-size:0.8rem;">Spools in Stock:</span>
              <div class="spool-stepper">
                <button class="spool-stepper-btn" data-action="dec-spool" data-id="${f.id}" title="Decrease 1 spool">-</button>
                <span class="spool-stepper-val">${f.spools || 0}</span>
                <button class="spool-stepper-btn" data-action="inc-spool" data-id="${f.id}" title="Add 1 spool">+</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderFilamentTable(items) {
  if (items.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">${ICONS.spool}</div><p>No filaments found.</p></div>`;
  }

  return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Numakers Spool / Color</th>
            <th data-sort="material" class="${_sortField === 'material' ? 'sorted' : ''}">Material <span class="sort-icon">↕</span></th>
            <th data-sort="spools" class="${_sortField === 'spools' ? 'sorted' : ''}">Spools <span class="sort-icon">↕</span></th>
            <th>Status</th>
            <th>Brand</th>
            <th style="width:130px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((f, i) => {
            const swatchClass = getSwatchClass(f.name, f.material);
            return `
            <tr data-id="${f.id}">
              <td style="color:var(--text-muted)">${i + 1}</td>
              <td>
                <div class="flex items-center gap-md">
                  <div class="color-swatch ${swatchClass}" style="background-color: ${f.hex || '#888'};"></div>
                  <div>
                    <span class="inline-editable" style="font-weight:600;color:var(--text-primary);" data-field="name" data-id="${f.id}">${escapeHtml(f.name)}</span>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${f.hex || ''}</div>
                  </div>
                </div>
              </td>
              <td>${getMaterialBadge(f.material)}</td>
              <td>
                <div class="spool-stepper">
                  <button class="spool-stepper-btn" data-action="dec-spool" data-id="${f.id}">-</button>
                  <span class="spool-stepper-val">${f.spools || 0}</span>
                  <button class="spool-stepper-btn" data-action="inc-spool" data-id="${f.id}">+</button>
                </div>
              </td>
              <td><span class="badge ${f.usable !== false ? 'badge-yes' : 'badge-no'}">${f.usable !== false ? 'Usable' : 'Not Usable'}</span></td>
              <td style="color:var(--text-secondary)">${escapeHtml(f.brand || 'Numakers')}</td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon" data-action="thermal-label" data-id="${f.id}" title="50x30mm QR Label">🏷️</button>
                  <button class="btn-icon" data-action="tare" data-id="${f.id}" title="Weigh & Tare Spool">⚖️</button>
                  <button class="btn-icon" data-action="edit" data-id="${f.id}" title="Edit">${ICONS.edit}</button>
                  <button class="btn-icon" data-action="duplicate" data-id="${f.id}" title="Duplicate">${ICONS.copy}</button>
                  <button class="btn-icon" data-action="delete" data-id="${f.id}" title="Delete" style="color:var(--danger)">${ICONS.trash}</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderConsumablesView(consumables, lowStockItems) {
  if (consumables.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🔩</div>
        <p>No workshop consumables found. Add brass inserts, nozzles, IPA, or resins to track shop stock.</p>
      </div>
    `;
  }

  return `
    ${lowStockItems.length > 0 ? `
      <div class="alert-banner alert-warning animate-in" style="margin-bottom:var(--space-md);background:rgba(239, 68, 68, 0.12);border:1px solid rgba(239, 68, 68, 0.3);border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.4rem;">⚠️</span>
        <div>
          <div style="font-weight:700;color:var(--danger);">Low Stock Warning (${lowStockItems.length} items require replenishment)</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">
            The following consumables are below minimum safety buffer: 
            <strong>${lowStockItems.map(c => `${c.name} (${c.stock} ${c.unit})`).join(', ')}</strong>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="consumables-grid">
      ${consumables.map(c => {
        const isLow = (c.stock || 0) <= (c.minStock || 0);
        return `
          <div class="consumable-card ${isLow ? 'low-stock' : ''}" data-id="${c.id}">
            <div>
              <div class="consumable-top">
                <span class="consumable-cat">${escapeHtml(c.category || 'General')}</span>
                <div style="display:flex;gap:4px;">
                  <button class="btn-icon btn-sm" data-action="edit-consumable" data-id="${c.id}" title="Edit">${ICONS.edit}</button>
                  <button class="btn-icon btn-sm" data-action="delete-consumable" data-id="${c.id}" title="Delete" style="color:var(--danger);">${ICONS.trash}</button>
                </div>
              </div>
              <div class="consumable-name">${escapeHtml(c.name)}</div>
              <div style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 8px;">${escapeHtml(c.specs || '')}</div>
              
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                <span class="badge" style="background:rgba(255,255,255,0.05);font-size:0.72rem;">📍 ${escapeHtml(c.location || 'Workshop')}</span>
                ${c.supplier ? `<span class="badge" style="background:rgba(255,255,255,0.05);font-size:0.72rem;">🏢 ${escapeHtml(c.supplier)}</span>` : ''}
                <span class="badge" style="background:rgba(255,255,255,0.05);font-size:0.72rem;">💰 ${formatCurrency(c.costPerUnit || 0)}/${c.unit || 'pc'}</span>
              </div>
            </div>

            <div>
              <div class="consumable-stock-row">
                <div>
                  <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Stock Level</div>
                  <div style="font-size:1.15rem;font-weight:800;color:${isLow ? 'var(--danger)' : 'var(--text-primary)'};">
                    ${c.stock || 0} <span style="font-size:0.8rem;font-weight:500;color:var(--text-secondary);">${c.unit || 'pcs'}</span>
                  </div>
                  <div style="font-size:0.72rem;color:var(--text-muted);">Min: ${c.minStock || 0} ${c.unit || 'pcs'}</div>
                </div>

                <div class="stock-stepper">
                  <button class="btn-stepper" data-action="step-consumable" data-delta="-10" data-id="${c.id}" title="-10">-10</button>
                  <button class="btn-stepper" data-action="step-consumable" data-delta="-1" data-id="${c.id}" title="-1">-1</button>
                  <button class="btn-stepper" data-action="step-consumable" data-delta="1" data-id="${c.id}" title="+1">+1</button>
                  <button class="btn-stepper" data-action="step-consumable" data-delta="10" data-id="${c.id}" title="+10">+10</button>
                </div>
              </div>

              ${isLow ? `
                <div style="font-size:0.72rem;color:var(--danger);font-weight:700;display:flex;align-items:center;gap:4px;">
                  ⚠️ Replenish soon (Below safety stock)
                </div>
              ` : `
                <div style="font-size:0.72rem;color:#4ade80;display:flex;align-items:center;gap:4px;">
                  ✓ Optimal inventory buffer
                </div>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function bindEvents(container) {
  // Tab switcher
  container.querySelectorAll('.filter-pills [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      render(container);
    });
  });

  // Add filament
  container.querySelector('#btn-add-filament')?.addEventListener('click', () => openFilamentModal());

  // Add consumable
  container.querySelector('#btn-add-consumable')?.addEventListener('click', () => openConsumableModal());

  // Digital Scale Tare
  container.querySelector('#btn-scale-tare')?.addEventListener('click', () => {
    openTareCalculatorModal(null, () => render(container));
  });

  // Search
  container.querySelector('#inv-search')?.addEventListener('input', debounce((e) => {
    _searchQuery = e.target.value;
    render(container);
  }, 250));

  // Filters
  container.querySelector('#inv-filter-material')?.addEventListener('change', (e) => {
    _filterMaterial = e.target.value;
    render(container);
  });

  container.querySelector('#inv-filter-usable')?.addEventListener('change', (e) => {
    _filterUsable = e.target.value;
    render(container);
  });

  container.querySelector('#inv-filter-consumable-cat')?.addEventListener('change', (e) => {
    _filterConsumableCat = e.target.value;
    render(container);
  });

  // View toggle
  container.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      _view = btn.dataset.view;
      render(container);
    });
  });

  // Table sort
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (_sortField === field) {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        _sortField = field;
        _sortDir = 'asc';
      }
      render(container);
    });
  });

  // Card/Row actions (edit, delete, duplicate, inc/dec spool stepper, tare, thermal label)
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'thermal-label') {
        const filament = getAll('filaments').find(f => f.id === id);
        if (filament) openThermalLabelModal(filament);
      } else if (action === 'tare') {
        openTareCalculatorModal(id, () => render(container));
      } else if (action === 'edit') {
        openFilamentModal(id);
      } else if (action === 'delete') {
        confirmDelete(id, container);
      } else if (action === 'duplicate') {
        duplicate('filaments', id);
        showToast('Filament duplicated!', 'success');
        render(container);
      } else if (action === 'inc-spool') {
        const item = getAll('filaments').find(f => f.id === id);
        if (item) {
          update('filaments', id, { spools: (item.spools || 0) + 1 });
          render(container);
        }
      } else if (action === 'dec-spool') {
        const item = getAll('filaments').find(f => f.id === id);
        if (item && item.spools > 0) {
          update('filaments', id, { spools: item.spools - 1 });
          render(container);
        }
      } else if (action === 'edit-consumable') {
        openConsumableModal(id);
      } else if (action === 'delete-consumable') {
        confirmDeleteConsumable(id, container);
      } else if (action === 'step-consumable') {
        const delta = parseFloat(btn.dataset.delta) || 0;
        const c = getAll('consumables').find(item => item.id === id);
        if (c) {
          const newStock = Math.max(0, (c.stock || 0) + delta);
          update('consumables', id, { stock: newStock });
          render(container);
        }
      }
    });
  });

  // Inline editing (table view)
  container.querySelectorAll('.inline-editable').forEach(el => {
    el.addEventListener('dblclick', () => startInlineEdit(el, container));
  });
}

function startInlineEdit(el, container) {
  const field = el.dataset.field;
  const id = el.dataset.id;
  const currentValue = el.textContent.trim();

  const input = document.createElement('input');
  input.className = 'inline-edit-input';
  input.value = currentValue;
  input.type = field === 'spools' ? 'number' : 'text';
  if (field === 'spools') { input.min = 0; input.step = 1; }

  el.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const newValue = field === 'spools' ? parseInt(input.value) || 0 : input.value.trim();
    if (newValue !== currentValue && newValue !== '') {
      update('filaments', id, { [field]: newValue });
      showToast('Updated!', 'success');
    }
    render(container);
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish();
    if (e.key === 'Escape') render(container);
  });
}

function confirmDelete(id, container) {
  const filament = getAll('filaments').find(f => f.id === id);
  if (!filament) return;

  showModal({
    title: 'Delete Filament',
    body: `<p>Are you sure you want to delete <strong>${escapeHtml(filament.name)}</strong>?</p><p class="text-secondary" style="margin-top:8px;font-size:0.85rem;">This action can be undone.</p>`,
    confirmText: 'Delete',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      remove('filaments', id);
      showToast(`Deleted "${filament.name}"`, 'warning');
      closeModal();
      render(container);
    },
  });
}

function confirmDeleteConsumable(id, container) {
  const c = getAll('consumables').find(item => item.id === id);
  if (!c) return;

  showModal({
    title: 'Delete Consumable',
    body: `<p>Are you sure you want to delete <strong>${escapeHtml(c.name)}</strong>?</p>`,
    confirmText: 'Delete',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      remove('consumables', id);
      showToast(`Deleted "${c.name}"`, 'warning');
      closeModal();
      render(container);
    },
  });
}

/** 50x30mm Thermal Spool QR Label Modal */
export function openThermalLabelModal(f) {
  const tare = f.tareWeight || 210;
  const qrData = `MNM:SPOOL:${f.id}:${encodeURIComponent(f.name)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(qrData)}`;

  const body = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:18px;padding:10px 0;">
      <div style="font-size:0.85rem;color:var(--text-secondary);text-align:center;">
        Industrial 50x30mm Thermal Sticker Roll Preview (Direct Thermal / QR Scanner Ready)
      </div>

      <!-- 50x30mm Physical Aspect Ratio Container -->
      <div class="thermal-label" id="printable-thermal-label">
        <div class="thermal-label-header">
          <span class="thermal-brand">MADE N MORE • WORKSHOP</span>
          <span class="thermal-tare-badge">TARE: ${tare}g</span>
        </div>

        <div class="thermal-label-body">
          <img class="thermal-qr" src="${qrUrl}" alt="QR" />
          <div class="thermal-details">
            <div class="thermal-material">${escapeHtml(f.material || 'PLA+')} • 1.75mm</div>
            <div class="thermal-color" style="display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.hex || '#000'};border:0.5px solid #000;"></span>
              <span>${escapeHtml(f.name)}</span>
            </div>
            <div style="font-size:6.2pt;color:#222;">Brand: ${escapeHtml(f.brand || 'Numakers')} • ID: ${f.id}</div>
            <div style="font-weight:800;font-size:7pt;margin-top:0.5mm;">NET: 1000g / 1.0 kg</div>
          </div>
        </div>

        <div class="thermal-footer">
          <span>BATCH: 2026-NMK</span>
          <span>RACK SLOT: SHELF-A</span>
        </div>
      </div>

      <div style="display:flex;gap:12px;width:100%;justify-content:center;">
        <button class="btn btn-primary" id="btn-trigger-thermal-print" style="padding:10px 24px;">
          🖨️ Print 50x30mm Thermal Sticker
        </button>
      </div>
    </div>
  `;

  showModal({
    title: `Thermal Spool QR Label — ${f.name}`,
    body,
    confirmText: 'Done',
    onReady: () => {
      document.getElementById('btn-trigger-thermal-print')?.addEventListener('click', () => {
        document.body.classList.add('printing-thermal');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-thermal');
        }, 800);
      });
    },
  });
}

function openFilamentModal(editId = null) {
  const existing = editId ? getAll('filaments').find(f => f.id === editId) : null;
  const isEdit = !!existing;

  const currentImage = existing?.image || (existing ? NUMAKERS_PHOTO_MAP[existing.name] : '') || '';

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Color Name *</label>
        <input class="form-input" id="fil-name" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Pitch Black, Midnight Grey" required />
      </div>
      <div class="form-group">
        <label class="form-label">Material *</label>
        <select class="form-select" id="fil-material">
          ${MATERIAL_TYPES.map(m => `<option value="${m}" ${existing?.material === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Filament Color</label>
        <div class="form-color-wrapper">
          <div class="form-color-preview" id="fil-color-preview" style="background-color: ${existing?.hex || '#888888'}"></div>
          <input type="color" id="fil-hex" value="${existing?.hex || '#888888'}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Spools in Stock</label>
        <input class="form-input" type="number" id="fil-spools" min="0" value="${existing?.spools ?? 1}" />
      </div>
    </div>

    <div class="form-group" style="background:var(--bg-card);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border);">
      <label class="form-label" style="font-weight:600;">Numakers Official Spool Photo</label>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;">
        Select from available Numakers factory photos or enter custom URL:
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        ${Object.keys(NUMAKERS_PHOTO_MAP).map(key => `
          <button type="button" class="btn btn-ghost btn-sm btn-preset-photo" data-url="${NUMAKERS_PHOTO_MAP[key]}" style="font-size:0.75rem;padding:4px 8px;">
            ${key}
          </button>
        `).join('')}
      </div>
      <input class="form-input" id="fil-image" value="${escapeHtml(currentImage)}" placeholder="Optional photo URL (e.g. /spools/Pitch_Black_Spool_Printzy.webp)" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Brand</label>
        <input class="form-input" id="fil-brand" value="${escapeHtml(existing?.brand || 'Numakers')}" placeholder="e.g. Numakers" />
      </div>
      <div class="form-group">
        <label class="form-label">Usable</label>
        <div class="toggle-wrapper" id="fil-usable-toggle" style="margin-top:8px;">
          <div class="toggle ${existing?.usable !== false ? 'active' : ''}" id="fil-usable-switch"></div>
          <span id="fil-usable-label">${existing?.usable !== false ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="fil-notes" placeholder="Batch details, print temperature, etc...">${escapeHtml(existing?.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit Filament Spool' : 'Add New Numakers Spool',
    body,
    confirmText: isEdit ? 'Save Changes' : 'Add Spool',
    onConfirm: () => {
      const name = document.getElementById('fil-name').value.trim();
      if (!name) {
        showToast('Name is required', 'error');
        return;
      }

      const data = {
        name,
        material: document.getElementById('fil-material').value,
        hex: document.getElementById('fil-hex').value,
        spools: parseInt(document.getElementById('fil-spools').value) || 0,
        image: document.getElementById('fil-image').value.trim(),
        brand: document.getElementById('fil-brand').value.trim(),
        usable: document.getElementById('fil-usable-switch').classList.contains('active'),
        notes: document.getElementById('fil-notes').value.trim(),
      };

      if (isEdit) {
        update('filaments', editId, data);
        showToast('Filament updated!', 'success');
      } else {
        create('filaments', data);
        showToast('Filament added!', 'success');
      }

      closeModal();
      const contentEl = document.getElementById('content');
      if (contentEl) render(contentEl);
    },
    onReady: () => {
      const colorInput = document.getElementById('fil-hex');
      const colorPreview = document.getElementById('fil-color-preview');
      if (colorInput && colorPreview) {
        colorInput.addEventListener('input', () => {
          colorPreview.style.backgroundColor = colorInput.value;
        });
      }

      document.querySelectorAll('.btn-preset-photo').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          const imgInput = document.getElementById('fil-image');
          if (imgInput) imgInput.value = url;
          showToast(`Applied photo: ${btn.textContent.trim()}`, 'info');
        });
      });

      const toggle = document.getElementById('fil-usable-switch');
      const label = document.getElementById('fil-usable-label');
      if (toggle) {
        toggle.parentElement.addEventListener('click', () => {
          toggle.classList.toggle('active');
          label.textContent = toggle.classList.contains('active') ? 'Yes' : 'No';
        });
      }
    },
  });
}

function openConsumableModal(editId = null) {
  const existing = editId ? getAll('consumables').find(c => c.id === editId) : null;
  const isEdit = !!existing;

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Item Name *</label>
        <input class="form-input" id="con-name" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. M3 Brass Threaded Heat-Set Inserts" required />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-select" id="con-category">
          ${CONSUMABLE_CATEGORIES.map(cat => `<option value="${cat}" ${existing?.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Technical Specifications</label>
      <input class="form-input" id="con-specs" value="${escapeHtml(existing?.specs || '')}" placeholder="e.g. M3 x 4.0mm (OD 4.6mm), Knurled Brass" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Stock Quantity</label>
        <input class="form-input" type="number" id="con-stock" min="0" step="any" value="${existing?.stock ?? 100}" />
      </div>
      <div class="form-group">
        <label class="form-label">Unit of Measure</label>
        <input class="form-input" id="con-unit" value="${escapeHtml(existing?.unit || 'pcs')}" placeholder="e.g. pcs, g, L, tubes" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Min Stock Threshold (Alert Level)</label>
        <input class="form-input" type="number" id="con-min-stock" min="0" step="any" value="${existing?.minStock ?? 20}" />
      </div>
      <div class="form-group">
        <label class="form-label">Cost per Unit (₹)</label>
        <input class="form-input" type="number" id="con-cost" min="0" step="any" value="${existing?.costPerUnit ?? 2.5}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Physical Storage Location</label>
        <input class="form-input" id="con-location" value="${escapeHtml(existing?.location || 'Bin A1 - Hardware Drawer')}" placeholder="e.g. Bin A1, Toolbox Shelf 2" />
      </div>
      <div class="form-group">
        <label class="form-label">Supplier / Source</label>
        <input class="form-input" id="con-supplier" value="${escapeHtml(existing?.supplier || 'Robu.in')}" placeholder="e.g. Robu.in, Amazon" />
      </div>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit Hardware / Consumable' : 'Add New Hardware / Consumable',
    body,
    confirmText: isEdit ? 'Save Changes' : 'Add Item',
    onConfirm: () => {
      const name = document.getElementById('con-name').value.trim();
      if (!name) {
        showToast('Name is required', 'error');
        return;
      }

      const data = {
        name,
        category: document.getElementById('con-category').value,
        specs: document.getElementById('con-specs').value.trim(),
        stock: parseFloat(document.getElementById('con-stock').value) || 0,
        unit: document.getElementById('con-unit').value.trim() || 'pcs',
        minStock: parseFloat(document.getElementById('con-min-stock').value) || 0,
        costPerUnit: parseFloat(document.getElementById('con-cost').value) || 0,
        location: document.getElementById('con-location').value.trim(),
        supplier: document.getElementById('con-supplier').value.trim(),
      };

      if (isEdit) {
        update('consumables', editId, data);
        showToast('Consumable updated!', 'success');
      } else {
        create('consumables', data);
        showToast('Consumable added to inventory!', 'success');
      }

      closeModal();
      const contentEl = document.getElementById('content');
      if (contentEl) render(contentEl);
    },
  });
}

// ─── 50x30mm Thermal Spool Label Generator ──────────────────
function openThermalLabelModal(filament) {
  const qrData = `MNM:SPOOL:${filament.id}:${filament.name}:${filament.material}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(qrData)}`;
  
  let nozzleTemp = '210°C';
  let bedTemp = '60°C';
  const mat = (filament.material || '').toUpperCase();
  if (mat.includes('PETG')) { nozzleTemp = '240°C'; bedTemp = '75°C'; }
  else if (mat.includes('ABS')) { nozzleTemp = '250°C'; bedTemp = '100°C'; }
  else if (mat.includes('TPU')) { nozzleTemp = '220°C'; bedTemp = '50°C'; }
  else if (mat.includes('PLA')) { nozzleTemp = '215°C'; bedTemp = '60°C'; }

  const spoolCode = `MNM-${(filament.id || '000000').slice(-6).toUpperCase()}`;

  const body = `
    <div class="thermal-sheet-modal">
      <p style="font-size:0.82rem;color:var(--text-secondary);text-align:center;margin-bottom:8px;">
        Formatted for direct output on standard <strong>50mm × 30mm (2" × 1.25")</strong> thermal label rolls (Phomemo, Niimbot, Zebra, Brother, TSC).
      </p>

      <!-- 50x30mm Label Preview Card -->
      <div id="printable-thermal-label" class="thermal-label-card">
        <div class="thermal-label-header">
          <span class="thermal-label-brand">MADE N MORE LABS</span>
          <span class="thermal-label-mat">${escapeHtml(filament.material || 'PLA+')}</span>
        </div>

        <div class="thermal-label-content">
          <img src="${qrUrl}" alt="QR Code" class="thermal-label-qr" />
          <div class="thermal-label-info">
            <div class="thermal-label-color">${escapeHtml(filament.name || 'Spool')}</div>
            <div class="thermal-label-weight">Brand: ${escapeHtml(filament.brand || 'Numakers')} • 1.0kg</div>
            <div style="font-size:6.5pt;color:#333;margin-top:1mm;">
              Nozzle: <strong>${nozzleTemp}</strong> | Bed: <strong>${bedTemp}</strong>
            </div>
            <div style="font-size:6.5pt;color:#555;">Tare Weight: ~210g</div>
          </div>
        </div>

        <div class="thermal-label-footer">
          <span style="font-family:monospace;letter-spacing:1px;font-weight:700;">${spoolCode}</span>
          <span>LOT: ${new Date().toISOString().split('T')[0].replace(/-/g, '')}</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;margin-top:12px;">
        <button class="btn btn-primary" id="btn-print-thermal-action">
          🖨️ Print Label (50x30mm)
        </button>
        <button class="btn btn-secondary" id="btn-copy-qr-action">
          📋 Copy QR String
        </button>
      </div>
    </div>
  `;

  showModal({
    title: `🏷️ Spool Thermal Label (50×30mm) — ${escapeHtml(filament.name)}`,
    body,
    confirmText: 'Done',
    onReady: () => {
      document.getElementById('btn-copy-qr-action')?.addEventListener('click', () => {
        navigator.clipboard.writeText(qrData).then(() => {
          showToast('Copied QR payload to clipboard!', 'success');
        });
      });

      document.getElementById('btn-print-thermal-action')?.addEventListener('click', () => {
        const printContent = document.getElementById('printable-thermal-label')?.outerHTML || '';
        const printWindow = window.open('', '_blank', 'width=360,height=300');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Thermal Label - ${escapeHtml(filament.name)}</title>
                <style>
                  @page {
                    size: 50mm 30mm;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .thermal-label-card {
                    width: 50mm;
                    height: 30mm;
                    box-sizing: border-box;
                    padding: 2.2mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    background: #fff;
                    color: #000;
                  }
                  .thermal-label-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 0.8px solid #000;
                    padding-bottom: 1mm;
                  }
                  .thermal-label-brand { font-size: 7.5pt; font-weight: 900; letter-spacing: -0.2px; }
                  .thermal-label-mat { font-size: 7pt; font-weight: 800; background: #000; color: #fff; padding: 1px 3px; border-radius: 2px; }
                  .thermal-label-content { display: flex; align-items: center; justify-content: space-between; gap: 2mm; margin: 1mm 0; }
                  .thermal-label-qr { width: 14mm; height: 14mm; }
                  .thermal-label-info { flex: 1; min-width: 0; }
                  .thermal-label-color { font-weight: 800; font-size: 7.5pt; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                  .thermal-label-weight { font-size: 6.5pt; color: #111; margin-top: 0.8mm; }
                  .thermal-label-footer { display: flex; justify-content: space-between; font-size: 6pt; color: #222; border-top: 0.6px solid #000; padding-top: 0.8mm; }
                </style>
              </head>
              <body>
                ${printContent}
                <script>
                  window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      });
    }
  });
}

