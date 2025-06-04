const express = require('express');
const db = require('./database');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients').all();
  res.json(clients);
});

app.get('/api/invoices', (req, res) => {
  const stmt = db.prepare(`
    SELECT 
      invoices.*, 
      issuer.name AS issuerName, 
      issuer.address AS issuerAddress, 
      issuer.taxNumber AS issuerTaxNumber,
      client.name AS clientName, 
      client.address AS clientAddress, 
      client.taxNumber AS clientTaxNumber
    FROM invoices
    JOIN clients AS issuer ON invoices.issuerId = issuer.id
    JOIN clients AS client ON invoices.clientId = client.id
    ORDER BY invoices.date DESC
  `);
  res.json(stmt.all());
});

app.post('/api/invoices', (req, res) => {
  const {
    number, issuerId, clientId, date,
    fulfillmentDate, dueDate, total, vat, paymentMethod
  } = req.body;

  const issue = new Date(date);
  const due = new Date(dueDate);
  if ((due - issue) / (1000 * 60 * 60 * 24) > 30) {
    return res.status(400).json({ error: 'A fizetési határidő nem lehet több, mint 30 nap a kiállítás dátumától számítva.' });
  }

  const stmt = db.prepare(`
    INSERT INTO invoices (
      number, issuerId, clientId, date,
      fulfillmentDate, dueDate, total, vat, paymentMethod
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod);
    res.status(201).json({ message: 'Számla létrehozva.' });
  } catch (err) {
    res.status(500).json({ error: 'Hiba a számla mentésekor.' });
  }
});

app.put('/api/invoices/:id/cancel', (req, res) => {
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Számla nem található.' });
  }

  if (existing.canceled) {
    return res.status(400).json({ error: 'A számla már stornózva lett.' });
  }

  const stmt = db.prepare('UPDATE invoices SET canceled = 1 WHERE id = ?');
  stmt.run(id);
  res.json({ message: 'Számla stornózva.' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Szerver fut a ${PORT} porton`);
});
