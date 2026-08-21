import { expect, test } from '@playwright/test';

// Coverage for the AI opponent, draft bots, and the co-op / boss modes.
// These drive the app through window.GALDUR_APP (the deliberate bridge ai.js
// uses) so the tests stay independent of menu-navigation churn.

async function enter(page) {
  await page.goto('/index.html');
  await page.waitForTimeout(250);
  await page.locator('#enterApp').click();
  await page.waitForTimeout(200);
}

async function openBattleMenu(page, modeId) {
  await page.evaluate((id) => {
    const A = window.GALDUR_APP, s = A.state;
    s.currentPlayer = 1;
    s.gameStarted = false;
    s.winner = null;
    s.vsAI = false;
    s.coop = false;
    s.bossRound = 0;
    s.decks.player1 = [];
    s.decks.player2 = [];
    s.selectedMode = id;
    s.battleMode = id;
    s.screen = 'battlemenu';
    A.render();
  }, modeId);
}

// Give both seats a deck so the Start Game button enables.
async function seedDecks(page, size = 40) {
  await page.evaluate((n) => {
    const s = window.GALDUR_APP.state;
    const deck = (owner) => Array.from({ length: n }, (_, i) => ({
      id: `${owner}-${i}`, name: i % 3 ? `Bear ${i}` : 'Forest',
      type: i % 3 ? 'Creature — Bear' : 'Basic Land — Forest',
      cost: i % 3 ? '{1}{G}' : '', colors: ['G'], effect: '',
      power: i % 3 ? 2 : 0, toughness: i % 3 ? 2 : 0, rarity: 'common', imageUrl: ''
    }));
    s.decks.player1 = deck('p1');
    s.decks.player2 = deck('p2');
    window.GALDUR_APP.render();
  }, size);
}

test('AI and app bridges are exposed once the scripts load', async ({ page }) => {
  await enter(page);
  const globals = await page.evaluate(() => ({
    app: !!window.GALDUR_APP,
    ai: !!window.GALDUR_AI,
    hasExecute: typeof window.GALDUR_APP?.executeGameAction === 'function',
    hasOnRender: typeof window.GALDUR_AI?.onRender === 'function'
  }));
  expect(globals).toEqual({ app: true, ai: true, hasExecute: true, hasOnRender: true });
});

test('Boss Battle starts asymmetric life totals and offers co-op', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'boss');
  await expect(page.locator('#playCoop')).toBeVisible();

  await page.locator('#playCoop').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(600);

  const st = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    return {
      coop: s.coop,
      vsAI: s.vsAI,
      survivors: s.gameState.player1.health,
      boss: s.gameState.player2.health,
      hand: s.gameState.player1.hand.length
    };
  });
  expect(st.coop).toBe(true);
  expect(st.vsAI).toBe(true);
  expect(st.survivors).toBe(38);   // 30 base + the Normal co-op cushion
  expect(st.boss).toBe(40);
  expect(st.hand).toBe(7);           // vs-AI games deal an opening hand

  // Co-op hands the device between the two survivors.
  await expect(page.locator('#passSeat')).toBeVisible();
  await page.locator('#passSeat').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.GALDUR_APP.state.coopSeat)).toBe(2);
});

test('AI takes its own turn: untaps, draws, and passes back', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'boss');
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);

  await page.locator('#endTurn').click();
  await page.waitForTimeout(9000);

  const st = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    return {
      active: s.activePlayer,
      targeting: s.targeting && s.targeting.type,
      log: (s.gameLog || []).map(e => e.message)
    };
  });
  // Either the turn came back to us, or the AI is waiting on blocker assignment.
  expect(st.active === 1 || st.targeting === 'ai-blockers').toBe(true);
  expect(st.log.some(m => /AI (untaps|draws)/.test(m))).toBe(true);
});

test('Horde tokens are summoning sick and cannot swing the turn they arrive', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'horde');
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);

  const lifeBefore = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.health);
  await page.locator('#endTurn').click();
  // Wait for the Horde's reveal, then for its turn to finish.
  await page.waitForFunction(
    () => (window.GALDUR_APP.state.gameLog || []).some(e => /Horde reveal:/.test(e.message)),
    { timeout: 20000 });
  await page.waitForFunction(
    () => window.GALDUR_APP.state.activePlayer === 1 || window.GALDUR_APP.state.winner,
    { timeout: 25000 }).catch(() => {});

  const st = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    return { log: (s.gameLog || []).map(e => e.message), life: s.gameState.player1.health };
  });
  expect(st.log.some(m => /Horde reveal:/.test(m))).toBe(true);
  // Nothing revealed this turn can swing, so combat cannot have cost life.
  // (Drain actions like Gnawing Dread still can, hence the <= comparison.)
  expect(st.log.some(m => /Horde attacks with/.test(m))).toBe(false);
  expect(st.life).toBeLessThanOrEqual(lifeBefore);
});

test('A life-based win shows the victory modal instead of the pre-game screen', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.decks.player1 = [{ id: 'a', name: 'Test', type: 'Creature', cost: '{1}', colors: [], effect: '', power: 1, toughness: 1 }];
    s.decks.player2 = [{ id: 'b', name: 'Test', type: 'Creature', cost: '{1}', colors: [], effect: '', power: 1, toughness: 1 }];
    A.render();
  });
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.gameState.player2.health = 0;
    A.checkWinner();
    A.render();
  });
  await expect(page.locator('#returnBtn')).toBeVisible();
  await expect(page.getByText('You Win!')).toBeVisible();
});

test('Simultaneous lethal is a draw rather than an automatic player 2 win', async ({ page }) => {
  await enter(page);
  const winner = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.gameStarted = true;
    s.gameState.player1.health = 0;
    s.gameState.player2.health = 0;
    A.checkWinner();
    const w = s.winner;
    s.winner = null; s.gameStarted = false;
    return w;
  });
  expect(winner).toBe('draw');
});

test('Opening a mode with auto-decks never overwrites a real deck', async ({ page }) => {
  await enter(page);
  const kept = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.decks.player1 = [{ id: 'x', name: 'Precious Custom Card', type: 'Creature', cost: '{1}', colors: [], effect: '', power: 1, toughness: 1 }];
    s.decks.player2 = [];
    s.selectedMode = 'land-game';
    s.battleMode = 'land-game';
    s.screen = 'battlemenu';
    A.render();
    return s.decks.player1.map(c => c.name);
  });
  expect(kept).toEqual(['Precious Custom Card']);
});

test('Starting a new draft clears the previous run', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.draft.deck = Array.from({ length: 60 }, (_, i) => ({ id: 'c' + i, name: 'Old ' + i, type: 'Creature', cost: '{1}' }));
    s.draft.picks = 60;
    s.screen = 'draft';
    s.draft.active = true;
    s.draft.mode = 'traditional';
    s.draft.screen = 'setup';
    A.render();
  });
  await page.locator('[data-f="modern"]').first().click();
  await page.waitForTimeout(400);

  const d = await page.evaluate(() => {
    const x = window.GALDUR_APP.state.draft;
    return { deck: x.deck.length, picks: x.picks, screen: x.screen };
  });
  expect(d).toEqual({ deck: 0, picks: 0, screen: 'colors' });
});

