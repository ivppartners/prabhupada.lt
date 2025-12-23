# Deployment Instructions (Debian/Ubuntu + Nginx + PM2)

Šios instrukcijos skirtos `prabhupada.lt` API serverio diegimui į Debian (arba Ubuntu) Linux serverį, naudojant Nginx kaip reverse proxy ir PM2 procesų valdymui.

## 1. Serverio paruošimas

Atnaujinkite sistemą ir įdiekite reikalingus įrankius:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Įdiekite Node.js (v18 ar naujesnę)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Įdiekite PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

### Įdiekite Nginx

```bash
sudo apt install -y nginx
```

## 2. Duomenų bazės paruošimas

Prisijunkite prie Postgres ir sukurkite vartotoją bei duomenų bazę:

```bash
sudo -u postgres psql
```

SQL komandos (pakeiskite slaptažodį!):

```sql
CREATE DATABASE prabhupada;
CREATE USER prabhupada WITH ENCRYPTED PASSWORD 'jusu_stiprus_slaptazodis';
GRANT ALL PRIVILEGES ON DATABASE prabhupada TO prabhupada;
\q
```

*Pastaba: Jums reikės sukurti lentelę `records`. Naudokite SQL struktūrą iš savo kūrimo aplinkos arba migracijos failų, jei turite.*

Pavyzdinė `records` lentelės struktūra (pagal kodą):

```sql
\c prabhupada
CREATE TABLE records (
    id UUID PRIMARY KEY,
    pavadinimas TEXT,
    failo_pavadinimas TEXT,
    failo_data TIMESTAMP,
    data TIMESTAMP,
    metai INTEGER,
    vieta TEXT,
    knyga TEXT,
    giesme INTEGER,
    skyrius INTEGER,
    tekstas INTEGER,
    aprasymas TEXT,
    dydis BIGINT
);
GRANT ALL PRIVILEGES ON TABLE records TO prabhupada;
```

## 3. Aplikacijos diegimas

Nuklonuokite repozitoriją į `/var/www/prabhupada.lt` (ar kitą katalogą):

```bash
sudo mkdir -p /var/www/prabhupada.lt
sudo chown -R $USER:$USER /var/www/prabhupada.lt
git clone <jusu_repo_url> /var/www/prabhupada.lt
cd /var/www/prabhupada.lt
```

Įdiekite priklausomybes:

```bash
npm install --production
```

Sukonfigūruokite `.env` failą:

```bash
cp .env.example .env
nano .env
```

Įrašykite savo DB duomenis ir kelią iki audio failų:

```env
AUDIO_PATH="/var/www/prabhupada.lt/audio"
POSTGRES_USER=prabhupada
POSTGRES_PASSWORD=jusu_stiprus_slaptazodis
POSTGRES_DB=prabhupada
POSTGRES_HOST=127.0.0.1
```

Sukurkite audio katalogą (jei nenaudojate atskiro disko/volume):

```bash
mkdir -p audio
```

## 4. Procesų valdymas su PM2

Įdiekite PM2 globaliai:

```bash
sudo npm install -g pm2
```

Paleiskite aplikaciją:

```bash
pm2 start server.js --name "prabhupada-api"
pm2 save
```

Nustatykite, kad PM2 pasileistų po serverio restarto:

```bash
pm2 startup
# Nukopijuokite ir įvykdykite komandą, kurią parodys terminalas
```

## 5. Nginx konfigūracija

Sukurkite naują konfigūracijos failą:

```bash
sudo nano /etc/nginx/sites-available/prabhupada.lt
```

Įklijuokite konfigūraciją (pakeiskite `server_name` į savo domeną):

```nginx
# Frontend (React)
server {
    listen 80;
    server_name prabhupada.lt www.prabhupada.lt;
    root /var/www/prabhupada.lt;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend (API)
server {
    listen 80;
    server_name api.prabhupada.lt; # Jūsų domenas

    # Padidiname upload limitą, nes keliate MP3 failus
    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Perduodame tikrą IP adresą aplikacijai
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Aktyvuokite konfigūraciją:

```bash
sudo ln -s /etc/nginx/sites-available/prabhupada.lt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL sertifikatas (HTTPS)

Naudokite Certbot nemokamam SSL sertifikatui:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.prabhupada.lt
```

Sekite instrukcijas ekrane. Certbot automatiškai atnaujins Nginx konfigūraciją.

## 7. Priežiūra

- **Logai**: `pm2 logs prabhupada-api` arba failuose `./logs/` kataloge.
- **Restartas**: `pm2 restart prabhupada-api`
- **Atnaujinimas**:
  ```bash
  git pull
  npm install
  pm2 restart prabhupada-api
  ```
