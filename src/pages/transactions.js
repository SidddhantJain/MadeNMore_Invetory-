/**
 * Made N More — Transactions & Financial Intelligence
 * Full double-entry style workshop ledger, P&L statements (Filament COGS, Electricity, Scrap, Net Margins),
 * and 30-Day Filament Reorder Burn Rate Forecasting
 */

import { getAll, create, update, remove, getSettings } from '../data/store.js';
import { TRANSACTION_CATEGORIES } from '../data/seed.js';
import { formatCurrency, formatDate, formatDateInput, escapeHtml, debounce, todayStr } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let _activeTab = 'ledger'; // ledger | pnl
let _pnlRange = 'all'; // all | 30days | month
let _typeFilter = '';
let _categoryFilter = '';
let _searchQuery = '';
let _sortField = 'date';
let _sortDir = 'desc';

export function renderTransactions(container) {
  render(container);
}

function getFilteredTransactions() {
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

function calculatePnL(range = 'all') {
  const settings = getSettings();
  const allOrders = getAll('orders');
  const allTxns = getAll('transactions');
  const allPrinters = getAll('printers');
  const allFilaments = getAll('filaments');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filterByDate = (dateStr) => {
    if (range === 'all') return true;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (range === '30days') return d >= thirtyDaysAgo;
    if (range === 'month') return d >= startOfMonth;
    return true;
  };

  const filteredOrders = allOrders.filter(o => filterByDate(o.createdAt || o.deliveryDate));
  const filteredTxns = allTxns.filter(t => filterByDate(t.date));

  // 1. Revenue
  const txnSales = filteredTxns
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const orderSales = filteredOrders
    .filter(o => o.status === 'completed' || o.status === 'shipping' || o.paid)
    .reduce((sum, o) => sum + (o.totalPrice || o.price || 0), 0);

  const totalRevenue = txnSales > 0 ? txnSales : orderSales;

  // 2. Filament Material COGS
  let totalPrintedGrams = 0;
  let filamentCOGS = 0;

  filteredOrders.forEach(o => {
    const grams = (o.weight || 0) * (o.quantity || 1);
    totalPrintedGrams += grams;
    const ratePerGram = (settings.materialCosts?.[o.material] || 850) / 1000;
    filamentCOGS += grams * ratePerGram;
  });

  // If no detailed order weights, calculate from filament purchase expenses
  const filamentPurchases = filteredTxns
    .filter(t => t.category === 'Filament Purchase')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  if (filamentCOGS === 0 && filamentPurchases > 0) {
    filamentCOGS = filamentPurchases * 0.65; // Estimated 65% consumed
  }

  // 3. Electricity Cost (350W average * print hours * ₹8.5/kWh)
  let totalPrintHours = 0;
  filteredOrders.forEach(o => {
    totalPrintHours += (o.printTimeHours || 2.5) * (o.quantity || 1);
  });
  if (totalPrintHours === 0) {
    totalPrintHours = allPrinters.reduce((sum, p) => sum + (p.runningHours || 0), 0) * 0.4;
  }
  const kwhRate = settings.electricityRate || 8.5;
  const powerKw = (settings.printerPower || 350) / 1000;
  const electricityCost = totalPrintHours * powerKw * kwhRate;

  // 4. Workshop Consumables & Hardware allocated
  const consumablesCost = filteredOrders.length * 45; // ~₹45 per order for brass inserts, nozzles, IPA, prep

  // 5. Total COGS & Gross Profit
  const totalCOGS = filamentCOGS + electricityCost + consumablesCost;
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 6. Operating Expenses & Scrap Losses
  const scrapGrams = filteredOrders.reduce((sum, o) => sum + (o.scrapGrams || 0), 0);
  const scrapLoss = scrapGrams * 0.85; // ₹0.85/g

  const otherExpenses = filteredTxns
    .filter(t => t.type === 'expense' && t.category !== 'Filament Purchase')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const depreciationReserve = totalPrintHours * 15.0; // ₹15/hr machine depreciation reserve

  const totalOperatingCosts = totalCOGS + scrapLoss + otherExpenses + depreciationReserve;
  const netOperatingProfit = totalRevenue - totalOperatingCosts;
  const netMargin = totalRevenue > 0 ? (netOperatingProfit / totalRevenue) * 100 : 0;

  // 7. Filament Burn Rate & Reorder Forecasting
  const colorBurnMap = {};
  allOrders.forEach(o => {
    const color = o.filamentColor || 'Pitch Black';
    const grams = (o.weight || 120) * (o.quantity || 1);
    colorBurnMap[color] = (colorBurnMap[color] || 0) + grams;
  });

  const forecast = allFilaments.slice(0, 12).map(f => {
    const totalGramsUsed = colorBurnMap[f.name] || (f.spools > 1 ? 450 : 150);
    const dailyBurnRate = Math.max(5, Math.round(totalGramsUsed / 30)); // grams/day
    const currentStockGrams = (f.spools || 0) * 1000;
    const daysRemaining = Math.round(currentStockGrams / dailyBurnRate);

    let status = 'healthy';
    let statusLabel = '🟢 Healthy (> 30d)';
    if (daysRemaining <= 7) {
      status = 'critical';
      statusLabel = '🔴 Reorder Now (< 7d)';
    } else if (daysRemaining <= 18) {
      status = 'warning';
      statusLabel = '🟡 Reorder Soon (< 18d)';
    }

    return {
      id: f.id,
      name: f.name,
      material: f.material,
      hex: f.hex,
      spools: f.spools || 0,
      currentStockGrams,
      dailyBurnRate,
      daysRemaining,
      status,
      statusLabel,
    };
  });

  forecast.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalRevenue,
    orderSales,
    txnSales,
    filamentCOGS,
    totalPrintedGrams,
    totalPrintHours,
    electricityCost,
    consumablesCost,
    totalCOGS,
    grossProfit,
    grossMargin,
    scrapLoss,
    scrapGrams,
    otherExpenses,
    depreciationReserve,
    totalOperatingCosts,
    netOperatingProfit,
    netMargin,
    forecast,
  };
}

