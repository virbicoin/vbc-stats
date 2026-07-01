import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts';
const Map = lazy(() => import('./Map'));

const MapLoading = (
  <div className="flex h-full w-full items-center justify-center border border-[#1e3a5f] bg-[#0d1421]">
    <p className="text-gray-400">Loading Map...</p>
  </div>
);

interface Node {
  id: string | number;
  name: string;
  type?: string;
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

interface ChartData {
  time: string;
  index: number;
  blockTime: number;
  difficulty: number;
  uncles: number;
  transactions: number;
  gasSpending: number;
  propagation: number;
}

interface ChartsProps {
  currentStats: {
    avgBlockTime?: { value: number };
    difficulty?: { value: number };
    uncles?: { value: number };
  };
  nodes?: Node[];
}

const Charts: React.FC<ChartsProps> = ({ nodes = [] }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [staticTimeLabels, setStaticTimeLabels] = useState<string[]>([]);

  // Initialize chart data only once using lazy initializer pattern
  useEffect(() => {
    if (!isInitialized) {
      const generateData = () => {
        const data: ChartData[] = [];
        const timeLabels: string[] = [];
        const now = new Date();

        // Start from current minute rounded down
        const currentMinute = new Date(now);
        currentMinute.setSeconds(0, 0);

        for (let i = 19; i >= 0; i--) {
          const time = new Date(currentMinute.getTime() - i * 300000); // 5 minute intervals
          const timeString = time.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          timeLabels.push(timeString);

          data.push({
            time: timeString,
            index: 19 - i,
            blockTime: 12 + (Math.random() - 0.5) * 0.6,
            difficulty: 94 + (Math.random() - 0.5) * 1.2,
            uncles: Math.floor(Math.random() * 3),
            transactions: Math.floor(Math.random() * 50) + 15,
            gasSpending: Math.random() * 70 + 25,
            propagation: Math.random() * 40 + 85,
          });
        }

        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setStaticTimeLabels(timeLabels);
        return data;
      };

      // eslint-disable-next-line @eslint-react/set-state-in-effect, react-hooks/set-state-in-effect
      setChartData(generateData());
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Completely static X-axis configuration without any dynamic elements
  const xAxisConfig = {
    dataKey: 'index',
    hide: true, // Hide X-axis completely to prevent any flickering
    type: 'number' as const,
    domain: [0, 19],
  };

  // Static time labels component
  const TimeLabels = React.memo(() => (
    <div className="mt-2 flex justify-between px-2 text-xs text-gray-400">
      {staticTimeLabels
        .filter((_, index) => [0, 4, 8, 12, 16, 19].includes(index))
        .map((label) => (
          <span key={`time-label-${label}`}>{label}</span>
        ))}
    </div>
  ));
  TimeLabels.displayName = 'TimeLabels';

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Block Time Chart - top left */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Block Time</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[12.4, 13.6]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="blockTime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                animationDuration={0}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Difficulty Chart - top center left */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Difficulty</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[93, 95]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="difficulty"
                stroke="#ec4899"
                fill="#ec4899"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                animationDuration={0}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Transactions Chart - top center right */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Transactions</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[10, 70]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="transactions"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                animationDuration={0}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Block Propagation Chart - top right */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Block Propagation</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[80, 130]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="propagation"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={false}
                animationDuration={0}
                isAnimationActive={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Uncle Count Chart - bottom left */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Uncle Count</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 3]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Bar
                dataKey="uncles"
                fill="#8b5cf6"
                radius={[2, 2, 0, 0]}
                animationDuration={0}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Gas Spending Chart - bottom center left */}
      <div className="h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Gas Spending</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis {...xAxisConfig} />
              <YAxis
                stroke="#9ca3af"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[20, 100]}
                allowDataOverflow={false}
                tick={{ fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="gasSpending"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                animationDuration={0}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <TimeLabels />
      </div>

      {/* Network Map - bottom right, spans 2 columns */}
      <div className="relative col-span-2 h-64 rounded-lg border border-[#1e3a5f] bg-[#0d1421] p-6">
        <h3 className="relative z-10 mb-4 text-lg font-semibold text-white">Network Map</h3>
        <div className="absolute inset-6 overflow-hidden rounded bg-[#0d1421]">
          <Suspense fallback={MapLoading}>
            <Map nodes={nodes} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Charts;
