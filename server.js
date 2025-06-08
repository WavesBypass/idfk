const express = require('express');
const bodyParser = require('body-parser');
const pg = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL config
const db = new pg.Pool({
  user: 'doadmin',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  ssl: { rejectUnauthorized: false }
});

// Auto-create tables
(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      age VARCHAR(10),
      discord VARCHAR(100),
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending'
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);
})();

// Handle registration request
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    const userExists = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const requestExists = await db.query('SELECT * FROM requests WHERE username = $1', [username]);
    if (userExists.rows.length > 0 || requestExists.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)`,
      [username, hashed, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Get all pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM requests WHERE status = 'pending'`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Handle approval or denial
app.post('/update-request', async (req, res) => {
  const { id, action } = req.body;

  if (!id || !['approved', 'denied'].includes(action)) {
    return res.status(400).json({ success: false });
  }

  try {
    const request = await db.query(`SELECT * FROM requests WHERE id = $1`, [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const { username, password } = request.rows[0];

    if (action === 'approved') {
      await db.query(`INSERT INTO users (username, password) VALUES ($1, $2)`, [username, password]);
    }

    await db.query(`UPDATE requests SET status = $1 WHERE id = $2`, [action, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const match = await bcrypt.compare(password, result.rows[0].password);
    if (!match) return res.status(401).json({ success: false, message: 'Incorrect password' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