test('Draft-off vs bot: the bot answers each pick on its own', async ({ page }) => {
  // Deterministic offline pack contents. Drafting pulls one /cards/search page
  // and samples it locally, so the whole draft is served by this single stub.
  const stubCard = (n) => ({
    id: 'stub-' + n, name: 'Stub Card ' + n, type_line: 'Creature — Test',
    mana_cost: '{1}{U}', cmc: 2, colors: ['U'], oracle_text: 'Test.',
    power: '2', toughness: '2', rarity: ['common', 'uncommon', 'rare', 'mythic'][n % 4],
    image_uris: { normal: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' }
  });
  await page.route('**://api.scryfall.com/**', async route => {
    const url = route.request().url();
    if (url.includes('/cards/search')) {
      const data = Array.from({ length: 60 }, (_, i) => stubCard(i + 1));
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ object: 'list', total_cards: data.length, has_more: false, data })
      });
    }
    if (url.includes('/cards/random')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubCard(1)) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.currentPlayer = 1;
    s.screen = 'draft';
    s.draft.active = true;
    s.draft.mode = 'draftoff';
    s.draft.screen = 'draftoff-setup';
    A.render();
  });
  await expect(page.locator('#botOff')).toBeVisible();
  await page.locator('#botOff').click();
  await page.waitForTimeout(3500);

  const start = await page.evaluate(() => {
    const d = window.GALDUR_APP.state.draft;
    return { vsBot: d.off.vsBot, table: d.off.table.length, picker: d.off.currentPicker };
  });
  expect(start.vsBot).toBe(true);
  expect(start.table).toBeGreaterThan(0);
  expect(start.picker).toBe(1);

  // Human picks; the bot should take its own card without any further input.
  await page.evaluate(() => window.draftOffApplyPick(0, 1));
  await page.waitForTimeout(3000);

  const after = await page.evaluate(() => {
    const d = window.GALDUR_APP.state.draft;
    return { p1: d.off.p1.length, p2: d.off.p2.length };
  });
  expect(after.p1).toBe(1);
  expect(after.p2).toBe(1);
});

test('Winston vs bot exposes its moves and the bot takes a turn', async ({ page }) => {
  await stubScryfall(page);          // the starter pool now fetches real cards
  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.screen = 'draft';
    s.draft.active = true;
    s.draft.mode = 'winston';
    s.draft.screen = 'winston-setup';
    A.render();
  });
  await page.locator('#winstonVsBot').check();
  await page.locator('#useStarterPool').click();
  // The pool build is async; wait until the draft actually starts.
  await page.waitForFunction(() => window.GALDUR_APP.state.draft.screen === 'winston', { timeout: 20000 });

  expect(await page.evaluate(() => typeof window.winstonTakePile)).toBe('function');
  const started = await page.evaluate(() => {
    const w = window.GALDUR_APP.state.draft.winston;
    return { vsBot: w.vsBot, active: w.activePlayer, pool: w.pool.length };
  });
  expect(started.vsBot).toBe(true);
  expect(started.active).toBe(1);

  // Player 1 takes a pile; the bot should then act unprompted.
  await page.evaluate(() => window.winstonTakePile());
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => {
    const w = window.GALDUR_APP.state.draft.winston;
    return { p1: w.p1.length, p2: w.p2.length };
  });
  expect(after.p1).toBeGreaterThan(0);
  expect(after.p2).toBeGreaterThan(0);
});

test('Utility spacing classes referenced by the app actually resolve', async ({ page }) => {
  await enter(page);
  const css = await page.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'mt-3 p-3 font-bold';
    document.body.appendChild(d);
    const c = getComputedStyle(d);
    const out = { marginTop: c.marginTop, padding: c.padding, fontWeight: c.fontWeight };
    d.remove();
    return out;
  });
  expect(css).toEqual({ marginTop: '12px', padding: '12px', fontWeight: '700' });
});

test('Hybrid mana pips count once toward converted mana cost', async ({ page }) => {
  await enter(page);
  const cmc = await page.evaluate(() => window.GALDUR_APP.getCMC({ cost: '{1}{G/W}{G/W}' }));
  expect(cmc).toBe(3);   // Kitchen Finks
});

// --- draft performance + rendering regressions -----------------------------

// Stub a search page so drafting is offline and deterministic.
async function stubScryfall(page, count = 120) {
  // Power varies so difficulty filters (the boss wants power >= 3) still find
  // creatures, and some cards read as removal.
  const card = (n) => ({
    id: 'stub-' + n, name: 'Stub Card ' + n,
    type_line: n % 4 === 0 ? 'Instant' : 'Creature — Test',
    mana_cost: `{${n % 4}}{U}`, cmc: (n % 4) + 1, colors: ['U'],
    oracle_text: n % 4 === 0 ? 'Destroy target creature.' : 'Test.',
    power: n % 4 === 0 ? null : String(1 + (n % 6)),
    toughness: n % 4 === 0 ? null : String(1 + (n % 5)),
    rarity: ['common', 'uncommon', 'rare', 'mythic'][n % 4],
    set: 'tst', set_name: 'Test Set', artist: 'Tester',
    image_uris: { normal: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' }
  });
  const landCard = (name, n) => ({
    id: `land-${name}-${n}`, name, type_line: `Basic Land — ${name}`,
    mana_cost: '', cmc: 0, colors: [], oracle_text: '',
    rarity: 'common', set: 'tst', set_name: 'Test Set', artist: 'Land Tester',
    image_uris: { normal: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' }
  });
  const LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

  await page.route('**://api.scryfall.com/**', async route => {
    const url = decodeURIComponent(route.request().url());
    const list = (data) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ object: 'list', total_cards: data.length, has_more: false, data })
    });

    if (url.includes('/cards/search')) {
      // Basic-land art lookups must come back as lands, not spells.
      const land = LANDS.find(n => url.includes(`type:${n}`));
      if (land) return list(Array.from({ length: 12 }, (_, i) => landCard(land, i + 1)));
      return list(Array.from({ length: count }, (_, i) => card(i + 1)));
    }
    if (url.includes('/cards/named')) {
      const land = LANDS.find(n => url.includes(n));
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(land ? landCard(land, 1) : card(1))
      });
    }
    if (url.includes('/cards/random')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(card(1)) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

async function startTraditionalDraft(page) {
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.currentPlayer = 1; s.screen = 'draft'; s.draft.active = true;
    s.draft.mode = 'traditional'; s.draft.screen = 'setup'; A.render();
  });
  await page.locator('[data-f="modern"]').first().click();
  await page.evaluate(() => {
    const D = window.GALDUR_APP.state.draft;
    D.chosenColors = ['U']; D.screen = 'lands'; window.GALDUR_APP.render();
  });
  await page.evaluate(() => { document.querySelectorAll('input[data-c]').forEach(i => { i.value = '0'; }); });
  await page.locator('#apply').click();
  await page.waitForFunction(() => {
    const D = window.GALDUR_APP.state.draft;
    return D.screen === 'picks' && !D.dealing && D.pool.length > 0;
  }, { timeout: 30000 });
}

