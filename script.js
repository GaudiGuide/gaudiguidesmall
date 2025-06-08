const supabase = window.supabase.createClient(
  "https://lfptdjesepqdoolcxppw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcHRkamVzZXBxZG9vbGN4cHB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4MDk3OTMsImV4cCI6MjA2MDM4NTc5M30.i67qj_tTDvx9_TJiWHCo_RT8EnS71ZV7LpJIvlAXiFg"
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
      ${loc.address || ""}<br>
      ${loc.contact || ""}<br>
      ${loc.image_url ? `<img src="${loc.image_url}" style="max-width:100px;">` : ""}
      ${isOwner ? "<br><em>(Eigene Location)</em>" : ""}
    `);
    supabaseMarkers.push(m);
  });

  document.getElementById("loader").style.display = "none";
}

async function updateAuthUI() {
  const user = supabase.auth.user();
  const loggedIn = !!user;
  const email = user?.email;

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
    let userData, error;
    if (authMode === "login") {
      ({ user: userData, error } = await supabase.auth.signIn({ email, password }));
    } else {
      ({ user: userData, error } = await supabase.auth.signUp({ email, password }));
    }

    if (error) throw error;

    if (authMode === "register") alert("Registrierung erfolgreich. Bitte E-Mail bestätigen.");
    toggleAuthModal();
    updateAuthUI();
  } catch (err) {
    statusEl.textContent = "Fehler: " + err.message;
  }
});

// 🔄 Profil speichern mit Bild
document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("profile-name").value;
  const file = document.getElementById("profile-image").files[0];
  const user = supabase.auth.user();

  let imageUrl = null;

  if (file) {
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      document.getElementById("profile-status").textContent = "Fehler beim Hochladen: " + uploadError.message;
      return;
    }

    imageUrl = supabase.storage.from("avatars").getPublicUrl(path).publicURL;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert([{ user_id: user.id, name, avatar_url: imageUrl }]);

  if (!error) {
    document.getElementById("profile-status").textContent = "Profil gespeichert!";
    if (imageUrl) {
      document.getElementById("profile-image-preview").innerHTML = `<img src="${imageUrl}" alt="Profilbild">`;
    }
  } else {
    document.getElementById("profile-status").textContent = "Fehler: " + error.message;
  }
});

// 🔄 Profil laden
async function loadProfileData() {
  const user = supabase.auth.user();
  if (!user) return;
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
  if (!error && data) {
    document.getElementById("profile-name").value = data.name || "";
    if (data.avatar_url) {
      document.getElementById("profile-image-preview").innerHTML = `<img src="${data.avatar_url}" alt="Profilbild">`;
    }
  }
}

// 📌 Location speichern mit Bild & Kontakt
document.getElementById("location-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("loc-name").value;
  const address = document.getElementById("loc-address").value;
  const hours = document.getElementById("loc-hours").value;
  const description = document.getElementById("loc-description").value;
  const contact = document.getElementById("loc-contact").value;
  const imageFile = document.getElementById("loc-image").files[0];
  const coords = marker.getLatLng();
  const user = supabase.auth.user();

  let imageUrl = null;

  if (imageFile) {
    const path = `${user.id}/${Date.now()}_${imageFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("location-images")
      .upload(path, imageFile, { upsert: true });

    if (uploadError) {
      document.getElementById("loc-status").textContent = "Fehler beim Hochladen: " + uploadError.message;
      return;
    }

    imageUrl = supabase.storage.from("location-images").getPublicUrl(path).publicURL;
  }

  const { error } = await supabase.from("Locations").insert([{
    name,
    address,
    hours,
    description,
    contact,
    image_url: imageUrl,
    latitude: coords.lat,
    longitude: coords.lng,
    user_id: user.id
  }]);

  if (!error) {
    const m = L.marker([coords.lat, coords.lng]).addTo(map);
    m.bindPopup(`
      <strong>${name}</strong><br>${description}<br><em>${hours}</em><br>${address}<br>${contact}<br>
      ${imageUrl ? `<img src="${imageUrl}" style="max-width:100px;">` : ""}
    `);
    supabaseMarkers.push(m);
    document.getElementById("loc-status").textContent = "Gespeichert!";
    if (imageUrl) {
      document.getElementById("location-image-preview").innerHTML = `<img src="${imageUrl}" alt="Vorschau">`;
    }
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
