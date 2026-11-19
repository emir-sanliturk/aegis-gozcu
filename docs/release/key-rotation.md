# Anahtar Rotasyonu Prosedürü (90 Gün)

## Kapsamdaki Anahtarlar
- Sahip Ed25519 kimlik anahtarı (`owner_identity_ed25519`)
- Cihaz Ed25519 imza anahtarı (`device_signing_ed25519`)
- X25519 anahtar anlaşma anahtarı (`x25519_key_agreement`)
- AES-256-GCM zarf şifreleme anahtarı (`dek_aes_256_gcm`)
- Cloudflare API / Privacy Proxy belirteci
- APNs `.p8` kimlik doğrulama anahtarı

## Adımlar
1. Yeni anahtar çiftini yalnızca yerel güvenli donanım / Keychain / Keystore içinde üretin.
2. Yeni açık anahtarı cihaz eşleştirme (`/v1/devices/pair`) uç noktası üzerinden yayınlayın.
3. Yalnızca asgari şifreli meta veriyi yeni anahtarla yeniden şifreleyin; ham görüntü veya biyometrik kare aktarmayın.
4. Yeni anahtar doğrulandıktan sonra eski anahtarı iptal edin (`revoked_at` damgası).
5. Rotasyon işlemini yeni bir UUIDv7 `event_id` ve güncel `prev_event_hash` ile kaydedin.
6. `verifyEventChain()` ile olay zinciri bütünlüğünü doğrulayın.
