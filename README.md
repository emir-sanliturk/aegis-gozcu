# Aegis Gözcü — Kişisel Güvenlik ve Olay Merkezi

Gizlilik öncelikli, olay tetiklemeli kişisel güvenlik, yerel biyometrik doğrulama ve şifreli olay merkezi.

## Kurulum ve Geliştirme

```bash
cp .env.example .env
npm ci
npm run dev
```

## Derleme, Tip Denetimi ve Testler

```bash
npm run lint
npm run typecheck
npm run build
npm test -- --run
npm run check:no-mock
```

## Cloud Correlator (`apps/cloud-correlator` / `backend`)

`NODE_ENV=production` ortamında JSON dosya depoları (`AEGIS_DEVICE_STORE`, `AEGIS_EVENT_STORE`) güvenlik gereği reddedilir. Kalıcı depolama için PostgreSQL (`DATABASE_URL` / `AEGIS_DATABASE_URL`) veya `AEGIS_SQLITE_PATH` sağlanmalıdır.

```bash
cd backend
npm run typecheck
npm test
npm run build
```

PostgreSQL migrasyonu (`DATABASE_URL` ortam değişkeni ile):

```bash
cd backend
npm run db:migrate
```

## Tanıtım Medyası ve Altyazılar

- Video: `public/media/aegis-gozcu-tanitim.mp4` (`1920x1080`, 30 sn)
- Poster: `public/media/aegis-gozcu-tanitim-poster.webp`
- Altyazılar: `public/media/aegis-gozcu-tanitim.tr.vtt` ve `public/media/aegis-gozcu-tanitim.tr.srt`

Videoyu yeniden üretmek için:

```bash
npm run render:promo
```

## Konteyner Çalıştırma (`docker-compose.prod.yml`)

```bash
mkdir -p deploy/secrets && chmod 700 deploy/secrets
openssl rand -base64 48 > deploy/secrets/aegis_session_secret.txt
openssl rand -base64 48 > deploy/secrets/aegis_ip_pepper.txt
openssl rand -base64 48 > deploy/secrets/postgres_password.txt
chmod 600 deploy/secrets/*.txt

cp .env.prod.example .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
curl --fail http://localhost:8080/api/healthz
curl --fail http://localhost:8080/api/readyz
```

## Güvenlik İlkeleri

- **Açık kullanıcı onayı (`428`)**: `POST /v1/commands`, `POST /v1/shares` ve `DELETE /v1/shares/:shareId` uçları `explicit_user_confirmation: true` olmadan reddedilir.
- **Kısıtlı uzaktan işlem**: Yalnızca `lock_session` komutu kabul edilir; desteklenmeyen komut türleri ve bilinmeyen alanlar `.strict()` doğrulama ile `400` döner.
- **Strict CORS & Oturum**: `AEGIS_ALLOWED_ORIGINS` listesi açıkça tanımlanır (`*` reddedilir). `aegis_session` çerezi `HttpOnly`, `SameSite`, `Path=/`, kısa `Max-Age` ve üretimde `Secure` bayraklarıyla verilir. Cookie oturumlarında yazma istekleri `X-Requested-With` CSRF doğrulamasından geçer.
- **Veri gizliliği ve dürüst boş durum**: Ham ciphertext, nonce, auth tag, imza, private key, shared secret veya ham IP arayüzde ve loglarda tutulmaz/gösterilmez. Gerçek veri yoksa sahte cihaz veya olay üretilmez.

> Not: Bu proje katmanlı koruma uygular ancak hiçbir yazılım mutlak güvenlik garantisi vermez. Üretim ortamında TLS sonlandırma, anahtar/parola döndürme, yedekleme ve olay müdahale süreçleri ayrıca doğrulanmalıdır.