test('The draft row renders the cards the pool actually holds', async ({ page }) => {
  // Regression: the old preloader blanked D.pool as a side channel, so a render
  // landing in that window painted an empty draft row that never recovered.
  await stubScryfall(page);
  await enter(page);
  await startTraditionalDraft(page);

  const poolSize = await page.evaluate(() => window.GALDUR_APP.state.draft.pool.length);
  expect(poolSize).toBe(3);
  await expect(page.locator('.draft-choice')).toHaveCount(3);
});

test('Picking repeatedly keeps refilling the row without extra API calls', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);
  await startTraditionalDraft(page);

  let apiCalls = 0;
  page.on('request', r => {
    if (r.url().includes('api.scryfall.com') && !r.url().includes('format=image')) apiCalls++;
  });

  for (let i = 0; i < 5; i++) {
    await expect(page.locator('.draft-choice')).toHaveCount(3);
    const before = await page.evaluate(() => window.GALDUR_APP.state.draft.deck.length);
    await page.locator('.draft-choice').first().click();
    await page.waitForFunction(
      n => window.GALDUR_APP.state.draft.deck.length > n, before, { timeout: 15000 });
  }

  expect(await page.evaluate(() => window.GALDUR_APP.state.draft.deck.length)).toBe(5);
  // Picks are served from the in-memory pool. A broadened fallback query may
  // legitimately open one more pool, but nothing like the old one-request-per-
  // candidate behaviour (which cost dozens of calls for five picks).
  expect(apiCalls).toBeLessThanOrEqual(2);
});

test('Basic lands are resolved once per land name, with real art', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);

  // Walk the draft up to the lands step, then ask for 12 of each of two basics.
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.currentPlayer = 1; s.screen = 'draft'; s.draft.active = true;
    s.draft.mode = 'traditional'; s.draft.screen = 'setup'; A.render();
  });
  await page.locator('[data-f="modern"]').first().click();
  await page.evaluate(() => {
    const D = window.GALDUR_APP.state.draft;
    D.chosenColors = ['U', 'R']; D.screen = 'lands'; window.GALDUR_APP.render();
  });
  await expect(page.locator('input[data-c]')).toHaveCount(2);

  let apiCalls = 0;
  page.on('request', r => {
    if (r.url().includes('api.scryfall.com') && !r.url().includes('format=image')) apiCalls++;
  });

  await page.evaluate(() => { document.querySelectorAll('input[data-c]').forEach(i => { i.value = '12'; }); });
  await page.locator('#apply').click();
  await page.waitForFunction(() => {
    const D = window.GALDUR_APP.state.draft;
    return D.screen === 'picks' && !D.dealing;
  }, { timeout: 30000 });

  const lands = await page.evaluate(() => window.GALDUR_APP.state.draft.deck
    .filter(c => /Land/i.test(c.type || ''))
    .map(c => ({ name: c.name, hasImage: !!c.imageUrl })));

  expect(lands.length).toBe(24);
  expect(lands.every(c => c.hasImage)).toBe(true);
  // Two land names + one card pool — nowhere near one request per land copy.
  expect(apiCalls).toBeLessThanOrEqual(6);
});

// --- game start / turn flow -------------------------------------------------

// Walk the real navigation (menu -> formats -> studio), which is how the
// stuck-turn bug reached production: state-injecting tests never touched it.
async function openStudioViaMenu(page, modeName) {
  await page.locator('#playlistModeBtn').click();
  await page.locator('.mode-card', { has: page.getByRole('heading', { name: modeName }) })
    .getByRole('button', { name: 'Open Studio' }).click();
  await expect(page.locator('#studioPlayAI')).toBeVisible();
}

for (const [modeName, expectedKind] of [['Horde Magic', 'horde:normal'], ['Boss Battle', 'boss:normal']]) {
  test(`${modeName} runs its own turns when started from the Mode Studio`, async ({ page }) => {
    await enter(page);
    await openStudioViaMenu(page, modeName);
    await page.locator('#studioPlayAI').click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.waitForTimeout(700);

    const start = await page.evaluate(() => {
      const s = window.GALDUR_APP.state;
      return {
        vsAI: s.vsAI,
        hand: s.gameState.player1.hand.length,
        deckKind: (s.decks.player2 || [])[0]?.autoDeckKind || ''
      };
    });
    expect(start.vsAI).toBe(true);          // the mode drives itself
    expect(start.hand).toBe(7);             // opening hand is dealt
    expect(start.deckKind).toBe(expectedKind);

    // Passing the turn must hand control back, not stall on player 2.
    await page.locator('#endTurn').click();
    await page.waitForFunction(
      () => window.GALDUR_APP.state.activePlayer === 1 || window.GALDUR_APP.state.winner,
      { timeout: 25000 });
    const log = await page.evaluate(() => (window.GALDUR_APP.state.gameLog || []).map(e => e.message));
    expect(log.some(m => /Horde|AI /.test(m))).toBe(true);
  });
}

test('Switching modes replaces a generated deck from the previous mode', async ({ page }) => {
  await enter(page);
  await openStudioViaMenu(page, 'Horde Magic');
  await page.locator('#studioPlayAI').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() =>
    window.GALDUR_APP.state.decks.player2[0].autoDeckKind)).toBe('horde:normal');

  // Leave, pick a different mode: the Horde deck must not linger as the
  // opponent's library.
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.gameStarted = false; s.winner = null; s.screen = 'menu'; A.render();
  });
  await openStudioViaMenu(page, 'Boss Battle');
  await page.locator('#studioPlayAI').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() =>
    window.GALDUR_APP.state.decks.player2[0].autoDeckKind)).toBe('boss:normal');
});

test('Taking over a turn untaps and draws automatically', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);

  const before = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    // Tap something so the untap step is observable.
    s.gameState.player2.creatureField = [{
      id: 't1', gameId: 't1', name: 'Tapped Guy', type: 'Creature - Bear',
      power: 2, toughness: 2, tapped: true, pt: { p: 0, t: 0 }, stun: 0
    }];
    A.render();
    return { p2hand: s.gameState.player2.hand.length, p2deck: s.gameState.player2.deck.length };
  });

  await page.locator('#endTurn').click();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    return {
      p2hand: s.gameState.player2.hand.length,
      p2deck: s.gameState.player2.deck.length,
      untapped: s.gameState.player2.creatureField.every(c => !c.tapped)
    };
  });
  expect(after.p2hand).toBe(before.p2hand + 1);
  expect(after.p2deck).toBe(before.p2deck - 1);
  expect(after.untapped).toBe(true);
});

