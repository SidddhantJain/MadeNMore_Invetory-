/**
 * Made N More — Settings & System Configuration Page
 * Business defaults, material costs, electricity tariffs, and Cloud Website Sync Pipeline
 */

import {
  getSettings,
  updateSettings,
  exportData,
  exportSettings,
  importData,
  exportCSV,
  clearAll,
  getAll,
  getSyncStatus,
  testCloudConnection,
  updateSyncConfig,
  triggerCloudSync
} from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, escapeHtml, downloadFile, readFileAsText, formatDate } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function renderSettings(container) {
  const settings = getSettings();
  const printers = getAll('printers') || [];
  const filaments = getAll('filaments') || [];
  const orders = getAll('orders') || [];
  const accounts = getAll('accounts') || [];
  const leads = getAll('leads') || [];
  const transactions = getAll('transactions') || [];
  const consumables = getAll('consumables') || [];

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Settings & System Configuration</h1>
        <p class="text-secondary">Configure workshop defaults, cloud synchronization pipeline, and manage full database backups</p>
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
      <!-- Cloud Website Synchronization Pipeline Card -->
      <div class="card settings-section animate-in animate-delay-1" style="border: 1px solid rgba(56, 189, 248, 0.35); background: linear-gradient(180deg, rgba(56, 189, 248, 0.05) 0%, rgba(255,255,255,0.02) 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">🌐</span>
            <h3 style="margin-bottom:0;color:#38bdf8;">Cloud Sync & API Gateway</h3>
          </div>
          <span class="badge" id="settings-sync-status-badge" style="background:rgba(34,197,94,0.15);color:#4ade80;font-size:0.75rem;font-weight:700;">
            Checking...
          </span>
        </div>

        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:14px;">
          Bi-directional background pipeline connecting your local MadeNMore workshop to your public cloud website for real-time customer quotes, orders, and pipeline synchronization.
        </p>

        <div class="form-group">
          <label class="form-label">Cloud API Gateway Base URL</label>
          <input class="form-input" id="set-cloud-url" value="${escapeHtml(settings.cloudApiUrl || 'http://localhost:3000')}" placeholder="e.g. http://localhost:3000 or https://madenmore.com" />
          <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">Endpoint for <code>/api/v1/sync/pull</code> and <code>/api/v1/sync/push</code></span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Cloud Sync API Key (x-api-key)</label>
            <div style="position:relative;display:flex;align-items:center;">
              <input class="form-input" type="password" id="set-cloud-key" value="${escapeHtml(settings.cloudApiKey || 'mm_live_sync_secret_2026_key')}" style="padding-right:40px;" />
              <button type="button" class="btn btn-ghost btn-sm" id="btn-toggle-key-vis" style="position:absolute;right:4px;padding:4px 8px;font-size:0.85rem;" title="Show/Hide API Key">👁️</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Polling Interval (Seconds)</label>
            <input class="form-input" type="number" id="set-cloud-interval" value="${settings.syncIntervalSec || 20}" min="5" max="300" step="5" />
          </div>
        </div>

        <!-- Live Sync Telemetry Box -->
        <div id="settings-sync-telemetry-box" style="background:rgba(0,0,0,0.25);border:1px solid var(--border);border-radius:var(--radius-md);padding:10px 12px;margin:12px 0;font-size:0.8rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:var(--text-secondary);">Last Pull:</span>
            <strong id="st-last-pull" style="color:var(--text-primary);">Loading...</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:var(--text-secondary);">Quotes & Briefs Pulled:</span>
            <strong id="st-quotes-count" style="color:#38bdf8;">—</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-secondary);">Cloud Status:</span>
            <strong id="st-connection-status" style="color:#4ade80;">Active</strong>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
          <button class="btn btn-primary flex-1" id="btn-save-cloud-sync">Save Configuration</button>
          <button class="btn btn-secondary" id="btn-test-cloud-conn" title="Send authenticated ping to Cloud Gateway">
            <span id="test-conn-icon">🔌</span> Test Connection
          </button>
          <button class="btn btn-secondary" id="btn-trigger-sync-now" title="Trigger instant pull & push cycle">
            <span id="sync-now-icon">🔄</span> Sync Now
          </button>
        </div>
      </div>

      <!-- Business & Pricing Settings -->
      <div class="card settings-section animate-in animate-delay-2">
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
      <div class="card settings-section animate-in animate-delay-3">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">⚡ Electricity & Energy Draw</h3>
          <span style="font-size:0.75rem;color:var(--text-secondary);">MSEDCL Commercial Rate</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Commercial Tariff (₹/kWh)</label>
            <input class="form-input" type="number" id="set-elec" value="${settings.electricityRate || 8.5}" step="0.5" />
            <span style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;display:block;">Standard commercial rate (₹8.50)</span>
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
      <div class="card settings-section animate-in animate-delay-4">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">🎨 Material Cost Matrix (₹/kg)</h3>
          <span style="font-size:0.75rem;color:var(--text-secondary);">Direct Filaments Baseline</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${MATERIAL_TYPES.map(mat => `
            <div class="form-group" style="margin-bottom:8px;">
              <label class="form-label" style="font-size:0.78rem;">${mat}</label>
              <input class="form-input" type="number" id="set-mat-${mat.replace(/[^a-zA-Z0-9]/g, '')}" 
                value="${settings.materialCosts && settings.materialCosts[mat] !== undefined ? settings.materialCosts[mat] : 1000}" step="10" data-material="${mat}" />
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary w-full mt-md" id="btn-save-materials">Save Material Tariffs</button>
      </div>

      <!-- Data Management & Backups Card -->
      <div class="card settings-section animate-in animate-delay-5">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:0;">💾 Data Management & Backups</h3>
          <span class="badge badge-yes" style="font-size:0.7rem;">ACID Persisted</span>
        </div>

        <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">
          Current Database Status: <strong>${filaments.length} spools</strong>, <strong>${leads.length} leads</strong>, <strong>${printers.length} machines</strong>, <strong>${orders.length} orders</strong>, <strong>${accounts.length} accounts</strong>.
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

        <!-- CSV Export Shortcuts -->
        <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">Export Tabular Data (CSV / Excel):</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" id="btn-export-leads-csv">📋 Leads</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-filaments-csv">🧵 Filaments</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-orders-csv">📦 Orders</button>
            <button class="btn btn-ghost btn-sm" id="btn-export-transactions-csv">💰 Ledger</button>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
          <button class="btn btn-danger btn-sm w-full" id="btn-reset-database" title="Reset all inventory and order state">
            ⚠️ Reset Database to Defaults
          </button>
        </div>
      </div>
    </div>
  `;

  bindEvents(container);
  refreshSyncTelemetry(container);
}

async function refreshSyncTelemetry(container) {
  try {
    const status = await getSyncStatus();
    const badge = container.querySelector('#settings-sync-status-badge');
    const lastPullEl = container.querySelector('#st-last-pull');
    const quotesCountEl = container.querySelector('#st-quotes-count');
    const connStatusEl = container.querySelector('#st-connection-status');

    if (badge) {
      if (status.status === 'connected' || status.isRunning) {
        badge.style.background = 'rgba(34,197,94,0.15)';
        badge.style.color = '#4ade80';
        badge.textContent = 'Active & Connected';
      } else {
        badge.style.background = 'rgba(245,158,11,0.15)';
        badge.style.color = '#f59e0b';
        badge.textContent = 'Standby';
      }
    }

    if (lastPullEl) {
      lastPullEl.textContent = status.lastPullTime ? formatDate(status.lastPullTime) : 'Listening for new quotes';
    }
    if (quotesCountEl) {
      quotesCountEl.textContent = `${status.stats?.quotesPulled || 0} quotes, ${status.stats?.ordersPulled || 0} orders`;
    }
    if (connStatusEl) {
      connStatusEl.textContent = status.lastError ? `Notice: ${status.lastError}` : `Polls every ${status.syncIntervalSec || 20}s`;
      if (status.lastError) connStatusEl.style.color = '#ef4444';
    }
  } catch {}
}

function bindEvents(container) {
  // Toggle Key Visibility
  const keyInput = container.querySelector('#set-cloud-key');
  const toggleBtn = container.querySelector('#btn-toggle-key-vis');
  if (keyInput && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });
  }

  // Save Cloud Sync Settings
  container.querySelector('#btn-save-cloud-sync')?.addEventListener('click', async () => {
    const cloudApiUrl = container.querySelector('#set-cloud-url').value.trim();
    const cloudApiKey = container.querySelector('#set-cloud-key').value.trim();
    const syncIntervalSec = parseInt(container.querySelector('#set-cloud-interval').value, 10) || 20;

    try {
      await updateSyncConfig({ cloudApiUrl, cloudApiKey, syncIntervalSec }, true);
      showToast('Cloud Sync configuration saved!', 'success');
      refreshSyncTelemetry(container);
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    }
  });

  // Test Cloud Connection
  container.querySelector('#btn-test-cloud-conn')?.addEventListener('click', async () => {
    const cloudApiUrl = container.querySelector('#set-cloud-url').value.trim();
    const cloudApiKey = container.querySelector('#set-cloud-key').value.trim();
    const icon = container.querySelector('#test-conn-icon');
    if (icon) icon.textContent = '⏳';

    try {
      const res = await testCloudConnection(cloudApiUrl, cloudApiKey);
      if (res.success) {
        showToast(`✅ Connected! Latency: ${res.latencyMs}ms. Cloud Gateway online.`, 'success');
      } else {
        showToast(`⚠️ Connection test failed: ${res.error || 'Server unreachable'}`, 'error');
      }
      refreshSyncTelemetry(container);
    } catch (err) {
      showToast(`Connection error: ${err.message}`, 'error');
    } finally {
      if (icon) icon.textContent = '🔌';
    }
  });

  // Trigger Immediate Sync
  container.querySelector('#btn-trigger-sync-now')?.addEventListener('click', async () => {
    const icon = container.querySelector('#sync-now-icon');
    if (icon) icon.style.display = 'inline-block';
    
    try {
      await triggerCloudSync();
      showToast('✅ Cloud synchronization completed successfully!', 'success');
      refreshSyncTelemetry(container);
    } catch (err) {
      showToast(`Sync failed: ${err.message}`, 'error');
    }
  });

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
  container.querySelector('#btn-export-leads-csv')?.addEventListener('click', () => {
    const items = getAll('leads') || [];
    if (items.length === 0) return showToast('No lead data to export', 'warning');
    const headers = ['Client Name', 'Email', 'Phone', 'Material', 'Quantity', 'Stage', 'Quoted Price', 'Deadline'];
    const rows = items.map(l => [
      `"${(l.clientName || '').replace(/"/g, '""')}"`,
      `"${l.clientEmail || ''}"`,
      `"${l.clientPhone || ''}"`,
      `"${l.material || ''}"`,
      l.quantity || 1,
      `"${l.stage || 'new'}"`,
      l.quotedPrice || 0,
      `"${l.deadline || ''}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csv, `leads_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('📋 Leads CSV exported!', 'success');
  });

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
    showToast('📦 Orders CSV exported!', 'success');
  });

  container.querySelector('#btn-export-transactions-csv')?.addEventListener('click', () => {
    const csv = exportCSV('transactions');
    if (!csv) return showToast('No transaction data to export', 'warning');
    downloadFile(csv, `transactions_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showToast('💰 Ledger transactions CSV exported!', 'success');
  });

  // Import Modal
  container.querySelector('#btn-hdr-import')?.addEventListener('click', () => openUniversalImportModal(container));

  // Reset Database
  container.querySelector('#btn-reset-database')?.addEventListener('click', () => {
    if (confirm('⚠️ Are you sure you want to reset all records to initial sample data?')) {
      clearAll().then(() => {
        showToast('Database reset to defaults', 'info');
        renderSettings(container);
      });
    }
  });
}

function openUniversalImportModal(container) {
  let loadedParsedData = null;
  let rawJsonText = '';

  showModal({
    title: '📥 Import Settings & Database Backup',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="slicer-drop-zone" id="import-dropzone" style="padding:28px 16px;cursor:pointer;">
          <input type="file" id="modal-import-file-input" accept=".json,application/json" style="display:none;" />
          <div style="font-size:2rem;margin-bottom:6px;">📁</div>
          <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);" id="import-dropzone-title">
            Click or Drop JSON Backup File Here
          </div>
          <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">
            Supports <strong>madenmore_settings_*.json</strong> & <strong>full_backup_*.json</strong>
          </div>
        </div>

        <div id="import-inspection-box" style="display:none;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.8rem;color:var(--text-secondary);">Archive Content:</span>
            <span class="badge badge-yes" id="import-badge-type" style="font-size:0.7rem;">Detected</span>
          </div>
          <div id="import-summary-chips" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>

        <div class="form-group" style="margin-top:4px;">
          <label class="form-label" style="font-size:0.85rem;">Import Strategy</label>
          <select class="form-select" id="import-replace-mode">
            <option value="replace">Overwrite Existing Database (Restore Clean State)</option>
            <option value="merge">Merge with Existing Records (Non-Destructive)</option>
          </select>
        </div>
      </div>
    `,
    confirmText: 'Restore / Apply Archive',
    onConfirm: async () => {
      if (!rawJsonText) {
        showToast('Please select a valid backup JSON file first', 'error');
        return false;
      }
      const replace = document.getElementById('import-replace-mode')?.value === 'replace';
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

        const chips = [];
        const isSettingsOnly = parsed.exportType === 'settings_only' || (!parsed.filaments && !parsed.printers && (parsed.settings || parsed.businessName));
        if (badgeType) badgeType.textContent = isSettingsOnly ? 'Settings Profile' : 'Workshop OS Archive';

        if (parsed.settings || parsed.businessName) {
          const s = parsed.settings || parsed;
          chips.push(`<span class="badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;">⚙️ Settings (${s.businessName || 'Configured'})</span>`);
        }
        if (Array.isArray(parsed.leads)) {
          chips.push(`<span class="badge" style="background:rgba(56,189,248,0.2);color:#38bdf8;">📋 ${parsed.leads.length} Leads</span>`);
        }
        if (Array.isArray(parsed.filaments)) {
          chips.push(`<span class="badge" style="background:rgba(34,197,94,0.2);color:#4ade80;">🧵 ${parsed.filaments.length} Filaments</span>`);
        }
        if (Array.isArray(parsed.printers)) {
          chips.push(`<span class="badge" style="background:rgba(168,85,247,0.2);color:#c084fc;">🖨️ ${parsed.printers.length} Printers</span>`);
        }
        if (Array.isArray(parsed.orders)) {
          chips.push(`<span class="badge" style="background:rgba(234,179,8,0.2);color:#facc15;">📦 ${parsed.orders.length} Orders</span>`);
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
