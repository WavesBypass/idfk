const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Prevent direct access to stats.html via static
app.use(express.static('public', {
  extensions: ['html'],
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('/stats.html')) {
      res.status(403).end('Forbidden');
    }
  }
}));

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

// 🔐 Protected route
app.get('/stats.html', requireLogin, (req, res) => {
  res.sendFile(__dirname + '/public/stats.html');
});

// 🧠 Provide the logged-in username
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ username: rows[0].username });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
