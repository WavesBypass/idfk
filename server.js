const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static('public', { extensions: ['html'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));

// Submit form request (now including age, discord)
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO requests (username, password, age, discord, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [username, hashed, age, discord, reason, 'pending']
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Request submission error:", err);
    res.status(500).json({ error: 'Request failed' });
  }
});

// Get all requests
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Fetch requests error:", err.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve
app.post('/approve/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const { username, password } = rows[0];
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Approve error:", err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Deny
app.post('/deny/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Deny error:", err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = user.id;
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Login error:", err.stack);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Debug-init: recreate tables without UNIQUE on requests.username
app.get('/debug-init', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        age INT,
        discord TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending'
      );
    `);
    res.send("✅ Tables initialized (no UNIQUE on requests.username).");
  } catch (err) {
    console.error("❌ Debug-init error:", err.stack);
    res.status(500).send("Init failed");
  }
});

// Debug-fix-constraint: drop old UNIQUE constraint if it exists
app.get('/debug-fix-constraint', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_username_key;`);
    res.send("✅ Dropped UNIQUE constraint on requests.username");
  } catch (err) {
    console.error("❌ Constraint-fix error:", err.stack);
    res.status(500).send("Constraint fix failed");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
