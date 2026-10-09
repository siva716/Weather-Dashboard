
const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";

const $ = (id) => document.getElementById(id);

const elements = {
  form: $("searchForm"),
  input: $("cityInput"),
  locationBtn: $("locationBtn"),
  refreshBtn: $("refreshBtn"),
  status: $("statusMessage"),
  dashboard: $("dashboard"),
  city: $("cityName"),
  subtitle: $("locationSubtitle"),
  localTime: $("localTime"),
  heroIcon: $("heroIcon"),
  temperature: $("temperature"),
  condition: $("condition"),
  feelsLike: $("feelsLike"),
  date: $("todayDate"),
  daySummary: $("daySummary"),
  humidity: $("humidity"),
  humidityCaption: $("humidityCaption"),
  wind: $("wind"),
  windCaption: $("windCaption"),
  uv: $("uvIndex"),
  uvCaption: $("uvCaption"),
  visibility: $("visibility"),
  hourly: $("hourlyGrid"),
  forecast: $("forecastList")
};

let currentLocation = null;
let latestWeather = null;

const weatherTypes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Moderate snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm", "⛈️"]
};

function weatherInfo(code, isDay = true) {
  const result = weatherTypes[code] || ["Unknown conditions", "🌡️"];
  if (code === 0 && !isDay) return ["Clear night", "🌙"];
  if (code === 1 && !isDay) return ["Mainly clear night", "🌙"];
  if (code === 2 && !isDay) return ["Partly cloudy night", "☁️"];
  return result;
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status-message ${type}`.trim();
}

function formatDay(dateString, options = { weekday: "short" }) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-IN", options);
}

function formatHour(dateString) {
  const hour = Number(dateString.slice(11, 13));
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function safeNumber(value, digits = 0) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "--";
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service returned an error (${response.status}). Please try again.`);
  }
  return response.json();
}

async function findCity(query) {
  const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const data = await fetchJSON(url);

  if (!data.results?.length) {
    throw new Error("We couldn't find that city. Check the spelling and try again.");
  }

  const city = data.results[0];
  return {
    name: city.name,
    admin: city.admin1 || "",
    country: city.country || "",
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone || "auto"
  };
}

async function getWeather(location) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone || "auto",
    forecast_days: "7",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "visibility"
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "weather_code",
      "is_day",
      "uv_index"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "uv_index_max",
      "precipitation_probability_max"
    ].join(",")
  });

  return fetchJSON(`${API_BASE}?${params.toString()}`);
}

function renderWeather(location, data) {
  if (!data.current || !data.daily || !data.hourly) {
    throw new Error("Weather data is incomplete. Please refresh and try again.");
  }

  currentLocation = location;
  latestWeather = data;

  const current = data.current;
  const currentDay = data.daily;
  const info = weatherInfo(current.weather_code, current.is_day === 1);

  elements.city.textContent = location.name;
  elements.subtitle.textContent = [location.admin, location.country].filter(Boolean).join(", ");
  elements.localTime.textContent = `Local time · ${new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: data.timezone || "UTC"
  }).format(new Date())}`;

  elements.heroIcon.textContent = info[1];
  elements.temperature.innerHTML = `${safeNumber(current.temperature_2m)}<span>°</span>`;
  elements.condition.textContent = info[0];
  elements.feelsLike.textContent = `${safeNumber(current.apparent_temperature)}°C`;
  elements.date.textContent = formatDay(current.time.slice(0, 10), {
    weekday: "long",
    day: "numeric",
    month: "short"
  });
  elements.daySummary.textContent = current.precipitation > 0
    ? `${safeNumber(current.precipitation, 1)} mm precipitation`
    : "Current conditions";

  elements.humidity.innerHTML = `${safeNumber(current.relative_humidity_2m)}<span>%</span>`;
  elements.humidityCaption.textContent =
    current.relative_humidity_2m >= 70 ? "High moisture in the air" :
    current.relative_humidity_2m <= 35 ? "Dry air" : "Moderate moisture";

  elements.wind.innerHTML = `${safeNumber(current.wind_speed_10m)}<span> km/h</span>`;
  elements.windCaption.textContent =
    current.wind_speed_10m >= 30 ? "Breezy conditions" : "Current wind speed";

  const dayIndex = Math.max(0, currentDay.time.indexOf(current.time.slice(0, 10)));
  const uv = currentDay.uv_index_max?.[dayIndex];
  elements.uv.textContent = safeNumber(uv, 1);
  elements.uvCaption.textContent =
    uv < 3 ? "Low intensity" : uv < 6 ? "Moderate intensity" :
    uv < 8 ? "High intensity" : "Very high intensity";

  const visibilityKm = Number.isFinite(current.visibility)
    ? current.visibility / 1000 : NaN;
  elements.visibility.innerHTML = `${safeNumber(visibilityKm, 1)}<span> km</span>`;

  renderHourly(data);
  renderForecast(data.daily);

  elements.dashboard.classList.add("visible");
  setStatus("");
}

