# Intelligent Recruitment Processing Workflow (HW3)

This project extends the existing HW2 webhook and Google Sheets workflow instead of rebuilding it from scratch.

HW2 stored normalized application data from:

`HTTP POST ({name, email, message}) -> Antigravity Connector -> Google Sheets`

HW3 keeps the same endpoint and payload fields, but treats `message` as the CV text and adds validation, AI analysis, decision rules, and richer persistence:

`Input applicant data / CV text -> Validation -> AI analysis -> Store full record with metadata`

## Workflow Structure

1. Receive a `POST` request at `/webhook/apply`.
2. Normalize existing fields:
   - `name` -> `applicant_name`
   - `email` -> lowercase email
   - `message` -> `cv_text`
3. Validate before AI processing.
4. Skip AI analysis for clearly invalid records.
5. Ask AI to return structured JSON for valid CVs.
6. Apply deterministic `next_stage` rules.
7. Store the complete record in Google Sheets.

## Expected Input

The endpoint still accepts the HW2 fields:

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "message": "Data analyst with 4 years of experience using Python, SQL, dashboards, and stakeholder reporting."
}
```

Only `name`, `email`, and `message` are supported. Missing or blank supported fields are saved as invalid records instead of being discarded.

## Validation Rules

Validation happens before AI analysis:

- CV text (`message`) must exist.
- CV text must be at least 40 characters long.
- Applicant name must exist.
- Email must exist.
- Email format must be valid.

Invalid input is still stored with:

- `validation_status = Invalid`
- populated `validation_errors`
- `next_stage = Reject`

## AI Prompt Strategy

For valid records, the system prompts the model to analyze only the provided CV and return JSON only.

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

The prompt explicitly says:

- Use only information found in the CV.
- Do not invent experience.
- If information is missing, use `"Unknown"`.
- Keep reasoning short.
- Return JSON only, with no markdown.

## Decision Rules

After validation and AI analysis, the system assigns `next_stage`:

- Invalid records: `Reject`
- `fit_score >= 75`: `Interview`
- `fit_score` from `50` to `74`: `Screen`
- `fit_score < 50`: `Reject`

## Google Sheet Columns

Create these headers in row 1:

`timestamp` | `applicant_name` | `email` | `cv_text` | `validation_status` | `validation_errors` | `recommended_department` | `skills` | `seniority_level` | `fit_score` | `reasoning` | `next_stage`

## Setup

### 1) Install

```bash
npm install
```

### 2) Environment variables

Set these values in `.env`:

```bash
PORT=3000
GOOGLE_SHEET_ID=your_google_sheet_id_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

The AI step supports either Gemini or OpenAI. If `OPENAI_API_KEY` is present, OpenAI is used. Otherwise, the system uses `GEMINI_API_KEY`.

### 3) Google Sheets credentials

Place `credentials.json` in the project root and share the target Google Sheet with the service account `client_email`.

## Run

```bash
npm start
```

Endpoint:

- `POST http://localhost:3000/webhook/apply`

## Test Cases

### Test case 1: Valid CV

```bash
curl -X POST http://localhost:3000/webhook/apply \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "message": "Data analyst with 4 years of experience using Python, SQL, dashboards, data visualization, and stakeholder reporting."
  }'
```

Expected result:

- `validation_status = Valid`
- `skills` extracted
- `recommended_department` assigned
- `seniority_level` assigned
- `fit_score` generated
- `next_stage` selected from the score
- record saved in Google Sheets

### Test case 2: Invalid CV

```bash
curl -X POST http://localhost:3000/webhook/apply \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "bad-email",
    "message": ""
  }'
```

Expected result:

- `validation_status = Invalid`
- `validation_errors` populated
- AI analysis skipped
- `next_stage = Reject`
- record still saved in Google Sheets

## Response Shape

Successful processing returns the stored record:

```json
{
  "success": true,
  "stored_in_sheets": true,
  "message": "Application processed and stored successfully.",
  "record": {
    "timestamp": "2026-05-05T12:00:00.000Z",
    "applicant_name": "Jane Doe",
    "email": "jane.doe@example.com",
    "cv_text": "Data analyst with 4 years...",
    "validation_status": "Valid",
    "validation_errors": [],
    "recommended_department": "Data Analytics",
    "skills": ["Python", "SQL"],
    "seniority_level": "Mid",
    "fit_score": 82,
    "reasoning": "Strong match for analytics work.",
    "next_stage": "Interview"
  }
}
```
