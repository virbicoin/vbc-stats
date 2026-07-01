import type { Request, Response } from 'express';
import geoip from 'geoip-lite';

// IPv4 validation: reject anything that isn't a dotted quad in range.
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// Private / loopback / unspecified ranges are not geolocatable; skip them.
const PRIVATE_IP_REGEX =
  /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.0\.0\.0|255\.255\.255\.255)/;

// GET /geoip?ip=1.2.3.4
// Migrated from the former Next.js App Router route (src/app/api/geoip/route.ts).
// Served outside the /api prefix because Primus owns the '/api' WebSocket pathname.
// geoip-lite reads its database synchronously from node_modules, so no dynamic
// import is needed here — server.ts already imports it the same way.
export function geoipHandler(req: Request, res: Response): void {
  const ip = typeof req.query.ip === 'string' ? req.query.ip : null;

  if (!ip) {
    res.status(400).json({ error: 'IP address is required' });
    return;
  }

  if (!IPV4_REGEX.test(ip)) {
    res.status(400).json({ error: 'Invalid IP address format' });
    return;
  }

  if (PRIVATE_IP_REGEX.test(ip)) {
    res.status(400).json({ error: 'Private IP address not supported' });
    return;
  }

  try {
    const geo = geoip.lookup(ip);
    if (geo && geo.ll && geo.ll.length === 2) {
      const [latitude, longitude] = geo.ll;
      res.json({
        ip,
        latitude,
        longitude,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        timezone: geo.timezone,
      });
      return;
    }
    res.status(404).json({ error: 'Location not found for this IP' });
  } catch (error) {
    console.error('GeoIP lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
