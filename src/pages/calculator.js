/**
 * Made N More — Calculator Page
 * Print cost estimator with live-updating results
 */

import { getSettings } from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';

export function renderCalculator(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Cost Calculator</h1>
        <p class="text-secondary">Estimate the cost of a 3D print job before you start</p>
      </div>
    </div>

    <div class="calc-layout animate-in animate-delay-1">
      <!-- Input Side -->
      <div class="card">
        <h3 style="margin-bottom:var(--space-lg);">Print Parameters</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Print Weight (grams) *</label>
            <input class="form-input" type="number" id="calc-weight" min="0" step="0.1" value="50" placeholder="e.g. 50" />
          </div>
          <div class="form-group">
            <label class="form-label">Material Type</label>
            <select class="form-select" id="calc-material">
              ${MATERIAL_TYPES.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Filament Cost (₹/kg)</label>
            <input class="form-input" type="number" id="calc-cost-per-kg" min="0" step="10" value="${settings.materialCosts['PLA+'] || 700}" />
          </div>
          <div class="form-group">
            <label class="form-label">Print Time (hours)</label>
            <input class="form-input" type="number" id="calc-time" min="0" step="0.25" value="2" placeholder="e.g. 2" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Electricity Rate (₹/kWh)</label>
            <input class="form-input" type="number" id="calc-elec-rate" min="0" step="0.5" value="${settings.electricityRate}" />
          </div>
          <div class="form-group">
            <label class="form-label">Printer Power (Watts)</label>
            <input class="form-input" type="number" id="calc-power" min="0" step="10" value="${settings.printerPower}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Markup / Profit Margin (%)</label>
          <input class="form-input" type="number" id="calc-markup" min="0" max="500" step="5" value="${settings.defaultMarkup}" />
          <div style="margin-top:8px;height:6px;border-radius:3px;background:rgba(255,255,255,0.05);overflow:hidden;">
            <div id="calc-markup-bar" style="height:100%;width:${settings.defaultMarkup}%;background:var(--accent-gradient);border-radius:3px;transition:width 0.3s ease;"></div>
          </div>
        </div>

        <div class="form-group" style="margin-top:var(--space-md);">
          <label class="form-label">Failure / Waste Factor (%)</label>
          <input class="form-input" type="number" id="calc-waste" min="0" max="100" step="1" value="5" />
        </div>
      </div>

      <!-- Results Side -->
      <div>
        <div class="card calc-result-card" style="margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:var(--space-lg);">Cost Breakdown</h3>

          <div id="calc-results">
            <!-- Filled by JS -->
          </div>
        </div>

        <!-- Quick reference -->
        <div class="card">
          <h3 style="margin-bottom:var(--space-md);">Material Costs Reference</h3>
          <div style="font-size:0.85rem;">
            ${Object.entries(settings.materialCosts).map(([mat, cost]) => `
              <div class="calc-result-row">
                <span class="label">${mat}</span>
                <span class="value">${formatCurrency(cost)}/kg</span>
              </div>
            `).join('')}
          </div>
          <p class="text-muted" style="font-size:0.75rem;margin-top:var(--space-md);">Edit default costs in Settings →</p>
        </div>
      </div>
    </div>
  `;

  // Bind live calculation
  const inputs = ['calc-weight', 'calc-cost-per-kg', 'calc-time', 'calc-elec-rate', 'calc-power', 'calc-markup', 'calc-waste'];
  inputs.forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('input', () => calculate(container));
  });

  // Material change → auto-fill cost
  container.querySelector('#calc-material')?.addEventListener('change', (e) => {
    const mat = e.target.value;
    const cost = settings.materialCosts[mat] || 700;
    const costInput = container.querySelector('#calc-cost-per-kg');
    if (costInput) costInput.value = cost;
    calculate(container);
  });

  // Markup bar
  container.querySelector('#calc-markup')?.addEventListener('input', (e) => {
    const bar = container.querySelector('#calc-markup-bar');
    if (bar) bar.style.width = `${Math.min(e.target.value, 100)}%`;
  });

  // Initial calculation
  calculate(container);
}

function calculate(container) {
  const weight = parseFloat(container.querySelector('#calc-weight')?.value) || 0;
  const costPerKg = parseFloat(container.querySelector('#calc-cost-per-kg')?.value) || 0;
  const time = parseFloat(container.querySelector('#calc-time')?.value) || 0;
  const elecRate = parseFloat(container.querySelector('#calc-elec-rate')?.value) || 0;
  const power = parseFloat(container.querySelector('#calc-power')?.value) || 0;
  const markup = parseFloat(container.querySelector('#calc-markup')?.value) || 0;
  const waste = parseFloat(container.querySelector('#calc-waste')?.value) || 0;

  // Calculations
  const materialCost = (weight / 1000) * costPerKg;
  const wasteCost = materialCost * (waste / 100);
  const electricityCost = (time * (power / 1000)) * elecRate;
  const totalCost = materialCost + wasteCost + electricityCost;
  const suggestedPrice = totalCost * (1 + markup / 100);
  const profit = suggestedPrice - totalCost;

  const resultsEl = container.querySelector('#calc-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = `
    <div class="calc-result-row">
      <span class="label">Material Cost</span>
      <span class="value">${formatCurrency(materialCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Waste Factor (${waste}%)</span>
      <span class="value">${formatCurrency(wasteCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Electricity Cost</span>
      <span class="value">${formatCurrency(electricityCost)}</span>
    </div>
    <div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
      <span class="label" style="font-weight:600;">Total Production Cost</span>
      <span class="value">${formatCurrency(totalCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Markup (${markup}%)</span>
      <span class="value text-success">+${formatCurrency(profit)}</span>
    </div>
    <div class="calc-result-row calc-total-row">
      <span class="label">Suggested Selling Price</span>
      <span class="value">${formatCurrency(suggestedPrice)}</span>
    </div>
    <div style="text-align:center;margin-top:var(--space-lg);">
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Your Profit per Print</div>
      <div style="font-size:1.8rem;font-weight:800;color:var(--success);">${formatCurrency(profit)}</div>
    </div>
  `;
}
