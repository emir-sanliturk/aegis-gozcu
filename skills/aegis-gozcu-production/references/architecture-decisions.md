# Aegis Gözcü — Mimari Kararlar ve Durum Eşleme

## 1. İstek ve Ağ Katmanları

```
Tarayıcı (React + Vite)
   │  HTTPS · credentials: "include"
   ▼
Nginx (frontend:8080, USER 101:101)
   ├─ /*      -> statik React SPA
   └─ /api/*  -> proxy_pass http://cloud-correlator:8080/
                    │  aegis-internal (internal: true)
                    ▼
             Fastify (@aegis/cloud-correlator, nonroot)
               ├── Strict CORS (new URL + HTTPS + Vary: Origin)
               ├── Sliding-window IP rate limiter (HMAC-SHA256)
               ├── __Host-aegis_session (HttpOnly, Secure, SameSite=Strict)
               └── PostgreSQL / kalıcı SQLite + hash-chained append-only events
```

## 2. HTTP Durum Eşlemesi

| HTTP Kodu | Backend Hatası | React İstemci Hatası | Arayüz Mesajı |
| --- | --- | --- | --- |
| `200` / `201` | — | Başarılı yanıt | Gerçek liste / `Paylaşım iptal edildi` |
| `202` | `queued_for_device` | `accepted: true` | `İşlem cihaz kuyruğuna alındı` |
| `401` | `unauthorized` | `session_required` | `Oturum doğrulaması gerekli` |
| `403` | `cors_origin_not_allowed` | `cors_origin_not_allowed` | `Origin izinli değil` |
| `428` | `explicit_user_confirmation_required` | `explicit_user_confirmation_required` | `Kullanıcı onayı gerekli` |
| `503` | `not_ready` | `api_not_ready` | `Bağlantı bekleniyor` |

## 3. Yayın Öncesi Kontrol Listesi

- [ ] `npm run lint`, `npm run build`, `npm test`, `npm run check:no-mock` hatasız geçti.
- [ ] `apps/cloud-correlator/tsconfig.json` tip kontrolü ve Fastify `esbuild` derlemesi geçti.
- [ ] `AEGIS_ALLOWED_ORIGINS` yalnızca geçerli `https://` origin'leri içeriyor (`*` yok).
- [ ] `.env`, `.env.prod`, `*.key`, `*.pem`, `deploy/secrets/` dosyaları Git takibinde değil.
- [ ] Çalıştırılmayan Docker / TLS / canlı PostgreSQL adımları raporda `NOT RUN` olarak işaretlendi.
