/**
 * Made N More — Dashboard Page
 * Financial overview with stats, charts, and recent activity
 */

import { getStats, getAll } from '../data/store.js';
import { MATERIAL_BADGES } from '../data/seed.js';
import { formatCurrency, formatDate, getMonthName } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';

export function renderDashboard(container) {
  const stats = getStats();
  const transactions = getAll('transactions');
  const filaments = getAll('filaments');
  const orders = getAll('orders');
  const printers = getAll('printers');
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  // Financial metrics
  const profitMargin = stats.totalSales > 0 ? Math.round((stats.netProfit / stats.totalSales) * 100) : 0;
  const inventoryValuation = filaments.reduce((sum, f) => sum + ((f.spools || 0) * 750), 0);

  // Orders outstanding balance (Receivables)
  const activeOrders = orders.filter(o => o.status !== 'completed' && o.kanbanStage !== 'completed');
  const pendingReceivables = activeOrders.reduce((sum, o) => {
    const paid = (o.payments || []).reduce((pSum, p) => pSum + (p.amount || 0), 0);
    return sum + Math.max(0, (o.totalAmount || 0) - paid);
  }, 0);

  // Low stock filaments watchlist
  const lowStockFilaments = filaments.filter(f => (f.spools || 0) <= 1 || f.usable === false);

  // Monthly chart data
  const monthlyEntries = Object.entries(stats.monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);
  const maxMonthly = Math.max(...monthlyEntries.map(([, d]) => d.sales), 1);

  // Material donut
  const matEntries = Object.entries(stats.materialBreakdown).sort((a, b) => b[1] - a[1]);
  const matColors = {
    'PLA+': '#22c55e', 'PETG-HS': '#3b82f6', 'ABS': '#ef4444',
    'TPU+': '#f59e0b', 'PLA Silk': '#d946ef', 'PLA Matt': '#94a3b8',
  };

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Executive Command Center</h1>
        <p class="text-secondary">Real-time print farm telemetry, commercial cash flow, inventory valuation & actionable priorities</p>
      </div>
      <div class="page-header-actions">
        <a href="#/orders" class="btn btn-secondary btn-sm">
          <span>📦</span> Orders Pipeline (${activeOrders.length})
        </a>
        <a href="#/printers" class="btn btn-primary btn-sm">
          <span>📡</span> Fleet Hub
        </a>
      </div>
    </div>

    <!-- Live Fleet Strip -->
    <div class="dashboard-farm-strip animate-in">
      <a href="#/printers" class="farm-machine-chip active-print" title="Snapmaker U1 Moonraker Telemetry">
        <div class="farm-chip-dot printing"></div>
        <div class="farm-chip-details">
          <div class="farm-chip-name">Snapmaker U1 #01</div>
          <div class="farm-chip-sub">
            <span>Dual Direct Drive</span>
            <span style="color:#60a5fa;font-family:var(--font-mono);font-weight:600;">192.168.0.144</span>
          </div>
        </div>
        <span class="badge" style="background:rgba(59,130,246,0.2);color:#93c5fd;font-size:0.7rem;">Moonraker</span>
      </a>

      <a href="#/printers" class="farm-machine-chip" title="Bambu Lab X1-Carbon">
        <div class="farm-chip-dot idle"></div>
        <div class="farm-chip-details">
          <div class="farm-chip-name">Bambu Lab X1-Carbon #02</div>
          <div class="farm-chip-sub">
            <span>High-Speed CoreXY</span>
            <span style="color:#4ade80;">Ready / Idle</span>
          </div>
        </div>
        <span class="badge" style="background:rgba(34,197,94,0.15);color:#4ade80;font-size:0.7rem;">Standby</span>
      </a>

      <a href="#/printers" class="farm-machine-chip" title="Creality K1 Max">
        <div class="farm-chip-dot idle"></div>
        <div class="farm-chip-details">
          <div class="farm-chip-name">Creality K1 Max #03</div>
          <div class="farm-chip-sub">
            <span>Large Format 300mm³</span>
            <span style="color:#4ade80;">Ready / Idle</span>
          </div>
        </div>
        <span class="badge" style="background:rgba(34,197,94,0.15);color:#4ade80;font-size:0.7rem;">Standby</span>
      </a>
    </div>

    <!-- Actionable Priorities Strip -->
    <div class="attention-grid animate-in animate-delay-1">
      <!-- Low Spool Warning -->
      <a href="#/inventory" class="attention-card alert-low-stock" style="text-decoration:none;">
        <div class="attention-icon">⚠️</div>
        <div class="attention-body">
          <div class="attention-title">${lowStockFilaments.length} Filament(s) Low on Stock</div>
          <div class="attention-desc">
            ${lowStockFilaments.length > 0 
              ? `${escapeHtml(lowStockFilaments[0].name)} has ${lowStockFilaments[0].spools || 0} spool remaining. Replenish reserve.`
              : 'All filament spools are well stocked above safety buffer.'}
          </div>
        </div>
      </a>

      <!-- Pending Receivables -->
      <a href="#/orders" class="attention-card alert-receivables" style="text-decoration:none;">
        <div class="attention-icon">💵</div>
        <div class="attention-body">
          <div class="attention-title">${formatCurrency(pendingReceivables)} Pending Receivables</div>
          <div class="attention-desc">
            ${activeOrders.length} active client order(s) currently in production with outstanding payments.
          </div>
        </div>
      </a>

      <!-- Preventative Maintenance -->
      <a href="#/printers" class="attention-card alert-maintenance" style="text-decoration:none;">
        <div class="attention-icon">🔧</div>
        <div class="attention-body">
          <div class="attention-title">Preventative Maintenance Due</div>
          <div class="attention-desc">
            Snapmaker U1 #01 has exceeded 400 print hours. Z-axis lead screw lubrication recommended.
          </div>
        </div>
      </a>
    </div>

    <!-- Stat Cards -->
    <div class="stat-grid">
      <div class="card card-lift stat-card animate-in animate-delay-1">
        <div class="card-title">Total Revenue</div>
        <div class="stat-value text-success">${formatCurrency(stats.totalSales)}</div>
        <div class="stat-label">${transactions.filter(t => t.type === 'sale').length} sales recorded • Net Margin: ${profitMargin}%</div>
      </div>
      <div class="card card-lift stat-card animate-in animate-delay-2">
        <div class="card-title">Total Expenses</div>
        <div class="stat-value text-danger">${formatCurrency(stats.totalExpenses)}</div>
        <div class="stat-label">${transactions.filter(t => t.type === 'expense').length} expenses recorded</div>
      </div>
      <div class="card card-lift stat-card animate-in animate-delay-3">
        <div class="card-title">Net Profit</div>
        <div class="stat-value ${stats.netProfit >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(stats.netProfit)}</div>
        <span class="stat-change ${stats.netAfterMachine >= 0 ? 'positive' : 'negative'}">
          ${stats.netAfterMachine >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(stats.netAfterMachine))} after machine write-off
        </span>
      </div>
      <div class="card card-lift stat-card animate-in animate-delay-4">
        <div class="card-title">Stock Valuation</div>
        <div class="stat-value text-accent">${formatCurrency(inventoryValuation)}</div>
        <div class="stat-label">${stats.totalSpools} spools in rack • ${stats.usableSpools} ready for print</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="dashboard-grid">
      <!-- Monthly Revenue Chart -->
      <div class="card animate-in animate-delay-2">
        <div class="card-header">
          <span class="card-title">Monthly Revenue & Cash Inflow</span>
        </div>
        <div class="chart-container">
          <div class="chart-bar-group" style="padding-bottom: 28px;">
            ${monthlyEntries.map(([month, data]) => {
              const pct = (data.sales / maxMonthly) * 100;
              return `
                <div class="chart-bar" style="height: ${Math.max(pct, 3)}%;">
                  <span class="chart-bar-value">${formatCurrency(data.sales)}</span>
                  <span class="chart-bar-label">${getMonthName(month)}</span>
                </div>`;
            }).join('')}
            ${monthlyEntries.length === 0 ? '<div style="display:flex;align-items:center;justify-content:center;width:100%;color:var(--text-muted);font-size:0.85rem;">No data yet</div>' : ''}
          </div>
        </div>
      </div>

      <!-- Material Breakdown Donut -->
      <div class="card animate-in animate-delay-3">
        <div class="card-header">
          <span class="card-title">Spools by Material</span>
        </div>
        ${renderDonutChart(matEntries, matColors, stats.totalSpools)}
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="card animate-in animate-delay-3">
      <div class="card-header">
        <span class="card-title">Recent Transactions</span>
        <a href="#/transactions" class="btn btn-ghost btn-sm">View All →</a>
      </div>
      <div class="recent-list">
        ${recent.length > 0 ? recent.map(t => `
          <div class="recent-item">
            <div class="recent-item-left">
              <div class="recent-item-icon ${t.type}">${t.type === 'sale' ? '↑' : '↓'}</div>
              <div>
                <div class="recent-item-desc">${escapeHtml(t.description || 'Untitled')}</div>
                <div class="recent-item-date">${formatDate(t.date)}${t.category ? ' • ' + t.category : ''}</div>
              </div>
            </div>
            <div class="recent-item-amount ${t.type === 'sale' ? 'positive' : 'negative'}">
              ${t.type === 'sale' ? '+' : '-'}${formatCurrency(t.amount)}
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>No transactions yet. Add your first sale or expense!</p></div>'}
      </div>
    </div>
  `;
}

function renderDonutChart(entries, colors, total) {
  if (entries.length === 0) {
    return '<div class="empty-state"><p>No filaments in stock</p></div>';
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const segments = entries.map(([mat, count]) => {
    const pct = count / total;
    const dashLength = pct * circumference;
    const dashOffset = currentOffset;
    currentOffset += dashLength;
    return { mat, count, dashLength, dashOffset, color: colors[mat] || '#888' };
  });

  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center;">
      <div class="donut-chart">
        <svg viewBox="0 0 140 140">
          ${segments.map(s => `
            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="${s.color}" stroke-width="18"
              stroke-dasharray="${s.dashLength} ${circumference - s.dashLength}"
              stroke-dashoffset="${-s.dashOffset}" opacity="0.85"/>
          `).join('')}
        </svg>
        <div class="donut-chart-center">
          <span class="value">${total}</span>
          <span class="label">spools</span>
        </div>
      </div>
      <div class="donut-legend">
        ${segments.map(s => `
          <div class="donut-legend-item">
            <span class="donut-legend-dot" style="background:${s.color}"></span>
            <span>${s.mat}</span>
            <span style="margin-left:auto;font-weight:600;">${s.count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
