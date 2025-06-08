const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const db = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'piget-secret',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// Check if user exists
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
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

app.get('/check-session', (req, res) => {
  res.json({ loggedIn: !!req.session.user });
});

// Register request (Form submission)
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }

  try {
    const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const existingRequest = await db.query('SELECT * FROM requests WHERE username = $1 AND status = $2', [username, 'pending']);

    if (existingUser.rows.length > 0 || existingRequest.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username taken or pending' });
    }

    await db.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, password, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Submit request error:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get pending forms
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM requests WHERE status = 'pending'");
    res.json(result.rows);
  } catch (err) {
    console.error('Requests fetch error:', err);
    res.status(500).send('Error loading requests');
  }
});

// Approve
app.post('/approve/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
    const { username, password } = request.rows[0];

    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await db.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);

    res.sendStatus(200);
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).send('Approve failed');
  }
});

// Deny
app.post('/deny/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE requests SET status = 'denied' WHERE id = $1", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error('Deny error:', err);
    res.status(500).send('Deny failed');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
