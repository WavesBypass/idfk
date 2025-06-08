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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'piget-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create tables
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
    console.error('❌ Table creation error:', err.message);
  }
})();

// Submit form request
app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord, reason } = req.body;

  if (!username || !password || !age || !discord || !reason) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }

  try {
    const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const pending = await db.query('SELECT * FROM requests WHERE username = $1 AND status = $2', [username, 'pending']);

    if (user.rows.length > 0 || pending.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username taken or pending' });
    }

    await db.query(
      'INSERT INTO requests (username, password, age, discord, reason) VALUES ($1, $2, $3, $4, $5)',
      [username, password, age, discord, reason]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in /submit-request:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Get all pending requests
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM requests WHERE status = 'pending'");
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error in /requests:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Approve request
app.post('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await db.query('SELECT * FROM requests WHERE id = $1', [id]);

    if (request.rows.length === 0) return res.status(404).send('Not found');

    const user = request.rows[0];
    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [user.username, user.password]);
    await db.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error in /approve:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Deny request
app.post('/deny/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE requests SET status = 'denied' WHERE id = $1", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error in /deny:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
