/**
 * Made N More — Numakers 3D Spool Visualizer
 * Renders real Numakers product photos or procedural vector Numakers spools
 */

import { escapeHtml } from './helpers.js';

export const NUMAKERS_PHOTO_MAP = {
  'Cool White': '/spools/Cool_White_Spool_Printzy.webp',
  'Ivory Skin': '/spools/Ivory_Spool_Printzy.webp',
  'Midnight Grey': '/spools/Midnight_Gray_Spool_Printzy.webp',
  'Military Khaki': '/spools/Military_Khaki_Spool_Printzy.webp',
  'Pitch Black': '/spools/Pitch_Black_Spool_Printzy.webp',
  'Terracotta Orange': '/spools/Terracota_Orange_Spool.webp',
  'Orange': '/spools/Terracota_Orange_Spool.webp',
};

export function getSpoolImage(filament) {
  if (filament.image) return filament.image;
  return NUMAKERS_PHOTO_MAP[filament.name] || null;
}

/**
 * Render a Numakers spool display:
 * - Real photo with 3D printed dragon if available
 * - Procedural photorealistic Numakers vector spool if photo not yet uploaded
 */
export function renderNumakersSpool(filament, size = 'card') {
  const photoUrl = getSpoolImage(filament);
  const colorHex = filament.hex || '#888888';
  const mat = filament.material || 'PLA+';

  if (photoUrl) {
    return `
      <div class="numakers-spool-display size-${size}" title="${escapeHtml(filament.name)} — Numakers Genuine Spool">
        <div class="spool-glow-backdrop" style="background: radial-gradient(circle, ${colorHex}44 0%, transparent 70%);"></div>
        <img class="numakers-real-photo" src="${photoUrl}" alt="${escapeHtml(filament.name)}" loading="lazy" />
        <span class="numakers-pill-tag">Numakers</span>
      </div>
    `;
  }

  // Procedural authentic Numakers spool graphic
  return `
    <div class="numakers-spool-display size-${size}" title="${escapeHtml(filament.name)} — ${mat}">
      <div class="spool-glow-backdrop" style="background: radial-gradient(circle, ${colorHex}38 0%, transparent 70%);"></div>
      <svg class="numakers-procedural-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Filament coil gradient -->
          <radialGradient id="coil-grad-${filament.id || 'default'}" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
            <stop offset="25%" stop-color="${colorHex}"/>
            <stop offset="85%" stop-color="${colorHex}"/>
            <stop offset="100%" stop-color="#050505"/>
          </radialGradient>

          <!-- Outer flange shadow -->
          <radialGradient id="flange-grad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#2a2e39"/>
            <stop offset="60%" stop-color="#15171e"/>
            <stop offset="100%" stop-color="#0a0b0f"/>
          </radialGradient>

          <!-- Specular sheen -->
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2"/>
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
          </linearGradient>
        </defs>

        <!-- Outer Spool Rim -->
        <circle cx="100" cy="100" r="92" fill="url(#flange-grad)" stroke="#3a3f4d" stroke-width="2.5"/>

        <!-- Wound Filament Coil -->
        <circle cx="100" cy="100" r="82" fill="url(#coil-grad-${filament.id || 'default'})"/>

        <!-- Concentric Filament Strand Ribs -->
        <circle cx="100" cy="100" r="77" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.2" fill="none"/>
        <circle cx="100" cy="100" r="72" stroke="#000000" stroke-opacity="0.25" stroke-width="1" fill="none"/>
        <circle cx="100" cy="100" r="67" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.2" fill="none"/>
        <circle cx="100" cy="100" r="62" stroke="#000000" stroke-opacity="0.25" stroke-width="1" fill="none"/>
        <circle cx="100" cy="100" r="57" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.2" fill="none"/>

        <!-- Front Black Flange Body -->
        <circle cx="100" cy="100" r="52" fill="url(#flange-grad)" stroke="#222530" stroke-width="2"/>

        <!-- Numakers Characteristic Cutout Windows -->
        <!-- Window 1 (Top Right) -->
        <path d="M 112 58 A 45 45 0 0 1 138 78 L 126 83 A 32 32 0 0 0 108 68 Z" fill="url(#coil-grad-${filament.id || 'default'})" stroke="#000000" stroke-width="1.5"/>
        <!-- Window 2 (Bottom Right) -->
        <path d="M 138 122 A 45 45 0 0 1 112 142 L 108 132 A 32 32 0 0 0 126 117 Z" fill="url(#coil-grad-${filament.id || 'default'})" stroke="#000000" stroke-width="1.5"/>
        <!-- Window 3 (Bottom Left) -->
        <path d="M 88 142 A 45 45 0 0 1 62 122 L 74 117 A 32 32 0 0 0 92 132 Z" fill="url(#coil-grad-${filament.id || 'default'})" stroke="#000000" stroke-width="1.5"/>
        <!-- Window 4 (Top Left) -->
        <path d="M 62 78 A 45 45 0 0 1 88 58 L 92 68 A 32 32 0 0 0 74 83 Z" fill="url(#coil-grad-${filament.id || 'default'})" stroke="#000000" stroke-width="1.5"/>

        <!-- Central Hub Hub Sticker -->
        <circle cx="100" cy="100" r="28" fill="#181a20" stroke="#333742" stroke-width="1.5"/>

        <!-- Brand Text Arc or Logo -->
        <text x="100" y="88" text-anchor="middle" font-family="'Inter', sans-serif" font-size="8.5" font-weight="800" fill="#9ca3af" letter-spacing="0.8">numakers</text>
        <text x="100" y="103" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">${mat}</text>
        <text x="100" y="113" text-anchor="middle" font-family="'Inter', sans-serif" font-size="6.5" font-weight="500" fill="#9ca3af">ø 1.75 mm</text>

        <!-- Center Core Hole -->
        <circle cx="100" cy="100" r="11" fill="#08090d" stroke="#222630" stroke-width="2"/>

        <!-- Gloss Overlap -->
        <circle cx="100" cy="100" r="92" fill="url(#sheen)" pointer-events="none"/>
      </svg>
      <span class="numakers-pill-tag">Numakers</span>
    </div>
  `;
}
