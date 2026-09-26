// server/syncEngine.js — Bi-Directional Cloud Website Synchronization Daemon
// Connects MadeNMore local workshop to the public cloud website API Gateway

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.resolve(__dirname, '../.env');

// Simple .env parser to avoid requiring external packages if not present
function parseEnvFile() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    try {
      const content = fs.readFileSync(ENV_FILE, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      });
    } catch (err) {
      console.warn('Could not read .env file:', err.message);
    }
  }
  return env;
}

export class SyncEngine {
  constructor(options = {}) {
    const fileEnv = parseEnvFile();
    this.cloudApiUrl = (options.cloudApiUrl || process.env.CLOUD_API_URL || fileEnv.CLOUD_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
    this.cloudApiKey = options.cloudApiKey || process.env.CLOUD_SYNC_API_KEY || fileEnv.CLOUD_SYNC_API_KEY || 'mm_live_sync_secret_2026_key';
    this.syncIntervalSec = parseInt(options.syncIntervalSec || process.env.SYNC_INTERVAL_SEC || fileEnv.SYNC_INTERVAL_SEC || '20', 10);
    
    this.loadDataFn = options.loadData || (() => ({}));
    this.saveDataFn = options.saveData || (() => {});
    
    this.cursorTimestamp = 0;
    this.isRunning = false;
    this.timer = null;
    this.isSyncing = false;
    this.lastPullTime = null;
    this.lastPushTime = null;
    this.lastError = null;
    this.lastStatus = 'idle'; // 'idle' | 'syncing' | 'connected' | 'error' | 'disconnected'
    this.syncedStats = {
      quotesPulled: 0,
      ordersPulled: 0,
      contactsPulled: 0,
      updatesPushed: 0,
      totalSyncCycles: 0,
    };
    this.pendingQueue = [];
  }

  updateConfig(config = {}) {
    if (config.cloudApiUrl !== undefined) this.cloudApiUrl = config.cloudApiUrl.replace(/\/+$/, '');
    if (config.cloudApiKey !== undefined) this.cloudApiKey = config.cloudApiKey;
    if (config.syncIntervalSec !== undefined) {
      this.syncIntervalSec = Math.max(5, parseInt(config.syncIntervalSec, 10) || 20);
      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
    return this.getStatus();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      cloudApiUrl: this.cloudApiUrl,
      cloudApiKeyConfigured: Boolean(this.cloudApiKey),
      syncIntervalSec: this.syncIntervalSec,
      cursorTimestamp: this.cursorTimestamp,
      lastPullTime: this.lastPullTime,
      lastPushTime: this.lastPushTime,
      lastError: this.lastError,
      status: this.lastStatus,
      stats: this.syncedStats,
      pendingQueueSize: this.pendingQueue.length
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`📡 [SyncEngine] Starting synchronization daemon against ${this.cloudApiUrl} (every ${this.syncIntervalSec}s)`);
    
    // Run an initial sync immediately
    this.syncCycle().catch(err => {
      console.warn(`[SyncEngine] Initial sync failed:`, err.message);
    });

    this.timer = setInterval(() => {
      this.syncCycle().catch(err => {
        // Handled internally in syncCycle
      });
    }, this.syncIntervalSec * 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`⏹️ [SyncEngine] Sync daemon stopped.`);
  }

  // Queue a local update (stage transition, costing matrix calculation, order status, etc.) to push to cloud
  queuePushUpdate(type, data) {
    this.pendingQueue.push({
      id: `push_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type, // 'lead_update' | 'order_update' | 'costing_update' | 'catalog_sync'
      data,
      timestamp: new Date().toISOString()
    });
  }

  async testConnection(customUrl = null, customKey = null) {
    const targetUrl = (customUrl || this.cloudApiUrl).replace(/\/+$/, '');
    const apiKey = customKey || this.cloudApiKey;
    const startTime = Date.now();

    try {
      const resp = await fetch(`${targetUrl}/api/v1/sync/pull?since=0`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        signal: AbortSignal.timeout(6000)
      });

      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          success: false,
          status: resp.status,
          latencyMs,
          error: `HTTP ${resp.status}: ${text || resp.statusText}`
        };
      }

      const json = await resp.json().catch(() => ({}));
      return {
        success: true,
        status: resp.status,
        latencyMs,
        data: json,
        message: 'Successfully connected to cloud API Gateway'
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.name === 'TimeoutError' ? 'Connection timed out after 6000ms' : err.message
      };
    }
  }

  async syncCycle() {
    if (this.isSyncing) return { skipped: true, reason: 'Already in progress' };
    this.isSyncing = true;
    this.lastStatus = 'syncing';

    try {
      const pullResult = await this.pullFromCloud();
      let pushResult = null;

      if (this.pendingQueue.length > 0 || (pullResult.acknowledgedIds && Object.keys(pullResult.acknowledgedIds).length > 0)) {
        pushResult = await this.pushToCloud(pullResult.acknowledgedIds);
      }

      this.lastStatus = 'connected';
      this.lastError = null;
      this.syncedStats.totalSyncCycles++;

      return {
        success: true,
        pull: pullResult,
        push: pushResult,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      this.lastStatus = 'error';
      this.lastError = err.message;
      // Do not log continuous spam if cloud is down or unreachable
      if (err.name !== 'TimeoutError' && !err.message.includes('fetch failed')) {
        console.error(`[SyncEngine Error]`, err.message);
      }
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async pullFromCloud() {
    const url = `${this.cloudApiUrl}/api/v1/sync/pull?since=${this.cursorTimestamp}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.cloudApiKey
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Sync pull failed [HTTP ${resp.status}]: ${text || resp.statusText}`);
    }

    const payload = await resp.json();
    this.lastPullTime = new Date().toISOString();

    const data = this.loadDataFn();
    if (!data.leads) data.leads = [];
    if (!data.orders) data.orders = [];
    if (!data.messages) data.messages = [];

    const acknowledgedIds = {
      quoteIds: [],
      orderIds: [],
      contactIds: []
    };

    let hasModifications = false;

    // 1. Ingest Quotes / Custom 3D Briefs
    const quotes = payload.quotes || payload.quoteRequests || [];
    if (Array.isArray(quotes) && quotes.length > 0) {
      quotes.forEach(q => {
        const quoteId = q.id || `quote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        acknowledgedIds.quoteIds.push(quoteId);

        const existingIdx = data.leads.findIndex(l => l.id === quoteId || (l.cloudQuoteId && l.cloudQuoteId === quoteId));
        
        const leadObj = {
          id: quoteId,
          cloudQuoteId: quoteId,
          source: 'cloud_quote',
          clientName: q.clientName || q.name || q.customerName || 'Anonymous Client',
          clientEmail: q.clientEmail || q.email || '',
          clientPhone: q.clientPhone || q.phone || '',
          material: q.material || 'PLA+',
          color: q.color || 'Standard / Any',
          quantity: parseInt(q.quantity, 10) || 1,
          deadline: q.deadline || q.requiredDate || '',
          notes: q.notes || q.description || q.message || '',
          fileCadUrl: q.fileUrl || q.cadFileUrl || q.fileCadUrl || '',
          cadFiles: q.cadFiles || (q.fileUrl ? [{ name: q.fileName || 'Model.stl', url: q.fileUrl, size: q.fileSize }] : []),
          dimensions: q.dimensions || '',
          infillPercentage: q.infillPercentage || q.infill || 20,
          layerResolution: q.layerResolution || q.resolution || '0.20mm (Standard)',
          stage: q.stage || 'new', // new -> contacted -> interested -> quoted -> won -> lost
          costing: q.costing || {
            materialCost: 0,
            electricityCost: 0,
            machineWear: 0,
            packaging: 0,
            shipping: 0,
            cadFee: 0,
            totalCost: 0,
            sellingPrice: q.budget || 0,
            profit: 0,
            profitMarginPct: 0
          },
          quotedPrice: q.quotedPrice || q.budget || 0,
          createdAt: q.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          // Merge preserving local changes if stage advanced locally
          data.leads[existingIdx] = {
            ...leadObj,
            ...data.leads[existingIdx],
            // Update cloud reference fields
            cadFiles: leadObj.cadFiles.length ? leadObj.cadFiles : data.leads[existingIdx].cadFiles,
            fileCadUrl: leadObj.fileCadUrl || data.leads[existingIdx].fileCadUrl,
            syncedAt: new Date().toISOString()
          };
        } else {
          data.leads.unshift(leadObj);
          this.syncedStats.quotesPulled++;
        }
        hasModifications = true;
      });
    }

    // 2. Ingest Store Orders / Checkouts
    const orders = payload.orders || payload.storeOrders || [];
    if (Array.isArray(orders) && orders.length > 0) {
      orders.forEach(ord => {
        const ordId = ord.id || `ord_cloud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        acknowledgedIds.orderIds.push(ordId);

        const existingIdx = data.orders.findIndex(o => o.id === ordId || (o.cloudOrderId && o.cloudOrderId === ordId));

        const orderObj = {
          id: ordId,
          cloudOrderId: ordId,
          source: 'cloud_website',
          clientName: ord.clientName || ord.name || ord.customerName || 'Online Store Customer',
          clientPhone: ord.clientPhone || ord.phone || '',
          clientEmail: ord.clientEmail || ord.email || '',
          clientGstin: ord.clientGstin || ord.gstin || '',
          shippingAddress: ord.shippingAddress || ord.address || '',
          description: ord.description || `Website Store Order #${ordId.slice(-6).toUpperCase()}`,
          priority: ord.priority || 'standard',
          kanbanStage: ord.kanbanStage || ord.stage || (ord.paid ? 'advance_paid' : 'in_queue'),
          status: ord.status || 'active',
          notes: ord.notes || 'Placed via Website Cloud Store Checkout',
          items: Array.isArray(ord.items) && ord.items.length > 0 ? ord.items.map((it, idx) => ({
            id: it.id || `it_c_${idx + 1}`,
            name: it.name || it.title || '3D Printed Product',
            material: it.material || 'PLA+',
            color: it.color || 'Standard',
            quantity: parseInt(it.quantity, 10) || 1,
            unitPrice: parseFloat(it.unitPrice || it.price) || 0,
            subtotal: (parseInt(it.quantity, 10) || 1) * (parseFloat(it.unitPrice || it.price) || 0),
            status: it.status || 'queued'
          })) : [
            {
              id: `it_${ordId}_1`,
              name: ord.itemName || 'Custom 3D Printing Service',
              material: ord.material || 'PLA+',
              color: ord.color || 'Standard',
              quantity: parseInt(ord.quantity, 10) || 1,
              unitPrice: parseFloat(ord.totalAmount || ord.total || 0),
              subtotal: parseFloat(ord.totalAmount || ord.total || 0),
              status: 'queued'
            }
          ],
          totalAmount: parseFloat(ord.totalAmount || ord.total || 0),
          payments: Array.isArray(ord.payments) && ord.payments.length > 0 ? ord.payments : (ord.paid ? [
            {
              id: `pay_${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              percentage: 100,
              amount: parseFloat(ord.totalAmount || ord.total || 0),
              notes: 'Website Gateway Payment (Prepaid Online)'
            }
          ] : []),
          createdAt: ord.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          data.orders[existingIdx] = {
            ...orderObj,
            ...data.orders[existingIdx],
            updatedAt: new Date().toISOString()
          };
        } else {
          data.orders.unshift(orderObj);
          this.syncedStats.ordersPulled++;
        }
        hasModifications = true;
      });
    }

    // 3. Ingest Technical & General Contact Messages
    const contactMessages = payload.contactMessages || payload.contacts || payload.messages || [];
    if (Array.isArray(contactMessages) && contactMessages.length > 0) {
      contactMessages.forEach(msg => {
        const msgId = msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        acknowledgedIds.contactIds.push(msgId);

        // Also create as a new CRM lead for immediate sales follow-up
        const existingLeadIdx = data.leads.findIndex(l => l.cloudContactId === msgId || (l.id === msgId));
        if (existingLeadIdx === -1) {
          data.leads.unshift({
            id: msgId,
            cloudContactId: msgId,
            source: 'cloud_contact_inquiry',
            clientName: msg.name || msg.clientName || 'Inquiry Contact',
            clientEmail: msg.email || msg.clientEmail || '',
            clientPhone: msg.phone || msg.clientPhone || '',
            material: msg.material || 'PLA+',
            quantity: 1,
            deadline: '',
            notes: msg.message || msg.subject || msg.notes || 'Inquiry from website contact form',
            fileCadUrl: msg.fileUrl || '',
            cadFiles: msg.fileUrl ? [{ name: 'Attachment', url: msg.fileUrl }] : [],
            stage: 'new',
            costing: {
              materialCost: 0,
              electricityCost: 0,
              machineWear: 0,
              packaging: 0,
              shipping: 0,
              cadFee: 0,
              totalCost: 0,
              sellingPrice: 0,
              profit: 0,
              profitMarginPct: 0
            },
            quotedPrice: 0,
            createdAt: msg.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedAt: new Date().toISOString()
          });
          this.syncedStats.contactsPulled++;
          hasModifications = true;
        }

        // Store in raw messages log
        const existingMsg = data.messages.find(m => m.id === msgId);
        if (!existingMsg) {
          data.messages.unshift({
            id: msgId,
            sender: msg.name || 'Website Visitor',
            email: msg.email || '',
            phone: msg.phone || '',
            subject: msg.subject || 'Website Message',
            message: msg.message || '',
            createdAt: msg.createdAt || new Date().toISOString()
          });
          hasModifications = true;
        }
      });
    }

    if (payload.timestamp) {
      this.cursorTimestamp = payload.timestamp;
    } else {
      this.cursorTimestamp = Date.now();
    }

    if (hasModifications) {
      this.saveDataFn(data);
    }

    return {
      quotesCount: quotes.length,
      ordersCount: orders.length,
      contactsCount: contactMessages.length,
      acknowledgedIds
    };
  }

  async pushToCloud(acknowledgedIds = {}) {
    const queueToPush = [...this.pendingQueue];
    this.pendingQueue = []; // flush

    const payload = {
      acknowledgedIds: acknowledgedIds || {},
      updates: queueToPush,
      timestamp: Date.now()
    };

    try {
      const resp = await fetch(`${this.cloudApiUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.cloudApiKey
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      this.lastPushTime = new Date().toISOString();

      if (!resp.ok) {
        // Put back in queue if failed
        this.pendingQueue.unshift(...queueToPush);
        const text = await resp.text().catch(() => '');
        throw new Error(`Sync push failed [HTTP ${resp.status}]: ${text || resp.statusText}`);
      }

      const result = await resp.json().catch(() => ({ success: true }));
      this.syncedStats.updatesPushed += queueToPush.length;
      return result;
    } catch (err) {
      this.pendingQueue.unshift(...queueToPush);
      throw err;
    }
  }
}

export const syncEngineInstance = new SyncEngine();
