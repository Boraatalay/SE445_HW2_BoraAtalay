import express from 'express';
import dotenv from 'dotenv';
import { appendApplicationRow } from './connectors/antigravitySheetsConnector.js';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Environment Configurations
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * HW2 Minimal processing step
 * Processing function that maps or transforms incoming data.
 */
function processApplicationData(data) {
  return {
    timestamp: new Date().toISOString(),
    name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    message: (data.message || '').trim()
  };
}

/**
 * HW2 Trigger step
 * An HTTP POST endpoint that acts as a webhook
 */
app.post('/webhook/apply', async (req, res) => {
  try {
    const payload = req.body || {};
    const payloadKeys = Object.keys(payload);
    const requiredKeys = ['name', 'email', 'message'];
    const hasExactContract =
      payloadKeys.length === requiredKeys.length &&
      requiredKeys.every((key) => payloadKeys.includes(key));

    if (!hasExactContract) {
      return res.status(400).json({
        success: false,
        error: 'Payload must contain exactly these fields: name, email, message'
      });
    }

    const processedData = processApplicationData(payload);

    if (!processedData.name || !processedData.email || !processedData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, message'
      });
    }

    const rowData = [
      processedData.timestamp,
      processedData.name,
      processedData.email,
      processedData.message,
      'Success'
    ];

    const storedInSheets = await appendApplicationRow({
      spreadsheetId: SPREADSHEET_ID,
      rowData
    });

    if (!storedInSheets) {
      return res.status(500).json({
        success: false,
        error: 'Failed to store application in Google Sheets'
      });
    }

    return res.status(200).json({
      success: true,
      stored_in_sheets: true,
      message: 'Application message received and stored successfully.'
    });
  } catch (error) {
    console.error('Webhook Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to store application in Google Sheets'
    });
  }
});

// Start up the Express Server
app.listen(PORT, () => {
  console.log('[ HW2 ] Server is running!');
  console.log(`[ HW2 ] Webhook endpoint is POST http://localhost:${PORT}/webhook/apply`);
});
