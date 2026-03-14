const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to database
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // ← this line is needed for Railway
});

async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id     SERIAL PRIMARY KEY,
        lat    FLOAT,
        lng    FLOAT,
        smoke  INT,
        alert  BOOLEAN,
        ts     TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database ready');
  } catch(e) {
    console.error('DB init error:', e.message);
  }
}
init();

// ESP8266 + SIM800 sends data here
app.post('/update', async (req, res) => {
  try {
    const { lat, lng, smoke, alert } = req.body;
    await pool.query(
      'INSERT INTO locations (lat, lng, smoke, alert) VALUES ($1, $2, $3, $4)',
      [lat, lng, smoke || 0, alert || false]
    );
    res.send('OK');
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

// Latest location
app.get('/latest', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM locations ORDER BY ts DESC LIMIT 1');
    res.json(r.rows[0] || {});
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Route history (last 100 points)
app.get('/history', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM locations ORDER BY ts DESC LIMIT 100');
    res.json(r.rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Serve dashboard for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));