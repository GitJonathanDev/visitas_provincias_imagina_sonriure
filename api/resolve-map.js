export default async function handler(req, res) {
  const raw = req.query?.url;
  if (!raw) return res.status(400).json({ error: 'Falta la URL.' });

  let input;
  try { input = new URL(raw); } catch { return res.status(400).json({ error: 'URL no válida.' }); }

  const host = input.hostname.toLowerCase();
  const allowed = host === 'maps.app.goo.gl' || (host === 'goo.gl' && input.pathname.toLowerCase().startsWith('/maps'));
  if (!allowed) return res.status(400).json({ error: 'Solo se permiten enlaces cortos de Google Maps.' });

  try {
    const response = await fetch(input.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Visitas-Provincias/1.0' }
    });

    const resolvedUrl = response.url || input.toString();
    let html = '';
    try { html = await response.text(); } catch {}

    const candidates = [resolvedUrl, html];
    let coords = null;

    for (const text of candidates) {
      let m = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (m) { coords = [Number(m[1]), Number(m[2])]; break; }
      m = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      if (m) { coords = [Number(m[1]), Number(m[2])]; break; }
      m = text.match(/[?&](?:q|query|ll|destination|origin)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i);
      if (m) { coords = [Number(m[1]), Number(m[2])]; break; }
    }

    if (!coords) return res.status(422).json({ resolvedUrl, coords: null });
    return res.status(200).json({ resolvedUrl, coords });
  } catch (error) {
    return res.status(502).json({ error: 'No se pudo resolver el enlace de Google Maps.' });
  }
}
