# SE445 HW3 Report - Intelligent Recruitment Processing Workflow

## 1. Project Overview

This HW3 project extends my previous HW2 recruitment intake workflow. In HW2, the system accepted applicant data through an HTTP POST endpoint and stored the raw fields in Google Sheets. In HW3, the same workflow was improved with validation, AI analysis, structured output, decision rules, and richer data persistence.

The topic of the project is a Recruitment Pipeline Tracker. The system receives applicant information and CV text, checks whether the input is valid, analyzes valid CVs with AI, assigns recruitment metadata, and stores the complete result in Google Sheets.

## 2. How HW3 Builds on HW2

The HW2 structure was kept as much as possible. The existing endpoint `/webhook/apply` was preserved, and the original payload format `{name, email, message}` is still used.

The main difference is that the `message` field is now treated as the applicant's CV text. Instead of only saving the original applicant data, the HW3 version validates the input, performs AI-based CV analysis, applies recruitment stage rules, and saves both the original input and generated metadata.

## 3. Workflow Architecture

The HW3 workflow follows this structure:

`Input applicant data / CV text -> Validation -> AI Analysis -> Decision Rules -> Google Sheets Storage`

The workflow steps are:

1. Trigger: An Express HTTP POST endpoint receives requests at `/webhook/apply`.
2. Processing: The system normalizes name, email, and CV text.
3. Validation: The system checks whether the applicant data is complete and correctly formatted.
4. AI Analysis: Valid CVs are analyzed by an AI model and converted into structured JSON.
5. Decision Rules: The system assigns the next recruitment stage based on validation status and fit score.
6. Persistence: The complete record is appended to Google Sheets.

## 4. Main Files and Their Purposes

### `server.js`

This is the main Express server. It contains the webhook endpoint, input normalization, validation logic, AI prompt and API calls, decision rules, and record-building logic.

### `connectors/antigravitySheetsConnector.js`

This file contains the Google Sheets connector. It appends processed applicant records to the first sheet in the configured spreadsheet.

### `README.md`

This file documents the setup steps, workflow explanation, validation rules, AI prompt strategy, expected input and output, Google Sheet columns, and test cases.

### `.env.example`

This file shows the required environment variables such as `PORT`, `GOOGLE_SHEET_ID`, `GEMINI_API_KEY`, and `GEMINI_MODEL`.

### `package.json`

This file defines the Node.js project dependencies and the start command.

## 5. Validation Rules

The system validates input before AI processing. The validation rules are:

- Applicant name must exist.
- Email must exist.
- Email format must be valid.
- CV text must exist.
- CV text must be long enough to be meaningful, at least 40 characters.

Invalid records are not discarded. They are still saved to Google Sheets with:

- `validation_status = Invalid`
- `validation_errors` populated
- `next_stage = Reject`

This satisfies the HW3 requirement that bad data should be marked instead of deleted.

## 6. AI Prompt Strategy

For valid records, the system asks the AI model to analyze only the provided CV text and return valid JSON only. The prompt clearly tells the AI:

- Use only information found in the CV.
- Do not invent experience.
- If information is missing, use `Unknown`.
- Keep reasoning short.
- Return JSON only, with no markdown.

The required AI JSON shape is:

```json
{
  "recommended_department": "string",
  "skills": ["string"],
  "seniority_level": "Intern | Junior | Mid | Senior | Unknown",
  "fit_score": 0,
  "reasoning": "string"
}
```

The implementation supports Gemini through `GEMINI_API_KEY`. It can also use OpenAI if `OPENAI_API_KEY` is provided.

## 7. Decision Rules

After validation and AI analysis, the system assigns `next_stage` using deterministic rules:

- If validation status is `Invalid`, `next_stage` is `Reject`.
- If `fit_score` is 75 or higher, `next_stage` is `Interview`.
- If `fit_score` is between 50 and 74, `next_stage` is `Screen`.
- If `fit_score` is below 50, `next_stage` is `Reject`.

This makes the final recruitment decision consistent and easy to explain during a live demo.

## 8. Data Schema / Google Sheet Columns

Each stored record includes both original input and metadata. The Google Sheet columns are:

- `timestamp`
- `applicant_name`
- `email`
- `cv_text`
- `validation_status`
- `validation_errors`
- `recommended_department`
- `skills`
- `seniority_level`
- `fit_score`
- `reasoning`
- `next_stage`

This satisfies the HW3 requirement to store the full record with metadata.

## 9. Test Cases

### Test Case 1: Valid CV

Input:

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "message": "Data analyst with 4 years of experience using Python, SQL, dashboards, data visualization, Excel, reporting, and stakeholder communication."
}
```

Expected result:

- `validation_status = Valid`
- skills are extracted
- recommended department is assigned
- seniority level is assigned
- fit score is generated
- next stage is selected based on the fit score
- record is saved to Google Sheets

During testing, the valid AI call reached Gemini correctly, but Gemini returned a quota error: `429 RESOURCE_EXHAUSTED`. This means the workflow reached the AI service, but the API quota was unavailable. The AI integration and logic are implemented, but a working API quota is needed for a full live valid-AI demonstration.

### Test Case 2: Invalid CV

Input:

```json
{
  "name": "",
  "email": "bad-email",
  "message": ""
}
```

Actual and expected result:

- `validation_status = Invalid`
- `validation_errors` populated
- AI analysis skipped
- `recommended_department = Unknown`
- `skills = []`
- `seniority_level = Unknown`
- `fit_score = 0`
- `next_stage = Reject`
- record successfully saved to Google Sheets

## 10. HW3 Requirement Mapping

| Requirement | How It Is Satisfied |
| --- | --- |
| Input applicant data | `/webhook/apply` accepts `{name, email, message}` |
| Validation | Implemented in `validateApplicationData` |
| Invalid data stored | Invalid records are saved with validation errors and `Reject` status |
| AI analysis | Implemented through Gemini/OpenAI-compatible AI analysis functions |
| Structured output | AI output includes department, skills, seniority, fit score, and reasoning |
| Decision rules | Implemented in `applyDecisionRules` |
| Data persistence | Full records are stored through the Google Sheets connector |
| Documentation | README and this report explain workflow, prompt, validation, schema, and tests |

## 11. Conclusion

HW3 upgrades the HW2 system from simple data persistence into an intelligent recruitment workflow. The system now validates applicant data, enriches valid CVs with AI-generated recruitment metadata, applies deterministic recruitment stage rules, and stores the full result in Google Sheets.
