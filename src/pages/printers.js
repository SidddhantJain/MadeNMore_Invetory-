/**
 * Made N More — 3D Printer Fleet Farm Interface
 * Real physical machine telemetry over LAN (Moonraker / Snapmaker U1), zero-touch spool deduction, and camera feeds
 */

import { getAll, create, update, remove, getById } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { PRINTER_SEED } from '../data/seed.js';
import { openTareCalculatorModal } from '../utils/tareCalculator.js';
import { readSlicerFile } from '../utils/slicerParser.js';
import { fetchPrinterTelemetry, fetchLatestSnapshot, scanLocalSubnet, fetchAllCameraMedia } from '../services/moonrakerService.js';

let _telemetryActive = false;
let _telemetryTimer = null;
let _fleetFilter = 'all'; // all | printing | idle | maintenance

export function renderPrinters(container) {
  // Auto-seed sample printers if fleet is empty
  let printers = getAll('printers');
  if (printers.length === 0) {
    PRINTER_SEED.forEach(p => create('printers', p));
    printers = getAll('printers');
  }

  // Ensure Snapmaker U1 has the known LAN IP 192.168.0.144
  const snapmaker = printers.find(p => p.name?.includes('Snapmaker') || p.model?.includes('Snapmaker'));
  if (snapmaker && (!snapmaker.iotHost || snapmaker.iotHost === '192.168.1.120')) {
    update('printers', snapmaker.id, {
      iotHost: '192.168.0.144',
      iotPort: '80',
      iotType: 'moonraker',
      webcamUrl: 'http://192.168.0.144/server/files/camera/',
    });
  }

  render(container);

  // Poll real physical printer immediately in background
  syncPhysicalPrinters(container, false);
}

