/**
 * Made N More — Treasury & Multi-Account Banking Ledger
 * Tracks real-time actual balances across Bank Accounts, UPI Merchant QR, Workshop Cash Drawer, and Machine Sinking Reserves.
 */

import { getAll, create, update, remove, getById, getAccountBalance, transferBetweenAccounts, reconcileAccountBalance } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml, todayStr } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let _filterAccount = 'all';
let _filterTxType = 'all';

export function renderAccounts(container) {
  render(container);
}

function render(container) {
  const accounts = getAll('accounts');
  const transactions = getAll('transactions');
  const orders = getAll('orders');

  // Compute live balances for each account
  const accountStats = accounts.map(a => {
    const stats = getAccountBalance(a.id);
    return {
      ...a,
      ...stats
    };
  });

  const totalLiquidCapital = accountStats.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalInflow = accountStats.reduce((sum, a) => sum + (a.totalInflow || 0), 0);
  const totalOutflow = accountStats.reduce((sum, a) => sum + (a.totalOutflow || 0), 0);
  const netCashFlow = totalInflow - totalOutflow;

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Treasury & Account Balances</h1>
        <p class="text-secondary">Actual live liquid balances, multi-account banking ledger, UPI gateways & statement reconciliation</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-transfer-funds">
          <span style="font-size:1.05rem;">⇄</span>
          Transfer Between Accounts
        </button>
        <button class="btn btn-primary" id="btn-add-account">
          <span class="nav-icon">${ICONS.plus}</span>
          Add Account
        </button>
      </div>
    </div>

    <!-- Treasury Financial KPI Ribbon -->
    <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="card stat-card card-lift animate-in animate-delay-1">
        <div class="card-title">Total Liquid Capital</div>
        <div class="stat-value text-success" style="font-size:1.8rem;font-weight:800;">
          ${formatCurrency(totalLiquidCapital)}
        </div>
        <div class="stat-label">Reconciled across ${accounts.length} business accounts</div>
      </div>
      <div class="card stat-card card-lift animate-in animate-delay-2">
        <div class="card-title">Cumulative Inflows</div>
        <div class="stat-value text-info">
          +${formatCurrency(totalInflow)}
        </div>
        <div class="stat-label">Order payments & client advance deposits</div>
      </div>
      <div class="card stat-card card-lift animate-in animate-delay-3">
        <div class="card-title">Cumulative Outflows</div>
        <div class="stat-value text-danger">
          -${formatCurrency(totalOutflow)}
        </div>
        <div class="stat-label">Filament, equipment & operational expenses</div>
      </div>
      <div class="card stat-card card-lift animate-in animate-delay-4">
        <div class="card-title">Net Operating Cash Flow</div>
        <div class="stat-value ${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">
          ${netCashFlow >= 0 ? '+' : ''}${formatCurrency(netCashFlow)}
        </div>
        <div class="stat-label">Actual operating treasury surplus</div>
      </div>
    </div>

    <!-- Accounts Cards Grid -->
    <div style="margin-bottom:var(--space-xl);" class="animate-in animate-delay-2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h2 style="font-size:1.2rem;font-weight:700;">Operating Accounts & Reserves</h2>
        <span class="text-secondary" style="font-size:0.85rem;">All balances update in real-time with incoming order payments</span>
      </div>

      <div class="account-card-grid">
        ${accountStats.map(acc => renderAccountCard(acc)).join('')}
      </div>
    </div>

    <!-- Comprehensive Treasury Ledger -->
    <div class="card animate-in animate-delay-3">
      <div class="card-header" style="flex-wrap:wrap;gap:12px;">
        <div>
          <span class="card-title">Chronological Account Activity & Cash Flow</span>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Complete audit trail of deposits, order payments, withdrawals, and inter-account transfers</div>
        </div>
        
        <div style="display:flex;gap:10px;align-items:center;">
          <select class="form-select form-select-sm" id="ledger-filter-account" style="width:auto;min-width:180px;">
            <option value="all">All Operating Accounts</option>
            ${accounts.map(a => `<option value="${a.id}" ${_filterAccount === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <select class="form-select form-select-sm" id="ledger-filter-type" style="width:auto;min-width:140px;">
            <option value="all" ${_filterTxType === 'all' ? 'selected' : ''}>All Types</option>
            <option value="inflow" ${_filterTxType === 'inflow' ? 'selected' : ''}>Inflows (Credits)</option>
            <option value="outflow" ${_filterTxType === 'outflow' ? 'selected' : ''}>Outflows (Debits)</option>
            <option value="transfer" ${_filterTxType === 'transfer' ? 'selected' : ''}>Transfers</option>
          </select>
        </div>
      </div>

      ${renderLedgerTable(transactions, orders, accounts)}
    </div>
  `;

  bindEvents(container);
}

function renderAccountCard(acc) {
  const typeIcons = {
    bank: '🏦',
    upi: '📱',
    cash: '💵',
    reserve: '🛡️',
  };
  const typeLabels = {
    bank: 'Bank Current A/c',
    upi: 'UPI Merchant QR',
    cash: 'Workshop Cash Drawer',
    reserve: 'Equipment Sinking Reserve',
  };

  const icon = typeIcons[acc.type] || '💳';
  const typeLabel = typeLabels[acc.type] || 'Account';

  return `
    <div class="card account-box" data-account-id="${acc.id}">
      <div class="account-box-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.6rem;">${icon}</span>
          <div>
            <div style="font-weight:700;font-size:1rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              ${escapeHtml(acc.name)}
              ${acc.isPrimary ? `<span class="badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;font-size:0.65rem;">Primary</span>` : ''}
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">
              ${escapeHtml(acc.institution || typeLabel)} • <span style="font-family:var(--font-mono);">${escapeHtml(acc.accountNumber || 'N/A')}</span>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:4px;">
          <button class="btn-icon btn-sm" data-action="edit-account" data-id="${acc.id}" title="Edit Account">
            ${ICONS.edit}
          </button>
          ${!acc.isPrimary ? `
            <button class="btn-icon btn-sm" data-action="delete-account" data-id="${acc.id}" title="Delete Account" style="color:var(--danger);">
              ${ICONS.trash}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Actual Reconciled Balance Display -->
      <div class="account-balance-display">
        <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">
          Actual Available Balance
        </div>
        <div class="account-balance-amount ${acc.balance >= 0 ? 'text-success' : 'text-danger'}">
          ${formatCurrency(acc.balance)}
        </div>
      </div>

      <!-- Quick Metrics Breakdown -->
      <div class="account-metrics-row">
        <div>
          <span class="account-metric-label">Opening Base</span>
          <span class="account-metric-val">${formatCurrency(acc.openingBalance)}</span>
        </div>
        <div>
          <span class="account-metric-label">Credits (+)</span>
          <span class="account-metric-val text-success">+${formatCurrency(acc.totalInflow)}</span>
        </div>
        <div>
          <span class="account-metric-label">Debits (-)</span>
          <span class="account-metric-val text-danger">-${formatCurrency(acc.totalOutflow)}</span>
        </div>
      </div>

      ${acc.notes ? `
        <div style="font-size:0.74rem;color:var(--text-muted);margin:10px 0;line-height:1.3;background:rgba(255,255,255,0.02);padding:6px 10px;border-radius:4px;">
          ${escapeHtml(acc.notes)}
        </div>
      ` : ''}

      <!-- Action Footer -->
      <div class="account-box-actions">
        <button class="btn btn-secondary btn-sm flex-1" data-action="quick-deposit" data-id="${acc.id}">
          + Deposit
        </button>
        <button class="btn btn-secondary btn-sm flex-1" data-action="quick-withdraw" data-id="${acc.id}">
          - Withdraw
        </button>
        <button class="btn btn-ghost btn-sm" data-action="reconcile" data-id="${acc.id}" title="Reconcile against bank statement">
          ⚖️ Reconcile
        </button>
      </div>
    </div>
  `;
}

function renderLedgerTable(transactions, orders, accounts) {
  // Collect all ledger items chronologically
  let entries = [];

  // 1. Transactions
  transactions.forEach(t => {
    let type = t.type;
    let targetAccId = t.accountId;
    if (type === 'transfer') {
      entries.push({
        id: t.id + '-out',
        date: t.date,
        accountId: t.fromAccountId,
        type: 'transfer_out',
        category: 'Internal Transfer Out',
        desc: t.description || 'Transfer to account',
        amount: -Math.abs(t.amount || 0),
      });
      entries.push({
        id: t.id + '-in',
        date: t.date,
        accountId: t.toAccountId,
        type: 'transfer_in',
        category: 'Internal Transfer In',
        desc: t.description || 'Transfer from account',
        amount: Math.abs(t.amount || 0),
      });
      return;
    }

    const amt = type === 'sale' ? Math.abs(t.amount || 0) : -Math.abs(t.amount || 0);
    entries.push({
      id: t.id,
      date: t.date,
      accountId: targetAccId || 'acc1',
      type: type === 'sale' ? 'credit' : 'debit',
      category: t.category || (type === 'sale' ? 'Sale' : 'Expense'),
      desc: t.description || 'Workshop Transaction',
      amount: amt,
    });
  });

  // 2. Order Payments
  orders.forEach(o => {
    (o.payments || []).forEach(p => {
      entries.push({
        id: p.id,
        date: p.date,
        accountId: p.accountId || 'acc1',
        type: 'credit',
        category: 'Order Milestone Payment',
        desc: `${escapeHtml(o.clientName)} — Order #${o.id} (${p.notes || `${p.percentage}% Milestone`})`,
        amount: Math.abs(p.amount || 0),
      });
    });
  });

  // Filter
  if (_filterAccount !== 'all') {
    entries = entries.filter(e => e.accountId === _filterAccount);
  }
  if (_filterTxType === 'inflow') {
    entries = entries.filter(e => e.amount > 0);
  } else if (_filterTxType === 'outflow') {
    entries = entries.filter(e => e.amount < 0);
  } else if (_filterTxType === 'transfer') {
    entries = entries.filter(e => e.type.startsWith('transfer'));
  }

  // Sort descending by date
  entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (entries.length === 0) {
    return `
      <div class="empty-state">
        <p>No transactions found for the selected account filters.</p>
      </div>
    `;
  }

  const accountMap = {};
  accounts.forEach(a => { accountMap[a.id] = a.name; });

  return `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Operating Account</th>
            <th>Category</th>
            <th>Description & Reference</th>
            <th style="text-align:right;">Cash Flow</th>
          </tr>
        </thead>
        <tbody>
          ${entries.slice(0, 30).map(e => `
            <tr>
              <td style="font-family:var(--font-mono);font-size:0.8rem;white-space:nowrap;">
                ${formatDate(e.date)}
              </td>
              <td>
                <span class="badge" style="background:rgba(255,255,255,0.06);font-size:0.75rem;font-weight:600;">
                  ${escapeHtml(accountMap[e.accountId] || 'Primary Account')}
                </span>
              </td>
              <td>
                <span class="badge ${e.amount >= 0 ? 'badge-yes' : 'badge-no'}" style="font-size:0.72rem;">
                  ${escapeHtml(e.category)}
                </span>
              </td>
              <td style="font-size:0.85rem;color:var(--text-primary);">
                ${escapeHtml(e.desc)}
              </td>
              <td style="text-align:right;font-family:var(--font-mono);font-weight:700;font-size:0.9rem;" class="${e.amount >= 0 ? 'text-success' : 'text-danger'}">
                ${e.amount >= 0 ? '+' : ''}${formatCurrency(e.amount)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindEvents(container) {
  // Add Account
  container.querySelector('#btn-add-account')?.addEventListener('click', () => openAccountModal());

  // Transfer Between Accounts
  container.querySelector('#btn-transfer-funds')?.addEventListener('click', () => openTransferModal(container));

  // Filter Account
  container.querySelector('#ledger-filter-account')?.addEventListener('change', (e) => {
    _filterAccount = e.target.value;
    render(container);
  });

  // Filter Type
  container.querySelector('#ledger-filter-type')?.addEventListener('change', (e) => {
    _filterTxType = e.target.value;
    render(container);
  });

  // Card Actions
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit-account') {
        openAccountModal(id);
      } else if (action === 'delete-account') {
        confirmDeleteAccount(id, container);
      } else if (action === 'quick-deposit') {
        openQuickCashModal(id, 'deposit', container);
      } else if (action === 'quick-withdraw') {
        openQuickCashModal(id, 'withdraw', container);
      } else if (action === 'reconcile') {
        openReconcileModal(id, container);
      }
    });
  });
}