test('The pre-game screen explains the setup and the mode rules', async ({ page }) => {
  await enter(page);
  await openStudioViaMenu(page, 'Horde Magic');
  await page.locator('#studioPlayAI').click();

  await expect(page.locator('.setup-card')).toBeVisible();
  const text = await page.locator('.setup-card').innerText();
  expect(text).toMatch(/Opening hand:\s*7/);
  expect(text).toMatch(/starting life/i);
  expect(text).toMatch(/rules of horde magic/i);
  expect(text).toMatch(/automated Horde deck/);
});

// --- difficulty + bot blocking ---------------------------------------------

// Put a fixed board on the table: 3 attackers for the human, 3 blockers for the bot.
async function combatScenario(page, difficulty) {
  await page.evaluate((d) => {
    const A = window.GALDUR_APP, s = A.state;
    s.aiDifficulty = d;
    const mk = (n, t, pw, tg, e = '') => ({
      id: n + Math.random(), gameId: 'g' + Math.random().toString(36).slice(2),
      name: n, type: t, cost: '', colors: [], effect: e,
      power: pw, toughness: tg, tapped: false, pt: { p: 0, t: 0 }, stun: 0
    });
    const p1 = s.gameState.player1, p2 = s.gameState.player2;
    p1.creatureField = [
      mk('Big Bear', 'Creature - Bear', 4, 4),
      mk('Flier', 'Creature - Bird', 2, 2, 'Flying.'),
      mk('Runt', 'Creature - Rat', 1, 1)
    ];
    p1.supportField = []; p1.landField = [];
    p2.creatureField = [
      mk('Wall', 'Creature - Wall', 0, 5),
      mk('Trader', 'Creature - Knight', 3, 3),
      mk('Archer', 'Creature - Archer', 2, 3, 'Reach.')
    ];
    p2.supportField = []; p2.landField = [];
    p1.health = 20; p2.health = 20;
    s.activePlayer = 1; s.showTurnNotification = false;
    A.render();
  }, difficulty);
}

test('Difficulty is selectable on the battle menu and persists', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await expect(page.locator('.difficultyBtn')).toHaveCount(3);

  await page.locator('.difficultyBtn[data-diff="hard"]').click();
  expect(await page.evaluate(() => window.GALDUR_APP.state.aiDifficulty)).toBe('hard');
  await expect(page.locator('.difficultyBtn[data-diff="hard"]')).toHaveClass(/active/);
  await expect(page.locator('#difficultyBlurb')).not.toBeEmpty();

  // Survives a reload via the saved profile (saving is debounced, so wait).
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.GALDUR_APP.state.aiDifficulty)).toBe('hard');
});

test('On Hard the bot blocks the human attack intelligently', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);
  await combatScenario(page, 'hard');

  await page.locator('#declareAttack').click();
  await expect(page.locator('.attackPick')).toHaveCount(3);
  await page.locator('#attackAll').click();
  await page.locator('#confirmAttack').click();
  await page.waitForTimeout(4000);

  const r = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    return {
      botLife: s.gameState.player2.health,
      myCreatures: A.battlefieldCards(s.gameState.player1).map(c => c.name),
      log: (s.gameLog || [])[0]?.message || ''
    };
  });
  // Every attacker is blockable here, so a perfect blocker takes no damage...
  expect(r.botLife).toBe(20);
  // ...and its reach Archer eats the flier while the Knight kills the Runt.
  expect(r.myCreatures).toEqual(['Big Bear']);
  expect(r.log).toMatch(/blocks/);
});

test('Attacking taps the attackers and can be cancelled', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);
  await combatScenario(page, 'easy');

  await page.locator('#declareAttack').click();
  await page.locator('#cancelAttack').click();
  await expect(page.locator('.attackPick')).toHaveCount(0);
  expect(await page.evaluate(() =>
    window.GALDUR_APP.battlefieldCards(window.GALDUR_APP.state.gameState.player1)
      .every(c => !c.tapped))).toBe(true);

  // Attacking with one creature taps only that one (no vigilance here).
  await page.locator('#declareAttack').click();
  await page.locator('.attackPick').first().click();
  await page.locator('#confirmAttack').click();
  await page.waitForTimeout(3000);
  const tapped = await page.evaluate(() =>
    window.GALDUR_APP.battlefieldCards(window.GALDUR_APP.state.gameState.player1)
      .filter(c => c.tapped).length);
  expect(tapped).toBe(1);
});


test('Auto-built opponents scale with the chosen difficulty', async ({ page }) => {
  await enter(page);

  const counts = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    const giants = (deck) => deck.filter(c => /Giant/.test(c.name)).length;
    const build = (tier) => {
      s.decks.player1 = []; s.decks.player2 = [];
      s.selectedMode = 'horde'; s.battleMode = 'horde';
      s.screen = 'battlemenu'; A.render();
      // Clicking the difficulty control is what rebuilds the auto deck.
      document.querySelector(`.difficultyBtn[data-diff="${tier}"]`).click();
      return { size: s.decks.player2.length, giants: giants(s.decks.player2), kind: s.decks.player2[0].autoDeckKind };
    };
    return { easy: build('easy'), hard: build('hard') };
  });
  // Changing difficulty alone regenerated the deck (the kind carries the tier)...
  expect(counts.easy.kind).toBe('horde:easy');
  expect(counts.hard.kind).toBe('horde:hard');
  // ...and Hard runs meaningfully more big threats than Easy.
  expect(counts.hard.giants).toBeGreaterThan(counts.easy.giants);
});

test('Boss life scales with difficulty', async ({ page }) => {
  await enter(page);
  const life = await page.evaluate(async () => {
    const A = window.GALDUR_APP, s = A.state;
    const start = (tier) => {
      s.aiDifficulty = tier;
      s.gameStarted = false; s.winner = null;
      s.decks.player1 = []; s.decks.player2 = [];
      s.selectedMode = 'boss'; s.battleMode = 'boss';
      s.screen = 'battlemenu'; A.render();
      document.querySelector('#playAI').click();
      document.querySelector('#startBtn').click();
      return s.gameState.player2.health;
    };
    return { easy: start('easy'), normal: start('normal'), hard: start('hard') };
  });
  expect(life).toEqual({ easy: 30, normal: 40, hard: 50 });
});

test('Double-clicking a hand card plays it to its natural zone', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.hand.length);
  await page.locator('#handContainer .hand-card').first().dblclick();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const A = window.GALDUR_APP, p1 = A.state.gameState.player1;
    return { hand: p1.hand.length, field: A.battlefieldCards(p1).length };
  });
  expect(after.hand).toBe(before - 1);
  expect(after.field).toBe(1);
});


