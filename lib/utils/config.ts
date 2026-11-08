import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface AccessControl {
  /** Client IPs refused at `hello`, matched against the resolved client IP. */
  banned: string[];
  /** Node ids that may never register (e.g. ids impersonating official nodes). */
  reserved: string[];
}

/**
 * Operator-managed deny lists.
 *
 * These used to be empty arrays hard-coded here, which made the `banned` /
 * `reserved` checks in the `hello` handler dead code: blocking an abusive
 * reporter meant editing source and redeploying. Load them from
 * `access-control.json` (or `ACCESS_CONTROL_FILE`) instead, so an operator can
 * react without a code change. A missing file simply means nothing is blocked.
 * See `access-control.example.json`.
 */
export function loadAccessControl(): AccessControl {
  const file =
    process.env.ACCESS_CONTROL_FILE || path.resolve(process.cwd(), 'access-control.json');
  const list = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<AccessControl>;
    return { banned: list(parsed?.banned), reserved: list(parsed?.reserved) };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') {
      console.warn(`Failed to load access control from ${file}:`, e.message);
    }
    return { banned: [], reserved: [] };
  }
}

const accessControl = loadAccessControl();
export const banned: string[] = accessControl.banned;
export const reserved: string[] = accessControl.reserved;

export interface GeoOverride {
  /** [latitude, longitude] — required so the node can be placed on the map. */
  ll: [number, number];
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

/**
 * Optional, deployment-specific geo overrides.
 *
 * geoip-lite's bundled GeoLite2 DB is inaccurate for IPv6 and cloud/hosting
 * ranges (which often resolve to the provider's home country), so an operator
 * can pin the true location of known nodes WITHOUT editing source code. The
 * data lives outside the repository: set `GEO_OVERRIDES_FILE`, or drop a
 * `geo-overrides.json` at the project root. Keys are matched against a node's
 * id or display name. See `geo-overrides.example.json`.
 */
export function loadGeoOverrides(): Record<string, GeoOverride> {
  const file = process.env.GEO_OVERRIDES_FILE || path.resolve(process.cwd(), 'geo-overrides.json');
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, GeoOverride>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    // A missing file simply means no overrides are configured.
    if (e.code !== 'ENOENT') {
      console.warn(`Failed to load geo overrides from ${file}:`, e.message);
    }
    return {};
  }
}
