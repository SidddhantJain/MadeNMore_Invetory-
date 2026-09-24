/**
 * Made N More — Digital Scale Tare Subtraction & Spool Logistics Utility
 * Eliminates mental math by subtracting empty spool tare from kitchen/digital scale gross weight,
 * provides live job feasibility checks, and 1-click 50x30mm thermal sticker calibration printing.
 */

import { getAll, getById, update } from '../data/store.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatCurrency, formatDate } from '../utils/helpers.js';
import { openThermalLabelModal } from '../pages/inventory.js';

export const SPOOL_TARE_PRESETS = [
  { id: 'numakers', name: 'Numakers Polycarbonate Spool', tare: 210, desc: 'Clear/smoke PC spool with hex pattern' },
  { id: 'bambu', name: 'Bambu Lab Reusable Spool', tare: 250, desc: 'Two-piece reusable ABS spool with RFID slot' },
  { id: 'esun', name: 'eSun Clear Plastic Spool', tare: 230, desc: 'Clear solid plastic injection molded spool' },
  { id: 'polymaker', name: 'Polymaker Cardboard Spool', tare: 180, desc: 'Eco-friendly compressed cardboard spool' },
  { id: 'sunlu', name: 'Sunlu / Creality Black Spool', tare: 220, desc: 'Standard solid black plastic spool' },
  { id: 'custom', name: 'Custom Tare Weight', tare: 0, desc: 'Manually specify empty spool weight' },
];

export function detectBrandPreset(filament) {
  if (!filament) return 'numakers';
  const text = ((filament.brand || '') + ' ' + (filament.name || '')).toLowerCase();
  if (text.includes('bambu')) return 'bambu';
  if (text.includes('esun')) return 'esun';
  if (text.includes('polymaker')) return 'polymaker';
  if (text.includes('sunlu') || text.includes('creality')) return 'sunlu';
  return 'numakers';
}

