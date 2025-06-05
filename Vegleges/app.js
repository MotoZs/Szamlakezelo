const express = require('express');
const db = require('./util/database');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT invoices.*,
      c1.name AS issuerName,
      c1.address AS issuerAddress,
      c1.taxNumber AS issuerTaxNumber,
      c2.name AS clientName,
      c2.address AS clientAddress,
      c2.taxNumber AS clientTaxNumber
    FROM invoices
    JOIN clients c1 ON invoices.issuerId = c1.id
    JOIN clients c2 ON invoices.clientId = c2.id
  `).all();
  res.json(invoices);
});

app.get('/api/invoices/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).send('Érvénytelen azonosító');
  }
  const invoice = db.prepare(`
    SELECT invoices.*,
      c1.name AS issuerName,
      c1.address AS issuerAddress,
      c1.taxNumber AS issuerTaxNumber,
      c2.name AS clientName,
      c2.address AS clientAddress,
      c2.taxNumber AS clientTaxNumber
    FROM invoices
    JOIN clients c1 ON invoices.issuerId = c1.id
    JOIN clients c2 ON invoices.clientId = c2.id
    WHERE invoices.id = ?
  `).get(id);

  if (!invoice) {
    return res.status(404).send('Számla nem található');
  }
  res.json(invoice);
});

app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients').all();
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { name, address, taxNumber } = req.body;
  if (!name || !address || !taxNumber) {
    return res.status(400).send('Hiányzó mező!');
  }
  try {
    db.prepare(`
      INSERT INTO clients (name, address, taxNumber)
      VALUES (?, ?, ?)
    `).run(name, address, taxNumber);
    res.sendStatus(200);
  } catch (err) {
    res.status(400).send('Név vagy adószám már létezik!');
  }
});

app.post('/api/invoices', (req, res) => {
  const { number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod } = req.body;

  if (!number || !issuerId || !clientId || !date || !fulfillmentDate || !dueDate || total === undefined || vat === undefined || !paymentMethod) {
    return res.status(400).send('Minden mező kitöltése kötelező!');
  }

  if (typeof total !== 'number' && typeof total !== 'string') {
    return res.status(400).send('Az összeg érvénytelen!');
  }

  const totalNum = Number(total);
  if (isNaN(totalNum) || totalNum <= 0) {
    return res.status(400).send('Az összeg nem lehet nulla vagy negatív!');
  }

  const invoiceDate = new Date(date);
  const paymentDueDate = new Date(dueDate);

  if (isNaN(invoiceDate.getTime()) || isNaN(paymentDueDate.getTime())) {
    return res.status(400).send('Dátumok nem megfelelő formátumúak!');
  }

  const diffMs = paymentDueDate.getTime() - invoiceDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return res.status(400).send('A fizetési határidő nem lehet korábbi, mint a számla keltezése!');
  }

  if (diffDays > 30) {
    return res.status(400).send('A fizetési határidő legfeljebb 30 nappal lehet későbbi a számla keltezésénél!');
  }

  try {
    db.prepare(`
      INSERT INTO invoices (number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(number, issuerId, clientId, date, fulfillmentDate, dueDate, totalNum, vat, paymentMethod);
    res.sendStatus(200);
  } catch (err) {
    res.status(400).send('A számlaszám már létezik vagy egyéb adatbázis hiba!');
  }
});

app.post('/api/invoices', (req, res) => {
  const {
    number, issuerId, clientId, date,
    fulfillmentDate, dueDate, total, vat, paymentMethod
  } = req.body;

  const issueDate = new Date(date);
  const maxDueDate = new Date(issueDate);
  maxDueDate.setDate(issueDate.getDate() + 30);
  if (new Date(dueDate) > maxDueDate) {
    return res.status(400).send('A fizetési határidő nem lehet későbbi, mint 30 nappal a kiállítás után!');
  }

  const stmt = db.prepare(`
    INSERT INTO invoices
    (number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod, canceled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  stmt.run(number, issuerId, clientId, date, fulfillmentDate, dueDate, total, vat, paymentMethod);
  res.sendStatus(200);
});


app.post('/api/invoices/:id/cancel', (req, res) => {
  const stmt = db.prepare(`UPDATE invoices SET canceled = 1 WHERE id = ?`);
  stmt.run(req.params.id);
  res.sendStatus(200);
});


app.delete('/api/clients/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).send('Érvénytelen ID');

  const hasInvoices = db.prepare(`
    SELECT COUNT(*) AS count FROM invoices WHERE issuerId = ? OR clientId = ?
  `).get(id, id);

  if (hasInvoices.count > 0) {
    return res.status(400).send('Nem törölhető, mert van hozzárendelt számla.');
  }

  const info = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).send('Ügyfél nem található.');
  }

  res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});