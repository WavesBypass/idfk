const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: 'doadmin',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'piget-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 604800000 } // 1 week
}));

// Remove /public from URLs
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create tables
const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(100) NOT NULL,
        age VARCHAR(10),
        discord VARCHAR(100),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending'
      );
    `);
    console.log("✅ Tables are ready.");
  } catch (err) {
    console.error("Error initializing tables:", err);
  }
};

initTables();

// ROUTES

// Submit registration form
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    await pool.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, password, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Submit request error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, age, discord, reason FROM requests WHERE status = 'pending'");
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch requests error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve request
app.post('/approve-request', async (req, res) => {
  const { id } = req.body;

  try {
    const request = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { username, password } = request.rows[0];

    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await pool.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Deny request
app.post('/deny-request', async (req, res) => {
  const { id } = req.body;

  try {
    await pool.query("UPDATE requests SET status = 'denied' WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Deny error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = result.rows[0].username;
    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check login session
app.get('/check-login', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
