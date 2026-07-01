import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import {
  FaCube,
  FaLayerGroup,
  FaClock,
  FaStopwatch,
  FaSignal,
  FaHashtag,
  FaUsers,
  FaMoneyBillWave,
} from 'react-icons/fa';
// GeoIP-lite import for server-side IP geolocation
// Note: This will only work on the server side, so we'll use a different approach for client-side

// 型定義ファイルがないモジュールの宣言（未使用）
// declare const Primus: new (url: string) => {
//   on: (event: string, callback: (data?: unknown) => void) => void;
//   emit: (event: string, data?: unknown) => void;
//   write: (data: unknown) => void;
// };

const Charts = lazy(() => import('@/components/Charts'));
const HalvingCountdown = lazy(() => import('@/components/HalvingCountdown'));
const Nodes = lazy(() => import('@/components/Nodes'));

// Shared fallback shown while a lazily-loaded section's chunk downloads.
function SectionLoading({ label }: { label: string }): React.ReactNode {
  return (
    <div className="flex h-full w-full items-center justify-center rounded bg-[#0d1421]">
      <p className="text-gray-400">{label}</p>
    </div>
  );
}

interface Node {
  id: string | number;
  name: string;
  type?: string;
  info?: {
    name?: string;
    type?: string;
    ip?: string;
    [key: string]: unknown;
  };
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    ll?: [number, number];
    [key: string]: unknown;
  } | null;
  latency?: string | number | { id: string; latency: string };
  mining?: boolean;
  peers?: number;
  pending?: number;
  block?: number;
  blockHash?: string;
  totalDifficulty?: number;
  transactions?: number;
  uncles?: number;
  lastBlockTime?: string;
  propagation?: string | number;
  propagationAvg?: string | number;
  uptime?: { lastStatus?: number; up?: number; down?: number };
  pinned?: boolean;
  latitude?: number;
  longitude?: number;
  blockTimestamp?: number;
}

interface StatsValue {
  value: number | string | { lastStatus?: number; up?: number; down?: number };
  unit?: string;
}

interface StatsData {
  [id: string]: StatsValue;
}

// サードパーティのライブラリでany型が必要な場合に使用（未使用）
// const safeDisplayValue = (value: any): string => {
//   if (value === undefined || value === null) return '--';
//   if (typeof value === 'object') {
//     if (value.value !== undefined) return String(value.value);
//     return JSON.stringify(value);
//   }
//   return String(value);
// };

// Convert wei to gwei (divide by 1e9)
const weiToGwei = (wei: number): number => {
  return wei / 1000000000;
};

// Format large numbers with proper units
const formatLargeNumber = (value: number): string => {
  if (
    value === 0 ||
    value === null ||
    value === undefined ||
    typeof value !== 'number' ||
    isNaN(value)
  )
    return '0';
  if (value >= 1e18) return (value / 1e18).toFixed(2) + ' E';
  if (value >= 1e15) return (value / 1e15).toFixed(2) + ' P';
  if (value >= 1e12) return (value / 1e12).toFixed(2) + ' T';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + ' G';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + ' M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + ' K';
  return value.toLocaleString();
};

// Get color class for Last Block time based on elapsed seconds
const getLastBlockTimeColor = (seconds: number): string => {
  if (seconds <= 15) return 'text-white';
  if (seconds <= 30) return 'text-yellow-400';
  if (seconds <= 60) return 'text-orange-400';
  return 'text-red-400';
};

