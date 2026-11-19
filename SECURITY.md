# Security Policy

## Supported Versions

Only the latest release on `main` receives security updates.

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Please report suspected vulnerabilities privately to the repository maintainers via GitHub Security Advisories (`Security` → `Advisories` → `Report a vulnerability`) with:

- Affected component (`frontend`, `apps/cloud-correlator`, `docker`, or `migrations`)
- Reproduction steps or minimal proof of concept
- Potential security impact

We aim to acknowledge reports within 48 hours and provide an initial assessment or remediation timeline within 5 business days.

## Security Design Guarantees & Boundaries

- Strict CORS origin allowlist (`AEGIS_ALLOWED_ORIGINS`); wildcard `*` is rejected whenever `credentials: true` is enabled.
- `aegis_session` cookies are issued with `HttpOnly`, `SameSite`, `Path=/`, short `Max-Age`, and `Secure` in production.
- Mutating endpoints (`POST /v1/commands`, `POST /v1/shares`, `DELETE /v1/shares/:shareId`) require explicit user confirmation (`428` otherwise), strict schema validation, CSRF verification on cookie sessions, and ownership checks (`403`).
- Raw ciphertexts, nonces, auth tags, cryptographic signatures, private keys, and raw client IP addresses are redacted from logs and never exposed in the UI.
- **No software system can claim absolute immunity**; deployment operators remain responsible for TLS termination, secret rotation, database backups, host firewalling, and incident response.
