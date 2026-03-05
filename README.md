# Restaurant Desktop App

A full-featured restaurant management desktop application built with **Electron**, **React**, **Tailwind CSS**, and **SQLite** (via better-sqlite3).

---

## Features

| Module       | Capabilities                                                                 |
|--------------|------------------------------------------------------------------------------|
| **Auth**     | Login/logout, role-based access (admin / manager / staff), password change   |
| **POS**      | Menu items & categories, cart with qty controls, discount, tax, bill creation |
| **Inventory**| Stock CRUD, quantity adjustments with audit log, low-stock alerts            |
| **Expenses** | Expense CRUD, category filtering, running totals                             |
| **Staff**    | Employee CRUD, salary records & payment history, position management         |
| **Reports**  | Dashboard KPIs, sales reports, expense breakdowns, staff summaries, P&L      |

---

## Tech Stack

| Layer         | Technology                                        |
|---------------|---------------------------------------------------|
| Desktop Shell | Electron 33                                       |
| Backend       | Node.js + IPC (replaces Express in desktop apps)  |
| Database      | SQLite via better-sqlite3 (WAL mode)              |
| Frontend      | React 18 + React Router 6                         |
| Styling       | Tailwind CSS 3                                    |
| State         | React Context (Auth), local component state       |
| Build         | Vite 6 + @vitejs/plugin-react                     |

---

## Project Structure

```
restaurant-desktop-app/
├── app/
│   ├── main/                 # Electron main process
│   │   ├── index.js          # App bootstrap, BrowserWindow setup
│   │   ├── ipc/              # IPC route registrations (like Express routes)
│   │   ├── controllers/      # Request handling + response formatting
│   │   ├── services/         # Core business logic
│   │   ├── models/           # Direct SQLite query layer
│   │   ├── middlewares/      # Auth + role-check wrappers
│   │   ├── db/               # SQLite connection + schema/migrations
│   │   └── utils/            # Logger, crypto, backup helpers
│   ├── preload/
│   │   └── index.js          # contextBridge API bridge (renderer ↔ main)
│   └── renderer/             # React SPA
│       ├── index.html
│       └── src/
│           ├── main.jsx      # React entry point
│           ├── styles.css    # Tailwind + custom component classes
│           ├── app/          # Page components (auth, pos, stock, etc.)
│           ├── layouts/      # SidebarLayout
│           └── store/        # AuthContext provider
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Getting Started

### Prerequisites

This app uses `better-sqlite3`, a native Node.js addon that requires compilation. Make sure you have:

- **Node.js** v18 or v20
- **Build tools**:
  - **Linux**: `sudo apt-get install build-essential python3`
  - **macOS**: Xcode Command Line Tools — `xcode-select --install`
  - **Windows**: `npm install --global windows-build-tools`

### Quick Start (Automated)

```bash
./setup.sh
```

### Manual Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Rebuild Native Modules for Electron

```bash
npm run rebuild
```

> **Important:** This step rebuilds `better-sqlite3` to match Electron's Node.js version. If you skip it, you'll get a `NODE_MODULE_VERSION` mismatch error.

#### 3. Run in Development Mode

```bash
npm run dev
```

This starts both Vite (React dev server on port 5173) and Electron simultaneously.

### Troubleshooting

**Error: "was compiled against a different Node.js version" (NODE_MODULE_VERSION mismatch)**

`better-sqlite3` was compiled for plain Node.js but Electron uses its own Node.js runtime with a different MODULE_VERSION. You must rebuild the native module against Electron's headers.

`npm run rebuild` uses `electron-rebuild`, which requires Node.js v20+. If you're on Node.js v18 (the default on many systems), it will crash with `TypeError: util.styleText is not a function`. Use `node-gyp` directly instead:

```bash
cd node_modules/better-sqlite3
HOME=~/.electron-gyp /path/to/repo/node_modules/.bin/node-gyp rebuild \
  --target=28.3.3 \
  --arch=x64 \
  --dist-url=https://electronjs.org/headers
cd ../..
```

Replace `28.3.3` with your actual Electron version (`cat node_modules/electron/package.json | grep '"version"'`).

> **Why this happens:** `npm install` compiles `better-sqlite3` against the system Node.js. Electron embeds its own Node.js with a different ABI version, so the `.node` binary must be recompiled targeting Electron's headers every time you run `npm install`.

**Still having issues?**

See `SETUP.md` for detailed troubleshooting steps.

### 3. Default Credentials

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | admin |

---

## Architecture Notes

### IPC Pattern (replaces HTTP)
Instead of Express routes, this app uses Electron's `ipcMain.handle` / `ipcRenderer.invoke` pattern. Each module has:
- **Routes file** (`ipc/*.routes.js`) — registers channel handlers, applies middleware
- **Controller** — wraps service calls in try/catch, returns `{ success, data/error }`
- **Service** — pure business logic, validation, orchestration
- **Model** — raw SQL queries via better-sqlite3

### Middleware
`requireAuth` and `requireRole` are higher-order functions that wrap IPC handlers — functionally equivalent to Express middleware but adapted for the synchronous IPC pattern.

### Database
- SQLite file is stored in Electron's `userData` directory (OS-specific, persistent)
- Schema is created via `CREATE TABLE IF NOT EXISTS` on every startup
- Default admin user and 10 tables are seeded automatically on first run
- WAL mode enabled for better read performance

### Security
- Passwords are hashed with bcrypt (10 salt rounds)
- `contextIsolation: true` + `nodeIntegration: false` in BrowserWindow
- The preload script exposes only explicitly defined API methods via `contextBridge`
- Role-based access control on all mutating operations

---

## Adding New Modules

1. Create IPC route file in `app/main/ipc/`
2. Register it in `app/main/ipc/index.js`
3. Create controller → service → model following existing patterns
4. Expose API methods in `app/preload/index.js`
5. Add the React page in `app/renderer/src/app/<module>/`
6. Add route in `app/renderer/src/app/App.jsx`
7. Add nav item in `app/renderer/src/layouts/SidebarLayout.jsx`