test('A generated Dandan library no longer becomes the Boss survivor deck', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    // What the Dandan generator leaves behind…
    s.selectedMode = 'dandan'; s.battleMode = 'dandan';
    s.screen = 'battlemenu'; A.render();
  });
  const gen = page.locator('#starterDandanBattle');
  if (await gen.count()) await gen.click();
  await page.waitForTimeout(300);
  // …must be replaced when Boss Battle sets itself up. (openBattleMenu would
  // clear the decks and hide the bug, so switch modes by hand and trigger the
  // auto-deck build the way the UI does: via the difficulty control.)
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.selectedMode = 'boss'; s.battleMode = 'boss';
    s.screen = 'battlemenu'; A.render();
  });
  await page.locator('.difficultyBtn[data-diff="normal"]').click();
  await page.waitForTimeout(300);
  const kinds = await page.evaluate(() => ({
    p1: window.GALDUR_APP.state.decks.player1[0]?.autoDeckKind,
    p2: window.GALDUR_APP.state.decks.player2[0]?.autoDeckKind
  }));
  expect(kinds.p1).toBe('survivor');
  expect(kinds.p2).toMatch(/^boss:/);
});

test('Auto decks upgrade to real Scryfall cards when the fetch lands', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);
  await openBattleMenu(page, 'boss');
  // applyAutoDeck runs off the difficulty control, generating the fallback
  // deck and scheduling the real-card upgrade.
  await page.locator('.difficultyBtn[data-diff="normal"]').click();
  await page.waitForFunction(
    () => (window.GALDUR_APP.state.decks.player2 || [])[0]?.realCard === true,
    { timeout: 15000 });
  const deck = await page.evaluate(() => ({
    kind: window.GALDUR_APP.state.decks.player2[0].autoDeckKind,
    allImages: window.GALDUR_APP.state.decks.player2.every(c => !!c.imageUrl)
  }));
  expect(deck.kind).toMatch(/^boss:/);
  expect(deck.allImages).toBe(true);
});

test('Strict mana enforces costs, taps lands, and limits land drops', async ({ page }) => {
  // Enforcement is deliberately bot-games-only: human games stay self-enforced.
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#strictManaToggle').check();
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    const p1 = s.gameState.player1;
    const mk = (n, t, cost) => ({ id: n, gameId: n, name: n, type: t, cost,
      colors: [], effect: '', power: 2, toughness: 2, tapped: false, pt: { p: 0, t: 0 }, stun: 0 });
    p1.hand = [mk('Forest A', 'Basic Land — Forest', ''), mk('Forest B', 'Basic Land — Forest', ''),
               mk('Cheap Bear', 'Creature — Bear', '{G}'), mk('Big Wurm', 'Creature — Wurm', '{5}{G}{G}')];
    p1.creatureField = []; p1.supportField = []; p1.landField = [];
    s.landsPlayedThisTurn = 0;
    A.render();
    return p1.hand.map(c => c.name);
  });
  expect(r.length).toBe(4);

  const cards = page.locator('#handContainer .hand-card');
  await cards.nth(0).dblclick();                    // first land: fine
  await page.waitForTimeout(300);
  await page.locator('#handContainer .hand-card').first().dblclick();   // second land: rejected
  await page.waitForTimeout(300);
  let st = await page.evaluate(() => ({
    lands: window.GALDUR_APP.state.gameState.player1.landField.length,
    hand: window.GALDUR_APP.state.gameState.player1.hand.length
  }));
  expect(st.lands).toBe(1);
  expect(st.hand).toBe(3);

  // The 7-mana wurm is unaffordable with one land…
  await page.evaluate(() => { /* Big Wurm is last in hand */ });
  await page.locator('#handContainer .hand-card').nth(2).dblclick();
  await page.waitForTimeout(300);
  st = await page.evaluate(() => ({
    creatures: window.GALDUR_APP.state.gameState.player1.creatureField.length,
    hand: window.GALDUR_APP.state.gameState.player1.hand.length
  }));
  expect(st.creatures).toBe(0);

  // …but the one-mana bear resolves and taps the Forest for it.
  await page.locator('#handContainer .hand-card').nth(1).dblclick();
  await page.waitForTimeout(300);
  st = await page.evaluate(() => {
    const p1 = window.GALDUR_APP.state.gameState.player1;
    return { creatures: p1.creatureField.length, landTapped: p1.landField[0].tapped };
  });
  expect(st.creatures).toBe(1);
  expect(st.landTapped).toBe(true);
});

test('Human games stay self-enforced even with strict mana on', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#strictManaToggle').check();
  await page.locator('#playLocal').click();          // people, not a bot
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    const p1 = s.gameState.player1;
    p1.hand = [{ id: 'w', gameId: 'w', name: 'Big Wurm', type: 'Creature — Wurm', cost: '{5}{G}{G}',
      colors: ['G'], effect: '', power: 7, toughness: 7, tapped: false, pt: { p: 0, t: 0 }, stun: 0 }];
    p1.creatureField = []; p1.supportField = []; p1.landField = [];
    A.render();
  });
  // No lands at all, but a human game must still allow the play.
  await page.locator('#handContainer .hand-card').first().dblclick();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.creatureField.length)).toBe(1);
});

test('Mulligan draws a fresh hand of one fewer', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.hand.length);
  await page.locator('#mulliganBtn').click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.hand.length);
  expect(after).toBe(before - 1);
});

test('Space ends the turn from the keyboard', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.GALDUR_APP.state.activePlayer)).toBe(2);
});



test('The Deck Editor holds both deck building and card design', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.selectedMode = 'casual'; s.battleMode = 'casual';
    s.builderTab = 'deck'; s.screen = 'builder'; A.render();
  });
  await expect(page.locator('h1')).toContainText('Deck Editor');
  await expect(page.locator('#deckContainer')).toBeVisible();

  // The card designer lives behind a tab rather than on its own screen.
  await page.locator('#tabCards').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#cardType')).toBeVisible();
  // Embedded, so it must not bring its own back/logout header.
  expect(await page.evaluate(() => !!document.querySelector('#builderBody .header'))).toBe(false);

  await page.locator('#tabDeck').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#deckContainer')).toBeVisible();
});

