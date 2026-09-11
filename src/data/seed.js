/**
 * Made N More — Seed Data
 * Pre-populates the store with all 40 filaments and existing transaction data
 */

import { create, isSeeded, markSeeded, getSettings } from './store.js';

/** Hex color map for all filament colors */
const FILAMENT_COLORS = {
  'Black (Orange)':                          '#1a1a1a',
  'Midnight Grey':                           '#2d3436',
  'Translucent Pink':                        '#ff69b4',
  'Translucent Blue':                        '#5dade2',
  'Blue':                                    '#2980b9',
  'Pitch Black':                             '#0a0a0a',
  'Teal Blue':                               '#008b8b',
  'White':                                   '#f0f0f0',
  'Military Khaki':                          '#6b6b47',
  'Silk Dual Color (Red & Black)':           '#c0392b',
  'Cool White':                              '#e0e0e0',
  'Mauve Purple':                            '#9b59b6',
  'Dark Grey':                               '#4a4a4a',
  'Light Blue':                              '#87ceeb',
  'Silk Triple Color (Purple, Gold & Black)':'#7d3c98',
  'Lavender Violet':                         '#9f8fef',
  'Yellow':                                  '#f1c40f',
  'Luminous Green':                          '#39ff14',
  'Bronze':                                  '#cd7f32',
  'Silver':                                  '#c0c0c0',
  'Marble':                                  '#d5d5d5',
  'Gold Light':                              '#ffd700',
  'Red':                                     '#e74c3c',
  'Ivory Skin':                              '#ffe4c4',
  'Gold Dark':                               '#b8860b',
  'Royal Blue':                              '#2c3e8c',
  'Natural White':                           '#faf0e6',
  'Blue (2)':                                '#3498db',
  'Orange':                                  '#e67e22',
  'Translucent':                             '#d4e6f1',
  'Green':                                   '#27ae60',
  'Blue Bendable':                           '#2e86c1',
  'Agloo Black':                             '#111111',
  'Antique Gold':                            '#cfb53b',
  'Copper':                                  '#b87333',
  'White Matte':                             '#eaeaea',
  'Black Matte':                             '#1c1c1c',
  'Light Beige':                             '#f5deb3',
  'Light Grey':                              '#b0b0b0',
  'Terracotta Orange':                       '#e2725b',
};

/** Material badge class mapping */
export const MATERIAL_BADGES = {
  'PLA+':     'badge-pla',
  'PETG-HS':  'badge-petg',
  'ABS':      'badge-abs',
  'TPU+':     'badge-tpu',
  'PLA Silk': 'badge-silk',
  'PLA Matt': 'badge-matt',
};

/** Material types list */
export const MATERIAL_TYPES = ['PLA+', 'PETG-HS', 'ABS', 'TPU+', 'PLA Silk', 'PLA Matt'];

/** Transaction categories */
export const TRANSACTION_CATEGORIES = [
  'Sale',
  'Filament Purchase',
  'Designer Fee',
  'Stall Fee',
  'Equipment',
  'Other',
];

/** Get CSS class for filament effect (translucent, silk, matte) */
export function getSwatchClass(name, material) {
  const lower = name.toLowerCase();
  if (lower.includes('translucent') || lower.includes('tenaslucent') || lower.includes('trnaslucent'))
    return 'translucent';
  if (material === 'PLA Silk' || lower.includes('silk')) return 'silk';
  if (material === 'PLA Matt' || lower.includes('matt')) return 'matte';
  return '';
}

