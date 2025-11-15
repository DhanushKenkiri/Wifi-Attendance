"""DNS redirector used to trigger captive portal splash screens."""

from __future__ import annotations

import ipaddress
import logging
import socket
import socketserver
import threading
from dataclasses import dataclass
from typing import Optional, Sequence

from dnslib import AAAA, A, DNSRecord, DNSError, QTYPE, RCODE, RR

LOGGER = logging.getLogger("captive_dns")
LOGGER.addHandler(logging.NullHandler())


class CaptiveDNSError(RuntimeError):
    """Raised when the redirector cannot be started."""


def _normalise_domains(domains: Sequence[str] | None) -> set[str]:
    cleaned: set[str] = set()
    if not domains:
        return cleaned
    for domain in domains:
        if not domain:
            continue
        cleaned.add(str(domain).strip().lower().rstrip("."))
    return cleaned


def _domain_matches(domain: str, patterns: set[str]) -> bool:
    return any(domain == pattern or domain.endswith(f".{pattern}") for pattern in patterns)


class DNSRedirectResolver:
    """Redirects most DNS answers to the captive portal IP."""

    def __init__(
        self,
        *,
        portal_ip: str,
        bypass_domains: Sequence[str] | None,
        force_portal_domains: Sequence[str] | None,
        upstream_servers: Sequence[str] | None,
        log_queries: bool,
        ttl: int = 5,
        auto_grant: bool = False,
        grant_url: Optional[str] = None,
    ) -> None:
        ip_obj = ipaddress.ip_address(portal_ip)
        if ip_obj.version != 4:
            raise CaptiveDNSError("portal_ip must be an IPv4 address")

        self.portal_ip = str(ip_obj)
        self.portal_ipv6 = f"::ffff:{ip_obj}"
        self.ttl = ttl
        self.log_queries = log_queries
        self.bypass_domains = _normalise_domains(bypass_domains)
        self.force_portal_domains = _normalise_domains(force_portal_domains)
        self.upstream_servers = tuple(server for server in (upstream_servers or []) if server)
        self.auto_grant = bool(auto_grant)
        self.grant_url = str(grant_url) if grant_url else None
        self._seen_clients: set[str] = set()

    def handle_packet(self, raw_query: bytes, client_address: tuple[str, int]) -> Optional[bytes]:
        try:
            request = DNSRecord.parse(raw_query)
        except DNSError as exc:
            if self.log_queries:
                LOGGER.warning("Invalid DNS frame from %s: %s", client_address[0], exc)
            return None

        qname = str(request.q.qname).rstrip(".").lower()
        qtype_id = request.q.qtype
        if self.log_queries:
            LOGGER.debug("DNS query %s (%s) from %s", qname, QTYPE.get(qtype_id, qtype_id), client_address[0])

        # attempt an auto-grant for new clients if configured
        client_ip = client_address[0]
        if self.auto_grant and self.grant_url and client_ip not in self._seen_clients:
            # mark seen immediately to avoid duplicate posts
            self._seen_clients.add(client_ip)
            try:
                import requests

                requests.post(self.grant_url, json={"ipAddress": client_ip, "studentId": None}, timeout=1.0)
                LOGGER.info("Auto-grant requested for %s", client_ip)
            except Exception:
                LOGGER.exception("Auto-grant request failed for %s", client_ip)

        if self._should_bypass(qname) and self.upstream_servers:
            forwarded = self._forward_upstream(raw_query)
            if forwarded:
                return forwarded

        response = self._redirect_response(request, qtype_id)
        return response.pack()

    def _should_bypass(self, qname: str) -> bool:
        if _domain_matches(qname, self.force_portal_domains):
            return False
        return bool(self.bypass_domains) and _domain_matches(qname, self.bypass_domains)

    def _forward_upstream(self, raw_query: bytes) -> Optional[bytes]:
        for upstream in self.upstream_servers:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as forwarder:
                    forwarder.settimeout(1.0)
                    forwarder.sendto(raw_query, (upstream, 53))
                    response, _ = forwarder.recvfrom(4096)
                    return response
            except OSError:
                continue
        return None

    def _redirect_response(self, request: DNSRecord, qtype_id: int) -> DNSRecord:
        response = request.reply()
        response.header.rcode = RCODE.NOERROR
        response.header.aa = 1

        qname = request.q.qname
        added_answer = False

        if qtype_id in (QTYPE.A, QTYPE.ANY):
            response.add_answer(RR(rname=qname, rtype=QTYPE.A, ttl=self.ttl, rdata=A(self.portal_ip)))
            added_answer = True

        if qtype_id in (QTYPE.AAAA, QTYPE.ANY):
            response.add_answer(
                RR(rname=qname, rtype=QTYPE.AAAA, ttl=self.ttl, rdata=AAAA(self.portal_ipv6))
            )
            added_answer = True

        if not added_answer:
            response.add_answer(RR(rname=qname, rtype=QTYPE.A, ttl=self.ttl, rdata=A(self.portal_ip)))

        return response


class DNSRedirectServer(socketserver.ThreadingUDPServer):
    allow_reuse_address = True

    def __init__(self, server_address: tuple[str, int], resolver: DNSRedirectResolver) -> None:
        self.resolver = resolver
        super().__init__(server_address, _DNSRequestHandler)


class _DNSRequestHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        data, socket_obj = self.request
        server: DNSRedirectServer = self.server  # type: ignore[assignment]
        response = server.resolver.handle_packet(data, self.client_address)
        if response:
            socket_obj.sendto(response, self.client_address)


@dataclass(frozen=True)
class DNSServerHandle:
    server: DNSRedirectServer
    thread: threading.Thread
    listen_address: str
    listen_port: int


def start_dns_server(
    *,
    listen_address: str,
    listen_port: int,
    portal_ip: str,
    bypass_domains: Sequence[str] | None = None,
    force_portal_domains: Sequence[str] | None = None,
    upstream_servers: Sequence[str] | None = None,
    log_queries: bool = False,
) -> DNSServerHandle:
    resolver = DNSRedirectResolver(
        portal_ip=portal_ip,
        bypass_domains=bypass_domains,
        force_portal_domains=force_portal_domains,
        upstream_servers=upstream_servers,
        log_queries=log_queries,
    )

    try:
        server = DNSRedirectServer((listen_address, listen_port), resolver)
    except OSError as exc:
        raise CaptiveDNSError(str(exc)) from exc

    thread = threading.Thread(target=server.serve_forever, name="CaptiveDNS", daemon=True)
    thread.start()
    LOGGER.info("Captive DNS redirector listening on %s:%s", listen_address, listen_port)
    return DNSServerHandle(server=server, thread=thread, listen_address=listen_address, listen_port=listen_port)


def stop_dns_server(handle: Optional[DNSServerHandle]) -> None:
    if not handle:
        return
    handle.server.shutdown()
    handle.server.server_close()
    handle.thread.join(timeout=2)
    LOGGER.info("Captive DNS redirector stopped")
