import type { PositionView } from "@/lib/dashboard/types";

// marketValueUsd is already converted (or already USD) via getPositions —
// a null here means no cached FX rate exists yet for that currency, so its
// allocation stays null rather than being guessed or mixed in unconverted.
export const withAllocationPercent = (positions: PositionView[]): PositionView[] => {
  const totalMarketValueUsd = positions
    .filter((position) => position.marketValueUsd !== null)
    .reduce((sum, position) => sum + (position.marketValueUsd ?? 0), 0);

  return positions.map((position) => {
    const { marketValueUsd } = position;

    if (marketValueUsd === null || totalMarketValueUsd <= 0) {
      return { ...position, allocationPercent: null };
    }

    return { ...position, allocationPercent: (marketValueUsd / totalMarketValueUsd) * 100 };
  });
};