export function openTareCalculatorModal(preselectedFilamentId = null, onUpdated = null) {
  const filaments = getAll('filaments');
  const orders = getAll('orders').filter(o => o.status !== 'completed');
  const initialFilament = preselectedFilamentId ? getById('filaments', preselectedFilamentId) : filaments[0];
  const initialPresetKey = detectBrandPreset(initialFilament);
  const initialPreset = SPOOL_TARE_PRESETS.find(p => p.id === initialPresetKey) || SPOOL_TARE_PRESETS[0];

  const body = `
    <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text-primary);font-size:0.95rem;">
        <span>⚖️ Zero-Touch Digital Scale Tare Subtraction</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 0 0;">
        Place spool on digital kitchen/postage scale. The empty spool tare is automatically subtracted to give 100% verified net usable grams and calculate job yield.
      </p>
    </div>

    <div class="form-group">
      <label class="form-label">Select Spool from Inventory *</label>
      <select class="form-select" id="tare-filament-select">
        ${filaments.map(f => {
          const weighedTag = f.lastWeighed ? ` [Calibrated: ${f.remainingGrams || Math.round(f.spools * 1000)}g]` : '';
          return `
            <option value="${f.id}" ${initialFilament && initialFilament.id === f.id ? 'selected' : ''}>
              ${escapeHtml(f.name)} (${f.material || 'PLA+'}) — Current: ${f.spools || 0} spools (${Math.round((f.spools || 0) * 1000)}g)${weighedTag}
            </option>
          `;
        }).join('')}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Empty Spool Brand / Tare Preset</label>
        <select class="form-select" id="tare-preset-select">
          ${SPOOL_TARE_PRESETS.map(p => `
            <option value="${p.id}" data-tare="${p.tare}" ${p.id === initialPresetKey ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${p.tare > 0 ? p.tare + 'g tare' : 'Manual'})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tare Weight (Grams)</label>
        <input class="form-input" type="number" id="tare-grams-input" value="${initialPreset.tare}" min="0" max="800" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Scale Reading (Gross Weight in Grams) *</label>
      <div style="position:relative;">
        <input class="form-input" type="number" id="tare-gross-input" value="735" min="10" max="3000" step="1" style="font-size:1.25rem;font-weight:700;padding-right:45px;" />
        <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;">g</span>
      </div>
    </div>

    <!-- Live Calculation Display Card -->
    <div id="tare-result-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-top:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.85rem;color:var(--text-secondary);">
        <span>Gross Weight on Scale:</span>
        <strong id="disp-gross" style="color:var(--text-primary);">735 g</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.85rem;color:var(--text-secondary);">
        <span>Empty Spool Tare:</span>
        <strong id="disp-tare" style="color:var(--danger);">- ${initialPreset.tare} g</strong>
      </div>
      <div style="height:1px;background:var(--border);margin:10px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:1rem;font-weight:700;color:var(--text-primary);">Net Filament Remaining:</span>
        <span id="disp-net" style="font-size:1.5rem;font-weight:800;color:var(--success);">${Math.max(0, 735 - initialPreset.tare)} g</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">
        <span>Fractional Spools: <strong id="disp-spools" style="color:var(--accent);">${((735 - initialPreset.tare) / 1000).toFixed(2)} spools</strong></span>
        <span id="disp-percent">${Math.round(((735 - initialPreset.tare) / 1000) * 100)}% full</span>
      </div>
      <div class="order-progress-bar-track" style="height:6px;">
        <div id="disp-bar" class="order-progress-bar-fill" style="width:${Math.round(((735 - initialPreset.tare) / 1000) * 100)}%;background:var(--accent-gradient);"></div>
      </div>
    </div>

    <!-- Job Feasibility & Yield Estimator -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-top:14px;">
      <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span>🎯 Job Feasibility & Parts Yield Calculator</span>
        <span class="badge" style="background:rgba(6,182,212,0.15);color:#06b6d4;font-size:0.68rem;">Prevent Mid-Print Runout</span>
      </div>
      
      <div class="form-row">
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:0.75rem;">Check Against Active Order</label>
          <select class="form-select form-select-sm" id="tare-order-select">
            <option value="">-- Choose Order or Enter Custom Grams --</option>
            ${orders.map(o => {
              const grams = (o.weight || 120) * (o.quantity || 1);
              return `<option value="${o.id}" data-grams="${grams}">${escapeHtml(o.clientName)} (#${o.id.slice(0,6)}) — ${grams}g total</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" style="font-size:0.75rem;">Target Part Mass (Grams)</label>
          <input class="form-input form-input-sm" type="number" id="tare-target-grams" value="120" min="1" step="1" />
        </div>
      </div>

      <div id="tare-feasibility-badge" style="padding:10px;border-radius:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);font-size:0.82rem;color:#4ade80;">
        ✓ Loading feasibility...
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:14px;">
      <button type="button" class="btn btn-secondary btn-sm flex-1" id="btn-tare-print-sticker">
        🏷️ Print 50x30mm Calibrated Label
      </button>
    </div>
  `;

  showModal({
    title: 'Digital Scale Spool Weighing & Tare Calibration',
    body,
    confirmText: '✓ Update Spool Balance in Inventory',
    confirmClass: 'btn-primary',
    onConfirm: () => {
      const filId = document.getElementById('tare-filament-select')?.value;
      const gross = parseFloat(document.getElementById('tare-gross-input')?.value) || 0;
      const tare = parseFloat(document.getElementById('tare-grams-input')?.value) || 0;
      const net = Math.max(0, gross - tare);
      const fractionalSpools = Number((net / 1000).toFixed(2));

      if (!filId) {
        showToast('Please select a filament', 'error');
        return;
      }

      const fil = getById('filaments', filId);
      if (!fil) return;

      update('filaments', filId, {
        spools: fractionalSpools,
        remainingGrams: Math.round(net),
        tareWeight: Math.round(tare),
        lastWeighed: new Date().toISOString(),
      });

      showToast(`⚖️ ${fil.name} calibrated! Net remaining: ${Math.round(net)}g (${fractionalSpools} spools)`, 'success');
      closeModal();
      if (onUpdated) onUpdated();
    },
  });

  // Wire up live calculation inside the modal
  setTimeout(() => {
    const filSelect = document.getElementById('tare-filament-select');
    const grossInput = document.getElementById('tare-gross-input');
    const tareInput = document.getElementById('tare-grams-input');
    const presetSelect = document.getElementById('tare-preset-select');
    const orderSelect = document.getElementById('tare-order-select');
    const targetGramsInput = document.getElementById('tare-target-grams');
    const printStickerBtn = document.getElementById('btn-tare-print-sticker');

    function recalc() {
      const gross = parseFloat(grossInput?.value) || 0;
      const tare = parseFloat(tareInput?.value) || 0;
      const net = Math.max(0, gross - tare);
      const fractionalSpools = Number((net / 1000).toFixed(2));
      const pct = Math.min(100, Math.round((net / 1000) * 100));

      const dispGross = document.getElementById('disp-gross');
      const dispTare = document.getElementById('disp-tare');
      const dispNet = document.getElementById('disp-net');
      const dispSpools = document.getElementById('disp-spools');
      const dispPercent = document.getElementById('disp-percent');
      const dispBar = document.getElementById('disp-bar');
      const feasibilityBadge = document.getElementById('tare-feasibility-badge');

      if (dispGross) dispGross.textContent = `${gross} g`;
      if (dispTare) dispTare.textContent = `- ${tare} g`;
      if (dispNet) dispNet.textContent = `${Math.round(net)} g`;
      if (dispSpools) dispSpools.textContent = `${fractionalSpools} spools`;
      if (dispPercent) dispPercent.textContent = `${pct}% full`;
      if (dispBar) dispBar.style.width = `${pct}%`;

      // Feasibility calculation
      const targetGrams = parseFloat(targetGramsInput?.value) || 1;
      const partsYield = Math.floor(net / targetGrams);
      const marginGrams = Math.round(net - targetGrams);

      if (feasibilityBadge) {
        if (net <= 0) {
          feasibilityBadge.style.background = 'rgba(239,68,68,0.1)';
          feasibilityBadge.style.borderColor = 'rgba(239,68,68,0.3)';
          feasibilityBadge.style.color = '#f87171';
          feasibilityBadge.innerHTML = '❌ <strong>Empty Spool:</strong> 0g usable filament remaining.';
        } else if (net < targetGrams) {
          feasibilityBadge.style.background = 'rgba(239,68,68,0.1)';
          feasibilityBadge.style.borderColor = 'rgba(239,68,68,0.3)';
          feasibilityBadge.style.color = '#f87171';
          feasibilityBadge.innerHTML = `⚠️ <strong>Insufficient Filament:</strong> Needs ${targetGrams}g, but only ${Math.round(net)}g available (Short by ${Math.abs(marginGrams)}g). Will fail mid-print!`;
        } else {
          feasibilityBadge.style.background = 'rgba(34,197,94,0.1)';
          feasibilityBadge.style.borderColor = 'rgba(34,197,94,0.3)';
          feasibilityBadge.style.color = '#4ade80';
          feasibilityBadge.innerHTML = `✅ <strong>Sufficient Filament:</strong> ${Math.round(net)}g available vs ${targetGrams}g required (+${marginGrams}g buffer). <strong>Max Yield: ${partsYield} part${partsYield !== 1 ? 's' : ''}</strong>.`;
        }
      }
    }

    // Auto-brand detection when picking filament
    filSelect?.addEventListener('change', () => {
      const fil = getById('filaments', filSelect.value);
      if (fil) {
        const brandKey = detectBrandPreset(fil);
        if (presetSelect) presetSelect.value = brandKey;
        const preset = SPOOL_TARE_PRESETS.find(p => p.id === brandKey);
        if (preset && preset.tare > 0 && tareInput) {
          tareInput.value = preset.tare;
        }
      }
      recalc();
    });

    presetSelect?.addEventListener('change', () => {
      const selected = SPOOL_TARE_PRESETS.find(p => p.id === presetSelect.value);
      if (selected && selected.tare > 0 && tareInput) {
        tareInput.value = selected.tare;
      }
      recalc();
    });

    orderSelect?.addEventListener('change', () => {
      const opt = orderSelect.options[orderSelect.selectedIndex];
      const g = parseFloat(opt?.dataset.grams);
      if (g && targetGramsInput) {
        targetGramsInput.value = g;
        recalc();
      }
    });

    targetGramsInput?.addEventListener('input', recalc);
    grossInput?.addEventListener('input', recalc);
    tareInput?.addEventListener('input', recalc);

    printStickerBtn?.addEventListener('click', () => {
      const filId = filSelect?.value;
      const fil = filId ? getById('filaments', filId) : null;
      if (!fil) return;
      const gross = parseFloat(grossInput?.value) || 0;
      const tare = parseFloat(tareInput?.value) || 0;
      const net = Math.max(0, gross - tare);

      // Open calibrated thermal label modal
      openThermalLabelModal({
        ...fil,
        remainingGrams: Math.round(net),
        tareWeight: Math.round(tare),
        lastWeighed: new Date().toISOString(),
      });
    });

    recalc();
  }, 50);
}
