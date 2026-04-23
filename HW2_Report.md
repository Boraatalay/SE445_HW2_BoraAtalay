# Prompt Engineering HW2 Report

## 1) How the solution meets HW2 requirements

The existing HW1 webhook project was upgraded directly instead of rebuilt.  
The endpoint remains webhook-based (`POST /webhook/apply`) and now enforces an exact payload contract with only `name`, `email`, and `message`.  
Each successful request is appended as a new row in Google Sheets through the connector module (`connectors/antigravitySheetsConnector.js`) without overwriting prior rows.

## 2) Workflow structure

The final HW2 workflow is:

**HTTP POST Request ({name, email, message}) -> Antigravity Connector -> Google Sheets**

Processing is intentionally minimal:
- trim `name`
- trim + lowercase `email`
- trim `message`
- add `timestamp` in ISO format

After processing, one row is appended with:
`timestamp | name | email | message | storage_status`

## 3) Demonstrated test case

Example request body:

```json
{
  "name": "  Jane Doe  ",
  "email": "JANE.DOE@EXAMPLE.COM ",
  "message": " Data analyst with 4 years experience in Python and SQL. "
}
```

Expected stored row:
- `timestamp`: generated at runtime
- `name`: `Jane Doe`
- `email`: `jane.doe@example.com`
- `message`: `Data analyst with 4 years experience in Python and SQL.`
- `storage_status`: `Success`

Expected API response:

```json
{
  "success": true,
  "stored_in_sheets": true,
  "message": "Application message received and stored successfully."
}
```
