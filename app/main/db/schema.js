const { hashPassword } = require('../utils/crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function runMigrations(db) {
  db.exec(`
    -- Users table (auth)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Menu categories
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      createdAt TEXT NOT NULL
    );

    -- Menu items
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      halfPrice REAL,
      categoryId TEXT,
      isAvailable INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (categoryId) REFERENCES menu_categories(id)
    );

    -- Tables (restaurant tables)
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      number INTEGER UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'free',
      createdAt TEXT NOT NULL
    );

    -- Bills
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      tableId TEXT,
      customerName TEXT DEFAULT '',
      subtotal REAL NOT NULL,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      paymentMethod TEXT NOT NULL DEFAULT 'cash',
      status TEXT NOT NULL DEFAULT 'completed',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (tableId) REFERENCES tables(id)
    );

    -- Held bills (saved POS drafts)
    CREATE TABLE IF NOT EXISTS held_bills (
      id TEXT PRIMARY KEY,
      tableId TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paymentMethod TEXT NOT NULL DEFAULT 'cash',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (tableId) REFERENCES tables(id)
    );

    -- Held bill line items
    CREATE TABLE IF NOT EXISTS held_bill_items (
      id TEXT PRIMARY KEY,
      heldBillId TEXT NOT NULL,
      menuItemId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      isAvailable INTEGER NOT NULL DEFAULT 1,
      basePrice REAL NOT NULL DEFAULT 0,
      halfPrice REAL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (heldBillId) REFERENCES held_bills(id),
      FOREIGN KEY (menuItemId) REFERENCES menu_items(id)
    );

    -- Bill line items
    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      billId TEXT NOT NULL,
      menuItemId TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      lineTotal REAL NOT NULL,
      FOREIGN KEY (billId) REFERENCES bills(id),
      FOREIGN KEY (menuItemId) REFERENCES menu_items(id)
    );

    -- Stock / Inventory
    CREATE TABLE IF NOT EXISTS stock_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      reorderLevel INTEGER NOT NULL DEFAULT 5,
      unitPrice REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Stock adjustment audit log
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      stockItemId TEXT NOT NULL,
      previousQty INTEGER NOT NULL,
      adjustment INTEGER NOT NULL,
      newQty INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (stockItemId) REFERENCES stock_items(id)
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      sourceType TEXT NOT NULL DEFAULT 'manual', -- manual | khata | salary
      sourceEntityId TEXT DEFAULT NULL, -- khata profile id | employee id
      sourceEntityName TEXT DEFAULT '',
      sourceRecordId TEXT DEFAULT NULL, -- khata transaction id | salary record id
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Khata (Ledger) profiles
    CREATE TABLE IF NOT EXISTS khata_profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      businessDetails TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Khata transactions (dues/payments)
    CREATE TABLE IF NOT EXISTS khata_transactions (
      id TEXT PRIMARY KEY,
      khataId TEXT NOT NULL,
      type TEXT NOT NULL, -- due | payment
      amount REAL NOT NULL,
      paymentSource TEXT DEFAULT NULL, -- today_sale | net_profit
      note TEXT DEFAULT '',
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (khataId) REFERENCES khata_profiles(id)
    );

    -- Daily Sales Aggregates (for fast reports)
    CREATE TABLE IF NOT EXISTS daily_sales (
      date TEXT PRIMARY KEY, -- YYYY-MM-DD
      totalRevenue REAL NOT NULL DEFAULT 0,
      totalBills INTEGER NOT NULL DEFAULT 0,
      totalExpenses REAL NOT NULL DEFAULT 0,
      updatedAt TEXT
    );

    -- Employees
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT 'Staff',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      monthlySalary REAL NOT NULL DEFAULT 0,
      hireDate TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Salary records
    CREATE TABLE IF NOT EXISTS salary_records (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT NOT NULL,
      amount REAL NOT NULL,
      payDate TEXT NOT NULL,
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES employees(id)
    );

    -- Attendance
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      hoursWorked REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES employees(id),
      UNIQUE(employeeId, date)
    );

    -- Discounted bills log
    CREATE TABLE IF NOT EXISTS discounted_bills (
      id TEXT PRIMARY KEY,
      billId TEXT NOT NULL,
      tableNum INTEGER,
      billAmount REAL NOT NULL,
      discountAmount REAL NOT NULL,
      finalAmount REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (billId) REFERENCES bills(id)
    );

    -- Quick keys (POS keyboard shortcuts for frequent items)
    CREATE TABLE IF NOT EXISTS quick_keys (
      key TEXT PRIMARY KEY,
      menuItemId TEXT NOT NULL,
      FOREIGN KEY (menuItemId) REFERENCES menu_items(id)
    );

    -- App metadata (schema/data migrations)
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Lightweight column migrations
  const menuCols = db.prepare("PRAGMA table_info(menu_items)").all().map(c => c.name);
  if (!menuCols.includes('halfPrice')) {
    db.prepare('ALTER TABLE menu_items ADD COLUMN halfPrice REAL').run();
  }

  const expenseCols = db.prepare("PRAGMA table_info(expenses)").all().map(c => c.name);
  if (!expenseCols.includes('sourceType')) {
    db.prepare("ALTER TABLE expenses ADD COLUMN sourceType TEXT NOT NULL DEFAULT 'manual'").run();
    logger.info('Migration: Added sourceType column to expenses table');
  }
  if (!expenseCols.includes('sourceEntityId')) {
    db.prepare('ALTER TABLE expenses ADD COLUMN sourceEntityId TEXT DEFAULT NULL').run();
    logger.info('Migration: Added sourceEntityId column to expenses table');
  }
  if (!expenseCols.includes('sourceEntityName')) {
    db.prepare("ALTER TABLE expenses ADD COLUMN sourceEntityName TEXT DEFAULT ''").run();
    logger.info('Migration: Added sourceEntityName column to expenses table');
  }
  if (!expenseCols.includes('sourceRecordId')) {
    db.prepare('ALTER TABLE expenses ADD COLUMN sourceRecordId TEXT DEFAULT NULL').run();
    logger.info('Migration: Added sourceRecordId column to expenses table');
  }

  const attendanceCols = db.prepare("PRAGMA table_info(attendance)").all().map(c => c.name);
  if (!attendanceCols.includes('hoursWorked')) {
    db.prepare('ALTER TABLE attendance ADD COLUMN hoursWorked REAL NOT NULL DEFAULT 0').run();
    logger.info('Migration: Added hoursWorked column to attendance table');
  }

  const discountedBillCols = db.prepare("PRAGMA table_info(discounted_bills)").all().map(c => c.name);
  if (!discountedBillCols.includes('tableNum')) {
    db.prepare('ALTER TABLE discounted_bills ADD COLUMN tableNum INTEGER').run();
    logger.info('Migration: Added tableNum column to discounted_bills table');
  }

  // Backfill daily_sales once (if empty)
  const dailySalesCount = db.prepare('SELECT COUNT(*) as count FROM daily_sales').get();
  if (dailySalesCount.count === 0) {
    const now = new Date().toISOString();

    // Aggregate bills by date
    db.prepare(`
      INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
      SELECT substr(createdAt, 1, 10) as date, SUM(total) as revenue, COUNT(*) as bills, 0 as expenses, ?
      FROM bills
      GROUP BY substr(createdAt, 1, 10)
    `).run(now);

    // Aggregate expenses by date (merge with existing rows)
    db.prepare(`
      INSERT INTO daily_sales (date, totalRevenue, totalBills, totalExpenses, updatedAt)
      SELECT date, 0 as revenue, 0 as bills, SUM(amount) as expenses, ?
      FROM expenses
      GROUP BY date
      ON CONFLICT(date) DO UPDATE SET
        totalExpenses = totalExpenses + excluded.totalExpenses,
        updatedAt = excluded.updatedAt
    `).run(now);

    logger.info('Backfilled daily_sales from existing bills and expenses');
  }

  // Seed menu categories (must come before menu items)
  const catCount = db.prepare('SELECT COUNT(*) as count FROM menu_categories').get();
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO menu_categories (id, name, createdAt) VALUES (?, ?, ?)');
    const categories = [
      { id: 'cat-01', name: 'Main Course' },
      { id: 'cat-02', name: 'Drinks' }
    ];
    categories.forEach(({ id, name }) => {
      insertCat.run(id, name, new Date().toISOString());
    });
    logger.info('Seeded menu categories');
  }

  // Migration: Update default menu items if seed version changes
  const getMeta = db.prepare('SELECT value FROM app_meta WHERE key = ?');
  const setMeta = db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const menuSeedVersion = Number((getMeta.get('menu_seed_version') || {}).value || 0);
  const targetMenuSeedVersion = 1;
  if (menuSeedVersion < targetMenuSeedVersion) {
    const now = new Date().toISOString();
    const upsertItem = db.prepare(`
      INSERT INTO menu_items (id, name, description, price, halfPrice, categoryId, isAvailable, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        price = excluded.price,
        halfPrice = excluded.halfPrice,
        categoryId = excluded.categoryId,
        isAvailable = excluded.isAvailable,
        updatedAt = excluded.updatedAt
    `);

    const seedItems = [
      { id: 'item-001', name: 'Dall Mash', desc: 'Herb-marinated chicken with roasted vegetables', price: 180.00, halfPrice: 120.00, catId: 'cat-01' },
      { id: 'item-002', name: 'Dall Chana', desc: 'Classic burger with lettuce, tomato, and fries', price: 180.00, halfPrice: 120.00, catId: 'cat-01' },
      { id: 'item-003', name: 'Beef Kabab', desc: 'Fresh mozzarella, tomato sauce, and basil', price: 130.00, halfPrice: null, catId: 'cat-01' },
      { id: 'item-004', name: 'S-Beef Kabab', desc: 'Creamy pasta with bacon and parmesan', price: 180.00, halfPrice: null, catId: 'cat-01' },
      { id: 'item-005', name: 'Sabzi', desc: 'Atlantic salmon with lemon butter sauce', price: 180.00, halfPrice: 120.00, catId: 'cat-01' },
      { id: 'item-006', name: 'Qeema', desc: 'Mixed vegetables with tofu in teriyaki sauce', price: 400.00, halfPrice: 250.00, catId: 'cat-01' },
      { id: 'item-007', name: 'Rita', desc: 'Tender pork ribs with BBQ sauce and coleslaw', price: 10.00, halfPrice: null, catId: 'cat-01' },
      { id: 'item-008', name: 'Alu-Anda', desc: 'Battered cod with french fries and tartar sauce', price: 150.00, halfPrice: 100.00, catId: 'cat-01' },
      { id: 'item-009', name: 'Kalaji', desc: 'Grilled vegetable stir-fry with garlic sauce', price: 250.00, halfPrice: 150.00, catId: 'cat-01' },
      { id: 'item-010', name: 'Chicken Kharai', desc: 'Marinated chicken pieces grilled to perfection', price: 300.00, halfPrice: 200.00, catId: 'cat-01' },
      { id: 'item-011', name: 'Roti', desc: 'Tender mutton pieces grilled to perfection', price: 15.00, halfPrice: null, catId: 'cat-01' },
      { id: 'item-012', name: 'Regular', desc: 'Chilled soft drink', price: 70.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-013', name: 'Drink-1 Liter', desc: '', price: 170.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-014', name: 'Drink-1.5 Liter', desc: '', price: 200.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-015', name: 'Drink-2.5 Liter', desc: '', price: 240.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-016', name: 'Chay', desc: '', price: 70.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-017', name: 'S-Chay', desc: '', price: 90.00, halfPrice: null, catId: 'cat-02' },
      { id: 'item-018', name: 'Mineral Water-1.5 Liter', desc: '', price: 120.00, halfPrice: null, catId: 'cat-02' },
    ];

    const seedTx = db.transaction(() => {
      seedItems.forEach(item => {
        upsertItem.run(
          item.id,
          item.name,
          item.desc,
          item.price,
          item.halfPrice,
          item.catId,
          1,
          now,
          now
        );
      });
      setMeta.run('menu_seed_version', String(targetMenuSeedVersion));
    });

    seedTx();
    logger.info('Migration: Updated default menu items (seed v1)');
  }

  // Migration: Add createdAt column to users table if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasCreatedAt = columns.some(col => col.name === 'createdAt');
  if (!hasCreatedAt) {
    db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT DEFAULT ''");
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET createdAt = ? WHERE createdAt = '' OR createdAt IS NULL").run(now);
    logger.info('Migration: Added createdAt column to users table');
  }
  const hasUpdatedAt = columns.some(col => col.name === 'updatedAt');
  if (!hasUpdatedAt) {
    db.exec("ALTER TABLE users ADD COLUMN updatedAt TEXT");
    logger.info('Migration: Added updatedAt column to users table');
  }

  // Migration: Add canManage column to users table if it doesn't exist
  const columnsAfter = db.prepare("PRAGMA table_info(users)").all();
  const hasCanManage = columnsAfter.some(col => col.name === 'canManage');
  if (!hasCanManage) {
    db.exec('ALTER TABLE users ADD COLUMN canManage INTEGER NOT NULL DEFAULT 0');
    logger.info('Migration: Added canManage column to users table');
  }

  // Seed default admin user if none exists
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
  if (adminExists.count === 0) {
    const hashedPassword = hashPassword('admin123'); // bcryptjs sync version for setup
    db.prepare(`
      INSERT INTO users (id, username, password, role, createdAt)
      VALUES ('admin-001', 'admin', ?, 'admin', ?)
    `).run(hashedPassword, new Date().toISOString());
    logger.info('Default admin user seeded (username: admin, password: admin123)');
  }

  // Seed default cashier user if none exists
  const cashierExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('cashier');
  if (cashierExists.count === 0) {
    const hashedCashierPw = hashPassword('cashier123');
    db.prepare(`
      INSERT INTO users (id, username, password, role, canManage, createdAt)
      VALUES ('cashier-001', 'cashier', ?, 'cashier', 0, ?)
    `).run(hashedCashierPw, new Date().toISOString());
    logger.info('Default cashier user seeded (username: cashier, password: cashier123)');
  }

  // Seed default tables (1–10)
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get();
  if (tableCount.count === 0) {
    const insertTable = db.prepare('INSERT INTO tables (id, number, capacity, status, createdAt) VALUES (?, ?, ?, ?, ?)');
    for (let i = 1; i <= 10; i++) {
      insertTable.run(`table-${String(i).padStart(2, '0')}`, i, i <= 4 ? 4 : 6, 'free', new Date().toISOString());
    }
    logger.info('Seeded 10 default tables');
  }

  // Seed default menu items
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  if (itemCount.count === 0) {
    const insertItem = db.prepare(`
      INSERT INTO menu_items (id, name, description, price, categoryId, isAvailable, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    // Main Course (cat-02)
    const mainCourse = [
      { name: 'Dall Mash', desc: 'Herb-marinated chicken with roasted vegetables', price: 180.00, halfPrice: 120.00 },
      { name: 'Dall Chana', desc: 'Classic burger with lettuce, tomato, and fries', price: 180.00, halfPrice: 120.00 },
      { name: 'Beef Kabab', desc: 'Fresh mozzarella, tomato sauce, and basil', price: 130.00 },
      { name: 'S-Beef Kabab', desc: 'Creamy pasta with bacon and parmesan', price: 180 },
      { name: 'Sabzi', desc: 'Atlantic salmon with lemon butter sauce', price: 180.00, halfPrice: 120.00 },
      { name: 'Qeema', desc: 'Mixed vegetables with tofu in teriyaki sauce', price: 400.00, halfPrice: 250.00 },
      { name: 'Rita', desc: 'Tender pork ribs with BBQ sauce and coleslaw', price: 10.00 },
      { name: 'Alu-Anda', desc: 'Battered cod with french fries and tartar sauce', price: 150.00, halfPrice: 100.00 },
      { name: 'Kalaji', desc: 'Grilled vegetable stir-fry with garlic sauce', price: 250.00, halfPrice: 150.00 },
      { name: 'Chicken Kharai', desc: 'Marinated chicken pieces grilled to perfection', price: 300.00, halfPrice: 200.00 },
      { name: 'Roti', desc: 'Tender mutton pieces grilled to perfection', price: 150.00}
    ];


    // Drinks (cat-04)
    const drinks = [
      { name: 'Regular', desc: 'Chilled soft drink', price: 70 },
      { name: 'Drink-1 Liter', price: 170 },
      { name: 'Drink-1.5 Liter', price: 200 },
      { name: 'Drink-2.5 Liter',  price: 240 },
      { name: 'Chay ', price: 70},
      { name: 'S-Chay', price: 90 },
      { name: 'Mineral Water-1.5 Liter', price:120 }
    ];


    // Insert all items
    let itemId = 1;
    [
      { catId: 'cat-01', items: mainCourse },
      { catId: 'cat-02', items: drinks }
    ].forEach(({ catId, items }) => {
      items.forEach((item) => {
        insertItem.run(
          `item-${String(itemId).padStart(3, '0')}`,
          item.name,
          item.desc,
          item.price,
          catId,
          1,
          now
        );
        itemId++;
      });
    });

    logger.info(`Seeded ${itemId - 1} default menu items`);
  }
}

module.exports = { runMigrations };
