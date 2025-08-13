// server/index.js
const express = require('express');
const pool = require('./db');
const runSeed = require('./seeders/run_seeders');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const { parse } = require('csv-parse/sync');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- CRUD: Customers ---

// GET /api/customers
app.get('/api/customers', async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '102');
  const offset = (page - 1) * limit;
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY customer_id LIMIT ? OFFSET ?', [limit, offset]);
    res.json({ data: rows, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id
app.get('/api/customers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customers
app.post('/api/customers',
  body('name').isLength({ min: 1 }),
  body('identification_number').isLength({ min: 1 }),
  body('email').optional().isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, identification_number, address, phone, email } = req.body;
    try {
      const [result] = await pool.query(
        `INSERT INTO customers (name, identification_number, address, phone, email)
         VALUES (?, ?, ?, ?, ?)`,
        [name, identification_number, address || null, phone || null, email || null]
      );
      const inserted = { customer_id: result.insertId, name, identification_number, address, phone, email };
      res.status(201).json(inserted);
    } catch (err) {
      console.error(err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate entry (identification or email)' });
      res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/customers/:id
app.put('/api/customers/:id',
  body('email').optional().isEmail(),
  async (req, res) => {
    const id = req.params.id;
    const { name, identification_number, address, phone, email } = req.body;
    try {
      const [result] = await pool.query(
        `UPDATE customers SET name = COALESCE(?, name),
         identification_number = COALESCE(?, identification_number),
         address = COALESCE(?, address),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email)
         WHERE customer_id = ?`,
        [name, identification_number, address, phone, email, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found' });
      const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [id]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate entry' });
      res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Reports (advanced queries only accessible via Postman

// Total paid by each customer
app.get('/api/reports/total_paid_by_customer', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.customer_id, c.name, c.identification_number,
             COALESCE(SUM(t.amount_paid), 0) AS total_paid
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name, c.identification_number
      ORDER BY total_paid DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Pending invoices with client and last transaction info
app.get('/api/reports/pending_invoices', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.invoice_id, i.invoice_number, i.billing_period, i.amount_billed,
             COALESCE(SUM(t.amount_paid),0) AS total_paid,
             (i.amount_billed - COALESCE(SUM(t.amount_paid),0)) AS balance,
             c.customer_id, c.name AS customer_name, c.identification_number
      FROM invoices i
      JOIN customers c ON c.customer_id = i.customer_id
      LEFT JOIN transactions t ON t.invoice_id = i.invoice_id
      GROUP BY i.invoice_id
      HAVING balance > 0
      ORDER BY balance DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List transactions by platform
app.get('/api/reports/transactions_by_platform/:platform', async (req, res) => {
  try {
    const platform = req.params.platform;
    const [rows] = await pool.query(`
      SELECT t.transaction_id, t.transaction_datetime, t.transaction_amount, t.amount_paid, t.transaction_status,
             c.customer_id, c.name AS customer_name, i.invoice_id, i.invoice_number
      FROM transactions t
      LEFT JOIN platforms p ON p.platform_id = t.platform_id
      LEFT JOIN customers c ON c.customer_id = t.customer_id
      LEFT JOIN invoices i ON i.invoice_id = t.invoice_id
      WHERE p.name = ?
      ORDER BY t.transaction_datetime DESC
    `, [platform]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve static frontend (optional)
app.use('/', express.static(path.join(__dirname, '..', 'app')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
