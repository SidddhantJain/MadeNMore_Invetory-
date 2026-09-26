// Made N More — Client Store & Synchronization Engine
// Integrates an in-memory cache with the Express REST API backend for high-speed offline/LAN persistence.

const API_HOST = typeof window !== 'undefined' && window.location && window.location.hostname
  ? window.location.hostname
  : 'localhost';
export const BASE_URL = typeof window !== 'undefined' && window.location
  ? (window.location.port === '3000' || window.location.port === '5173'
      ? window.location.protocol + '//' + window.location.hostname + ':4000/api'
      : window.location.origin + '/api')
  : 'http://localhost:4000/api';

// In-memory cache for immediate synchronous reads & reactivity
let _cache = {
  filaments: [],
  transactions: [],
  orders: [],
  printers: [],
  consumables: [],
  accounts: [],
  leads: [],
  messages: [],
  settings: {
    machineCost: 55000,
    electricityRate: 8.5,
    printerPower: 350,
    defaultMarkup: 150,
    businessName: 'Made N More',
    currency: '₹',
    cloudApiUrl: 'http://localhost:3000',
    cloudApiKey: 'mm_live_sync_secret_2026_key',
    syncIntervalSec: 20,
    materialCosts: {
      'PLA+': 900,
      'PETG-HS': 1100,
      'ABS': 1200,
      'TPU+': 1600,
      'PLA Silk': 1300,
      'PLA Matt': 1100
    }
  },
  _seeded: false
};

let _listeners = [];
let _history = [];
let _syncInterval = null;

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Subscribe to store modifications */
export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

function _notify(collection) {
  _listeners.forEach(fn => {
    try { fn(collection); } catch (e) { console.error('Listener notification error:', e); }
  });
}

function _pushHistory(action, collection, item) {
  _history.push({ action, collection, item });
  if (_history.length > 50) _history.shift();
}

