/**
 * Made N More — Lead CRM & Sales Pipeline Management
 * Features:
 * - 6-Stage Commercial Funnel (new ➔ contacted ➔ interested ➔ quoted ➔ won ➔ lost)
 * - Bi-Directional Cloud Website Ingestion & Sync Acknowledgment
 * - 1-Click Lead-to-Order ERP Conversion
 * - Integrated 3D Job Costing Matrix & Profit Margin % Engine
 * - WhatsApp Business Quote Formatter & Slicer CAD link launcher
 */

import { getAll, create, update, remove, getById, getSettings, convertLeadToOrder, calculateJobCosting, triggerCloudSync, getSyncStatus } from '../data/store.js';
import { MATERIAL_TYPES } from '../data/seed.js';
import { formatCurrency, formatDate, escapeHtml, todayStr, debounce } from '../utils/helpers.js';
import { ICONS } from '../utils/icons.js';
import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export const CRM_STAGES = [
  { id: 'new', label: 'New Inquiries', icon: '✨', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
  { id: 'contacted', label: 'Contacted & Scoped', icon: '📞', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', gradient: 'linear-gradient(135deg, #7e22ce, #a855f7)' },
  { id: 'interested', label: 'Interested / Scoped', icon: '🎯', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)' },
  { id: 'quoted', label: 'Quotation Sent', icon: '💰', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', gradient: 'linear-gradient(135deg, #d97706, #f59e0b)' },
  { id: 'won', label: 'Won / Converted', icon: '🏆', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', gradient: 'linear-gradient(135deg, #16a34a, #22c55e)' },
  { id: 'lost', label: 'Lost / Dropped', icon: '📁', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', gradient: 'linear-gradient(135deg, #475569, #64748b)' },
];

let _crmView = 'kanban'; // 'kanban' | 'list'
let _crmSearch = '';
let _filterMaterial = '';
let _filterStage = '';
let _draggedLeadId = null;

export function renderLeads(container) {
  render(container);
}

function getFilteredLeads() {
  let leads = getAll('leads') || [];

  if (_crmSearch) {
    const q = _crmSearch.toLowerCase();
    leads = leads.filter(l =>
      (l.clientName || '').toLowerCase().includes(q) ||
      (l.clientEmail || '').toLowerCase().includes(q) ||
      (l.clientPhone || '').toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q) ||
      (l.material || '').toLowerCase().includes(q) ||
      (l.id || '').toLowerCase().includes(q)
    );
  }

  if (_filterMaterial) {
    leads = leads.filter(l => l.material === _filterMaterial);
  }

  if (_filterStage) {
    leads = leads.filter(l => (l.stage || 'new') === _filterStage);
  }

  return [...leads].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

function getInitials(name) {
  if (!name) return 'CL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function render(container) {
  const leads = getFilteredLeads();
  const allLeads = getAll('leads') || [];

  const totalLeads = allLeads.length;
  const newLeads = allLeads.filter(l => (l.stage || 'new') === 'new').length;
  const wonLeads = allLeads.filter(l => l.stage === 'won').length;
  const pipelineValue = allLeads
    .filter(l => l.stage !== 'lost')
    .reduce((sum, l) => sum + (parseFloat(l.quotedPrice || (l.costing && l.costing.sellingPrice) || 0) || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  container.innerHTML = `
    <div class="crm-container animate-in">
      <!-- Header Area -->
      <div class="page-header" style="margin-bottom: var(--space-md);">
        <div class="page-header-left">
          <div style="display:flex;align-items:center;gap:12px;">
            <h1 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.5px;">Lead CRM & Sales Pipeline</h1>
            <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:700;font-size:0.75rem;padding:4px 10px;border-radius:20px;">
              🌐 Cloud Sync Active
            </span>
          </div>
          <p class="text-secondary" style="font-size:0.88rem;margin-top:2px;">
            Website quotes, 3D CAD briefs, commercial costing, and 1-click production order conversion
          </p>
        </div>
        <div class="page-header-actions" style="display:flex;gap:10px;">
          <button class="btn btn-secondary" id="btn-sync-cloud-leads" title="Sync now with Cloud Website API Gateway">
            <span style="font-size:1.1rem;display:inline-block;" id="icon-sync-spin">🔄</span>
            Sync Website
          </button>
          <button class="btn btn-primary" id="btn-create-lead">
            ${ICONS.plus}
            New Lead
          </button>
        </div>
      </div>

      <!-- CRM Stats Row -->
      <div class="stats-grid animate-in animate-delay-1" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: var(--space-md);">
        <div class="stat-card" style="padding:16px;">
          <div class="stat-card-header">
            <span class="stat-label" style="font-size:0.8rem;font-weight:600;">Active Funnel Leads</span>
            <span class="stat-icon" style="background:rgba(56,189,248,0.15);color:#38bdf8;font-size:1.1rem;">👥</span>
          </div>
          <div class="stat-value" style="font-size:1.7rem;margin:4px 0;">${totalLeads}</div>
          <div class="stat-subtext" style="color:#38bdf8;font-weight:600;font-size:0.78rem;">
            ${newLeads} new awaiting follow-up
          </div>
        </div>

        <div class="stat-card" style="padding:16px;">
          <div class="stat-card-header">
            <span class="stat-label" style="font-size:0.8rem;font-weight:600;">Pipeline Value</span>
            <span class="stat-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:1.1rem;">💰</span>
          </div>
          <div class="stat-value" style="font-size:1.7rem;margin:4px 0;color:#f59e0b;">${formatCurrency(pipelineValue)}</div>
          <div class="stat-subtext" style="font-size:0.78rem;">Potential commercial revenue</div>
        </div>

        <div class="stat-card" style="padding:16px;">
          <div class="stat-card-header">
            <span class="stat-label" style="font-size:0.8rem;font-weight:600;">Win Conversion Rate</span>
            <span class="stat-icon" style="background:rgba(34,197,94,0.15);color:#22c55e;font-size:1.1rem;">🏆</span>
          </div>
          <div class="stat-value" style="font-size:1.7rem;margin:4px 0;color:#22c55e;">${conversionRate}%</div>
          <div class="stat-subtext" style="color:#22c55e;font-size:0.78rem;font-weight:600;">${wonLeads} deals won & converted</div>
        </div>

        <div class="stat-card" id="card-sync-telemetry" style="padding:16px;cursor:pointer;" title="Click to open Settings & Sync Gateway">
          <div class="stat-card-header">
            <span class="stat-label" style="font-size:0.8rem;font-weight:600;">Website Sync Gateway</span>
            <span class="stat-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6;font-size:1.1rem;">🌐</span>
          </div>
          <div class="stat-value" style="font-size:1.25rem;margin:6px 0;display:flex;align-items:center;gap:8px;" id="crm-sync-status-indicator">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span>
            Connected
          </div>
          <div class="stat-subtext" id="crm-sync-last-time" style="font-size:0.75rem;color:var(--text-secondary);">Auto-pulls every 20s</div>
        </div>
      </div>

      <!-- Filter & Controls Toolbar -->
      <div class="toolbar animate-in animate-delay-2" style="background:rgba(18,22,40,0.85);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:var(--radius-lg);padding:10px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;flex:1;min-width:280px;">
          <div class="search-box" style="flex:1;max-width:320px;position:relative;">
            <input class="form-input" id="crm-search-input" placeholder="Search customer, phone, email, notes..." value="${escapeHtml(_crmSearch)}" style="padding-left:36px;height:38px;font-size:0.85rem;" />
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:0.6;pointer-events:none;">${ICONS.search}</span>
          </div>

          <select class="form-select" id="crm-filter-material" style="width:auto;min-width:140px;height:38px;font-size:0.85rem;">
            <option value="">All Materials</option>
            ${MATERIAL_TYPES.map(m => `<option value="${m}" ${_filterMaterial === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>

          <select class="form-select" id="crm-filter-stage" style="width:auto;min-width:160px;height:38px;font-size:0.85rem;">
            <option value="">All Stages</option>
            ${CRM_STAGES.map(s => `<option value="${s.id}" ${_filterStage === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
          </select>

          ${(_crmSearch || _filterMaterial || _filterStage) ? `
            <button class="btn btn-ghost btn-sm" id="btn-clear-crm-filters" style="height:38px;font-size:0.8rem;color:var(--text-secondary);">
              Reset Filters
            </button>
          ` : ''}
        </div>

        <div class="view-toggle">
          <button class="view-toggle-btn ${_crmView === 'kanban' ? 'active' : ''}" id="btn-view-kanban">
            ${ICONS.kanban}
            <span>Kanban Pipeline</span>
          </button>
          <button class="view-toggle-btn ${_crmView === 'list' ? 'active' : ''}" id="btn-view-list">
            ${ICONS.list}
            <span>Table List</span>
          </button>
        </div>
      </div>

      <!-- Main CRM Stage Funnel Board -->
      <div id="crm-content-area">
        ${_crmView === 'kanban' ? renderKanbanBoard(leads) : renderListView(leads)}
      </div>
    </div>
  `;

  attachEventListeners(container);
  updateSyncTelemetryWidget();
}

function renderKanbanBoard(leads) {
  return `
    <div class="crm-kanban-board">
      ${CRM_STAGES.map(stage => {
        const stageLeads = leads.filter(l => (l.stage || 'new') === stage.id);
        const stageTotalValue = stageLeads.reduce((s, l) => s + (parseFloat(l.quotedPrice || (l.costing && l.costing.sellingPrice) || 0) || 0), 0);

        return `
          <div class="crm-column" data-stage="${stage.id}" style="--stage-color: ${stage.color};">
            <div class="crm-column-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.1rem;">${stage.icon}</span>
                <span style="font-weight:700;color:var(--text-primary);font-size:0.9rem;">${stage.label}</span>
                <span class="badge" style="background:${stage.bg};color:${stage.color};font-weight:800;font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid ${stage.border};">
                  ${stageLeads.length}
                </span>
              </div>
              <span style="font-size:0.8rem;font-weight:700;color:${stage.color};">${formatCurrency(stageTotalValue)}</span>
            </div>

            <div class="crm-column-body" data-stage="${stage.id}">
              ${stageLeads.length === 0 ? `
                <div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:0.82rem;border:1px dashed rgba(255,255,255,0.08);border-radius:var(--radius-md);margin-top:8px;">
                  <div style="font-size:1.5rem;margin-bottom:6px;opacity:0.4;">📥</div>
                  No leads in this stage<br>
                  <span style="font-size:0.75rem;opacity:0.6;">Drag lead cards here</span>
                </div>
              ` : stageLeads.map(lead => renderLeadCard(lead, stage)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderLeadCard(lead, stage) {
  const price = lead.quotedPrice || (lead.costing && lead.costing.sellingPrice) || 0;
  const costing = lead.costing || {};
  const marginPct = costing.profitMarginPct !== undefined ? costing.profitMarginPct : 45;
  const hasCad = lead.fileCadUrl || (lead.cadFiles && lead.cadFiles.length > 0);
  const initials = getInitials(lead.clientName);

  const sourceConfig = {
    website_quote: { label: 'Quote Brief', icon: '🌐', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
    cloud_quote: { label: 'Quote Brief', icon: '🌐', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
    website_contact: { label: 'Contact Msg', icon: '✉️', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
    cloud_contact_inquiry: { label: 'Contact Msg', icon: '✉️', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
    calculator_quote: { label: 'ERP Calculator', icon: '🧮', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    manual_walkin: { label: 'Direct Walk-in', icon: '🏢', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  };

  const src = sourceConfig[lead.source] || sourceConfig.manual_walkin;
  const cleanPhone = (lead.clientPhone || '').replace(/[^0-9]/g, '');

  return `
    <div class="crm-card animate-in" draggable="true" data-lead-id="${lead.id}">
      <!-- Card Top: Avatar, Name, Source -->
      <div class="crm-card-header">
        <div class="crm-avatar" style="background:${stage.gradient};">
          ${initials}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:0.92rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(lead.clientName || 'Anonymous Client')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span class="badge" style="background:${src.bg};color:${src.color};font-size:0.68rem;padding:2px 6px;border-radius:4px;font-weight:600;">
              ${src.icon} ${src.label}
            </span>
            <span style="font-size:0.72rem;color:var(--text-muted);">
              ${lead.createdAt ? formatDate(lead.createdAt) : 'Recently'}
            </span>
          </div>
        </div>
      </div>

      <!-- Contact Quick Chips -->
      ${(lead.clientPhone || lead.clientEmail) ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${lead.clientPhone ? `
            <a href="tel:${lead.clientPhone}" class="crm-chip-link" title="Call ${lead.clientPhone}">
              📞 ${escapeHtml(lead.clientPhone)}
            </a>
          ` : ''}
          ${lead.clientEmail ? `
            <a href="mailto:${lead.clientEmail}" class="crm-chip-link" title="Email ${lead.clientEmail}" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ✉️ ${escapeHtml(lead.clientEmail)}
            </a>
          ` : ''}
        </div>
      ` : ''}

      <!-- Specs Badges -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);font-size:0.74rem;">
          🧵 ${escapeHtml(lead.material || 'PLA+')}
        </span>
        <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);font-size:0.74rem;">
          📦 Qty: ${lead.quantity || 1}
        </span>
        ${hasCad ? `
          <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-size:0.72rem;display:inline-flex;align-items:center;gap:4px;">
            ${ICONS.cad} 3D Model
          </span>
        ` : ''}
        ${lead.deadline ? `
          <span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.72rem;">
            ⏰ ${lead.deadline}
          </span>
        ` : ''}
      </div>

      <!-- Notes Preview -->
      ${lead.notes ? `
        <div style="font-size:0.78rem;color:var(--text-secondary);background:rgba(0,0,0,0.3);border-radius:6px;padding:6px 8px;line-height:1.3;max-height:42px;overflow:hidden;text-overflow:ellipsis;">
          "${escapeHtml(lead.notes)}"
        </div>
      ` : ''}

      <!-- Commercial Value & Actions Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:2px;">
        <div>
          <span style="font-size:0.7rem;color:var(--text-muted);display:block;">Quote Value</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <strong style="font-size:1.05rem;color:#4ade80;">${formatCurrency(price)}</strong>
            ${marginPct > 0 ? `
              <span class="badge ${marginPct >= 40 ? 'badge-yes' : 'badge-neutral'}" style="font-size:0.68rem;padding:1px 5px;">
                ${marginPct.toFixed(0)}% margin
              </span>
            ` : ''}
          </div>
        </div>

        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost btn-sm btn-quick-wa-card" data-id="${lead.id}" title="Send WhatsApp Quote" style="padding:4px 8px;color:#22c55e;">
            ${ICONS.whatsapp}
          </button>
          ${lead.stage === 'won' ? `
            <span class="badge badge-yes" style="font-size:0.72rem;padding:4px 8px;">Won #${lead.convertedOrderId || ''}</span>
          ` : `
            <button class="btn btn-primary btn-sm btn-quick-convert" data-id="${lead.id}" title="Convert to Production Order" style="padding:4px 10px;font-size:0.78rem;background:linear-gradient(135deg,#22c55e,#16a34a);font-weight:700;">
              🏆 Convert
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderListView(leads) {
  if (leads.length === 0) {
    return `
      <div class="empty-state card" style="padding:48px 24px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:12px;">📭</div>
        <h3>No Leads Found</h3>
        <p class="text-secondary" style="max-width:400px;margin:0 auto 16px;">
          No customer inquiries matching your criteria. Add a manual lead or sync with your cloud website.
        </p>
        <button class="btn btn-primary" id="btn-create-lead-empty">Add New Lead</button>
      </div>
    `;
  }

  return `
    <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--border);">
      <div class="table-responsive">
        <table class="data-table" style="margin:0;">
          <thead>
            <tr>
              <th>Client / Company</th>
              <th>Contact Details</th>
              <th>Material & Quantity</th>
              <th>CAD Files</th>
              <th>Funnel Stage</th>
              <th>Quote Value</th>
              <th>Profit Margin</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${leads.map(lead => {
              const stageObj = CRM_STAGES.find(s => s.id === (lead.stage || 'new')) || CRM_STAGES[0];
              const price = lead.quotedPrice || (lead.costing && lead.costing.sellingPrice) || 0;
              const margin = lead.costing && lead.costing.profitMarginPct ? lead.costing.profitMarginPct : (price > 0 ? 45 : 0);
              const hasCad = lead.fileCadUrl || (lead.cadFiles && lead.cadFiles.length > 0);

              return `
                <tr class="lead-table-row" data-id="${lead.id}" style="cursor:pointer;">
                  <td>
                    <div style="font-weight:700;color:var(--text-primary);font-size:0.92rem;">${escapeHtml(lead.clientName || 'Anonymous')}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Added: ${lead.createdAt ? formatDate(lead.createdAt) : 'Recently'}</div>
                  </td>
                  <td>
                    <div style="font-size:0.85rem;color:var(--text-primary);">${escapeHtml(lead.clientPhone || '—')}</div>
                    <div style="font-size:0.78rem;color:var(--text-secondary);">${escapeHtml(lead.clientEmail || '—')}</div>
                  </td>
                  <td>
                    <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);">${escapeHtml(lead.material || 'PLA+')}</span>
                    <span style="font-size:0.8rem;color:var(--text-secondary);margin-left:4px;">× ${lead.quantity || 1}</span>
                  </td>
                  <td>
                    ${hasCad ? `
                      <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;">
                        ${ICONS.cad} Attached
                      </span>
                    ` : '<span style="color:var(--text-muted);font-size:0.8rem;">None</span>'}
                  </td>
                  <td>
                    <select class="form-select crm-stage-inline-select" data-id="${lead.id}" style="width:auto;padding:4px 8px;font-size:0.78rem;background:${stageObj.bg};color:${stageObj.color};border-color:${stageObj.border};font-weight:700;border-radius:6px;">
                      ${CRM_STAGES.map(s => `<option value="${s.id}" ${(lead.stage || 'new') === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <strong style="color:#4ade80;font-size:0.95rem;">${formatCurrency(price)}</strong>
                  </td>
                  <td>
                    <span class="badge ${margin >= 40 ? 'badge-yes' : 'badge-neutral'}" style="font-size:0.75rem;">
                      ${margin.toFixed(0)}%
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-ghost btn-sm btn-action-costing" data-id="${lead.id}" title="Job Costing Matrix">
                        🧮
                      </button>
                      <button class="btn btn-secondary btn-sm btn-quick-wa-card" data-id="${lead.id}" title="Send WhatsApp Quote" style="color:#22c55e;">
                        ${ICONS.whatsapp}
                      </button>
                      ${lead.stage !== 'won' ? `
                        <button class="btn btn-primary btn-sm btn-quick-convert" data-id="${lead.id}" title="Convert to Order" style="background:linear-gradient(135deg,#22c55e,#16a34a);">
                          🏆
                        </button>
                      ` : ''}
                      <button class="btn btn-ghost btn-sm btn-delete-lead" data-id="${lead.id}" title="Delete Lead" style="color:var(--danger);">
                        ${ICONS.trash}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function attachEventListeners(container) {
  // Search input
  const searchInput = container.querySelector('#crm-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      _crmSearch = e.target.value;
      render(container);
    }, 200));
  }

  // Material filter
  container.querySelector('#crm-filter-material')?.addEventListener('change', (e) => {
    _filterMaterial = e.target.value;
    render(container);
  });

  // Stage filter
  container.querySelector('#crm-filter-stage')?.addEventListener('change', (e) => {
    _filterStage = e.target.value;
    render(container);
  });

  // Clear filters
  container.querySelector('#btn-clear-crm-filters')?.addEventListener('click', () => {
    _crmSearch = '';
    _filterMaterial = '';
    _filterStage = '';
    render(container);
  });

  // View toggle
  container.querySelector('#btn-view-kanban')?.addEventListener('click', () => {
    _crmView = 'kanban';
    render(container);
  });
  container.querySelector('#btn-view-list')?.addEventListener('click', () => {
    _crmView = 'list';
    render(container);
  });

  // Create lead buttons
  container.querySelector('#btn-create-lead')?.addEventListener('click', () => openLeadFormModal());
  container.querySelector('#btn-create-lead-empty')?.addEventListener('click', () => openLeadFormModal());

  // Cloud Sync button
  const syncBtn = container.querySelector('#btn-sync-cloud-leads');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      const icon = syncBtn.querySelector('#icon-sync-spin');
      if (icon) icon.style.animation = 'spin 1s linear infinite';
      syncBtn.disabled = true;

      try {
        await triggerCloudSync();
        showToast('✅ Synchronized customer quotes & orders with Cloud Website!', 'success');
        render(container);
      } catch (err) {
        showToast(`Sync failed: ${err.message}`, 'error');
      } finally {
        syncBtn.disabled = false;
        if (icon) icon.style.animation = 'none';
      }
    });
  }

  // Sync Telemetry widget click
  container.querySelector('#card-sync-telemetry')?.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });

  // Lead Card click -> Open Modal
  container.querySelectorAll('.crm-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('a')) return;
      const leadId = card.dataset.leadId;
      openLeadDetailModal(leadId, () => render(container));
    });

    card.addEventListener('dragstart', () => {
      _draggedLeadId = card.dataset.leadId;
      card.style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });
  });

  // Drag over Kanban columns
  container.querySelectorAll('.crm-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.style.background = 'rgba(255,255,255,0.06)';
    });
    col.addEventListener('dragleave', () => {
      col.style.background = 'rgba(15, 18, 33, 0.75)';
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.style.background = 'rgba(15, 18, 33, 0.75)';
      const targetStage = col.dataset.stage;
      if (_draggedLeadId && targetStage) {
        const lead = getById('leads', _draggedLeadId);
        if (lead && lead.stage !== targetStage) {
          await update('leads', _draggedLeadId, { stage: targetStage, updatedAt: new Date().toISOString() });
          showToast(`Moved "${lead.clientName}" to ${targetStage.toUpperCase()}`, 'info');
          render(container);
        }
      }
      _draggedLeadId = null;
    });
  });

  // Actions
  container.querySelectorAll('.btn-action-costing').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLeadDetailModal(btn.dataset.id, () => render(container));
    });
  });

  container.querySelectorAll('.btn-quick-convert').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const leadId = btn.dataset.id;
      const lead = getById('leads', leadId);
      if (!lead) return;

      if (confirm(`Convert lead "${lead.clientName}" into an active Production Order?`)) {
        try {
          const ord = await convertLeadToOrder(leadId);
          showToast(`🏆 Order #${ord.id} created! Moved lead to WON stage.`, 'success');
          render(container);
        } catch (err) {
          showToast(`Conversion failed: ${err.message}`, 'error');
        }
      }
    });
  });

  container.querySelectorAll('.btn-quick-wa-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const leadId = btn.dataset.id;
      const lead = getById('leads', leadId);
      if (lead) generateWhatsAppQuote(lead);
    });
  });

  container.querySelectorAll('.crm-stage-inline-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const leadId = sel.dataset.id;
      const newStage = sel.value;
      await update('leads', leadId, { stage: newStage, updatedAt: new Date().toISOString() });
      showToast('Funnel stage updated', 'success');
      render(container);
    });
  });

  container.querySelectorAll('.btn-delete-lead').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const leadId = btn.dataset.id;
      if (confirm('Delete this customer lead from the CRM funnel?')) {
        await remove('leads', leadId);
        showToast('Lead removed', 'info');
        render(container);
      }
    });
  });
}

