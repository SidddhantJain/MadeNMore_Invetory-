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
  settings: {
    machineCost: 55000,
    electricityRate: 8.5,
    printerPower: 350,
    defaultMarkup: 150,
    businessName: 'Made N More',
    currency: '₹',
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
  // 1. Transactions of type 'sale' assigned to this account, or unassigned fallback to primary
  const saleTx = transactions
    .filter(t => t.type === 'sale' && (t.accountId === accountId || (!t.accountId && isPrimary)))
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  // 2. Order Payments assigned to this account
  const orderPayments = orders
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

  const totalInflow = saleTx + orderPayments + transfersIn + adjustmentsIn;

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

/** Search across collections */
export function search(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return { filaments: [], transactions: [], orders: [] };

  const filaments = getAll('filaments');
  const transactions = getAll('transactions');
  const orders = getAll('orders');

  return {
    filaments: filaments.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.material?.toLowerCase().includes(q) ||
      f.brand?.toLowerCase().includes(q)
    ),
    transactions: transactions.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    ),
    orders: orders.filter(o =>
      o.clientName?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q)
    )
  };
}

/** Export and Import */
export function exportData() {
  return JSON.stringify(_cache, null, 2);
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
      return true;
    }
    return false;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

export async function clearAll() {
  _cache = {
    filaments: [],
    transactions: [],
    orders: [],
    printers: [],
    consumables: [],
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
