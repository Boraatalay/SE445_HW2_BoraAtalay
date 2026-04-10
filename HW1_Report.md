# Prompt Engineering HW1 Report

**Objective:**
To build a functional, beginner-friendly end-to-end automation project that fulfills the mandatory sequence of a Trigger, Logic processing, an External API Integration, and an AI-driven completion step. The goal is to learn how to string these individual system components together autonomously.

**Chosen Topic:**
**AI Candidate Assessor**
A lightweight backend application that acts as an enterprise webhook. As soon as a candidate applies for a fictional job, the system catches their data, performs lightweight sanitation, safely archives the raw resume in an external database (Google Sheets), and then prompts a large language model to perform a preliminary evaluation of their qualifications. 

**Workflow Architecture:**
1. **Trigger:** An HTTP POST Webhook built using Express JS (`/webhook/apply`) serving as the entrypoint. 
2. **Logic Step:** A processing JavaScript function that trims white spaces, normalizes applicant email characters, maps JSON inputs to a pre-defined array, and injects an ISO timestamp.
3. **Integration Step:** Utilizing the Google API client (`googleapis`) authenticated via a Service Account (`credentials.json`), the application makes an RPC call to push the raw candidate data into a Google Spreadsheet in a sequential log.
4. **AI Step:** Using the Google Generative AI SDK, the webhook fires a completion call to the `gemini-1.5-flash` model. It is statically prompted as an HR assistant to summarize the candidate's parsed `cv_text` and enforce exactly two categorical outputs: a `recommended_department` and a `fit_level`.

**Test Case:**
The test case simulates a Data Analyst applying to the company.
A dummy payload is structured passing through the name "Jane Doe", the role "Data Analyst", and a brief CV describing 4 years of experience in Python and Tableau.
Using a POST request to send this data into the webhook produces the following validated outcome:
1. The spreadsheet reflects a success log generated on processing.
2. The endpoint successfully replies with a status code 200 JSON object. The AI recognizes the tabular requirement and successfully returns:
   - `ai_summary`: "Jane Doe brings 4 years of experience utilizing SQL, Python, and Tableau for data-driven modeling."
   - `recommended_department`: "Data/AI"
   - `fit_level`: "High"

**How it satisfies the HW1 constraints:**
- The architecture is explicitly linear: Trigger -> Transformation -> Sheets -> AI without unnecessary layers.
- Avoids over-engineering: no databases, docker containers, or CRMs.
- Kept inside a monolithic readable node file (`server.js`).
- Business constraints are forced strictly (returns a locked array of departments and fit thresholds natively via systematic prompting).
