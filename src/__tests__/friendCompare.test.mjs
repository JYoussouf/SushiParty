import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors src/lib/friendCompare.ts (head-to-head, stats-only friend comparison).
// No messaging or social actions — the feature only compares numeric pace.

function leaderOf(you, friend) {
  if (you > friend) return 'you';
  if (friend > you) return 'friend';
  return 'tie';
}

function buildFriendComparison(you, friend, friendName) {
  const rows = [
    { label: 'Parties', youValue: you.totalSessions, friendValue: friend.totalSessions, leader: leaderOf(you.totalSessions, friend.totalSessions) },
    { label: 'Total pieces', youValue: you.totalPieces, friendValue: friend.totalPieces, leader: leaderOf(you.totalPieces, friend.totalPieces) },
    { label: 'Avg / party', youValue: you.averagePiecesPerSession, friendValue: friend.averagePiecesPerSession, leader: leaderOf(you.averagePiecesPerSession, friend.averagePiecesPerSession) },
  ];
  const youWins = rows.filter((r) => r.leader === 'you').length;
  const friendWins = rows.filter((r) => r.leader === 'friend').length;
  let headline;
  if (youWins > friendWins) headline = `You're out-eating ${friendName}`;
  else if (friendWins > youWins) headline = `${friendName} is ahead of you`;
  else headline = `You and ${friendName} are neck and neck`;
  return { rows, youWins, friendWins, headline };
}

const stats = (totalSessions, totalPieces, averagePiecesPerSession) => ({
  totalSessions,
  totalPieces,
  averagePiecesPerSession,
});

describe('buildFriendComparison', () => {
  it('marks the higher value as the row leader', () => {
    const c = buildFriendComparison(stats(5, 100, 20), stats(3, 60, 20), 'Maya');
    assert.equal(c.rows[0].leader, 'you'); // 5 > 3 parties
    assert.equal(c.rows[1].leader, 'you'); // 100 > 60 pieces
    assert.equal(c.rows[2].leader, 'tie'); // 20 == 20 avg
  });

  it('headline reflects who wins the most rows', () => {
    assert.equal(buildFriendComparison(stats(5, 100, 20), stats(3, 60, 15), 'Maya').headline, "You're out-eating Maya");
    assert.equal(buildFriendComparison(stats(1, 10, 10), stats(9, 200, 40), 'Noah').headline, 'Noah is ahead of you');
  });

  it('ties on every row read as neck and neck', () => {
    const c = buildFriendComparison(stats(4, 80, 20), stats(4, 80, 20), 'Sam');
    assert.equal(c.youWins, 0);
    assert.equal(c.friendWins, 0);
    assert.equal(c.headline, 'You and Sam are neck and neck');
  });

  it('split rows (1-1 with a tie) read as neck and neck', () => {
    // You win parties, friend wins pieces, avg ties -> 1 vs 1.
    const c = buildFriendComparison(stats(5, 50, 10), stats(3, 90, 10), 'Zoe');
    assert.equal(c.youWins, 1);
    assert.equal(c.friendWins, 1);
    assert.equal(c.headline, 'You and Zoe are neck and neck');
  });
});
