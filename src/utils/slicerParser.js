/**
 * Made N More — Slicer Metadata Parser
 * Extracts filament mass, print time, and material comments from Bambu Studio, OrcaSlicer, PrusaSlicer, and Cura files
 */

export function parseSlicerGCode(text) {
  let extractedGrams = 0;
  let extractedSeconds = 0;
  let extractedMaterial = '';
  let layerCount = 0;

  // Mass extraction
  // ; filament used [g] = 142.85
  const massMatch = text.match(/;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i) ||
                    text.match(/;\s*filament used\s*=\s*([\d.]+)g/i) ||
                    text.match(/;\s*total filament used\s*\[g\]\s*=\s*([\d.]+)/i);
  if (massMatch) extractedGrams = parseFloat(massMatch[1]);

  // Estimated print duration
  // ; total estimated time = 3h 24m 12s
  const timeTextMatch = text.match(/;\s*(?:total )?estimated (?:printing )?time[^\n]*=\s*([^\n]+)/i);
  if (timeTextMatch) {
    const timeStr = timeTextMatch[1];
    const hours = (timeStr.match(/(\d+)h/i) || [])[1] || 0;
    const mins = (timeStr.match(/(\d+)m/i) || [])[1] || 0;
    const secs = (timeStr.match(/(\d+)s/i) || [])[1] || 0;
    extractedSeconds = (parseInt(hours) * 3600) + (parseInt(mins) * 60) + parseInt(secs);
  } else {
    // Cura TIME:12345
    const curaTimeMatch = text.match(/;TIME:(\d+)/i);
    if (curaTimeMatch) extractedSeconds = parseInt(curaTimeMatch[1]);
  }

  // Material detection
  const matMatch = text.match(/;\s*filament_type\s*=\s*([A-Za-z0-9+-]+)/i) ||
                   text.match(/material\s*=\s*([A-Za-z0-9+-]+)/i);
  if (matMatch) extractedMaterial = matMatch[1].trim();

  // Total layers detection
  const layerMatch = text.match(/;\s*total layers count\s*=\s*(\d+)/i) ||
                     text.match(/;\s*LAYER_COUNT:(\d+)/i);
  if (layerMatch) layerCount = parseInt(layerMatch[1]);

  return {
    grams: extractedGrams > 0 ? Number(extractedGrams.toFixed(1)) : 0,
    seconds: extractedSeconds,
    durationHours: extractedSeconds > 0 ? Number((extractedSeconds / 3600).toFixed(2)) : 0,
    material: extractedMaterial,
    layerCount: layerCount || 0,
  };
}

export function readSlicerFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseSlicerGCode(e.target.result);
    callback(null, parsed, file.name);
  };
  reader.onerror = (err) => callback(err);

  // Read slice of file for speed if large, but read enough for header
  if (file.size > 200000) {
    const blob = file.slice(0, 150000);
    reader.readAsText(blob);
  } else {
    reader.readAsText(file);
  }
}