test('The battlefield keeps a card exactly where it is dropped', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const pos = await page.evaluate(() => {
    const from = document.querySelector('#handContainer .hand-card');
    const to = document.querySelector('.battle-canvas.mine');
    const box = to.getBoundingClientRect();
    const dt = new DataTransfer();
    const fire = (el, ty, x, y) => el.dispatchEvent(
      new DragEvent(ty, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    fire(from, 'dragstart', 0, 0);
    const x = box.left + box.width * 0.6, y = box.top + box.height * 0.5;
    fire(to, 'dragover', x, y);
    fire(to, 'drop', x, y);
    fire(from, 'dragend', 0, 0);
    const A = window.GALDUR_APP;
    const placed = A.battlefieldCards(A.state.gameState.player1).find(c => c.pos);
    return placed ? placed.pos : null;
  });
  expect(pos).not.toBeNull();
  // Dropped around 60% across, so it should be stored near there — not snapped
  // into a fixed zone.
  expect(pos.x).toBeGreaterThan(40);
  expect(pos.x).toBeLessThan(80);
});



// --- rules engine (bot games only) -----------------------------------------

test('Card text is parsed into anthems, triggers and effects', async ({ page }) => {
  await enter(page);
  const parsed = await page.evaluate(() => {
    const R = window.GALDUR_RULES;
    return {
      anthem: R.parseAnthem({ effect: 'Other creatures you control get +1/+1.' }),
      tribal: R.parseAnthem({ effect: 'Goblins you control get +2/+0.' }),
      notAnthem: R.parseAnthem({ effect: 'Flying, lifelink.' }),
      damage: R.parseEffects('When this enters the battlefield, it deals 3 damage to any target.'),
      token: R.parseEffects('When this enters the battlefield, create a 1/1 white Soldier creature token.'),
      drain: R.parseEffects('When this dies, each opponent loses 2 life.')
    };
  });
  expect(parsed.anthem).toEqual({ othersOnly: true, tribe: null, p: 1, t: 1 });
  expect(parsed.tribal.tribe).toBe('goblin');
  expect(parsed.notAnthem).toBeNull();
  expect(parsed.damage[0]).toMatchObject({ kind: 'damage', n: 3 });
  expect(parsed.token[0]).toMatchObject({ kind: 'token', p: 1, t: 1 });
  expect(parsed.drain[0]).toMatchObject({ kind: 'drain', n: 2 });
});

test('An anthem buffs other creatures but not itself', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const pt = await page.evaluate(() => {
    const A = window.GALDUR_APP, p1 = A.state.gameState.player1;
    const mk = (n, t, pw, tg, e) => A.initBattleCard({ id: n, gameId: n, name: n, type: t,
      cost: '', colors: [], effect: e || '', power: pw, toughness: tg });
    p1.creatureField = [mk('Bear', 'Creature — Bear', 2, 2), mk('Gob', 'Creature — Goblin', 1, 1)];
    p1.supportField = []; p1.landField = [];
    const before = A.effectivePT(p1.creatureField[0]);
    p1.supportField.push(mk('Banner', 'Enchantment', 0, 0, 'Other creatures you control get +1/+1.'));
    return {
      before,
      bear: A.effectivePT(p1.creatureField[0]),
      gob: A.effectivePT(p1.creatureField[1])
    };
  });
  expect(pt.before).toEqual({ p: 2, t: 2 });
  expect(pt.bear).toEqual({ p: 3, t: 3 });
  expect(pt.gob).toEqual({ p: 2, t: 2 });
});

test('An enter trigger resolves when the card is played', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state, p1 = s.gameState.player1;
    p1.creatureField = []; p1.supportField = []; p1.landField = [];
    p1.hand = [A.initBattleCard({ id: 'z', gameId: 'z', name: 'Flame Herald',
      type: 'Creature — Shaman', cost: '', colors: ['R'],
      effect: 'When this enters the battlefield, it deals 3 damage to any target.',
      power: 2, toughness: 2 })];
    const before = s.gameState.player2.health;
    A.render();
    document.querySelector('#handContainer .hand-card')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return { before, after: s.gameState.player2.health };
  });
  expect(result.after).toBe(result.before - 3);
});

test('Rules enforcement never applies to a game between people', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();     // people, not a bot
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state, p1 = s.gameState.player1;
    p1.creatureField = [A.initBattleCard({ id: 'b', gameId: 'b', name: 'Bear',
      type: 'Creature — Bear', cost: '', colors: [], effect: '', power: 2, toughness: 2 })];
    p1.supportField = [A.initBattleCard({ id: 'a', gameId: 'a', name: 'Banner',
      type: 'Enchantment', cost: '', colors: [], effect: 'Other creatures you control get +1/+1.',
      power: 0, toughness: 0 })];
    return { active: window.GALDUR_RULES.active(), bear: A.effectivePT(p1.creatureField[0]) };
  });
  expect(result.active).toBe(false);
  expect(result.bear).toEqual({ p: 2, t: 2 });   // untouched: players adjudicate
});

// --- replays and relay ------------------------------------------------------

test('A game records a scrubable, read-only replay', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);

  for (let i = 0; i < 4; i++) { await page.locator('#drawBtn').click(); await page.waitForTimeout(120); }
  await page.locator('#minusLP').click();
  await page.waitForTimeout(250);

  const data = await page.evaluate(() => {
    const r = window.GALDUR_APP.state.replay;
    return { format: 'galdur-replay-1', mode: r.mode, recordedAt: r.startedAt, frames: r.frames };
  });
  expect(data.frames.length).toBeGreaterThan(3);

  await page.evaluate(d => window.GALDUR_APP.enterReplay(d), data);
  await page.waitForTimeout(400);
  await expect(page.locator('.replay-bar')).toBeVisible();

  // Scrubbing rewinds the board.
  await page.locator('#replayFirst').click();
  await page.waitForTimeout(300);
  const start = await page.evaluate(() => ({
    i: window.GALDUR_APP.state.replayIndex,
    hand: window.GALDUR_APP.state.gameState.player1.hand.length
  }));
  await page.locator('#replayLast').click();
  await page.waitForTimeout(300);
  const end = await page.evaluate(() => ({
    i: window.GALDUR_APP.state.replayIndex,
    hand: window.GALDUR_APP.state.gameState.player1.hand.length
  }));
  expect(start.i).toBe(0);
  expect(end.i).toBe(data.frames.length - 1);
  expect(end.hand).toBeGreaterThan(start.hand);

  // Watching must never mutate the board.
  const before = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.health);
  await page.evaluate(() => window.GALDUR_APP.executeGameAction(
    'probe', {}, () => { window.GALDUR_APP.state.gameState.player1.health = 999; }, 'x'));
  expect(await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.health)).toBe(before);

  await page.locator('#replayExit').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.screen)).toBe('menu');
});

test('Replay frames stay small by storing library counts, not contents', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page, 60);
  await page.locator('#playLocal').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 4; i++) { await page.locator('#drawBtn').click(); await page.waitForTimeout(120); }

  const perFrame = await page.evaluate(() => {
    const r = window.GALDUR_APP.state.replay;
    return JSON.stringify(r.frames).length / r.frames.length;
  });
  expect(perFrame).toBeLessThan(8000);   // full snapshots were ~15KB each

  // ...but the visible counts still survive the round trip.
  const data = await page.evaluate(() => {
    const r = window.GALDUR_APP.state.replay;
    return { format: 'galdur-replay-1', mode: r.mode, recordedAt: r.startedAt, frames: r.frames };
  });
  const liveDeck = await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.deck.length);
  await page.evaluate(d => window.GALDUR_APP.enterReplay(d), data);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.gameState.player1.deck.length)).toBe(liveDeck);
});

