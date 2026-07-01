import React, { useState, useMemo, useEffect } from 'react';

interface Node {
  id: string | number;
  name: string;
  type?: string;
  info?: {
    name?: string;
    type?: string;
    ip?: string;
    node?: string;
    net?: string;
    protocol?: string;
    api?: string;
    port?: string;
    os?: string;
    os_v?: string;
    client?: string;
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
  lastBlockTime?: string | number;
  propagation?: string | number;
  propagationAvg?: string | number;
  uptime?: { lastStatus?: number; up?: number; down?: number };
  pinned?: boolean;
  latitude?: number;
  longitude?: number;
  blockTimestamp?: number;
  stats?: {
    active: boolean;
    mining: boolean;
    hashrate: number;
    peers: number;
    pending: number;
    gasPrice: number;
    uptime: number;
    latency: number;
    block: {
      number: number;
      hash: string;
      totalDifficulty: number;
      timestamp: number;
      time: number;
      received: number;
      propagation: number;
      transactions: unknown[];
      uncles: unknown[];
    };
    propagationAvg: number;
  };
  readable?: {
    latencyClass: string;
    latency: string;
  };
}

interface NodesProps {
  nodes?: Node[];
  bestBlock?: number;
}

type SortField =
  | 'name'
  | 'type'
  | 'latency'
  | 'mining'
  | 'peers'
  | 'pending'
  | 'block'
  | 'hash'
  | 'difficulty'
  | 'transactions'
  | 'uncles'
  | 'blockTime'
  | 'propagation'
  | 'avgPropagation'
  | 'uptime';
type SortDirection = 'asc' | 'desc';

const Nodes: React.FC<NodesProps> = ({ nodes = [], bestBlock = 0 }) => {
  const [pinnedNodes, setPinnedNodes] = useState<Set<string | number>>(() => new Set());
  const [hoveredNode, setHoveredNode] = useState<{ node: Node; x: number; y: number } | null>(null);

  // Initialize sort state from localStorage or default values
  const [sortField, setSortField] = useState<SortField | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nodesSortField');
      return (saved as SortField) || 'propagation';
    }
    return 'propagation';
  });

  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nodesSortDirection');
      return (saved as SortDirection) || 'asc';
    }
    return 'asc';
  });

  // Real-time counter for block times - updates every second
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Store when each node's block was first received
  const [nodeBlockBaseTimes, setNodeBlockBaseTimes] = useState<
    Map<string | number, { baseTime: number; blockNumber: number }>
  >(() => new Map());

  // Store stable node types to prevent flickering
  const [stableNodeTypes, setStableNodeTypes] = useState<Map<string | number, string>>(
    () => new Map()
  ); // Update current time every second for real-time block time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Save sort state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sortField) {
        localStorage.setItem('nodesSortField', sortField);
      }
      localStorage.setItem('nodesSortDirection', sortDirection);
    }
  }, [sortField, sortDirection]);

  // Track node block base times to enable real-time counting
  useEffect(() => {
    nodes.forEach((node) => {
      const currentBlockNumber = node.stats?.block?.number ?? node.block ?? 0;
      const nodeId = node.id;

      setNodeBlockBaseTimes((prev) => {
        const existingData = prev.get(nodeId);

        // Only update if this is a new node OR block number actually increased
        if (!existingData) {
          // New node - set initial base time
          const now = Date.now();
          const newMap = new Map(prev);
          newMap.set(nodeId, {
            baseTime: now,
            blockNumber: currentBlockNumber,
          });
          return newMap;
        } else if (currentBlockNumber > existingData.blockNumber) {
          // Block number increased - reset timer only for genuinely new blocks
          const now = Date.now();
          const newMap = new Map(prev);
          newMap.set(nodeId, {
            baseTime: now,
            blockNumber: currentBlockNumber,
          });
          return newMap;
        } else if (currentBlockNumber === existingData.blockNumber) {
          // Same block number - do NOT update base time to prevent flickering
          // Keep the existing base time to maintain stable display
          return prev;
        }

        // Block number decreased (unlikely but handle gracefully) - keep existing
        return prev;
      });

      // Update stable node types only when block changes
      setStableNodeTypes((prev) => {
        const existingData = nodeBlockBaseTimes.get(nodeId);
        const currentNodeType = node.info?.node;

        if (currentNodeType && (!existingData || currentBlockNumber > existingData.blockNumber)) {
          const newMap = new Map(prev);
          newMap.set(nodeId, currentNodeType);
          return newMap;
        }

        return prev;
      });
    });
  }, [nodes, nodeBlockBaseTimes]);

  // Toggle pin status for a node
  const togglePin = (nodeId: string | number) => {
    setPinnedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort nodes with pinned ones first, then by selected field - stable sort implementation
  const sortedNodes = useMemo(() => {
    // Get sort value for a node
    const getSortValue = (node: Node, field: SortField): string | number => {
      switch (field) {
        case 'name':
          return (node.info?.name || node.name).toLowerCase();
        case 'type':
          return (stableNodeTypes.get(node.id) || node.info?.node || '').toLowerCase();
        case 'latency':
          return (
            node.stats?.latency ??
            (typeof node.latency === 'object'
              ? parseInt(node.latency?.latency || '0')
              : node.latency
                ? parseInt(String(node.latency))
                : 0)
          );
        case 'mining':
          return (node.stats?.mining ?? node.mining) ? 1 : 0;
        case 'peers':
          const peers = node.stats?.peers ?? node.peers ?? 0;
          return typeof peers === 'object' && peers !== null && 'value' in peers
            ? ((peers as { value: number }).value ?? 0)
            : typeof peers === 'number'
              ? peers
              : 0;
        case 'pending':
          const pending = node.stats?.pending ?? node.pending ?? 0;
          return typeof pending === 'object' && pending !== null && 'value' in pending
            ? ((pending as { value: number }).value ?? 0)
            : typeof pending === 'number'
              ? pending
              : 0;
        case 'block':
          const blockNumber = node.stats?.block?.number ?? node.block ?? 0;
          return typeof blockNumber === 'object' && blockNumber !== null && 'value' in blockNumber
            ? ((blockNumber as { value: number }).value ?? 0)
            : typeof blockNumber === 'number'
              ? blockNumber
              : 0;
        case 'hash':
          return (node.stats?.block?.hash ?? node.blockHash ?? '').toLowerCase();
        case 'difficulty':
          return node.stats?.block?.totalDifficulty ?? node.totalDifficulty ?? 0;
        case 'transactions':
          const transactions = node.stats?.block?.transactions ?? node.transactions ?? 0;
          if (Array.isArray(transactions)) return transactions.length;
          return typeof transactions === 'object' &&
            transactions !== null &&
            'value' in transactions
            ? ((transactions as { value: number }).value ?? 0)
            : typeof transactions === 'number'
              ? transactions
              : 0;
        case 'uncles':
          const uncles = node.stats?.block?.uncles ?? node.uncles ?? 0;
          if (Array.isArray(uncles)) return uncles.length;
          return typeof uncles === 'object' && uncles !== null && 'value' in uncles
            ? ((uncles as { value: number }).value ?? 0)
            : typeof uncles === 'number'
              ? uncles
              : 0;
        case 'blockTime':
          return typeof node.lastBlockTime === 'number' ? node.lastBlockTime : 0;
        case 'propagation':
          return Number(node.stats?.block?.propagation || node.propagation || 0);
        case 'avgPropagation':
          return Number(node.stats?.propagationAvg || node.propagationAvg || 0);
        case 'uptime':
          const uptimeValue = node.stats?.uptime ?? node.uptime;
          if (typeof uptimeValue === 'object' && uptimeValue !== null) {
            if (uptimeValue.lastStatus !== undefined) {
              return uptimeValue.lastStatus;
            }
            if (uptimeValue.up !== undefined && uptimeValue.down !== undefined) {
              const total = uptimeValue.up + uptimeValue.down;
              return total > 0 ? (uptimeValue.up / total) * 100 : 0;
            }
            return 100;
          }
          return typeof uptimeValue === 'number' ? uptimeValue : 0;
        default:
          return 0;
      }
    };

    const sorted = [...nodes]
      .map((node, index) => ({ node, originalIndex: index }))
      .sort((a, b) => {
        const aIsPinned = pinnedNodes.has(a.node.id);
        const bIsPinned = pinnedNodes.has(b.node.id);

        // Pinned nodes always come first
        if (aIsPinned && !bIsPinned) return -1;
        if (!aIsPinned && bIsPinned) return 1;

        // If no sort field is selected, maintain original order
        if (!sortField) return a.originalIndex - b.originalIndex;

        // Sort by selected field
        const aValue = getSortValue(a.node, sortField);
        const bValue = getSortValue(b.node, sortField);

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;

        // For stable sort: if values are equal, maintain original order
        return a.originalIndex - b.originalIndex;
      });

    return sorted.map((item) => item.node);
  }, [nodes, pinnedNodes, sortField, sortDirection, stableNodeTypes]);

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-500">↕️</span>;
    }
    return <span className="ml-1 text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Helper functions for styling classes
  const getNodeClass = (node: Node) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const peers = node.stats?.peers ?? node.peers ?? 0;

    if (!active) return 'text-gray-400';
    if (peers === 0) return 'text-red-400';
    return getPeerClass(peers, active);
  };

  const getPeerClass = (peers: number, active: boolean) => {
    if (!active) return 'text-gray-400';
    if (peers <= 1) return 'text-red-400';
    if (peers < 4) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const getLatencyClass = (node: Node) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const latency =
      node.stats?.latency ??
      (typeof node.latency === 'object'
        ? parseInt(node.latency?.latency || '0')
        : node.latency
          ? parseInt(String(node.latency))
          : 0);

    if (!active) return 'text-red-400';
    if (latency <= 100) return 'text-blue-400';
    if (latency <= 1000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBlockClass = (node: Node, bestBlock: number) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const blockNumber = node.stats?.block?.number ?? node.block ?? 0;

    if (!active) return 'text-gray-400';
    if (blockNumber < bestBlock) return 'text-yellow-400';
    return 'text-blue-400'; // Latest block is always green
  };

  const getBlockHashClass = (node: Node, bestBlock: number) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const blockNumber = node.stats?.block?.number ?? node.block ?? 0;

    if (!active) return 'text-gray-400';
    if (blockNumber < bestBlock) return 'text-yellow-400';
    return 'text-blue-400'; // Latest block hash is always green
  };

  const getMiningClass = (node: Node) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const mining = node.stats?.mining ?? node.mining ?? false;

    if (!active) return 'text-gray-400';
    return mining ? 'text-blue-400' : 'text-red-400';
  };

  const getUptimeClass = (uptime: number, active: boolean) => {
    if (!active) return 'text-gray-400';
    if (uptime >= 95) return 'text-blue-400';
    if (uptime >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Function to get elapsed seconds for a node's last block
  const getElapsedSeconds = (node: Node) => {
    const nodeId = node.id;
    const baseTimeData = nodeBlockBaseTimes.get(nodeId);

    if (baseTimeData) {
      // Calculate real-time seconds elapsed since block was received
      const elapsedMs = currentTime - baseTimeData.baseTime;
      return Math.floor(elapsedMs / 1000);
    }

    // Fallback to server-provided lastBlockTime if available
    const secondsAgo = typeof node.lastBlockTime === 'number' ? node.lastBlockTime : null;
    if (secondsAgo !== null) {
      return secondsAgo;
    }

    // Fallback to timestamp-based calculation
    const received =
      node.stats?.block?.received || node.stats?.block?.timestamp || node.blockTimestamp;

    if (!received || received < 1e6) {
      return 0; // Consider as current for "Live" nodes
    }

    // Use current real-time for calculation
    const now = currentTime;
    const receivedMs = received < 1e12 ? received * 1000 : received;
    const diff = Math.floor((now - receivedMs) / 1000);

    // Handle invalid timestamps
    if (diff < 0 || diff > 86400 * 365) {
      return 0; // Consider as current for invalid timestamps
    }

    return diff;
  };

  // Function to get color class for Last Block based on elapsed time
  const getLastBlockTimeClass = (node: Node, bestBlock: number) => {
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const blockNumber = node.stats?.block?.number ?? node.block ?? 0;

    if (!active) return 'text-gray-400';

    // Check if the formatted block time is "Live" and return green
    const blockTimeText = formatBlockTime(node);
    if (blockTimeText === 'Live') return 'text-blue-400';

    // If node is on the latest block, apply time-based coloring
    if (blockNumber >= bestBlock) {
      const elapsedSeconds = getElapsedSeconds(node);

      // 4-tier color system for block timing
      if (elapsedSeconds <= 15) return 'text-white';
      if (elapsedSeconds <= 30) return 'text-yellow-400';
      if (elapsedSeconds <= 60) return 'text-orange-400';
      return 'text-red-400';
    }

    // If node is behind, show yellow
    return 'text-yellow-400';
  };

  const formatLatency = (node: Node) => {
    // Check direct properties first, then stats if it exists
    const active = node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false);
    const latency =
      node.stats?.latency ??
      (typeof node.latency === 'object' && node.latency && 'latency' in node.latency
        ? parseInt(node.latency.latency || '0')
        : node.latency
          ? parseInt(String(node.latency))
          : 0);

    if (!active) return 'offline';
    return `${latency} ms`;
  };

  const formatBlockTime = (node: Node) => {
    const nodeId = node.id;
    const baseTimeData = nodeBlockBaseTimes.get(nodeId);

    // Priority 1: Use stable base time tracking if available (most reliable)
    if (baseTimeData) {
      // Calculate real-time seconds elapsed since block was received
      const elapsedMs = currentTime - baseTimeData.baseTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // For VirBiCoin nodes, show "Live" if very recent (< 15 seconds)
      if (node.id.toString().includes('Gvbc') && elapsedSeconds < 16) {
        return 'Live';
      }

      // Format the real-time elapsed time with stability
      if (elapsedSeconds < 15) return 'Live';
      if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
      if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
      if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
      return `${Math.floor(elapsedSeconds / 86400)}d ago`;
    }

    // Priority 2: VirBiCoin special handling - always show "Live" if active
    if (node.id.toString().includes('Gvbc')) {
      const isActive = node.stats?.active ?? true;
      if (isActive) {
        return 'Live';
      }
    }

    // Priority 3: Server-provided lastBlockTime if available and reasonable
    const secondsAgo = typeof node.lastBlockTime === 'number' ? node.lastBlockTime : null;
    if (secondsAgo !== null && secondsAgo >= 0 && secondsAgo < 86400) {
      // Within 24 hours
      // For VirBiCoin nodes, show "Live" if very recent (< 15 seconds)
      if (node.id.toString().includes('Gvbc') && secondsAgo < 15) {
        return 'Live';
      }

      // Format the time difference
      if (secondsAgo < 15) return 'Live';
      if (secondsAgo < 60) return `${secondsAgo}s ago`;
      if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
      if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
      return `${Math.floor(secondsAgo / 86400)}d ago`;
    }

    // Priority 4: Fallback to timestamp-based calculation with validation
    const received =
      node.stats?.block?.received || node.stats?.block?.timestamp || node.blockTimestamp;

    if (!received || received < 1e6) {
      // For real nodes without timestamp, show "Live" instead of "-"
      if (
        node.id.toString().includes('Gvbc') ||
        (!node.id.toString().includes('historical') && !node.id.toString().includes('test'))
      ) {
        return 'Live';
      }
      return '-';
    }

    // Additional validation for VirBiCoin timestamps that may be corrupted
    if (node.id.toString().includes('Gvbc') && received < 1e10) {
      return 'Live';
    }

    // Use current real-time for calculation
    const now = currentTime;

    // Check if timestamp is in seconds (< 1e12) or milliseconds (>= 1e12)
    const receivedMs = received < 1e12 ? received * 1000 : received;
    const diff = Math.floor((now - receivedMs) / 1000); // Convert to seconds

    // Handle invalid timestamps (future or very old)
    if (diff < 0 || diff > 86400 * 365) {
      // More than 1 year
      return 'Live';
    }

    // For very recent blocks (< 15 seconds), show as "Live" for active nodes
    if (diff < 15 && node.stats?.active) {
      return 'Live';
    }

    // Standard time formatting for valid timestamps with real-time updates
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  const formatPropagation = (node: Node) => {
    const propagation = node.stats?.block?.propagation || node.propagation || 0;

    if (!propagation || propagation === 0) {
      // For real nodes without propagation data, show reasonable default
      if (
        node.id.toString().includes('Gvbc') ||
        (!node.id.toString().includes('historical') && !node.id.toString().includes('test'))
      ) {
        return '0ms';
      }
      return '-';
    }

    return `${propagation}ms`;
  };

  const formatAvgPropagation = (node: Node) => {
    const avgPropagation = node.stats?.propagationAvg || node.propagationAvg || 0;

    if (!avgPropagation || avgPropagation === 0) {
      // For real nodes without avg propagation data, show reasonable default
      if (
        node.id.toString().includes('Gvbc') ||
        (!node.id.toString().includes('historical') && !node.id.toString().includes('test'))
      ) {
        return '0ms';
      }
      return '-';
    }

    return `${avgPropagation}ms`;
  };

  // Get propagation color class (like GitHub original implementation)
  const getPropagationClass = (node: Node) => {
    const propagation = Number(node.stats?.block?.propagation || node.propagation || 0);

    // Check if node is active - consider node active if it has peers or propagation data
    const peers = node.stats?.peers ?? node.peers ?? 0;
    const isActive = node.stats?.active ?? (peers > 0 || node.id.toString().includes('Gvbc'));

    if (!isActive && propagation === 0) return 'propagation-inactive';

    if (propagation === 0) return 'propagation-zero'; // Green for 0ms (first to receive)
    if (propagation < 1000) return 'propagation-fast'; // Green for < 1s
    if (propagation < 3000) return 'propagation-medium'; // Yellow for < 3s
    if (propagation < 7000) return 'propagation-slow'; // Orange for < 7s
    return 'propagation-very-slow'; // Red for >= 7s
  };

  // Get average propagation color class
  const getAvgPropagationClass = (node: Node) => {
    const avgPropagation = Number(node.stats?.propagationAvg || node.propagationAvg || 0);

    // Check if node is active - consider node active if it has peers or propagation data
    const peers = node.stats?.peers ?? node.peers ?? 0;
    const isActive = node.stats?.active ?? (peers > 0 || node.id.toString().includes('Gvbc'));

    if (!isActive && avgPropagation === 0) return 'propagation-inactive';

    if (avgPropagation === 0) return 'propagation-zero'; // Green for 0ms
    if (avgPropagation < 1000) return 'propagation-fast'; // Green for < 1s
    if (avgPropagation < 3000) return 'propagation-medium'; // Yellow for < 3s
    if (avgPropagation < 7000) return 'propagation-slow'; // Orange for < 7s
    return 'propagation-very-slow'; // Red for >= 7s
  };

  const formatHash = (hash: string) => {
    if (!hash) return '';
    return hash.substring(0, 8) + '...';
  };

  const formatTotalDifficulty = (value: number | undefined): string => {
    if (!value || value === 0 || typeof value !== 'number' || isNaN(value)) return '-';

    const TH = 1e12;
    const GH = 1e9;
    const MH = 1e6;

    if (value >= TH) {
      const thValue = value / TH;
      // For very large values, use fewer decimal places
      if (thValue >= 100) {
        return `${thValue.toFixed(0)}T`;
      } else {
        return `${thValue.toFixed(1)}T`;
      }
    } else if (value >= GH) {
      const ghValue = value / GH;
      if (ghValue >= 100) {
        return `${ghValue.toFixed(0)}G`;
      } else {
        return `${ghValue.toFixed(1)}G`;
      }
    } else if (value >= MH) {
      const mhValue = value / MH;
      if (mhValue >= 100) {
        return `${mhValue.toFixed(0)}M`;
      } else {
        return `${mhValue.toFixed(1)}M`;
      }
    } else {
      return `${value.toFixed(0)}H`;
    }
  };

  const formatUptime = (uptime: any) => {
    if (typeof uptime === 'object' && uptime !== null) {
      // Handle object uptime like the server sends
      if (uptime.lastStatus !== undefined) {
        const status = uptime.lastStatus;
        if (typeof status === 'boolean') {
          return status ? '100.0%' : '0.0%';
        } else {
          const numStatus = Number(status);
          return isNaN(numStatus) ? '-' : `${numStatus.toFixed(1)}%`;
        }
      }
      if (uptime.up !== undefined && uptime.down !== undefined) {
        const total = uptime.up + uptime.down;
        const percentage = total > 0 ? (uptime.up / total) * 100 : 0;
        return `${percentage.toFixed(1)}%`;
      }
      return '-';
    }
    if (typeof uptime === 'number' && !isNaN(uptime)) {
      return `${uptime.toFixed(1)}%`;
    }
    return '-';
  };

  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6 text-white">
      <h2 className="mb-4 text-xl font-bold">Nodes</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e3a5f] text-gray-400">
              <th className="w-8 p-2 text-left">📌</th>
              <th className="w-36 p-2 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Node Name
                  {renderSortIndicator('name')}
                </button>
              </th>
              <th className="w-56 p-2 text-left">
                <button
                  onClick={() => handleSort('type')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Node Type
                  {renderSortIndicator('type')}
                </button>
              </th>
              <th className="w-20 p-2 text-left">
                <button
                  onClick={() => handleSort('latency')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Latency
                  {renderSortIndicator('latency')}
                </button>
              </th>
              <th className="w-16 p-2 text-left">
                <button
                  onClick={() => handleSort('mining')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Mining
                  {renderSortIndicator('mining')}
                </button>
              </th>
              <th className="w-16 p-2 text-left">
                <button
                  onClick={() => handleSort('peers')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Peers
                  {renderSortIndicator('peers')}
                </button>
              </th>
              <th className="w-20 p-2 text-left">
                <button
                  onClick={() => handleSort('pending')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Pending
                  {renderSortIndicator('pending')}
                </button>
              </th>
              <th className="w-20 p-2 text-left">
                <button
                  onClick={() => handleSort('block')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Last Block
                  {renderSortIndicator('block')}
                </button>
              </th>
              <th className="w-20 p-2 text-left">
                <button
                  onClick={() => handleSort('hash')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Block Hash
                  {renderSortIndicator('hash')}
                </button>
              </th>
              <th className="w-24 p-2 text-left">
                <button
                  onClick={() => handleSort('difficulty')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Total Difficulty
                  {renderSortIndicator('difficulty')}
                </button>
              </th>
              <th className="w-16 p-2 text-left">
                <button
                  onClick={() => handleSort('transactions')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Txs
                  {renderSortIndicator('transactions')}
                </button>
              </th>
              <th className="w-16 p-2 text-left">
                <button
                  onClick={() => handleSort('uncles')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Uncles
                  {renderSortIndicator('uncles')}
                </button>
              </th>
              <th className="w-24 p-2 text-left">
                <button
                  onClick={() => handleSort('blockTime')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Block Time
                  {renderSortIndicator('blockTime')}
                </button>
              </th>
              <th className="w-24 p-2 text-left">
                <button
                  onClick={() => handleSort('propagation')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Propagation
                  {renderSortIndicator('propagation')}
                </button>
              </th>
              <th className="w-24 p-2 text-left">
                <button
                  onClick={() => handleSort('avgPropagation')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Avg Propagation
                  {renderSortIndicator('avgPropagation')}
                </button>
              </th>
              <th className="w-16 p-2 text-left">
                <button
                  onClick={() => handleSort('uptime')}
                  className="flex cursor-pointer items-center transition-colors hover:text-blue-400"
                >
                  Uptime
                  {renderSortIndicator('uptime')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedNodes.length === 0 ? (
              <tr>
                <td colSpan={16} className="p-8 text-center text-gray-400">
                  No nodes connected
                </td>
              </tr>
            ) : (
              sortedNodes.map((node) => (
                <tr
                  key={node.id}
                  className={`border-b border-gray-800 hover:bg-[#0d1421]/50 ${getNodeClass(node)}`}
                >
                  <td className="p-2 text-center">
                    <button
                      onClick={() => togglePin(node.id)}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      {pinnedNodes.has(node.id) ? (
                        <span className="text-blue-400">📌</span>
                      ) : (
                        <span className="text-gray-600 hover:text-gray-400">⚪</span>
                      )}
                    </button>
                  </td>
                  <td className="p-2">
                    <div
                      className="cursor-pointer font-medium transition-colors hover:text-cyan-400"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredNode({ node, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {node.info?.name || node.name}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="text-xs text-blue-400">
                      {stableNodeTypes.get(node.id) || node.info?.node || node.type || '--'}
                    </div>
                  </td>
                  <td className={`p-2 ${getLatencyClass(node)}`}>{formatLatency(node)}</td>
                  <td className={`p-2 ${getMiningClass(node)}`}>
                    {(node.stats?.mining ?? node.mining) ? '⛏️' : '-'}
                  </td>
                  <td
                    className={`p-2 ${getPeerClass(
                      (() => {
                        const peers = node.stats?.peers ?? node.peers ?? 0;
                        return typeof peers === 'object' && peers !== null && 'value' in peers
                          ? ((peers as { value: number }).value ?? 0)
                          : typeof peers === 'number'
                            ? peers
                            : 0;
                      })(),
                      node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false)
                    )}`}
                  >
                    {(() => {
                      const peers = node.stats?.peers ?? node.peers ?? 0;
                      return typeof peers === 'object' && peers !== null && 'value' in peers
                        ? ((peers as { value: number }).value ?? 0)
                        : typeof peers === 'number'
                          ? peers
                          : 0;
                    })()}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const pending = node.stats?.pending ?? node.pending ?? 0;

                      // Handle object with value property
                      if (typeof pending === 'object' && pending !== null && 'value' in pending) {
                        return (pending as { value: number }).value ?? 0;
                      }

                      // Handle direct number
                      if (typeof pending === 'number') {
                        return pending;
                      }

                      // Handle string that might be a number
                      if (typeof pending === 'string') {
                        const num = parseInt(pending, 10);
                        return isNaN(num) ? 0 : num;
                      }

                      // For any other object type, try to convert to string first, then number
                      if (typeof pending === 'object' && pending !== null) {
                        const str = String(pending);
                        const num = parseInt(str, 10);
                        return isNaN(num) ? 0 : num;
                      }

                      // Default fallback
                      return 0;
                    })()}
                  </td>
                  <td className={`p-2 ${getBlockClass(node, bestBlock)}`}>
                    #
                    {(() => {
                      const blockNumber = node.stats?.block?.number ?? node.block ?? 0;
                      return typeof blockNumber === 'object' &&
                        blockNumber !== null &&
                        'value' in blockNumber
                        ? ((blockNumber as { value: number }).value ?? 0)
                        : typeof blockNumber === 'number'
                          ? blockNumber
                          : 0;
                    })()}
                  </td>
                  <td className={`p-2 ${getBlockHashClass(node, bestBlock)} font-mono text-xs`}>
                    {formatHash(node.stats?.block?.hash ?? node.blockHash ?? '')}
                  </td>
                  <td className="p-2 text-xs">
                    {(() => {
                      const difficulty =
                        node.stats?.block?.totalDifficulty ?? node.totalDifficulty ?? 0;
                      return formatTotalDifficulty(difficulty);
                    })()}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const transactions =
                        node.stats?.block?.transactions ?? node.transactions ?? 0;
                      if (Array.isArray(transactions)) return transactions.length;
                      return typeof transactions === 'object' &&
                        transactions !== null &&
                        'value' in transactions
                        ? ((transactions as { value: number }).value ?? 0)
                        : typeof transactions === 'number'
                          ? transactions
                          : 0;
                    })()}
                  </td>
                  <td className="p-2">
                    {(() => {
                      const uncles = node.stats?.block?.uncles ?? node.uncles ?? 0;
                      if (Array.isArray(uncles)) return uncles.length;
                      return typeof uncles === 'object' && uncles !== null && 'value' in uncles
                        ? ((uncles as { value: number }).value ?? 0)
                        : typeof uncles === 'number'
                          ? uncles
                          : 0;
                    })()}
                  </td>
                  <td className={`p-2 text-xs ${getLastBlockTimeClass(node, bestBlock)}`}>
                    {formatBlockTime(node)}
                  </td>
                  <td className={`p-2 ${getPropagationClass(node)}`}>{formatPropagation(node)}</td>
                  <td className={`p-2 ${getAvgPropagationClass(node)}`}>
                    {formatAvgPropagation(node)}
                  </td>
                  <td
                    className={`p-2 ${getUptimeClass(
                      (() => {
                        const uptimeValue = node.stats?.uptime ?? node.uptime;
                        if (typeof uptimeValue === 'object' && uptimeValue !== null) {
                          if (uptimeValue.lastStatus !== undefined) {
                            return uptimeValue.lastStatus;
                          }
                          if (uptimeValue.up !== undefined && uptimeValue.down !== undefined) {
                            const total = uptimeValue.up + uptimeValue.down;
                            return total > 0 ? (uptimeValue.up / total) * 100 : 0;
                          }
                          return 100;
                        }
                        return typeof uptimeValue === 'number' ? uptimeValue : 0;
                      })(),
                      node.stats?.active ?? (node.peers !== undefined ? node.peers >= 0 : false)
                    )}`}
                  >
                    {formatUptime(node.stats?.uptime ?? node.uptime ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fixed position tooltip for node hover */}
      {hoveredNode && (
        <div
          className="pointer-events-none fixed z-[99999] max-w-[320px] min-w-[220px] rounded-lg border border-gray-600 bg-gray-900 p-3 shadow-2xl"
          style={{
            left: hoveredNode.x,
            top: hoveredNode.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="mb-2 text-sm font-bold text-amber-400">
            {hoveredNode.node.info?.name || hoveredNode.node.name}
          </div>
          <div className="space-y-1 text-xs text-gray-300">
            {hoveredNode.node.geo?.city && hoveredNode.node.geo?.country && (
              <div>
                📍 {hoveredNode.node.geo.city}, {hoveredNode.node.geo.country}
              </div>
            )}
            {!hoveredNode.node.geo?.city && hoveredNode.node.geo?.country && (
              <div>📍 {hoveredNode.node.geo.country}</div>
            )}
            {hoveredNode.node.info?.node && <div>🖥️ {hoveredNode.node.info.node}</div>}
            {(hoveredNode.node.stats?.block?.number || hoveredNode.node.block) && (
              <div>
                📦 Block #
                {(
                  hoveredNode.node.stats?.block?.number || hoveredNode.node.block
                )?.toLocaleString()}
              </div>
            )}
            <div>🔗 {hoveredNode.node.stats?.peers ?? hoveredNode.node.peers ?? 0} peers</div>
            <div>⏱️ {formatLatency(hoveredNode.node)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Nodes;
