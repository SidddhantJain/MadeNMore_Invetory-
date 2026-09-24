/**
 * Made N More — Orders & Production Management
 * Phase 1: Multi-Item Assemblies, Interactive Kanban Pipeline, GST Invoicing & Milestone Receipts
 */

import { getAll, create, update, remove, getById, getAccountBalance } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml, todayStr, debounce } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export const KANBAN_STAGES = [
  { id: 'quote', label: 'Draft / Quote', color: '#64748b' },
  { id: 'advance_paid', label: 'Advance Paid', color: '#06b6d4' },
  { id: 'slicing', label: 'Slicing & Pre-Flight', color: '#8b5cf6' },
  { id: 'in_queue', label: 'In Print Queue', color: '#3b82f6' },
  { id: 'printing', label: 'Printing', color: '#f59e0b' },
  { id: 'post_processing', label: 'Post-Processing & QA', color: '#ec4899' },
  { id: 'ready_dispatch', label: 'Ready for Dispatch', color: '#10b981' },
  { id: 'completed', label: 'Delivered & Settled', color: '#22c55e' },
];

const PRIORITY_CONFIG = {
  standard: { label: 'Standard', class: 'badge-priority-standard' },
  express: { label: 'Express 48h', class: 'badge-priority-express' },
  overnight: { label: 'Overnight 24h', class: 'badge-priority-overnight' },
};

let _currentView = 'kanban'; // 'kanban' | 'list'
let _expandedOrderId = null;
let _filterStatus = '';
let _filterPriority = '';
let _orderSearch = '';
let _draggedOrderId = null;

export function renderOrders(container) {
  render(container);
}

export function getOrderStage(order) {
  if (order.kanbanStage) return order.kanbanStage;
  if (order.status === 'completed') return 'completed';
  if (order.status === 'quote') return 'quote';
  if (order.payments && order.payments.length > 0) return 'printing';
  return 'in_queue';
}

function calcOrderStats(order) {
  const payments = order.payments || [];
  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const total = order.totalAmount || 0;
  const paidPct = total > 0 ? (paidAmount / total) * 100 : 0;
  const remaining = Math.max(0, total - paidAmount);
  const remainingPct = Math.max(0, 100 - paidPct);
  return { paidAmount, paidPct: Math.min(paidPct, 100), remaining, remainingPct };
}

