# Contributing to Aegis Gözcü

Thank you for helping improve Aegis Gözcü!

## Local Development

1. Copy `.env.example` to `.env` and replace all `replace-with-...` placeholders with strong local values.
2. Never commit `.env`, `deploy/secrets/`, private keys (`*.pem`, `*.key`), or SQLite files.
3. Install dependencies and verify before opening a pull request:

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run check:no-mock
```

For backend (`apps/cloud-correlator`):

```bash
cd apps/cloud-correlator
npm run lint
npm test
npm run build
```

## Pull Request Guidelines

- Do not introduce mock devices, synthetic incidents, or placeholder security statuses in production code paths.
- Ensure any new or changed backend route enforces authentication, ownership checks, strict schema validation, and explicit confirmation (`428`) where required.
- Add automated tests for every bug fix or security hardening change.
- Keep CI workflows minimal-privilege (`permissions: contents: read`).
