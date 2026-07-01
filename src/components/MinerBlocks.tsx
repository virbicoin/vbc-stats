import { MinerData } from '@/types/stats';

interface MinerBlocksProps {
  miners: MinerData[];
}

export default function MinerBlocks({ miners }: MinerBlocksProps) {
  if (!miners || miners.length === 0) {
    return <div className="py-4 text-center text-gray-400">No miner data available</div>;
  }

  return (
    <div className="space-y-2">
      {miners.slice(0, 5).map((miner) => (
        <div
          key={miner.miner || miner.name}
          className="hover:bg-gray-750 flex items-center justify-between rounded border border-[#1e3a5f] bg-[#0d1421] p-2 transition-colors duration-200"
        >
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${getMinerColor(miner.blocks)} shadow-sm`}></div>
            <span className="max-w-20 truncate text-xs font-medium text-gray-300">
              {miner.name || miner.miner}
            </span>
          </div>
          <span className={`text-xs font-semibold ${getMinerTextColor(miner.blocks)}`}>
            {miner.blocks}
          </span>
        </div>
      ))}
      {miners.length > 5 && (
        <div className="py-1 text-center text-xs text-gray-500">
          +{miners.length - 5} more miners
        </div>
      )}
    </div>
  );
}

function getMinerColor(blocks: number): string {
  if (blocks >= 10) return 'bg-green-400';
  if (blocks >= 5) return 'bg-yellow-400';
  if (blocks >= 1) return 'bg-emerald-400';
  return 'bg-gray-400';
}

function getMinerTextColor(blocks: number): string {
  if (blocks >= 10) return 'text-blue-400';
  if (blocks >= 5) return 'text-yellow-400';
  if (blocks >= 1) return 'text-blue-400';
  return 'text-gray-400';
}
