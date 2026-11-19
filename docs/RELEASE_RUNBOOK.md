# Aegis Gözcü — Kişisel Güvenlik ve Olay Merkezi Release Runbook

## 1. Release Readiness Kontrol Listesi

Her sürüm etiketi (`release/**`) öncesinde aşağıdaki maddelerin tamamı doğrulanmalıdır:

- [ ] Tüm CI/CD işleri (`schema-and-web`, `cloud-correlator`, `windows-agent`, `macos-agent`, `android-agent`, `ios-command-center`) hatasız geçer.
- [ ] `npm run check:no-mock` üretim yollarında `mock/fake/random/dummy/placeholder` sembolü bulunmadığını doğrular.
- [ ] CycloneDX 1.6 SBOM (`sbom/aegis-nobet.cdx.json`) üretilir ve workflow artefaktı olarak saklanır.
- [ ] `scripts/license-gate.mjs` `GPL-3.0-only`, `GPL-3.0-or-later`, `AGPL-3.0-only`, `AGPL-3.0-or-later`, `SSPL-1.0`, `ELv2` ve lisanssız bağımlılıkları reddeder.
- [ ] Demo Modu CSV/JSON dışa aktarımı kapalıdır ve gerçek olay akışına karışmaz.
- [ ] Distroless Node.js 22 konteyneri root olmayan kullanıcı (`nonroot`), `read_only: true`, `cap_drop: ALL` ve `/healthz`, `/readyz` kontrolleriyle başlar.
- [ ] Fastify HTTP yanıtlarında Strict CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP/CORP ve `no-store` başlıkları doğrulanır.
- [ ] `__Host-aegis_session` çerezi `Secure; HttpOnly; SameSite=Strict` özellikleriyle verilir.
- [ ] Pino log redaksiyonu `ciphertext`, `nonce`, `iv`, `auth_tag`, `signature`, `authorization` ve ham IP alanlarını maskeler.
- [ ] Cloudflare WAF, DDoS ve uç nokta bazlı rate limiting kuralları (`infra/cloudflare/waf-rules.json`) aktiftir.

## 2. Anahtar Rotasyonu (90 Gün Döngüsü)

Ayrıntılı adımlar için bkz. [`docs/release/key-rotation.md`](release/key-rotation.md).

## 3. Güvenlik Olayı Müdahalesi (Tamper / Zincir Kopması)

Ayrıntılı adımlar için bkz. [`docs/release/incident-response.md`](release/incident-response.md).

## 4. Platform Onayları & Dağıtım Kapıları

Ayrıntılı adımlar için bkz. [`docs/release/platform-approvals.md`](release/platform-approvals.md).

## 5. Veritabanı Migrasyonu (PostgreSQL)

Üretim ortamında yalnızca kalıcı SQLite (`AEGIS_SQLITE_PATH`) veya PostgreSQL (`DATABASE_URL`) kullanılır; JSON dosya depoları (`AEGIS_DEVICE_STORE`, `AEGIS_EVENT_STORE`) reddedilir.

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/aegis \
pnpm --filter @aegis/cloud-correlator db:migrate
```