function render(container) {
  const items = getFilteredTransactions();
  const allItems = getAll('transactions');

  const totalSales = allItems.filter(t => t.type === 'sale').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = allItems.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = totalSales - totalExpenses;

  const pnl = calculatePnL(_pnlRange);

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Financial Ledger & Workshop P&L</h1>
        <p class="text-secondary">Double-entry cashflow ledger, automated manufacturing P&L statements, and material burn rate forecasting</p>
      </div>
      <div class="page-header-actions">
        ${_activeTab === 'ledger' ? `
          <button class="btn btn-secondary" id="btn-add-expense">
            <span class="nav-icon" style="color:var(--danger)">${ICONS.sort}</span>
            Add Expense
          </button>
          <button class="btn btn-primary" id="btn-add-sale">
            <span class="nav-icon">${ICONS.plus}</span>
            Add Sale
          </button>
        ` : `
          <div class="filter-pills" style="margin:0;">
            <button class="filter-pill ${_pnlRange === 'all' ? 'active' : ''}" data-pnl-range="all">All Time</button>
            <button class="filter-pill ${_pnlRange === '30days' ? 'active' : ''}" data-pnl-range="30days">Last 30 Days</button>
            <button class="filter-pill ${_pnlRange === 'month' ? 'active' : ''}" data-pnl-range="month">This Month</button>
          </div>
        `}
      </div>
    </div>

    <!-- Sub-tab Switcher -->
    <div class="filter-pills animate-in animate-delay-1" style="margin-bottom: var(--space-md);">
      <button class="filter-pill ${_activeTab === 'ledger' ? 'active' : ''}" data-tab="ledger">
        📋 Cashflow Ledger (${allItems.length})
      </button>
      <button class="filter-pill ${_activeTab === 'pnl' ? 'active' : ''}" data-tab="pnl">
        📊 Workshop P&L Intelligence & Forecasting
      </button>
    </div>

    <!-- Tab Content -->
    <div id="txn-content" class="animate-in animate-delay-2">
      ${_activeTab === 'ledger' ? renderLedgerView(items, totalSales, totalExpenses, balance) : renderPnLView(pnl)}
    </div>
  `;

  bindEvents(container);
}

function renderLedgerView(items, totalSales, totalExpenses, balance) {
  return `
    <!-- Quick Stats -->
    <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);margin-bottom:var(--space-md);">
      <div class="card stat-card animate-in animate-delay-1">
        <div class="card-title">Total Sales Inflow</div>
        <div class="stat-value text-success">${formatCurrency(totalSales)}</div>
      </div>
      <div class="card stat-card animate-in animate-delay-2">
        <div class="card-title">Total Expenses Outflow</div>
        <div class="stat-value text-danger">${formatCurrency(totalExpenses)}</div>
      </div>
      <div class="card stat-card animate-in animate-delay-3">
        <div class="card-title">Net Ledger Balance</div>
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
}

