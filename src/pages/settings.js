/**
 * Made N More — Settings Page
 * Configure business defaults, material costs, export/import data
 */

import { getSettings, updateSettings, exportData, importData, exportCSV, clearAll } from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, escapeHtml, downloadFile, readFileAsText } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderSettings(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Settings</h1>
        <p class="text-secondary">Configure your business defaults and manage data</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Business Settings -->
      <div class="card settings-section animate-in animate-delay-1">
        <h3>🏢 Business</h3>
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input class="form-input" id="set-biz-name" value="${escapeHtml(settings.businessName)}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Machine Cost (₹)</label>
            <input class="form-input" type="number" id="set-machine-cost" value="${settings.machineCost}" step="0.01" />
          </div>
          <div class="form-group">
            <label class="form-label">Default Markup (%)</label>
            <input class="form-input" type="number" id="set-markup" value="${settings.defaultMarkup}" min="0" max="500" />
          </div>
        </div>
        <button class="btn btn-primary w-full mt-md" id="btn-save-business">Save Business Settings</button>
      </div>

      <!-- Printer Settings -->
      <div class="card settings-section animate-in animate-delay-2">
        <h3>🖨️ Printer</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Electricity Rate (₹/kWh)</label>
            <input class="form-input" type="number" id="set-elec" value="${settings.electricityRate}" step="0.5" />
          </div>
          <div class="form-group">
            <label class="form-label">Printer Power (Watts)</label>
            <input class="form-input" type="number" id="set-power" value="${settings.printerPower}" step="10" />
          </div>
        </div>
        <button class="btn btn-primary w-full mt-md" id="btn-save-printer">Save Printer Settings</button>
      </div>

      <!-- Material Costs -->
      <div class="card settings-section animate-in animate-delay-3">
        <h3>🎨 Material Costs (₹/kg)</h3>
        ${MATERIAL_TYPES.map(mat => `
          <div class="form-group">
            <label class="form-label">${mat}</label>
            <input class="form-input" type="number" id="set-mat-${mat.replace(/[^a-zA-Z]/g, '')}" 
              value="${settings.materialCosts[mat] || 0}" step="10" data-material="${mat}" />
          </div>
        `).join('')}
        <button class="btn btn-primary w-full mt-md" id="btn-save-materials">Save Material Costs</button>
      </div>

      <!-- Data Management -->
      <div class="card settings-section animate-in animate-delay-4">
        <h3>💾 Data Management</h3>

        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <button class="btn btn-secondary w-full" id="btn-export-json">
            <span style="width:16px;height:16px;">${ICONS.download}</span>
            Export All Data (JSON)
          </button>

          <button class="btn btn-secondary w-full" id="btn-export-filaments-csv">
            <span style="width:16px;height:16px;">${ICONS.download}</span>
            Export Filaments (CSV)
          </button>

          <button class="btn btn-secondary w-full" id="btn-export-transactions-csv">
            <span style="width:16px;height:16px;">${ICONS.download}</span>
            Export Transactions (CSV)
          </button>

          <div style="position:relative;">
            <button class="btn btn-secondary w-full" id="btn-import-json">
              <span style="width:16px;height:16px;">${ICONS.upload}</span>
              Import Data (JSON)
            </button>
            <input type="file" id="import-file-input" accept=".json" style="position:absolute;inset:0;opacity:0;cursor:pointer;" />
          </div>

          <hr style="border:none;border-top:1px solid var(--border);margin:var(--space-md) 0;" />

          <button class="btn btn-danger w-full" id="btn-clear-data">
            <span style="width:16px;height:16px;">${ICONS.trash}</span>
            Reset All Data
          </button>
        </div>

        <p class="text-muted" style="font-size:0.72rem;margin-top:var(--space-md);text-align:center;">
          All data is stored locally in your browser. Export regularly to back up.
        </p>
      </div>
    </div>
  `;

  bindEvents(container);
}

function bindEvents(container) {
  // Save business settings
  container.querySelector('#btn-save-business')?.addEventListener('click', () => {
    updateSettings({
      businessName: container.querySelector('#set-biz-name').value.trim() || 'Made N More',
      machineCost: parseFloat(container.querySelector('#set-machine-cost').value) || 0,
      defaultMarkup: parseFloat(container.querySelector('#set-markup').value) || 0,
    });
    showToast('Business settings saved!', 'success');
  });

  // Save printer settings
  container.querySelector('#btn-save-printer')?.addEventListener('click', () => {
    updateSettings({
      electricityRate: parseFloat(container.querySelector('#set-elec').value) || 8,
      printerPower: parseFloat(container.querySelector('#set-power').value) || 350,
    });
    showToast('Printer settings saved!', 'success');
  });

  // Save material costs
  container.querySelector('#btn-save-materials')?.addEventListener('click', () => {
    const settings = getSettings();
    const materialCosts = { ...settings.materialCosts };
    container.querySelectorAll('[data-material]').forEach(input => {
      materialCosts[input.dataset.material] = parseFloat(input.value) || 0;
    });
    updateSettings({ materialCosts });
    showToast('Material costs saved!', 'success');
  });

  // Export JSON
  container.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const data = exportData();
    const date = new Date().toISOString().split('T')[0];
    downloadFile(data, `made-n-more-backup-${date}.json`, 'application/json');
    showToast('Data exported successfully!', 'success');
  });

  // Export CSVs
  container.querySelector('#btn-export-filaments-csv')?.addEventListener('click', () => {
    const csv = exportCSV('filaments');
    if (!csv) { showToast('No filament data to export', 'warning'); return; }
    downloadFile(csv, `filaments-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('Filaments CSV exported!', 'success');
  });

  container.querySelector('#btn-export-transactions-csv')?.addEventListener('click', () => {
    const csv = exportCSV('transactions');
    if (!csv) { showToast('No transaction data to export', 'warning'); return; }
    downloadFile(csv, `transactions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('Transactions CSV exported!', 'success');
  });

  // Import JSON
  container.querySelector('#import-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const success = importData(text, true);
      if (success) {
        showToast('Data imported successfully! Refreshing...', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast('Import failed — invalid JSON', 'error');
      }
    } catch {
      showToast('Failed to read file', 'error');
    }
    e.target.value = '';
  });

  // Clear data
  container.querySelector('#btn-clear-data')?.addEventListener('click', () => {
    showModal({
      title: '⚠️ Reset All Data',
      body: `
        <p>This will <strong>permanently delete</strong> all your filaments, transactions, and settings.</p>
        <p class="text-danger" style="margin-top:12px;font-weight:600;">This cannot be undone. Export your data first!</p>
      `,
      confirmText: 'Yes, Reset Everything',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        clearAll();
        showToast('All data has been reset', 'warning');
        closeModal();
        setTimeout(() => window.location.reload(), 500);
      },
    });
  });
}
