const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false
}));

// Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  next();
}

// ✅ Serve individual HTML routes (instead of full static access)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/stats.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'stats.html')));

// ✅ Still allow static access to css and other assets
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Handle login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!rows.length || !await bcrypt.compare(password, rows[0].password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = rows[0].id;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Handle request form
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      `INSERT INTO requests (username, password, age, discord, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [username, hashed, age, discord, reason]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Approve/deny
app.get('/requests', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requests');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/approve/:id', async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Request not found' });
  const { username, password } = rows[0];
  await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
  await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', id]);
  res.json({ success: true });
});

app.post('/deny/:id', async (req, res) => {
  const id = req.params.id;
  await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', id]);
  res.json({ success: true });
});

// API for frontend to get current user
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ username: rows[0].username });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
