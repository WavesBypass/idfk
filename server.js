
const express = require('express');
const pg = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new pg.Pool({
  connectionString: 'postgresql://doadmin:AVNS_pmydiR8acsiQlbtVTQF@db-postgresql-nyc1-97903-do-user-22678364-0.f.db.ondigitalocean.com:25060/defaultdb',
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Submit form
app.post('/submit-form', async (req, res) => {
  const { username, message } = req.body;
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS form_requests (id SERIAL PRIMARY KEY, username TEXT, message TEXT, status TEXT DEFAULT \'pending\')');
    await pool.query('INSERT INTO form_requests (username, message) VALUES ($1, $2)', [username, message]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Fetch forms
app.get('/get-forms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM form_requests ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching forms');
  }
});

// Accept or deny a form
app.post('/update-form', async (req, res) => {
  const { id, status } = req.body;
  try {
    await pool.query('UPDATE form_requests SET status = $1 WHERE id = $2', [status, id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
