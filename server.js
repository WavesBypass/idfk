const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const db = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'piget-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Auto-create tables
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age TEXT,
        discord TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending'
      );
    `);

    console.log('✅ Tables are ready');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  }
})();

// ✅ Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    if (result.rows.length > 0) {
      req.session.user = username;
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ Register route (submit request)
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const userExists = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const pendingExists = await db.query('SELECT * FROM requests WHERE username = $1 AND status = $2', [username, 'pending']);

    if (userExists.rows.length > 0 || pendingExists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists or is pending approval' });
    }

    await db.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, password, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// ✅ View all pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM requests WHERE status = 'pending'");
    res.json(result.rows);
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// ✅ Approve request
app.post('/approve/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
    const request = result.rows[0];

    if (!request) return res.status(404).json({ error: 'Request not found' });

    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [request.username, request.password]);
    await db.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);

    res.sendStatus(200);
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ✅ Deny request
app.post('/deny/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE requests SET status = 'denied' WHERE id = $1", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error('Deny error:', err);
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
