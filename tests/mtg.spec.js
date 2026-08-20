import { expect, test } from '@playwright/test';

async function login(page, player = 1) {
  await page.goto('/index.html');
  await page.waitForTimeout(250);
  await page.locator('#enterApp').click();
  if (player === 2) {
    await page.locator('#menuPlayer2').click();
  }
}

// Playwright's dragTo synthesises mouse movement, which HTML5 drag-and-drop
// picks up only intermittently — this test used to fail well over half the time
// for that reason alone. Dispatching the real drag events with one shared
// DataTransfer exercises the app's own handlers deterministically.
async function dragCard(page, fromSelector, toSelector) {
  await page.evaluate(([fromSel, toSel]) => {
    const from = document.querySelector(fromSel);
    const to = document.querySelector(toSel);
    if (!from || !to) throw new Error(`drag failed: ${!from ? fromSel : toSel} not found`);
    const dataTransfer = new DataTransfer();
    const fire = (el, type) => el.dispatchEvent(
      new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }));
    fire(from, 'dragstart');
    fire(to, 'dragover');
    fire(to, 'drop');
    fire(from, 'dragend');
  }, [fromSelector, toSelector]);
}

// The auto-deck builders fetch real cards; stub Scryfall so these tests are
// deterministic and do not depend on the live API (or its rate limits).
async function stubScryfall(page, count = 60) {
  await page.route('**://api.scryfall.com/**', async route => {
    const url = route.request().url();
    const card = (n) => ({
      id: 'stub-' + n, name: 'Stub Card ' + n,
      type_line: n % 5 === 0 ? 'Basic Land — Forest' : 'Creature — Test',
      mana_cost: n % 5 === 0 ? '' : '{1}{G}', cmc: 2, colors: ['G'],
      oracle_text: 'Test.', power: '2', toughness: '2', rarity: 'common',
      set: 'tst', set_name: 'Test Set', artist: 'Tester',
      image_uris: { normal: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E' }
    });
    if (url.includes('/cards/search')) {
      const data = Array.from({ length: count }, (_, i) => card(i + 1));
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ object: 'list', total_cards: data.length, has_more: false, data }) });
    }
    if (url.includes('/cards/named') || url.includes('/cards/random')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(card(1)) });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
}

async function openModeStudio(page, modeName) {
  await page.locator('#chooseMode').click();
  await page.locator('.mode-card', { has: page.getByRole('heading', { name: modeName }) })
    .getByRole('button', { name: 'Open Studio' })
    .click();
}

function seededCommanderDeck(owner) {
  const commander = {
    id: `${owner}-commander`,
    name: 'Test Commander',
    type: 'Legendary Creature - Wizard',
    cost: '{2}{U}',
    colors: ['U'],
    effect: 'Commander candidate.',
    power: 3,
    toughness: 3,
    rarity: 'mythic',
    imageUrl: ''
  };
  const lands = Array.from({ length: 99 }, (_, i) => ({
    id: `${owner}-island-${i}`,
    name: 'Island',
    type: 'Basic Land - Island',
    cost: '',
    colors: ['U'],
    effect: '',
    power: 0,
    toughness: 0,
    rarity: 'common',
    imageUrl: ''
  }));
  return [commander, ...lands];
}

function brokenImageDeck(owner) {
  return Array.from({ length: 60 }, (_, i) => ({
    id: `${owner}-broken-image-${i}`,
    name: `Fallback Test Card ${i + 1}`,
    type: 'Creature',
    cost: '{1}',
    colors: [],
    effect: 'Uses fallback art when its remote image is unavailable.',
    power: 1,
    toughness: 1,
    rarity: 'common',
    imageUrl: '/missing-card-image.png'
  }));
}

