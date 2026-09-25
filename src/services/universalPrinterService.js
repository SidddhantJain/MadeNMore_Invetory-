/**
 * Made N More — Universal Printer Telemetry & Control Adapter
 * Unified Fleet Protocol supporting:
 *  1. Moonraker (Klipper — Snapmaker U1, Voron 2.4, Creality K1, Elegoo Neptune 4)
 *  2. OctoPrint (Marlin / RepRap — Ender 3, Prusa MK3S, Anycubic, CR-10)
 *  3. Bambu Lab Local LAN (MQTT/FTPS — X1C, P1S, P1P, A1, A1 Mini + AMS)
 *  4. PrusaLink (Prusa MK4, XL, Mini)
 *  5. WebSerial (Direct USB COM port — 115200 / 250000 baud raw G-code streaming)
 */

import { showToast } from '../components/toast.js';

export const PROTOCOLS = {
  MOONRAKER: 'moonraker',
  OCTOPRINT: 'octoprint',
  BAMBU: 'bambu',
  PRUSALINK: 'prusalink',
  SERIAL: 'serial',
};

export const PROTOCOL_CONFIG = {
  [PROTOCOLS.MOONRAKER]: {
    label: 'Klipper (Moonraker)',
    icon: '📡',
    defaultPort: 80,
    desc: 'Snapmaker U1, Voron, Creality K1, Neptune 4, Sovol SV07',
  },
  [PROTOCOLS.OCTOPRINT]: {
    label: 'OctoPrint (Marlin)',
    icon: '🐙',
    defaultPort: 5000,
    desc: 'Ender 3/V2/Neo, Prusa MK3S, Anycubic Kobra, CR-10',
  },
  [PROTOCOLS.BAMBU]: {
    label: 'Bambu Lab LAN (MQTT)',
    icon: '🐼',
    defaultPort: 8883,
    desc: 'X1-Carbon, P1S, P1P, A1, A1 Mini + AMS multi-color',
  },
  [PROTOCOLS.PRUSALINK]: {
    label: 'PrusaLink REST',
    icon: '🧡',
    defaultPort: 80,
    desc: 'Original Prusa MK4, XL multi-tool, MINI+',
  },
  [PROTOCOLS.SERIAL]: {
    label: 'Direct Serial USB (COM)',
    icon: '🔌',
    defaultPort: 115200,
    desc: 'Direct USB browser link for standalone Marlin/RepRap',
  },
};

// Global WebSerial Port Handle for direct USB connection
let _serialPort = null;
let _serialReader = null;
let _serialWriter = null;
let _serialConnected = false;

/**
 * Fetch Normalized Telemetry from ANY printer protocol
 * @param {Object} printer - Printer record from store
 * @returns {Promise<Object>} Normalized telemetry object
 */
