import { google } from 'googleapis';

/**
 * Antigravity-generated connector wrapper for Google Sheets append.
 * This module provides a single integration point for HW2 storage.
 */
export async function appendApplicationRow({
  spreadsheetId,
  credentialsFile = 'credentials.json',
  rowData
}) {
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is missing.');
  }

  if (!Array.isArray(rowData) || rowData.length === 0) {
    throw new Error('rowData must be a non-empty array.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = sheetInfo.data.sheets?.[0]?.properties?.title;

  if (!firstSheetTitle) {
    throw new Error('Could not resolve target sheet title.');
  }

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${firstSheetTitle}!A:E`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowData] }
  });

  const updatedRows = result?.data?.updates?.updatedRows || 0;
  return updatedRows > 0;
}