/** Fetch JSON helper with timeout */
async function fetchJSON(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`API ${options.method || 'GET'} ${url} failed with status ${resp.status}:`, errText);
      throw new Error(`API error ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/** Initialize store: fetch all data from backend and start background sync */
export async function initStore() {
  try {
    const allData = await fetchJSON(`${BASE_URL}/all`);
    if (allData && typeof allData === 'object') {
      _cache = {
        filaments: allData.filaments || [],
        transactions: allData.transactions || [],
        orders: allData.orders || [],
        printers: allData.printers || [],
        consumables: allData.consumables || [],
        accounts: allData.accounts || [],
        leads: allData.leads || [],
        messages: allData.messages || [],
        settings: allData.settings || _cache.settings,
        _seeded: allData._seeded !== undefined ? allData._seeded : true
      };
      _notify('all');
    }
  } catch (err) {
    console.warn('API offline or unreachable, using local fallback:', err.message);
  }

  // Start background polling to keep multiple browser tabs / mobile devices in sync
  if (!_syncInterval && typeof window !== 'undefined') {
    _syncInterval = setInterval(async () => {
      try {
        const fresh = await fetchJSON(`${BASE_URL}/all`);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(_cache)) {
          _cache = {
            filaments: fresh.filaments || [],
            transactions: fresh.transactions || [],
            orders: fresh.orders || [],
            printers: fresh.printers || [],
            consumables: fresh.consumables || [],
            accounts: fresh.accounts || [],
            leads: fresh.leads || [],
            messages: fresh.messages || [],
            settings: fresh.settings || _cache.settings,
            _seeded: fresh._seeded !== undefined ? fresh._seeded : true
          };
          _notify('all');
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 4000);
  }

  return true;
}

/** Synchronous read accessors (fast, reactive, no layout shifts) */
export function getAll(collection) {
  if (!_cache[collection]) _cache[collection] = [];
  return _cache[collection];
}

export function getById(collection, id) {
  const list = getAll(collection);
  return list.find(item => String(item.id) === String(id)) || null;
}

export function getSettings() {
  return _cache.settings || {};
}

export function isSeeded() {
  return _cache._seeded === true;
}

export async function markSeeded() {
  _cache._seeded = true;
  try {
    await updateSettings({ ..._cache.settings, _seeded: true });
  } catch {}
}

/** Stats calculation */
export function getStats() {
  const filaments = _cache.filaments || [];
  const transactions = _cache.transactions || [];
  const settings = _cache.settings || {};

  const totalSales = transactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfit = totalSales - totalExpenses;
  const netAfterMachine = netProfit - (settings.machineCost || 0);

  const totalSpools = filaments.reduce((sum, f) => sum + (f.spools || 0), 0);
  const usableSpools = filaments.filter(f => f.usable).reduce((sum, f) => sum + (f.spools || 0), 0);

  const materialBreakdown = {};
  filaments.forEach(f => {
    materialBreakdown[f.material] = (materialBreakdown[f.material] || 0) + (f.spools || 0);
  });

  const monthlyData = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { sales: 0, expenses: 0 };
    if (t.type === 'sale') monthlyData[month].sales += t.amount || 0;
    if (t.type === 'expense') monthlyData[month].expenses += t.amount || 0;
  });

  const accounts = _cache.accounts || [];
  const totalLiquidCapital = accounts.reduce((sum, a) => sum + getAccountBalance(a.id).balance, 0);

  return {
    totalSales,
    totalExpenses,
    netProfit,
    netAfterMachine,
    totalSpools,
    usableSpools,
    totalFilaments: filaments.length,
    totalLiquidCapital,
    materialBreakdown,
    monthlyData
  };
}

/** Calculate actual reconciled balance for a financial account */
export function getAccountBalance(accountId) {
  const account = (_cache.accounts || []).find(a => String(a.id) === String(accountId));
  if (!account) return { balance: 0, totalInflow: 0, totalOutflow: 0, openingBalance: 0 };

  const opening = parseFloat(account.openingBalance) || 0;
  const isPrimary = account.isPrimary || account.id === 'acc1';
  const transactions = _cache.transactions || [];
  const orders = _cache.orders || [];

  // Inflows:
  // 1. Transactions of type 'sale' assigned to this account
  const saleTx = transactions
    .filter(t => t.type === 'sale' && (t.accountId === accountId || (!t.accountId && isPrimary)))
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // 2. Order Payments that were not already logged as ledger transactions
  const recordedTxOrderIds = new Set(transactions.filter(t => t.orderId).map(t => t.orderId));
  const unlinkedOrderPayments = orders
    .filter(o => !recordedTxOrderIds.has(o.id))
    .flatMap(o => o.payments || [])
    .filter(p => p.accountId === accountId || (!p.accountId && isPrimary))
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // 3. Internal transfers IN
  const transfersIn = transactions
    .filter(t => t.type === 'transfer' && t.toAccountId === accountId)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // 4. Manual adjustments IN
  const adjustmentsIn = transactions
    .filter(t => t.type === 'adjustment' && t.accountId === accountId && (t.amount || 0) > 0)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const totalInflow = saleTx + unlinkedOrderPayments + transfersIn + adjustmentsIn;

  // Outflows:
  // 1. Transactions of type 'expense' assigned to this account
  const expenseTx = transactions
    .filter(t => t.type === 'expense' && (t.accountId === accountId || (!t.accountId && isPrimary)))
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // 2. Internal transfers OUT
  const transfersOut = transactions
    .filter(t => t.type === 'transfer' && t.fromAccountId === accountId)
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // 3. Manual adjustments OUT
  const adjustmentsOut = transactions
    .filter(t => t.type === 'adjustment' && t.accountId === accountId && (t.amount || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0);

  const totalOutflow = expenseTx + transfersOut + adjustmentsOut;
  const currentBalance = opening + totalInflow - totalOutflow;

  return {
    balance: currentBalance,
    totalInflow,
    totalOutflow,
    openingBalance: opening,
    account
  };
}

/** Transfer funds between two financial accounts */
export async function transferBetweenAccounts(fromId, toId, amount, notes = '') {
  const fromAcc = getById('accounts', fromId);
  const toAcc = getById('accounts', toId);
  const amt = parseFloat(amount) || 0;
  if (!fromAcc || !toAcc || amt <= 0) return null;

  const desc = notes || `Transfer from ${fromAcc.name} to ${toAcc.name}`;
  const tx = await create('transactions', {
    date: new Date().toISOString().split('T')[0],
    type: 'transfer',
    category: 'Transfer',
    fromAccountId: fromId,
    toAccountId: toId,
    amount: amt,
    description: desc,
  });

  return tx;
}

/** Reconcile account balance with manual adjustment */
export async function reconcileAccountBalance(accountId, verifiedBalance, notes = '') {
  const stats = getAccountBalance(accountId);
  const verified = parseFloat(verifiedBalance) || 0;
  const discrepancy = verified - stats.balance;

  if (Math.abs(discrepancy) < 0.01) return null;

  const tx = await create('transactions', {
    date: new Date().toISOString().split('T')[0],
    type: 'adjustment',
    category: 'Reconciliation',
    accountId: accountId,
    amount: discrepancy,
    description: notes || `Statement Reconciliation Discrepancy Adjustment (${discrepancy >= 0 ? '+' : ''}${discrepancy})`,
  });

  return tx;
}

/** CRUD Mutations (synchronously updates cache, asynchronously persists to API) */
export async function create(collection, item) {
  const newItem = {
    ...item,
    id: item.id || generateId(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!_cache[collection]) _cache[collection] = [];
  _cache[collection].push(newItem);
  _pushHistory('create', collection, newItem);
  _notify(collection);

  try {
    const saved = await fetchJSON(`${BASE_URL}/${collection}`, {
      method: 'POST',
      body: JSON.stringify(newItem)
    });
    return saved;
  } catch (err) {
    console.warn(`Created item locally (API sync pending):`, err.message);
    return newItem;
  }
}

export async function update(collection, id, updates) {
  if (!_cache[collection]) _cache[collection] = [];
  const idx = _cache[collection].findIndex(i => String(i.id) === String(id));
  if (idx === -1) return null;

  const oldItem = { ..._cache[collection][idx] };
  _cache[collection][idx] = {
    ..._cache[collection][idx],
    ...updates,
    id: _cache[collection][idx].id,
    updatedAt: new Date().toISOString()
  };

  _pushHistory('update', collection, oldItem);
  _notify(collection);

  try {
    const saved = await fetchJSON(`${BASE_URL}/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return saved;
  } catch (err) {
    console.warn(`Updated item locally (API sync pending):`, err.message);
    return _cache[collection][idx];
  }
}

