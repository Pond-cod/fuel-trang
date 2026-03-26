import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

// Initialize Auth
const serviceAccountAuth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

async function initDoc() {
  await doc.loadInfo();
}

// GET /api/stations
app.get('/api/stations', async (req, res) => {
  try {
    await initDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const stations = rows.map(row => ({
      id: row.get('id'),
      name: row.get('name'),
      brand: row.get('brand'),
      district: row.get('district'),
      fuels: {
        diesel: { have: parseInt(row.get('diesel_have')) || 0, out: parseInt(row.get('diesel_out')) || 0 },
        g95: { have: parseInt(row.get('g95_have')) || 0, out: parseInt(row.get('g95_out')) || 0 },
        g91: { have: parseInt(row.get('g91_have')) || 0, out: parseInt(row.get('g91_out')) || 0 },
        e20: { have: parseInt(row.get('e20_have')) || 0, out: parseInt(row.get('e20_out')) || 0 },
      },
      lastUpdated: row.get('lastUpdated')
    }));
    
    res.json(stations);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// POST /api/vote
app.post('/api/vote', async (req, res) => {
  const { stationId, fuelKey, voteType } = req.body;
  try {
    await initDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') == stationId);
    
    if (row) {
      const colName = `${fuelKey}_${voteType}`;
      const currentVal = parseInt(row.get(colName)) || 0;
      row.assign({
        [colName]: currentVal + 1,
        lastUpdated: new Date().toLocaleString('th-TH')
      });
      await row.save();
      res.json({ status: 'success' });
    } else {
      res.status(404).json({ error: 'Station not found' });
    }
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ status: 'success' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// POST /api/admin/update
app.post('/api/admin/update', async (req, res) => {
  const { stationId, name, brand, district } = req.body;
  try {
    await initDoc();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') == stationId);
    
    if (row) {
      row.assign({
        name,
        brand,
        district,
        lastUpdated: new Date().toLocaleString('th-TH')
      });
      await row.save();
      res.json({ status: 'success' });
    } else {
      res.status(404).json({ error: 'Station not found' });
    }
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

export default app;
