
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const pg = require('pg');
const cors = require('cors');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/piget'
});

app.get('/forms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM forms WHERE status = $1 ORDER BY submitted_at DESC', ['pending']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/forms/:id/approved', async (req, res) => {
  try {
    await pool.query('UPDATE forms SET status = $1 WHERE id = $2', ['approved', req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/forms/:id/denied', async (req, res) => {
  try {
    await pool.query('UPDATE forms SET status = $1 WHERE id = $2', ['denied', req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
