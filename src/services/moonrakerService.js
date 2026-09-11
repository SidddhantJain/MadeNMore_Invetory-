/**
 * Made N More — Physical 3D Printer LAN Service (Moonraker / Klipper / Snapmaker)
 * Communicates directly with physical printers over local Wi-Fi/LAN
 */

export async function fetchPrinterTelemetry(ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const url = `http://${host}/printer/objects/query?extruder=temperature,target&heater_bed=temperature,target&temperature_sensor%20cavity=temperature&print_stats=state,filename,print_duration,total_duration&virtual_sdcard=progress`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const status = data.result?.status || {};

    const ext = status.extruder || {};
    const bed = status.heater_bed || {};
    const stats = status.print_stats || {};
    const vsd = status.virtual_sdcard || {};
    const cavity = status['temperature_sensor cavity'] || {};

    let uiState = 'idle';
    if (stats.state === 'printing') uiState = 'printing';
    else if (stats.state === 'paused') uiState = 'paused';
    else if (ext.target > 50 || bed.target > 40) uiState = 'heating';

    return {
      online: true,
      currentNozzleTemp: Math.round(ext.temperature || 0),
      targetNozzleTemp: Math.round(ext.target || 0),
      currentBedTemp: Math.round(bed.temperature || 0),
      targetBedTemp: Math.round(bed.target || 0),
      chamberTemp: cavity.temperature ? Math.round(cavity.temperature) : null,
      status: uiState,
      klippyState: stats.state || 'standby',
      currentJob: stats.filename ? stats.filename.replace(/\.(gcode|3mf)$/i, '') : null,
      jobProgress: Math.round((vsd.progress || 0) * 100),
      elapsedMinutes: Math.round((stats.print_duration || 0) / 60),
      totalMinutes: Math.round((stats.total_duration || 0) / 60),
      eventtime: data.result?.eventtime,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      online: false,
      error: err.name === 'AbortError' ? 'Timeout reaching printer IP' : err.message,
    };
  }
}

/**
 * Fetch latest snapshot photo taken by Snapmaker camera
 */
export async function fetchLatestSnapshot(ip = '192.168.0.144', port = 80) {
  const host = port == 80 ? ip : `${ip}:${port}`;
  const url = `http://${host}/server/files/list?root=camera`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const files = data.result || [];
    const jpgs = files
      .filter(f => f.path.toLowerCase().endsWith('.jpg'))
      .sort((a, b) => (b.modified || 0) - (a.modified || 0));

    if (jpgs.length > 0) {
      return {
        url: `http://${host}/server/files/camera/${encodeURIComponent(jpgs[0].path)}`,
        filename: jpgs[0].path,
        modified: new Date((jpgs[0].modified || 0) * 1000).toLocaleString(),
        size: Math.round(jpgs[0].size / 1024) + ' KB',
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Auto-discover Snapmaker printer IP on local subnet if IP shifted
 */
export async function scanLocalSubnet(baseSubnet = '192.168.0', onProgress = null) {
  const candidates = [];
  // Scan likely DHCP range (e.g. 100 to 200, plus known prior IPs)
  const priority = [144, 145, 143, 146, 142, 140, 150, 100, 101, 102, 105, 110, 120];
  const others = [];
  for (let i = 100; i <= 200; i++) {
    if (!priority.includes(i)) others.push(i);
  }
  const queue = [...priority, ...others];

  for (let i = 0; i < queue.length; i++) {
    const octet = queue[i];
    const testIp = `${baseSubnet}.${octet}`;
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
    } catch (_) {
      // Ignore timeouts and continue scanning
    }
  }

  return { found: false };
}
