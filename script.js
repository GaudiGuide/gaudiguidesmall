const supabase = window.supabase.createClient(
  "https://lfptdjesepqdoolcxppw.supabase.co",
  "public-anon-key" // ← Ersetze durch deinen echten anon key
);

let map, marker = null, circle = null, showCircle = true;
let userLat = 51.1657, userLon = 10.4515;
let supabaseMarkers = [];

function initMap(position) {
  userLat = position.coords.latitude;
  userLon = position.coords.longitude;

  map = L.map("map").setView([userLat, userLon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  marker = L.marker([userLat, userLon]).addTo(map);

  // ✅ GeoSearch robust einbinden
  try {
    if (!window.GeoSearch || !window.GeoSearch.OpenStreetMapProvider) {
      throw new Error("GeoSearch nicht verfügbar.");
    }

    const provider = new window.GeoSearch.OpenStreetMapProvider({
      params: {
        'accept-language': 'de',
        countrycodes: 'de'
      }
    });

    const searchControl = new window.GeoSearch.GeoSearchControl({
      provider: provider,
      style: "bar",
      searchLabel: "Adresse eingeben…",
      autoComplete: true,
      autoCompleteDelay: 300
    });

    map.addControl(searchControl);

    map.on("geosearch/showlocation", (result) => {
      drawCircle(result.location.y, result.location.x);
    });

  } catch (err) {
    console.error("GeoSearch Fehler:", err.message);
    alert("Geo-Suche konnte nicht geladen werden.");
  }

  document.getElementById("radius-toggle").onclick = () => {
    showCircle = !showCircle;
    drawCircle();
  };

  drawCircle();
}

function drawCircle(lat, lon) {
  if (!map) return;

  const radiusKm = 5;
  let center = lat && lon ? L.latLng(lat, lon) : marker.getLatLng();

  if (lat && lon && marker) map.removeLayer(marker);
  if (lat && lon) marker = L.marker(center).addTo(map);

  if (circle) map.removeLayer(circle);

  if (showCircle) {
    circle = L.circle(center, {
      radius: radiusKm * 1000,
      color: "green",
      fillColor: "#aaffaa",
      fillOpacity: 0.3,
    }).addTo(map);
  }

  loadLocationsWithRadius(center.lat, center.lng, radiusKm);
}

async function loadLocationsWithRadius(lat, lon, radiusKm) {
  document.getElementById("loader").style.display = "block";
  const { data, error } = await supabase.rpc("get_locations_within_radius", {
    lat_input: lat,
    lon_input: lon,
    radius_km: radiusKm,
  });

  if (error) {
    alert("Fehler beim Laden der Locations: " + error.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  supabaseMarkers.forEach((m) => map.removeLayer(m));
  supabaseMarkers = [];

  data.forEach((loc) => {
    const m = L.marker([loc.latitude, loc.longitude]).addTo(map);
    const isOwner = user && loc.user_id === user.id;
    m.bindPopup(`
      <strong>${loc.name}</strong><br>
      ${loc.description || ""}<br>
      <em>${loc.hours || ""}</em><br>
      ${loc.address || ""}
      ${isOwner ? "<br><em>(Eigene Location)</em>" : ""}
    `);
    supabaseMarkers.push(m);
  });

  document.getElementById("loader").style.display = "none";
}

async function updateAuthUI() {
  const { data: { session } } = await supabase.auth.getSession();
  const loggedIn = !!session;
  const email = session?.user?.email;

  document.getElementById("user-display").textContent = loggedIn ? `👤 ${email}` : "";
  ["login-btn", "register-btn"].forEach(id => document.getElementById(id).style.display = loggedIn ? "none" : "inline");
  ["logout-btn", "profile-btn", "location-btn"].forEach(id => document.getElementById(id).style.display = loggedIn ? "inline" : "none");
}

let authMode = "login";

function toggleAuthModal() {
  document.getElementById("auth-modal").classList.toggle("hidden");
  document.getElementById("auth-status").textContent = "";
}

function switchAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("auth-title").textContent = authMode === "login" ? "Login" : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = authMode === "login" ? "Anmelden" : "Registrieren";
  document.getElementById("toggle-auth-mode").innerHTML =
    authMode === "login"
      ? 'Noch kein Konto? <a href="#" onclick="switchAuthMode()">Registrieren</a>'
      : 'Bereits registriert? <a href="#" onclick="switchAuthMode()">Login</a>';
}

function toggleProfileModal() {
  document.getElementById("profile-modal").classList.toggle("hidden");
  loadProfileData();
}

function toggleLocationModal() {
  document.getElementById("location-modal").classList.toggle("hidden");
}

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const statusEl = document.getElementById("auth-status");

  try {
    const fn = authMode === "login" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn({ email, password });
    if (error) throw error;

    if (authMode === "register") alert("Registrierung erfolgreich. Bitte E-Mail bestätigen.");
    toggleAuthModal();
    updateAuthUI();
  } catch (err) {
    statusEl.textContent = "Fehler: " + err.message;
  }
});

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("profile-name").value;
  const address = document.getElementById("profile-address").value;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("profiles").upsert([{ user_id: user.id, name, address }]);
  document.getElementById("profile-status").textContent = "Profil gespeichert!";
});

async function loadProfileData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  if (!error && data) {
    document.getElementById("profile-name").value = data.name || "";
    document.getElementById("profile-address").value = data.address || "";
  }
}

document.getElementById("location-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("loc-name").value;
  const address = document.getElementById("loc-address").value;
  const hours = document.getElementById("loc-hours").value;
  const description = document.getElementById("loc-description").value;
  const coords = marker.getLatLng();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("Locations").insert([{
    name,
    address,
    hours,
    description,
    latitude: coords.lat,
    longitude: coords.lng,
    user_id: user.id
  }]);

  if (!error) {
    const m = L.marker([coords.lat, coords.lng]).addTo(map);
    m.bindPopup(`<strong>${name}</strong><br>${description}<br><em>${hours}</em><br>${address}`);
    supabaseMarkers.push(m);
    document.getElementById("loc-status").textContent = "Gespeichert!";
    toggleLocationModal();
  } else {
    document.getElementById("loc-status").textContent = "Fehler: " + error.message;
  }
});

document.getElementById("login-btn").onclick = toggleAuthModal;
document.getElementById("register-btn").onclick = () => {
  authMode = "register";
  switchAuthMode();
  toggleAuthModal();
};
document.getElementById("logout-btn").onclick = async () => {
  await supabase.auth.signOut();
  updateAuthUI();
};
document.getElementById("profile-btn").onclick = toggleProfileModal;
document.getElementById("location-btn").onclick = toggleLocationModal;

window.onload = () => {
  navigator.geolocation.getCurrentPosition(initMap, () => initMap({ coords: { latitude: userLat, longitude: userLon } }));
  updateAuthUI();
};
