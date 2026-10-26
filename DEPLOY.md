# Deployment Instructions (Debian/Ubuntu + Nginx + PM2)

Šios instrukcijos skirtos `prabhupada.lt` API serverio diegimui į Debian (arba Ubuntu) Linux serverį, naudojant Nginx kaip reverse proxy ir PM2 procesų valdymui.

## 1. Serverio paruošimas

Atnaujinkite sistemą ir įdiekite reikalingus įrankius:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Įdiekite Node.js (v22 LTS ar naujesnę)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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
GRANT CONNECT ON DATABASE prabhupada TO prabhupada;
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
    dydis BIGINT,
    published BOOLEAN DEFAULT FALSE
);

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    record_id UUID,
    timestamp TIMESTAMP DEFAULT NOW(),
    ip TEXT
);

-- Minimalių privilegijų principas (Least Privilege): suteikiame tik DML teises
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE records, logs TO prabhupada;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prabhupada;
\q
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
npm install --omit=dev
```

Sukonfigūruokite `.env` failą ir apribojite jo prieigos teises:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Įrašykite savo DB duomenis ir kelią iki audio failų:

```env
AUDIO_PATH="/var/www/prabhupada.lt/audio"
HOST=127.0.0.1
PORT=4001
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

Paruošti ir saugos atžvilgiu patikrinti Nginx konfigūracijos failai yra kataloge `docs/`:
- `docs/prabhupada.lt.conf` – viešajam puslapiui `prabhupada.lt` (su administracinių `/api/*` maršrutų blokavimu iš išorinio tinklo).
- `docs/prabhupada.admin.conf` – administravimo puslapiui `prabhupada.admin` (pasiekiamam tik iš vietinio tinklo `127.0.0.1` ir `192.168.0.0/16`).

Nukopijuokite ir aktyvuokite konfigūracijas:

```bash
sudo cp docs/prabhupada.lt.conf /etc/nginx/sites-available/prabhupada.lt
sudo cp docs/prabhupada.admin.conf /etc/nginx/sites-available/prabhupada.admin
sudo ln -s /etc/nginx/sites-available/prabhupada.lt /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/prabhupada.admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL sertifikatas (HTTPS)

Naudokite Certbot nemokamam SSL sertifikatui:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d prabhupada.lt -d www.prabhupada.lt
```

## 7. Priežiūra

- **Logai**: `pm2 logs prabhupada-api` arba failuose `./logs/` kataloge.
- **Restartas**: `pm2 restart prabhupada-api`
- **Atnaujinimas**:
  ```bash
  git pull
  npm install --omit=dev
  pm2 restart prabhupada-api
  ```
