# Wi‑Fi Attendance & Captive Portal — Detailed README

This repository contains the full-stack Wi‑Fi captive portal and attendance platform used to run short on‑prem sessions where network access is gated until a student authenticates and their attendance is recorded. It supports a local SQLite mode (recommended for offline hotspots) and a Firebase mode for cloud sync.

This README expands setup, architecture, data-flow diagrams, operational runbooks, performance guidance and privacy/ethics guidance for the face-capture feature.

--

## Quick Links

- Captive portal: `captive-portal/`
- Teacher dashboard: `teacher-dashboard/`
- Student web app (PWA): `web-app/`
- Docs: `docs/`

## What’s new in this repo

- Face-capture verification on the captive portal (optional): captures a photo during login, detects faces server-side, and stores a reference in SQLite.
- Performance improvements: compression, longer static caching, and reduced template reloading to improve captive popup responsiveness on mobile devices.

## High-level architecture

Inline component diagram (simplified):

<svg width="900" height="320" viewBox="0 0 900 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style> .box{fill:#fff;stroke:#cbd5e1;stroke-width:1.5;rx:10;}.title{font:700 14px/1.2 sans-serif;fill:#0f172a}.label{font:400 12px/1.2 sans-serif;fill:#334155}</style>
  </defs>
  <rect x="24" y="24" width="220" height="80" class="box" rx="8"/>
  <text x="36" y="46" class="title">Clients (phones/laptops)</text>
  <text x="36" y="66" class="label">Wi‑Fi users visiting a URL</text>

  <rect x="300" y="18" width="240" height="116" class="box" rx="8"/>
  <text x="312" y="40" class="title">Captive Portal (Flask)</text>
  <text x="312" y="62" class="label">/verify, /login, /mark-attendance, /api/face-capture</text>

  <rect x="580" y="24" width="280" height="120" class="box" rx="8"/>
  <text x="592" y="46" class="title">Local Services</text>
  <text x="592" y="66" class="label">SQLite DB (`data/portal.db`)</text>
  <text x="592" y="84" class="label">Face images: `data/faces/`</text>

  <line x1="244" y1="64" x2="300" y2="64" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="540" y1="64" x2="580" y2="64" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arrow)"/>

  <defs>
    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/>
    </marker>
  </defs>

  <rect x="300" y="150" width="240" height="120" class="box" rx="8"/>
  <text x="312" y="172" class="title">Optional Cloud</text>
  <text x="312" y="192" class="label">Firebase (cloud sync, user store)</text>

  <line x1="420" y1="134" x2="420" y2="150" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>

## Sequence flow (student check-in)

Inline sequence diagram for the student check-in flow:

<svg width="900" height="220" viewBox="0 0 900 220" xmlns="http://www.w3.org/2000/svg">
  <style> text{font:12px sans-serif;fill:#0f172a} .lane{stroke:#e2e8f0;stroke-width:1} .box{fill:#fff;stroke:#cbd5e1;stroke-width:1.2}</style>
  <text x="40" y="28">Client</text>
  <text x="300" y="28">Captive Portal</text>
  <text x="620" y="28">Local DB/Face Store</text>

  <line x1="80" y1="40" x2="300" y2="40" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow2)"/>
  <text x="180" y="56">HTTP request -> redirected to /verify</text>

  <line x1="300" y1="80" x2="300" y2="120" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arrow2)"/>
  <text x="312" y="100">User enters code -> /verify (POST)</text>

  <line x1="300" y1="140" x2="620" y2="140" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow2)"/>
  <text x="420" y="156">Server verifies & stores code/session</text>

  <line x1="80" y1="100" x2="300" y2="100" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arrow2)"/>
  <text x="120" y="116">Client shows login + face capture UI</text>

  <defs>
    <marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8"/>
    </marker>
  </defs>
</svg>

## Setup & Quick Start (concise)

1. Open PowerShell as Administrator on the host machine.
2. Initialize the captive portal virtualenv and install Python deps:

```powershell
cd "student-attendance-app\captive-portal"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

3. Configure `config/network_settings.json` for your environment:
- `port`: 80 (recommended for captive popups) or 8080 with `netsh interface portproxy` to forward 80→8080.
- `data_source`: `sqlite` for offline hotspots, `firebase` to use cloud backend.
- `face_capture.enabled`: `true` to enable face capture flow (see privacy section).

4. Start the network helper (creates hotspot + DNS redirect if used):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_network.ps1
```

