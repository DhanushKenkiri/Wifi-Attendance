# Captive Portal Setup (Windows)

Use this guide to prepare a Windows host that exposes the captive portal over a local hotspot.

## 1. Hardware checklist
- Laptop or desktop with Windows 10/11
- Wi-Fi adapter supporting hosted network mode
- Administrative privileges
- Stable internet connection for the host machine

## 2. Pre-flight checks
- Update Wi-Fi and chipset drivers
- Disable conflicting hotspot solutions (e.g., third-party sharing tools)
- Ensure PowerShell execution policy allows running signed scripts:
  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

## 3. Project installation
```powershell
cd captive-portal
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 4. Configure the data source
- Edit `config/network_settings.json` and set `data_source` to either `firebase` (default) or `sqlite`.

### Firebase
- Place the service account JSON inside `config/firebase_config.json`.
- Verify `databaseURL` within the JSON points to the correct region.

### SQLite fallback
- Set `data_source` to `sqlite` and a `sqlite.db_path` (defaults to `data/portal.db`). The path is resolved relative to `captive-portal/` unless you provide an absolute path.
- Optional: set `sqlite.seed_demo_data` to `true` to populate a sample code (`123456`) and student (`22mc123@uohyd.ac.in`) for quick smoke tests.
- Before production use, populate the `attendance_codes` and `students` tables with your real data using the `sqlite3` CLI or a GUI tool such as "DB Browser for SQLite".

## 5. Adjust network settings
- Edit `config/network_settings.json`:
  - `host`: LAN IP assigned to the hotspot interface.
  - `port`: Use 80 for full captive behaviour (requires elevated port binding) or 8080 for testing.
  - `debug`: Disable in production.
  - `session.flask_secret_key`: Replace with a secure random value (64 hex chars).
  - `firewall.rule_prefix`: Prefix applied to generated firewall rules per student/IP.

## 6. Start hotspot and firewall rules
```powershell
powershell -ExecutionPolicy Bypass -File setup_network.ps1
```
Review and adapt the script before running in production. The script now:
- Opens UDP/TCP port 53 for the embedded DNS redirector (controlled via `captive_dns` in `config/network_settings.json`).
- Reads the `allowed_domains` list to build outbound allow rules.
- Provides a quick summary of the hotspot SSID, password, and landing page (`http://<portal_ip>/verify`).

Enable `captive_dns.enabled` and adjust `portal_ip` if your hotspot is not using the default `192.168.137.1`. With DNS rerouting enabled, clients immediately receive the login page when they join your Wi-Fi network.

## 7. Run the portal
```powershell
python app.py
```
Access the portal at `http://192.168.137.1:8080` (or your configured host/port). Test the flow using a mobile device connected to the hotspot.

## 8. Troubleshooting
- **Portal not reachable**: Confirm the device received the correct gateway/DNS (try `ipconfig /all`).
- **Code verification fails**: Verify the Firebase service account has `Editor` or granular DB permissions.
- **Firewall not releasing clients**: Run PowerShell as Administrator and check for existing rules using `Get-NetFirewallRule`.
- **SSL warnings**: Consider running the Flask app behind an HTTPS reverse proxy (e.g., Caddy or Nginx with a self-signed cert installed on client devices).

## 9. Maintenance
- Rotate service account keys regularly.
- Clear stale attendance codes in Firebase after each session.
- Periodically run `netsh wlan stop hostednetwork` followed by `start` to refresh the hotspot.
- Review Windows firewall rules and remove unused entries to prevent rule sprawl.
