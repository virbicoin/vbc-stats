/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client WebSocket URL; omit for same-origin */
  readonly VITE_WS_URL?: string;
  /** CARTO basemaps API key; when set, the map uses CARTO Dark Matter instead of Esri */
  readonly VITE_CARTO_API_KEY?: string;
}
