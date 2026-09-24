/**
 * Made N More — Physical 3D Printer LAN Service (Moonraker / Klipper / Snapmaker)
 * Communicates directly with physical printers over local Wi-Fi/LAN with automatic server proxy fallback
 */

const API_HOST = typeof window !== 'undefined' && window.location && window.location.hostname
  ? window.location.hostname
  : 'localhost';
const API_BASE = `http://${API_HOST}:4000/api`;

/** Helper to parse time estimates from sliced gcode filename, e.g. "FlowerPot_PLA_3h8m.gcode" */
function parseTimeFromFilename(filename) {
  if (!filename) return null;
  const match = filename.match(/(\d+)h(?:(\d+)m)?/i) || filename.match(/(\d+)m/i);
  if (!match) return null;

  if (match[0].includes('h')) {
    const hours = parseInt(match[1], 10) || 0;
    const mins = parseInt(match[2], 10) || 0;
    return hours * 60 + mins;
  }
  return parseInt(match[1], 10) || 0;
}

export async function fetchPrinterTelemetry(ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const directUrl = `http://${host}/printer/objects/query?extruder&heater_bed&print_stats&virtual_sdcard`;
  const proxyUrl = `${API_BASE}/printer/telemetry?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;

  let data = null;

  // 1. Try direct fetch with short timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(directUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      data = await res.json();
    }
  } catch {
    // Direct fetch failed (likely CORS or LAN routing), proceed to proxy
  }

  // 2. Fallback to API backend proxy
  if (!data) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        data = await res.json();
      }
    } catch (proxyErr) {
      return { online: false, error: proxyErr.message };
    }
  }

  if (!data || !data.result) {
    return { online: false, error: 'No response from printer' };
  }

  const status = data.result.status || {};
  const ext = status.extruder || {};
  const bed = status.heater_bed || {};
  const stats = status.print_stats || {};
  const vsd = status.virtual_sdcard || {};

  let uiState = 'idle';
  if (stats.state === 'printing') uiState = 'printing';
  else if (stats.state === 'paused') uiState = 'paused';
  else if ((ext.target && ext.target > 50) || (bed.target && bed.target > 40)) uiState = 'heating';

  const rawFilename = stats.filename || '';
  const parsedMinutes = parseTimeFromFilename(rawFilename);
  const totalMinutes = parsedMinutes || Math.round((stats.total_duration || 0) / 60) || 0;
  const elapsedMinutes = Math.round((stats.print_duration || 0) / 60);

  const cleanJobName = rawFilename
    ? rawFilename.replace(/\.(gcode|3mf)$/i, '').replace(/_/g, ' ').replace(/\+/g, ' ')
    : null;

  return {
    online: true,
    currentNozzleTemp: Math.round(ext.temperature || 0),
    targetNozzleTemp: Math.round(ext.target || 0),
    currentBedTemp: Math.round(bed.temperature || 0),
    targetBedTemp: Math.round(bed.target || 0),
    chamberTemp: null,
    status: uiState,
    klippyState: stats.state || 'standby',
    currentJob: cleanJobName,
    rawFilename,
    jobProgress: Math.round((vsd.progress || 0) * 100),
    elapsedMinutes,
    totalMinutes: Math.max(totalMinutes, elapsedMinutes),
    eventtime: data.result.eventtime,
  };
}

/**
 * Fetch latest snapshot photo taken by Snapmaker camera
 */
export async function fetchLatestSnapshot(ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const directUrl = `http://${host}/server/files/list?root=camera`;
  const proxyUrl = `${API_BASE}/printer/files?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&root=camera`;

  let files = [];

  try {
    const res = await fetch(directUrl);
    if (res.ok) {
      const d = await res.json();
      files = d.result || [];
    }
  } catch {}

  if (files.length === 0) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const d = await res.json();
        files = d.result || [];
      }
    } catch {}
  }

  const jpgs = files
    .filter(f => f.path && (f.path.toLowerCase().endsWith('.jpg') || f.path.toLowerCase().endsWith('.png')))
    .sort((a, b) => (b.modified || 0) - (a.modified || 0));

  if (jpgs.length > 0) {
    return {
      url: `http://${host}/server/files/camera/${encodeURIComponent(jpgs[0].path)}`,
      filename: jpgs[0].path,
      modified: new Date((jpgs[0].modified || 0) * 1000).toLocaleString(),
      size: Math.round((jpgs[0].size || 0) / 1024) + ' KB',
    };
  }
  return null;
}

/**
 * Fetch all timelapse videos (.mp4) and snapshots (.jpg) with metadata
 */
