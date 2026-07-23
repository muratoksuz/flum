# Nakit — Kendi Sunucuya Kurulum Rehberi

Bu rehber, uygulamayı **kendi VPS/sunucunuza** kurup bir domain üzerinden yayınlamanız için gereken tüm adımları içerir.

---

## 1) Gereksinimler

**Sunucu:**
- Ubuntu 22.04 / 24.04 LTS (Debian de olur) VPS
- En az **1 CPU · 1 GB RAM · 10 GB disk** (küçük kullanım için yeterli)
- Kök (`sudo`) erişimi
- Bir domain (örn. `nakit.flum.com.tr`) ve A kaydını sunucu IP'sine yönlendirdiğiniz DNS

**Yerelde:**
- Kodun bir kopyası (GitHub'dan `git clone` veya ZIP)

---

## 2) Sunucuya Bağımlılıkları Kurun

```bash
# Sistem güncelleme
sudo apt update && sudo apt upgrade -y

# Temel araçlar
sudo apt install -y curl git build-essential nginx ufw

# Python 3.11+ (Ubuntu 22.04'te 3.10 gelir; 3.11 için deadsnakes)
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# Node.js 20 LTS + Yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn

# MongoDB 7.0
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Süreç yöneticisi
sudo apt install -y supervisor
```

---

## 3) Kodu Sunucuya Alın

```bash
sudo mkdir -p /var/www/nakit
sudo chown -R $USER:$USER /var/www/nakit
cd /var/www/nakit
git clone https://github.com/muratoksuz/<REPO_ADI>.git .
```

---

## 4) Backend Kurulumu

```bash
cd /var/www/nakit/backend

# Sanal ortam
python3.11 -m venv .venv
source .venv/bin/activate

# Bağımlılıklar
pip install --upgrade pip
pip install -r requirements.txt
```

`.env` dosyasını oluşturun:

```bash
cat > /var/www/nakit/backend/.env <<'EOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="nakit_prod"
CORS_ORIGINS="https://nakit.flum.com.tr"

# 64 karakterli hex secret üretin: python3 -c "import secrets;print(secrets.token_hex(32))"
JWT_SECRET="BURAYA_URETILEN_SECRET"

ADMIN_EMAIL="admin@flum.com.tr"
ADMIN_PASSWORD="ÇOK_GÜÇLÜ_ŞİFRE"

FRONTEND_URL="https://nakit.flum.com.tr"

RESEND_API_KEY="re_..."
SENDER_EMAIL="onboarding@resend.dev"
REMINDER_DAYS_BEFORE="3"
REMINDER_HOUR="9"
EOF
chmod 600 /var/www/nakit/backend/.env
```

Backend'i test edin (elle):

```bash
cd /var/www/nakit/backend
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
# Yeni bir terminalde: curl http://localhost:8001/api/
# {"service":"nakit-cashflow","ok":true}
```

`Ctrl+C` ile durdurup **supervisor** ile kalıcı çalıştıracağız.

---

## 5) Supervisor ile Backend'i Servis Yapın

```bash
sudo tee /etc/supervisor/conf.d/nakit-backend.conf > /dev/null <<'EOF'
[program:nakit-backend]
command=/var/www/nakit/backend/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
directory=/var/www/nakit/backend
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
stdout_logfile=/var/log/nakit-backend.out.log
stderr_logfile=/var/log/nakit-backend.err.log
environment=PATH="/var/www/nakit/backend/.venv/bin"
user=www-data
EOF

sudo chown -R www-data:www-data /var/www/nakit
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status nakit-backend
```

---

## 6) Frontend'i Build Edip Nginx'e Verin

Frontend production build:

```bash
cd /var/www/nakit/frontend

# .env dosyası (build sırasında React içine gömülür)
echo 'REACT_APP_BACKEND_URL=https://nakit.flum.com.tr' > .env
echo 'WDS_SOCKET_PORT=443' >> .env

yarn install
yarn build
# build/ klasörü oluşur
```

**Önemli:** `REACT_APP_BACKEND_URL` değeri build sırasında bundle içine gömüldüğü için, değiştirdiğinizde `yarn build`'i tekrar çalıştırmalısınız.

---

## 7) Nginx Yapılandırması

```bash
sudo tee /etc/nginx/sites-available/nakit > /dev/null <<'EOF'
server {
    listen 80;
    server_name nakit.flum.com.tr;

    # Frontend (React build)
    root /var/www/nakit/frontend/build;
    index index.html;

    # Client-side routing için tüm rotalar index.html'e
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — /api ile başlayan istekler uvicorn'a
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    client_max_body_size 10M;
}
EOF

sudo ln -s /etc/nginx/sites-available/nakit /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8) HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nakit.flum.com.tr
# Yönergeleri takip edin (e-posta, KVKK onayı, "redirect HTTP→HTTPS: 2")
# Sertifika 90 günlük, otomatik yenilenir.
```

---

## 9) Güvenlik Duvarı (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
sudo ufw status
```

MongoDB'yi **dışa açık tutmayın** — sadece localhost'ta dinlesin (default). Uzak erişim gerekirse şifreli auth + firewall gerekir.

---

## 10) MongoDB Auth (Şiddetle Önerilir)

```bash
mongosh
> use admin
> db.createUser({user:"root", pwd:"UZUN_GUCLU_SIFRE", roles:["root"]})
> exit

sudo nano /etc/mongod.conf
# security:
#   authorization: enabled

sudo systemctl restart mongod
```

Sonra `backend/.env` içindeki `MONGO_URL` değerini güncelleyin:

```
MONGO_URL="mongodb://root:UZUN_GUCLU_SIFRE@127.0.0.1:27017/nakit_prod?authSource=admin"
```

Supervisor'ı yeniden başlatın:

```bash
sudo supervisorctl restart nakit-backend
```

---

## 11) İlk Giriş

Tarayıcıda `https://nakit.flum.com.tr` adresine gidin. `.env` içinde tanımladığınız `ADMIN_EMAIL / ADMIN_PASSWORD` ile giriş yapın. Sistem ilk açılışta admin kullanıcısını otomatik oluşturur.

---

## 12) Güncellemeler

Yeni bir sürüm çıktığında:

```bash
cd /var/www/nakit
git pull

# Backend
cd backend && .venv/bin/pip install -r requirements.txt
sudo supervisorctl restart nakit-backend

# Frontend
cd ../frontend && yarn install && yarn build
# nginx zaten build klasörünü serviyor — reload gerekmez
```

---

## 13) Yedekleme

**MongoDB yedeği (günlük cron):**

```bash
sudo tee /etc/cron.daily/nakit-mongo-backup > /dev/null <<'EOF'
#!/bin/bash
D=$(date +%F)
mongodump --uri="mongodb://root:UZUN_GUCLU_SIFRE@127.0.0.1:27017/nakit_prod?authSource=admin" --out=/var/backups/nakit/$D
find /var/backups/nakit -maxdepth 1 -mtime +14 -type d -exec rm -rf {} +
EOF
sudo chmod +x /etc/cron.daily/nakit-mongo-backup
sudo mkdir -p /var/backups/nakit
```

Ayrıca uygulama içindeki **Ayarlar → Yedeği İndir** ile JSON yedek alabilirsiniz.

---

## 14) Sorun Giderme

**Backend çalışmıyor:**
```bash
sudo tail -f /var/log/nakit-backend.err.log
sudo supervisorctl status
```

**Frontend 404:**
- `yarn build` çalıştı mı, `build/` klasörü var mı?
- Nginx `root` yolu doğru mu?
- `nginx -t` ve `systemctl reload nginx`

**API'ye erişilemiyor / CORS hatası:**
- `.env` içindeki `CORS_ORIGINS` ve `FRONTEND_URL` sizin domain'iniz mi?
- Backend'i restart ettiniz mi?

**Sertifika sorunu:**
```bash
sudo certbot renew --dry-run
```

---

## Alternatif: Tek Komutla Docker (Kolay Yol)

Docker ile de kurabilirsiniz. `docker-compose.yml` örneği için sorun, hazırlayayım.
