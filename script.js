const supabase = window.supabase.createClient(
  "https://lfptdjesepqdoolcxppw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcHRkamVzZXBxZG9vbGN4cHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk3OTMsImV4cCI6MjA2MDM4NTc5M30.i67qj_tTDvx9_TJiWHCo_RT8EnS71ZV7LpJIvlAXiFg"
);

let map, marker = null, circle = null;
let userLat = 51.1657, userLon = 10.4515;
let supabaseMarkers = [];

function initMap(position) {
  userLat = position.coords.latitude;
  userLon = position.coords.longitude;

  map = L.map("map").setView([userLat, userLon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  marker = L.marker([userLat, userLon]).addTo(map);

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
      provider,
      searchLabel: "Adresse eingeben…",
      showMarker: true,
      retainZoomLevel: false,
      autoClose: true,
      autoComplete: true,
      autoCompleteDelay: 300
    });

    map.addControl(searchControl);

    map.on("geosearch/showlocation", (result) => {
      const { y, x } = result.location;
      drawCircle(y, x);
    });
  } catch (err) {
    console.error("❌ GeoSearch Fehler:", err.message);
    alert("Suche konnte nicht geladen werden.");
  }

  const radiusInput = document.getElementById("radius");
  if (radiusInput) {
    radiusInput.addEventListener("input", () => drawCircle());
  }

  drawCircle();
}

function drawCircle(lat, lon) {
  if (!map) return;
  const radiusInput = document.getElementById("radius");
  const radiusKm = radiusInput ? parseFloat(radiusInput.value) : 5;
  if (isNaN(radiusKm) || radiusKm <= 0) return;

  const center = lat && lon ? L.latLng(lat, lon) : marker.getLatLng();
  if (lat && lon && marker) map.removeLayer(marker);
  if (lat && lon) marker = L.marker(center).addTo(map);
  if (circle) map.removeLayer(circle);

  circle = L.circle(center, {
    radius: radiusKm * 1000,
    color: "green",
    fillColor: "#aaffaa",
    fillOpacity: 0.3,
  }).addTo(map);

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
    document.getElementById("loader").style.display = "none";
    return;
  }

  supabaseMarkers.forEach((m) => map.removeLayer(m));
  supabaseMarkers = [];

  data.forEach((loc) => {
    const m = L.marker([loc.latitude, loc.longitude]).addTo(map);
    m.bindPopup(`<strong>${loc.name || "Unbenannt"}</strong><br>${loc.description || ""}`);
    supabaseMarkers.push(m);
  });

  document.getElementById("loader").style.display = "none";
}

// Modal Steuerung
function toggleAuthModal() {
  document.getElementById("auth-modal").classList.toggle("hidden");
  document.getElementById("auth-status").textContent = "";
}

function toggleProfileModal() {
  document.getElementById("profile-modal").classList.toggle("hidden");
  loadProfileData();
}

function toggleLocationModal() {
  document.getElementById("location-modal").classList.toggle("hidden");
}

function switchAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  document.getElementById("auth-title").textContent = authMode === "login" ? "Login" : "Registrieren";
  document.getElementById("auth-submit-btn").textContent = authMode === "login" ? "Anmelden" : "Registrieren";
  document.getElementById("toggle-auth-mode").innerHTML =
    authMode === "login"
      ? 'Noch kein Konto? <a href="#" onclick="switchAuthMode()">Registrieren</a>'
      : 'Bereits registriert? <a href="#" onclick="switchAuthMode()">Login</a>';
  document.getElementById("auth-status").textContent = "";
}

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

let authMode = "login";

async function updateAuthUI() {
  const { data: { session } } = await supabase.auth.getSession();
  const loggedIn = !!session;
  const email = session?.user?.email;

  document.getElementById("user-display").textContent = loggedIn ? `👤 ${email}` : "";
  document.getElementById("login-btn").style.display = loggedIn ? "none" : "inline";
  document.getElementById("register-btn").style.display = loggedIn ? "none" : "inline";
  document.getElementById("logout-btn").style.display = loggedIn ? "inline" : "none";
  document.getElementById("profile-btn").style.display = loggedIn ? "inline" : "none";
  document.getElementById("location-btn").style.display = loggedIn ? "inline" : "none";
}

// Login/Register
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const statusEl = document.getElementById("auth-status");

  try {
    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert("Registrierung erfolgreich. Bitte E-Mail bestätigen.");
    }

    toggleAuthModal();
    updateAuthUI();
  } catch (err) {
    statusEl.textContent = "Fehler: " + err.message;
    statusEl.className = "status error";
  }
});

// Profil
document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("profile-name").value;
  const address = document.getElementById("profile-address").value;
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return;

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert([{ user_id: user.id, name: name, address: address }]);

  document.getElementById("profile-status").textContent = upsertError ? upsertError.message : "Profil gespeichert!";
});

async function loadProfileData() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return;

  const { data, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!fetchError && data) {
    document.getElementById("profile-name").value = data.name || "";
    document.getElementById("profile-address").value = data.address || "";
  }
}

// Location speichern
document.getElementById("location-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("loc-name").value;
  const address = document.getElementById("loc-address").value;
  const coords = marker.getLatLng();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    document.getElementById("loc-status").textContent = "Fehler: Benutzer nicht angemeldet.";
    return;
  }

  const { error } = await supabase.from("Locations").insert([{
    name,
    address,
    latitude: coords.lat,
    longitude: coords.lng,
    user_id: user.id
  }]);

  document.getElementById("loc-status").textContent = error ? error.message : "Gespeichert!";
});

window.onload = () => {
  setTimeout(() => {
    navigator.geolocation.getCurrentPosition(initMap, () => {
      initMap({ coords: { latitude: userLat, longitude: userLon } });
    });
    updateAuthUI();
  }, 300);
};
