const express = require('express');
const session = require('express-session');
const pg = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'piget-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create tables on startup
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        age INTEGER,
        discord TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        age INTEGER,
        discord TEXT,
        status TEXT DEFAULT 'pending'
      );
    `);
    console.log('✅ Tables ensured.');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}
createTables();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/stats.html');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/register', async (req, res) => {
  const { username, password, age, discord } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, age, discord) VALUES ($1, $2, $3, $4)',
      [username, hashed, age, discord]
    );
    res.redirect('/login.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Registration failed');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).send('Invalid credentials');
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send('Invalid credentials');
    req.session.userId = user.id;
    res.redirect('/stats.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Login error');
  }
});

app.post('/submit-request', async (req, res) => {
  const { username, password, age, discord } = req.body;
  try {
    await pool.query(
      'INSERT INTO requests (username, password, age, discord, status) VALUES ($1, $2, $3, $4, $5)',
      [username, password, age, discord, 'pending']
    );
    res.redirect('/success.html');
  } catch (err) {
    console.error(err);
    res.status(500).send('Form submission failed');
  }
});

app.get('/forms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching forms');
  }
});

app.post('/forms/approve', async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['approved', id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Approval failed');
  }
});

app.post('/forms/deny', async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('UPDATE requests SET status = $1 WHERE id = $2', ['denied', id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Denial failed');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