// ─── Modals ─────────────────────────────────────────────────

function openAccountModal(editId = null) {
  const existing = editId ? getById('accounts', editId) : null;
  const isEdit = !!existing;

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Account / Facility Name *</label>
        <input class="form-input" id="acc-name" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. ICICI Bank Current A/c" required />
      </div>
      <div class="form-group">
        <label class="form-label">Account Category</label>
        <select class="form-select" id="acc-type">
          <option value="bank" ${existing?.type === 'bank' ? 'selected' : ''}>🏦 Bank Account (Current/Savings)</option>
          <option value="upi" ${existing?.type === 'upi' ? 'selected' : ''}>📱 UPI Merchant Gateway (GPay/Paytm)</option>
          <option value="cash" ${existing?.type === 'cash' ? 'selected' : ''}>💵 Workshop Cash Drawer / Petty Cash</option>
          <option value="reserve" ${existing?.type === 'reserve' ? 'selected' : ''}>🛡️ Equipment Sinking / Maintenance Reserve</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Financial Institution / Provider</label>
        <input class="form-input" id="acc-inst" value="${escapeHtml(existing?.institution || '')}" placeholder="e.g. HDFC Bank, ICICI, Razorpay, Cash" />
      </div>
      <div class="form-group">
        <label class="form-label">Account Number / UPI ID</label>
        <input class="form-input" id="acc-number" value="${escapeHtml(existing?.accountNumber || '')}" placeholder="e.g. •••• 9821 or pay@upi" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Opening Base Balance (₹) *</label>
        <input class="form-input" type="number" id="acc-opening" min="0" step="10" value="${existing?.openingBalance ?? 0}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Account Status</label>
        <select class="form-select" id="acc-status">
          <option value="active" ${existing?.status !== 'archived' ? 'selected' : ''}>Active / Operational</option>
          <option value="archived" ${existing?.status === 'archived' ? 'selected' : ''}>Archived / Inactive</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Operational Notes / Usage Guidance</label>
      <input class="form-input" id="acc-notes" value="${escapeHtml(existing?.notes || '')}" placeholder="e.g. Dedicated for multi-material client orders and hardware purchases." />
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="acc-is-primary" ${existing?.isPrimary ? 'checked' : ''} />
        <span>Set as Primary Operating Account (Default destination for untagged sales & receipts)</span>
      </label>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit Operating Account' : 'Add New Operating Account',
    body,
    confirmText: isEdit ? 'Save Changes' : 'Create Account',
    onConfirm: () => {
      const name = document.getElementById('acc-name')?.value.trim();
      if (!name) {
        showToast('Account name is required', 'error');
        return;
      }

      const isPrimary = document.getElementById('acc-is-primary')?.checked || false;

      // If this account is set to primary, clear primary from other accounts
      if (isPrimary) {
        getAll('accounts').forEach(a => {
          if (a.id !== editId && a.isPrimary) {
            update('accounts', a.id, { isPrimary: false });
          }
        });
      }

      const data = {
        name,
        type: document.getElementById('acc-type')?.value || 'bank',
        institution: document.getElementById('acc-inst')?.value.trim() || '',
        accountNumber: document.getElementById('acc-number')?.value.trim() || '',
        openingBalance: parseFloat(document.getElementById('acc-opening')?.value) || 0,
        status: document.getElementById('acc-status')?.value || 'active',
        notes: document.getElementById('acc-notes')?.value.trim() || '',
        isPrimary,
      };

      if (isEdit) {
        update('accounts', editId, data);
        showToast('Account updated!', 'success');
      } else {
        create('accounts', data);
        showToast('Account added to treasury!', 'success');
      }

      closeModal();
      const contentEl = document.getElementById('content');
      if (contentEl) render(contentEl);
    }
  });
}

