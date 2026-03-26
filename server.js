import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Simple logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY 
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/^"|"$/g, '').replace(/\\n/g, '\n') 
  : null;

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
  const { stationId, fuelKey, voteType, userName, userEmail } = req.body;
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

      // Log vote to votes_log sheet
      try {
        let logSheet = doc.sheetsByTitle['votes_log'];
        if (!logSheet) {
          logSheet = await doc.addSheet({
            title: 'votes_log',
            headerValues: ['timestamp', 'user_name', 'user_email', 'station_id', 'station_name', 'fuel_type', 'vote_type']
          });
        }
        await logSheet.addRow({
          timestamp: new Date().toLocaleString('th-TH'),
          user_name: userName || 'Anonymous',
          user_email: userEmail || '',
          station_id: stationId,
          station_name: row.get('name'),
          fuel_type: fuelKey,
          vote_type: voteType
        });
      } catch (logErr) {
        console.error('Vote log error:', logErr.message);
      }

      res.json({ status: 'success' });
    } else {
      res.status(404).json({ error: 'Station not found' });
    }
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    await initDoc();
    const logSheet = doc.sheetsByTitle['votes_log'];
    if (!logSheet) {
      return res.json([]);
    }
    const rows = await logSheet.getRows();
    const userMap = {};
    rows.forEach(row => {
      const name = row.get('user_name') || 'Anonymous';
      const email = row.get('user_email') || '';
      const key = email || name;
      if (!userMap[key]) {
        userMap[key] = { name, email, voteCount: 0, lastVote: '' };
      }
      userMap[key].voteCount += 1;
      userMap[key].lastVote = row.get('timestamp') || '';
    });
    const leaderboard = Object.values(userMap)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 50);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
