/**
 * Made N More — Transactions Page
 * Full ledger with add/edit/delete, filters, date range, running balance
 */

import { getAll, create, update, remove } from '../data/store.js';
import { TRANSACTION_CATEGORIES } from '../data/seed.js';
import { formatCurrency, formatDate, formatDateInput, escapeHtml, debounce, todayStr } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let _typeFilter = '';
let _categoryFilter = '';
let _searchQuery = '';
let _sortField = 'date';
let _sortDir = 'desc';

export function renderTransactions(container) {
  render(container);
}

function getFiltered() {
  let items = getAll('transactions');

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }
  if (_typeFilter) {
    items = items.filter(t => t.type === _typeFilter);
  }
  if (_categoryFilter) {
    items = items.filter(t => t.category === _categoryFilter);
  }

  items.sort((a, b) => {
    let valA = a[_sortField] ?? '';
    let valB = b[_sortField] ?? '';
    if (_sortField === 'amount') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    }
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return _sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return items;
}

function render(container) {
  const items = getFiltered();
  const allItems = getAll('transactions');

  const totalSales = allItems.filter(t => t.type === 'sale').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = allItems.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = totalSales - totalExpenses;

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Transactions</h1>
        <p class="text-secondary">Track all sales, expenses, and financial activity</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-add-expense">
          <span class="nav-icon" style="color:var(--danger)">${ICONS.sort}</span>
          Add Expense
        </button>
        <button class="btn btn-primary" id="btn-add-sale">
          <span class="nav-icon">${ICONS.plus}</span>
          Add Sale
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="card stat-card animate-in animate-delay-1">
        <div class="card-title">Total Sales</div>
        <div class="stat-value text-success">${formatCurrency(totalSales)}</div>
      </div>
      <div class="card stat-card animate-in animate-delay-2">
        <div class="card-title">Total Expenses</div>
        <div class="stat-value text-danger">${formatCurrency(totalExpenses)}</div>
      </div>
      <div class="card stat-card animate-in animate-delay-3">
        <div class="card-title">Net Balance</div>
        <div class="stat-value ${balance >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(balance)}</div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar animate-in animate-delay-2">
      <div class="toolbar-left">
        <div class="search-bar">
          <span class="search-icon">${ICONS.search}</span>
          <input type="text" id="txn-search" placeholder="Search transactions..." value="${escapeHtml(_searchQuery)}"/>
        </div>
        <select class="filter-select" id="txn-filter-type">
          <option value="">All Types</option>
          <option value="sale" ${_typeFilter === 'sale' ? 'selected' : ''}>Sales</option>
          <option value="expense" ${_typeFilter === 'expense' ? 'selected' : ''}>Expenses</option>
        </select>
        <select class="filter-select" id="txn-filter-category">
          <option value="">All Categories</option>
          ${TRANSACTION_CATEGORIES.map(c => `<option value="${c}" ${_categoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <span class="text-muted" style="font-size:0.82rem;">${items.length} entries</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container animate-in animate-delay-3">
      <table class="table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th data-sort="date" class="${_sortField === 'date' ? 'sorted' : ''}">Date <span class="sort-icon">↕</span></th>
            <th data-sort="description" class="${_sortField === 'description' ? 'sorted' : ''}">Description <span class="sort-icon">↕</span></th>
            <th>Type</th>
            <th>Category</th>
            <th data-sort="amount" class="${_sortField === 'amount' ? 'sorted' : ''}" style="text-align:right">Amount <span class="sort-icon">↕</span></th>
            <th style="width:100px">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map((t, i) => `
            <tr data-id="${t.id}">
              <td style="color:var(--text-muted)">${i + 1}</td>
              <td>${formatDate(t.date)}</td>
              <td>
                <span class="inline-editable" data-field="description" data-id="${t.id}">${escapeHtml(t.description || '—')}</span>
              </td>
              <td>
                <span class="badge ${t.type === 'sale' ? 'badge-yes' : 'badge-no'}">
                  ${t.type === 'sale' ? '↑ Sale' : '↓ Expense'}
                </span>
              </td>
              <td style="color:var(--text-secondary)">${escapeHtml(t.category || '—')}</td>
              <td class="text-right">
                <span class="${t.type === 'sale' ? 'text-success' : 'text-danger'}" style="font-weight:600;">
                  ${t.type === 'sale' ? '+' : '-'}${formatCurrency(t.amount)}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon" data-action="edit" data-id="${t.id}" title="Edit">${ICONS.edit}</button>
                  <button class="btn-icon" data-action="delete" data-id="${t.id}" title="Delete" style="color:var(--danger)">${ICONS.trash}</button>
                </div>
              </td>
            </tr>
          `).join('') : `
            <tr><td colspan="7">
              <div class="empty-state" style="padding:40px">
                <p>No transactions found. Start by adding a sale or expense.</p>
              </div>
            </td></tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  bindEvents(container);
}

function bindEvents(container) {
  // Add buttons
  container.querySelector('#btn-add-sale')?.addEventListener('click', () => openTransactionModal('sale'));
  container.querySelector('#btn-add-expense')?.addEventListener('click', () => openTransactionModal('expense'));

  // Search
  container.querySelector('#txn-search')?.addEventListener('input', debounce((e) => {
    _searchQuery = e.target.value;
    render(container);
  }, 250));

  // Filters
  container.querySelector('#txn-filter-type')?.addEventListener('change', (e) => {
    _typeFilter = e.target.value;
    render(container);
  });
  container.querySelector('#txn-filter-category')?.addEventListener('change', (e) => {
    _categoryFilter = e.target.value;
    render(container);
  });

  // Sort
  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (_sortField === field) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      else { _sortField = field; _sortDir = field === 'date' ? 'desc' : 'asc'; }
      render(container);
    });
  });

  // Row actions
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'edit') openTransactionModal(null, id);
      else if (action === 'delete') confirmDelete(id, container);
    });
  });

  // Inline editing
  container.querySelectorAll('.inline-editable').forEach(el => {
    el.addEventListener('dblclick', () => {
      const field = el.dataset.field;
      const id = el.dataset.id;
      const currentValue = el.textContent.trim();

      const input = document.createElement('input');
      input.className = 'inline-edit-input';
      input.value = currentValue === '—' ? '' : currentValue;
      el.replaceWith(input);
      input.focus();
      input.select();

      const finish = () => {
        const newVal = input.value.trim();
        if (newVal && newVal !== currentValue) {
          update('transactions', id, { [field]: newVal });
          showToast('Updated!', 'success');
        }
        render(container);
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') render(container);
      });
    });
  });
}