function openTransferModal(container) {
  const accounts = getAll('accounts');
  if (accounts.length < 2) {
    showToast('At least 2 accounts required for internal transfer', 'error');
    return;
  }

  const body = `
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-md);padding:12px;margin-bottom:var(--space-md);font-size:0.85rem;color:var(--text-secondary);">
      Transfer liquid funds internally between accounts (e.g. Transfer UPI QR daily receipts into your primary HDFC Bank Account, or withdraw cash to the workshop drawer).
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Source Account (Debit From) *</label>
        <select class="form-select" id="tr-from">
          ${accounts.map(a => {
            const b = getAccountBalance(a.id);
            return `<option value="${a.id}">${escapeHtml(a.name)} (${formatCurrency(b.balance)})</option>`;
          }).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Destination Account (Credit To) *</label>
        <select class="form-select" id="tr-to">
          ${accounts.map((a, i) => {
            const b = getAccountBalance(a.id);
            return `<option value="${a.id}" ${i === 1 ? 'selected' : ''}>${escapeHtml(a.name)} (${formatCurrency(b.balance)})</option>`;
          }).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Transfer Amount (₹) *</label>
        <input class="form-input" type="number" id="tr-amount" min="1" step="10" placeholder="e.g. 5000" required />
      </div>
      <div class="form-group">
        <label class="form-label">Transfer Reference / Memo</label>
        <input class="form-input" id="tr-notes" placeholder="e.g. Daily UPI settlement to Bank" />
      </div>
    </div>
  `;

  showModal({
    title: '⇄ Internal Treasury Funds Transfer',
    body,
    confirmText: 'Execute Transfer',
    onConfirm: async () => {
      const fromId = document.getElementById('tr-from')?.value;
      const toId = document.getElementById('tr-to')?.value;
      const amount = parseFloat(document.getElementById('tr-amount')?.value) || 0;
      const notes = document.getElementById('tr-notes')?.value.trim();

      if (fromId === toId) {
        showToast('Source and destination accounts must be different', 'error');
        return;
      }
      if (amount <= 0) {
        showToast('Please enter a valid transfer amount', 'error');
        return;
      }

      await transferBetweenAccounts(fromId, toId, amount, notes);
      showToast(`Transferred ${formatCurrency(amount)} successfully!`, 'success');
      closeModal();
      render(container);
    }
  });
}

