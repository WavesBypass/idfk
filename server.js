const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'piget-secret-key',
  resave: false,
  saveUninitialized: false,
}));
app.use(express.static(path.join(__dirname, 'public')));

// Create tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age TEXT,
        discord TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending'
      );
    `);
    console.log("✅ Tables ensured");
  } catch (err) {
    console.error("❌ DB Init Error:", err);
  }
}
initDB();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Submit form
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  if (!username || !password || !reason) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const requestCheck = await pool.query('SELECT * FROM requests WHERE username = $1 AND status = $2', [username, 'pending']);

    if (userCheck.rows.length > 0 || requestCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists or is pending.' });
    }

    await pool.query(
      `INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)`,
      [username, password, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Get pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM requests WHERE status = 'pending'`);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /requests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// Approve
app.post('/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM requests WHERE id = $1`, [id]);
    const reqData = result.rows[0];
    if (!reqData) return res.status(404).json({ error: 'Request not found' });

    await pool.query(`INSERT INTO users (username, password) VALUES ($1, $2)`, [reqData.username, reqData.password]);
    await pool.query(`UPDATE requests SET status = 'approved' WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Deny
app.post('/deny', async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query(`UPDATE requests SET status = 'denied' WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Deny error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
