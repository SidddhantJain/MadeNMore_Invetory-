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
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

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
        <h1>Dashboard</h1>
        <p class="text-secondary">Welcome back to Made N More — here's your business at a glance</p>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="stat-grid">
      <div class="card card-lift stat-card animate-in animate-delay-1">
        <div class="card-title">Total Revenue</div>
        <div class="stat-value text-success">${formatCurrency(stats.totalSales)}</div>
        <div class="stat-label">${transactions.filter(t => t.type === 'sale').length} sales recorded</div>
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
          ${stats.netAfterMachine >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(stats.netAfterMachine))} after machine cost
        </span>
      </div>
      <div class="card card-lift stat-card animate-in animate-delay-4">
        <div class="card-title">Filament Stock</div>
        <div class="stat-value">${stats.totalSpools}</div>
        <div class="stat-label">${stats.totalFilaments} colors • ${stats.usableSpools} usable spools</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="dashboard-grid">
      <!-- Monthly Revenue Chart -->
      <div class="card animate-in animate-delay-2">
        <div class="card-header">
          <span class="card-title">Monthly Revenue</span>
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
