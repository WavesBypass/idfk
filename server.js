// server.js
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'piget-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7*24*60*60*1000 }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create tables if missing
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        age INTEGER NOT NULL,
        discord VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS registration_requests (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        age INTEGER NOT NULL,
        discord VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables are ready');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}
createTables();

// Register - POST /register
app.post('/register', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;
  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  const ageInt = parseInt(age, 10);
  if (isNaN(ageInt)) {
    return res.status(400).json({ success: false, message: 'Age must be a number' });
  }
  try {
    // Check if username exists in users or registration_requests
    const userCheck = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (userCheck.rowCount > 0) {
      return res.status(400).json({ success: false, message: 'Username already registered' });
    }
    const requestCheck = await pool.query('SELECT 1 FROM registration_requests WHERE username = $1', [username]);
    if (requestCheck.rowCount > 0) {
      return res.status(400).json({ success: false, message: 'Registration request for this username is pending' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into registration_requests
    await pool.query(
      `INSERT INTO registration_requests (username, password, age, discord, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [username, hashedPassword, ageInt, discord, reason]
    );

    res.json({ success: true, message: 'Registration request submitted, pending approval' });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Login - POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    req.session.userId = user.id;
    res.json({ success: true, message: 'Logged in successfully' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Middleware to redirect logged-in user away from /login.html
app.get('/login.html', (req, res, next) => {
  if (req.session.userId) return res.redirect('/stats.html');
  next();
});

// Forms page - GET /forms (staff)
// Returns JSON with pending requests (for simple testing)
app.get('/forms', async (req, res) => {
  try {
    const requests = await pool.query('SELECT id, username, age, discord, reason, created_at FROM registration_requests ORDER BY created_at ASC');
    res.json({ success: true, requests: requests.rows });
  } catch (err) {
    console.error('Get forms error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Approve registration request - POST /forms/approve
app.post('/forms/approve', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'Request id is required' });

  try {
    // Get request data
    const reqRes = await pool.query('SELECT * FROM registration_requests WHERE id = $1', [id]);
    if (reqRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const request = reqRes.rows[0];

    // Insert into users table
    await pool.query(
      `INSERT INTO users (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)`,
      [request.username, request.password, request.age, request.discord, request.reason]
    );

    // Delete request
    await pool.query('DELETE FROM registration_requests WHERE id = $1', [id]);

    res.json({ success: true, message: 'User approved and created' });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Deny registration request - POST /forms/deny
app.post('/forms/deny', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'Request id is required' });
  try {
    await pool.query('DELETE FROM registration_requests WHERE id = $1', [id]);
    res.json({ success: true, message: 'Request denied and
