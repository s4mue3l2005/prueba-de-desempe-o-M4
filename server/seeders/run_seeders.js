// server/seeders/run_seeders.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../db');

async function runSeed() {
  const csvPath = path.join(__dirname, '..', 'data', 'data.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error('CSV file not found at server/data/data.csv');
  }
  const content = fs.readFileSync(csvPath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    //  Insert platforms unique
    const platformMap = new Map();
    for (const r of records) {
      const p = (r['Plataforma Utilizada'] || r['Plataforma'] || '').trim();
      if (!p) continue;
      platformMap.set(p, null);
    }
    for (const name of platformMap.keys()) {
      const [res] = await conn.query(
        'INSERT INTO platforms (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name',
        [name]
      );
      const insertId = res.insertId ? res.insertId : (await conn.query('SELECT platform_id FROM platforms WHERE name = ?', [name]))[0][0].platform_id;
      platformMap.set(name, insertId);
    }

    //  Insert customers unique
    const customerMap = new Map();
    for (const r of records) {
      const idnum = (r['Número de Identificación'] || r['identification'] || '').toString().trim();
      if (!idnum) continue;
      if (!customerMap.has(idnum)) {
        const name = (r['Nombre del Cliente'] || '').trim();
        const address = (r['Dirección'] || null);
        const phone = (r['Teléfono'] || null);
        const email = (r['Correo Electrónico'] || null);
        // Insert or ignore on duplicate identification_number
        const [res] = await conn.query(
          `INSERT INTO customers (name, identification_number, address, phone, email)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), phone = VALUES(phone), email = VALUES(email)`,
          [name, idnum, address, phone, email]
        );
        // get the id
        let custId;
        if (res.insertId && res.insertId !== 0) custId = res.insertId;
        else {
          const [rows] = await conn.query('SELECT customer_id FROM customers WHERE identification_number = ?', [idnum]);
          custId = rows[0].customer_id;
        }
        customerMap.set(idnum, custId);
      }
    }

    // Insert invoices unique
    const invoiceMap = new Map();
    for (const r of records) {
      const invNum = (r['Número de Factura'] || '').toString().trim();
      if (!invNum) continue;
      if (!invoiceMap.has(invNum)) {
        const billing_period = (r['Periodo de Facturación'] || '').toString().trim();
        const amount_billed = parseFloat((r['Monto Facturado'] || 0) || 0);
        const custId = customerMap.get((r['Número de Identificación'] || '').toString().trim());
        const [res] = await conn.query(
          `INSERT INTO invoices (invoice_number, billing_period, amount_billed, customer_id)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE billing_period = VALUES(billing_period), amount_billed = VALUES(amount_billed)`,
          [invNum, billing_period, amount_billed, custId]
        );
        let invId;
        if (res.insertId && res.insertId !== 0) invId = res.insertId;
        else {
          const [rows] = await conn.query('SELECT invoice_id FROM invoices WHERE invoice_number = ?', [invNum]);
          invId = rows[0].invoice_id;
        }
        invoiceMap.set(invNum, invId);
      }
    }

    // Insert transactions (payments)
    for (const r of records) {
      const txId = (r['ID de la Transacción'] || '').toString().trim();
      if (!txId) continue;
      const datetime = (r['Fecha y Hora de la Transacción'] || '').toString().trim();
      // try to normalize datetime if needed
      const txAmount = parseFloat((r['Monto de la Transacción'] || 0) || 0);
      const status = (r['Estado de la Transacción'] || '').trim();
      const type = (r['Tipo de Transacción'] || '').trim();
      const custId = customerMap.get((r['Número de Identificación'] || '').toString().trim());
      const platformName = (r['Plataforma Utilizada'] || '').trim();
      const platformId = platformMap.get(platformName) || null;
      const invId = invoiceMap.get((r['Número de Factura'] || '').toString().trim()) || null;
      const amountPaid = parseFloat((r['Monto Pagado'] || 0) || 0);

      // Insert ignoring duplicate txId
      await conn.query(
        `INSERT INTO transactions
        (transaction_id, transaction_datetime, transaction_amount, transaction_status, transaction_type, customer_id, platform_id, invoice_id, amount_paid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE transaction_status = VALUES(transaction_status)`,
        [txId, datetime || null, txAmount, status, type, custId, platformId, invId, amountPaid]
      );
    }

    await conn.commit();
    console.log('Seeders executed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Seeding error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

// If run directly, execute
if (require.main === module) {
  runSeed().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runSeed, pool };