function getFilteredOrders() {
  let orders = getAll('orders');

  if (_orderSearch) {
    const q = _orderSearch.toLowerCase();
    orders = orders.filter(o =>
      o.clientName?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.clientPhone?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      (o.items || []).some(it => it.name?.toLowerCase().includes(q) || it.material?.toLowerCase().includes(q) || it.notes?.toLowerCase().includes(q))
    );
  }

  if (_filterStatus) {
    orders = orders.filter(o => {
      const stage = getOrderStage(o);
      if (_filterStatus === 'active') return stage !== 'completed' && stage !== 'quote';
      if (_filterStatus === 'completed') return stage === 'completed';
      if (_filterStatus === 'quote') return stage === 'quote';
      return o.status === _filterStatus;
    });
  }

  if (_filterPriority) {
    orders = orders.filter(o => (o.priority || 'standard') === _filterPriority);
  }

  // Sort: active production first, then most recently updated
  orders.sort((a, b) => {
    const stageA = getOrderStage(a);
    const stageB = getOrderStage(b);
    if (stageA !== 'completed' && stageB === 'completed') return -1;
    if (stageA === 'completed' && stageB !== 'completed') return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  return orders;
}

function render(container) {
  const orders = getFilteredOrders();
  const allOrders = getAll('orders');
  
  const activeOrders = allOrders.filter(o => {
    const st = getOrderStage(o);
    return st !== 'completed' && st !== 'quote';
  });

  const totalOutstanding = activeOrders.reduce((s, o) => {
    const stats = calcOrderStats(o);
    return s + stats.remaining;
  }, 0);

  const completedOrders = allOrders.filter(o => getOrderStage(o) === 'completed');

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Orders & Production</h1>
        <p class="text-secondary">Milestone payments, multi-part assemblies & interactive Kanban pipeline</p>
      </div>
      <div class="page-header-actions">
        <!-- View Mode Switcher -->
        <div class="view-toggle">
          <button class="view-toggle-btn ${_currentView === 'kanban' ? 'active' : ''}" id="btn-view-kanban">
            ${ICONS.kanban} Kanban Board
          </button>
          <button class="view-toggle-btn ${_currentView === 'list' ? 'active' : ''}" id="btn-view-list">
            ${ICONS.list} List View
          </button>
        </div>

        <button class="btn btn-primary" id="btn-new-order">
          <span class="nav-icon">${ICONS.plus}</span>
          New Order
        </button>
      </div>
    </div>

    <!-- KPI Metric Cards -->
    <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="card stat-card animate-in animate-delay-1">
        <div class="card-title">In Production</div>
        <div class="stat-value">${activeOrders.length}</div>
        <div class="stat-label">active jobs in workshop</div>
      </div>
      <div class="card stat-card animate-in animate-delay-2">
        <div class="card-title">Outstanding Balance</div>
        <div class="stat-value text-warning">${formatCurrency(totalOutstanding)}</div>
        <div class="stat-label">uncollected milestone amounts</div>
      </div>
      <div class="card stat-card animate-in animate-delay-3">
        <div class="card-title">Settled / Delivered</div>
        <div class="stat-value text-success">${completedOrders.length}</div>
        <div class="stat-label">orders paid in full</div>
      </div>
    </div>

    <!-- Filtering Toolbar -->
    <div class="toolbar animate-in animate-delay-2">
      <div class="toolbar-left">
        <div class="search-bar" style="min-width:240px;max-width:320px;">
          <span class="search-icon">${ICONS.search}</span>
          <input type="text" id="order-search-input" placeholder="Search orders, clients, parts..." value="${escapeHtml(_orderSearch)}"/>
          ${_orderSearch ? `<button type="button" class="search-clear-btn" id="order-search-clear" title="Clear Search">✕</button>` : ''}
        </div>

        <select class="filter-select" id="order-filter-status">
          <option value="" ${_filterStatus === '' ? 'selected' : ''}>All Stages</option>
          <option value="active" ${_filterStatus === 'active' ? 'selected' : ''}>Active Production</option>
          <option value="quote" ${_filterStatus === 'quote' ? 'selected' : ''}>Draft Quotes</option>
          <option value="completed" ${_filterStatus === 'completed' ? 'selected' : ''}>Delivered / Settled</option>
        </select>

        <select class="filter-select" id="order-filter-priority">
          <option value="" ${_filterPriority === '' ? 'selected' : ''}>All Priorities</option>
          <option value="standard" ${_filterPriority === 'standard' ? 'selected' : ''}>Standard</option>
          <option value="express" ${_filterPriority === 'express' ? 'selected' : ''}>Express 48h</option>
          <option value="overnight" ${_filterPriority === 'overnight' ? 'selected' : ''}>Overnight 24h</option>
        </select>
      </div>
      <div class="toolbar-right">
        <span class="text-muted" style="font-size:0.82rem;">${orders.length} orders loaded</span>
      </div>
    </div>

    <!-- Main Content: Kanban or List View -->
    <div class="orders-view-container animate-in animate-delay-3">
      ${_currentView === 'kanban' ? renderKanbanBoard(orders) : renderOrdersList(orders)}
    </div>
  `;

  bindEvents(container);
}

// ─── Kanban Board Rendering ───────────────────────────────────
function renderKanbanBoard(orders) {
  return `
    <div class="kanban-board-wrapper">
      <div class="kanban-board">
        ${KANBAN_STAGES.map(stage => {
          const stageOrders = orders.filter(o => getOrderStage(o) === stage.id);
          return `
            <div class="kanban-column" data-stage="${stage.id}">
              <div class="kanban-column-header">
                <div class="kanban-column-title-group">
                  <span class="kanban-stage-dot" style="background: ${stage.color}"></span>
                  <span class="kanban-column-title">${stage.label}</span>
                </div>
                <span class="kanban-column-count">${stageOrders.length}</span>
              </div>
              <div class="kanban-cards" data-stage="${stage.id}">
                ${stageOrders.length > 0 ? stageOrders.map(o => renderKanbanCard(o, stage)).join('') : `
                  <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.75rem;">
                    No orders here
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderKanbanCard(order, currentStage) {
  const stats = calcOrderStats(order);
  const items = order.items || [];
  const priority = PRIORITY_CONFIG[order.priority || 'standard'] || PRIORITY_CONFIG.standard;
  const currentIndex = KANBAN_STAGES.findIndex(s => s.id === currentStage.id);

  return `
    <div class="kanban-card" draggable="true" data-order-id="${order.id}">
      <div class="kanban-card-top">
        <span class="kanban-client-name">${escapeHtml(order.clientName)}</span>
        <span class="badge ${priority.class}" style="font-size:0.68rem;padding:2px 6px;">${priority.label}</span>
      </div>

      <div class="kanban-card-desc">${escapeHtml(order.description || 'Custom 3D Printing')}</div>

      ${items.length > 0 ? `
        <div style="margin-bottom:8px;">
          <span class="order-items-badge">
            🧩 ${items.length} part${items.length > 1 ? 's' : ''} (${items.reduce((s, i) => s + (i.quantity || 1), 0)} units)
          </span>
        </div>
      ` : ''}

      <!-- Progress -->
      <div class="order-progress-section" style="padding:0;margin:0 0 6px 0;">
        <div class="order-progress-bar-track" style="height:4px;">
          <div class="order-progress-bar-fill" style="width: ${stats.paidPct}%; background: ${stats.paidPct >= 100 ? 'var(--success)' : 'var(--accent-gradient)'};"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-top:4px;">
          <span class="text-success" style="font-weight:600;">${stats.paidPct.toFixed(0)}% paid</span>
          <span class="text-muted">${formatCurrency(stats.remaining)} left</span>
        </div>
      </div>

      <div class="kanban-card-meta">
        <span class="kanban-card-amount">${formatCurrency(order.totalAmount)}</span>
        <div class="flex gap-xs">
          <button class="btn-icon btn-sm" data-action="generate-invoice" data-id="${order.id}" title="Generate Tax Invoice" style="padding:2px 4px;font-size:0.75rem;">
            ${ICONS.invoice}
          </button>
          <button class="btn-icon btn-sm" data-action="print-traveler" data-id="${order.id}" title="Print Job Traveler & QC Sheet" style="padding:2px 4px;font-size:0.75rem;">
            📋
          </button>
          <button class="btn-icon btn-sm" data-action="log-payment" data-id="${order.id}" title="Log Milestone Payment" style="padding:2px 4px;font-size:0.75rem;">
            ${ICONS.plus}
          </button>
          <button class="btn-icon btn-sm" data-action="edit-order" data-id="${order.id}" title="Edit Order" style="padding:2px 4px;font-size:0.75rem;">
            ${ICONS.edit}
          </button>
        </div>
      </div>

      <!-- Quick Stage Advancement Buttons -->
      <div class="kanban-stage-nav">
        <button class="btn-prev-stage" data-order-id="${order.id}" data-target-stage="${currentIndex > 0 ? KANBAN_STAGES[currentIndex - 1].id : ''}" ${currentIndex === 0 ? 'disabled' : ''} title="Move back">
          ${ICONS.arrowLeft} Back
        </button>
        <button class="btn-next-stage" data-order-id="${order.id}" data-target-stage="${currentIndex < KANBAN_STAGES.length - 1 ? KANBAN_STAGES[currentIndex + 1].id : ''}" ${currentIndex === KANBAN_STAGES.length - 1 ? 'disabled' : ''} title="Advance stage">
          Next ${ICONS.arrowRight}
        </button>
      </div>
    </div>
  `;
}

// ─── List View Rendering ──────────────────────────────────────
function renderOrdersList(orders) {
  if (orders.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${ICONS.order}</div>
        <p>No orders match the selected filters. Create your first order to get started!</p>
      </div>
    `;
  }

  return `
    <div class="orders-list">
      ${orders.map(o => renderOrderCard(o)).join('')}
    </div>
  `;
}

function renderOrderCard(order) {
  const stats = calcOrderStats(order);
  const payments = order.payments || [];
  const items = order.items || [];
  const isExpanded = _expandedOrderId === order.id;
  const stage = getOrderStage(order);
  const stageObj = KANBAN_STAGES.find(s => s.id === stage) || KANBAN_STAGES[3];
  const priority = PRIORITY_CONFIG[order.priority || 'standard'] || PRIORITY_CONFIG.standard;

  return `
    <div class="card order-card ${isExpanded ? 'order-expanded' : ''}" data-order-id="${order.id}" style="margin-bottom:var(--space-md);">
      <!-- Order Header -->
      <div class="order-card-header" data-toggle-order="${order.id}">
        <div class="order-card-left">
          <div class="order-client-avatar">${(order.clientName || '?')[0].toUpperCase()}</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="order-client-name">${escapeHtml(order.clientName)}</span>
              <span class="badge ${priority.class}" style="font-size:0.7rem;padding:2px 6px;">${priority.label}</span>
              ${items.length > 0 ? `
                <span class="order-items-badge">🧩 ${items.length} part${items.length > 1 ? 's' : ''}</span>
              ` : ''}
            </div>
            <div class="order-desc">${escapeHtml(order.description || '—')}</div>
          </div>
        </div>
        <div class="order-card-right">
          <span class="badge" style="background:${stageObj.color}22;color:${stageObj.color};border:1px solid ${stageObj.color}55;">
            ${stageObj.label}
          </span>
          <div class="order-total">${formatCurrency(order.totalAmount)}</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="order-progress-section">
        <div class="order-progress-bar-track">
          <div class="order-progress-bar-fill" style="width: ${stats.paidPct}%;
            background: ${stats.paidPct >= 100 ? 'var(--success)' : 'var(--accent-gradient)'};"></div>
        </div>
        <div class="order-progress-info">
          <span class="text-success" style="font-weight:600;">${formatCurrency(stats.paidAmount)} paid (${stats.paidPct.toFixed(0)}%)</span>
          <span class="text-muted">${formatCurrency(stats.remaining)} remaining</span>
        </div>
      </div>

      <!-- Actions Row -->
      <div class="order-actions-row">
        <div class="flex gap-sm">
          ${stage !== 'completed' ? `
            <button class="btn btn-primary btn-sm" data-action="log-payment" data-id="${order.id}">
              ${ICONS.plus} Log Payment
            </button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" data-toggle-order="${order.id}">
            ${items.length} parts • ${payments.length} payment${payments.length !== 1 ? 's' : ''} ${isExpanded ? '▲' : '▼'}
          </button>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" data-action="print-traveler" data-id="${order.id}">
            📋 Job Traveler
          </button>
          <button class="btn btn-ghost btn-sm" data-action="generate-invoice" data-id="${order.id}">
            ${ICONS.invoice} Tax Invoice
          </button>
          <button class="btn-icon btn-sm" data-action="edit-order" data-id="${order.id}" title="Edit order">${ICONS.edit}</button>
          ${stage === 'quote' ? `
            <button class="btn btn-secondary btn-sm" data-action="convert-quote" data-id="${order.id}" title="Convert quote to production order" style="color:var(--accent);font-weight:600;">
              🚀 Convert Quote
            </button>
          ` : ''}
          <button class="btn-icon btn-sm" data-action="delete-order" data-id="${order.id}" title="Delete" style="color:var(--danger)">${ICONS.trash}</button>
        </div>
      </div>

      <!-- Expanded Section: Parts Breakdown & Payment Logs -->
      ${isExpanded ? `
        <div class="order-payments-section">
          <!-- Itemized Parts Breakdown -->
          ${items.length > 0 ? `
            <div style="margin-bottom:var(--space-md);">
              <div class="order-payments-header" style="margin-bottom:8px;">
                <span class="card-title">🧩 Itemized Parts & Assembly Specs</span>
              </div>
              <table class="table" style="font-size:0.82rem;margin-bottom:12px;">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Part Name</th>
                    <th>Material</th>
                    <th>Color</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it, idx) => `
                    <tr>
                      <td style="color:var(--text-muted);">${idx + 1}</td>
                      <td><strong>${escapeHtml(it.name)}</strong></td>
                      <td><span class="badge badge-mat-${(it.material || '').toLowerCase().replace(/[^a-z]/g,'')}">${it.material || 'PLA+'}</span></td>
                      <td style="color:var(--text-secondary);">${escapeHtml(it.color || '—')}</td>
                      <td>${it.quantity || 1}</td>
                      <td>${formatCurrency(it.unitPrice || 0)}</td>
                      <td style="font-weight:600;color:var(--text-primary);">${formatCurrency(it.subtotal || 0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Milestone Payment History -->
          <div class="order-payments-header">
            <span class="card-title">Milestone Payment History</span>
          </div>
          ${payments.length > 0 ? `
            <table class="table" style="font-size:0.82rem;">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Percentage</th>
                  <th>Amount</th>
                  <th>Cumulative</th>
                  <th>Notes</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  let cumAmt = 0;
                  let cumPct = 0;
                  return payments.map((p, i) => {
                    cumAmt += p.amount || 0;
                    cumPct += p.percentage || 0;
                    return `
                      <tr>
                        <td style="color:var(--text-muted)">${i + 1}</td>
                        <td>${formatDate(p.date)}</td>
                        <td><span style="font-weight:600;color:var(--accent);">${(p.percentage || 0).toFixed(1)}%</span></td>
                        <td class="text-success" style="font-weight:600;">+${formatCurrency(p.amount)}</td>
                        <td>
                          <span style="font-weight:500;">${formatCurrency(cumAmt)}</span>
                          <span class="text-muted" style="font-size:0.75rem;"> (${cumPct.toFixed(0)}%)</span>
                        </td>
                        <td class="text-muted">${escapeHtml(p.notes || '—')}</td>
                        <td>
                          <button class="btn-icon btn-sm" data-action="print-receipt" data-order-id="${order.id}" data-payment-id="${p.id || i}" title="Print Milestone Receipt">
                            ${ICONS.receipt}
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('');
                })()}
              </tbody>
            </table>
          ` : '<p class="text-muted" style="padding:var(--space-md);font-size:0.85rem;">No milestone payments recorded yet.</p>'}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Event Handlers & Drag-and-Drop ────────────────────────────
function bindEvents(container) {
  // View Switchers
  container.querySelector('#btn-view-kanban')?.addEventListener('click', () => {
    _currentView = 'kanban';
    render(container);
  });

  container.querySelector('#btn-view-list')?.addEventListener('click', () => {
    _currentView = 'list';
    render(container);
  });

  // Filters
  const searchInput = container.querySelector('#order-search-input');
  searchInput?.addEventListener('input', debounce((e) => {
    _orderSearch = e.target.value.trim();
    render(container);
  }, 250));

  container.querySelector('#order-search-clear')?.addEventListener('click', () => {
    _orderSearch = '';
    render(container);
  });

  container.querySelector('#order-filter-status')?.addEventListener('change', (e) => {
    _filterStatus = e.target.value;
    render(container);
  });

  container.querySelector('#order-filter-priority')?.addEventListener('change', (e) => {
    _filterPriority = e.target.value;
    render(container);
  });

  // New Order
  container.querySelector('#btn-new-order')?.addEventListener('click', () => openNewOrderModal(container));

  // Toggle order expanded state
  container.querySelectorAll('[data-toggle-order]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      const orderId = el.dataset.toggleOrder;
      _expandedOrderId = _expandedOrderId === orderId ? null : orderId;
      render(container);
    });
  });

  // Action Buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id, orderId, paymentId } = btn.dataset;
      if (action === 'log-payment') openLogPaymentModal(id, container);
      else if (action === 'edit-order') openEditOrderModal(id, container);
      else if (action === 'generate-invoice') openInvoiceModal(id);
      else if (action === 'print-traveler') openOrderJobTravelerModal(id);
      else if (action === 'print-receipt') openReceiptModal(orderId, paymentId);
      else if (action === 'convert-quote') convertQuoteToOrder(id, container);
      else if (action === 'delete-order') confirmDeleteOrder(id, container);
    });
  });

  // Stage Navigation Buttons (Back / Next)
  container.querySelectorAll('.btn-prev-stage, .btn-next-stage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      const targetStage = btn.dataset.targetStage;
      if (orderId && targetStage) {
        updateOrderStage(orderId, targetStage, container);
      }
    });
  });

  // HTML5 Drag and Drop for Kanban Cards
  if (_currentView === 'kanban') {
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        _draggedOrderId = card.dataset.orderId;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', _draggedOrderId);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        _draggedOrderId = null;
        container.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
      });
    });

    container.querySelectorAll('.kanban-column').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const orderId = e.dataTransfer.getData('text/plain') || _draggedOrderId;
        const targetStage = col.dataset.stage;
        if (orderId && targetStage) {
          updateOrderStage(orderId, targetStage, container);
        }
      });
    });
  }
}

function updateOrderStage(orderId, newStage, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  const currentStage = getOrderStage(order);
  if (currentStage === newStage) return;

  const stageObj = KANBAN_STAGES.find(s => s.id === newStage);
  const statusUpdate = newStage === 'completed' ? 'completed' : newStage === 'quote' ? 'quote' : 'active';

  update('orders', orderId, {
    kanbanStage: newStage,
    status: statusUpdate,
  });

  showToast(`Moved to ${stageObj?.label || newStage}!`, 'success');
  render(container);
}

// ─── Multi-Item Order Modal ──────────────────────────────────
function openNewOrderModal(container) {
  let items = [
    { name: '', material: 'PLA+', color: '', quantity: 1, unitPrice: 0, subtotal: 0 },
  ];

  function calculateItemsTotal() {
    return items.reduce((sum, it) => sum + (parseFloat(it.subtotal) || 0), 0);
  }

  function renderModalBody() {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Client / Company Name *</label>
          <input class="form-input" id="ord-client" placeholder="e.g. Product Designer, RoboTech" required />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone</label>
          <input class="form-input" id="ord-phone" placeholder="e.g. +91 98230 44551" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Client GSTIN / Tax ID</label>
          <input class="form-input" id="ord-gstin" placeholder="e.g. 27AAAAA0000A1Z5 (Optional)" />
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" id="ord-priority">
            <option value="standard" selected>Standard (3–5 days)</option>
            <option value="express">Express 48h</option>
            <option value="overnight">Emergency Overnight 24h</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Project / Assembly Description</label>
        <input class="form-input" id="ord-desc" placeholder="e.g. Custom Drone Arm Assembly & Mounts" />
      </div>

      <!-- Itemized Parts Builder -->
      <div style="margin-top:var(--space-md);margin-bottom:var(--space-md);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <label class="form-label" style="margin:0;font-weight:600;color:var(--text-primary);">
            🧩 Multi-Part Assembly Itemization
          </label>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-add-item-row" style="color:var(--accent);">
            + Add Part
          </button>
        </div>

        <div id="items-table-container">
          ${renderItemRows(items)}
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.85rem;">
          <span style="color:var(--text-secondary);margin-right:12px;">Assembly Subtotal:</span>
          <strong id="items-sum-display" style="color:var(--accent);font-size:0.95rem;">${formatCurrency(calculateItemsTotal())}</strong>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total Contract Amount (₹) *</label>
          <input class="form-input" type="number" id="ord-total" min="1" step="0.01" value="${calculateItemsTotal() || ''}" placeholder="Auto-calculated from parts" required />
        </div>
        <div class="form-group">
          <label class="form-label">Initial Stage</label>
          <select class="form-select" id="ord-stage">
            <option value="quote">Draft / Formal Quote</option>
            <option value="in_queue" selected>In Print Queue</option>
            <option value="printing">Printing Directly</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Engineering / Quality Notes</label>
        <textarea class="form-textarea form-input" id="ord-notes" placeholder="Infill requirements, orientation, surface finish..."></textarea>
      </div>
    `;
  }

  function renderItemRows(currentItems) {
    return `
      <table class="item-builder-table">
        <thead>
          <tr>
            <th style="width:30%;">Part Name</th>
            <th style="width:20%;">Material</th>
            <th style="width:15%;">Color</th>
            <th style="width:10%;">Qty</th>
            <th style="width:15%;">Rate (₹)</th>
            <th style="width:10%;"></th>
          </tr>
        </thead>
        <tbody>
          ${currentItems.map((it, i) => `
            <tr class="item-builder-row" data-index="${i}">
              <td><input class="form-input it-name" value="${escapeHtml(it.name)}" placeholder="e.g. Arm Bracket" /></td>
              <td>
                <select class="form-select it-mat">
                  <option value="PLA+" ${it.material === 'PLA+' ? 'selected' : ''}>PLA+</option>
                  <option value="PETG-HS" ${it.material === 'PETG-HS' ? 'selected' : ''}>PETG-HS</option>
                  <option value="ABS" ${it.material === 'ABS' ? 'selected' : ''}>ABS</option>
                  <option value="TPU+" ${it.material === 'TPU+' ? 'selected' : ''}>TPU+</option>
                  <option value="PLA Silk" ${it.material === 'PLA Silk' ? 'selected' : ''}>PLA Silk</option>
                </select>
              </td>
              <td><input class="form-input it-color" value="${escapeHtml(it.color)}" placeholder="Color" /></td>
              <td><input class="form-input it-qty" type="number" min="1" value="${it.quantity || 1}" /></td>
              <td><input class="form-input it-rate" type="number" min="0" value="${it.unitPrice || ''}" placeholder="0" /></td>
              <td style="text-align:center;">
                ${currentItems.length > 1 ? `
                  <button type="button" class="btn-icon btn-sm btn-del-row" data-index="${i}" style="color:var(--danger);" title="Remove">×</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  showModal({
    title: 'Create Production Order / Assembly',
    body: renderModalBody(),
    confirmText: 'Create Order',
    onConfirm: () => {
      const clientName = document.getElementById('ord-client')?.value.trim();
      const totalAmount = parseFloat(document.getElementById('ord-total')?.value);
      const stage = document.getElementById('ord-stage')?.value || 'in_queue';

      if (!clientName) { showToast('Client name is required', 'error'); return; }
      if (!totalAmount || totalAmount <= 0) { showToast('Enter a valid total amount', 'error'); return; }

      // Filter non-empty items
      const validItems = items.filter(it => it.name.trim()).map(it => ({
        id: 'it_' + Math.random().toString(36).slice(2, 7),
        name: it.name.trim(),
        material: it.material,
        color: it.color.trim(),
        quantity: parseInt(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice) || 0,
        subtotal: (parseInt(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0),
        status: 'queued',
      }));

      create('orders', {
        clientName,
        clientPhone: document.getElementById('ord-phone')?.value.trim() || '',
        clientGstin: document.getElementById('ord-gstin')?.value.trim() || '',
        description: document.getElementById('ord-desc')?.value.trim() || '',
        priority: document.getElementById('ord-priority')?.value || 'standard',
        kanbanStage: stage,
        status: stage === 'quote' ? 'quote' : 'active',
        totalAmount,
        items: validItems,
        payments: [],
        notes: document.getElementById('ord-notes')?.value.trim() || '',
      });

      showToast(`Order created for ${clientName}!`, 'success');
      closeModal();
      render(container);
    },
    onReady: () => {
      function syncItemsFromInputs() {
        const rows = document.querySelectorAll('.item-builder-row');
        rows.forEach((row, i) => {
          if (!items[i]) return;
          items[i].name = row.querySelector('.it-name')?.value || '';
          items[i].material = row.querySelector('.it-mat')?.value || 'PLA+';
          items[i].color = row.querySelector('.it-color')?.value || '';
          items[i].quantity = parseInt(row.querySelector('.it-qty')?.value) || 1;
          items[i].unitPrice = parseFloat(row.querySelector('.it-rate')?.value) || 0;
          items[i].subtotal = items[i].quantity * items[i].unitPrice;
        });

        const totalSum = calculateItemsTotal();
        const sumDisplay = document.getElementById('items-sum-display');
        if (sumDisplay) sumDisplay.innerText = formatCurrency(totalSum);

        const totalInput = document.getElementById('ord-total');
        if (totalInput && totalSum > 0) totalInput.value = totalSum;
      }

      function attachRowListeners() {
        document.querySelectorAll('.item-builder-row input, .item-builder-row select').forEach(el => {
          el.addEventListener('input', syncItemsFromInputs);
        });

        document.querySelectorAll('.btn-del-row').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            syncItemsFromInputs();
            items.splice(idx, 1);
            document.getElementById('items-table-container').innerHTML = renderItemRows(items);
            attachRowListeners();
            syncItemsFromInputs();
          });
        });
      }

      document.getElementById('btn-add-item-row')?.addEventListener('click', () => {
        syncItemsFromInputs();
        items.push({ name: '', material: 'PETG-HS', color: '', quantity: 1, unitPrice: 0, subtotal: 0 });
        document.getElementById('items-table-container').innerHTML = renderItemRows(items);
        attachRowListeners();
        syncItemsFromInputs();
      });

      attachRowListeners();
    },
  });
}

// ─── Milestone Payment Modal ─────────────────────────────────
function openLogPaymentModal(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  const accounts = getAll('accounts');
  const stats = calcOrderStats(order);
  const remainingPct = Math.max(0, 100 - stats.paidPct);

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="text-secondary">Client</span>
        <strong>${escapeHtml(order.clientName)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="text-secondary">Contract Value</span>
        <strong>${formatCurrency(order.totalAmount)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="text-secondary">Already Paid</span>
        <span class="text-success" style="font-weight:600;">${formatCurrency(stats.paidAmount)} (${stats.paidPct.toFixed(1)}%)</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span class="text-secondary">Remaining</span>
        <span class="text-warning" style="font-weight:600;">${formatCurrency(stats.remaining)} (${remainingPct.toFixed(1)}%)</span>
      </div>
      <div class="order-progress-bar-track" style="margin-top:10px;">
        <div class="order-progress-bar-fill" style="width:${stats.paidPct}%;background:var(--accent-gradient);"></div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Payment Date</label>
      <input class="form-input" type="date" id="pay-date" value="${todayStr()}" />
    </div>

    <div class="form-group">
      <label class="form-label">Deposit Into Account (Automatic Inflow) *</label>
      <select class="form-select" id="pay-account">
        ${accounts.map(a => `<option value="${a.id}" ${a.isPrimary ? 'selected' : ''}>${escapeHtml(a.name)} (${formatCurrency(getAccountBalance(a.id).balance)})</option>`).join('')}
      </select>
      <div class="text-muted" style="font-size:0.72rem;margin-top:3px;">Live balance of this account will automatically increase upon confirmation.</div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Milestone Percentage (%)</label>
        <input class="form-input" type="number" id="pay-pct" min="0.1" max="${remainingPct.toFixed(2)}" step="0.1" placeholder="e.g. 28" />
        <div class="text-muted" style="font-size:0.72rem;margin-top:4px;">Remaining: ${remainingPct.toFixed(1)}%</div>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input class="form-input" type="number" id="pay-amount" min="0.01" step="0.01" placeholder="Auto-calculated" />
        <div class="text-muted" style="font-size:0.72rem;margin-top:4px;">Max: ${formatCurrency(stats.remaining)}</div>
      </div>
    </div>

    <button class="btn btn-secondary btn-sm w-full" id="pay-fill-remaining" style="margin-bottom:var(--space-md);">
      Pay Remaining (${remainingPct.toFixed(1)}% = ${formatCurrency(stats.remaining)})
    </button>

    <div class="form-group">
      <label class="form-label">Payment Mode / Reference Notes</label>
      <input class="form-input" id="pay-notes" placeholder="e.g. UPI Ref #4829, Cash advance..." />
    </div>
  `;

  showModal({
    title: 'Log Milestone Installment Payment',
    body,
    confirmText: 'Log Payment & Record Ledger',
    onConfirm: () => {
      const percentage = parseFloat(document.getElementById('pay-pct')?.value);
      const amount = parseFloat(document.getElementById('pay-amount')?.value);
      const date = document.getElementById('pay-date')?.value || todayStr();
      const notes = document.getElementById('pay-notes')?.value.trim() || '';
      const accountId = document.getElementById('pay-account')?.value || 'acc1';

      if ((!percentage || percentage <= 0) && (!amount || amount <= 0)) {
        showToast('Enter a percentage or amount', 'error');
        return;
      }

      const finalPct = percentage > 0 ? percentage : (amount / order.totalAmount) * 100;
      const finalAmt = amount > 0 ? amount : (order.totalAmount * percentage / 100);

      if (finalAmt > stats.remaining + 0.05) {
        showToast(`Amount exceeds remaining (${formatCurrency(stats.remaining)})`, 'error');
        return;
      }

      const payment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        percentage: Math.round(finalPct * 10) / 10,
        amount: Math.round(finalAmt * 100) / 100,
        notes,
        accountId,
      };

      const updatedPayments = [...(order.payments || []), payment];
      const newPaidTotal = updatedPayments.reduce((s, p) => s + p.amount, 0);
      const isFullyPaid = newPaidTotal >= order.totalAmount - 0.05;

      update('orders', orderId, {
        payments: updatedPayments,
        status: isFullyPaid ? 'completed' : 'active',
        kanbanStage: isFullyPaid ? 'completed' : (order.kanbanStage === 'quote' ? 'advance_paid' : order.kanbanStage),
      });

      // Auto-create Ledger Sale Transaction
      const pctLabel = Math.round(finalPct) + '%';
      create('transactions', {
        date,
        description: `${order.clientName} (${pctLabel})`,
        type: 'sale',
        category: 'Sale',
        amount: Math.round(finalAmt * 100) / 100,
        notes: `Order milestone payment: ${pctLabel} of ${formatCurrency(order.totalAmount)}. ${notes}`.trim(),
        orderId: orderId,
        accountId: accountId,
      });

      if (isFullyPaid) {
        showToast(`🎉 ${order.clientName} — 100% fully settled!`, 'success');
      } else {
        showToast(`Milestone payment logged: +${formatCurrency(finalAmt)} (${pctLabel})`, 'success');
      }

      closeModal();
      _expandedOrderId = orderId;
      render(container);
    },
    onReady: () => {
      const pctInput = document.getElementById('pay-pct');
      const amtInput = document.getElementById('pay-amount');
      const fillBtn = document.getElementById('pay-fill-remaining');

      let _syncing = false;
      pctInput?.addEventListener('input', () => {
        if (_syncing) return;
        _syncing = true;
        const pct = parseFloat(pctInput.value);
        amtInput.value = pct > 0 ? (order.totalAmount * pct / 100).toFixed(2) : '';
        _syncing = false;
      });

      amtInput?.addEventListener('input', () => {
        if (_syncing) return;
        _syncing = true;
        const amt = parseFloat(amtInput.value);
        pctInput.value = amt > 0 ? ((amt / order.totalAmount) * 100).toFixed(1) : '';
        _syncing = false;
      });

      fillBtn?.addEventListener('click', () => {
        pctInput.value = remainingPct.toFixed(1);
        amtInput.value = stats.remaining.toFixed(2);
      });
    },
  });
}

// ─── GST Tax Invoice Generator Modal (Overhauled) ─────────────
function openInvoiceModal(orderId) {
  const order = getById('orders', orderId);
  if (!order) return;

  const stats = calcOrderStats(order);
  const items = order.items && order.items.length > 0 ? order.items : [
    { name: order.description || '3D Printing & Prototyping Services', material: 'FDM Polymer', color: 'Standard', quantity: 1, unitPrice: order.totalAmount, subtotal: order.totalAmount }
  ];

  const invoiceNum = `INV-2026-${(order.id || '0000').slice(-4).toUpperCase()}`;
  const invoiceDate = todayStr();
  const upiVpa = 'siddhant@upi';
  let _taxMode = 'intra';
  let _discount = 0;
  let _delivery = 0;

  function calculateGrand() {
    const sub = order.totalAmount;
    const taxable = Math.max(0, sub - _discount);
    let taxAmt = 0;
    if (_taxMode === 'intra' || _taxMode === 'inter') {
      taxAmt = taxable * 0.18;
    }
    return (taxable + taxAmt + _delivery).toFixed(2);
  }

  const initialGrand = calculateGrand();
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent('Made N More 3D Printing Labs')}&am=${initialGrand}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNum}`)}`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(upiUrl)}`;

  const body = `
    <!-- Top Configuration Bar (Hidden during Print) -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:12px;font-size:0.82rem;">
          <span style="font-weight:700;color:var(--text-primary);">Tax Mode:</span>
          <label style="cursor:pointer;display:flex;align-items:center;gap:4px;">
            <input type="radio" name="inv-tax-mode" value="intra" checked /> Intra-State (CGST 9% + SGST 9%)
          </label>
          <label style="cursor:pointer;display:flex;align-items:center;gap:4px;">
            <input type="radio" name="inv-tax-mode" value="inter" /> Inter-State (IGST 18%)
          </label>
          <label style="cursor:pointer;display:flex;align-items:center;gap:4px;">
            <input type="radio" name="inv-tax-mode" value="none" /> Exempt / Inclusive
          </label>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="btn-print-inv">
            ${ICONS.printer} Print / Save A4 PDF
          </button>
        </div>
      </div>

      <!-- Quick Adjustments -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:10px;font-size:0.8rem;border-top:1px solid var(--border);padding-top:10px;">
        <div>
          <label style="color:var(--text-secondary);display:block;margin-bottom:2px;">Client GSTIN / Tax ID:</label>
          <input class="form-input" id="inv-client-gstin" placeholder="e.g. 27ABCDE1234F1Z5" value="${escapeHtml(order.clientGstin || '')}" style="font-size:0.8rem;padding:4px 8px;" />
        </div>
        <div>
          <label style="color:var(--text-secondary);display:block;margin-bottom:2px;">Special Discount (₹):</label>
          <input class="form-input" type="number" id="inv-discount-input" min="0" value="0" style="font-size:0.8rem;padding:4px 8px;" />
        </div>
        <div>
          <label style="color:var(--text-secondary);display:block;margin-bottom:2px;">Delivery / Courier (₹):</label>
          <input class="form-input" type="number" id="inv-delivery-input" min="0" value="0" style="font-size:0.8rem;padding:4px 8px;" />
        </div>
      </div>
    </div>

    <!-- Printable Invoice Sheet -->
    <div class="invoice-sheet" id="invoice-sheet-container">
      <div class="invoice-header">
        <div style="display:flex;align-items:center;gap:16px;">
          <img src="/Logo/logo.png" alt="Made N More Logo" style="height:65px;width:auto;object-fit:contain;" />
          <div>
            <div class="invoice-brand" style="font-size:1.4rem;font-weight:900;letter-spacing:-0.5px;color:#1e1b4b;margin:0;line-height:1.1;">MADE N MORE</div>
            <div class="invoice-subbrand" style="color:#7c3aed;font-weight:700;font-size:0.75rem;letter-spacing:0.8px;">3D PRINTING LABS • DIGITAL MANUFACTURING HUB</div>
            <div style="font-size:0.78rem;color:#4b5563;margin-top:4px;line-height:1.35;">
              Pune, Maharashtra, India • High-Speed Rapid Prototyping<br/>
              GSTIN: <strong>27AABCU9603R1ZM</strong> • State Code: <strong>27</strong><br/>
              Email: contact@madenmore.in • Web: madenmore.in
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="invoice-meta-title">TAX INVOICE</div>
          <div style="font-size:0.95rem;color:#374151;font-weight:700;"># ${invoiceNum}</div>
          <div style="font-size:0.8rem;color:#6b7280;margin-top:2px;">Date: ${formatDate(invoiceDate)}</div>
          <div style="font-size:0.75rem;color:#6b7280;">Place of Supply: Maharashtra (27)</div>
        </div>
      </div>

      <div class="invoice-details-grid">
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
          <strong style="color:#111827;display:block;margin-bottom:4px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">BILLED TO:</strong>
          <div style="font-weight:700;font-size:1.05rem;color:#111827;">${escapeHtml(order.clientName)}</div>
          ${order.clientPhone ? `<div style="color:#4b5563;font-size:0.82rem;margin-top:2px;">Contact: ${escapeHtml(order.clientPhone)}</div>` : ''}
          ${order.clientEmail ? `<div style="color:#4b5563;font-size:0.82rem;">Email: ${escapeHtml(order.clientEmail)}</div>` : ''}
          <div id="inv-disp-client-gstin" style="color:#4b5563;font-size:0.82rem;font-weight:600;margin-top:2px;">
            ${order.clientGstin ? `GSTIN: ${escapeHtml(order.clientGstin)}` : 'Consumer / B2C Non-GST'}
          </div>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
          <strong style="color:#111827;display:block;margin-bottom:4px;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;">SERVICE & PRODUCTION CLASSIFICATION:</strong>
          <div style="color:#374151;font-size:0.85rem;">Fabrication: <strong>High-Precision FDM 3D Printing</strong></div>
          <div style="color:#4b5563;font-size:0.82rem;margin-top:2px;">Service Accounting Code (SAC): <strong>9988</strong></div>
          <div style="color:#4b5563;font-size:0.82rem;">Harmonized System Code (HSN): <strong>3916</strong> (Polymers)</div>
          <div style="color:#4b5563;font-size:0.82rem;">Contract Milestone: <strong>${order.kanbanStage ? order.kanbanStage.replace(/_/g, ' ').toUpperCase() : 'PRODUCTION'}</strong></div>
        </div>
      </div>

      <!-- Line Items Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:5%;">#</th>
            <th style="width:45%;">Item / Part Specifications</th>
            <th style="width:15%;">Material & Finish</th>
            <th style="width:10%;text-align:center;">Qty</th>
            <th style="width:12%;text-align:right;">Rate</th>
            <th style="width:13%;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${escapeHtml(it.name)}</strong></td>
              <td>${it.material || 'PLA+'} ${it.color ? `(${escapeHtml(it.color)})` : ''}</td>
              <td style="text-align:center;">${it.quantity || 1}</td>
              <td style="text-align:right;">${formatCurrency(it.unitPrice || 0)}</td>
              <td style="text-align:right;font-weight:600;">${formatCurrency(it.subtotal || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals, Milestones & UPI Payment QR -->
      <div class="invoice-totals-section">
        <!-- UPI QR Scan Card -->
        <div class="upi-payment-card">
          <img src="${qrImgUrl}" alt="UPI QR Code" class="upi-qr-img" id="inv-upi-qr" />
          <div>
            <div style="font-size:0.75rem;font-weight:800;color:#1e1b4b;text-transform:uppercase;letter-spacing:0.5px;">Instant UPI Payment</div>
            <div style="font-size:1.15rem;font-weight:800;color:#16a34a;margin-top:2px;" id="inv-upi-amount">₹${initialGrand}</div>
            <div style="font-size:0.72rem;color:#4b5563;margin-top:2px;">Scan with GPay, PhonePe, Paytm, or BHIM</div>
            <div style="font-size:0.7rem;color:#374151;margin-top:4px;">UPI VPA: <strong style="color:#4338ca;">${upiVpa}</strong></div>
          </div>
        </div>

        <!-- Totals Calculation Table -->
        <div style="min-width:300px;">
          <table class="invoice-totals-table" style="width:100%;">
            <tr>
              <td style="color:#6b7280;">Subtotal:</td>
              <td style="text-align:right;font-weight:600;" id="inv-subtotal">${formatCurrency(order.totalAmount)}</td>
            </tr>
            <tr id="inv-row-discount" style="display:none;color:#16a34a;">
              <td>Discount:</td>
              <td style="text-align:right;" id="inv-discount-val">-₹0</td>
            </tr>
            <tr id="inv-tax-row-cgst">
              <td style="color:#6b7280;">CGST (9%):</td>
              <td style="text-align:right;" id="inv-cgst">${formatCurrency(order.totalAmount * 0.09)}</td>
            </tr>
            <tr id="inv-tax-row-sgst">
              <td style="color:#6b7280;">SGST (9%):</td>
              <td style="text-align:right;" id="inv-sgst">${formatCurrency(order.totalAmount * 0.09)}</td>
            </tr>
            <tr id="inv-tax-row-igst" style="display:none;">
              <td style="color:#6b7280;">IGST (18%):</td>
              <td style="text-align:right;" id="inv-igst">${formatCurrency(order.totalAmount * 0.18)}</td>
            </tr>
            <tr id="inv-row-delivery" style="display:none;color:#6b7280;">
              <td>Delivery / Courier:</td>
              <td style="text-align:right;" id="inv-delivery-val">+₹0</td>
            </tr>
            <tr class="invoice-totals-grand">
              <td>Total Payable:</td>
              <td style="text-align:right;color:#111827;" id="inv-grand-total">₹${initialGrand}</td>
            </tr>
          </table>

          <!-- Settlement status -->
          <div style="margin-top:10px;font-size:0.8rem;text-align:right;font-weight:600;color:${stats.remaining <= 0 ? '#16a34a' : '#ea580c'};">
            ${stats.remaining <= 0 ? '✓ Order 100% Fully Settled' : `Milestone Balance Due: ${formatCurrency(stats.remaining)}`}
          </div>
        </div>
      </div>

      <!-- Footer & Signature -->
      <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:0.75rem;color:#6b7280;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div>Thank you for manufacturing with <strong>3D Printing Labs / Made N More</strong>!</div>
          <div style="margin-top:2px;">Standard FDM Industrial Dimensional Tolerances: ±0.20 mm</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;color:#111827;margin-bottom:28px;">For MADE N MORE</div>
          <div style="border-top:1px solid #9ca3af;padding-top:4px;display:inline-block;min-width:140px;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: `Tax Invoice & Billing — ${escapeHtml(order.clientName)}`,
    body,
    confirmText: 'Close',
    modalClass: 'modal-invoice-wide',
    onReady: () => {
      document.getElementById('btn-print-inv')?.addEventListener('click', () => {
        window.print();
      });

      function recalculateInvoice() {
        const sub = order.totalAmount;
        _discount = parseFloat(document.getElementById('inv-discount-input')?.value) || 0;
        _delivery = parseFloat(document.getElementById('inv-delivery-input')?.value) || 0;
        const taxable = Math.max(0, sub - _discount);

        const cgstRow = document.getElementById('inv-tax-row-cgst');
        const sgstRow = document.getElementById('inv-tax-row-sgst');
        const igstRow = document.getElementById('inv-tax-row-igst');
        const discRow = document.getElementById('inv-row-discount');
        const delRow = document.getElementById('inv-row-delivery');
        const grandEl = document.getElementById('inv-grand-total');
        const upiAmtEl = document.getElementById('inv-upi-amount');
        const upiQrImg = document.getElementById('inv-upi-qr');

        if (_discount > 0) {
          discRow.style.display = '';
          document.getElementById('inv-discount-val').textContent = `-₹${_discount.toFixed(2)}`;
        } else {
          discRow.style.display = 'none';
        }

        if (_delivery > 0) {
          delRow.style.display = '';
          document.getElementById('inv-delivery-val').textContent = `+₹${_delivery.toFixed(2)}`;
        } else {
          delRow.style.display = 'none';
        }

        let taxAmt = 0;
        if (_taxMode === 'intra') {
          cgstRow.style.display = '';
          sgstRow.style.display = '';
          igstRow.style.display = 'none';
          document.getElementById('inv-cgst').textContent = formatCurrency(taxable * 0.09);
          document.getElementById('inv-sgst').textContent = formatCurrency(taxable * 0.09);
          taxAmt = taxable * 0.18;
        } else if (_taxMode === 'inter') {
          cgstRow.style.display = 'none';
          sgstRow.style.display = 'none';
          igstRow.style.display = '';
          document.getElementById('inv-igst').textContent = formatCurrency(taxable * 0.18);
          taxAmt = taxable * 0.18;
        } else {
          cgstRow.style.display = 'none';
          sgstRow.style.display = 'none';
          igstRow.style.display = 'none';
          taxAmt = 0;
        }

        const totalPayable = (taxable + taxAmt + _delivery).toFixed(2);
        grandEl.textContent = `₹${totalPayable}`;
        if (upiAmtEl) upiAmtEl.textContent = `₹${totalPayable}`;

        if (upiQrImg) {
          const newUpiUrl = `upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=${encodeURIComponent('Made N More 3D Printing Labs')}&am=${totalPayable}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNum}`)}`;
          upiQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(newUpiUrl)}`;
        }
      }

      document.querySelectorAll('input[name="inv-tax-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          _taxMode = e.target.value;
          recalculateInvoice();
        });
      });

      document.getElementById('inv-discount-input')?.addEventListener('input', recalculateInvoice);
      document.getElementById('inv-delivery-input')?.addEventListener('input', recalculateInvoice);

      document.getElementById('inv-client-gstin')?.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        const disp = document.getElementById('inv-disp-client-gstin');
        if (disp) {
          disp.textContent = val ? `GSTIN: ${val}` : 'Consumer / B2C Non-GST';
        }
      });
    },
  });
}

