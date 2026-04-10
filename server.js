import express from 'express';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Environment Configurations
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * HW1 Requirement: Logic step
 * Processing function that maps or transforms incoming data.
 */
function processApplicationData(data) {
    // 1. Trim inputs, 2. Normalize fields, 3. Map for Google Sheets, 4. Add timestamp
    return {
        timestamp: new Date().toISOString(),
        name: (data.name || '').trim(),
        email: (data.email || '').trim().toLowerCase(),
        applied_role: (data.applied_role || '').trim(),
        cv_text: (data.cv_text || '').trim(),
        storage_status: 'Pending'
    };
}

/**
 * HW1 Requirement: Integration step
 * Function to push data to an external API (Google Sheets)
 */
async function appendToSheet(processedData) {
    if (!SPREADSHEET_ID) {
        console.warn("GOOGLE_SHEET_ID is not set in .env. Skipping Google Sheets append.");
        return false;
    }

    try {
        // Authenticate to Google Sheets using a local credentials.json file
        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Match the required column order: timestamp | name | email | applied_role | cv_text | storage_status
        const values = [
            [
                processedData.timestamp,
                processedData.name,
                processedData.email,
                processedData.applied_role,
                processedData.cv_text,
                'Success' // Storage status indicates successful push
            ]
        ];

        // Dynamically fetch the first sheet's title to avoid "Unable to parse range" error
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheetTitle = sheetInfo.data.sheets[0].properties.title;

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetTitle}!A:F`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });
        
        return true;
    } catch (error) {
        console.error('Error appending to Google Sheets:', error.message);
        return false;
    }
}

/**
 * HW1 Requirement: AI Step
 * Function to call Gemini API to generate an applicant summary, department matching, and fit estimation
 */
async function analyzeApplication(cvText) {
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not set in .env. Skipping AI completion.");
        return {
            ai_summary: "AI analysis skipped (no API key).",
            recommended_department: "Other",
            fit_level: "Medium"
        };
    }

    try {
        // Use gemini-2.5-flash since 1.5 is retired/unavailable in this region/key
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // We instruct the model to return exactly a JSON object so it satisfies the business logic
        const prompt = `
You are an expert HR assistant. Analyze the candidate's CV.
CV Text: "${cvText}"

Respond with ONLY a raw JSON object (no markdown, no backticks, no comments) containing these 3 keys:
1. "ai_summary": A very brief 1-2 sentence summary of the candidate's profile.
2. "recommended_department": Must be exactly one of: Engineering, Data/AI, Product, Marketing, HR, Sales, Other.
3. "fit_level": Must be exactly one of: High, Medium, Low.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean markdown backticks in case the model ignored our "no markdown" instruction
        const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedResponse = JSON.parse(cleanedText);

        return {
            ai_summary: parsedResponse.ai_summary || "Could not generate summary.",
            recommended_department: parsedResponse.recommended_department || "Other",
            fit_level: parsedResponse.fit_level || "Medium"
        };

    } catch (error) {
        console.error('Error calling Gemini API:', error.message);
        return {
            ai_summary: "Error during AI analysis.",
            recommended_department: "Other",
            fit_level: "Low"
        };
    }
}

/**
 * HW1 Requirement: Trigger step
 * An HTTP POST endpoint that acts as a webhook
 */
app.post('/webhook/apply', async (req, res) => {
    try {
        const payload = req.body;

        // 1. Basic required fields validation
        if (!payload || !payload.name || !payload.email || !payload.applied_role || !payload.cv_text) {
            return res.status(400).json({ error: 'Missing required payload fields: name, email, applied_role, cv_text' });
        }

        // 2. Processing / Transformation function
        const processedData = processApplicationData(payload);

        // 3. Push data to External API (Google Sheets)
        // Note: As required, the raw data is pushed first.
        const sheetSuccess = await appendToSheet(processedData);

        // 4. AI Completion Step
        const aiResult = await analyzeApplication(processedData.cv_text);

        // 5. Structure final JSON response according to constraints
        return res.json({
            success: true,
            stored_in_sheets: sheetSuccess,
            ai_summary: aiResult.ai_summary,
            recommended_department: aiResult.recommended_department,
            fit_level: aiResult.fit_level
        });

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error processing the webhook.' });
    }
});

// Start up the Express Server
app.listen(PORT, () => {
    console.log(`[ HW1 ] Server is running!`);
    console.log(`[ HW1 ] Webhook endpoint is POST http://localhost:${PORT}/webhook/apply`);
});
