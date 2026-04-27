# Pulse Survey Studio

Pulse Survey Studio is a polished survey platform prototype built with:

- React + Vite + TypeScript on the frontend
- FastAPI + SQLite on the backend
- admin authentication powered by `.env`
- public survey access through share links and QR codes
- real-time analytics with Server-Sent Events
- live word cloud views for `single_word` and `multiple_choice` questions
- automatic JSON and CSV exports saved to disk and downloadable from the admin panel

## Prototype credentials

The admin credentials are loaded from the root `.env` file:

- username: `admin`
- password: `admin1234!`

The repository also includes `.env.example` with the same prototype variables.

## Project structure

- `frontend/` React application
- `backend/` FastAPI application
- `storage/surveys/` automatic survey export folders

## Quick start

Run the backend and frontend in two terminals.

Terminal 1, from the repository root:

```powershell
cd C:\Users\Pietr\Desktop\github\survey
.\backend\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd C:\Users\Pietr\Desktop\github\survey\frontend
npm run dev
```

Then open `http://localhost:5173`.

If the admin login page does not work, make sure the backend is running first. The Vite frontend proxies `/api` requests to `http://127.0.0.1:8000`.

## Backend setup

Create the virtual environment and install dependencies:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the API from the repository root:

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

If you launch `uvicorn` from inside the `backend` folder instead, use:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Frontend setup

Install dependencies and run the React app:

```powershell
cd frontend
npm install
npm run dev
```

The Vite development server runs on `http://localhost:5173`.

## Main product flows

### Admin workspace

- log in at `/admin/login`
- create surveys with `open_text`, `single_choice`, `multiple_choice`, and `single_word` questions
- edit survey metadata and edit questions until the first response arrives
- duplicate surveys to reuse a structure quickly
- archive or reactivate surveys to control public access
- delete surveys safely from the workspace
- open a share center page with:
  - public path
  - public URL
  - QR code
  - export downloads
- open live analytics and a dedicated word cloud admin page
- launch a separate projector view for real-time display on a second screen

### Public participant flow

- open the survey through the public URL or by scanning the QR code
- answer without registration or login
- submit the survey on mobile or desktop
- see the final `Thank you` confirmation screen

## Data storage and exports

- SQLite database file: `backend/survey.db`
- exported survey folders: `storage/surveys/<survey-slug>_<timestamp>/`

Each survey export folder contains:

- `survey.json`
- `responses.json`
- `responses.csv`

These files are created when a survey is created and refreshed automatically when new responses arrive.

The admin panel also exposes direct download actions for:

- `survey.json`
- `responses.json`
- `responses.csv`

## Real-time analytics

- survey analytics update live while responses arrive
- choice questions render visual result summaries
- open-text answers remain readable in list form
- word cloud pages support both:
  - `single_word` answers
  - `multiple_choice` selections
- projector mode is available on its own route for live presentation

## Notes

- This is a prototype application with simple token-based admin authentication.
- Admin credentials are intentionally environment-driven for the requested prototype workflow.
- Archived surveys are hidden from the public route until reactivated.
- `single_word` validation is enforced on both frontend and backend.