export async function fetchUniversalTelemetry(printer) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost || '127.0.0.1';
  const port = printer.iotPort || PROTOCOL_CONFIG[protocol]?.defaultPort || 80;
  const apiKey = printer.apiKey || '';
  const accessCode = printer.accessCode || '';
  const serialNo = printer.serialNo || '';

  // 1. Direct WebSerial USB Connection
  if (protocol === PROTOCOLS.SERIAL) {
    return {
      online: _serialConnected,
      protocol: PROTOCOLS.SERIAL,
      state: _serialConnected ? (printer.status || 'idle') : 'offline',
      nozzleTemp: printer.currentNozzleTemp || 25,
      targetNozzleTemp: printer.targetNozzleTemp || 0,
      bedTemp: printer.currentBedTemp || 25,
      targetBedTemp: printer.targetBedTemp || 0,
      jobProgress: printer.jobProgress || 0,
      currentJob: printer.currentJob || null,
      message: _serialConnected ? 'Serial Port Active' : 'Disconnected',
    };
  }

  // 2. OctoPrint Protocol
  if (protocol === PROTOCOLS.OCTOPRINT) {
    try {
      const url = `/api/printer/octoprint/status?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        online: data.online !== false,
        protocol: PROTOCOLS.OCTOPRINT,
        state: data.state || 'idle',
        nozzleTemp: Math.round(data.nozzleTemp || 0),
        targetNozzleTemp: Math.round(data.targetNozzleTemp || 0),
        bedTemp: Math.round(data.bedTemp || 0),
        targetBedTemp: Math.round(data.targetBedTemp || 0),
        jobProgress: Math.round(data.progress || 0),
        currentJob: data.filename || null,
        printTime: data.printTime || 0,
        printTimeLeft: data.printTimeLeft || 0,
        raw: data,
      };
    } catch (e) {
      return { online: false, protocol: PROTOCOLS.OCTOPRINT, state: 'offline', error: e.message };
    }
  }

  // 3. Bambu Lab Local LAN Protocol
  if (protocol === PROTOCOLS.BAMBU) {
    try {
      const url = `/api/printer/bambu/status?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&accessCode=${encodeURIComponent(accessCode)}&serial=${encodeURIComponent(serialNo)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        online: data.online !== false,
        protocol: PROTOCOLS.BAMBU,
        state: data.state || 'idle',
        nozzleTemp: Math.round(data.nozzleTemp || 0),
        targetNozzleTemp: Math.round(data.targetNozzleTemp || 0),
        bedTemp: Math.round(data.bedTemp || 0),
        targetBedTemp: Math.round(data.targetBedTemp || 0),
        chamberTemp: Math.round(data.chamberTemp || 0),
        jobProgress: Math.round(data.progress || 0),
        currentJob: data.subtaskName || data.filename || null,
        amsSlots: data.amsSlots || [],
        activeTray: data.activeTray || 0,
        speedLevel: data.speedLevel || 1, // 1: Silent, 2: Standard, 3: Sport, 4: Ludicrous
        raw: data,
      };
    } catch (e) {
      return { online: false, protocol: PROTOCOLS.BAMBU, state: 'offline', error: e.message };
    }
  }

  // 4. PrusaLink Protocol
  if (protocol === PROTOCOLS.PRUSALINK) {
    try {
      const url = `/api/printer/prusalink/status?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        online: data.online !== false,
        protocol: PROTOCOLS.PRUSALINK,
        state: data.state || 'idle',
        nozzleTemp: Math.round(data.nozzleTemp || 0),
        targetNozzleTemp: Math.round(data.targetNozzleTemp || 0),
        bedTemp: Math.round(data.bedTemp || 0),
        targetBedTemp: Math.round(data.targetBedTemp || 0),
        jobProgress: Math.round(data.progress || 0),
        currentJob: data.jobName || null,
        timeRemaining: data.timeRemaining || 0,
        raw: data,
      };
    } catch (e) {
      return { online: false, protocol: PROTOCOLS.PRUSALINK, state: 'offline', error: e.message };
    }
  }

  // 5. Default: Klipper (Moonraker) Protocol (Snapmaker U1, Voron, K1)
  try {
    const url = `/api/printer/status?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const status = data.result?.status || {};
    const extruder = status.extruder || {};
    const bed = status.heater_bed || {};
    const printStats = status.print_stats || {};
    const dispStatus = status.display_status || {};

    const progressPct = Math.round(dispStatus.progress ? dispStatus.progress * 100 : (printStats.progress || 0) * 100);
    const klipperState = printStats.state?.toLowerCase() || 'idle';
    const state = klipperState === 'printing' ? 'printing' : klipperState === 'paused' ? 'paused' : 'idle';

    return {
      online: true,
      protocol: PROTOCOLS.MOONRAKER,
      state,
      nozzleTemp: Math.round(extruder.temperature || 0),
      targetNozzleTemp: Math.round(extruder.target || 0),
      bedTemp: Math.round(bed.temperature || 0),
      targetBedTemp: Math.round(bed.target || 0),
      jobProgress: progressPct,
      currentJob: printStats.filename || null,
      printDuration: Math.round((printStats.print_duration || 0) / 60),
      raw: data,
    };
  } catch (e) {
    return { online: false, protocol: PROTOCOLS.MOONRAKER, state: 'offline', error: e.message };
  }
}

/**
 * Send G-Code script to ANY printer protocol
 */
