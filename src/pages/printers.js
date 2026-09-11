/**
 * Made N More — 3D Printer Fleet Farm Interface
 * Operator-centric control room for multiple 3D printers, telemetry, job assignment, and maintenance
 */

import { getAll, create, update, remove, getById } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { PRINTER_SEED } from '../data/seed.js';

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
        <p class="text-secondary">Real-time multi-printer monitoring, job queue dispatch & machine maintenance</p>
      </div>
      <div class="page-header-actions">
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

  return `
    <div class="card printer-card status-${printer.status || 'idle'}" data-printer-id="${printer.id}">
      <!-- Header -->
      <div class="printer-card-header">
        <div class="printer-title-group">
          <div class="printer-name">${escapeHtml(printer.name)}</div>
          <div class="printer-model">${escapeHtml(printer.model || 'FDM Printer')}</div>
        </div>
        <span class="status-badge-live ${status.class}">
          <span class="status-live-dot" style="background:${status.color};"></span>
          ${status.label}
        </span>
      </div>

      <!-- Thermal Telemetry -->
      <div class="telemetry-row">
        <div class="temp-gauge">
          <span class="temp-label">🔥 Extruder</span>
          <div class="temp-value">
            ${printer.currentNozzleTemp || 28}°C 
            <span class="temp-target">/ ${printer.targetNozzleTemp || 0}°C</span>
          </div>
        </div>
        <div class="temp-gauge">
          <span class="temp-label">🔲 Heatbed</span>
          <div class="temp-value">
            ${printer.currentBedTemp || 28}°C 
            <span class="temp-target">/ ${printer.targetBedTemp || 0}°C</span>
          </div>
        </div>
      </div>

      <!-- Active Job or Idle State -->
      ${printer.status === 'printing' && printer.currentJob ? `
        <div class="printer-job-box">
          <div class="printer-job-title">
            <span>⚙️ ${escapeHtml(printer.currentJob)}</span>
            <span style="color:var(--info);">${printer.jobProgress || 0}%</span>
          </div>
          <div class="order-progress-bar-track" style="margin-bottom:8px;height:5px;">
            <div class="order-progress-bar-fill" style="width:${printer.jobProgress || 0}%;background:var(--accent-gradient);"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary);">
            <span>Elapsed: ${Math.floor((printer.elapsedMinutes || 0)/60)}h ${(printer.elapsedMinutes || 0)%60}m</span>
            <span>Total: ${Math.floor((printer.totalMinutes || 0)/60)}h ${(printer.totalMinutes || 0)%60}m</span>
          </div>
        </div>
      ` : `
        <div class="printer-job-box" style="text-align:center;padding:16px 12px;background:rgba(255,255,255,0.015);">
          <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:6px;">
            ${printer.status === 'maintenance' ? '🛠️ Machine under servicing / tuning' : '✨ Build plate clear and ready for next job'}
          </div>
        </div>
      `}

      <!-- Loaded Spool & Specs -->
      <div class="printer-meta-specs">
        <span>🧵 Spool:</span>
        <span style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          ${printer.loadedSpoolHex ? `<span class="color-swatch" style="width:12px;height:12px;display:inline-block;background-color:${printer.loadedSpoolHex};"></span>` : ''}
          ${escapeHtml(printer.loadedSpool || 'Not assigned')}
        </span>
      </div>

      <div class="printer-meta-specs">
        <span>📐 Build Volume:</span>
        <span style="color:var(--text-secondary);">${escapeHtml(printer.buildVolume || '250 x 250 x 250 mm')}</span>
      </div>

      <div class="printer-meta-specs">
        <span>📍 Location:</span>
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
          <button class="btn btn-primary btn-sm flex-1" data-action="complete-job" data-id="${printer.id}">
            ✓ Complete
          </button>
          <button class="btn btn-ghost btn-sm" data-action="toggle-pause" data-id="${printer.id}" title="Pause/Resume">
            ⏸️
          </button>
          <button class="btn btn-ghost btn-sm" data-action="cancel-job" data-id="${printer.id}" title="Cancel Job" style="color:var(--danger);">
            ✕
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

  // Card Actions
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'assign-job') openAssignJobModal(id, container);
      else if (action === 'complete-job') markJobComplete(id, container);
      else if (action === 'cancel-job') cancelJob(id, container);
      else if (action === 'toggle-pause') togglePause(id, container);
      else if (action === 'preheat') preheatPrinter(id, container);
      else if (action === 'finish-maintenance') finishMaintenance(id, container);
      else if (action === 'maintenance-log') openMaintenanceLogModal(id, container);
      else if (action === 'edit-printer') openPrinterModal(container, id);
      else if (action === 'delete-printer') confirmDeletePrinter(id, container);
    });
  });
}

// ─── Machine Actions ──────────────────────────────────────────
function markJobComplete(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  const jobName = printer.currentJob || 'Job';
  const hoursAdded = Math.max(1, Math.round((printer.totalMinutes || 120) / 60));

  update('printers', printerId, {
    status: 'idle',
    currentJob: null,
    jobProgress: 0,
    elapsedMinutes: 0,
    totalMinutes: 0,
    targetNozzleTemp: 0,
    targetBedTemp: 0,
    runningHours: (printer.runningHours || 0) + hoursAdded,
  });

  showToast(`🎉 ${escapeHtml(jobName)} completed on ${printer.name}! Plate cleared.`, 'success');
  render(container);
}

function cancelJob(printerId, container) {
  const printer = getById('printers', printerId);
  if (!printer) return;

  showModal({
    title: 'Abort Print Job',
    body: `<p>Cancel active job <strong>${escapeHtml(printer.currentJob || 'Job')}</strong> on ${printer.name}?</p>
           <p class="text-danger" style="margin-top:8px;font-size:0.85rem;">This will stop the heater targets and reset the machine state.</p>`,
    confirmText: 'Abort Print',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      update('printers', printerId, {
        status: 'idle',
        currentJob: null,
        jobProgress: 0,
        targetNozzleTemp: 0,
        targetBedTemp: 0,
      });
      showToast('Print cancelled. Heaters set to cooldown.', 'warning');
      closeModal();
      render(container);
    },
  });
}

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
    currentNozzleTemp: 180,
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

// ─── Assign Job Modal ─────────────────────────────────────────
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
        `).join('') : '<option value="">No queued orders available</option>'}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Specific Part / Assembly Description</label>
      <input class="form-input" id="assign-part-name" placeholder="e.g. Front Motor Mount (Part 1 of 4)" />
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
        <label class="form-label">Estimated Print Duration (Hours)</label>
        <input class="form-input" type="number" id="assign-duration" min="0.5" step="0.5" value="3.5" />
      </div>
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
      const durationHours = parseFloat(document.getElementById('assign-duration')?.value) || 2;

      let jobTitle = partDesc;
      if (orderId) {
        const order = getById('orders', orderId);
        if (order) {
          jobTitle = `${order.clientName} — ${partDesc || order.description || 'Custom Print'}`;
          // Update order stage to printing
          update('orders', orderId, { kanbanStage: 'printing', status: 'active' });
        }
      }

      // Configure extrusion temps based on material
      let nozzleT = 215;
      let bedT = 60;
      if (spoolMat.includes('PETG')) { nozzleT = 245; bedT = 80; }
      else if (spoolMat.includes('ABS')) { nozzleT = 250; bedT = 95; }
      else if (spoolMat.includes('TPU')) { nozzleT = 225; bedT = 50; }

      update('printers', printerId, {
        status: 'printing',
        currentJob: jobTitle || 'Production Print Job',
        jobProgress: 5,
        elapsedMinutes: 10,
        totalMinutes: Math.round(durationHours * 60),
        loadedSpool: selectedSpoolName,
        loadedSpoolHex: spoolHex,
        targetNozzleTemp: nozzleT,
        currentNozzleTemp: nozzleT - 5,
        targetBedTemp: bedT,
        currentBedTemp: bedT,
      });

      showToast(`Job dispatched to ${printer.name}!`, 'success');
      closeModal();
      render(container);
    },
  });
}

// ─── Maintenance Log Modal ───────────────────────────────────
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

// ─── Add / Edit Printer Modal ────────────────────────────────
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
