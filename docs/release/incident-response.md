# Güvenlik Olayı Müdahale Prosedürü

## `tamper_detected` veya Zincir Kopması Durumunda

1. Olayın `event_id`, `trace_id` ve `correlation_id` bilgilerini koruyun.
2. `prev_event_hash` zincirini doğrulayın; kopma noktasını karantinaya alın.
3. İlgili olaya bağlı tüm aktif geçici paylaşım bağlantılarını (`DELETE /v1/shares/:shareId` veya `revoke`) anında iptal edin.
4. Yalnızca cihaz sahibinin açık onayıyla ilgili masaüstü oturumunu uzaktan kilitleyin (`/v1/commands/lock`).
5. Şifreli komuta merkezi (iOS) üzerinden kullanıcıya bildirim gönderin.
6. Yalnızca sanitize edilmiş, gizlilik korumalı tanılama meta verisini toplayın (ham ekran görüntüsü, ham yüz görüntüsü, ham komut satırı ve ham IP toplanmaz).
7. Anahtar sızıntısı şüphesi varsa `docs/release/key-rotation.md` adımlarını hemen başlatın.
8. Yapılan tüm müdahaleleri zaman damgalı olay zaman çizelgesine işleyin.
