const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const pg = require('pg');
const app = express();

// PostgreSQL config
const pool = new pg.Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'pigetsecret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Create tables on startup
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      reason TEXT NOT NULL,
      age INTEGER NOT NULL,
      discord VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending'
    );
  `);
})();

// Handle form submission
app.post('/submit-request', async (req, res) => {
  const { username, password, reason, age, discord } = req.body;

  if (!username || !password || !reason || !age || !discord) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const requestCheck = await pool.query(
      'SELECT * FROM requests WHERE username = $1',
      [username]
    );

    if (requestCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Request already submitted' });
    }

    await pool.query(
      'INSERT INTO requests (username, password, reason, age, discord) VALUES ($1, $2, $3, $4, $5)',
      [username, password, reason, age, discord]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Piget server running on port ${PORT}`);
});
