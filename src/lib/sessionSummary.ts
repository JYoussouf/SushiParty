import type { SessionParticipant, SushiItem, SushiSession } from '../types';

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

const CATEGORY_LABELS: Record<SushiItem['category'], string> = {
  nigiri: 'Nigiri',
  sashimi: 'Sashimi',
  roll: 'Rolls',
  special: 'Specials',
  other: 'Other',
};

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
