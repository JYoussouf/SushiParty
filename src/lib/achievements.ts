import type { Achievement, SushiSession } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sd(s: SushiSession): string | undefined {
  return s.submittedAt ?? s.startedAt;
}

function latestDate(sessions: SushiSession[]): string | undefined {
  return sd(sessions[sessions.length - 1]!);
}

function restaurantName(session: SushiSession | undefined): string | undefined {
  if (!session) return undefined;
  const name = session.restaurantName?.trim();
  return name && name.toLowerCase() !== 'unknown restaurant' ? name : undefined;
}

function make(
  id: string,
  emoji: string,
  title: string,
  description: string,
  xp: number,
  earned: boolean,
  earnedAt?: string,
  hidden?: boolean,
  earnedAtRestaurant?: string,
): Achievement {
  return {
    id, emoji, title, description, xp, earned,
    ...(hidden ? { hidden: true } : {}),
    ...(earnedAt ? { earnedAt } : {}),
    ...(earnedAtRestaurant ? { earnedAtRestaurant } : {}),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function getAchievements(sessions: SushiSession[], userId: string): Achievement[] {
  const us = sessions.filter((s) => s.participants.some((p) => p.userId === userId));
  if (us.length === 0) {
    // Return all unearned so the locked list renders without crashing
    return buildAll(us, userId);
  }
  return buildAll(us, userId);
}

function buildAll(us: SushiSession[], userId: string): Achievement[] {
  // ── Piece counts ────────────────────────────────────────────────────────
  const piecesPerSession = us.map((s) => {
    const p = s.participants.find((pp) => pp.userId === userId);
    return p ? Object.values(p.counts).reduce((a, c) => a + c, 0) : 0;
  });
  const totalPieces = piecesPerSession.reduce((a, c) => a + c, 0);
  const maxSingle = piecesPerSession.length > 0 ? Math.max(...piecesPerSession) : 0;
  const maxIdx = piecesPerSession.indexOf(maxSingle);

  // ── Category totals & unique items ──────────────────────────────────────
  const cat: Record<string, number> = {};
  const uniqueItems = new Set<string>();
  us.forEach((s) => {
    const p = s.participants.find((pp) => pp.userId === userId);
    if (!p) return;
    Object.entries(p.counts).forEach(([id, n]) => {
      if (n <= 0) return;
      uniqueItems.add(id);
      const c = id.split('-')[0] ?? 'other';
      cat[c] = (cat[c] ?? 0) + n;
    });
  });

  // ── Per-session category sets (for combo achievements) ──────────────────
  const sessionCats = us.map((s) => {
    const p = s.participants.find((pp) => pp.userId === userId);
    if (!p) return new Set<string>();
    return new Set(
      Object.entries(p.counts)
        .filter(([, n]) => n > 0)
        .map(([id]) => id.split('-')[0] ?? 'other'),
    );
  });
  const maxCatsInSession = Math.max(0, ...sessionCats.map((s) => s.size));

  // ── Restaurants ─────────────────────────────────────────────────────────
  const restVisits = new Map<string, number>();
  us.forEach((s) => {
    const key = s.restaurantId !== 'unknown'
      ? s.restaurantId
      : s.restaurantName.trim().toLowerCase();
    if (key && key !== 'unknown restaurant') restVisits.set(key, (restVisits.get(key) ?? 0) + 1);
  });
  const uniqueRests = restVisits.size;
  const maxRestVisits = restVisits.size > 0 ? Math.max(...restVisits.values()) : 0;

  // ── Group / solo ─────────────────────────────────────────────────────────
  const groupSessions = us.filter((s) => s.mode === 'group');
  const soloSessions = us.filter((s) => s.mode !== 'group');
  const ownedGroup = groupSessions.filter((s) => s.participants[0]?.userId === userId);
  const hasBigParty = groupSessions.some((s) => s.participants.length >= 4);
  const hasHugeParty = groupSessions.some((s) => s.participants.length >= 6);
  const sessionsWithNotes = us.filter((s) => s.note?.trim()).length;

  // ── Time / date ──────────────────────────────────────────────────────────
  function safeDate(s: SushiSession): Date | null {
    const ts = s.startedAt ?? s.submittedAt;
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  const dates = us.map(safeDate).filter((d): d is Date => d !== null);
  const calDays = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  const calMonths = new Set(dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`));
  const calWeeks = new Set(dates.map((d) => {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${wk}`;
  }));
  const dowSeen = new Set(dates.map((d) => d.getDay()));
  const weekendCount = dates.filter((d) => d.getDay() === 0 || d.getDay() === 6).length;

  const hasLateNight = dates.some((d) => d.getHours() >= 21);
  const hasEarlyBird = dates.some((d) => d.getHours() < 12);
  const hasFriday = dates.some((d) => d.getDay() === 5);
  const hasMonday = dates.some((d) => d.getDay() === 1);
  const hasLunch = dates.some((d) => d.getHours() >= 12 && d.getHours() < 14);

  const sortedDays = Array.from(calDays).sort();
  const hasConsecutiveDays = sortedDays.some((day, i) => {
    if (i === 0) return false;
    return new Date(day).getTime() - new Date(sortedDays[i - 1]!).getTime() === 86400000;
  });
  const hasDoubleDay = (() => {
    const m = new Map<string, number>();
    dates.forEach((d) => { const k = d.toISOString().slice(0, 10); m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m.values()).some((n) => n >= 2);
  })();
  const hasPerfectWeek = (() => {
    const days = Array.from(calDays).sort();
    for (let i = 0; i <= days.length - 7; i++) {
      let ok = true;
      for (let j = 1; j < 7; j++) {
        if (new Date(days[i + j]!).getTime() - new Date(days[i + j - 1]!).getTime() !== 86400000) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  })();

  // ── Combo session flags ──────────────────────────────────────────────────
  const hasAllRaw = sessionCats.some((sc) => sc.has('nigiri') && sc.has('sashimi') && sc.has('handroll'));
  const hasFullCourse = sessionCats.some((sc) => sc.has('soup') && sc.has('dessert'));
  const hasSurfAndTurf = sessionCats.some((sc) => {
    const seafood = sc.has('nigiri') || sc.has('sashimi') || sc.has('roll') || sc.has('handroll') || sc.has('special_roll');
    return seafood && sc.has('teriyaki');
  });

  // ── World tour: every main category at least once ───────────────────────
  const ALL_CATS = ['nigiri','sashimi','roll','handroll','special_roll','soup','dessert','rice','noodles','teriyaki','skewers','spring_roll'];
  const hasWorldTour = ALL_CATS.every((c) => (cat[c] ?? 0) > 0);

  // ── 3 different restaurants within any 7-day window ─────────────────────
  const hasAdventureWeek = (() => {
    for (const s of us) {
      const d = safeDate(s);
      if (!d) continue;
      const lo = d.getTime() - 3.5 * 86400000;
      const hi = d.getTime() + 3.5 * 86400000;
      const rw = new Set<string>();
      for (const s2 of us) {
        const d2 = safeDate(s2);
        if (!d2 || d2.getTime() < lo || d2.getTime() > hi) continue;
        const key = s2.restaurantId !== 'unknown' ? s2.restaurantId : s2.restaurantName.trim().toLowerCase();
        if (key && key !== 'unknown restaurant') rw.add(key);
      }
      if (rw.size >= 3) return true;
    }
    return false;
  })();

  // Convenience shorthands
  const n = us.length;
  const ld = latestDate(us);
  const sAt = (i: number) => us[i] ? (us[i]!.submittedAt ?? us[i]!.startedAt) : undefined;
  const rn = (i: number) => restaurantName(us[i]);

  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return [
    // ── Session milestones ─────────────────────────────────────────────────
    make('first-session',        '🍣', 'First Plate',       'Log your first sushi party.',                        100,  n >= 1,    sAt(0),   false, rn(0)),
    make('habit-forming',        '📅', 'Habit Forming',     'Complete 5 parties.',                                100,  n >= 5,    sAt(4),   false, rn(4)),
    make('regular',              '🎌', 'Regular',           'Complete 10 parties.',                               250,  n >= 10,   sAt(9),   false, rn(9)),
    make('committed',            '🗓️', 'Committed',         'Complete 20 parties.',                               350,  n >= 20,   sAt(19),  false, rn(19)),
    make('on-a-roll',            '🏃', 'On a Roll',         'Complete 30 parties.',                               450,  n >= 30,   sAt(29),  false, rn(29)),
    make('sushi-devotee',        '🏅', 'Sushi Devotee',     'Complete 50 parties.',                               600,  n >= 50,   sAt(49),  false, rn(49)),
    make('unstoppable',          '🌟', 'Unstoppable',       'Complete 75 parties.',                               800,  n >= 75,   sAt(74),  false, rn(74)),

    // ── Session milestones (hidden) ────────────────────────────────────────
    make('hundred-sessions',     '🧿', '???',               '???',                                                1000, n >= 100,  sAt(99),  true,  rn(99)),
    make('two-hundred-sessions', '👑', '???',               '???',                                                2500, n >= 200,  sAt(199), true,  rn(199)),

    // ── Piece milestones ───────────────────────────────────────────────────
    make('fifty-pieces',         '🍙', 'Half Century',      'Eat 50 total pieces.',                               75,   totalPieces >= 50,   totalPieces >= 50   ? ld : undefined),
    make('hundred-pieces',       '💯', 'Century Club',      'Eat 100 total pieces.',                              200,  totalPieces >= 100,  totalPieces >= 100  ? ld : undefined),
    make('two-fifty-pieces',     '🎯', 'Quarter Thousand',  'Eat 250 total pieces.',                              300,  totalPieces >= 250,  totalPieces >= 250  ? ld : undefined),
    make('five-hundred-pieces',  '🍱', 'Five Hundred Club', 'Eat 500 total pieces.',                              400,  totalPieces >= 500,  totalPieces >= 500  ? ld : undefined),
    make('thousand-pieces',      '🌊', 'Tsunami',           'Eat 1,000 total pieces.',                            700,  totalPieces >= 1000, totalPieces >= 1000 ? ld : undefined),
    make('fifteen-hundred',      '🌀', 'Spiraling',         'Eat 1,500 total pieces.',                            850,  totalPieces >= 1500, totalPieces >= 1500 ? ld : undefined),

    // ── Piece milestones (hidden) ──────────────────────────────────────────
    make('absolute-unit',        '👹', 'Absolute Unit',     'A number too embarrassing to display.',               750,  totalPieces >= 2000, totalPieces >= 2000 ? ld : undefined, true),
    make('five-thousand-pieces', '🐉', '???',               '???',                                                2000, totalPieces >= 5000, totalPieces >= 5000 ? ld : undefined, true),

    // ── Single-session feats ───────────────────────────────────────────────
    make('ten-in-one',           '😋', 'Warmed Up',         'Eat 10+ pieces in one session.',                     50,   maxSingle >= 10, maxSingle >= 10 ? ld : undefined, false, maxSingle >= 10  ? rn(maxIdx) : undefined),
    make('twenty-in-one',        '😤', 'Getting Serious',   'Eat 20+ pieces in one session.',                     100,  maxSingle >= 20, maxSingle >= 20 ? ld : undefined, false, maxSingle >= 20  ? rn(maxIdx) : undefined),
    make('thirty-in-one',        '🔥', 'Big Appetite',      'Eat 30+ pieces in a single party.',                  150,  maxSingle >= 30, maxSingle >= 30 ? ld : undefined, false, maxSingle >= 30  ? rn(maxIdx) : undefined),
    make('forty-in-one',         '🌋', 'On Fire',           'Eat 40+ pieces in one sitting.',                     250,  maxSingle >= 40, maxSingle >= 40 ? ld : undefined, false, maxSingle >= 40  ? rn(maxIdx) : undefined),
    make('fifty-in-one',         '🦈', 'Feeding Frenzy',    'Eat 50+ pieces in one sitting.',                     350,  maxSingle >= 50, maxSingle >= 50 ? ld : undefined, false, maxSingle >= 50  ? rn(maxIdx) : undefined),

    // ── Single-session (hidden) ────────────────────────────────────────────
    make('sixty-in-one',         '💀', '???',               '???',                                                500,  maxSingle >= 60, maxSingle >= 60 ? ld : undefined, true,  maxSingle >= 60  ? rn(maxIdx) : undefined),

    // ── Category debuts ────────────────────────────────────────────────────
    make('first-roll',           '🌀', 'Roll Model',        'Order your first roll.',                             50,   (cat.roll       ?? 0) > 0),
    make('first-nigiri',         '🍣', 'Raw Purist',        'Order your first nigiri.',                           50,   (cat.nigiri     ?? 0) > 0),
    make('first-sashimi',        '🐟', 'Going Raw',         'Order your first sashimi.',                          50,   (cat.sashimi    ?? 0) > 0),
    make('first-handroll',       '🌮', 'Cone Head',         'Order your first hand roll.',                        50,   (cat.handroll   ?? 0) > 0),
    make('first-special-roll',   '🎁', 'Special Delivery',  'Order your first special roll.',                     75,   (cat.special_roll ?? 0) > 0),
    make('first-soup',           '🍜', 'Soup Season',       'Order your first soup.',                             50,   (cat.soup       ?? 0) > 0),
    make('first-salad',          '🥗', 'Greens Please',     'Order your first salad.',                            50,   (cat.salad      ?? 0) > 0),
    make('first-dessert',        '🍡', 'Sweet Tooth',       'Order your first dessert.',                          75,   (cat.dessert    ?? 0) > 0),
    make('first-noodles',        '🍝', 'Slurp Life',        'Order your first noodle dish.',                      50,   (cat.noodles    ?? 0) > 0),
    make('first-teriyaki',       '🔥', 'Teriyaki Temptation','Order your first teriyaki.',                        50,   (cat.teriyaki   ?? 0) > 0),
    make('first-skewers',        '🍢', 'Skewer Season',     'Order your first skewers.',                          50,   (cat.skewers    ?? 0) > 0),
    make('first-spring-roll',    '🥟', 'Spring Fling',      'Order your first spring roll.',                      50,   (cat.spring_roll ?? 0) > 0),
    make('first-rice',           '🍚', 'Rice Enthusiast',   'Order your first rice dish.',                        50,   (cat.rice       ?? 0) > 0),
    make('world-tour',           '🌍', 'World Tour',        'Order from every food category at least once.',      400,  hasWorldTour, hasWorldTour ? ld : undefined),

    // ── Category volume ────────────────────────────────────────────────────
    make('roll-fifty',           '🌀', 'Roll Enthusiast',   'Order 50 roll pieces total.',                        150,  (cat.roll        ?? 0) >= 50,  (cat.roll        ?? 0) >= 50  ? ld : undefined),
    make('nigiri-fifty',         '🍣', 'Nigiri Fan',        'Order 50 nigiri pieces.',                            150,  (cat.nigiri      ?? 0) >= 50,  (cat.nigiri      ?? 0) >= 50  ? ld : undefined),
    make('sashimi-fifty',        '🐟', 'Sashimi Fan',       'Order 50 sashimi pieces.',                           150,  (cat.sashimi     ?? 0) >= 50,  (cat.sashimi     ?? 0) >= 50  ? ld : undefined),
    make('roll-hundred',         '🌊', 'Roll Obsessed',     'Order 100 roll pieces.',                             250,  (cat.roll        ?? 0) >= 100, (cat.roll        ?? 0) >= 100 ? ld : undefined),
    make('nigiri-hundred',       '🏆', 'Nigiri Ninja',      'Order 100 nigiri pieces.',                           250,  (cat.nigiri      ?? 0) >= 100, (cat.nigiri      ?? 0) >= 100 ? ld : undefined),
    make('sashimi-hundred',      '🎋', 'Sashimi Devotee',   'Order 100 sashimi pieces.',                          250,  (cat.sashimi     ?? 0) >= 100, (cat.sashimi     ?? 0) >= 100 ? ld : undefined),
    make('special-roll-fifty',   '🎁', 'Special Occasion',  'Order 50 special roll pieces.',                      200,  (cat.special_roll ?? 0) >= 50, (cat.special_roll ?? 0) >= 50 ? ld : undefined),
    make('soup-twenty',          '🍜', 'Miso Happy',        'Order 20 soup items.',                               150,  (cat.soup        ?? 0) >= 20,  (cat.soup        ?? 0) >= 20  ? ld : undefined),
    make('dessert-twenty',       '🍡', 'Sugar Rush',        'Order 20 dessert items.',                            150,  (cat.dessert     ?? 0) >= 20,  (cat.dessert     ?? 0) >= 20  ? ld : undefined),
    make('noodle-fifty',         '🍝', 'Noodle Arms',       'Order 50 noodle pieces.',                            200,  (cat.noodles     ?? 0) >= 50,  (cat.noodles     ?? 0) >= 50  ? ld : undefined),
    make('rice-twenty',          '🍚', 'Rice Believer',     'Order 20 rice dishes.',                              150,  (cat.rice        ?? 0) >= 20,  (cat.rice        ?? 0) >= 20  ? ld : undefined),
    make('teriyaki-thirty',      '🔥', 'Teriyaki Believer', 'Order 30 teriyaki pieces.',                          150,  (cat.teriyaki    ?? 0) >= 30,  (cat.teriyaki    ?? 0) >= 30  ? ld : undefined),

    // ── Restaurant exploration ─────────────────────────────────────────────
    make('five-restaurants',     '🗺️', 'Sushi Explorer',    'Visit 5 different restaurants.',                     250,  uniqueRests >= 5,   uniqueRests >= 5   ? ld : undefined),
    make('ten-restaurants',      '🏯', 'Restaurant Hopper', 'Visit 10 different restaurants.',                    450,  uniqueRests >= 10,  uniqueRests >= 10  ? ld : undefined),
    make('fifteen-restaurants',  '🌏', 'Globetrotter',      'Visit 15 different restaurants.',                    600,  uniqueRests >= 15,  uniqueRests >= 15  ? ld : undefined),
    make('loyal-regular',        '❤️', 'Loyal Regular',     'Visit the same restaurant 5 times.',                 200,  maxRestVisits >= 5,  maxRestVisits >= 5  ? ld : undefined),
    make('home-base',            '🏠', 'Home Base',          'Visit the same restaurant 10 times.',                400,  maxRestVisits >= 10, maxRestVisits >= 10 ? ld : undefined),
    make('truly-devoted',        '💍', 'Truly Devoted',      'Visit the same restaurant 20 times.',                700,  maxRestVisits >= 20, maxRestVisits >= 20 ? ld : undefined),

    // ── Restaurant (hidden) ────────────────────────────────────────────────
    make('twenty-five-restaurants','🌐','???',              '???',                                                 1200, uniqueRests >= 25, uniqueRests >= 25 ? ld : undefined, true),

    // ── Group / social ─────────────────────────────────────────────────────
    make('first-group',          '🥢', 'Party Table',       'Finish your first linked group party.',              150,  groupSessions.length >= 1, sd(groupSessions[0]!), false, restaurantName(groupSessions[0])),
    make('social-butterfly',     '👥', 'Social Butterfly',  'Complete 3 group parties.',                          150,  groupSessions.length >= 3, sd(groupSessions[2]!), false, restaurantName(groupSessions[2])),
    make('party-animal',         '🎉', 'Party Animal',      'Complete 5 group parties.',                          250,  groupSessions.length >= 5, sd(groupSessions[4]!), false, restaurantName(groupSessions[4])),
    make('sushi-party-legend',   '🎊', 'Sushi Party Legend','Complete 10 group parties.',                         400,  groupSessions.length >= 10,sd(groupSessions[9]!), false, restaurantName(groupSessions[9])),
    make('big-party',            '🎆', 'Big Party',         'Join a group party with 4 or more people.',          200,  hasBigParty, hasBigParty ? ld : undefined),
    make('crowd-pleaser',        '🎙️', 'Crowd Pleaser',     'Host 5 group parties as party leader.',              300,  ownedGroup.length >= 5, ownedGroup.length >= 5 ? ld : undefined),
    make('balanced',             '⚖️', 'Balanced',          'Complete 10 solo and 10 group parties.',             350,  soloSessions.length >= 10 && groupSessions.length >= 10, soloSessions.length >= 10 && groupSessions.length >= 10 ? ld : undefined),

    // ── Group (hidden) ─────────────────────────────────────────────────────
    make('huge-party',           '🏟️', '???',               '???',                                                500,  hasHugeParty, hasHugeParty ? ld : undefined, true),
    make('sushi-party-king',     '👑', '???',               '???',                                                800,  groupSessions.length >= 20, groupSessions.length >= 20 ? ld : undefined, true),

    // ── Solo ───────────────────────────────────────────────────────────────
    make('solo-debut',           '🎭', 'Solo Debut',         'Complete your first solo session.',                 75,   soloSessions.length >= 1, sd(soloSessions[0]!), false, restaurantName(soloSessions[0])),
    make('me-time',              '🧘', 'Me Time',            'Complete 10 solo sessions.',                        200,  soloSessions.length >= 10, sd(soloSessions[9]!),  false, restaurantName(soloSessions[9])),
    make('solo-twenty',          '🎯', 'Flying Solo',        'Complete 20 solo sessions.',                        350,  soloSessions.length >= 20, sd(soloSessions[19]!), false, restaurantName(soloSessions[19])),

    // ── Solo (hidden) ──────────────────────────────────────────────────────
    make('solo-legend',          '🥷', '???',                '???',                                               500,  soloSessions.length >= 25, sd(soloSessions[24]!), true),

    // ── Time of day / day of week ──────────────────────────────────────────
    make('friday-night',         '🍻', 'TGIF',               'Log a party on a Friday.',                          75,   hasFriday,        hasFriday   ? ld : undefined),
    make('monday-warrior',       '💪', 'Case of the Mondays','Log a session on a Monday.',                        100,  hasMonday,        hasMonday   ? ld : undefined),
    make('weekend-warrior',      '☀️', 'Weekend Warrior',    'Log 5 sessions on weekends.',                       150,  weekendCount >= 5, weekendCount >= 5 ? ld : undefined),
    make('late-night-craving',   '🌙', 'Late Night Craving', 'Log a session after 9pm.',                          100,  hasLateNight,     hasLateNight ? ld : undefined),
    make('lunch-break',          '🕛', 'Lunch Break',        'Log a session between noon and 2pm.',                75,   hasLunch,         hasLunch    ? ld : undefined),
    make('early-bird',           '🌅', 'Early Bird',         'Log a session before noon.',                        100,  hasEarlyBird,     hasEarlyBird ? ld : undefined),
    make('all-days-of-week',     '🗂️', 'Round the Week',     'Log a session on every day of the week.',           400,  dowSeen.size >= 7, dowSeen.size >= 7 ? ld : undefined),

    // ── Consistency ────────────────────────────────────────────────────────
    make('five-nights',          '🌙', 'Five Nights',        'Log sessions on 5 different calendar days.',        200,  calDays.size >= 5,   calDays.size >= 5   ? ld : undefined),
    make('ten-nights',           '📆', 'Regular Attender',   'Log sessions on 10 different calendar days.',       300,  calDays.size >= 10,  calDays.size >= 10  ? ld : undefined),
    make('twenty-nights',        '🗓️', 'Dedicated',          'Log sessions on 20 different calendar days.',       450,  calDays.size >= 20,  calDays.size >= 20  ? ld : undefined),
    make('three-months',         '📅', 'Three Month Itch',   'Log sessions in 3 different calendar months.',      250,  calMonths.size >= 3, calMonths.size >= 3 ? ld : undefined),
    make('half-year',            '🗓️', 'Half Year Habit',    'Log sessions in 6 different calendar months.',      450,  calMonths.size >= 6, calMonths.size >= 6 ? ld : undefined),
    make('ten-weeks',            '📅', 'Decade of Weeks',    'Log sessions across 10 different calendar weeks.',  400,  calWeeks.size >= 10, calWeeks.size >= 10 ? ld : undefined),
    make('back-to-back',         '🔥', 'Back to Back',       'Log sessions on two consecutive calendar days.',    150,  hasConsecutiveDays, hasConsecutiveDays ? ld : undefined),
    make('double-feature',       '⚡', 'Double Feature',     'Log 2 sessions in the same calendar day.',          200,  hasDoubleDay, hasDoubleDay ? ld : undefined),

    // ── Consistency (hidden) ──────────────────────────────────────────────
    make('perfect-week',         '🗓️', '???',                '???',                                               1000, hasPerfectWeek, hasPerfectWeek ? ld : undefined, true),

    // ── Variety & unique items ─────────────────────────────────────────────
    make('menu-tourist',         '🎭', 'Menu Tourist',       'Order 10 different menu items across all sessions.', 150, uniqueItems.size >= 10, uniqueItems.size >= 10 ? ld : undefined),
    make('connoisseur',          '📚', 'Connoisseur',        'Order 20 different menu items.',                     250, uniqueItems.size >= 20, uniqueItems.size >= 20 ? ld : undefined),
    make('researcher',           '🔬', 'Researcher',         'Order 30 different menu items.',                     350, uniqueItems.size >= 30, uniqueItems.size >= 30 ? ld : undefined),
    make('menu-master',          '🏆', 'Menu Master',        'Order 50 different menu items.',                     500, uniqueItems.size >= 50, uniqueItems.size >= 50 ? ld : undefined),
    make('variety-eater',        '🎲', 'Adventurous Palate', 'Order from 8 different food categories in your lifetime.', 300, (new Set(Object.keys(cat))).size >= 8, (new Set(Object.keys(cat))).size >= 8 ? ld : undefined),

    // ── Combo / session achievements ──────────────────────────────────────
    make('tasting-menu',         '🍽️', 'Tasting Menu',       'Order from 3 or more categories in one session.',   75,   maxCatsInSession >= 3, maxCatsInSession >= 3 ? ld : undefined),
    make('rainbow-session',      '🌈', 'Rainbow Roll',       'Order from 6 or more categories in one party.',     300,  maxCatsInSession >= 6, maxCatsInSession >= 6 ? ld : undefined),
    make('the-purist',           '🐠', 'The Purist',         'Order nigiri, sashimi, and hand rolls in one session.',150, hasAllRaw, hasAllRaw ? ld : undefined),
    make('full-course',          '🍽️', 'Full Course',        'Order both soup and dessert in one session.',        150,  hasFullCourse, hasFullCourse ? ld : undefined),
    make('surf-and-turf',        '🌊', 'Surf & Turf',        'Order seafood and teriyaki in the same session.',    150,  hasSurfAndTurf, hasSurfAndTurf ? ld : undefined),

    // ── Notes ─────────────────────────────────────────────────────────────
    make('note-taker',           '📝', 'Note Taker',         'Add a note to any session.',                         50,   sessionsWithNotes >= 1,  sessionsWithNotes >= 1  ? ld : undefined),
    make('journaling',           '📓', 'Journaling',         'Add notes to 5 different sessions.',                 150,  sessionsWithNotes >= 5,  sessionsWithNotes >= 5  ? ld : undefined),
    make('food-critic',          '✍️', 'Food Critic',        'Add notes to 20 different sessions.',                300,  sessionsWithNotes >= 20, sessionsWithNotes >= 20 ? ld : undefined),

    // ── Adventure ─────────────────────────────────────────────────────────
    make('adventure-week',       '🗺️', 'Adventure Week',     'Visit 3 different restaurants within 7 days.',      300,  hasAdventureWeek, hasAdventureWeek ? ld : undefined),
    make('world-tour-sessions',  '✈️', 'Frequent Flyer',     'Log sessions at 5 restaurants in a single month.',  400,  (() => {
      const monthRests = new Map<string, Set<string>>();
      us.forEach((s) => {
        const d = safeDate(s);
        if (!d) return;
        const mk = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthRests.has(mk)) monthRests.set(mk, new Set());
        const key = s.restaurantId !== 'unknown' ? s.restaurantId : s.restaurantName.trim().toLowerCase();
        if (key && key !== 'unknown restaurant') monthRests.get(mk)!.add(key);
      });
      return Array.from(monthRests.values()).some((rs) => rs.size >= 5);
    })(), ld),
  ];
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

export function getNewlyEarnedAchievements(
  sessions: SushiSession[],
  previousSessions: SushiSession[],
  userId: string,
): Achievement[] {
  const prevIds = new Set(
    getAchievements(previousSessions, userId).filter((a) => a.earned).map((a) => a.id),
  );
  return getAchievements(sessions, userId).filter((a) => a.earned && !prevIds.has(a.id));
}