async function updateSyncTelemetryWidget() {
  try {
    const status = await getSyncStatus();
    const ind = document.getElementById('crm-sync-status-indicator');
    const timeEl = document.getElementById('crm-sync-last-time');
    if (!ind || !timeEl) return;

    if (status.status === 'connected' || status.isRunning) {
      ind.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span> Connected`;
      const timeStr = status.lastPullTime ? formatDate(status.lastPullTime) : 'Active';
      timeEl.textContent = `Last pull: ${timeStr} • ${status.stats?.quotesPulled || 0} quotes synced`;
    } else {
      ind.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span> Standby`;
      timeEl.textContent = status.lastError ? `Notice: ${status.lastError}` : 'Ready for Cloud Gateway';
    }
  } catch {}
}

// ─── Lead ERP Job Costing & Detail Modal ────────────────────
export function openLeadDetailModal(leadId, onRefresh) {
  const lead = getById('leads', leadId);
  if (!lead) return;

  const settings = getSettings();
  let costing = lead.costing || calculateJobCosting({
    material: lead.material || 'PLA+',
    weightGrams: lead.weightGrams || 65,
    printHours: lead.printHours || 3,
    packaging: 40,
    shipping: 100,
    cadFee: 0,
    sellingPrice: lead.quotedPrice || 0
  });

  function recalcAndRender() {
    const weightG = parseFloat(document.getElementById('lm-weight')?.value) || 0;
    const hours = parseFloat(document.getElementById('lm-hours')?.value) || 0;
    const mat = document.getElementById('lm-material')?.value || 'PLA+';
    const pkg = parseFloat(document.getElementById('lm-pkg')?.value) || 0;
    const ship = parseFloat(document.getElementById('lm-ship')?.value) || 0;
    const cad = parseFloat(document.getElementById('lm-cad-fee')?.value) || 0;
    const customSell = document.getElementById('lm-selling-price')?.value;

    costing = calculateJobCosting({
      material: mat,
      weightGrams: weightG,
      printHours: hours,
      packaging: pkg,
      shipping: ship,
      cadFee: cad,
      sellingPrice: customSell !== '' && customSell !== undefined ? parseFloat(customSell) : undefined,
      markup: parseFloat(document.getElementById('lm-markup')?.value) || settings.defaultMarkup || 150
    });

    const costEl = document.getElementById('lm-costing-breakdown');
    if (costEl) {
      costEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.83rem;margin-bottom:12px;color:var(--text-secondary);background:rgba(0,0,0,0.2);padding:12px;border-radius:var(--radius-md);">
          <div>Material Cost: <strong style="color:var(--text-primary);">${formatCurrency(costing.materialCost)}</strong></div>
          <div>Power Draw: <strong style="color:var(--text-primary);">${formatCurrency(costing.electricityCost)}</strong></div>
          <div>Machine Wear/Capex: <strong style="color:var(--text-primary);">${formatCurrency(costing.machineWear)}</strong></div>
          <div>Packaging & Box: <strong style="color:var(--text-primary);">${formatCurrency(costing.packaging)}</strong></div>
          <div>Courier Shipping: <strong style="color:var(--text-primary);">${formatCurrency(costing.shipping)}</strong></div>
          <div>CAD/Design Pre-flight: <strong style="color:var(--text-primary);">${formatCurrency(costing.cadFee)}</strong></div>
        </div>

        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Total Production Cost</div>
            <div style="font-size:1.15rem;font-weight:700;color:var(--text-primary);">${formatCurrency(costing.totalCost)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem;color:var(--text-muted);">Net Profit Margin</div>
            <div style="font-size:1.25rem;font-weight:800;color:${costing.profitMarginPct >= 40 ? '#4ade80' : '#f59e0b'};">
              +${formatCurrency(costing.profit)} (${costing.profitMarginPct.toFixed(1)}%)
            </div>
          </div>
        </div>
      `;
    }
  }

  showModal({
    title: `📋 Lead Profile & ERP Costing — ${escapeHtml(lead.clientName)}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;max-height:75vh;overflow-y:auto;padding-right:4px;">
        <!-- Header banner -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:0.72rem;color:var(--text-muted);display:block;">Lead ID: #${lead.id}</span>
            <strong style="font-size:1.1rem;color:var(--text-primary);">${escapeHtml(lead.clientName)}</strong>
          </div>
          <div class="form-group" style="margin:0;">
            <select class="form-select" id="lm-stage" style="padding:6px 12px;font-size:0.85rem;font-weight:700;">
              ${CRM_STAGES.map(s => `<option value="${s.id}" ${(lead.stage || 'new') === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Contact Fields -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client / Company Name</label>
            <input class="form-input" id="lm-name" value="${escapeHtml(lead.clientName || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone / WhatsApp</label>
            <input class="form-input" id="lm-phone" value="${escapeHtml(lead.clientPhone || '')}" placeholder="+91..." />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input class="form-input" id="lm-email" value="${escapeHtml(lead.clientEmail || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Delivery Deadline</label>
            <input class="form-input" type="date" id="lm-deadline" value="${lead.deadline || ''}" />
          </div>
        </div>

        <!-- Attached 3D Models -->
        ${(lead.fileCadUrl || (lead.cadFiles && lead.cadFiles.length > 0)) ? `
          <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.25);border-radius:var(--radius-md);padding:12px;">
            <div style="font-weight:700;font-size:0.88rem;color:#38bdf8;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ${ICONS.cad} Attached 3D CAD Files
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
              ${(lead.cadFiles && lead.cadFiles.length > 0) ? lead.cadFiles.map(f => `
                <a href="${f.url}" target="_blank" download class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;">
                  📥 ${escapeHtml(f.name || 'Model.stl')} ${f.size ? `(${f.size})` : ''}
                </a>
              `).join('') : `
                <a href="${lead.fileCadUrl}" target="_blank" download class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;">
                  📥 Download CAD File
                </a>
              `}
              <button class="btn btn-ghost btn-sm" id="btn-lm-open-slicer" style="color:#38bdf8;font-size:0.8rem;">
                🚀 Open in Calculator & Slicer
              </button>
            </div>
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">Project Requirements & Brief</label>
          <textarea class="form-textarea" id="lm-notes" rows="2">${escapeHtml(lead.notes || '')}</textarea>
        </div>

        <!-- 3D ERP Costing Matrix -->
        <div style="border-top:1px solid var(--border);padding-top:14px;">
          <h4 style="color:var(--text-primary);margin-bottom:10px;font-size:0.95rem;display:flex;align-items:center;gap:6px;">
            🧮 Job Costing Matrix & Margin Engine
          </h4>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Material</label>
              <select class="form-select" id="lm-material">
                ${MATERIAL_TYPES.map(m => `<option value="${m}" ${m === (lead.material || 'PLA+') ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Weight (g)</label>
              <input class="form-input" type="number" id="lm-weight" value="${costing.weightGrams || 65}" step="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Print Time (hrs)</label>
              <input class="form-input" type="number" id="lm-hours" value="${costing.printHours || 3}" step="0.25" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Packaging (₹)</label>
              <input class="form-input" type="number" id="lm-pkg" value="${costing.packaging || 40}" />
            </div>
            <div class="form-group">
              <label class="form-label">Shipping (₹)</label>
              <input class="form-input" type="number" id="lm-ship" value="${costing.shipping || 100}" />
            </div>
            <div class="form-group">
              <label class="form-label">CAD / Pre-flight (₹)</label>
              <input class="form-input" type="number" id="lm-cad-fee" value="${costing.cadFee || 0}" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Standard Markup (%)</label>
              <input class="form-input" type="number" id="lm-markup" value="${costing.markupPct || settings.defaultMarkup || 150}" />
            </div>
            <div class="form-group">
              <label class="form-label">Target Selling Price (₹)</label>
              <input class="form-input" type="number" id="lm-selling-price" value="${costing.sellingPrice || ''}" placeholder="Auto-calculated" />
            </div>
          </div>

          <div id="lm-costing-breakdown" style="margin-top:10px;"></div>
        </div>
      </div>
    `,
    confirmText: 'Save Lead Profile',
    cancelText: 'Close',
    onReady: () => {
      recalcAndRender();

      ['lm-material', 'lm-weight', 'lm-hours', 'lm-pkg', 'lm-ship', 'lm-cad-fee', 'lm-markup', 'lm-selling-price'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcAndRender);
      });

      document.getElementById('btn-lm-open-slicer')?.addEventListener('click', () => {
        closeModal();
        window.location.hash = '#/calculator';
      });
    },
    onConfirm: async () => {
      const updated = {
        clientName: document.getElementById('lm-name')?.value || lead.clientName,
        clientPhone: document.getElementById('lm-phone')?.value || '',
        clientEmail: document.getElementById('lm-email')?.value || '',
        deadline: document.getElementById('lm-deadline')?.value || '',
        notes: document.getElementById('lm-notes')?.value || '',
        stage: document.getElementById('lm-stage')?.value || lead.stage || 'new',
        material: document.getElementById('lm-material')?.value || lead.material,
        costing,
        quotedPrice: costing.sellingPrice,
        updatedAt: new Date().toISOString()
      };

      await update('leads', lead.id, updated);
      showToast('Lead profile & costing saved!', 'success');
      if (onRefresh) onRefresh();
    }
  });
}

// ─── Manual Lead Creation Modal ─────────────────────────────
export function openLeadFormModal() {
  const settings = getSettings();

  showModal({
    title: '✨ Add New Customer Lead',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client / Company Name *</label>
            <input class="form-input" id="nl-name" placeholder="e.g. Acme Robotics Pvt Ltd" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone / WhatsApp</label>
            <input class="form-input" id="nl-phone" placeholder="+91..." />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input class="form-input" id="nl-email" placeholder="client@company.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Target Material</label>
            <select class="form-select" id="nl-material">
              ${MATERIAL_TYPES.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Order Quantity</label>
            <input class="form-input" type="number" id="nl-qty" value="1" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">Delivery Deadline</label>
            <input class="form-input" type="date" id="nl-deadline" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Estimated Budget / Price (₹)</label>
          <input class="form-input" type="number" id="nl-price" placeholder="e.g. 2500" />
        </div>

        <div class="form-group">
          <label class="form-label">Project Brief & Details</label>
          <textarea class="form-textarea" id="nl-notes" placeholder="Part description, color preferences, tolerances..."></textarea>
        </div>
      </div>
    `,
    confirmText: 'Create Lead',
    onConfirm: async () => {
      const name = document.getElementById('nl-name')?.value?.trim();
      if (!name) {
        showToast('Client name is required', 'error');
        return false;
      }

      const price = parseFloat(document.getElementById('nl-price')?.value) || 0;
      const mat = document.getElementById('nl-material')?.value || 'PLA+';

      await create('leads', {
        source: 'manual_walkin',
        clientName: name,
        clientPhone: document.getElementById('nl-phone')?.value || '',
        clientEmail: document.getElementById('nl-email')?.value || '',
        material: mat,
        quantity: parseInt(document.getElementById('nl-qty')?.value, 10) || 1,
        deadline: document.getElementById('nl-deadline')?.value || '',
        notes: document.getElementById('nl-notes')?.value || '',
        stage: 'new',
        quotedPrice: price,
        costing: calculateJobCosting({ material: mat, weightGrams: 50, printHours: 2, sellingPrice: price }),
        createdAt: new Date().toISOString()
      });

      showToast(`Lead for "${name}" created in CRM!`, 'success');
      const container = document.getElementById('page-content');
      if (container) render(container);
    }
  });
}

// ─── WhatsApp Quote Generator ──────────────────────────────
export function generateWhatsAppQuote(lead) {
  const settings = getSettings();
  const costing = lead.costing || {};
  const price = lead.quotedPrice || costing.sellingPrice || 0;

  const text = `*MADE N MORE 3D PRINTING — OFFICIAL QUOTATION* 🏷️
-----------------------------------------
👤 *Client:* ${lead.clientName}
🧵 *Material:* ${lead.material || 'PLA+'}
📦 *Quantity:* ${lead.quantity || 1} Unit(s)
${lead.deadline ? `⏰ *Required Delivery:* ${lead.deadline}\n` : ''}
📋 *Scope:* ${lead.notes || 'Custom 3D Printing & Prototyping Service'}

💰 *Commercial Investment:*
• Total Production & Finishing: *${formatCurrency(price)}* (Inc. GST)
${costing.shipping ? `• Doorstep Dispatch: Included\n` : ''}
⚙️ *Production Lead Time:* 24-48 Hours upon file sign-off

🏦 *Payment / Confirmation:*
UPI / Bank Transfer: 50% Advance to initiate high-speed production queue.

Thank you for engineering with *${settings.businessName || 'Made N More'}*!
-----------------------------------------`;

  const encoded = encodeURIComponent(text);
  const cleanPhone = (lead.clientPhone || '').replace(/[^0-9]/g, '');
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied formatted WhatsApp Quote to clipboard!', 'success');
  });

  window.open(url, '_blank');
}
