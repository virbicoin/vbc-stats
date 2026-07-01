import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { geoipHandler } from './routes/geoip.js';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// GeoIP lookup endpoint (migrated from the former Next.js /api/geoip route).
// NOTE: it must NOT live under /api — Primus owns the '/api' pathname for node
// WebSocket connections and would hijack the HTTP request (426 Upgrade Required).
// Registered before the Vite/static SPA fallback in server.ts so it wins.
app.get('/geoip', geoipHandler);

export default app;
