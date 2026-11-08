# Életkert – deploy az éles szerverre

Az oldal: https://eletkertjudittal.hu · Backend API: https://strapi.eletkertjudittal.hu · Szerver: `root@91.98.141.17`
(Hetzner VPS, Ubuntu 24.04), SSH **kulccsal**.

## Gyors használat

```powershell
# a repo gyökeréből (Életkert_v2.0)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1                  # frontend (alapértelmezett)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target backend  # Strapi (eletkertadmin)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target nginx    # nginx site-ok (deploy\nginx-eletkert-*.conf)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target all      # backend + frontend + nginx
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Rollback        # előző frontend verzió
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -CheckOnly       # csak kapcsolat- és állapotteszt
```

A script minden futás végén ellenőrzi az oldalt (főoldal, `/impresszum`, `/galeria`, `/receptek`,
`/adatkezelesi-tajekoztato`, `sitemap.xml`, `robots.txt`, a Strapi `/admin`, és hogy a másik éles oldal
(bellawellfizio.hu) is válaszol-e). Hiba esetén nem nulla kilépési kóddal áll le.

## Mit csinál

**Frontend** (ez a repo, `eletkert` mappa): `npm run build` (vite build, 5 oldal: főoldal, galéria, receptek,
impresszum, adatkezelési tájékoztató) → feltöltés → atomi csere a `/var/www/eletkert` mappán. Az előző verzió
a `/var/www/eletkert.prev` mappában marad (`-Rollback` ezt cseréli vissza). A build a helyi `eletkert\.env`
fájlban lévő `VITE_API` értékét ágyazza be (már most is az éles `https://strapi.eletkertjudittal.hu`-ra mutat).

**Backend (Strapi, külön repo: `KeithNav/eletkertadmin`, alapértelmezett helye a gépen:
`..\Életkert_v2.0admin\eletkertadmin`):** `strapi build` → feltöltés → adatbázis-mentés
(`/root/backups/eletkert/data-*.db`, az utolsó 10 marad) → a kód cseréje → `npm ci --omit=dev` csak ha a
`package-lock.json` változott → `pm2 restart admin` → várakozás, amíg a `/admin` válaszol. **Nem küldi fel** és
nem írja felül: `.env`, `.tmp/data.db`, `public/uploads`. A tartalom (receptek, piacok, galéria stb.) az éles
admin felületen szerkesztendő (`https://strapi.eletkertjudittal.hu/admin`), nem a helyi adatbázisból.

Ha a backend más helyen van a gépeden, állítsd be az `ELETKERT_BACKEND_PATH` környezeti változót a teljes
elérési útra.

**nginx:** a `deploy\nginx-eletkert-frontend.conf` és `deploy\nginx-eletkert-strapi.conf` fájlok feltöltése a
szerveren a `/etc/nginx/sites-available/frontend` és `/etc/nginx/sites-available/strapi` helyére. Előtte mentés
készül (`/root/backups/eletkert/nginx-*-<idő>.conf`), `nginx -t` ellenőriz, és hibás konfig esetén a script
automatikusan visszaállítja a régit. A certbot által kezelt SSL sorok (`# managed by Certbot`) a fájlban
maradnak; a tanúsítvány megújítása nem érinti.

## Kulcs és hozzáférés

- A privát kulcs: `~/.ssh/eletkert_deploy` (Windows: `C:\Users\<felhasználó>\.ssh\eletkert_deploy`), a publikus
  párja a szerver `/root/.ssh/authorized_keys` fájljában van (`eletkert-deploy` megjegyzéssel).
- **A privát kulcs soha nem kerülhet a repóba** (a `.gitignore` tiltja a `*.local`/`.env`-szerű fájlokat; a
  kulcs amúgy sem a repóban van, hanem a felhasználó saját `~/.ssh` mappájában).
- Másik útvonal esetén: `ELETKERT_DEPLOY_KEY` környezeti változó.
- Kényelmi alias az `~/.ssh/config`-ban: `ssh eletkert`.

### Új gépen
1. Másold az `eletkert_deploy` fájlt a `~/.ssh/` mappába (jogosultság: csak a saját felhasználód olvashatja).
2. `ssh -i ~/.ssh/eletkert_deploy root@91.98.141.17 hostname` – első alkalommal fogadd el a host kulcsot.
3. `powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -CheckOnly`

### Kulcs cseréje / új kulcs
```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\eletkert_deploy -C "eletkert-deploy" -N '""'
# a publikus kulcsot (eletkert_deploy.pub) add hozzá a szerveren a /root/.ssh/authorized_keys fájlhoz,
# majd a régi sort töröld onnan.
```

## A szerver felépítése

| Mit | Hol |
|---|---|
| Frontend (statikus) | `/var/www/eletkert` |
| Strapi | `/root/apps/eletkertadmin`, `root` felhasználó, `127.0.0.1:1337`, PM2 `admin` folyamat (`pm2 list`) |
| nginx | `/etc/nginx/sites-available/frontend` és `/etc/nginx/sites-available/strapi` (HTTPS: certbot, automatikus megújítás) |
| Feltöltött képek | `/root/apps/eletkertadmin/public/uploads` |
| Adatbázis | `/root/apps/eletkertadmin/.tmp/data.db` (SQLite), mentések: `/root/backups/eletkert` |

**Ugyanezen a szerveren fut egy másik, éles oldal is – ahhoz nem szabad nyúlni:** `bellawellfizio.hu`
(`/var/www/bellawell`, nginx `sites-enabled/bellawellfizio`, Strapi `bellawell-strapi.service` a `:1338`-on,
`bellawell` felhasználó alatt), valamint egy Minecraft szerver (`:25565`, sok RAM-ot használ). A szerveren 2 GB
swap van.

## Backend deploy – fontos előfeltétel

A szerveren a Strapi **5.23** fut (`/root/apps/eletkertadmin`, az `origin/master` `ad21e6d` utáni állapota, `recept`
és `picture` API-val). A `-Target backend` a helyi mappa tartalmával **lecseréli** a szerver `src`, `config`,
`dist` stb. mappáit, ezért a script megáll, ha a helyi backend repo:
- nem tiszta (commitolatlan változás van benne), vagy
- le van maradva az `origin/<ág>` mögött.

A helyi `eletkertadmin` mappa jelenleg egy régi, eltérő ágon áll (Strapi 5.22, `repair2.0` commit, félkész
függőség-módosítások; a távoli `master` közben át lett írva). Backend deploy előtt a helyi mappát rendbe kell tenni
(pl. a félkész változtatások félretétele, majd a távoli `master` kicsekkolása), és ellenőrizni, hogy
`npm run build` helyben sikeresen lefut. A frontend deploy ettől független.
