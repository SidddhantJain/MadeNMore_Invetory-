// server/api.js – Express backend for Made N More data persistence
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Path to the JSON file that holds the persisted data
const DATA_FILE = path.resolve(__dirname, '../src/data/persisted.json');

// Default initial database state if file does not exist
function getDefaultDatabase() {
  return {
    filaments: [
      { id: 'f1', name: 'Black (Orange)', hex: '#1a1a1a', spools: 1, material: 'ABS', usable: true, brand: 'Numakers' },
      { id: 'f2', name: 'Midnight Grey', hex: '#2d3436', spools: 2, material: 'PETG-HS', usable: true, brand: 'Numakers' },
      { id: 'f3', name: 'Translucent Pink', hex: '#ff69b4', spools: 1, material: 'PETG-HS', usable: true, brand: 'Numakers' },
      { id: 'f4', name: 'Translucent Blue', hex: '#5dade2', spools: 1, material: 'PETG-HS', usable: true, brand: 'Numakers' },
      { id: 'f5', name: 'Blue', hex: '#2980b9', spools: 1, material: 'PETG-HS', usable: true, brand: 'Numakers' },
      { id: 'f6', name: 'Pitch Black', hex: '#0a0a0a', spools: 2, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f7', name: 'Teal Blue', hex: '#008b8b', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f8', name: 'White', hex: '#f0f0f0', spools: 3, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f9', name: 'Military Khaki', hex: '#6b6b47', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f10', name: 'Silk Dual Color (Red & Black)', hex: '#c0392b', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f11', name: 'Cool White', hex: '#e0e0e0', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f12', name: 'Mauve Purple', hex: '#9b59b6', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f13', name: 'Dark Grey', hex: '#4a4a4a', spools: 2, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f14', name: 'Light Blue', hex: '#87ceeb', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f15', name: 'Silk Triple Color (Purple, Gold & Black)', hex: '#7d3c98', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f16', name: 'Lavender Violet', hex: '#9f8fef', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f17', name: 'Yellow', hex: '#f1c40f', spools: 2, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f18', name: 'Luminous Green', hex: '#39ff14', spools: 1, material: 'PLA+', usable: false, brand: 'Numakers' },
      { id: 'f19', name: 'Bronze', hex: '#cd7f32', spools: 1, material: 'PLA+', usable: false, brand: 'Numakers' },
      { id: 'f20', name: 'Silver', hex: '#c0c0c0', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f21', name: 'Marble', hex: '#d5d5d5', spools: 1, material: 'PLA+', usable: false, brand: 'Numakers' },
      { id: 'f22', name: 'Gold Light', hex: '#ffd700', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f23', name: 'Red', hex: '#e74c3c', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f24', name: 'Ivory Skin', hex: '#ffe4c4', spools: 2, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f25', name: 'Gold Dark', hex: '#b8860b', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f26', name: 'Royal Blue', hex: '#2c3e8c', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f27', name: 'Natural White', hex: '#faf0e6', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f28', name: 'Blue (2)', hex: '#3498db', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f29', name: 'Orange', hex: '#e67e22', spools: 2, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f30', name: 'Translucent', hex: '#d4e6f1', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f31', name: 'Green', hex: '#27ae60', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f32', name: 'Blue Bendable', hex: '#2e86c1', spools: 1, material: 'TPU+', usable: true, brand: 'Numakers' },
      { id: 'f33', name: 'Agloo Black', hex: '#111111', spools: 1, material: 'TPU+', usable: true, brand: 'Numakers' },
      { id: 'f34', name: 'Antique Gold', hex: '#cfb53b', spools: 1, material: 'PLA Silk', usable: true, brand: 'Numakers' },
      { id: 'f35', name: 'Copper', hex: '#b87333', spools: 1, material: 'PLA Silk', usable: true, brand: 'Numakers' },
      { id: 'f36', name: 'White Matte', hex: '#eaeaea', spools: 2, material: 'PLA Matt', usable: true, brand: 'Numakers' },
      { id: 'f37', name: 'Black Matte', hex: '#1c1c1c', spools: 2, material: 'PLA Matt', usable: true, brand: 'Numakers' },
      { id: 'f38', name: 'Light Beige', hex: '#f5deb3', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f39', name: 'Light Grey', hex: '#b0b0b0', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' },
      { id: 'f40', name: 'Terracotta Orange', hex: '#e2725b', spools: 1, material: 'PLA+', usable: true, brand: 'Numakers' }
    ],
    transactions: [
      { id: 't1', date: '2026-06-25', description: 'Ganpati Stall 57 Midtown', type: 'expense', category: 'Stall Fee', amount: 600 },
      { id: 't2', date: '2026-06-25', description: 'Ganpati Stall Highmont', type: 'expense', category: 'Stall Fee', amount: 500 },
      { id: 't3', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 750 },
      { id: 't4', date: '2026-06-25', description: '3D Print Sale — Bulk Order', type: 'sale', category: 'Sale', amount: 2560 },
      { id: 't5', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 150 },
      { id: 't6', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 750 },
      { id: 't7', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 150 },
      { id: 't8', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 150 },
      { id: 't9', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 600 },
      { id: 't10', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 240 },
      { id: 't11', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 450 },
      { id: 't12', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 300 },
      { id: 't13', date: '2026-06-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 650 },
      { id: 't14', date: '2026-07-24', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 200 },
      { id: 't15', date: '2026-07-26', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 200 },
      { id: 't16', date: '2026-07-26', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 200 },
      { id: 't17', date: '2026-07-26', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 1830 },
      { id: 't18', date: '2026-07-26', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 970 },
      { id: 't19', date: '2026-08-23', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 770 },
      { id: 't20', date: '2026-08-23', description: 'Stall Expense', type: 'expense', category: 'Other', amount: 3955.47 },
      { id: 't21', date: '2026-08-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 1300 },
      { id: 't22', date: '2026-08-25', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 1000 },
      { id: 't23', date: '2026-08-25', description: 'Numakers Filament 3D (8 units)', type: 'expense', category: 'Filament Purchase', amount: 7521.32 },
      { id: 't24', date: '2026-09-04', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 1650 },
      { id: 't25', date: '2026-09-07', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 950 },
      { id: 't26', date: '2026-09-07', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 630 },
      { id: 't27', date: '2026-09-07', description: 'Product Designer 28%', type: 'sale', category: 'Sale', amount: 2000 },
      { id: 't28', date: '2026-09-07', description: 'Product Designer 22%', type: 'sale', category: 'Sale', amount: 1375 },
      { id: 't29', date: '2026-09-07', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 2100 },
      { id: 't30', date: '2026-09-07', description: '3D Print Sale', type: 'sale', category: 'Sale', amount: 200 },
      { id: 't31', date: '2026-09-08', description: 'Mushak 904 57 Midtown', type: 'sale', category: 'Sale', amount: 240 },
      { id: 't32', date: '2026-09-08', description: 'Filament Khaki (1 spool)', type: 'expense', category: 'Filament Purchase', amount: 700 },
      { id: 't33', date: '2026-09-08', description: 'Saurab Mushak', type: 'sale', category: 'Sale', amount: 600 },
      { id: 't34', date: '2026-09-09', description: 'Product Designer 100% Complete', type: 'sale', category: 'Sale', amount: 3375 },
      { id: 't35', date: '2026-06-25', description: 'Prior Sales Revenue', type: 'expense', category: 'Other', amount: 15900 }
    ],
    orders: [
      {
        id: 'ord1',
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
          { id: 'it3', name: 'Shock Absorbing Gasket & Feet', material: 'TPU+', color: 'Agloo Black', quantity: 4, unitPrice: 250, subtotal: 1000, status: 'completed' }
        ],
        totalAmount: 6750,
        payments: [
          { id: 'pay1', date: '2026-09-07', percentage: 28, amount: 2000, notes: 'First installment (28%)' },
          { id: 'pay2', date: '2026-09-07', percentage: 22, amount: 1375, notes: 'Second installment (22%)' },
          { id: 'pay3', date: '2026-09-09', percentage: 50, amount: 3375, notes: 'Final payment — 100% complete' }
        ]
      },
      {
        id: 'ord2',
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
          { id: 'it6', name: 'Anti-Vibration Dampening Mount', material: 'TPU+', color: 'Blue benadable', quantity: 4, unitPrice: 350, subtotal: 1400, status: 'queued' }
        ],
        totalAmount: 7000,
        payments: [
          { id: 'pay4', date: '2026-09-10', percentage: 30, amount: 2100, notes: '30% Advance Deposit — Production Started' }
        ]
      },
      {
        id: 'ord3',
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
          { id: 'it8', name: 'Landscape Pavilion Base', material: 'PLA+', color: 'cool white', quantity: 1, unitPrice: 1700, subtotal: 1700, status: 'completed' }
        ],
        totalAmount: 4500,
        payments: [
          { id: 'pay5', date: '2026-09-08', percentage: 50, amount: 2250, notes: '50% Milestone Advance' }
        ]
      },
      {
        id: 'ord4',
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
          { id: 'it9', name: 'Assembly Line Holding Nest', material: 'PETG-HS', color: 'teal Blue', quantity: 5, unitPrice: 950, subtotal: 4750, status: 'queued' }
        ],
        totalAmount: 4750,
        payments: []
      }
    ],
    printers: [
      {
        id: 'pr1',
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
        iotType: 'moonraker',
        iotHost: '192.168.0.144',
        iotPort: '80',
        webcamUrl: 'http://192.168.0.144/server/files/camera/',
        autoDeductSpool: true,
        notes: 'Snapmaker U1 Klipper/Moonraker connected directly over LAN.'
      },
      {
        id: 'pr2',
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
        notes: 'Dedicated ABS/ASA high-speed engineering printer with active chamber heating.'
      },
      {
        id: 'pr3',
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
        notes: 'Ready for next queue job. AMS slot loaded with 4x PLA colors.'
      },
      {
        id: 'pr4',
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
        notes: 'Linear rail lubrication & replacement of 0.6mm brass nozzle.'
      }
    ],
    consumables: [
      { id: 'c1', name: 'M2 Brass Threaded Heat-Set Inserts', category: 'Fasteners & Inserts', specs: 'M2 x 3.0mm (OD 3.2mm), Knurled Brass', stock: 250, unit: 'pcs', minStock: 50, costPerUnit: 1.8, location: 'Bin A1 - Hardware Drawer', supplier: 'Robu.in' },
      { id: 'c2', name: 'M3 Brass Threaded Heat-Set Inserts', category: 'Fasteners & Inserts', specs: 'M3 x 4.0mm (OD 4.6mm), High-Torque Knurled', stock: 420, unit: 'pcs', minStock: 100, costPerUnit: 2.2, location: 'Bin A2 - Hardware Drawer', supplier: 'Robu.in' },
      { id: 'c3', name: 'M4 Brass Threaded Heat-Set Inserts', category: 'Fasteners & Inserts', specs: 'M4 x 5.0mm (OD 6.0mm), Knurled Brass', stock: 180, unit: 'pcs', minStock: 40, costPerUnit: 3.5, location: 'Bin A3 - Hardware Drawer', supplier: 'Robu.in' },
      { id: 'c4', name: 'M5 Brass Threaded Heat-Set Inserts', category: 'Fasteners & Inserts', specs: 'M5 x 6.5mm (OD 7.0mm), Knurled Heavy-Duty', stock: 35, unit: 'pcs', minStock: 50, costPerUnit: 4.8, location: 'Bin A4 - Hardware Drawer', supplier: 'Robu.in' },
      { id: 'c5', name: 'Hardened Steel Nozzle 0.4mm (High Flow)', category: 'Maintenance & Spare Parts', specs: '0.4mm, M6 Thread, Abrasion Resistant for Carbon/Glow', stock: 4, unit: 'pcs', minStock: 2, costPerUnit: 450, location: 'Toolbox Shelf 1', supplier: '3D Hub India' },
      { id: 'c6', name: 'Hardened Steel Nozzle 0.6mm (Rapid Draft)', category: 'Maintenance & Spare Parts', specs: '0.6mm, M6 Thread, High Volumetric Flow Rate', stock: 1, unit: 'pcs', minStock: 2, costPerUnit: 480, location: 'Toolbox Shelf 1', supplier: '3D Hub India' },
      { id: 'c7', name: '99.9% High Purity Isopropyl Alcohol (IPA)', category: 'Chemicals & Post-Processing', specs: '5 Litres Canister, 99.9% Tech Grade', stock: 3.5, unit: 'L', minStock: 2.0, costPerUnit: 220, location: 'Chemical Storage Cabinet', supplier: 'Chemical Supply Direct' },
      { id: 'c8', name: 'Engineering Tough Photopolymer Resin', category: 'Chemicals & Post-Processing', specs: '1000g Grey, 405nm UV Resin for High Impact Parts', stock: 1200, unit: 'g', minStock: 500, costPerUnit: 2.4, location: 'UV Storage Shelf', supplier: 'Anycubic India' },
      { id: 'c9', name: 'PTFE Super Lube Synthetic Grease with Syncolon', category: 'Maintenance & Spare Parts', specs: '85g Tube, Lead Screws & Linear Rods Lubricant', stock: 2, unit: 'tubes', minStock: 1, costPerUnit: 650, location: 'Printer Service Kit', supplier: 'Amazon Business' },
      { id: 'c10', name: 'Double-Sided Textured PEI Spring Steel Sheet (256x256)', category: 'Maintenance & Spare Parts', specs: 'Gold Powder-Coated Textured PEI for High Adhesion', stock: 2, unit: 'sheets', minStock: 1, costPerUnit: 1450, location: 'Plate Rack B', supplier: 'Bambu Lab India' }
    ],
    settings: {
      machineCost: 55000,
      electricityRate: 8.5,
      printerPower: 350,
      defaultMarkup: 150,
      businessName: 'Made N More',
      currency: '₹',
      materialCosts: {
        'PLA+': 900,
        'PETG-HS': 1100,
        'ABS': 1200,
        'TPU+': 1600,
        'PLA Silk': 1300,
        'PLA Matt': 1100
      }
    },
    _seeded: true
  };
}

// Load data from file or fall back to default structure
function loadData() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = getDefaultDatabase();
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.filaments || parsed.filaments.length === 0) {
      const defaultData = getDefaultDatabase();
      const merged = { ...defaultData, ...parsed };
      fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      return merged;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to parse persisted data, resetting file to default:', err);
    const defaultData = getDefaultDatabase();
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
}

function saveData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getCollection(data, col) {
  if (!data[col]) data[col] = [];
  return data[col];
}

// ----- Bulk & Diagnostic Endpoints -----

// Get all collections in a single request (for fast client hydration)
app.get('/api/all', (req, res) => {
  const data = loadData();
  res.json(data);
});

// Export raw database
app.get('/api/export', (req, res) => {
  const data = loadData();
  res.json(data);
});

// Import database (JSON)
app.post('/api/import', (req, res) => {
  try {
    let payload = req.body;
    if (payload.jsonStr) {
      payload = JSON.parse(payload.jsonStr);
    }
    const replace = req.body.replace !== false;

    let current = loadData();
    if (replace) {
      current = {
        ...getDefaultDatabase(),
        ...payload,
        _seeded: true
      };
    } else {
      // Merge collections
      ['filaments', 'transactions', 'orders', 'printers', 'consumables'].forEach(col => {
        if (Array.isArray(payload[col])) {
          const existingIds = new Set((current[col] || []).map(i => i.id));
          payload[col].forEach(item => {
            if (!existingIds.has(item.id)) {
              current[col].push(item);
            }
          });
        }
      });
      if (payload.settings) {
        current.settings = { ...current.settings, ...payload.settings };
      }
    }

    saveData(current);
    res.json({ success: true, message: 'Data imported successfully', data: current });
  } catch (err) {
    console.error('Import error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Calculate and return business stats
app.get('/api/stats', (req, res) => {
  const data = loadData();
  const filaments = data.filaments || [];
  const transactions = data.transactions || [];
  const settings = data.settings || {};

  const totalSales = transactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfit = totalSales - totalExpenses;
  const netAfterMachine = netProfit - (settings.machineCost || 0);

  const totalSpools = filaments.reduce((sum, f) => sum + (f.spools || 0), 0);
  const usableSpools = filaments.filter(f => f.usable).reduce((sum, f) => sum + (f.spools || 0), 0);

  const materialBreakdown = {};
  filaments.forEach(f => {
    materialBreakdown[f.material] = (materialBreakdown[f.material] || 0) + (f.spools || 0);
  });

  const monthlyData = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { sales: 0, expenses: 0 };
    if (t.type === 'sale') monthlyData[month].sales += t.amount || 0;
    if (t.type === 'expense') monthlyData[month].expenses += t.amount || 0;
  });

  res.json({
    totalSales,
    totalExpenses,
    netProfit,
    netAfterMachine,
    totalSpools,
    usableSpools,
    totalFilaments: filaments.length,
    materialBreakdown,
    monthlyData
  });
});

// Clear / Reset All Data
app.post('/api/clear', (req, res) => {
  const defaultData = {
    filaments: [],
    transactions: [],
    orders: [],
    printers: [],
    consumables: [],
    settings: {
      machineCost: 0,
      electricityRate: 8,
      printerPower: 350,
      defaultMarkup: 150,
      businessName: 'Made N More',
      currency: '₹',
      materialCosts: {}
    },
    _seeded: false
  };
  saveData(defaultData);
  res.json({ success: true, message: 'All data reset' });
});

// Settings Endpoints
app.get('/api/settings', (req, res) => {
  const data = loadData();
  res.json(data.settings || {});
});

app.put('/api/settings', (req, res) => {
  const data = loadData();
  data.settings = { ...(data.settings || {}), ...req.body };
  saveData(data);
  res.json(data.settings);
});

// ----- Generic Collection CRUD Endpoints -----
app.get('/api/:collection', (req, res) => {
  const data = loadData();
  const collection = getCollection(data, req.params.collection);
  res.json(collection);
});

app.get('/api/:collection/:id', (req, res) => {
  const data = loadData();
  const collection = getCollection(data, req.params.collection);
  const item = collection.find(i => String(i.id) === String(req.params.id));
  res.json(item || null);
});

app.post('/api/:collection', (req, res) => {
  const data = loadData();
  const collection = getCollection(data, req.params.collection);
  const newItem = {
    ...req.body,
    id: req.body.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  collection.push(newItem);
  saveData(data);
  res.status(201).json(newItem);
});

app.put('/api/:collection/:id', (req, res) => {
  const data = loadData();
  const collection = getCollection(data, req.params.collection);
  const idx = collection.findIndex(i => String(i.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  collection[idx] = {
    ...collection[idx],
    ...req.body,
    id: collection[idx].id,
    updatedAt: new Date().toISOString()
  };
  saveData(data);
  res.json(collection[idx]);
});

app.delete('/api/:collection/:id', (req, res) => {
  const data = loadData();
  const collection = getCollection(data, req.params.collection);
  const idx = collection.findIndex(i => String(i.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const removed = collection.splice(idx, 1)[0];
  saveData(data);
  res.json(removed);
});

// ----- Moonraker Printer Proxy Endpoints (solves browser CORS restrictions) -----
app.get('/api/printer/telemetry', async (req, res) => {
  const ip = req.query.ip || '192.168.0.144';
  const port = req.query.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/printer/objects/query?extruder&heater_bed&fan&toolhead&print_stats&virtual_sdcard&display_status`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message, online: false });
  }
});

app.post('/api/printer/gcode', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const script = req.body.script || req.query.script;
  const host = port == 80 ? ip : `${ip}:${port}`;

  if (!script) return res.status(400).json({ error: 'Missing script parameter' });

  try {
    const r = await fetch(`http://${host}/printer/gcode/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(6000)
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { result: text }; }
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message, success: false });
  }
});

app.post('/api/printer/pause', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/printer/print/pause`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000)
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/printer/resume', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/printer/print/resume`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000)
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/printer/cancel', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/printer/print/cancel`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000)
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/printer/emergency_stop', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/printer/emergency_stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000)
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/printer/files', async (req, res) => {
  const ip = req.query.ip || '192.168.0.144';
  const port = req.query.port || 80;
  const root = req.query.root || 'camera';
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/server/files/list?root=${encodeURIComponent(root)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message, result: [] });
  }
});

