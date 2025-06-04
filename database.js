//const Database = require('better-sqlite3');
//const path = require('path');
//const db = new Database(path.join(__dirname, '../data/database.sqlite'));

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, './data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const Database = require('better-sqlite3');
const db = new Database(path.join(dataDir, 'database.db'));


db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT NOT NULL,
    taxNumber TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    issuerId INTEGER NOT NULL,
    clientId INTEGER NOT NULL,
    date TEXT NOT NULL,
    fulfillmentDate TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    total REAL NOT NULL,
    vat INTEGER NOT NULL,
    paymentMethod TEXT NOT NULL DEFAULT 'Átutalás',
    canceled INTEGER DEFAULT 0,
    FOREIGN KEY (issuerId) REFERENCES clients(id),
    FOREIGN KEY (clientId) REFERENCES clients(id)
  );
`);


const existingClients = db.prepare('SELECT COUNT(*) AS count FROM clients').get();
if (existingClients.count === 0) {
  const insertClient = db.prepare('INSERT INTO clients (name, address, taxNumber) VALUES (?, ?, ?)');
  insertClient.run('Kovács és Társa Kft.', 'Budapest, Váci út 45.', '10123456-1-41');
  insertClient.run('Nagy Építő Bt.', 'Debrecen, Piac u. 12.', '20678901-2-12');
  insertClient.run('Szabó Consulting Zrt.', 'Szeged, Kossuth Lajos sgt. 15.', '30987654-3-65');
  insertClient.run('Mészáros Kft.', 'Pécs, Rákóczi út 89.', '40876543-4-32');
  insertClient.run('Kertész Kereskedelmi Bt.', 'Győr, Baross Gábor út 7.', '50765432-5-76');
}

const existingInvoices = db.prepare('SELECT COUNT(*) AS count FROM invoices').get();
if (existingInvoices.count === 0) {
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const issuerId = db.prepare("SELECT id FROM clients WHERE name = 'Teszt Cég Kft.'").get().id;
  const clients = db.prepare("SELECT id, name FROM clients WHERE id != ?").all(issuerId);

  let count = 1;
  const paymentMethods = ['Átutalás', 'Készpénz', 'Bankkártya'];

  for (const client of clients) {
    const invoicesData = [
      { total: 15000, vat: 27, daysAgo: 10 },
      { total: 23500, vat: 27, daysAgo: 20 },
      { total: 9800, vat: 5, daysAgo: 5 },
    ];

    for (const inv of invoicesData) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() - inv.daysAgo);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const dueDateObj = new Date(dateObj);
      dueDateObj.setDate(dueDateObj.getDate() + 30);
      const dueDateStr = dueDateObj.toISOString().slice(0, 10);

      const number = `SZAMLA-2025-${String(count).padStart(3, '0')}`;

      const paymentMethod = paymentMethods[count % paymentMethods.length]; 

      insertInvoice.run(
        number,
        issuerId,
        client.id,
        dateStr,
        dateStr,
        dueDateStr,
        inv.total,
        inv.vat,
        paymentMethod
      );

      count++;
    }
  }
}

module.exports = db;