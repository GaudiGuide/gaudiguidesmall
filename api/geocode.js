export default async function handler(req, res) {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Parameter 'q' fehlt." });
  }

  const url = `https://nominatim.openstreetmap.org/search?accept-language=de&countrycodes=de&q=${encodeURIComponent(query)}&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'gaudiguidesmall.vercel.app (kontakt@deinedomain.de)' // <-- deine Domain + Kontakt
      }
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Fehler beim Geocoding." });
  }
}
