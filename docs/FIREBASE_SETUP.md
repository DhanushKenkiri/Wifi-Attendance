# Firebase Setup

Follow this checklist to configure Firebase services for both the web application and captive portal.

## 1. Create a Firebase project
- Visit [Firebase Console](https://console.firebase.google.com/).
- Create a new project (or reuse an existing project) named `student-attendance`.
- Disable Google Analytics unless required.

## 2. Enable Authentication
- Navigate to **Build → Authentication**.
- Click **Get started**.
- Add **Email/Password** as a sign-in provider.
- (Optional) Configure password strength requirements and email templates.

## 3. Realtime Database
- Go to **Build → Realtime Database**.
- Create a database in the region closest to your classroom (asia-southeast1 recommended).
- Start in **Locked mode**.
- Add the following rules as a baseline (adjust for production):

```json
{
  "rules": {
    "attendance_codes": {
      ".read": true,
      ".write": "auth != null"
    },
    "students": {
      "$studentId": {
        ".read": true,
        ".write": false
      }
    },
    "attendance": {
      "$classId": {
        ".read": "auth != null",
        "$studentId": {
          ".write": "!data.exists() || data.child('date').val() != newData.child('date').val()"
        }
      }
    }
  }
}
```

> Update the rules with stricter constraints before production (e.g., limit reads to authenticated roles, enforce server timestamps).

## 4. Service account for captive portal
- Open **Project settings → Service accounts**.
- Generate a **Firebase Admin SDK** key (JSON).
- Save the file as `captive-portal/config/firebase_config.json`.
- Remove the key from source control and rotate it periodically.

## 5. Web app configuration
- Under **Project settings → Your apps**, add a new Web app if not already created.
- Copy the SDK snippet values to `web-app/.env` (matching keys `VITE_FIREBASE_*`).

## 6. Sample data structure

```json
{
  "attendance_codes": {
    "class-2024-11-13": {
      "code": "123456",
      "subject": "Data Structures",
      "teacherName": "Dr. Rao",
      "expiryTime": 1731498600000,
      "department": "CSE"
    }
  },
  "students": {
    "22mc123": {
      "name": "Asha Varma",
      "email": "22mc123@uohyd.ac.in",
      "department": "CSE",
      "batch": "2022",
      "password": "plaintext-or-hash"
    }
  }
}
```

## 7. Hardening recommendations
- Hash passwords using bcrypt or Firebase Authentication custom claims instead of storing plain text values.
- Store attendance code metadata (start time, duration, classroom) to simplify audits.
- Enable Cloud Logging / Monitoring to capture API usage and suspicious activity.
- Set up IAM policies restricting who can manage service account keys.