function confirmDelete(id, container) {
  const txn = getAll('transactions').find(t => t.id === id);
  if (!txn) return;
  showModal({
    title: 'Delete Transaction',
    body: `<p>Delete "<strong>${escapeHtml(txn.description || 'Untitled')}</strong>" (${formatCurrency(txn.amount)})?</p><p class="text-secondary" style="margin-top:8px;font-size:0.85rem;">This action can be undone.</p>`,
    confirmText: 'Delete',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      remove('transactions', id);
      showToast('Transaction deleted', 'warning');
      closeModal();
      render(container);
    },
  });
}

function openTransactionModal(type = null, editId = null) {
  const existing = editId ? getAll('transactions').find(t => t.id === editId) : null;
  const isEdit = !!existing;
  const txnType = type || existing?.type || 'sale';

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date *</label>
        <input class="form-input" type="date" id="txn-date" value="${formatDateInput(existing?.date) || todayStr()}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="txn-type">
          <option value="sale" ${txnType === 'sale' ? 'selected' : ''}>Sale ↑</option>
          <option value="expense" ${txnType === 'expense' ? 'selected' : ''}>Expense ↓</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description *</label>
      <input class="form-input" id="txn-desc" value="${escapeHtml(existing?.description || '')}" placeholder="e.g. 3D Print Sale — Custom Figure" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Amount (₹) *</label>
        <input class="form-input" type="number" id="txn-amount" min="0" step="0.01" value="${existing?.amount || ''}" placeholder="0.00" required />
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="txn-category">
          ${TRANSACTION_CATEGORIES.map(c => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="txn-notes" placeholder="Optional notes...">${escapeHtml(existing?.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit Transaction' : (txnType === 'sale' ? 'Add Sale' : 'Add Expense'),
    body,
    confirmText: isEdit ? 'Save Changes' : 'Add Transaction',
    onConfirm: () => {
      const date = document.getElementById('txn-date').value;
      const description = document.getElementById('txn-desc').value.trim();
      const amount = parseFloat(document.getElementById('txn-amount').value);

      if (!date || !description || isNaN(amount) || amount <= 0) {
        showToast('Please fill in all required fields', 'error');
        return;
      }

      const data = {
        date,
        description,
        type: document.getElementById('txn-type').value,
        amount,
        category: document.getElementById('txn-category').value,
        notes: document.getElementById('txn-notes').value.trim(),
      };

      if (isEdit) {
        update('transactions', editId, data);
        showToast('Transaction updated!', 'success');
      } else {
        create('transactions', data);
        showToast('Transaction added!', 'success');
      }

      closeModal();
      const contentEl = document.getElementById('content');
      if (contentEl) render(contentEl);
    },
  });
}
