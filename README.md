# Wi-Fi Attendance & Captive Portal Platform

A full-stack cybersecurity-focused attendance solution that locks down Wi-Fi access until students authenticate via a captive portal, while faculty manage sessions through a dedicated dashboard and students can also check in via a cloud-ready web app.

> Inspired by the [Wifi-Attendance](https://github.com/DhanushKenkiri/Wifi-Attendance) initiative and extended with hardened network controls, DNS interception, and multi-surface UX.

## Repository Layout

| Folder | Purpose |
| --- | --- |
| `captive-portal/` | Flask service that powers the hotspot splash page, DNS-based redirection, local SQLite/Firebase data, and Windows firewall automation. |
| `teacher-dashboard/` | React+Vite dashboard for faculty to authenticate, create attendance codes, view records, and manage timetables. |
| `web-app/` | Student-facing React PWA with Firebase support for remote attendance outside the captive network. |
| `docs/` | Operational guides (captive portal setup, Firebase provisioning, deployment notes). |
| `start-local-stack.ps1` | Convenience launcher that boots hotspot, backend, and dashboards in separate terminals on Windows. |

## Platform Capabilities

- **Zero Internet Until Login**: DNS redirector + Windows firewall policies block all outbound traffic until the captive portal records a successful attendance entry.
- **Multi-Surface Attendance**: Native captive portal, teacher dashboard, and student PWA all share the same backend contract and code format.
- **Granular Session Control**: Auto-expiring 6-digit codes, duplicate prevention, per-device fingerprints, and IP-based firewall grants.
- **Rapid Onboarding**: Hotspot automation script configures Wi-Fi, DNS interception, and firewall allowlists in minutes on Windows 10/11 hosts.
- **Cloud Extensibility**: Switch between local SQLite and Firebase Realtime Database by editing `captive-portal/config/network_settings.json`.

## Cybersecurity Posture

### Network Containment
- **Captive DNS** (`utils/captive_dns.py`): Forces all hostnames (except allow-listed domains) to resolve to the portal IP and serves OS-specific captive probes (`/generate_204`, `/hotspot-detect.html`, `msftconnecttest.com`, etc.).
- **Firewall Automation** (`utils/firewall.py`): Default outbound action set to *Block*; only authenticated clients receive temporary egress rules tied to their IP + student ID.
- **Auto-Grant Controls**: Optional `captive_dns.auto_grant_on_connect` can trigger `/api/grant-access` when devices connect, easing UX for trusted networks while still logging every grant.

### Identity & Session Security
- Teacher JWT tokens generated via `itsdangerous` with configurable TTL and stored in `teacher-dashboard` local storage.
- Student logins support Firebase Auth or SQLite credentials; sessions stored server-side using Flask signed cookies with adjustable lifetime and secure flags.
- Attendance entries hashed with device fingerprints (IP + UA) to detect spoofing.

### Data Protection & Observability
- SQLite lives under `captive-portal/data/portal.db`; production deployments should move to encrypted volumes or managed databases.
- `docs/FIREBASE_SETUP.md` walks through least-privilege service accounts.
- `app.py` exposes `/api/health` for uptime checks and can be fronted by HTTPS reverse proxies (Caddy, Nginx) to add TLS and WAF layers.

### Hardening Checklist
1. Bind Flask to port 80/443 (or use `netsh interface portproxy`) so captive OS probes succeed instantly.
2. Rotate `session.flask_secret_key` and teacher credentials frequently.
3. Review firewall rules after each session: `Get-NetFirewallRule -DisplayName "UniNet*"`.
4. Enable Windows Defender Application Control or AppLocker to prevent rogue binaries on the hotspot host.
5. Mirror DNS query logs to a SIEM for anomaly detection.

## Quick Start

### Prerequisites
- Windows 10/11 host with admin rights and Wi-Fi adapter supporting "Hosted Network".
- Python 3.11+ and Node.js 18+.
- Firebase project (optional) if not using SQLite.

### Captive Portal
```powershell
cd "student-attendance-app\captive-portal"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
notepad config\network_settings.json
powershell -ExecutionPolicy Bypass -File setup_network.ps1
python app.py
```
Points of note:
- Set `host` to the hotspot gateway (default `192.168.137.1`) and `port` to 80 for automatic captive popups.
- Toggle `data_source` (`sqlite` vs `firebase`) and adjust credentials under `config/firebase_config.json` if needed.
- `setup_network.ps1` creates the hotspot SSID (`UniNet`), opens UDP/TCP 53 for captive DNS, and seeds firewall allow-rules for Firebase domains.

### Teacher Dashboard
```powershell
cd "student-attendance-app\teacher-dashboard"
npm install
cp .env.example .env
# update VITE_API_BASE_URL to the captive portal URL (e.g. http://192.168.137.1)
npm run dev
```

### Student Web App (Firebase mode)
```powershell
cd "student-attendance-app\web-app"
npm install
cp .env.example .env
# fill Firebase keys and Realtime Database URL
npm run dev
```

### Combined Launcher
```powershell
cd "student-attendance-app"
powershell -ExecutionPolicy Bypass -File .\start-local-stack.ps1
```
Flags like `-SkipHotspot`, `-SkipPortal`, or `-StartStudentWeb` tailor which services boot.

## Operational Flow

1. **Admin/IT** runs `setup_network.ps1`, bringing up the hotspot and DNS redirector.
2. **Teacher** logs into the dashboard, creates a 6-digit code, and broadcasts it to students.
3. **Student** connects to the Wi-Fi; captive DNS diverts their first HTTP request to `captive-portal`, prompting login + code entry.
4. **Portal** validates the student, records attendance, and calls `grant_internet_access`, unlocking outbound traffic for that IP.
5. **Monitoring**: Teachers review live attendance in the dashboard; IT can inspect logs, DNS queries, and firewall states for anomalies.

## Troubleshooting Checklist
- **No captive popup**: Ensure Flask is on port 80 or add `netsh interface portproxy` to forward 80→8080; confirm `captive_dns` service is running (`netstat -ano | findstr :53`).
- **DNS not resolving**: Re-run `setup_network.ps1` as Admin to reopen UDP/TCP 53.
- **Teacher auth fails**: Confirm `data_source` is `sqlite` and that teachers exist in `local_db.py` tables (seed demo data by setting `sqlite.seed_demo_data` to `true`).
- **Students still blocked post-login**: Check `NETWORK_CONFIG.firewall.rule_prefix` and verify new rules appear under Windows Firewall; delete stale rules if IPs recycled.

## Documentation & References
- `docs/CAPTIVE_PORTAL_SETUP.md`
- `docs/FIREBASE_SETUP.md`
- `docs/DEPLOYMENT.md`
- Origin inspiration: [Wifi-Attendance](https://github.com/DhanushKenkiri/Wifi-Attendance)

## Contributing
1. Fork or create a feature branch.
2. Keep edits isolated per folder (portal, dashboard, or web app) and run lint/test suites (`npm run lint`, `pytest`/`flask test` if applicable).
3. Open a PR describing security implications of your change (e.g., new network ports, auth flows, data collection).

Security reviews are mandatory for any change that touches DNS interception, firewall rules, or authentication layers.
