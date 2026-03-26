import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

async function testConnection() {
  console.log('Testing connection to sheet:', SPREADSHEET_ID);
  console.log('Email:', GOOGLE_CLIENT_EMAIL);
  
  const serviceAccountAuth = new JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

  try {
    await doc.loadInfo();
    console.log('Title:', doc.title);
    const sheet = doc.sheetsByIndex[0];
    console.log('Sheet name:', sheet.title);
    console.log('Rows:', sheet.rowCount);
    
    const rows = await sheet.getRows();
    console.log('Fetched rows:', rows.length);
    
    if (rows.length > 0) {
      console.log('First row example:', {
        id: rows[0].get('id'),
        name: rows[0].get('name'),
        brand: rows[0].get('brand')
      });
    } else {
      console.log('No rows found in the sheet!');
    }
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

testConnection();
