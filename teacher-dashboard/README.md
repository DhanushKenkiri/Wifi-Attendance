# SEST Teacher Dashboard

React dashboard for university attendance orchestration backed by the local Flask + SQLite API.

## Features

- Email/password authentication against the Flask API (tokens stored in localStorage)
- Dark-first UI with Tailwind CSS and theme persistence
- Attendance code generator with live countdown and automatic expiry cleanup
- Timetable CRUD management powered by Headless UI modals
- Student management roster and manual attendance controls
- Attendance records filtering and CSV export

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file from `.env.example` and point `VITE_API_BASE_URL` to your running Flask captive-portal server (e.g. `http://127.0.0.1:8080`). Make sure the backend is running with `data_source` set to `sqlite`.

## Build & Deploy

```bash
npm run build
```

## Tech Stack

React 18, Vite, Tailwind CSS 3, Headless UI, lucide-react, date-fns, file-saver.
