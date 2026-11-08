# Sohbet: kayıt, giriş ve canlı mesajlaşma

Bağımlılıksız Node.js uygulaması (Node 18+). Kayıt, giriş, kişiyi e-posta ile bulma, canlı mesajlaşma ve okundu bilgisi vardır. Telefonda ana ekrana eklenebilir (PWA).

## Yerelde çalıştırma
    npm start        # http://localhost:3000

## İnternette yayınlama (Render örneği)
1. Klasörü bir GitHub deposuna yükle.
2. render.com: New > Web Service > depoyu seç. Build Command boş, Start Command `npm start`.
3. Disks bölümünden bir disk ekle (Mount Path `/data`) ve ortam değişkeni ekle: `DATA_DIR=/data`. Disk olmazsa kayıtlar her yeniden başlatmada silinir.
4. Yayın bittikten sonra çıkan `https://...onrender.com` adresi uygulama linkindir. Herkes bu adresten kayıt olabilir.

## Telefona yükleme
- iPhone (Safari): Paylaş > Ana Ekrana Ekle.
- Android (Chrome): ⋮ > Uygulamayı yükle.

## Bilinen sınırlar
- E-posta doğrulaması ve şifre sıfırlama yok (bir e-posta servisi gerekir).
- Uygulama kapalıyken bildirim yok (Web Push gerekir).
- Veriler tek bir JSON dosyasında tutulur; küçük gruplar için uygundur. Büyürse PostgreSQL'e geçirilmeli.
- App Store / Google Play için bu web uygulaması Capacitor gibi bir araçla paketlenir.
