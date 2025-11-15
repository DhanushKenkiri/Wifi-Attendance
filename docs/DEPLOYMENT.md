# Deployment Guide

This document covers the two supported deployment targets for the Student Attendance platform.

---

## Firebase Hosting (Cloud Mode)

1. **Install dependencies**
   ```bash
   cd web-app
   npm install
   ```
2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Populate Firebase values in .env
   ```
3. **Smoke test locally**
   ```bash
   npm run dev
   ```
4. **Build and deploy**
   ```bash
   npm run build
   firebase deploy
   ```
   Ensure the Firebase CLI is logged in and the project/hosting target has been configured (use `firebase init hosting`).

### CI/CD Suggestions
- Add `npm run lint` and `npm run build` to your pipeline.
- Cache `~/.npm` between runs to speed up builds.
- Configure preview channels with `firebase hosting:channel:deploy` for QA environments.

---

## Captive Portal (Local Hotspot Mode)

1. **Prepare Windows host**
   - Update network drivers and ensure the Wi-Fi adapter supports hosted networks.
   - Run PowerShell as Administrator for setup tasks.

2. **Clone and install**
   ```powershell
   cd captive-portal
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. **Provide configuration**
   - Copy Firebase service account JSON to `config/firebase_config.json`.
   - Edit `config/network_settings.json` to match your hotspot IP, port and security preferences.

4. **Configure hotspot + firewall (optional helper)**
   ```powershell
   powershell -ExecutionPolicy Bypass -File setup_network.ps1
   ```

5. **Run portal**
   ```powershell
   python app.py
   ```

6. **Test flow**
   - Connect a device to the hotspot SSID.
   - Browse to any HTTP site and confirm redirect to portal.
   - Walk through code verification, login, and attendance steps.

### Production Checklist
- Replace `flask_secret_key` in `network_settings.json` with a strong random string.
- Serve the portal over HTTPS using a trusted certificate (e.g., via stunnel or reverse proxy).
- Review firewall rules regularly and clear stale entries.
- Monitor Flask logs for suspicious activity (failed logins, repeated invalid codes).
