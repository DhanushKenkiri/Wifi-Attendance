# Student Attendance Web App

A mobile-first React application for recording student attendance in cloud and captive portal environments. Built with Vite, Tailwind CSS, and Firebase.

## Features
- 6-digit teacher code verification with Realtime Database.
- Email/password authentication through Firebase Auth.
- Attendance recording with duplicate protection and portal awareness.
- Responsive UI with light/dark theme toggle and confetti success state.
- Countdown timers showing remaining validity of attendance codes.

## Prerequisites
- Node.js 18+
- Firebase project with Authentication and Realtime Database enabled

## Environment Variables
Copy `.env.example` to `.env` and populate with Firebase credentials.

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g., `your-project.firebaseapp.com`) |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database URL |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket URL |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Firebase Deployment

```bash
npm run deploy
```

Ensure you have the Firebase CLI configured with hosting targets before deploying.

## Placeholder Assets
- Replace `public/favicon.ico` with a production-ready icon before launch.

## Testing Checklist
- Code verification success and failure states
- Authentication flow (valid/invalid credentials)
- Attendance creation and duplicate prevention
- Success screen auto-redirect and confetti animation
- Mobile responsiveness for all screens
- Dark/light theme behaviour
