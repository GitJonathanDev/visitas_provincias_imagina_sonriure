export default async function handler(req, res) {
  const raw = req.query?.url;
  if (!raw) return res.status(400).json({ error: "Missing url" });
  let input;
  try { input = new URL(raw); } catch { return res.status(400).json({ error: "Invalid URL" }); }
  const host = input.hostname.toLowerCase();
  if (host !== "maps.app.goo.gl" && !(host === "goo.gl" && input.pathname.startsWith("/maps"))) {
    return res.status(400).json({ error: "Only Google Maps short URLs are allowed" });
  }
  try {
    const response = await fetch(input.toString(), { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    const finalUrl = response.url || input.toString();
    const html = await response.text();
    const candidates = [finalUrl, html];
    const patterns = [
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i,
      /(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/
    ];
    for (const source of candidates) {
      for (const re of patterns) {
        const m = source.match(re);
        if (m) {
          const coords = [Number(m[1]), Number(m[2])];
          if (Number.isFinite(coords[0]) && Number.isFinite(coords[1]) && Math.abs(coords[0]) <= 90 && Math.abs(coords[1]) <= 180) {
            return res.status(200).json({ coords, resolvedUrl: finalUrl });
          }
        }
      }
    }
    return res.status(422).json({ error: "Coordinates not found", resolvedUrl: finalUrl });
  } catch (e) {
    return res.status(502).json({ error: "Could not resolve map URL" });
  }
}
