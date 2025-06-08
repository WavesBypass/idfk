const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'super-secret-session-key',
  resave: false,
  saveUninitialized: true,
}));

// Create tables if not exist
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password TEXT,
        age VARCHAR(10),
        discord VARCHAR(100),
        reason TEXT,
        status VARCHAR(10) DEFAULT 'pending'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password TEXT
      );
    `);

    console.log('✅ Tables are ready');
  } catch (err) {
    console.error('❌ Failed to create tables:', err);
  }
})();

// Submit form request
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  try {
    // Check if user already exists
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Check if already requested
    const reqCheck = await pool.query('SELECT * FROM requests WHERE username = $1', [username]);
    if (reqCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Request already submitted' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, hashed, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /submit-request:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Get pending requests
app.get('/requests', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requests WHERE status = $1', ['pending']);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching requests:', err);
    res.status(500).json({ success: false });
  }
});

// Approve request
app.post('/approve/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);

    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const { username, password } = request.rows[0];

    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', requestId]);

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error approving request:', err);
    res.status(500).json({ success: false });
  }
});

// Deny request
app.post('/deny/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', requestId]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error denying request:', err);
    res.status(500).json({ success: false });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid username or password' });
    }

    req.session.user = user.username;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false });
  }
});

// Check session
app.get('/check-session', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});

// Fallback for 404
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