app.get('/api/printer/gcode_files', async (req, res) => {
  const ip = req.query.ip || '192.168.0.144';
  const port = req.query.port || 80;
  const host = port == 80 ? ip : `${ip}:${port}`;
  try {
    const r = await fetch(`http://${host}/server/files/list?root=gcodes`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message, result: [] });
  }
});

app.post('/api/printer/print/start', async (req, res) => {
  const ip = req.query.ip || req.body.ip || '192.168.0.144';
  const port = req.query.port || req.body.port || 80;
  const filename = req.query.filename || req.body.filename;
  const host = port == 80 ? ip : `${ip}:${port}`;

  if (!filename) return res.status(400).json({ error: 'Missing filename parameter' });

  try {
    const r = await fetch(`http://${host}/printer/print/start?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(4000)
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/printer/camera/snapshot', async (req, res) => {
  const ip = req.query.ip || '192.168.0.144';
  const port = req.query.port || 80;
  const urls = [
    `http://${ip}/webcam/?action=snapshot`,
    `http://${ip}:8080/?action=snapshot`,
    `http://${ip}/server/files/camera/snapshot.jpg`
  ];

  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(2500) });
      if (r.ok) {
        const buffer = await r.arrayBuffer();
        res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        return res.send(Buffer.from(buffer));
      }
    } catch {
      // try next
    }
  }
  res.status(502).send('Camera offline');
});


// Serve production build if dist exists
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Made N More API Server running on http://0.0.0.0:${PORT} (persisting to ${DATA_FILE})`);
});
