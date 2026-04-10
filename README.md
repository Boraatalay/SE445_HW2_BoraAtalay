# AI CV Routing Webhook (HW1)

A beginner-friendly end-to-end automation project that accepts a candidate job application via webhook, stores it in Google Sheets, and evaluates the CV using Google Gemini AI.

## Mappings to HW1 Requirements
This project exactly satisfies the defined requirements in the following sequence:
1. **Trigger:** `app.post('/webhook/apply', ...)` acts as an HTTP POST endpoint.
2. **Logic Step:** `processApplicationData()` function cleans strings, normalize emails, and injects timestamps.
3. **Integration Step:** `appendToSheet()` connects to the Google Sheets API and stores the candidate's raw data directly to a row.
4. **AI Step:** `analyzeApplication()` passes the CV text to Gemini 1.5 Flash to generate a summary, a recommended department, and a fit level score.

---

## Prerequisites

1. **Node.js** (v18 or higher recommended)
2. **Google Cloud Account** (To create Service Account Credentials for Sheets)
3. **Google Gemini API Key** (From Google AI Studio)

## Setup Instructions

### 1. Install Dependencies
Run the following inside the project folder:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the provided `.env.example` into a new `.env` file:
```bash
cp .env.example .env
```
Inside `.env`, populate the three variables:
- `PORT` = (Keep as 3000 or pick another port)
- `GOOGLE_SHEET_ID` = (Copy this from your Google Sheet's URL)
- `GEMINI_API_KEY` = (Your Gemini API Key)

### 3. Connect Google Sheets (Authentication)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Sheets API**.
3. Create a **Service Account** and download its JSON key file.
4. Rename the downloaded file to `credentials.json` and place it in the root of this project folder. *(Note: This file is ignored by git to keep your secrets safe).*
5. Open your `credentials.json` and copy the `client_email`.
6. Create a blank Google Sheet, and add these column headers to row 1:
   `timestamp` | `name` | `email` | `applied_role` | `cv_text` | `storage_status`
7. Click the **Share** button on your Google Sheet and invite the `client_email` Service Account as an **Editor**.

## How to Run

Start the server using:
```bash
npm start
```
The console will report `Server is running!` and display the webhook endpoint.

## How to Test it Live

To test the application, open a new terminal window and send a webhook request using `curl`. 
A sample payload is available in `sample-payload.json`.

```bash
curl -X POST http://localhost:3000/webhook/apply \
-H "Content-Type: application/json" \
-d @sample-payload.json
```

### Expected JSON Response

```json
{
  "success": true,
  "stored_in_sheets": true,
  "ai_summary": "An experienced data professional with 4 years of background in Python, SQL and Tableau.",
  "recommended_department": "Data/AI",
  "fit_level": "High"
}
```

## Live Demo Walkthrough
When presenting live:
1. Show your terminal with `node server.js` running.
2. Show your empty Google Sheet.
3. Open a second terminal window and run the `curl` command.
4. Let the audience watch the terminal output that represents the API request returning perfectly formatted JSON with AI evaluations.
5. Immediately switch to the Google Sheet tab and show that the raw data and timestamp have appeared.
6. Briefly walk through the `server.js` file to show how the "Sequence" of the homework is satisfied.
