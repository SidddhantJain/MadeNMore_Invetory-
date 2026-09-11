/**
 * Made N More — Orders Page
 * Track client orders with partial/installment payment logging by percentage
 * Auto-creates transactions, tracks progress, tallies automatically
 */

import { getAll, create, update, remove, getById } from '../data/store.js';
import { formatCurrency, formatDate, formatDateInput, escapeHtml, todayStr } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let _expandedOrderId = null;
let _filterStatus = '';

export function renderOrders(container) {
  render(container);
}

function getFiltered() {
  let orders = getAll('orders');
  if (_filterStatus) orders = orders.filter(o => o.status === _filterStatus);
  // Sort: active first, then by most recent
  orders.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return orders;
}

function calcOrderStats(order) {
  const payments = order.payments || [];
  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const paidPct = order.totalAmount > 0 ? (paidAmount / order.totalAmount) * 100 : 0;
  const remaining = Math.max(0, order.totalAmount - paidAmount);
  const remainingPct = Math.max(0, 100 - paidPct);
  return { paidAmount, paidPct: Math.min(paidPct, 100), remaining, remainingPct };
}

function render(container) {
  const orders = getFiltered();
  const allOrders = getAll('orders');
  const activeOrders = allOrders.filter(o => o.status === 'active');
  const totalOutstanding = activeOrders.reduce((s, o) => {
    const stats = calcOrderStats(o);
    return s + stats.remaining;
  }, 0);
  const completedOrders = allOrders.filter(o => o.status === 'completed');

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Orders & Payments</h1>
        <p class="text-secondary">Track orders with partial payments — auto-calculates percentages and tallies</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" id="btn-new-order">
          <span class="nav-icon">${ICONS.plus}</span>
          New Order
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="card stat-card animate-in animate-delay-1">
        <div class="card-title">Active Orders</div>
        <div class="stat-value">${activeOrders.length}</div>
        <div class="stat-label">awaiting full payment</div>
      </div>
      <div class="card stat-card animate-in animate-delay-2">
        <div class="card-title">Outstanding Amount</div>
        <div class="stat-value text-warning">${formatCurrency(totalOutstanding)}</div>
        <div class="stat-label">remaining to collect</div>
      </div>
      <div class="card stat-card animate-in animate-delay-3">
        <div class="card-title">Completed</div>
        <div class="stat-value text-success">${completedOrders.length}</div>
        <div class="stat-label">orders fully paid</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="toolbar animate-in animate-delay-2">
      <div class="toolbar-left">
        <select class="filter-select" id="order-filter-status">
          <option value="" ${_filterStatus === '' ? 'selected' : ''}>All Orders</option>
          <option value="active" ${_filterStatus === 'active' ? 'selected' : ''}>Active</option>
          <option value="completed" ${_filterStatus === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${_filterStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
      <div class="toolbar-right">
        <span class="text-muted" style="font-size:0.82rem;">${orders.length} orders</span>
      </div>
    </div>

    <!-- Orders List -->
    <div class="orders-list animate-in animate-delay-3">
      ${orders.length > 0 ? orders.map(o => renderOrderCard(o)).join('') :
        `<div class="empty-state"><div class="empty-state-icon">${ICONS.order}</div>
          <p>No orders yet. Create your first order to start tracking partial payments!</p>
        </div>`
      }
    </div>
  `;

  bindEvents(container);
}

function renderOrderCard(order) {
  const stats = calcOrderStats(order);
  const payments = order.payments || [];
  const isExpanded = _expandedOrderId === order.id;
  const statusColors = {
    active: 'badge-status-active',
    completed: 'badge-status-completed',
    cancelled: 'badge-no',
  };

  return `
    <div class="card order-card ${isExpanded ? 'order-expanded' : ''}" data-order-id="${order.id}" style="margin-bottom:var(--space-md);">
      <!-- Order Header -->
      <div class="order-card-header" data-toggle-order="${order.id}">
        <div class="order-card-left">
          <div class="order-client-avatar">${(order.clientName || '?')[0].toUpperCase()}</div>
          <div>
            <div class="order-client-name">${escapeHtml(order.clientName)}</div>
            <div class="order-desc">${escapeHtml(order.description || '—')}</div>
          </div>
        </div>
        <div class="order-card-right">
          <span class="badge ${statusColors[order.status] || 'badge-status-active'}">${order.status}</span>
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
          ${order.status === 'active' ? `
            <button class="btn btn-primary btn-sm" data-action="log-payment" data-id="${order.id}">
              ${ICONS.plus} Log Payment
            </button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" data-toggle-order="${order.id}">
            ${payments.length} payment${payments.length !== 1 ? 's' : ''} ${isExpanded ? '▲' : '▼'}
          </button>
        </div>
        <div class="flex gap-sm">
          <button class="btn-icon btn-sm" data-action="edit-order" data-id="${order.id}" title="Edit order">${ICONS.edit}</button>
          ${order.status === 'active' ? `
            <button class="btn-icon btn-sm" data-action="complete-order" data-id="${order.id}" title="Mark complete" style="color:var(--success)">${ICONS.check}</button>
          ` : ''}
          <button class="btn-icon btn-sm" data-action="delete-order" data-id="${order.id}" title="Delete" style="color:var(--danger)">${ICONS.trash}</button>
        </div>
      </div>

      <!-- Expanded: Payment History -->
      ${isExpanded ? `
        <div class="order-payments-section">
          <div class="order-payments-header">
            <span class="card-title">Payment History</span>
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
                      </tr>
                    `;
                  }).join('');
                })()}
              </tbody>
            </table>
          ` : '<p class="text-muted" style="padding:var(--space-md);font-size:0.85rem;">No payments logged yet.</p>'}
        </div>
      ` : ''}
    </div>
  `;
}

function bindEvents(container) {
  // New order
  container.querySelector('#btn-new-order')?.addEventListener('click', () => openNewOrderModal(container));

  // Filter
  container.querySelector('#order-filter-status')?.addEventListener('change', (e) => {
    _filterStatus = e.target.value;
    render(container);
  });

  // Toggle expand
  container.querySelectorAll('[data-toggle-order]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return; // Don't toggle when clicking action buttons
      const orderId = el.dataset.toggleOrder;
      _expandedOrderId = _expandedOrderId === orderId ? null : orderId;
      render(container);
    });
  });

  // Action buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'log-payment') openLogPaymentModal(id, container);
      else if (action === 'edit-order') openEditOrderModal(id, container);
      else if (action === 'complete-order') markOrderComplete(id, container);
      else if (action === 'delete-order') confirmDeleteOrder(id, container);
    });
  });
}