test('The relay badge never claims a url the connection would discard', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');

  // Missing scheme: iceServers() drops it, so the UI must not say "configured".
  await page.evaluate(() => document.querySelector('.relay-card')?.setAttribute('open', ''));
  await page.locator('#turnUrls').fill('relay.example.com');
  await page.locator('#saveTurn').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.relay-card .badge')).toHaveText('unusable url');

  await page.evaluate(() => document.querySelector('.relay-card')?.setAttribute('open', ''));
  await page.locator('#turnUrls').fill('turn:relay.example.com:3478');
  await page.locator('#saveTurn').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.relay-card .badge')).toHaveText('configured');
});

test('The LAN-only warning is decided by the shared code itself', async ({ page }) => {
  // Regression: waitForIceGathering's fast path asserted srflx without
  // evidence, and that flag then suppressed the warning regardless of what the
  // SDP actually contained.
  await enter(page);
  await page.evaluate(() => window.GALDUR_APP.createOnlineRoom());
  await page.waitForFunction(
    () => { const s = window.GALDUR_APP.state; return s.roomCode && s.roomCode !== 'waiting'; },
    { timeout: 30000 });

  const agree = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    const sdp = JSON.parse(atob(s.roomCode)).offer.sdp;
    return window.GALDUR_APP.sdpHasPublicCandidate(sdp) === !s.localOnlyCode;
  });
  expect(agree).toBe(true);
});

test('A relay can be configured, persisted and honestly tested', async ({ page }) => {
  await enter(page);
  await openBattleMenu(page, 'casual');
  await page.evaluate(() => document.querySelector('.relay-card')?.setAttribute('open', ''));
  await page.locator('#turnUrls').fill('turn:relay.invalid:3478');
  await page.locator('#turnUser').fill('u');
  await page.locator('#turnPass').fill('p');
  await page.locator('#saveTurn').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.turnServer.urls)).toBe('turn:relay.invalid:3478');

  // An unreachable relay must report failure rather than quietly "succeeding".
  await page.evaluate(() => document.querySelector('.relay-card')?.setAttribute('open', ''));
  await page.locator('#testTurn').click();
  await page.waitForFunction(
    () => { const t = document.querySelector('#turnStatus'); return t && t.textContent && !/Testing/.test(t.textContent); },
    { timeout: 20000 });
  expect(await page.locator('#turnStatus').textContent()).toContain('No relay candidate');

  // Hosting still works — STUN carries it when the relay does not answer.
  await page.evaluate(() => window.GALDUR_APP.createOnlineRoom());
  await page.waitForFunction(
    () => { const s = window.GALDUR_APP.state; return s.roomCode && s.roomCode !== 'waiting'; },
    { timeout: 30000 });
  expect(await page.evaluate(() => window.GALDUR_APP.state.localOnlyCode)).toBe(false);
});

// --- online connection ------------------------------------------------------

test('The shared code contains an internet-routable STUN candidate', async ({ page }) => {
  // Regression: ICE gathering was once cut off on a 4s timer, which shipped
  // codes containing only LAN host candidates — they worked on one Wi-Fi and
  // nowhere else. Gathering must not finish before STUN has answered.
  await enter(page);
  await page.evaluate(() => window.GALDUR_APP.createOnlineRoom());
  await page.waitForFunction(
    () => { const s = window.GALDUR_APP.state; return s.roomCode && s.roomCode !== 'waiting'; },
    { timeout: 30000 });

  const info = await page.evaluate(() => {
    const s = window.GALDUR_APP.state;
    const sdp = JSON.parse(atob(s.roomCode)).offer.sdp;
    return { public: window.GALDUR_APP.sdpHasPublicCandidate(sdp), localOnly: s.localOnlyCode };
  });
  expect(info.public).toBe(true);
  expect(info.localOnly).toBe(false);
});

test('Two peers complete the handshake and sync game state', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const joiner = await (await browser.newContext()).newPage();
  const boot = async (pg) => {
    await pg.goto('/index.html');
    await pg.waitForTimeout(250);
    await pg.locator('#enterApp').click();
    await pg.evaluate(() => {
      const A = window.GALDUR_APP, s = A.state;
      s.selectedMode = 'casual'; s.battleMode = 'casual';
      const deck = (n) => Array.from({ length: 40 }, (_, i) => ({
        id: n + i, name: 'Bear ' + i, type: 'Creature — Bear', cost: '{1}{G}',
        colors: ['G'], effect: '', power: 2, toughness: 2 }));
      s.decks.player1 = deck('p1'); s.decks.player2 = deck('p2');
      s.screen = 'game'; A.render();
    });
  };
  await boot(host); await boot(joiner);

  await host.evaluate(() => window.GALDUR_APP.createOnlineRoom());
  await host.waitForFunction(
    () => { const s = window.GALDUR_APP.state; return s.roomCode && s.roomCode !== 'waiting'; },
    { timeout: 30000 });
  const offer = await host.evaluate(() => window.GALDUR_APP.state.roomCode);

  await joiner.evaluate(code => window.GALDUR_APP.joinOnlineRoom(code), offer);
  await joiner.waitForFunction(() => !!window.GALDUR_APP.state.answerCode, { timeout: 30000 });
  const answer = await joiner.evaluate(() => window.GALDUR_APP.state.answerCode);

  await host.evaluate(code => window.GALDUR_APP.completeConnection(code), answer);
  await host.waitForFunction(
    () => window.GALDUR_APP.state.dataChannel?.readyState === 'open', { timeout: 30000 });
  await joiner.waitForFunction(
    () => window.GALDUR_APP.state.dataChannel?.readyState === 'open', { timeout: 20000 });

  // The host dealing the game must reach the joiner over the channel.
  await host.evaluate(() => document.querySelector('#startBtn')?.click());
  await joiner.waitForFunction(() => window.GALDUR_APP.state.gameStarted === true, { timeout: 20000 });
  expect(await joiner.evaluate(() => window.GALDUR_APP.state.gameState.player2.hand.length)).toBe(7);

  await host.close(); await joiner.close();
});


