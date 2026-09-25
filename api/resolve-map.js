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
    const response = await fetch(input.toString(), { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept-Language": "es-BO,es;q=0.9,en;q=0.8" } });
    const finalUrl = response.url || input.toString();
    const html = await response.text();
    const sources = [finalUrl, html.replace(/\\u003d/g,"=").replace(/\\u0026/g,"&").replace(/\\u002c/g,",")];
    const patterns = [
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/gi,
      /(?:[?&]|\\u0026)(?:q|query|ll|center|destination|origin)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/gi,
      /["']?(?:lat|latitude)["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)[,}\s]+["']?(?:lng|lon|longitude)["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi,
      /(-?\d{1,3}\.\d{4,})\s*[, ]\s*(-?\d{1,3}\.\d{4,})/g
    ];
    const valid = (lat, lon) => Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
    // Prefer Bolivia coordinates when the short URL response contains many unrelated coordinate pairs.
    const all=[];
    for (const source of sources) for (const re of patterns) { let m; while((m=re.exec(source))!==null){ const c=[Number(m[1]),Number(m[2])]; if(valid(c[0],c[1])) all.push(c); } }
    const bolivia=all.find(c=>c[0]>=-24.5&&c[0]<=-9.5&&c[1]>=-70.5&&c[1]<=-57.0);
    if (bolivia) return res.status(200).json({ coords: bolivia, resolvedUrl: finalUrl });
    if (all[0]) return res.status(200).json({ coords: all[0], resolvedUrl: finalUrl });
    return res.status(422).json({ error: "Coordinates not found", resolvedUrl: finalUrl });
  } catch (e) {
    return res.status(502).json({ error: "Could not resolve map URL" });
  }
}
