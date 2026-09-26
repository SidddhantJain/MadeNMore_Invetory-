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
  { id: 'new', label: 'New Inquiries', icon: '✨', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)' },
  { id: 'contacted', label: 'Contacted & Scoped', icon: '📞', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' },
  { id: 'interested', label: 'Interested / Qualified', icon: '🎯', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' },
  { id: 'quoted', label: 'Quote Sent', icon: '💰', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  { id: 'won', label: 'Won / Converted', icon: '🏆', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)' },
  { id: 'lost', label: 'Lost / Closed', icon: '📁', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' },
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

  // Sort by updatedAt descending
  return [...leads].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
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
    <div class="page-header animate-in">
      <div class="page-header-left">
        <div style="display:flex;align-items:center;gap:10px;">
          <h1>Lead CRM & Website Funnel</h1>
          <span class="badge" style="background:linear-gradient(135deg,#38bdf8,#818cf8);color:#fff;font-weight:700;font-size:0.75rem;padding:4px 10px;border-radius:20px;">
            Live Cloud Sync
          </span>
        </div>
        <p class="text-secondary">Capture website inquiries, calculate ERP job costing matrix, and convert quotes to active production orders</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-secondary" id="btn-sync-cloud-leads" title="Sync now with Cloud Website API Gateway">
          <span style="font-size:1.1rem;display:inline-block;animation:none;" id="icon-sync-spin">🔄</span>
          Sync Website
        </button>
        <button class="btn btn-primary" id="btn-create-lead">
          ${ICONS.plus}
          Add New Lead
        </button>
      </div>
    </div>

    <!-- CRM Executive Metric Cards -->
    <div class="stats-grid animate-in animate-delay-1" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: var(--space-lg);">
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-label">Total Leads</span>
          <span class="stat-icon" style="background:rgba(56,189,248,0.15);color:#38bdf8;">${ICONS.crm}</span>
        </div>
        <div class="stat-value">${totalLeads}</div>
        <div class="stat-subtext" style="color:#38bdf8;font-weight:600;">${newLeads} new awaiting review</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-label">Pipeline Value</span>
          <span class="stat-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b;">${ICONS.transactions}</span>
        </div>
        <div class="stat-value">${formatCurrency(pipelineValue)}</div>
        <div class="stat-subtext">Active potential revenue</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-label">Conversion Rate</span>
          <span class="stat-icon" style="background:rgba(34,197,94,0.15);color:#22c55e;">${ICONS.check}</span>
        </div>
        <div class="stat-value" style="color:#22c55e;">${conversionRate}%</div>
        <div class="stat-subtext">${wonLeads} deals won & converted</div>
      </div>

      <div class="stat-card" id="card-sync-telemetry" style="cursor:pointer;" title="Click to view cloud sync telemetry">
        <div class="stat-card-header">
          <span class="stat-label">Cloud Gateway</span>
          <span class="stat-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6;">${ICONS.cloud}</span>
        </div>
        <div class="stat-value" style="font-size:1.25rem;display:flex;align-items:center;gap:6px;" id="crm-sync-status-indicator">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;"></span>
          Connected
        </div>
        <div class="stat-subtext" id="crm-sync-last-time">Auto-pulling quotes every 20s</div>
      </div>
    </div>

    <!-- Filters & View Toggle Bar -->
    <div class="toolbar animate-in animate-delay-2" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);background:var(--bg-card);padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border);">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;flex:1;min-width:280px;">
        <div class="search-box" style="flex:1;max-width:320px;position:relative;">
          <input class="form-input" id="crm-search-input" placeholder="Search customer, email, notes..." value="${escapeHtml(_crmSearch)}" style="padding-left:34px;" />
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);opacity:0.5;pointer-events:none;">${ICONS.search}</span>
        </div>

        <select class="form-select" id="crm-filter-material" style="width:auto;min-width:140px;">
          <option value="">All Materials</option>
          ${MATERIAL_TYPES.map(m => `<option value="${m}" ${_filterMaterial === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>

        <select class="form-select" id="crm-filter-stage" style="width:auto;min-width:150px;">
          <option value="">All Funnel Stages</option>
          ${CRM_STAGES.map(s => `<option value="${s.id}" ${_filterStage === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
      </div>

      <div class="btn-group">
        <button class="btn btn-sm ${_crmView === 'kanban' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-kanban" title="Kanban Pipeline Board">
          ${ICONS.kanban} Kanban
        </button>
        <button class="btn btn-sm ${_crmView === 'list' ? 'btn-primary' : 'btn-secondary'}" id="btn-view-list" title="Data Table List">
          ${ICONS.list} List
        </button>
      </div>
    </div>

    <!-- Main CRM Container -->
    <div id="crm-content-area" class="animate-in animate-delay-3">
      ${_crmView === 'kanban' ? renderKanbanBoard(leads) : renderListView(leads)}
    </div>
  `;

  attachEventListeners(container);
  updateSyncTelemetryWidget();
}

function renderKanbanBoard(leads) {
  return `
    <div class="kanban-board" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;align-items:start;overflow-x:auto;padding-bottom:16px;">
      ${CRM_STAGES.map(stage => {
        const stageLeads = leads.filter(l => (l.stage || 'new') === stage.id);
        const stageTotalValue = stageLeads.reduce((s, l) => s + (parseFloat(l.quotedPrice || (l.costing && l.costing.sellingPrice) || 0) || 0), 0);

        return `
          <div class="kanban-column" data-stage="${stage.id}" style="background:rgba(255,255,255,0.02);border:1px solid ${stage.border};border-radius:var(--radius-lg);padding:14px;min-height:480px;display:flex;flex-direction:column;">
            <div class="kanban-column-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.1rem;">${stage.icon}</span>
                <span style="font-weight:700;color:var(--text-primary);font-size:0.92rem;">${stage.label}</span>
                <span class="badge" style="background:${stage.bg};color:${stage.color};font-weight:800;font-size:0.75rem;padding:2px 8px;border-radius:12px;">
                  ${stageLeads.length}
                </span>
              </div>
              <span style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);">${formatCurrency(stageTotalValue)}</span>
            </div>

            <div class="kanban-cards-container" data-stage="${stage.id}" style="display:flex;flex-direction:column;gap:12px;flex:1;min-height:200px;">
              ${stageLeads.length === 0 ? `
                <div style="text-align:center;padding:32px 12px;color:var(--text-muted);font-size:0.82rem;border:1px dashed rgba(255,255,255,0.08);border-radius:var(--radius-md);">
                  Drop leads here
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
  const hasCad = lead.fileCadUrl || (lead.cadFiles && lead.cadFiles.length > 0);
  const sourceLabel = lead.source === 'website_quote' || lead.source === 'cloud_quote'
    ? 'Cloud Quote'
    : (lead.source === 'website_contact' || lead.source === 'cloud_contact_inquiry' ? 'Web Contact' : 'Direct Lead');

  const formattedDate = lead.createdAt ? formatDate(lead.createdAt) : '';

  return `
    <div class="card lead-card animate-in" draggable="true" data-lead-id="${lead.id}" style="background:var(--bg-secondary);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:12px 14px;cursor:grab;transition:transform 0.15s ease, box-shadow 0.15s ease;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary);line-height:1.2;">
          ${escapeHtml(lead.clientName || 'Unnamed Client')}
        </div>
        <span class="badge" style="background:${stage.bg};color:${stage.color};font-size:0.7rem;padding:2px 6px;border-radius:6px;font-weight:600;">
          ${sourceLabel}
        </span>
      </div>

      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:8px;display:flex;flex-direction:column;gap:3px;">
        ${lead.clientPhone ? `<div style="display:flex;align-items:center;gap:6px;"><span>📞</span><span>${escapeHtml(lead.clientPhone)}</span></div>` : ''}
        ${lead.clientEmail ? `<div style="display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span>✉️</span><span>${escapeHtml(lead.clientEmail)}</span></div>` : ''}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);font-size:0.72rem;">
          🧵 ${escapeHtml(lead.material || 'PLA+')}
        </span>
        <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-primary);font-size:0.72rem;">
          📦 Qty: ${lead.quantity || 1}
        </span>
        ${hasCad ? `
          <span class="badge" style="background:rgba(56,189,248,0.15);color:#38bdf8;font-size:0.72rem;display:flex;align-items:center;gap:3px;">
            ${ICONS.cad} 3D CAD
          </span>
        ` : ''}
        ${lead.deadline ? `
          <span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.72rem;">
            ⏰ ${lead.deadline}
          </span>
        ` : ''}
      </div>

      ${lead.notes ? `
        <div style="font-size:0.78rem;color:var(--text-secondary);background:rgba(0,0,0,0.2);padding:6px 8px;border-radius:6px;margin-bottom:10px;line-height:1.3;max-height:48px;overflow:hidden;text-overflow:ellipsis;">
          "${escapeHtml(lead.notes)}"
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px;">
        <div>
          <span style="font-size:0.7rem;color:var(--text-muted);display:block;">Quote Value</span>
          <strong style="font-size:0.98rem;color:#4ade80;">${formatCurrency(price)}</strong>
        </div>

        <div style="display:flex;gap:6px;">
          ${lead.stage === 'won' ? `
            <span class="badge badge-yes" style="font-size:0.72rem;">Order #${lead.convertedOrderId || 'Active'}</span>
          ` : `
            <button class="btn btn-ghost btn-sm btn-action-costing" data-id="${lead.id}" title="Open Costing & ERP Matrix" style="padding:4px 8px;font-size:0.78rem;">
              🧮 Costing
            </button>
            <button class="btn btn-primary btn-sm btn-quick-convert" data-id="${lead.id}" title="Convert to Production Order" style="padding:4px 8px;font-size:0.78rem;background:linear-gradient(135deg,#22c55e,#16a34a);">
              🏆 Order
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
      <div class="empty-state card">
        <div style="font-size:2.5rem;margin-bottom:8px;">📭</div>
        <h3>No Leads Found</h3>
        <p class="text-secondary">No customer leads matching your search criteria. Add a manual lead or sync with cloud.</p>
        <button class="btn btn-primary mt-md" id="btn-create-lead-empty">Add New Lead</button>
      </div>
    `;
  }

  return `
    <div class="card" style="padding:0;overflow:hidden;">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client / Company</th>
              <th>Contact Details</th>
              <th>Material & Qty</th>
              <th>CAD Files</th>
              <th>Stage</th>
              <th>Quoted Value</th>
              <th>Margin %</th>
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
                    <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(lead.clientName || 'Anonymous')}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">Added: ${lead.createdAt ? formatDate(lead.createdAt) : 'Recently'}</div>
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
                    <select class="form-select crm-stage-inline-select" data-id="${lead.id}" style="width:auto;padding:3px 8px;font-size:0.78rem;background:${stageObj.bg};color:${stageObj.color};border-color:${stageObj.border};font-weight:600;">
                      ${CRM_STAGES.map(s => `<option value="${s.id}" ${(lead.stage || 'new') === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <strong style="color:#4ade80;">${formatCurrency(price)}</strong>
                  </td>
                  <td>
                    <span class="badge ${margin >= 40 ? 'badge-yes' : 'badge-no'}" style="font-size:0.75rem;">
                      ${margin.toFixed(1)}%
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-ghost btn-sm btn-action-costing" data-id="${lead.id}" title="Job Costing Matrix">
                        🧮
                      </button>
                      <button class="btn btn-secondary btn-sm btn-quick-whatsapp" data-id="${lead.id}" title="Send WhatsApp Quote" style="color:#22c55e;">
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
    }, 250));
  }

  // Material filter
  const materialFilter = container.querySelector('#crm-filter-material');
  if (materialFilter) {
    materialFilter.addEventListener('change', (e) => {
      _filterMaterial = e.target.value;
      render(container);
    });
  }

  // Stage filter
  const stageFilter = container.querySelector('#crm-filter-stage');
  if (stageFilter) {
    stageFilter.addEventListener('change', (e) => {
      _filterStage = e.target.value;
      render(container);
    });
  }

  // View toggle
  container.querySelector('#btn-view-kanban')?.addEventListener('click', () => {
    _crmView = 'kanban';
    render(container);
  });
  container.querySelector('#btn-view-list')?.addEventListener('click', () => {
    _crmView = 'list';
    render(container);
  });

  // Create lead button
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
        const res = await triggerCloudSync();
        showToast('Successfully synchronized quotes & orders with Cloud Website!', 'success');
        render(container);
      } catch (err) {
        showToast(`Sync failed: ${err.message}`, 'error');
      } finally {
        syncBtn.disabled = false;
        if (icon) icon.style.animation = 'none';
      }
    });
  }

  // Lead Card click -> Open Costing / Detail Modal
  container.querySelectorAll('.lead-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      const leadId = card.dataset.leadId;
      openLeadDetailModal(leadId, () => render(container));
    });

    // Drag and drop support
    card.addEventListener('dragstart', (e) => {
      _draggedLeadId = card.dataset.leadId;
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
    });
  });

  // Drag over Kanban columns
  container.querySelectorAll('.kanban-column').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.style.background = 'rgba(255,255,255,0.05)';
    });
    col.addEventListener('dragleave', () => {
      col.style.background = 'rgba(255,255,255,0.02)';
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.style.background = 'rgba(255,255,255,0.02)';
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

  // Action buttons
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
          showToast(`Order #${ord.id} generated successfully!`, 'success');
          render(container);
        } catch (err) {
          showToast(`Conversion failed: ${err.message}`, 'error');
        }
      }
    });
  });

  container.querySelectorAll('.btn-quick-whatsapp').forEach(btn => {
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
      if (confirm('Are you sure you want to delete this lead inquiry?')) {
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
      ind.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;"></span> Connected`;
      const timeStr = status.lastPullTime ? formatDate(status.lastPullTime) : 'Listening';
      timeEl.textContent = `Last pull: ${timeStr} • ${status.stats.quotesPulled || 0} quotes synced`;
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
      sellingPrice: customSell !== '' ? parseFloat(customSell) : undefined,
      markup: parseFloat(document.getElementById('lm-markup')?.value) || settings.defaultMarkup || 150
    });

    const costEl = document.getElementById('lm-costing-breakdown');
    if (costEl) {
      costEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.83rem;margin-bottom:12px;color:var(--text-secondary);">
          <div>Material Cost: <strong style="color:var(--text-primary);">${formatCurrency(costing.materialCost)}</strong></div>
          <div>Power Draw: <strong style="color:var(--text-primary);">${formatCurrency(costing.electricityCost)}</strong></div>
          <div>Machine Wear/Capex: <strong style="color:var(--text-primary);">${formatCurrency(costing.machineWear)}</strong></div>
          <div>Packaging & Box: <strong style="color:var(--text-primary);">${formatCurrency(costing.packaging)}</strong></div>
          <div>Courier Shipping: <strong style="color:var(--text-primary);">${formatCurrency(costing.shipping)}</strong></div>
          <div>CAD/Design Pre-flight: <strong style="color:var(--text-primary);">${formatCurrency(costing.cadFee)}</strong></div>
        </div>

        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Total Production Cost</div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">${formatCurrency(costing.totalCost)}</div>
          </div>
          <div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Net Profit Margin</div>
            <div style="font-size:1.2rem;font-weight:800;color:${costing.profitMarginPct >= 40 ? '#4ade80' : '#f59e0b'};">
              +${formatCurrency(costing.profit)} (${costing.profitMarginPct.toFixed(1)}%)
            </div>
          </div>
        </div>
      `;
    }
  }

  showModal({
    title: `📋 Lead CRM & ERP Costing — ${escapeHtml(lead.clientName)}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;max-height:75vh;overflow-y:auto;padding-right:4px;">
        <!-- Contact & Source Info Banner -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:0.75rem;color:var(--text-muted);display:block;">Lead ID: #${lead.id}</span>
            <strong style="font-size:1.05rem;color:var(--text-primary);">${escapeHtml(lead.clientName)}</strong>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="form-group" style="margin:0;">
              <select class="form-select" id="lm-stage" style="padding:6px 10px;font-size:0.85rem;font-weight:700;">
                ${CRM_STAGES.map(s => `<option value="${s.id}" ${(lead.stage || 'new') === s.id ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Contact Fields -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client Name</label>
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
            <label class="form-label">Required Delivery Deadline</label>
            <input class="form-input" type="date" id="lm-deadline" value="${lead.deadline || ''}" />
          </div>
        </div>

        <!-- Attached CAD / 3D Files -->
        ${(lead.fileCadUrl || (lead.cadFiles && lead.cadFiles.length > 0)) ? `
          <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.25);border-radius:var(--radius-md);padding:12px;">
            <div style="font-weight:700;font-size:0.88rem;color:#38bdf8;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              ${ICONS.cad} Attached 3D CAD Models
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
          <label class="form-label">Project Brief / Technical Notes</label>
          <textarea class="form-textarea" id="lm-notes" rows="2">${escapeHtml(lead.notes || '')}</textarea>
        </div>

        <!-- 3D ERP Job Costing Matrix -->
        <div style="border-top:1px solid var(--border);padding-top:12px;">
          <h4 style="color:var(--text-primary);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
            🧮 Job Costing Matrix & Profit Engine
          </h4>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Material Type</label>
              <select class="form-select" id="lm-material">
                ${MATERIAL_TYPES.map(m => `<option value="${m}" ${m === (lead.material || 'PLA+') ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Part Weight (grams)</label>
              <input class="form-input" type="number" id="lm-weight" value="${costing.weightGrams || 65}" step="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Print Time (hours)</label>
              <input class="form-input" type="number" id="lm-hours" value="${costing.printHours || 3}" step="0.25" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Packaging & Box (₹)</label>
              <input class="form-input" type="number" id="lm-pkg" value="${costing.packaging || 40}" />
            </div>
            <div class="form-group">
              <label class="form-label">Shipping & Courier (₹)</label>
              <input class="form-input" type="number" id="lm-ship" value="${costing.shipping || 100}" />
            </div>
            <div class="form-group">
              <label class="form-label">CAD / Pre-flight Fee (₹)</label>
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

          <!-- Live Breakdown Result Container -->
          <div id="lm-costing-breakdown" style="margin-top:10px;"></div>
        </div>
      </div>
    `,
    confirmText: 'Save Lead & Costing',
    cancelText: 'Cancel',
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
      showToast('Lead profile & costing matrix saved!', 'success');
      if (onRefresh) onRefresh();
    }
  });
}

// ─── Manual Lead Creation Modal ─────────────────────────────
export function openLeadFormModal() {
  const settings = getSettings();

  showModal({
    title: '✨ Add New Commercial Lead Inquiry',
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
            <label class="form-label">Email</label>
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
            <label class="form-label">Required Delivery Deadline</label>
            <input class="form-input" type="date" id="nl-deadline" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Initial Budget / Quoted Estimate (₹)</label>
          <input class="form-input" type="number" id="nl-price" placeholder="e.g. 2500" />
        </div>

        <div class="form-group">
          <label class="form-label">Project Requirements & Brief</label>
          <textarea class="form-textarea" id="nl-notes" placeholder="Part description, infill %, surface finish requirements..."></textarea>
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

      const newLead = await create('leads', {
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
    showToast('Copied formatted WhatsApp Quote to clipboard!', 'success');
  });

  window.open(url, '_blank');
}
