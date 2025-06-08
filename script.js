const supabase = window.supabase.createClient("https://lfptdjesepqdoolcxppw.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcHRkamVzZXBxZG9vbGN4cHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk3OTMsImV4cCI6MjA2MDM4NTc5M30.i67qj_tTDvx9_TJiWHCo_RT8EnS71ZV7LpJIvlAXiFg");

let map, marker = null, circle = null, showCircle = true;
let userLat = 51.1657, userLon = 10.4515;
let supabaseMarkers = [];

function initMap(position) {
  userLat = position.coords.latitude;
  userLon = position.coords.longitude;

  map = L.map("map").setView([userLat, userLon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  marker = L.marker([userLat, userLon]).addTo(map);

  const provider = new window.GeoSearch.OpenStreetMapProvider();
  const searchControl = new window.GeoSearch.GeoSearchControl({ provider, searchLabel: "Adresse eingeben…" });
  map.addControl(searchControl);
  map.on("geosearch/showlocation", (result) => drawCircle(result.location.y, result.location.x));

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

  supabaseMarkers.forEach((m) => map.removeLayer(m));
  supabaseMarkers = [];

  data.forEach((loc) => {
    const m = L.marker([loc.latitude, loc.longitude]).addTo(map);
    m.bindPopup(`<strong>${loc.name}</strong><br>${loc.description}<br><em>${loc.hours}</em>`);
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
function toggleAuthModal() { document.getElementById("auth-modal").classList.toggle("hidden"); }
function switchAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("auth-title").textContent = authMode === "login" ? "Login" : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = authMode === "login" ? "Anmelden" : "Registrieren";
}

function toggleProfileModal() { document.getElementById("profile-modal").classList.toggle("hidden"); loadProfileData(); }
function toggleLocationModal() { document.getElementById("location-modal").classList.toggle("hidden"); }

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
});

document.getElementById("location-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("loc-name").value;
  const address = document.getElementById("loc-address").value;
  const hours = document.getElementById("loc-hours").value;
  const description = document.getElementById("loc-description").value;
  const coords = marker.getLatLng();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("Locations").insert([{ name, address, hours, description, latitude: coords.lat, longitude: coords.lng, user_id: user.id }]);
  toggleLocationModal();
  drawCircle(); // neu laden
});

document.getElementById("login-btn").onclick = toggleAuthModal;
document.getElementById("register-btn").onclick = () => { authMode = "register"; switchAuthMode(); toggleAuthModal(); };
document.getElementById("logout-btn").onclick = async () => { await supabase.auth.signOut(); updateAuthUI(); };
document.getElementById("profile-btn").onclick = toggleProfileModal;
document.getElementById("location-btn").onclick = toggleLocationModal;

window.onload = () => {
  navigator.geolocation.getCurrentPosition(initMap, () => initMap({ coords: { latitude: userLat, longitude: userLon } }));
  updateAuthUI();
};