test('MTG mode hub and Land Game startup work', async ({ page }) => {
  await login(page, 1);

  await page.locator('#chooseMode').click();
  await expect(page.getByText('Choose Mode')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Commander' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oathbreaker' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Brawl' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pauper Draft' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jumpstart' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Winston Draft' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Basic Land Game' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dandan' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Horde Magic' })).toBeVisible();

  const commanderCard = page.locator('[data-mode-id="commander"]');
  const dandanCard = page.locator('[data-mode-id="dandan"]');
  await page.locator('#modeSearch').fill('dandan');
  await expect(dandanCard).toBeVisible();
  await expect(commanderCard).toBeHidden();
  await expect(page.locator('#modeCount')).toHaveText(/1\/\d+/);
  await page.locator('#modeSearch').fill('');
  await page.getByRole('button', { name: 'Community' }).click();
  await expect(dandanCard).toBeVisible();
  await expect(commanderCard).toBeHidden();
  await page.getByRole('button', { name: 'All' }).click();
  await expect(commanderCard).toBeVisible();

  await page.locator('.mode-card', { has: page.getByRole('heading', { name: 'Basic Land Game' }) }).getByRole('button', { name: 'Open Studio' }).click();
  await expect(page.getByText('Basic Land Game Studio')).toBeVisible();
  await expect(page.getByText('Decks are 10 of each basic land')).toBeVisible();

  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.locator('.turn-pill')).toHaveText('Your turn');
  await expect(page.getByText(/You - LP: 20/)).toBeVisible();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(5);
  await expect(page.locator('#mulliganBtn')).toBeDisabled();
  await expect(page.getByText(/Goal: control all five basic land names/)).toBeVisible();

  await page.locator('#handContainer .hand-card').first().click();
  // Lands auto-route to the Lands & Rocks zone in the back row.
  await page.getByRole('button', { name: /Play to Lands & Rocks/ }).click();
  await expect(page.getByText(/Your lands:/)).toBeVisible();
  await page.locator('.battle-half.you .canvas-card').first().click();
  await expect(page.getByText('Basic Land Game effect')).toBeVisible();
});

test('Battlefield stack and phase controls work', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Basic Land Game');
  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.locator('#minusLP').click();
  await expect(page.getByText(/You - LP: 19/)).toBeVisible();
  await page.locator('#undoAction').click();
  await expect(page.getByText(/You - LP: 20/)).toBeVisible();
  await expect(page.locator('#actionLog').getByText('Undid life_change.')).toBeVisible();

  await page.locator('#endTurn').click();
  await expect(page.locator('.turn-pill')).toHaveText(/Opponent's turn|Bot's turn/);
  await page.locator('#undoAction').click();
  await expect(page.locator('.turn-pill')).toHaveText('Your turn');
  await expect(page.locator('#actionLog').getByText('Undid end_turn.')).toBeVisible();

  await expect(page.getByText('Stack empty')).toBeVisible();
  await page.locator('#nextPhase').click();
  await expect(page.locator('#actionLog').getByText('Phase: Combat.')).toBeVisible();

  await page.locator('#handContainer .hand-card').first().click();
  await page.getByRole('button', { name: 'Cast to Stack' }).click();
  await expect(page.locator('#stackPanel').getByText(/Player 1/)).toBeVisible();
  await expect(page.locator('#actionLog').getByText(/Player 1 cast .* to the stack/)).toBeVisible();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(4);

  await page.locator('#resolveStackTop').click();
  await expect(page.getByText('Stack empty')).toBeVisible();
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(1);
  await expect(page.locator('#actionLog').getByText(/Resolved/)).toBeVisible();
});

test('Drawn cards recover when their image URL fails', async ({ page }) => {
  await page.addInitScript((saved) => {
    localStorage.setItem('galdur-save-v1', JSON.stringify(saved));
  }, {
    cards: [],
    decks: {
      player1: brokenImageDeck('p1'),
      player2: brokenImageDeck('p2')
    }
  });
  await login(page, 1);

  await openModeStudio(page, 'Casual Custom');
  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  // 60-card deck minus the 7-card opening hand.
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(53\)/);
  await page.locator('#drawBtn').click();

  const drawnImage = page.locator('#handContainer .hand-card img').first();
  await expect(drawnImage).toBeVisible();
  await expect.poll(async () => drawnImage.getAttribute('data-fallback-stage')).toMatch(/[12]/);
  await expect.poll(async () => (
    await drawnImage.evaluate((el) => getComputedStyle(el).backgroundImage)
  )).toContain('data:image/svg+xml');
  await expect(drawnImage).not.toHaveAttribute('src', /missing-card-image/);
});

