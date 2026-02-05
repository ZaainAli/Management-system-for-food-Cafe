# SETUP INSTRUCTIONS

## Issue: Native Module Version Mismatch

The error you're seeing happens because `better-sqlite3` (a native Node.js addon) was compiled for Node v20, but Electron 33 uses Node v18. We need to rebuild it for Electron's Node version.

## Solution

Run these commands in order:

```bash
# 1. Install dependencies
npm install

# 2. Rebuild better-sqlite3 for Electron
npm run rebuild

# 3. Start the app
npm run dev
```

## Alternative: If rebuild doesn't work

If you still get errors, try this:

```bash
# Remove node_modules and rebuild from scratch
rm -rf node_modules
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev
```

## Prerequisites

Make sure you have installed:
- **Python 3** (for node-gyp)
- **Build tools**:
  - **Linux**: `sudo apt-get install build-essential`
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: `npm install --global windows-build-tools`

## Still Having Issues?

If the rebuild still fails, you can temporarily test the app without better-sqlite3 by:

1. Comment out the `initializeDatabase()` call in `app/main/index.js` (line 19)
2. Mock the database responses in the controllers
3. Use the UI to verify the React frontend works

Once you get the build tools installed properly, uncomment and rebuild.

---

## Quick Test After Setup

1. App should open with a login screen
2. Login: **admin** / **admin123**
3. You should see the dashboard with 0 values (no data yet)
4. Navigate to POS → add some menu items
5. Create a bill
6. Check the dashboard again to see the data update

---

**Default Credentials:**
- Username: `admin`
- Password: `admin123`
- Role: `admin` (full access)
