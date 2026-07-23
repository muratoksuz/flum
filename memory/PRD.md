# NAKİT — Kişisel Nakit Akış Yönetimi

## Original Problem Statement
"Alacakları, giderleri, banka hesaplarını, kredi kartlarını ve yaklaşan ödemeleri tek bir ekrandan takip edebileceğim nakit akış yönetimi uygulaması oluştur. Güvenlikli olsun ve herkes tarafından erişilemesin. İçerisinde yapılacaklar diye bir kısım olsun oradan da to do listelerini takip edebileyim"

## Architecture
- **Backend:** FastAPI + MongoDB (motor). JWT auth with httpOnly cookies + Bearer fallback. All routes under `/api`. UUID string IDs.
- **Frontend:** React 19 + React Router 7, Tailwind + shadcn/ui, Recharts for analytics, Phosphor Icons.
- **Design:** Swiss high-contrast light theme (Chivo display + IBM Plex Sans body).

## Personas
- Bireysel kullanıcı / küçük işletme sahibi — tek kullanıcılı kişisel nakit akış paneli.

## Core Requirements (Static)
1. JWT-korumalı erişim (sadece kayıtlı kullanıcı)
2. Alacaklar CRUD + "Ödendi" durumu
3. Giderler CRUD + kategori
4. Banka hesapları CRUD + toplam bakiye
5. Kredi kartları CRUD + limit/borç/ekstre/ödeme günü
6. Yaklaşan ödemeler otomatik derlenir (alacak + gider + kart borcu)
7. Yapılacaklar (to-do) listesi
8. Aylık/kategori analitikleri + CSV dışa aktarma

## Implemented (2026-02)
- ✅ JWT auth: register / login / logout / me (admin seed)
- ✅ Alacaklar, Giderler, Banka Hesapları, Kredi Kartları, Yapılacaklar CRUD
- ✅ Dashboard özet + aylık bar chart + kategori pie chart + yaklaşan widget
- ✅ Yaklaşan Ödemeler sayfası (7/30/60 gün filtresi)
- ✅ CSV export (5 kaynak)
- ✅ Türkçe UI, ₺ Intl format
- ✅ Testing agent: backend 95%, frontend 100%
- ✅ Resend e-posta hatırlatıcıları + APScheduler günlük cron (09:00 Europe/Istanbul, vadeye 3 gün kala)
- ✅ /bildirimler sayfası — durum, test gönder, manuel çalıştır
- ✅ FLUM markalı logo entegrasyonu (giriş ekranı & sidebar)
- ✅ Çoklu para birimi: USD, EUR, XAU (gram altın), XAG (gram gümüş), TRY — Receivables/Expenses/BankAccounts formlarında
- ✅ Kur takibi (/kurlar) + dashboard ticker; APScheduler her 3 saatte bir günceller (fawazahmed0/currency-api CDN, key'siz)
- ✅ Dashboard toplamları backend'de TRY karşılığına dönüştürülür
- ✅ Testing agent iterasyon-2: backend 15/15, frontend 24/24

## Backlog (P1/P2)
- P1: Yinelenen (recurring) giderler/alacaklar
- P2: Karanlık tema
- P2: PDF rapor / dashboard yazdırma
- P2: Yedekleme / veri dışa alma (JSON tam)
- P2: PUT partial-update desteği (mark as paid) — şu an frontend tam nesne gönderdiği için sorun yok

## Test Credentials
- admin@nakit.app / Admin1234!  (bkz. `/app/memory/test_credentials.md`)
