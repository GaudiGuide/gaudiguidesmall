const supabase = window.supabase.createClient(
  "https://lfptdjesepqdoolcxppw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcHRkamVzZXBxZG9vbGN4cHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk3OTMsImV4cCI6MjA2MDM4NTc5M30.i67qj_tTDvx9_TJiWHCo_RT8EnS71ZV7LpJIvlAXiFg."
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

  if (window.GeoSearch && window.GeoSearch.OpenStreetMapProvider && window.GeoSearch.GeoSearchControl) {
    console.log("GeoSearch:", window.GeoSearch);
    console.log("OpenStreetMapProvider:", window.GeoSearch?.OpenStreetMapProvider);
    console.log("GeoSearchControl:", window.GeoSearch?.GeoSearchControl);

    const provider = new window.GeoSearch.OpenStreetMapProvider({
      params: { 'accept-language': 'de', countrycodes: 'de' }
    });

    const searchControl = new window.GeoSearch.GeoSearchControl({
      provider,
      style: "bar",
      searchLabel: "Adresse eingeben…",
      autoComplete: true,
      autoCompleteDelay: 300
    });

    console.log("searchControl:", searchControl);
    
    if (searchControl) {
      map.addControl(searchControl);
    } else {
      console.error("searchControl is undefined. Check GeoSearch dependencies.");
    }

    map.on("geosearch/showlocation", (result) => {
      drawCircle(result.location.y, result.location.x);
    });
  } else {
    console.warn("GeoSearch nicht geladen oder fehlerhaft – wird übersprungen.");
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
  const center = lat && lon ? L.latLng(lat, lon) : marker.getLatLng();

  if (lat && lon && marker) map.removeLayer(marker);
  if (lat && lon) marker = L.marker(center).addTo(map);

  if (circle) map.removeLayer(circle);

  if (showCircle) {
    circle = L.circle(center, {
      radius: radiusKm * 1000,
      color: "green", fillColor: "#aaffaa", fillOpacity: 0.3
    }).addTo(map);
  }

  loadLocationsWithRadius(center.lat, center.lng, radiusKm);
}

async function loadLocationsWithRadius(lat, lon, radiusKm) {
  document.getElementById("loader").style.display = "block";
  const { data, error } = await supabase.rpc("get_locations_within_radius", {
    lat_input: lat, lon_input: lon, radius_km: radiusKm,
  });

  if (error) {
    alert("Fehler beim Laden der Locations: " + error.message);
    return;
  }

  const user = supabase.auth.user();
  supabaseMarkers.forEach((m) => map.removeLayer(m));
  supabaseMarkers = [];

  data.forEach((loc) => {
    const m = L.marker([loc.latitude, loc.longitude]).addTo(map);
    const isOwner = user && loc.user_id === user.id;
    m.bindPopup(`
      <strong>${loc.name}</strong><br>${loc.description || ""}<br>
      <em>${loc.hours || ""}</em><br>${loc.address || ""}<br>
      ${loc.contact || ""}<br>
      ${loc.image_url ? `<img src="${loc.image_url}" style="max-width:100px;">` : ""}
      ${isOwner ? "<br><em>(Eigene Location)</em>" : ""}
    `);
    supabaseMarkers.push(m);
  });

  document.getElementById("loader").style.display = "none";
}

// Authentication and UI updates
async function updateAuthUI() {
  const user = supabase.auth.user();
  const loggedIn = !!user;
  const email = user?.email;

  document.getElementById("user-display").textContent = loggedIn ? `👤 ${email}` : "";
  ["login-btn", "register-btn"].forEach(id => document.getElementById(id).style.display = loggedIn ? "none" : "inline");
  ["logout-btn", "profile-btn", "location-btn"].forEach(id => document.getElementById(id).style.display = loggedIn ? "inline" : "none");
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

window.onload = () => {
  navigator.geolocation.getCurrentPosition(initMap, () =>
    initMap({ coords: { latitude: userLat, longitude: userLon } })
  );
  updateAuthUI();
};