function render(container) {
  const printers = getAll('printers');
  const activePrinting = printers.filter(p => p.status === 'printing');
  const idlePrinters = printers.filter(p => p.status === 'idle');
  const maintenancePrinters = printers.filter(p => p.status === 'maintenance');
  const totalHours = printers.reduce((s, p) => s + (p.runningHours || 0), 0);

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>3D Printer Fleet Hub</h1>
        <p class="text-secondary">Direct physical machine telemetry, camera snapshots, and automated inventory sync</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-sync-physical" title="Poll physical Snapmaker U1 over Wi-Fi now">
          <span style="font-size:1.05rem;">🔄</span>
          Sync Physical Farm
        </button>
        <button class="btn btn-secondary" id="btn-scale-tare-printers" title="Weigh physical spool on digital scale">
          <span style="font-size:1.05rem;">⚖️</span>
          Tare Spool
        </button>
        <button class="btn ${_telemetryActive ? 'btn-success' : 'btn-secondary'}" id="btn-toggle-telemetry" title="Toggle real-time IoT telemetry heartbeat">
          <span class="status-live-dot ${_telemetryActive ? 'telemetry-pulse' : ''}" style="background:${_telemetryActive ? '#22c55e' : '#94a3b8'};"></span>
          IoT Telemetry: ${_telemetryActive ? 'LIVE' : 'PAUSED'}
        </button>
        <button class="btn btn-primary" id="btn-add-printer">
          <span class="nav-icon">${ICONS.plus}</span>
          Add Machine
        </button>
      </div>
    </div>

    <!-- Fleet Status KPI Grid -->
    <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="card stat-card animate-in animate-delay-1">
        <div class="card-title">Fleet Active</div>
        <div class="stat-value text-info" style="display:flex;align-items:center;gap:8px;">
          <span class="status-live-dot" style="background:#3b82f6;"></span>
          ${activePrinting.length} / ${printers.length}
        </div>
        <div class="stat-label">machines actively printing</div>
      </div>
      <div class="card stat-card animate-in animate-delay-2">
        <div class="card-title">Ready / Idle</div>
        <div class="stat-value text-success">${idlePrinters.length}</div>
        <div class="stat-label">available for new queue jobs</div>
      </div>
      <div class="card stat-card animate-in animate-delay-3">
        <div class="card-title">Maintenance</div>
        <div class="stat-value ${maintenancePrinters.length > 0 ? 'text-warning' : 'text-secondary'}">
          ${maintenancePrinters.length}
        </div>
        <div class="stat-label">offline for service/tuning</div>
      </div>
      <div class="card stat-card animate-in animate-delay-4">
        <div class="card-title">Fleet Run Time</div>
        <div class="stat-value text-primary">${totalHours} <span style="font-size:1rem;color:var(--text-secondary);font-weight:400;">hrs</span></div>
        <div class="stat-label">cumulative operational hours</div>
      </div>
    </div>

    <!-- Fleet Status Filter Pills -->
    <div class="fleet-filter-bar animate-in animate-delay-2">
      <button class="fleet-filter-pill ${_fleetFilter === 'all' ? 'active' : ''}" data-filter="all">All Machines (${printers.length})</button>
      <button class="fleet-filter-pill ${_fleetFilter === 'printing' ? 'active' : ''}" data-filter="printing">🟢 Printing (${activePrinting.length})</button>
      <button class="fleet-filter-pill ${_fleetFilter === 'idle' ? 'active' : ''}" data-filter="idle">🟡 Ready / Idle (${idlePrinters.length})</button>
      <button class="fleet-filter-pill ${_fleetFilter === 'maintenance' ? 'active' : ''}" data-filter="maintenance">🔴 Maintenance (${maintenancePrinters.length})</button>
    </div>

    <!-- Printers Cards Grid -->
    <div class="printer-grid animate-in animate-delay-2">
      ${(_fleetFilter === 'all' ? printers : printers.filter(p => p.status === _fleetFilter)).map(p => renderPrinterCard(p)).join('')}
    </div>
  `;

  bindEvents(container);
}

function renderPrinterCard(printer) {
  const statusConfig = {
    printing: { label: 'Printing', class: 'status-badge-printing', color: '#3b82f6' },
    idle: { label: 'Ready / Idle', class: 'status-badge-idle', color: '#22c55e' },
    heating: { label: 'Heating Bed', class: 'status-badge-heating', color: '#f59e0b' },
    maintenance: { label: 'Maintenance', class: 'status-badge-maintenance', color: '#ef4444' },
    offline: { label: 'Offline', class: 'badge-no', color: '#64748b' },
  };

  const status = statusConfig[printer.status || 'idle'] || statusConfig.idle;
  const maintLimit = printer.maintenanceDueHours || 300;
  const maintProgress = Math.min(100, Math.round(((printer.runningHours || 0) % maintLimit) / maintLimit * 100));
  const isMaintDue = (printer.runningHours || 0) >= maintLimit;

  // IoT Connector details
  const iotType = printer.iotType || (printer.model.includes('Bambu') ? 'bambu' : 'moonraker');
  const iotLabels = {
    moonraker: 'Moonraker (Klipper)',
    bambu: 'Bambu Lab MQTT',
    octoprint: 'OctoPrint REST',
    snapmaker: 'Snapmaker Serial',
  };

  const hasLan = !!printer.iotHost;

  return `
    <div class="card printer-card status-${printer.status || 'idle'}" data-printer-id="${printer.id}">
      <!-- Header -->
      <div class="printer-card-header">
        <div class="printer-title-group">
          <div class="printer-name">${escapeHtml(printer.name)}</div>
          <div class="printer-model">${escapeHtml(printer.model || 'FDM Printer')}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="status-badge-live ${status.class}">
            <span class="status-live-dot ${_telemetryActive && printer.status === 'printing' ? 'telemetry-pulse' : ''}" style="background:${status.color};"></span>
            ${status.label}
          </span>
          <button class="printer-iot-badge" data-action="iot-config" data-id="${printer.id}" title="Configure IP & IoT settings">
            <span>📡 ${iotLabels[iotType] || 'IoT Hub'}</span>
            <span style="font-size:0.65rem;opacity:0.7;">⚙️</span>
          </button>
        </div>
      </div>

      <!-- Physical LAN Bridge Status Bar -->
      ${hasLan ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);padding:5px 9px;margin-bottom:10px;font-size:0.74rem;">
          <span style="display:flex;align-items:center;gap:6px;color:var(--success);font-weight:600;">
            <span class="status-live-dot telemetry-pulse" style="background:#22c55e;"></span>
            LAN: ${escapeHtml(printer.iotHost)}
          </span>
          <div style="display:flex;gap:4px;align-items:center;">
            <button class="btn-icon btn-sm" data-action="fetch-camera" data-id="${printer.id}" title="View Camera Snapshot" style="font-size:0.8rem;padding:2px 4px;">📷</button>
            <button class="btn-icon btn-sm" data-action="poll-physical" data-id="${printer.id}" title="Refresh Live Data" style="font-size:0.8rem;padding:2px 4px;">🔄</button>
            <a href="http://${escapeHtml(printer.iotHost)}/" target="_blank" title="Open Fluidd Web UI" style="color:var(--text-secondary);font-size:0.8rem;padding:2px 4px;text-decoration:none;">🌐</a>
          </div>
        </div>
      ` : ''}

      <!-- Thermal Telemetry (Extruder, Bed & Optional Chamber) -->
      <div class="telemetry-row">
        <div class="temp-gauge">
          <span class="temp-label">🔥 Extruder</span>
          <div class="temp-value">
            <span id="temp-nozzle-${printer.id}">${printer.currentNozzleTemp || 28}</span>°C 
            <span class="temp-target">/ ${printer.targetNozzleTemp || 0}°C</span>
          </div>
        </div>
        <div class="temp-gauge">
          <span class="temp-label">🔲 Heatbed</span>
          <div class="temp-value">
            <span id="temp-bed-${printer.id}">${printer.currentBedTemp || 28}</span>°C 
            <span class="temp-target">/ ${printer.targetBedTemp || 0}°C</span>
          </div>
        </div>
        ${printer.chamberTemp ? `
          <div class="temp-gauge">
            <span class="temp-label">📦 Chamber</span>
            <div class="temp-value">
              <span id="temp-chamber-${printer.id}">${printer.chamberTemp}</span>°C
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Active Job, Slicer Dropzone, or Idle State -->
      ${printer.status === 'printing' && printer.currentJob ? `
        <div class="printer-job-box">
          <div class="printer-job-title">
            <span class="truncate" style="max-width:180px;" title="${escapeHtml(printer.currentJob)}">⚙️ ${escapeHtml(printer.currentJob)}</span>
            <span id="prog-val-${printer.id}" style="color:var(--info);font-weight:700;">${printer.jobProgress || 0}%</span>
          </div>
          <div class="order-progress-bar-track" style="margin-bottom:8px;height:6px;">
            <div id="prog-bar-${printer.id}" class="order-progress-bar-fill" style="width:${printer.jobProgress || 0}%;background:var(--accent-gradient);"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary);">
            <span>Elapsed: <strong id="prog-elapsed-${printer.id}">${Math.floor((printer.elapsedMinutes || 0)/60)}h ${(printer.elapsedMinutes || 0)%60}m</strong></span>
            <span>Total: <strong>${Math.floor((printer.totalMinutes || 0)/60)}h ${(printer.totalMinutes || 0)%60}m</strong></span>
          </div>
          <div style="margin-top:6px;font-size:0.72rem;display:flex;justify-content:space-between;color:var(--accent);font-weight:600;">
            <span>Mass: ~${printer.jobGrams || 140}g filament</span>
            <span>Auto-deduct on finish: ✓</span>
          </div>
        </div>
      ` : printer.status === 'maintenance' ? `
        <div class="printer-job-box" style="text-align:center;padding:16px 12px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.2);">
          <div style="font-size:0.85rem;color:var(--danger);font-weight:600;margin-bottom:4px;">
            🛠️ Machine Under Servicing
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">Complete maintenance check before assigning jobs</div>
        </div>
      ` : `
        <!-- Slicer Ingestion Dropzone for Idle Printer -->
        <div class="printer-quick-drop" data-printer-id="${printer.id}" title="Drag & drop sliced .gcode or .3mf file to instantly start this job">
          <input type="file" class="hidden-file-input" accept=".gcode,.3mf" style="display:none;" />
          <div style="font-size:1.1rem;margin-bottom:2px;">📂</div>
          <div style="font-size:0.78rem;font-weight:600;color:var(--text-primary);">Drop .gcode / .3mf to Print</div>
          <div style="font-size:0.7rem;color:var(--text-secondary);">Auto-reads mass, time & preheats</div>
        </div>
      `}

      <!-- Loaded Spool & Specs -->
      <div class="printer-meta-specs">
        <span>🧵 Loaded Spool:</span>
        <span style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          ${printer.loadedSpoolHex ? `<span class="color-swatch" style="width:12px;height:12px;display:inline-block;background-color:${printer.loadedSpoolHex};"></span>` : ''}
          <span class="truncate" style="max-width:140px;" title="${escapeHtml(printer.loadedSpool || 'Not assigned')}">
            ${escapeHtml(printer.loadedSpool || 'Not assigned')}
          </span>
          <button class="btn-icon btn-sm" data-action="quick-tare-printer" data-id="${printer.id}" title="Weigh & Tare this spool on scale" style="padding:2px;font-size:0.75rem;">
            ⚖️
          </button>
        </span>
      </div>

      <div class="printer-meta-specs">
        <span>📐 Build Volume:</span>
        <span style="color:var(--text-secondary);">${escapeHtml(printer.buildVolume || '250 x 250 x 250 mm')}</span>
      </div>

      <div class="printer-meta-specs">
        <span>📍 Workshop Bay:</span>
        <span style="color:var(--text-secondary);">${escapeHtml(printer.location || 'Workshop Farm')}</span>
      </div>

      <!-- Maintenance Meter -->
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">
          <span>Running Hours: <strong>${printer.runningHours || 0} hrs</strong></span>
          <span style="color:${isMaintDue ? 'var(--danger)' : 'var(--text-secondary)'};">
            ${isMaintDue ? '⚠️ Service Due' : `Service in ${maintLimit - ((printer.runningHours || 0) % maintLimit)}h`}
          </span>
        </div>
        <div class="order-progress-bar-track" style="height:3px;">
          <div class="order-progress-bar-fill" style="width:${maintProgress}%;background:${isMaintDue ? 'var(--danger)' : 'var(--accent)'};"></div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="printer-actions-footer">
        ${printer.status === 'printing' ? `
          <button class="btn btn-primary btn-sm flex-1" data-action="complete-job" data-id="${printer.id}" title="Complete job and auto-deduct spool">
            ✓ Complete
          </button>
          <button class="btn btn-ghost btn-sm" data-action="toggle-pause" data-id="${printer.id}" title="Pause / Resume">
            ⏸️
          </button>
          <button class="btn btn-ghost btn-sm" data-action="scrap-job" data-id="${printer.id}" title="Report Failure & Log Scrap Loss" style="color:var(--danger);">
            ✕ Scrap
          </button>
        ` : printer.status === 'maintenance' ? `
          <button class="btn btn-secondary btn-sm flex-1" data-action="finish-maintenance" data-id="${printer.id}">
            ✓ Return to Service
          </button>
        ` : `
          <button class="btn btn-primary btn-sm flex-1" data-action="assign-job" data-id="${printer.id}">
            🚀 Assign Job
          </button>
          <button class="btn btn-ghost btn-sm" data-action="preheat" data-id="${printer.id}">
            🔥 Preheat
          </button>
        `}

        <button class="btn-icon btn-sm" data-action="print-traveler" data-id="${printer.id}" title="Print Workshop Job Traveler Card">
          📋
        </button>

        ${hasLan ? `
          <button class="btn-icon btn-sm" data-action="fetch-camera" data-id="${printer.id}" title="Timelapse Gallery & Camera">
            📷
          </button>
        ` : ''}

        <button class="btn-icon btn-sm" data-action="maintenance-log" data-id="${printer.id}" title="Maintenance Log">
          🛠️
        </button>
        <button class="btn-icon btn-sm" data-action="edit-printer" data-id="${printer.id}" title="Edit Machine">
          ${ICONS.edit}
        </button>
        <button class="btn-icon btn-sm" data-action="delete-printer" data-id="${printer.id}" title="Delete" style="color:var(--danger);">
          ${ICONS.trash}
        </button>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  // Add Machine
  container.querySelector('#btn-add-printer')?.addEventListener('click', () => openPrinterModal(container));

  // Fleet Filter Pills
  container.querySelectorAll('.fleet-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _fleetFilter = btn.dataset.filter;
      render(container);
    });
  });

  // Sync Physical Farm
  container.querySelector('#btn-sync-physical')?.addEventListener('click', () => {
    syncPhysicalPrinters(container, true);
  });

  // Scale Tare Shortcut
  container.querySelector('#btn-scale-tare-printers')?.addEventListener('click', () => {
    openTareCalculatorModal(null, () => render(container));
  });

  // Toggle Live IoT Telemetry Heartbeat
  container.querySelector('#btn-toggle-telemetry')?.addEventListener('click', () => {
    toggleTelemetryHeartbeat(container);
  });

  // Setup Quick Slicer Dropzones on cards
  container.querySelectorAll('.printer-quick-drop').forEach(dropArea => {
    const printerId = dropArea.dataset.printerId;
    const fileInput = dropArea.querySelector('.hidden-file-input');

    dropArea.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput?.click();
    });

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files && files.length > 0) handleSlicerDropToPrinter(printerId, files[0], container);
    });

    fileInput?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) handleSlicerDropToPrinter(printerId, files[0], container);
    });
  });

  // Card Actions
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'assign-job') openAssignJobModal(id, container);
      else if (action === 'complete-job') markJobComplete(id, container);
      else if (action === 'scrap-job') openScrapLossModal(id, container);
      else if (action === 'toggle-pause') togglePause(id, container);
      else if (action === 'preheat') preheatPrinter(id, container);
      else if (action === 'finish-maintenance') finishMaintenance(id, container);
      else if (action === 'maintenance-log') openMaintenanceLogModal(id, container);
      else if (action === 'iot-config') openIoTConfigModal(id, container);
      else if (action === 'quick-tare-printer') quickTarePrinterSpool(id, container);
      else if (action === 'fetch-camera') openCameraSnapshotModal(id, container);
      else if (action === 'print-traveler') openJobTravelerModal(id, container);
      else if (action === 'poll-physical') pollSinglePhysicalPrinter(id, container);
      else if (action === 'edit-printer') openPrinterModal(container, id);
      else if (action === 'delete-printer') confirmDeletePrinter(id, container);
    });
  });
}

