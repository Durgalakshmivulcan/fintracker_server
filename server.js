const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middlewares
app.use(cors({
  origin: '*', // ✅ Replace with actual frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],       // Optional: restrict methods
  credentials: true                                 // Optional: if you're using cookies or auth
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Setup multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// MySQL connection
const db = mysql.createConnection({
  host: 'sql12.freesqldatabase.com',
  user: 'sql12788702',
  password: 'aT9X9nzBPz',
  database: 'sql12788702'
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL Connected...');
});

const sanitize = (val) => (val === undefined || val === '' || val === null ? 0 : val);

// POST: Insert Household Data
app.post('/api/household', upload.single('file'), (req, res) => {
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  const {
    entryname, date, powerbill, waterbill, emis, houserent, subscriptions,
    internetbill, study, entertainment, fooddrink, dwakra, groceries, health,
    shopping, transport, gifts, others, income, total_expenditure, gross_savings
  } = req.body;

  const sql = `
    INSERT INTO househole_info (
      entryname, date, power_bill, water_bill, EMIs, house_rent, subscriptions,
      internet_bill, study_purpose, entertainment, food_and_drink, dwakra_bill,
      groceries, health_or_wellbeing, shopping, transport, gifts, others,
      Income, total_expenditure, gross_savings, bills_images
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    entryname, date,
    sanitize(powerbill), sanitize(waterbill), sanitize(emis), sanitize(houserent),
    sanitize(subscriptions), sanitize(internetbill), sanitize(study), sanitize(entertainment),
    sanitize(fooddrink), sanitize(dwakra), sanitize(groceries), sanitize(health),
    sanitize(shopping), sanitize(transport), sanitize(gifts), sanitize(others),
    sanitize(income), sanitize(total_expenditure), sanitize(gross_savings),
    filePath
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).json({ status: 'error', message: 'Database insert failed.' });
    }
    res.json({ status: 'success', message: 'Data and file saved successfully.' });
  });
});

// PUT: Update Household Data
app.put('/api/household/update/:id', upload.single('file'), (req, res) => {
  const entryId = req.params.id;
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;

  const {
    entryname, date, powerbill, waterbill, emis, houserent, subscriptions,
    internetbill, study, entertainment, fooddrink, dwakra, groceries, health,
    shopping, transport, gifts, others, income, total_expenditure, gross_savings
  } = req.body;

  let sql = `
    UPDATE househole_info SET
      entryname = ?, date = ?, power_bill = ?, water_bill = ?, EMIs = ?, house_rent = ?,
      subscriptions = ?, internet_bill = ?, study_purpose = ?, entertainment = ?,
      food_and_drink = ?, dwakra_bill = ?, groceries = ?, health_or_wellbeing = ?,
      shopping = ?, transport = ?, gifts = ?, others = ?, Income = ?,
      total_expenditure = ?, gross_savings = ?`;

  const values = [
    entryname, date, sanitize(powerbill), sanitize(waterbill), sanitize(emis), sanitize(houserent),
    sanitize(subscriptions), sanitize(internetbill), sanitize(study), sanitize(entertainment),
    sanitize(fooddrink), sanitize(dwakra), sanitize(groceries), sanitize(health),
    sanitize(shopping), sanitize(transport), sanitize(gifts), sanitize(others),
    sanitize(income), sanitize(total_expenditure), sanitize(gross_savings)
  ];

  if (filePath) {
    sql += `, bills_images = ?`;
    values.push(filePath);
  }
  sql += ` WHERE day_id = ?`;
  values.push(entryId);

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ status: 'error', message: 'Failed to update entry' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'No entry found with this ID' });
    }
    res.json({ status: 'success', message: 'Entry updated successfully' });
  });
});

// GET: User Names
app.get('/api/get_entrynames', (req, res) => {
  const sql = `SELECT user_id, name FROM usernames WHERE status = '1'`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database query failed' });
    res.json(results);
  });
});

// GET: Graph Data
app.get('/api/graph-data', (req, res) => {
  const { year, entryname } = req.query;
  if (!year) return res.status(400).json({ error: 'Year is required' });

  let whereClause = `YEAR(date) = ?`;
  const values = [year];

  if (entryname && entryname.trim() !== '') {
    whereClause += ` AND entryname = ?`;
    values.push(entryname.trim());
  }

  const sql = `
    SELECT 
      MONTH(date) AS month,
      SUM(Income) AS total_income,
      SUM(total_expenditure) AS total_expenses,
      SUM(gross_savings) AS total_savings
    FROM househole_info
    WHERE ${whereClause}
    GROUP BY MONTH(date)
    ORDER BY MONTH(date)
  `;

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database query failed' });

    const income = Array(12).fill(0);
    const expenses = Array(12).fill(0);
    const savings = Array(12).fill(0);

    results.forEach(row => {
      const monthIndex = row.month - 1;
      income[monthIndex] = row.total_income || 0;
      expenses[monthIndex] = row.total_expenses || 0;
      savings[monthIndex] = row.total_savings || 0;
    });

    res.json({ income, expenses, savings });
  });
});

// GET: Dashboard Data
app.get('/api/dashboard-data', (req, res) => {
  const { year, entryname } = req.query;
  let sql = `
    SELECT 
      day_id, entryname, DATE_FORMAT(date, '%Y-%m-%d') as date, Income,
      total_expenditure, gross_savings, power_bill, water_bill, EMIs,
      house_rent, subscriptions, internet_bill, study_purpose, entertainment,
      food_and_drink, dwakra_bill, groceries, health_or_wellbeing, shopping,
      transport, gifts, others, bills_images
    FROM househole_info WHERE status='1'
  `;
  const values = [];

  if (year) {
    sql += ' AND YEAR(date) = ?';
    values.push(year);
  }

  if (entryname && entryname.trim() !== '') {
    sql += ' AND entryname = ?';
    values.push(entryname.trim());
  }

  sql += ' ORDER BY date DESC';

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database fetch failed' });
    res.json(results);
  });
});

// DELETE (Soft Delete) update status to '0'
app.delete('/api/household/:id', (req, res) => {
  const entryId = req.params.id;
  const query = 'UPDATE househole_info SET status = 0 WHERE day_id = ?';

  db.query(query, [entryId], (err, result) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found or already deleted' });
    }
    res.json({ message: 'Record marked as deleted (status = 0)' });
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
