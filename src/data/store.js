/**
 * Made N More — Data Store
 * localStorage-based CRUD with export/import and undo support
 */

const STORE_KEY = 'madeNMore_data';
const HISTORY_KEY = 'madeNMore_history';
const MAX_HISTORY = 50;

let _data = null;
let _listeners = [];
let _history = [];

/** Generate a unique ID */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Get default data structure */
function getDefaultData() {
  return {
    filaments: [],
    transactions: [],
    orders: [],
    printers: [],
    consumables: [],
    settings: {
      machineCost: 115881.32,
      electricityRate: 8.5,
      printerPower: 350,
      defaultMarkup: 30,
      businessName: 'Made N More',
      currency: '₹',
      materialCosts: {
        'PLA+': 700,
        'PETG-HS': 900,
        'ABS': 850,
        'TPU+': 1200,
        'PLA Silk': 950,
        'PLA Matt': 800,
      },
    },
    _seeded: false,
  };
}

/** Initialize the store, loading from localStorage */
export function initStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      _data = JSON.parse(raw);
    } catch {
      _data = getDefaultData();
    }
  } else {
    _data = getDefaultData();
  }
  // Load history
  const histRaw = localStorage.getItem(HISTORY_KEY);
  if (histRaw) {
    try { _history = JSON.parse(histRaw); } catch { _history = []; }
  }
  return _data;
}

/** Persist current state */
function _save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(_data));
}

/** Push to undo history */
function _pushHistory(action, collection, item) {
  _history.push({ action, collection, item: JSON.parse(JSON.stringify(item)), timestamp: Date.now() });
  if (_history.length > MAX_HISTORY) _history.shift();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(_history));
}

/** Notify listeners */
function _notify(collection) {
  _listeners.forEach(fn => fn(collection));
}

/** Subscribe to changes */
export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

/** Check if data has been seeded */
export function isSeeded() {
  return _data?._seeded === true;
}

/** Mark as seeded */
export function markSeeded() {
  _data._seeded = true;
  _save();
}

// ─── CRUD Operations ────────────────────────────────────────

/** Get all items in a collection */
export function getAll(collection) {
  return _data[collection] || [];
}

/** Get item by ID */
export function getById(collection, id) {
  return (_data[collection] || []).find(item => item.id === id);
}

/** Create a new item */
export function create(collection, item) {
  const newItem = {
    ...item,
    id: item.id || generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!_data[collection]) _data[collection] = [];
  _data[collection].push(newItem);
  _pushHistory('create', collection, newItem);
  _save();
  _notify(collection);
  return newItem;
}

/** Update an existing item */
export function update(collection, id, updates) {
  const arr = _data[collection] || [];
  const idx = arr.findIndex(item => item.id === id);
  if (idx === -1) return null;
  const oldItem = { ...arr[idx] };
  _pushHistory('update', collection, oldItem);
  arr[idx] = { ...arr[idx], ...updates, updatedAt: new Date().toISOString() };
  _save();
  _notify(collection);
  return arr[idx];
}

/** Delete an item */
export function remove(collection, id) {
  const arr = _data[collection] || [];
  const idx = arr.findIndex(item => item.id === id);
  if (idx === -1) return null;
  const removed = arr.splice(idx, 1)[0];
  _pushHistory('delete', collection, removed);
  _save();
  _notify(collection);
  return removed;
}

/** Bulk delete */
export function bulkRemove(collection, ids) {
  const removedItems = [];
  ids.forEach(id => {
    const idx = (_data[collection] || []).findIndex(item => item.id === id);
    if (idx !== -1) {
      removedItems.push(_data[collection].splice(idx, 1)[0]);
    }
  });
  removedItems.forEach(item => _pushHistory('delete', collection, item));
  _save();
  _notify(collection);
  return removedItems;
}

/** Duplicate an item */
export function duplicate(collection, id) {
  const original = getById(collection, id);
  if (!original) return null;
  const { id: _id, createdAt, updatedAt, ...rest } = original;
  return create(collection, { ...rest, name: original.name ? `${original.name} (copy)` : undefined });
}

