/**
 * Made N More — Cost Calculator, STL Mesh Slicer & ERP Job Costing Engine
 * Features:
 * - Drag & drop G-Code, 3MF, and raw 3D STL models
 * - In-browser mathematical STL volume & mass calculation with interactive infill adjuster
 * - Direct OrcaSlicer integration (D:\software\OrcaSlicer\orca-slicer.exe) with 1-click batch launcher
 * - Standardized ERP Cost Breakdown: Material, Power, Machine Wear, Packaging, Shipping, CAD Fee
 * - Dynamic Profit Margin % calculation: ((Selling Price - Total Cost) / Selling Price) * 100
 * - 1-click Lead CRM quote generator & instant Kanban order creation
 */

import { getSettings, create, calculateJobCosting } from '../data/store.js';
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
  materialCost: 0,
  electricityCost: 0,
  machineWear: 0,
  packaging: 0,
  shipping: 0,
  cadFee: 0,
  totalCost: 0,
  suggestedPrice: 0,
  sellingPrice: 0,
  profit: 0,
  profitMarginPct: 0
};

let _currentSTLBuffer = null;
let _currentInfill = 20;

export function renderCalculator(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Print Cost, 3D Mesh Slicer & ERP Matrix</h1>
        <p class="text-secondary">Estimate production costs, calculate live profit margins, and launch directly into OrcaSlicer or CRM</p>
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
        <h3 style="margin-bottom:var(--space-lg);">Print & Job Costing Parameters</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Part / Reference Name</label>
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
            <input class="form-input" type="number" id="calc-cost-per-kg" min="0" step="10" value="${(settings.materialCosts && settings.materialCosts['PLA+']) || 900}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Print Time (hours) *</label>
            <input class="form-input" type="number" id="calc-time" min="0" step="0.25" value="2" placeholder="e.g. 2" />
          </div>
          <div class="form-group">
            <label class="form-label">Electricity Tariff (₹/kWh)</label>
            <input class="form-input" type="number" id="calc-elec-rate" min="0" step="0.5" value="${settings.electricityRate || 8.5}" />
          </div>
        </div>

        <!-- ERP Overheads Breakdown (Packaging, Courier, CAD) -->
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin:12px 0;">
          <div style="font-weight:700;font-size:0.85rem;color:var(--text-primary);margin-bottom:8px;">
            📦 ERP Fulfillment & Pre-Flight Overheads
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">Packaging & Box (₹)</label>
              <input class="form-input" type="number" id="calc-pkg" value="40" step="5" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">Shipping / Courier (₹)</label>
              <input class="form-input" type="number" id="calc-ship" value="100" step="10" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:0.75rem;">CAD / Design Fee (₹)</label>
              <input class="form-input" type="number" id="calc-cad" value="0" step="50" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Printer Power (Watts)</label>
            <input class="form-input" type="number" id="calc-power" min="0" step="10" value="${settings.printerPower || 350}" />
          </div>
          <div class="form-group">
            <label class="form-label">Markup Multiplier (%)</label>
            <input class="form-input" type="number" id="calc-markup" min="0" max="500" step="5" value="${settings.defaultMarkup || 150}" />
          </div>
        </div>

        <!-- Custom Target Selling Price Override -->
        <div class="form-group">
          <label class="form-label">Client Selling Price (₹) <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:normal;">(Leave empty for auto-calculated)</span></label>
          <input class="form-input" type="number" id="calc-custom-selling-price" placeholder="Auto-calculated from cost + markup" />
        </div>

        <!-- OrcaSlicer Hardware Integration Box -->
        <div style="margin-top:var(--space-md);background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;font-size:0.88rem;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span style="color:#06b6d4;">⚙️</span> OrcaSlicer Fleet Bridge
            </span>
            <span class="badge" style="background:rgba(34, 197, 94, 0.1);color:#4ade80;font-size:0.7rem;">Ready</span>
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
          <h3 style="margin-bottom:var(--space-md);">Cost Breakdown & ERP Margin</h3>

          <div id="calc-results">
            <!-- Filled by JS -->
          </div>

          <!-- Quick WhatsApp Quote, CRM Lead & Order Dispatch Tools -->
          <div style="margin-top:var(--space-lg);padding-top:var(--space-md);border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-primary w-full" id="btn-copy-wa-quote">
              📋 Copy WhatsApp Quote for Client
            </button>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary flex-1" id="btn-save-as-lead" style="color:#38bdf8;">
                ✨ Save as CRM Lead
              </button>
              <button class="btn btn-ghost flex-1" id="btn-save-as-order" style="color:#4ade80;">
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
      </div>
    </div>
  `;

  // Bind live calculation
  const inputs = ['calc-weight', 'calc-cost-per-kg', 'calc-time', 'calc-elec-rate', 'calc-power', 'calc-markup', 'calc-part-name', 'calc-pkg', 'calc-ship', 'calc-cad', 'calc-custom-selling-price'];
  inputs.forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('input', () => calculate(container));
  });

  // Material change
  container.querySelector('#calc-material')?.addEventListener('change', (e) => {
    const mat = e.target.value;
    const cost = (settings.materialCosts && settings.materialCosts[mat]) || 900;
    const costInput = container.querySelector('#calc-cost-per-kg');
    if (costInput) costInput.value = cost;

    if (_currentSTLBuffer) {
      recomputeSTL(container);
    } else {
      calculate(container);
    }
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
      _currentInfill = parseInt(btn.dataset.infill, 10) || 20;
      if (_currentSTLBuffer) recomputeSTL(container);
    });
  });

  // Slicer File Drop & Browse Listeners
  setupSlicerFileHandlers(container);

  // WhatsApp & Save Tools Listeners
  setupActionTools(container);

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
  const elecRate = parseFloat(container.querySelector('#calc-elec-rate')?.value) || 8.5;
  const power = parseFloat(container.querySelector('#calc-power')?.value) || 350;
  const markup = parseFloat(container.querySelector('#calc-markup')?.value) || 150;
  const mat = container.querySelector('#calc-material')?.value || 'PLA+';

  const pkg = parseFloat(container.querySelector('#calc-pkg')?.value) || 0;
  const ship = parseFloat(container.querySelector('#calc-ship')?.value) || 0;
  const cad = parseFloat(container.querySelector('#calc-cad')?.value) || 0;
  const customSellingPriceStr = container.querySelector('#calc-custom-selling-price')?.value;

  const res = calculateJobCosting({
    material: mat,
    weightGrams: weight,
    printHours: time,
    powerWatts: power,
    electricityRate: elecRate,
    packaging: pkg,
    shipping: ship,
    cadFee: cad,
    markup,
    sellingPrice: customSellingPriceStr !== '' && customSellingPriceStr !== undefined ? parseFloat(customSellingPriceStr) : undefined
  });

  _lastCalculated = {
    partName: container.querySelector('#calc-part-name')?.value || 'Custom 3D Print Part',
    ...res
  };

  const resultsEl = container.querySelector('#calc-results');
  if (resultsEl) {
    resultsEl.innerHTML = `
      <div class="calc-result-row">
        <span class="label">Material (${res.weightGrams}g ${res.material})</span>
        <span class="value">${formatCurrency(res.materialCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Power (${res.printHours}h @ ₹${elecRate})</span>
        <span class="value">${formatCurrency(res.electricityCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Machine Wear & Sinking Fund</span>
        <span class="value">${formatCurrency(res.machineWear)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Packaging & Fulfillment</span>
        <span class="value">${formatCurrency(res.packaging)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Courier / Shipping</span>
        <span class="value">${formatCurrency(res.shipping)}</span>
      </div>
      ${res.cadFee > 0 ? `
        <div class="calc-result-row">
          <span class="label">CAD / Pre-flight Fee</span>
          <span class="value">${formatCurrency(res.cadFee)}</span>
        </div>
      ` : ''}
      <div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
        <span class="label" style="font-weight:700;">Total Production Cost</span>
        <span class="value" style="font-weight:700;">${formatCurrency(res.totalCost)}</span>
      </div>
      <div class="calc-result-row">
        <span class="label">Net Profit Margin (${res.profitMarginPct.toFixed(1)}%)</span>
        <span class="value" style="font-weight:700;color:${res.profitMarginPct >= 40 ? '#4ade80' : '#f59e0b'};">
          +${formatCurrency(res.profit)}
        </span>
      </div>
      <div class="calc-result-row calc-total-row" style="margin-top:10px;background:rgba(139,92,246,0.1);padding:10px 14px;border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.25);">
        <span class="label" style="font-size:1.05rem;font-weight:700;">Client Selling Price</span>
        <span class="value" style="font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          ${formatCurrency(res.sellingPrice)}
        </span>
      </div>
    `;
  }

  // Update Tier Table
  const tierTbody = container.querySelector('#tier-pricing-tbody');
  if (tierTbody) {
    const baseUnitPrice = res.sellingPrice;
    const tiers = [
      { qty: '1 - 4', discPct: 0, multiplier: 1.0, leadTime: '24-48 hrs' },
      { qty: '5 - 9', discPct: 8, multiplier: 0.92, leadTime: '2-3 days' },
      { qty: '10 - 24', discPct: 15, multiplier: 0.85, leadTime: '3-5 days' },
      { qty: '25 - 49', discPct: 22, multiplier: 0.78, leadTime: '5-7 days' },
      { qty: '50+', discPct: 30, multiplier: 0.70, leadTime: '7-10 days' },
    ];

    tierTbody.innerHTML = tiers.map(t => {
      const unitP = Math.round(baseUnitPrice * t.multiplier);
      const minQty = parseInt(t.qty.split('-')[0], 10);
      const batchTotal = unitP * minQty;
      return `
        <tr>
          <td><strong style="color:var(--text-primary);">${t.qty} units</strong></td>
          <td><span class="badge ${t.discPct > 0 ? 'badge-yes' : 'badge-neutral'}" style="font-size:0.75rem;">${t.discPct > 0 ? `-${t.discPct}%` : 'Standard'}</span></td>
          <td style="font-weight:700;color:#38bdf8;">${formatCurrency(unitP)}</td>
          <td style="font-weight:600;color:var(--text-secondary);">${formatCurrency(batchTotal)}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${t.leadTime}</td>
        </tr>
      `;
    }).join('');
  }
}

function setupSlicerFileHandlers(container) {
  const dropZone = container.querySelector('#slicer-drop-zone');
  const fileInput = container.querySelector('#slicer-file-input');
  const browseBtn = container.querySelector('#btn-browse-slicer');

  browseBtn?.addEventListener('click', () => fileInput?.click());

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSlicerFile(container, e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSlicerFile(container, e.target.files[0]);
    }
  });
}

function handleSlicerFile(container, file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'stl') {
    const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
    const partNameInput = container.querySelector('#calc-part-name');
    if (partNameInput) partNameInput.value = cleanFileName;
    _lastCalculated.partName = cleanFileName;

    const reader = new FileReader();
    reader.onload = (e) => {
      _currentSTLBuffer = e.target.result;
      const infillRow = container.querySelector('#stl-infill-selector-row');
      if (infillRow) infillRow.style.display = 'block';

      const banner = container.querySelector('#slicer-parsed-banner');
      if (banner) banner.style.display = 'block';

      recomputeSTL(container);
      showToast(`Analyzed 3D mesh: ${file.name}`, 'success');
    };
    reader.readAsArrayBuffer(file);
    return;
  }

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
    }
  });
}

function setupActionTools(container) {
  function getWhatsAppQuoteMessage() {
    return (
      `🖨️ *MADE N MORE 3D PRINTING — OFFICIAL COMMERCIAL QUOTATION* 🏷️\n` +
      `-----------------------------------------\n` +
      `*Part/Project:* ${_lastCalculated.partName}\n` +
      `*Material:* ${_lastCalculated.material} (Industrial Grade)\n` +
      `*Estimated Mass:* ${_lastCalculated.weightGrams}g\n` +
      `*Print Time:* ${_lastCalculated.printHours} hrs\n` +
      `*Tolerance:* ±0.2mm (Precision FDM)\n\n` +
      `💰 *Total Quote:* ${formatCurrency(_lastCalculated.sellingPrice)} (Inc. GST)\n` +
      `📦 *Fulfillment:* High-grade box packaging & courier dispatch included\n\n` +
      `⚙️ *Production Terms:* 50% Advance to reserve production queue.\n` +
      `_Reply to confirm and initiate 3D manufacturing._`
    );
  }

  container.querySelector('#btn-copy-wa-quote')?.addEventListener('click', () => {
    const text = getWhatsAppQuoteMessage();
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 WhatsApp quote copied to clipboard!', 'success');
    });
  });

  container.querySelector('#btn-save-as-lead')?.addEventListener('click', async () => {
    const newLead = await create('leads', {
      source: 'calculator_quote',
      clientName: 'Walk-in / Direct Inquiry',
      partName: _lastCalculated.partName,
      material: _lastCalculated.material,
      quantity: 1,
      quotedPrice: _lastCalculated.sellingPrice,
      costing: _lastCalculated,
      stage: 'quoted',
      notes: `Calculated from ERP matrix: ${_lastCalculated.weightGrams}g ${_lastCalculated.material}, ${_lastCalculated.printHours} hrs.`,
      createdAt: new Date().toISOString()
    });

    showToast(`Lead saved to CRM Funnel!`, 'success');
    window.location.hash = '#/crm';
  });

  container.querySelector('#btn-save-as-order')?.addEventListener('click', async () => {
    const newOrder = await create('orders', {
      clientName: 'New Client Commission',
      description: _lastCalculated.partName,
      totalAmount: _lastCalculated.sellingPrice,
      status: 'active',
      kanbanStage: 'slicing',
      priority: 'standard',
      items: [
        {
          id: `it_${Date.now()}_1`,
          name: _lastCalculated.partName,
          material: _lastCalculated.material,
          quantity: 1,
          unitPrice: _lastCalculated.sellingPrice,
          subtotal: _lastCalculated.sellingPrice,
          status: 'queued'
        }
      ],
      payments: [],
      notes: `Estimated from ERP Matrix: ${_lastCalculated.weightGrams}g, ${_lastCalculated.printHours} hrs. Margin: ${_lastCalculated.profitMarginPct.toFixed(1)}%`,
      createdAt: new Date().toISOString()
    });

    showToast(`Order #${newOrder.id} created! Check Kanban board.`, 'success');
    window.location.hash = '#/orders';
  });
}
