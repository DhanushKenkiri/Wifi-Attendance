# Captive Portal Server

Flask-based captive portal that runs on a Windows hotspot and synchronises attendance with Firebase Realtime Database.

## Features
- 6-digit attendance code verification via Firebase Admin SDK
- Student authentication using Realtime Database records
- Attendance recording with duplicate prevention per day
- Automatic Windows firewall rule management to release internet access
- REST API endpoints consumed by lightweight vanilla JS pages

## Prerequisites
- Windows 10/11 host with administrative privileges
- Python 3.11+
- Firebase project with Realtime Database and service account credentials
- Wi-Fi adapter that supports hosted network (mobile hotspot)

## Setup

```powershell
# 1. Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Provide Firebase credentials
#    Download a service account JSON and place it at config/firebase_config.json
#    Ensure databaseURL inside the file points to your Realtime Database instance.

# 4. Review network settings
notepad config\network_settings.json
```

Update `network_settings.json` with your hotspot IP, port and desired session parameters. Replace `flask_secret_key` with a random 64-character hex string before production use.

## Running the Portal

```powershell
# Optional: configure hotspot and firewall
powershell -ExecutionPolicy Bypass -File setup_network.ps1

# Start the portal
python app.py
```

The portal defaults to `http://192.168.137.1:8080`. Adjust the host/port inside `config/network_settings.json` if needed.

## Automatic DNS Rerouting
- Set `captive_dns.enabled` to `true` in `config/network_settings.json` to start the built-in DNS redirector. Update `portal_ip` if your hotspot gateway differs from `192.168.137.1`.
- Run `setup_network.ps1` so Windows opens UDP/TCP port 53 for the redirector. The script now also respects the `allowed_domains` list for outbound firewall exceptions.
- The redirector forces all DNS lookups (except the `bypass_domains` allowlist) to resolve to the portal IP and includes special handling for OS connectivity checks (`/generate_204`, `/hotspot-detect.html`, etc.), which makes Android, iOS, macOS and Windows automatically display the login screen once Wi-Fi connects.
- Extend `captive_dns.force_portal_domains` for additional probe hostnames or `captive_dns.bypass_domains` when you need raw internet access (e.g., to reach extra identity providers) before attendance is marked.

## API Overview
- `POST /verify` — verify 6 digit code
- `POST /login` — authenticate student credentials
- `POST /mark-attendance` — record attendance and unlock firewall
- `GET /api/client-ip` — helper endpoint used by the React app when running in portal mode
- `POST /api/grant-access` — external trigger to unlock firewall rules

## Security Notes
- Store only hashed passwords in Firebase (e.g. bcrypt). Update `login` route to compare hashed values before production.
- Rotate `flask_secret_key` regularly and keep it private.
- Restrict the service account privileges to the minimum required paths.
- Review firewall scripts before running on production hosts.