export async function remove(collection, id) {
  if (!_cache[collection]) return null;
  const idx = _cache[collection].findIndex(i => String(i.id) === String(id));
  if (idx === -1) return null;

  const removed = _cache[collection].splice(idx, 1)[0];
  _pushHistory('delete', collection, removed);
  _notify(collection);

  try {
    await fetchJSON(`${BASE_URL}/${collection}/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn(`Deleted item locally (API sync pending):`, err.message);
  }
  return removed;
}

export async function bulkRemove(collection, ids) {
  const removed = [];
  for (const id of ids) {
    const r = await remove(collection, id);
    if (r) removed.push(r);
  }
  return removed;
}

export async function duplicate(collection, id) {
  const original = getById(collection, id);
  if (!original) return null;
  const { id: _old, createdAt, updatedAt, ...rest } = original;
  return await create(collection, {
    ...rest,
    name: original.name ? `${original.name} (copy)` : 'Copy'
  });
}

export async function updateSettings(updates) {
  _cache.settings = { ...(_cache.settings || {}), ...updates };
  _notify('settings');
  try {
    const saved = await fetchJSON(`${BASE_URL}/settings`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return saved;
  } catch (err) {
    console.warn('Updated settings locally (API sync pending):', err.message);
    return _cache.settings;
  }
}

/** Undo last action */
export async function undo() {
  if (_history.length === 0) return null;
  const last = _history.pop();
  const { action, collection, item } = last;

  try {
    if (action === 'create') {
      await remove(collection, item.id);
    } else if (action === 'delete') {
      await create(collection, item);
    } else if (action === 'update') {
      await update(collection, item.id, item);
    }
    _notify(collection);
    return last;
  } catch (e) {
    console.error('Undo failed:', e);
    return null;
  }
}

/** Search across all business collections */
export function search(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return { orders: [], filaments: [], printers: [], accounts: [], transactions: [] };

  const filaments = getAll('filaments');
  const transactions = getAll('transactions');
  const orders = getAll('orders');
  const printers = getAll('printers');
  const accounts = getAll('accounts');

  return {
    orders: orders.filter(o =>
      o.clientName?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.clientPhone?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      (o.items || []).some(it => it.name?.toLowerCase().includes(q))
    ),
    filaments: filaments.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.material?.toLowerCase().includes(q) ||
      f.brand?.toLowerCase().includes(q)
    ),
    printers: printers.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.iotHost?.includes(q) ||
      p.location?.toLowerCase().includes(q)
    ),
    accounts: accounts.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.institution?.toLowerCase().includes(q) ||
      a.accountNumber?.toLowerCase().includes(q)
    ),
    transactions: transactions.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    )
  };
}

/** Export and Import */
export function exportData() {
  return JSON.stringify({
    ..._cache,
    exportType: 'full_archive',
    version: '1.0',
    exportDate: new Date().toISOString()
  }, null, 2);
}

export function exportSettings() {
  return JSON.stringify({
    settings: _cache.settings,
    exportType: 'settings_only',
    version: '1.0',
    exportDate: new Date().toISOString()
  }, null, 2);
}

export function exportCSV(collection) {
  const items = getAll(collection);
  if (!items || items.length === 0) return '';

  if (collection === 'filaments') {
    const headers = ['Name', 'Material', 'Hex Color', 'Spools', 'Usable', 'Brand'];
    const rows = items.map(f => [
      `"${(f.name || '').replace(/"/g, '""')}"`,
      `"${f.material || ''}"`,
      `"${f.hex || ''}"`,
      f.spools || 0,
      f.usable ? 'Yes' : 'No',
      `"${f.brand || ''}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  if (collection === 'transactions') {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount (INR)'];
    const rows = items.map(t => [
      `"${t.date || ''}"`,
      `"${t.type || ''}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount || 0
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  if (collection === 'orders') {
    const headers = ['Order ID', 'Client Name', 'Phone', 'Stage', 'Status', 'Total (INR)'];
    const rows = items.map(o => [
      `"${o.id || ''}"`,
      `"${(o.clientName || '').replace(/"/g, '""')}"`,
      `"${o.clientPhone || ''}"`,
      `"${o.kanbanStage || ''}"`,
      `"${o.status || ''}"`,
      o.totalAmount || 0
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  if (collection === 'consumables') {
    const headers = ['Name', 'Category', 'Specs', 'Stock', 'Unit', 'Min Stock', 'Cost Per Unit (INR)', 'Supplier'];
    const rows = items.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.category || ''}"`,
      `"${(c.specs || '').replace(/"/g, '""')}"`,
      c.stock || 0,
      `"${c.unit || ''}"`,
      c.minStock || 0,
      c.costPerUnit || 0,
      `"${(c.supplier || '').replace(/"/g, '""')}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  if (collection === 'accounts') {
    const headers = ['Name', 'Type', 'Institution', 'Account Number', 'Opening Balance', 'Current Balance'];
    const rows = items.map(a => [
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.type || ''}"`,
      `"${(a.institution || '').replace(/"/g, '""')}"`,
      `"${a.accountNumber || ''}"`,
      a.openingBalance || 0,
      getAccountBalance(a.id).balance || 0
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  return '';
}

export async function importData(jsonStr, replace = true) {
  try {
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    const resp = await fetchJSON(`${BASE_URL}/import`, {
      method: 'POST',
      body: JSON.stringify({ jsonStr: JSON.stringify(parsed), replace })
    });

    if (resp.success) {
      await initStore();
      _notify('all');
      return { success: true, data: resp.data };
    }
    return { success: false, error: resp.error || 'Server rejected import' };
  } catch (err) {
    console.error('Import failed:', err);
    return { success: false, error: err.message };
  }
}

export async function clearAll() {
  _cache = {
    filaments: [],
    transactions: [],
    orders: [],
    printers: [],
    consumables: [],
    leads: [],
    messages: [],
    settings: {
      machineCost: 0,
      electricityRate: 8,
      printerPower: 350,
      defaultMarkup: 150,
      businessName: 'Made N More',
      currency: '₹',
      materialCosts: {}
    },
    _seeded: false
  };
  _notify('all');
  try {
    await fetchJSON(`${BASE_URL}/clear`, { method: 'POST' });
  } catch (err) {
    console.warn('Reset local only (API unreachable):', err.message);
  }
}

// ─── Cloud Website Synchronization Engine APIs ─────────────

/** Get status of background cloud sync engine */
export async function getSyncStatus() {
  try {
    return await fetchJSON(`${BASE_URL}/sync/status`);
  } catch (err) {
    return {
      isRunning: false,
      isSyncing: false,
      status: 'disconnected',
      lastError: err.message,
      stats: { quotesPulled: 0, ordersPulled: 0, contactsPulled: 0, updatesPushed: 0 }
    };
  }
}

/** Manually trigger an immediate pull & push synchronization cycle */
export async function triggerCloudSync() {
  try {
    const res = await fetchJSON(`${BASE_URL}/sync/trigger`, { method: 'POST' });
    // Re-hydrate local store cache immediately with fresh pulled leads & orders
    await initStore();
    _notify('all');
    return res;
  } catch (err) {
    console.error('Trigger sync error:', err);
    throw err;
  }
}

/** Test connectivity to Cloud Website API Gateway with custom endpoint and API key */
export async function testCloudConnection(cloudApiUrl, cloudApiKey) {
  try {
    return await fetchJSON(`${BASE_URL}/sync/test`, {
      method: 'POST',
      body: JSON.stringify({ cloudApiUrl, cloudApiKey })
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Update Cloud Sync configuration (URL, key, polling interval) */
export async function updateSyncConfig(config, persistToSettings = true) {
  try {
    const res = await fetchJSON(`${BASE_URL}/sync/config`, {
      method: 'POST',
      body: JSON.stringify({ ...config, persistToSettings })
    });
    if (persistToSettings && _cache.settings) {
      if (config.cloudApiUrl) _cache.settings.cloudApiUrl = config.cloudApiUrl;
      if (config.cloudApiKey) _cache.settings.cloudApiKey = config.cloudApiKey;
      if (config.syncIntervalSec) _cache.settings.syncIntervalSec = config.syncIntervalSec;
      _notify('settings');
    }
    return res;
  } catch (err) {
    console.error('Update sync config error:', err);
    throw err;
  }
}

// ─── Job Costing Matrix & Profit Calculation (ERP) ──────────

/**
 * Standard ERP Job Costing Engine for 3D Printing
 * Inputs: material, weightGrams, printHours, packaging, shipping, cadFee, sellingPrice/markupPct
 * Formula: Margin % = ((Selling Price - Total Cost) / Selling Price) * 100
 */
export function calculateJobCosting(params = {}) {
  const settings = getSettings();
  const material = params.material || 'PLA+';
  const weightGrams = Math.max(0, parseFloat(params.weightGrams || params.weight || 0));
  const printHours = Math.max(0, parseFloat(params.printHours || params.timeHours || params.hours || 0));
  
  const costPerKg = (settings.materialCosts && settings.materialCosts[material]) || 900;
  const materialCost = (weightGrams / 1000) * costPerKg;
  
  const powerWatts = parseFloat(params.powerWatts || settings.printerPower || 350);
  const elecRate = parseFloat(params.electricityRate || settings.electricityRate || 8.5);
  const electricityCost = printHours * (powerWatts / 1000) * elecRate;
  
  const wearRatePerHour = parseFloat(params.hourlyWearRate || 25); // ₹25/hr machine wear & maintenance sinking fund
  const machineWear = printHours * wearRatePerHour;
  
  const packaging = Math.max(0, parseFloat(params.packaging || 0));
  const shipping = Math.max(0, parseFloat(params.shipping || 0));
  const cadFee = Math.max(0, parseFloat(params.cadFee || params.designFee || 0));
  
  const totalCost = materialCost + electricityCost + machineWear + packaging + shipping + cadFee;
  
  const markupPct = params.markup !== undefined && params.markup !== null && params.markup !== ''
    ? parseFloat(params.markup)
    : (settings.defaultMarkup || 150);
    
  const suggestedPrice = Math.round(totalCost * (1 + markupPct / 100));
  
  let sellingPrice = params.sellingPrice !== undefined && params.sellingPrice !== null && params.sellingPrice !== ''
    ? parseFloat(params.sellingPrice)
    : suggestedPrice;
    
  if (isNaN(sellingPrice)) sellingPrice = suggestedPrice;
  
  const profit = sellingPrice - totalCost;
  const profitMarginPct = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;
  
  return {
    material,
    weightGrams,
    printHours,
    materialCost: Math.round(materialCost * 100) / 100,
    electricityCost: Math.round(electricityCost * 100) / 100,
    machineWear: Math.round(machineWear * 100) / 100,
    packaging: Math.round(packaging * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    cadFee: Math.round(cadFee * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    markupPct,
    suggestedPrice,
    sellingPrice: Math.round(sellingPrice),
    profit: Math.round(profit * 100) / 100,
    profitMarginPct: Math.round(profitMarginPct * 100) / 100
  };
}

// ─── Lead CRM & Pipeline Helpers ────────────────────────────

/** Transition Lead stage and sync update */
export async function updateLeadStage(leadId, newStage) {
  const lead = getById('leads', leadId);
  if (!lead) return null;
  const updated = await update('leads', leadId, {
    stage: newStage,
    updatedAt: new Date().toISOString()
  });
  return updated;
}

/** Convert a Lead / Quote directly into an Active Production Order */
export async function convertLeadToOrder(leadId, overrides = {}) {
  const lead = getById('leads', leadId);
  if (!lead) throw new Error(`Lead #${leadId} not found`);

  const costing = lead.costing || calculateJobCosting({
    material: lead.material,
    weightGrams: lead.weightGrams || 60,
    printHours: lead.printHours || 2.5,
    sellingPrice: lead.quotedPrice
  });

  const orderPrice = overrides.totalAmount || lead.quotedPrice || costing.sellingPrice || 1000;

  const newOrder = await create('orders', {
    clientName: lead.clientName || 'Website Client',
    clientPhone: lead.clientPhone || '',
    clientEmail: lead.clientEmail || '',
    clientGstin: overrides.clientGstin || lead.clientGstin || '',
    description: overrides.description || lead.notes || `Production for ${lead.clientName}`,
    priority: overrides.priority || 'standard',
    kanbanStage: 'slicing', // New orders start at slicing/pre-flight
    status: 'active',
    notes: `Converted from Lead #${lead.id}. ${lead.notes || ''}`.trim(),
    leadId: lead.id,
    source: lead.source || 'crm_lead',
    items: overrides.items || [
      {
        id: `it_${Date.now()}_1`,
        name: lead.partName || (lead.cadFiles && lead.cadFiles[0]?.name) || `${lead.material} 3D Printed Part`,
        material: lead.material || 'PLA+',
        color: lead.color || 'Standard',
        quantity: parseInt(lead.quantity, 10) || 1,
        unitPrice: Math.round(orderPrice / (parseInt(lead.quantity, 10) || 1)),
        subtotal: orderPrice,
        status: 'queued'
      }
    ],
    totalAmount: orderPrice,
    costingBreakdown: costing,
    payments: overrides.payments || [],
    createdAt: new Date().toISOString()
  });

  // Advance lead stage to 'won' and link the created order ID
  await update('leads', lead.id, {
    stage: 'won',
    convertedOrderId: newOrder.id,
    updatedAt: new Date().toISOString()
  });

  return newOrder;
}