test('Two peers who each built into their own slot both see two decks', async ({ browser }) => {
  // Regression: everyone builds into decks.player1 locally, so a deckSync that
  // filed the payload by slot name left both sides thinking the opponent had
  // no deck ("Both players need decks to start").
  const host = await (await browser.newContext()).newPage();
  const joiner = await (await browser.newContext()).newPage();
  const boot = async (pg, label) => {
    await pg.goto('/index.html');
    await pg.waitForTimeout(250);
    await pg.locator('#enterApp').click();
    await pg.evaluate((name) => {
      const A = window.GALDUR_APP, s = A.state;
      s.selectedMode = 'casual'; s.battleMode = 'casual';
      s.decks.player1 = Array.from({ length: 40 }, (_, i) => ({
        id: name + i, name: `${name} card ${i}`, type: 'Creature — Bear',
        cost: '{1}{G}', colors: ['G'], effect: '', power: 2, toughness: 2 }));
      s.decks.player2 = [];              // nothing in the opponent slot
      s.screen = 'game'; A.render();
    }, label);
  };
  await boot(host, 'HOSTDECK');
  await boot(joiner, 'JOINDECK');

  await host.evaluate(() => window.GALDUR_APP.createOnlineRoom());
  await host.waitForFunction(
    () => { const s = window.GALDUR_APP.state; return s.roomCode && s.roomCode !== 'waiting'; },
    { timeout: 30000 });
  const offer = await host.evaluate(() => window.GALDUR_APP.state.roomCode);
  await joiner.evaluate(c => window.GALDUR_APP.joinOnlineRoom(c), offer);
  await joiner.waitForFunction(() => !!window.GALDUR_APP.state.answerCode, { timeout: 30000 });
  const answer = await joiner.evaluate(() => window.GALDUR_APP.state.answerCode);
  await host.evaluate(c => window.GALDUR_APP.completeConnection(c), answer);

  // Both sides must end up holding both decks, each under the right seat.
  const bothDecks = () => {
    const s = window.GALDUR_APP.state;
    return s.decks.player1.length > 0 && s.decks.player2.length > 0;
  };
  await host.waitForFunction(bothDecks, { timeout: 30000 });
  await joiner.waitForFunction(bothDecks, { timeout: 30000 });

  const seats = await host.evaluate(() => ({
    p1: window.GALDUR_APP.state.decks.player1[0].name,
    p2: window.GALDUR_APP.state.decks.player2[0].name
  }));
  expect(seats.p1).toContain('HOSTDECK');
  expect(seats.p2).toContain('JOINDECK');
  // The joiner's own deck followed them to seat 2.
  expect(await joiner.evaluate(() => window.GALDUR_APP.state.currentPlayer)).toBe(2);
  expect(await joiner.evaluate(() => window.GALDUR_APP.state.decks.player2[0].name)).toContain('JOINDECK');

  await host.close(); await joiner.close();
});

test('Decks can be saved to and loaded from the library', async ({ page }) => {
  await enter(page);
  await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    s.currentPlayer = 1;
    s.selectedMode = 'casual'; s.battleMode = 'casual';
    s.decks.player1 = Array.from({ length: 30 }, (_, i) => ({
      id: 'c' + i, name: 'Card ' + i, type: 'Creature — Bear', cost: '{G}',
      colors: ['G'], effect: '', power: 2, toughness: 2 }));
    s.screen = 'builder'; A.render();
  });
  await page.locator('#deckNameInput').fill('Green Stompy');
  await page.locator('#saveDeckToLib').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.deckLibrary.length)).toBe(1);

  // Clearing the working deck and loading the saved one restores it.
  await page.evaluate(() => { window.GALDUR_APP.state.decks.player1 = []; window.GALDUR_APP.render(); });
  await page.locator('.libLoad').first().click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GALDUR_APP.state.decks.player1.length)).toBe(30);

  // And it survives a reload, since the library is persisted.
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForTimeout(900);
  const lib = await page.evaluate(() => window.GALDUR_APP.state.deckLibrary.map(d => d.name));
  expect(lib).toEqual(['Green Stompy']);
});

// --- battlefield zone layout -----------------------------------------------

test('Cards auto-route to the right battlefield zone', async ({ page }) => {
  await enter(page);
  const routed = await page.evaluate(() => {
    const z = window.GALDUR_APP.defaultZoneForCard;
    return {
      creature: z({ type: 'Creature — Bear' }),
      planeswalker: z({ type: 'Legendary Planeswalker — Jace' }),
      land: z({ type: 'Basic Land — Forest' }),
      enchantment: z({ type: 'Enchantment' }),
      artifact: z({ type: 'Artifact' }),
      // A mana rock belongs with the lands, per the table layout.
      manaRock: z({ type: 'Artifact', effect: '{T}: Add {C}{C}.' }),
      artifactCreature: z({ type: 'Artifact Creature — Golem' })
    };
  });
  expect(routed).toEqual({
    creature: 'creatureField',
    planeswalker: 'creatureField',
    land: 'landField',
    enchantment: 'supportField',
    artifact: 'supportField',
    manaRock: 'landField',
    artifactCreature: 'creatureField'
  });
});

test('The board renders both halves with all zones and pile counts', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);
  await openBattleMenu(page, 'commander');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(600);

  // One open battlefield canvas per player, plus four piles each
  // (command/library/graveyard/exile).
  await expect(page.locator('.battle-half')).toHaveCount(2);
  await expect(page.locator('.battle-canvas')).toHaveCount(2);
  await expect(page.locator('.battle-half.you [data-drop-target="canvas"]')).toHaveCount(1);
  await expect(page.locator('#viewCommander')).toBeVisible();
  await expect(page.locator('#viewGY .pile-count')).toHaveText('0');

  // The opponent's library is hidden information, so it is not clickable.
  await expect(page.locator('.battle-half.opponent .battle-zone.pile.is-static')).toHaveCount(1);
});

test('Legacy upper/lower board state migrates into the new zones', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);
  await openBattleMenu(page, 'casual');
  await seedDecks(page);
  await page.locator('#playAI').click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(500);

  // Simulate a snapshot from the previous layout (or an older peer).
  const zones = await page.evaluate(() => {
    const A = window.GALDUR_APP, s = A.state;
    const p = s.gameState.player1;
    delete p.creatureField; delete p.supportField; delete p.landField;
    p.upperField = [{ id: 'c1', name: 'Bear', type: 'Creature — Bear', power: 2, toughness: 2 }];
    p.lowerField = [
      { id: 'l1', name: 'Forest', type: 'Basic Land — Forest' },
      { id: 'e1', name: 'Sigil', type: 'Enchantment' }
    ];
    A.render();
    return {
      creatures: p.creatureField.map(c => c.name),
      support: p.supportField.map(c => c.name),
      lands: p.landField.map(c => c.name),
      legacyGone: !('upperField' in p) && !('lowerField' in p)
    };
  });
  expect(zones).toEqual({
    creatures: ['Bear'], support: ['Sigil'], lands: ['Forest'], legacyGone: true
  });
});

test('The land picker offers printings and applies the chosen art', async ({ page }) => {
  await stubScryfall(page);
  await enter(page);

  await page.locator('#chooseLands').click();
  await page.waitForFunction(
    () => window.GALDUR_APP.state.landPicker && !window.GALDUR_APP.state.landPicker.loading,
    { timeout: 20000 });

  await expect(page.locator('.landArtChoice').first()).toBeVisible();
  await page.locator('.landArtChoice').first().click();

  const applied = await page.evaluate(() => {
    const A = window.GALDUR_APP;
    const chosen = A.state.landArt.Plains;
    const card = A.makeBasicLandCard('Plains', 0, 'test');
    return { chosen: !!chosen, cardUrl: card.imageUrl, chosenUrl: chosen && chosen.imageUrl };
  });
  expect(applied.chosen).toBe(true);
  // The card carries the chosen printing, not the rate-limited named redirect.
  expect(applied.cardUrl).toBe(applied.chosenUrl);
  expect(applied.cardUrl).not.toContain('/cards/named');
});