export async function sendUniversalGcode(printer, script) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost || '127.0.0.1';
  const port = printer.iotPort || PROTOCOL_CONFIG[protocol]?.defaultPort || 80;

  if (protocol === PROTOCOLS.SERIAL) {
    return sendSerialCommand(script);
  }

  if (protocol === PROTOCOLS.OCTOPRINT) {
    const res = await fetch('/api/printer/octoprint/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, apiKey: printer.apiKey, command: script }),
    });
    return res.json();
  }

  if (protocol === PROTOCOLS.BAMBU) {
    const res = await fetch('/api/printer/bambu/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, accessCode: printer.accessCode, serial: printer.serialNo, command: script }),
    });
    return res.json();
  }

  if (protocol === PROTOCOLS.PRUSALINK) {
    const res = await fetch('/api/printer/prusalink/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, apiKey: printer.apiKey, command: script }),
    });
    return res.json();
  }

  // Moonraker
  const res = await fetch('/api/printer/gcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, port, script }),
  });
  return res.json();
}

/**
 * Universal Print Job Control: Pause
 */
export async function universalPausePrint(printer) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost;
  const port = printer.iotPort;

  if (protocol === PROTOCOLS.OCTOPRINT) {
    return fetch('/api/printer/octoprint/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, apiKey: printer.apiKey, action: 'pause' }),
    });
  }

  if (protocol === PROTOCOLS.BAMBU) {
    return fetch('/api/printer/bambu/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, accessCode: printer.accessCode, serial: printer.serialNo, action: 'pause' }),
    });
  }

  // Default: Moonraker
  return fetch(`/api/printer/pause?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
}

/**
 * Universal Print Job Control: Resume
 */
export async function universalResumePrint(printer) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost;
  const port = printer.iotPort;

  if (protocol === PROTOCOLS.OCTOPRINT) {
    return fetch('/api/printer/octoprint/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, apiKey: printer.apiKey, action: 'resume' }),
    });
  }

  if (protocol === PROTOCOLS.BAMBU) {
    return fetch('/api/printer/bambu/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, accessCode: printer.accessCode, serial: printer.serialNo, action: 'resume' }),
    });
  }

  return fetch(`/api/printer/resume?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
}

/**
 * Universal Print Job Control: Cancel
 */
export async function universalCancelPrint(printer) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost;
  const port = printer.iotPort;

  if (protocol === PROTOCOLS.OCTOPRINT) {
    return fetch('/api/printer/octoprint/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, apiKey: printer.apiKey, action: 'cancel' }),
    });
  }

  if (protocol === PROTOCOLS.BAMBU) {
    return fetch('/api/printer/bambu/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, accessCode: printer.accessCode, serial: printer.serialNo, action: 'stop' }),
    });
  }

  return fetch(`/api/printer/cancel?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
}

/**
 * Universal Emergency Stop (M112)
 */
export async function universalEmergencyStop(printer) {
  const protocol = printer.iotType || PROTOCOLS.MOONRAKER;
  const ip = printer.iotHost;
  const port = printer.iotPort;

  if (protocol === PROTOCOLS.SERIAL) {
    return sendSerialCommand('M112\nM104 S0\nM140 S0');
  }

  if (protocol === PROTOCOLS.OCTOPRINT || protocol === PROTOCOLS.PRUSALINK || protocol === PROTOCOLS.BAMBU) {
    return sendUniversalGcode(printer, 'M112');
  }

  return fetch(`/api/printer/emergency_stop?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
}

/**
 * Direct WebSerial USB API Connect (Browser Native)
 */
export async function connectWebSerial(baudRate = 115200) {
  if (!('serial' in navigator)) {
    showToast('WebSerial API is not supported in this browser. Use Chrome or Edge.', 'error');
    return false;
  }

  try {
    _serialPort = await navigator.serial.requestPort();
    await _serialPort.open({ baudRate: parseInt(baudRate, 10) || 115200 });
    _serialConnected = true;

    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(_serialPort.writable);
    _serialWriter = textEncoder.writable.getWriter();

    showToast(`🔌 Serial USB Connected at ${baudRate} baud!`, 'success');
    return true;
  } catch (err) {
    showToast(`Serial connection error: ${err.message}`, 'error');
    _serialConnected = false;
    return false;
  }
}

/**
 * Send raw G-code line over WebSerial
 */
export async function sendSerialCommand(cmd) {
  if (!_serialConnected || !_serialWriter) {
    showToast('Serial port not connected. Connect USB first.', 'warning');
    return { success: false, error: 'Not connected' };
  }
  try {
    await _serialWriter.write(cmd + '\n');
    return { success: true, command: cmd };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