function renderHourly(data) {
  const hourly = data.hourly;
  const currentTime = data.current.time;
  let start = hourly.time.findIndex(time => time >= currentTime);
  if (start < 0) start = 0;

  const cards = hourly.time.slice(start, start + 24).filter((_, index) => index % 3 === 0);

  elements.hourly.innerHTML = cards.map(time => {
    const index = hourly.time.indexOf(time);
    const info = weatherInfo(hourly.weather_code[index], hourly.is_day[index] === 1);
    const rain = hourly.precipitation_probability?.[index];
    return `
      <article class="hour-card">
        <span class="hour-time">${index === start ? "Now" : formatHour(time)}</span>
        <span class="hour-icon" aria-label="${info[0]}">${info[1]}</span>
        <span class="hour-temp">${safeNumber(hourly.temperature_2m[index])}°</span>
        <span class="hour-rain">${Number.isFinite(rain) ? `${rain}% rain` : ""}</span>
      </article>
    `;
  }).join("");
}

function renderForecast(daily) {
  elements.forecast.innerHTML = daily.time.map((date, index) => {
    const info = weatherInfo(daily.weather_code[index]);
    const high = daily.temperature_2m_max[index];
    const low = daily.temperature_2m_min[index];
    const rain = daily.precipitation_probability_max?.[index];
    const dayName = index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatDay(date);
    const range = Math.max(1, daily.temperature_2m_max[index] - daily.temperature_2m_min[index]);
    const trackWidth = Math.min(100, Math.max(20, range * 4));

    return `
      <article class="forecast-row">
        <span class="forecast-day">${dayName}</span>
        <span class="forecast-condition"><span class="forecast-icon">${info[1]}</span><span>${info[0]}</span></span>
        <span class="forecast-rain">${Number.isFinite(rain) ? `💧 ${rain}%` : ""}</span>
        <span class="forecast-temperatures">
          <span>${safeNumber(high)}°</span>
          <span class="temp-track" style="width:${trackWidth}px"></span>
          <span class="forecast-low">${safeNumber(low)}°</span>
        </span>
      </article>
    `;
  }).join("");
}

async function loadLocation(location) {
  setStatus(`Fetching weather for ${location.name}...`);
  elements.dashboard.classList.remove("visible");

  try {
    const weather = await getWeather(location);
    renderWeather(location, weather);
  } catch (error) {
    setStatus(error.message || "Unable to load weather. Check your internet and try again.", "error");
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = elements.input.value.trim();
  if (!query) {
    setStatus("Enter a city name to search.", "error");
    elements.input.focus();
    return;
  }

  elements.form.querySelector("button[type='submit']").disabled = true;
  try {
    const location = await findCity(query);
    await loadLocation(location);
  } catch (error) {
    setStatus(error.message || "City search failed. Please try again.", "error");
  } finally {
    elements.form.querySelector("button[type='submit']").disabled = false;
  }
});

elements.locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location. Search for a city instead.", "error");
    return;
  }

  setStatus("Requesting your location permission...");
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const reverseURL = `${GEO_BASE}?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`;

      let name = "Your location";
      let admin = "";
      let country = "";

      try {
        const reverse = await fetchJSON(reverseURL);
        const place = reverse.results?.[0];
        if (place) {
          name = place.name || name;
          admin = place.admin1 || "";
          country = place.country || "";
        }
      } catch {
        // Coordinates still allow a weather lookup without a city name.
      }

      await loadLocation({
        name,
        admin,
        country,
        latitude,
        longitude,
        timezone: "auto"
      });
    } catch (error) {
      setStatus(error.message || "Unable to retrieve local weather.", "error");
    }
  }, (error) => {
    const message = error.code === 1
      ? "Location permission was denied. Search for a city instead."
      : "Unable to get your location. Check browser permissions and try again.";
    setStatus(message, "error");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});

elements.refreshBtn.addEventListener("click", async () => {
  if (!currentLocation) return;
  await loadLocation(currentLocation);
});

(async function initialize() {
  try {
    const defaultCity = await findCity("Coimbatore");
    await loadLocation(defaultCity);
  } catch (error) {
    setStatus(error.message || "Unable to load the default city. Search for a city to begin.", "error");
  }
})();