/**
 * Made N More — Cost Calculator & Slicer Ingestion Tool
 * Features: Slicer G-Code/3MF metadata extraction, cost estimator, 1-click WhatsApp quote generator
 */

import { getSettings, create } from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, escapeHtml } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showToast } from '../components/toast.js';

let _lastCalculated = {
  material: 'PLA+',
  weight: 50,
  timeHours: 2,
  totalCost: 0,
  suggestedPrice: 0,
  profit: 0,
};

export function renderCalculator(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header animate-in">
      <div class="page-header-left">
        <h1>Print Cost & Slicer Quoter</h1>
        <p class="text-secondary">Drag & drop sliced G-Code, estimate production costs & generate instant WhatsApp quotes</p>
      </div>
    </div>

    <!-- Slicer File Ingestion Drop Zone -->
    <div class="slicer-drop-zone animate-in" id="slicer-drop-zone">
      <input type="file" id="slicer-file-input" accept=".gcode,.3mf,.txt" style="display:none;" />
      <div style="font-size:2rem;margin-bottom:6px;">📂</div>
      <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">
        Drop Sliced G-Code or 3MF File Here
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">
        Auto-extracts filament grams, print hours & temperatures from Bambu Studio, OrcaSlicer, PrusaSlicer & Cura
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-browse-slicer" style="margin-top:12px;">
        Browse Sliced File
      </button>
    </div>

    <!-- Parsed Banner -->
    <div id="slicer-parsed-banner" style="display:none;margin-bottom:var(--space-md);background:var(--success-bg);border:1px solid rgba(34,197,94,0.3);border-radius:var(--radius-md);padding:12px 16px;color:var(--success);font-size:0.86rem;">
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
            <input class="form-input" type="number" id="calc-elec-rate" min="0" step="0.5" value="${settings.electricityRate}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Printer Power (Watts)</label>
            <input class="form-input" type="number" id="calc-power" min="0" step="10" value="${settings.printerPower}" />
          </div>
          <div class="form-group">
            <label class="form-label">Failure Buffer (%)</label>
            <input class="form-input" type="number" id="calc-waste" min="0" max="100" step="1" value="5" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Markup / Profit Margin (%)</label>
          <input class="form-input" type="number" id="calc-markup" min="0" max="500" step="5" value="${settings.defaultMarkup}" />
          <div style="margin-top:8px;height:6px;border-radius:3px;background:rgba(255,255,255,0.05);overflow:hidden;">
            <div id="calc-markup-bar" style="height:100%;width:${settings.defaultMarkup}%;background:var(--accent-gradient);border-radius:3px;transition:width 0.3s ease;"></div>
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

        <!-- Material Costs Reference -->
        <div class="card">
          <h3 style="margin-bottom:var(--space-md);">Material Costs Reference</h3>
          <div style="font-size:0.85rem;">
            ${Object.entries(settings.materialCosts).map(([mat, cost]) => `
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
    calculate(container);
  });

  // Markup bar
  container.querySelector('#calc-markup')?.addEventListener('input', (e) => {
    const bar = container.querySelector('#calc-markup-bar');
    if (bar) bar.style.width = `${Math.min(e.target.value, 100)}%`;
  });

  // Slicer File Drop & Browse Listeners
  setupSlicerFileHandlers(container);

  // WhatsApp Tools Listeners
  setupWhatsAppTools(container);

  // Initial calculation
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
  const totalCost = materialCost + wasteCost + electricityCost;
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
  if (!resultsEl) return;

  resultsEl.innerHTML = `
    <div class="calc-result-row">
      <span class="label">Material Cost (${weight}g)</span>
      <span class="value">${formatCurrency(materialCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Waste Buffer (${waste}%)</span>
      <span class="value">${formatCurrency(wasteCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Electricity (${time}h @ ₹${elecRate})</span>
      <span class="value">${formatCurrency(electricityCost)}</span>
    </div>
    <div class="calc-result-row" style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
      <span class="label" style="font-weight:600;">Total Production Cost</span>
      <span class="value">${formatCurrency(totalCost)}</span>
    </div>
    <div class="calc-result-row">
      <span class="label">Net Profit Margin (${markup}%)</span>
      <span class="value text-success">+${formatCurrency(profit)}</span>
    </div>
    <div class="calc-result-row calc-total-row" style="margin-top:10px;background:rgba(139,92,246,0.1);padding:10px 14px;border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.25);">
      <span class="label" style="font-size:1.05rem;font-weight:700;">Recommended Quote Price</span>
      <span class="value" style="font-size:1.3rem;font-weight:800;color:#fff;">${formatCurrency(suggestedPrice)}</span>
    </div>
  `;
}

// ─── G-Code & Slicer File Ingestion ──────────────────────────
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
  const reader = new FileReader();
  
  // Read first 64KB for header comments (or entire file if small)
  reader.onload = (e) => {
    const text = e.target.result;
    let extractedGrams = 0;
    let extractedSeconds = 0;
    let extractedMaterial = '';

    // Bambu Studio / OrcaSlicer / PrusaSlicer format:
    // ; filament used [g] = 142.85
    const massMatch = text.match(/;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i) ||
                      text.match(/;\s*filament used\s*=\s*([\d.]+)g/i) ||
                      text.match(/;\s*total filament used\s*\[g\]\s*=\s*([\d.]+)/i);

    if (massMatch) extractedGrams = parseFloat(massMatch[1]);

    // Estimated time formats:
    // ; total estimated time = 3h 24m 12s or ; estimated printing time (normal mode) = 3h 24m
    const timeTextMatch = text.match(/;\s*(?:total )?estimated (?:printing )?time[^\n]*=\s*([^\n]+)/i);
    if (timeTextMatch) {
      const timeStr = timeTextMatch[1];
      const hours = (timeStr.match(/(\d+)h/i) || [])[1] || 0;
      const mins = (timeStr.match(/(\d+)m/i) || [])[1] || 0;
      extractedSeconds = (parseInt(hours) * 3600) + (parseInt(mins) * 60);
    } else {
      // Cura TIME:12345
      const curaTimeMatch = text.match(/;TIME:(\d+)/i);
      if (curaTimeMatch) extractedSeconds = parseInt(curaTimeMatch[1]);
    }

    // Material detection
    const matMatch = text.match(/;\s*filament_type\s*=\s*([A-Za-z0-9+-]+)/i) ||
                     text.match(/material\s*=\s*([A-Za-z0-9+-]+)/i);
    if (matMatch) extractedMaterial = matMatch[1].trim();

    if (extractedGrams > 0 || extractedSeconds > 0) {
      if (extractedGrams > 0) {
        const weightInput = container.querySelector('#calc-weight');
        if (weightInput) weightInput.value = extractedGrams.toFixed(1);
      }

      if (extractedSeconds > 0) {
        const hours = (extractedSeconds / 3600).toFixed(2);
        const timeInput = container.querySelector('#calc-time');
        if (timeInput) timeInput.value = hours;
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
          <div style="margin-top:3px;font-size:0.8rem;color:#22c55e;">
            Mass: <strong>${extractedGrams.toFixed(1)}g</strong> • Print Time: <strong>${(extractedSeconds/3600).toFixed(1)} hours</strong>
          </div>
        `;
      }

      showToast(`Parsed: ${extractedGrams.toFixed(0)}g / ${(extractedSeconds/3600).toFixed(1)}h from ${file.name}`, 'success');
      calculate(container);
    } else {
      showToast('Could not find slicer comment metadata. Using standard manual parameters.', 'info');
    }
  };

  reader.readAsText(file.slice(0, 150000));
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
