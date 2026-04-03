const STORAGE_KEY = "cropRec_lastPrediction";

async function render() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const results = document.getElementById("results");
    const empty = document.getElementById("empty-state");

    if (!raw) {
        results.style.display = "none";
        empty.style.display = "block";
        return;
    }

    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        results.style.display = "none";
        empty.style.display = "block";
        return;
    }

    const { result } = payload;
    if (!result || !result.rankings) {
        results.style.display = "none";
        empty.style.display = "block";
        return;
    }

    document.getElementById("season-line").textContent =
        `Season (from temperature): ${result.season} — tap a crop for notes.`;

    let cropData = {};
    try {
        const r = await fetch("data/crops.json");
        cropData = await r.json();
    } catch {
        // fallback: use plain model labels
        cropData = {};
    }

    results.innerHTML = "";
    result.rankings.forEach((row) => {
        const card = document.createElement("article");
        card.className = "result-card card-clickable";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        const name = row.crop;
        const display = cropData && cropData[name] ? cropData[name].name : capitalize(name);
        card.innerHTML = `
            <div class="rank-badge">#${row.rank}</div>
            <h3>${display}</h3>
            <p><strong>Probability:</strong> ${row.probability}%</p>
            <p class="card-hint">View overview &amp; irrigation</p>
        `;
        card.addEventListener("click", () => {
            window.location.href = `crop-detail.html?crop=${encodeURIComponent(name)}`;
        });
        card.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                window.location.href = `crop-detail.html?crop=${encodeURIComponent(name)}`;
            }
        });
        results.appendChild(card);
    });
}

render();