// ─── New Order Modal ─────────────────────────────────────────
function openNewOrderModal(container) {
  const body = `
    <div class="form-group">
      <label class="form-label">Client / Person Name *</label>
      <input class="form-input" id="ord-client" placeholder="e.g. Product Designer, Saurab" required />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" id="ord-desc" placeholder="e.g. Custom 3D printed figures set" />
    </div>
    <div class="form-group">
      <label class="form-label">Total Order Amount (₹) *</label>
      <input class="form-input" type="number" id="ord-total" min="1" step="0.01" placeholder="e.g. 6750" required />
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="ord-notes" placeholder="Optional notes..."></textarea>
    </div>

    <div style="background:var(--info-bg);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-md);padding:12px;margin-top:var(--space-sm);">
      <p style="font-size:0.82rem;color:var(--info);">
        <strong>💡 How it works:</strong> Create the order with the total amount. Then log each payment by percentage — the app auto-calculates the amount, creates a transaction, and tracks progress to 100%.
      </p>
    </div>
  `;

  showModal({
    title: 'Create New Order',
    body,
    confirmText: 'Create Order',
    onConfirm: () => {
      const clientName = document.getElementById('ord-client')?.value.trim();
      const totalAmount = parseFloat(document.getElementById('ord-total')?.value);

      if (!clientName) { showToast('Client name is required', 'error'); return; }
      if (!totalAmount || totalAmount <= 0) { showToast('Enter a valid total amount', 'error'); return; }

      create('orders', {
        clientName,
        description: document.getElementById('ord-desc')?.value.trim() || '',
        totalAmount,
        status: 'active',
        payments: [],
        notes: document.getElementById('ord-notes')?.value.trim() || '',
      });

      showToast(`Order created for ${clientName}!`, 'success');
      closeModal();
      render(container);
    },
  });
}

