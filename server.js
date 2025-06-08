const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Redirect /public/* to remove "/public"
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/forms.html', (req, res) => res.sendFile(path.join(__dirname, 'public/forms.html')));

// Create tables
async function createTables() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );`);

    await db.query(`DROP TABLE IF EXISTS form_requests;`);
    await db.query(`CREATE TABLE form_requests (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
    );`);
    
    console.log("Tables ready");
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}
createTables();

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length > 0) {
      req.session.user = username;
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Session check
app.get('/session-check', (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true });
  } else {
    return res.json({ loggedIn: false });
  }
});

// Submit request (register form)
app.post('/submit-request', async (req, res) => {
  const { username, password, reason } = req.body;

  if (!username || !password || !reason) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const userExists = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const pendingExists = await db.query('SELECT * FROM form_requests WHERE username = $1', [username]);
    if (pendingExists.rows.length > 0) {
      return res.status(409).json({ error: 'Form request already submitted' });
    }

    await db.query('INSERT INTO form_requests (username, password, reason) VALUES ($1, $2, $3)', [username, password, reason]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Submit request error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all form requests
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM form_requests WHERE status = $1', ['pending']);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Requests error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Approve request
app.post('/approve', async (req, res) => {
  const { id } = req.body;
  try {
    const request = await db.query('SELECT * FROM form_requests WHERE id = $1', [id]);

    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { username, password } = request.rows[0];

    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await db.query('UPDATE form_requests SET status = $1 WHERE id = $2', ['approved', id]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Approval error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Deny request
app.post('/deny', async (req, res) => {
  const { id } = req.body;
  try {
    await db.query('UPDATE form_requests SET status = $1 WHERE id = $2', ['denied', id]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Deny error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
