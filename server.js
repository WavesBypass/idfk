// server.js
const express = require('express');
const path = require('path');
const db = require('./db');           // your existing db.js
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session (for isStaff)
app.use(session({
  secret: 'replace-with-your-secret',
  resave: false,
  saveUninitialized: false,
}));

// Auto-create join_requests table
db.query(`
  CREATE TABLE IF NOT EXISTS join_requests (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    age INTEGER NOT NULL,
    discord TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Table creation error:', err));

// Simple stub isStaff middleware — replace with your real auth
function isStaff(req, res, next) {
  // e.g. req.session.user.role === 'staff'
  if (req.session.user && req.session.user.role === 'staff') {
    return next();
  }
  return res.status(403).send('Access denied');
}

// 1) Handle user form submission
app.post('/submit-request', async (req, res) => {
  const { username, age, discord, reason } = req.body;
  if (!username || !age || !discord || !reason) {
    return res.status(400).send('All fields are required.');
  }
  try {
    await db.query(
      `INSERT INTO join_requests (username, age, discord, reason)
       VALUES ($1, $2, $3, $4)`,
      [username, age, discord, reason]
    );
    // Redirect back with a query flag that we can use for a popup
    res.redirect('/register.html?sent=1');
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).send('Server error.');
  }
});

// 2) Serve pending requests as JSON (for staff page)
app.get('/forms', isStaff, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM join_requests WHERE status='pending' ORDER BY submitted_at`
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch forms error:', err);
    res.status(500).send('Error loading forms.');
  }
});

// 3) Approve / Deny endpoints
app.post('/approve/:id', isStaff, async (req, res) => {
  const id = req.params.id;
  try {
    // create the actual user
    const { rows } = await db.query(
      'SELECT username FROM join_requests WHERE id=$1',
      [id]
    );
    await db.query('INSERT INTO users (username) VALUES ($1)', [rows[0].username]);
    await db.query(`UPDATE join_requests SET status='approved' WHERE id=$1`, [id]);
    res.redirect('/forms.html');
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).send('Error approving.');
  }
});

app.post('/deny/:id', isStaff, async (req, res) => {
  const id = req.params.id;
  try {
    await db.query(`UPDATE join_requests SET status='denied' WHERE id=$1`, [id]);
    res.redirect('/forms.html');
  } catch (err) {
    console.error('Deny error:', err);
    res.status(500).send('Error denying.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