function renderPnLView(pnl) {
  return `
    <!-- Top P&L KPI Cards -->
    <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);margin-bottom:var(--space-md);">
      <div class="card stat-card">
        <div class="card-title">Gross Operating Revenue</div>
        <div class="stat-value text-success">${formatCurrency(pnl.totalRevenue)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">100% Inflow Base</div>
      </div>
      <div class="card stat-card">
        <div class="card-title">Filament & Direct COGS</div>
        <div class="stat-value text-danger">${formatCurrency(pnl.totalCOGS)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${pnl.totalPrintedGrams.toLocaleString()}g printed • ${pnl.totalPrintHours.toFixed(1)} hrs</div>
      </div>
      <div class="card stat-card">
        <div class="card-title">Net Operating Profit</div>
        <div class="stat-value ${pnl.netOperatingProfit >= 0 ? 'text-success' : 'text-danger'}">
          ${formatCurrency(pnl.netOperatingProfit)}
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">After electricity, scrap, reserves</div>
      </div>
      <div class="card stat-card">
        <div class="card-title">Net Operating Margin</div>
        <div class="stat-value" style="color:var(--accent);">
          ${pnl.netMargin.toFixed(1)}%
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Gross Margin: ${pnl.grossMargin.toFixed(1)}%</div>
      </div>
    </div>

    <!-- P&L Breakdown Layout -->
    <div class="pnl-container">
      <!-- Left Column: Official Financial P&L Statement -->
      <div class="pnl-statement-card">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:12px;">
          <div>
            <h3 style="margin:0;font-size:1.1rem;font-weight:700;">Workshop Profit & Loss Statement</h3>
            <span style="font-size:0.78rem;color:var(--text-muted);">Period: ${_pnlRange === 'all' ? 'All Historic Operations' : _pnlRange === '30days' ? 'Last 30 Rolling Days' : 'Current Calendar Month'}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Export / Print P&L</button>
        </div>

        <table class="pnl-table">
          <tbody>
            <!-- REVENUE -->
            <tr class="pnl-section-header">
              <td colspan="2">1. Operating Revenue</td>
              <td style="text-align:right;">Amount (₹)</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">3D Printed Customer Orders & Commissions</td>
              <td class="text-right" style="font-weight:600;color:var(--text-primary);">${formatCurrency(pnl.totalRevenue)}</td>
            </tr>
            <tr style="background:rgba(255,255,255,0.02);font-weight:700;">
              <td colspan="2">Total Operating Revenue</td>
              <td class="text-right text-success">${formatCurrency(pnl.totalRevenue)}</td>
            </tr>

            <!-- COGS -->
            <tr class="pnl-section-header">
              <td colspan="2">2. Cost of Goods Sold (COGS)</td>
              <td style="text-align:right;">Cost (₹)</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">Direct Filament Consumed (${pnl.totalPrintedGrams.toLocaleString()}g across jobs)</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.filamentCOGS)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">Electricity Consumption (${pnl.totalPrintHours.toFixed(1)} hrs @ ₹8.50/kWh, 350W)</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.electricityCost)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">Hardware & Consumables (Inserts, Nozzles, IPA prep)</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.consumablesCost)}</td>
            </tr>
            <tr style="background:rgba(255,255,255,0.02);font-weight:700;">
              <td colspan="2">Total Cost of Goods Sold</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.totalCOGS)}</td>
            </tr>

            <!-- GROSS PROFIT -->
            <tr class="pnl-summary-row" style="background:rgba(34, 197, 94, 0.05);">
              <td colspan="2">GROSS MANUFACTURING PROFIT</td>
              <td class="text-right text-success">${formatCurrency(pnl.grossProfit)} (${pnl.grossMargin.toFixed(1)}%)</td>
            </tr>

            <!-- OPERATING EXPENSES & LOSSES -->
            <tr class="pnl-section-header">
              <td colspan="2">3. Scrap, Wear & Operating Overhead</td>
              <td style="text-align:right;">Deductions (₹)</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">Print Failures & Scrap Waste (${pnl.scrapGrams}g logged)</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.scrapLoss)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">Machine Wear & Sinking Depreciation Reserve (${pnl.totalPrintHours.toFixed(1)} hrs @ ₹15/hr)</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.depreciationReserve)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-left:16px;">General Workshop Supplies & Tools</td>
              <td class="text-right" style="color:var(--danger);">${formatCurrency(pnl.otherExpenses)}</td>
            </tr>

            <!-- NET PROFIT -->
            <tr class="pnl-summary-row" style="background:rgba(124, 58, 237, 0.1);border-color:var(--accent);">
              <td colspan="2" style="font-size:1.05rem;color:var(--accent);">NET OPERATING PROFIT (EBITDA)</td>
              <td class="text-right" style="font-size:1.15rem;font-weight:900;color:var(--accent);">
                ${formatCurrency(pnl.netOperatingProfit)} (${pnl.netMargin.toFixed(1)}%)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Right Column: Filament Consumption Burn Rate & Reorder Forecasting -->
      <div class="card" style="padding:var(--space-lg);">
        <h3 style="margin:0 0 6px;font-size:1.05rem;font-weight:700;">Filament Reorder Forecasting</h3>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:14px;">
          Dynamic 30-day burn rate vs real-time stock levels with automatic replenishment alerts
        </p>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${pnl.forecast.map(item => `
            <div style="background:rgba(255,255,255,0.02);border:1px solid ${item.status === 'critical' ? 'rgba(239,68,68,0.4)' : item.status === 'warning' ? 'rgba(234,179,8,0.4)' : 'var(--border)'};border-radius:var(--radius-md);padding:10px 12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.hex};border:0.5px solid rgba(255,255,255,0.2);"></span>
                  <span style="font-weight:600;font-size:0.88rem;color:var(--text-primary);">${escapeHtml(item.name)}</span>
                </div>
                <span style="font-size:0.75rem;font-weight:700;color:${item.status === 'critical' ? 'var(--danger)' : item.status === 'warning' ? '#eab308' : '#4ade80'};">
                  ${item.statusLabel}
                </span>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:0.78rem;color:var(--text-secondary);">
                <span>Stock: <strong>${item.spools} spools (${item.currentStockGrams}g)</strong></span>
                <span>Burn: ~${item.dailyBurnRate}g/day</span>
                <span>Runway: <strong>${item.daysRemaining} days</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
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

  // P&L Range buttons
  container.querySelectorAll('[data-pnl-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      _pnlRange = btn.dataset.pnlRange;
      render(container);
    });
  });

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
    body: `<p>Are you sure you want to delete this transaction: <strong>${escapeHtml(txn.description || 'Untitled')}</strong> (${formatCurrency(txn.amount)})?</p>`,
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

