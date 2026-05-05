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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MIN_CV_LENGTH = 40;
const ALLOWED_PAYLOAD_KEYS = ['name', 'email', 'message'];
const VALID_SENIORITY_LEVELS = ['Intern', 'Junior', 'Mid', 'Senior', 'Unknown'];

const DEFAULT_ANALYSIS = {
  recommended_department: 'Unknown',
  skills: [],
  seniority_level: 'Unknown',
  fit_score: 0,
  reasoning: 'Insufficient valid CV information.'
};

/**
 * HW2 processing step, extended for HW3.
 * The existing message field is treated as the applicant CV text.
 */
function processApplicationData(data) {
  return {
    timestamp: new Date().toISOString(),
    applicant_name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    cv_text: (data.message || '').trim()
  };
}

/**
 * HW3 validation step.
 * Invalid records are still persisted, but clearly marked and skipped for AI analysis.
 */
function validateApplicationData(data) {
  const validationErrors = [];

  if (!data.applicant_name) {
    validationErrors.push('Applicant name is required.');
  }

  if (!data.email) {
    validationErrors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    validationErrors.push('Email format is invalid.');
  }

  if (!data.cv_text) {
    validationErrors.push('CV text is required.');
  } else if (data.cv_text.length < MIN_CV_LENGTH) {
    validationErrors.push(`CV text must be at least ${MIN_CV_LENGTH} characters long.`);
  }

  return {
    validation_status: validationErrors.length > 0 ? 'Invalid' : 'Valid',
    validation_errors: validationErrors
  };
}

function createAiPrompt(cvText) {
  return `Analyze this applicant CV for recruitment routing.

Use only information found in the CV.
Do not invent experience.
If information is missing, use "Unknown".
Keep reasoning short.
Return JSON only, with no markdown.

Required JSON shape:
{
  "recommended_department": "string",
  "skills": ["string"],
  "seniority_level": "Intern | Junior | Mid | Senior | Unknown",
  "fit_score": 0,
  "reasoning": "string"
}

Rules:
- recommended_department should be the best matching department for the applicant.
- skills must be a list of skills explicitly present in the CV.
- seniority_level must be one of: Intern, Junior, Mid, Senior, Unknown.
- fit_score must be a number from 0 to 100.

CV:
${cvText}`;
}

function normalizeAiAnalysis(analysis) {
  const fitScore = Number(analysis?.fit_score);
  const seniorityLevel = VALID_SENIORITY_LEVELS.includes(analysis?.seniority_level)
    ? analysis.seniority_level
    : 'Unknown';

  return {
    recommended_department: String(analysis?.recommended_department || 'Unknown').trim() || 'Unknown',
    skills: Array.isArray(analysis?.skills)
      ? analysis.skills.map((skill) => String(skill).trim()).filter(Boolean)
      : [],
    seniority_level: seniorityLevel,
    fit_score: Number.isFinite(fitScore) ? Math.max(0, Math.min(100, Math.round(fitScore))) : 0,
    reasoning: String(analysis?.reasoning || 'Unknown').trim() || 'Unknown'
  };
}

/**
 * HW3 AI analysis step.
 * The prompt requires valid JSON only so downstream decision rules can be deterministic.
 */
async function analyzeCvWithOpenAi(cvText) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an HR recruitment analyst. Return valid JSON only.'
        },
        {
          role: 'user',
          content: createAiPrompt(cvText)
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI analysis failed: ${response.status} ${errorBody}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI analysis returned an empty response.');
  }

  return normalizeAiAnalysis(JSON.parse(content));
}

async function analyzeCvWithGemini(cvText) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: createAiPrompt(cvText) }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini analysis failed: ${response.status} ${errorBody}`);
  }

  const result = await response.json();
  const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('Gemini analysis returned an empty response.');
  }

  return normalizeAiAnalysis(JSON.parse(content));
}

async function analyzeCvWithAi(cvText) {
  if (OPENAI_API_KEY) {
    return analyzeCvWithOpenAi(cvText);
  }

  if (GEMINI_API_KEY) {
    return analyzeCvWithGemini(cvText);
  }

  throw new Error('Missing AI API key. Set OPENAI_API_KEY or GEMINI_API_KEY.');
}

/**
 * HW3 decision rules.
 * Validation always wins, then fit_score selects the next recruitment stage.
 */
function applyDecisionRules(validationStatus, fitScore) {
  if (validationStatus === 'Invalid') {
    return 'Reject';
  }

  if (fitScore >= 75) {
    return 'Interview';
  }

  if (fitScore >= 50) {
    return 'Screen';
  }

  return 'Reject';
}

function buildStoredRecord(processedData, validationResult, aiAnalysis) {
  const nextStage = applyDecisionRules(validationResult.validation_status, aiAnalysis.fit_score);

  return {
    timestamp: processedData.timestamp,
    applicant_name: processedData.applicant_name,
    email: processedData.email,
    cv_text: processedData.cv_text,
    validation_status: validationResult.validation_status,
    validation_errors: validationResult.validation_errors,
    recommended_department: aiAnalysis.recommended_department,
    skills: aiAnalysis.skills,
    seniority_level: aiAnalysis.seniority_level,
    fit_score: aiAnalysis.fit_score,
    reasoning: aiAnalysis.reasoning,
    next_stage: nextStage
  };
}

function toSheetRow(record) {
  return [
    record.timestamp,
    record.applicant_name,
    record.email,
    record.cv_text,
    record.validation_status,
    record.validation_errors.join('; '),
    record.recommended_department,
    record.skills.join(', '),
    record.seniority_level,
    record.fit_score,
    record.reasoning,
    record.next_stage
  ];
}

/**
 * HW2 Trigger step
 * An HTTP POST endpoint that acts as a webhook, now upgraded for HW3.
 */
app.post('/webhook/apply', async (req, res) => {
  try {
    const payload = req.body || {};
    const payloadKeys = Object.keys(payload);
    const hasOnlySupportedKeys = payloadKeys.every((key) => ALLOWED_PAYLOAD_KEYS.includes(key));

    if (!hasOnlySupportedKeys) {
      return res.status(400).json({
        success: false,
        error: 'Payload may only contain these fields: name, email, message'
      });
    }

    const processedData = processApplicationData(payload);
    const validationResult = validateApplicationData(processedData);
    let aiAnalysis = { ...DEFAULT_ANALYSIS };

    if (validationResult.validation_status === 'Valid') {
      aiAnalysis = await analyzeCvWithAi(processedData.cv_text);
    }

    const record = buildStoredRecord(processedData, validationResult, aiAnalysis);

    const storedInSheets = await appendApplicationRow({
      spreadsheetId: SPREADSHEET_ID,
      rowData: toSheetRow(record)
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
      message: 'Application processed and stored successfully.',
      record
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
  console.log('[ HW3 ] Server is running!');
  console.log(`[ HW3 ] Webhook endpoint is POST http://localhost:${PORT}/webhook/apply`);
});
