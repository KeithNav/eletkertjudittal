import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { escapeHtml, formatDate } from './util.js';

// A bundlerrel az alapértelmezett jelölő-ikon útvonala elromlik, ezért kézzel adjuk meg.
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
});

const DEFAULT_VIEW = { center: [47.6825, 17.6333], zoom: 8.5 };

// Előre ismert városok: nem kell hozzájuk geocoding, ha nincs pontos utca.
const CITY_COORDINATES = {
  'Budapest': { lat: 47.4979, lon: 19.0402 },
  'Debrecen': { lat: 47.5316, lon: 21.6273 },
  'Szeged': { lat: 46.2530, lon: 20.1414 },
  'Miskolc': { lat: 48.1036, lon: 20.7784 },
  'Pécs': { lat: 46.0727, lon: 18.2329 },
  'Győr': { lat: 47.6875, lon: 17.6504 },
  'Nyíregyháza': { lat: 47.9565, lon: 21.7172 },
  'Kecskemét': { lat: 46.9069, lon: 19.6925 },
  'Székesfehérvár': { lat: 47.1903, lon: 18.4092 },
  'Szombathely': { lat: 47.2306, lon: 16.6218 },
  'Szolnok': { lat: 47.1817, lon: 20.1992 },
  'Tatabánya': { lat: 47.5692, lon: 18.3981 },
  'Kaposvár': { lat: 46.3661, lon: 17.7956 },
  'Érd': { lat: 47.3964, lon: 18.9195 },
  'Veszprém': { lat: 47.0930, lon: 17.9093 },
  'Békéscsaba': { lat: 46.6758, lon: 21.0951 },
  'Zalaegerszeg': { lat: 46.8456, lon: 16.8443 },
  'Sopron': { lat: 47.6850, lon: 16.5900 },
  'Eger': { lat: 47.9028, lon: 20.3707 },
  'Nagykanizsa': { lat: 46.4613, lon: 16.9902 },
  'Dunaszeg': { lat: 47.7517, lon: 17.4536 },
  'Kunsziget': { lat: 47.7712, lon: 17.4282 }
};

const GEOCODE_CACHE_KEY = 'eletkert_geocode_cache';
const CACHE_EXPIRY_DAYS = 30;

function readGeocodeCache() {
  try {
    const data = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || 'null');
    if (data && data.expiry > Date.now()) return data.cache || {};
  } catch (e) {
    // sérült vagy nem elérhető cache: újra geocodolunk
  }
  return {};
}

function writeGeocodeCache(cache) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify({
      cache,
      expiry: Date.now() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    }));
  } catch (e) {
    // nincs hely vagy tiltott tároló: nem kritikus
  }
}

async function geocode(query) {
  const cache = readGeocodeCache();
  if (cache[query]) return cache[query];

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Hungary&limit=1`);
    const data = await response.json();
    if (!data || data.length === 0) return null;

    const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    cache[query] = result;
    writeGeocodeCache(cache);
    return result;
  } catch (e) {
    return null;
  }
}

async function locate(item) {
  const street = item.street || '';
  const city = item.city;
  if (!street && CITY_COORDINATES[city]) return CITY_COORDINATES[city];

  const house = item.houseNumber ? ` ${item.houseNumber}` : '';
  const query = street ? `${street}${house}, ${city}` : city;
  return (await geocode(query)) || (street ? await geocode(city) : null);
}

export function createMap(items, { container, resetButton }) {
  const isWide = () => window.innerWidth > 900;
  const map = L.map(container, {
    scrollWheelZoom: false,
    dragging: isWide(),
    tap: isWide(),
    touchZoom: true
  }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
      map.closePopup();
    });
  }

  // Mobilon az oldal görgetését nem fogja el a térkép; csak csippentéssel zoomolható.
  const updateTouch = () => {
    if (isWide()) {
      map.dragging.enable();
      if (map.tap) map.tap.enable();
    } else {
      map.dragging.disable();
      if (map.tap) map.tap.disable();
    }
    map.scrollWheelZoom.disable();
    map.touchZoom.enable();
  };
  window.addEventListener('resize', updateTouch);
  updateTouch();

  // Görgős zoom csak Ctrl/Meta nyomva tartva.
  window.addEventListener('keydown', (e) => { if (e.key === 'Control' || e.key === 'Meta') map.scrollWheelZoom.enable(); });
  window.addEventListener('keyup', (e) => { if (e.key === 'Control' || e.key === 'Meta') map.scrollWheelZoom.disable(); });
  window.addEventListener('blur', () => map.scrollWheelZoom.disable());
  map.getContainer().addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  const markers = new Map();

  const addMarker = async (item) => {
    const coords = await locate(item);
    if (!coords) return;

    const street = item.street ? `<br>Utca: ${escapeHtml(item.street)}` : '';
    const marker = L.marker([coords.lat, coords.lon]).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(item.marketName)}</strong><br>` +
      `Város: ${escapeHtml(item.city)}${street}<br>` +
      `Dátum: ${escapeHtml(formatDate(item.date))}`
    );
    markers.set(item.id, marker);
  };

  // Háromasával geocodolunk, hogy ne terheljük túl a Nominatimot.
  const loading = (async () => {
    for (let i = 0; i < items.length; i += 3) {
      const batch = items.slice(i, i + 3);
      await Promise.all(batch.map(addMarker));
      if (i + 3 < items.length) await new Promise((resolve) => setTimeout(resolve, 100));
    }
  })();

  return {
    async focus(item) {
      await loading;
      const marker = markers.get(item.id);
      if (!marker) return;
      map.setView(marker.getLatLng(), 16);
      setTimeout(() => marker.openPopup(), 200);
    }
  };
}
