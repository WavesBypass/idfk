const express = require('express');
const app = express();
const path = require('path');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const session = require('express-session');

const pool = new Pool({
  user: 'doadmin',
  host: 'db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com',
  database: 'defaultdb',
  password: 'AVNS_pmydiR8acsiQlbtVTQF',
  port: 25060,
  ssl: { rejectUnauthorized: false },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: '9Lfj8ksnCqU2zVr4WmXyPq1bTiNgHu7z',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auto-create tables
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS form_requests (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE,
      reason TEXT,
      age VARCHAR(10),
      discord VARCHAR(100),
      status VARCHAR(20) DEFAULT 'pending'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE,
      discord VARCHAR(100)
    );
  `);
}
createTables().catch(console.error);

// Routes
app.post('/submit-request', async (req, res) => {
  const { username, reason, age, discord } = req.body;

  if (!username || !reason || !age || !discord) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM form_requests WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already submitted' });
    }

    await pool.query(
      'INSERT INTO form_requests (username, reason, age, discord) VALUES ($1, $2, $3, $4)',
      [username, reason, age, discord]
    );

    res.status(200).json({ success: true, message: 'Request submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM form_requests WHERE status = $1', ['pending']);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching requests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/update-request', async (req, res) => {
  const { id, action } = req.body;
  if (!id || !['approved', 'denied'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  try {
    const request = await pool.query('SELECT * FROM form_requests WHERE id = $1', [id]);
    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    await pool.query('UPDATE form_requests SET status = $1 WHERE id = $2', [action, id]);

    if (action === 'approved') {
      const { username, discord } = request.rows[0];
      await pool.query(
        'INSERT INTO users (username, discord) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
        [username, discord]
      );
    }

    res.status(200).json({ success: true, message: `Request ${action}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
