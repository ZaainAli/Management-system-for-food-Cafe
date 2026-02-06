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

    -- Bill owners (Billing)
    CREATE TABLE IF NOT EXISTS bill_owners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      description TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- Bill payments (Billing)
    CREATE TABLE IF NOT EXISTS bill_payments (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      amount REAL NOT NULL,
      payDate TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'today_sale',
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ownerId) REFERENCES bill_owners(id)
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
  `);

  // Lightweight column migrations
  const menuCols = db.prepare("PRAGMA table_info(menu_items)").all().map(c => c.name);
  if (!menuCols.includes('halfPrice')) {
    db.prepare('ALTER TABLE menu_items ADD COLUMN halfPrice REAL').run();
  }

  // Migration: Add canManage column to users table if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasCanManage = columns.some(col => col.name === 'canManage');
  if (!hasCanManage) {
    db.exec('ALTER TABLE users ADD COLUMN canManage INTEGER NOT NULL DEFAULT 0');
    logger.info('Migration: Added canManage column to users table');
  }

  // Migration: Backfill missing employee IDs (legacy rows with NULL/empty id)
  const employeesMissingId = db.prepare("SELECT rowid FROM employees WHERE id IS NULL OR id = ''").all();
  if (employeesMissingId.length > 0) {
    const updateEmpId = db.prepare('UPDATE employees SET id = ? WHERE rowid = ?');
    employeesMissingId.forEach(row => {
      updateEmpId.run(uuidv4(), row.rowid);
    });
    logger.info(`Migration: Backfilled ${employeesMissingId.length} employee IDs`);
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

  // Seed sample menu categories
  const catCount = db.prepare('SELECT COUNT(*) as count FROM menu_categories').get();
  if (catCount.count === 0) {
    const insertCat = db.prepare('INSERT INTO menu_categories (id, name, createdAt) VALUES (?, ?, ?)');
    const categories = ['Appetizers', 'Main Course', 'Desserts', 'Drinks', 'Sides'];
    categories.forEach((name, i) => {
      insertCat.run(`cat-${String(i + 1).padStart(2, '0')}`, name, new Date().toISOString());
    });
    logger.info('Seeded menu categories');
  }

  // Seed default menu items
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  if (itemCount.count === 0) {
    const insertItem = db.prepare(`
      INSERT INTO menu_items (id, name, description, price, categoryId, isAvailable, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    // Appetizers (cat-01)
    const appetizers = [
      { name: 'Spring Rolls', desc: 'Crispy vegetable spring rolls with sweet chili sauce', price: 6.99 },
      { name: 'Chicken Wings', desc: 'Spicy buffalo wings with ranch dip', price: 9.99 },
      { name: 'Garlic Bread', desc: 'Toasted bread with garlic butter and herbs', price: 4.99 },
      { name: 'Mozzarella Sticks', desc: 'Breaded mozzarella with marinara sauce', price: 7.99 },
      { name: 'Bruschetta', desc: 'Grilled bread with tomatoes, basil, and olive oil', price: 8.99 }
    ];

    // Main Course (cat-02)
    const mainCourse = [
      { name: 'Grilled Chicken Breast', desc: 'Herb-marinated chicken with roasted vegetables', price: 16.99 },
      { name: 'Beef Burger', desc: 'Classic burger with lettuce, tomato, and fries', price: 14.99 },
      { name: 'Margherita Pizza', desc: 'Fresh mozzarella, tomato sauce, and basil', price: 12.99 },
      { name: 'Spaghetti Carbonara', desc: 'Creamy pasta with bacon and parmesan', price: 13.99 },
      { name: 'Grilled Salmon', desc: 'Atlantic salmon with lemon butter sauce', price: 19.99 },
      { name: 'Vegetable Stir Fry', desc: 'Mixed vegetables with tofu in teriyaki sauce', price: 11.99 },
      { name: 'BBQ Ribs', desc: 'Tender pork ribs with BBQ sauce and coleslaw', price: 18.99 },
      { name: 'Fish and Chips', desc: 'Battered cod with french fries and tartar sauce', price: 15.99 }
    ];

    // Desserts (cat-03)
    const desserts = [
      { name: 'Chocolate Lava Cake', desc: 'Warm chocolate cake with vanilla ice cream', price: 7.99 },
      { name: 'Cheesecake', desc: 'New York style cheesecake with berry compote', price: 6.99 },
      { name: 'Tiramisu', desc: 'Classic Italian coffee-flavored dessert', price: 8.99 },
      { name: 'Ice Cream Sundae', desc: 'Three scoops with toppings and whipped cream', price: 5.99 },
      { name: 'Apple Pie', desc: 'Homemade apple pie with cinnamon', price: 6.49 }
    ];

    // Drinks (cat-04)
    const drinks = [
      { name: 'Coca Cola', desc: 'Chilled soft drink', price: 2.99 },
      { name: 'Sprite', desc: 'Lemon-lime soda', price: 2.99 },
      { name: 'Orange Juice', desc: 'Freshly squeezed orange juice', price: 4.99 },
      { name: 'Coffee', desc: 'Freshly brewed coffee', price: 3.49 },
      { name: 'Cappuccino', desc: 'Espresso with steamed milk foam', price: 4.99 },
      { name: 'Iced Tea', desc: 'Refreshing iced tea with lemon', price: 3.49 },
      { name: 'Mineral Water', desc: 'Still or sparkling', price: 2.49 },
      { name: 'Milkshake', desc: 'Chocolate, vanilla, or strawberry', price: 5.99 }
    ];

    // Sides (cat-05)
    const sides = [
      { name: 'French Fries', desc: 'Crispy golden fries', price: 3.99 },
      { name: 'Onion Rings', desc: 'Breaded and fried onion rings', price: 4.99 },
      { name: 'Caesar Salad', desc: 'Romaine lettuce with Caesar dressing', price: 6.99 },
      { name: 'Coleslaw', desc: 'Creamy cabbage salad', price: 3.49 },
      { name: 'Mashed Potatoes', desc: 'Creamy mashed potatoes with gravy', price: 4.49 }
    ];

    // Insert all items
    let itemId = 1;
    [
      { catId: 'cat-01', items: appetizers },
      { catId: 'cat-02', items: mainCourse },
      { catId: 'cat-03', items: desserts },
      { catId: 'cat-04', items: drinks },
      { catId: 'cat-05', items: sides }
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
