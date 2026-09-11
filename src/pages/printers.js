/**
 * Made N More — 3D Printer Fleet Farm Interface
 * Operator-centric control room for physical 3D printers, IoT telemetry, zero-touch spool deduction, and scrap logging
 */

import { getAll, create, update, remove, getById } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { PRINTER_SEED } from '../data/seed.js';
import { openTareCalculatorModal } from '../utils/tareCalculator.js';
import { readSlicerFile } from '../utils/slicerParser.js';

let _telemetryActive = false;
let _telemetryTimer = null;

export function renderPrinters(container) {
  // Auto-seed sample printers if fleet is empty
  let printers = getAll('printers');
  if (printers.length === 0) {
    PRINTER_SEED.forEach(p => create('printers', p));
    printers = getAll('printers');
  }

  render(container);
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
        <p class="text-secondary">Direct physical machine telemetry, automated spool deduction & scrap loss logging</p>
      </div>
      <div class="page-header-actions">
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

    <!-- Printers Cards Grid -->
    <div class="printer-grid animate-in animate-delay-2">
      ${printers.map(p => renderPrinterCard(p)).join('')}
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
  const iotType = printer.iotType || (printer.model.includes('Bambu') ? 'bambu' : printer.model.includes('Voron') ? 'moonraker' : 'octoprint');
  const iotLabels = {
    moonraker: 'Moonraker (Klipper)',
    bambu: 'Bambu Lab MQTT',
    octoprint: 'OctoPrint REST',
    snapmaker: 'Snapmaker Serial',
  };

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
          <button class="printer-iot-badge" data-action="iot-config" data-id="${printer.id}" title="Configure API & IoT settings">
            <span>📡 ${iotLabels[iotType] || 'IoT Hub'}</span>
            <span style="font-size:0.65rem;opacity:0.7;">⚙️</span>
          </button>
        </div>
      </div>

      <!-- Thermal Telemetry -->
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
      else if (action === 'edit-printer') openPrinterModal(container, id);
      else if (action === 'delete-printer') confirmDeletePrinter(id, container);
    });
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

    // Configure temperatures
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

  // Show detailed confirmation
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
      const notes = document.getElementById('scrap-notes')?.value.trim();
      const scrapCost = Math.round(wastedGrams * 1.45);

      // 1. Deduct wasted grams from loaded spool
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

      // 2. Log Scrap Loss in Transactions
      create('transactions', {
        date: formatDate(new Date()),
        description: `Scrap Loss (${wastedGrams}g on ${printer.name}): ${rootCause}`,
        category: 'Other',
        type: 'Expense',
        amount: -scrapCost,
      });

      // 3. Reset Printer
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

  // Wire chips inside modal
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

// ─── IoT Connector Configuration Modal ─────────────────────────
function openIoTConfigModal(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const body = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="font-weight:700;font-size:0.95rem;">${escapeHtml(printer.name)} — IoT Telemetry Connector</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">
        Connect directly to Klipper (Moonraker), Bambu Lab Local MQTT, or OctoPrint for real-time sensor streams and automated job triggers.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Firmware / Controller Protocol *</label>
      <select class="form-select" id="iot-protocol">
        <option value="moonraker" ${printer.iotType === 'moonraker' ? 'selected' : ''}>Moonraker (Klipper WebSocket / REST)</option>
        <option value="bambu" ${printer.iotType === 'bambu' ? 'selected' : ''}>Bambu Lab Local Broker (MQTT over TLS)</option>
        <option value="octoprint" ${printer.iotType === 'octoprint' ? 'selected' : ''}>OctoPrint (REST API v1)</option>
        <option value="snapmaker" ${printer.iotType === 'snapmaker' ? 'selected' : ''}>Snapmaker Serial / WiFi Hub</option>
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Printer IP / Hostname *</label>
        <input class="form-input" id="iot-host" value="${escapeHtml(printer.iotHost || '192.168.1.120')}" placeholder="e.g. 192.168.1.120 or mainsail.local" />
      </div>
      <div class="form-group">
        <label class="form-label">Port</label>
        <input class="form-input" id="iot-port" value="${escapeHtml(printer.iotPort || '7125')}" placeholder="7125 / 8883 / 5000" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">API Key / Access Code</label>
      <input class="form-input" type="password" id="iot-token" value="${escapeHtml(printer.iotToken || 'mk_secret_farm_token')}" placeholder="Moonraker API Key / Bambu Access Code" />
    </div>

    <div class="form-group">
      <label class="form-label">Webcam Stream URL (Optional)</label>
      <input class="form-input" id="iot-webcam" value="${escapeHtml(printer.webcamUrl || '')}" placeholder="http://192.168.1.120/webcam/?action=stream" />
    </div>

    <div class="form-group" style="margin-top:12px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="iot-auto-deduct" ${printer.autoDeductSpool !== false ? 'checked' : ''} />
        <strong>Auto-Deduct Filament on PRINT_DONE Webhook</strong>
      </label>
      <p style="font-size:0.75rem;color:var(--text-secondary);margin:4px 0 0 24px;">
        When printer fires print finished notification, automatically deducts grams from loaded spool and moves order to QC.
      </p>
    </div>
  `;

  showModal({
    title: 'Configure Physical Printer IoT Connector',
    body,
    confirmText: 'Save Connector Settings',
    onConfirm: () => {
      const iotType = document.getElementById('iot-protocol')?.value;
      const iotHost = document.getElementById('iot-host')?.value.trim();
      const iotPort = document.getElementById('iot-port')?.value.trim();
      const iotToken = document.getElementById('iot-token')?.value.trim();
      const webcamUrl = document.getElementById('iot-webcam')?.value.trim();
      const autoDeductSpool = document.getElementById('iot-auto-deduct')?.checked;

      update('printers', printerId, {
        iotType,
        iotHost,
        iotPort,
        iotToken,
        webcamUrl,
        autoDeductSpool,
      });

      showToast(`📡 IoT connector updated for ${printer.name}!`, 'success');
      closeModal();
      render(container);
    },
  });
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

function simulateTelemetryTick(container) {
  const printers = getAll('printers');
  let anyCompleted = false;

  printers.forEach(p => {
    if (p.status === 'printing') {
      // Fluctuating temperatures around target
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

      // Update DOM gauges directly if present
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

      // Auto-trigger completion on 100%
      if (newProgress >= 100 && !anyCompleted) {
        anyCompleted = true;
        markJobComplete(p.id, container, true);
      }
    }
  });
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
        <input class="form-input" id="pr-name" value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Snapmaker U1 #02" required />
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
        <label class="form-label">Workshop Location</label>
        <input class="form-input" id="pr-location" value="${escapeHtml(existing?.location || 'Workbench 1')}" placeholder="e.g. Workbench A1 — Enclosed" />
      </div>
      <div class="form-group">
        <label class="form-label">Initial Running Hours</label>
        <input class="form-input" type="number" id="pr-hours" min="0" value="${existing?.runningHours || 0}" />
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
