# 🖨️ Made N More — Universal 3D Printer Farm OS & Workshop Executive System

A modern, production-grade Manufacturing Executive System (MES) and 3D Printer Fleet Hub engineered specifically for high-throughput 3D printing businesses, farm operators, and rapid prototyping labs.

Made N More unites real-time physical machine telemetry, automated inventory deduction, multi-stage milestone quoting, workshop lab logistics, multi-account financial treasury, and an integrated **OrcaSlicer Studio** into a single glassmorphic interface accessible across all workshop devices over LAN.

![Made N More Banner](public/favicon.svg)

---

## 🌟 Master Feature Highlights

### 🖨️ 1. Universal 3D Printer Fleet Hub (5 Protocols Supported)
Standardized real-time telemetry (hotend, bed, chamber temp, active job, progress, elapsed time, and AMS multi-color tray status) across modern 3D printers:
- **📡 Moonraker (Klipper)**: Direct LAN integration for Snapmaker U1 (`192.168.0.144`), Voron 2.4, Creality K1/Max, and Elegoo Neptune 4.
  - **Klipper Command Center**: Interactive Jog D-Pad (0.1mm to 100mm), Z-lift, Target Temp Sliders, Filament Feed Drive (extrude/retract purge), interactive G-Code terminal console, virtual SD card job launcher, and Emergency Stop (`M112`).
  - **Dynamic IP Scanner**: Subnet scanner that automatically detects new dynamic DHCP IPs when printers reboot.
- **🐙 OctoPrint (Marlin & RepRap)**: Backend proxy bypassing CORS restrictions for Creality Ender 3, CR-10, Prusa MK3S, and Anycubic.
- **🎋 Bambu Lab Local LAN Mode**: Direct TLS MQTT (`port 8883`) & FTPS adapter with Access Code authentication and real-time **4-slot AMS multi-color filament monitoring** for X1-Carbon, P1S, P1P, and A1 series.
- **🟠 PrusaLink REST API**: Full status & job telemetry for Original Prusa MK4, XL multi-toolhead, and Mini+.
- **🔌 Direct WebSerial USB COM**: Browser-native WebSerial connection for tethered workshop laptops communicating directly with Marlin/RepRap hardware.

### 🔪 2. OrcaSlicer Integrated Studio & Headless Engine
- **Local Slicer Auto-Discovery**: Automatically detects installed instances of **OrcaSlicer** (`D:\software\OrcaSlicer\orca-slicer.exe`) and **Snapmaker Orca** (`snapmaker-orca.exe`).
- **Interactive Slicing Studio Modal**: Machine profiles (Snapmaker U1, Voron, Bambu P1S, Ender 3), filament presets, layer height (0.12mm–0.28mm), infill patterns (Gyroid, Grid, Honeycomb), wall loops, and support options.
- **Pre-Flight Telemetry**: Instant calculations of filament mass ($g$), print duration ($h$), power draw, machine wear reserve, and recommended retail quote before starting prints.
- **1-Click Native Slicer Launch**: Opens the desktop OrcaSlicer application directly with your selected part.
- **1-Click LAN Farm Dispatch**: Sends sliced jobs straight to Moonraker, OctoPrint, or Bambu printers over LAN.

### 📹 3. Optimized High-Speed Single-ZIP Timelapse Downloader
- **📦 Single ZIP Archive Download**: Download all timelapse video recordings in one click (`timelapses_<printer>_<date>.zip`) instead of dozens of sequential popups.
- **⚡ High-Speed LAN Stream (`/api/printer/timelapse/zip`)**: Node.js streams directly from the printer over local LAN using **Store Compression (Level 0)** to eliminate CPU recompression delays for MP4 video.
- **Client-Side Parallel Fallback (`JSZip`)**: Parallel batch fetching (3 streams at a time) ensures reliable offline bundling.
- **Direct Web Media Player**: Built-in MP4 player and high-res layer photo inspector.

### ⚖️ 4. Workshop Spool Tare & Lab Logistics (Phase 4)
- **Digital Tare Scale Subtractor**: Weigh physical spools on a kitchen/digital scale to calculate exact usable remaining filament, subtracting manufacturer spool tare weight.
- **Job Feasibility Checker**: Verifies whether remaining filament is sufficient to finish a sliced job before starting.
- **📋 Printable Job Traveler Card**: Generates an A4 production router and QC checklist with QR code for the shop floor.
- **⚠️ Universal Scrap Loss & Defect Logger**: Log failed prints, spaghetti waste, and purge poops; automatically debits material loss to the financial ledger.
- **Thermal QR Spool Labels (50x30mm)**: Generates printable QR stickers for warehouse shelves and dry boxes.
- **Hardware & Consumables Fast-Pull**: Track stock of brass heat-set inserts (M2–M5), hardened steel nozzles, IPA, and PEI build plates.

### 💳 5. Multi-Account Banking & Treasury Suite (Phase 3)
- **Real-World Account Balances**: Manage HDFC Business Current A/c, Workshop UPI (PhonePe QR), Workshop Cash Drawer, and Capex Sinking Fund.
- **Inter-Account Transfers**: Move funds between cash drawer, UPI, and bank accounts with automatic ledger audit trails.
- **Bank Statement Reconciliation**: Reconcile balance discrepancies with 1-click adjusting vouchers.
- **Liquid Capital Ribbon**: Real-time cash visibility badge in top navbar.

