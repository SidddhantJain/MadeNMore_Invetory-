/**
 * Made N More — Universal Workshop Scrap & Defect Logger (Phase 4)
 * Real shop-floor failure tracking: records scrap mass, calculates financial loss,
 * deducts spool inventory, debits ledger account, and links to orders or physical printers.
 */

import { getAll, create, update, getById } from '../data/store.js';
import { formatCurrency, formatDate, escapeHtml } from './helpers.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

// Material cost standard per gram (used if spool cost is not explicitly defined)
const MATERIAL_COST_PER_GRAM = {
  'PLA+': 0.95,
  'PETG-HS': 1.15,
  'ABS': 1.25,
  'TPU+': 1.65,
  'PLA Silk': 1.35,
  'PLA Matt': 1.20,
};

const ROOT_CAUSES = [
  { id: 'bed-adhesion', label: '🔲 Bed Adhesion Loss / Warping', defaultGrams: 40 },
  { id: 'nozzle-clog', label: '🔥 Nozzle Clog / Extruder Skip', defaultGrams: 60 },
  { id: 'layer-shift', label: '📐 Layer Shift / Mechanical Skip', defaultGrams: 85 },
  { id: 'filament-runout', label: '🧵 Filament Runout / Spool Snag', defaultGrams: 50 },
  { id: 'power-cut', label: '⚡ Power Cut / Workshop Outage', defaultGrams: 110 },
  { id: 'slicer-defect', label: '💻 Slicer Settings / Support Failure', defaultGrams: 70 },
  { id: 'post-process', label: '🔨 Post-Processing / Insert Stripped', defaultGrams: 90 },
  { id: 'qc-defect', label: '🔬 QC Surface / Dimension Reject', defaultGrams: 120 },
  { id: 'purge-waste', label: '🧪 Multi-Color Purge / Poop Chute', defaultGrams: 35 },
];

/**
 * Open the Universal Scrap & Print Failure Logger Modal
 * @param {Object} options - { printerId, orderId, spoolId }
 * @param {Function} onComplete - Callback after saving
 */
