import { escapeHtml, isUpcoming, dayKey } from './util.js';

const apiBaseUrl = import.meta.env.VITE_API;
const apiToken = import.meta.env.VITE_API_TOKEN;
const TIME_ZONE = 'Europe/Budapest';

const grid = document.querySelector('.markets-grid');
const mapElement = document.getElementById('map');

let mapPromise = null;
let upcoming = [];

// A térkép (Leaflet + csempék + geocoding) csak akkor töltődik be, ha a látogató odagörgetett vagy rákattintott egy piacra.
function loadMap() {
  if (!mapPromise) {
    mapPromise = import('./map.js').then(({ createMap }) =>
      createMap(upcoming, {
        container: mapElement,
        resetButton: document.getElementById('map-reset-btn')
      })
    );
  }
  return mapPromise;
}

function watchMapVisibility() {
  if (!mapElement) return;
  if (!('IntersectionObserver' in window)) {
    loadMap();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      loadMap();
    }
  }, { rootMargin: '400px' });
  observer.observe(mapElement);
}

function renderCard(item) {
  const date = new Date(item.date);
  const dateOnly = date.toLocaleDateString('hu-HU', { timeZone: TIME_ZONE, month: 'long', day: 'numeric' });
  const timeOnly = date.toLocaleTimeString('hu-HU', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
  const address = [item.street, item.houseNumber].filter(Boolean).join(' ');

  const card = document.createElement('div');
  card.className = 'market-card';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.innerHTML = `
    <svg class="market-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <div class="market-card-content">
      <div class="market-header">
        <h3 class="market-city">${escapeHtml(item.city)}</h3>
        <span class="market-date-badge">${escapeHtml(dateOnly)}</span>
      </div>
      <div class="market-details">
        <div class="market-name">${escapeHtml(item.marketName)}</div>
        ${address ? `<div class="market-address">${escapeHtml(address)}</div>` : ''}
        <div class="market-time">${escapeHtml(timeOnly)}</div>
      </div>
    </div>`;

  const focus = () => {
    mapElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    loadMap().then((map) => map.focus(item));
  };
  card.addEventListener('click', focus);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focus();
    }
  });
  return card;
}

// Hosszú városnévnél csökkentjük a betűméretet, hogy elférjen a dátum-címke mellett.
function fitCityNames() {
  grid.querySelectorAll('.market-card').forEach((card) => {
    const city = card.querySelector('.market-city');
    const header = card.querySelector('.market-header');
    const badge = card.querySelector('.market-date-badge');
    const gap = 12;
    if (city.scrollWidth + badge.offsetWidth + gap <= header.offsetWidth) return;

    let size = 1.25;
    for (let i = 0; i < 10 && size > 0.9; i++) {
      city.style.fontSize = `${size}rem`;
      if (city.scrollWidth + badge.offsetWidth + gap <= header.offsetWidth) break;
      size -= 0.05;
    }
  });
}

function showMessage(text) {
  grid.innerHTML = '';
  if (mapElement) mapElement.hidden = true;
  const message = document.createElement('p');
  message.className = 'markets-empty';
  message.textContent = text;
  grid.appendChild(message);
}

async function loadMarkets() {
  // A szerveroldali szűrés csak a lekérdezést szűkíti (egy nap ráhagyással); a pontos szűrés lent, magyar idő szerint történik.
  const since = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const url = `${apiBaseUrl}/api/piacoks?sort=date:asc&pagination[pageSize]=100&filters[date][$gte]=${since}`;

  try {
    const response = await fetch(url, { headers: { Authorization: apiToken } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { data } = await response.json();

    upcoming = (data || [])
      .filter((item) => isUpcoming(item))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (e) {
    showMessage('A piacok listája most nem érhető el. Kövess a Facebookon, ott is megtalálod, merre járok!');
    return;
  }

  if (upcoming.length === 0) {
    showMessage('Jelenleg nincs közelgő piac. Kövess a Facebookon, és értesülj elsőként az új időpontokról!');
    return;
  }

  grid.innerHTML = '';
  upcoming.forEach((item) => grid.appendChild(renderCard(item)));
  requestAnimationFrame(fitCityNames);
  watchMapVisibility();
}

if (grid) loadMarkets();
