# Aegis Gözcü — Production Deployment & Rollback Runbook

## 1. Ön Koşullar

```bash
docker --version && docker compose version
# DNS: gozcu.example.com -> sunucu IP
# TLS sertifikası / reverse proxy (ACME / Let's Encrypt veya kurumsal ingress)
```

## 2. Secret Oluşturma (Git'e Asla Eklenmez)

```bash
mkdir -p deploy/secrets
chmod 700 deploy/secrets
openssl rand -base64 48 > deploy/secrets/aegis_session_secret.txt
openssl rand -base64 48 > deploy/secrets/aegis_ip_pepper.txt
openssl rand -base64 48 > deploy/secrets/postgres_password.txt
chmod 600 deploy/secrets/*.txt
```

`.gitignore` ve `.dockerignore` içinde `.env`, `.env.prod`, `*.key`, `*.pem`, `*.sqlite*`, `secrets/`, `deploy/secrets/`, `credentials/` kuralları bulunmalıdır.

## 3. Environment Ayarları (`.env.prod`)

```bash
cp .env.prod.example .env.prod
```

- `AEGIS_PUBLIC_API_ORIGIN=/api` (aynı-origin Nginx proxy) veya `https://api.gozcu.example.com`
- `AEGIS_ALLOWED_ORIGINS=https://gozcu.example.com` (wildcard `*` yasak, HTTPS zorunlu)
- Secret'lar `/run/secrets/*` veya `*_FILE` üzerinden okunur.

## 4. Build, Migration ve Başlatma

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build --pull
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm cloud-correlator pnpm --filter @aegis/cloud-correlator db:migrate
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

## 5. Health, Readiness, CORS ve Cookie Doğrulaması

```bash
curl --fail https://gozcu.example.com/api/healthz
curl --fail https://gozcu.example.com/api/readyz

# Preflight (beklenen: 204, Access-Control-Allow-Credentials: true, Vary: Origin)
curl -i -X OPTIONS https://gozcu.example.com/api/v1/devices \
  -H 'Origin: https://gozcu.example.com' \
  -H 'Access-Control-Request-Method: GET'

# İzinsiz origin (beklenen: 403 cors_origin_not_allowed, Vary: Origin)
curl -i https://gozcu.example.com/api/v1/devices \
  -H 'Origin: https://evil.example'

# Oturum çerezi (__Host-aegis_session, Path=/, HttpOnly, Secure, SameSite=Strict)
curl -i -c /tmp/cookies.txt -X POST https://gozcu.example.com/api/v1/auth/session
```

## 6. Log İzleme, Yedekleme ve Rollback

```bash
docker compose -f docker-compose.prod.yml logs --since=10m cloud-correlator
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U aegis_app aegis > backup-$(date +%F).sql
```

Geri alma (`rollback`):
```bash
docker compose -f docker-compose.prod.yml up -d --no-deps cloud-correlator frontend
```
Yıkıcı bir şema değişikliği (`migration`) varsa önce `pg_dump` yedeğine dönün; veritabanı şemasının otomatik geri döndüğünü varsaymayın.
