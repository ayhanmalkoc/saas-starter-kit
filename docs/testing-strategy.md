# Testing Strategy

Bu doküman, proje için test kapsamı, önceliklendirme ve CI doğrulama kurallarını standartlaştırır.

## 1) Test katmanları: unit / integration / e2e

### Unit test

- **Amaç:** Tek bir fonksiyon/sınıf/modülün izolasyonda doğru çalıştığını doğrulamak.
- **Kapsam:** Özellikle `lib/**` altındaki saf iş kuralları, yardımcı fonksiyonlar, doğrulama (`zod`), yetki/rol kuralları.
- **Bağımlılık yaklaşımı:** Ağ, DB, dış servisler (Stripe, Jackson, SMTP vb.) mock edilir.
- **Hız hedefi:** Test başına milisaniye-seviye; CI’da en hızlı geri bildirim katmanı.

### Integration test

- **Amaç:** Birden çok modülün birlikte çalışmasını (örn. API handler + servis + DB erişimi) doğrulamak.
- **Kapsam:** `pages/api/**` endpoint’leri, auth/permission akışları, hata yönetimi, request/response kontratları.
- **Bağımlılık yaklaşımı:** Mümkünse gerçek Postgres (CI service) + kontrollü fixture/factory; harici 3rd-party API’ler mock/stub.
- **Hız hedefi:** Unit’ten yavaş ama deterministik; PR’da zorunlu.

### E2E test

- **Amaç:** Kullanıcı perspektifinden kritik senaryoları uçtan uca doğrulamak.
- **Kapsam:** Kayıt/giriş, takım yönetimi, oturum yönetimi, ödeme veya SSO gibi kritik yolculuklar.
- **Araç:** Playwright (`npm run test:e2e`).
- **Hız hedefi:** Sayıca sınırlı, yüksek değerli senaryolar; smoke + kritik iş akışları.

---

## 2) Önceliklendirme: P0 / P1 / P2 endpoint ve modül listesi

> Kural: Önce **P0**, sonra **P1**, ardından **P2** için test yazılır/iyileştirilir.

### P0 (iş sürekliliği / güvenlik kritik)

#### Endpoint’ler (`pages/api/**`)

- `pages/api/auth/[...nextauth].ts`
- `pages/api/auth/forgot-password.ts`
- `pages/api/auth/reset-password.ts`
- `pages/api/oauth/token.ts`
- `pages/api/oauth/userinfo.ts`
- `pages/api/sessions/index.ts`
- `pages/api/sessions/[id].ts`
- `pages/api/teams/index.ts`
- `pages/api/webhooks/stripe.ts`

#### Modüller (`lib/**`)

- `lib/auth.ts`
- `lib/nextAuth.ts`
- `lib/session.ts`
- `lib/prisma.ts`
- `lib/permissions.ts`
- `lib/rbac.ts`
- `lib/stripe.ts`
- `lib/guards/team-api-key.ts`
- `lib/guards/team-sso.ts`
- `lib/guards/team-dsync.ts`

### P1 (yüksek iş değeri / entegrasyon kritik)

#### Endpoint’ler

- `pages/api/users.ts`
- `pages/api/invitations/[token].ts`
- `pages/api/auth/join.ts`
- `pages/api/auth/resend-email-token.ts`
- `pages/api/auth/unlock-account.ts`
- `pages/api/oauth/authorize.ts`
- `pages/api/oauth/saml.ts`
- `pages/api/idp.ts`
- `pages/api/webhooks/dsync.ts`

#### Modüller

- `lib/jackson.ts`
- `lib/jackson/dsyncEvents.ts`
- `lib/accountLock.ts`
- `lib/server-common.ts`
- `lib/metrics.ts`
- `lib/retraced.ts`
- `lib/svix.ts`
- `lib/billing/entitlements.ts`
- `lib/email/sendPasswordResetEmail.ts`
- `lib/email/sendTeamInviteEmail.ts`

### P2 (destekleyici / regresyon önleyici)

#### Endpoint’ler