function openQuickCashModal(accountId, mode = 'deposit', container) {
  const account = getById('accounts', accountId);
  if (!account) return;

  const isDeposit = mode === 'deposit';

  const body = `
    <div class="form-group">
      <label class="form-label">Amount to ${isDeposit ? 'Deposit / Credit' : 'Withdraw / Debit'} (₹) *</label>
      <input class="form-input" type="number" id="cash-amount" min="1" step="10" placeholder="e.g. 1500" autofocus required />
    </div>

    <div class="form-group">
      <label class="form-label">Category</label>
      <input class="form-input" id="cash-category" value="${isDeposit ? 'Manual Capital Credit' : 'Workshop Expense'}" />
    </div>

    <div class="form-group">
      <label class="form-label">Reason / Notes *</label>
      <input class="form-input" id="cash-desc" placeholder="e.g. ${isDeposit ? 'Client cash advance received in person' : 'Cash purchase for acetone and nozzles'}" required />
    </div>
  `;

  showModal({
    title: `${isDeposit ? '📥 Log Deposit' : '📤 Log Withdrawal'} — ${escapeHtml(account.name)}`,
    body,
    confirmText: isDeposit ? 'Credit Account' : 'Debit Account',
    onConfirm: async () => {
      const amount = parseFloat(document.getElementById('cash-amount')?.value) || 0;
      const category = document.getElementById('cash-category')?.value.trim() || 'General';
      const desc = document.getElementById('cash-desc')?.value.trim() || 'Manual adjustment';

      if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      await create('transactions', {
        date: todayStr(),
        type: isDeposit ? 'sale' : 'expense',
        category,
        description: desc,
        amount,
        accountId
      });

      showToast(`Logged ${isDeposit ? 'deposit' : 'withdrawal'} of ${formatCurrency(amount)}!`, 'success');
      closeModal();
      render(container);
    }
  });
}

