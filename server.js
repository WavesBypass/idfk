const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ PostgreSQL connection for DigitalOcean Managed DB
const pool = new Pool({
  user: 'doadmin',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  port: 25060,
  database: 'defaultdb',
  ssl: { rejectUnauthorized: false }
});

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // root-level access to public/

app.use(session({
  secret: 'piget_secret_key',
  resave: false,
  saveUninitialized: true
}));

// ✅ Auto-create tables if not exist
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

// ✅ Handle form submission
app.post('/submit-request', async (req, res) => {
  const { username, password, reason, age, discord } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO requests (username, password, reason, age, discord) VALUES ($1, $2, $3, $4, $5)',
      [username, hashed, reason, age, discord]
    );
    res.redirect('/register.html?success=true');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting form.');
  }
});

// ✅ List all pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to load requests');
  }
});

// ✅ Approve or deny a request
app.post('/requests/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  try {
    const result = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    const request = result.rows[0];

    if (!request) return res.status(404).send('Request not found');

    if (action === 'approve') {
      await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2)',
        [request.username, request.password]
      );
    }

    await pool.query('DELETE FROM requests WHERE id = $1', [id]);
    res.status(200).send('Request processed');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing request');
  }
});

// ✅ Login handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).send('Invalid login');
    }

    const valid = await bcrypt.compare(password, result.rows[0].password);
    if (!valid) {
      return res.status(401).send('Incorrect password');
    }

    req.session.user = username;
    res.redirect('/stats.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed');
  }
});

// ✅ Check login status (for redirecting from login page)
app.get('/check-login', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Piget server running on port ${PORT}`);
});