/** Full filament seed data matching user's spreadsheet */
const FILAMENT_SEED = [
  { name: 'Black (Orange)',                           hex: FILAMENT_COLORS['Black (Orange)'],          spools: 1, material: 'ABS',      usable: true,  brand: 'Numakers' },
  { name: 'Midnight Grey',                            hex: FILAMENT_COLORS['Midnight Grey'],           spools: 2, material: 'PETG-HS',  usable: true,  brand: 'Numakers' },
  { name: 'Translucent Pink',                         hex: FILAMENT_COLORS['Translucent Pink'],        spools: 1, material: 'PETG-HS',  usable: true,  brand: 'Numakers' },
  { name: 'Translucent Blue',                         hex: FILAMENT_COLORS['Translucent Blue'],        spools: 1, material: 'PETG-HS',  usable: true,  brand: 'Numakers' },
  { name: 'Blue',                                     hex: FILAMENT_COLORS['Blue'],                    spools: 1, material: 'PETG-HS',  usable: true,  brand: 'Numakers' },
  { name: 'Pitch Black',                              hex: FILAMENT_COLORS['Pitch Black'],             spools: 2, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Teal Blue',                                hex: FILAMENT_COLORS['Teal Blue'],               spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'White',                                    hex: FILAMENT_COLORS['White'],                   spools: 3, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Military Khaki',                           hex: FILAMENT_COLORS['Military Khaki'],          spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Silk Dual Color (Red & Black)',             hex: FILAMENT_COLORS['Silk Dual Color (Red & Black)'], spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
  { name: 'Cool White',                               hex: FILAMENT_COLORS['Cool White'],              spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Mauve Purple',                             hex: FILAMENT_COLORS['Mauve Purple'],            spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Dark Grey',                                hex: FILAMENT_COLORS['Dark Grey'],               spools: 2, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Light Blue',                               hex: FILAMENT_COLORS['Light Blue'],              spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Silk Triple Color (Purple, Gold & Black)', hex: FILAMENT_COLORS['Silk Triple Color (Purple, Gold & Black)'], spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
  { name: 'Lavender Violet',                          hex: FILAMENT_COLORS['Lavender Violet'],         spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Yellow',                                   hex: FILAMENT_COLORS['Yellow'],                  spools: 2, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Luminous Green',                           hex: FILAMENT_COLORS['Luminous Green'],          spools: 1, material: 'PLA+',     usable: false, brand: 'Numakers' },
  { name: 'Bronze',                                   hex: FILAMENT_COLORS['Bronze'],                  spools: 1, material: 'PLA+',     usable: false, brand: 'Numakers' },
  { name: 'Silver',                                   hex: FILAMENT_COLORS['Silver'],                  spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Marble',                                   hex: FILAMENT_COLORS['Marble'],                  spools: 1, material: 'PLA+',     usable: false, brand: 'Numakers' },
  { name: 'Gold Light',                               hex: FILAMENT_COLORS['Gold Light'],              spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Red',                                      hex: FILAMENT_COLORS['Red'],                     spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Ivory Skin',                               hex: FILAMENT_COLORS['Ivory Skin'],              spools: 2, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Gold Dark',                                hex: FILAMENT_COLORS['Gold Dark'],               spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Royal Blue',                               hex: FILAMENT_COLORS['Royal Blue'],              spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Natural White',                            hex: FILAMENT_COLORS['Natural White'],           spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Blue (2)',                                 hex: FILAMENT_COLORS['Blue (2)'],                spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Orange',                                   hex: FILAMENT_COLORS['Orange'],                  spools: 2, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Translucent',                              hex: FILAMENT_COLORS['Translucent'],             spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Green',                                    hex: FILAMENT_COLORS['Green'],                   spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Blue Bendable',                            hex: FILAMENT_COLORS['Blue Bendable'],           spools: 1, material: 'TPU+',     usable: true,  brand: 'Numakers' },
  { name: 'Agloo Black',                              hex: FILAMENT_COLORS['Agloo Black'],             spools: 1, material: 'TPU+',     usable: true,  brand: 'Numakers' },
  { name: 'Antique Gold',                             hex: FILAMENT_COLORS['Antique Gold'],            spools: 1, material: 'PLA Silk', usable: true,  brand: 'Numakers' },
  { name: 'Copper',                                   hex: FILAMENT_COLORS['Copper'],                  spools: 1, material: 'PLA Silk', usable: true,  brand: 'Numakers' },
  { name: 'White Matte',                              hex: FILAMENT_COLORS['White Matte'],             spools: 2, material: 'PLA Matt', usable: true,  brand: 'Numakers' },
  { name: 'Black Matte',                              hex: FILAMENT_COLORS['Black Matte'],             spools: 2, material: 'PLA Matt', usable: true,  brand: 'Numakers' },
  { name: 'Light Beige',                              hex: FILAMENT_COLORS['Light Beige'],             spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Light Grey',                               hex: FILAMENT_COLORS['Light Grey'],              spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
  { name: 'Terracotta Orange',                        hex: FILAMENT_COLORS['Terracotta Orange'],       spools: 1, material: 'PLA+',     usable: true,  brand: 'Numakers' },
];

/** Transaction seed data from user's spreadsheet */
const TRANSACTION_SEED = [
  { date: '2026-06-25', description: 'Ganpati Stall 57 Midtown',       type: 'expense', category: 'Stall Fee',          amount: 600 },
  { date: '2026-06-25', description: 'Ganpati Stall Highmont',         type: 'expense', category: 'Stall Fee',          amount: 500 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 750 },
  { date: '2026-06-25', description: '3D Print Sale — Bulk Order',     type: 'sale',    category: 'Sale',               amount: 2560 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 150 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 750 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 150 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 150 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 600 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 240 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 450 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 300 },
  { date: '2026-06-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 650 },
  { date: '2026-07-24', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 200 },
  { date: '2026-07-26', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 200 },
  { date: '2026-07-26', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 200 },
  { date: '2026-07-26', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 1830 },
  { date: '2026-07-26', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 970 },
  { date: '2026-08-23', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 770 },
  { date: '2026-08-23', description: 'Stall Expense',                  type: 'expense', category: 'Other',              amount: 3955.47 },
  { date: '2026-08-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 1300 },
  { date: '2026-08-25', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 1000 },
  { date: '2026-08-25', description: 'Numakers Filament 3D (8 units)', type: 'expense', category: 'Filament Purchase',  amount: 7521.32 },
  { date: '2026-09-04', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 1650 },
  { date: '2026-09-07', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 950 },
  { date: '2026-09-07', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 630 },
  { date: '2026-09-07', description: 'Product Designer 28%',           type: 'sale',    category: 'Sale',               amount: 2000 },
  { date: '2026-09-07', description: 'Product Designer 22%',           type: 'sale',    category: 'Sale',               amount: 1375 },
  { date: '2026-09-07', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 2100 },
  { date: '2026-09-07', description: '3D Print Sale',                  type: 'sale',    category: 'Sale',               amount: 200 },
  { date: '2026-09-08', description: 'Mushak 904 57 Midtown',          type: 'sale',    category: 'Sale',               amount: 240 },
  { date: '2026-09-08', description: 'Filament Khaki (1 spool)',       type: 'expense', category: 'Filament Purchase',  amount: 700 },
  { date: '2026-09-08', description: 'Saurab Mushak',                  type: 'sale',    category: 'Sale',               amount: 600 },
  { date: '2026-09-09', description: 'Product Designer 100% Complete', type: 'sale',    category: 'Sale',               amount: 3375 },
  { date: '2026-06-25', description: 'Prior Sales Revenue',            type: 'expense', category: 'Other',              amount: 15900 },
];

/** Sample order seed — demonstrates multi-item assemblies and Kanban production pipeline */
const ORDER_SEED = [
  {
    clientName: 'Product Designer',
    clientPhone: '+91 98230 44551',
    clientEmail: 'contact@designstudio.in',
    clientGstin: '27AAAAA0000A1Z5',
    description: 'Custom 3D printed product design commission',
    priority: 'standard',
    kanbanStage: 'completed',
    status: 'completed',
    notes: 'Full design project — paid in 3 installments',
    items: [
      { id: 'it1', name: 'Main Ergonomic Housing', material: 'ABS', color: 'Black (orange)', quantity: 2, unitPrice: 1875, subtotal: 3750, status: 'completed' },
      { id: 'it2', name: 'Structural Internal Chassis', material: 'PETG-HS', color: 'Pitch Black', quantity: 2, unitPrice: 1000, subtotal: 2000, status: 'completed' },
      { id: 'it3', name: 'Shock Absorbing Gasket & Feet', material: 'TPU+', color: 'Agloo Black', quantity: 4, unitPrice: 250, subtotal: 1000, status: 'completed' },
    ],
    totalAmount: 6750,
    payments: [
      { id: 'pay1', date: '2026-09-07', percentage: 28, amount: 2000, notes: 'First installment (28%)' },
      { id: 'pay2', date: '2026-09-07', percentage: 22, amount: 1375, notes: 'Second installment (22%)' },
      { id: 'pay3', date: '2026-09-09', percentage: 50, amount: 3375, notes: 'Final payment — 100% complete' },
    ],
  },
  {
    clientName: 'RoboTech Automation Labs',
    clientPhone: '+91 94220 11223',
    clientEmail: 'rnd@robotechpune.com',
    clientGstin: '27BBBBB1111B1Z2',
    description: 'Inspection Drone Arm Linkages & Sensor Mounts',
    priority: 'express',
    kanbanStage: 'printing',
    status: 'active',
    notes: 'Urgent pilot batch for field testing in Bhosari MIDC',
    items: [
      { id: 'it4', name: 'Heavy-Duty Motor Arm Bracket', material: 'PETG-HS', color: 'dark greay', quantity: 4, unitPrice: 850, subtotal: 3400, status: 'printing' },
      { id: 'it5', name: 'LiDAR Sensor Protective Housing', material: 'ABS', color: 'Military Khaki', quantity: 2, unitPrice: 1100, subtotal: 2200, status: 'queued' },
      { id: 'it6', name: 'Anti-Vibration Dampening Mount', material: 'TPU+', color: 'Blue benadable', quantity: 4, unitPrice: 350, subtotal: 1400, status: 'queued' },
    ],
    totalAmount: 7000,
    payments: [
      { id: 'pay4', date: '2026-09-10', percentage: 30, amount: 2100, notes: '30% Advance Deposit — Production Started' },
    ],
  },
  {
    clientName: 'Saurab — Custom Scale Models',
    clientPhone: '+91 91580 99887',
    clientEmail: 'saurab.mushak@gmail.com',
    description: 'Architectural Presentation Scale Model',
    priority: 'standard',
    kanbanStage: 'post_processing',
    status: 'active',
    notes: 'Fine layer height (0.12mm) in Silk Dual Color',
    items: [
      { id: 'it7', name: 'Tower Facade Centerpiece', material: 'PLA+', color: 'silk dual color (red and black )', quantity: 1, unitPrice: 2800, subtotal: 2800, status: 'completed' },
      { id: 'it8', name: 'Landscape Pavilion Base', material: 'PLA+', color: 'cool white', quantity: 1, unitPrice: 1700, subtotal: 1700, status: 'completed' },
    ],
    totalAmount: 4500,
    payments: [
      { id: 'pay5', date: '2026-09-08', percentage: 50, amount: 2250, notes: '50% Milestone Advance' },
    ],
  },
  {
    clientName: 'Pimpri Precision Works',
    clientPhone: '+91 98900 33441',
    clientEmail: 'tooling@pimprispairs.com',
    clientGstin: '27CCCCC2222C1Z8',
    description: 'Drill Jig Bushing Retainer Tooling',
    priority: 'overnight',
    kanbanStage: 'quote',
    status: 'quote',
    validUntil: '2026-09-25',
    notes: 'Quotation sent. Awaiting engineering sign-off on 40% infill PETG.',
    items: [
      { id: 'it9', name: 'Assembly Line Holding Nest', material: 'PETG-HS', color: 'teal Blue', quantity: 5, unitPrice: 950, subtotal: 4750, status: 'queued' },
    ],
    totalAmount: 4750,
    payments: [],
  },
];

/** Sample 3D printer fleet seed */
export const PRINTER_SEED = [
  {
    name: 'Snapmaker U1 #01',
    model: 'Snapmaker U1 Multi-Material Dual',
    buildVolume: '250 x 250 x 250 mm',
    nozzleDiameter: '0.4 mm Hardened Steel',
    status: 'printing',
    targetNozzleTemp: 250,
    currentNozzleTemp: 246,
    targetBedTemp: 80,
    currentBedTemp: 80,
    currentJob: 'RoboTech — Motor Arm Bracket',
    jobProgress: 68,
    elapsedMinutes: 135,
    totalMinutes: 200,
    loadedSpool: 'Pitch Black (PETG-HS)',
    loadedSpoolHex: '#0a0a0a',
    runningHours: 248,
    maintenanceDueHours: 300,
    location: 'Workbench A1 — Enclosed',
    notes: 'Dual-material production unit with high-temperature enclosure.',
  },
  {
    name: 'Voron 2.4 CoreXY #02',
    model: 'Voron 2.4 High-Speed Enclosed',
    buildVolume: '350 x 350 x 350 mm',
    nozzleDiameter: '0.4 mm CHT High-Flow',
    status: 'printing',
    targetNozzleTemp: 240,
    currentNozzleTemp: 240,
    targetBedTemp: 95,
    currentBedTemp: 95,
    currentJob: 'Product Designer — Main Housing',
    jobProgress: 42,
    elapsedMinutes: 180,
    totalMinutes: 430,
    loadedSpool: 'Black (Orange) (ABS)',
    loadedSpoolHex: '#1a1a1a',
    runningHours: 412,
    maintenanceDueHours: 500,
    location: 'Workbench A2 — Exhaust Bay',
    notes: 'Dedicated ABS/ASA high-speed engineering printer with active chamber heating.',
  },
  {
    name: 'Bambu Lab P1S #03',
    model: 'Bambu Lab P1S + AMS Hub',
    buildVolume: '256 x 256 x 256 mm',
    nozzleDiameter: '0.4 mm Stainless',
    status: 'idle',
    targetNozzleTemp: 0,
    currentNozzleTemp: 28,
    targetBedTemp: 0,
    currentBedTemp: 29,
    currentJob: null,
    jobProgress: 0,
    elapsedMinutes: 0,
    totalMinutes: 0,
    loadedSpool: 'Cool White (PLA+)',
    loadedSpoolHex: '#e0e0e0',
    runningHours: 185,
    maintenanceDueHours: 300,
    location: 'Workbench B1',
    notes: 'Ready for next queue job. AMS slot loaded with 4x PLA colors.',
  },
  {
    name: 'Ender 3 V3 Plus #04',
    model: 'Creality Ender 3 V3 Plus',
    buildVolume: '300 x 300 x 330 mm',
    nozzleDiameter: '0.6 mm High-Flow Brass',
    status: 'maintenance',
    targetNozzleTemp: 0,
    currentNozzleTemp: 26,
    targetBedTemp: 0,
    currentBedTemp: 26,
    currentJob: null,
    jobProgress: 0,
    elapsedMinutes: 0,
    totalMinutes: 0,
    loadedSpool: 'Military Khaki (PLA+)',
    loadedSpoolHex: '#6b6b47',
    runningHours: 530,
    maintenanceDueHours: 500,
    location: 'Service Station',
    notes: 'Linear rail lubrication & replacement of 0.6mm brass nozzle.',
  },
];

/** Seed the database with initial data */
export function seedDatabase() {
  if (isSeeded()) return false;

  // Seed filaments
  FILAMENT_SEED.forEach(f => {
    create('filaments', f);
  });

  // Seed transactions
  TRANSACTION_SEED.forEach(t => {
    create('transactions', t);
  });

  // Seed orders
  ORDER_SEED.forEach(o => {
    create('orders', o);
  });

  // Seed printers
  PRINTER_SEED.forEach(p => {
    create('printers', p);
  });

  markSeeded();
  return true;
}

/** Get hex color for a filament name */
export function getFilamentHex(name) {
  return FILAMENT_COLORS[name] || '#888888';
}

export { FILAMENT_COLORS };
