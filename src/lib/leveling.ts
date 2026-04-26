import type { Achievement } from '../types';

// XP required to reach level n (0-indexed internally, display as n+1)
// threshold(n) = 300 * n * (n + 1) / 2  →  0, 300, 900, 1800, 3000, 4500 …
function thresholdForLevel(level: number): number {
  return 150 * level * (level + 1);
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number; // 0–1
  isMaxLevel: boolean;
}

const MAX_LEVEL = 20;

export function calculateLevel(achievements: Achievement[]): LevelInfo {
  const totalXp = achievements.filter((a) => a.earned).reduce((sum, a) => sum + a.xp, 0);

  let level = 1;
  while (level < MAX_LEVEL && totalXp >= thresholdForLevel(level)) {
    level++;
  }

  const isMaxLevel = level >= MAX_LEVEL;
  const floorXp = thresholdForLevel(level - 1);
  const ceilXp = isMaxLevel ? thresholdForLevel(level - 1) + 1 : thresholdForLevel(level);

  return {
    level,
    totalXp,
    currentLevelXp: totalXp - floorXp,
    nextLevelXp: isMaxLevel ? 0 : ceilXp - floorXp,
    progress: isMaxLevel ? 1 : (totalXp - floorXp) / (ceilXp - floorXp),
    isMaxLevel,
  };
}

export function levelTitle(level: number): string {
  if (level >= 20) return 'Sushi Legend';
  if (level >= 16) return 'Omakase Master';
  if (level >= 12) return 'Head Itamae';
  if (level >= 9)  return 'Sous Chef';
  if (level >= 6)  return 'Line Cook';
  if (level >= 4)  return 'Apprentice';
  if (level >= 2)  return 'Regular';
  return 'Newcomer';
}
