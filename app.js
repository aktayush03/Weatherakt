const q = document.getElementById('q');
const findBtn = document.getElementById('findBtn');
const gpsBtn = document.getElementById('gpsBtn');
const suggestions = document.getElementById('suggestions');

const cityTitle = document.getElementById('cityTitle');
const tempEl = document.getElementById('temp');
const descEl = document.getElementById('desc');
const windEl = document.getElementById('wind');
const humidityEl = document.getElementById('humidity');
const updatedEl = document.getElementById('updated');
const forecastGrid = document.getElementById('forecastGrid');

let lastCoords = null;
let refreshTimer = null;

function fmtDate(d){ return new Date(d).toLocaleString(); }

async function searchCities(name){
  if(!name || name.length < 2){ suggestions.innerHTML=''; return; }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  suggestions.innerHTML = '';
  (data.results || []).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = `${item.name}, ${item.admin1 ?? ''} ${item.country}`;
    li.onclick = ()=> {
      suggestions.innerHTML='';
      q.value = li.textContent;
      loadWeather(item.latitude, item.longitude, li.textContent);
    };
    suggestions.appendChild(li);
  });
}

async function loadWeather(lat, lon, label=''){
  lastCoords = {lat, lon, label};
  // current + daily forecast (7 days)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();

  // Current
  const c = data.current;
  tempEl.textContent = Math.round(c.temperature_2m);
  windEl.textContent = Math.round(c.wind_speed_10m);
  humidityEl.textContent = Math.round(c.relative_humidity_2m);
  descEl.textContent = codeToText(c.weather_code);
  updatedEl.textContent = fmtDate(c.time);
  cityTitle.textContent = label || `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;

  // Forecast
  const d = data.daily;
  forecastGrid.innerHTML = '';
  for(let i=0;i<d.time.length;i++){
    const card = document.createElement('div');
    card.className = 'card';
    const day = new Date(d.time[i]).toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
    card.innerHTML = `
      <div><strong>${day}</strong></div>
      <div style="font-size:0.95rem">${codeToText(d.weather_code[i])}</div>
      <div style="margin-top:6px">${Math.round(d.temperature_2m_min[i])}°C — <strong>${Math.round(d.temperature_2m_max[i])}°C</strong></div>
    `;
    forecastGrid.appendChild(card);
  }

  // Auto-refresh every 5 minutes
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(()=> {
    loadWeather(lastCoords.lat, lastCoords.lon, lastCoords.label);
  }, 5*60*1000);
}

function codeToText(code){
  // minimal mapping
  const map = {
    0:'Clear', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
    45:'Fog', 48:'Rime fog',
    51:'Drizzle', 53:'Drizzle', 55:'Drizzle',
    61:'Rain', 63:'Rain', 65:'Heavy rain',
    71:'Snow', 73:'Snow', 75:'Heavy snow',
    80:'Rain showers', 81:'Rain showers', 82:'Violent showers',
    95:'Thunderstorm', 96:'Thunderstorm (hail)', 99:'Thunderstorm (hail)'
  };
  return map[code] ?? '—';
}

// Events
findBtn.onclick = ()=> searchCities(q.value.trim());
q.addEventListener('input', ()=> searchCities(q.value.trim()));
gpsBtn.onclick = ()=> {
  if(!navigator.geolocation){ alert('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    async (pos)=>{
      const {latitude, longitude} = pos.coords;
      // Reverse geocode for label
      const rev = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en`);
      const rj = await rev.json();
      const label = rj && rj.results && rj.results[0] ? `${rj.results[0].name}, ${rj.results[0].country}`: 'My Location';
      loadWeather(latitude, longitude, label);
    },
    (err)=> alert('Location permission denied')
  );
};