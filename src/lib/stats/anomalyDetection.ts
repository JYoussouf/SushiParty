import type { RestaurantStats } from '../../types';

const ANOMALY_THRESHOLD_STD_DEVS = 3.5;

/**
 * Returns true if totalPieces is statistically unusual for this restaurant.
 * Requires at least 10 sessions of baseline data before flagging.
 */
export function isAnomaly(totalPieces: number, stats: RestaurantStats): boolean {
  if (stats.totalSessions < 10) return false;
  if (stats.stdDevPiecesPerSession === 0) return false;
  const zScore = (totalPieces - stats.meanPiecesPerSession) / stats.stdDevPiecesPerSession;
  return zScore > ANOMALY_THRESHOLD_STD_DEVS;
}

/**
 * Incrementally updates Welford online mean/variance for a restaurant.
 * Call this when a new session is submitted without anomaly dismissal.
 */
export function updateRestaurantStats(
  current: RestaurantStats,
  newPieceCount: number,
): Pick<RestaurantStats, 'totalSessions' | 'meanPiecesPerSession' | 'stdDevPiecesPerSession'> {
  const n = current.totalSessions + 1;
  const delta = newPieceCount - current.meanPiecesPerSession;
  const newMean = current.meanPiecesPerSession + delta / n;
  // Running sum of squared deviations (Welford's algorithm)
  const prevM2 = current.stdDevPiecesPerSession ** 2 * Math.max(current.totalSessions - 1, 0);
  const delta2 = newPieceCount - newMean;
  const newM2 = prevM2 + delta * delta2;
  const newStdDev = n > 1 ? Math.sqrt(newM2 / (n - 1)) : 0;
  return { totalSessions: n, meanPiecesPerSession: newMean, stdDevPiecesPerSession: newStdDev };
}