// ─── Sync Physical LAN Printers ────────────────────────────────
async function syncPhysicalPrinters(container, showFeedback = true) {
  const printers = getAll('printers');
  let syncCount = 0;

  for (const printer of printers) {
    if (printer.iotHost) {
      const tel = await fetchPrinterTelemetry(printer.iotHost, printer.iotPort || 80);
      if (tel.online) {
        update('printers', printer.id, {
          currentNozzleTemp: tel.currentNozzleTemp,
          targetNozzleTemp: tel.targetNozzleTemp,
          currentBedTemp: tel.currentBedTemp,
          targetBedTemp: tel.targetBedTemp,
          chamberTemp: tel.chamberTemp,
          status: tel.status,
          currentJob: tel.currentJob || printer.currentJob,
          jobProgress: tel.jobProgress || printer.jobProgress,
          elapsedMinutes: tel.elapsedMinutes || printer.elapsedMinutes,
          totalMinutes: tel.totalMinutes || printer.totalMinutes,
          isLiveOnline: true,
        });
        syncCount++;
      }
    }
  }

  if (syncCount > 0) {
    if (showFeedback) showToast(`📡 Synced live data from physical printer (${syncCount} machines active)!`, 'success');
    render(container);
  } else if (showFeedback) {
    showToast('⚠️ Could not reach physical printer on LAN. Check IP address or Wi-Fi.', 'warning');
  }
}

async function pollSinglePhysicalPrinter(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer || !printer.iotHost) return;

  showToast(`Polling ${printer.name} at ${printer.iotHost}...`, 'info');
  const tel = await fetchPrinterTelemetry(printer.iotHost, printer.iotPort || 80);

  if (tel.online) {
    update('printers', printerId, {
      currentNozzleTemp: tel.currentNozzleTemp,
      targetNozzleTemp: tel.targetNozzleTemp,
      currentBedTemp: tel.currentBedTemp,
      targetBedTemp: tel.targetBedTemp,
      chamberTemp: tel.chamberTemp,
      status: tel.status,
      currentJob: tel.currentJob || printer.currentJob,
      jobProgress: tel.jobProgress || printer.jobProgress,
      elapsedMinutes: tel.elapsedMinutes || printer.elapsedMinutes,
      isLiveOnline: true,
    });
    showToast(`🟢 ${printer.name} Online: ${tel.currentNozzleTemp}°C / Bed ${tel.currentBedTemp}°C`, 'success');
    render(container);
  } else {
    showToast(`⚠️ Could not reach ${printer.iotHost}. IP may have changed.`, 'error');
  }
}

// ─── Direct Blob Downloader (Solves Chrome cross-origin UUID download issue) ───
async function downloadMediaBlob(url, filename, knownSizeBytes = 0, progressCallback = null) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const headerLength = parseInt(response.headers.get('content-length'), 10);
    const totalBytes = (headerLength && !isNaN(headerLength)) ? headerLength : knownSizeBytes;
    let blob;

    if (totalBytes > 0 && response.body && window.ReadableStream) {
      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (progressCallback && totalBytes > 0) {
          const pct = Math.min(99, Math.round((loaded / totalBytes) * 100));
          progressCallback(pct);
        }
      }
      if (progressCallback) progressCallback(100);
      const mimeType = filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      blob = new Blob(chunks, { type: mimeType });
    } else {
      blob = await response.blob();
      if (progressCallback) progressCallback(100);
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    return true;
  } catch (err) {
    console.error('Blob download failed, using direct download:', err);
    // Direct link fallback without target="_blank"
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return false;
  }
}

