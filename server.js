const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Enable for DigitalOcean/HTTPS-compatible setups
app.set('trust proxy', 1);

// ✅ Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ SESSION CONFIG that WORKS without NODE_ENV or secure HTTPS setup
app.use(session({
  name: 'piget.sid',
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
    secure: false // ⚠️ Not secure, but it works on HTTP and DigitalOcean without NODE_ENV
  }
}));

// ✅ Middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  next();
}

// ✅ Public pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/login.html', (req, res) => {
  if (req.session.userId) return res.redirect('/stats.html');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));

// ✅ Protected pages
app.get('/stats.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'stats.html')));
app.get('/forms.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'forms.html')));
app.get('/inventory.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'inventory.html')));
app.get('/settings.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));
app.get('/market.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'market.html')));
app.get('/leaderboard.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'leaderboard.html')));

// ✅ Static assets
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// ✅ Login handler
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

// ✅ Logout handler
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ✅ Registration request (unchanged)
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

// ✅ View all requests (unchanged)
app.get('/requests', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requests');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ✅ Approve request (unchanged)
app.post('/approve/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });

    const { username, password } = rows[0];
    const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!existing.rows.length) {
      await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    }

    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Approval failed' });
  }
});

// ✅ Deny request (unchanged)
app.post('/deny/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Denial failed' });
  }
});

// ✅ Get current user info (optional)
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  try {
    const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ username: rows[0].username });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