function openTransactionModal(defaultType = 'sale', editId = null) {
  const existing = editId ? getAll('transactions').find(t => t.id === editId) : null;
  const isEdit = !!existing;
  const currentType = existing?.type || defaultType;

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Type *</label>
        <select class="form-select" id="txn-type">
          <option value="sale" ${currentType === 'sale' ? 'selected' : ''}>Sale (Inflow)</option>
          <option value="expense" ${currentType === 'expense' ? 'selected' : ''}>Expense (Outflow)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-select" id="txn-category">
          ${TRANSACTION_CATEGORIES.map(c => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Amount (₹) *</label>
        <input class="form-input" type="number" id="txn-amount" min="0" step="0.01" value="${existing?.amount ?? ''}" placeholder="0.00" required />
      </div>
      <div class="form-group">
        <label class="form-label">Date *</label>
        <input class="form-input" type="date" id="txn-date" value="${formatDateInput(existing?.date || todayStr())}" required />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Description *</label>
      <input class="form-input" id="txn-description" value="${escapeHtml(existing?.description || '')}" placeholder="e.g. Custom Helmet 3D Print, Numakers PLA Purchase" required />
    </div>

    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="txn-notes" placeholder="Invoice reference, payment mode (UPI/Cash), scrap details...">${escapeHtml(existing?.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit Transaction' : (currentType === 'sale' ? 'Add Sale Transaction' : 'Add Expense Transaction'),
    body,
    confirmText: isEdit ? 'Save Changes' : 'Record Transaction',
    onConfirm: () => {
      const desc = document.getElementById('txn-description').value.trim();
      const amount = parseFloat(document.getElementById('txn-amount').value);

      if (!desc) {
        showToast('Description is required', 'error');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      const data = {
        type: document.getElementById('txn-type').value,
        category: document.getElementById('txn-category').value,
        amount,
        date: document.getElementById('txn-date').value || todayStr(),
        description: desc,
        notes: document.getElementById('txn-notes').value.trim(),
      };

      if (isEdit) {
        update('transactions', editId, data);
        showToast('Transaction updated!', 'success');
      } else {
        create('transactions', data);
        showToast('Transaction recorded!', 'success');
      }

      closeModal();
      const contentEl = document.getElementById('content');
      if (contentEl) render(contentEl);
    },
  });
}