// ─── Timelapse Video Gallery & Bulk Downloader ────────────────
async function openCameraSnapshotModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer || !printer.iotHost) {
    showToast('No LAN IP configured for this printer', 'warning');
    return;
  }

  showToast('Connecting to Moonraker camera media repository...', 'info');
  const media = await fetchAllCameraMedia(printer.iotHost, printer.iotPort || 80);
  const initialSnapshot = media.snapshots.length > 0 ? media.snapshots[0] : null;

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">${escapeHtml(printer.name)} Timelapse & Media Hub</div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
          ${media.totalVideoCount} Video Recordings (${media.totalVideoSizeFormatted}) • ${media.totalSnapshotCount} Layer Photos
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-primary btn-sm" id="btn-download-all-videos" ${media.totalVideoCount === 0 ? 'disabled' : ''}>
          ⬇️ Download All Timelapses (${media.totalVideoCount})
        </button>
        <a href="http://${escapeHtml(printer.iotHost)}/" target="_blank" class="btn btn-ghost btn-sm" style="font-size:0.75rem;">
          🌐 Fluidd
        </a>
      </div>
    </div>

    <!-- Active Media Player Box (Video or Photo) -->
    <div id="active-media-box" style="background:#0a0a0a;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:14px;min-height:240px;display:flex;align-items:center;justify-content:center;position:relative;">
      <video id="active-preview-video" controls style="display:none;max-width:100%;max-height:360px;object-fit:contain;width:100%;"></video>
      <img id="active-preview-img" src="${initialSnapshot ? initialSnapshot.url : ''}" alt="Snapshot" style="${initialSnapshot ? 'display:block;' : 'display:none;'}max-width:100%;max-height:360px;object-fit:contain;" />
      
      <div id="active-preview-caption" style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.75);padding:4px 10px;border-radius:4px;font-size:0.72rem;color:#fff;${!initialSnapshot ? 'display:none;' : ''}">
        ${initialSnapshot ? `Latest Snapshot: ${escapeHtml(initialSnapshot.filename)} (${initialSnapshot.dateFormatted})` : ''}
      </div>

      ${!initialSnapshot && media.totalVideoCount === 0 ? `
        <div style="padding:40px 20px;color:var(--text-secondary);text-align:center;">
          <div style="font-size:2rem;margin-bottom:6px;">📷</div>
          <div>No media files found in printer memory.</div>
        </div>
      ` : ''}
    </div>

    <!-- Media Tab Controls -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:12px;">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="tab-videos-btn" style="background:var(--accent);color:#fff;">
          📹 Timelapse Videos (${media.totalVideoCount})
        </button>
        <button class="btn btn-ghost btn-sm" id="tab-snapshots-btn">
          📸 Layer Photos (${media.totalSnapshotCount})
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-refresh-media-list" style="font-size:0.75rem;">
        🔄 Refresh List
      </button>
    </div>

    <!-- Videos List Container -->
    <div id="timelapse-videos-list" class="timelapse-media-list">
      ${media.videos.length > 0 ? media.videos.map((v, i) => `
        <div class="timelapse-item">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <span style="font-size:1.3rem;">🎬</span>
            <div class="timelapse-info-col">
              <div class="timelapse-name" title="${escapeHtml(v.filename)}">${escapeHtml(v.filename)}</div>
              <div class="timelapse-meta">
                <span>📦 ${v.sizeFormatted}</span>
                <span>•</span>
                <span>📅 ${v.dateFormatted}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-secondary btn-sm play-video-btn" data-url="${v.url}" data-name="${escapeHtml(v.filename)}">
              ▶️ Play
            </button>
            <button class="btn btn-primary btn-sm download-single-media-btn" data-url="${v.url}" data-filename="${escapeHtml(v.filename)}" data-size="${v.size || 0}" title="Save MP4 with exact filename">
              ⬇️ Download
            </button>
          </div>
        </div>
      `).join('') : `
        <div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.85rem;">
          No timelapse video recordings found in printer memory.
        </div>
      `}
    </div>

    <!-- Snapshots List Container (Hidden by default) -->
    <div id="timelapse-snapshots-list" class="timelapse-media-list" style="display:none;">
      ${media.snapshots.length > 0 ? media.snapshots.map((s, i) => `
        <div class="timelapse-item">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <span style="font-size:1.3rem;">🖼️</span>
            <div class="timelapse-info-col">
              <div class="timelapse-name" title="${escapeHtml(s.filename)}">${escapeHtml(s.filename)}</div>
              <div class="timelapse-meta">
                <span>📦 ${s.sizeFormatted}</span>
                <span>•</span>
                <span>📅 ${s.dateFormatted}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-secondary btn-sm view-photo-btn" data-url="${s.url}" data-name="${escapeHtml(s.filename)}">
              🔍 View
            </button>
            <button class="btn btn-primary btn-sm download-single-media-btn" data-url="${s.url}" data-filename="${escapeHtml(s.filename)}" data-size="${s.size || 0}" title="Save JPG">
              ⬇️
            </button>
          </div>
        </div>
      `).join('') : `
        <div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:0.85rem;">
          No layer photo snapshots found.
        </div>
      `}
    </div>
  `;

  showModal({
    title: 'Snapmaker Camera Feed & Timelapses',
    body,
    confirmText: 'Done',
    onConfirm: () => {
      const videoEl = document.getElementById('active-preview-video');
      if (videoEl) videoEl.pause();
      closeModal();
    },
  });

  setTimeout(() => {
    const videoEl = document.getElementById('active-preview-video');
    const imgEl = document.getElementById('active-preview-img');
    const captionEl = document.getElementById('active-preview-caption');
    const tabVideosBtn = document.getElementById('tab-videos-btn');
    const tabSnapshotsBtn = document.getElementById('tab-snapshots-btn');
    const videosList = document.getElementById('timelapse-videos-list');
    const snapshotsList = document.getElementById('timelapse-snapshots-list');

    // Switch Tabs
    tabVideosBtn?.addEventListener('click', () => {
      tabVideosBtn.style.background = 'var(--accent)';
      tabVideosBtn.style.color = '#fff';
      tabSnapshotsBtn.style.background = 'transparent';
      tabSnapshotsBtn.style.color = 'var(--text-secondary)';
      if (videosList) videosList.style.display = 'flex';
      if (snapshotsList) snapshotsList.style.display = 'none';
    });

    tabSnapshotsBtn?.addEventListener('click', () => {
      tabSnapshotsBtn.style.background = 'var(--accent)';
      tabSnapshotsBtn.style.color = '#fff';
      tabVideosBtn.style.background = 'transparent';
      tabVideosBtn.style.color = 'var(--text-secondary)';
      if (snapshotsList) snapshotsList.style.display = 'flex';
      if (videosList) videosList.style.display = 'none';
    });

    // Play Video in top player
    document.querySelectorAll('.play-video-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        const name = btn.dataset.name;
        if (imgEl) imgEl.style.display = 'none';
        if (videoEl) {
          videoEl.style.display = 'block';
          videoEl.src = url;
          videoEl.play();
        }
        if (captionEl) {
          captionEl.style.display = 'block';
          captionEl.textContent = `Playing: ${name}`;
        }
      });
    });

    // View Photo in top preview
    document.querySelectorAll('.view-photo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url;
        const name = btn.dataset.name;
        if (videoEl) {
          videoEl.pause();
          videoEl.style.display = 'none';
        }
        if (imgEl) {
          imgEl.style.display = 'block';
          imgEl.src = url;
        }
        if (captionEl) {
          captionEl.style.display = 'block';
          captionEl.textContent = `Viewing: ${name}`;
        }
      });
    });

    // Single Media Blob Downloader (solves Chrome cross-origin UUID issue)
    document.querySelectorAll('.download-single-media-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.url;
        const filename = btn.dataset.filename;
        const size = parseInt(btn.dataset.size, 10) || 0;
        const origText = btn.innerHTML;

        btn.disabled = true;
        btn.textContent = '⏳ 0%';

        try {
          await downloadMediaBlob(url, filename, size, (pct) => {
            btn.textContent = `⏳ ${pct}%`;
          });
          btn.textContent = '✓ Saved!';
          showToast(`Saved ${filename} to your Downloads!`, 'success');
        } catch (err) {
          btn.textContent = '⚠️ Error';
          showToast(`Failed to download ${filename}`, 'error');
        }

        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = origText;
        }, 5000);
      });
    });

    // Bulk Downloader for All Timelapses with sequential progress
    document.getElementById('btn-download-all-videos')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-download-all-videos');
      if (!media.videos || media.videos.length === 0) return;

      btn.disabled = true;
      showToast(`Starting sequential download of ${media.videos.length} timelapses...`, 'info');

      for (let i = 0; i < media.videos.length; i++) {
        const v = media.videos[i];
        btn.textContent = `⏳ (${i + 1}/${media.videos.length}): 0%`;

        await downloadMediaBlob(v.url, v.filename, v.size || 0, (pct) => {
          btn.textContent = `⏳ (${i + 1}/${media.videos.length}): ${pct}%`;
        });

        // Brief delay between files to avoid browser rate limit
        await new Promise(r => setTimeout(r, 600));
      }

      btn.textContent = '✓ All Downloaded';
      showToast(`🎉 Downloaded all ${media.videos.length} timelapses with exact filenames!`, 'success');

      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = `⬇️ Download All Timelapses (${media.totalVideoCount})`;
      }, 5000);
    });

    // Refresh button
    document.getElementById('btn-refresh-media-list')?.addEventListener('click', () => {
      closeModal();
      openCameraSnapshotModal(printerId, container);
    });
  }, 50);
}

// ─── Printable Workshop Job Traveler Card (Phase 2 & 3) ────────
function openJobTravelerModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const jobName = printer.currentJob || 'Precision Production Component';
  const order = printer.orderId ? getById('orders', printer.orderId) : null;
  const clientName = order?.clientName || 'In-House Production';
  const hours = Math.floor((printer.totalMinutes || 180) / 60);
  const mins = (printer.totalMinutes || 180) % 60;
  const grams = printer.jobGrams || 142.8;

  const body = `
    <div class="traveler-sheet">
      <!-- Header -->
      <div class="traveler-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/Logo/logo.png" alt="Made N More Logo" style="height:48px;width:auto;object-fit:contain;" />
          <div>
            <div style="font-size:1.25rem;font-weight:800;letter-spacing:-0.5px;color:#1e1b4b;">MADE N MORE | 3D PRINTING LABS</div>
            <div style="font-size:0.78rem;color:#444;margin-top:2px;">WORKSHOP MANUFACTURING JOB TRAVELER & QC ROUTER</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.05rem;font-weight:700;">JOB #${(printer.orderId || printer.id).slice(0, 8).toUpperCase()}</div>
          <div style="font-size:0.78rem;color:#555;">Date: ${formatDate(new Date())}</div>
        </div>
      </div>

      <!-- Specification Grid -->
      <div class="traveler-grid">
        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;">
          <div style="font-size:0.75rem;font-weight:700;color:#666;text-transform:uppercase;">Part / Assembly Description</div>
          <div style="font-size:0.95rem;font-weight:700;margin-top:4px;">${escapeHtml(jobName)}</div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Client / Account: <strong>${escapeHtml(clientName)}</strong></div>
        </div>

        <div style="border:1px solid #ddd;border-radius:6px;padding:10px;">
          <div style="font-size:0.75rem;font-weight:700;color:#666;text-transform:uppercase;">Production Machine & Spool</div>
          <div style="font-size:0.95rem;font-weight:700;margin-top:4px;">${escapeHtml(printer.name)} (${escapeHtml(printer.model)})</div>
          <div style="font-size:0.8rem;color:#555;margin-top:2px;">Loaded Spool: <strong>${escapeHtml(printer.loadedSpool || 'Production Filament')}</strong></div>
        </div>
      </div>

      <!-- Parameters Table -->
      <table class="traveler-table">
        <thead>
          <tr>
            <th>Estimated Mass</th>
            <th>Print Duration</th>
            <th>Nozzle Target</th>
            <th>Bed Target</th>
            <th>Layer Height</th>
            <th>Infill Profile</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${grams} g</strong></td>
            <td><strong>${hours}h ${mins}m</strong></td>
            <td>${printer.targetNozzleTemp || 215}°C</td>
            <td>${printer.targetBedTemp || 60}°C</td>
            <td>0.20 mm</td>
            <td>20% Gyroid</td>
          </tr>
        </tbody>
      </table>

      <!-- Quality Control Sign-Off Table -->
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">POST-PRINT QUALITY INSPECTION & DISPATCH CHECKLIST</div>
      <table class="traveler-table">
        <thead>
          <tr>
            <th style="width:40px;">Check</th>
            <th>Inspection Parameter</th>
            <th>Acceptance Criteria</th>
            <th style="width:140px;">Verified By / Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Dimensional Accuracy</strong></td>
            <td>Critical dimensions within ±0.20mm (Digital Caliper)</td>
            <td>_____________ mm</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Mass Audit</strong></td>
            <td>Finished weight within ±3% of sliced mass (${grams}g)</td>
            <td>_____________ g</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Layer Adhesion & Perimeter Bonding</strong></td>
            <td>Zero delamination, solid wall fusion</td>
            <td>Pass / Fail</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Surface Finish & Cosmetics</strong></td>
            <td>No stringing, z-banding, or severe scarring</td>
            <td>Pass / Fail</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Client Photo Proof</strong></td>
            <td>High-res photo sent to client via WhatsApp</td>
            <td>Timestamp: ______</td>
          </tr>
          <tr>
            <td style="text-align:center;">[ &nbsp; ]</td>
            <td><strong>Packaging & Dispatch Label</strong></td>
            <td>Protective bubble-wrap & box sealed</td>
            <td>Tracking / Courier: ___</td>
          </tr>
        </tbody>
      </table>

      <!-- Operator Signature -->
      <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #ccc;font-size:0.82rem;">
        <div>Manufacturing Operator: _______________________</div>
        <div>QC Inspector Sign-off: _______________________</div>
      </div>
    </div>
  `;

  showModal({
    title: 'Print Workshop Job Traveler Card',
    body,
    confirmText: '🖨️ Print Sheet (Ctrl+P)',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      window.print();
    },
  });
}

// ─── Direct Slicer Ingestion to Printer ─────────────────────────
function handleSlicerDropToPrinter(printerId, file, container) {
  readSlicerFile(file, (err, parsed, filename) => {
    if (err) {
      showToast('Could not read sliced file', 'error');
      return;
    }

    const printer = getById('printers', printerId);
    if (!printer) return;

    const grams = parsed.grams || 140;
    const hours = parsed.durationHours || 2.5;
    const cleanJobName = filename.replace(/\.(gcode|3mf)$/i, '');

    let nozzleT = 215;
    let bedT = 60;
    if (parsed.material.includes('PETG') || (printer.loadedSpool && printer.loadedSpool.includes('PETG'))) {
      nozzleT = 245; bedT = 80;
    } else if (parsed.material.includes('ABS') || (printer.loadedSpool && printer.loadedSpool.includes('ABS'))) {
      nozzleT = 250; bedT = 95;
    }

    update('printers', printerId, {
      status: 'printing',
      currentJob: cleanJobName,
      jobGrams: grams,
      jobProgress: 2,
      elapsedMinutes: 3,
      totalMinutes: Math.round(hours * 60),
      targetNozzleTemp: nozzleT,
      currentNozzleTemp: nozzleT - 5,
      targetBedTemp: bedT,
      currentBedTemp: bedT,
    });

    showToast(`🚀 Sliced file ingested! ${escapeHtml(cleanJobName)} (${grams}g, ${hours}h) printing on ${printer.name}`, 'success');
    render(container);
  });
}

// ─── Automated Spool Deduction & Job Completion ──────────────
function markJobComplete(printerId, container, fromTelemetry = false) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const jobName = printer.currentJob || 'Production Job';
  const jobGrams = printer.jobGrams || 142.8;
  const hoursAdded = Math.max(1, Math.round((printer.totalMinutes || 120) / 60));

  // 1. Zero-Touch Filament Spool Deduction
  let deductedFilament = null;
  let remainingSpools = null;
  const allFilaments = getAll('filaments');
  
  if (printer.loadedSpool) {
    deductedFilament = allFilaments.find(f => 
      printer.loadedSpool.toLowerCase().includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(printer.loadedSpool.toLowerCase())
    );

    if (deductedFilament) {
      const currentSpools = deductedFilament.spools || 1;
      const spoolsUsed = Number((jobGrams / 1000).toFixed(2));
      remainingSpools = Math.max(0, Number((currentSpools - spoolsUsed).toFixed(2)));

      update('filaments', deductedFilament.id, {
        spools: remainingSpools,
        remainingGrams: Math.max(0, Math.round(((deductedFilament.remainingGrams || (currentSpools * 1000)) - jobGrams))),
      });
    }
  }

  // 2. Advance Linked Order Stage to QC
  let linkedOrder = null;
  if (printer.orderId) {
    linkedOrder = getById('orders', printer.orderId);
    if (linkedOrder) {
      update('orders', linkedOrder.id, {
        kanbanStage: 'ready_for_qc',
        status: 'active',
      });
    }
  }

  // 3. Log Machine Electricity & Operating Cost in Transactions
  const electricityRate = 8.5; // ₹8.5/kWh
  const machineKW = 0.35; // 350W
  const electricityCost = Math.round(hoursAdded * machineKW * electricityRate);

  create('transactions', {
    date: formatDate(new Date()),
    description: `Electricity & Machine Wear: ${printer.name} (${hoursAdded}h on ${jobName})`,
    category: 'Equipment',
    type: 'Expense',
    amount: -electricityCost,
  });

  // 4. Update Printer State
  update('printers', printerId, {
    status: 'idle',
    currentJob: null,
    jobGrams: 0,
    jobProgress: 0,
    elapsedMinutes: 0,
    totalMinutes: 0,
    targetNozzleTemp: 0,
    targetBedTemp: 0,
    orderId: null,
    runningHours: (printer.runningHours || 0) + hoursAdded,
  });

  const filMsg = deductedFilament 
    ? `Deducted ${jobGrams}g from "${deductedFilament.name}" (${remainingSpools} spools left).` 
    : `Logged ${jobGrams}g usage.`;
  const orderMsg = linkedOrder ? ` Order #${linkedOrder.id.slice(0,6)} moved to 'Ready for QC'.` : '';

  showToast(`🎉 ${escapeHtml(jobName)} Complete! ${filMsg}${orderMsg} Logged ₹${electricityCost} electricity expense.`, 'success');
  render(container);
}

