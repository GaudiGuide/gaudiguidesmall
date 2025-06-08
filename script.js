const supabase = window.supabase.createClient(
  "https://lfptdjesepqdoolcxppw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcHRkamVzZXBxZG9vbGN4cHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk3OTMsImV4cCI6MjA2MDM4NTc5M30.i67qj_tTDvx9_TJiWHCo_RT8EnS71ZV7LpJIvlAXiFg"
);

let map, userMarker = null, circle = null;
let userLat = 51.1657, userLon = 10.4515;
let radiusKm = 5;
let showCircle = true;
let supabaseMarkers = [];

function initMap(position) {
  userLat = position.coords.latitude;
  userLon = position.coords.longitude;

  map = L.map("map").setView([userLat, userLon], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  userMarker = L.marker([userLat, userLon])
    .addTo(map)
    .bindPopup("📍 Du bist hier")
    .openPopup();

  const provider = new window.GeoSearch.OpenStreetMapProvider({
    params: { "accept-language": "de", countrycodes: "de" },
  });

  const searchControl = new window.GeoSearch.GeoSearchControl({
    provider,
    style: "bar",
    searchLabel: "Adresse eingeben…",
    autoComplete: true,
    autoCompleteDelay: 300,
  });

  map.addControl(searchControl);

  map.on("geosearch/showlocation", (result) => {
    userLat = result.location.y;
    userLon = result.location.x;
    drawCircle(userLat, userLon);
  });

  drawCircle();
}

function drawCircle(lat = userLat, lon = userLon) {
  if (!map) return;

  const center = L.latLng(lat, lon);

  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker(center)
    .addTo(map)
    .bindPopup("📍 Du bist hier")
    .openPopup();

  if (circle) map.removeLayer(circle);

  if (showCircle) {
    console.log("🟢 Kreis wird gezeichnet bei:", center.lat, center.lng, "Radius:", radiusKm);
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
    console.error("❌ Fehler beim Laden der Locations:", error);
    alert("Fehler beim Laden der Locations: " + error.message);
    document.getElementById("loader").style.display = "none";
    return;
  }

  const user = supabase.auth.user();
  supabaseMarkers.forEach((m) => map.removeLayer(m));
  supabaseMarkers = [];

  data.forEach((loc) => {
    const m = L.marker([loc.latitude, loc.longitude]).addTo(map);
    const isOwner = user && loc.user_id === user.id;
    m.bindPopup(`
      <strong>${loc.name}</strong><br>
      ${loc.description || ""}<br>
      <em>${loc.hours || ""}</em><br>
      ${loc.address || ""}<br>${loc.contact || ""}<br>
      ${loc.image_url ? `<img src="${loc.image_url}" style="max-width:100px;">` : ""}
      ${isOwner ? "<br><em>(Eigene Location)</em>" : ""}
    `);
    supabaseMarkers.push(m);
  });

  document.getElementById("loader").style.display = "none";
}

function updateAuthUI() {
  const user = supabase.auth.user();
  const loggedIn = !!user;
  document.getElementById("user-display").textContent = loggedIn ? `👤 ${user.email}` : "";

  ["login-btn", "register-btn"].forEach(id => {
    document.getElementById(id).style.display = loggedIn ? "none" : "inline";
  });

  ["logout-btn", "profile-btn", "location-btn"].forEach(id => {
    document.getElementById(id).style.display = loggedIn ? "inline" : "none";
  });
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
  document.getElementById("toggle-auth-mode").innerHTML = authMode === "login"
    ? 'Noch kein Konto? <a href="#" onclick="switchAuthMode()">Registrieren</a>'
    : 'Bereits registriert? <a href="#" onclick="switchAuthMode()">Login</a>';
}

function toggleProfileModal() {
  document.getElementById("profile-modal").classList.toggle("hidden");
  loadProfileData();
}

function loadProfileData() {
  console.log("📄 Profil laden noch nicht implementiert");
}

function toggleLocationModal() {
  document.getElementById("location-modal").classList.toggle("hidden");
}

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;
  const status = document.getElementById("auth-status");
  status.textContent = "Wird verarbeitet...";

  const result = authMode === "login"
    ? await supabase.auth.signIn({ email, password })
    : await supabase.auth.signUp({ email, password });

  const { error } = result;

  if (error) {
    status.textContent = "Fehler: " + error.message;
  } else {
    status.textContent = "Erfolg!";
    toggleAuthModal();
    updateAuthUI();
  }
});

document.getElementById("location-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = supabase.auth.user();

  if (!user) {
    document.getElementById("loc-status").textContent = "Bitte einloggen.";
    return;
  }

  const name = document.getElementById("loc-name").value;
  const address = document.getElementById("loc-address").value;
  const hours = document.getElementById("loc-hours").value;
  const description = document.getElementById("loc-description").value;
  const contact = document.getElementById("loc-contact").value;
  const imageFile = document.getElementById("loc-image").files[0];
  const coords = userMarker.getLatLng();
  let imageUrl = null;

  if (imageFile && imageFile.size > 0) {
    const path = `${user.id}/${Date.now()}_${imageFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("location-images")
      .upload(path, imageFile, {
        upsert: true,
        contentType: imageFile.type || "image/jpeg",
      });

    if (uploadError) {
      document.getElementById("loc-status").textContent = "Fehler beim Hochladen: " + uploadError.message;
      return;
    }

    imageUrl = supabase.storage.from("location-images").getPublicUrl(path).publicURL;
  }

  const insertData = {
    name,
    address,
    hours,
    description,
    contact,
    image_url: imageUrl,
    latitude: coords.lat,
    longitude: coords.lng,
    user_id: user.id,
  };

  const { error } = await supabase.from("Locations").insert([insertData]);

  if (error) {
    document.getElementById("loc-status").textContent = "Fehler: " + error.message;
  } else {
    document.getElementById("loc-status").textContent = "Gespeichert!";
    toggleLocationModal();
    drawCircle(); // reload after insert
  }
});

// === Event Bindings ===
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

document.getElementById("radius-toggle").addEventListener("click", (e) => {
  e.preventDefault();
  showCircle = !showCircle;
  drawCircle();
});

document.getElementById("radius-range").addEventListener("input", (e) => {
  radiusKm = parseInt(e.target.value, 10);
  document.getElementById("radius-value").textContent = radiusKm;
  drawCircle();
});

window.onload = () => {
  navigator.geolocation.getCurrentPosition(
    initMap,
    () => initMap({ coords: { latitude: userLat, longitude: userLon } })
  );
  updateAuthUI();
};
