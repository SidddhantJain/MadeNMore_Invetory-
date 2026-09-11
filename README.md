# 🖨️ Made N More — 3D Printing Business Management System

A sleek, modern, all-in-one management dashboard engineered specifically for 3D printing businesses, maker studios, and rapid prototyping services. Track your filament inventory, log multi-stage client installment orders, manage cash flow finances, and calculate precise 3D print job costs with ease.

![Made N More Banner](public/favicon.svg)

---

## 🌟 Key Features

### 🧵 Filament & Material Inventory
- **Granular Spool Tracking**: Keep tabs on spools across diverse materials (**PLA+, PETG-HS, ABS, TPU, Silk, Glow/Luminous, Marble, Dual/Triple Color**).
- **Usability Status**: Mark materials as active, experimental, or unusable with visual tags.
- **Stock Level Indicators**: Real-time badges for in-stock, low-stock, and depletion alerts.
- **Dynamic Search & Material Filters**: Instant filtering by color name, material type, usability status, or brand.
- **Quick Adjustments**: Add, edit, or remove spools seamlessly through responsive modals.

### 📦 Orders & Milestone Installment Payments
- **Multi-Stage Payment Tracking**: Log client orders with percentage-based milestone payments (e.g., 28% advance deposit, 22% midway proof, 50% delivery completion).
- **Automated Tally Calculation**: Keep track of total contracted amounts, cumulative amounts paid, outstanding balance due, and payment progress percentage.
- **Audit Payment History**: Retain granular, dated transaction logs for every partial payment without losing previous records.
- **Order Status Workflow**: Track status from `Pending` ➔ `In Progress` ➔ `Completed` ➔ `Cancelled`.

### 💰 Financial Transactions & Ledger
- **Cash Flow Overview**: Real-time income and expense tracking with automatic net balance tallying.
- **Categorized Records**: Categorize finances by Material, Equipment, Maintenance, Sales Revenue, Operational Expenses, and more.
- **Instant Search & Date Sorting**: Filter transactions by transaction type (`Income` / `Expense`), category, or description.

### 🧮 3D Print Cost & Pricing Calculator
- **Precision Job Quoting**: Factor in filament weight (g), print duration (hours), electricity unit costs, machine wear & depreciation, failure margin %, and target profit margin.
- **Instant Quote Output**: Get recommended retail quote prices, break-even costs, and net margins before committing to client jobs.

### ⚙️ Settings, Data Backup & Seeding
- **Zero-Config Local Persistence**: High-speed, offline-first data layer powered by browser `localStorage`.
- **Export & Import (JSON)**: Backup entire databases (inventory, orders, transactions, config) into clean JSON files and restore anytime.
- **Factory Reset & Sample Seeding**: Built-in sample dataset seeded with real 3D printing spools and multi-stage payment orders for immediate demonstration.

---

## 🛠️ Tech Stack & Design Architecture

- **Core**: Vanilla JavaScript (ES Modules, modern component-page pattern)
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/) (ultra-fast HMR and bundle optimizer)
- **Styling**: Vanilla CSS3 design system with custom CSS properties
  - Modern dark-mode glassmorphism aesthetic
  - Fluid responsive layout (desktop sidebar + mobile collapsible navigation)
  - Micro-interactions, animated modal dialogs, and toast notifications
- **Icons**: Modular inline SVG icon system for crisp rendering at any display resolution

---

## 📁 Project Structure

```text
MadeNMore/
├── index.html              # Single page application entry point
├── package.json            # Project dependencies & scripts
├── vite.config.js          # Vite configuration
├── public/                 # Static assets (favicons, public icons)
│   └── favicon.svg
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── modal.js        # Accessible modal dialog system
│   │   └── toast.js        # Notification toast alerts
│   ├── data/               # State management & data persistence
│   │   ├── seed.js         # Initial sample database seeds
│   │   └── store.js        # localStorage CRUD wrapper & pub/sub events
│   ├── pages/              # Application route pages
│   │   ├── dashboard.js    # Metric KPI cards & business summary
│   │   ├── inventory.js    # Filament inventory management & filters
│   │   ├── orders.js       # Orders & percentage milestone payment tracking
│   │   ├── transactions.js # Income/expense bookkeeping ledger
│   │   ├── calculator.js   # 3D print job cost estimation tool
│   │   └── settings.js     # Data export, import, & system preferences
│   ├── styles/             # Global stylesheet & design tokens
│   │   └── main.css        # CSS variables, layout, glassmorphism UI
│   ├── utils/              # Utility helpers
│   │   ├── helpers.js      # Currency formatters, date parsers, math utils
│   │   └── icons.js        # SVG icon registry
│   └── main.js             # Client router, navigation, & initialization
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SidddhantJain/MadeNMore_Invetory-.git
   cd MadeNMore_Invetory-
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000` (or the URL shown in your terminal).

### Production Build

To build the static production distribution:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

---

## 📊 Usage Guide

### Logging an Installment Order
1. Navigate to **Orders** from the sidebar.
2. Click **+ New Order**, enter the client's name (e.g. *Product Designer*), total contract price (e.g. *₹6,750*), and initial milestone percentage (e.g. *28%*).
3. As the project advances, open the order and record subsequent milestone payments (e.g. *22%*, then *50%*).
4. The system automatically computes the running balance, keeps individual audit dates, and flags the order as **Paid in Full (100%)** once complete.

### Estimating a Print Job
1. Head over to **Calculator**.
2. Input estimated print time (hrs), filament used (grams), electricity tariff, and machine hourly rate.
3. Adjust the desired profit margin % to receive instant breakdown of material cost, overhead, and recommended quote price.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