function HomePage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState('');
  const [lastBlockTime, setLastBlockTime] = useState<number | null>(null);
  const [lastBlockTimestamp, setLastBlockTimestamp] = useState<number | null>(null);
  const [pageLatency, setPageLatency] = useState<number>(0);
  const [latencyRetryCount, setLatencyRetryCount] = useState<number>(0);
  const [lastValidLatency, setLastValidLatency] = useState<number>(0);

  // Stable values to prevent flickering - use first value after block update
  const [stableAvgBlockTime, setStableAvgBlockTime] = useState<number | null>(null);
  const [stableDifficulty, setStableDifficulty] = useState<number | null>(null);
  const [stablePageLatency, setStablePageLatency] = useState<number>(0);
  const [stableAvgNetworkHashrate, setStableAvgNetworkHashrate] = useState<number | null>(null);
  const [stableUncles, setStableUncles] = useState<number | null>(null);
  const [stableBestBlock, setStableBestBlock] = useState<number | null>(null);
  const [stableActiveNodes, setStableActiveNodes] = useState<number | null>(null);

  // Additional stable values for Gas Price and Gas Limit to prevent '!' display
  const [stableGasPrice, setStableGasPrice] = useState<number | null>(null);
  const [stableGasLimit, setStableGasLimit] = useState<number | null>(null);

  // Track the previous best block value to detect actual changes
  const [prevBestBlock, setPrevBestBlock] = useState<number | null>(null);

  // Track processed blocks to prevent duplicate updates for the same block
  const processedBlocksRef = useRef(new globalThis.Map<number, number>()); // blockNumber -> timestamp when first processed

  // Track stable values block number with ref for immediate access
  const stableValuesBlockRef = useRef<number | null>(null);

  // Track which block timer was last started for - prevent multiple timer resets for same block
  const timerStartedForBlockRef = useRef<number | null>(null);

  // Track WebSocket connection to prevent duplicates
  const wsConnectionRef = useRef<{
    on: (event: string, callback: (data?: unknown) => void) => void;
    emit?: (event: string, data?: unknown) => void;
    write?: (data: unknown) => void;
    end?: () => void;
    destroy?: () => void;
  } | null>(null);

  // Track connection state to prevent multiple initialization attempts
  const wsInitializingRef = useRef<boolean>(false);
  const wsConnectedRef = useRef<boolean>(false);
  const wsReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  // Function to safely reset timer only once per block
  const resetTimerForNewBlock = useCallback((blockNumber: number, timestamp?: number) => {
    // Only reset timer if we haven't already started it for this block
    if (timerStartedForBlockRef.current !== blockNumber) {
      timerStartedForBlockRef.current = blockNumber;
      setLastBlockTime(0);
      setLastBlockTimestamp(timestamp || Date.now());
      return true; // Timer was reset
    }
    return false; // Timer was already reset for this block
  }, []);

  // Store node coordinates persistently to prevent position changes
  const nodeCoordinatesRef = useRef(
    new globalThis.Map<string | number, { latitude: number; longitude: number }>()
  );
  // Store IP to coordinates cache to avoid repeated API calls
  const ipCoordinatesCacheRef = useRef(
    new globalThis.Map<string, { latitude: number; longitude: number; timestamp: number }>()
  );

  // Function to extract IP address from node name or ID (based on original vbcstats implementation)
  const extractIPFromNode = (node: Node): string | null => {
    // Check if node info contains IP directly
    if (node.name && typeof node.name === 'string') {
      // First try to extract from node name
      const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
      const match = node.name.match(ipRegex);
      if (match) return match[1];

      // Try to extract from hostname format like "node-123.456.789.012"
      const hostnameRegex = /node[.-](\d{1,3})[.-](\d{1,3})[.-](\d{1,3})[.-](\d{1,3})/i;
      const hostnameMatch = node.name.match(hostnameRegex);
      if (hostnameMatch) {
        return `${hostnameMatch[1]}.${hostnameMatch[2]}.${hostnameMatch[3]}.${hostnameMatch[4]}`;
      }
    }

    // Try to extract IP from node ID if it's a string
    if (typeof node.id === 'string') {
      const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
      const match = node.id.match(ipRegex);
      if (match) return match[1];
    }

    // Look for any IP-like patterns in other node properties
    const nodeStr = JSON.stringify(node);
    const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
    const matches = nodeStr.match(ipRegex);
    if (matches && matches.length > 0) {
      // Return the first valid-looking IP address
      for (const ip of matches) {
        const parts = ip.split('.');
        if (parts.every((part) => parseInt(part) <= 255)) {
          return ip;
        }
      }
    }

    return null;
  };

  // Function to get coordinates from IP using direct geoip-lite call via API
  const getCoordinatesFromIP = async (
    ip: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // Check cache first (cache for 24 hours)
      const cached = ipCoordinatesCacheRef.current.get(ip);
      const now = Date.now();
      if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) {
        console.log(`Using cached coordinates for IP ${ip}:`, cached.latitude, cached.longitude);
        return { latitude: cached.latitude, longitude: cached.longitude };
      }

      // Skip private IP addresses and IPv6-mapped IPv4 addresses
      let cleanIp = ip;
      if (ip.substr(0, 7) === '::ffff:') {
        cleanIp = ip.substr(7);
      }

      const privateIpRegex =
        /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.0\.0\.0|255\.255\.255\.255)/;
      if (privateIpRegex.test(cleanIp)) {
        console.log(`Skipping private IP address: ${cleanIp}`);
        return null;
      }

      // Make API request to our GeoIP endpoint
      const response = await fetch(`/geoip?ip=${encodeURIComponent(cleanIp)}`);
      if (!response.ok) {
        console.warn(`GeoIP API request failed for ${cleanIp}:`, response.status);
        return null;
      }

      const data = await response.json();
      if (
        data.latitude !== undefined &&
        data.longitude !== undefined &&
        !isNaN(data.latitude) &&
        !isNaN(data.longitude)
      ) {
        const coords = { latitude: data.latitude, longitude: data.longitude };
        // Cache the result
        ipCoordinatesCacheRef.current.set(ip, {
          ...coords,
          timestamp: now,
        });
        // Only log GeoIP results occasionally to reduce console spam
        if (Math.random() < 0.05) {
          console.log(
            `Got coordinates from GeoIP for ${cleanIp} (${data.city || 'Unknown'}, ${data.country || 'Unknown'}):`,
            data.latitude,
            data.longitude
          );
        }
        return coords;
      }

      console.warn(`Invalid location data from GeoIP for ${cleanIp}:`, data);
      return null;
    } catch (error) {
      console.error(`Error fetching coordinates for IP ${ip}:`, error);
      return null;
    }
  };

  // Function to add stable coordinates to nodes based on server data or IP
  const addCoordinatesToNodes = useCallback(async (nodesList: Node[]): Promise<Node[]> => {
    const processedNodes = await Promise.all(
      nodesList.map(async (node) => {
        // Priority 1: If node has geo.ll data from server (geoip-lite), use it
        if (node.geo?.ll && Array.isArray(node.geo.ll) && node.geo.ll.length === 2) {
          const coords = {
            latitude: node.geo.ll[0],
            longitude: node.geo.ll[1],
          };
          // Only update if coordinates changed
          const storedCoords = nodeCoordinatesRef.current.get(node.id);
          if (
            !storedCoords ||
            storedCoords.latitude !== coords.latitude ||
            storedCoords.longitude !== coords.longitude
          ) {
            nodeCoordinatesRef.current.set(node.id, coords);
            // Only log coordinate updates occasionally to reduce console spam
            if (Math.random() < 0.1) {
              // Log only 10% of coordinate updates
              console.log(
                `Node ${node.id} (${node.name}) using server GeoIP coordinates:`,
                coords.latitude,
                coords.longitude
              );
            }
          }
          return {
            ...node,
            ...coords,
          };
        }

        // Priority 2: If node already has coordinates from server, use them
        if (node.latitude && node.longitude) {
          const storedCoords = nodeCoordinatesRef.current.get(node.id);
          if (
            !storedCoords ||
            storedCoords.latitude !== node.latitude ||
            storedCoords.longitude !== node.longitude
          ) {
            nodeCoordinatesRef.current.set(node.id, {
              latitude: node.latitude,
              longitude: node.longitude,
            });
            // Reduce console log frequency
            if (Math.random() < 0.1) {
              console.log(
                `Node ${node.id} (${node.name}) using server coordinates:`,
                node.latitude,
                node.longitude
              );
            }
          }
          return node;
        }

        // Priority 3: Check if we have stored coordinates for this node
        const storedCoords = nodeCoordinatesRef.current.get(node.id);
        if (storedCoords) {
          return {
            ...node,
            latitude: storedCoords.latitude,
            longitude: storedCoords.longitude,
          };
        }

        // Priority 4: Try to get coordinates from IP address via API (which uses geoip-lite)
        const ip = extractIPFromNode(node);
        if (ip) {
          try {
            const coords = await getCoordinatesFromIP(ip);
            if (coords) {
              nodeCoordinatesRef.current.set(node.id, coords);
              // Reduce console log frequency for GeoIP lookups
              if (Math.random() < 0.1) {
                console.log(
                  `Node ${node.id} (${node.name}) got coordinates from GeoIP API for ${ip}:`,
                  coords.latitude,
                  coords.longitude
                );
              }
              return {
                ...node,
                ...coords,
              };
            }
          } catch (error) {
            console.error(`Failed to get coordinates for IP ${ip}:`, error);
          }
        }

        // Fallback: Hide nodes without valid coordinates - let the server handle GeoIP
        // Only log once per node to reduce console spam and log very rarely
        const logKey = `${node.id}_logged`;
        if (!nodeCoordinatesRef.current.has(logKey) && Math.random() < 0.01) {
          // Only 1% chance to log
          console.warn(
            `Node ${node.id} (${node.name}) has no coordinate data - waiting for server GeoIP`
          );
          nodeCoordinatesRef.current.set(logKey, { latitude: 0, longitude: 0 });
        }
        return node;
      })
    );

    return processedNodes;
  }, []);

  // Last Block timer - calculate from actual block timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastBlockTimestamp) {
        // Calculate time difference from actual block timestamp
        const now = Date.now();
        const timeDiff = Math.floor((now - lastBlockTimestamp) / 1000);
        setLastBlockTime(timeDiff);
      } else {
        // Don't show timer until we have a valid timestamp
        setLastBlockTime(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastBlockTimestamp]);

  // Reset last block time when new block arrives - DISABLED (handled in WebSocket events)
  // useEffect(() => {
  //   const bestBlockValue = stats['bestBlock']?.value;
  //   if (bestBlockValue && typeof bestBlockValue === 'number' && bestBlockValue > 0) {
  //     // Only reset if bestBlock value actually changed
  //     if (bestBlockValue !== prevBestBlock) {
  //       setLastBlockTime(0);
  //       setPrevBestBlock(bestBlockValue);
  //     }
  //   }
  // }, [stats, prevBestBlock]);

  // Reset latency retry count periodically
  useEffect(() => {
    const retryTimer = setInterval(() => {
      setLatencyRetryCount((prev) => {
        if (prev > 0) {
          console.log('Resetting latency retry count from', prev, 'to', Math.max(0, prev - 1));
          return Math.max(0, prev - 1);
        }
        return prev;
      });
    }, 30000); // Reset one retry count every 30 seconds

    return () => clearInterval(retryTimer);
  }, []);

  // Reset reconnection attempts periodically to allow recovery from network issues
  useEffect(() => {
    const reconnectResetTimer = setInterval(() => {
      if (reconnectAttemptsRef.current > 0 && !wsConnectedRef.current) {
        console.log('Resetting reconnection attempts from', reconnectAttemptsRef.current, 'to 0');
        reconnectAttemptsRef.current = 0;
        wsInitializingRef.current = false; // Allow new connection attempts
      }
    }, 60000); // Reset reconnection attempts every minute

    return () => clearInterval(reconnectResetTimer);
  }, []);

  useEffect(() => {
    // Prevent multiple simultaneous connections - enhanced check with reconnect limit
    if (wsConnectionRef.current || wsInitializingRef.current) {
      console.log('WebSocket connection already exists or initializing, skipping...');
      return;
    }

    // Check reconnect attempts to prevent infinite reconnection loops
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log(
        `Max reconnection attempts (${maxReconnectAttempts}) reached, stopping reconnection`
      );
      setErrorStats(`Connection failed after ${maxReconnectAttempts} attempts`);
      return;
    }

    // Mark as initializing to prevent multiple attempts
    wsInitializingRef.current = true;
    // Don't increment attempts here - only increment on actual connection failures

    // Determine the appropriate server URL based on environment
    const customWsUrl = import.meta.env.VITE_WS_URL;
    const isProduction = import.meta.env.PROD;

    // Use custom WS URL if provided, otherwise use same origin (unified server)
    let baseUrl: string;
    let wsUrl: string;

    if (customWsUrl) {
      wsUrl = customWsUrl;
      baseUrl = customWsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    } else if (isProduction) {
      // In production, use same origin with secure protocols
      baseUrl = `${window.location.protocol}//${window.location.host}`;
      wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    } else {
      // Development environment - use same origin
      baseUrl = `${window.location.protocol}//${window.location.host}`;
      wsUrl = `ws://${window.location.host}`;
    }

    // Load Primus client library from server - prevent duplicate script loading
    const existingScript = document.querySelector(`script[src="${baseUrl}/primus/primus.js"]`);
    if (existingScript) {
      console.log('Primus script already loaded, reusing...');
      // Script already exists, check if Primus is available
      const existingScriptTimer = setTimeout(() => {
        if (!(window as unknown as { Primus?: unknown }).Primus) {
          console.error('Primus library not found after loading');
          setErrorStats('Failed to load Primus WebSocket library');
          wsInitializingRef.current = false;
          return;
        }

        // Continue with connection initialization
        initializePrimusConnection();
      }, 100);
      return () => {
        clearTimeout(existingScriptTimer);
      };
    }

    const script = document.createElement('script');
    script.src = `${baseUrl}/primus/primus.js`;
    script.onload = () => {
      // Double-check for duplicate script loading and initialization state
      if (wsConnectionRef.current || !wsInitializingRef.current) {
        console.log('WebSocket already initialized or not in initializing state, skipping...');
        wsInitializingRef.current = false;
        return;
      }

      console.log('Primus library loaded from:', baseUrl);
      initializePrimusConnection();
    };

    const initializePrimusConnection = () => {
      // Check if Primus is available
      if (!(window as unknown as { Primus?: unknown }).Primus) {
        console.error('Primus library not found after loading');
        setErrorStats('Failed to load Primus WebSocket library');
        wsInitializingRef.current = false;
        return;
      }

      try {
        const PrimusConstructor = (window as unknown as { Primus: new (url: string) => unknown })
          .Primus;
        const primus = new PrimusConstructor(wsUrl) as {
          on: (event: string, callback: (data?: unknown) => void) => void;
          emit?: (event: string, data?: unknown) => void;
          write?: (data: unknown) => void;
          end?: () => void;
          destroy?: () => void;
        };

        // Store the connection reference to prevent duplicates
        wsConnectionRef.current = primus;
        wsInitializingRef.current = false;

        primus.on('open', () => {
          console.log('WebSocket connection opened to:', wsUrl);
          wsConnectedRef.current = true;
          reconnectAttemptsRef.current = 0; // Reset reconnection attempts on successful connection
          setErrorStats('');
          // Small delay to ensure connection is fully established
          // eslint-disable-next-line @eslint-react/web-api-no-leaked-timeout
          const readyTimer = setTimeout(() => {
            try {
              if (typeof primus.emit === 'function') {
                primus.emit('ready');
              } else if (typeof primus.write === 'function') {
                primus.write({ action: 'ready' });
              }
              console.log('Ready event sent to server');
            } catch (err) {
              console.error('Failed to send ready event:', err);
            }
          }, 100);
          // Store timer for cleanup if needed
          void readyTimer;
        });

        primus.on('error', (err: unknown) => {
          console.error('WebSocket error:', err);
          const errorMessage =
            typeof err === 'object' && err !== null && 'message' in err
              ? (err as { message: string }).message
              : String(err);

          // Increment reconnection attempts on actual errors
          reconnectAttemptsRef.current += 1;
          setErrorStats(
            `WebSocket Error: ${errorMessage} (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
        });

        primus.on('close', () => {
          console.log('WebSocket connection closed');
          wsConnectedRef.current = false;
          wsConnectionRef.current = null; // Clear connection reference to allow reconnection

          // Increment reconnection attempts on close
          reconnectAttemptsRef.current += 1;

          // Prevent immediate reconnection with exponential backoff
          if (wsReconnectTimeoutRef.current) {
            clearTimeout(wsReconnectTimeoutRef.current);
          }

          // Check if we should attempt reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const reconnectDelay = Math.min(
              2000 * Math.pow(2, reconnectAttemptsRef.current - 1),
              30000
            ); // Max 30 seconds
            console.log(
              `Scheduling reconnection attempt ${reconnectAttemptsRef.current} in ${reconnectDelay}ms`
            );

            wsReconnectTimeoutRef.current = setTimeout(() => {
              wsInitializingRef.current = false; // Allow reconnection after delay
              // Force a re-render to trigger reconnection by updating a state variable
              setLastValidLatency((prev) => prev); // Trigger re-render without changing value
            }, reconnectDelay);

            setErrorStats(
              `Connection closed - reconnecting in ${Math.ceil(reconnectDelay / 1000)}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );
          } else {
            setErrorStats(`Connection closed - max reconnection attempts reached`);
            wsInitializingRef.current = false;
          }
        });

        primus.on('disconnect', () => {
          console.log('WebSocket disconnected');
          wsConnectedRef.current = false;
          wsConnectionRef.current = null; // Clear connection reference to allow reconnection

          // Increment reconnection attempts on disconnect
          reconnectAttemptsRef.current += 1;

          // Prevent immediate reconnection with exponential backoff
          if (wsReconnectTimeoutRef.current) {
            clearTimeout(wsReconnectTimeoutRef.current);
          }

          // Check if we should attempt reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const reconnectDelay = Math.min(
              2000 * Math.pow(2, reconnectAttemptsRef.current - 1),
              30000
            ); // Max 30 seconds
            console.log(
              `Scheduling reconnection attempt ${reconnectAttemptsRef.current} in ${reconnectDelay}ms`
            );

            wsReconnectTimeoutRef.current = setTimeout(() => {
              wsInitializingRef.current = false; // Allow reconnection after delay
              // Trigger reconnection by causing a re-render
              setErrorStats(
                `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
              );
            }, reconnectDelay);

            setErrorStats(
              `Disconnected - reconnecting in ${Math.ceil(reconnectDelay / 1000)}s (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );
          } else {
            setErrorStats(`Disconnected - max reconnection attempts reached`);
            wsInitializingRef.current = false;
          }
        });

        primus.on('data', async (message: unknown) => {
          const typedMessage = message as {
            action?: string;
            data?: {
              nodes?: Node[];
              stats?: StatsData;
              id?: string | number;
              serverTime?: number;
              latency?: number;
              pending?: number;
            };
          };
          if (typedMessage.action === 'init' && typedMessage.data) {
            // Only process if we have a stable connection to prevent multiple initializations
            if (!wsConnectedRef.current) {
              console.log('Ignoring init data - connection not stable');
              return;
            }

            // Only process coordinates for new nodes or if we don't have coordinates yet
            const incomingNodes = typedMessage.data.nodes || [];
            const needsCoordinateProcessing = incomingNodes.some((node) => {
              const stored = nodeCoordinatesRef.current.get(node.id);
              return !stored && (!node.latitude || !node.longitude);
            });

            let nodesWithCoords;
            if (needsCoordinateProcessing) {
              nodesWithCoords = await addCoordinatesToNodes(incomingNodes);
            } else {
              // Use existing coordinates to avoid unnecessary processing
              nodesWithCoords = incomingNodes.map((node) => {
                const stored = nodeCoordinatesRef.current.get(node.id);
                return stored
                  ? { ...node, latitude: stored.latitude, longitude: stored.longitude }
                  : node;
              });
            }
            setNodes(nodesWithCoords);

            // Check if bestBlock changed before resetting timer
            const newStats = typedMessage.data.stats || {};
            const newBestBlock = newStats['bestBlock']?.value;

            if (newBestBlock && typeof newBestBlock === 'number') {
              // Additional check for duplicate processing during init - increased window for more stability
              const now = Date.now();
              const alreadyProcessed = processedBlocksRef.current.get(newBestBlock);
              const recentlyProcessed = alreadyProcessed ? now - alreadyProcessed < 15000 : false; // Increased from 10 seconds to 15 seconds for init

              if (
                (prevBestBlock === null || newBestBlock !== prevBestBlock) &&
                !recentlyProcessed
              ) {
                // Only log block changes occasionally to reduce console spam
                if (Math.random() < 0.1) {
                  // Reduced from 0.3 to 0.1
                  console.log(`Init: setting bestBlock from ${prevBestBlock} to ${newBestBlock}`);
                }
                // Mark this block as processed
                processedBlocksRef.current.set(newBestBlock, now);

                // Update prevBestBlock immediately to prevent duplicate processing
                setPrevBestBlock(newBestBlock);

                // Try to find the most recent block timestamp from nodes
                const nodesWithTimestamp = typedMessage.data.nodes?.filter(
                  (node) => node.blockTimestamp && typeof node.blockTimestamp === 'number'
                );

                if (nodesWithTimestamp && nodesWithTimestamp.length > 0) {
                  const timestamps = nodesWithTimestamp.map((node) => node.blockTimestamp!);
                  const maxTimestamp = Math.max(...timestamps);
                  if (maxTimestamp > 0) {
                    // Calculate actual elapsed time since block was created
                    const elapsedSeconds = Math.floor((now - maxTimestamp) / 1000);
                    setLastBlockTime(elapsedSeconds);
                    setLastBlockTimestamp(maxTimestamp);
                    timerStartedForBlockRef.current = newBestBlock;
                    if (Math.random() < 0.1) {
                      console.log(
                        `Init: set block ${newBestBlock} timer to ${elapsedSeconds}s ago (timestamp: ${maxTimestamp})`
                      );
                    }
                  }
                } else {
                  // Alternative: try to find latest block info from nodes by block number
                  const nodesWithBlock = typedMessage.data.nodes?.filter(
                    (node) => node.block && typeof node.block === 'number'
                  );
                  if (nodesWithBlock && nodesWithBlock.length > 0) {
                    // Find the node with the highest block number
                    const maxBlockNode = nodesWithBlock.reduce((max, node) =>
                      node.block! > max.block! ? node : max
                    );

                    // If this node has lastBlockTime, parse it and calculate elapsed time
                    if (maxBlockNode.lastBlockTime) {
                      const lastBlockTimeStr = String(maxBlockNode.lastBlockTime);
                      const secondsMatch = lastBlockTimeStr.match(/(\d+)/);
                      if (secondsMatch) {
                        const reportedSeconds = parseInt(secondsMatch[1]);
                        setLastBlockTime(reportedSeconds);
                        // Estimate timestamp from reported seconds
                        const estimatedTimestamp = now - reportedSeconds * 1000;
                        setLastBlockTimestamp(estimatedTimestamp);
                        timerStartedForBlockRef.current = newBestBlock;
                        if (Math.random() < 0.1) {
                          console.log(
                            `Init: set block ${newBestBlock} timer to ${reportedSeconds}s ago (from lastBlockTime)`
                          );
                        }
                      }
                    }
                  } else {
                    // Fallback: check if stats contains lastBlock time information
                    const statsLastBlock = newStats['lastBlock'];
                    if (
                      statsLastBlock &&
                      typeof statsLastBlock.value === 'number' &&
                      statsLastBlock.value >= 0
                    ) {
                      const reportedSeconds = Number(statsLastBlock.value);
                      setLastBlockTime(reportedSeconds);
                      // Estimate timestamp from reported seconds
                      const estimatedTimestamp = now - reportedSeconds * 1000;
                      setLastBlockTimestamp(estimatedTimestamp);
                      timerStartedForBlockRef.current = newBestBlock;
                      if (Math.random() < 0.1) {
                        console.log(
                          `Init: set block ${newBestBlock} timer to ${reportedSeconds}s ago (from stats)`
                        );
                      }
                    }
                  }
                }
              }
            }

            setStats(newStats);

            // Set stable values on initialization to prevent flickering - only once per block
            if (
              typeof newBestBlock === 'number' &&
              (!stableValuesBlockRef.current || newBestBlock !== stableValuesBlockRef.current)
            ) {
              stableValuesBlockRef.current = newBestBlock;

              // Set stable Best Block first
              setStableBestBlock(newBestBlock);

              if (newStats['avgBlockTime'] && typeof newStats['avgBlockTime'].value === 'number') {
                setStableAvgBlockTime(Number(newStats['avgBlockTime'].value));
              }
              if (newStats['difficulty'] && typeof newStats['difficulty'].value === 'number') {
                setStableDifficulty(Number(newStats['difficulty'].value));
              }
              if (
                newStats['avgNetworkHashrate'] &&
                typeof newStats['avgNetworkHashrate'].value === 'number'
              ) {
                setStableAvgNetworkHashrate(Number(newStats['avgNetworkHashrate'].value));
              }
              if (newStats['latency'] && typeof newStats['latency'].value === 'number') {
                setStablePageLatency(Number(newStats['latency'].value));
              }
              if (newStats['uncles'] && typeof newStats['uncles'].value === 'number') {
                setStableUncles(Number(newStats['uncles'].value));
              }
              if (newStats['activeNodes'] && typeof newStats['activeNodes'].value === 'number') {
                setStableActiveNodes(Number(newStats['activeNodes'].value));
              }
              if (newStats['gasPrice'] && typeof newStats['gasPrice'].value === 'number') {
                setStableGasPrice(Number(newStats['gasPrice'].value));
              }
              if (newStats['gasLimit'] && typeof newStats['gasLimit'].value === 'number') {
                setStableGasLimit(Number(newStats['gasLimit'].value));
              }
            }

            // If we still don't have a last block time set, start from 0 for new blocks
            if (
              lastBlockTime === null &&
              newStats['lastBlock'] &&
              typeof newBestBlock === 'number'
            ) {
              // Check if we have lastBlock stat with actual time information
              const statsLastBlock = newStats['lastBlock'];
              if (
                statsLastBlock &&
                typeof statsLastBlock.value === 'number' &&
                statsLastBlock.value >= 0
              ) {
                const reportedSeconds = Number(statsLastBlock.value);
                setLastBlockTime(reportedSeconds);
                // Estimate timestamp from reported seconds
                const now = Date.now();
                const estimatedTimestamp = now - reportedSeconds * 1000;
                setLastBlockTimestamp(estimatedTimestamp);
                timerStartedForBlockRef.current = newBestBlock;
                if (Math.random() < 0.1) {
                  console.log(
                    `Init: fallback set timer to ${reportedSeconds}s ago for block ${newBestBlock}`
                  );
                }
              } else {
                // Final fallback: start from 0 if no time information available
                resetTimerForNewBlock(newBestBlock);
              }
            }

            setLoadingStats(false);
          } else if (typedMessage.action === 'update' && typedMessage.data) {
            // Handle periodic updates from server (every second)
            // Update node stats while preserving coordinates and geo information
            if (typedMessage.data.nodes && Array.isArray(typedMessage.data.nodes)) {
              // Full nodes array update - merge with existing nodes to preserve coordinates
              setNodes((prev) => {
                return typedMessage.data!.nodes!.map((serverNode: Node) => {
                  const existingNode = prev.find((n) => n.id === serverNode.id);
                  if (existingNode) {
                    // Preserve existing coordinates and geo, update everything else
                    return {
                      ...serverNode,
                      // Preserve coordinates from existing node if server doesn't have them
                      latitude: serverNode.latitude ?? existingNode.latitude,
                      longitude: serverNode.longitude ?? existingNode.longitude,
                      geo: serverNode.geo ?? existingNode.geo,
                    };
                  }
                  return serverNode;
                });
              });
            } else if (typedMessage.data.id && typedMessage.data.stats) {
              // Individual node update
              setNodes((prev) =>
                prev.map((node) => {
                  if (node.id === typedMessage.data!.id) {
                    return {
                      ...node,
                      stats: typedMessage.data!.stats,
                      // Coordinates are preserved by spreading existing node
                    };
                  }
                  return node;
                })
              );
            }
          } else if (typedMessage.action === 'block' && typedMessage.data) {
            // Handle block updates - refresh all data (both nodes and stats will be updated)
            if (typedMessage.data.nodes && typedMessage.data.stats) {
              // Check if bestBlock changed FIRST to prevent duplicate processing
              const newBestBlock = typedMessage.data.stats['bestBlock']?.value;
              const shouldResetTimer =
                newBestBlock &&
                typeof newBestBlock === 'number' &&
                (prevBestBlock === null || newBestBlock !== prevBestBlock);

              // Additional check: ensure we haven't processed this exact block recently
              const now = Date.now();
              let recentlyProcessed = false;
              if (typeof newBestBlock === 'number') {
                const alreadyProcessed = processedBlocksRef.current.get(newBestBlock);
                recentlyProcessed = alreadyProcessed ? now - alreadyProcessed < 8000 : false; // Increased from 5 seconds to 8 seconds
              }

              if (shouldResetTimer && !recentlyProcessed) {
                // Only log new block detection occasionally
                if (Math.random() < 0.1) {
                  // Reduced from 0.3 to 0.1
                  console.log(`New block detected: ${prevBestBlock} -> ${newBestBlock}`);
                }
                // Mark this block as processed
                if (typeof newBestBlock === 'number') {
                  processedBlocksRef.current.set(newBestBlock, now);
                  // Clean up old entries (keep only last 10 blocks)
                  if (processedBlocksRef.current.size > 10) {
                    const entries = Array.from(processedBlocksRef.current.entries());
                    entries.sort((a, b) => a[0] - b[0]); // Sort by block number
                    const toDelete = entries.slice(0, entries.length - 10);
                    toDelete.forEach(([blockNum]) => processedBlocksRef.current.delete(blockNum));
                  }
                }

                // Update prevBestBlock IMMEDIATELY to prevent duplicate processing
                setPrevBestBlock(newBestBlock as number);

                // Try to find the most recent block timestamp from nodes
                const nodesWithTimestamp = typedMessage.data.nodes?.filter(
                  (node) => node.blockTimestamp && typeof node.blockTimestamp === 'number'
                );

                if (nodesWithTimestamp && nodesWithTimestamp.length > 0) {
                  const timestamps = nodesWithTimestamp.map((node) => node.blockTimestamp!);
                  const maxTimestamp = Math.max(...timestamps);
                  if (maxTimestamp > 0) {
                    // For new blocks, reset to 0; for existing blocks during page load, calculate elapsed time
                    if (prevBestBlock !== null && newBestBlock > prevBestBlock) {
                      // This is a genuinely new block - always reset to 0
                      const wasReset = resetTimerForNewBlock(newBestBlock as number, maxTimestamp);
                      if (wasReset && Math.random() < 0.1) {
                        console.log(`Block: timer reset to 0 for new block ${newBestBlock}`);
                      }
                    } else {
                      // This might be page load with existing block - calculate actual elapsed time
                      const now = Date.now();
                      const elapsedSeconds = Math.floor((now - maxTimestamp) / 1000);
                      setLastBlockTime(elapsedSeconds);
                      setLastBlockTimestamp(maxTimestamp);
                      timerStartedForBlockRef.current = newBestBlock as number;
                      if (Math.random() < 0.1) {
                        console.log(
                          `Block: set timer to ${elapsedSeconds}s ago for block ${newBestBlock}`
                        );
                      }
                    }
                  }
                } else {
                  // Fallback: Use lastBlock stat if available
                  const statsLastBlock = typedMessage.data.stats['lastBlock'];
                  if (
                    statsLastBlock &&
                    typeof statsLastBlock.value === 'number' &&
                    statsLastBlock.value >= 0
                  ) {
                    if (prevBestBlock !== null && newBestBlock > prevBestBlock) {
                      // New block - always reset to 0
                      const wasReset = resetTimerForNewBlock(newBestBlock as number);
                      if (wasReset && Math.random() < 0.1) {
                        console.log(`Block: timer reset to 0 for new block ${newBestBlock}`);
                      }
                    } else {
                      // Existing block - use reported time
                      const reportedSeconds = Number(statsLastBlock.value);
                      setLastBlockTime(reportedSeconds);
                      const now = Date.now();
                      const estimatedTimestamp = now - reportedSeconds * 1000;
                      setLastBlockTimestamp(estimatedTimestamp);
                      timerStartedForBlockRef.current = newBestBlock as number;
                      if (Math.random() < 0.1) {
                        console.log(
                          `Block: set timer to ${reportedSeconds}s ago for block ${newBestBlock}`
                        );
                      }
                    }
                  } else {
                    // Force reset to 0 for new blocks even without timestamp
                    const wasReset = resetTimerForNewBlock(newBestBlock as number);
                    if (wasReset && Math.random() < 0.1) {
                      console.log(`Block: forced timer reset for block ${newBestBlock}`);
                    }
                  }
                }
              }

              // Process nodes with coordinate preservation - avoid unnecessary coordinate processing
              const incomingNodes = typedMessage.data.nodes;
              const needsCoordinateProcessing = incomingNodes.some((node) => {
                const stored = nodeCoordinatesRef.current.get(node.id);
                return !stored && (!node.latitude || !node.longitude);
              });

              let nodesWithCoords;
              if (needsCoordinateProcessing) {
                nodesWithCoords = await addCoordinatesToNodes(incomingNodes);
              } else {
                // Use existing coordinates to avoid unnecessary processing
                nodesWithCoords = incomingNodes.map((node) => {
                  const stored = nodeCoordinatesRef.current.get(node.id);
                  return stored
                    ? { ...node, latitude: stored.latitude, longitude: stored.longitude }
                    : node;
                });
              }
              setNodes(nodesWithCoords);

              // Update stable values ONLY on new blocks to prevent flickering - first value wins
              const blockStats = typedMessage.data.stats;
              if (
                typeof newBestBlock === 'number' &&
                (!stableValuesBlockRef.current || newBestBlock !== stableValuesBlockRef.current)
              ) {
                stableValuesBlockRef.current = newBestBlock;

                // Set stable Best Block first
                setStableBestBlock(newBestBlock);

                if (
                  blockStats['avgBlockTime'] &&
                  typeof blockStats['avgBlockTime'].value === 'number'
                ) {
                  setStableAvgBlockTime(Number(blockStats['avgBlockTime'].value));
                }
                if (
                  blockStats['difficulty'] &&
                  typeof blockStats['difficulty'].value === 'number'
                ) {
                  setStableDifficulty(Number(blockStats['difficulty'].value));
                }
                if (
                  blockStats['avgNetworkHashrate'] &&
                  typeof blockStats['avgNetworkHashrate'].value === 'number'
                ) {
                  setStableAvgNetworkHashrate(Number(blockStats['avgNetworkHashrate'].value));
                }
                if (blockStats['latency'] && typeof blockStats['latency'].value === 'number') {
                  setStablePageLatency(Number(blockStats['latency'].value));
                }
                if (blockStats['uncles'] && typeof blockStats['uncles'].value === 'number') {
                  setStableUncles(Number(blockStats['uncles'].value));
                }
                if (
                  blockStats['activeNodes'] &&
                  typeof blockStats['activeNodes'].value === 'number'
                ) {
                  setStableActiveNodes(Number(blockStats['activeNodes'].value));
                }
                if (blockStats['gasPrice'] && typeof blockStats['gasPrice'].value === 'number') {
                  setStableGasPrice(Number(blockStats['gasPrice'].value));
                }
                if (blockStats['gasLimit'] && typeof blockStats['gasLimit'].value === 'number') {
                  setStableGasLimit(Number(blockStats['gasLimit'].value));
                }
              }

              setStats(typedMessage.data.stats);
            } else if (typedMessage.data.id) {
              // Individual node update - preserve coordinates and check for block timestamp updates
              setNodes((prev) =>
                prev.map((node) => {
                  if (node.id === typedMessage.data!.id) {
                    const updatedNode = { ...node, ...typedMessage.data };

                    // If this node has a newer block timestamp, update our global timestamp only if not already set for this block
                    if (
                      updatedNode.blockTimestamp &&
                      typeof updatedNode.blockTimestamp === 'number'
                    ) {
                      setLastBlockTimestamp((currentTimestamp) => {
                        if (!currentTimestamp || updatedNode.blockTimestamp! > currentTimestamp) {
                          // Only update timestamp, don't reset timer count during individual updates
                          // Timer reset should only happen during block/init actions
                          return updatedNode.blockTimestamp!;
                        }
                        return currentTimestamp;
                      });
                    }

                    return updatedNode;
                  }
                  return node;
                })
              );
            }
          } else if (typedMessage.action === 'stats' && typedMessage.data) {
            // Handle stats updates - NEVER process bestBlock in stats action to prevent unwanted resets

            // Update individual node stats without changing coordinates
            if (typedMessage.data.id && typedMessage.data.stats) {
              setNodes((prev) =>
                prev.map((node) => {
                  if (node.id === typedMessage.data!.id) {
                    // Only update if stats actually changed
                    const newStats = typedMessage.data!.stats;
                    const currentStats = (node as unknown as { stats?: unknown }).stats;
                    if (JSON.stringify(currentStats) !== JSON.stringify(newStats)) {
                      return { ...node, stats: newStats } as Node;
                    }
                    return node;
                  }
                  return node;
                })
              );
            }

            // For global stats updates, only update non-bestBlock and non-lastBlock stats
            if (typedMessage.data.stats && !typedMessage.data.id) {
              // Create a copy of stats without bestBlock and lastBlock to prevent interference
              const statsWithoutCriticalValues = { ...typedMessage.data.stats };
              delete statsWithoutCriticalValues['bestBlock'];
              delete statsWithoutCriticalValues['lastBlock']; // Prevent lastBlock timer interference

              // DO NOT UPDATE stable values during stats updates - only use block update values
              // This prevents flickering by ensuring only the first value after block update is used

              // Only update non-critical stats
              setStats((prevStats) => ({
                ...prevStats,
                ...statsWithoutCriticalValues,
              }));
            }
          } else if (typedMessage.action === 'pending' && typedMessage.data) {
            // Handle pending transaction updates - do NOT process bestBlock

            // Update individual node pending stats without changing coordinates or bestBlock
            if (typedMessage.data.id) {
              setNodes((prev) =>
                prev.map((node) => {
                  if (node.id === typedMessage.data!.id) {
                    const newPending = typedMessage.data!.pending || 0;
                    if (node.pending !== newPending) {
                      return { ...node, pending: newPending };
                    }
                    return node;
                  }
                  return node;
                })
              );
            }
          } else if (typedMessage.action === 'latency' && typedMessage.data) {
            // Handle latency updates - do NOT process bestBlock

            // Update individual node latency without changing coordinates or bestBlock
            if (typedMessage.data.id) {
              setNodes((prev) =>
                prev.map((node) => {
                  if (node.id === typedMessage.data!.id) {
                    const newLatency = typedMessage.data!.latency || 0;
                    if (node.latency !== newLatency) {
                      return { ...node, latency: newLatency };
                    }
                    return node;
                  }
                  return node;
                })
              );
            }
          } else if (typedMessage.action === 'charts' && typedMessage.data) {
            // Handle charts data if needed
          } else if (typedMessage.action === 'client-ping' && typedMessage.data) {
            // Handle server ping - send pong back with the server time
            const currentTime = Date.now();
            const pongData = {
              serverTime: typedMessage.data.serverTime,
              clientTime: currentTime,
            };
            let pongSent = false;
            // Method 1: Try write method first (most reliable for Primus)
            try {
              if (typeof primus.write === 'function') {
                primus.write({
                  action: 'client-pong',
                  data: pongData,
                });
                pongSent = true;
              }
            } catch {
              // Error ignored intentionally
            }
            // Method 2: Try emit method as backup if write failed
            if (!pongSent) {
              try {
                if (typeof primus.emit === 'function') {
                  primus.emit('client-pong', pongData);
                  pongSent = true;
                }
              } catch {
                // Error ignored intentionally
              }
            }
            // Update retry count based on success
            if (pongSent) {
              setLatencyRetryCount(0);
            } else {
              setLatencyRetryCount((prev) => prev + 1);
            }
          } else if (typedMessage.action === 'client-latency' && typedMessage.data) {
            if (typedMessage.data.latency !== undefined && typedMessage.data.latency > 0) {
              const newLatency = Math.round(typedMessage.data.latency);
              // Update both state variables
              setPageLatency(newLatency);
              setLastValidLatency(newLatency);
              // DO NOT update stable latency here - only use block update values to prevent flickering
              setStats((prevStats) => ({
                ...prevStats,
                pageLatency: {
                  value: newLatency,
                  unit: 'ms',
                },
              }));
              // Reset retry count on successful latency update
              setLatencyRetryCount(0);
            } else {
              setLatencyRetryCount((prev) => prev + 1);
            }
          }
        });

        primus.on('error', () => {
          setErrorStats('Connection error');
        });
      } catch (err) {
        console.error('Failed to initialize Primus:', err);
        setErrorStats('Failed to initialize Primus');
        wsInitializingRef.current = false;
        wsConnectionRef.current = null;
        reconnectAttemptsRef.current += 1; // Increment on initialization failure
      }
    };

    script.onerror = (error) => {
      console.error('Failed to load Primus library from:', baseUrl, error);
      setErrorStats(`Failed to load WebSocket library from ${baseUrl}`);
      setLoadingStats(false);
      wsInitializingRef.current = false;
      reconnectAttemptsRef.current += 1; // Increment on script load failure
    };

    document.head.appendChild(script);

    return () => {
      // Clean up reconnection timeout
      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
        wsReconnectTimeoutRef.current = null;
      }

      // Clean up WebSocket connection
      if (wsConnectionRef.current) {
        try {
          if (typeof wsConnectionRef.current.end === 'function') {
            wsConnectionRef.current.end();
          } else if (typeof wsConnectionRef.current.destroy === 'function') {
            wsConnectionRef.current.destroy();
          }
        } catch (error) {
          console.warn('Error closing WebSocket connection:', error);
        }
        wsConnectionRef.current = null;
        wsConnectedRef.current = false;
        wsInitializingRef.current = false;
        reconnectAttemptsRef.current = 0; // Reset reconnection attempts
      }

      // Clean up script element
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps, react-hooks/exhaustive-deps
  }, []); // Empty dependency array to prevent reconnection loops

  const statCards = [
    { id: 'bestBlock', icon: <FaCube className="text-blue-400" />, label: 'Best Block' },
    { id: 'uncles', icon: <FaLayerGroup className="text-purple-400" />, label: 'Uncles' },
    { id: 'lastBlock', icon: <FaClock className="text-blue-400" />, label: 'Last Block' },
    {
      id: 'avgBlockTime',
      icon: <FaStopwatch className="text-orange-400" />,
      label: 'Avg Block Time',
    },
    {
      id: 'avgNetworkHashrate',
      icon: <FaSignal className="text-cyan-400" />,
      label: 'Avg Network Hashrate',
    },
    { id: 'difficulty', icon: <FaHashtag className="text-red-400" />, label: 'Difficulty' },
  ];

  const formatStatValue = (card: { id: string }) => {
    if (loadingStats) return '--';
    if (errorStats) return '!';

    // For new blocks, use stable values to prevent showing '!' during data updates
    const stat = stats[card.id];
    if (!stat || stat === undefined || stat.value === undefined) {
      // Use stable values as fallback to prevent '!' display during block updates
      switch (card.id) {
        case 'bestBlock':
          return stableBestBlock !== null ? stableBestBlock.toLocaleString() : '--';
        case 'avgBlockTime':
          return stableAvgBlockTime !== null &&
            typeof stableAvgBlockTime === 'number' &&
            !isNaN(stableAvgBlockTime)
            ? `${stableAvgBlockTime.toFixed(2)} s`
            : '--';
        case 'difficulty':
          return stableDifficulty !== null &&
            typeof stableDifficulty === 'number' &&
            !isNaN(stableDifficulty)
            ? `${(stableDifficulty / 1e9).toFixed(2)} GH`
            : '--';
        case 'avgNetworkHashrate':
          return stableAvgNetworkHashrate !== null &&
            typeof stableAvgNetworkHashrate === 'number' &&
            !isNaN(stableAvgNetworkHashrate)
            ? `${(stableAvgNetworkHashrate / 1e9).toFixed(2)} GH/s`
            : '--';
        case 'uncles':
          return stableUncles !== null ? stableUncles.toString() : '--';
        case 'activeNodes':
          return stableActiveNodes !== null ? stableActiveNodes.toLocaleString() : '--';
        case 'lastBlock':
          return lastBlockTime !== null ? `${lastBlockTime} s ago` : '--';
        case 'gasPrice':
          return stableGasPrice !== null ? `${Math.floor(weiToGwei(stableGasPrice))} Gniku` : '--';
        case 'gasLimit':
          return stableGasLimit !== null ? formatLargeNumber(stableGasLimit) : '--';
        default:
          return '--';
      }
    }

    if (card.id === 'uptime' && typeof stat.value === 'object' && stat.value !== null) {
      if (stat.value.lastStatus !== undefined) {
        return `${Number(stat.value.lastStatus).toFixed(2)}%`;
      }
      if (stat.value.up !== undefined && stat.value.down !== undefined) {
        const total = stat.value.up + stat.value.down;
        const percentage = total > 0 ? (stat.value.up / total) * 100 : 0;
        return `${percentage.toFixed(2)}%`;
      }
      return '--';
    }

    switch (card.id) {
      case 'lastBlock':
        return lastBlockTime !== null ? `${lastBlockTime} s ago` : '--';
      case 'avgBlockTime':
        // Use stable value to prevent flickering
        const blockTime = stableAvgBlockTime !== null ? stableAvgBlockTime : Number(stat.value);
        return `${blockTime.toFixed(2)} s`;
      case 'avgNetworkHashrate':
        // Use stable value to prevent flickering
        const hashrate =
          stableAvgNetworkHashrate !== null ? stableAvgNetworkHashrate : Number(stat.value);
        return `${(hashrate / 1e9).toFixed(2)} GH/s`;
      case 'difficulty':
        // Use stable value to prevent flickering
        const difficulty = stableDifficulty !== null ? stableDifficulty : Number(stat.value);
        return `${(difficulty / 1e9).toFixed(2)} GH`;
      case 'gasPrice':
        // Use stable value to prevent flickering, fallback to current stat
        const gasPrice = stableGasPrice !== null ? stableGasPrice : Number(stat.value);
        const priceInGwei = weiToGwei(gasPrice);
        return `${Math.floor(priceInGwei)} Gniku`;
      case 'gasLimit':
        // Use stable value to prevent flickering, fallback to current stat
        const gasLimit = stableGasLimit !== null ? stableGasLimit : Number(stat.value);
        return formatLargeNumber(gasLimit);
      case 'bestBlock':
        // Use stable value to prevent constant changes - prioritize stable value more strongly
        const bestBlock =
          stableBestBlock !== null
            ? stableBestBlock
            : stats[card.id] && typeof stats[card.id].value === 'number'
              ? Number(stats[card.id].value)
              : 0;
        return bestBlock.toLocaleString();
      case 'activeNodes':
        // Use stable value to prevent constant changes
        const activeNodes = stableActiveNodes !== null ? stableActiveNodes : Number(stat.value);
        return activeNodes.toLocaleString();
      case 'uncles':
        // Use stable value to prevent flickering
        const uncles = stableUncles !== null ? stableUncles : Number(stat.value);
        return uncles.toString();
      default:
        if (typeof stat.value === 'object' && stat.value !== null) {
          return JSON.stringify(stat.value);
        }
        return String(stat.value);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main Content */}
      <main className="container-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Statistics Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <div
              key={card.id}
              className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="mb-2 flex items-center justify-between">
                {/* eslint-disable-next-line @eslint-react/no-clone-element */}
                {React.cloneElement(card.icon, {
                  className: 'text-3xl ' + card.icon.props.className,
                })}
              </div>
              <div
                className={`mb-1 text-2xl font-bold ${
                  card.id === 'lastBlock' ? getLastBlockTimeColor(lastBlockTime || 0) : 'text-white'
                }`}
              >
                {formatStatValue(card)}
              </div>
              <div className="text-sm tracking-wide text-gray-400 uppercase">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Additional Statistics Row */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Nodes */}
          <div className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="mb-2 flex items-center justify-between">
              <FaUsers className="text-3xl text-indigo-400" />
            </div>
            <div className="mb-1 text-2xl font-bold text-white">
              {loadingStats
                ? '--'
                : errorStats
                  ? '!'
                  : (() => {
                      // Use stable value to prevent constant changes and '!' during updates
                      const activeNodes =
                        stableActiveNodes !== null
                          ? stableActiveNodes
                          : stats['activeNodes'] && typeof stats['activeNodes'].value === 'number'
                            ? Number(stats['activeNodes'].value)
                            : 0;
                      return activeNodes > 0
                        ? `${activeNodes.toLocaleString()}/${nodes.length}`
                        : '--';
                    })()}
            </div>
            <div className="text-sm tracking-wide text-gray-400 uppercase">Active Nodes</div>
          </div>

          {/* Gas Price */}
          <div className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="mb-2 flex items-center justify-between">
              <FaMoneyBillWave className="text-3xl text-emerald-400" />
            </div>
            <div className="mb-1 text-2xl font-bold text-white">
              {loadingStats
                ? '--'
                : errorStats
                  ? '!'
                  : (() => {
                      // Use stable value to prevent '!' during updates, fallback to current stat
                      if (stableGasPrice !== null) {
                        const priceInGwei = weiToGwei(stableGasPrice);
                        return `${Math.floor(priceInGwei)} Gniku`;
                      } else if (stats['gasPrice'] && typeof stats['gasPrice'].value === 'number') {
                        const priceInGwei = weiToGwei(Number(stats['gasPrice'].value));
                        return `${Math.floor(priceInGwei)} Gniku`;
                      }
                      return '--';
                    })()}
            </div>
            <div className="text-sm tracking-wide text-gray-400 uppercase">Gas Price</div>
          </div>

          {/* Gas Limit */}
          <div className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="mb-2 flex items-center justify-between">
              <FaSignal className="text-3xl text-amber-400" />
            </div>
            <div className="mb-1 text-2xl font-bold text-white">
              {loadingStats
                ? '--'
                : errorStats
                  ? '!'
                  : (() => {
                      // Use stable value to prevent '!' during updates, fallback to current stat
                      if (stableGasLimit !== null) {
                        return formatLargeNumber(stableGasLimit);
                      } else if (stats['gasLimit'] && typeof stats['gasLimit'].value === 'number') {
                        return formatLargeNumber(Number(stats['gasLimit'].value));
                      }
                      return '--';
                    })()}
            </div>
            <div className="text-sm tracking-wide text-gray-400 uppercase">Gas Limit</div>
          </div>

          {/* Page Latency */}
          <div className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="mb-2 flex items-center justify-between">
              <FaClock className="text-3xl text-pink-400" />
              {latencyRetryCount > 2 && (
                <div className="text-xs text-yellow-400">⚠️ {latencyRetryCount}</div>
              )}
            </div>
            <div className="mb-1 text-2xl font-bold text-white">
              {(() => {
                // Priority order: stablePageLatency > stats > pageLatency > lastValidLatency > fallback
                if (stablePageLatency > 0) {
                  return `${stablePageLatency} ms`;
                } else if (
                  stats['pageLatency']?.value &&
                  typeof stats['pageLatency'].value === 'number' &&
                  stats['pageLatency'].value > 0
                ) {
                  return `${stats['pageLatency'].value} ms`;
                } else if (pageLatency > 0) {
                  return `${pageLatency} ms`;
                } else if (lastValidLatency > 0 && latencyRetryCount < 5) {
                  return `${lastValidLatency} ms*`;
                } else if (latencyRetryCount > 0) {
                  return `-- (retry: ${latencyRetryCount})`;
                } else {
                  return '--';
                }
              })()}
            </div>
            <div className="text-sm tracking-wide text-gray-400 uppercase">
              Page Latency
              {lastValidLatency > 0 && latencyRetryCount > 0 && latencyRetryCount < 5 && (
                <span className="text-xs"> (*last known)</span>
              )}
            </div>
          </div>
        </div>

        {/* Halving Countdown */}
        <div className="mb-8">
          <Suspense fallback={<SectionLoading label="Loading Halving Countdown..." />}>
            <HalvingCountdown
              bestBlock={
                stableBestBlock !== null
                  ? stableBestBlock
                  : typeof stats['bestBlock']?.value === 'number'
                    ? Number(stats['bestBlock'].value)
                    : null
              }
              avgBlockTime={stableAvgBlockTime}
            />
          </Suspense>
        </div>

        {/* Charts and Visualizations */}
        <div className="mb-8">
          <Suspense fallback={<SectionLoading label="Loading Chart..." />}>
            <Charts currentStats={stats} nodes={nodes} />
          </Suspense>
        </div>

        {/* Nodes Table */}
        <Suspense fallback={<SectionLoading label="Loading Nodes..." />}>
          <Nodes
            nodes={nodes}
            bestBlock={typeof stats['bestBlock']?.value === 'number' ? stats['bestBlock'].value : 0}
          />
        </Suspense>
      </main>
    </div>
  );
}

export default HomePage;