// ─── Scrap Loss & Print Failure Logger Modal ───────────────────
function openScrapLossModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const currentGrams = printer.jobGrams || 140;
  const progressPct = printer.jobProgress || 30;
  const estimatedWasted = Math.round((currentGrams * progressPct) / 100);

  const body = `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--danger);font-size:0.95rem;">
        <span>⚠️ Abort Print & Log Scrap Loss</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 0 0;">
        Machine: <strong>${escapeHtml(printer.name)}</strong> • Job: <strong>${escapeHtml(printer.currentJob || 'Job')}</strong>
        <br />Deduct wasted filament mass and record failure cost in the financial ledger.
      </p>
    </div>

    <div class="form-group">
      <label class="form-label">Filament Wasted Before Failure (Grams) *</label>
      <div style="display:flex;gap:12px;align-items:center;">
        <input class="form-input" type="number" id="scrap-grams" value="${estimatedWasted}" min="1" max="1000" style="font-size:1.15rem;font-weight:700;max-width:140px;" />
        <span style="font-size:0.85rem;color:var(--text-secondary);">Estimated from ${progressPct}% completion</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Root Cause / Failure Reason *</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;" id="root-cause-chips">
        <span class="root-cause-chip selected" data-cause="Bed Adhesion Failure / Warping">🔲 Bed Adhesion Loss</span>
        <span class="root-cause-chip" data-cause="Nozzle Clog / Extruder Skipping">🔥 Nozzle Clog</span>
        <span class="root-cause-chip" data-cause="Layer Shift / Mechanical Skip">📐 Layer Shift</span>
        <span class="root-cause-chip" data-cause="Filament Runout / Tangled Spool">🧵 Filament Runout</span>
        <span class="root-cause-chip" data-cause="Power Cut / Workshop Outage">⚡ Power Cut</span>
        <span class="root-cause-chip" data-cause="Slicing / Overhang Defect">💻 Slicing Defect</span>
      </div>
      <input type="hidden" id="scrap-cause-val" value="Bed Adhesion Failure / Warping" />
    </div>

    <div class="form-group">
      <label class="form-label">Operator Notes / Diagnostic Log</label>
      <textarea class="form-textarea form-input" id="scrap-notes" placeholder="e.g. Z-offset was too high on front-left quadrant, nozzle cleaned with needle..."></textarea>
    </div>

    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:0.85rem;color:var(--text-secondary);">Calculated Material Loss Expense:</span>
      <strong id="disp-scrap-cost" style="color:var(--danger);font-size:1.05rem;">₹${Math.round(estimatedWasted * 1.45)}</strong>
    </div>
  `;

  showModal({
    title: 'Print Failure & Scrap Logger',
    body,
    confirmText: 'Record Scrap & Abort Job',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      const wastedGrams = parseFloat(document.getElementById('scrap-grams')?.value) || 0;
      const rootCause = document.getElementById('scrap-cause-val')?.value || 'Print Failure';
      const scrapCost = Math.round(wastedGrams * 1.45);

      if (printer.loadedSpool && wastedGrams > 0) {
        const allFilaments = getAll('filaments');
        const loadedFil = allFilaments.find(f => 
          printer.loadedSpool.toLowerCase().includes(f.name.toLowerCase()) ||
          f.name.toLowerCase().includes(printer.loadedSpool.toLowerCase())
        );

        if (loadedFil) {
          const newSpools = Math.max(0, Number(((loadedFil.spools || 1) - (wastedGrams / 1000)).toFixed(2)));
          update('filaments', loadedFil.id, {
            spools: newSpools,
            remainingGrams: Math.max(0, Math.round(((loadedFil.remainingGrams || (loadedFil.spools * 1000)) - wastedGrams))),
          });
        }
      }

      create('transactions', {
        date: formatDate(new Date()),
        description: `Scrap Loss (${wastedGrams}g on ${printer.name}): ${rootCause}`,
        category: 'Other',
        type: 'Expense',
        amount: -scrapCost,
      });

      update('printers', printerId, {
        status: 'idle',
        currentJob: null,
        jobGrams: 0,
        jobProgress: 0,
        elapsedMinutes: 0,
        targetNozzleTemp: 0,
        targetBedTemp: 0,
        orderId: null,
      });

      showToast(`⚠️ Scrap loss recorded: ${wastedGrams}g deducted from spool & ₹${scrapCost} logged in financial ledger.`, 'warning');
      closeModal();
      render(container);
    },
  });

  setTimeout(() => {
    const chips = document.querySelectorAll('#root-cause-chips .root-cause-chip');
    const hiddenVal = document.getElementById('scrap-cause-val');
    const gramsInput = document.getElementById('scrap-grams');
    const dispCost = document.getElementById('disp-scrap-cost');

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        if (hiddenVal) hiddenVal.value = chip.dataset.cause;
      });
    });

    gramsInput?.addEventListener('input', () => {
      const g = parseFloat(gramsInput.value) || 0;
      if (dispCost) dispCost.textContent = `₹${Math.round(g * 1.45)}`;
    });
  }, 50);
}

