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

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
}

// Serve stats.html with login protection
app.get('/stats.html', requireLogin, (req, res) => {
  res.sendFile(__dirname + '/public/stats.html');
});

// Endpoint to return logged-in user's username
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ username: rows[0].username });
  } catch (err) {
    console.error("❌ API user error:", err.stack);
    res.status(500).json({ error: 'Server error' });
  }
});

// [You can add other existing routes below this like /login, /register, etc.]

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});