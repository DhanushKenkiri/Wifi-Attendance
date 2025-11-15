"""Windows firewall helpers for captive portal access control."""

from __future__ import annotations

import platform
import subprocess
from typing import Optional


class FirewallError(RuntimeError):
    """Raised when a firewall command fails."""


def _windows_only() -> None:
    if platform.system() != "Windows":
        raise FirewallError("Firewall automation is only supported on Windows hosts.")


def _run_powershell(command: str) -> None:
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise FirewallError(completed.stderr.strip() or "Firewall command failed.")


def _rule_name(rule_prefix: str, student_id: str, ip_address: str) -> str:
    safe_ip = ip_address.replace(".", "_")
    safe_student = student_id.replace(" ", "_")
    return f"{rule_prefix}_{safe_student}_{safe_ip}"


def grant_internet_access(ip_address: str, student_id: str, rule_prefix: str) -> bool:
    """Create (or refresh) a firewall rule allowing outbound traffic for the IP."""
    try:
        _windows_only()
    except FirewallError:
        return False

    rule = _rule_name(rule_prefix, student_id, ip_address)
    try:
        _run_powershell(
            f"Remove-NetFirewallRule -DisplayName '{rule}' -ErrorAction SilentlyContinue"
        )
        _run_powershell(
            "New-NetFirewallRule "
            f"-DisplayName '{rule}' "
            "-Direction Outbound "
            f"-RemoteAddress {ip_address} "
            "-Action Allow"
        )
        return True
    except FirewallError:
        return False


def revoke_internet_access(ip_address: str, student_id: str, rule_prefix: str) -> bool:
    try:
        _windows_only()
    except FirewallError:
        return False

    rule = _rule_name(rule_prefix, student_id, ip_address)
    try:
        _run_powershell(f"Remove-NetFirewallRule -DisplayName '{rule}' -ErrorAction SilentlyContinue")
        return True
    except FirewallError:
        return False
