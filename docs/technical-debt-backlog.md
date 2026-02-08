# Technical Debt Backlog

Bu doküman, build sırasında gözlenen ancak release'i bloklamayan uyarıları teknik borç olarak takip etmek için oluşturulmuştur.

## 1) Sentry modern instrumentation migration

- **Öncelik:** P1
- **Durum:** Açık
- **Gözlem:** Build çıktısında `sentry.client.config.ts` için deprecation uyarısı ve `onRequestError` hook önerisi görülüyor.
- **Risk:** Gelecek Next.js / Sentry sürümlerinde gözlemlenebilirlikte kırılma veya eksik hata yakalama.
- **Yapılacaklar:**
  1. `sentry.client.config.ts` içeriğini `instrumentation-client.ts` dosyasına taşı.
  2. `onRequestError` için Sentry capture entegrasyonunu ekle.
  3. Client + server hata smoke testleri ile event gönderimini doğrula.
- **İlgili dosyalar:**
  - `sentry.client.config.ts`
  - `next.config.js`

## 2) Edge Runtime uyumluluğu: middleware içinde `micromatch` bağımlılığı

- **Öncelik:** P1/P2
- **Durum:** Açık
- **Gözlem:** Build çıktısında `micromatch/picomatch` içindeki Node API (`process.platform`, `process.version`) kullanımına dair Edge Runtime uyarıları görülüyor.
- **Risk:** İleride Edge runtime kuralları sertleştiğinde uyumluluk sorunları.
- **Yapılacaklar:**
  1. Middleware route eşleşmesini `micromatch` yerine Edge-safe pattern (native matcher / `startsWith` / kontrollü regex) ile değiştir.
  2. Middleware unit testlerini güncelle ve regresyon testi çalıştır.
- **İlgili dosyalar:**
  - `middleware.ts`
  - `package.json`

## 3) ESLint Next plugin uyumlandırması

- **Öncelik:** P2
- **Durum:** Açık
- **Gözlem:** Build sırasında “Next.js plugin was not detected in your ESLint configuration” uyarısı görülüyor.
- **Risk:** Next.js'e özgü kalite kurallarının eksik uygulanması.
- **Yapılacaklar:**
  1. ESLint konfigürasyonunda Next.js önerilen plugin/preset’in etkin olduğunu doğrula.
  2. `eslint` ve `next lint` çıktıları arasında fark analizi yap.

## 4) `baseline-browser-mapping` güncelliği

- **Öncelik:** P3
- **Durum:** Açık
- **Gözlem:** Build sırasında veri setinin güncelliğine dair uyarı görülüyor.
- **Risk:** Tarayıcı baseline kararlarında güncellik kaybı.
- **Yapılacaklar:**
  1. `baseline-browser-mapping` paketini güncelle.
  2. Dependabot/renovate ile periyodik güncelleme politikasına dahil et.

---

## Takip notu

- Bu maddeler release bloklayıcı değildir.
- Ancak üretim olgunluğu için bir sonraki sprintte ele alınması önerilir.
