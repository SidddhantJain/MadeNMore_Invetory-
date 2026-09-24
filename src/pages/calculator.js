/**
 * Made N More — Cost Calculator, STL Mesh Slicer & OrcaSlicer Integration
 * Features:
 * - Drag & drop G-Code, 3MF, and raw 3D STL models
 * - In-browser mathematical STL volume & mass calculation with interactive infill adjuster
 * - Direct OrcaSlicer integration (D:\software\OrcaSlicer\orca-slicer.exe) with 1-click batch launcher
 * - 1-click WhatsApp quote generator & instant Kanban order creation
 */

import { getSettings, create } from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, escapeHtml } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showToast } from '../components/toast.js';
import { readSlicerFile, parseSTLGeometry, generateOrcaSlicerLauncher, ORCA_SLICER_PATH } from '../utils/slicerParser.js';

let _lastCalculated = {
  partName: 'Custom 3D Print Part',
  material: 'PLA+',
  weight: 50,
  timeHours: 2,
  totalCost: 0,
  suggestedPrice: 0,
  profit: 0,
};

let _currentSTLBuffer = null;
let _currentInfill = 20;

export function renderCalculator(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Print Cost, 3D Mesh Slicer & OrcaSlicer</h1>
        <p class="text-secondary">Drag & drop 3D STLs or sliced G-Code, estimate production costs & launch directly into OrcaSlicer</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-launch-orcaslicer" title="Open OrcaSlicer executable">
          <span style="font-size:1.05rem;">🚀</span>
          Open in OrcaSlicer
        </button>
      </div>
    </div>

    <!-- Slicer & STL Ingestion Drop Zone -->
    <div class="slicer-drop-zone animate-in" id="slicer-drop-zone">
      <input type="file" id="slicer-file-input" accept=".stl,.gcode,.3mf,.txt" style="display:none;" />
      <div style="font-size:2rem;margin-bottom:6px;">📐</div>
      <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">
        Drop 3D STL, G-Code or 3MF File Here
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">
        Automatic 3D mesh volume integration & mass calculation for <strong>.stl</strong> • Metadata extraction from <strong>OrcaSlicer</strong>, <strong>Bambu Studio</strong> & <strong>Cura</strong>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-browse-slicer" style="margin-top:12px;">
        Browse 3D Model / Sliced File
      </button>
    </div>

    <!-- Parsed / 3D Mesh Banner -->
    <div id="slicer-parsed-banner" style="display:none;margin-bottom:var(--space-md);background:var(--success-bg);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-md);padding:12px 16px;color:var(--success);font-size:0.86rem;">
    </div>

    <!-- Interactive STL Infill Adjustment Bar (Shown when an STL is loaded) -->
    <div id="stl-infill-selector-row" style="display:none;margin-bottom:var(--space-md);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <span style="font-weight:700;color:var(--text-primary);">Interactive Infill Density:</span>
          <span style="font-size:0.82rem;color:var(--text-secondary);margin-left:8px;">Recalculates mass & print hours dynamically</span>
        </div>
        <div class="filter-pills" style="margin:0;">
          <button class="filter-pill btn-infill-preset" data-infill="15">15% (Light)</button>
          <button class="filter-pill btn-infill-preset active" data-infill="20">20% (Standard)</button>
          <button class="filter-pill btn-infill-preset" data-infill="35">35% (Functional)</button>
          <button class="filter-pill btn-infill-preset" data-infill="60">60% (High Strength)</button>
          <button class="filter-pill btn-infill-preset" data-infill="100">100% (Solid)</button>
        </div>
      </div>
    </div>

    <div class="calc-layout animate-in animate-delay-1">
      <!-- Input Side -->
      <div class="card">
        <h3 style="margin-bottom:var(--space-lg);">Print & Material Parameters</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Part Name / Ref</label>
            <input class="form-input" id="calc-part-name" placeholder="e.g. Custom Drone Mount" value="Custom 3D Print Part" />
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
            <label class="form-label">Print Weight (grams) *</label>
            <input class="form-input" type="number" id="calc-weight" min="0" step="0.1" value="50" placeholder="e.g. 50" />
          </div>
          <div class="form-group">
            <label class="form-label">Filament Cost (₹/kg)</label>
            <input class="form-input" type="number" id="calc-cost-per-kg" min="0" step="10" value="${settings.materialCosts['PLA+'] || 700}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Print Time (hours) *</label>
            <input class="form-input" type="number" id="calc-time" min="0" step="0.25" value="2" placeholder="e.g. 2" />
          </div>
          <div class="form-group">
            <label class="form-label">Electricity Rate (₹/kWh)</label>
            <input class="form-input" type="number" id="calc-elec-rate" min="0" step="0.5" value="${settings.electricityRate || 8.5}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Printer Power (Watts)</label>
            <input class="form-input" type="number" id="calc-power" min="0" step="10" value="${settings.printerPower || 350}" />
          </div>
          <div class="form-group">
            <label class="form-label">Failure Buffer (%)</label>
            <input class="form-input" type="number" id="calc-waste" min="0" max="100" step="1" value="5" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Markup / Profit Margin (%)</label>
          <input class="form-input" type="number" id="calc-markup" min="0" max="500" step="5" value="${settings.defaultMarkup || 30}" />
          <div style="margin-top:8px;height:6px;border-radius:3px;background:rgba(255,255,255,0.05);overflow:hidden;">
            <div id="calc-markup-bar" style="height:100%;width:${settings.defaultMarkup || 30}%;background:var(--accent-gradient);border-radius:3px;transition:width 0.3s ease;"></div>
          </div>
        </div>

        <!-- OrcaSlicer Hardware Integration Box -->
        <div style="margin-top:var(--space-md);background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:0.88rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span style="color:#06b6d4;">⚙️</span> OrcaSlicer Fleet Bridge
            </span>
            <span class="badge" style="background:rgba(34, 197, 94, 0.1);color:#4ade80;font-size:0.7rem;">Installed</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
            Target binary: <code>${ORCA_SLICER_PATH}</code>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" id="btn-orca-launcher-download" style="font-size:0.78rem;">
              📥 1-Click Launch Script (.bat)
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-copy-orca-cmd" style="font-size:0.78rem;">
              📋 Copy Command
            </button>
          </div>
        </div>
      </div>

      <!-- Results Side -->
      <div>
        <div class="card calc-result-card" style="margin-bottom:var(--space-md);">
          <h3 style="margin-bottom:var(--space-md);">Cost & Quote Output</h3>

          <div id="calc-results">
            <!-- Filled by JS -->
          </div>

          <!-- Quick WhatsApp Quote & Order Dispatch Tools -->
          <div style="margin-top:var(--space-lg);padding-top:var(--space-md);border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-primary w-full" id="btn-copy-wa-quote">
              📋 Copy WhatsApp Quote for Client
            </button>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary flex-1" id="btn-open-wa">
                💬 Open WhatsApp Web
              </button>
              <button class="btn btn-ghost flex-1" id="btn-save-as-order" style="color:var(--accent);">
                🚀 Save as Order
              </button>
            </div>
          </div>
        </div>

        <!-- Tiered Volume Commercial Discount Matrix -->
        <div class="card" style="margin-bottom:var(--space-md);">
          <div class="card-header" style="padding-bottom:10px;">
            <div>
              <span class="card-title" style="font-size:0.95rem;">📊 Wholesale & Batch Volume Tiers</span>
              <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">Automated scale discount matrix for client quotations</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-copy-tiered-pricing" style="font-size:0.75rem;">
              📋 Copy Tier Table
            </button>
          </div>

          <table class="tier-pricing-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Discount</th>
                <th>Unit Price</th>
                <th>Batch Total</th>
                <th>Lead Time</th>
              </tr>
            </thead>
            <tbody id="tier-pricing-tbody">
              <!-- Filled dynamically by calculate() -->
            </tbody>
          </table>
        </div>

        <!-- Material Costs Reference -->
        <div class="card">
          <h3 style="margin-bottom:var(--space-md);">Material Costs Reference</h3>
          <div style="font-size:0.85rem;">
            ${Object.entries(settings.materialCosts || {}).map(([mat, cost]) => `
              <div class="calc-result-row">
                <span class="label">${mat}</span>
                <span class="value">${formatCurrency(cost)}/kg</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind live calculation
  const inputs = ['calc-weight', 'calc-cost-per-kg', 'calc-time', 'calc-elec-rate', 'calc-power', 'calc-markup', 'calc-waste', 'calc-part-name'];
  inputs.forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('input', () => calculate(container));
  });

  // Material change
  container.querySelector('#calc-material')?.addEventListener('change', (e) => {
    const mat = e.target.value;
    const cost = settings.materialCosts[mat] || 700;
    const costInput = container.querySelector('#calc-cost-per-kg');
    if (costInput) costInput.value = cost;

    // If we have an STL loaded, recompute for the new material's density
    if (_currentSTLBuffer) {
      recomputeSTL(container);
    } else {
      calculate(container);
    }
  });

  // Markup bar
  container.querySelector('#calc-markup')?.addEventListener('input', (e) => {
    const bar = container.querySelector('#calc-markup-bar');
    if (bar) bar.style.width = `${Math.min(e.target.value, 100)}%`;
  });

  // OrcaSlicer Launcher Buttons
  container.querySelector('#btn-launch-orcaslicer')?.addEventListener('click', () => {
    generateOrcaSlicerLauncher(_lastCalculated.partName);
    showToast('Downloaded 1-click launcher! Run to open OrcaSlicer directly.', 'success');
  });

  container.querySelector('#btn-orca-launcher-download')?.addEventListener('click', () => {
    generateOrcaSlicerLauncher(_lastCalculated.partName);
    showToast('Downloaded Open_in_OrcaSlicer.bat', 'success');
  });

  container.querySelector('#btn-copy-orca-cmd')?.addEventListener('click', () => {
    const cmd = `start "" "${ORCA_SLICER_PATH}"`;
    navigator.clipboard.writeText(cmd).then(() => {
      showToast('Copied OrcaSlicer command to clipboard!', 'success');
    });
  });

  // Infill presets for loaded STL
  container.querySelectorAll('.btn-infill-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.btn-infill-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentInfill = parseInt(btn.dataset.infill) || 20;
      if (_currentSTLBuffer) recomputeSTL(container);
    });
  });

  // Slicer File Drop & Browse Listeners
  setupSlicerFileHandlers(container);

  // WhatsApp Tools Listeners
  setupWhatsAppTools(container);

  // Initial calculation
  calculate(container);
}

function recomputeSTL(container) {
  if (!_currentSTLBuffer) return;
  const mat = container.querySelector('#calc-material')?.value || 'PLA+';
  const geo = parseSTLGeometry(_currentSTLBuffer, mat, _currentInfill);

  const weightInput = container.querySelector('#calc-weight');
  if (weightInput) weightInput.value = geo.estimatedGrams;

  const timeInput = container.querySelector('#calc-time');
  if (timeInput) timeInput.value = geo.estimatedHours;

  const banner = container.querySelector('#slicer-parsed-banner');
  if (banner) {
    banner.innerHTML = `
      <strong>✓ 3D Mesh Geometry Computed:</strong> ${_lastCalculated.partName}
      <div style="margin-top:4px;font-size:0.8rem;color:#4ade80;">
        Volume: <strong>${geo.volumeCm3} cm³</strong> • ${geo.triangleCount.toLocaleString()} Triangles • 
        Infill: <strong>${_currentInfill}%</strong> • Estimated Mass: <strong>${geo.estimatedGrams}g</strong> • Print Time: <strong>${geo.estimatedHours}h</strong>
      </div>
    `;
  }

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
  const mat = container.querySelector('#calc-material')?.value || 'PLA+';

  // Calculations
  const materialCost = (weight / 1000) * costPerKg;
  const wasteCost = materialCost * (waste / 100);
  const electricityCost = (time * (power / 1000)) * elecRate;
  const machineWear = time * 25; // ₹25/hr depreciation & maintenance reserve
  const totalCost = materialCost + wasteCost + electricityCost + machineWear;
  const suggestedPrice = Math.round(totalCost * (1 + markup / 100));
  const profit = suggestedPrice - totalCost;

  _lastCalculated = {
    partName: container.querySelector('#calc-part-name')?.value || 'Custom 3D Print Part',
    material: mat,
    weight,
    timeHours: time,
    totalCost,
    suggestedPrice,
    profit,
  };

  const resultsEl = container.querySelector('#calc-results');
  if (resultsEl) {
    resultsEl.innerHTML = `
      <div class="calc-result-row">
        <span class="label">Material Cost (${weight}g ${mat})</span>
        <span class="value">${formatCurrency(materialCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Failure Buffer (${waste}%)</span>
        <span class="value">${formatCurrency(wasteCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Electricity (${time}h @ ₹${elecRate})</span>
        <span class="value">${formatCurrency(electricityCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Machine Wear & Maintenance (₹25/h)</span>
        <span class="value">${formatCurrency(machineWear)}</span>
      </div>
      <div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
        <span class="label" style="font-weight:600;">Total Production Cost</span>
        <span class="value">${formatCurrency(totalCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Commercial Margin (${markup}%)</span>
        <span class="value text-success">+${formatCurrency(profit)}</span>
      </div>
      <div class="calc-result-row calc-total-row" style="margin-top:10px;background:rgba(139,92,246,0.1);padding:10px 14px;border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.25);">
        <span class="label" style="font-size:1.05rem;font-weight:700;">Recommended Quote Price</span>
        <span class="value" style="font-size:1.3rem;font-weight:800;color:#fff;">${formatCurrency(suggestedPrice)}</span>
      </div>
    `;
  }

  // Populate Tier Pricing Table
  const tierTbody = container.querySelector('#tier-pricing-tbody');
  const tiers = [
    { qty: 1, discount: 0, label: 'Standard', lead: `${Math.max(1, Math.ceil(time / 8))}d` },
    { qty: 5, discount: 8, label: 'Batch 5', lead: `${Math.max(1, Math.ceil((time * 5) / 16))}d` },
    { qty: 10, discount: 15, label: 'Small Run', lead: `${Math.max(2, Math.ceil((time * 10) / 20))}d` },
    { qty: 25, discount: 22, label: 'Commercial', lead: `${Math.max(3, Math.ceil((time * 25) / 24))}d` },
    { qty: 50, discount: 28, label: 'Production', lead: `${Math.max(4, Math.ceil((time * 50) / 24))}d` },
    { qty: 100, discount: 35, label: 'Wholesale', lead: `${Math.max(6, Math.ceil((time * 100) / 24))}d` },
  ];

  if (tierTbody) {
    tierTbody.innerHTML = tiers.map(t => {
      const uPrice = Math.round(suggestedPrice * (1 - t.discount / 100));
      const bTotal = uPrice * t.qty;
      return `
        <tr>
          <td style="font-weight:700;">${t.qty} pcs</td>
          <td>${t.discount === 0 ? '<span style="color:var(--text-muted);font-size:0.75rem;">Base</span>' : `<span class="tier-badge">-${t.discount}%</span>`}</td>
          <td style="font-weight:600;font-family:var(--font-mono);">${formatCurrency(uPrice)}</td>
          <td style="font-weight:700;color:#fff;font-family:var(--font-mono);">${formatCurrency(bTotal)}</td>
          <td style="font-size:0.75rem;color:var(--text-secondary);">${t.lead}</td>
        </tr>
      `;
    }).join('');
  }

  // Rebind Tier Pricing Copy button
  const copyTierBtn = container.querySelector('#btn-copy-tiered-pricing');
  if (copyTierBtn) {
    copyTierBtn.onclick = () => {
      let text = `*Made N More 3D Printing — Commercial Volume Matrix*\n` +
        `📦 *Item:* ${_lastCalculated.partName} (${_lastCalculated.material}, ${_lastCalculated.weight}g)\n` +
        `──────────────────────────\n`;

      tiers.forEach(t => {
        const uP = Math.round(_lastCalculated.suggestedPrice * (1 - t.discount / 100));
        const tot = uP * t.qty;
        const discStr = t.discount > 0 ? ` [${t.discount}% OFF]` : ` [Standard]`;
        text += `• *${t.qty} pcs:* ${formatCurrency(uP)}/pc → *${formatCurrency(tot)}* total${discStr} (${t.lead})\n`;
      });

      text += `──────────────────────────\n_Precision Manufactured at Made N More Labs_`;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied Commercial Tier Pricing to clipboard!', 'success');
      });
    };
  }
}

// ─── G-Code, 3MF & STL File Ingestion ────────────────────────
function setupSlicerFileHandlers(container) {
  const dropZone = container.querySelector('#slicer-drop-zone');
  const fileInput = container.querySelector('#slicer-file-input');
  const browseBtn = container.querySelector('#btn-browse-slicer');

  browseBtn?.addEventListener('click', () => fileInput?.click());
  dropZone?.addEventListener('click', (e) => {
    if (e.target !== browseBtn) fileInput?.click();
  });

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-active');
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) parseSlicerFile(files[0], container);
  });

  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) parseSlicerFile(files[0], container);
  });
}

function parseSlicerFile(file, container) {
  const isSTL = file.name.toLowerCase().endsWith('.stl');

  if (isSTL) {
    const reader = new FileReader();
    reader.onload = (e) => {
      _currentSTLBuffer = e.target.result;
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const partNameInput = container.querySelector('#calc-part-name');
      if (partNameInput) partNameInput.value = cleanFileName;

      // Display infill row
      const infillRow = container.querySelector('#stl-infill-selector-row');
      if (infillRow) infillRow.style.display = 'block';

      // Banner display
      const banner = container.querySelector('#slicer-parsed-banner');
      if (banner) banner.style.display = 'block';

      recomputeSTL(container);
      showToast(`Analyzed 3D mesh: ${file.name}`, 'success');
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  // Regular G-code / 3MF metadata parser
  readSlicerFile(file, (err, parsed) => {
    if (err) {
      showToast('Error reading slicer file', 'error');
      return;
    }

    _currentSTLBuffer = null;
    const infillRow = container.querySelector('#stl-infill-selector-row');
    if (infillRow) infillRow.style.display = 'none';

    if (parsed.grams > 0 || parsed.seconds > 0) {
      if (parsed.grams > 0) {
        const weightInput = container.querySelector('#calc-weight');
        if (weightInput) weightInput.value = parsed.grams;
      }

      if (parsed.durationHours > 0) {
        const timeInput = container.querySelector('#calc-time');
        if (timeInput) timeInput.value = parsed.durationHours;
      }

      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      const partNameInput = container.querySelector('#calc-part-name');
      if (partNameInput) partNameInput.value = cleanFileName;

      // Banner display
      const banner = container.querySelector('#slicer-parsed-banner');
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `
          <strong>✓ Slicer File Successfully Parsed:</strong> ${escapeHtml(file.name)} 
          <div style="margin-top:3px;font-size:0.8rem;color:#4ade80;">
            Mass: <strong>${parsed.grams}g</strong> • Print Time: <strong>${parsed.durationHours} hours</strong>
          </div>
        `;
      }

      showToast(`Parsed: ${parsed.grams}g / ${parsed.durationHours}h from ${file.name}`, 'success');
      calculate(container);
    } else {
      showToast('Could not find slicer comment metadata. Using standard manual parameters.', 'info');
    }
  });
}

// ─── WhatsApp Quote & Order Creation ─────────────────────────
function setupWhatsAppTools(container) {
  function getWhatsAppQuoteMessage() {
    return (
      `🖨️ *Made N More | 3D Printing Labs — Job Quote*\n` +
      `-----------------------------------------\n` +
      `*Part/Project:* ${_lastCalculated.partName}\n` +
      `*Material:* ${_lastCalculated.material} (Industrial Grade)\n` +
      `*Estimated Mass:* ${_lastCalculated.weight}g\n` +
      `*Production Time:* ${_lastCalculated.timeHours} hrs\n` +
      `*Manufacturing Tolerance:* ±0.2mm (Industrial FDM)\n\n` +
      `💰 *Total Quote:* ${formatCurrency(_lastCalculated.suggestedPrice)} (All-inclusive)\n` +
      `📦 *Standard Milestone Terms:*\n` +
      `• 30% Advance deposit to lock machine queue\n` +
      `• Balance upon high-res photo proof & dispatch\n\n` +
      `_Reply to confirm and initiate production._`
    );
  }

  container.querySelector('#btn-copy-wa-quote')?.addEventListener('click', () => {
    const text = getWhatsAppQuoteMessage();
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 WhatsApp quote copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Copied to clipboard', 'info');
    });
  });

  container.querySelector('#btn-open-wa')?.addEventListener('click', () => {
    const text = encodeURIComponent(getWhatsAppQuoteMessage());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  });

  container.querySelector('#btn-save-as-order')?.addEventListener('click', () => {
    create('orders', {
      clientName: 'New Client Enquiry',
      description: _lastCalculated.partName,
      totalAmount: _lastCalculated.suggestedPrice,
      status: 'quote',
      kanbanStage: 'quote',
      priority: 'standard',
      items: [
        {
          name: _lastCalculated.partName,
          material: _lastCalculated.material,
          quantity: 1,
          unitPrice: _lastCalculated.suggestedPrice,
          subtotal: _lastCalculated.suggestedPrice,
        }
      ],
      payments: [],
      notes: `Estimated from Slicer/Calculator: ${_lastCalculated.weight}g, ${_lastCalculated.timeHours} hrs.`,
    });

    showToast(`Order created! Check the Orders Kanban board.`, 'success');
    window.location.hash = '#/orders';
  });
}