test('Battlefield drag-and-drop moves cards between zones', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Basic Land Game');
  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await dragCard(page, '#handContainer .hand-card', '.battle-half.you [data-drop-target="canvas"]');
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(4);
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(1);
  // Dropping on the open battlefield plays the card where it landed.
  await expect(page.locator('#actionLog').getByText(/Played /)).toBeVisible();
  await expect(page.locator('#undoAction')).toBeEnabled();

  await page.locator('#undoAction').click();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(5);
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(0);
  // Playing onto the open field is a hand_to_field action, not a zone move.
  await expect(page.locator('#actionLog').getByText('Undid hand_to_field.')).toBeVisible();

  await dragCard(page, '#handContainer .hand-card', '.battle-half.you [data-drop-target="canvas"]');
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(4);
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(1);

  await dragCard(page, '.battle-half.you .canvas-card', '#graveyardDrop');
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(0);
  await expect(page.locator('#viewGY .pile-count')).toHaveText('1');
  await expect(page.locator('#actionLog').getByText(/Moved .* to Graveyard/)).toBeVisible();

  await page.locator('#viewGY').click();
  await page.locator('#zoneCards .zone-card').first().click();
  await page.locator('#zoneToHand').click();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(5);
  await expect(page.locator('#viewGY .pile-count')).toHaveText('0');
  await page.locator('#undoAction').click();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(4);
  await expect(page.locator('#viewGY .pile-count')).toHaveText('1');
  await expect(page.locator('#actionLog').getByText('Undid zone_move.')).toBeVisible();

  await dragCard(page, '#handContainer .hand-card', '#stackPanel');
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(3);
  await expect(page.locator('#stackPanel').getByText(/Player 1/)).toBeVisible();
  await expect(page.locator('#actionLog').getByText(/Moved .* to Stack/)).toBeVisible();
});

test('Battlefield token creation can be undone', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Basic Land Game');
  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.locator('#createToken').click();
  await page.locator('#tokenName').fill('Practice Token');
  await page.locator('#createTokenUpper').click();
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(1);
  await expect(page.locator('#actionLog').getByText('Created Practice Token in Creatures.')).toBeVisible();

  await page.locator('#undoAction').click();
  await expect(page.locator('.battle-half.you .canvas-card')).toHaveCount(0);
  await expect(page.locator('#actionLog').getByText('Undid create_token.')).toBeVisible();
});

test('Commander mode seeds commander candidates into the command zone', async ({ page }) => {
  await page.addInitScript((saved) => {
    localStorage.setItem('galdur-save-v1', JSON.stringify(saved));
  }, {
    cards: [],
    decks: {
      player1: seededCommanderDeck('p1'),
      player2: seededCommanderDeck('p2')
    }
  });
  await login(page, 1);

  await openModeStudio(page, 'Commander');
  await expect(page.locator('#studioP1Validation')).toContainText('Ready');
  await expect(page.locator('#studioP2Validation')).toContainText('Ready');

  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('#viewCommander .pile-count')).toHaveText('1');
  // 100 cards, one seeded to the command zone, minus the 7-card opening hand.
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(92\)/);
});

test('Jumpstart packet mixer builds a 40-card deck', async ({ page }) => {
  await stubScryfall(page);
  await login(page, 1);

  await openModeStudio(page, 'Jumpstart');
  await page.getByRole('button', { name: 'Build' }).click();
  await page.locator('#studioOpenBuilder').click();
  await expect(page.getByText('Jumpstart Packet Mixer')).toBeVisible();
  await expect(page.locator('#deckValidation')).toContainText('Needs work');

  await page.locator('#buildJumpstart').click();
  await expect(page.locator('#deckValidation')).toContainText('Ready');
  await expect(page.getByText('Decklist [40]')).toBeVisible();
  await expect(page.locator('#deckContainer .deck-card')).toHaveCount(40);
});

test('Winston Draft starts from the generated pool and advances piles', async ({ page }) => {
  await stubScryfall(page, 120);
  await login(page, 1);

  await openModeStudio(page, 'Winston Draft');
  await page.getByRole('button', { name: 'Draft' }).click();
  await page.locator('#studioStartDraft').click();
  await expect(page.getByText('Winston Draft Setup')).toBeVisible();

  await page.locator('#useStarterPool').click();
  await expect(page.getByText('Winston Draft • Player 1')).toBeVisible();
  await expect(page.locator('#takeWinstonPile')).toBeVisible();
  await expect(page.locator('#skipWinstonPile')).toBeVisible();

  await page.locator('#skipWinstonPile').click();
  await expect(page.getByText('Inspecting Pile 2')).toBeVisible();
  await page.locator('#takeWinstonPile').click();
  await expect(page.getByText('Winston Draft • Player 2')).toBeVisible();
});

