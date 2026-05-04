# Pulse Survey Studio

Pulse Survey Studio is a survey platform prototype built with React, Vite, TypeScript, Firebase Authentication, and Firestore.

The current online version is designed for GitHub Pages:

- React + Vite + TypeScript frontend
- Firebase Authentication for admin login
- Firestore for surveys, responses, analytics, and live word clouds
- QR codes generated in the browser
- JSON and CSV exports generated from Firestore data

The FastAPI + SQLite backend remains in the repository for legacy local usage, but the deployed GitHub Pages frontend does not require `/api`.

## Online Admin User

Create this user manually in Firebase Authentication:

- email: `admin@survey.local`
- password: `admin1234!`

The login form still accepts `admin` as the username. The frontend maps it internally to `admin@survey.local`.

## Firebase Setup

In Firebase Console, enable:

- Authentication
- Email/Password provider
- Firestore Database
- Authorized domain: `costello1.github.io`

The frontend reads Firebase config from `frontend/.env.production`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Prototype Firestore rules are included in `firestore.rules`.

## GitHub Pages

The app is configured for this repository URL:

```text
https://costello1.github.io/survey_all/
```

Important frontend settings:

- `frontend/vite.config.ts` uses `base: '/survey_all/'`
- `frontend/src/main.tsx` uses `BrowserRouter basename={import.meta.env.BASE_URL}`
- `.github/workflows/deploy.yml` builds `frontend/` and publishes `frontend/dist`

Deploy after changes:

```powershell
cd C:\Users\Pietr\Desktop\github\survey
git add .
git commit -m "Update survey app"
git push
```

Then check:

```text
https://github.com/costello1/survey_all/actions
```

## Local Frontend

Install and run:

```powershell
cd C:\Users\Pietr\Desktop\github\survey\frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Main Product Flows

Admin workspace:

- log in at `/admin/login`
- create, edit, duplicate, archive, reactivate, and delete surveys
- share surveys with public URLs and QR codes
- download `survey.json`, `responses.json`, and `responses.csv`
- view live analytics
- open live word cloud and a public display view at `/word-cloud/{surveyId}`

Public participant flow:

- open a survey by public URL or QR code
- answer without registration
- submit from mobile or desktop
- see the final `Thank you` confirmation

## Firestore Data

Firestore stores:

- `surveys/{surveyId}` for survey metadata and questions
- `surveys/{surveyId}/responses/{responseId}` for submitted answers

The public word cloud display reads active survey responses to render cloud terms in real time. Deploy `firestore.rules` after changing this behavior.

Supported question types:

- `open_text`
- `single_choice`
- `multiple_choice`
- `single_word`

## Legacy Backend

The `backend/` folder still contains the original FastAPI + SQLite prototype. It is useful as historical/local reference, but the GitHub Pages app now uses Firebase instead of backend `/api` calls.
