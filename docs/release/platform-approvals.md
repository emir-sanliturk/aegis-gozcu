# Platform Onayları & Dağıtım Kapıları

## Apple macOS Endpoint Security
- [ ] Apple Developer System Extensions talebi onaylandı.
- [ ] `com.apple.developer.endpoint-security.client` yetkisi alındı.
- [ ] Sistem uzantısı imzalandı (`codesign`) ve noter onayından (`notarytool`) geçti.
- [ ] Yetki öncesi `MONITOR` modu doğrulandı; `AUTH` engelleme yalnızca onay sonrası açıldı (`execve` kapsam sınırı belgelendi).

## Windows Ajan İmzası
- [ ] EV kod imzalama sertifikası yapılandırıldı.
- [ ] Kullanıcı modu sınırları (`WTSRegisterSessionNotification`, ETW, WFP/ALE) ve yönetici/SYSTEM saldırgan riski açıkça belgelendi.
- [ ] İleride çekirdek bileşeni eklenecekse Microsoft WHQL sürücü imzalama gereksinimleri doğrulandı.

## Google Play (Android Nöbet Modu)
- [ ] `FOREGROUND_SERVICE_CAMERA` bildirildi; kamera izni bağlam içinde isteniyor.
- [ ] Kalıcı görünür bildirim ve `Nöbeti Bitir` (`ACTION_STOP_DUTY`) eylemi doğrulandı.
- [ ] Android 15 `onTimeout()` davranışı test edildi; gizli kamera veya arka plandan izinsiz başlatma yok.

## Apple App Store (iOS Komuta Merkezi)
- [ ] Arka planda kamera oturumu yok (`videoDeviceNotAvailableInBackground` sınırı korunuyor).
- [ ] APNs yalnızca `{ aps: { "content-available": 1 }, event_id }` uyandırma yükü gönderiyor.
- [ ] Şifreli özet yerel olarak `CryptoKit` (`AES.GCM`, `AAD = sender_device_id`) ile çözülüyor.
- [ ] Uzak kilitleme komutları açık kullanıcı onayı istiyor; Privacy Manifest güncel.