// ─── Milestone Receipt Voucher Modal ─────────────────────────
function openReceiptModal(orderId, paymentId) {
  const order = getById('orders', orderId);
  if (!order) return;

  const payments = order.payments || [];
  const payment = payments.find(p => p.id === paymentId) || payments[paymentId] || payments[0];
  if (!payment) return;

  const stats = calcOrderStats(order);
  const receiptNum = `REC-${(order.id || '0000').slice(-4).toUpperCase()}-${(payment.id || '1').slice(-4).toUpperCase()}`;

  const body = `
    <div style="margin-bottom:var(--space-md);text-align:right;">
      <button class="btn btn-primary btn-sm" id="btn-print-rec">
        ${ICONS.printer} Print Receipt
      </button>
    </div>

    <div class="receipt-sheet" id="receipt-sheet-container">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/Logo/logo.png" alt="Made N More Logo" style="height:50px;width:auto;object-fit:contain;" />
          <div>
            <div style="font-size:1.15rem;font-weight:800;letter-spacing:-0.5px;color:#1e1b4b;">MADE N MORE • 3D PRINTING LABS</div>
            <div style="font-size:0.75rem;color:#4b5563;">Digital Manufacturing & Milestone Accounting • Pune, India</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:800;font-size:0.95rem;color:#111827;">PAYMENT VOUCHER</div>
          <div style="font-size:0.78rem;color:#6b7280;"># ${receiptNum}</div>
        </div>
      </div>

      <div style="font-size:0.85rem;line-height:1.7;margin-bottom:16px;">
        <div>Received with thanks from: <strong>${escapeHtml(order.clientName)}</strong></div>
        <div>Date of Receipt: <strong>${formatDate(payment.date)}</strong></div>
        <div>Installment Milestone: <span style="font-weight:700;color:#6366f1;">${(payment.percentage || 0).toFixed(1)}% of Contract</span></div>
        <div>Amount Received: <span style="font-size:1.15rem;font-weight:800;color:#16a34a;">${formatCurrency(payment.amount)}</span></div>
        <div>Reference / Notes: <em>${escapeHtml(payment.notes || 'Milestone Installment')}</em></div>
      </div>

      <div style="background:#f3f4f6;border-radius:6px;padding:10px 14px;font-size:0.8rem;display:flex;justify-content:space-between;">
        <span>Contract Total: <strong>${formatCurrency(order.totalAmount)}</strong></span>
        <span>Cumulative Paid: <strong>${formatCurrency(stats.paidAmount)} (${stats.paidPct.toFixed(0)}%)</strong></span>
        <span>Balance Due: <strong style="color:#ea580c;">${formatCurrency(stats.remaining)}</strong></span>
      </div>

      <div style="margin-top:16px;text-align:right;font-size:0.75rem;color:#6b7280;">
        Authorized Electronic Voucher • Made N More Operations
      </div>
    </div>
  `;

  showModal({
    title: 'Milestone Payment Receipt',
    body,
    confirmText: 'Close',
    onReady: () => {
      document.getElementById('btn-print-rec')?.addEventListener('click', () => {
        window.print();
      });
    },
  });
}

