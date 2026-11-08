<#
.SYNOPSIS
  Eletkert deploy az eles szerverre (eletkertjudittal.hu). Reszletek: DEPLOY.md

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1                 # frontend (alapertelmezett)
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target backend # Strapi (eletkertadmin)
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target nginx   # nginx site-ok (deploy\nginx-eletkert-*.conf)
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Target all
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Rollback       # elozo frontend verzio
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -CheckOnly      # csak kapcsolat- es allapotteszt
#>
[CmdletBinding()]
param(
  [ValidateSet('frontend', 'backend', 'nginx', 'all')][string]$Target = 'frontend',
  [switch]$Rollback,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

$Server = 'root@91.98.141.17'
$Site = 'https://eletkertjudittal.hu'
$StrapiSite = 'https://strapi.eletkertjudittal.hu'
$OtherSite = 'https://bellawellfizio.hu'
$Key = if ($env:ELETKERT_DEPLOY_KEY) { $env:ELETKERT_DEPLOY_KEY } else { Join-Path $HOME '.ssh\eletkert_deploy' }
$Root = Split-Path $PSScriptRoot -Parent
$FrontendDir = Join-Path $Root 'eletkert'
$BackendDir = $env:ELETKERT_BACKEND_PATH
if (-not $BackendDir) {
  # Ekezet nelkuli kereses: a script fajl kodolasa (BOM nelkuli UTF-8) miatt nem szerepelhet benne ekezetes mappanev.
  $adminRoot = Get-ChildItem (Split-Path $Root -Parent) -Directory -Filter '*v2.0admin' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($adminRoot) { $BackendDir = Join-Path $adminRoot.FullName 'eletkertadmin' }
}
$SshOpts = @('-i', $Key, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }

# Native programs write progress to stderr; only the exit code decides success.
# Output goes to the console (Out-Host) so it never mixes into function return values.
function Invoke-Native([string]$What, [scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Command | Out-Host
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($code -ne 0) { throw "$What sikertelen (kilepesi kod: $code)" }
}

# Runs a bash script on the server. The trailing comment absorbs the CR PowerShell appends to piped text.
function Invoke-Remote([string]$Script) {
  $payload = ($Script -replace "`r", '').TrimEnd() + "`n# end"
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $payload | & ssh @SshOpts $Server 'bash -s' | Out-Host
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($code -ne 0) { throw "A szerveren futtatott lepes sikertelen (kilepesi kod: $code)" }
}

function Send-File([string]$Local, [string]$Remote) {
  Invoke-Native 'Feltoltes (scp)' { scp @SshOpts $Local "${Server}:$Remote" }
}

function Get-StatusCode([string]$Url) {
  (curl.exe -s -o NUL -w '%{http_code}' $Url)
}

function Test-Site {
  Write-Step 'Ellenorzes az eles oldalon'
  $failed = $false
  foreach ($path in '/', '/impresszum', '/galeria', '/receptek', '/adatkezelesi-tajekoztato', '/sitemap.xml', '/robots.txt') {
    $code = Get-StatusCode "$Site$path"
    $ok = $code -eq '200'
    if (-not $ok) { $failed = $true }
    Write-Host ('  {0,-28} {1}' -f $path, $code) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
  }
  $redirects = @(
    @{ Url = "$Site/index.html"; Want = '301'; Label = '/index.html -> / (301)' },
    @{ Url = "$Site/galeria.html"; Want = '301'; Label = '/galeria.html -> /galeria (301)' },
    @{ Url = 'https://www.eletkertjudittal.hu/'; Want = '301'; Label = 'www -> apex (301)' },
    @{ Url = 'http://eletkertjudittal.hu/'; Want = '301'; Label = 'http -> https (301)' },
    @{ Url = "$Site/nincs-ilyen-oldal"; Want = '404'; Label = 'ismeretlen URL (404)' }
  )
  foreach ($c in $redirects) {
    $code = Get-StatusCode $c.Url
    $ok = $code -eq $c.Want
    if (-not $ok) { $failed = $true }
    Write-Host ('  {0,-28} {1}' -f $c.Label, $code) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
  }
  $admin = Get-StatusCode "$StrapiSite/admin"
  $adminOk = $admin -eq '200'
  if (-not $adminOk) { $failed = $true }
  Write-Host ('  {0,-28} {1}' -f 'strapi /admin', $admin) -ForegroundColor $(if ($adminOk) { 'Green' } else { 'Red' })
  $other = Get-StatusCode "$OtherSite/"
  Write-Host ('  bellawellfizio.hu (masik oldal)  {0}' -f $other) -ForegroundColor $(if ($other -eq '200') { 'Green' } else { 'Red' })
  if ($other -ne '200') { $failed = $true }
  if ($failed) { throw 'Az ellenorzes hibat talalt, nezd meg a fenti sorokat.' }
  Write-Host 'Minden rendben.' -ForegroundColor Green
}

function Deploy-Frontend {
  Write-Step 'Frontend build (vite build)'
  Push-Location $FrontendDir
  try {
    Invoke-Native 'npm run build' { npm run build }
  } finally {
    Pop-Location
  }

  $dist = Join-Path $FrontendDir 'dist'
  foreach ($page in 'index.html', 'galeria.html', 'receptek.html', 'impresszum.html', 'adatkezelesi-tajekoztato.html', '404.html') {
    if (-not (Test-Path (Join-Path $dist $page))) { throw "Hianyzik a dist\$page, a build nem keszult el teljesen." }
  }

  Write-Step 'Feltoltes'
  $archive = Join-Path $env:TEMP 'eletkert-frontend.tgz'
  Invoke-Native 'tar' { tar -czf $archive -C $dist . }
  try { Send-File $archive '/tmp/eletkert-frontend.tgz' } finally { Remove-Item $archive -ErrorAction SilentlyContinue }

  Write-Step 'Atomi csere a szerveren (az elozo verzio: /var/www/eletkert.prev)'
  Invoke-Remote @'
set -euo pipefail
NEW=/var/www/eletkert.new
rm -rf "$NEW"; mkdir -p "$NEW"
tar -xzf /tmp/eletkert-frontend.tgz -C "$NEW"
rm -f /tmp/eletkert-frontend.tgz
test -f "$NEW/index.html"
chown -R root:root "$NEW"
find "$NEW" -type d -exec chmod 755 {} +
find "$NEW" -type f -exec chmod 644 {} +
rm -rf /var/www/eletkert.prev
mv /var/www/eletkert /var/www/eletkert.prev
mv "$NEW" /var/www/eletkert
nginx -t
echo "frontend telepitve"
'@
}

function Deploy-Nginx {
  $frontendConf = Join-Path $Root 'deploy\nginx-eletkert-frontend.conf'
  $strapiConf = Join-Path $Root 'deploy\nginx-eletkert-strapi.conf'
  if (-not (Test-Path $frontendConf)) { throw "Nincs $frontendConf" }
  if (-not (Test-Path $strapiConf)) { throw "Nincs $strapiConf" }
  Write-Step 'nginx beallitasok feltoltese'
  Send-File $frontendConf '/tmp/eletkert-nginx-frontend.conf'
  Send-File $strapiConf '/tmp/eletkert-nginx-strapi.conf'
  Write-Step 'nginx frissitese (mentes, nginx -t, reload; hiba eseten visszaallitas)'
  Invoke-Remote @'
set -uo pipefail
mkdir -p /root/backups/eletkert
STAMP=$(date +%Y%m%d-%H%M%S)
FRONTEND_CONF=/etc/nginx/sites-available/frontend
STRAPI_CONF=/etc/nginx/sites-available/strapi
cp "$FRONTEND_CONF" "/root/backups/eletkert/nginx-frontend-$STAMP.conf"
cp "$STRAPI_CONF" "/root/backups/eletkert/nginx-strapi-$STAMP.conf"
ls -1t /root/backups/eletkert/nginx-frontend-*.conf 2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t /root/backups/eletkert/nginx-strapi-*.conf 2>/dev/null | tail -n +11 | xargs -r rm -f
cp /tmp/eletkert-nginx-frontend.conf "$FRONTEND_CONF"
cp /tmp/eletkert-nginx-strapi.conf "$STRAPI_CONF"
rm -f /tmp/eletkert-nginx-frontend.conf /tmp/eletkert-nginx-strapi.conf
if nginx -t; then
  systemctl reload nginx
  echo "nginx frissitve (mentes: /root/backups/eletkert/*-$STAMP.conf)"
else
  cp "/root/backups/eletkert/nginx-frontend-$STAMP.conf" "$FRONTEND_CONF"
  cp "/root/backups/eletkert/nginx-strapi-$STAMP.conf" "$STRAPI_CONF"
  nginx -t
  echo "HIBA: az uj nginx beallitas hibas, a regi vissza lett allitva"
  exit 1
fi
'@
  # A reload aszinkron: a regi workerek meg pillanatokig a regi konfiggal valaszolhatnak.
  Start-Sleep -Seconds 3
}

function Deploy-Backend {
  if (-not $BackendDir -or -not (Test-Path $BackendDir)) {
    throw "Nem talalom a backend (eletkertadmin) mappat.`nAllitsd be az ELETKERT_BACKEND_PATH kornyezeti valtozot a teljes eleresi utra."
  }
  Write-Step 'Backend repo ellenorzese (tiszta munkakonyvtar, nincs lemaradas az origin mogott)'
  Push-Location $BackendDir
  try {
    Invoke-Native 'git fetch' { git fetch origin }
    $dirty = git status --porcelain
    if ($dirty) { throw "A backend munkakonyvtar nem tiszta (commitold vagy stash-eld):`n$($dirty -join "`n")" }
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    $behind = (git rev-list --count "HEAD..origin/$branch").Trim()
    if ($behind -ne '0') { throw "A helyi $branch $behind committal le van maradva az origin/$branch mogott (git pull kell). Igy a deploy visszaallitana regebbi kodot az elesre." }
    $ahead = (git rev-list --count "origin/$branch..HEAD").Trim()
    if ($ahead -ne '0') { Write-Host "  Figyelem: $ahead nem pusholt commit is benne lesz a deployban." -ForegroundColor Yellow }
  } finally {
    Pop-Location
  }

  Write-Step 'Strapi build'
  $archive = Join-Path $env:TEMP 'eletkert-backend.tgz'
  Push-Location $BackendDir
  try {
    $env:NODE_ENV = 'production'
    Invoke-Native 'strapi build' { npm run build }

    $items = 'dist', 'config', 'database', 'public', 'src', 'types', 'package.json', 'package-lock.json', 'tsconfig.json', 'favicon.png' |
      Where-Object { Test-Path $_ }
    # Soha ne kuldd fel: .env, .tmp/data.db, public/uploads - ezek a szerveren elnek, nem a helyi repoban.
    Invoke-Native 'tar' { tar --exclude=public/uploads -czf $archive @items }
  } finally {
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Pop-Location
  }

  Write-Step 'Feltoltes'
  try { Send-File $archive '/tmp/eletkert-backend.tgz' } finally { Remove-Item $archive -ErrorAction SilentlyContinue }

  Write-Step 'Strapi frissitese (adatbazis-mentes + ujrainditas, PM2 "admin" folyamat)'
  Invoke-Remote @'
set -euo pipefail
APP=/root/apps/eletkertadmin
NEW=/tmp/eletkert-backend-new
rm -rf "$NEW"; mkdir -p "$NEW"
tar -xzf /tmp/eletkert-backend.tgz -C "$NEW"
rm -f /tmp/eletkert-backend.tgz
test -d "$NEW/dist"
mkdir -p /root/backups/eletkert
cp "$APP/.tmp/data.db" "/root/backups/eletkert/data-$(date +%Y%m%d-%H%M%S).db"
ls -1t /root/backups/eletkert/data-*.db | tail -n +11 | xargs -r rm -f
cd "$APP"
OLDLOCK=$(md5sum package-lock.json | cut -d' ' -f1)
for d in dist config database src types; do
  if [ -d "$NEW/$d" ]; then rm -rf "$d"; mv "$NEW/$d" "$d"; fi
done
mkdir -p public
cp -a "$NEW/public/." public/
for f in package.json package-lock.json tsconfig.json favicon.png; do
  if [ -f "$NEW/$f" ]; then cp -a "$NEW/$f" "$f"; fi
done
rm -rf "$NEW"
NEWLOCK=$(md5sum package-lock.json | cut -d' ' -f1)
if [ "$OLDLOCK" != "$NEWLOCK" ] || [ ! -d node_modules ]; then
  env NODE_ENV=production npm ci --omit=dev --no-audit --no-fund
fi
pm2 restart admin
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1337/admin || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
if [ "$code" != "200" ]; then
  pm2 logs admin --lines 40 --nostream
  echo "A Strapi nem indult el (HTTP $code). Az adatbazis-mentes: /root/backups/eletkert"
  exit 1
fi
echo "strapi fut"
'@
}

if (-not (Test-Path $Key)) {
  throw "Nem talalom a deploy kulcsot: $Key`nMasold oda az eletkert_deploy fajlt (lasd DEPLOY.md), vagy allitsd be az ELETKERT_DEPLOY_KEY kornyezeti valtozot."
}

Write-Step 'Kapcsolat a szerverrel'
Invoke-Remote 'echo "kapcsolat ok: $(hostname)"; systemctl is-active nginx; pm2 jlist | grep -q "\"name\":\"admin\"" && echo "pm2 admin: ismert"'

if ($CheckOnly) {
  Test-Site
  return
}

if ($Rollback) {
  Write-Step 'Frontend visszaallitasa az elozo verziora'
  Invoke-Remote @'
set -euo pipefail
test -d /var/www/eletkert.prev
mv /var/www/eletkert /var/www/eletkert.swap
mv /var/www/eletkert.prev /var/www/eletkert
mv /var/www/eletkert.swap /var/www/eletkert.prev
echo "visszaallitva"
'@
  Test-Site
  return
}

if ($Target -in 'backend', 'all') { Deploy-Backend }
if ($Target -in 'frontend', 'all') { Deploy-Frontend }
if ($Target -in 'nginx', 'all') { Deploy-Nginx }
Test-Site
