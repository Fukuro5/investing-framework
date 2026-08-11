import { BASE_CURRENCY } from "@/lib/dashboard/consts";
import type { PositionView } from "@/lib/dashboard/types";

// Only positions already in USD are summed/allocated for now — mixing
// currencies into one total without FX conversion (Phase 3) would silently
// misrepresent the portfolio, so a non-USD position's allocation is left
// null rather than guessed.
export const withAllocationPercent = (positions: PositionView[]): PositionView[] => {
  const totalMarketValue = positions
    .filter((position) => position.currency === BASE_CURRENCY && position.marketValue !== null)
    .reduce((sum, position) => sum + (position.marketValue ?? 0), 0);

  return positions.map((position) => {
    const { marketValue, currency } = position;

    if (currency !== BASE_CURRENCY || marketValue === null || totalMarketValue <= 0) {
      return { ...position, allocationPercent: null };
    }

    return { ...position, allocationPercent: (marketValue / totalMarketValue) * 100 };
  });
};