### 📦 6. Orders, Kanban & Milestone Payments
- **Milestone Installment Billing**: Log percentage-based payments (e.g. 28% advance deposit, 22% proof, 50% delivery).
- **8-Stage Visual Production Kanban**: Drag & drop orders from `In Queue` ➔ `Slicing` ➔ `Printing` ➔ `Post-Processing` ➔ `QC Passed` ➔ `Ready`.
- **GST Tax Invoicing**: Generates A4 PDF tax invoices with SAC 9988 / HSN 3916 codes.

### 💾 7. Settings, Full Backups & Smart Import
- **⚙️ Export Settings Only (JSON)**: Back up business defaults, machine wear cost, markup %, electricity tariffs, and material rates.
- **📦 Export Full Workshop OS Archive (JSON)**: Full backup of settings + filaments + printers + orders + transactions + consumables + accounts.
- **📊 Spreadsheet CSV Exports**: 1-click CSV exports for Filaments, Orders, Transactions, Consumables, and Accounts.
- **📥 Smart Import Preview Modal**:
  - Automatically analyzes incoming JSON and highlights detected components.
  - **"Merge with Current Data"**: Updates settings and merges records into active database without wiping existing work.
  - **"Clean Restore / Replace All"**: Complete database restoration.

---

## 🛠️ Technical Architecture

```text
MadeNMore/
├── server/
│   └── api.js              # Express 5 backend (0.0.0.0:4000) with ACID JSON persistence
├── src/
│   ├── services/
│   │   ├── universalPrinterService.js  # Unified Moonraker, OctoPrint, Bambu, PrusaLink, WebSerial adapter
│   │   └── moonrakerService.js         # Snapmaker U1 direct LAN bridge, D-pad, G-code console & IP scanner
│   ├── utils/
│   │   ├── slicerStudio.js # OrcaSlicer integration modal, pre-flight telemetry & 1-click dispatch
│   │   ├── tareCalculator.js # Digital scale spool tare & parts yield estimator
│   │   ├── scrapLogger.js  # Universal scrap defect logger & financial debit hook
│   │   ├── slicerParser.js # .gcode / .3mf metadata extractor (mass, duration, temperatures)
│   │   └── helpers.js      # Formatting, CSV generators, blob downloaders
│   ├── pages/
│   │   ├── printers.js     # Universal Fleet Hub, Klipper Command Center & Timelapse Gallery
│   │   ├── orders.js       # Production Kanban, milestone installment invoicing
│   │   ├── inventory.js    # Spool stock, QR labels, and fast-pull consumables
│   │   ├── transactions.js # Multi-account banking treasury, ledger, and reconciliation
│   │   ├── calculator.js   # Commercial unit economics pricing engine
│   │   └── settings.js     # Business defaults, tariffs, export/import modal
│   ├── data/
│   │   ├── store.js        # Reactive in-memory state with optimistic sync & pub/sub events
│   │   ├── seed.js         # Default filament, printer, and account presets
│   │   └── persisted.json  # Backend persistent database file
│   └── styles/
│       └── main.css        # Vanilla CSS3 glassmorphism design tokens & micro-animations
├── FUTURE_PLAN.md          # Master Strategic Roadmap & Farm Scaling Engine (Phases 1 - 8)
├── package.json            # Project dependencies (archiver, jszip, concurrently, express, cors, vite)
└── create-desktop-shortcut.bat # Windows desktop shortcut launcher
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher recommended)
- [npm](https://www.npmjs.com/)

### 1. Installation
```bash
git clone https://github.com/SidddhantJain/MadeNMore_Invetory-.git
cd MadeNMore_Invetory-
npm install
```

### 2. Launch Development & Fleet Servers
Starts both the **Node.js Express API Server** (`port 4000`) and the **Vite Dashboard** (`port 3000`):
```bash
npm start
```

### 3. Open in Browser
- **Local Machine:** `http://localhost:3000/`
- **Workshop LAN (Tablets / Phones):** `http://<your-lan-ip>:3000/` (e.g. `http://192.168.0.143:3000/`)
- **Backend API:** `http://localhost:4000/`

---

## 🖨️ Hardware Configuration Defaults

| Component | Default Workshop Value |
| :--- | :--- |
| **Snapmaker U1 Moonraker IP** | `192.168.0.144` (Port `80`, autodetected on reboot) |
| **Bambu Lab LAN Mode Port** | `8883` (TLS MQTT) |
| **OctoPrint Proxy Port** | `5000` |
| **Commercial Electricity Tariff** | `₹8.50 / kWh` |
| **Average Printer Power Draw** | `350 Watts` |
| **Machine Capex Cost** | `₹55,000` amortized over 3,000 operational hours |
| **Default Commercial Markup** | `150%` ($2.5\times$ base cost) |

---

## 📜 Production Build & Deployment

To compile the optimized static production bundle:
```bash
npm run build
```

To run the production Node.js server with static assets enabled:
```bash
node server/api.js
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).  
*Engineered for Made N More & 3D Printing Labs — Pune Industrial Corridor, Maharashtra, India.*
