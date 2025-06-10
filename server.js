const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static .html from /public
app.use(express.static('public', { extensions: ['html'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
}

// -----------------
// Registration API
// -----------------
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO requests (username, password, age, discord, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [username, hashed, age, discord, reason]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Request submission error:", err);
    res.status(500).json({ error: 'Request failed' });
  }
});

// -----------------
// Forms API
// -----------------
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests');
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Fetch requests error:", err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/approve/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { username, password } = rows[0];
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/deny/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Deny error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------
// Auth Routes
// -------------
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!rows.length || !await bcrypt.compare(password, rows[0].password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = rows[0].id;
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// If you still have a separate /register route, re-add it here.
// (You may not need it if you only use /submit-request for join requests.)

// ---------------------------
// Protected Stats & User API
// ---------------------------

// Serve stats.html only if logged in
app.get('/stats.html', requireLogin, (req, res) => {
  res.sendFile(__dirname + '/public/stats.html');
});

// Return the logged-in user's username
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const { rows } = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ username: rows[0].username });
  } catch (err) {
    console.error("❌ /api/user error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