// ─── Convert Quote to Order ──────────────────────────────────
function convertQuoteToOrder(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  showModal({
    title: 'Convert Quotation to Active Order',
    body: `
      <p>Convert <strong>${escapeHtml(order.clientName)}</strong>'s formal quotation of <strong>${formatCurrency(order.totalAmount)}</strong> into an active production job?</p>
      <div style="margin-top:12px;background:var(--info-bg);padding:12px;border-radius:var(--radius-md);font-size:0.82rem;color:var(--info);">
        💡 This will update the stage to <strong>Advance Paid / In Queue</strong> and allow you to log milestone installment payments.
      </div>
    `,
    confirmText: 'Convert & Begin Production',
    onConfirm: () => {
      update('orders', orderId, {
        status: 'active',
        kanbanStage: 'advance_paid',
      });
      showToast(`Quotation converted! Ready for production.`, 'success');
      closeModal();
      render(container);
    },
  });
}

// ─── Edit Order Modal ────────────────────────────────────────
function openEditOrderModal(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Client / Person Name *</label>
        <input class="form-input" id="ord-edit-client" value="${escapeHtml(order.clientName)}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Contact Phone</label>
        <input class="form-input" id="ord-edit-phone" value="${escapeHtml(order.clientPhone || '')}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-select" id="ord-edit-priority">
          <option value="standard" ${order.priority === 'standard' ? 'selected' : ''}>Standard</option>
          <option value="express" ${order.priority === 'express' ? 'selected' : ''}>Express 48h</option>
          <option value="overnight" ${order.priority === 'overnight' ? 'selected' : ''}>Overnight 24h</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Production Stage</label>
        <select class="form-select" id="ord-edit-stage">
          ${KANBAN_STAGES.map(s => `
            <option value="${s.id}" ${getOrderStage(order) === s.id ? 'selected' : ''}>${s.label}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" id="ord-edit-desc" value="${escapeHtml(order.description || '')}" />
    </div>

    <div class="form-group">
      <label class="form-label">Total Contract Amount (₹) *</label>
      <input class="form-input" type="number" id="ord-edit-total" min="1" step="0.01" value="${order.totalAmount}" required />
    </div>

    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="ord-edit-notes">${escapeHtml(order.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: 'Edit Order & Specs',
    body,
    confirmText: 'Save Changes',
    onConfirm: () => {
      const clientName = document.getElementById('ord-edit-client')?.value.trim();
      const totalAmount = parseFloat(document.getElementById('ord-edit-total')?.value);
      const stage = document.getElementById('ord-edit-stage')?.value || 'in_queue';

      if (!clientName || !totalAmount || totalAmount <= 0) {
        showToast('Fill in required fields', 'error');
        return;
      }

      update('orders', orderId, {
        clientName,
        clientPhone: document.getElementById('ord-edit-phone')?.value.trim() || '',
        priority: document.getElementById('ord-edit-priority')?.value || 'standard',
        kanbanStage: stage,
        status: stage === 'completed' ? 'completed' : stage === 'quote' ? 'quote' : 'active',
        description: document.getElementById('ord-edit-desc')?.value.trim() || '',
        totalAmount,
        notes: document.getElementById('ord-edit-notes')?.value.trim() || '',
      });

      showToast('Order updated!', 'success');
      closeModal();
      render(container);
    },
  });
}

function confirmDeleteOrder(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  showModal({
    title: 'Delete Order',
    body: `<p>Delete <strong>${escapeHtml(order.clientName)}</strong>'s order?</p>
           <p class="text-danger" style="margin-top:8px;font-size:0.85rem;font-weight:600;">
             This removes the order, assemblies, and payment history. Linked financial ledger transactions will remain.
           </p>`,
    confirmText: 'Delete Order',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      remove('orders', orderId);
      showToast('Order deleted', 'warning');
      closeModal();
      if (_expandedOrderId === orderId) _expandedOrderId = null;
      render(container);
    },
  });
}

// ─── Printable Workshop Job Traveler Card for Orders ──────────
function openOrderJobTravelerModal(orderId) {
  const order = getById('orders', orderId);
  if (!order) return;

  const items = order.items || [];
  const priority = PRIORITY_CONFIG[order.priority || 'standard'] || PRIORITY_CONFIG.standard;
  const stage = getOrderStage(order);
  const stageObj = KANBAN_STAGES.find(s => s.id === stage) || KANBAN_STAGES[3];

  const body = `
    <div class="traveler-sheet">
      <!-- Header -->
      <div class="traveler-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/Logo/logo.png" alt="Made N More Logo" style="height:48px;width:auto;object-fit:contain;" />
          <div>
            <div style="font-size:1.25rem;font-weight:800;letter-spacing:-0.5px;color:#1e1b4b;">MADE N MORE | 3D PRINTING LABS</div>
            <div style="font-size:0.78rem;color:#444;margin-top:2px;">WORKSHOP MANUFACTURING JOB TRAVELER & QC ROUTER</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.05rem;font-weight:700;">ORDER #${order.id.slice(0, 8).toUpperCase()}</div>
          <div style="font-size:0.78rem;color:#555;">Date: ${formatDate(order.createdAt || new Date())}</div>
        </div>
      </div>

      <!-- Specification Grid -->
      <div class="traveler-grid">
        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;">
          <div style="font-size:0.75rem;font-weight:700;color:#666;text-transform:uppercase;">Client & Project</div>
          <div style="font-size:0.95rem;font-weight:700;margin-top:4px;">${escapeHtml(order.clientName)}</div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Contact: ${escapeHtml(order.clientPhone || '—')}</div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Project: ${escapeHtml(order.description || 'Custom 3D Printing')}</div>
        </div>

        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;">
          <div style="font-size:0.75rem;font-weight:700;color:#666;text-transform:uppercase;">Production Priority & Routing</div>
          <div style="font-size:0.95rem;font-weight:700;margin-top:4px;">Priority: ${priority.label.toUpperCase()}</div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Current Stage: <strong>${stageObj.label}</strong></div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Contract Value: <strong>${formatCurrency(order.totalAmount)}</strong></div>
        </div>
      </div>

      <!-- Itemized Assemblies / Components Table -->
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">PRODUCTION PARTS & MATERIAL SPECIFICATIONS</div>
      <table class="traveler-table">
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th>Part / Component Name</th>
            <th>Material Spec</th>
            <th>Colorway</th>
            <th style="text-align:center;">Qty</th>
            <th>Print Profile</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map((it, idx) => `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td><strong>${escapeHtml(it.name)}</strong></td>
              <td>${escapeHtml(it.material || 'PLA+')}</td>
              <td>${escapeHtml(it.color || 'Default')}</td>
              <td style="text-align:center;font-weight:700;">${it.quantity || 1}</td>
              <td>0.20mm Standard / 20% Infill</td>
              <td>[ &nbsp; ] Printed</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="7" style="text-align:center;color:#666;">No individual parts itemized. Refer to main order description.</td>
            </tr>
          `}
        </tbody>
      </table>

      <!-- Quality Control Sign-Off Table -->
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">POST-PRINT QUALITY INSPECTION & DISPATCH CHECKLIST</div>
      <table class="traveler-table">
        <thead>
          <tr>
            <th style="width:40px;">Check</th>
            <th>Inspection Parameter</th>
            <th>Acceptance Criteria</th>
            <th style="width:150px;">Verified By / Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Dimensional Accuracy</strong></td>
            <td>Critical dimensions within ±0.20mm (Digital Caliper)</td>
            <td>_____________ mm</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Mass & Density Audit</strong></td>
            <td>Finished weight within ±3% of sliced model grams</td>
            <td>_____________ g</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Layer Adhesion & Perimeter Bonding</strong></td>
            <td>Zero delamination, solid wall fusion</td>
            <td>Pass / Fail</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Surface Finish & Cosmetics</strong></td>
            <td>No stringing, z-banding, or severe scarring</td>
            <td>Pass / Fail</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Client Photo Proof</strong></td>
            <td>High-res photo sent to client via WhatsApp</td>
            <td>Timestamp: ______</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Packaging & Dispatch Label</strong></td>
            <td>Protective bubble-wrap & box sealed</td>
            <td>Courier / Tracking: ___</td>
          </tr>
        </tbody>
      </table>

      <!-- Operator Signature -->
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #ccc;font-size:0.82rem;">
        <div>Manufacturing Operator: _______________________</div>
        <div>QC Inspector Sign-off: _______________________</div>
      </div>
    </div>
  `;

  showModal({
    title: 'Print Workshop Job Traveler Card',
    body,
    confirmText: '🖨️ Print Sheet (Ctrl+P)',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      window.print();
    },
  });
}

