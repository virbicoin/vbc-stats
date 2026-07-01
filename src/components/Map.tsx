import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon paths when bundling Leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Node {
  id: string | number;
  name: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  mining?: boolean;
  peers?: number;
  pending?: number;
  block?: number;
  blockHash?: string;
  totalDifficulty?: number;
  transactions?: number;
  uncles?: number;
  lastBlockTime?: string | number;
  propagation?: string | number;
  propagationAvg?: string | number;
  uptime?: { lastStatus?: number; up?: number; down?: number };
  latency?: string | number | { id: string; latency: string };
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
    [key: string]: unknown;
  } | null;
}

interface MapProps {
  nodes: Node[];
}

const Map: React.FC<MapProps> = ({ nodes }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<globalThis.Map<string | number, L.Marker>>(new globalThis.Map());
  const [hoveredNode, setHoveredNode] = useState<{ node: Node; x: number; y: number } | null>(null);

  // Track node states to prevent unnecessary marker updates
  const nodeStatesRef = useRef<
    globalThis.Map<
      string | number,
      {
        mining: boolean;
        block: number;
        hash: string;
        city?: string;
        country?: string;
      }
    >
  >(new globalThis.Map());

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Capture ref values at the start of the effect
    const markersMap = markersRef.current;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [-45, 0], // Balanced so both Norway (north) and New Zealand (south) stay visible
      zoom: 1,
      zoomControl: false,
      attributionControl: false,
      // Disable automatic animations and interactions that could cause unwanted movement
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      // Allow manual zoom/pan but prevent automatic behavior
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
    });

    // Dark mode tile layer using CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 10,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      // Use the captured ref values to avoid ref mutation warning
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersMap.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const existingMarkers = markersRef.current;

    // Get valid nodes with coordinates
    const validNodes = nodes.filter(
      (node) =>
        node.latitude !== undefined &&
        node.longitude !== undefined &&
        !isNaN(node.latitude) &&
        !isNaN(node.longitude)
    );

    // Get current node IDs
    const currentNodeIds = new Set(validNodes.map((node) => node.id));

    // Remove markers for nodes that no longer exist
    existingMarkers.forEach((marker, nodeId) => {
      if (!currentNodeIds.has(nodeId)) {
        map.removeLayer(marker);
        existingMarkers.delete(nodeId);
      }
    });

    // Helper function to get stable node information
    const getNodeInfo = (node: Node) => {
      return {
        name: node.name || 'Unknown Node',
        type: node.type || 'Unknown',
        mining: Boolean(node.mining),
        peers: node.peers || 0,
        pending: node.pending || 0,
        block: node.block,
        lastBlockTime: node.lastBlockTime,
        transactions: node.transactions,
        latency: node.latency,
        uptime: node.uptime,
        propagation: node.propagation,
        blockHash: node.blockHash,
        latitude: node.latitude,
        longitude: node.longitude,
        city: node.geo?.city,
        country: node.geo?.country,
      };
    };

    // Custom marker icons based on node type
    const createCustomIcon = (node: Node) => {
      const color = node.mining ? '#f59e0b' : '#06b6d4';
      const size = 8;

      return L.divIcon({
        className: 'custom-node-marker',
        html: `
          <div style="
            background: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            border: 2px solid #1f2937;
            box-shadow: 0 0 ${size}px rgba(${color === '#f59e0b' ? '245, 158, 11' : '6, 182, 212'}, 0.6);
          "></div>
        `,
        iconSize: [size + 4, size + 4],
        iconAnchor: [(size + 4) / 2, (size + 4) / 2],
      });
    };

    // Update or create markers for each valid node
    validNodes.forEach((node) => {
      if (!node.latitude || !node.longitude) return;

      const nodeInfo = getNodeInfo(node);
      const existingMarker = existingMarkers.get(node.id);

      // Track current node state
      const currentState: {
        mining: boolean;
        block: number;
        hash: string;
        city?: string;
        country?: string;
      } = {
        mining: nodeInfo.mining,
        block: nodeInfo.block || 0,
        hash: nodeInfo.blockHash || '',
        ...(nodeInfo.city && { city: nodeInfo.city }),
        ...(nodeInfo.country && { country: nodeInfo.country }),
      };

      const previousState = nodeStatesRef.current.get(node.id);
      const stateChanged =
        !previousState ||
        previousState.mining !== currentState.mining ||
        previousState.block !== currentState.block ||
        previousState.hash !== currentState.hash ||
        previousState.city !== currentState.city ||
        previousState.country !== currentState.country;

      if (existingMarker) {
        // Update existing marker position if needed
        const currentLatLng = existingMarker.getLatLng();
        if (currentLatLng.lat !== node.latitude || currentLatLng.lng !== node.longitude) {
          existingMarker.setLatLng([node.latitude, node.longitude]);
        }

        // Only update marker icon and popup if state actually changed
        if (stateChanged) {
          existingMarker.setIcon(createCustomIcon(node));
          nodeStatesRef.current.set(node.id, currentState);
        }
      } else {
        // Create new marker
        const marker = L.marker([node.latitude, node.longitude], {
          icon: createCustomIcon(node),
        }).addTo(map);

        // Add hover events to show custom React tooltip
        marker.on('mouseover', function (e: L.LeafletMouseEvent) {
          const containerPoint = map.latLngToContainerPoint(e.latlng);
          const mapRect = mapContainerRef.current?.getBoundingClientRect();
          if (mapRect) {
            setHoveredNode({
              node,
              x: mapRect.left + containerPoint.x,
              y: mapRect.top + containerPoint.y,
            });
          }
        });
        marker.on('mouseout', function () {
          setHoveredNode(null);
        });

        // Store marker reference and state
        existingMarkers.set(node.id, marker);
        nodeStatesRef.current.set(node.id, currentState);
      }
    });

    // Disabled to prevent unwanted map movement
    // const isInitialLoad = validNodes.length > 0 && existingMarkers.size <= validNodes.length;
    // if (isInitialLoad && validNodes.length === existingMarkers.size) {
    //   const group = new L.FeatureGroup(
    //     validNodes.map(node =>
    //       L.marker([node.latitude!, node.longitude!])
    //     )
    //   );
    //   map.fitBounds(group.getBounds().pad(0.1), { animate: false });
    // }
  }, [nodes]);

  // Geolocated node count and the number of distinct map locations they occupy
  // (coordinates rounded so floating-point jitter doesn't split a shared site).
  const geolocatedNodes = nodes.filter((n) => n.latitude != null && n.longitude != null);
  const geolocatedCount = geolocatedNodes.length;
  const uniqueLocationCount = new Set(
    geolocatedNodes.map((n) => `${n.latitude!.toFixed(3)},${n.longitude!.toFixed(3)}`)
  ).size;

  // Helper to get location text
  const getLocationText = (node: Node) => {
    if (node.geo?.city && node.geo?.country) {
      return `${node.geo.city}, ${node.geo.country}`;
    }
    if (node.geo?.country) {
      return node.geo.country;
    }
    return 'Unknown';
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={mapContainerRef}
        className="h-full w-full rounded-lg bg-gray-900"
        style={{ minHeight: '400px' }}
      />

      {/* Node count overlay */}
      <div className="absolute top-4 left-4 z-[500] rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur-sm">
        <div className="text-sm text-gray-300">
          <span className="text-cyan-400">{nodes.length}</span> nodes connected
        </div>
        <div className="mt-1 text-xs text-gray-400">
          {geolocatedCount} geolocated · {uniqueLocationCount} locations
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-[500] rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-2 backdrop-blur-sm">
        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full border border-gray-700 bg-yellow-500"></div>
            <span>Mining Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full border border-gray-700 bg-cyan-400"></div>
            <span>Regular Node</span>
          </div>
        </div>
      </div>

      {/* Custom tooltip rendered via portal */}
      {hoveredNode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[99999] rounded-lg border border-gray-600 bg-gray-900 p-3 shadow-2xl"
            style={{
              left: hoveredNode.x,
              top: hoveredNode.y - 10,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="text-xs whitespace-nowrap text-gray-300">
              <div className="flex items-center gap-1 text-pink-400">
                📍 {getLocationText(hoveredNode.node)}
              </div>
              {hoveredNode.node.block !== undefined && hoveredNode.node.block > 0 && (
                <div className="text-cyan-400">
                  Block #{hoveredNode.node.block.toLocaleString()}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Map;