export function openUniversalScrapLossModal(options = {}, onComplete = null) {
  const printers = getAll('printers') || [];
  const filaments = getAll('filaments') || [];
  const orders = getAll('orders') || [];
  const accounts = getAll('accounts') || [];

  const initialPrinter = options.printerId ? getById('printers', options.printerId) : null;
  const initialOrder = options.orderId ? getById('orders', options.orderId) : null;
  
  // Find linked spool
  let initialSpoolId = options.spoolId || '';
  if (!initialSpoolId && initialPrinter && initialPrinter.loadedSpool) {
    const matched = filaments.find(f => 
      initialPrinter.loadedSpool.toLowerCase().includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(initialPrinter.loadedSpool.toLowerCase())
    );
    if (matched) initialSpoolId = matched.id;
  }
  if (!initialSpoolId && initialOrder && initialOrder.items && initialOrder.items.length > 0) {
    const firstMat = initialOrder.items[0].material || '';
    const matched = filaments.find(f => f.material === firstMat);
    if (matched) initialSpoolId = matched.id;
  }
  if (!initialSpoolId && filaments.length > 0) {
    initialSpoolId = filaments[0].id;
  }

  // Initial estimated wasted grams
  let initialGrams = 45;
  if (initialPrinter && initialPrinter.status === 'printing') {
    const totalGrams = initialPrinter.jobGrams || 140;
    const progress = initialPrinter.jobProgress || 30;
    initialGrams = Math.max(5, Math.round((totalGrams * progress) / 100));
  } else if (initialOrder && initialOrder.items && initialOrder.items.length > 0) {
    initialGrams = initialOrder.items[0].grams || 65;
  }

  const selectedSpool = filaments.find(f => f.id === initialSpoolId) || filaments[0];
  const matRate = selectedSpool ? (MATERIAL_COST_PER_GRAM[selectedSpool.material] || 1.45) : 1.45;
  const initialCost = Math.round(initialGrams * matRate);

  const body = `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--danger);font-size:0.98rem;">
          <span>⚠️ Universal Workshop Scrap & Defect Logger</span>
        </div>
        <span class="badge" style="background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.3);font-size:0.75rem;">
          Phase 4 Quality & Loss Audit
        </span>
      </div>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:6px 0 0 0;line-height:1.4;">
        Record wasted filament mass from failed prints, post-processing damage, purge waste, or QC rejects. 
        Deducts physical inventory and records actual material loss in your financial ledger.
      </p>
    </div>

    <!-- Machine & Workstation Selection -->
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Machine / Source Origin *</label>
        <select class="form-select" id="scrap-source-printer">
          <option value="">Workshop Bench / Post-Processing Station</option>
          ${printers.map(p => `
            <option value="${p.id}" ${initialPrinter && initialPrinter.id === p.id ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${p.status === 'printing' ? `Active: ${escapeHtml(p.currentJob || 'Job')}` : p.status})
            </option>
          `).join('')}
          <option value="qc-station">QC Inspection Bench (Finished Part Reject)</option>
          <option value="purge-station">Purge Tower / Waste Bucket (AMS / Dual Extruder)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Associated Order (Optional)</label>
        <select class="form-select" id="scrap-linked-order">
          <option value="">— Unlinked / Internal R&D / Calibration —</option>
          ${orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map(o => `
            <option value="${o.id}" ${initialOrder && initialOrder.id === o.id ? 'selected' : ''}>
              #${o.id.slice(0, 6).toUpperCase()} • ${escapeHtml(o.clientName)} (${escapeHtml(o.description || 'Custom')})
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Spool Selection & Live Net Balance -->
    <div class="form-group">
      <label class="form-label">Filament Spool to Deduct *</label>
      <select class="form-select" id="scrap-spool-select">
        ${filaments.map(f => {
          const remaining = f.remainingGrams || Math.round((f.spools || 1) * 1000);
          const tare = f.tareWeight || 210;
          const isCalibrated = !!f.lastWeighed;
          return `
            <option value="${f.id}" ${f.id === initialSpoolId ? 'selected' : ''} data-rate="${MATERIAL_COST_PER_GRAM[f.material] || 1.45}" data-remaining="${remaining}">
              ${escapeHtml(f.name)} (${f.material}) • ${remaining}g left ${isCalibrated ? '⚖️ Calibrated' : `(Tare ${tare}g)`}
            </option>
          `;
        }).join('')}
      </select>
    </div>

    <!-- Wasted Mass with Quick Chips and Digital Scale Prompt -->
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <label class="form-label" style="margin:0;">Wasted Filament Mass (Grams) *</label>
        <span style="font-size:0.75rem;color:var(--text-muted);">
          ⚖️ Place failed part / purge scrap on digital scale
        </span>
      </div>
      <div style="display:flex;gap:12px;align-items:center;">
        <input class="form-input" type="number" id="scrap-grams-input" value="${initialGrams}" min="1" max="2500" step="1" style="font-size:1.25rem;font-weight:800;max-width:140px;color:var(--danger);" />
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          <button type="button" class="btn btn-secondary btn-sm btn-quick-scrap-gram" data-grams="15">15g (Purge)</button>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-scrap-gram" data-grams="35">35g (Early)</button>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-scrap-gram" data-grams="75">75g (Mid)</button>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-scrap-gram" data-grams="150">150g (Late)</button>
          <button type="button" class="btn btn-secondary btn-sm btn-quick-scrap-gram" data-grams="250">250g (Full)</button>
        </div>
      </div>
    </div>

    <!-- Root Cause Chips -->
    <div class="form-group">
      <label class="form-label">Root Cause / Failure Classification *</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;" id="scrap-root-cause-chips">
        ${ROOT_CAUSES.map((rc, idx) => `
          <button type="button" class="root-cause-chip ${idx === 0 ? 'selected' : ''}" data-cause="${escapeHtml(rc.label)}" data-default="${rc.defaultGrams}">
            ${rc.label}
          </button>
        `).join('')}
      </div>
      <input type="hidden" id="scrap-cause-hidden" value="${escapeHtml(ROOT_CAUSES[0].label)}" />
    </div>

    <!-- Account to Debit & Operational Details -->
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Debit Ledger Account *</label>
        <select class="form-select" id="scrap-debit-account">
          <option value="">General Workshop Overhead (Unassigned Account)</option>
          ${accounts.map(acc => `
            <option value="${acc.id}">
              ${escapeHtml(acc.name)} (Current Balance: ${formatCurrency(acc.balance)})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Action on Printer / Order</label>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.82rem;padding-top:4px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="scrap-chk-deduct-inv" checked />
            Deduct wasted grams from physical spool inventory
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="scrap-chk-abort-printer" ${initialPrinter && initialPrinter.status === 'printing' ? 'checked' : ''} />
            Reset printer to Ready/Idle (if currently printing)
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="scrap-chk-reprint-flag" />
            Flag Order as 'Requires Reprint' (keep in Production Queue)
          </label>
        </div>
      </div>
    </div>

    <!-- Diagnostic Notes -->
    <div class="form-group">
      <label class="form-label">Operator Diagnostic Notes / Corrective Action</label>
      <textarea class="form-textarea form-input" id="scrap-diagnostic-notes" rows="2" placeholder="e.g. Bed temperature raised to 65C for better adhesion, PEI sheet cleaned with 99.9% IPA..."></textarea>
    </div>

    <!-- Financial Loss Summary Banner -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);">
      <div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Calculated Financial Material Loss</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;" id="disp-scrap-rate-info">
          Rate: ₹${matRate.toFixed(2)}/g • Deducting <span id="disp-scrap-grams">${initialGrams}</span>g from spool
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.25rem;font-weight:800;color:var(--danger);" id="disp-scrap-total-cost">
          ${formatCurrency(initialCost)}
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);">Recorded as Expense (Debit)</div>
      </div>
    </div>
  `;

  showModal({
    title: 'Workshop Scrap & Print Defect Logger',
    body,
    confirmText: 'Record Scrap & Synchronize Ledger',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      const wastedGrams = parseFloat(document.getElementById('scrap-grams-input')?.value) || 0;
      if (wastedGrams <= 0) {
        showToast('Please enter a valid scrap mass (>0 grams)', 'error');
        return;
      }

      const rootCause = document.getElementById('scrap-cause-hidden')?.value || 'Scrap Defect';
      const spoolId = document.getElementById('scrap-spool-select')?.value;
      const printerId = document.getElementById('scrap-source-printer')?.value;
      const orderId = document.getElementById('scrap-linked-order')?.value;
      const accountId = document.getElementById('scrap-debit-account')?.value;
      const notes = document.getElementById('scrap-diagnostic-notes')?.value.trim();
      const deductInv = document.getElementById('scrap-chk-deduct-inv')?.checked;
      const abortPrinter = document.getElementById('scrap-chk-abort-printer')?.checked;
      const flagReprint = document.getElementById('scrap-chk-reprint-flag')?.checked;

      const spool = spoolId ? getById('filaments', spoolId) : null;
      const rate = spool ? (MATERIAL_COST_PER_GRAM[spool.material] || 1.45) : 1.45;
      const totalCost = Math.round(wastedGrams * rate);

      // 1. Spool deduction
      if (deductInv && spool) {
        const curRemaining = spool.remainingGrams != null ? spool.remainingGrams : Math.round((spool.spools || 1) * 1000);
        const newRemaining = Math.max(0, curRemaining - wastedGrams);
        const newSpools = Math.max(0, Number((newRemaining / 1000).toFixed(2)));
        update('filaments', spool.id, {
          remainingGrams: newRemaining,
          spools: newSpools,
        });
      }

      // 2. Create double-entry transaction expense
      const printerObj = printerId && printerId !== 'qc-station' && printerId !== 'purge-station' 
        ? getById('printers', printerId) 
        : null;
      const orderObj = orderId ? getById('orders', orderId) : null;

      const descParts = [`Scrap Loss (${wastedGrams}g)`];
      if (printerObj) descParts.push(`on ${printerObj.name}`);
      else if (printerId === 'qc-station') descParts.push(`at QC Station`);
      else if (printerId === 'purge-station') descParts.push(`Purge Waste`);
      if (orderObj) descParts.push(`for Order #${orderObj.id.slice(0, 6)}`);
      descParts.push(`: ${rootCause}`);

      const txnData = {
        date: formatDate(new Date()),
        description: descParts.join(' '),
        category: 'Other',
        type: 'Expense',
        amount: -totalCost,
        notes: notes || undefined,
        metadata: {
          wastedGrams,
          rootCause,
          printerId: printerObj?.id || null,
          orderId: orderObj?.id || null,
          spoolId: spool?.id || null,
          spoolName: spool?.name || null,
        },
      };

      if (accountId) {
        txnData.accountId = accountId;
        const targetAcc = getById('accounts', accountId);
        if (targetAcc) {
          update('accounts', accountId, {
            balance: (targetAcc.balance || 0) - totalCost,
          });
        }
      }

      create('transactions', txnData);

      // 3. Update Order if linked
      if (orderObj) {
        const curScrapGrams = orderObj.scrapGrams || 0;
        const curScrapCost = orderObj.scrapCost || 0;
        const orderUpdates = {
          scrapGrams: curScrapGrams + wastedGrams,
          scrapCost: curScrapCost + totalCost,
        };
        if (flagReprint) {
          orderUpdates.stage = 'printing';
          orderUpdates.notes = (orderObj.notes ? `${orderObj.notes}\n` : '') + 
            `[${formatDate(new Date())}] ⚠️ Reprint required: ${wastedGrams}g lost to ${rootCause}.`;
        }
        update('orders', orderObj.id, orderUpdates);
      }

      // 4. Reset Printer if abort requested
      if (abortPrinter && printerObj && printerObj.status === 'printing') {
        update('printers', printerObj.id, {
          status: 'idle',
          currentJob: null,
          jobGrams: 0,
          jobProgress: 0,
          elapsedMinutes: 0,
          targetNozzleTemp: 0,
          targetBedTemp: 0,
          orderId: null,
        });
      }

      showToast(`⚠️ Scrap Recorded: ${wastedGrams}g (${formatCurrency(totalCost)}) logged in ledger & spool updated.`, 'warning');
      closeModal();
      if (onComplete) onComplete();
    },
    onReady: () => {
      const gramsInput = document.getElementById('scrap-grams-input');
      const spoolSelect = document.getElementById('scrap-spool-select');
      const dispTotalCost = document.getElementById('disp-scrap-total-cost');
      const dispGrams = document.getElementById('disp-scrap-grams');
      const dispRateInfo = document.getElementById('disp-scrap-rate-info');
      const chips = document.querySelectorAll('#scrap-root-cause-chips .root-cause-chip');
      const hiddenCause = document.getElementById('scrap-cause-hidden');

      function recalculate() {
        const grams = parseFloat(gramsInput?.value) || 0;
        const selectedOption = spoolSelect?.options[spoolSelect.selectedIndex];
        const rate = parseFloat(selectedOption?.dataset?.rate) || 1.45;
        const cost = Math.round(grams * rate);

        if (dispGrams) dispGrams.textContent = grams;
        if (dispTotalCost) dispTotalCost.textContent = formatCurrency(cost);
        if (dispRateInfo) {
          dispRateInfo.innerHTML = `Rate: ₹${rate.toFixed(2)}/g • Deducting <span id="disp-scrap-grams">${grams}</span>g from spool`;
        }
      }

      gramsInput?.addEventListener('input', recalculate);
      spoolSelect?.addEventListener('change', recalculate);

      document.querySelectorAll('.btn-quick-scrap-gram').forEach(btn => {
        btn.addEventListener('click', () => {
          if (gramsInput) {
            gramsInput.value = btn.dataset.grams;
            recalculate();
          }
        });
      });

      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          if (hiddenCause) hiddenCause.value = chip.dataset.cause;
        });
      });
    },
  });
}
