/**
 * Made N More — Slicer & 3D Model Geometry Parser
 * Features:
 * 1. G-Code / 3MF metadata extraction (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura)
 * 2. Binary & ASCII STL 3D Mesh Volume & Mass Estimator (computes signed tetrahedron volume sum)
 * 3. OrcaSlicer integration helper for D:\software\OrcaSlicer\orca-slicer.exe
 */

/** Densities in g/cm^3 */
export const MATERIAL_DENSITIES = {
  'PLA+': 1.24,
  'PETG-HS': 1.27,
  'ABS': 1.04,
  'TPU+': 1.21,
  'PLA Silk': 1.25,
  'PLA Matt': 1.22,
};

export const ORCA_SLICER_PATH = 'D:\\software\\OrcaSlicer\\orca-slicer.exe';

/** Extract mass, time, and temperatures from sliced G-Code text */
export function parseSlicerGCode(text) {
  let extractedGrams = 0;
  let extractedSeconds = 0;
  let extractedMaterial = '';
  let layerCount = 0;

  // Mass extraction
  const massMatch = text.match(/;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i) ||
                    text.match(/;\s*filament used\s*=\s*([\d.]+)g/i) ||
                    text.match(/;\s*total filament used\s*\[g\]\s*=\s*([\d.]+)/i);
  if (massMatch) extractedGrams = parseFloat(massMatch[1]);

  // Estimated print duration
  const timeTextMatch = text.match(/;\s*(?:total )?estimated (?:printing )?time[^\n]*=\s*([^\n]+)/i);
  if (timeTextMatch) {
    const timeStr = timeTextMatch[1];
    const hours = (timeStr.match(/(\d+)h/i) || [])[1] || 0;
    const mins = (timeStr.match(/(\d+)m/i) || [])[1] || 0;
    const secs = (timeStr.match(/(\d+)s/i) || [])[1] || 0;
    extractedSeconds = (parseInt(hours) * 3600) + (parseInt(mins) * 60) + parseInt(secs);
  } else {
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

/**
 * Parses binary or ASCII STL arrayBuffer to compute exact physical mesh volume
 * Using Divergence theorem / Signed tetrahedron volume sum
 */
export function parseSTLGeometry(arrayBuffer, material = 'PLA+', infillPercent = 20) {
  const dataView = new DataView(arrayBuffer);
  let totalVolumeMm3 = 0;
  let triangleCount = 0;

  const isBinary = arrayBuffer.byteLength >= 84 &&
    arrayBuffer.byteLength === 84 + (dataView.getUint32(80, true) * 50);

  if (isBinary) {
    triangleCount = dataView.getUint32(80, true);
    let offset = 84;

    for (let i = 0; i < triangleCount; i++) {
      // Skip normal (12 bytes)
      offset += 12;

      // Vertex 1
      const p1x = dataView.getFloat32(offset, true);
      const p1y = dataView.getFloat32(offset + 4, true);
      const p1z = dataView.getFloat32(offset + 8, true);
      offset += 12;

      // Vertex 2
      const p2x = dataView.getFloat32(offset, true);
      const p2y = dataView.getFloat32(offset + 4, true);
      const p2z = dataView.getFloat32(offset + 8, true);
      offset += 12;

      // Vertex 3
      const p3x = dataView.getFloat32(offset, true);
      const p3y = dataView.getFloat32(offset + 4, true);
      const p3z = dataView.getFloat32(offset + 8, true);
      offset += 12;

      // Skip attribute byte count (2 bytes)
      offset += 2;

      // Signed tetrahedron volume = (p1 · (p2 × p3)) / 6
      const crossX = p2y * p3z - p2z * p3y;
      const crossY = p2z * p3x - p2x * p3z;
      const crossZ = p2x * p3y - p2y * p3x;
      const v = (p1x * crossX + p1y * crossY + p1z * crossZ) / 6.0;
      totalVolumeMm3 += v;
    }
  } else {
    // ASCII STL fallback
    const text = new TextDecoder('utf-8').decode(arrayBuffer);
    const vertexMatches = [...text.matchAll(/vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/g)];
    triangleCount = Math.floor(vertexMatches.length / 3);

    for (let i = 0; i < triangleCount; i++) {
      const idx = i * 3;
      const p1 = [parseFloat(vertexMatches[idx][1]), parseFloat(vertexMatches[idx][2]), parseFloat(vertexMatches[idx][3])];
      const p2 = [parseFloat(vertexMatches[idx + 1][1]), parseFloat(vertexMatches[idx + 1][2]), parseFloat(vertexMatches[idx + 1][3])];
      const p3 = [parseFloat(vertexMatches[idx + 2][1]), parseFloat(vertexMatches[idx + 2][2]), parseFloat(vertexMatches[idx + 2][3])];

      const crossX = p2[1] * p3[2] - p2[2] * p3[1];
      const crossY = p2[2] * p3[0] - p2[0] * p3[2];
      const crossZ = p2[0] * p3[1] - p2[1] * p3[0];
      const v = (p1[0] * crossX + p1[1] * crossY + p1[2] * crossZ) / 6.0;
      totalVolumeMm3 += v;
    }
  }

  const volumeMm3 = Math.abs(totalVolumeMm3);
  const volumeCm3 = volumeMm3 / 1000.0;
  const density = MATERIAL_DENSITIES[material] || 1.24;
  const solidGrams = volumeCm3 * density;

  // Real world shell + sparse infill model:
  // Shell (perimeters, top/bottom) takes ~22% of solid volume, infill takes remaining proportion
  const infillRatio = Math.max(0.05, Math.min(1.0, infillPercent / 100));
  const estimatedGrams = solidGrams * (0.22 + 0.78 * infillRatio);

  // Print speed estimation (~30g/hour average for standard 200mm/s CoreXY)
  const estimatedHours = Number((estimatedGrams / 32).toFixed(2));

  return {
    triangleCount,
    volumeCm3: Number(volumeCm3.toFixed(2)),
    solidGrams: Number(solidGrams.toFixed(1)),
    estimatedGrams: Number(estimatedGrams.toFixed(1)),
    estimatedHours: Math.max(0.2, estimatedHours),
  };
}

/** Unified file reader for GCode, 3MF, and STL */
export function readSlicerFile(file, callback) {
  const isSTL = file.name.toLowerCase().endsWith('.stl');

  if (isSTL) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geo = parseSTLGeometry(e.target.result);
        callback(null, {
          isSTL: true,
          grams: geo.estimatedGrams,
          durationHours: geo.estimatedHours,
          volumeCm3: geo.volumeCm3,
          triangleCount: geo.triangleCount,
        }, file.name);
      } catch (err) {
        callback(err);
      }
    };
    reader.onerror = (err) => callback(err);
    reader.readAsArrayBuffer(file);
    return;
  }

  // Text-based G-code or header slice
  const reader = new FileReader();
  reader.onload = (e) => {
    const parsed = parseSlicerGCode(e.target.result);
    callback(null, parsed, file.name);
  };
  reader.onerror = (err) => callback(err);

  if (file.size > 200000) {
    const blob = file.slice(0, 150000);
    reader.readAsText(blob);
  } else {
    reader.readAsText(file);
  }
}

/** Generate a downloadable 1-click batch launcher for local OrcaSlicer */
export function generateOrcaSlicerLauncher(stlFilename = '') {
  const script = `@echo off
title Made N More - Launching OrcaSlicer
echo ========================================================
echo   MADE N MORE - ORCASLICER DIRECT INTEGRATION
echo   Opening: ${stlFilename || 'OrcaSlicer Workbench'}
echo ========================================================
if exist "${ORCA_SLICER_PATH}" (
    start "" "${ORCA_SLICER_PATH}" %*
) else (
    echo [ERROR] OrcaSlicer not found at ${ORCA_SLICER_PATH}
    pause
)
`;
  const blob = new Blob([script], { type: 'application/x-bat' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Open_in_OrcaSlicer.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
