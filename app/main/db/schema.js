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
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
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
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES employees(id),
      UNIQUE(employeeId, date)
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
      { id: 'item-011', name: 'Roti', desc: 'Tender mutton pieces grilled to perfection', price: 150.00, halfPrice: null, catId: 'cat-01' },
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

  // Migration: Add canManage column to users table if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasCanManage = columns.some(col => col.name === 'canManage');
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
