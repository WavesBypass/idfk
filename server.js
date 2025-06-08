const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL config
const pool = new Pool({
  user: 'doadmin',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'piget_secret',
  resave: false,
  saveUninitialized: true
}));

// Create tables if not exist
pool.query(`
  CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    reason TEXT,
    age INT,
    discord TEXT
  );
`);
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Submit form
app.post('/submit-request', async (req, res) => {
  const { username, password, reason, age, discord } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      'INSERT INTO requests (username, password, reason, age, discord) VALUES ($1, $2, $3, $4, $5)',
      [username, hashed, reason, age, discord]
    );
    res.redirect('/register.html?success=true');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting request');
  }
});

// Get requests
app.get('/requests', async (req, res) => {
  const result = await pool.query('SELECT * FROM requests');
  res.json(result.rows);
});

// Approve/Deny
app.post('/requests/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).send('Request not found');

    const request = rows[0];

    if (action === 'approve') {
      await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2)',
        [request.username, request.password]
      );
    }

    await pool.query('DELETE FROM requests WHERE id = $1', [id]);
    res.status(200).send('Success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Action failed');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

  if (!rows.length) return res.status(401).send('Invalid login');

  const valid = await bcrypt.compare(password, rows[0].password);
  if (!valid) return res.status(401).send('Invalid password');

  req.session.user = username;
  res.redirect('/stats.html');
});

// Check session
app.get('/check-login', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
