import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

if (!SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.error('Missing environment variables in .env.local');
  process.exit(1);
}

// In case it's NOT unescaped by dotenv (though our test showed it is)
const finalizedKey = GOOGLE_PRIVATE_KEY.includes('\\n') 
  ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : GOOGLE_PRIVATE_KEY;

const serviceAccountAuth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: finalizedKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

async function seed() {
  try {
    console.log('Connecting to Google Sheets...');
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    console.log('Reading CSV file...');
    const csvData = fs.readFileSync('trang_fuel_db_seed_63_stations.csv', 'utf8');
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim();
      });
      return row;
    });

    console.log(`Adding ${rows.length} stations to the sheet...`);
    await sheet.addRows(rows);
    
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    if (error.response) {
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

seed();
