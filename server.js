const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const pg = require('pg');
const app = express();

const PORT = process.env.PORT || 3000;

const db = new pg.Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false }
});

// Auto-create tables
const createTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS form_requests (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending'
    );
  `);
};

createTables().catch(err => console.error('Table creation error:', err));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'yourSecret',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

// REGISTER SUBMISSION -> form_requests
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

    const requestExists = await db.query('SELECT * FROM form_requests WHERE username = $1', [username]);
    if (requestExists.rows.length > 0) {
      return res.status(409).json({ error: 'Form request already submitted' });
    }

    await db.query('INSERT INTO form_requests (username, password, reason) VALUES ($1, $2, $3)', [username, password, reason]);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Submit request error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length > 0) {
      req.session.user = result.rows[0];
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ error: 'Invalid login' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET FORM REQUESTS
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM form_requests ORDER BY id DESC');
    return res.status(200).json(result.rows); // Must be an array
  } catch (err) {
    console.error('Get requests error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// APPROVE/DENY REQUESTS
app.post('/approve-request', async (req, res) => {
  const { id, action } = req.body;

  try {
    const request = await db.query('SELECT * FROM form_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (action === 'approve') {
      const { username, password } = request.rows[0];
      await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
      await db.query('UPDATE form_requests SET status = $1 WHERE id = $2', ['approved', id]);
    } else if (action === 'deny') {
      await db.query('UPDATE form_requests SET status = $1 WHERE id = $2', ['denied', id]);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Approve/Deny error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
