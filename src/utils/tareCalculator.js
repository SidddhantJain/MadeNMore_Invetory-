/**
 * Made N More — Digital Scale Tare Subtraction Utility
 * Eliminates mental math by subtracting empty spool tare from kitchen/digital scale gross weight
 */

import { getAll, getById, update } from '../data/store.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/helpers.js';

export const SPOOL_TARE_PRESETS = [
  { id: 'numakers', name: 'Numakers Polycarbonate Spool', tare: 210, desc: 'Clear/smoke PC spool with hex pattern' },
  { id: 'bambu', name: 'Bambu Lab Reusable Spool', tare: 250, desc: 'Two-piece reusable ABS spool with RFID slot' },
  { id: 'esun', name: 'eSun Clear Plastic Spool', tare: 230, desc: 'Clear solid plastic injection molded spool' },
  { id: 'polymaker', name: 'Polymaker Cardboard Spool', tare: 180, desc: 'Eco-friendly compressed cardboard spool' },
  { id: 'sunlu', name: 'Sunlu / Creality Black Spool', tare: 220, desc: 'Standard solid black plastic spool' },
  { id: 'custom', name: 'Custom Tare Weight', tare: 0, desc: 'Manually specify empty spool weight' },
];

export function openTareCalculatorModal(preselectedFilamentId = null, onUpdated = null) {
  const filaments = getAll('filaments');
  const initialFilament = preselectedFilamentId ? getById('filaments', preselectedFilamentId) : filaments[0];

  const body = `
    <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:var(--radius-md);padding:14px;margin-bottom:var(--space-md);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text-primary);font-size:0.95rem;">
        <span>⚖️ Zero-Touch Digital Scale Tare Subtraction</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin:4px 0 0 0;">
        Weigh your physical spool on any digital kitchen/postage scale. Select the brand preset to subtract the empty spool tare and instantly update your inventory balance.
      </p>
    </div>

    <div class="form-group">
      <label class="form-label">Select Spool from Inventory *</label>
      <select class="form-select" id="tare-filament-select">
        ${filaments.map(f => `
          <option value="${f.id}" ${initialFilament && initialFilament.id === f.id ? 'selected' : ''}>
            ${escapeHtml(f.name)} (${f.material || 'PLA+'}) — Current: ${f.spools || 0} spools (${Math.round((f.spools || 0) * 1000)}g)
          </option>
        `).join('')}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Empty Spool Brand / Tare Preset</label>
        <select class="form-select" id="tare-preset-select">
          ${SPOOL_TARE_PRESETS.map(p => `
            <option value="${p.id}" data-tare="${p.tare}" ${p.id === 'numakers' ? 'selected' : ''}>
              ${escapeHtml(p.name)} (${p.tare > 0 ? p.tare + 'g tare' : 'Manual'})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tare Weight (Grams)</label>
        <input class="form-input" type="number" id="tare-grams-input" value="210" min="0" max="800" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Scale Reading (Gross Weight in Grams) *</label>
      <div style="position:relative;">
        <input class="form-input" type="number" id="tare-gross-input" value="735" min="10" max="3000" step="1" style="font-size:1.2rem;font-weight:700;padding-right:45px;" />
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
        <strong id="disp-tare" style="color:var(--danger);">- 210 g</strong>
      </div>
      <div style="height:1px;background:var(--border);margin:10px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:1rem;font-weight:700;color:var(--text-primary);">Net Filament Remaining:</span>
        <span id="disp-net" style="font-size:1.4rem;font-weight:800;color:var(--success);">525 g</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">
        <span>Fractional Spools: <strong id="disp-spools" style="color:var(--accent);">0.53 spools</strong></span>
        <span id="disp-percent">52.5% full</span>
      </div>
      <div class="order-progress-bar-track" style="height:6px;">
        <div id="disp-bar" class="order-progress-bar-fill" style="width:52.5%;background:var(--accent-gradient);"></div>
      </div>
    </div>
  `;

  showModal({
    title: 'Digital Scale Spool Weighing',
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
        lastWeighed: new Date().toISOString(),
      });

      showToast(`⚖️ ${fil.name} calibrated! Net remaining: ${Math.round(net)}g (${fractionalSpools} spools)`, 'success');
      closeModal();
      if (onUpdated) onUpdated();
    },
  });

  // Wire up live calculation inside the modal
  setTimeout(() => {
    const grossInput = document.getElementById('tare-gross-input');
    const tareInput = document.getElementById('tare-grams-input');
    const presetSelect = document.getElementById('tare-preset-select');

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

      if (dispGross) dispGross.textContent = `${gross} g`;
      if (dispTare) dispTare.textContent = `- ${tare} g`;
      if (dispNet) dispNet.textContent = `${Math.round(net)} g`;
      if (dispSpools) dispSpools.textContent = `${fractionalSpools} spools`;
      if (dispPercent) dispPercent.textContent = `${pct}% full`;
      if (dispBar) dispBar.style.width = `${pct}%`;
    }

    presetSelect?.addEventListener('change', () => {
      const selected = SPOOL_TARE_PRESETS.find(p => p.id === presetSelect.value);
      if (selected && selected.tare > 0 && tareInput) {
        tareInput.value = selected.tare;
      }
      recalc();
    });

    grossInput?.addEventListener('input', recalc);
    tareInput?.addEventListener('input', recalc);
  }, 50);
}
