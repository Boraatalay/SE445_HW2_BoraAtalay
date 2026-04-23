# AI Application Intake Webhook (HW2)

This project is an HW2 upgrade of the existing HW1 CV intake workflow.  
It keeps the same webhook-based application theme and now focuses on the required HW2 flow:

**HTTP POST ({name, email, message}) -> Antigravity Connector -> Google Sheets**

## HW2 Workflow

1. Receive a `POST` request at `/webhook/apply`.
2. Accept only these required fields: `name`, `email`, `message`.
   - The payload must contain **exactly** these 3 keys (no extra keys).
3. Apply minimal normalization:
   - trim text fields
   - lowercase email
   - add ISO timestamp
4. Send raw normalized data to Google Sheets using the connector module at `connectors/antigravitySheetsConnector.js`.
5. Append one row per successful request.

## Prerequisites

1. Node.js (v18+ recommended)
2. Google Cloud service account with Sheets API enabled
3. `credentials.json` in project root
4. Target Google Sheet shared with service account `client_email`

## Setup

### 1) Install
```bash
npm install
```

### 2) Environment variables
```bash
cp .env.example .env
```

Set:
- `PORT=3000`
- `GOOGLE_SHEET_ID=your_google_sheet_id_here`

### 3) Google Sheet columns
Create these headers in row 1:

`timestamp` | `name` | `email` | `message` | `storage_status`

## Run

```bash
npm start
```

Endpoint:
- `POST http://localhost:3000/webhook/apply`

## Test

Use the provided `sample-payload.json`:

```bash
curl -X POST http://localhost:3000/webhook/apply \
  -H "Content-Type: application/json" \
  -d @sample-payload.json
```

### Expected success response
```json
{
  "success": true,
  "stored_in_sheets": true,
  "message": "Application message received and stored successfully."
}
```

## Error responses

### Missing required fields (`400`)
```json
{
  "success": false,
  "error": "Missing required fields: name, email, message"
}
```

### Invalid payload contract (`400`)
```json
{
  "success": false,
  "error": "Payload must contain exactly these fields: name, email, message"
}
```

### Storage failure (`500`)
```json
{
  "success": false,
  "error": "Failed to store application in Google Sheets"
}
```