export async function fetchAllCameraMedia(ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const directUrl = `http://${host}/server/files/list?root=camera`;
  const proxyUrl = `${API_BASE}/printer/files?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&root=camera`;

  let files = [];

  try {
    const res = await fetch(directUrl);
    if (res.ok) {
      const d = await res.json();
      files = d.result || [];
    }
  } catch {}

  if (files.length === 0) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const d = await res.json();
        files = d.result || [];
      }
    } catch {}
  }

  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const videos = files
    .filter(f => f.path && f.path.toLowerCase().endsWith('.mp4'))
    .sort((a, b) => (b.modified || 0) - (a.modified || 0))
    .map(f => ({
      filename: f.path,
      url: `http://${host}/server/files/camera/${encodeURIComponent(f.path)}`,
      sizeBytes: f.size,
      sizeFormatted: formatBytes(f.size),
      dateFormatted: new Date((f.modified || 0) * 1000).toLocaleString(),
      rawModified: f.modified,
    }));

  const snapshots = files
    .filter(f => f.path && (f.path.toLowerCase().endsWith('.jpg') || f.path.toLowerCase().endsWith('.png')))
    .sort((a, b) => (b.modified || 0) - (a.modified || 0))
    .map(f => ({
      filename: f.path,
      url: `http://${host}/server/files/camera/${encodeURIComponent(f.path)}`,
      sizeBytes: f.size,
      sizeFormatted: formatBytes(f.size),
      dateFormatted: new Date((f.modified || 0) * 1000).toLocaleString(),
      rawModified: f.modified,
    }));

  const totalVideoBytes = videos.reduce((s, v) => s + (v.sizeBytes || 0), 0);

  return {
    success: true,
    videos,
    snapshots,
    totalVideoCount: videos.length,
    totalSnapshotCount: snapshots.length,
    totalVideoSizeFormatted: formatBytes(totalVideoBytes),
  };
}

/**
 * Auto-discover Snapmaker printer IP on local subnet
 */
export async function scanLocalSubnet(baseSubnet = '192.168.0', onProgress = null) {
  const priority = [144, 145, 143, 146, 142, 140, 150, 100, 101, 102, 105, 110, 120];
  const others = [];
  for (let i = 100; i <= 200; i++) {
    if (!priority.includes(i)) others.push(i);
  }
  const queue = [...priority, ...others];

  for (let i = 0; i < queue.length; i++) {
    const testIp = `${baseSubnet}.${queue[i]}`;
    if (onProgress) onProgress(testIp, i + 1, queue.length);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`http://${testIp}/server/info`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.result?.klippy_state || data.result?.moonraker_version) {
          return {
            found: true,
            ip: testIp,
            version: data.result.moonraker_version,
            klippyState: data.result.klippy_state,
          };
        }
      }
    } catch {}
  }

  return { found: false };
}

/**
 * Send arbitrary G-Code script to Klipper with proxy fallback
 */
export async function sendGcodeCommand(script, ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const directUrl = `http://${host}/printer/gcode/script`;
  const proxyUrl = `${API_BASE}/printer/gcode`;

  // 1. Try direct fetch
  try {
    const res = await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      return { success: true, data: await res.json() };
    }
  } catch {}

  // 2. Proxy fallback
  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, ip, port }),
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    return { success: res.ok, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Pause active physical print job
 */
export async function pausePrint(ip = '192.168.0.144', port = 80) {
  try {
    const res = await fetch(`${API_BASE}/printer/pause?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resume paused physical print job
 */
export async function resumePrint(ip = '192.168.0.144', port = 80) {
  try {
    const res = await fetch(`${API_BASE}/printer/resume?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Cancel physical print job
 */
export async function cancelPrint(ip = '192.168.0.144', port = 80) {
  try {
    const res = await fetch(`${API_BASE}/printer/cancel?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trigger immediate Emergency Stop (M112)
 */
export async function emergencyStop(ip = '192.168.0.144', port = 80) {
  try {
    const res = await fetch(`${API_BASE}/printer/emergency_stop?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Set target extruder hotend temperature
 */
export async function setTargetHotendTemp(temp, ip = '192.168.0.144', port = 80) {
  return sendGcodeCommand(`M104 S${Math.round(temp)}`, ip, port);
}

/**
 * Set target heatbed temperature
 */
export async function setTargetBedTemp(temp, ip = '192.168.0.144', port = 80) {
  return sendGcodeCommand(`M140 S${Math.round(temp)}`, ip, port);
}

/**
 * Set part cooling fan speed (0 - 100%)
 */
export async function setFanSpeed(pct, ip = '192.168.0.144', port = 80) {
  const pwm = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 255);
  return sendGcodeCommand(`M106 S${pwm}`, ip, port);
}

/**
 * Jog relative motion on X, Y, or Z axis
 */
export async function jogAxis(axis, distanceMm, feedrate = null, ip = '192.168.0.144', port = 80) {
  const ax = axis.toUpperCase();
  const f = feedrate || (ax === 'Z' ? 600 : 3000);
  const script = `G91\nG1 ${ax}${distanceMm} F${f}\nG90`;
  return sendGcodeCommand(script, ip, port);
}

/**
 * Extrude or Retract filament
 */
export async function extrudeRetract(amountMm, speedMmS = 5, ip = '192.168.0.144', port = 80) {
  const f = Math.round(speedMmS * 60);
  const script = `M83\nG1 E${amountMm} F${f}`;
  return sendGcodeCommand(script, ip, port);
}

/**
 * Fetch all sliced G-Code files stored in virtual_sdcard (/gcodes)
 */
export async function fetchGcodeFiles(ip = '192.168.0.144', port = 80) {
  const proxyUrl = `${API_BASE}/printer/gcode_files?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
  try {
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      return (data.result || []).sort((a, b) => (b.modified || 0) - (a.modified || 0));
    }
  } catch {}
  return [];
}

/**
 * Start printing a file from virtual_sdcard
 */
export async function startGcodePrint(filename, ip = '192.168.0.144', port = 80) {
  const proxyUrl = `${API_BASE}/printer/print/start?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}&filename=${encodeURIComponent(filename)}`;
  try {
    const res = await fetch(proxyUrl, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