// ─── IoT Connector Configuration & Auto-Scan Modal ─────────────
function openIoTConfigModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(printer.name)} — IoT Telemetry Connector</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
        Connect directly to Klipper (Moonraker) over LAN for real-time sensor streams and automated job triggers.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Firmware / Controller Protocol *</label>
      <select class="form-select" id="iot-protocol">
        <option value="moonraker" ${printer.iotType === 'moonraker' ? 'selected' : ''}>Moonraker (Klipper HTTP / WebSocket)</option>
        <option value="bambu" ${printer.iotType === 'bambu' ? 'selected' : ''}>Bambu Lab Local Broker (MQTT over TLS)</option>
        <option value="octoprint" ${printer.iotType === 'octoprint' ? 'selected' : ''}>OctoPrint (REST API v1)</option>
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Printer IP / Hostname *</label>
        <input class="form-input" id="iot-host" value="${escapeHtml(printer.iotHost || '192.168.0.144')}" placeholder="e.g. 192.168.0.144" />
      </div>
      <div class="form-group">
        <label class="form-label">Port</label>
        <input class="form-input" id="iot-port" value="${escapeHtml(printer.iotPort || '80')}" placeholder="80 (default for Snapmaker)" />
      </div>
    </div>

    <!-- Auto-Scan Subnet Button if IP Keeps Changing -->
    <div style="background:rgba(139,92,246,0.06);border:1px dashed rgba(139,92,246,0.3);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:0.82rem;font-weight:600;color:var(--text-primary);">IP keeps changing on Wi-Fi?</div>
        <div style="font-size:0.72rem;color:var(--text-secondary);">Auto-scan your 192.168.0.X subnet to find the new IP</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-auto-scan-subnet" type="button">
        🔍 Auto-Scan LAN
      </button>
    </div>
    <div id="scan-status-msg" style="display:none;font-size:0.78rem;color:var(--accent);margin-bottom:12px;"></div>

    <div class="form-group">
      <label class="form-label">Webcam Stream URL (Optional)</label>
      <input class="form-input" id="iot-webcam" value="${escapeHtml(printer.webcamUrl || 'http://192.168.0.144/server/files/camera/')}" placeholder="http://192.168.0.144/server/files/camera/" />
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="iot-auto-deduct" ${printer.autoDeductSpool !== false ? 'checked' : ''} />
        <strong>Auto-Deduct Filament on PRINT_DONE Webhook</strong>
      </label>
    </div>
  `;

  showModal({
    title: 'Configure Physical Printer IoT Connector',
    body,
    confirmText: 'Save & Test Connection',
    onConfirm: async () => {
      const iotType = document.getElementById('iot-protocol')?.value;
      const iotHost = document.getElementById('iot-host')?.value.trim();
      const iotPort = document.getElementById('iot-port')?.value.trim();
      const webcamUrl = document.getElementById('iot-webcam')?.value.trim();
      const autoDeductSpool = document.getElementById('iot-auto-deduct')?.checked;

      update('printers', printerId, {
        iotType,
        iotHost,
        iotPort,
        webcamUrl,
        autoDeductSpool,
      });

      showToast(`📡 Testing connection to ${iotHost}...`, 'info');
      const tel = await fetchPrinterTelemetry(iotHost, iotPort || 80);
      if (tel.online) {
        showToast(`🎉 Connected to ${printer.name}! Extruder: ${tel.currentNozzleTemp}°C, Bed: ${tel.currentBedTemp}°C`, 'success');
      } else {
        showToast(`⚠️ Saved, but could not reach ${iotHost}. Verify printer is powered on.`, 'warning');
      }

      closeModal();
      render(container);
    },
  });

  // Wire up the Auto-Scan button inside the modal
  setTimeout(() => {
    const scanBtn = document.getElementById('btn-auto-scan-subnet');
    const hostInput = document.getElementById('iot-host');
    const statusMsg = document.getElementById('scan-status-msg');

    scanBtn?.addEventListener('click', async () => {
      scanBtn.disabled = true;
      scanBtn.textContent = 'Scanning...';
      if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = 'Scanning 192.168.0.100 - 200 for Moonraker/Snapmaker...';
      }

      const result = await scanLocalSubnet('192.168.0', (ip, curr, total) => {
        if (statusMsg) statusMsg.textContent = `Pinging ${ip} (${curr}/${total})...`;
      });

      if (result.found && hostInput) {
        hostInput.value = result.ip;
        if (statusMsg) {
          statusMsg.style.color = 'var(--success)';
          statusMsg.textContent = `🎉 Found Snapmaker at ${result.ip} (Klippy ${result.klippyState})! Updated input field.`;
        }
        showToast(`Found printer at ${result.ip}!`, 'success');
      } else {
        if (statusMsg) {
          statusMsg.style.color = 'var(--danger)';
          statusMsg.textContent = 'Could not find printer. Ensure machine Wi-Fi is connected.';
        }
      }

      scanBtn.disabled = false;
      scanBtn.textContent = '🔍 Auto-Scan LAN';
    });
  }, 50);
}

// ─── Quick Tare Shortcut from Printer Spool ────────────────────
function quickTarePrinterSpool(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer || !printer.loadedSpool) {
    openTareCalculatorModal(null, () => render(container));
    return;
  }

  const allFilaments = getAll('filaments');
  const matched = allFilaments.find(f => 
    printer.loadedSpool.toLowerCase().includes(f.name.toLowerCase()) ||
    f.name.toLowerCase().includes(printer.loadedSpool.toLowerCase())
  );

  openTareCalculatorModal(matched?.id || null, () => render(container));
}

// ─── Real-Time IoT Telemetry Heartbeat Simulation ──────────────
function toggleTelemetryHeartbeat(container) {
  _telemetryActive = !_telemetryActive;

  if (_telemetryActive) {
    showToast('📡 IoT Telemetry Heartbeat ACTIVATED. Live sensor feed running.', 'info');
    _telemetryTimer = setInterval(() => {
      simulateTelemetryTick(container);
    }, 4000);
  } else {
    if (_telemetryTimer) clearInterval(_telemetryTimer);
    _telemetryTimer = null;
    showToast('IoT Telemetry Heartbeat PAUSED.', 'warning');
  }

  render(container);
}

async function simulateTelemetryTick(container) {
  const printers = getAll('printers');

  for (const p of printers) {
    // If it has physical LAN IP, poll real hardware
    if (p.iotHost) {
      const tel = await fetchPrinterTelemetry(p.iotHost, p.iotPort || 80);
      if (tel.online) {
        update('printers', p.id, {
          currentNozzleTemp: tel.currentNozzleTemp,
          targetNozzleTemp: tel.targetNozzleTemp,
          currentBedTemp: tel.currentBedTemp,
          targetBedTemp: tel.targetBedTemp,
          chamberTemp: tel.chamberTemp,
          status: tel.status,
          currentJob: tel.currentJob || p.currentJob,
          jobProgress: tel.jobProgress || p.jobProgress,
          elapsedMinutes: tel.elapsedMinutes || p.elapsedMinutes,
        });

        // Update DOM elements in real-time
        const nozzleEl = document.getElementById(`temp-nozzle-${p.id}`);
        const bedEl = document.getElementById(`temp-bed-${p.id}`);
        const chamberEl = document.getElementById(`temp-chamber-${p.id}`);
        const progValEl = document.getElementById(`prog-val-${p.id}`);
        const progBarEl = document.getElementById(`prog-bar-${p.id}`);

        if (nozzleEl) nozzleEl.textContent = tel.currentNozzleTemp;
        if (bedEl) bedEl.textContent = tel.currentBedTemp;
        if (chamberEl && tel.chamberTemp) chamberEl.textContent = tel.chamberTemp;
        if (progValEl && tel.jobProgress) progValEl.textContent = `${tel.jobProgress}%`;
        if (progBarEl && tel.jobProgress) progBarEl.style.width = `${tel.jobProgress}%`;
      }
    } else if (p.status === 'printing') {
      // Simulated machine jitter
      const targetNozzle = p.targetNozzleTemp || 215;
      const targetBed = p.targetBedTemp || 60;
      const jitterNozzle = targetNozzle + (Math.floor(Math.random() * 3) - 1);
      const jitterBed = targetBed + (Math.floor(Math.random() * 2) - 0.5);

      const newElapsed = (p.elapsedMinutes || 10) + 1;
      const newProgress = Math.min(100, (p.jobProgress || 10) + 2);

      update('printers', p.id, {
        currentNozzleTemp: jitterNozzle,
        currentBedTemp: Math.round(jitterBed),
        elapsedMinutes: newElapsed,
        jobProgress: newProgress,
      });

      const nozzleEl = document.getElementById(`temp-nozzle-${p.id}`);
      const bedEl = document.getElementById(`temp-bed-${p.id}`);
      const progValEl = document.getElementById(`prog-val-${p.id}`);
      const progBarEl = document.getElementById(`prog-bar-${p.id}`);
      const elapsedEl = document.getElementById(`prog-elapsed-${p.id}`);

      if (nozzleEl) nozzleEl.textContent = jitterNozzle;
      if (bedEl) bedEl.textContent = Math.round(jitterBed);
      if (progValEl) progValEl.textContent = `${newProgress}%`;
      if (progBarEl) progBarEl.style.width = `${newProgress}%`;
      if (elapsedEl) elapsedEl.textContent = `${Math.floor(newElapsed/60)}h ${newElapsed%60}m`;

      if (newProgress >= 100) {
        markJobComplete(p.id, container, true);
      }
    }
  }
}

// ─── Machine Controls (Pause, Preheat, Assign) ────────────────
function togglePause(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const isPaused = printer.status === 'paused';
  update('printers', printerId, {
    status: isPaused ? 'printing' : 'paused',
  });

  showToast(isPaused ? 'Resumed printing' : 'Printing paused', 'info');
  render(container);
}

function preheatPrinter(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  update('printers', printerId, {
    status: 'heating',
    targetNozzleTemp: 220,
    targetBedTemp: 60,
    currentNozzleTemp: 185,
    currentBedTemp: 55,
  });

  showToast(`Heating ${printer.name}: 220°C / 60°C`, 'info');
  render(container);
}

function finishMaintenance(printerId, container) {
  update('printers', printerId, {
    status: 'idle',
    targetNozzleTemp: 0,
    targetBedTemp: 0,
  });

  showToast('Printer returned to active service!', 'success');
  render(container);
}

function openAssignJobModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const orders = getAll('orders').filter(o => o.status === 'active' || o.kanbanStage === 'in_queue' || o.kanbanStage === 'slicing');
  const filaments = getAll('filaments');

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:var(--space-md);">
      <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(printer.name)}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(printer.model)} • Volume: ${escapeHtml(printer.buildVolume)}</div>
    </div>

    <div class="form-group">
      <label class="form-label">Select Active Order / Project *</label>
      <select class="form-select" id="assign-order-select">
        ${orders.length > 0 ? orders.map(o => `
          <option value="${o.id}">${escapeHtml(o.clientName)} — ${escapeHtml(o.description || '3D Print')} (${formatCurrency(o.totalAmount)})</option>
        `).join('') : '<option value="">No queued orders available (Standalone Job)</option>'}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Part / Job Name *</label>
      <input class="form-input" id="assign-part-name" placeholder="e.g. Robot Arm Joint Bracket (Set of 2)" value="Production Part" />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Loaded Spool Material</label>
        <select class="form-select" id="assign-spool-select">
          ${filaments.map(f => `
            <option value="${escapeHtml(f.name)}" data-hex="${f.hex || '#888'}" data-mat="${f.material}">
              ${escapeHtml(f.name)} (${f.material || 'PLA+'}) — ${f.spools || 0} in stock
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Estimated Filament Mass (Grams)</label>
        <input class="form-input" type="number" id="assign-grams" min="5" value="145" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Estimated Print Duration (Hours)</label>
      <input class="form-input" type="number" id="assign-duration" min="0.5" step="0.5" value="3.5" />
    </div>
  `;

  showModal({
    title: 'Dispatch Job to 3D Printer',
    body,
    confirmText: 'Dispatch & Start Printing',
    onConfirm: () => {
      const orderId = document.getElementById('assign-order-select')?.value;
      const partDesc = document.getElementById('assign-part-name')?.value.trim();
      const spoolSelect = document.getElementById('assign-spool-select');
      const selectedSpoolName = spoolSelect?.value || 'Standard Spool';
      const selectedOption = spoolSelect?.selectedOptions[0];
      const spoolHex = selectedOption?.dataset.hex || '#3b82f6';
      const spoolMat = selectedOption?.dataset.mat || 'PLA+';
      const jobGrams = parseFloat(document.getElementById('assign-grams')?.value) || 145;
      const durationHours = parseFloat(document.getElementById('assign-duration')?.value) || 2.5;

      let jobTitle = partDesc;
      if (orderId) {
        const order = getById('orders', orderId);
        if (order) {
          jobTitle = `${order.clientName} — ${partDesc || order.description || 'Custom Print'}`;
          update('orders', orderId, { kanbanStage: 'printing', status: 'active' });
        }
      }

      let nozzleT = 215;
      let bedT = 60;
      if (spoolMat.includes('PETG')) { nozzleT = 245; bedT = 80; }
      else if (spoolMat.includes('ABS')) { nozzleT = 250; bedT = 95; }
      else if (spoolMat.includes('TPU')) { nozzleT = 225; bedT = 50; }

      update('printers', printerId, {
        status: 'printing',
        currentJob: jobTitle || 'Production Print Job',
        jobGrams,
        jobProgress: 4,
        elapsedMinutes: 5,
        totalMinutes: Math.round(durationHours * 60),
        loadedSpool: selectedSpoolName,
        loadedSpoolHex: spoolHex,
        targetNozzleTemp: nozzleT,
        currentNozzleTemp: nozzleT - 4,
        targetBedTemp: bedT,
        currentBedTemp: bedT,
        orderId: orderId || null,
      });

      showToast(`🚀 Job dispatched to ${printer.name}! (~${jobGrams}g, ${durationHours}h)`, 'success');
      closeModal();
      render(container);
    },
  });
}

function openMaintenanceLogModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-bottom:var(--space-md);">
      <strong>${escapeHtml(printer.name)}</strong>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
        Current Odometer: <strong>${printer.runningHours || 0} operating hours</strong>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Maintenance Service Action *</label>
      <select class="form-select" id="maint-action">
        <option value="Nozzle Replacement">Nozzle Replacement (Swap 0.4mm / 0.6mm)</option>
        <option value="Linear Rails Lubrication">Linear Rails & Lead Screw Lubrication</option>
        <option value="Bed Leveling & Tramming">Bed Leveling & Z-Offset Calibration</option>
        <option value="Belt Tensioning">Timing Belts Inspection & Tensioning</option>
        <option value="Extruder Gear Cleaning">Extruder Dual-Drive Gear Cleaning</option>
        <option value="General Preventative Maintenance">Full Preventative Inspection</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Technician Notes</label>
      <textarea class="form-textarea form-input" id="maint-notes" placeholder="Parts installed, torque checks, runout test..."></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">
        <input type="checkbox" id="maint-reset-counter" checked /> Reset service interval odometer
      </label>
    </div>
  `;

  showModal({
    title: 'Log Machine Maintenance',
    body,
    confirmText: 'Record Service Log',
    onConfirm: () => {
      const action = document.getElementById('maint-action')?.value;
      const notes = document.getElementById('maint-notes')?.value.trim();
      const shouldReset = document.getElementById('maint-reset-counter')?.checked;

      const newLog = {
        date: formatDate(new Date()),
        action,
        notes,
        hoursAtService: printer.runningHours || 0,
      };

      const logs = printer.maintenanceLogs || [];
      logs.unshift(newLog);

      update('printers', printerId, {
        maintenanceLogs: logs,
        maintenanceDueHours: shouldReset ? (printer.runningHours || 0) + 300 : printer.maintenanceDueHours,
      });

      showToast('Maintenance recorded!', 'success');
      closeModal();
      render(container);
    },
  });
}

