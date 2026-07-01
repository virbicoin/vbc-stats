import React, { useEffect, useState } from 'react';
import { FaHourglassHalf } from 'react-icons/fa';

// VirBiCoin block reward schedule (go-virbicoin consensus/ethash/consensus.go)
// Reward starts at 8 VBC and decreases by 1 VBC every 2,100,000 blocks,
// starting at block 4,200,000, down to a minimum of 1 VBC at block 16,800,000.
const FIRST_REDUCTION_BLOCK = 4_200_000;
const REDUCTION_INTERVAL = 2_100_000;
const INITIAL_REWARD = 8;
const MINIMUM_REWARD = 1;
const DEFAULT_BLOCK_TIME = 12; // seconds (network target)

// Fork names for each reward reduction block (params/config.go)
const FORK_NAMES: Record<number, string> = {
  4_200_000: 'Quiche',
  6_300_000: 'Miche',
  8_400_000: 'Rusk',
  10_500_000: 'Celestia',
  12_600_000: 'Mafuyu',
  14_700_000: 'Kipfel',
  16_800_000: 'Lumina',
};

const getRewardAtBlock = (block: number): number => {
  if (block < FIRST_REDUCTION_BLOCK) return INITIAL_REWARD;
  const reductions = Math.floor((block - FIRST_REDUCTION_BLOCK) / REDUCTION_INTERVAL) + 1;
  return Math.max(MINIMUM_REWARD, INITIAL_REWARD - reductions);
};

// Next block at which the reward decreases, or null once the minimum is reached
const getNextReductionBlock = (block: number): number | null => {
  if (getRewardAtBlock(block) <= MINIMUM_REWARD) return null;
  if (block < FIRST_REDUCTION_BLOCK) return FIRST_REDUCTION_BLOCK;
  const k = Math.floor((block - FIRST_REDUCTION_BLOCK) / REDUCTION_INTERVAL) + 1;
  return FIRST_REDUCTION_BLOCK + k * REDUCTION_INTERVAL;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

interface TimerUnitsProps {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

function TimerUnits({ days, hours, minutes, seconds }: TimerUnitsProps): React.ReactNode {
  const units = [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hrs' },
    { value: minutes, label: 'Min' },
    { value: seconds, label: 'Sec' },
  ];
  return (
    <div className="flex items-center gap-3">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex min-w-[64px] flex-col items-center rounded-lg border border-[#1e3a5f]/50 bg-[#0a1018] px-3 py-2"
        >
          <span className="text-2xl font-bold text-white tabular-nums">{unit.value}</span>
          <span className="text-xs tracking-wide text-gray-400 uppercase">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}

interface CountdownTimerProps {
  blocksRemaining: number;
  blockTime: number;
}

// Mounted with key={bestBlock} so the countdown re-anchors to the wall clock
// each time a new block arrives (state initializers run once per mount).
function CountdownTimer({ blocksRemaining, blockTime }: CountdownTimerProps): React.ReactNode {
  const [targetTime] = useState<number>(() => Date.now() + blocksRemaining * blockTime * 1000);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingSec = Math.max(0, Math.floor((targetTime - now) / 1000));
  const estimatedDate = new Date(targetTime).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col items-center gap-2 lg:items-end">
      <TimerUnits
        days={pad2(Math.floor(remainingSec / 86400))}
        hours={pad2(Math.floor((remainingSec % 86400) / 3600))}
        minutes={pad2(Math.floor((remainingSec % 3600) / 60))}
        seconds={pad2(remainingSec % 60)}
      />
      <div className="text-xs text-gray-500">Est. {estimatedDate}</div>
    </div>
  );
}

interface HalvingCountdownProps {
  bestBlock: number | null;
  avgBlockTime: number | null;
}

export default function HalvingCountdown({
  bestBlock,
  avgBlockTime,
}: HalvingCountdownProps): React.ReactNode {
  const hasBlock = bestBlock !== null && typeof bestBlock === 'number' && bestBlock > 0;
  const currentReward = hasBlock ? getRewardAtBlock(bestBlock) : null;
  const nextBlock = hasBlock ? getNextReductionBlock(bestBlock) : null;
  const atMinimum = hasBlock && nextBlock === null;
  const blockTime =
    typeof avgBlockTime === 'number' && !isNaN(avgBlockTime) && avgBlockTime > 0
      ? avgBlockTime
      : DEFAULT_BLOCK_TIME;

  const blocksRemaining = hasBlock && nextBlock !== null ? nextBlock - bestBlock : null;
  const eraStart =
    nextBlock !== null
      ? nextBlock === FIRST_REDUCTION_BLOCK
        ? 0
        : nextBlock - REDUCTION_INTERVAL
      : null;
  const progress =
    hasBlock && nextBlock !== null && eraStart !== null
      ? Math.min(100, Math.max(0, ((bestBlock - eraStart) / (nextBlock - eraStart)) * 100))
      : null;
  const forkName = nextBlock !== null ? FORK_NAMES[nextBlock] : undefined;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#1e3a5f]/50 bg-gradient-to-br from-[#0d1421] to-[#0a1018] p-6 transition-all duration-300 ease-out hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Title and reward transition */}
        <div className="flex items-center gap-4">
          <FaHourglassHalf className="text-3xl text-teal-400" />
          <div>
            <div className="text-sm tracking-wide text-gray-400 uppercase">Halving Countdown</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
              {currentReward !== null ? (
                atMinimum ? (
                  <span>{currentReward} VBC</span>
                ) : (
                  <>
                    <span>{currentReward} VBC</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-teal-400">{currentReward - 1} VBC</span>
                  </>
                )
              ) : (
                <span>--</span>
              )}
            </div>
            {forkName && nextBlock !== null && (
              <div className="mt-1 text-xs text-gray-500">
                Next reduction: {forkName} fork at block {nextBlock.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Countdown timer */}
        {atMinimum ? (
          <div className="text-lg font-semibold text-gray-400">
            Final reward era — no further reductions
          </div>
        ) : blocksRemaining !== null && hasBlock ? (
          <CountdownTimer key={bestBlock} blocksRemaining={blocksRemaining} blockTime={blockTime} />
        ) : (
          <TimerUnits days="--" hours="--" minutes="--" seconds="--" />
        )}
      </div>

      {/* Progress bar */}
      {!atMinimum && (
        <div className="mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1e3a5f]/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-1000"
              style={{ width: `${progress !== null ? progress.toFixed(2) : 0}%` }}
            />
          </div>
          <div className="mt-2 flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {hasBlock && nextBlock !== null
                ? `Block ${bestBlock.toLocaleString()} / ${nextBlock.toLocaleString()}`
                : '--'}
              {progress !== null && ` (${progress.toFixed(1)}%)`}
            </span>
            <span>
              {blocksRemaining !== null && `${blocksRemaining.toLocaleString()} blocks remaining`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
