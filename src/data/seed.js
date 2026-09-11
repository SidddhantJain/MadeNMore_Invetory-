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

/** Sample order seed — demonstrates the percentage payment system */
const ORDER_SEED = [
  {
    clientName: 'Product Designer',
    description: 'Custom 3D printed product design commission',
    totalAmount: 6750,
    status: 'completed',
    notes: 'Full design project — paid in 3 installments',
    payments: [
      { id: 'pay1', date: '2026-09-07', percentage: 28, amount: 2000, notes: 'First installment (28%)' },
      { id: 'pay2', date: '2026-09-07', percentage: 22, amount: 1375, notes: 'Second installment (22%)' },
      { id: 'pay3', date: '2026-09-09', percentage: 50, amount: 3375, notes: 'Final payment — 100% complete' },
    ],
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

  markSeeded();
  return true;
}

/** Get hex color for a filament name */
export function getFilamentHex(name) {
  return FILAMENT_COLORS[name] || '#888888';
}

export { FILAMENT_COLORS };
