import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

const lightbox = new PhotoSwipeLightbox({
  gallery: '#my-gallery',
  children: 'a',
  showHideAnimationType: 'zoom',
  showAnimationDuration: 250,
  hideAnimationDuration: 250,
  pswpModule: () => import('photoswipe')
});
lightbox.init();

const apiBaseUrl = import.meta.env.VITE_API;
const apiToken = import.meta.env.VITE_API_TOKEN;

document.addEventListener("DOMContentLoaded", function() {
  // Smooth scroll: minden belső horgony linkre (nav + footer)
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const hash = this.getAttribute('href');
      const targetId = hash.slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.pageYOffset - 10;
      window.scrollTo({ top: y, behavior: 'smooth' });

      // URL frissítése ugrás nélkül
      history.replaceState(null, '', hash);
    });
  });
    

    const scrollBtn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 200) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    
  // Vegburger mobil menü
  const vegburger = document.querySelector('.vegburger');
  const mobileMenu = document.querySelector('#mobile-menu');
  const backdrop = document.querySelector('.menu-backdrop');

  function openMenu() {
    mobileMenu.classList.add('open');
    vegburger.classList.add('open');
    vegburger.setAttribute('aria-expanded', 'true');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    vegburger.classList.remove('open');
    vegburger.setAttribute('aria-expanded', 'false');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  }
  function toggleMenu() {
    if (mobileMenu.classList.contains('open')) closeMenu(); else openMenu();
  }

  vegburger.addEventListener('click', toggleMenu);
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // Bezárás kattintásra a mobil nav linkre
  mobileMenu.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      if(window.innerWidth <= 768) closeMenu();
    });
  });

  // Ha visszanagyítunk desktopra, menü zárása és overlay eltüntetése
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
});


