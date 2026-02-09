const { getDb } = require('../db/index');

function getAllProfiles() {
  const db = getDb();
  return db.prepare(`
    SELECT
      kp.*,
      COALESCE(SUM(CASE WHEN kt.type = 'due' THEN kt.amount ELSE 0 END), 0) as totalDue,
      COALESCE(SUM(CASE WHEN kt.type = 'payment' THEN kt.amount ELSE 0 END), 0) as totalPaid,
      COALESCE(SUM(CASE WHEN kt.type = 'due' THEN kt.amount WHEN kt.type = 'payment' THEN -kt.amount ELSE 0 END), 0) as balance
    FROM khata_profiles kp
    LEFT JOIN khata_transactions kt ON kt.khataId = kp.id
    GROUP BY kp.id
    ORDER BY kp.name ASC
  `).all();
}

function getProfileById(id) {
  const db = getDb();
  return db.prepare(`
    SELECT
      kp.*,
      COALESCE(SUM(CASE WHEN kt.type = 'due' THEN kt.amount ELSE 0 END), 0) as totalDue,
      COALESCE(SUM(CASE WHEN kt.type = 'payment' THEN kt.amount ELSE 0 END), 0) as totalPaid,
      COALESCE(SUM(CASE WHEN kt.type = 'due' THEN kt.amount WHEN kt.type = 'payment' THEN -kt.amount ELSE 0 END), 0) as balance
    FROM khata_profiles kp
    LEFT JOIN khata_transactions kt ON kt.khataId = kp.id
    WHERE kp.id = ?
    GROUP BY kp.id
  `).get(id) || null;
}

function getProfileByName(name) {
  const db = getDb();
  return db.prepare('SELECT * FROM khata_profiles WHERE name = ?').get(name) || null;
}

function insertProfile(profile) {
  const db = getDb();
  db.prepare(`
    INSERT INTO khata_profiles (id, name, phone, businessDetails, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(profile.id, profile.name, profile.phone, profile.businessDetails, profile.createdAt);
  return profile;
}

function updateProfile(profile) {
  const db = getDb();
  db.prepare(`
    UPDATE khata_profiles
    SET name = ?, phone = ?, businessDetails = ?, updatedAt = ?
    WHERE id = ?
  `).run(profile.name, profile.phone, profile.businessDetails, profile.updatedAt, profile.id);
  return profile;
}

function getTransactionsByKhataId(khataId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM khata_transactions
    WHERE khataId = ?
    ORDER BY date DESC, createdAt DESC
  `).all(khataId);
}

function insertTransaction(tx) {
  const db = getDb();
  db.prepare(`
    INSERT INTO khata_transactions (id, khataId, type, amount, paymentSource, note, date, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tx.id, tx.khataId, tx.type, tx.amount, tx.paymentSource, tx.note, tx.date, tx.createdAt);
  return tx;
}

module.exports = {
  getAllProfiles,
  getProfileById,
  getProfileByName,
  insertProfile,
  updateProfile,
  getTransactionsByKhataId,
  insertTransaction,
};
