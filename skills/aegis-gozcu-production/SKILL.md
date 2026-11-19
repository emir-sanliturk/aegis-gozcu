---
name: aegis-gozcu-production
description: "Aegis Gözcü için production-ready Docker, Nginx, Fastify, PostgreSQL, secure session cookie, strict CORS, React gerçek veri entegrasyonu, deployment runbooku ve mimari diyagramları üret. Kullan: Aegis Gözcü backend/frontend dağıtımı, production hardening, cookie/CORS entegrasyonu, gerçek veri API bağlantısı, release readiness veya mimari dokümantasyon görevlerinde."
---

# Aegis Gözcü Production

Aegis Gözcü görevlerinde aşağıdaki sırayı izle:

1. Mevcut frontend (`src/`) ve backend (`apps/cloud-correlator/`) yapısını ile gerçek endpoint sözleşmesini incele.
2. Uygulamayı DEMO ve Gerçek Veri modları açısından kesin olarak ayır; sahte cihaz, olay veya grafik ekleme.
3. Production secret, açık origin CORS, session cookie ve reverse proxy sınırlarını tanımla.
4. Docker image (`Dockerfile`, `apps/cloud-correlator/Dockerfile`), Nginx frontend proxy (`docker/nginx.conf`), `internal: true` Docker ağı ve kalıcı depolamayı yapılandır.
5. React veri akışını `credentials: "include"`, `AbortController` ve `30_000` ms polling ile bağla.
6. Kullanıcı onayı olmadan `/v1/commands`, `/v1/shares` oluşturma veya paylaşım iptali gönderme.
7. Health/readiness, `401`/`403`/`428`, CORS preflight ve empty-state testlerini çalıştır.
8. Gerçekte çalıştırılmayan Docker/TLS/PostgreSQL kontrollerini asla PASS olarak raporlama.
9. Mimari şema için `docs/architecture/*.mmd` Mermaid kaynaklarını güncelle.

## Zorunlu Güvenlik Kararları

- `Access-Control-Allow-Origin: *` kullanma; `credentials: "include"` ile wildcard uyumsuzdur.
- `AEGIS_ALLOWED_ORIGINS` listesindeki her değeri `new URL()` ile doğrula.
- Production origin'leri `https://` protokolüne sahip olmalı.
- CORS reddinde `403 cors_origin_not_allowed` ve `Vary: Origin` döndür.
- `OPTIONS` preflight için izinli origin'de `204` döndür.
- `AEGIS_SESSION_SECRET` en az 32 karakter olmalı.
- Production'da secret'ları Docker secrets (`/run/secrets/*`) veya `*_FILE` ile oku.
- Session cookie: `__Host-aegis_session`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`.
- Ham cookie, `authorization`, `private_key`, `nonce`, `ciphertext`, `auth_tag` ve `shared_secret` loglama veya arayüze yazma.
- Production container root olarak çalışmamalı (`USER 101:101` ve `USER nonroot`).
- `cloud-correlator` ve `postgres` yalnızca `internal: true` Docker ağı üzerinden erişilebilir olmalı.
- Nginx yalnızca public frontend / `/api/` reverse-proxy giriş noktası olmalı.

## Gerçek Veri Davranışı

API veya kayıt yoksa açıkça şu durumları göster:

- `Bağlantı bekleniyor`
- `Eşleşmiş cihaz yok`
- `Gerçek olay kaydı yok`
- `Veri yok`
- `Aktif paylaşım yok`

`win11-workstation`, `macbook-pro-m3`, `pixel-8-pro`, `iphone-15`, rastgele telemetri veya varsayımsal nöbet durumu üretme.

## Frontend Sözleşmesi

- Vite ortam değişkeni: `VITE_AEGIS_API_ORIGIN` (aynı-origin proxy ile `/api` veya tam `https://` API origin'i).
- Tüm `fetch` çağrılarında `credentials: "include"` ve `Accept: "application/json"` kullan.
- Polling `30_000` ms olmalı; unmount/stop sırasında interval temizlenmeli ve `AbortController.abort()` çağrılmalı.
- HTTP durum eşleştirme:
  - `401` → `Oturum doğrulaması gerekli`
  - `403` → `Origin izinli değil`
  - `428` → `Kullanıcı onayı gerekli`
  - `202` → `İşlem cihaz kuyruğuna alındı`

## Referanslar

- Production deploy ve rollback adımları: `references/deployment-runbook.md`
- Mimari kararlar ve veri akışı: `references/architecture-decisions.md`
