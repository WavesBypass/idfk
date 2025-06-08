const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// === Database connection ===
const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: {
    rejectUnauthorized: false
  }
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'yourSecretKeyHere',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Use true if HTTPS enforced
}));

// Serve static files from /public without showing /public in URL
app.use(express.static(path.join(__dirname, 'public')));

// === Auto-create tables ===
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age INT,
        discord TEXT
      );
    `);
    console.log('✅ Users table ready');
  } catch (err) {
    console.error('❌ Failed to create table:', err);
  }
})();

// === Routes ===

// Register
app.post('/register', async (req, res) => {
  const { username, password, age, discord } = req.body;
  if (!username || !password || !age || !discord) {
    return res.status(400).send('Missing fields');
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, age, discord) VALUES ($1, $2, $3, $4)',
      [username, hashed, age, discord]
    );
    res.redirect('/login.html');
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).send('Registration failed');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).send('Invalid username or password');

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send('Invalid username or password');

    req.session.user = { id: user.id, username: user.username };
    res.redirect('/stats.html');
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).send('Login failed');
  }
});

// Check login status
app.get('/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// Redirect root to register
app.get('/', (req, res) => {
  res.redirect('/register.html');
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