fetch(`${apiBaseUrl}/api/piacoks`, {
    method: "GET",
    headers: {
        "Authorization": apiToken
    }
    // …
  }).then(res=>res.json()).then(res=>{
    const marketsGrid = document.querySelector(".markets-grid"); 
    marketsGrid.innerHTML = ""; // előző törlése, ha frissíted
    
    // Dátum szerint növekvő sorrendbe rendezés
    const sortedData = res.data.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB; // növekvő sorrend (korábbi dátumok előbb)
    });
    
    // Tároljuk el a város koordinátákat a linkekhez
    const cityLinksData = {};
    
    sortedData.forEach(item => {
        // dátum formázás emberibbé
        const fullDate = new Date(item.date);
        const dateOnly = fullDate.toLocaleDateString("hu-HU", {
          month: "long",
          day: "numeric"
        });
        const timeOnly = fullDate.toLocaleTimeString("hu-HU", {
          hour: "2-digit",
          minute: "2-digit"
        });

        // Market card létrehozása
        const marketCard = document.createElement("div");
        marketCard.className = "market-card";
        marketCard.style.position = "relative";
        
        // Tároljuk a város adatait későbbi használatra
        cityLinksData[item.city] = {
          coords: cityCoordinates[item.city] || null,
          needsGeocoding: !cityCoordinates[item.city]
        };

        // Utca címe
        const address = item.street ? item.street : '';
        
        marketCard.innerHTML = `
            <svg class="market-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <div class="market-card-content">
                <div class="market-header">
                    <h3 class="market-city">${item.city}</h3>
                    <span class="market-date-badge">${dateOnly}</span>
                </div>
                <div class="market-details">
                    <div class="market-name">${item.marketName}</div>
                    ${address ? `<div class="market-address">${address}</div>` : ''}
                    <div class="market-time">${timeOnly}</div>
                </div>
            </div>
        `;
        
        marketsGrid.appendChild(marketCard);
        
        // Dinamikus betűméret-csökkentés, ha a városnév túl hosszú
        const cityElement = marketCard.querySelector('.market-city');
        const headerElement = marketCard.querySelector('.market-header');
        const dateBadge = marketCard.querySelector('.market-date-badge');
        
        // Várunk egy kicsit, hogy a DOM renderelődjön
        requestAnimationFrame(() => {
          const headerWidth = headerElement.offsetWidth;
          const cityWidth = cityElement.scrollWidth;
          const badgeWidth = dateBadge.offsetWidth;
          const gap = 12; // gap a header-ben
          
          // Ha a városnév + dátum buborék + gap nem fér ki
          if (cityWidth + badgeWidth + gap > headerWidth) {
            // Csökkentjük a betűméretet fokozatosan
            let fontSize = 1.25;
            cityElement.style.fontSize = `${fontSize}rem`;
            
            // Maximum 5 iteráció, hogy ne legyen végtelen ciklus
            let iterations = 0;
            while (cityElement.scrollWidth + badgeWidth + gap > headerWidth && fontSize > 0.9 && iterations < 10) {
              fontSize -= 0.05;
              cityElement.style.fontSize = `${fontSize}rem`;
              iterations++;
            }
          }
        });
        
        // Hover effekt és kattintás kezelés az egész card-ra
        marketCard.addEventListener("mouseenter", () => {
          marketCard.style.transform = "translateY(-4px)";
          marketCard.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
        });
        
        marketCard.addEventListener("mouseleave", () => {
          marketCard.style.transform = "";
          marketCard.style.boxShadow = "";
        });
        
        marketsGrid.appendChild(marketCard);
      });

    // Kattintás események hozzáadása a market card-okhoz
    Object.keys(cityLinksData).forEach(cityName => {
      const marketCard = [...marketsGrid.querySelectorAll('.market-card')].find(card => 
        card.querySelector('.market-city').textContent === cityName
      );
      if (marketCard) {
        marketCard.style.cursor = 'pointer';
        marketCard.addEventListener('click', (e) => {
          e.preventDefault();
          
          const cityData = cityLinksData[cityName];
          if (cityData.coords) {
            // Ha van koordináta, zoomolunk rá nagyobb zoommal
            map.setView([cityData.coords.lat, cityData.coords.lon], 16);
            
            // Megnyitjuk a marker popup-ját
            if (window.cityMarkers && window.cityMarkers[cityName]) {
              const markers = window.cityMarkers[cityName];
              if (markers.length > 0) {
                // A marker koordinátáira zoomolunk, nem a város koordinátáira
                const marker = markers[0];
                const markerLatLng = marker.getLatLng();
                map.setView([markerLatLng.lat, markerLatLng.lng], 16);
                
                // Popup megnyitása rövidebb késleltetéssel
                setTimeout(() => {
                  marker.openPopup();
                }, 200); // Rövidebb késleltetés a jobb UX érdekében
              }
            }
          } else if (cityData.needsGeocoding) {
            // Ha nincs koordináta, geocodoljuk
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}, Hungary&limit=1`)
              .then(resp => resp.json())
              .then(data => {
                if (data && data.length > 0) {
                  const lat = parseFloat(data[0].lat);
                  const lon = parseFloat(data[0].lon);
                  
                  // Eltároljuk a koordinátát később használatra
                  cityLinksData[cityName].coords = { lat, lon };
                  cityLinksData[cityName].needsGeocoding = false;
                  
                  // Zoomolunk a városra nagyobb zoommal
                  map.setView([lat, lon], 16);
                  
                  // Popup megnyitása geocoding után is
                  if (window.cityMarkers && window.cityMarkers[cityName]) {
                    const markers = window.cityMarkers[cityName];
                    if (markers.length > 0) {
                      // A marker pontos koordinátáira zoomolunk
                      const marker = markers[0];
                      const markerLatLng = marker.getLatLng();
                      map.setView([markerLatLng.lat, markerLatLng.lng], 16);
                      
                      setTimeout(() => {
                        marker.openPopup();
                      }, 200);
                    }
                  }
                } else {
                  // Nem található város - silent fail for production
                }
              })
              .catch(err => {
                // Geocoding hiba - silent fail for production
              });
          }
        });
      }
    });
    })
    .catch(err => {
      // API hiba - silent fail for production
    });

    // Alap térkép beállítás
const map = L.map('map', {
  scrollWheelZoom: false,
  dragging: window.innerWidth > 900,
  tap: window.innerWidth > 900, 
  touchZoom: true
}).setView([47.6825, 17.6333], 8.5);

// Térkép alaphelyzet tárolása a reset gombhoz
const DEFAULT_MAP_VIEW = {
  center: [47.6825, 17.6333],
  zoom: 8.5
};

// Reset gomb eseménykezelő
document.getElementById('map-reset-btn').addEventListener('click', () => {
  map.setView(DEFAULT_MAP_VIEW.center, DEFAULT_MAP_VIEW.zoom);
  // Minden popup bezárása
  map.closePopup();
});
function updateMapTouch() {
  if (window.innerWidth <= 900) {
    map.dragging.disable();
    map.tap && map.tap.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.enable(); // csak pinch
  } else {
    map.dragging.enable();
    map.tap && map.tap.enable();
    map.scrollWheelZoom.disable();
    map.touchZoom.enable();
  }
}
window.addEventListener('resize', updateMapTouch);
updateMapTouch();

// Csak Ctrl/Meta nyomva tartásakor engedélyezzük a görgős zoomot
const enableWheel = () => map.scrollWheelZoom.enable();
const disableWheel = () => map.scrollWheelZoom.disable();

window.addEventListener('keydown', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') enableWheel();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Control' || e.key === 'Meta') disableWheel();
});
window.addEventListener('blur', disableWheel);
map.getContainer().addEventListener('mouseleave', disableWheel);

// OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Előre geocodolt magyar városok (gyors cache)
const cityCoordinates = {
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

// Geocoding gyorsítótár (localStorage-ben tárolva)
const GEOCODE_CACHE_KEY = 'eletkert_geocode_cache';
const CACHE_EXPIRY_DAYS = 30; // 30 napig érvényes a cache

function getGeocodingCache() {
  try {
    const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      const now = Date.now();
      // Ellenőrizzük, hogy nem járt-e le a cache
      if (data.expiry > now) {
        return data.cache || {};
      }
    }
  } catch (e) {
    // Cache olvasási hiba - silent fail for production
  }
  return {};
}

function saveGeocodingCache(cache) {
  try {
    const expiry = Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify({
      cache: cache,
      expiry: expiry
    }));
  } catch (e) {
    // Cache mentési hiba - silent fail for production
  }
}

async function geocodeWithCache(searchQuery) {
  const cache = getGeocodingCache();
  
  // Ha már van cache-ben, azonnal visszaadjuk
  if (cache[searchQuery]) {
    return cache[searchQuery];
  }
  
  // Ha nincs cache-ben, geocodoljuk
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}, Hungary&limit=1`);
    const data = await response.json();
    
    const result = data && data.length > 0 ? 
      { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    
    // Mentjük a cache-be
    cache[searchQuery] = result;
    saveGeocodingCache(cache);
    
    return result;
  } catch (error) {
    // Geocoding hiba - silent fail for production
    return null;
  }
}

// Piacok betöltése Strapi-ból
fetch(`${apiBaseUrl}/api/piacoks`, {
  method: "GET",
  headers: {
    "Authorization": apiToken
  }
})
  .then(res => res.json())
  .then(async res => {
    // Dátum szerint növekvő sorrendbe rendezés a térképhez is
    const sortedData = res.data.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB; // növekvő sorrend (korábbi dátumok előbb)
    });
    
    // Marker referenciák tárolása városonként
    const cityMarkers = {};

    // Optimalizált geocoding - fokozatos marker megjelenítés
    // Először próbáljuk a cache-ből, majd aszinkron geocodoljuk a többit
    
    const processItem = async (item, index) => {
      const city = item.city;
      const street = item.street || '';
      const houseNumber = item.houseNumber || '';
      
      // Keresési lekérdezés felépítése
      let searchQuery = city;
      if (street) {
        searchQuery = `${street}, ${city}`;
        if (houseNumber) {
          searchQuery = `${street} ${houseNumber}, ${city}`;
        }
      }
      
      // Geocoding cache-szel
      let coords = await geocodeWithCache(searchQuery);
      
      // Fallback ha nem találta a pontos címet
      if (!coords && street) {
        coords = await geocodeWithCache(city);
      }
      
      // Ha van koordináta, rögtön hozzáadjuk a markert
      if (coords) {
        const formattedDate = new Date(item.date).toLocaleDateString("hu-HU");
        const marker = L.marker([coords.lat, coords.lon]).addTo(map);
        const streetInfo = street ? `<br>Utca: ${street}` : '';
        
        marker.bindPopup(`
          <strong>${item.marketName}</strong><br>
          Város: ${city}${streetInfo}<br>
          Dátum: ${formattedDate}
        `);
        
        // Tároljuk a markert a városhoz
        if (!cityMarkers[city]) {
          cityMarkers[city] = [];
        }
        cityMarkers[city].push(marker);
      }
    };
    
    // Első körben a cache-ből azonnal hozzáadjuk a markereket
    const cachePromises = sortedData.map((item, index) => processItem(item, index));
    
    // Kis késleltetéssel dolgozzuk fel őket, hogy ne blokkoljuk a UI-t
    for (let i = 0; i < cachePromises.length; i += 3) {
      // 3-asával dolgozzuk fel párhuzamosan
      const batch = cachePromises.slice(i, i + 3);
      await Promise.all(batch);
      
      // Kis szünet a batch-ek között, hogy ne túlterheljük a nominatim API-t
      if (i + 3 < cachePromises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Globális hozzáférés a marker referenciákhoz
    window.cityMarkers = cityMarkers;
  });