/** Undo last action — returns the undone action info or null */
export function undo() {
  if (_history.length === 0) return null;
  const last = _history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(_history));

  if (last.action === 'create') {
    // Undo create → remove the item
    const arr = _data[last.collection] || [];
    const idx = arr.findIndex(item => item.id === last.item.id);
    if (idx !== -1) arr.splice(idx, 1);
  } else if (last.action === 'delete') {
    // Undo delete → re-add the item
    if (!_data[last.collection]) _data[last.collection] = [];
    _data[last.collection].push(last.item);
  } else if (last.action === 'update') {
    // Undo update → restore old item
    const arr = _data[last.collection] || [];
    const idx = arr.findIndex(item => item.id === last.item.id);
    if (idx !== -1) arr[idx] = last.item;
  }

  _save();
  _notify(last.collection);
  return last;
}

// ─── Settings ──────────────────────────────────────────────

/** Get settings */
export function getSettings() {
  return _data.settings;
}

/** Update settings */
export function updateSettings(updates) {
  _data.settings = { ..._data.settings, ...updates };
  _save();
  _notify('settings');
  return _data.settings;
}

// ─── Search ────────────────────────────────────────────────

/** Search across collections */
export function search(query) {
  const q = query.toLowerCase().trim();
  if (!q) return { filaments: [], transactions: [] };

  const filaments = (_data.filaments || []).filter(f =>
    f.name?.toLowerCase().includes(q) ||
    f.material?.toLowerCase().includes(q) ||
    f.brand?.toLowerCase().includes(q)
  );

  const transactions = (_data.transactions || []).filter(t =>
    t.description?.toLowerCase().includes(q) ||
    t.category?.toLowerCase().includes(q)
  );

  return { filaments, transactions };
}

// ─── Export / Import ───────────────────────────────────────

/** Export all data as JSON string */
export function exportData() {
  return JSON.stringify(_data, null, 2);
}

/** Import data from JSON string — merges or replaces */
export function importData(jsonStr, replace = true) {
  try {
    const imported = JSON.parse(jsonStr);
    if (replace) {
      _data = { ...getDefaultData(), ...imported };
    } else {
      // Merge: add non-duplicate items
      ['filaments', 'transactions'].forEach(col => {
        const existingIds = new Set((_data[col] || []).map(i => i.id));
        (imported[col] || []).forEach(item => {
          if (!existingIds.has(item.id)) {
            _data[col].push(item);
          }
        });
      });
    }
    _save();
    _notify('all');
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

/** Export as CSV */
export function exportCSV(collection) {
  const items = _data[collection] || [];
  if (items.length === 0) return '';
  const headers = Object.keys(items[0]);
  const rows = items.map(item => headers.map(h => {
    let val = item[h];
    if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
    return val ?? '';
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

/** Clear all data */
export function clearAll() {
  _data = getDefaultData();
  _history = [];
  _save();
  localStorage.removeItem(HISTORY_KEY);
  _notify('all');
}

/** Get stats for dashboard */
export function getStats() {
  const transactions = _data.transactions || [];
  const filaments = _data.filaments || [];

  const totalSales = transactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfit = totalSales - totalExpenses;
  const netAfterMachine = netProfit - (_data.settings.machineCost || 0);

  const totalSpools = filaments.reduce((sum, f) => sum + (f.spools || 0), 0);
  const usableSpools = filaments.filter(f => f.usable).reduce((sum, f) => sum + (f.spools || 0), 0);

  // Material breakdown
  const materialBreakdown = {};
  filaments.forEach(f => {
    const mat = f.material || 'Other';
    if (!materialBreakdown[mat]) materialBreakdown[mat] = 0;
    materialBreakdown[mat] += f.spools || 0;
  });

  // Monthly revenue
  const monthlyData = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { sales: 0, expenses: 0 };
    if (t.type === 'sale') monthlyData[key].sales += t.amount || 0;
    else monthlyData[key].expenses += t.amount || 0;
  });

  return {
    totalSales,
    totalExpenses,
    netProfit,
    netAfterMachine,
    totalSpools,
    usableSpools,
    totalFilaments: filaments.length,
    materialBreakdown,
    monthlyData,
    machineCost: _data.settings.machineCost || 0,
  };
}