function openPrinterModal(container, editId = null) {
  const existing = editId ? getById('printers', editId) : null;
  const isEdit = !!existing;

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Machine Name / ID *</label>
        <input class="form-input" id="pr-name" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Snapmaker U1 #01" required />
      </div>
      <div class="form-group">
        <label class="form-label">Printer Model *</label>
        <input class="form-input" id="pr-model" value="${escapeHtml(existing?.model || '')}" placeholder="e.g. Snapmaker U1, Voron 2.4, Bambu P1S" required />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Build Volume (X x Y x Z mm)</label>
        <input class="form-input" id="pr-volume" value="${escapeHtml(existing?.buildVolume || '250 x 250 x 250 mm')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Nozzle Diameter / Type</label>
        <input class="form-input" id="pr-nozzle" value="${escapeHtml(existing?.nozzleDiameter || '0.4 mm Hardened Steel')}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Workshop Bay / Location</label>
        <input class="form-input" id="pr-location" value="${escapeHtml(existing?.location || 'Workbench 1')}" placeholder="e.g. Workbench A1 — Enclosed" />
      </div>
      <div class="form-group">
        <label class="form-label">Running Hours Odometer</label>
        <input class="form-input" type="number" id="pr-hours" min="0" value="${existing?.runningHours || 0}" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">LAN IP Address</label>
        <input class="form-input" id="pr-ip" value="${escapeHtml(existing?.iotHost || '')}" placeholder="e.g. 192.168.0.144" />
      </div>
      <div class="form-group">
        <label class="form-label">Port</label>
        <input class="form-input" id="pr-port" value="${escapeHtml(existing?.iotPort || '80')}" placeholder="80" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea form-input" id="pr-notes" placeholder="Chamber heater specs, high-flow hotend notes...">${escapeHtml(existing?.notes || '')}</textarea>
    </div>
  `;

  showModal({
    title: isEdit ? 'Edit 3D Printer Specs' : 'Add Machine to Fleet',
    body,
    confirmText: isEdit ? 'Save Changes' : 'Add Machine',
    onConfirm: () => {
      const name = document.getElementById('pr-name')?.value.trim();
      const model = document.getElementById('pr-model')?.value.trim();

      if (!name || !model) {
        showToast('Name and Model are required', 'error');
        return;
      }

      const data = {
        name,
        model,
        buildVolume: document.getElementById('pr-volume')?.value.trim() || '250 x 250 x 250 mm',
        nozzleDiameter: document.getElementById('pr-nozzle')?.value.trim() || '0.4 mm Hardened Steel',
        location: document.getElementById('pr-location')?.value.trim() || 'Workshop Farm',
        runningHours: parseInt(document.getElementById('pr-hours')?.value) || 0,
        iotHost: document.getElementById('pr-ip')?.value.trim() || '',
        iotPort: document.getElementById('pr-port')?.value.trim() || '80',
        notes: document.getElementById('pr-notes')?.value.trim() || '',
        status: existing?.status || 'idle',
        targetNozzleTemp: existing?.targetNozzleTemp || 0,
        currentNozzleTemp: existing?.currentNozzleTemp || 28,
        targetBedTemp: existing?.targetBedTemp || 0,
        currentBedTemp: existing?.currentBedTemp || 28,
      };

      if (isEdit) {
        update('printers', editId, data);
        showToast('Printer updated!', 'success');
      } else {
        create('printers', data);
        showToast('Machine added to fleet!', 'success');
      }

      closeModal();
      render(container);
    },
  });
}

function confirmDeletePrinter(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  showModal({
    title: 'Remove Printer from Fleet',
    body: `<p>Remove <strong>${escapeHtml(printer.name)}</strong> from the active fleet registry?</p>`,
    confirmText: 'Remove Machine',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      remove('printers', printerId);
      showToast(`Removed ${printer.name}`, 'warning');
      closeModal();
      render(container);
    },
  });
}
