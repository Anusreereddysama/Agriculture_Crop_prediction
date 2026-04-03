const STORAGE_KEY = "cropRec_lastPrediction";

function apiDetail(j) {
    if (!j || j.detail === undefined || j.detail === null) return null;
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail))
        return j.detail.map((x) => (typeof x === "object" && x.msg ? x.msg : String(x))).join("; ");
    return String(j.detail);
}

function readInputs() {
    return {
        N: parseFloat(document.getElementById("N").value),
        P: parseFloat(document.getElementById("P").value),
        K: parseFloat(document.getElementById("K").value),
        temperature: parseFloat(document.getElementById("temp").value),
        humidity: parseFloat(document.getElementById("humidity").value),
        ph: parseFloat(document.getElementById("ph").value),
        rainfall: parseFloat(document.getElementById("rainfall").value),
    };
}

function validateInputs(d) {
    const keys = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"];
    for (const k of keys) {
        if (Number.isNaN(d[k])) {
            return "Please fill all numeric fields (soil N, P, K, pH, temperature, humidity, rainfall).";
        }
    }
    return null;
}

const GEO_KEY = "cropRec_lastGeo";

async function applyWeatherPayload(w) {
    document.getElementById("temp").value = w.temperature_c;
    document.getElementById("humidity").value = w.humidity_pct;
    document.getElementById("rainfall").value = w.rainfall_mm;
    const hint = document.getElementById("weather-hint");
    const loc = w.location_name ? `${w.location_name}${w.country ? ", " + w.country : ""}` : "";
    hint.textContent = (loc ? `Location: ${loc}. ` : "") + (w.rainfall_note || "");
    showToast("Weather fields updated.");
    // Auto-trigger NPK estimate once weather values are available.
    estimateNpkFromWeather();
}

async function fetchWeatherLatLon(lat, lon) {
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";
    const res = await fetch(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(apiDetail(j) || res.statusText || "Weather request failed.");
    }
    const w = await res.json();
    sessionStorage.setItem(GEO_KEY, JSON.stringify({ lat, lon }));
    await applyWeatherPayload(w);
}

async function fetchWeatherCity() {
    const city = document.getElementById("city").value.trim();
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";
    sessionStorage.removeItem(GEO_KEY);
    if (!city) {
        errEl.textContent = "Enter a city name or use location.";
        return;
    }
    const res = await fetch(`/api/weather/city?city=${encodeURIComponent(city)}`);
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(apiDetail(j) || "City not found or weather unavailable.");
    }
    const w = await res.json();
    await applyWeatherPayload(w);
}

document.getElementById("btn-geo").addEventListener("click", () => {
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";
    if (!navigator.geolocation) {
        errEl.textContent = "Geolocation is not supported in this browser.";
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            fetchWeatherLatLon(pos.coords.latitude, pos.coords.longitude).catch((e) => {
                errEl.textContent = e.message;
            });
        },
        () => {
            errEl.textContent = "Location permission denied or unavailable. Enter city or type weather manually.";
        }
    );
});

document.getElementById("btn-city").addEventListener("click", () => {
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";
    fetchWeatherCity().catch((e) => {
        errEl.textContent = e.message;
    });
});

async function estimateNpkFromWeather() {
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";

    const temperature = parseFloat(document.getElementById("temp").value);
    const humidity = parseFloat(document.getElementById("humidity").value);
    const rainfall = parseFloat(document.getElementById("rainfall").value);

    if (Number.isNaN(temperature) || Number.isNaN(humidity) || Number.isNaN(rainfall)) {
        errEl.textContent = "Please fill temperature, humidity, and rainfall first (use weather fetch or manual).";
        return;
    }

    const btn = document.getElementById("btn-estimate-npk");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Estimating NPK…";

    try {
        const res = await fetch(
            `/api/estimate-npk?temperature=${encodeURIComponent(temperature)}&humidity=${encodeURIComponent(humidity)}&rainfall=${encodeURIComponent(rainfall)}`
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(j.detail || "NPK estimation failed.");
        }

        const est = j.estimated_npk || {};
        document.getElementById("N").value = est.N ?? "";
        document.getElementById("P").value = est.P ?? "";
        document.getElementById("K").value = est.K ?? "";

        const note = document.getElementById("npk-estimate-note");
        if (note) note.style.display = "block";
        showToast(`NPK estimated (confidence: ${(j.confidence * 100).toFixed(0)}%).`);
    } catch (e) {
        errEl.textContent = e.message || "NPK estimation failed.";
    } finally {
        btn.disabled = false;
        btn.textContent = old;
    }
}

document.getElementById("btn-estimate-npk").addEventListener("click", estimateNpkFromWeather);

document.getElementById("btn-predict").addEventListener("click", async () => {
    const errEl = document.getElementById("predict-error");
    errEl.textContent = "";
    const data = readInputs();
    const v = validateInputs(data);
    if (v) {
        errEl.textContent = v;
        return;
    }

    const btn = document.getElementById("btn-predict");
    btn.disabled = true;
    btn.textContent = "Running model…";

    try {
        const res = await fetch("/predict?top_k=50", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(apiDetail(j) || "Prediction failed.");
        }
        const result = await res.json();
        const geoRaw = sessionStorage.getItem(GEO_KEY);
        let geo = null;
        try {
            geo = geoRaw ? JSON.parse(geoRaw) : null;
        } catch {
            geo = null;
        }
        const payload = {
            inputs: data,
            result,
            savedAt: Date.now(),
            geo,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.location.href = "recommendations.html";
    } catch (e) {
        errEl.textContent = e.message || "Prediction failed.";
    } finally {
        btn.disabled = false;
        btn.textContent = "Get recommendations";
    }
});
