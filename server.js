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
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Initialize DB
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    console.log('✅ Users table ready');
  } catch (err) {
    console.error('❌ Error creating users table:', err);
  }
}
initDB();

// Register Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  console.log("Registering user:", username);

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashed]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ error: 'Username taken or error occurred.' });
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", username);

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Dashboard Route
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  res.sendFile(__dirname + '/public/dashboard.html');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
