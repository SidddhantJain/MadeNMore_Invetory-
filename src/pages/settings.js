/**
 * Made N More — Settings & System Configuration Page
 * Business defaults, material costs, electricity tariffs, and robust export/import architecture
 */

import {
  getSettings,
  updateSettings,
  exportData,
  exportSettings,
  importData,
  exportCSV,
  clearAll,
  getAll
} from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, escapeHtml, downloadFile, readFileAsText } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderSettings(container) {
  const settings = getSettings();
  const printers = getAll('printers') || [];
  const filaments = getAll('filaments') || [];
  const orders = getAll('orders') || [];
  const accounts = getAll('accounts') || [];
  const transactions = getAll('transactions') || [];
  const consumables = getAll('consumables') || [];

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Settings & System Configuration</h1>
        <p class="text-secondary">Configure workshop defaults, material tariffs, and manage full database exports & imports</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-hdr-export-settings" title="Download only settings and business parameters">
          <span style="font-size:1rem;">⚙️</span>
          Export Settings
        </button>
        <button class="btn btn-secondary" id="btn-hdr-export-full" title="Download complete database backup">
          <span style="font-size:1rem;">📦</span>
          Export Full Backup
        </button>
        <button class="btn btn-primary" id="btn-hdr-import" title="Import settings or restore backup into current system">
          <span style="font-size:1rem;">📥</span>
          Import Config / Data
        </button>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Business & Pricing Settings -->
      <div class="card settings-section animate-in animate-delay-1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">🏢 Business & Pricing Defaults</h3>
          <span class="badge badge-yes" style="font-size:0.7rem;">Active Profile</span>
        </div>

        <div class="form-group">
          <label class="form-label">Business / Lab Name</label>
          <input class="form-input" id="set-biz-name" value="${escapeHtml(settings.businessName || 'Made N More')}" placeholder="e.g. Made N More 3D Labs" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Machine Amortization Cost (₹)</label>
            <input class="form-input" type="number" id="set-machine-cost" value="${settings.machineCost || 55000}" step="500" title="Total capex cost across printer fleet" />
            <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">Depreciated across 3,000 hrs</span>
          </div>
          <div class="form-group">
            <label class="form-label">Default Commercial Markup (%)</label>
            <input class="form-input" type="number" id="set-markup" value="${settings.defaultMarkup || 150}" min="0" max="500" step="5" />
            <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">Standard markup multiplier (150% = 2.5x)</span>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:var(--space-md);">
          <button class="btn btn-primary flex-1" id="btn-save-business">Save Business Settings</button>
          <button class="btn btn-secondary" id="btn-quick-export-settings" title="Export this settings profile as JSON">⚙️ Export</button>
        </div>
      </div>

      <!-- Electrical & Hardware Power -->
      <div class="card settings-section animate-in animate-delay-2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">⚡ Electricity & Energy Draw</h3>
          <span style="font-size:0.75rem;color:var(--text-secondary);">MSEDCL Commercial Rate</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Commercial Tariff (₹/kWh)</label>
            <input class="form-input" type="number" id="set-elec" value="${settings.electricityRate || 8.5}" step="0.5" />
            <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">Standard Pune commercial rate (₹8.50)</span>
          </div>
          <div class="form-group">
            <label class="form-label">Avg Printer Draw (Watts)</label>
            <input class="form-input" type="number" id="set-power" value="${settings.printerPower || 350}" step="10" />
            <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">CoreXY heated bed + nozzle draw (~350W)</span>
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;margin:12px 0;font-size:0.78rem;">
          <div style="color:var(--text-secondary);margin-bottom:2px;">Calculated Running Power Cost:</div>
          <strong style="color:var(--accent);">₹${(((settings.printerPower || 350) / 1000) * (settings.electricityRate || 8.5)).toFixed(2)} / printing hour</strong>
        </div>

        <button class="btn btn-primary w-full mt-sm" id="btn-save-printer">Save Energy Settings</button>
      </div>

      <!-- Material Cost Matrix -->
      <div class="card settings-section animate-in animate-delay-3">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">🎨 Material Cost Matrix (₹/kg)</h3>
          <span style="font-size:0.75rem;color:var(--text-secondary);">Direct Filaments Baseline</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${MATERIAL_TYPES.map(mat => `
            <div class="form-group" style="margin-bottom:8px;">
              <label class="form-label" style="font-size:0.78rem;">${mat}</label>
              <input class="form-input" type="number" id="set-mat-${mat.replace(/[^a-zA-Z0-9]/g, '')}" 
                value="${settings.materialCosts[mat] !== undefined ? settings.materialCosts[mat] : 1000}" step="10" data-material="${mat}" />
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary w-full mt-md" id="btn-save-materials">Save Material Tariffs</button>
      </div>

      <!-- Data Management & Backups Card -->
      <div class="card settings-section animate-in animate-delay-4">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">💾 Data Management & Backups</h3>
          <span class="badge badge-yes" style="font-size:0.7rem;">ACID Persisted</span>
        </div>

        <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">
          Current Database Status: <strong>${filaments.length} spools</strong>, <strong>${printers.length} machines</strong>, <strong>${orders.length} orders</strong>, <strong>${accounts.length} accounts</strong>.
        </div>

        <!-- Export Buttons Grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="btn-export-settings-json" title="Export only configuration settings without records">
            ⚙️ Export Settings
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-export-json" title="Export complete database archive with all records">
            📦 Full Backup (JSON)
          </button>
        </div>

        <!-- CSV Reports Ribbon -->
        <div style="margin-bottom:14px;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">📊 Spreadsheet Reports (CSV)</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button class="btn btn-ghost btn-sm" id="btn-export-filaments-csv" style="font-size:0.75rem;">🧵 Filaments</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-orders-csv" style="font-size:0.75rem;">📋 Orders</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-transactions-csv" style="font-size:0.75rem;">💰 Ledger</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-consumables-csv" style="font-size:0.75rem;">📦 Consumables</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-accounts-csv" style="font-size:0.75rem;">💳 Accounts</button>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid var(--border);margin:12px 0;" />

        <!-- Import Action Button -->
        <button class="btn btn-primary w-full" id="btn-open-import-modal" style="font-weight:700;">
          <span style="font-size:1.1rem;margin-right:4px;">📥</span>
          Import Settings / Restore Archive
        </button>

        <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-ghost btn-sm text-danger" id="btn-clear-data" style="font-size:0.75rem;">
            ⚠️ Reset All Workshop Data
          </button>
          <span style="font-size:0.7rem;color:var(--text-muted);">v6.0 Unified Farm OS</span>
        </div>
      </div>
    </div>
  `;

  bindEvents(container);
}

function bindEvents(container) {
  // Save Business Settings
  container.querySelector('#btn-save-business')?.addEventListener('click', () => {
    updateSettings({
      businessName: container.querySelector('#set-biz-name').value.trim() || 'Made N More',
      machineCost: parseFloat(container.querySelector('#set-machine-cost').value) || 0,
      defaultMarkup: parseFloat(container.querySelector('#set-markup').value) || 0,
    });
    showToast('Business & Pricing settings saved!', 'success');
  });

  // Save Energy Settings
  container.querySelector('#btn-save-printer')?.addEventListener('click', () => {
    updateSettings({
      electricityRate: parseFloat(container.querySelector('#set-elec').value) || 8.5,
      printerPower: parseFloat(container.querySelector('#set-power').value) || 350,
    });
    showToast('Energy tariffs and power settings saved!', 'success');
  });

  // Save Material Tariffs
  container.querySelector('#btn-save-materials')?.addEventListener('click', () => {
    const settings = getSettings();
    const materialCosts = { ...settings.materialCosts };
    container.querySelectorAll('[data-material]').forEach(input => {
      materialCosts[input.dataset.material] = parseFloat(input.value) || 0;
    });
    updateSettings({ materialCosts });
    showToast('Material cost matrix updated!', 'success');
  });

  // Export Settings Only (JSON)
  const handleExportSettings = () => {
    const jsonStr = exportSettings();
    const date = new Date().toISOString().split('T')[0];
    downloadFile(jsonStr, `madenmore_settings_${date}.json`, 'application/json');
    showToast('⚙️ Settings profile exported successfully!', 'success');
  };

  container.querySelector('#btn-hdr-export-settings')?.addEventListener('click', handleExportSettings);
  container.querySelector('#btn-quick-export-settings')?.addEventListener('click', handleExportSettings);
  container.querySelector('#btn-export-settings-json')?.addEventListener('click', handleExportSettings);

  // Export Complete Backup (JSON)
  const handleExportFull = () => {
    const data = exportData();
    const date = new Date().toISOString().split('T')[0];
    downloadFile(data, `madenmore_full_backup_${date}.json`, 'application/json');
    showToast('📦 Complete Workshop OS Archive exported successfully!', 'success');
  };

  container.querySelector('#btn-hdr-export-full')?.addEventListener('click', handleExportFull);
  container.querySelector('#btn-export-json')?.addEventListener('click', handleExportFull);

  // CSV Exports
  container.querySelector('#btn-export-filaments-csv')?.addEventListener('click', () => {
    const csv = exportCSV('filaments');
    if (!csv) return showToast('No filament data to export', 'warning');
    downloadFile(csv, `filaments_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('🧵 Filaments CSV exported!', 'success');
  });

  container.querySelector('#btn-export-orders-csv')?.addEventListener('click', () => {
    const csv = exportCSV('orders');
    if (!csv) return showToast('No order records to export', 'warning');
    downloadFile(csv, `orders_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('📋 Orders CSV exported!', 'success');
  });

  container.querySelector('#btn-export-transactions-csv')?.addEventListener('click', () => {
    const csv = exportCSV('transactions');
    if (!csv) return showToast('No transaction data to export', 'warning');
    downloadFile(csv, `transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('💰 Ledger transactions CSV exported!', 'success');
  });

  container.querySelector('#btn-export-consumables-csv')?.addEventListener('click', () => {
    const csv = exportCSV('consumables');
    if (!csv) return showToast('No consumables to export', 'warning');
    downloadFile(csv, `consumables_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('📦 Consumables CSV exported!', 'success');
  });

  container.querySelector('#btn-export-accounts-csv')?.addEventListener('click', () => {
    const csv = exportCSV('accounts');
    if (!csv) return showToast('No accounts to export', 'warning');
    downloadFile(csv, `accounts_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('💳 Accounts CSV exported!', 'success');
  });

  // Open Interactive Import Modal
  const handleOpenImport = () => openImportModal(container);
  container.querySelector('#btn-hdr-import')?.addEventListener('click', handleOpenImport);
  container.querySelector('#btn-open-import-modal')?.addEventListener('click', handleOpenImport);

  // Reset All Data
  container.querySelector('#btn-clear-data')?.addEventListener('click', () => {
    showModal({
      title: '⚠️ Reset All Workshop Data',
      body: `
        <p>This will <strong>permanently delete</strong> all filaments, active orders, printer configs, and transactions from the local database.</p>
        <p class="text-danger" style="margin-top:12px;font-weight:600;">This cannot be undone. Please ensure you have exported a full backup first!</p>
      `,
      confirmText: 'Yes, Reset Everything',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await clearAll();
        showToast('All workshop records reset to factory defaults', 'warning');
        closeModal();
        renderSettings(container);
      },
    });
  });
}

/**
 * Interactive Import Configuration & Data Modal
 * Inspects JSON, detects settings vs full archive, and allows Merge vs Clean Restore
 */
function openImportModal(container) {
  let loadedParsedData = null;
  let rawJsonText = null;

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:14px;">
      <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);margin-bottom:4px;">
        Select Settings or Backup Archive (.json)
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary);">
        Supports Settings Profiles, Inventory Backups, or Complete Workshop OS Archives.
      </div>
    </div>

    <!-- Drag & Drop Dropzone -->
    <div id="import-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:24px 16px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.02);transition:all 0.2s ease;">
      <input type="file" id="modal-import-file-input" accept=".json" style="display:none;" />
      <div style="font-size:2rem;margin-bottom:6px;">📂</div>
      <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);" id="import-dropzone-title">
        Click to Choose or Drag & Drop .JSON File
      </div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:4px;" id="import-dropzone-subtitle">
        Max recommended file size: 50MB
      </div>
    </div>

    <!-- File Inspection / Summary Box (Hidden until file selected) -->
    <div id="import-inspection-box" style="display:none;margin-top:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
      <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>🔍 Detected Archive Contents:</span>
        <span id="import-badge-type" class="badge badge-yes" style="font-size:0.7rem;">Valid JSON</span>
      </div>

      <div id="import-summary-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;"></div>

      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label" style="font-weight:700;">Import Mode:</label>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.82rem;cursor:pointer;">
            <input type="radio" name="import-mode" value="merge" checked style="margin-top:3px;" />
            <div>
              <strong>Merge with Current Data (Recommended)</strong>
              <div style="color:var(--text-secondary);font-size:0.75rem;">
                Updates settings and merges records into the active database without deleting your current work.
              </div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;font-size:0.82rem;cursor:pointer;">
            <input type="radio" name="import-mode" value="replace" style="margin-top:3px;" />
            <div>
              <strong>Clean Restore / Replace All</strong>
              <div style="color:var(--text-secondary);font-size:0.75rem;">
                Completely overwrites all workshop data with this backup archive.
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  `;

  showModal({
    title: 'Import Settings & Workshop Data',
    body,
    confirmText: 'Confirm & Apply Import',
    onConfirm: async () => {
      if (!rawJsonText || !loadedParsedData) {
        showToast('Please select a valid JSON backup file first', 'error');
        return;
      }

      const replace = document.querySelector('input[name="import-mode"]:checked')?.value === 'replace';
      showToast('Importing and persisting to database...', 'info');

      const result = await importData(rawJsonText, replace);
      if (result && result.success) {
        showToast('🎉 Configuration & data imported successfully!', 'success');
        closeModal();
        renderSettings(container);
      } else {
        showToast(`Import failed: ${result?.error || 'Invalid format'}`, 'error');
      }
    },
  });

  // Modal interactions wireup
  setTimeout(() => {
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('modal-import-file-input');
    const inspectionBox = document.getElementById('import-inspection-box');
    const dropzoneTitle = document.getElementById('import-dropzone-title');
    const chipsContainer = document.getElementById('import-summary-chips');
    const badgeType = document.getElementById('import-badge-type');

    dropzone?.addEventListener('click', () => fileInput?.click());

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent)';
      dropzone.style.background = 'rgba(59,130,246,0.08)';
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border)';
      dropzone.style.background = 'rgba(255,255,255,0.02)';
    });

    const processFile = async (file) => {
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        const parsed = JSON.parse(text);
        rawJsonText = text;
        loadedParsedData = parsed;

        if (dropzoneTitle) dropzoneTitle.textContent = `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        if (inspectionBox) inspectionBox.style.display = 'block';

        // Detect contents
        const chips = [];
        const isSettingsOnly = parsed.exportType === 'settings_only' || (!parsed.filaments && !parsed.printers && (parsed.settings || parsed.businessName));
        if (badgeType) badgeType.textContent = isSettingsOnly ? 'Settings Profile' : 'Workshop OS Archive';

        if (parsed.settings || parsed.businessName) {
          const s = parsed.settings || parsed;
          chips.push(`<span class="badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">⚙️ Settings (${s.businessName || 'Configured'})</span>`);
        }
        if (Array.isArray(parsed.filaments)) {
          chips.push(`<span class="badge" style="background:rgba(34,197,94,0.2);color:#4ade80;">🧵 ${parsed.filaments.length} Filaments</span>`);
        }
        if (Array.isArray(parsed.printers)) {
          chips.push(`<span class="badge" style="background:rgba(168,85,247,0.2);color:#c084fc;">🖨️ ${parsed.printers.length} Printers</span>`);
        }
        if (Array.isArray(parsed.orders)) {
          chips.push(`<span class="badge" style="background:rgba(234,179,8,0.2);color:#facc15;">📋 ${parsed.orders.length} Orders</span>`);
        }
        if (Array.isArray(parsed.accounts)) {
          chips.push(`<span class="badge" style="background:rgba(6,182,212,0.2);color:#22d3ee;">💳 ${parsed.accounts.length} Accounts</span>`);
        }
        if (Array.isArray(parsed.transactions)) {
          chips.push(`<span class="badge" style="background:rgba(244,63,94,0.2);color:#fb7185;">💰 ${parsed.transactions.length} Transactions</span>`);
        }
        if (Array.isArray(parsed.consumables)) {
          chips.push(`<span class="badge" style="background:rgba(249,115,22,0.2);color:#fb923c;">📦 ${parsed.consumables.length} Consumables</span>`);
        }

        if (chipsContainer) chipsContainer.innerHTML = chips.length > 0 ? chips.join('') : '<span class="text-secondary" style="font-size:0.75rem;">Standard JSON Payload</span>';
      } catch (err) {
        showToast('Invalid JSON file format: ' + err.message, 'error');
      }
    };

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border)';
      dropzone.style.background = 'rgba(255,255,255,0.02)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processFile(e.target.files[0]);
      }
    });
  }, 50);
}