- `pages/api/health.ts`
- `pages/api/hello.ts`
- `pages/api/import-hack.ts`
- `pages/api/password.ts`
- `pages/api/oauth/oidc.ts`
- `pages/api/well-known/saml.cer.ts`
- `pages/api/auth/custom-signout.ts`

#### Modüller

- `lib/common.ts`
- `lib/fetcher.ts`
- `lib/env.ts`
- `lib/errors.ts`
- `lib/theme.ts`
- `lib/email/utils.ts`
- `lib/zod/primitives.ts`
- `lib/zod/schema.ts`

---

## 3) Minimum coverage hedefleri

Coverage, `npm run test:cov` çıktısı üzerinden değerlendirilir.

### Hedefler (minimum)

- `pages/api/**`
  - **Line:** %80
  - **Branch:** %70
  - **Function:** %80
  - **Statement:** %80
- `lib/**`
  - **Line:** %85
  - **Branch:** %75
  - **Function:** %85
  - **Statement:** %85

### Uygulama politikası

- Yeni eklenen dosyalarda minimum hedefin altına düşülmez.
- Mevcut düşük kapsamlı dosyalarda “ratchet” uygulanır: her PR’da en azından mevcut oran korunur veya artırılır.
- Geçici istisnalar (legacy/dış bağımlılık kısıtı) PR açıklamasında gerekçelendirilir ve takip issue’su açılır.

---

## 4) CI pipeline kuralları

PR ve `main`/`release` branch’leri için aşağıdaki sıra önerilir:

1. `npm test` (unit + integration)
2. `npm run test:e2e` (kritik akışlar)
3. coverage threshold kontrolü (`npm run test:cov` veya jest threshold gate)

### Gate (merge şartı)

- `npm test` başarısızsa merge engellenir.
- `npm run test:e2e` başarısızsa merge engellenir.
- Coverage, bölüm 3’teki minimum hedeflerin altına düşerse merge engellenir.

### Operasyonel not

- E2E süresi uzarsa testler smoke/full olarak ayrılır:
  - PR: smoke + P0 yolculukları
  - Gece çalışması (scheduled): full regresyon

---

## 5) Flaky test yönetimi ve mock/factory standartları

### Flaky test yönetimi

- **Tanım:** Aynı commit’te tekrar çalıştırmada nondeterministic şekilde geçen/kalan test.
- **Tespit:** Son 20 CI koşusunda başarısızlık oranı %2+ ise flaky adayı.
- **Aksiyonlar:**
  1. Teste `@flaky` etiketi/yorum notu düşülür.
  2. En fazla 7 gün içinde kök neden analizi yapılır.
  3. Gerekirse test geçici quarantine grubuna alınır (ana gate dışında raporlanır).
  4. Quarantine süresi boyunca ilgili P0 alan için alternatif güvence testi zorunludur.
- **Yasak:** Sebepsiz `retry` artırımı ile flaky test “saklamak”.

### Mock standartları

- Mock’lar sadece sınır bağımlılıklarında kullanılır (ağ, ödeme, e-posta, telemetry, SSO provider).
- İş kuralı modüllerinde aşırı mock yerine gerçek implementasyon + fixture tercih edilir.
- Mock davranışları senaryo bazlı ve açık isimlendirilir (`should_return_401_when_token_invalid` gibi).
- Global/shared mutable mock state kullanılmaz; her testte temiz kurulum (`beforeEach/afterEach`).

### Factory/fixture standartları

- Test verisi üretimi için factory yaklaşımı kullanılır (varsayılan geçerli obje + senaryoya özel override).
- Rastgele veri (`faker`) kullanıldığında deterministik tohum (seed) belirlenir.
- Fixture isimleri domain odaklı olur (`teamFactory`, `sessionFactory`, `tokenFactory`).
- Tarih/saat ve UUID gibi değerlerde sabitlenmiş kaynaklar (fake timers / deterministic generators) tercih edilir.

---

## Sahiplik ve gözden geçirme

- Bu dokümanın sahibi: backend + platform ekibi.
- Gözden geçirme sıklığı: en az 3 ayda bir veya büyük mimari değişiklik sonrası.
