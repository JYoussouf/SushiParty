import type { SessionParticipant, SushiItem, SushiSession } from '../types';
import { CATEGORY_LABELS } from './categoryLabels';

export interface Superlative {
  label: string;
  emoji: string;
  winners: string[];
}

export interface ParticipantSummary {
  userId: string;
  displayName: string;
  totalPieces: number;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  count: number;
}

export interface CategoryBreakdown {
  category: SushiItem['category'];
  label: string;
  totalPieces: number;
  items: CategoryBreakdownItem[];
}

export function getParticipantTotalPieces(participant: SessionParticipant): number {
  return Object.values(participant.counts).reduce((sum, count) => sum + count, 0);
}

export function getSessionTotalPieces(session: SushiSession): number {
  return session.participants.reduce((sum, participant) => sum + getParticipantTotalPieces(participant), 0);
}

export function getParticipantSummaries(session: SushiSession): ParticipantSummary[] {
  return session.participants.map((participant) => ({
    userId: participant.userId,
    displayName: participant.displayName,
    totalPieces: getParticipantTotalPieces(participant),
  }));
}

export function getAttendeeNames(session: SushiSession): string[] {
  return session.participants
    .map((participant) => participant.displayName.trim())
    .filter(Boolean);
}

export function getSessionSuperlatives(
  session: SushiSession,
  menuItems: SushiItem[],
): Superlative[] {
  const ps = session.participants;
  if (ps.length < 2) return [];

  const menuById = new Map(menuItems.map((item) => [item.id, item]));

  const score = (fn: (p: SessionParticipant) => number): Superlative['winners'] => {
    const scores = ps.map((p) => ({ name: p.displayName, val: fn(p) }));
    const max = Math.max(...scores.map((s) => s.val));
    if (max === 0) return [];
    const winners = scores.filter((s) => s.val === max).map((s) => s.name);
    // Skip if all tied
    if (winners.length === ps.length) return [];
    return winners;
  };

  const candidates: Array<{ label: string; emoji: string; fn: (p: SessionParticipant) => number }> = [
    {
      label: 'Most Eaten',
      emoji: '🏆',
      fn: (p) => getParticipantTotalPieces(p),
    },
    {
      label: 'Lightest Eater',
      emoji: '🌸',
      fn: (p) => {
        const total = getParticipantTotalPieces(p);
        return total === 0 ? 0 : -total;
      },
    },
    {
      label: 'Most Variety',
      emoji: '🎲',
      fn: (p) => Object.values(p.counts).filter((c) => c > 0).length,
    },
    {
      label: 'Roll Lover',
      emoji: '🌀',
      fn: (p) =>
        Object.entries(p.counts).reduce((sum, [id, count]) => {
          const cat = menuById.get(id)?.category;
          return cat === 'roll' || cat === 'handroll' || cat === 'special_roll' ? sum + count : sum;
        }, 0),
    },
    {
      label: 'Sushi Purist',
      emoji: '🎋',
      fn: (p) =>
        Object.entries(p.counts).reduce((sum, [id, count]) => {
          const cat = menuById.get(id)?.category;
          return cat === 'nigiri' || cat === 'sashimi' ? sum + count : sum;
        }, 0),
    },
    {
      label: 'Most Adventurous',
      emoji: '🗺️',
      fn: (p) =>
        new Set(
          Object.entries(p.counts)
            .filter(([, c]) => c > 0)
            .map(([id]) => menuById.get(id)?.category)
            .filter(Boolean),
        ).size,
    },
    {
      label: 'Sweet Tooth',
      emoji: '🍡',
      fn: (p) =>
        Object.entries(p.counts).reduce((sum, [id, count]) => {
          return menuById.get(id)?.category === 'dessert' ? sum + count : sum;
        }, 0),
    },
  ];

  return candidates
    .map(({ label, emoji, fn }) => ({ label, emoji, winners: score(fn) }))
    .filter((s) => s.winners.length > 0);
}

export function getSessionCategoryBreakdown(
  session: SushiSession,
  menuItems: SushiItem[],
): CategoryBreakdown[] {
  const counts = new Map<string, number>();

  for (const participant of session.participants) {
    for (const [itemId, count] of Object.entries(participant.counts)) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + count);
    }
  }

  const uncategorized = new Map<string, number>(counts);
  const sections: CategoryBreakdown[] = [];

  for (const category of Object.keys(CATEGORY_LABELS) as SushiItem['category'][]) {
    const items = menuItems
      .map((item) => ({ item, count: counts.get(item.id) ?? 0 }))
      .filter(({ item, count }) => item.category === category && count > 0)
      .map(({ item, count }) => {
        uncategorized.delete(item.id);
        return { id: item.id, name: item.name, count };
      });

    if (items.length > 0) {
      sections.push({
        category,
        label: CATEGORY_LABELS[category],
        totalPieces: items.reduce((sum, item) => sum + item.count, 0),
        items,
      });
    }
  }

  if (uncategorized.size > 0) {
    const items = Array.from(uncategorized.entries()).map(([id, count]) => ({
      id,
      name: id,
      count,
    }));
    sections.push({
      category: 'other',
      label: CATEGORY_LABELS.other,
      totalPieces: items.reduce((sum, item) => sum + item.count, 0),
      items,
    });
  }

  return sections;
}