test('Cube uses a shared center stack and draws from it', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Cube / Center Stack');
  await page.getByRole('button', { name: 'Build' }).click();
  await page.locator('#studioStarterCube').click();
  await expect(page.locator('#studioBuildValidation')).toContainText('Ready');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText(/Cube Stack will use your deck as one center stack/)).toBeVisible();
  await expect(page.locator('#studioSharedValidation')).toContainText('Ready');

  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText(/Cube Stack center stack/)).toBeVisible();
  // Shared stack: both players draw their opening hand from it (90 - 14).
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(76\)/);
  await expect(page.getByText('Action Log')).toBeVisible();

  await page.locator('#revealSharedTop').click();
  await expect(page.locator('#actionLog').getByText(/Cube Stack top card:/)).toBeVisible();

  await page.locator('#burnSharedTop').click();
  await expect(page.locator('#actionLog').getByText(/Burned .* from Cube Stack/)).toBeVisible();
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(75\)/);
  await expect(page.locator('#viewSharedGY')).toHaveText(/Shared GY \(1\)/);

  await page.locator('#shuffleSharedStack').click();
  await expect(page.locator('#actionLog').getByText('Cube Stack shuffled.')).toBeVisible();

  await page.locator('#drawBtn').click();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(8);
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(74\)/);
  await expect(page.locator('#actionLog').getByText(/Player 1 drew from Cube Stack/)).toBeVisible();
});

test('Dandan quick-start builds a shared library and draws from it', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Dandan');
  await page.getByRole('button', { name: 'Build' }).click();
  await page.locator('#studioStarterDandan').click();
  await expect(page.locator('#studioBuildValidation')).toContainText('Ready');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText(/Dandan Library will use your deck as one center stack/)).toBeVisible();
  await expect(page.locator('#studioSharedValidation')).toContainText('Ready');

  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByText(/Dandan Library center stack/)).toBeVisible();
  // Shared stack: both players draw their opening hand from it (80 - 14).
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(66\)/);

  await page.locator('#drawBtn').click();
  await expect(page.locator('#handContainer .hand-card')).toHaveCount(8);
  await expect(page.locator('#drawBtn')).toHaveText(/Draw \(65\)/);
  await expect(page.locator('#actionLog').getByText(/Player 1 drew from Dandan Library/)).toBeVisible();
});

test('Mode Studio saves and restores tailored mode setups', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Dandan');
  await page.getByRole('button', { name: 'Build' }).click();
  await page.locator('#studioStarterDandan').click();
  await expect(page.locator('#studioBuildValidation')).toContainText('Ready');

  await page.locator('#setupName').fill('Dandan Night');
  await page.locator('#saveSetup').click();
  await expect(page.locator('#setupSelect')).toBeEnabled();
  await expect(page.locator('#setupSelect')).toContainText('Dandan Night');

  await page.locator('#studioMenu').click();
  await expect(page.getByText('Deck Playlists')).toBeVisible();
  await expect(page.locator('.playlist-title', { hasText: 'Dandan Night' })).toBeVisible();
  await page.locator('[data-open-playlist][data-mode="dandan"]').first().click();
  await expect(page.getByText('Dandan Studio')).toBeVisible();

  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const key = 'galdur-save-v1';
    const saved = JSON.parse(localStorage.getItem(key));
    saved.decks = { player1: [], player2: [] };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await login(page, 1);

  await openModeStudio(page, 'Dandan');
  await page.getByRole('button', { name: 'Build' }).click();
  await expect(page.locator('#studioBuildValidation')).toContainText('Needs work');
  const setupValue = await page.locator('#setupSelect option', { hasText: 'Dandan Night' }).getAttribute('value');
  await page.locator('#setupSelect').selectOption(setupValue);
  await page.locator('#loadSetup').click();

  await expect(page.locator('#studioBuildValidation')).toContainText('Ready');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText(/Dandan Library will use your deck as one center stack \(80 cards\)/)).toBeVisible();
});

test('Horde Magic auto-decks and exposes reveal controls', async ({ page }) => {
  await login(page, 1);

  await openModeStudio(page, 'Horde Magic');
  await expect(page.getByText('Player 2 is the automated Horde deck')).toBeVisible();

  await page.getByLabel('Play Local').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('#hordeReveal')).toBeVisible();
  await expect(page.locator('#hordeAttack')).toBeVisible();

  await page.locator('#hordeReveal').click();
  await expect(page.locator('#actionLog').getByText(/Horde reveal:/)).toBeVisible();
});
