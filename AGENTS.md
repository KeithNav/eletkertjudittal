# Életkert – útmutató ügynököknek

Statikus, több oldalas Vite frontend (`eletkert` mappa) + külön repóban élő Strapi 4 backend (`eletkertadmin`,
`KeithNav/eletkertadmin`). Éles oldal: https://eletkertjudittal.hu · API: https://strapi.eletkertjudittal.hu

## Deploy az éles szerverre

Amikor a felhasználó deployt kér, használd a scriptet – ne írj saját SSH/scp parancsokat:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1                  # frontend
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target backend  # Strapi (ujrainditja, adatbazis-mentes keszul)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target nginx    # nginx beallitas (deploy\nginx-eletkert-*.conf; mentes + nginx -t + reload)
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Rollback        # elozo frontend verzio
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -CheckOnly       # allapotteszt
```

- A script a kulcsot a `~/.ssh/eletkert_deploy` fájlból olvassa (vagy az `ELETKERT_DEPLOY_KEY` változóból). Ha
  hiányzik, mondd meg a felhasználónak; a kulcsot ne generáld újra és ne keress vele kerülőutat.
- A backend repo alapértelmezetten a `..\Életkert_v2.0admin\eletkertadmin` mappában van (az `ELETKERT_BACKEND_PATH`
  változóval felülírható). A script megáll, ha a backend repo nem tiszta vagy le van maradva az origin mögött
  (az éles Strapi 5.23, a helyi mappa jelenleg régi ágon áll – lásd DEPLOY.md „Backend deploy”). Ne kerüld meg ezt a
  védelmet: a deploy a szerver kódját a helyi mappa tartalmára cseréli.
- Csak akkor deployolj, ha a felhasználó kéri. A deploy után a script kimenete mutatja az ellenőrzést; ha hibát
  jelez, jelezd.
- Teljes leírás (szerver felépítése, kulcs, új gép): [DEPLOY.md](DEPLOY.md).

## Szabályok

- **A privát kulcsot, jelszavakat, a szerver `.env`-jét soha ne commitold és ne írd a repóba.**
- A szerveren **másik éles oldal is fut** (`bellawellfizio.hu`, saját nginx site-ok, `bellawell-strapi` systemd
  szolgáltatás, Minecraft szerver). Ezeket ne módosítsd, ne indítsd újra. Az nginx-ben csak az eletkert
  site-okhoz (`frontend`, `strapi`) nyúlj, és előbb mindig `nginx -t`.
- A tartalom (receptek, piacok, galéria) az éles Strapi adatbázisban van. A helyi `eletkertadmin\.tmp\data.db`-t
  ne töltsd fel az éles szerverre.

## Fejlesztés

```powershell
cd eletkert; npm install; npm run dev      # http://localhost:5176
npm run build                              # vite build (dist\), ugyanez fut a deploy elott
```

- Az `eletkert\.env` tartalmazza a `VITE_API` (Strapi URL) és `VITE_API_TOKEN` értékeket; ez már az éles API-ra
  mutat, nem kell módosítani build előtt.
- Felépítés: `src\common.js` (menü, görgetés; minden oldalon), `src\script.js` (főoldal belépési pont),
  `src\markets.js` (piac-kártyák), `src\map.js` (Leaflet; csak akkor töltődik be, ha a térkép közel kerül a
  látható területhez vagy rákattintanak egy piacra). Betűtípusok: `@fontsource` (saját szerverről, nincs Google Fonts).
- **Piacok:** csak a mai vagy későbbi (magyar idő szerinti) napra eső tételek jelennek meg, a múltbeliek nem – akkor
  sem, ha a backendben még szerepelnek (`src\util.js` `isUpcoming`, az API-lekérdezés is szűr).
- Minden oldal `<head>`-jében egyedi `title`/`description`, `canonical`, Open Graph; a főoldalon JSON-LD
  (`WebSite`, `Organization`). Új oldalnál ezeket is töltsd ki, és vedd fel a `public\sitemap.xml`-be
  (hash-es `#...` URL-ek nem kellenek a sitemapbe).
- Új oldal (route) esetén vedd fel a `vite.config.js` `rollupOptions.input` listájába, a `public\sitemap.xml`-be és az
  `deploy\nginx-eletkert-frontend.conf` `.html` -> kiterjesztés nélküli átirányítási listájába; az nginx a
  `try_files $uri $uri/ $uri.html` szabállyal a `/<oldal>` URL-t a `<oldal>.html` fájlból szolgálja ki.