5. Start the portal:

```powershell
python app.py
```

6. Launch the dashboard and student web app if desired (see folder READMEs).

## Face-capture feature — overview and important notes

- The portal can optionally capture a photo during login and run a lightweight face detector (OpenCV Haar cascade) server-side to ensure a face is present. The image is saved locally under `captive-portal/data/faces/` and a small metadata row is stored in SQLite.
- This feature is implemented to reduce fraudulent check-ins but is strictly optional. It is controlled by `config/network_settings.json` and must be enabled deliberately.

Privacy & legal guidance (read before enabling):

- Obtain explicit consent from users and publish a short privacy notice at the portal login page whenever face capture is enabled.
- Retain images only as long as necessary; configure retention in `network_settings.json` and implement periodic cleanup (not included by default).
- Prefer face-detection-only (presence check) rather than face recognition/identification unless your institution has legal approval.
- Implement secure filesystem permissions for `data/faces` and consider encrypting disks or using encrypted containers.

## Performance tuning & mobile UX recommendations

1. Serve the portal on port 80 to trigger captive OS detection automatically.
2. Use `Flask-Compress` (already in `requirements.txt`) and ensure `brotli` is installed for best compression on modern browsers.
3. Increase `SEND_FILE_MAX_AGE_DEFAULT` in `app.py` for immutable static assets (CSS/JS) — we defaulted to 24h in code.
4. Defer non-critical scripts and inline only the small JS that triggers the captive popup. The portal already includes `defer` on `main.js`.
5. Minify and pre-build the frontend bundle for the captive pages; keep the captive portal HTML/CSS minimal and avoid large external fonts.
6. If many clients land simultaneously, run the portal behind a small reverse-proxy (Caddy/Nginx) to better handle connections and enable TLS offloading.

Commands for a quick profiling pass:

```powershell
# From captive-portal directory
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
python -m py_compile app.py utils/*.py
# Start portal and monitor logs. Measure static asset sizes under static/ and reduce them if large.
```

## Testing & verification

- Manual: connect a phone to the hotspot and verify the captive popup appears within 10 seconds; confirm face capture flow is requested and that `data/faces/` receives a saved file after a successful capture.
- Unit: run `python -m py_compile` on changed modules. SQLite schema migration is performed on first connect.
- Integration: exercise the whole flow (verify → login with face capture → mark-attendance → success) and inspect `data/portal.db` for attendance rows with `face_capture_id`.

## Troubleshooting guide (concise)

- No captive popup: try forwarding port 80 to your app port or run the app on 80. Confirm there is no local firewall blocking inbound connections.
- Camera access denied: most mobile browsers require a secure context (HTTPS) for camera; captive portals are an exception for many platforms, but behavior varies. Use the browser UI to allow camera.
- Face detector failing: ensure `opencv-python` is installed in the portal venv and that `haarcascade_frontalface_default.xml` is available (OpenCV includes it in its package data).

## Data retention & cleanup (recommended)

- Implement a cron/Task Scheduler script to remove `data/faces/` older than the retention window and delete corresponding `face_captures` rows. Example (PowerShell):

```powershell
Get-ChildItem -Path .\captive-portal\data\faces -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
```

## Security & operational checklist before production

1. Audit `network_settings.json` and disable `captive_dns` unless you require DNS interception.
2. Rotate secrets and use a secure secret store for production deployments.
3. Disable debug logging and configure structured logs for collection.
4. Place the portal behind a reverse proxy if expecting scale or to add TLS.

## Contributing

- Keep changes scoped to the relevant folder and provide unit tests for backend behavior where possible.
- For anything that touches DNS, firewall or face-capture, include a security rationale and a rollback plan.

--

If you want, I can also:

- Add a small PowerShell task to periodically prune old face images and rows.
- Generate a printable one-page runbook for IT teams that operate the hotspot.
- Add an example privacy notice HTML partial that you can enable when `face_capture.enabled` is true.

Tell me which of the above you'd like next and I’ll apply it.
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