// ─── Log Payment Modal ───────────────────────────────────────
function openLogPaymentModal(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  const stats = calcOrderStats(order);
  const remainingPct = Math.max(0, 100 - stats.paidPct);

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="text-secondary">Client</span>
        <strong>${escapeHtml(order.clientName)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span class="text-secondary">Total Order</span>
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

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Percentage (%)</label>
        <input class="form-input" type="number" id="pay-pct" min="0.1" max="${remainingPct.toFixed(2)}" step="0.1" placeholder="e.g. 28" />
        <div class="text-muted" style="font-size:0.72rem;margin-top:4px;">Max: ${remainingPct.toFixed(1)}%</div>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input class="form-input" type="number" id="pay-amount" min="0.01" step="0.01" placeholder="Auto-calculated" />
        <div class="text-muted" style="font-size:0.72rem;margin-top:4px;">Max: ${formatCurrency(stats.remaining)}</div>
      </div>
    </div>

    <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);border-radius:var(--radius-md);padding:12px;margin-bottom:var(--space-sm);">
      <p style="font-size:0.82rem;color:var(--accent);">
        💡 Enter <strong>percentage</strong> or <strong>amount</strong> — the other will auto-calculate. Use the "Pay Remaining" button to fill in what's left.
      </p>
    </div>

    <button class="btn btn-secondary btn-sm w-full" id="pay-fill-remaining" style="margin-bottom:var(--space-md);">
      Pay Remaining (${remainingPct.toFixed(1)}% = ${formatCurrency(stats.remaining)})
    </button>

    <div class="form-group">
      <label class="form-label">Notes</label>
      <input class="form-input" id="pay-notes" placeholder="e.g. Cash payment, UPI, etc." />
    </div>
  `;

  showModal({
    title: 'Log Payment',
    body,
    confirmText: 'Log Payment & Create Transaction',
    onConfirm: () => {
      const percentage = parseFloat(document.getElementById('pay-pct')?.value);
      const amount = parseFloat(document.getElementById('pay-amount')?.value);
      const date = document.getElementById('pay-date')?.value || todayStr();
      const notes = document.getElementById('pay-notes')?.value.trim() || '';

      if ((!percentage || percentage <= 0) && (!amount || amount <= 0)) {
        showToast('Enter a percentage or amount', 'error');
        return;
      }

      // Resolve final values
      const finalPct = percentage > 0 ? percentage : (amount / order.totalAmount) * 100;
      const finalAmt = amount > 0 ? amount : (order.totalAmount * percentage / 100);

      if (finalAmt > stats.remaining + 0.01) {
        showToast(`Amount exceeds remaining (${formatCurrency(stats.remaining)})`, 'error');
        return;
      }

      // Add payment to order
      const payment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        percentage: Math.round(finalPct * 10) / 10,
        amount: Math.round(finalAmt * 100) / 100,
        notes,
      };

      const updatedPayments = [...(order.payments || []), payment];
      const newPaidTotal = updatedPayments.reduce((s, p) => s + p.amount, 0);
      const isFullyPaid = newPaidTotal >= order.totalAmount - 0.01;

      update('orders', orderId, {
        payments: updatedPayments,
        status: isFullyPaid ? 'completed' : 'active',
      });

      // Auto-create transaction
      const pctLabel = Math.round(finalPct) + '%';
      create('transactions', {
        date,
        description: `${order.clientName} (${pctLabel})`,
        type: 'sale',
        category: 'Sale',
        amount: Math.round(finalAmt * 100) / 100,
        notes: `Order payment: ${pctLabel} of ${formatCurrency(order.totalAmount)}. ${notes}`.trim(),
        orderId: orderId,
      });

      if (isFullyPaid) {
        showToast(`🎉 ${order.clientName} — fully paid! Order complete.`, 'success');
      } else {
        const newStats = calcOrderStats({ ...order, payments: updatedPayments });
        showToast(`Payment logged: ${pctLabel} (${formatCurrency(finalAmt)}). Total: ${newStats.paidPct.toFixed(0)}% paid.`, 'success');
      }

      closeModal();
      _expandedOrderId = orderId;
      render(container);
    },
    onReady: () => {
      const pctInput = document.getElementById('pay-pct');
      const amtInput = document.getElementById('pay-amount');
      const fillBtn = document.getElementById('pay-fill-remaining');

      // Percentage → Amount auto-calc
      let _syncing = false;
      pctInput?.addEventListener('input', () => {
        if (_syncing) return;
        _syncing = true;
        const pct = parseFloat(pctInput.value);
        if (pct > 0) {
          amtInput.value = (order.totalAmount * pct / 100).toFixed(2);
        } else {
          amtInput.value = '';
        }
        _syncing = false;
      });

      // Amount → Percentage auto-calc
      amtInput?.addEventListener('input', () => {
        if (_syncing) return;
        _syncing = true;
        const amt = parseFloat(amtInput.value);
        if (amt > 0) {
          pctInput.value = ((amt / order.totalAmount) * 100).toFixed(1);
        } else {
          pctInput.value = '';
        }
        _syncing = false;
      });

      // Fill remaining
      fillBtn?.addEventListener('click', () => {
        pctInput.value = remainingPct.toFixed(1);
        amtInput.value = stats.remaining.toFixed(2);
      });
    },
  });
}

// ─── Edit Order Modal ────────────────────────────────────────
function openEditOrderModal(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Client / Person Name *</label>
      <input class="form-input" id="ord-edit-client" value="${escapeHtml(order.clientName)}" required />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-input" id="ord-edit-desc" value="${escapeHtml(order.description || '')}" />
    </div>
    <div class="form-group">
      <label class="form-label">Total Order Amount (₹) *</label>
      <input class="form-input" type="number" id="ord-edit-total" min="1" step="0.01" value="${order.totalAmount}" required />
    </div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-select" id="ord-edit-status">
        <option value="active" ${order.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="ord-edit-notes">${escapeHtml(order.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: 'Edit Order',
    body,
    confirmText: 'Save Changes',
    onConfirm: () => {
      const clientName = document.getElementById('ord-edit-client')?.value.trim();
      const totalAmount = parseFloat(document.getElementById('ord-edit-total')?.value);

      if (!clientName || !totalAmount || totalAmount <= 0) {
        showToast('Fill in required fields', 'error');
        return;
      }

      update('orders', orderId, {
        clientName,
        description: document.getElementById('ord-edit-desc')?.value.trim() || '',
        totalAmount,
        status: document.getElementById('ord-edit-status')?.value || 'active',
        notes: document.getElementById('ord-edit-notes')?.value.trim() || '',
      });

      showToast('Order updated!', 'success');
      closeModal();
      render(container);
    },
  });
}

function markOrderComplete(orderId, container) {
  const order = getById('orders', orderId);
  if (!order) return;

  showModal({
    title: 'Mark as Complete',
    body: `<p>Mark <strong>${escapeHtml(order.clientName)}</strong>'s order as fully completed?</p>
           <p class="text-muted" style="margin-top:8px;font-size:0.85rem;">This won't auto-log any remaining payment — it just changes the status.</p>`,
    confirmText: 'Mark Complete',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      update('orders', orderId, { status: 'completed' });
      showToast('Order marked as complete!', 'success');
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
             This removes the order and its payment history. Linked transactions will NOT be deleted.
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
