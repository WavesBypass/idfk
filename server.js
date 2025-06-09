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
  secret: process.env.SESSION_SECRET || '9Lfj8ksnCqU2zVr4WmXyPq1bTiNgHu7z',
  resave: false,
  saveUninitialized: false
}));

// Submit form request
app.post('/submit-request', async (req, res) => {
  const { username, password, reason } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO requests (username, password, reason, status) VALUES ($1, $2, $3, $4)',
      [username, hashed, reason, 'pending']
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Request submission error:", err);
    res.status(500).json({ error: 'Request failed or username taken' });
  }
});

// ✅ FIXED: Get all requests (no WHERE filter)
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests'); // removed WHERE
    console.log("✅ Requests fetched:", result.rows);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Fetch requests error:", err.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve request
app.post('/approve/:id', async (req, res) => {
  const requestId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const { username, password } = result.rows[0];
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', requestId]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Approve error:", err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// Deny request
app.post('/deny/:id', async (req, res) => {
  const requestId = req.params.id;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', requestId]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Deny error:", err);
    res.status(500).json({ error: 'Denial failed' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Debug table creation route
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
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending'
      );
    `);
    res.send("✅ Tables initialized successfully.");
  } catch (err) {
    console.error("❌ Debug init error:", err);
    res.status(500).send("Error initializing tables.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