function openReconcileModal(accountId, container) {
  const account = getById('accounts', accountId);
  if (!account) return;

  const stats = getAccountBalance(accountId);

  const body = `
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.86rem;color:var(--text-secondary);">
        <span>System Calculated Balance:</span>
        <span style="font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">${formatCurrency(stats.balance)}</span>
      </div>
      <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">
        Open your official banking app / passbook / UPI statement and enter the exact closing balance. Any discrepancy will be automatically adjusted with an audit entry.
      </p>
    </div>

    <div class="form-group">
      <label class="form-label">Verified Statement Closing Balance (₹) *</label>
      <input class="form-input" type="number" id="rec-verified-balance" step="0.5" value="${stats.balance}" required />
    </div>

    <div id="rec-discrepancy-box" style="margin-bottom:12px;font-size:0.85rem;padding:8px 12px;border-radius:var(--radius-sm);display:none;"></div>

    <div class="form-group">
      <label class="form-label">Reconciliation Notes / Statement Reference</label>
      <input class="form-input" id="rec-notes" placeholder="e.g. Matched with HDFC E-Statement dated ${todayStr()}" />
    </div>
  `;

  showModal({
    title: `⚖️ Statement Reconciliation — ${escapeHtml(account.name)}`,
    body,
    confirmText: 'Verify & Reconcile',
    onReady: () => {
      const input = document.getElementById('rec-verified-balance');
      const box = document.getElementById('rec-discrepancy-box');

      const updateDiff = () => {
        const val = parseFloat(input?.value) || 0;
        const diff = val - stats.balance;
        if (box) {
          box.style.display = 'block';
          if (Math.abs(diff) < 0.01) {
            box.style.background = 'rgba(34, 197, 94, 0.1)';
            box.style.color = '#4ade80';
            box.textContent = '✓ Perfectly in Balance! System matches verified statement balance.';
          } else if (diff > 0) {
            box.style.background = 'rgba(59, 130, 246, 0.1)';
            box.style.color = '#60a5fa';
            box.textContent = `Surplus Discrepancy: +${formatCurrency(diff)} will be credited to match statement.`;
          } else {
            box.style.background = 'rgba(239, 68, 68, 0.1)';
            box.style.color = '#f87171';
            box.textContent = `Shortfall Discrepancy: ${formatCurrency(diff)} will be debited to match statement.`;
          }
        }
      };

      input?.addEventListener('input', updateDiff);
      updateDiff();
    },
    onConfirm: async () => {
      const verified = parseFloat(document.getElementById('rec-verified-balance')?.value) || 0;
      const notes = document.getElementById('rec-notes')?.value.trim();

      await reconcileAccountBalance(accountId, verified, notes);
      showToast('Account successfully reconciled with bank statement!', 'success');
      closeModal();
      render(container);
    }
  });
}

function confirmDeleteAccount(id, container) {
  const account = getById('accounts', id);
  if (!account) return;

  if (account.isPrimary) {
    showToast('Cannot delete primary operating account', 'error');
    return;
  }

  showModal({
    title: 'Archive Account?',
    body: `<p>Are you sure you want to remove <strong>${escapeHtml(account.name)}</strong> from active treasury tracking?</p>`,
    confirmText: 'Delete Account',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      await remove('accounts', id);
      showToast('Account removed from treasury!', 'success');
      closeModal();
      render(container);
    }
  });
}
