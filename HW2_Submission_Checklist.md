# HW2 Submission Checklist

Use this file before final upload.

## 1) GitHub Repo
- [ ] `server.js` is HW2-compliant (`name`, `email`, `message` only)
- [ ] `connectors/antigravitySheetsConnector.js` exists
- [ ] `README.md` explains setup + test
- [ ] `sample-payload.json` matches exact contract
- [ ] Push latest code to GitHub

## 2) Word Report
- [ ] Explain how requirements are satisfied
- [ ] Include workflow architecture:
  - HTTP POST -> Connector -> Google Sheets
- [ ] Include one full test case (request + response + stored row)
- [ ] Include screenshot proof from Google Sheets

## 3) Mandatory Test Run
- [ ] Run:
  ```bash
  curl -X POST http://localhost:3000/webhook/apply \
    -H "Content-Type: application/json" \
    -d @sample-payload.json
  ```
- [ ] Verify response has:
  - `success: true`
  - `stored_in_sheets: true`
- [ ] Verify Google Sheets received a new row

## 4) Sheet Validation
- [ ] Columns are exactly:
  - `timestamp | name | email | message | storage_status`
- [ ] No formatting corruption
- [ ] Every successful request creates a separate row
