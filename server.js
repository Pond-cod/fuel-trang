import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';
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

// Initialize Auth
const serviceAccountAuth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
const gsheets = google.sheets({ version: 'v4', auth: serviceAccountAuth });

async function initDoc() {
  try {
    await doc.loadInfo();
    console.log('Doc loaded successfully:', doc.title);

    // Check and create sheets if they don't exist
    const sheetsMetadata = await gsheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheetTitles = sheetsMetadata.data.sheets.map(s => s.properties.title);

    const sheetsToCreate = [
      { title: NEWS_SHEET, headerValues: ['id', 'title', 'content', 'image_url', 'video_url', 'reference_url', 'created_at', 'updated_at'] },
      { title: USER_NEWS_SHEET, headerValues: ['id', 'user_name', 'user_email', 'title', 'content', 'image_url', 'video_url', 'created_at'] },
      { title: COMMENTS_SHEET, headerValues: ['id', 'news_id', 'user_name', 'user_email', 'avatar', 'content', 'created_at'] }
    ];

    for (const sheetInfo of sheetsToCreate) {
      if (!existingSheetTitles.includes(sheetInfo.title)) {
        console.log(`Creating sheet: ${sheetInfo.title}`);
        await gsheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: { requests: [{ addSheet: { properties: { title: sheetInfo.title } } }] }
        });
        await gsheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetInfo.title}!A1:${String.fromCharCode(64 + sheetInfo.headerValues.length)}1`,
          valueInputOption: 'RAW',
          resource: { values: [sheetInfo.headerValues] }
        });
      }
    }
  } catch (err) {
    console.error('Failed to load doc info or create sheets:', err.message);
    throw err;
  }
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
// ========== NEWS ENDPOINTS ==========

async function getOrCreateNewsSheet() {
  await initDoc();
  let sheet = doc.sheetsByTitle['news'];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: 'news',
      headerValues: ['id', 'title', 'content', 'image_url', 'video_url', 'reference_url', 'created_at', 'updated_at']
    });
  }
  return sheet;
}

app.get('/api/news', async (req, res) => {
  try {
    const sheet = await getOrCreateNewsSheet();
    const rows = await sheet.getRows();
    const news = rows.map(row => ({
      id: row.get('id'), title: row.get('title'), content: row.get('content'),
      image_url: row.get('image_url'), video_url: row.get('video_url'),
      reference_url: row.get('reference_url'), created_at: row.get('created_at'), updated_at: row.get('updated_at')
    })).reverse();
    res.json(news);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/news', async (req, res) => {
  const { title, content, image_url, video_url, reference_url } = req.body;
  try {
    const sheet = await getOrCreateNewsSheet();
    const now = new Date().toLocaleString('th-TH');
    await sheet.addRow({ id: Date.now().toString(), title: title||'', content: content||'', image_url: image_url||'', video_url: video_url||'', reference_url: reference_url||'', created_at: now, updated_at: now });
    res.json({ status: 'success' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/news/update', async (req, res) => {
  const { id, title, content, image_url, video_url, reference_url } = req.body;
  try {
    const sheet = await getOrCreateNewsSheet();
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') == id);
    if (row) {
      row.assign({ title: title||'', content: content||'', image_url: image_url||'', video_url: video_url||'', reference_url: reference_url||'', updated_at: new Date().toLocaleString('th-TH') });
      await row.save();
      res.json({ status: 'success' });
    } else { res.status(404).json({ error: 'Not found' }); }
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    await initDoc();
    const { id } = req.params;
    let response = await gsheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${NEWS_SHEET}!A:A` });
    let rows = response.data.values || [];
    let rowIndex = rows.findIndex(r => r[0] === id);
    let targetSheet = NEWS_SHEET;

    if (rowIndex === -1) {
      response = await gsheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${USER_NEWS_SHEET}!A:A` });
      rows = response.data.values || [];
      rowIndex = rows.findIndex(r => r[0] === id);
      targetSheet = USER_NEWS_SHEET;
    }

    if (rowIndex === -1) return res.status(404).json({ error: 'News not found' });

    const sheetsMetadata = await gsheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const targetSheetMeta = sheetsMetadata.data.sheets.find(s => s.properties.title === targetSheet);
    const sheetId = targetSheetMeta.properties.sheetId;

    await gsheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }] }
    });
    res.json({ status: 'success' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed' }); }
});

// COMMUNITY NEWS & COMMENTS
app.get('/api/user-news', async (req, res) => {
  try {
    await initDoc();
    const response = await gsheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${USER_NEWS_SHEET}!A:H` });
    const rows = response.data.values || [];
    if (rows.length === 0) return res.json([]);
    const header = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      header.forEach((key, i) => obj[key] = row[i] || '');
      return obj;
    }).reverse();
    res.json(data);
  } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/user-news', async (req, res) => {
  try {
    await initDoc();
    const { user_name, user_email, title, content, image_url, video_url } = req.body;
    const id = Date.now().toString();
    const created_at = new Date().toLocaleString('th-TH');
    await gsheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USER_NEWS_SHEET}!A:H`,
      valueInputOption: 'RAW',
      resource: { values: [[id, user_name||'Anon', user_email||'', title||'', content||'', image_url||'', video_url||'', created_at]] }
    });
    res.json({ id, status: 'success' });
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/comments/:news_id', async (req, res) => {
  try {
    await initDoc();
    const { news_id } = req.params;
    const response = await gsheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${COMMENTS_SHEET}!A:G` });
    const rows = response.data.values || [];
    if (rows.length === 0) return res.json([]);
    const header = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      header.forEach((key, i) => obj[key] = row[i] || '');
      return obj;
    }).filter(c => c.news_id === news_id).reverse();
    res.json(data);
  } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/comments', async (req, res) => {
  try {
    await initDoc();
    const { news_id, user_name, user_email, avatar, content } = req.body;
    const id = Date.now().toString();
    const created_at = new Date().toLocaleString('th-TH');
    await gsheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${COMMENTS_SHEET}!A:G`,
      valueInputOption: 'RAW',
      resource: { values: [[id, news_id||'', user_name||'Anon', user_email||'', avatar||'', content||'', created_at]] }
    });
    res.json({ id, status: 'success' });
  } catch (e) { res.status(500).send(e.message); }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
