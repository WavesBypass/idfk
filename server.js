const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  user: 'doadmin',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Tables setup
async function setupTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      age INTEGER,
      discord TEXT,
      reason TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);
}
setupTables();

// Submit registration request
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, hashed, age, discord, reason]
    );
    res.status(200).send('Request submitted');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting request');
  }
});

// Get all requests
app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Error loading requests');
  }
});

// Approve or deny a request
app.post('/requests/:id', async (req, res) => {
  const id = req.params.id;
  const { action } = req.body;

  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).send('Request not found');

    const request = rows[0];

    if (action === 'approve') {
      await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2)',
        [request.username, request.password]
      );
    }

    await pool.query('DELETE FROM requests WHERE id = $1', [id]);
    res.send('Action completed');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing request');
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).send('Invalid credentials');

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).send('Invalid credentials');

    req.session.user = username;
    res.status(200).send('Login success');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login failed');
  }
});

// Check session
app.get('/session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
