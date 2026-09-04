(function(){
'use strict';

const state = {
  screen: 'login',
  currentPlayer: null,
  cards: [],
  scryfallCards: [],
  searchResults: [],
  isLoadingScryfallCards: false,
  decks: { player1: [], player2: [] },
  modeSetups: {},
  selectedMode: 'casual',
  modeIntent: 'all',
  modeQuery: '',
  modeFamily: 'all',
  battleMode: 'casual',
  studioTab: 'play',
  editingCard: null,
  activePlayer: 1,
  gameState: {
    player1: { hand: [], creatureField: [], supportField: [], landField: [], graveyard: [], exile: [], commanderZone: [], deck: [], health: 20 },
    player2: { hand: [], creatureField: [], supportField: [], landField: [], graveyard: [], exile: [], commanderZone: [], deck: [], health: 20 },
    shared: { enabled: false, label: '', deck: [], graveyard: [], exile: [] },
    stack: [],
    phase: 'Main',
    mode: 'casual'
  },
  gameStarted: false,
  winner: null,
  selectedCard: null,
  selectedFieldCard: null,
  selectedZoneCard: null,
  hoveredCard: null,
  viewingZone: null,
  creatingToken: false,
  targeting: null,
  gameLog: [],
  gameHistory: [],
  onlineMode: false,
  vsAI: false,               // local game where the computer plays player 2
  coop: false,               // two humans share the player-1 board vs the AI
  declaringAttack: false,    // attacker-selection modal is open
  attackSelection: [],       // ids chosen in that modal
  coopSeat: 1,               // which teammate currently holds the device
  aiDifficulty: 'normal',    // 'easy' | 'normal' | 'hard'
  strictMana: false,         // enforce paying costs by tapping lands (bot games)
  builderTab: 'deck',        // Deck Editor section: 'deck' | 'cards'
  embedCreator: false,       // CardCreator rendered inside the Deck Editor
  handZoom: 1,               // hand card scale, 0.7 - 1.8
  handCollapsed: false,      // hand tray peeked shut
  showShortcuts: false,      // keyboard legend open
  turnCount: 1,              // turns taken this game
  layout: null,              // { oppPct, sidebarPx } board split, from localStorage
  landsPlayedThisTurn: 0,    // strict mode: one land per turn
  aiActing: false,           // the bot is visibly taking its turn
  deckLibrary: [],           // named saved decks: { id, name, modeId, cards, savedAt }
  landArt: {},               // chosen basic-land printing per land name
  landPicker: null,          // { land, printings, loading } while the picker is open
  bossRound: 0,
  connectionStatus: '',
  turnServer: null,          // optional { urls, username, credential } relay
  candidateSummary: '',      // what the generated code can reach
  replay: null,              // { frames, mode, startedAt } while playing
  replayMode: false,         // watching a replay (board is read-only)
  replayData: null,
  replayIndex: 0,
  replayPlaying: null,       // interval handle while auto-playing
  localOnlyCode: false,      // the generated code carries no public address
  leavingOnline: false,
  peerConnection: null,
  dataChannel: null,
  roomCode: null,
  isHost: false,
  waitingForAnswer: false,
  answerCode: null,
  showTurnNotification: false, 
  actionMessage: null,   // NEW: transient action overlay (e.g., draws)
  draft: {
  active: false,
  // NEW: first screen is a mode selector
  screen: 'mode',               // 'mode' | 'setup' | 'custom-setup' | 'colors' | 'lands' | 'picks' | 'done'
  // NEW: which draft engine to use
  mode: 'traditional',          // 'traditional' | 'custom'

  // shared
  format: 'standard',           // 'standard' | 'modern' | 'commander'
  modeId: 'standard-draft',
  rarity: '',
  setCode: '',
  era: '',
  queryExtra: '',
  target: 60,
  allowDuplicates: true,

  // color flow
  offeredColorSets: [],         // arrays like ['U'], ['U','R'], ['W','U','B']
  chosenColors: [],
  basicLands: { W:0, U:0, B:0, R:0, G:0 },

  // live draft state
  picks: 0,
  pool: [],                     // current 3 shown
  deck: [],                     // chosen cards

  // NEW: dedupe memory across the whole draft
  seenIds: {},
  seenNames: {},

  // NEW: custom draft inputs
  customPool: [],               // array of card objects (your export format)
  customParams: {
    filterByColors: true        // only offer cards within chosen colors
    // (you can extend later: artifactChance, rareEvery, etc.)
  },
  
    // --- Draft-off (two-player online draft) state ---
  off: {
    screen: 'setup',       // 'setup' | 'room'
    round: 0,
    startingPlayer: 1,     // alternates each round: 1 ↔ 2
    currentPicker: 1,      // whose turn to pick now (1 or 2)
    currentSet: null,      // e.g., 'khm'
    table: [],             // current 15 cards on the field
    p1: [],                // picks by player 1
 p2: [],                // picks by player 2
 isLocal: false,          // local (hotseat) flag
  // New per-pack settings for 9-card micro-packs:
  packSize: 9,
  picksPerPlayerPerPack: 3,
  picksMadeThisPack: 0
  },

  winston: {
    pool: [],
    piles: [[], [], []],
    p1: [],
    p2: [],
    activePlayer: 1,
    currentPile: 0,
    log: []
  },
  
}

};

const MODE_DATA = window.GALDUR_MODE_DATA;
if (!MODE_DATA) throw new Error('modes.js must load before app.js');
const { BASIC_LAND_NAMES, TURN_PHASES, MTG_MODE_LIBRARY, JUMPSTART_THEMES } = MODE_DATA;

function makeId(prefix){
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function shuffleCopy(arr){
  const out = (arr || []).slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function htmlEscape(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function getModeConfig(id){
  return MTG_MODE_LIBRARY.find(m => m.id === id) || MTG_MODE_LIBRARY[0];
}

function currentModeConfig(){
  return getModeConfig(state.battleMode || state.selectedMode || 'casual');
}

function freshWinstonState(){
  return {
    pool: [],
    piles: [[], [], []],
    p1: [],
    p2: [],
    activePlayer: 1,
    currentPile: 0,
    log: []
  };
}

function freshDraftOffState(){
  return {
    screen: 'setup',
    round: 0,
    startingPlayer: 1,
    currentPicker: 1,
    currentSet: null,
    table: [],
    p1: [],
    p2: [],
    isLocal: false,
    packSize: 9,
    picksPerPlayerPerPack: 3,
    picksMadeThisPack: 0,
    p1LandsDone: false,
    p2LandsDone: false
  };
}

function currentModeId(){
  return state.battleMode || state.selectedMode || 'casual';
}

function defaultSetupName(mode){
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${mode.title} Setup ${stamp}`;
}

function cloneCards(cards){
  return cloneJSON(cards || []);
}

function modeSetupList(modeId = currentModeId()){
  return (state.modeSetups && Array.isArray(state.modeSetups[modeId])) ? state.modeSetups[modeId] : [];
}

function captureModeSetup(modeOrId = currentModeConfig(), name = ''){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : (modeOrId || currentModeConfig());
  const setupName = (name || defaultSetupName(mode)).trim();
  return {
    id: makeId('setup'),
    name: setupName,
    modeId: mode.id,
    savedAt: Date.now(),
    decks: {
      player1: cloneCards(state.decks.player1),
      player2: cloneCards(state.decks.player2)
    }
  };
}

function saveModeSetup(modeOrId = currentModeConfig(), name = ''){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : (modeOrId || currentModeConfig());
  state.modeSetups = state.modeSetups || {};
  const setup = captureModeSetup(mode, name);
  const list = modeSetupList(mode.id).filter(existing => existing.name !== setup.name);
  list.unshift(setup);
  state.modeSetups[mode.id] = list.slice(0, 12);
  saveLocal();
  return setup;
}

function loadModeSetup(modeId, setupId){
  const setup = modeSetupList(modeId).find(item => item.id === setupId);
  if (!setup) return null;
  state.decks.player1 = cloneCards(setup.decks?.player1);
  state.decks.player2 = cloneCards(setup.decks?.player2);
  return setup;
}

function deleteModeSetup(modeId, setupId){
  state.modeSetups = state.modeSetups || {};
  state.modeSetups[modeId] = modeSetupList(modeId).filter(item => item.id !== setupId);
  saveLocal();
}

function setupDeckCount(setup, playerKey){
  return (setup?.decks?.[playerKey] || []).length;
}

function allModePlaylists(limit = 6){
  const rows = [];
  const setupGroups = state.modeSetups || {};
  Object.entries(setupGroups).forEach(([modeId, setups]) => {
    const mode = getModeConfig(modeId);
    (setups || []).forEach(setup => {
      rows.push({
        ...setup,
        mode,
        p1Count: setupDeckCount(setup, 'player1'),
        p2Count: setupDeckCount(setup, 'player2')
      });
    });
  });
  return rows
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, limit);
}

function resetDraftForMode(modeId, options = {}){
  const mode = getModeConfig(modeId);
  const draftMode = options.draftMode || mode.preferredDraftMode || 'traditional';
  const defaultScreen = draftMode === 'winston' ? 'winston-setup' : (draftMode === 'custom' ? 'custom-setup' : 'setup');
  state.selectedMode = mode.id;
  state.draft = {
    ...state.draft,
    active: true,
    screen: options.screen || defaultScreen,
    mode: draftMode,
    modeId: mode.id,
    format: options.format || mode.format || 'standard',
    target: options.target || mode.target || (mode.format === 'commander' ? 100 : 60),
    allowDuplicates: !mode.singleton,
    rarity: options.rarity ?? (mode.rarity || ''),
    setCode: options.setCode ?? '',
    era: options.era ?? '',
    queryExtra: options.queryExtra ?? (mode.queryExtra || ''),
    offeredColorSets: [],
    chosenColors: [],
    basicLands: { W:0, U:0, B:0, R:0, G:0 },
    picks: 0,
    pool: [],
    deck: [],
    seenIds: {},
    seenNames: {},
    customPool: [],
    customParams: { filterByColors: true },
    off: freshDraftOffState(),
    winston: freshWinstonState()
  };
}

function routeToMode(modeId, action){
  const mode = getModeConfig(modeId);
  state.selectedMode = mode.id;
  state.battleMode = mode.id;
  if (action === 'build') state.studioTab = 'build';
  else if (action === 'draft') state.studioTab = 'draft';
  else if (action === 'play') state.studioTab = 'play';
  else state.studioTab = mode.play ? 'play' : (mode.build ? 'build' : 'draft');
  applyAutoDeck(mode);
  state.screen = 'mode-studio';
  render();
}

function makeBasicLandCard(name, copyIndex, owner){
  const colorMap = { Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G' };
  // Prefer the printing the player picked (a direct CDN URL). The /cards/named
  // redirect is the fallback: it works, but dozens of them at once get
  // rate-limited by Scryfall, which is why some lands rendered blank.
  const art = chosenLandArt(name);
  return {
    id: `land_${owner}_${name}_${copyIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name,
    type: `Basic Land - ${name}`,
    cost: '',
    colors: colorMap[name] ? [colorMap[name]] : [],
    effect: '',
    power: 0,
    toughness: 0,
    imageUrl: art?.imageUrl || `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(name)}`,
    rarity: 'common'
  };
}

function normalizePlayableCard(card, fallbackName = 'Custom Card'){
  const name = card?.name || fallbackName;
  const type = card?.type || card?.type_line || '';
  const colors = Array.isArray(card?.colors)
    ? card.colors
    : (Array.isArray(card?.color_identity) ? card.color_identity : []);
  return {
    id: card?.id || makeId('card'),
    name,
    type,
    cost: card?.cost || card?.mana_cost || card?.manaCost || '',
    colors,
    effect: card?.effect || card?.oracle_text || '',
    power: card?.power ?? 0,
    toughness: card?.toughness ?? 0,
    image: card?.image || '',
    imageUrl: card?.imageUrl || card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || '',
    rarity: card?.rarity || 'common',
    isToken: !!card?.isToken,
    generated: !!card?.generated,   // invented name; skip Scryfall image lookup
    hordeRole: card?.hordeRole || '',
    hordeEffect: card?.hordeEffect || ''
  };
}

function makeGeneratedCard(name, type, cost, colors, effect, power = 0, toughness = 0, extra = {}){
  return normalizePlayableCard({
    id: makeId('gen'),
    name,
    type,
    cost,
    colors,
    effect,
    power,
    toughness,
    rarity: extra.rarity || 'common',
    isToken: !!extra.isToken,
    // Invented name → skip the Scryfall image lookup. Pass generated:false for
    // builders that use real card names (Dandan) so their art still loads.
    generated: extra.generated !== false,
    hordeRole: extra.hordeRole || '',
    hordeEffect: extra.hordeEffect || ''
  }, name);
}

function optimizeCardImage(img, loading = 'lazy'){
  if (!img) return img;
  img.loading = loading;
  img.decoding = 'async';
  return img;
}

function cardArtLabel(name, maxChars = 26){
  const clean = String(name || 'Card').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(8, maxChars - 1)).trim() + '...';
}

function cardPlaceholderSvgUrl(card, width = 100, height = 140){
  const isToken = !!card?.isToken;
  const name = htmlEscape(cardArtLabel(card?.name || (isToken ? 'Token' : 'Card')));
  const type = htmlEscape(cardArtLabel(card?.type || '', 24));
  const power = card?.power ?? '';
  const toughness = card?.toughness ?? '';
  // normalizePlayableCard coerces missing P/T to 0, so "has a value" is not a
  // usable test — only creatures and tokens actually have a printed P/T box.
  const typeText = ((card?.type || '') + '').toLowerCase();
  const hasPt = (isToken || typeText.includes('creature')) && (power !== '' || toughness !== '');
  const bg = isToken ? '#065f46' : '#334155';
  const stroke = isToken ? '#10b981' : '#64748b';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="7" fill="${bg}"/>
      <rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="5" fill="none" stroke="${stroke}" stroke-width="2"/>
      <text x="${width / 2}" y="${height * 0.42}" text-anchor="middle" fill="#f8fafc" font-family="Arial, sans-serif" font-size="10" font-weight="700">${name}</text>
      ${type ? `<text x="${width / 2}" y="${height * 0.57}" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="8">${type}</text>` : ''}
      ${hasPt ? `<text x="${width / 2}" y="${height * 0.74}" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="10">${htmlEscape(power)}/${htmlEscape(toughness)}</text>` : ''}
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function namedCardImageUrl(card){
  const name = String(card?.name || '').trim();
  // Generated cards (jumpstart/horde/cube filler) have invented names, so this
  // lookup is a guaranteed 404 — skip straight to the SVG placeholder instead
  // of firing ~100 doomed requests and flickering on every horde/cube setup.
  if (!name || card?.isToken || card?.generated) return '';
  return `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(name)}`;
}

function applyCardImageFallback(img){
  if (!img) return;
  const stage = Number(img.dataset.fallbackStage || '0');
  if (stage === 0 && img.dataset.fallbackSrc) {
    img.dataset.fallbackStage = '1';
    img.src = img.dataset.fallbackSrc;
    return;
  }
  img.dataset.fallbackStage = '2';
  img.onerror = null;
  img.src = img.dataset.placeholderSrc || cardPlaceholderSvgUrl({ name: img.alt || 'Card' });
}

window.GALDUR_CARD_IMAGE_FALLBACK = applyCardImageFallback;

function setCardImageElement(img, card, options = {}){
  const width = options.width || 100;
  const height = options.height || 140;
  const placeholder = cardPlaceholderSvgUrl(card, width, height);
  const direct = card?.image || card?.imageUrl || '';
  const named = namedCardImageUrl(card);
  const primary = direct || named || placeholder;
  const fallback = direct && named && direct !== named ? named : '';
  img.alt = card?.name || 'Card';
  img.classList.add('card-art-img');
  img.dataset.fallbackStage = '0';
  img.dataset.fallbackSrc = fallback;
  img.dataset.placeholderSrc = placeholder;
  img.style.backgroundImage = `url("${placeholder}")`;
  img.onerror = () => applyCardImageFallback(img);
  img.src = primary;
  return optimizeCardImage(img, options.loading || 'lazy');
}

function cardImageMarkup(card, options = {}){
  const width = options.width || 100;
  const height = options.height || 140;
  const placeholder = cardPlaceholderSvgUrl(card, width, height);
  const direct = card?.image || card?.imageUrl || '';
  const named = namedCardImageUrl(card);
  const primary = direct || named || placeholder;
  const fallback = direct && named && direct !== named ? named : '';
  const style = [
    'background-size:cover',
    'background-position:center',
    `background-image:url("${placeholder}")`,
    options.style || ''
  ].filter(Boolean).join(';');
  return `<img class="card-art-img ${htmlEscape(options.className || '')}" src="${htmlEscape(primary)}" alt="${htmlEscape(card?.name || 'Card')}" loading="${htmlEscape(options.loading || 'lazy')}" decoding="async" data-fallback-stage="0" data-fallback-src="${htmlEscape(fallback)}" data-placeholder-src="${htmlEscape(placeholder)}" onerror="window.GALDUR_CARD_IMAGE_FALLBACK && window.GALDUR_CARD_IMAGE_FALLBACK(this)" style="${htmlEscape(style)}">`;
}

function makeJumpstartPacket(themeId, packetIndex = 1){
  const theme = JUMPSTART_THEMES.find(t => t.id === themeId) || JUMPSTART_THEMES[0];
  const colors = theme.color === 'C' ? [] : [theme.color];
  const spells = theme.cards.map(([name, type, cost, power, toughness, effect], i) => makeGeneratedCard(
    `${name}`,
    type,
    cost,
    colors,
    effect,
    power,
    toughness,
    { rarity: i % 6 === 0 ? 'uncommon' : 'common' }
  ));
  const lands = [];
  for (let i = 0; i < 8; i++) lands.push(makeBasicLandCard(theme.land, `${packetIndex}_${i}`, `jumpstart_${theme.id}`));
  return {
    theme,
    cards: shuffleCopy([...spells, ...lands]).map((card, i) => ({ ...card, packet: theme.title, deckId: makeId(`jump_${packetIndex}_${i}`) }))
  };
}

function buildJumpstartDeck(themeAId, themeBId){
  const packetA = makeJumpstartPacket(themeAId, 1);
  const packetB = makeJumpstartPacket(themeBId, 2);
  return {
    name: `${packetA.theme.title} + ${packetB.theme.title}`,
    cards: shuffleCopy([...packetA.cards, ...packetB.cards])
  };
}

function makeStarterSurvivorDeck(owner = 'survivor'){
  const deck = [];
  const specs = [
    ['Sanctuary Guard', 'Creature - Human Soldier', '{1}{W}', ['W'], 2, 2, 'Vigilance.'],
    ['Expedition Healer', 'Creature - Human Cleric', '{2}{W}', ['W'], 2, 3, 'When this enters, you gain 2 life.'],
    ['Trailblazing Archer', 'Creature - Elf Archer', '{1}{G}', ['G'], 2, 2, 'Reach.'],
    ['Outpost Captain', 'Creature - Human Knight', '{3}{W}', ['W'], 3, 3, 'Other creatures you control get +0/+1.'],
    ['Shelter Charm', 'Instant', '{W}', ['W'], 0, 0, 'Target creature gains indestructible until end of turn.'],
    ['Coordinated Strike', 'Instant', '{1}{W}', ['W'], 0, 0, 'Two target creatures get +1/+1 until end of turn.'],
    ['Monster Hunter', 'Creature - Human Warrior', '{2}{G}', ['G'], 3, 2, 'When this blocks a token, it gets +2/+2 until end of turn.'],
    ['Campfire Renewal', 'Sorcery', '{2}{G}', ['G'], 0, 0, 'Return target creature card from your graveyard to your hand.']
  ];
  for (let round = 0; round < 4; round++) {
    for (const [name, type, cost, colors, power, toughness, effect] of specs) {
      deck.push(makeGeneratedCard(name, type, cost, colors, effect, power, toughness, { rarity: 'common' }));
    }
  }
  for (let i = 0; i < 12; i++) deck.push(makeBasicLandCard('Plains', `${owner}_p_${i}`, owner));
  for (let i = 0; i < 10; i++) deck.push(makeBasicLandCard('Forest', `${owner}_f_${i}`, owner));
  return shuffleCopy(deck);
}

function makeHordeToken(name, power, toughness, effect = ''){
  return makeGeneratedCard(
    name,
    'Creature Token - Zombie',
    '',
    ['B'],
    effect,
    power,
    toughness,
    { isToken: true, hordeRole: 'token' }
  );
}

function makeHordeAction(name, effect, hordeEffect){
  return makeGeneratedCard(
    name,
    'Horde Sorcery',
    '',
    ['B'],
    effect,
    0,
    0,
    { hordeRole: 'action', hordeEffect }
  );
}

// The chosen bot difficulty, readable before ai.js has necessarily booted.
function aiTier(){
  const t = state.aiDifficulty;
  return t === 'easy' || t === 'hard' ? t : 'normal';
}

// Horde composition scales with difficulty: Easy is mostly small fodder,
// Hard runs more surges, drains and giant tokens.
function makeHordeDeck(tier = aiTier()){
  // Survivors win by emptying this library, so its SIZE is the clock: a short
  // Easy deck is a winnable game, a long Hard deck is a grind.
  const counts = {
    easy:   { fodder: 24, surge: 1, regrow: 1, drain: 1, untap: 2, giants: 2 },
    normal: { fodder: 58, surge: 4, regrow: 4, drain: 5, untap: 4, giants: 8 },
    hard:   { fodder: 78, surge: 8, regrow: 6, drain: 8, untap: 5, giants: 16 }
  }[tier];
  const deck = [];
  const tokenMix = [
    () => makeHordeToken('Zombie Horde Token', 2, 2),
    () => makeHordeToken('Decayed Zombie Token', 2, 1, 'This token is disposable fodder for the horde.'),
    () => makeHordeToken('Rotting Brute Token', 3, 3),
    () => makeHordeToken('Shambling Mass Token', 1, 1, 'When many of these appear, the horde gets wide quickly.')
  ];
  for (let i = 0; i < counts.fodder; i++) deck.push(tokenMix[i % tokenMix.length]());
  for (let i = 0; i < counts.surge; i++) deck.push(makeHordeAction('Mindless Surge', 'Reveal two extra Horde cards.', 'surge'));
  for (let i = 0; i < counts.regrow; i++) deck.push(makeHordeAction('Graveborn Return', 'Return up to two Horde tokens from the graveyard to the battlefield.', 'regrow'));
  for (let i = 0; i < counts.drain; i++) deck.push(makeHordeAction('Gnawing Dread', 'Each survivor loses 2 life.', 'drain'));
  for (let i = 0; i < counts.untap; i++) deck.push(makeHordeAction('Endless Moan', 'Untap all Horde creatures.', 'untap'));
  for (let i = 0; i < counts.giants; i++) deck.push(makeHordeToken('Zombie Giant Token', 4, 4, 'Trample.'));
  return shuffleCopy(deck);
}

function makeDandanLibrary(size = 80){
  const requestedSize = parseInt(size || '80', 10);
  const targetSize = Number.isFinite(requestedSize) ? Math.max(40, Math.min(160, requestedSize)) : 80;
  const spellSpecs = [
    [10, 'Dandan', 'Creature - Fish', '{U}{U}', 4, 1, 'Can only attack players who control an Island. The shared library makes every copy matter.'],
    [4, 'Memory Lapse', 'Instant', '{1}{U}', 0, 0, 'Counter target spell, then put it on top of its owner library.'],
    [4, 'Counterspell', 'Instant', '{U}{U}', 0, 0, 'Counter target spell.'],
    [4, 'Brainstorm', 'Instant', '{U}', 0, 0, 'Draw three cards, then put two cards from your hand on top of the shared library.'],
    [4, 'Ponder', 'Sorcery', '{U}', 0, 0, 'Look at the top cards of the shared library, then draw a card.'],
    [4, 'Opt', 'Instant', '{U}', 0, 0, 'Scry 1, then draw a card.'],
    [4, 'Accumulated Knowledge', 'Instant', '{1}{U}', 0, 0, 'Draw a card plus one for each copy in graveyards.'],
    [4, 'Predict', 'Instant', '{1}{U}', 0, 0, 'Name a card, mill the top card, then draw if the name matched.'],
    [4, 'Vision Charm', 'Instant', '{U}', 0, 0, 'Choose a small library, land, or phasing trick.'],
    [4, 'Unsummon', 'Instant', '{U}', 0, 0, 'Return target creature to its owner hand.'],
    [4, 'Boomerang', 'Instant', '{U}{U}', 0, 0, 'Return target permanent to its owner hand.'],
    [4, 'Portent', 'Sorcery', '{U}', 0, 0, 'Reorder top cards and draw on the next upkeep.'],
    [4, 'Force Spike', 'Instant', '{U}', 0, 0, 'Counter target spell unless its controller pays 1.'],
    [4, 'Impulse', 'Instant', '{1}{U}', 0, 0, 'Look at the top cards and put one into your hand.']
  ];
  const cards = [];
  spellSpecs.forEach(([qty, name, type, cost, power, toughness, effect]) => {
    for (let i = 0; i < qty; i++) cards.push(makeGeneratedCard(name, type, cost, ['U'], effect, power, toughness, { rarity: 'common', generated: false }));
  });
  for (let i = 0; i < 18; i++) cards.push(makeBasicLandCard('Island', i, 'dandan'));
  while (cards.length < targetSize) {
    const i = cards.length;
    cards.push(i % 3 === 0
      ? makeBasicLandCard('Island', i, 'dandan')
      : makeGeneratedCard('Dandan', 'Creature - Fish', '{U}{U}', ['U'], 'Can only attack players who control an Island.', 4, 1, { rarity: 'common', generated: false }));
  }
  return shuffleCopy(cards.slice(0, targetSize).map((card, i) => ({
    ...card,
    deckId: makeId(`dandan_${i}`)
  })));
}

// Generated decks are tagged so a later mode can tell "this is leftover Horde
// filler" from "this is the deck the player actually built".
function tagAutoDeck(cards, kind){
  (cards || []).forEach(c => { c.autoDeckKind = kind; });
  return cards;
}

function deckAutoKind(deck){
  const cards = deck || [];
  if (!cards.length) return '';
  const kind = cards[0].autoDeckKind || '';
  return kind && cards.every(c => c.autoDeckKind === kind) ? kind : '';
}

// Replaceable when empty, or when it is a generated deck for a different mode.
function deckReplaceableBy(deck, kind){
  const cards = deck || [];
  if (!cards.length) return true;
  const existing = deckAutoKind(cards);
  return !!existing && existing !== kind;
}

function setupHordeDecks(options = {}){
  if (options.forceSurvivor || deckReplaceableBy(state.decks.player1, 'survivor')) {
    state.decks.player1 = tagAutoDeck(makeStarterSurvivorDeck('player1'), 'survivor');
  }
  const hordeKind = 'horde:' + aiTier();
  if (options.forceHorde || deckReplaceableBy(state.decks.player2, hordeKind)) {
    state.decks.player2 = tagAutoDeck(makeHordeDeck(), hordeKind);
  }
}

// The boss plays a real deck (lands + threats) so the standard AI turn logic
// drives it; escalation on top of that is handled by the AI module.
function makeBossDeck(){
  const deck = [];
  const threats = [
    ['Ashen Warlord', 'Creature - Demon Warrior', '{3}{B}', ['B'], 4, 4, 'Menace.'],
    ['Cinderscale Drake', 'Creature - Dragon', '{4}{R}', ['R'], 4, 3, 'Flying.'],
    ['Grave Colossus', 'Creature - Zombie Giant', '{5}{B}', ['B'], 6, 6, 'Trample.'],
    ['Emberfang Hound', 'Creature - Hound', '{1}{R}', ['R'], 2, 2, 'Haste.'],
    ['Bonecrush Ogre', 'Creature - Ogre', '{3}{R}', ['R'], 5, 3, ''],
    ['Nightmare Herald', 'Creature - Demon', '{2}{B}', ['B'], 3, 2, 'Flying, lifelink.'],
    ['Molten Lash', 'Instant', '{1}{R}', ['R'], 0, 0, 'Deal 3 damage to target creature or player.'],
    ['Soul Tithe', 'Sorcery', '{2}{B}', ['B'], 0, 0, 'Destroy target creature.'],
    ['Dread Ritual', 'Sorcery', '{1}{B}', ['B'], 0, 0, 'Draw two cards and lose 2 life.'],
    ['Wyrm of the Deep', 'Creature - Wurm', '{6}{R}', ['R'], 7, 7, 'Trample.'],
    ['Shadow Stalker', 'Creature - Nightstalker', '{2}{B}', ['B'], 3, 3, 'Deathtouch.'],
    ['Infernal Bolt', 'Instant', '{R}', ['R'], 0, 0, 'Deal 2 damage to target creature or player.']
  ];
  // Easy runs two threat cycles and no bombs doubled; Hard triples the top
  // threats so its late game genuinely bites.
  const tier = aiTier();
  const cycles = { easy: 2, normal: 3, hard: 3 }[tier];
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const [name, type, cost, colors, power, toughness, effect] of threats) {
      deck.push(makeGeneratedCard(name, type, cost, colors, effect, power, toughness,
        { rarity: cycle === 0 ? 'rare' : 'uncommon' }));
    }
  }
  if (tier === 'hard') {
    for (const [name, type, cost, colors, power, toughness, effect] of threats.filter(t => t[4] >= 5 || /destroy|deal 3/i.test(t[6]))) {
      deck.push(makeGeneratedCard(name, type, cost, colors, effect, power, toughness, { rarity: 'rare' }));
    }
  }
  for (let i = 0; i < 12; i++) deck.push(makeBasicLandCard('Swamp', `boss_s_${i}`, 'boss'));
  for (let i = 0; i < 12; i++) deck.push(makeBasicLandCard('Mountain', `boss_m_${i}`, 'boss'));
  return shuffleCopy(deck);
}

function setupBossDecks(options = {}){
  if (options.forceSurvivor || deckReplaceableBy(state.decks.player1, 'survivor')) {
    state.decks.player1 = tagAutoDeck(makeStarterSurvivorDeck('player1'), 'survivor');
  }
  const bossKind = 'boss:' + aiTier();
  if (options.forceBoss || deckReplaceableBy(state.decks.player2, bossKind)) {
    state.decks.player2 = tagAutoDeck(makeBossDeck(), bossKind);
  }
}

// Single dispatch point so every entry into an auto-deck mode seeds the same way.
function applyAutoDeck(modeOrId, options = {}){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : modeOrId;
  if (!mode) return;
  if (mode.autoDeck === 'basic-land-game') setupLandGameDecks(options);
  else if (mode.autoDeck === 'horde') setupHordeDecks(options);
  else if (mode.autoDeck === 'boss') setupBossDecks(options);
  // The generated deck is playable immediately; the real-card version
  // replaces it as soon as Scryfall answers.
  scheduleRealDeckUpgrades(mode);
}

function makeStarterCubeStack(size = 90){
  return makeWinstonStarterPool(size).map((card, i) => ({
    ...card,
    cubeSlot: i + 1,
    deckId: makeId(`cube_${i}`)
  }));
}

function makeWinstonStarterPool(size = 90){
  const seeds = [];
  for (const theme of JUMPSTART_THEMES) {
    const colors = theme.color === 'C' ? [] : [theme.color];
    theme.cards.forEach(([name, type, cost, power, toughness, effect]) => {
      seeds.push({ name, type, cost, colors, power, toughness, effect });
    });
  }
  const pool = [];
  let i = 0;
  while (pool.length < size) {
    const seed = seeds[i % seeds.length];
    const cycle = Math.floor(i / seeds.length) + 1;
    pool.push(makeGeneratedCard(
      cycle > 1 ? `${seed.name} ${cycle}` : seed.name,
      seed.type,
      seed.cost,
      seed.colors,
      seed.effect,
      seed.power,
      seed.toughness,
      { rarity: i % 11 === 0 ? 'rare' : (i % 5 === 0 ? 'uncommon' : 'common') }
    ));
    i++;
  }
  return shuffleCopy(pool);
}

function isBasicLandGameDeck(deck){
  const cards = deck || [];
  return cards.length === 50 && cards.every(card => BASIC_LAND_NAMES.includes(card?.name));
}

// Only (re)generate when a slot is empty or already holds a land-game deck, so
// opening the mode never destroys a real deck the player built.
function setupLandGameDecks(options = {}){
  const makeDeck = (owner) => {
    const cards = [];
    for (const name of BASIC_LAND_NAMES) {
      for (let i = 0; i < 10; i++) cards.push(makeBasicLandCard(name, i, owner));
    }
    return cards;
  };
  const replaceable = (deck) => !(deck || []).length || isBasicLandGameDeck(deck) || deckReplaceableBy(deck, 'land-game');
  if (options.force || replaceable(state.decks.player1)) state.decks.player1 = tagAutoDeck(makeDeck('p1'), 'land-game');
  if (options.force || replaceable(state.decks.player2)) state.decks.player2 = tagAutoDeck(makeDeck('p2'), 'land-game');
}

function cloneForGame(card, gameId){
  return {
    ...card,
    gameId,
    tapped: false,
    pt: { p: 0, t: 0 },
    stun: 0
  };
}

function emptyPlayerState(deck, mode){
  return {
    hand: [],
    creatureField: [],
    supportField: [],
    landField: [],
    graveyard: [],
    exile: [],
    commanderZone: [],
    deck: deck || [],
    health: mode.health || 20
  };
}

function buildGameStateForMode(mode, p1Deck, p2Deck){
  const rules = getModeRules(mode);
  const shared = !!rules.sharedLibrary;
  // Whichever slot actually holds the center stack wins; if both are filled,
  // prefer the larger one (the generators write to the acting player's slot,
  // which is not necessarily player 1).
  const sharedDeck = shared
    ? (p1Deck.length && p2Deck.length
        ? (p2Deck.length > p1Deck.length ? p2Deck : p1Deck)
        : (p1Deck.length ? p1Deck : p2Deck)).slice()
    : [];
  const bossState = emptyPlayerState(shared ? [] : p2Deck, rules);
  const tier = aiTier();
  if (rules.opponentHealth) {
    // Boss life scales with difficulty: 75% on Easy, 125% on Hard.
    const factor = { easy: 0.75, normal: 1, hard: 1.25 }[tier];
    bossState.health = Math.round(rules.opponentHealth * factor);
  }
  // Survivors get a cushion on the easier settings of the co-op modes, so the
  // fight is winnable rather than a race the board state always wins.
  const survivorBonus = rules.botOpponent ? ({ easy: 20, normal: 8, hard: 0 }[tier] || 0) : 0;
  const survivorState = emptyPlayerState(shared ? [] : p1Deck, rules);
  survivorState.health += survivorBonus;
  return {
    player1: survivorState,
    player2: bossState,
    shared: {
      enabled: shared,
      label: rules.sharedLabel || 'Shared Library',
      deck: sharedDeck,
      graveyard: [],
      exile: []
    },
    stack: [],
    phase: 'Main',
    mode: mode.id
  };
}

function isSharedGame(){
  return !!state.gameState?.shared?.enabled;
}

function usesCommanderZone(){
  return !!getModeConfig(state.gameState?.mode || state.battleMode || state.selectedMode).commanderZone;
}

function commandZoneMeta(mode){
  const cfg = mode || getModeConfig(state.gameState?.mode || state.battleMode || state.selectedMode);
  return {
    label: cfg.commandZoneLabel || 'Commander Zone',
    shortLabel: cfg.commandZoneShortLabel || 'Cmd',
    max: cfg.commandZoneMax || null
  };
}

function commandZoneCandidateIndexes(deck, mode){
  if (!mode?.commanderZone || !Array.isArray(deck)) return [];
  const max = mode.commandZoneMax || (mode.id === 'oathbreaker' ? 2 : 1);
  const typeAt = (idx) => (deck[idx]?.type || '').toLowerCase();
  const used = new Set();
  const out = [];
  const addFirst = (predicate) => {
    const idx = deck.findIndex((card, i) => !used.has(i) && predicate(card, typeAt(i)));
    if (idx >= 0) {
      used.add(idx);
      out.push(idx);
    }
  };

  if (mode.id === 'oathbreaker') {
    addFirst((card, type) => type.includes('planeswalker'));
    addFirst((card, type) => type.includes('instant') || type.includes('sorcery'));
  } else {
    addFirst((card, type) =>
      type.includes('commander') ||
      (type.includes('legendary') && (type.includes('creature') || type.includes('planeswalker')))
    );
  }

  return out.slice(0, max);
}

function seedCommandZoneFromDeck(player, mode){
  if (!mode?.commanderZone || !player?.deck) return;
  const indexes = commandZoneCandidateIndexes(player.deck, mode).sort((a, b) => b - a);
  indexes.forEach(idx => {
    const card = player.deck.splice(idx, 1)[0];
    if (card) player.commanderZone.unshift(card);
  });
}

function getModeRules(modeOrId){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : (modeOrId || currentModeConfig());
  const sharedLibrary = !!mode.sharedLibrary;
  const defaultMaxCopies = (sharedLibrary || mode.family === 'Limited' || mode.id === 'horde') ? null : 4;
  const maxCopies = mode.maxCopies ?? (mode.singleton ? 1 : defaultMaxCopies);
  return {
    id: mode.id,
    title: mode.title,
    family: mode.family,
    deckTarget: mode.target || 60,
    maxCopies,
    singleton: !!mode.singleton,
    startingHand: mode.startingHand || 0,
    noMulligan: !!mode.noMulligan,
    autoDeck: mode.autoDeck || '',
    botOpponent: !!mode.botOpponent,    // player 2 is machine-driven in this mode
    openingHand: mode.openingHand || 0,
    modeRules: Array.isArray(mode.rules) ? mode.rules : [],
    health: mode.health || 20,          // starting life; emptyPlayerState reads this
    opponentHealth: mode.opponentHealth || 0,   // asymmetric modes (boss)
    sharedLibrary,
    sharedLabel: mode.sharedLabel || (sharedLibrary ? 'Shared Library' : ''),
    drawSource: sharedLibrary ? 'shared-top' : 'deck-top',
    commanderZone: !!mode.commanderZone,
    commandZoneLabel: mode.commandZoneLabel || (mode.commanderZone ? 'Commander Zone' : ''),
    commandZoneShortLabel: mode.commandZoneShortLabel || (mode.commanderZone ? 'Cmd' : ''),
    commandZoneMax: mode.commandZoneMax || null,
    winCondition: mode.id === 'land-game' ? 'basic-land-game' : 'life',
    battlefieldTools: [
      ...(mode.id === 'cube' || sharedLibrary ? ['shared-stack'] : []),
      ...(mode.id === 'land-game' ? ['basic-land-effects'] : []),
      ...(mode.id === 'horde' ? ['horde'] : [])
    ]
  };
}

// Human-readable deck requirement, e.g. "exactly 100 cards, singleton".
// ---------------------------------------------------------------------------
// Deck library
//
// Named decks the player owns, independent of which seat they occupy. This is
// what replaces the old "P1 deck / P2 deck" mental model: you keep a shelf of
// decks and choose which one to bring to a game.
// ---------------------------------------------------------------------------

function saveDeckToLibrary(name, cards, modeId){
  const clean = (cards || []).filter(Boolean);
  if (!clean.length) { toast('Nothing to save — the deck is empty.'); return null; }
  const entry = {
    id: makeId('deck'),
    name: (name || '').trim() || `Untitled deck (${clean.length})`,
    modeId: modeId || state.selectedMode || 'casual',
    cards: cloneCards(clean),
    savedAt: Date.now()
  };
  state.deckLibrary = state.deckLibrary || [];
  // Overwrite a deck of the same name rather than silently accumulating copies.
  const existing = state.deckLibrary.findIndex(d => d.name.toLowerCase() === entry.name.toLowerCase());
  if (existing >= 0) state.deckLibrary[existing] = entry;
  else state.deckLibrary.unshift(entry);
  state.deckLibrary = state.deckLibrary.slice(0, 40);
  scheduleSave();
  return entry;
}

function loadDeckFromLibrary(deckId, slotKey){
  const entry = (state.deckLibrary || []).find(d => d.id === deckId);
  if (!entry) { toast('Deck not found.'); return null; }
  state.decks[slotKey || ('player' + state.currentPlayer)] = cloneCards(entry.cards);
  if (entry.modeId && entry.modeId !== state.selectedMode) {
    state.selectedMode = entry.modeId;
    state.battleMode = entry.modeId;
  }
  scheduleSave();
  return entry;
}

function deleteDeckFromLibrary(deckId){
  state.deckLibrary = (state.deckLibrary || []).filter(d => d.id !== deckId);
  scheduleSave();
}

function libraryDeckSummary(entry){
  const mode = getModeConfig(entry.modeId);
  const lands = entry.cards.filter(c => ((c.type || '') + '').toLowerCase().includes('land')).length;
  return `${entry.cards.length} cards · ${lands} lands · ${mode.title}`;
}

// Position a floating hover preview so it is always fully on screen: flip to
// the other side of the cursor when it would overflow, then clamp.
function placeHoverBox(box, evt, pad = 16){
  if (!box) return;
  box.style.display = 'block';
  box.style.left = '0px';
  box.style.top = '0px';
  const rect = box.getBoundingClientRect();
  const w = rect.width || 360;
  const h = rect.height || 420;
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;    // flip left
  if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;   // flip up
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
  box.style.left = x + 'px';
  box.style.top = y + 'px';
}

// User-facing name for a seat. "Player 1 / Player 2" only ever mattered to the
// engine; people think in terms of you, the bot, or your opponent.
function seatLabel(n, { capital = true } = {}){
  let label;
  if (state.vsAI && n === 2) label = 'the Bot';
  else if (n === state.currentPlayer) label = 'you';
  else label = 'your opponent';
  return capital ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

// --- Strict mana ------------------------------------------------------------
// Optional rules enforcement: playing a card taps real lands for its cost, and
// only one land may be played per turn. Off by default — the sandbox stays.

function untappedLandsOf(player){
  return battlefieldCards(player).filter(c => ((c.type || '') + '').toLowerCase().includes('land') && !c.tapped);
}

function landColorOf(card){
  const map = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
  if (map[card.name]) return map[card.name];
  const m = ((card.effect || '') + '').match(/add\s*\{?([WUBRG])\}?/i);
  return m ? m[1].toUpperCase() : '*';
}

// Which untapped lands would pay this cost? null = cannot pay.
function planManaPayment(player, cost){
  const tokens = ((cost || '') + '').match(/\{([^}]+)\}/g) || [];
  let generic = 0;
  const colored = [];
  for (const t of tokens) {
    const inner = t.slice(1, -1).toUpperCase();
    const n = parseInt(inner, 10);
    if (Number.isFinite(n)) { generic += n; continue; }
    if (inner === 'X') continue;
    const opts = inner.split('/').filter(ch => 'WUBRG'.includes(ch));
    if (opts.length) colored.push(opts);
    else if (inner === 'C' || inner === 'S') generic += 1;
  }
  const lands = untappedLandsOf(player).map(c => ({ card: c, color: landColorOf(c) }));
  const used = new Set();
  for (const opts of colored) {
    const hit = lands.find(l => !used.has(l.card) && opts.includes(l.color))
      || lands.find(l => !used.has(l.card) && l.color === '*');
    if (!hit) return null;
    used.add(hit.card);
  }
  const rest = lands.filter(l => !used.has(l.card));
  if (rest.length < generic) return null;
  for (let i = 0; i < generic; i++) used.add(rest[i].card);
  return [...used];
}

// Fire a card's enter-the-battlefield trigger (bot games only) and surface it.
function fireEnterTrigger(card, controller){
  const rules = window.GALDUR_RULES;
  if (!rules) return;
  const note = rules.onEnter(card, controller);
  if (note) addGameLog(note, 'trigger', { cardName: card.name });
}

function fireDeathTrigger(card, controller){
  const rules = window.GALDUR_RULES;
  if (!rules) return;
  const note = rules.onDies(card, controller);
  if (note) addGameLog(note, 'trigger', { cardName: card.name });
}

function deckSizeSummary(modeOrId){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : modeOrId;
  const policy = deckSizePolicy(mode);
  const kindText = policy.kind === 'exact' ? `exactly ${policy.count}`
    : policy.kind === 'min' ? `at least ${policy.count}`
    : `around ${policy.count}`;
  const extras = [];
  if (mode.singleton) extras.push('singleton');
  else if (mode.maxCopies) extras.push(`max ${mode.maxCopies} copies`);
  return `${kindText} cards${extras.length ? ', ' + extras.join(', ') : ''}`;
}

function isBasicLandDeckCard(card){
  const type = (card?.type || '').toLowerCase();
  return BASIC_LAND_NAMES.includes(card?.name) || (type.includes('basic') && type.includes('land'));
}

function normalizeDeckCardName(card){
  return (card?.name || 'Unknown Card').trim();
}

function sampleCardNames(cards, limit = 4){
  const names = [...new Set(cards.map(card => normalizeDeckCardName(card)).filter(Boolean))];
  const suffix = names.length > limit ? `, +${names.length - limit} more` : '';
  return names.slice(0, limit).join(', ') + suffix;
}

function deckSizePolicy(mode){
  if (mode.sizePolicy) return { ...mode.sizePolicy };
  const exactSizeModes = new Set(['commander', 'oathbreaker', 'brawl', 'jumpstart', 'land-game']);
  if (exactSizeModes.has(mode.id) && mode.target) return { kind: 'exact', count: mode.target };
  if (mode.id === 'casual') return { kind: 'recommended', count: mode.target || 60 };
  if (mode.id === 'cube' || mode.id === 'winston') return { kind: 'recommended', count: mode.target || 40, min: 24 };
  if (mode.id === 'dandan') return { kind: 'recommended', count: mode.target || 80, min: 40 };
  if (mode.id === 'horde') return { kind: 'min', count: 40 };
  if (mode.sharedLibrary && mode.target) return { kind: 'recommended', count: mode.target, min: 24 };
  if (mode.target) return { kind: 'min', count: mode.target };
  return { kind: 'open' };
}

function validateDeckForMode(deck, modeOrId){
  const mode = typeof modeOrId === 'string' ? getModeConfig(modeOrId) : (modeOrId || currentModeConfig());
  const rules = getModeRules(mode);
  const cards = deck || [];
  const errors = [];
  const warnings = [];
  const facts = [];
  const policy = deckSizePolicy(mode);

  facts.push(`${cards.length} card${cards.length === 1 ? '' : 's'}`);
  if (policy.kind === 'exact') facts.push(`exactly ${policy.count}`);
  if (policy.kind === 'min') facts.push(`minimum ${policy.count}`);
  if (policy.kind === 'recommended') facts.push(`recommended ${policy.count}`);
  if (rules.singleton) facts.push('singleton');
  else if (rules.maxCopies) facts.push(`${rules.maxCopies} copies max`);
  if (mode.rarity === 'common') facts.push('commons only');
  if (mode.sharedLibrary) facts.push('shared library');
  if (mode.commanderZone) facts.push(mode.commandZoneLabel || 'command zone');

  if (!cards.length) {
    errors.push(mode.sharedLibrary ? 'Load a shared stack or pool before starting this mode.' : 'Add cards to this deck before starting.');
  }

  if (cards.length) {
    if (policy.kind === 'exact' && cards.length !== policy.count) {
      errors.push(`This mode uses exactly ${policy.count} cards; current deck has ${cards.length}.`);
    } else if (policy.kind === 'min' && cards.length < policy.count) {
      errors.push(`This format needs at least ${policy.count} cards; current deck has ${cards.length}.`);
    } else if (policy.kind === 'recommended') {
      if (policy.min && cards.length < policy.min) {
        errors.push(`This mode needs at least ${policy.min} cards to play smoothly; current stack has ${cards.length}.`);
      } else if (policy.count && cards.length < policy.count) {
        warnings.push(`Recommended size is ${policy.count} cards; current stack has ${cards.length}.`);
      }
    }
  }

  const counts = new Map();
  cards.forEach(card => {
    if (isBasicLandDeckCard(card)) return;
    const name = normalizeDeckCardName(card);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const copyLimit = rules.singleton ? 1 : (rules.maxCopies || null);
  if (copyLimit) {
    const overLimit = [...counts.entries()].filter(([, qty]) => qty > copyLimit);
    if (overLimit.length) {
      const examples = overLimit.slice(0, 4).map(([name, qty]) => `${name} x${qty}`).join(', ');
      errors.push(`${rules.singleton ? 'Singleton' : 'Copy limit'} violation: ${examples}${overLimit.length > 4 ? ', +' + (overLimit.length - 4) + ' more' : ''}.`);
    }
  }

  if (mode.rarity === 'common') {
    const nonCommon = cards.filter(card => !isBasicLandDeckCard(card) && card.rarity && String(card.rarity).toLowerCase() !== 'common');
    const missingRarity = cards.filter(card => !isBasicLandDeckCard(card) && !card.rarity);
    if (nonCommon.length) errors.push(`Pauper requires commons: ${sampleCardNames(nonCommon)}.`);
    if (missingRarity.length) warnings.push(`${missingRarity.length} non-land card${missingRarity.length === 1 ? '' : 's'} have no rarity recorded.`);
  }

  if (mode.id === 'oathbreaker') {
    const hasPlaneswalker = cards.some(card => (card.type || '').toLowerCase().includes('planeswalker'));
    if (cards.length && !hasPlaneswalker) warnings.push('Oathbreaker normally needs a planeswalker plus signature spell in the command zone.');
  } else if (mode.commanderZone) {
    const hasCommanderCandidate = cards.some(card => {
      const type = (card.type || '').toLowerCase();
      return type.includes('legendary') || type.includes('commander') || (mode.id === 'brawl' && type.includes('planeswalker'));
    });
    if (cards.length && !hasCommanderCandidate) warnings.push(`${mode.title} usually needs a commander candidate for the command zone.`);
  }

  if (mode.id === 'dandan' && cards.length && !cards.some(card => /dandan/i.test(card.name || ''))) {
    warnings.push('Dandan usually plays best with at least one Dandan in the shared library.');
  }

  const status = errors.length ? 'blocked' : (warnings.length ? 'warning' : 'ready');
  return { status, errors, warnings, facts, mode };
}

function deckValidationPanelHtml(validation, options = {}){
  const statusLabels = { ready: 'Ready', warning: 'Review', blocked: 'Needs work' };
  const title = options.title || 'Format Check';
  const issueRows = [
    ...validation.errors.map(message => ({ kind: 'error', message })),
    ...validation.warnings.map(message => ({ kind: 'warning', message }))
  ];
  const emptyText = validation.status === 'ready' ? 'Deck matches the selected mode rules the app can verify.' : '';
  return `
    <div id="${options.id || 'deckValidation'}" class="deck-validation deck-validation-${validation.status}${options.compact ? ' compact' : ''}">
      <div class="deck-validation-head">
        <div>
          <div class="text-xs text-gray">${htmlEscape(title)}</div>
          <div class="deck-validation-title">${htmlEscape(validation.mode.title)}</div>
        </div>
        <span class="validation-status">${statusLabels[validation.status] || validation.status}</span>
      </div>
      <div class="validation-facts">
        ${validation.facts.map(fact => `<span>${htmlEscape(fact)}</span>`).join('')}
      </div>
      <div class="validation-issues">
        ${issueRows.map(item => `<div class="${item.kind}">${htmlEscape(item.message)}</div>`).join('') || `<div class="ok">${htmlEscape(emptyText)}</div>`}
      </div>
    </div>
  `;
}

// --- Global player helpers (work for online and Local/Hotseat) ---
if (!window.isMe) window.isMe = function(n){
  const D = state?.draft;
  // In local (hotseat), allow UI elements to treat either side as "me".
  if (D?.mode === 'draftoff' && D?.off?.isLocal) return true;
  return state.currentPlayer === n;
};

if (!window.myPicksFor) window.myPicksFor = function(who){
  const D = state.draft;
  return who === 1 ? D.off.p1 : D.off.p2;
};

function initLandsFill(who){
  const D = state.draft;
  D.lands = {
    who,                              // 1 or 2; whose lands we are currently filling
    targetTotal: D.target || 60,
    baseCount: (who === 1 ? D.off.p1.length : D.off.p2.length),
    remaining: 0,                     // computed below
    finalizing: false,                // in-flight guard for the Finalize button
    counts: { Plains:0, Island:0, Swamp:0, Mountain:0, Forest:0 }
  };
  D.lands.remaining = Math.max(0, D.lands.targetTotal - D.lands.baseCount);
}


function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 400, maxH = 560;
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxW) { h *= maxW / w; w = maxW; } }
      else { if (h > maxH) { w *= maxH / h; h = maxH; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function checkWinner() {
  if (!state.gameStarted) return;
  const p1Dead = state.gameState.player1.health <= 0;
  const p2Dead = state.gameState.player2.health <= 0;
  if (p1Dead && p2Dead) { state.winner = 'draw'; state.gameStarted = false; }
  else if (p1Dead) { state.winner = 2; state.gameStarted = false; }
  else if (p2Dead) { state.winner = 1; state.gameStarted = false; }
}

function toast(message, ms = 2200) {
  const t = document.createElement('div');
  t.setAttribute('role', 'status');
  t.style.cssText = [
    'position:fixed','right:16px','bottom:16px','z-index:10000',
    'background:#111827','border:1px solid #374151','color:#fff',
    'padding:10px 14px','border-radius:8px','box-shadow:0 8px 24px rgba(0,0,0,.35)',
    'opacity:0','transform:translateY(8px)','transition:opacity .15s ease, transform .15s ease'
  ].join(';');
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 180);
  }, ms);
}

// --- Scryfall politeness: serialize calls ~100ms apart + retry on 429/503 ---
let _scryQueue = Promise.resolve();
function _delay(ms){ return new Promise(r => setTimeout(r, ms)); }
const SCRY_CACHE_KEY = 'galdur-scry-cache-v1';
let _scryCache = null;
function scryCache(){
  if (_scryCache) return _scryCache;
  try {
    _scryCache = JSON.parse(localStorage.getItem(SCRY_CACHE_KEY) || '{}');
  } catch {
    _scryCache = {};
  }
  return _scryCache;
}
function scryCacheGet(url){
  const entry = scryCache()[url];
  if (!entry || Date.now() - entry.savedAt > 1000 * 60 * 60 * 24 * 7) return null;
  return new Response(JSON.stringify(entry.body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Galdur-Cache': '1' }
  });
}
async function scryCachePut(url, response){
  try {
    if (!response.ok || !String(response.headers.get('content-type') || '').includes('json')) return;
    const clone = response.clone();
    const body = await clone.json();
    const cache = scryCache();
    cache[url] = { savedAt: Date.now(), body };
    let entries = Object.entries(cache).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 400);
    // Pruning by COUNT alone lets a few big Scryfall list pages blow the ~5MB
    // origin quota, after which saveLocal() silently stops persisting the
    // player's collection. Prune by size too, and drop the cache entirely
    // rather than let a write failure cascade.
    const MAX_BYTES = 2_000_000;
    let payload = JSON.stringify(Object.fromEntries(entries));
    while (payload.length > MAX_BYTES && entries.length > 1) {
      entries = entries.slice(0, Math.floor(entries.length / 2));
      payload = JSON.stringify(Object.fromEntries(entries));
    }
    _scryCache = Object.fromEntries(entries);
    try {
      localStorage.setItem(SCRY_CACHE_KEY, payload);
    } catch {
      _scryCache = {};
      try { localStorage.removeItem(SCRY_CACHE_KEY); } catch {}
    }
  } catch { /* cache best-effort only */ }
}
function scryfetch(url, opts){
  const method = (opts?.method || 'GET').toUpperCase();
  // /random is never cacheable; /cards/search pages are hundreds of KB and are
  // already held in the in-memory draft pool, so keeping them out of
  // localStorage leaves the quota for the player's own collection.
  const canCache = method === 'GET'
    && !String(url).includes('/random')
    && !String(url).includes('/cards/search');
  if (canCache) {
    const cached = scryCacheGet(url);
    if (cached) return Promise.resolve(cached);
  }
  const run = _scryQueue.then(async () => {
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++){
      try {
        const r = await fetch(url, opts);
        // Retry on rate-limit / transient server errors.
        if (r.status === 429 || r.status === 503){ await _delay(400 * (attempt + 1)); continue; }
        if (canCache) scryCachePut(url, r);
        return r;
      } catch (e) {
        // Network blip (e.g. "Failed to fetch") — back off and retry rather than abort.
        lastErr = e;
        await _delay(400 * (attempt + 1));
      }
    }
    try {
      const r = await fetch(url, opts);
      if (canCache) scryCachePut(url, r);
      return r;
    }      // one last attempt
    catch (e) { throw (lastErr || e); }
  });
  // advance the queue ~100ms after each request, whether it resolved or threw
  _scryQueue = run.then(() => _delay(100), () => _delay(100));
  return run;
}
window.scryfetch = scryfetch;

// --- Local persistence: keep the custom card collection + built decks across reloads ---
const SAVE_KEY = 'galdur-save-v1';
let _saveTimer = null;
// ---------------------------------------------------------------------------
// Draft card pool
//
// Drafting used to call /cards/random once per candidate card, and scryfetch
// serialises every request behind a 100ms-spaced queue — so a 9-card pack could
// mean 20-40 round trips and many seconds of a frozen-looking screen. One
// /cards/search page returns up to 175 fully-populated cards, so a single
// request now feeds a whole draft and every subsequent pick is instant.
// ---------------------------------------------------------------------------

const SCRY_PAGE_SIZE = 175;
// query -> Promise<{ cards: [...], idx: number }>. The PROMISE is cached, not
// the entry: the preloader and the live pick run concurrently, and publishing a
// half-built entry would hand the second caller an empty pool.
const _draftPools = new Map();

// Scryfall card JSON -> the app's canonical playable-card shape.
function scryfallToCard(c){
  const img = c?.image_uris?.normal
    || c?.card_faces?.[0]?.image_uris?.normal
    || '';
  const face = c?.card_faces?.[0];
  return {
    id: c.id,
    name: c.name,
    type: c.type_line || face?.type_line || '',
    cost: c.mana_cost || face?.mana_cost || '',
    colors: c.colors || c.color_identity || [],
    effect: c.oracle_text || face?.oracle_text || '',
    power: c.power ?? face?.power ?? 0,
    toughness: c.toughness ?? face?.toughness ?? 0,
    imageUrl: img,
    cmc: typeof c.cmc === 'number' ? c.cmc : undefined,
    rarity: c.rarity || ''
  };
}

function usableDraftCard(c){
  // Cards with no art are unusable in a visual draft, and lands are never offered.
  if (!c || !c.imageUrl || !c.name) return false;
  return !(c.type || '').toLowerCase().includes('land');
}

// Load (and shuffle) one page of results for a query. Large result sets pull a
// random page so repeat drafts don't keep seeing the same alphabetical head.
function poolSearchUrl(query, page){
  const base = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`;
  return page > 1 ? `${base}&page=${page}` : base;
}

// Fetch one page and append its unseen cards to the entry.
async function addPoolPage(entry, page){
  if (entry.pages.has(page)) return 0;
  entry.pages.add(page);
  try {
    const r = await scryfetch(poolSearchUrl(entry.query, page), { headers: { Accept: 'application/json' } });
    if (!r.ok) return 0;
    const data = await r.json();
    if (typeof data.total_cards === 'number') entry.total = data.total_cards;
    const fresh = (Array.isArray(data.data) ? data.data : [])
      .map(scryfallToCard)
      .filter(c => usableDraftCard(c) && !entry.ids.has(c.id));
    fresh.forEach(c => entry.ids.add(c.id));
    entry.cards.push(...shuffleCopy(fresh));
    return fresh.length;
  } catch (e) {
    console.warn('draft pool page failed', entry.query, page, e);
    return 0;
  }
}

function poolPageCount(entry){
  if (!entry.total) return 1;
  return Math.min(Math.ceil(entry.total / SCRY_PAGE_SIZE), 40);   // Scryfall caps deep paging
}

function loadDraftPool(query){
  const key = String(query || '').trim();
  if (_draftPools.has(key)) return _draftPools.get(key);

  const job = (async () => {
    const entry = { query: key, cards: [], idx: 0, ids: new Set(), pages: new Set(), total: 0 };
    await addPoolPage(entry, 1);
    // Large result sets: jump to a random page so repeat drafts don't keep
    // seeing the same alphabetical head of the results.
    const pages = poolPageCount(entry);
    if (pages > 1) await addPoolPage(entry, 1 + Math.floor(Math.random() * pages));
    return entry;
  })();

  _draftPools.set(key, job);
  return job;
}

// Pull the next card matching `accept`, fetching further pages as the pool runs
// dry. Returns null only when the query is genuinely exhausted.
async function drawFromPool(query, accept){
  const entry = await loadDraftPool(query);

  for (let guard = 0; guard < 8; guard++) {
    for (let i = entry.idx; i < entry.cards.length; i++) {
      const card = entry.cards[i];
      if (accept && !accept(card)) continue;
      // Swap the taken card to the front of the unconsumed region so repeated
      // scans stay cheap instead of re-walking every rejected card.
      entry.cards[i] = entry.cards[entry.idx];
      entry.cards[entry.idx] = card;
      entry.idx++;
      return card;
    }
    // Nothing acceptable left — pull another page if one exists.
    const pages = poolPageCount(entry);
    if (entry.pages.size >= pages) return null;
    let added = 0;
    for (let p = 1; p <= pages && !added; p++) {
      if (!entry.pages.has(p)) added = await addPoolPage(entry, p);
    }
    if (!added) return null;
  }
  return null;
}

function resetDraftPools(){
  _draftPools.clear();
}

// ---------------------------------------------------------------------------
// Basic land art
//
// state.landArt holds the printing the player chose for each basic. Resolving
// art once per land NAME (instead of once per copy) turns a 24-land deck from
// 24 serialised Scryfall calls into at most 5, and gives every copy a direct
// CDN image URL rather than a /cards/named redirect that gets rate-limited.
// ---------------------------------------------------------------------------

const _landArtInflight = new Map();

function chosenLandArt(landName){
  return (state.landArt && state.landArt[landName]) || null;
}

// One printing per basic, cached in state so later decks are instant.
async function resolveLandArt(landName){
  const chosen = chosenLandArt(landName);
  if (chosen && chosen.imageUrl) return chosen;
  if (_landArtInflight.has(landName)) return _landArtInflight.get(landName);

  const job = (async () => {
    try {
      const q = `t:basic type:${landName} game:paper`;
      const r = await scryfetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=art&order=released&dir=desc`,
        { headers: { Accept: 'application/json' } }
      );
      if (!r.ok) return null;
      const data = await r.json();
      const list = (Array.isArray(data.data) ? data.data : []).filter(c => c.image_uris?.normal);
      if (!list.length) return null;
      const c = list[Math.floor(Math.random() * Math.min(list.length, 20))];
      const art = {
        id: c.id,
        name: c.name,
        type: c.type_line || `Basic Land — ${landName}`,
        imageUrl: c.image_uris.normal,
        set: (c.set || '').toUpperCase(),
        setName: c.set_name || '',
        artist: c.artist || ''
      };
      state.landArt = state.landArt || {};
      if (!state.landArt[landName]) state.landArt[landName] = art;   // don't override a real choice
      return art;
    } catch {
      return null;
    } finally {
      _landArtInflight.delete(landName);
    }
  })();
  _landArtInflight.set(landName, job);
  return job;
}

// ---------------------------------------------------------------------------
// Real-card auto decks
//
// Auto-built opponents (boss, horde, generic AI, starter pools, jumpstart)
// used invented placeholder cards. They now draw real cards from Scryfall —
// with real art and real rules text — through the same pooled search the
// draft uses, so a whole deck costs one or two requests. The generated decks
// remain as an instant fallback and for offline play: the sync builders run
// first, then the real version replaces the deck when the fetch lands.
// ---------------------------------------------------------------------------

const BASIC_NAME_FOR = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

// Draw `count` distinct cards from one pooled query.
async function realCardsFrom(query, count, accept){
  const out = [];
  const seen = new Set();
  while (out.length < count) {
    const c = await drawFromPool(query, x => !seen.has(x.name) && (!accept || accept(x)));
    if (!c) break;
    seen.add(c.name);
    out.push({ ...c, realCard: true });
  }
  return out;
}

async function realBasicsFor(colors, count, owner){
  const lands = [];
  for (const col of colors) await resolveLandArt(BASIC_NAME_FOR[col]);   // warm the art cache
  let i = 0;
  while (lands.length < count) {
    const col = colors[i % colors.length];
    lands.push({ ...makeBasicLandCard(BASIC_NAME_FOR[col], i, owner), realCard: true });
    i++;
  }
  return lands;
}

const TWO_COLOR_PAIRS = [['W','U'],['U','B'],['B','R'],['R','G'],['G','W'],['W','B'],['U','R'],['B','G'],['R','W'],['G','U']];

const isCreatureCardData = (c) => ((c.type || '') + '').toLowerCase().includes('creature');
const looksLikeRemoval = (c) => /destroy target|deals? \d+ damage|each opponent loses|target creature gets -/i.test((c.effect || '') + '');

// Build a deck from ONE search. Scryfall rate-limits bursts hard (the edge
// rejects them without CORS headers), so every builder spends a single
// request and does its creature/spell split locally.
async function buildDeckFromPool({ query, colors, owner, creatures, spells, lands, creatureFilter }){
  const pool = await realCardsFrom(query, creatures + spells + 24);
  if (pool.length < Math.max(12, creatures)) return null;

  const creaturePool = pool.filter(c => isCreatureCardData(c) && (!creatureFilter || creatureFilter(c)));
  const spellPool = pool.filter(c => !isCreatureCardData(c));
  const chosen = [
    ...creaturePool.slice(0, creatures),
    ...spellPool.slice(0, spells)
  ];
  if (chosen.length < 12) return null;

  const basics = await realBasicsFor(colors, lands, owner);
  return shuffleCopy([...chosen, ...basics]);
}

// A generic opponent deck for ordinary formats, scaled by difficulty.
async function buildRealAiDeck(tier){
  const pair = TWO_COLOR_PAIRS[Math.floor(Math.random() * TWO_COLOR_PAIRS.length)];
  const id = pair.join('').toLowerCase();
  const scope = { easy: 'legal:pauper', normal: 'legal:pioneer', hard: 'legal:commander r>=uncommon' }[tier] || 'legal:pioneer';
  return buildDeckFromPool({
    query: `${scope} id<=${id} -t:land game:paper cmc<=6`,
    colors: pair, owner: 'ai', creatures: 16, spells: 7, lands: 17
  });
}

// The boss plays real black/red threats and removal.
async function buildRealBossDeck(tier){
  const scope = { easy: 'legal:pauper', normal: 'legal:pioneer', hard: 'legal:commander r>=rare' }[tier] || 'legal:pioneer';
  const minPower = { easy: 0, normal: 3, hard: 4 }[tier] || 0;
  return buildDeckFromPool({
    query: `${scope} id<=br -t:land game:paper cmc<=7`,
    colors: ['B', 'R'], owner: 'boss',
    creatures: { easy: 20, normal: 24, hard: 26 }[tier] || 24,
    spells: { easy: 6, normal: 8, hard: 10 }[tier] || 8,
    lands: 22,
    creatureFilter: (c) => (parseInt(c.power, 10) || 0) >= minPower
  });
}

// The survivors' starter deck: real white/green creatures and tricks.
async function buildRealSurvivorDeck(){
  return buildDeckFromPool({
    query: 'legal:pioneer id<=gw -t:land game:paper cmc<=5',
    colors: ['W', 'G'], owner: 'survivor', creatures: 20, spells: 8, lands: 22
  });
}

// Real printed token cards for the Horde. The reveal/attack engine keys off
// "Token" in the type line, which real token cards carry.
async function buildRealHordeDeck(tier){
  const counts = { easy: { fodder: 24, giants: 2 }, normal: { fodder: 58, giants: 8 }, hard: { fodder: 78, giants: 16 } }[tier];
  const arts = await realCardsFrom('is:token t:creature game:paper', 16);
  if (arts.length < 5) return null;
  const power = (c) => parseInt(c.power, 10) || 0;
  const small = arts.filter(c => power(c) <= 3);
  const big = arts.filter(c => power(c) >= 4);
  const pickFrom = (list, i) => (list.length ? list[i % list.length] : arts[i % arts.length]);
  const clone = (base, i) => ({ ...base, id: `${base.id}_h${i}`, isToken: true, hordeRole: 'token', realCard: true });
  const deck = [];
  for (let i = 0; i < counts.fodder; i++) deck.push(clone(pickFrom(small, i), i));
  for (let i = 0; i < counts.giants; i++) deck.push(clone(pickFrom(big, i), 1000 + i));
  // The action cards are variant instructions, not real Magic cards.
  const actions = { easy: { surge: 1, regrow: 1, drain: 1, untap: 2 }, normal: { surge: 4, regrow: 4, drain: 5, untap: 4 }, hard: { surge: 8, regrow: 6, drain: 8, untap: 5 } }[tier];
  for (let i = 0; i < actions.surge; i++) deck.push(makeHordeAction('Mindless Surge', 'Reveal two extra Horde cards.', 'surge'));
  for (let i = 0; i < actions.regrow; i++) deck.push(makeHordeAction('Graveborn Return', 'Return up to two Horde tokens from the graveyard to the battlefield.', 'regrow'));
  for (let i = 0; i < actions.drain; i++) deck.push(makeHordeAction('Gnawing Dread', 'Each survivor loses 2 life.', 'drain'));
  for (let i = 0; i < actions.untap; i++) deck.push(makeHordeAction('Endless Moan', 'Untap all Horde creatures.', 'untap'));
  return shuffleCopy(deck);
}

// Real cards for starter cubes and Winston pools.
async function buildRealStarterPool(size){
  const cards = await realCardsFrom('legal:pauper -t:land game:paper', size);
  return cards.length >= Math.min(24, size) ? shuffleCopy(cards) : null;
}

// Real-card jumpstart packets, themed like the generated ones.
const JUMPSTART_REAL_QUERIES = {
  goblins: 'legal:pauper id<=r t:goblin game:paper',
  flyers: 'legal:pauper id<=u t:creature o:flying game:paper',
  graveyard: 'legal:pauper id<=b o:graveyard game:paper',
  'big-green': 'legal:pauper id<=g t:creature pow>=3 game:paper',
  lifegain: 'legal:pauper id<=w o:"gain" o:"life" game:paper',
  artifacts: 'legal:pauper t:artifact -t:land game:paper'
};

async function buildRealJumpstartDeck(themeAId, themeBId){
  const parts = [];
  for (const themeId of [themeAId, themeBId]) {
    const theme = JUMPSTART_THEMES.find(t => t.id === themeId) || JUMPSTART_THEMES[0];
    const spells = await realCardsFrom(JUMPSTART_REAL_QUERIES[theme.id] || 'legal:pauper -t:land game:paper', 12);
    if (spells.length < 8) return null;
    await resolveLandArt(theme.land);
    const lands = [];
    for (let i = 0; i < 8; i++) lands.push({ ...makeBasicLandCard(theme.land, `${theme.id}_${i}`, 'jump'), realCard: true });
    parts.push({ theme, cards: [...spells, ...lands] });
  }
  return {
    name: `${parts[0].theme.title} + ${parts[1].theme.title}`,
    cards: shuffleCopy(parts.flatMap(p => p.cards))
  };
}

// Replace a generated deck slot with its real-card version once fetched.
// Guards: the game must not have started, and the slot must still hold the
// same generated deck (kind match, not yet real) — a deck the player built
// or a newer build always wins.
const _realBuildTokens = {};
function upgradeDeckSlot(slotKey, kind, buildFn){
  const current = state.decks[slotKey] || [];
  if (current[0] && current[0].realCard) return;         // already real
  const token = Symbol(kind);
  _realBuildTokens[slotKey] = token;
  Promise.resolve().then(buildFn).then(cards => {
    if (!cards || !cards.length) return;
    if (_realBuildTokens[slotKey] !== token) return;
    if (state.gameStarted) return;
    if (deckAutoKind(state.decks[slotKey]) !== kind) return;
    state.decks[slotKey] = tagAutoDeck(cards, kind);
    render();
  }).catch(() => { /* offline: the generated deck stands */ });
}

// Kick off real-card upgrades for whatever the current mode auto-built.
function scheduleRealDeckUpgrades(mode){
  if (!mode || !navigator.onLine) return;
  const tier = aiTier();
  if (mode.autoDeck === 'horde') {
    upgradeDeckSlot('player1', 'survivor', () => buildRealSurvivorDeck());
    upgradeDeckSlot('player2', 'horde:' + tier, () => buildRealHordeDeck(tier));
  } else if (mode.autoDeck === 'boss') {
    upgradeDeckSlot('player1', 'survivor', () => buildRealSurvivorDeck());
    upgradeDeckSlot('player2', 'boss:' + tier, () => buildRealBossDeck(tier));
  }
}

// Fetch the printings offered by the land picker.
async function fetchLandPrintings(landName, limit = 60){
  const q = `t:basic type:${landName} game:paper`;
  const r = await scryfetch(
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=art&order=released&dir=desc`,
    { headers: { Accept: 'application/json' } }
  );
  if (!r.ok) return [];
  const data = await r.json();
  return (Array.isArray(data.data) ? data.data : [])
    .filter(c => c.image_uris?.normal)
    .slice(0, limit)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type_line || `Basic Land — ${landName}`,
      imageUrl: c.image_uris.normal,
      set: (c.set || '').toUpperCase(),
      setName: c.set_name || '',
      artist: c.artist || ''
    }));
}

function saveLocal(){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 2,
      cards: state.cards,
      decks: state.decks,
      modeSetups: state.modeSetups || {},
      selectedMode: state.selectedMode,
      battleMode: state.battleMode,
      studioTab: state.studioTab,
      aiDifficulty: state.aiDifficulty,
      turnServer: state.turnServer || null,
      deckLibrary: state.deckLibrary || [],
      strictMana: !!state.strictMana,
      handZoom: state.handZoom || 1,
      landArt: state.landArt || {}
    }));
  } catch (e) { /* quota exceeded or storage disabled — fail silently */ }
}
function scheduleSave(){
  if (_saveTimer) return;                       // debounce: coalesce frequent renders
  _saveTimer = setTimeout(() => { _saveTimer = null; saveLocal(); }, 500);
}
function loadLocal(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.cards)) state.cards = data.cards;
    if (data.decks && typeof data.decks === 'object') {
      if (Array.isArray(data.decks.player1)) state.decks.player1 = data.decks.player1;
      if (Array.isArray(data.decks.player2)) state.decks.player2 = data.decks.player2;
    }
    if (data.modeSetups && typeof data.modeSetups === 'object') state.modeSetups = data.modeSetups;
    if (data.landArt && typeof data.landArt === 'object') state.landArt = data.landArt;
    if (data.aiDifficulty) state.aiDifficulty = data.aiDifficulty;
    if (data.turnServer && typeof data.turnServer === 'object') state.turnServer = data.turnServer;
    if (Array.isArray(data.deckLibrary)) state.deckLibrary = data.deckLibrary;
    if (typeof data.strictMana === 'boolean') state.strictMana = data.strictMana;
    if (typeof data.handZoom === 'number') state.handZoom = data.handZoom;
    if (data.selectedMode) state.selectedMode = data.selectedMode;
    if (data.battleMode) state.battleMode = data.battleMode;
    if (data.studioTab) state.studioTab = data.studioTab;
  } catch (e) { /* corrupt save — ignore and start fresh */ }
}

// Host broadcasts the full authoritative Draft-off snapshot to the joiner.
function broadcastDraftState(phase){
  const D = state.draft;
  if (!D || D.off.isLocal || !state.isHost) return;
  if (!(state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open')) return;
  state.dataChannel.send(JSON.stringify({
    type: 'draftoff_state',
    phase: phase || 'draft',
    round: D.off.round,
    table: D.off.table,
    p1: D.off.p1,
    p2: D.off.p2,
    currentPicker: D.off.currentPicker,
    startingPlayer: D.off.startingPlayer,
    picksMadeThisPack: D.off.picksMadeThisPack
  }));
}
window.broadcastDraftState = broadcastDraftState;

function draftOffCheckFinishOrNextPack(){
  const D = state.draft;

  const doneP1 = D.off.p1.length >= 42;
  const doneP2 = D.off.p2.length >= 42;

  if (doneP1 && doneP2){
    // Move to basic-lands fill window
    D.screen = 'landsfill';
    // initialize lands fill state for the first player who will fill (1 in local; "me" online)
    initLandsFill(D.off.isLocal ? 1 : state.currentPlayer);
    render();
    if (!D.off.isLocal) broadcastDraftState('landsfill');
    return;
  }

  // Not finished: only the host (or a local hotseat) generates the next pack;
  // the joiner receives it via the next draftoff_state snapshot.
  if (D.off.isLocal || state.isHost){
    if (window.draftOffStartNewPack) window.draftOffStartNewPack(true);
  }
}


// --- Mana Curve helpers ---
// Canonical mana-cost → numeric CMC. Used app-wide (top-level so it's in scope everywhere).
function getCMC(card) {
  if (card && typeof card.cmc === 'number' && Number.isFinite(card.cmc)) return Math.max(0, Math.floor(card.cmc));
  const s = (card?.manaCost || card?.manacost || card?.cost || '').toString();
  if (!s) return null;
  if (s.includes('{')) {
    const tokens = s.match(/\{([^}]+)\}/g) || [];
    let sum = 0;
    for (const t of tokens) {
      const inner = t.slice(1, -1);
      const n = parseInt(inner, 10);
      if (Number.isFinite(n)) { sum += n; continue; }
      // A hybrid/phyrexian token like {G/U} or {W/P} is a SINGLE pip, so count
      // the token once rather than once per letter inside it.
      const letters = inner.toUpperCase().split(/[^A-Z]/).join('');
      if ([...letters].some(ch => 'WUBRGCS'.includes(ch))) sum += 1;  // X → 0
    }
    return sum;
  }
  const digits = (s.match(/\d+/g) || []).map(x => parseInt(x,10)).reduce((a,b)=>a+b,0);
  const letters = (s.toUpperCase().match(/[WUBRGC]/g) || []).length;
  return digits + letters;
}

function manaCurveData(cards) {
  const counts = new Map();
  for (const c of (cards || [])) {
    const cmc = getCMC(c);
    if (cmc === null || !Number.isFinite(cmc)) continue;
    counts.set(cmc, (counts.get(cmc) || 0) + 1);
  }
  if (counts.size === 0) return { bins: [], max: 0 };

  const min = Math.min(...counts.keys());
  const max = Math.max(...counts.keys());
  const bins = [];
  let peak = 0;
  for (let k = min; k <= max; k++) {
    const v = counts.get(k) || 0;
    bins.push({ cmc: k, count: v });
    if (v > peak) peak = v;
  }
  return { bins, max: peak };
}

function renderManaCurve(containerId, cards) {
  const root = document.getElementById(containerId);
  if (!root) return;
  const { bins, max } = manaCurveData(cards);
  if (bins.length === 0) {
    root.innerHTML = `<div class="mana-curve-wrap">
      <div class="mana-curve-title">Mana Curve</div>
      <div style="opacity:.7; font-size:12px;">No mana-cost data in this deck.</div>
    </div>`;
    return;
  }
  
const cols = bins.map(b => {
  const h = max ? Math.max(4, Math.round((b.count / max) * 100)) : 0;
  const label = `${b.count} card${b.count===1 ? '' : 's'} at CMC ${b.cmc}`;
  return `
    <div class="mc-col">
      <div class="mc-bar" style="height:${h}%" title="${label}" aria-label="${label}"></div>
    </div>`;
}).join('');


  const labels = bins.map(b => `<div>${b.cmc}</div>`).join('');

  root.innerHTML = `
    <div class="mana-curve-wrap">
      <div class="mana-curve-title">Mana Curve</div>
      <div class="mana-curve" style="--bins:${bins.length}">${cols}</div>
      <div class="mc-x" style="--bins:${bins.length}">${labels}</div>
    </div>`;
}


function getDeckForChart() {
  const meKey = 'player' + state.currentPlayer;
  // Try common working-deck shapes first
  if (Array.isArray(state.currentDeck)) return state.currentDeck;
  if (state.deckBuilder?.cards && Array.isArray(state.deckBuilder.cards)) return state.deckBuilder.cards;
  if (Array.isArray(state.deck)) return state.deck;
  // Fallback: the deck synced per player
  return state.decks?.[meKey] || [];
}



function nInt(x) {
  const v = parseInt(x, 10);
  return Number.isFinite(v) ? v : 0;
}

// Effective (base + modifiers) P/T
function effectivePT(card) {
  // base values from card definition (or 0 if not a creature)
  const baseP = nInt(card.power);
  const baseT = nInt(card.toughness);

  // deltas from new system; fall back to old 'counters' if present
  const dP = (card && card.pt && typeof card.pt.p === 'number') ? card.pt.p : (card?.counters || 0);
  const dT = (card && card.pt && typeof card.pt.t === 'number') ? card.pt.t : (card?.counters || 0);

  // Static anthems ("Other creatures you control get +1/+1") in bot games.
  let sP = 0, sT = 0;
  const rules = window.GALDUR_RULES;
  if (rules && rules.active() && !_inStaticBonus) {
    _inStaticBonus = true;                       // staticBonus calls back here
    try {
      const owner = _ownerOfCard(card);
      if (owner) { const b = rules.staticBonus(card, owner); sP = b.p; sT = b.t; }
    } finally { _inStaticBonus = false; }
  }

  return { p: baseP + dP + sP, t: baseT + dT + sT };
}

// Guard against the mutual recursion between effectivePT and staticBonus.
let _inStaticBonus = false;

function _ownerOfCard(card){
  const gs = state.gameState;
  if (!gs || !card) return null;
  for (const key of ['player1', 'player2']) {
    if (battlefieldCards(gs[key]).includes(card)) return gs[key];
  }
  return null;
}

function addGameLog(message, type = 'note', payload = {}){
  if (!message) return;
  state.gameLog = state.gameLog || [];
  state.gameLog.unshift({
    id: makeId('log'),
    message,
    type,
    payload,
    at: Date.now(),
    player: state.currentPlayer,
    activePlayer: state.activePlayer,
    mode: state.gameState?.mode || state.battleMode || state.selectedMode
  });
  state.gameLog = state.gameLog.slice(0, 60);
}

function cloneJSON(value){
  return JSON.parse(JSON.stringify(value));
}

function gameSnapshot(actionType = 'action'){
  return {
    id: makeId('history'),
    actionType,
    savedAt: Date.now(),
    gameState: cloneJSON(state.gameState),
    activePlayer: state.activePlayer,
    winner: state.winner,
    selectedCard: state.selectedCard,
    selectedFieldCard: state.selectedFieldCard,
    selectedZoneCard: null,
    viewingZone: null,
    targeting: null
  };
}

function pushGameHistory(actionType){
  if (!state.gameStarted || !state.gameState) return;
  state.gameHistory = state.gameHistory || [];
  state.gameHistory.unshift(gameSnapshot(actionType));
  state.gameHistory = state.gameHistory.slice(0, 30);
}

function restoreGameSnapshot(snapshot){
  if (!snapshot) return false;
  state.gameState = normalizeGameStateZones(cloneJSON(snapshot.gameState));
  state.activePlayer = snapshot.activePlayer;
  state.winner = snapshot.winner;
  state.selectedCard = snapshot.selectedCard;
  state.selectedFieldCard = snapshot.selectedFieldCard;
  state.selectedZoneCard = snapshot.selectedZoneCard;
  state.viewingZone = snapshot.viewingZone;
  state.targeting = snapshot.targeting;
  return true;
}

// ---------------------------------------------------------------------------
// Replays
//
// Every game action already produces a clean state transition, so recording a
// snapshot per action gives a scrubable replay for free. Frames are capped so
// a long game cannot grow without bound, and a replay is a plain JSON file the
// player can save and re-open — which doubles as spectating after the fact.
// ---------------------------------------------------------------------------

const REPLAY_MAX_FRAMES = 400;

// A frame keeps everything a viewer can see, but libraries are stored as a
// COUNT rather than their contents — the deck is most of the bytes and none of
// it is visible in a replay. This is the difference between a ~15KB frame and
// a ~2KB one.
function compressGameState(gs){
  const slimPlayer = (p) => ({
    creatureField: p.creatureField, supportField: p.supportField, landField: p.landField,
    hand: p.hand, graveyard: p.graveyard, exile: p.exile, commanderZone: p.commanderZone,
    health: p.health, deckCount: (p.deck || []).length
  });
  return cloneJSON({
    player1: slimPlayer(gs.player1),
    player2: slimPlayer(gs.player2),
    shared: gs.shared ? { ...gs.shared, deck: [], deckCount: (gs.shared.deck || []).length } : null,
    stack: gs.stack, phase: gs.phase, mode: gs.mode
  });
}

// Rebuild a playable-looking state: libraries become face-down filler so the
// counts on screen are right.
function expandGameState(slim){
  const filler = (n) => Array.from({ length: n || 0 }, (_, i) => ({
    id: 'replay-hidden-' + i, name: 'Card', type: '', cost: '', colors: [], effect: '',
    power: 0, toughness: 0, imageUrl: ''
  }));
  const fat = (p) => ({ ...p, deck: filler(p.deckCount) });
  return {
    player1: fat(slim.player1),
    player2: fat(slim.player2),
    shared: slim.shared ? { ...slim.shared, deck: filler(slim.shared.deckCount) } : { enabled: false, label: '', deck: [], graveyard: [], exile: [] },
    stack: slim.stack || [], phase: slim.phase, mode: slim.mode
  };
}

function recordReplayFrame(actionType, message){
  if (!state.gameStarted || state.replayMode) return;
  state.replay = state.replay || { frames: [], mode: null, startedAt: Date.now() };
  const frames = state.replay.frames;
  frames.push({
    n: frames.length,
    actionType,
    message: message || '',
    at: Date.now(),
    activePlayer: state.activePlayer,
    winner: state.winner || null,
    gameState: compressGameState(state.gameState)
  });
  // Drop the oldest frames rather than the newest: the end of a game is the
  // interesting part.
  if (frames.length > REPLAY_MAX_FRAMES) frames.splice(0, frames.length - REPLAY_MAX_FRAMES);
}

function startReplayRecording(modeId){
  state.replay = { frames: [], mode: modeId, startedAt: Date.now() };
}

function replayToFile(){
  const rep = state.replay;
  if (!rep || !rep.frames.length) { toast('Nothing recorded yet.'); return; }
  const payload = {
    format: 'galdur-replay-1',
    mode: rep.mode || state.battleMode,
    recordedAt: rep.startedAt,
    frames: rep.frames
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `galdur-replay-${new Date(rep.startedAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Replay saved — ${rep.frames.length} moments.`);
}

function enterReplay(data){
  if (!data || data.format !== 'galdur-replay-1' || !Array.isArray(data.frames) || !data.frames.length) {
    toast('That is not a Galdur replay file.');
    return false;
  }
  state.replayMode = true;
  state.replayData = data;
  state.replayIndex = data.frames.length - 1;
  state.battleMode = data.mode || state.battleMode;
  state.gameStarted = true;
  state.screen = 'game';
  showReplayFrame(state.replayIndex);
  return true;
}

function showReplayFrame(i){
  const data = state.replayData;
  if (!data) return;
  const idx = Math.max(0, Math.min(i, data.frames.length - 1));
  const frame = data.frames[idx];
  state.replayIndex = idx;
  state.gameState = normalizeGameStateZones(expandGameState(frame.gameState));
  state.activePlayer = frame.activePlayer;
  state.winner = frame.winner;
  state.selectedCard = null;
  state.selectedFieldCard = null;
  state.viewingZone = null;
  state.targeting = null;
  render();
}

function stopReplayPlayback(){
  if (state.replayPlaying) { clearInterval(state.replayPlaying); state.replayPlaying = null; }
}

function exitReplay(){
  stopReplayPlayback();
  state.replayMode = false;
  state.replayData = null;
  state.replayIndex = 0;
  state.gameStarted = false;
  state.winner = null;
  state.screen = 'menu';
  render();
}

function executeGameAction(type, payload, mutator, message, options = {}){
  // Replays are read-only: nothing may mutate the board while watching.
  if (state.replayMode) return null;
  pushGameHistory(type);
  const result = typeof mutator === 'function' ? mutator() : null;
  const resolvedMessage = typeof message === 'function' ? message(result) : message;
  // Log BEFORE syncing, or the payload's gameLog omits the very entry that
  // describes the action being sent and the peer's log loses it forever.
  if (resolvedMessage) showAction(resolvedMessage, options.ms || 2000, options.log !== false, type, payload);
  if (options.sync !== false) sendGameUpdate();
  recordReplayFrame(type, resolvedMessage);
  if (!resolvedMessage) render();
  return result;
}

function undoLastGameAction(){
  const snapshot = (state.gameHistory || []).shift();
  if (!snapshot) {
    showAction('Nothing to undo.', 1600, false);
    return;
  }
  restoreGameSnapshot(snapshot);
  addGameLog(`Undid ${snapshot.actionType}.`, 'undo', { actionType: snapshot.actionType });
  // Undo rewinds BOTH boards locally, so a my-side-only gameUpdate would leave
  // the peer holding a board this client no longer believes in. Send it all.
  sendFullGameSync();
  render();
}

// --- NEW: in-game center overlay for actions, with optional broadcast ---
let _actionTimer = null;
function showAction(message, ms = 2000, log = true, type = 'note', payload = {}) {
  if (log) addGameLog(message, type, payload);
  state.actionMessage = message;
  // Cancel the previous overlay's timer, or it fires mid-way through this
  // message and clears it early.
  if (_actionTimer) clearTimeout(_actionTimer);
  render();
  _actionTimer = setTimeout(() => { _actionTimer = null; state.actionMessage = null; render(); }, ms);
}

function broadcastAction(message) {
  // Always show locally
  showAction(message);
  // And notify peer if online
  if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
    state.dataChannel.send(JSON.stringify({ type: 'notify', message }));
  }
}


function sendGameUpdate() {
  if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
    const meKey = 'player' + state.currentPlayer;
    // Send ONLY my own board so concurrent edits never clobber the opponent's side.
    state.dataChannel.send(JSON.stringify({
      type: 'gameUpdate',
      from: state.currentPlayer,
      mine: state.gameState[meKey],
      shared: state.gameState.shared,
      stack: state.gameState.stack,
      phase: state.gameState.phase,
      mode: state.gameState.mode,
      gameStarted: state.gameStarted,
      activePlayer: state.activePlayer,
      winner: state.winner,
      gameLog: state.gameLog
    }));
  }
}

// Authoritative full-state push, used when one side rewinds shared history
// (undo) and a my-side-only delta would desync the peer.
function sendFullGameSync() {
  if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
    state.dataChannel.send(JSON.stringify({
      type: 'gameSync',
      gameState: state.gameState,
      activePlayer: state.activePlayer,
      winner: state.winner,
      gameStarted: state.gameStarted,
      gameLog: state.gameLog
    }));
  }
}

// Host deals the opening hands/decks for both sides, so both peers agree on the
// shuffled order. Sent once at game start as a full-state snapshot.
function sendGameInit() {
  if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
    state.dataChannel.send(JSON.stringify({
      type: 'gameInit',
      gameState: state.gameState,
      mode: state.gameState.mode,
      stack: state.gameState.stack,
      phase: state.gameState.phase,
      activePlayer: state.activePlayer,
      gameStarted: true,
      gameLog: state.gameLog
    }));
  }
}

function setupDataChannel(channel) {
  state.dataChannel = channel;
  state.dataChannel.onopen = () => {
    console.log('Connected!');
    // Send my deck tagged with my seat. Sending the whole slot map fails now
    // that everyone builds into the same local slot: both sides would look for
    // the opponent under a slot name the sender never used.
    state.dataChannel.send(JSON.stringify({
      type: 'deckSync',
      from: state.currentPlayer,
      deck: state.decks['player' + state.currentPlayer] || []
    }));

    // Auto-enter the Draft-off room and start the first pack (host only)
if (state.screen === 'draft' && state.draft && state.draft.mode === 'draftoff') {
  const D = state.draft;
  D.screen = 'draftoff';       // ensure main Draft subview
  D.off.screen = 'draftoff';   // optional mirror
  D.off.isLocal = false;       // mark as online mode
  D.off.round = 0;
  D.off.p1 = [];
  D.off.p2 = [];
  D.off.table = [];
  D.off.currentSet = null;
  D.off.startingPlayer = 1;
  D.off.currentPicker  = 1;
  D.off.p1LandsDone = false;
  D.off.p2LandsDone = false;
  D.seenIds = {};
  D.seenNames = {};
  render();
  if (state.isHost) {
 if (window.draftOffStartNewPack) window.draftOffStartNewPack(true);  // host picks first in round 1
  }
}

  };
    
    // --- WebRTC datachannel handlers ---
state.dataChannel.onmessage = (event) => {
  const D = state.draft;
  try {
    const data = JSON.parse(event.data);

    if (data.type === 'deckSync') {
      if (typeof data.from === 'number' && Array.isArray(data.deck)) {
        state.decks['player' + data.from] = data.deck;          // file under the sender's seat
      } else if (data.decks) {
        // Back-compat with peers on the previous build.
        const oppKey = 'player' + (state.currentPlayer === 1 ? 2 : 1);
        if (data.decks[oppKey]) state.decks[oppKey] = data.decks[oppKey];
      }
      render();

    } else if (data.type === 'gameInit') {
      // Host dealt both sides; adopt the full opening snapshot.
      state.gameState = normalizeGameStateZones(data.gameState);
      state.gameStarted = true;
      state.activePlayer = data.activePlayer;
      state.gameLog = Array.isArray(data.gameLog) ? data.gameLog : [];
      state.winner = null;
      if (state.activePlayer === state.currentPlayer) {
        state.showTurnNotification = true;
        setTimeout(() => { state.showTurnNotification = false; render(); }, 2000);
      }
      render();

    } else if (data.type === 'gameUpdate') {
      // Adopt ONLY the sender's own board; never touch my own side.
      if (typeof data.from === 'number' && data.mine) {
        state.gameState['player' + data.from] = normalizePlayerZones(data.mine);
      } else if (data.gameState) {
        state.gameState = normalizeGameStateZones(data.gameState);   // back-compat with full snapshots
      }
      if (data.shared) state.gameState.shared = data.shared;
      if (Array.isArray(data.stack)) state.gameState.stack = data.stack;
      if (data.phase) state.gameState.phase = data.phase;
      if (data.mode) state.gameState.mode = data.mode;
      state.gameStarted = data.gameStarted;
      if (Array.isArray(data.gameLog)) state.gameLog = data.gameLog;

      const previousPlayer = state.activePlayer;
      state.activePlayer = data.activePlayer;
      state.winner = data.winner;

      // If it just became this player's turn, flash the turn notice
      if (previousPlayer !== state.activePlayer && state.activePlayer === state.currentPlayer) {
        state.showTurnNotification = true;
        setTimeout(() => {
          state.showTurnNotification = false;
          render();
        }, 2000);
      }

      render();

    } else if (data.type === 'gameSync') {
      // Peer rewound shared history (undo): adopt their full snapshot.
      state.gameState = normalizeGameStateZones(data.gameState);
      state.activePlayer = data.activePlayer;
      state.winner = data.winner;
      state.gameStarted = data.gameStarted;
      if (Array.isArray(data.gameLog)) state.gameLog = data.gameLog;
      render();

    } else if (data.type === 'notify') {
      // NEW: action overlay (deck → hand, etc.)
      showAction(data.message);
    }
    
        else if (data.type === 'draftoff_state') {
      // Host is authoritative; the joiner adopts each snapshot wholesale.
      if (state.isHost) return;
      D.mode = 'draftoff';
      D.off.isLocal = false;
      D.off.round = data.round;
      D.off.table = (data.table || []).slice();
      D.off.p1 = (data.p1 || []).slice();
      D.off.p2 = (data.p2 || []).slice();
      D.off.currentPicker = data.currentPicker;
      D.off.startingPlayer = data.startingPlayer;
      D.off.picksMadeThisPack = data.picksMadeThisPack || 0;
      if (data.phase === 'landsfill') {
        // enter my own lands-fill once; don't clobber it if I'm already filling/waiting
        if (D.screen !== 'landsfill' && D.screen !== 'landswait' && D.screen !== 'decklists') {
          D.screen = 'landsfill';
          initLandsFill(state.currentPlayer);
        }
      } else {
        D.screen = 'draftoff';
      }
      render();
    }
    else if (data.type === 'draftoff_pick_request') {
      // Host only: validate it's the joiner's turn, then apply authoritatively.
      if (!state.isHost) return;
      if (D.off.currentPicker !== 2) return;
      if (window.draftOffApplyPick) window.draftOffApplyPick(data.index, 2);
    }
    // Handle opponent finishing their lands fill
    else if (data.type === 'draftoff_lands_done') {
      const oppPlayer = data.player; // 1 or 2
      const oppDeck = data.deck || [];

      // Update opponent's deck
      if (oppPlayer === 1) {
        D.off.p1 = oppDeck;
        D.off.p1LandsDone = true;
      } else {
        D.off.p2 = oppDeck;
        D.off.p2LandsDone = true;
      }

      // Check if both players are done with lands
      const myPlayer = state.currentPlayer;
      const myDone = (myPlayer === 1) ? D.off.p1LandsDone : D.off.p2LandsDone;
      const oppDone = (oppPlayer === 1) ? D.off.p1LandsDone : D.off.p2LandsDone;

      if (myDone && oppDone) {
        // Both done - go to results screen
        state.decks.player1 = (D.off.p1 || []).slice();
        state.decks.player2 = (D.off.p2 || []).slice();
        D.screen = 'decklists';
      }
      render();
    }


  } catch (e) {
    console.error('dataChannel onmessage error:', e, event?.data);
  }
};

state.dataChannel.onclose = () => {
  // A channel we closed ourselves also fires onclose — don't alarm the player
  // who chose to leave.
  if (state.leavingOnline) return;
  toast('Connection closed — the other player disconnected.', 3200);
  disconnectOnline();
  state.screen = 'menu';
  render();
};

    
  }

const STUN_SERVERS = [
  { urls: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun.cloudflare.com:3478'
  ] }
];

// STUN alone cannot get through symmetric NAT — some corporate networks and a
// few mobile carriers. That needs a TURN relay, which needs a server this
// static site has no way to host. So the player can supply their own: any
// TURN service works, and several have free tiers. Stored locally, never sent
// anywhere except to the browser's own WebRTC stack.
// One validator, used by both the ICE config and the UI badge, so the badge can
// never claim a relay the connection would silently discard.
function validTurnUrls(raw){
  return String(raw || '').split(',').map(u => u.trim())
    .filter(u => /^(turns?|stun):\S+$/i.test(u));
}

function iceServers(){
  const t = state.turnServer;
  try {
    if (t && t.urls) {
      const urls = validTurnUrls(t.urls);
      if (urls.length) {
        const entry = { urls };
        if (t.username) entry.username = String(t.username);
        if (t.credential) entry.credential = String(t.credential);
        return [...STUN_SERVERS, entry];
      }
      console.warn('Ignoring malformed TURN url(s):', t.urls);
    }
  } catch (e) {
    console.warn('Ignoring unusable TURN config:', e);
  }
  return STUN_SERVERS;
}

const ICE_HARD_CAP_MS = 20000;   // never hang forever
const ICE_GRACE_MS = 1200;       // after STUN answers, allow a moment for more

// Wait for ICE gathering before handing the player a code to copy.
//
// This MUST NOT be cut short on a fixed timer. With manual copy-paste
// signalling the SDP is the ONLY chance to exchange candidates, and the
// server-reflexive (srflx) candidates that STUN discovers — the ones that let
// two people on different networks connect — arrive later than the local host
// candidates. Truncating gathering ships a code containing only LAN addresses,
// which then works on one Wi-Fi and nowhere else.
//
// So: resolve on 'complete'; allow an early finish only once STUN has actually
// answered (plus a short grace for more candidates); otherwise wait out the cap.
function waitForIceGathering(pc){
  return new Promise(resolve => {
    // Do NOT claim srflx here: gathering may already be complete having found
    // only host candidates. The caller reads the finished SDP instead.
    if (pc.iceGatheringState === 'complete') return resolve({ srflx: false, complete: true });

    let done = false;
    let sawSrflx = false;
    let graceTimer = null;

    const finish = (complete) => {
      if (done) return;
      done = true;
      clearTimeout(hardCap);
      clearTimeout(graceTimer);
      resolve({ srflx: sawSrflx, complete: !!complete });
    };

    const hardCap = setTimeout(() => finish(false), ICE_HARD_CAP_MS);

    pc.addEventListener('icecandidate', (e) => {
      const cand = e.candidate && e.candidate.candidate;
      if (!cand) return;                       // null candidate = gathering done
      // "typ srflx" (STUN) or "typ relay" (TURN) means an internet-routable
      // address made it in; host-only codes are LAN-only.
      if (/ typ (srflx|relay)/.test(cand) && !sawSrflx) {
        sawSrflx = true;
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => finish(false), ICE_GRACE_MS);
      }
    });

    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') finish(true);
    });
  });
}

// True when a code carries an address reachable from outside the local network.
function sdpHasPublicCandidate(sdp){
  return / typ (srflx|relay)/.test(String(sdp || ''));
}

function sdpHasRelayCandidate(sdp){
  return / typ relay/.test(String(sdp || ''));
}

// Human-readable summary of what the generated code can actually reach.
function describeCandidates(sdp){
  const text = String(sdp || '');
  const relay = / typ relay/.test(text);
  const srflx = / typ srflx/.test(text);
  if (relay) return 'relay ready — works on restrictive networks';
  if (srflx) return 'direct connection — works across most networks';
  return 'local network only';
}

// Verify a TURN config by gathering candidates against it and looking for a
// relay candidate. Answers the only question that matters: does it work?
async function testRelay(turn){
  const entry = { urls: turn.urls.split(',').map(u => u.trim()).filter(Boolean) };
  if (turn.username) entry.username = turn.username;
  if (turn.credential) entry.credential = turn.credential;
  let pc;
  try {
    pc = new RTCPeerConnection({ iceServers: [entry], iceTransportPolicy: 'relay' });
    pc.createDataChannel('probe');
    await pc.setLocalDescription(await pc.createOffer());
    return await new Promise(resolve => {
      const done = setTimeout(() => resolve(false), 8000);
      pc.addEventListener('icecandidate', e => {
        if (e.candidate && / typ relay/.test(e.candidate.candidate)) {
          clearTimeout(done); resolve(true);
        }
      });
    });
  } catch {
    return false;
  } finally {
    try { pc && pc.close(); } catch {}
  }
}

// Surface connection progress/failure; the manual-signaling flow otherwise
// leaves both players staring at a screen that never changes.
function watchConnection(pc){
  const update = () => {
    const s = pc.connectionState || pc.iceConnectionState;
    state.connectionStatus = s;
    if (s === 'failed') {
      toast('Connection failed. Re-copy a fresh code from the host and try again — codes expire once a connection attempt fails.', 6000);
    } else if (s === 'disconnected') {
      toast('Connection lost — trying to recover…', 3000);
    }
    render();
  };
  pc.addEventListener('connectionstatechange', update);
  pc.addEventListener('iceconnectionstatechange', update);
}

async function createOnlineRoom() {
  state.isHost = true;
  state.onlineMode = true;
  state.roomCode = 'waiting';
  state.connectionStatus = 'gathering';
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  state.peerConnection = pc;
  state.currentPlayer = 1;  // host = player 1
  watchConnection(pc);

  setupDataChannel(pc.createDataChannel('game'));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const gather = await waitForIceGathering(pc);
  const sdp = pc.localDescription;
  state.roomCode = btoa(JSON.stringify({ offer: sdp }));
  // The generated SDP is the only thing the other player receives, so it — not
  // the gathering bookkeeping — decides whether this code can leave the LAN.
  state.localOnlyCode = !sdpHasPublicCandidate(sdp && sdp.sdp);
  state.candidateSummary = describeCandidates(sdp && sdp.sdp);
  state.waitingForAnswer = true;
  state.connectionStatus = state.localOnlyCode
    ? 'local network only — see the warning below'
    : 'waiting for the answer code';
  render();
}

async function joinOnlineRoom(offerStr) {
  state.isHost = false;
  state.onlineMode = true;
  state.roomCode = 'connecting';
  try {
    const data = JSON.parse(atob(offerStr));
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    state.peerConnection = pc;
    state.onlineMode = true;
    state.isHost = false;
    state.currentPlayer = 2; // joiner = player 2
    // Everyone builds into slot 1 locally, so move this player's deck to the
    // seat they actually occupy online — otherwise their own side looks empty.
    if ((state.decks.player1 || []).length && !(state.decks.player2 || []).length) {
      state.decks.player2 = state.decks.player1;
      state.decks.player1 = [];
    }
    state.connectionStatus = 'gathering';
    watchConnection(pc);
    pc.ondatachannel = (e) => setupDataChannel(e.channel);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const gather = await waitForIceGathering(pc);
    const sdp = pc.localDescription;
    state.answerCode = btoa(JSON.stringify({ answer: sdp }));
    state.localOnlyCode = !sdpHasPublicCandidate(sdp && sdp.sdp);
    state.candidateSummary = describeCandidates(sdp && sdp.sdp);
    state.connectionStatus = state.localOnlyCode
      ? 'local network only — see the warning below'
      : 'send the answer code back';
    render();
  } catch(e) {
    alert('Invalid code: ' + e.message);
    disconnectOnline();
    state.screen = 'menu';
    render();
  }
}

// Host completes handshake by pasting the joiner's "answer" code
async function finishRoomHandshake(answerCode){
  const raw = (answerCode || '').trim();
  if (!raw) { alert('Empty answer code'); return; }

  // Helpers ----------------------------------------------------------
  const safeJSON = (s)=>{ try { return JSON.parse(s); } catch { return null; } };
  const b64decode = (s)=>{
    // handle base64url and missing padding
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return atob(t);
  };
  const tryAllParses = (s)=>{
    // 1) raw JSON
    let obj = safeJSON(s);
    if (obj) return obj;
    // 2) base64 / base64url → JSON
    let d; try { d = b64decode(s); } catch { d = null; }
    if (d) {
      obj = safeJSON(d);
      if (obj) return obj;
      // 3) some apps double-encode JSON (JSON string inside base64 JSON)
      const d2 = safeJSON(d);
      if (typeof d2 === 'string') {
        const d3 = safeJSON(d2);
        if (d3) return d3;
      }
    }
    return null;
  };
  // -----------------------------------------------------------------

  // Accept raw JSON, base64, or base64url (with or without nested string)
  let descInit = tryAllParses(raw);
  if (!descInit) { alert('Invalid code: cannot parse JSON/base64.'); return; }

  // Some wrappers use {desc:{type:'answer', sdp:'...'}} or { answer: {...} }
  if (descInit.desc && descInit.desc.sdp) descInit = descInit.desc;
  if (descInit.answer && descInit.answer.sdp) descInit = descInit.answer;
  if (typeof descInit === 'string') {
    const again = safeJSON(descInit);
    if (again) descInit = again;
  }

  if (!descInit || typeof descInit.sdp !== 'string' || typeof descInit.type !== 'string') {
    alert('Parsed code is missing required SDP fields.');
    return;
  }
  if (descInit.type.toLowerCase() !== 'answer') {
    alert(`Expected an SDP "answer", but got "${descInit.type}". Did you paste the offer instead of the answer?`);
    return;
  }

  if (!state.peerConnection) {
    alert('Peer connection not found. Start hosting again and paste the answer from the joiner.');
    return;
  }

  try {
    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(descInit));
  } catch (err) {
    console.error('setRemoteDescription failed:', err, descInit);
    alert('Code looks well-formed, but applying it failed. See console for details.');
    return;
  }

  // Success: clear transient UI
  state.waitingForAnswer = false;
  state.answerCode = null;

  // If this handshake is for Draft-off, just move to the room. The first pack is
  // dealt by the datachannel's onopen handler — dealing here too would race it
  // (the channel is not open yet) and produce a short or duplicated pack.
  if (state.screen === 'draft' && state.draft && state.draft.mode === 'draftoff') {
    state.draft.off.screen = 'draftoff';
  }
  render();
}


async function completeConnection(answerStr) {
  try {
    const data = JSON.parse(atob(answerStr));
    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    state.waitingForAnswer = false;
    render();
  } catch(e) {
    alert('Invalid answer: ' + e.message);
  }
}

function disconnectOnline() {
  // Coming back offline, the player is seat 1 again — bring their deck along.
  if (state.currentPlayer === 2 && (state.decks.player2 || []).length) {
    state.decks.player1 = state.decks.player2;
    state.decks.player2 = [];
  }
  state.currentPlayer = 1;
  state.leavingOnline = true;             // suppress our own onclose alert
  if (state.dataChannel) state.dataChannel.close();
  if (state.peerConnection) state.peerConnection.close();
  state.dataChannel = null;
  state.peerConnection = null;
  state.onlineMode = false;
  state.roomCode = null;
  state.isHost = false;
  state.waitingForAnswer = false;
  state.answerCode = null;
  state.localOnlyCode = false;
  setTimeout(() => { state.leavingOnline = false; }, 500);
}

function saveDeck() {
  const key = 'player' + state.currentPlayer;
  const data = JSON.stringify({ player: state.currentPlayer, cards: state.decks[key], timestamp: Date.now() });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deck_player' + state.currentPlayer + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadDeck(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      state.decks['player' + state.currentPlayer] = data.cards || [];
      render();
    } catch(err) {
      alert('Error loading deck');
    }
  };
  reader.readAsText(file);
}

// --- Basic land picker -------------------------------------------------------

function openLandPicker(landName = 'Plains'){
  state.landPicker = { land: landName, printings: [], loading: true };
  render();
  loadLandPickerArt(landName);
}

async function loadLandPickerArt(landName){
  try {
    const printings = await fetchLandPrintings(landName);
    if (!state.landPicker || state.landPicker.land !== landName) return;   // user switched
    state.landPicker.printings = printings;
  } catch {
    if (state.landPicker) state.landPicker.printings = [];
  } finally {
    if (state.landPicker) state.landPicker.loading = false;
    render();
  }
}

function LandPickerModal(){
  const P = state.landPicker;
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  const current = chosenLandArt(P.land);

  wrap.innerHTML = `
    <div class="modal-content" style="max-width:940px">
      <div class="flex justify-between mb-4" style="align-items:flex-start;gap:12px">
        <div>
          <h3 style="font-weight:800;font-size:20px">Choose your basic lands</h3>
          <div class="text-xs text-gray mt-1">
            Pick the printing used whenever a ${htmlEscape(P.land)} is added to a deck or draft.
            Your choice is saved.
          </div>
        </div>
        <button id="closeLandPicker" class="btn btn-secondary text-sm">✕ Close</button>
      </div>

      <div class="flex mb-4" style="gap:8px;flex-wrap:wrap">
        ${BASIC_LAND_NAMES.map(n => {
          const art = chosenLandArt(n);
          return `<button class="landTab btn ${n === P.land ? 'btn-blue' : 'btn-secondary'} text-sm" data-land="${n}">
            ${htmlEscape(n)}${art ? ' ✓' : ''}
          </button>`;
        }).join('')}
      </div>

      ${current ? `<div class="text-xs text-gray mb-3">
        Current ${htmlEscape(P.land)}: ${htmlEscape(current.setName || current.set || 'custom')}${current.artist ? ` — art by ${htmlEscape(current.artist)}` : ''}
        &nbsp;<button id="clearLandArt" class="btn btn-secondary text-xs">Reset to default</button>
      </div>` : ''}

      ${P.loading
        ? '<div class="text-center text-gray p-4">Loading printings…</div>'
        : (P.printings.length
          ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;max-height:56vh;overflow:auto">
              ${P.printings.map((art, i) => `
                <button class="landArtChoice card" data-i="${i}" title="${htmlEscape(art.setName || '')}"
                  style="padding:6px;cursor:pointer;text-align:left;${current && current.id === art.id ? 'border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.45)' : ''}">
                  <img src="${htmlEscape(art.imageUrl)}" alt="${htmlEscape(art.name)}" loading="lazy" decoding="async"
                       style="width:100%;border-radius:6px;display:block">
                  <div class="text-xs mt-1" style="font-weight:700">${htmlEscape(art.set || '')}</div>
                  <div class="text-xs text-gray" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${htmlEscape(art.artist || '')}</div>
                </button>`).join('')}
            </div>`
          : '<div class="text-center text-gray p-4">No printings found (offline?). The default art will be used.</div>')}
    </div>
  `;

  wrap.querySelector('#closeLandPicker').onclick = () => { state.landPicker = null; render(); };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) { state.landPicker = null; render(); }   // click backdrop to close
  });
  wrap.querySelectorAll('.landTab').forEach(btn => {
    btn.onclick = () => openLandPicker(btn.dataset.land);
  });
  const clearBtn = wrap.querySelector('#clearLandArt');
  if (clearBtn) clearBtn.onclick = () => {
    if (state.landArt) delete state.landArt[P.land];
    toast(`${P.land} reset to default art.`);
    render();
  };
  wrap.querySelectorAll('.landArtChoice').forEach(btn => {
    btn.onclick = () => {
      const art = P.printings[Number(btn.dataset.i)];
      if (!art) return;
      state.landArt = state.landArt || {};
      state.landArt[P.land] = art;
      toast(`${P.land}: ${art.setName || art.set} art selected.`);
      render();
    };
  });
  return wrap;
}

// Containers whose scroll position must survive a re-render. render() rebuilds
// the whole screen, so without this every remote update in an online game
// yanked the other player's view back to the top mid-read.
const SCROLL_KEEP = ['.battle-half.opponent .battle-canvas', '.battle-half.you .battle-canvas', '#actionLog', '#draftList', '#deckContainer', '#availContainer', '#zoneCards', '.mode-grid'];

// --- Board layout: the two battlefield halves and the sidebar are resizable.
// Sizes live in localStorage so a table keeps its shape between sessions.
const LAYOUT_KEY = 'galdur.layout';
const LAYOUT_DEFAULTS = { oppPct: 38, sidebarPx: 300 };

function boardLayout(){
  if (!state.layout) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch {}
    state.layout = { ...LAYOUT_DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  }
  const l = state.layout;
  l.oppPct = Math.min(70, Math.max(20, Number(l.oppPct) || LAYOUT_DEFAULTS.oppPct));
  l.sidebarPx = Math.min(520, Math.max(220, Number(l.sidebarPx) || LAYOUT_DEFAULTS.sidebarPx));
  return l;
}

function saveBoardLayout(patch){
  const l = boardLayout();
  Object.assign(l, patch || {});
  boardLayout();
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch {}
}

// Deal a fresh game for a mode. Used by Start Game and by Rematch.
function beginGame(mode, rules){
    // Online: only the host deals, so both peers share the same shuffle.
    if (state.onlineMode && !state.isHost) return;

    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const p1 = shuffle(state.decks.player1.map((c, i) => cloneForGame(c, 'p1-' + i)));
    const p2 = shuffle(state.decks.player2.map((c, i) => cloneForGame(c, 'p2-' + i)));

    state.battleMode = mode.id;
    // Horde and Boss always have a machine-driven player 2, however the game
    // was started — otherwise "Play Local" leaves nobody to run them and the
    // turn just stalls after you pass.
    if (rules.botOpponent && !state.onlineMode) state.vsAI = true;
    state.gameState = normalizeGameStateZones(buildGameStateForMode(mode, p1, p2));
    if (mode.commanderZone) {
      seedCommandZoneFromDeck(state.gameState.player1, mode);
      seedCommandZoneFromDeck(state.gameState.player2, mode);
    }
    // Deal opening hands for every mode. Modes may override the size
    // (the Basic Land Game opens on five); everything else opens on seven.
    const openingHand = rules.startingHand || rules.openingHand || 7;
    if (openingHand) {
      const sharedZone = state.gameState.shared;
      for (const who of ['player1', 'player2']) {
        const player = state.gameState[who];
        const drawPile = (sharedZone && sharedZone.enabled) ? sharedZone.deck : player.deck;
        for (let i = 0; i < openingHand && drawPile.length; i++) {
          player.hand.push(drawPile.shift());
        }
      }
    }
  state.activePlayer = 1;
  state.gameStarted = true;
  state.winner = null;
  state.turnCount = 1;
  state.targeting = null;
  state.declaringAttack = false;
  state.attackSelection = [];
  state.selectedCard = null;
  state.selectedFieldCard = null;
  state.selectedZoneCard = null;
  state.viewingZone = null;
  state.gameLog = [];
  state.gameHistory = [];
  startReplayRecording(mode.id);
  addGameLog(`${rules.title} started.`);

  // A short banner tells player 1 the table is theirs.
  if (state.currentPlayer === 1) {
    state.showTurnNotification = true;
    setTimeout(() => { state.showTurnNotification = false; render(); }, 1200);
  }

  sendGameInit();   // full opening snapshot so the joiner gets both shuffled decks
  render();
}

function captureScroll(){
  const saved = [];
  for (const sel of SCROLL_KEEP) {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.scrollTop || el.scrollLeft) saved.push({ sel, i, top: el.scrollTop, left: el.scrollLeft });
    });
  }
  return saved;
}

function restoreScroll(saved){
  if (!saved.length) return;
  for (const { sel, i, top, left } of saved) {
    const el = document.querySelectorAll(sel)[i];
    if (!el) continue;
    el.scrollTop = top;
    el.scrollLeft = left;
  }
}

function render() {
  scheduleSave();   // persist collection + decks (debounced) on any state change
  const root = document.getElementById('root');
  if (!root) return;
  const scroll = captureScroll();
  const activeId = document.activeElement && document.activeElement.id;
  const selStart = document.activeElement && document.activeElement.selectionStart;
  root.innerHTML = '';

  if (state.screen === 'login') root.appendChild(LoginScreen());
  else if (state.screen === 'menu') root.appendChild(MainMenu());
  else if (state.screen === 'modes') root.appendChild(ModeHubScreen());
  else if (state.screen === 'mode-studio') root.appendChild(ModeStudioScreen());
  else if (state.screen === 'creator') root.appendChild(CardCreator());
  else if (state.screen === 'builder') root.appendChild(DeckBuilder());
  else if (state.screen === 'game') root.appendChild(GameBoard());
  else if (state.screen === 'battlemenu') root.appendChild(BattleMenu());
  else if (state.screen === 'draft') root.appendChild(DraftScreen());

  // Overlay: available from every screen, so it is mounted after the screen.
  if (state.landPicker) root.appendChild(LandPickerModal());

  restoreScroll(scroll);
  // Keep the caret in a text field the player was typing in (deck names,
  // import box) — a remote update used to steal focus mid-word.
  if (activeId) {
    const again = document.getElementById(activeId);
    if (again && typeof again.focus === 'function') {
      again.focus();
      if (selStart != null && again.setSelectionRange) {
        try { again.setSelectionRange(selStart, selStart); } catch {}
      }
    }
  }

  // Let the AI module schedule any pending bot moves (AI turns, draft picks).
  if (window.GALDUR_AI) window.GALDUR_AI.onRender();
}

function LoginScreen() {
  const div = document.createElement('div');
  div.className = 'screen';
  div.innerHTML = `
    <div class="text-center" style="max-width: 820px; width:100%; padding: 0 16px;">
      <div class="hero"><img src="title_wizards.png" alt="Wizards Duel"></div>
      <h1 style="
  font-size: 56px; font-weight: 800; line-height: 1.1; margin-bottom: 6px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
  Galdurspjöld
</h1>
      <p class="text-gray mb-1" style="font-size: 14px;">Create custom cards, play with friends.</p>

<p class="text-xs text-gray" style="margin-bottom: 20px;">
 Made by KS. 2025. 
</p>
      <div class="card enter-card">
        <p class="text-sm text-gray mb-4">Enter the table. Build your own deck — the bot brings its own, or you can craft your opponent's too.</p>
        <button id="enterApp" class="btn btn-primary" style="padding: 18px 42px; font-size: 18px;">Enter</button>
      </div>
    </div>

  `;

  div.querySelector('#enterApp').onclick = () => {
    state.currentPlayer = state.currentPlayer || 1;
    state.screen = 'menu';
    render();
  };

  return div;
}

function ModeHubScreen() {
  const div = document.createElement('div');
  div.className = 'container';
  const modes = MTG_MODE_LIBRARY;
  const families = ['all', ...new Set(modes.map(mode => mode.family).filter(Boolean))];
  const familyButtons = families.map(family => `
    <button class="mode-filter-btn ${family === (state.modeFamily || 'all') ? 'active' : ''}" type="button" data-family="${htmlEscape(family)}">
      ${family === 'all' ? 'All' : htmlEscape(family)}
    </button>
  `).join('');

  div.innerHTML = `
    <div class="header">
      <button id="backBtn" class="btn btn-secondary text-sm">← Menu</button>
      <h1 style="font-size:24px;font-weight:800">Choose Mode</h1>
      <button id="collectionBtn" class="btn btn-secondary text-sm">Card Collection</button>
    </div>

    <div class="mode-filter-bar">
      <div class="mode-filter-head">
        <input id="modeSearch" class="input" type="search" autocomplete="off" placeholder="Search modes" value="${htmlEscape(state.modeQuery || '')}">
        <span id="modeCount" class="mode-filter-count">${modes.length}/${modes.length}</span>
      </div>
      <div class="mode-family-tabs" aria-label="Mode families">
        ${familyButtons}
      </div>
    </div>

    <div class="mode-grid">
      ${modes.map(mode => `
        <div class="mode-card ${mode.id === state.selectedMode ? 'active' : ''}" data-mode-card data-mode-id="${htmlEscape(mode.id)}" data-family="${htmlEscape(mode.family)}" data-search="${htmlEscape([mode.title, mode.family, mode.summary, mode.format, mode.note].filter(Boolean).join(' ').toLowerCase())}">
          <span class="mode-family">${htmlEscape(mode.family)}</span>
          <h3>${htmlEscape(mode.title)}</h3>
          <p class="mode-summary">${htmlEscape(mode.summary)}</p>
          <div class="text-xs text-gray">
            ${mode.target ? `Deck ${mode.target}` : 'Open deck size'}
            ${mode.singleton ? ' • Singleton' : ''}
            ${mode.rarity === 'common' ? ' • Commons only' : ''}
            ${mode.sharedLibrary ? ' • Shared library' : ''}
          </div>
          ${mode.note ? `<div class="mode-note">${htmlEscape(mode.note)}</div>` : ''}
          <div class="mode-actions">
            <button class="btn btn-primary" data-action="open" data-mode="${mode.id}">Open Studio</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div id="modeEmpty" class="mode-empty" hidden>No matching modes.</div>
  `;

  div.querySelector('#backBtn').onclick = () => { state.screen = 'menu'; render(); };
  div.querySelector('#collectionBtn').onclick = () => { state.screen = 'creator'; render(); };
  const searchInput = div.querySelector('#modeSearch');
  const countEl = div.querySelector('#modeCount');
  const emptyEl = div.querySelector('#modeEmpty');
  let activeFamily = state.modeFamily || 'all';
  const updateModeFilters = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    state.modeQuery = searchInput?.value || '';
    state.modeFamily = activeFamily;
    let visible = 0;
    div.querySelectorAll('[data-mode-card]').forEach(card => {
      const matchesFamily = activeFamily === 'all' || card.dataset.family === activeFamily;
      const matchesQuery = !query || (card.dataset.search || '').includes(query);
      const show = matchesFamily && matchesQuery;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (countEl) countEl.textContent = `${visible}/${modes.length}`;
    if (emptyEl) emptyEl.hidden = visible > 0;
    div.querySelectorAll('.mode-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.family === activeFamily);
    });
  };
  if (searchInput) searchInput.oninput = updateModeFilters;
  div.querySelectorAll('.mode-filter-btn').forEach(btn => {
    btn.onclick = () => {
      activeFamily = btn.dataset.family || 'all';
      updateModeFilters();
    };
  });
  updateModeFilters();
  div.querySelectorAll('[data-action][data-mode]').forEach(btn => {
    btn.onclick = () => routeToMode(btn.dataset.mode, btn.dataset.action);
  });
  return div;
}

function MainMenu() {
  const div = document.createElement('div');
  div.className = 'screen';
  const mode = currentModeConfig();
  const playlists = allModePlaylists(5);
  const playlistHtml = playlists.length ? playlists.map(setup => `
    <div class="playlist-row">
      <div>
        <div class="playlist-title">${htmlEscape(setup.name)}</div>
        <div class="playlist-meta">${htmlEscape(setup.mode.title)} • P1 ${setup.p1Count} cards • P2 ${setup.p2Count} cards</div>
      </div>
      <button class="btn btn-secondary text-xs" data-open-playlist="${setup.id}" data-mode="${setup.modeId}">Open</button>
    </div>
  `).join('') : '<div class="playlist-empty">Saved deck playlists will appear here.</div>';

  div.innerHTML = `
    <div class="home-shell">
      <div class="header">
        <div>
          <div class="mode-family">Galdurspjöld</div>
          <h1 class="home-title">Choose your battle</h1>
        </div>
        <button id="logoutBtn" class="btn btn-secondary text-sm">Exit</button>
      </div>

      <!-- Current format, always visible so nothing is "mode first" guesswork -->
      <div class="card mode-strip mb-4">
        <div>
          <div class="text-xs text-gray" style="letter-spacing:.06em;text-transform:uppercase">Current format</div>
          <div class="mode-strip-name">${htmlEscape(mode.title)}</div>
          <div class="text-xs text-gray mt-1">${htmlEscape(mode.summary)}</div>
        </div>
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <div class="deck-chip">Your deck · ${(state.decks.player1 || []).length}</div>
          <div class="deck-chip">Opponent · ${(state.decks.player2 || []).length}</div>
          <button id="chooseMode" class="btn btn-secondary text-sm">Change format</button>
        </div>
      </div>

      <div class="home-actions">
        <button id="goPlay" class="action-panel featured">
          <span>⚔️ Play</span>
          <small>Solo vs the bot, co-op, a boss fight, or pass-and-play.</small>
        </button>
        <button id="goBuild" class="action-panel">
          <span>🛠️ Deck Editor</span>
          <small>Search cards, import a list, check the curve.</small>
        </button>
        <button id="goDraft" class="action-panel">
          <span>🎴 Draft</span>
          <small>Draft solo against a bot, hotseat, or online.</small>
        </button>
        <button id="cardCollection" class="action-panel">
          <span>✨ Design Cards</span>
          <small>Make your own cards in the Deck Editor. ${(state.cards || []).length} saved.</small>
        </button>
        <button id="chooseLands" class="action-panel">
          <span>🏞️ Basic Lands</span>
          <small>Pick the printing your decks use.</small>
        </button>
        <button id="playlistModeBtn" class="action-panel">
          <span>📚 All Formats</span>
          <small>Browse every mode, from Commander to Dandan.</small>
        </button>
        <button id="watchReplay" class="action-panel">
          <span>🎬 Watch a Replay</span>
          <small>Open a saved game and scrub through it move by move.</small>
        </button>
        <input id="replayFile" type="file" accept=".json" class="hidden">
      </div>

      <div class="card p-4 mt-4">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="font-size:17px;font-weight:900;margin-bottom:4px">Deck Playlists</h2>
            <p class="text-xs text-gray">Saved mode + deck configurations for quick setup.</p>
          </div>
        </div>
        <div class="playlist-list mt-4">
          ${playlistHtml}
        </div>
      </div>
    </div>
  `;

  // actions
  div.querySelector('#logoutBtn').onclick  = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
  // You always act as seat 1 outside online play; the old P1/P2 profile
  // switcher confused far more than it helped.
  if (!state.onlineMode) state.currentPlayer = 1;
  div.querySelector('#chooseMode').onclick = () => { state.modeIntent = 'all'; state.screen = 'modes'; render(); };
  div.querySelector('#cardCollection').onclick = () => {
    state.builderTab = 'cards';                 // straight to card design
    state.screen = 'builder';
    render();
  };
  div.querySelector('#chooseLands').onclick = () => openLandPicker('Plains');
  div.querySelector('#playlistModeBtn').onclick = () => { state.modeIntent = 'all'; state.screen = 'modes'; render(); };
  // Straight to the thing you wanted, using the format already selected.
  const watchReplayBtn = div.querySelector('#watchReplay');
  const replayFileInput = div.querySelector('#replayFile');
  if (watchReplayBtn && replayFileInput) {
    watchReplayBtn.onclick = () => replayFileInput.click();
    replayFileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try { enterReplay(JSON.parse(await file.text())); }
      catch (err) { toast('Could not read that replay file.'); }
    };
  }

  div.querySelector('#goPlay').onclick = () => { state.screen = 'battlemenu'; render(); };
  div.querySelector('#goBuild').onclick = () => { state.builderTab = 'deck'; state.screen = 'builder'; render(); };
  div.querySelector('#goDraft').onclick = () => {
    resetDraftForMode(state.selectedMode || 'casual', { screen: 'mode' });
    state.screen = 'draft';
    render();
  };
  div.querySelectorAll('[data-open-playlist]').forEach(btn => {
    btn.onclick = () => {
      const setup = loadModeSetup(btn.dataset.mode, btn.dataset.openPlaylist);
      if (!setup) {
        toast('Playlist not found.');
        return;
      }
      state.selectedMode = btn.dataset.mode;
      state.battleMode = btn.dataset.mode;
      state.studioTab = 'play';
      state.screen = 'mode-studio';
      render();
    };
  });

  return div;
}

function ModeStudioScreen() {
  const div = document.createElement('div');
  div.className = 'container';
  const mode = currentModeConfig();
  const rules = getModeRules(mode);
  const myKey = 'player' + state.currentPlayer;
  const sharedStackReady = rules.sharedLibrary && (((state.decks.player1 || []).length > 0) || ((state.decks.player2 || []).length > 0));
  const sharedStackOwner = (state.decks.player1 || []).length ? 'your' : ((state.decks.player2 || []).length ? "the opponent's" : '');
  const sharedStackDeck = sharedStackOwner === 'your' ? (state.decks.player1 || []) : (state.decks.player2 || []);
  const sharedStackCount = sharedStackDeck.length;
  const p1Validation = validateDeckForMode(state.decks.player1 || [], mode);
  const p2Validation = validateDeckForMode(state.decks.player2 || [], mode);
  const sharedValidation = validateDeckForMode(sharedStackDeck, mode);
  const savedSetups = modeSetupList(mode.id);
  const setupOptions = savedSetups.map(setup => {
    const saved = setup.savedAt ? new Date(setup.savedAt).toLocaleDateString() : '';
    return `<option value="${setup.id}">${htmlEscape(setup.name)}${saved ? ` (${saved})` : ''}</option>`;
  }).join('');
  const matchValidationHtml = rules.sharedLibrary
    ? deckValidationPanelHtml(sharedValidation, {
        id: 'studioSharedValidation',
        title: `${rules.sharedLabel || 'Shared Stack'} Readiness`,
        compact: true
      })
    : `<div class="grid grid-2" style="gap:12px">
        ${deckValidationPanelHtml(p1Validation, { id: 'studioP1Validation', title: 'Your Deck', compact: true })}
        ${deckValidationPanelHtml(p2Validation, { id: 'studioP2Validation', title: 'Opponent Deck', compact: true })}
      </div>`;
  const availableTabs = [
    ...(mode.build ? ['build'] : []),
    ...(mode.draft ? ['draft'] : []),
    ...(mode.play ? ['play'] : [])
  ];
  if (!availableTabs.length) availableTabs.push('play');
  const currentTab = availableTabs.includes(state.studioTab) ? state.studioTab : availableTabs[0];
  state.studioTab = currentTab;
  const tabLabel = { build: 'Build', draft: 'Draft', play: 'Play' };
  const tabButtons = availableTabs.map(tab => `
    <button class="studio-tab ${currentTab === tab ? 'active' : ''}" data-tab="${tab}" type="button">${tabLabel[tab]}</button>
  `).join('');
  const buildValidation = rules.sharedLibrary ? sharedValidation : validateDeckForMode(state.decks[myKey] || [], mode);
  const buildPanelHtml = `
    <div class="studio-panel-card">
      <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">Build For ${htmlEscape(mode.title)}</h2>
      ${deckValidationPanelHtml(buildValidation, { id: 'studioBuildValidation', title: rules.sharedLibrary ? `${rules.sharedLabel || 'Shared Stack'} Build` : `Player ${state.currentPlayer} Deck`, compact: true })}
      <div class="flex mt-4" style="gap:8px;flex-wrap:wrap">
        ${mode.build ? '<button id="studioOpenBuilder" class="btn btn-primary">Open Builder</button>' : ''}
        ${mode.id === 'jumpstart' ? '<button id="studioJumpstart" class="btn btn-secondary">Open Packet Mixer</button>' : ''}
        ${mode.id === 'cube' ? '<button id="studioStarterCube" class="btn btn-secondary">Generate Starter Cube</button>' : ''}
        ${mode.id === 'dandan' ? '<button id="studioStarterDandan" class="btn btn-secondary">Generate Dandan Library</button>' : ''}
        ${mode.id === 'horde' ? '<button id="studioStarterHorde" class="btn btn-secondary">Regenerate Horde Decks</button>' : ''}
        ${mode.id === 'land-game' ? '<button id="studioStarterLand" class="btn btn-secondary">Regenerate Land Decks</button>' : ''}
      </div>
    </div>
  `;
  const draftPanelHtml = `
    <div class="studio-panel-card">
      <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">${htmlEscape(mode.title)} Draft</h2>
      <p class="text-sm text-gray">${mode.draft ? 'Draft and pool tools are scoped to this mode.' : 'This mode does not use a draft flow.'}</p>
      <div class="flex mt-4" style="gap:8px;flex-wrap:wrap">
        ${mode.draft ? '<button id="studioStartDraft" class="btn btn-blue">Start Draft / Pool Builder</button>' : ''}
      </div>
    </div>
  `;
  const playPanelHtml = `
    <div class="studio-panel-card">
      <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">Match Readiness</h2>
      ${matchValidationHtml}
      <div class="flex mt-4" style="gap:10px;flex-wrap:wrap">
        ${rules.botOpponent
          ? `<button id="studioPlayAI" class="btn btn-primary" aria-label="Start">${mode.id === 'horde' ? 'Fight the Horde' : 'Fight the Boss'}</button>`
          : `<button id="studioPlayAI" class="btn btn-primary" aria-label="Play vs AI">🤖 Play vs AI</button>`}
        ${mode.coop ? '<button id="studioPlayCoop" class="btn btn-purple" aria-label="Co-op vs AI">🤝 Co-op vs AI</button>' : ''}
        <button id="studioPlayLocal" class="btn btn-green" aria-label="Play Local">${rules.botOpponent ? 'Manual (no bot)' : 'Play Local (2 players)'}</button>
        <button id="studioHost" class="btn btn-blue" aria-label="Host Game">Host Online</button>
        <button id="studioJoin" class="btn btn-secondary" aria-label="Join Game">Join Online</button>
      </div>
    </div>
  `;
  const panelHtml = currentTab === 'build' ? buildPanelHtml : currentTab === 'draft' ? draftPanelHtml : playPanelHtml;

  div.innerHTML = `
    <div class="header">
      <button id="studioBack" class="btn btn-secondary text-sm">← Modes</button>
      <div>
        <div class="mode-family">${htmlEscape(mode.family)}</div>
        <h1 style="font-size:26px;font-weight:900;margin-top:4px">${htmlEscape(mode.title)} Studio</h1>
      </div>
      <button id="studioMenu" class="btn btn-secondary text-sm">Menu</button>
    </div>

    <div class="grid" style="grid-template-columns:minmax(280px,1fr) minmax(320px,1.35fr);gap:16px;align-items:start">
      <div class="card p-4">
        <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">Mode Requirements</h2>
        <p class="text-sm text-gray">${htmlEscape(mode.summary)}</p>
        ${mode.note ? `<div class="mode-note mt-4">${htmlEscape(mode.note)}</div>` : ''}
        <div class="validation-facts" style="margin-top:14px">
          <span>${mode.target ? `${mode.target} card target` : 'open size'}</span>
          ${mode.singleton ? '<span>singleton</span>' : ''}
          ${mode.rarity === 'common' ? '<span>commons only</span>' : ''}
          ${mode.sharedLibrary ? '<span>shared library</span>' : ''}
          ${mode.commanderZone ? `<span>${htmlEscape(mode.commandZoneShortLabel || 'command zone')}</span>` : ''}
        </div>
        ${rules.sharedLibrary ? `<div class="mode-note mt-4">
          ${sharedStackReady
            ? `${htmlEscape(rules.sharedLabel || 'Shared Library')} will use ${sharedStackOwner} deck as one center stack (${sharedStackCount} cards).`
            : `No ${htmlEscape(rules.sharedLabel || 'shared library')} loaded yet.`}
        </div>` : ''}
        <div class="card p-3 mt-4 playlist-card">
          <h3 style="font-size:14px;font-weight:800;margin-bottom:6px">Deck Playlists</h3>
          <p class="text-xs text-gray mb-2">Save the current Player 1 / Player 2 decks for this mode.</p>
          <div class="grid" style="gap:8px">
            <input id="setupName" class="input" placeholder="${htmlEscape(defaultSetupName(mode))}">
            <div class="flex" style="gap:8px;flex-wrap:wrap">
              <button id="saveSetup" class="btn btn-primary text-xs">Save List</button>
              <select id="setupSelect" class="input" style="min-width:180px;flex:1" ${savedSetups.length ? '' : 'disabled'}>
                ${setupOptions || '<option>No saved playlists</option>'}
              </select>
              <button id="loadSetup" class="btn btn-secondary text-xs" ${savedSetups.length ? '' : 'disabled'}>Load</button>
              <button id="deleteSetup" class="btn btn-red text-xs" ${savedSetups.length ? '' : 'disabled'}>Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="font-size:18px;font-weight:800;margin-bottom:8px">Mode Workspace</h2>
            <p class="text-sm text-gray">${htmlEscape(mode.title)} tools and readiness.</p>
          </div>
          <button id="studioChangeMode" class="btn btn-secondary text-sm">Change Mode</button>
        </div>
        <div class="studio-tabs mt-4" role="tablist">
          ${tabButtons}
        </div>
        ${panelHtml}
      </div>
    </div>
  `;

  const bind = (sel, fn) => {
    const el = div.querySelector(sel);
    if (el) el.onclick = fn;
  };
  const ensureAutoDecks = () => {
    applyAutoDeck(mode);
  };
  bind('#studioBack', () => { state.modeIntent = 'play'; state.screen = 'modes'; render(); });
  bind('#studioMenu', () => { state.screen = 'menu'; render(); });
  bind('#studioChangeMode', () => { state.modeIntent = 'play'; state.screen = 'modes'; render(); });
  div.querySelectorAll('.studio-tab').forEach(btn => {
    btn.onclick = () => {
      state.studioTab = btn.dataset.tab;
      render();
    };
  });
  bind('#saveSetup', () => {
    const name = (div.querySelector('#setupName')?.value || '').trim();
    const setup = saveModeSetup(mode, name);
    toast(`Saved setup: ${setup.name}`);
    render();
  });
  bind('#loadSetup', () => {
    const id = div.querySelector('#setupSelect')?.value;
    const setup = loadModeSetup(mode.id, id);
    if (!setup) {
      toast('No setup selected.');
      return;
    }
    toast(`Loaded setup: ${setup.name}`);
    render();
  });
  bind('#deleteSetup', () => {
    const id = div.querySelector('#setupSelect')?.value;
    if (!id) return;
    deleteModeSetup(mode.id, id);
    toast('Setup deleted.');
    render();
  });
  bind('#studioOpenBuilder', () => { state.selectedMode = mode.id; state.screen = 'builder'; render(); });
  bind('#studioJumpstart', () => { state.selectedMode = mode.id; state.screen = 'builder'; render(); });
  bind('#studioStartDraft', () => { resetDraftForMode(mode.id); state.screen = 'draft'; render(); });
  bind('#studioStarterCube', () => {
    state.decks[myKey] = tagAutoDeck(makeStarterCubeStack(90), 'cube');
    upgradeDeckSlot(myKey, 'cube', () => buildRealStarterPool(90));
    toast('Starter cube stack generated.');
    render();
  });
  bind('#studioStarterDandan', () => {
    state.decks[myKey] = tagAutoDeck(makeDandanLibrary(80), 'dandan');
    toast('Dandan library generated.');
    render();
  });
  bind('#studioStarterHorde', () => {
    setupHordeDecks({ forceSurvivor: true, forceHorde: true });
    toast('Horde decks regenerated.');
    render();
  });
  bind('#studioStarterLand', () => {
    setupLandGameDecks();
    toast('Basic Land Game decks regenerated.');
    render();
  });
  const studioStart = (opts = {}) => {
    ensureAutoDecks();
    state.onlineMode = false;
    state.vsAI = !!opts.vsAI;
    state.coop = !!opts.coop;
    state.coopSeat = 1;
    state.bossRound = 0;
    if (opts.vsAI) {
      state.currentPlayer = 1;             // the human always sits in seat 1
      // Generate an opponent deck for ordinary formats that have none.
      if (!mode.autoDeck && deckReplaceableBy(state.decks.player2, 'jumpstart')) {
        const themes = shuffleCopy(JUMPSTART_THEMES.map(t => t.id));
        const built = buildJumpstartDeck(themes[0], themes[1]);
        state.decks.player2 = tagAutoDeck(built.cards, 'jumpstart');
        toast(`AI deck generated: ${built.name}.`);
        upgradeDeckSlot('player2', 'jumpstart', () => buildRealAiDeck(aiTier()));
      }
    }
    state.screen = 'game';
    render();
  };
  bind('#studioPlayAI', () => studioStart({ vsAI: true }));
  bind('#studioPlayCoop', () => studioStart({ vsAI: true, coop: true }));
  bind('#studioPlayLocal', () => studioStart({}));
  bind('#studioHost', () => {
    ensureAutoDecks();
    const deck = (state.decks && state.decks[myKey]) || [];
    const hasSharedStack = rules.sharedLibrary && ((state.decks.player1 || []).length || (state.decks.player2 || []).length);
    if (!deck.length && !hasSharedStack) { alert(rules.sharedLibrary ? 'Build or generate the shared stack first.' : 'Build a deck first.'); return; }
    state.onlineMode = true;
    if (typeof createOnlineRoom === 'function') createOnlineRoom();
    state.screen = 'game';
    render();
  });
  bind('#studioJoin', () => {
    ensureAutoDecks();
    const deck = (state.decks && state.decks[myKey]) || [];
    if (!deck.length && !rules.sharedLibrary) { alert('Build a deck first.'); return; }
    const code = prompt('Paste connection code:');
    if (code && code.trim()) {
      state.onlineMode = true;
      if (typeof joinOnlineRoom === 'function') joinOnlineRoom(code.trim());
      state.screen = 'game';
      render();
    }
  });

  return div;
}

function BattleMenu()  {
  const div = document.createElement('div');
  div.className = 'screen';
  const mode = currentModeConfig();
  const rules = getModeRules(mode);
  const sharedStackReady = rules.sharedLibrary && (((state.decks.player1 || []).length > 0) || ((state.decks.player2 || []).length > 0));
  const sharedStackOwner = (state.decks.player1 || []).length ? 'your' : ((state.decks.player2 || []).length ? "the opponent's" : '');
  const sharedStackCount = sharedStackOwner === 'your' ? (state.decks.player1 || []).length : (state.decks.player2 || []).length;
  const sharedStackDeck = sharedStackOwner === 'your' ? (state.decks.player1 || []) : (state.decks.player2 || []);
  const turnConfigured = !!(state.turnServer && validTurnUrls(state.turnServer.urls).length);
  const battleValidationHtml = rules.sharedLibrary
    ? deckValidationPanelHtml(validateDeckForMode(sharedStackDeck, mode), {
        id: 'battleDeckValidation',
        title: `${rules.sharedLabel || 'Shared Stack'} Check`,
        compact: true
      })
    : `<div class="grid grid-2" style="gap:12px;margin-top:12px">
        ${deckValidationPanelHtml(validateDeckForMode(state.decks.player1 || [], mode), { id: 'p1DeckValidation', title: 'Your Deck', compact: true })}
        ${deckValidationPanelHtml(validateDeckForMode(state.decks.player2 || [], mode), { id: 'p2DeckValidation', title: state.vsAI ? 'Bot Deck' : 'Opponent Deck', compact: true })}
      </div>`;

  div.innerHTML = `
    <div style="max-width: 900px; width:100%; padding: 0 16px;">
      <div class="header">
        <button id="backBtn" class="btn btn-secondary text-sm">← Back</button>
        <h2 style="font-size: 24px; font-weight: bold;"></h2>
        <button id="logoutBtn" class="btn btn-secondary text-sm">Logout</button>
      </div>

      <div class="card p-4 mb-4">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;">
          <div>
            <div class="mode-family">${htmlEscape(mode.family)}</div>
            <h3 style="font-size:20px;font-weight:800;margin:8px 0 4px">${htmlEscape(mode.title)}</h3>
            <p class="text-sm text-gray">${htmlEscape(mode.summary)}</p>
            ${mode.note ? `<p class="mode-note mt-4">${htmlEscape(mode.note)}</p>` : ''}
            ${rules.sharedLibrary ? `<p class="mode-note mt-4">
              ${sharedStackReady
                ? `${htmlEscape(rules.sharedLabel || 'Shared Library')} will use ${sharedStackOwner} deck as one center stack (${sharedStackCount} cards).`
                : `No shared center stack loaded yet. Build, import, or generate one before starting ${htmlEscape(mode.title)}.`}
            </p>` : ''}
            ${mode.id === 'cube' && !sharedStackReady ? '<button id="starterCubeBattle" class="btn btn-secondary text-sm mt-4">Generate Starter Cube Stack</button>' : ''}
            ${mode.id === 'dandan' && !sharedStackReady ? '<button id="starterDandanBattle" class="btn btn-secondary text-sm mt-4">Generate Dandan Library</button>' : ''}
            ${battleValidationHtml}
          </div>
          <button id="changeMode" class="btn btn-secondary text-sm">Change</button>
        </div>
      </div>

      ${(state.deckLibrary || []).length ? `
      <div class="card p-4 mb-4">
        <div class="flex justify-between" style="align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="font-weight:800;font-size:15px">📚 Bring a deck</h3>
            <p class="text-xs text-gray mt-1">Load one of your saved decks into ${state.vsAI ? 'your seat' : 'a seat'} before starting.</p>
          </div>
          <div class="flex" style="gap:8px;align-items:center;flex-wrap:wrap">
            <select id="bringDeckSelect" class="input" style="width:220px">
              ${state.deckLibrary.map(d => `<option value="${d.id}">${htmlEscape(d.name)} (${d.cards.length})</option>`).join('')}
            </select>
            <button id="bringDeckMine" class="btn btn-secondary text-sm">→ My deck</button>
            <button id="bringDeckOpp" class="btn btn-secondary text-sm">→ Opponent</button>
          </div>
        </div>
      </div>` : ''}

      <div class="card p-4 mb-4 difficulty-card">
        <div class="flex justify-between" style="align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="font-weight:800;font-size:15px">🤖 Bot difficulty</h3>
            <p class="text-xs text-gray mt-1" id="difficultyBlurb"></p>
          </div>
          <div class="segmented" role="group" aria-label="Bot difficulty">
            ${['easy', 'normal', 'hard'].map(k => `
              <button class="difficultyBtn${state.aiDifficulty === k ? ' active' : ''}" data-diff="${k}">
                ${k[0].toUpperCase()}${k.slice(1)}
              </button>`).join('')}
          </div>
        </div>
        <div class="flex mt-3" style="align-items:center;gap:10px;flex-wrap:wrap">
          <label class="text-sm" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input id="strictManaToggle" type="checkbox" ${state.strictMana ? 'checked' : ''}>
            <strong>Strict mana (bot games only)</strong>
          </label>
          <span class="text-xs text-gray">Against a bot, playing a card taps lands for its cost and limits you to one land per turn. Games against people always stay self-enforced.</span>
        </div>
      </div>

      <details class="card p-4 mb-4 relay-card"${state.turnServer && state.turnServer.urls ? ' open' : ''}>
        <summary style="cursor:pointer;font-weight:800;font-size:14px">
          🛰️ Relay server for online play (optional)
          ${turnConfigured
            ? '<span class="badge" style="margin-left:8px">configured</span>'
            : (state.turnServer && state.turnServer.urls
                ? '<span class="badge" style="margin-left:8px;border-color:rgba(251,191,36,.6);color:#fcd34d">unusable url</span>'
                : '')}
        </summary>
        <p class="text-xs text-gray mt-3">
          Most connections work without this. If you and your opponent are on networks that block
          direct connections — some workplaces, some mobile carriers — you need a TURN relay.
          This site is static and cannot host one, so bring your own: several providers have a free
          tier (Metered, Twilio, Cloudflare Calls). Stored only in this browser.
        </p>
        <div class="grid mt-3" style="grid-template-columns:2fr 1fr 1fr;gap:8px">
          <input id="turnUrls" class="input" placeholder="turn:relay.example.com:3478"
                 value="${htmlEscape((state.turnServer && state.turnServer.urls) || '')}">
          <input id="turnUser" class="input" placeholder="username"
                 value="${htmlEscape((state.turnServer && state.turnServer.username) || '')}">
          <input id="turnPass" class="input" type="password" placeholder="credential"
                 value="${htmlEscape((state.turnServer && state.turnServer.credential) || '')}">
        </div>
        <div class="flex mt-3" style="gap:8px;flex-wrap:wrap;align-items:center">
          <button id="saveTurn" class="btn btn-secondary text-sm">Save relay</button>
          <button id="testTurn" class="btn btn-secondary text-sm">Test it</button>
          <button id="clearTurn" class="btn btn-secondary text-sm">Clear</button>
          <span id="turnStatus" class="text-xs text-gray"></span>
        </div>
      </details>

      <div class="action-panel-grid">
        <button id="playLocal" class="action-panel" aria-label="Play Local">
          <span>Play Local</span>
          <small>Start a local game using this mode setup.</small>
        </button>
        <button id="playAI" class="action-panel" aria-label="Play vs AI" ${rules.sharedLibrary && mode.id !== 'horde' ? 'disabled' : ''}>
          <span>${mode.id === 'horde' ? 'Fight the Horde (Auto)' : mode.id === 'boss' ? 'Fight the Boss' : 'Play vs AI'}</span>
          <small>${mode.id === 'horde'
            ? 'The Horde runs itself each turn: reveal, attack, pass.'
            : mode.id === 'boss'
              ? 'An escalating AI boss with 40 life takes its own turns.'
              : rules.sharedLibrary
                ? 'Not available for shared-stack modes yet.'
                : 'The computer plays Player 2. No deck? One is generated.'}</small>
        </button>
        ${mode.coop ? `
        <button id="playCoop" class="action-panel" aria-label="Co-op vs AI">
          <span>🤝 Co-op vs AI</span>
          <small>Two survivors share one board and pass the device between turns.</small>
        </button>` : ''}
        <button id="hostGame" class="action-panel" aria-label="Host Game">
          <span>Host Online</span>
          <small>Create a connection code for a friend.</small>
        </button>
        <button id="joinGame" class="action-panel" aria-label="Join Game">
          <span>Join Online</span>
          <small>Paste a host code to connect.</small>
        </button>
      </div>
    </div>
  `;

  // helper for keyboard activation on tiles
  const bind = (sel, fn) => {
    const el = div.querySelector(sel);
    if (!el) return;
    el.onclick = fn;
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  };

  // nav
  bind('#backBtn',   () => { state.screen = 'menu';  render(); });
  bind('#logoutBtn', () => { state.currentPlayer = null; state.screen = 'login'; render(); });
  bind('#changeMode', () => { state.modeIntent = 'play'; state.screen = 'modes'; render(); });
  bind('#starterCubeBattle', () => {
    state.decks.player1 = tagAutoDeck(makeStarterCubeStack(90), 'cube');
    upgradeDeckSlot('player1', 'cube', () => buildRealStarterPool(90));
    toast('Starter cube stack generated.');
    render();
  });
  bind('#starterDandanBattle', () => {
    state.decks.player1 = tagAutoDeck(makeDandanLibrary(80), 'dandan');
    toast('Dandan library generated.');
    render();
  });

  // local play
  bind('#playLocal', () => {
    state.onlineMode = false;
    state.vsAI = false;
    state.coop = false;
    state.screen = 'game';
    render();
  });

  // vs AI: computer plays player 2 locally
  const startVsAI = (coop) => {
    if (rules.sharedLibrary && mode.id !== 'horde') { toast('AI needs its own deck — shared-stack modes are PvP for now.'); return; }
    state.onlineMode = false;
    state.vsAI = true;
    state.coop = !!coop;
    state.coopSeat = 1;
    state.bossRound = 0;
    state.currentPlayer = 1;            // the human always sits in seat 1 vs the AI
    applyAutoDeck(mode);
    if (!mode.autoDeck && deckReplaceableBy(state.decks.player2, 'jumpstart')) {
      const themes = shuffleCopy(JUMPSTART_THEMES.map(t => t.id));
      const built = buildJumpstartDeck(themes[0], themes[1]);
      state.decks.player2 = tagAutoDeck(built.cards, 'jumpstart');
      toast(`AI deck generated: ${built.name}.`);
      upgradeDeckSlot('player2', 'jumpstart', () => buildRealAiDeck(aiTier()));
    }
    state.screen = 'game';
    render();
  };
  bind('#playAI', () => startVsAI(false));
  bind('#playCoop', () => startVsAI(true));

  const difficultyBlurb = div.querySelector('#difficultyBlurb');
  const showBlurb = () => {
    const table = window.GALDUR_AI && window.GALDUR_AI.DIFFICULTY;
    const entry = table && table[state.aiDifficulty];
    if (difficultyBlurb) difficultyBlurb.textContent = entry ? entry.blurb : '';
  };
  showBlurb();
  const bringSel = div.querySelector('#bringDeckSelect');
  const bringInto = (slot) => {
    if (!bringSel) return;
    const entry = loadDeckFromLibrary(bringSel.value, slot);
    if (entry) { toast(`${entry.name} → ${slot === 'player1' ? 'your deck' : 'opponent deck'}.`); render(); }
  };
  const bringMine = div.querySelector('#bringDeckMine');
  if (bringMine) bringMine.onclick = () => bringInto('player' + state.currentPlayer);
  const bringOpp = div.querySelector('#bringDeckOpp');
  if (bringOpp) bringOpp.onclick = () => bringInto('player' + (state.currentPlayer === 1 ? 2 : 1));

  const turnStatus = div.querySelector('#turnStatus');
  const readTurn = () => ({
    urls: (div.querySelector('#turnUrls')?.value || '').trim(),
    username: (div.querySelector('#turnUser')?.value || '').trim(),
    credential: (div.querySelector('#turnPass')?.value || '').trim()
  });
  const saveTurnBtn = div.querySelector('#saveTurn');
  if (saveTurnBtn) saveTurnBtn.onclick = () => {
    const t = readTurn();
    state.turnServer = t.urls ? t : null;
    scheduleSave();
    if (!t.urls) toast('Relay cleared.');
    else if (!validTurnUrls(t.urls).length) {
      toast('Saved, but that is not a usable TURN url — it must start with turn: or turns:.', 4500);
    } else toast('Relay saved.');
    render();
  };
  const clearTurnBtn = div.querySelector('#clearTurn');
  if (clearTurnBtn) clearTurnBtn.onclick = () => {
    state.turnServer = null; scheduleSave(); toast('Relay cleared.'); render();
  };
  const testTurnBtn = div.querySelector('#testTurn');
  if (testTurnBtn) testTurnBtn.onclick = async () => {
    const t = readTurn();
    if (!t.urls) { if (turnStatus) turnStatus.textContent = 'Enter a TURN url first.'; return; }
    testTurnBtn.disabled = true;
    if (turnStatus) turnStatus.textContent = 'Testing…';
    const ok = await testRelay(t);
    if (turnStatus) {
      turnStatus.textContent = ok
        ? '✅ Relay reachable — restrictive networks will work.'
        : '❌ No relay candidate. Check the url, username and credential.';
    }
    testTurnBtn.disabled = false;
  };

  const strictToggle = div.querySelector('#strictManaToggle');
  if (strictToggle) strictToggle.onchange = () => {
    state.strictMana = strictToggle.checked;
    scheduleSave();
  };
  div.querySelectorAll('.difficultyBtn').forEach(btn => {
    btn.onclick = () => {
      state.aiDifficulty = btn.dataset.diff;
      // Auto-built opponents (Horde, Boss) are composed per difficulty, so
      // rebuild them now rather than surprising the player at game start.
      applyAutoDeck(mode);
      scheduleSave();
      render();
    };
  });

  // host online (ID FIX)
  bind('#hostGame', () => {
    const deck = (state.decks && state.decks['player' + state.currentPlayer]) || [];
    const hasSharedStack = rules.sharedLibrary && ((state.decks.player1 || []).length || (state.decks.player2 || []).length);
    if (!deck.length && !hasSharedStack) { alert(rules.sharedLibrary ? 'Build or import the shared stack first.' : 'Build a deck first!'); return; }
    state.onlineMode = true;
    state.vsAI = false;
    if (typeof createOnlineRoom === 'function') createOnlineRoom();
    state.screen = 'game';
    render();
  });

  // join online (ID FIX)
  bind('#joinGame', () => {
    const deck = (state.decks && state.decks['player' + state.currentPlayer]) || [];
    if (!deck.length && !rules.sharedLibrary) { alert('Build a deck first!'); return; }
    const code = prompt('Paste connection code:');
    if (code && code.trim()) {
      state.onlineMode = true;
      state.vsAI = false;
      if (typeof joinOnlineRoom === 'function') joinOnlineRoom(code.trim());
      state.screen = 'game';
      render();
    }
  });

  return div;
}


// ------------------------------ D R A F T  ------------------------------
function DraftScreen(){
  const div = document.createElement('div');
  div.className = 'container';

  const D = state.draft;


  function setScreen(s){ D.screen = s; render(); }

  // helpers ---------------------------------------------------------------
  const colorNames = {W:'Plains',U:'Island',B:'Swamp',R:'Mountain',G:'Forest'};
  const manaSym = {W:'⚪',U:'🔵',B:'⚫',R:'🔴',G:'🟢'};

  function formatToScryfallLegal(format){
    // The format the player just picked wins. The entry mode's scryfall scope is
    // only a fallback — otherwise picking "Pauper" inside the Modern studio kept
    // querying legal:modern.
    const mode = getModeConfig(D.modeId || format);
    if (mode.scryfall && (!format || mode.format === format || mode.id === format)) return mode.scryfall;
    if (format === 'standard') return 'legal:standard';
    if (format === 'pioneer')  return 'legal:pioneer';
    if (format === 'modern')   return 'legal:modern';
    if (format === 'pauper')   return 'legal:pauper';
    if (format === 'legacy')   return 'legal:legacy';
    if (format === 'vintage')  return 'legal:vintage';
    if (format === 'premodern') return 'year>=1995 year<=2003 -is:digital';
    if (format === 'set' || format === 'cube' || format === 'casual') return 'game:paper';
    return 'legal:commander';
  }

  function draftScopeQuery(){
    const parts = [];
    const setCode = (D.setCode || '').trim().toLowerCase();
    if (setCode) parts.push(`set:${setCode}`);
    if (D.era === 'oldschool') parts.push('year<=1994');
    else if (D.era === 'premodern') parts.push('year>=1995 year<=2003');
    else if (D.era === 'modern-era') parts.push('year>=2003');
    else if (D.era === 'recent') parts.push('year>=2019');
    if (D.queryExtra) parts.push(D.queryExtra);
    return parts.join(' ');
  }

  function draftRarityQuery(){
    if (D.rarity === 'common') return 'rarity:common';
    if (D.rarity === 'uncommon') return 'rarity<=uncommon';
    return '';
  }

  function draftScopeLabel(){
    const bits = [];
    if (D.setCode) bits.push(`Set ${D.setCode.toUpperCase()}`);
    if (D.era) bits.push({
      oldschool: 'Old School',
      premodern: 'Premodern',
      'modern-era': 'Modern era',
      recent: 'Recent sets'
    }[D.era] || D.era);
    if (D.rarity === 'common') bits.push('Commons only');
    return bits.join(' • ');
  }

  function chosenIdentityToken(){
    // Scryfall "id<=" means color identity is subset of these letters
    // e.g., 'ur' allows U/R, UR multi, and mono U or mono R if not excluded elsewhere.
    return D.chosenColors.join('').toLowerCase();
  }

async function fetchThreeChoices(){
  const legal = formatToScryfallLegal(D.format);
  const idTok = chosenIdentityToken();
  const scopeQ = draftScopeQuery();
  const rarityFilter = draftRarityQuery();

  // rarity & artifact logic (unchanged policy)
  const rareRound   = (!rarityFilter && D.picks > 0 && D.picks % 10 === 0);
  const wantArtifact = Math.random() < 0.12; // 12%

  // helper: shuffle in-place
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // Build three CMC bands per round (diversity)
  const bands = shuffle([[0,2],[3,4],[5,20]]); // low, mid, high

  // Base query: format + colors; never lands
  const base = [legal, scopeQ, rarityFilter, `id<=${idTok}`, '-t:land'].filter(Boolean).join(' ');

  // Optional rarity upgrade
  const rarityQ = rareRound ? ' (rarity>=rare)' : '';

  // Optional artifact path (still respect format; artifacts are allowed outside color identity)
  const maybeArtifactQ = wantArtifact ? ['t:artifact', legal, scopeQ, rarityFilter, '-t:land', rarityQ].filter(Boolean).join(' ') : null;

  if (!D.seenIds)   D.seenIds = {};
  if (!D.seenNames) D.seenNames = {};
  const unseen = (c) => c && !D.seenIds[c.id] && !D.seenNames[c.name];
  const inBand = (c, lo, hi) => {
    const cmc = getCMC(c);
    return cmc === null || (cmc >= lo && cmc <= hi);
  };

  // One search page backs the whole draft; the CMC bands and the artifact slot
  // are applied locally, so a pick costs no network round trips at all.
  const picks = [];
  for (let b = 0; b < bands.length; b++){
    const [lo, hi] = bands[b];
    const artifactSlot = maybeArtifactQ && b === 0;
    const poolQ = artifactSlot ? maybeArtifactQ : `${base}${rarityQ}`;

    let card = await drawFromPool(poolQ, c => unseen(c) && inBand(c, lo, hi));
    // Nothing left in this band — take anything unseen from the same pool.
    if (!card) card = await drawFromPool(poolQ, unseen);
    // Pool exhausted or empty (over-narrow query): widen to the bare format.
    if (!card) {
      const lastResort = [legal, scopeQ, rarityFilter, '-t:land'].filter(Boolean).join(' ');
      card = await drawFromPool(lastResort, unseen);
    }
    if (card) {
      D.seenIds[card.id] = 1;
      D.seenNames[card.name] = 1;
      picks.push(card);
    }
  }

  // Top up if a slot came back empty.
  const lastResort = [legal, scopeQ, rarityFilter, '-t:land'].filter(Boolean).join(' ');
  while (picks.length < 3){
    const card = await drawFromPool(lastResort, unseen);
    if (!card) break;
    D.seenIds[card.id] = 1;
    D.seenNames[card.name] = 1;
    picks.push(card);
  }

  D.pool = picks.slice(0,3);
}

async function fetchThreeChoicesCustom(){
  const seenNameSet = new Set(Object.keys(D.seenNames || {}));
  const chosen = new Set((D.chosenColors || []).map(String));
  const filterByColors = !!(D.customParams && D.customParams.filterByColors);

  function eligible(c, relaxColors=false){
    if (!c || !c.name) return false;

    // hard exclude lands
    const type = (c.type || '').toLowerCase();
    if (type.includes('land')) return false;

    // singleton suggestion level (avoid offering a name already in deck when duplicates disallowed)
    if (!D.allowDuplicates && D.deck.some(x => x.name === c.name)) return false;

    // never re-offer same name within this draft
    if (seenNameSet.has(c.name)) return false;

    // color gating (optional)
    if (filterByColors && !relaxColors && chosen.size){
      const cols = new Set((c.colors || []).map(String));
      for (const col of cols) if (!chosen.has(col)) return false;
    }
    return true;
  }

  const fullPool = Array.isArray(D.customPool) ? D.customPool : [];

  // First pass: strict colors (if enabled), no lands
  let pool = fullPool.filter(c => eligible(c, false));

  // If too few options, relax color filter but still exclude lands
  if (pool.length < 3) pool = fullPool.filter(c => eligible(c, true));

  if (pool.length === 0){
    // Nothing eligible — keep UI responsive and instruct the user
    D.pool = [];
    toast('No eligible cards left in custom pool. Consider allowing duplicates or disabling color filtering.');
    return;
  }

  // Shuffle and take up to 3 distinct names
  for (let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = [];
  const used = new Set();
  for (const c of pool){
    if (!used.has(c.name)){
      picks.push(c);
      used.add(c.name);
      if (picks.length >= 3) break;
    }
  }

  if (!D.seenNames) D.seenNames = {};
  picks.forEach(c => { D.seenNames[c.name] = 1; });
  D.pool = picks;
}

async function fetchCurrentDraftPool(){
  if (D.mode === 'custom') await fetchThreeChoicesCustom();
  else await fetchThreeChoices();
}

// The old preload machinery (generateNextDraftPool / preloadNextPool /
// usePreloadedPoolIfReady) existed to hide per-pick network latency. The shared
// card pool removed that latency, and the preloader was actively harmful: it
// blanked D.pool as a side channel while borrowing the fetch path, so a render
// landing in that window painted an empty draft row that never recovered.
async function ensurePool(){
  if (D.pool.length > 0) return;
  D.poolError = false;
  // Try a few times before giving up — a single network blip shouldn't end the draft.
  for (let attempt = 0; attempt < 3; attempt++){
    try {
      await fetchCurrentDraftPool();
      if (D.pool.length > 0) {
        D.poolError = false;
        return;
      }
    } catch(e){
      console.error('Draft fetch attempt failed:', e);
    }
    await _delay(500 * (attempt + 1));
  }
  // Still nothing: flag it so Picks shows a Retry button instead of a dead screen.
  D.pool = [];
  D.poolError = true;
  toast('Couldn’t load cards from Scryfall. Check your connection and press Retry.', 3500);
}

async function pushBasicLands(){
  // Map draft shorthand → Scryfall type keyword
  const typeName = { W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest' };

  // Resolve art once per land NAME, then clone. This used to be one network
  // request per land COPY, which made finishing a draft take many seconds.
  for (const k of Object.keys(D.basicLands)){
    const n = (D.basicLands[k] | 0);
    if (n <= 0) continue;
    const landName = typeName[k];
    const art = await resolveLandArt(landName);

    for (let i = 0; i < n; i++){
      D.deck.push({
        id: `land_${k}_${i}_${makeId('bl')}`,
        name: landName,
        type: art?.type || `Basic Land — ${landName}`,
        cost: '',
        colors: [k],
        effect: '',
        power: 0, toughness: 0,
        imageUrl: art?.imageUrl || '',
        rarity: 'common'
      });
    }
  }
}

  function canAdd(card){
    if (D.allowDuplicates) return true;
    return !D.deck.some(x => x.name === card.name);
  }

  async function pickCard(idx){
    const card = D.pool[idx];
    if (!card) return;
    if (!canAdd(card)){
      toast('Commander singleton: duplicate not allowed'); 
      return;
    }
    if (!D.seenIds)   D.seenIds = {};
if (!D.seenNames) D.seenNames = {};
D.seenIds[card.id] = 1;
D.seenNames[card.name] = 1;
    D.deck.push(card);
    D.picks += 1;
    D.pool = []; // next round
    const left = D.target - D.deck.length;
    if (left <= 0){
      D.screen = 'done';
      render();
      return;
    }
    await ensurePool();
    render();
  }

  function deckCount(){ return D.deck.length; }
  function leftCount(){ return Math.max(0, D.target - deckCount()); }

function Mode(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="header">
      <button id="back" class="btn btn-secondary text-sm">← Builder</button>
      <h1 style="font-size:24px;font-weight:800">Choose Draft Mode</h1>
      <div></div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      <div class="card p-4" id="goTraditional" style="cursor:pointer">
        <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Traditional Draft</h3>
        <p class="text-xs text-gray">Random three-card offers from Scryfall, color-filtered by your choice; 60-card or 100-card Commander singleton.</p>
      </div>
      <div class="card p-4" id="goCustom" style="cursor:pointer">
        <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Custom Draft</h3>
        <p class="text-xs text-gray">Upload a JSON decklist (export format) to act as the draft pool. Optional color filtering. Same pick flow.</p>
      </div>
      <div class="card p-4" id="goWinston" style="cursor:pointer">
        <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Winston Draft</h3>
        <p class="text-xs text-gray">Local hotseat two-player pile draft from a cube, collection, deck, or generated starter pool.</p>
      </div>
        <div class="card p-4" id="goDraftOff" style="cursor:pointer">
    <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Draft-off (2-Player Online)</h3>
    <p class="text-xs text-gray">
      Both players connect online. Each round, 9 random non-land cards from a random set appear.
      Players alternate picks until 3 remain; the starting player alternates each round. Repeat until both reach 42 cards, then add lands to 60.
    </p>
  </div>

      
    </div>
  `;
  wrap.querySelector('#back').onclick = ()=>{ state.screen='builder'; render(); };
  wrap.querySelector('#goTraditional').onclick = ()=>{
    D.mode='traditional';
    D.screen='setup';
    render();
  };
  wrap.querySelector('#goCustom').onclick = ()=>{
    D.mode='custom';
    D.screen='custom-setup';
    render();
  };
  wrap.querySelector('#goWinston').onclick = ()=>{
    D.mode='winston';
    D.screen='winston-setup';
    render();
  };
wrap.querySelector('#goDraftOff').onclick = ()=>{
  D.mode = 'draftoff';
  D.screen = 'draftoff-setup';   // <-- switch the main Draft sub-screen
  state.screen = 'draft';
  render();
};
  return wrap;
}

  // setup steps -----------------------------------------------------------
  function Setup(){
    const wrap = document.createElement('div');
    const mode = getModeConfig(D.modeId || state.selectedMode || 'standard-draft');
    wrap.innerHTML = `
      <div class="header">
        <button id="back" class="btn btn-secondary text-sm">← Back</button>
        <h1 style="font-size:24px;font-weight:700">Draft Setup</h1>
        <div class="badge">${htmlEscape(mode.title)}</div>
      </div>

      <div class="grid grid-2">
      <div class="card p-4">
        <div class="mb-4">
          <label>Format preset</label>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary" data-f="standard">Standard (60)</button>
            <button class="btn btn-secondary" data-f="pioneer">Pioneer (60)</button>
            <button class="btn btn-secondary" data-f="modern">Modern (60)</button>
            <button class="btn btn-secondary" data-f="premodern">Premodern (60)</button>
            <button class="btn btn-secondary" data-f="pauper" data-rarity="common">Pauper (60)</button>
            <button class="btn btn-secondary" data-f="commander">Commander (100, singleton)</button>
          </div>
        </div>
        <button id="useModePreset" class="btn btn-primary">Use ${htmlEscape(mode.title)} Preset</button>
        <p class="text-xs text-gray mt-4">After choosing a format, you get a color scheme, optional basics, then three-card picks until the deck is full.</p>
      </div>

      <div class="card p-4">
        <label>Set or period scope</label>
        <div class="grid grid-2" style="gap:10px">
          <div>
            <label class="text-xs">Set code</label>
            <input id="draftSetCode" class="input" placeholder="e.g. ltr, mh3, dmu" value="${htmlEscape(D.setCode || '')}">
          </div>
          <div>
            <label class="text-xs">Period</label>
            <select id="draftEra" class="input">
              <option value="" ${!D.era ? 'selected' : ''}>Any</option>
              <option value="oldschool" ${D.era === 'oldschool' ? 'selected' : ''}>Old School</option>
              <option value="premodern" ${D.era === 'premodern' ? 'selected' : ''}>Premodern</option>
              <option value="modern-era" ${D.era === 'modern-era' ? 'selected' : ''}>Modern era</option>
              <option value="recent" ${D.era === 'recent' ? 'selected' : ''}>Recent sets</option>
            </select>
          </div>
        </div>
        <label class="text-xs flex mt-4" style="gap:6px;align-items:center;cursor:pointer">
          <input id="draftCommonsOnly" type="checkbox" ${D.rarity === 'common' ? 'checked' : ''}>
          Commons only
        </label>
        <button id="useScopedDraft" class="btn btn-blue mt-4">Use Set / Period Scope</button>
        <p class="text-xs text-gray mt-4">Leave set code blank to draft from the selected period. Set code wins if both are filled.</p>
      </div>
      </div>
    `;
    wrap.querySelector('#back').onclick = () => { D.screen='mode'; render(); };

    function beginDraft(format, opts = {}){
      // Fresh draft: clear the previous run's picks, or the first pick of the
      // new draft instantly "completes" an already-full deck.
      D.deck = [];
      D.picks = 0;
      D.pool = [];
      D.seenIds = {};
      D.seenNames = {};
      D.chosenColors = [];
      D.basicLands = { W:0, U:0, B:0, R:0, G:0 };
      D.format = format;
      D.target = opts.target || (format === 'commander' ? 100 : 60);
      D.allowDuplicates = opts.allowDuplicates ?? (format !== 'commander');
      D.rarity = opts.rarity ?? '';
      D.setCode = (opts.setCode ?? '').trim().toLowerCase();
      D.era = opts.era ?? '';
      D.queryExtra = opts.queryExtra ?? '';
      D.offeredColorSets = randomColorOffers();
      setScreen('colors');
    }

    wrap.querySelector('#useModePreset').onclick = () => {
      beginDraft(mode.format || 'standard', {
        target: mode.target || (mode.format === 'commander' ? 100 : 60),
        allowDuplicates: !mode.singleton,
        rarity: mode.rarity || '',
        queryExtra: mode.queryExtra || ''
      });
    };

    wrap.querySelector('#useScopedDraft').onclick = () => {
      const setCode = (wrap.querySelector('#draftSetCode').value || '').trim().toLowerCase();
      const era = wrap.querySelector('#draftEra').value || '';
      const commonsOnly = !!wrap.querySelector('#draftCommonsOnly').checked;
      beginDraft(setCode ? 'set' : (era === 'premodern' ? 'premodern' : 'set'), {
        target: 60,
        rarity: commonsOnly ? 'common' : '',
        setCode,
        era
      });
    };

    wrap.querySelectorAll('[data-f]').forEach(b=>{
      b.onclick = ()=>{
        beginDraft(b.dataset.f, { rarity: b.dataset.rarity || '' });
      };
    });
    return wrap;
  }
  
  function CustomSetup(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="header">
      <button id="back" class="btn btn-secondary text-sm">← Back</button>
      <h2 style="font-size:20px;font-weight:700">Custom Draft — Pool & Settings</h2>
      <div></div>
    </div>

    <div class="grid grid-2">
      <div class="card p-4">
        <label>Upload custom pool (.json)</label>
        <input id="customPoolFile" type="file" accept=".json" class="input" />
        <div id="customPoolStatus" class="text-xs text-gray" style="margin-top:8px">No file loaded.</div>

        <div class="mb-4" style="margin-top:12px">
          <label>Format</label>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary" data-f="standard">Standard (60)</button>
            <button class="btn btn-secondary" data-f="pioneer">Pioneer (60)</button>
            <button class="btn btn-secondary" data-f="modern">Modern (60)</button>
            <button class="btn btn-secondary" data-f="premodern">Premodern (60)</button>
            <button class="btn btn-secondary" data-f="pauper" data-rarity="common">Pauper (60)</button>
            <button class="btn btn-secondary" data-f="commander">Commander (100, singleton)</button>
          </div>
        </div>

        <div class="flex" style="gap:10px;align-items:center;margin:8px 0 12px">
          <label class="text-xs flex" style="gap:6px;align-items:center;cursor:pointer">
            <input id="customFilterColors" type="checkbox" checked>
            Only offer cards within chosen colors
          </label>
          <label class="text-xs flex" style="gap:6px;align-items:center;cursor:pointer">
            <input id="customAllowDupes" type="checkbox" checked>
            Allow duplicates
          </label>
        </div>

        <div class="flex" style="gap:8px">
          <button id="continueCustom" class="btn btn-primary" disabled>Continue</button>
        </div>

        <p class="text-xs text-gray mt-4">
          JSON must be your app’s export format (i.e., <code>{"cards":[...]}</code>).
          Cards in the pool with “Land” in type are ignored as draft offers.
        </p>
      </div>

      <div class="card p-4">
        <strong>Pool preview</strong>
        <div id="customPoolPreview" class="text-xs text-gray" style="margin-top:6px">—</div>
      </div>
    </div>
  `;

  wrap.querySelector('#back').onclick = ()=>{ D.screen='mode'; render(); };

  // format choose
  wrap.querySelectorAll('[data-f]').forEach(b=>{
    b.onclick = ()=>{
      const f = b.dataset.f;
      D.format = f;
      D.target = (f==='commander') ? 100 : 60;
      D.rarity = b.dataset.rarity || '';
      // default singleton only in commander – can be overridden by the checkbox
      D.allowDuplicates = (f!=='commander');
      wrap.querySelector('#customAllowDupes').checked = D.allowDuplicates;
    };
  });

  // file upload
  const fileInput = wrap.querySelector('#customPoolFile');
  const statusEl  = wrap.querySelector('#customPoolStatus');
  const previewEl = wrap.querySelector('#customPoolPreview');
  const contBtn   = wrap.querySelector('#continueCustom');

  fileInput.onchange = async (e)=>{
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try{
      const text = await f.text();
      const j = JSON.parse(text);
      if (!Array.isArray(j.cards)) throw new Error('Missing "cards" array.');
      // normalize / hydrate images just in case
      const pool = j.cards.map(c=>{
        const img = c.image || c.imageUrl ||
          `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(c.name||'')}`;
        return {
          id: c.id || (c.name + '_' + Math.random()),
          name: c.name,
          type: c.type || '',
          cost: c.cost || '',
          colors: Array.isArray(c.colors) ? c.colors : [],
          effect: c.effect || '',
          power: c.power || 0,
          toughness: c.toughness || 0,
          imageUrl: img,
          rarity: c.rarity || 'common'
        };
      });
      D.customPool = pool;
      statusEl.textContent = `Loaded ${pool.length} cards.`;
      previewEl.innerHTML = `${pool.slice(0,12).map(x=>x.name).join(', ')}${pool.length>12?' …':''}`;
      contBtn.disabled = pool.length === 0;
    }catch(err){
      statusEl.textContent = 'Invalid JSON: ' + err.message;
      contBtn.disabled = true;
    }
  };

  // params
  wrap.querySelector('#customAllowDupes').onchange = (e)=>{
    D.allowDuplicates = !!e.target.checked;
  };
  wrap.querySelector('#customFilterColors').onchange = (e)=>{
    D.customParams.filterByColors = !!e.target.checked;
  };

  // continue to color selection (we keep the same flow)
  contBtn.onclick = ()=>{
    D.offeredColorSets = randomColorOffers();
    D.chosenColors = []; // chosen next step
    D.seenIds = {}; D.seenNames = {};
    D.screen = 'colors';
    render();
  };

  return wrap;
}

  function Colors(){
    const offers = D.offeredColorSets;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="header">
        <button id="back" class="btn btn-secondary text-sm">← Back</button>
        <h2 style="font-size:20px;font-weight:700">Choose a color scheme</h2>
        <div></div>
      </div>

      <div class="card p-4">
        <div class="flex" style="gap:10px;flex-wrap:wrap">
          ${offers.map((set,i)=>`
            <button class="btn btn-secondary" data-i="${i}">
              ${set.map(c=>`${manaSym[c]} ${c}`).join(' ')}
            </button>
          `).join('')}
        </div>
        <p class="text-xs text-gray mt-4">Choices include mono / double / triple colors at random. Draft pool will be filtered to these colors when possible.</p>
      </div>
    `;
    wrap.querySelector('#back').onclick = () => setScreen('setup');
    wrap.querySelectorAll('[data-i]').forEach(b=>{
      b.onclick = ()=>{
        D.chosenColors = offers[+b.dataset.i];
        setScreen('lands');
      };
    });
    return wrap;
  }

  function Lands(){
    const wrap = document.createElement('div');
    const cols = D.chosenColors;
    const inputs = cols.map(c=>`
      <div>
        <label>${c} ${colorNames[c]}</label>
        <input class="input" type="number" min="0" max="${(D.format==='commander')?40:30}" value="0" data-c="${c}">
      </div>`).join('');

    wrap.innerHTML = `
      <div class="header">
        <button id="back" class="btn btn-secondary text-sm">← Back</button>
        <h2 style="font-size:20px;font-weight:700">Optional: pre-fill basic lands</h2>
        <div></div>
      </div>

      <div class="grid grid-2">
        <div class="card p-4">
          <div class="grid grid-2" style="gap:12px">${inputs}</div>
          <div class="mt-4 flex" style="gap:8px;flex-wrap:wrap">
            <button id="skip" class="btn btn-secondary">Skip</button>
            <button id="apply" class="btn btn-primary">Continue</button>
            <button id="pickLandArt" class="btn btn-secondary">🏞️ Choose land art</button>
          </div>
          <p class="text-xs text-gray mt-4">Example: set Islands=14 and continue; the draft will fill the remaining slots to ${D.target}.</p>
        </div>
        <div class="card p-4">
          <div><strong>Format:</strong> ${D.format}, target ${D.target} cards</div>
          <div class="text-xs text-gray mt-2">Commander: singletons enforced.</div>
        </div>
      </div>
    `;
    wrap.querySelector('#back').onclick = () => setScreen('colors');
    wrap.querySelector('#pickLandArt').onclick = () => {
      const first = { W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest' }[cols[0]] || 'Plains';
      openLandPicker(first);
    };
    wrap.querySelector('#skip').onclick = () => { D.basicLands={W:0,U:0,B:0,R:0,G:0}; beginPicks(); };
    wrap.querySelector('#apply').onclick = ()=>{
      const obj = {W:0,U:0,B:0,R:0,G:0};
      wrap.querySelectorAll('input[data-c]').forEach(inp=>{
        obj[inp.dataset.c] = Math.max(0, parseInt(inp.value||'0',10));
      });
      D.basicLands = obj;
      beginPicks();
    };
    return wrap;
  }
  
  function LandsFillScreen(){
  const D = state.draft;
  const wrap = document.createElement('div');
  wrap.className = 'screen';
    const who = D.lands.who;

// Bind globals into this scope (works whether they’re defined inside or outside the IIFE)
 const BASIC     = (window.BASIC_LANDS || ['Plains','Island','Swamp','Mountain','Forest']);
 const fetchLand = window.fetchBasicLandCard || (async (landName)=>{
   const r = await scryfetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(landName)}`);
   const c = await r.json(); const img = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
   return { id:c.id, name:c.name, type:c.type_line||'Basic Land', cost:'', colors:[], effect:'', power:0, toughness:0, imageUrl:img, rarity:c.rarity||'common' };
 });
 const cloner    = window.cloneCard || (base => ({ ...base, id: 'id_'+Math.random().toString(36).slice(2)+Date.now().toString(36) }));


  wrap.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:16px">
      <h2 style="font-weight:800;font-size:22px;margin-bottom:8px">
        Basic Lands — Player ${who}
      </h2>
      <p class="text-sm" style="opacity:.8;margin-bottom:10px">
        Deck size target: ${D.lands.targetTotal}. Current nonland cards: <b>${D.lands.baseCount}</b>.
        Remaining slots: <b id="remain">${D.lands.remaining}</b>.
      </p>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:12px">
           ${BASIC.map(n => `
          <div class="card p-3" data-land="${n}">
            <div style="font-weight:700;margin-bottom:6px">${n}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-secondary" data-act="dec" data-name="${n}">−</button>
              <div id="cnt_${n}" style="min-width:30px;text-align:center">${D.lands.counts[n] || 0}</div>
              <button class="btn btn-secondary" data-act="inc" data-name="${n}">+</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="finalize" class="btn btn-primary" ${D.lands.remaining>0?'disabled':''}>
          Finalize Player ${who}
        </button>
        <button id="pickLandArtFill" class="btn btn-secondary">🏞️ Choose land art</button>
      </div>
    </div>
  `;

  const pickArtBtn = wrap.querySelector('#pickLandArtFill');
  if (pickArtBtn) pickArtBtn.onclick = () => openLandPicker('Plains');

  // Wire +/- and finalize
  wrap.querySelectorAll('button[data-act]').forEach(btn=>{
    btn.onclick = ()=>{
      const name = btn.getAttribute('data-name');
      const act  = btn.getAttribute('data-act');
      if (act === 'inc' && D.lands.remaining > 0){
        D.lands.counts[name] += 1;
        D.lands.remaining -= 1;
      } else if (act === 'dec' && D.lands.counts[name] > 0){
        D.lands.counts[name] -= 1;
        D.lands.remaining += 1;
      }
      wrap.querySelector('#remain').textContent = D.lands.remaining;
      wrap.querySelector('#finalize').disabled  = D.lands.remaining > 0;
  BASIC.forEach(n => {
        const slot = wrap.querySelector('#cnt_'+n);
        if (slot) slot.textContent = D.lands.counts[n];
      });
    };
  });

  wrap.querySelector('#finalize').onclick = async (ev)=>{
    // Each land type costs one awaited fetch; without a guard a second click
    // runs the whole loop again and doubles every basic in the pool.
    if (D.lands.finalizing) return;
    D.lands.finalizing = true;
    ev.currentTarget.disabled = true;
    ev.currentTarget.textContent = 'Finalizing…';
    // Build land cards and append to the player's pool
    const pool = (who === 1) ? D.off.p1 : D.off.p2;

for (const n of BASIC){
      const k = D.lands.counts[n];
      if (k <= 0) continue;
        const base = await fetchLand(n);
  for (let i=0;i<k;i++) pool.push(cloner(base));
  
    }

    if (D.off.isLocal){
  if (who === 1){
    if (D.off.vsBot && D.off.p2LandsDone){
      // The bot already finished its deck — straight to the results screen.
      state.decks.player1 = (D.off.p1 || []).slice();
      state.decks.player2 = (D.off.p2 || []).slice();
      D.screen = 'decklists';
      render();
      return;
    }
    initLandsFill(2);
    render();
    return;
  } else {
    // Both players finalized: save decks and show the side-by-side results screen
    state.decks.player1 = (D.off.p1 || []).slice();
    state.decks.player2 = (D.off.p2 || []).slice();
    D.screen = 'decklists';
    render();
    return;
  }
}

// Online: set my deck and send to opponent
const meKey = 'player' + state.currentPlayer;
const myPlayer = state.currentPlayer;
state.decks[meKey] = pool.slice();
D.deck = pool.slice();

// Mark my lands as done
if (myPlayer === 1) {
  D.off.p1LandsDone = true;
} else {
  D.off.p2LandsDone = true;
}

// Send my finished deck to opponent
sendDraftOff({
  type: 'draftoff_lands_done',
  player: myPlayer,
  deck: pool.slice()
});

// Check if opponent already finished (from received message)
const oppDone = (myPlayer === 1) ? D.off.p2LandsDone : D.off.p1LandsDone;
if (oppDone) {
  // Both done - go to results screen
  state.decks.player1 = (D.off.p1 || []).slice();
  state.decks.player2 = (D.off.p2 || []).slice();
  D.screen = 'decklists';
} else {
  // Show waiting message
  D.screen = 'landswait';
}
render();

  };

  return wrap;
}

function LandsWaitScreen(){
  const D = state.draft;
  const wrap = document.createElement('div');
  wrap.className = 'screen';

  const myPlayer = state.currentPlayer;
  const myDeck = (myPlayer === 1) ? D.off.p1 : D.off.p2;

  wrap.innerHTML = `
    <div style="max-width:600px;margin:0 auto;padding:32px;text-align:center">
      <h2 style="font-weight:800;font-size:24px;margin-bottom:16px">
        Lands Finalized!
      </h2>
      <div class="card p-4 mb-4" style="background:rgba(59,130,246,0.15);border-color:#3b82f6;">
        <div style="font-size:48px;margin-bottom:12px">⏳</div>
        <p style="font-size:16px;margin-bottom:8px">
          Waiting for opponent to finish adding lands...
        </p>
        <p class="text-sm text-gray">
          Your deck: ${myDeck.length} cards
        </p>
      </div>
      <div class="text-xs text-gray">
        The results screen will appear when both players have finalized their decks.
      </div>
    </div>
  `;

  return wrap;
}

function DraftOffResults(){
  const D = state.draft;
  const wrap = document.createElement('div');
  wrap.className = 'screen';

  const p1 = D.off.p1 || [];
  const p2 = D.off.p2 || [];

  // group by name for a tidy list
  function group(cards){
    const m = new Map();
    for (const c of cards){ m.set(c.name || 'Unknown', (m.get(c.name || 'Unknown')||0)+1); }
    return Array.from(m.entries()).sort((a,b)=> b[1]-a[1] || (''+a[0]).localeCompare(b[0]));
  }
  const g1 = group(p1);
  const g2 = group(p2);

  function listHTML(g){
    return g.map(([name,qty])=>`<div class="flex items-center justify-between text-sm py-1">
      <span>${name}</span><span class="opacity-80">×${qty}</span></div>`).join('');
  }

  wrap.innerHTML = `
    <div style="max-width:1000px;margin:0 auto;padding:16px">
      <div class="header">
        <button id="backToMenu" class="btn btn-secondary text-sm">← Menu</button>
        <h2 style="font-size:20px;font-weight:700">Draft-off Results</h2>
        <div class="badge">P1: ${p1.length}/60 • P2: ${p2.length}/60</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card p-4">
          <h3 style="font-weight:800;margin-bottom:8px">Player 1 Deck (${p1.length})</h3>
          <div class="mb-3" style="max-height:320px;overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;">
            ${listHTML(g1)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="useP1" class="btn btn-primary">Use as Player 1 deck</button>
            <button id="dlP1" class="btn btn-secondary">Download JSON</button>
          </div>
        </div>

        <div class="card p-4">
          <h3 style="font-weight:800;margin-bottom:8px">Player 2 Deck (${p2.length})</h3>
          <div class="mb-3" style="max-height:320px;overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;">
            ${listHTML(g2)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="useP2" class="btn btn-primary">Use as Player 2 deck</button>
            <button id="dlP2" class="btn btn-secondary">Download JSON</button>
          </div>
        </div>
      </div>

      <div class="card p-4 mt-4" style="text-align:center">
        <h3 style="font-weight:800;margin-bottom:12px">Ready to Battle?</h3>
        <p class="text-sm text-gray mb-3">Load both decks and start a game with your drafted cards.</p>
        <button id="startBattle" class="btn btn-green" style="padding:12px 32px;font-size:16px">
          Start Battle with Drafted Decks
        </button>
      </div>
    </div>
  `;

  wrap.querySelector('#backToMenu').onclick = ()=>{ state.screen = 'menu'; render(); };

  function downloadNamedDeck(cards, filename){
    const data = JSON.stringify({ name: filename.replace(/\.json$/,''), cards: cards }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // Online: currentPlayer is the WebRTC seat (host=1, joiner=2) and drives pick
  // gating, deck sync and turn attribution — reassigning it here would swap the
  // player's identity mid-session. Only the local hotseat may switch seats.
  wrap.querySelector('#useP1').onclick = ()=>{
    state.decks.player1 = p1.slice();
    if (D.off.isLocal) state.currentPlayer = 1;
    toast('Loaded as Player 1 deck.');
    render();
  };
  wrap.querySelector('#useP2').onclick = ()=>{
    state.decks.player2 = p2.slice();
    if (D.off.isLocal) state.currentPlayer = 2;
    toast('Loaded as Player 2 deck.');
    render();
  };
  wrap.querySelector('#dlP1').onclick = ()=> downloadNamedDeck(p1, 'draftoff_player1.json');
  wrap.querySelector('#dlP2').onclick = ()=> downloadNamedDeck(p2, 'draftoff_player2.json');

  wrap.querySelector('#startBattle').onclick = ()=>{
    // Load both decks
    state.decks.player1 = p1.slice();
    state.decks.player2 = p2.slice();

    // If online, go to battle menu; if local (hotseat), go to local battle
    if (D.off.isLocal) {
      // Local hotseat battle
      state.onlineMode = false;
      state.screen = 'battlemenu';
    } else {
      // Online battle - connection should still be open
      state.screen = 'battlemenu';
    }
    render();
  };

  return wrap;
}

 async function beginPicks(){
   // Show the picks screen in a "dealing" state straight away — fetching the
   // lands and the first pool used to leave the UI frozen with no feedback.
   D.screen = 'picks';
   D.dealing = true;
   render();
   try {
     await pushBasicLands();   // prefill lands into deck if any (with images)
     await ensurePool();
   } finally {
     D.dealing = false;
     render();
   }
 }

  function Picks(){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="header">
        <button id="back" class="btn btn-secondary text-sm">← Exit</button>
        <h2 style="font-size:20px;font-weight:700">Pick one card • ${deckCount()}/${D.target}</h2>
        <div class="badge">Colors: ${D.chosenColors.join(', ') || '-'}${draftScopeLabel() ? ' • ' + htmlEscape(draftScopeLabel()) : ''}</div>
      </div>

<!-- Stats toggle for draft deck -->
<button id="draftStatsToggle" class="stats-toggle" type="button" aria-expanded="false" aria-controls="draftStatsCard">
  <span class="left"><span class="chip"></span><span>Draft Deck Statistics </span></span>
  <span class="chev">▸</span>
</button>
<div class="card p-4 hidden" id="draftStatsCard" style="margin-bottom:12px">
  <div id="manaCurveDraftChart"></div>
</div>

      ${D.dealing ? `<div class="card p-3 mb-3 text-center" style="background:rgba(59,130,246,.15);border-color:#3b82f6">
        <strong>Dealing cards…</strong>
        <div class="text-xs text-gray mt-1">Fetching a card pool from Scryfall. This happens once per draft.</div>
      </div>` : ''}

      <div class="draft-wrap">
        <div class="draft-stage">
          <div id="draftRow" class="draft-row">
            ${D.pool.map((c,i)=>`
              <div class="draft-choice" data-i="${i}">
                ${c.imageUrl ? cardImageMarkup(c, { loading: 'eager', style: 'width:100%;display:block' })
                              : `<div style="height:220px;background:#374151;display:flex;align-items:center;justify-content:center">${htmlEscape(c.name)}</div>`}
                <div style="position:absolute;left:6px;top:6px" class="badge">${(c.rarity||'').toUpperCase()}</div>
                <div style="position:absolute;right:6px;bottom:6px" class="badge">${c.name}</div>
              </div>
            `).join('')}
          </div>
          ${D.poolError ? `
            <div class="text-center" style="padding:24px">
              <p class="text-red mb-4">Couldn’t load cards from Scryfall.</p>
              <button id="retryPool" class="btn btn-primary">↻ Retry</button>
            </div>` : ''}
          <div class="text-xs text-gray mt-4">Click one card to draft; the other two disappear.</div>
        </div>

        <div class="draft-side">
          <div id="draftPreview" class="draft-preview">
            <div class="text-xs text-gray text-center" style="padding:18px">Hover a card to read it here</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <div><strong>Draft List</strong></div>
            <div class="text-xs badge">Left: ${leftCount()}</div>
          </div>
          <div id="draftList" style="margin-top:8px;max-height:56vh;overflow-y:auto;padding-right:4px">
            ${D.deck.map((c, di)=>`
              <div class="draft-small" data-di="${di}">
                ${c.imageUrl ? cardImageMarkup(c, { style: 'width:100%;display:block' }) : `<div class="badge">${htmlEscape(c.name)}</div>`}
                <div class="text-xs" style="line-height:1.1">
                  <div><strong>${htmlEscape(c.name)}</strong></div>
                  <div class="text-gray">${htmlEscape(c.type || '')}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 flex" style="gap:8px">
            <button id="finishNow" class="btn btn-secondary">Finish</button>
          </div>
          <p class="text-xs text-gray mt-2">“Finish” saves current picks into your deck even if not full.</p>
        </div>
      </div>
    `;

    // events
    wrap.querySelector('#back').onclick = () => {
      if (!confirm('Leave draft? Picks will be kept only if you finish.')) return;
      state.screen='builder'; render();
    };
      
      const draftPreview = wrap.querySelector('#draftPreview');
      const showInPreview = (card) => {
        if (!draftPreview || !card) return;
        draftPreview.innerHTML = `
          ${cardImageMarkup(card, { loading: 'eager', style: 'width:100%;border-radius:8px;display:block' })}
          <div style="font-weight:800;margin-top:8px">${htmlEscape(card.name)}</div>
          <div class="text-xs text-gray">${htmlEscape(card.type || '')}${card.cost ? ' · ' + htmlEscape(card.cost) : ''}</div>
          ${card.effect ? `<div class="text-xs mt-2" style="white-space:pre-wrap;line-height:1.35">${htmlEscape(card.effect)}</div>` : ''}
        `;
      };
      wrap.querySelectorAll('.draft-choice').forEach(el=>{
        const card = D.pool[+el.dataset.i];
        el.onclick = ()=> pickCard(+el.dataset.i);
        // Hovering a choice reads it in the side panel, so the card can be
        // studied without a floating box covering the other two.
        el.onmouseenter = ()=> showInPreview(card);
      });
    wrap.querySelector('#finishNow').onclick = ()=> setScreen('done');

    // Hover a drafted card in the list to see it full size next to the cursor.
    let draftHover = wrap.querySelector('#draftHoverBox');
    if (!draftHover) {
      draftHover = document.createElement('div');
      draftHover.id = 'draftHoverBox';
      draftHover.className = 'zone-hover';
      wrap.appendChild(draftHover);
    }
    wrap.querySelectorAll('.draft-small').forEach(row => {
      const card = D.deck[Number(row.dataset.di)];
      if (!card) return;
      row.onmouseenter = () => showInPreview(card);
      row.onmousemove = (e) => {
        draftHover.innerHTML = `
          <div style="font-weight:700;margin-bottom:4px">${htmlEscape(card.name)}</div>
          <div class="text-xs text-gray" style="margin-bottom:6px">${htmlEscape(card.type || '')}${card.cost ? ' · ' + htmlEscape(card.cost) : ''}</div>
          ${cardImageMarkup(card, { style: 'width:100%;border-radius:6px;margin-bottom:6px;display:block' })}
          ${card.effect ? `<div style="font-size:12px;white-space:pre-wrap;line-height:1.3">${htmlEscape(card.effect)}</div>` : ''}
        `;
        placeHoverBox(draftHover, e);
      };
      row.onmouseleave = () => { draftHover.style.display = 'none'; };
    });
    const retryBtn = wrap.querySelector('#retryPool');
    if (retryBtn) retryBtn.onclick = async ()=>{ retryBtn.disabled = true; retryBtn.textContent = 'Loading…'; await ensurePool(); render(); };

    
    // Ensure stats CSS is present (re-use from builder if available)
(function ensureDeckStatsCSS(){
  if (document.getElementById('deckStatsCSS')) return;
  const s = document.createElement('style');
  s.id = 'deckStatsCSS';
  s.textContent = `
  .ds-card{background:rgba(255,255,255,0.03);border:1px solid rgba(139,92,246,0.35);border-radius:12px;padding:12px;}
  .ds-title{font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.8;margin-bottom:8px;}
  .ds-row{display:grid;gap:12px;}
  @media (min-width:900px){.ds-row{grid-template-columns:2fr 1fr 1fr;}}
  .ds-curve{height:160px;display:grid;align-items:end;gap:10px;grid-template-columns:repeat(var(--bins,1),minmax(16px,1fr));padding:8px 6px 0 6px;}
  .ds-col{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;}
  .ds-seg{width:100%;border:2px solid #ecfdf5;}
  .ds-seg.crea{background:linear-gradient(180deg,#34d399 0%,#10b981 100%);border-radius:8px 8px 0 0;}
.ds-seg.noncrea{ background: linear-gradient(180deg,#8b5cf6 0%,#6d28d9 100%); border-radius:0 0 8px 8px; }
.ds-seg.noncrea.only{
  /* ensure the top “white outline” always shows */
  border-top-width: 2px !important;
  border-top-style: solid !important;
  border-top-color: #ecfdf5 !important;

  /* force the same rounded cap as the green bars */
  border-top-left-radius: 8px !important;
  border-top-right-radius: 8px !important;
  border-radius: 8px 8px 4px 4px !important;

  /* optional: add a subtle crisp edge like the green cap */
  box-shadow: 0 0 0 1px rgba(236,253,245,.65) inset;
}
  .ds-x{margin-top:6px;display:grid;gap:10px;grid-template-columns:repeat(var(--bins,1),minmax(16px,1fr));font-size:11px;opacity:.8;text-align:center;}
  .ds-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font-size:11px;opacity:.85;}
  .ds-key{display:inline-flex;align-items:center;gap:6px;}
  .ds-swatch{width:12px;height:12px;border-radius:3px;border:1px solid rgba(255,255,255,.5);}
  .ds-pies{display:grid;gap:12px;grid-template-columns:1fr;}
  @media (min-width:900px){.ds-pies{grid-template-columns:1fr 1fr;}}
  .ds-piewrap{display:flex;gap:12px;align-items:center;}
  .ds-pie{--size:120px;width:var(--size);height:var(--size);border-radius:50%;border:2px solid rgba(236,253,245,0.7);box-shadow:inset 0 0 16px rgba(0,0,0,0.35);}
  .ds-list{font-size:12px;line-height:1.6;}
  .ds-list .row{display:flex;justify-content:space-between;gap:12px;}
  .ds-small{font-size:12px;opacity:.8;}
  .stats-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(31,41,55,0.85);border:1px solid rgba(139,92,246,0.55);border-radius:10px;font-size:14px;font-weight:700;color:#e9d5ff;cursor:pointer;box-shadow:0 4px 14px rgba(139,92,246,0.25);transition:border-color .15s ease, background .15s ease, transform .08s ease;margin-bottom:10px;}
  .stats-toggle:hover{border-color:#a78bfa;background:rgba(31,41,55,0.95);}
  .stats-toggle:active{transform:translateY(1px);}
  .stats-toggle .left{display:flex;align-items:center;gap:10px;}
  .stats-toggle .chip{width:10px;height:10px;border-radius:50%;background:linear-gradient(180deg,#34d399 0%,#10b981 100%);border:1px solid #ecfdf5;box-shadow:0 0 0 2px rgba(16,185,129,25);}
  .stats-toggle .chev{font-size:16px;opacity:.9;transition:transform .15s ease;}
  .stats-toggle.open .chev{transform:rotate(90deg);}
  `;
  document.head.appendChild(s);
})();

function typesBreakdownLocal(cards){
  const map = new Map();
  const push = (k)=> map.set(k, (map.get(k)||0)+1);
  for (const c of cards){
    const t = (c.type||'').toLowerCase();
    if (!t){ push('Other'); continue; }
    if (t.includes('artifact') && t.includes('creature')) { push('Artifact Creature'); continue; }
    if (t.includes('creature'))     { push('Creature'); continue; }
    if (t.includes('instant'))      { push('Instant'); continue; }
    if (t.includes('sorcery'))      { push('Sorcery'); continue; }
    if (t.includes('enchantment'))  { push('Enchantment'); continue; }
    if (t.includes('planeswalker')) { push('Planeswalker'); continue; }
    if (t.includes('artifact'))     { push('Artifact'); continue; }
    if (t.includes('basic') && t.includes('land')) { push('Basic Land'); continue; }
    if (t.includes('land'))         { push('Land'); continue; }
    push('Other');
  }
  return map;
}
function isLandLocal(c){ return ((c.type||'')+'').toLowerCase().includes('land'); }
function isCreatureLocal(c){ return ((c.type||'')+'').toLowerCase().includes('creature'); }

function getCMCLocal(card){ return getCMC(card); }   // delegates to the canonical top-level getCMC

function stackedCurveLocal(cards){
  const bins = new Map(); let peak = 0;
  for (const c of cards){
    if (isLandLocal(c)) continue;
    const cmc = getCMCLocal(c);
    if (cmc === null || !Number.isFinite(cmc)) continue;
    const o = bins.get(cmc) || {crea:0, non:0};
    if (isCreatureLocal(c)) o.crea += 1; else o.non += 1;
    bins.set(cmc, o);
    const tot = o.crea + o.non; if (tot > peak) peak = tot;
  }
  const keys = [...bins.keys()].sort((a,b)=>a-b);
  return { keys, bins, peak };
}
function averageCMCLocal(cards){
  let sum=0, n=0;
  for (const c of cards){
    if (isLandLocal(c)) continue;
    const cmc = getCMCLocal(c);
    if (cmc === null || !Number.isFinite(cmc)) continue;
    sum+=cmc; n++;
  }
  return n? (sum/n) : 0;
}
function countManaSymbolsLocal(cards){
  const out = {W:0,U:0,B:0,R:0,G:0};
  for (const c of cards){
    const s = (c?.manaCost || c?.manacost || c?.cost || '').toString().toUpperCase();
    if (!s) continue;
    const tokens = s.match(/\{([^}]+)\}/g) || [];
    for (const t of tokens){
      const inner = t.slice(1,-1).toUpperCase();
      for (const ch of inner.split(/[^A-Z]/).join('')){
        if (out.hasOwnProperty(ch)) out[ch] += 1;
      }
    }
    if (!tokens.length){
      (s.match(/[WUBRG]/g)||[]).forEach(ch => out[ch] += 1);
    }
  }
  return out;
}
function pieStyleFromCountsLocal(obj, palette){
  const entries = Object.entries(obj).filter(([k,v]) => v>0);
  const total = entries.reduce((a, [,v])=>a+v, 0) || 1;
  let acc = 0;
  const stops = entries.map(([k,v])=>{
    const start = acc / total * 360; acc += v; const end = acc / total * 360;
    const color = palette[k] || '#999';
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');
  return `background: conic-gradient(${stops});`;
}

function renderDraftStats(){
  const mount = wrap.querySelector('#manaCurveDraftChart');
  if (!mount) return;
  const deck = D.deck || [];
  const avg  = averageCMCLocal(deck);
  const { keys, bins, peak } = stackedCurveLocal(deck);

  const manaColors = countManaSymbolsLocal(deck);
  const colorPalette = { W:'#fef08a', U:'#60a5fa', B:'#6b7280', R:'#f87171', G:'#34d399' };

  const tb = typesBreakdownLocal(deck);
  const typeObj = Object.fromEntries(tb);
  const typePalette = {
    'Creature':'#10b981', 'Artifact Creature':'#22c55e', 'Instant':'#60a5fa',
    'Sorcery':'#93c5fd', 'Enchantment':'#f59e0b', 'Artifact':'#d1d5db',
    'Planeswalker':'#f472b6', 'Basic Land':'#a3e635', 'Land':'#84cc16', 'Other':'#c084fc'
  };

  const cols = keys.map(k=>{
    const o = bins.get(k) || {crea:0, non:0};
    const tot = o.crea + o.non;
    const hC = (peak && o.crea) ? Math.max(4, Math.round(o.crea/peak*100)) : 0;
    const hN = peak ? Math.max(0, Math.round(o.non/peak*100)) : 0;
    return `
      <div class="ds-col" title="Total ${tot} (Creatures ${o.crea}, Non-creatures ${o.non})">
        ${hN?`<div class="ds-seg noncrea${hC? '' : ' only'}" style="height:${hN}%"></div>`:''}
        ${hC?`<div class="ds-seg crea" style="height:${hC}%"></div>`:''}
      </div>`;
  }).join('');
  const xlabels = keys.map(k=>`<div>${k}</div>`).join('');
  
  const colorTitle = Object.entries(manaColors)
  .filter(([,v])=>v>0)
  .map(([k,v])=>`${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[k]}: ${v}`)
  .join(' • ');

  const curveLegend = `
    <div class="ds-legend">
      <span class="ds-key"><span class="ds-swatch" style="background:#10b981; border-color:#ecfdf5"></span> Creature</span>
      <span class="ds-key"><span class="ds-swatch" style="background:#8b5cf6; border-color:#ede9fe"></span> Non-Creature</span>
      <span class="ds-small">Avg CMC (spells): <strong>${avg.toFixed(2)}</strong></span>
    </div>`;

  const colorRows = Object.entries(manaColors)
    .map(([k,v])=>`<div class="row"><span>${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[k]}</span><span>${v}</span></div>`)
    .join('');
  const colorPieStyle = pieStyleFromCountsLocal(manaColors, colorPalette);

  const typeEntries = Object.entries(typeObj).filter(([,v])=>v>0);
  const typeTotal = typeEntries.reduce((a,[,v])=>a+v,0) || 1;
  const typePieStyle = pieStyleFromCountsLocal(typeObj, typePalette);
  const typeRows = typeEntries
    .sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>{
      const pct = (v/typeTotal*100).toFixed(1)+'%';
      const sw = `<span class="ds-swatch" style="background:${typePalette[k]||'#999'}"></span>`;
      return `<div class="row"><span class="ds-key">${sw}${k}</span><span>${v} <span class="ds-small">(${pct})</span></span></div>`;
    }).join('');

  mount.innerHTML = `
    <div class="ds-card">
      <div class="ds-title">Mana Curve</div>
      <div class="ds-row">
        <div>
          <div class="ds-curve" style="--bins:${keys.length}">${cols}</div>
          <div class="ds-x" style="--bins:${keys.length}">${xlabels}</div>
          ${curveLegend}
        </div>
        <div class="ds-piecard">
          <div class="ds-title">Colors in Mana Cost</div>
          <div class="ds-piewrap">
            <div class="ds-pie" style="${colorPieStyle}" title="${colorTitle}"></div>
            <div class="ds-list">${colorRows || `<div class="ds-small">No mana symbols found.</div>`}</div>
          </div>
        </div>
        <div class="ds-piecard">
          <div class="ds-title">Types</div>
          <div class="ds-piewrap">
            <div class="ds-pie" style="${typePieStyle}"></div>
            <div class="ds-list">${typeRows || `<div class="ds-small">No type info available.</div>`}</div>
          </div>
        </div>
      </div>
    </div>`;
}

const toggle = wrap.querySelector('#draftStatsToggle');
const card   = wrap.querySelector('#draftStatsCard');
const chev   = toggle ? toggle.querySelector('.chev') : null;
function openDraftStats(){ if (!card) return; card.classList.remove('hidden'); if (toggle){ toggle.classList.add('open'); toggle.setAttribute('aria-expanded','true'); if (chev) chev.textContent='▾'; } renderDraftStats(); }
function closeDraftStats(){ if (!card) return; card.classList.add('hidden'); if (toggle){ toggle.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); if (chev) chev.textContent='▸'; } }
if (toggle && card){ closeDraftStats(); toggle.onclick = ()=>{ if (card.classList.contains('hidden')) openDraftStats(); else closeDraftStats(); }; }
//// end 
    
    return wrap;
  }
  
  function DraftOffSetup(){
  const wrap = document.createElement('div');

  // Reuse your existing connection UI pattern: waiting offer → paste answer → connected
  let connUI = '';
  if (state.onlineMode && state.waitingForAnswer && state.roomCode) {
    connUI = `
      <div class="card" style="background: rgba(59,130,246,0.15); border-color:#3b82f6; margin-bottom: 24px;">
        <h3 class="mb-4" style="font-weight: bold;">📋 Step 1: Share This Code</h3>
        <textarea readonly class="input mb-4" rows="3" id="offerCode" style="font-size: 11px;">${state.roomCode}</textarea>
        <button id="copyOffer" class="btn btn-blue mb-4" style="width: 100%;">Copy Code</button>
        <hr style="border-color: #4b5563; margin: 16px 0;">
        <h3 class="mb-4" style="font-weight: bold;">📥 Step 2: Enter Their Response</h3>
        <textarea class="input mb-4" rows="3" id="answerInput" placeholder="Paste answer code..." style="font-size: 11px;"></textarea>
        <button id="submitAnswer" class="btn btn-green" style="width: 100%;">Connect</button>
      </div>`;
  } else if (state.onlineMode && state.answerCode) {
    connUI = `
      <div class="card" style="background: rgba(5,150,105,0.2); border-color:#059669; margin-bottom: 24px;">
        <h3 class="mb-4" style="font-weight: bold;">✅ Send This Code Back</h3>
        <textarea readonly class="input mb-4" rows="3" id="answerCode" style="font-size: 11px;">${state.answerCode}</textarea>
        <button id="copyAnswer" class="btn btn-green" style="width: 100%;">Copy Answer Code</button>
        <p class="text-green text-sm mt-2">Waiting for host…</p>
      </div>`;
  } else if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
    connUI = '<div class="card text-green mb-4 text-center p-4">✅ Connected! Ready to draft.</div>';
  }

  wrap.innerHTML = `
    <div class="header">
      <button id="back" class="btn btn-secondary text-sm">← Modes</button>
      <h2 style="font-size:20px;font-weight:700">Draft-off • Setup</h2>
      <div></div>
    </div>

    ${connUI}

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:6px">Host Draft-off</h3>
        <p class="text-xs text-gray mb-2">Create a room and share the code.</p>
        <button id="hostOff" class="btn btn-primary">Host</button>
      </div>
      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:6px">Join Draft-off</h3>
        <p class="text-xs text-gray mb-2">Paste the host’s code to connect.</p>
        <input id="joinCode" class="input mb-2" placeholder="Paste host code">
        <button id="joinOff" class="btn btn-primary">Join</button>
      </div>
      
        <div class="card p-4">
    <h3 style="font-weight:800;margin-bottom:6px">Local (Hotseat)</h3>
    <p class="text-xs text-gray mb-2">Two players on one device. No internet connection.</p>
    <button id="localOff" class="btn btn-secondary">Start Local</button>
  </div>

      <div class="card p-4">
    <h3 style="font-weight:800;margin-bottom:6px">Solo vs Bot 🤖</h3>
    <p class="text-xs text-gray mb-2">Draft against a computer opponent, then battle its deck.</p>
    <button id="botOff" class="btn btn-primary">Start vs Bot</button>
  </div>

    </div>
  `;

  wrap.querySelector('#back').onclick = ()=>{ D.screen='mode'; render(); };

  const hostBtn = wrap.querySelector('#hostOff');
  if (hostBtn) hostBtn.onclick = async ()=>{
    state.onlineMode = true;
    await createOnlineRoom();        // uses your existing WebRTC code
    // stay on setup until connected; host will paste answer; once connected, we can go to room
    render();
  };

  const joinBtn = wrap.querySelector('#joinOff');
  if (joinBtn) joinBtn.onclick = async ()=>{
    const code = (wrap.querySelector('#joinCode').value||'').trim();
    if (!code) { alert('Paste a host code'); return; }
    state.onlineMode = true;
    await joinOnlineRoom(code);
    // when connected, switch to room
    if (state.dataChannel && state.dataChannel.readyState === 'open'){
      D.screen = 'draftoff';
      render();
    }
  };
  
  const startLocalDraftOff = async (vsBot) => {
    // Ensure we're not in online mode
    state.onlineMode = false;
    state.isHost = true;           // single machine owns the flow
    state.currentPlayer = 1;       // arbitrary; not used for gating in local
    // initialize Draft-off local
    D.mode = 'draftoff';
    D.off.screen = 'room';
    D.off.round = 0;
    D.off.p1 = [];
    D.off.p2 = [];
    D.off.table = [];
    D.off.currentSet = null;
    D.off.startingPlayer = 1;
    D.off.currentPicker  = 1;
    D.off.isLocal = true;
    D.off.vsBot = !!vsBot;
    D.off.p1LandsDone = false;
    D.off.p2LandsDone = false;

    D.screen = 'draftoff';
    render();

    // Start first pack with Player 1 picking first
    if (window.draftOffStartNewPack) await window.draftOffStartNewPack(true);
    render();
  };
  const localBtn = wrap.querySelector('#localOff');
  if (localBtn) localBtn.onclick = () => startLocalDraftOff(false);
  const botBtn = wrap.querySelector('#botOff');
  if (botBtn) botBtn.onclick = () => startLocalDraftOff(true);

  // wire offer/answer UI if present
  const copyOffer = wrap.querySelector('#copyOffer');
  if (copyOffer) copyOffer.onclick = ()=>{
    navigator.clipboard.writeText(state.roomCode||'');
    copyOffer.textContent = 'Copied ✓';
    setTimeout(()=>copyOffer.textContent='Copy Code',1000);
  };
  const submitAnswer = wrap.querySelector('#submitAnswer');
  if (submitAnswer) submitAnswer.onclick = async ()=>{
    const ans = (wrap.querySelector('#answerInput').value||'').trim();
    if (!ans) return;
    await finishRoomHandshake(ans);  // this exists in your online flow
    // The room + first pack are driven by the datachannel onopen handler once
    // the connection is actually live; nothing to start here.
    D.screen = 'draftoff';
    render();
  };

  const copyAnswer = wrap.querySelector('#copyAnswer');
  if (copyAnswer) copyAnswer.onclick = ()=>{
    navigator.clipboard.writeText(state.answerCode||'');
    copyAnswer.textContent = 'Copied ✓';
    setTimeout(()=>copyAnswer.textContent='Copy Answer Code',1000);
  };

  return wrap;
}

function DraftOffRoom(){
  
  const me = state.currentPlayer;
const myTurn = D.off.isLocal ? true : (D.off.currentPicker === me);
const status = D.off.isLocal
  ? (D.off.vsBot
        ? (D.off.currentPicker === 1 ? 'Your pick' : 'Bot is picking…')
        : (D.off.currentPicker === 1 ? 'Player 1 pick' : 'Player 2 pick'))
  : (myTurn ? 'Your pick' : 'Waiting for opponent…');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="header">
      <button id="leave" class="btn btn-secondary text-sm">← Exit</button>
      <h2 style="font-size:20px;font-weight:700">Draft-off • Round ${D.off.round} • ${status}</h2>
      <div class="badge">Pool: Random mix</div>
      <div class="badge">P1: ${D.off.p1.length}/42 • P2: ${D.off.p2.length}/42</div>
    </div>

    ${D.dealing ? `<div class="card p-3 mb-3 text-center" style="background:rgba(59,130,246,.15);border-color:#3b82f6">
      <strong>Dealing pack ${D.off.round}…</strong>
    </div>` : ''}


    <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 12px;">
      <div class="card p-4">
        <div id="table" class="grid" style="grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 10px;">
          ${D.off.table.map((c,i)=>`
            <div class="card" data-i="${i}" style="padding:0;position:relative;cursor:${myTurn?'pointer':'not-allowed'}">
              ${c.imageUrl ? cardImageMarkup(c, { loading: 'eager', style: 'width:100%;display:block;border-radius:8px' })
                           : `<div style="height:220px;background:#374151;border-radius:8px;display:flex;align-items:center;justify-content:center">${c.name}</div>`}
              <div class="badge" style="position:absolute;left:6px;top:6px">${(c.rarity||'').toUpperCase()}</div>
              <div class="badge" style="position:absolute;right:6px;bottom:6px">${c.name}</div>
            </div>
          `).join('')}
        </div>
        <div class="text-xs text-gray mt-2">Picks until table reaches 3 cards, then a new set appears. Starting player alternates each round.</div>
      </div>

      <div>
        <div class="card p-4">
          <div class="text-xs text-gray mb-2">Hover to preview</div>
          <img id="hoverImg" style="width:100%;border-radius:8px;display:none">
          <div class="mt-2 text-xs text-gray">
            You: ${isMe(1)? D.off.p1.length : D.off.p2.length} • Opp: ${isMe(1)? D.off.p2.length : D.off.p1.length} (target 42)
          </div>
          <div class="mt-2">
            <button id="toLands" class="btn btn-primary" ${ ( (isMe(1)?D.off.p1.length:D.off.p2.length) >= 42 && (isMe(1)?D.off.p2.length:D.off.p1.length) >=42 ) ? '' : 'disabled' }>
              Continue to Lands
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  wrap.querySelector('#leave').onclick = ()=>{ D.screen='mode'; render(); };

  // hover preview
  const hoverImg = wrap.querySelector('#hoverImg');
  wrap.querySelectorAll('#table .card').forEach(el=>{
    const i = parseInt(el.getAttribute('data-i'),10);
    const c = D.off.table[i];
    el.onmouseenter = ()=>{ if (c?.imageUrl){ hoverImg.src = c.imageUrl; hoverImg.style.display='block'; } };
    el.onmouseleave = ()=>{ hoverImg.style.display='none'; };

    el.onclick = ()=>{
      // Only act on your own turn (local hotseat lets either side click).
      if (!D.off.isLocal && D.off.currentPicker !== state.currentPlayer) return;

      if (D.off.isLocal) {
        draftOffApplyPick(i, D.off.currentPicker);    // applies + re-renders locally
      } else if (state.isHost) {
        draftOffApplyPick(i, 1);                      // host = player 1; broadcasts snapshot
      } else {
        // joiner: ask the host to apply; the authoritative snapshot comes back.
        sendDraftOff({ type:'draftoff_pick_request', index:i });
      }
    };
  });


  const toLands = wrap.querySelector('#toLands');
  if (toLands) toLands.onclick = ()=>{
    // Both players reached 42 — proceed to the per-side basic-land fill.
    D.screen = 'landsfill';
    initLandsFill(D.off.isLocal ? 1 : state.currentPlayer);
    render();
    if (!D.off.isLocal) broadcastDraftState('landsfill');
  };

  return wrap;
}

function cardImageHtml(c, height = 210){
  return cardImageMarkup(c, {
    height,
    style: `width:100%;height:${height}px;object-fit:cover;display:block;border-radius:8px`
  });
}

function prepareWinstonPool(cards, size){
  return shuffleCopy((cards || [])
    .map((card, i) => normalizePlayableCard(card, `Pool Card ${i + 1}`))
    .filter(card => card.name && card.type)
  ).slice(0, Math.max(24, size || 90));
}

function startWinstonDraft(cards, size, opts = {}){
  const pool = prepareWinstonPool(cards, size);
  if (pool.length < 24) {
    toast('Winston needs at least 24 cards in the pool.');
    return;
  }
  const startingCount = pool.length;
  D.mode = 'winston';
  D.target = 40;
  D.winston = freshWinstonState();
  D.winston.vsBot = !!opts.vsBot;
  D.winston.pool = pool;
  D.winston.piles = [[], [], []];
  for (let i = 0; i < 3; i++) {
    if (D.winston.pool.length) D.winston.piles[i].push(D.winston.pool.shift());
  }
  D.winston.log.unshift(`Started with ${startingCount} cards.`);
  D.screen = 'winston';
  render();
}

function winstonIsDone(){
  const W = D.winston;
  return W.pool.length === 0 && W.piles.every(pile => pile.length === 0);
}

// Exposed so the Winston bot (ai.js) can take its turn; re-assigned each render
// because these close over this DraftScreen invocation's D.
window.winstonTakePile = () => winstonTakePile();
window.winstonSkipPile = () => winstonSkipPile();

function winstonSwitchPlayer(){
  D.winston.activePlayer = D.winston.activePlayer === 1 ? 2 : 1;
  D.winston.currentPile = 0;
}

function winstonTakePile(){
  const W = D.winston;
  const pileIndex = W.currentPile;
  const pile = W.piles[pileIndex] || [];
  if (!pile.length) {
    toast('That pile is empty.');
    return;
  }
  const target = W.activePlayer === 1 ? W.p1 : W.p2;
  target.push(...pile);
  W.log.unshift(`Player ${W.activePlayer} took pile ${pileIndex + 1} (${pile.length} card${pile.length === 1 ? '' : 's'}).`);
  W.piles[pileIndex] = [];
  if (W.pool.length) W.piles[pileIndex].push(W.pool.shift());
  if (winstonIsDone()) {
    D.screen = 'winston-results';
  } else {
    winstonSwitchPlayer();
  }
  render();
}

function winstonSkipPile(){
  const W = D.winston;
  const pileIndex = W.currentPile;
  if (W.pool.length) {
    W.piles[pileIndex].push(W.pool.shift());
    W.log.unshift(`Player ${W.activePlayer} skipped pile ${pileIndex + 1}; one card was added.`);
  } else {
    W.log.unshift(`Player ${W.activePlayer} skipped pile ${pileIndex + 1}.`);
  }

  if (pileIndex < 2) {
    W.currentPile += 1;
  } else {
    const target = W.activePlayer === 1 ? W.p1 : W.p2;
    if (W.pool.length) {
      const card = W.pool.shift();
      target.push(card);
      W.log.unshift(`Player ${W.activePlayer} took the top card from the pool.`);
    }
    if (winstonIsDone()) {
      D.screen = 'winston-results';
    } else {
      winstonSwitchPlayer();
    }
  }
  render();
}

function WinstonSetup(){
  const wrap = document.createElement('div');
  const collectionCount = (state.cards || []).length;
  const p1Count = (state.decks.player1 || []).length;
  const p2Count = (state.decks.player2 || []).length;
  wrap.innerHTML = `
    <div class="header">
      <button id="back" class="btn btn-secondary text-sm">← Modes</button>
      <h2 style="font-size:20px;font-weight:700">Winston Draft Setup</h2>
      <div class="badge">Local hotseat or vs bot</div>
    </div>

    <div class="card p-4 mb-4">
      <label class="text-xs flex" style="gap:8px;align-items:center;cursor:pointer">
        <input id="winstonVsBot" type="checkbox">
        <span><strong>Play against the bot 🤖</strong> — the computer takes Player 2's piles.</span>
      </label>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:6px">Pool Source</h3>
        <label class="text-xs">Pool size</label>
        <input id="winstonPoolSize" class="input mb-3" type="number" min="24" max="180" value="90">
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <button id="useCollectionPool" class="btn btn-secondary" ${collectionCount < 24 ? 'disabled' : ''}>Use Collection (${collectionCount})</button>
          <button id="useP1Pool" class="btn btn-secondary" ${p1Count < 24 ? 'disabled' : ''}>Use Your Deck (${p1Count})</button>
          <button id="useP2Pool" class="btn btn-secondary" ${p2Count < 24 ? 'disabled' : ''}>Use Opponent Deck (${p2Count})</button>
          <button id="useStarterPool" class="btn btn-primary">Generated Starter Cube</button>
        </div>
        <p class="text-xs text-gray mt-4">Winston uses three piles. Skip a pile to add a facedown card to it, or take the pile and pass the turn.</p>
      </div>

      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:6px">Upload Cube JSON</h3>
        <input id="winstonPoolFile" type="file" accept=".json" class="input">
        <div id="winstonPoolStatus" class="text-xs text-gray mt-3">Upload an exported deck JSON with a <code>cards</code> array.</div>
        <button id="startUploadedWinston" class="btn btn-primary mt-3" disabled>Start Uploaded Pool</button>
      </div>
    </div>
  `;

  const poolSize = () => Math.max(24, parseInt(wrap.querySelector('#winstonPoolSize')?.value || '90', 10));
  const vsBot = () => !!wrap.querySelector('#winstonVsBot')?.checked;
  let uploadedPool = null;
  wrap.querySelector('#back').onclick = () => { D.screen = 'mode'; render(); };
  wrap.querySelector('#useCollectionPool').onclick = () => startWinstonDraft(state.cards, poolSize(), { vsBot: vsBot() });
  wrap.querySelector('#useP1Pool').onclick = () => startWinstonDraft(state.decks.player1, poolSize(), { vsBot: vsBot() });
  wrap.querySelector('#useP2Pool').onclick = () => startWinstonDraft(state.decks.player2, poolSize(), { vsBot: vsBot() });
  wrap.querySelector('#useStarterPool').onclick = async () => {
    const btn = wrap.querySelector('#useStarterPool');
    btn.disabled = true; btn.textContent = 'Fetching cards…';
    let pool = null;
    try { pool = await buildRealStarterPool(poolSize()); } catch {}
    startWinstonDraft(pool || makeWinstonStarterPool(poolSize()), poolSize(), { vsBot: vsBot() });
  };

  const status = wrap.querySelector('#winstonPoolStatus');
  const startUploaded = wrap.querySelector('#startUploadedWinston');
  wrap.querySelector('#winstonPoolFile').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!Array.isArray(json.cards)) throw new Error('Missing cards array.');
      uploadedPool = json.cards;
      status.textContent = `Loaded ${uploadedPool.length} cards.`;
      startUploaded.disabled = uploadedPool.length < 24;
    } catch (err) {
      uploadedPool = null;
      startUploaded.disabled = true;
      status.textContent = 'Invalid JSON: ' + err.message;
    }
  };
  startUploaded.onclick = () => startWinstonDraft(uploadedPool || [], poolSize(), { vsBot: vsBot() });
  return wrap;
}

function WinstonDraft(){
  const W = D.winston;
  const activePile = W.piles[W.currentPile] || [];
  const pileCards = activePile.slice(-3).reverse();
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="header">
      <button id="leave" class="btn btn-secondary text-sm">← Exit</button>
      <h2 style="font-size:20px;font-weight:700">Winston Draft • Player ${W.activePlayer}</h2>
      <div class="badge">Pool ${W.pool.length} • P1 ${W.p1.length} • P2 ${W.p2.length}</div>
    </div>

    <div class="grid" style="grid-template-columns:2fr 1fr;gap:16px">
      <div class="card p-4">
        <div class="grid" style="grid-template-columns:repeat(3,minmax(160px,1fr));gap:12px">
          ${W.piles.map((pile, i) => `
            <div class="card p-3" style="border-color:${i === W.currentPile ? '#fbbf24' : 'rgba(139,92,246,.35)'}">
              <div class="flex justify-between mb-2">
                <strong>Pile ${i + 1}</strong>
                <span class="badge">${pile.length}</span>
              </div>
              ${pile.length ? cardImageHtml(pile[pile.length - 1], 180) : '<div class="text-xs text-gray text-center" style="padding:72px 0">Empty</div>'}
              ${i === W.currentPile ? '<div class="badge mt-2">Current</div>' : ''}
            </div>
          `).join('')}
        </div>

        <div class="card p-4 mt-4">
          <div class="flex justify-between" style="align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <h3 style="font-weight:800">Inspecting Pile ${W.currentPile + 1}</h3>
              <p class="text-xs text-gray">${activePile.length ? `${activePile.length} card${activePile.length === 1 ? '' : 's'} in this pile.` : 'This pile is empty.'}</p>
            </div>
            <div class="flex" style="gap:8px;flex-wrap:wrap">
              <button id="takeWinstonPile" class="btn btn-primary" ${activePile.length ? '' : 'disabled'}>Take Pile</button>
              <button id="skipWinstonPile" class="btn btn-secondary">Skip / Add</button>
            </div>
          </div>
          <div class="grid mt-3" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
            ${pileCards.map(card => `<div>${cardImageHtml(card, 160)}<div class="text-xs mt-1">${htmlEscape(card.name)}</div></div>`).join('') || '<div class="text-xs text-gray">No cards to show.</div>'}
          </div>
        </div>
      </div>

      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:8px">Draft Log</h3>
        <div style="max-height:420px;overflow:auto">
          ${W.log.slice(0, 24).map(line => `<div class="text-xs text-gray" style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">${htmlEscape(line)}</div>`).join('')}
        </div>
      </div>
    </div>
  `;
  wrap.querySelector('#leave').onclick = () => {
    if (!confirm('Leave Winston draft? Current picks will be discarded unless you finish.')) return;
    D.screen = 'mode';
    render();
  };
  wrap.querySelector('#takeWinstonPile').onclick = winstonTakePile;
  wrap.querySelector('#skipWinstonPile').onclick = winstonSkipPile;
  return wrap;
}

function WinstonResults(){
  const W = D.winston;
  const wrap = document.createElement('div');
  function grouped(cards){
    const map = new Map();
    cards.forEach(card => map.set(card.name, (map.get(card.name) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function list(cards){
    return grouped(cards).map(([name, qty]) => `<div class="flex justify-between text-sm py-1"><span>${htmlEscape(name)}</span><span>x${qty}</span></div>`).join('');
  }
  wrap.innerHTML = `
    <div class="header">
      <button id="back" class="btn btn-secondary text-sm">← Modes</button>
      <h2 style="font-size:20px;font-weight:700">Winston Results</h2>
      <div class="badge">P1 ${W.p1.length} • P2 ${W.p2.length}</div>
    </div>
    <div class="grid grid-2" style="gap:16px">
      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:8px">Player 1 Picks</h3>
        <div style="max-height:340px;overflow:auto">${list(W.p1)}</div>
      </div>
      <div class="card p-4">
        <h3 style="font-weight:800;margin-bottom:8px">Player 2 Picks</h3>
        <div style="max-height:340px;overflow:auto">${list(W.p2)}</div>
      </div>
    </div>
    <div class="card p-4 mt-4 text-center">
      <button id="loadWinstonDecks" class="btn btn-primary">Load Both Decks</button>
      <button id="battleWinston" class="btn btn-green">Battle with Winston Decks</button>
    </div>
  `;
  function loadDecks(){
    state.decks.player1 = W.p1.slice();
    state.decks.player2 = W.p2.slice();
  }
  wrap.querySelector('#back').onclick = () => { D.screen = 'mode'; render(); };
  wrap.querySelector('#loadWinstonDecks').onclick = () => {
    loadDecks();
    state.currentPlayer = 1;
    state.screen = 'builder';
    render();
    toast('Winston decks loaded.');
  };
  wrap.querySelector('#battleWinston').onclick = () => {
    loadDecks();
    state.battleMode = 'winston';
    state.onlineMode = false;
    state.screen = 'battlemenu';
    render();
  };
  return wrap;
}


  function Done(){
    const key = 'player' + state.currentPlayer;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="header">
        <button id="back" class="btn btn-secondary text-sm">← Builder</button>
        <h2 style="font-size:20px;font-weight:700">Draft complete</h2>
        <div></div>
      </div>
      <div class="card p-4">
        <div class="mb-2">Total cards: <strong>${D.deck.length}</strong> (target ${D.target})</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <button id="useDeck" class="btn btn-primary">Use this as my deck</button>
          <button id="again" class="btn btn-secondary">Start new draft</button>
        </div>
        <p class="text-xs text-gray mt-2">“Use this as my deck” replaces your current deck in the builder.</p>
      </div>
    `;
    wrap.querySelector('#back').onclick = ()=>{ state.screen='builder'; render(); };
    wrap.querySelector('#again').onclick = ()=>{ state.screen='draft'; state.draft.screen='setup'; render(); };
    wrap.querySelector('#useDeck').onclick = ()=>{
      state.decks[key] = D.deck.slice();
      state.screen='builder';
      render();
      toast('Draft deck loaded into builder ✓');
    };
    return wrap;
  }

  // color offers ----------------------------------------------------------
  function randomColorOffers(){
    const all = ['W','U','B','R','G'];
    function pick(n){
      const pool = all.slice();
      const res = [];
      while (res.length<n){
        const i = Math.floor(Math.random()*pool.length);
        res.push(pool.splice(i,1)[0]);
      }
      return res.sort();
    }
    return [
      pick(1), pick(2), pick(2), pick(3), pick(3)
    ];
  }
  

function sendDraftOff(msg){
  if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open'){
    state.dataChannel.send(JSON.stringify(msg));
  }
}


async function draftOffDrawRandomCard(q){
  const D = state.draft;
  return drawFromPool(q, c => !(D.seenIds || {})[c.id] && !(D.seenNames || {})[c.name]);
}



async function draftOffApplyPick(index, picker){
  const D = state.draft;
  // Only the host (or a local hotseat) mutates authoritative draft state;
  // the joiner just sends a pick-request and waits for the next snapshot.
  if (!D.off.isLocal && !state.isHost) return;

  const card = D.off.table.splice(index, 1)[0];
  if (!card) return;

  (picker === 1 ? D.off.p1 : D.off.p2).push(card);
  D.off.picksMadeThisPack += 1;

  // alternate picker
  D.off.currentPicker = (picker === 1) ? 2 : 1;

  // Once both players have taken their picks for this pack, discard the
  // remainder and either finish (42/42) or deal the next pack.
  if (D.off.picksMadeThisPack >= (D.off.picksPerPlayerPerPack * 2)) {
    D.off.table.length = 0;                 // discard any remainder
    await draftOffCheckFinishOrNextPack();  // handles its own render + broadcast
    return;
  }

  render();
  broadcastDraftState('draft');
}
window.draftOffApplyPick = draftOffApplyPick;


async function draftOffStartNewPack(flipStarter = true){
  const D = state.draft;
  // Only host/local deals packs; the joiner receives them via draftoff_state.
  if (!D.off.isLocal && !state.isHost) return;
  // Each pack takes many awaited Scryfall calls; a second concurrent deal would
  // interleave cards into the same table and reset the round counter mid-fill.
  if (D.off.dealing) return;
  D.off.dealing = true;
  try {

  // Alternate who starts each pack (after the very first)
  if (flipStarter) {
    D.off.startingPlayer = (D.off.round === 0) ? D.off.startingPlayer : (3 - D.off.startingPlayer);
  }

  D.off.round += 1;
  D.off.picksMadeThisPack = 0;
  D.off.currentPicker = D.off.startingPlayer;

  // We are NOT using a set anymore
  D.off.currentSet = null;

  // Ensure global "seen" registries exist (to avoid duplicates across the whole draft)
  D.seenIds   = D.seenIds   || {};
  D.seenNames = D.seenNames || {};

  // Build the pack from the shared draft pool: one search request backs every
  // pack in the draft, so dealing is effectively instant after the first.
  D.off.table = [];
  D.dealing = true;
  render();                              // show the "dealing" state immediately

  const q = `-t:land game:paper`;        // paper cards, no lands
  while (D.off.table.length < D.off.packSize){
    const c = await draftOffDrawRandomCard(q);
    if (!c) break;                       // pool exhausted
    D.off.table.push(c);
    D.seenIds[c.id] = 1;
    D.seenNames[c.name] = 1;
  }
  D.dealing = false;

  if (D.off.table.length < D.off.packSize) {
    toast(`Pack ${D.off.round}: only ${D.off.table.length}/${D.off.packSize} cards could be fetched.`);
  }

  render();
  broadcastDraftState('draft');   // push the freshly dealt pack to the joiner
  } finally {
    D.off.dealing = false;
  }
}
window.draftOffStartNewPack = draftOffStartNewPack;


// Retained for backward compatibility; pack advancement now lives entirely in
// draftOffApplyPick -> draftOffCheckFinishOrNextPack (host-authoritative).
function draftOffMaybeNextRoundOrFinish(){ /* no-op */ }
window.draftOffMaybeNextRoundOrFinish = draftOffMaybeNextRoundOrFinish;
// -----------------------------------------------------------

  
  
  // choose which subview to render
let content;
if (D.screen==='mode')         content = Mode();
else if (D.screen==='setup')   content = Setup();        // traditional
else if (D.screen==='custom-setup') content = CustomSetup();
else if (D.screen==='colors')  content = Colors();
else if (D.screen==='lands')   content = Lands();
else if (D.screen === 'landsfill') content = LandsFillScreen();
else if (D.screen==='picks')   content = Picks();

// NEW: Draft-off
else if (D.screen==='draftoff-setup') content = DraftOffSetup();
else if (D.screen==='draftoff')       content = DraftOffRoom();
else if (D.screen==='landswait')      content = LandsWaitScreen();
else if (D.screen==='decklists')   content = DraftOffResults();
else if (D.screen==='winston-setup') content = WinstonSetup();
else if (D.screen==='winston')       content = WinstonDraft();
else if (D.screen==='winston-results') content = WinstonResults();


else                           content = Done();

  
  // wrapper scaffold
  div.innerHTML = `
    <div class="header">
  <button id="home" class="btn btn-secondary text-sm">← Menu</button>
<h1 style="font-size:24px;font-weight:800">${
  D.mode==='custom'    ? 'Custom Draft' :
  D.mode==='draftoff'  ? 'Draft-off' :
  D.mode==='winston'   ? 'Winston Draft' :
                         (getModeConfig(D.modeId || state.selectedMode).title + ' Draft')
}</h1>
  <div class="text-xs text-gray">Format: ${D.format} • Deck: ${D.deck.length}/${D.target}${draftScopeLabel() ? ' • ' + htmlEscape(draftScopeLabel()) : ''}</div>
</div>
  `;
  const mount = document.createElement('div');
  mount.appendChild(content);
  div.appendChild(mount);

  // nav
  div.querySelector('#home').onclick = ()=>{ state.screen='menu'; render(); };

  return div;
}
// ---------------------------- end D R A F T ------------------------------


function CardCreator() {
  // Edit on a COPY so typing doesn't mutate the stored card until "Update" is clicked.
  const form = state.editingCard
    ? { ...state.editingCard, colors: [...(state.editingCard.colors || [])] }
    : { name: '', type: 'Creature', cost: '', colors: [], power: 0, toughness: 0, effect: '', image: '', imageUrl: '' };
  const div = document.createElement('div');
  div.className = 'container';
  
  const cardsHtml = state.cards.map((c, i) => `
    <div class="card-preview" style="position: relative;">
      <div style="background: #4b5563; padding: 8px; border-radius: 6px 6px 0 0; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-weight: bold; font-size: 14px;">${c.name || 'Unnamed'}</h3>
          <span style="font-size: 12px; color: #fbbf24;">${c.cost || ''}</span>
        </div>
        <p class="text-xs text-gray">${c.type}</p>
      </div>
      <div class="card-img">${c.image || c.imageUrl ? cardImageMarkup(c, { style: 'width:100%;height:100%;object-fit:cover;border-radius:6px' }) : '🃏'}</div>
      ${c.type && c.type.includes('Creature') ? `<div style="background: #4b5563; padding: 8px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between;"><span class="text-sm">PWR: ${c.power}</span><span class="text-sm">TGH: ${c.toughness}</span></div>` : ''}
      <div style="background: #4b5563; padding: 8px; border-radius: 6px;"><p class="text-xs">${c.effect || 'No effect'}</p></div>
      <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
        <button class="btn btn-secondary text-xs editCard" data-id="${i}" style="padding: 4px 8px;">Edit</button>
        <button class="btn btn-red text-xs delCard" data-id="${i}" style="padding: 4px 8px;">Del</button>
      </div>
    </div>
  `).join('');
  
  const embedded = !!state.embedCreator;   // rendered inside the Deck Editor
  div.innerHTML = `
    ${embedded ? '' : `<div class="header">
      <button id="backBtn" class="btn btn-secondary text-sm">← Back</button>
      <h1 style="font-size: 24px; font-weight: bold;"></h1>
      <button id="logoutBtn" class="btn btn-secondary text-sm">Logout</button>
    </div>`}
    
    <div class="card mb-4">
      <h2 class="mb-4" style="font-weight: bold; font-size: 18px;">🔍 Search Scryfall Cards</h2>
      <div style="background: #374151; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
        <p class="text-xs text-gray">💡 <strong>Tip:</strong> Search works best when hosted on HTTPS. If you get errors, try searching for specific card names like "Lightning Bolt" or "Black Lotus".</p>
      </div>
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <input id="scryfallSearch" class="input" placeholder="Search for MTG cards (e.g., Lightning Bolt)..." style="flex: 1;">
        <button id="searchBtn" class="btn btn-primary">Search</button>
        <button id="loadAllBtn" class="btn btn-blue">Load All Cards</button>
      </div>
      <div id="searchResults" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; max-height: 400px; overflow-y: auto;"></div>
    </div>
    
    <h2 class="mb-4" style="font-size: 20px; font-weight: bold;">${state.editingCard ? 'Edit Card' : 'Create Custom Card'}</h2>
    <div class="grid grid-2 mb-8">
      <div class="card">
        <div class="mb-4">
          <label>Card Name</label>
          <input id="cardName" class="input" value="${form.name}">
        </div>
        <div class="mb-4">
          <label>Type</label>
          <select id="cardType" class="input">
            <option value="Creature">Creature</option>
            <option value="Instant">Instant</option>
            <option value="Sorcery">Sorcery</option>
            <option value="Enchantment">Enchantment</option>
            <option value="Artifact">Artifact</option>
            <option value="Planeswalker">Planeswalker</option>
            <option value="Land">Land</option>
          </select>
        </div>
        <div class="mb-4">
          <label>Mana Cost</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <button class="mana-btn" data-color="W" style="background: #f9fafb; color: #111827; padding: 8px 12px; border-radius: 6px; font-weight: bold; border: 2px solid #d1d5db;">W</button>
            <button class="mana-btn" data-color="U" style="background: #3b82f6; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;">U</button>
            <button class="mana-btn" data-color="B" style="background: #1f2937; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold; border: 2px solid #4b5563;">B</button>
            <button class="mana-btn" data-color="R" style="background: #dc2626; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;">R</button>
            <button class="mana-btn" data-color="G" style="background: #059669; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;">G</button>
            <button class="mana-btn" data-color="C" style="background: #9ca3af; color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold;">C</button>
            <input id="genericMana" type="number" min="0" max="20" value="0" style="width: 60px;" class="input text-center" placeholder="0">
            <button id="clearMana" class="btn btn-red text-xs" style="padding: 8px 12px;">Clear</button>
          </div>
          <input id="cardCost" class="input" value="${form.cost}" placeholder="{2}{U}{U}" readonly>
        </div>
        <div id="creatureStats" class="mb-4" style="${!form.type || !form.type.includes('Creature') ? 'display:none' : ''}">
          <div class="grid grid-2">
            <div>
              <label>Power</label>
              <input id="cardPower" class="input" type="text" value="${form.power}">
            </div>
            <div>
              <label>Toughness</label>
              <input id="cardToughness" class="input" type="text" value="${form.toughness}">
            </div>
          </div>
        </div>
        <div class="mb-4">
          <label>Effect / Oracle Text</label>
          <textarea id="cardEffect" class="input" rows="4">${form.effect}</textarea>
        </div>
        <div class="mb-4">
          <label>Upload Image</label>
          <input id="cardImage" class="input" type="file" accept="image/*">
          <label class="mt-4">Or Image URL</label>
          <input id="cardImageUrl" class="input" placeholder="https://..." value="${form.imageUrl || ''}">
        </div>
        <button id="submitCard" class="btn btn-primary" style="width: 100%; padding: 16px; font-size: 16px;">${state.editingCard ? '✓ Update Card' : '+ Create Card'}</button>
      </div>
      <div>
        <h3 class="mb-4" style="font-size: 18px; font-weight: bold;">Preview</h3>
        <div id="preview"></div>
      </div>
    </div>
    
    <div class="card">
      <h2 id="collectionCount" class="mb-4" style="font-size: 18px; font-weight: bold;">Collection (${state.cards.length} cards)</h2>
      <div id="collectionGrid" class="grid grid-4">
       ${cardsHtml || '<p class="text-gray text-center p-4">No cards yet. Search Scryfall or create custom cards!</p>'}
</div>


    </div>
  `;
  
  const ccBack = div.querySelector('#backBtn');
  if (ccBack) ccBack.onclick = () => { state.screen = 'menu'; state.editingCard = null; render(); };
  const ccLogout = div.querySelector('#logoutBtn');
  if (ccLogout) ccLogout.onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
  div.querySelector('#cardType').value = form.type;
  
  const updatePreview = () => {
    form.name = div.querySelector('#cardName').value;
    form.type = div.querySelector('#cardType').value;
    form.power = div.querySelector('#cardPower').value;
    form.toughness = div.querySelector('#cardToughness').value;
    form.effect = div.querySelector('#cardEffect').value;
    form.imageUrl = div.querySelector('#cardImageUrl').value;
    div.querySelector('#creatureStats').style.display = form.type.includes('Creature') ? 'block' : 'none';
    div.querySelector('#preview').innerHTML = `
      <div class="card-preview">
        <div style="background: #4b5563; padding: 8px; border-radius: 6px 6px 0 0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-weight: bold;">${form.name || 'Unnamed Card'}</h3>
            <span style="font-size: 12px; color: #fbbf24;">${form.cost || ''}</span>
          </div>
          <p class="text-xs text-gray">${form.type}</p>
        </div>
        <div class="card-img">${form.image || form.imageUrl ? `<img src="${form.image || form.imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">` : '🃏'}</div>
        ${form.type.includes('Creature') ? `<div style="background: #4b5563; padding: 8px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between;"><span>PWR: ${form.power}</span><span>TGH: ${form.toughness}</span></div>` : ''}
        <div style="background: #4b5563; padding: 8px; border-radius: 6px;"><p class="text-xs">${form.effect || 'No effect text'}</p></div>
      </div>
    `;
  };
  
  // Mana cost builder
  div.querySelectorAll('.mana-btn').forEach(btn => {
    btn.onclick = () => {
      const color = btn.dataset.color;
      if (!form.colors) form.colors = [];
      form.colors.push(color);
      const generic = parseInt(div.querySelector('#genericMana').value) || 0;
      form.cost = (generic > 0 ? `{${generic}}` : '') + form.colors.map(c => `{${c}}`).join('');
      div.querySelector('#cardCost').value = form.cost;
      updatePreview();
    };
  });
  
  div.querySelector('#genericMana').oninput = () => {
    const generic = parseInt(div.querySelector('#genericMana').value) || 0;
    if (!form.colors) form.colors = [];
    form.cost = (generic > 0 ? `{${generic}}` : '') + form.colors.map(c => `{${c}}`).join('');
    div.querySelector('#cardCost').value = form.cost;
    updatePreview();
  };
  
  div.querySelector('#clearMana').onclick = () => {
    form.colors = [];
    form.cost = '';
    div.querySelector('#cardCost').value = '';
    div.querySelector('#genericMana').value = '0';
    updatePreview();
  };
  
  function appendToCollectionGrid(c, i) {
  const grid = div.querySelector('#collectionGrid');
  if (!grid) return;

  // Remove "No cards yet" placeholder if present
  if (grid.children.length === 1 && grid.firstElementChild.tagName === 'P') {
    grid.innerHTML = '';
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'card-preview';
  wrapper.style.position = 'relative';
  wrapper.innerHTML = `
    <div style="background: #4b5563; padding: 8px; border-radius: 6px 6px 0 0; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-weight: bold; font-size: 14px;">${c.name || 'Unnamed'}</h3>
        <span style="font-size: 12px; color: #fbbf24;">${c.cost || ''}</span>
      </div>
      <p class="text-xs text-gray">${c.type || ''}</p>
    </div>
    <div class="card-img">
      ${c.image || c.imageUrl ? cardImageMarkup(c, { style: 'width:100%;height:100%;object-fit:cover;border-radius:6px' }) : '🃏'}
    </div>
    ${c.type && c.type.includes('Creature') ? `
      <div style="background: #4b5563; padding: 8px; border-radius: 6px; margin: 8px 0; display: flex; justify-content: space-between;">
        <span class="text-sm">PWR: ${c.power}</span><span class="text-sm">TGH: ${c.toughness}</span>
      </div>` : ''
    }
    <div style="background: #4b5563; padding: 8px; border-radius: 6px;"><p class="text-xs">${c.effect || 'No effect'}</p></div>
    <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
      <button class="btn btn-secondary text-xs editCard" style="padding: 4px 8px;">Edit</button>
      <button class="btn btn-red text-xs delCard" style="padding: 4px 8px;">Del</button>
    </div>
  `;

  // Attach handlers for the two buttons
  wrapper.querySelector('.editCard').onclick = () => { state.editingCard = state.cards[i]; render(); window.scrollTo(0, 0); };
  wrapper.querySelector('.delCard').onclick = () => {
    if (confirm('Delete this card?')) {
      state.cards.splice(i, 1);
      render();
    }
  };

  grid.appendChild(wrapper);

  // Update the "(N cards)" count
  const countEl = div.querySelector('#collectionCount');
  if (countEl) countEl.textContent = `Your Collection (${state.cards.length} cards)`;
}
  
  // Scryfall search
  div.querySelector('#searchBtn').onclick = async () => {
    const query = div.querySelector('#scryfallSearch').value.trim();
    if (!query) {
      alert('Please enter a search term!');
      return;
    }
    const resultsDiv = div.querySelector('#searchResults');
    resultsDiv.innerHTML = '<p class="text-blue text-xs loading">Searching Scryfall...</p>';
    try {
      // Use the correct Scryfall API endpoint with proper encoding
      const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
      console.log('Searching:', searchUrl);
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Scryfall response:', data);
      
      if (data.object === 'error') {
        resultsDiv.innerHTML = `<p class="text-red text-xs text-center p-4">Scryfall Error: ${data.details || 'Invalid search'}</p>`;
        return;
      }
      
      if (data.data && data.data.length > 0) {
        state.searchResults = data.data;
        resultsDiv.innerHTML = data.data.slice(0, 40).map((card, idx) => {
          const imgUrl = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || '';
          return `
            <div class="scryfall-result" data-idx="${idx}" style="cursor: pointer; border: 2px solid #374151; border-radius: 6px; overflow: hidden; transition: all 0.2s; position: relative;">
              ${imgUrl ? `<img src="${imgUrl}" style="width: 100%; display: block;">` : `<div style="padding: 20px; text-align: center; background: #374151; font-size: 12px;">${card.name}</div>`}
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.8); color: white; padding: 4px; font-size: 10px; text-align: center;">${card.name}</div>
            </div>
          `;
        }).join('');
        
        // ---------- Delegated hover + click on the search grid (no duplicates) ----------
// 1) Create hover preview box once.
let hoverDiv = document.getElementById('scryfallHover');
if (!hoverDiv) {
  hoverDiv = document.createElement('div');
  hoverDiv.id = 'scryfallHover';
  hoverDiv.style.cssText = 'position:fixed; pointer-events:none; z-index:9999; display:none; background:#1f2937; border:1px solid #374151; border-radius:8px; width:320px; max-width:90vw; padding:12px; box-shadow:0 10px 30px rgba(0,0,0,.5)';
  document.body.appendChild(hoverDiv);
}

// 2) Small helper to render preview content for a card index.
function showPreviewForIdx(idx) {
  const card = data.data[idx];
  if (!card) return;
  const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';
  hoverDiv.innerHTML = `
    <div style="font-weight:700; margin-bottom:4px;">${card.name}</div>
    <div class="text-xs text-gray" style="margin-bottom:6px;">${card.type_line || ''}</div>
    ${img ? `<img src="${img}" style="width:100%; border-radius:6px; margin-bottom:8px;">` : ''}
    <div style="font-size:12px; line-height:1.3; white-space:pre-wrap;">${(card.oracle_text || '').replaceAll('\\n','<br>')}</div>
  `;
  hoverDiv.style.display = 'block';
}

// 3) Delegated mousemove to position + render preview.
resultsDiv.onmousemove = (e) => {
  const tile = e.target.closest('.scryfall-result');
  if (!tile || !resultsDiv.contains(tile)) {
    hoverDiv.style.display = 'none';
    return;
  }
  const idx = Number(tile.dataset.idx);
  showPreviewForIdx(idx);
  const pad = 16;
  hoverDiv.style.left = (e.clientX + pad) + 'px';
  hoverDiv.style.top  = (e.clientY + pad) + 'px';
};

// 4) Hide preview when leaving the grid.
resultsDiv.onmouseleave = () => { hoverDiv.style.display = 'none'; };

// 5) Delegated click: add exactly one card, mark tile, update collection grid.
resultsDiv.onclick = (e) => {
  const tile = e.target.closest('.scryfall-result');
  if (!tile || !resultsDiv.contains(tile)) return;

  const idx = Number(tile.dataset.idx);
  const card = data.data[idx];
  const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';

  const newCard = {
    id: Date.now() + Math.random(),
    name: card.name,
    type: card.type_line,
    cost: card.mana_cost || '',
    colors: card.colors || [],
    power: card.power || 0,
    toughness: card.toughness || 0,
    effect: card.oracle_text || '',
    image: '',
    imageUrl: imgUrl,
    scryfallId: card.id
  };

  state.cards.push(newCard);
  toast('Added ' + card.name + ' ✓');

  if (!tile.querySelector('.added-badge')) {
    const badge = document.createElement('div');
    badge.className = 'added-badge';
    badge.textContent = 'Added ✓';
    badge.style.cssText = 'position:absolute; top:6px; left:6px; background:#10b981; color:white; font-size:10px; padding:2px 6px; border-radius:4px;';
    tile.appendChild(badge);
    tile.style.borderColor = '#10b981';
  }

  // Live update of the collection without re-rendering:
  appendToCollectionGrid(newCard, state.cards.length - 1);
};

        
      } else {
        resultsDiv.innerHTML = '<p class="text-gray text-xs text-center p-4">No results found. Try a different search term.</p>';
      }
    } catch (err) {
      console.error('Scryfall search error:', err);
      resultsDiv.innerHTML = `<p class="text-red text-xs text-center p-4">Error: ${err.message}<br><br>This might be a network issue or CORS restriction. Try:<br>1. Check your internet connection<br>2. Make sure you're using HTTPS<br>3. Try a different browser<br>4. Check browser console for details</p>`;
    }
  };
  
  // Load all Oracle cards
  div.querySelector('#loadAllBtn').onclick = async () => {
    if (state.isLoadingScryfallCards) return;
    if (state.scryfallCards.length > 0) {
      alert(`✓ ${state.scryfallCards.length} cards already loaded! Use search to find them.`);
      return;
    }
    if (!confirm('This will download ~160MB of card data from Scryfall. This may take 1-2 minutes. Continue?\n\nNote: You can also just use the Search feature without loading all cards!')) return;
    
    state.isLoadingScryfallCards = true;
    const resultsDiv = div.querySelector('#searchResults');
    resultsDiv.innerHTML = '<p class="text-blue text-xs loading text-center p-4">Downloading all MTG cards from Scryfall... Please wait...</p>';
    
    try {
      console.log('Fetching bulk data list...');
      const bulkResponse = await fetch('https://api.scryfall.com/bulk-data', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!bulkResponse.ok) {
        throw new Error(`HTTP ${bulkResponse.status}: ${bulkResponse.statusText}`);
      }
      
      const bulkData = await bulkResponse.json();
      console.log('Bulk data received:', bulkData);
      
      const oracleData = bulkData.data.find(d => d.type === 'oracle_cards');
      
      if (oracleData) {
        console.log('Downloading oracle cards from:', oracleData.download_uri);
        resultsDiv.innerHTML = '<p class="text-blue text-xs loading text-center p-4">Downloading card database... This may take 1-2 minutes...</p>';
        
        const cardsResponse = await fetch(oracleData.download_uri);
        
        if (!cardsResponse.ok) {
          throw new Error(`HTTP ${cardsResponse.status}: ${cardsResponse.statusText}`);
        }
        
        const cards = await cardsResponse.json();
        state.scryfallCards = cards;
        console.log('Loaded cards:', cards.length);
        alert(`✓ Success! Loaded ${cards.length.toLocaleString()} MTG cards! You can now search through all cards.`);
        resultsDiv.innerHTML = '<p class="text-green text-xs text-center p-4">✓ All cards loaded! Use the search box above to find any MTG card.</p>';
      } else {
        throw new Error('Could not find oracle cards in bulk data');
      }
    } catch (err) {
      console.error('Bulk load error:', err);
      resultsDiv.innerHTML = `<p class="text-red text-xs text-center p-4">Error loading cards: ${err.message}<br><br>Don't worry! You can still use the Search feature to find specific cards without loading the entire database.</p>`;
    }
    state.isLoadingScryfallCards = false;
  };
  
  div.querySelector('#cardName').oninput = updatePreview;
  div.querySelector('#cardType').onchange = updatePreview;
  div.querySelector('#cardPower').oninput = updatePreview;
  div.querySelector('#cardToughness').oninput = updatePreview;
  div.querySelector('#cardEffect').oninput = updatePreview;
  div.querySelector('#cardImageUrl').oninput = updatePreview;
  
  // Allow Enter key to search
  div.querySelector('#scryfallSearch').onkeypress = (e) => {
    if (e.key === 'Enter') {
      div.querySelector('#searchBtn').click();
    }
  };
  
  div.querySelector('#cardImage').onchange = (e) => {
    const file = e.target.files[0];
    if (file) compressImage(file, (img) => { form.image = img; updatePreview(); });
  };
  div.querySelector('#submitCard').onclick = () => {
    if (!form.name.trim()) {
      alert('Please enter a card name!');
      return;
    }
    if (state.editingCard) {
      const idx = state.cards.findIndex(c => c.id === state.editingCard.id);
      state.cards[idx] = Object.assign({}, form, { id: state.editingCard.id });
      state.editingCard = null;
    } else {
      state.cards.push(Object.assign({}, form, { id: Date.now() + Math.random() }));
    }
    render();
  };
  
  div.querySelectorAll('.editCard').forEach((btn, i) => {
    btn.onclick = () => { state.editingCard = state.cards[i]; render(); window.scrollTo(0, 0); };
  });
  div.querySelectorAll('.delCard').forEach((btn, i) => {
    btn.onclick = () => { 
      if (confirm('Delete this card?')) {
        state.cards.splice(i, 1); 
        render(); 
      }
    };
  });
  
  updatePreview();
  return div;
}

// ===============================
// Deck import helpers (GLOBAL)
// ===============================

// 1) Parse simple text decklists into a Map(name -> qty)
if (!window.parseDecklist) window.parseDecklist = function(text){
  const lines = String(text||'').split(/[\r\n]+/).map(s=>s.trim());
  const ignore = /^(#|\/\/|sideboard:|companions?:|maybeboard:)/i;
  const m = new Map();
  for (let raw of lines){
    if (!raw || ignore.test(raw)) continue;
    let line = raw.replace(/\s+/g,' ').trim();
    line = line.replace(/\s*\/\/.*$/, '').trim();     // strip trailing // comments
    if (!line) continue;

    let qty = 1, name = line, match;
    if ((match = line.match(/^(\d+)\s*x?\s+(.+)$/i))) { qty = +match[1]; name = match[2]; }
    else if ((match = line.match(/^(.+?)\s+x(\d+)$/i))) { name = match[1]; qty = +match[2]; }
    else if ((match = line.match(/^(\d+)x\s+(.+)$/i))) { qty = +match[1]; name = match[2]; }

    name = name.replace(/\u2019/g,"'").replace(/\s+/g,' ').trim();
    if (!name) continue;
    m.set(name, (m.get(name)||0) + (Number.isFinite(qty)?qty:1));
  }
  return m;
};

// 2) Scryfall resolver by name (prefers set if provided)
if (!window.fetchCardByName) window.fetchCardByName = async function(name, setPref){
  const base = 'https://api.scryfall.com/cards/named';
  const esc = encodeURIComponent(name);
  async function get(u){ const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); const j = await r.json(); if (j.object==='error') throw new Error(j.details||'Scryfall error'); return j; }
  if (setPref) {
    try { return await get(`${base}?exact=${esc}&set=${encodeURIComponent(setPref)}`); }
    catch { /* fallback to any set */ }
  }
  return await get(`${base}?exact=${esc}`);
};

// 3) Convert a Scryfall card JSON to your in-game card objects (qty copies)
if (!window.cardToGameObjects) window.cardToGameObjects = function(cardJSON, quantity, includeImages){
  const type_line = cardJSON.type_line || '';
  const colors = Array.isArray(cardJSON.colors) ? cardJSON.colors : [];
  const mana_cost = cardJSON.mana_cost || '';
  const oracle_text = cardJSON.oracle_text || '';

  let power = cardJSON.power ?? 0;
  let toughness = cardJSON.toughness ?? 0;

  let imageUrl = '';
  if (includeImages){
    imageUrl =
      cardJSON.image_uris?.normal ||
      cardJSON.card_faces?.[0]?.image_uris?.normal ||
      `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${encodeURIComponent(cardJSON.name)}`;
  }

  if ((power==null || toughness==null) && Array.isArray(cardJSON.card_faces) && cardJSON.card_faces.length){
    const f = cardJSON.card_faces[0];
    power = f.power ?? 0; toughness = f.toughness ?? 0;
  }
  if (!/Creature/i.test(type_line)){ power = Number(power)||0; toughness = Number(toughness)||0; }

  const out = [];
  for (let i=0;i<(quantity||1);i++){
    out.push({
      id: Date.now() + Math.random(),
      name: cardJSON.name,
      type: type_line,
      cost: mana_cost,
      colors: colors,
      power: String(power),
      toughness: String(toughness),
      effect: oracle_text,
      image: "",
      imageUrl
    });
  }
  return out;
};

// 4) Full TXT → Scryfall → game objects converter (shows status via .textContent if provided)
if (!window.convertDecklist) window.convertDecklist = async function(text, player, setPref, includeImages, statusElLike){
  const setStatus = (t)=>{ if (statusElLike && typeof statusElLike.textContent === 'string') statusElLike.textContent = t; };
  const m = window.parseDecklist(text);
  if (!m.size) throw new Error('No valid card names found.');

  const names = [...m.keys()];
  const results = [];
  const concurrency = 6;
  let idx = 0, done = 0, errs = [];

  async function next(){
    if (idx >= names.length) return;
    const myIdx = idx++;
    const name = names[myIdx];
    setStatus(`Fetching ${done}/${names.length} • Now: ${name}`);
    try{
      const cj = await window.fetchCardByName(name, setPref);
      const qty = m.get(name)||1;
      results.push(...window.cardToGameObjects(cj, qty, includeImages));
    } catch(e){
      errs.push({ name, error: e.message || String(e) });
    } finally {
      done++; setStatus(`Fetched ${done}/${names.length}`);
      if (idx < names.length) await next();
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, names.length)}, () => next()));
  results.sort((a,b)=> a.name.localeCompare(b.name));
  return { out: { player: Number(player)||1, timestamp: Date.now(), cards: results }, errors: errs };
};


// =====================================
// Deck Builder
// =====================================

function DeckBuilder() {
  const key = 'player' + state.currentPlayer;
  const mode = getModeConfig(state.selectedMode || 'casual');

  const div = document.createElement('div');
  div.className = 'container';


// --- NEW: Deck Statistics CSS (once) ---
(function ensureDeckStatsCSS(){
  if (document.getElementById('deckStatsCSS')) return;
  const s = document.createElement('style');
  s.id = 'deckStatsCSS';
  s.textContent = `
  /* Card-like wrapper */
  .ds-card{
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(139,92,246,0.35);
    border-radius: 12px;
    padding: 12px;
  }
  .ds-title{
    font-size: 12px; letter-spacing:.04em; text-transform:uppercase;
    opacity:.8; margin-bottom:8px;
  }
  .ds-row{ display:grid; gap:12px; }
 @media (min-width: 900px){
    .ds-row{ grid-template-columns: 1fr 1fr 1fr; }
  }

  /* Stacked mana curve */
  .ds-curve{ height: 160px; display:grid; align-items:end; gap:10px;
             grid-template-columns: repeat(var(--bins,1), minmax(16px,1fr)); padding: 8px 6px 0 6px;}
  .ds-col{ position:relative; height:100%; display:flex; flex-direction:column; justify-content:flex-end; }
  .ds-seg{ width:100%; border:2px solid #ecfdf5; }
  .ds-seg.crea{ background: linear-gradient(180deg,#34d399 0%,#10b981 100%); border-radius:8px 8px 0 0; }
.ds-seg.noncrea{ background: linear-gradient(180deg,#8b5cf6 0%,#6d28d9 100%); border-radius:0 0 8px 8px; }
.ds-seg.noncrea.only{
  /* ensure the top “white outline” always shows */
  border-top-width: 2px !important;
  border-top-style: solid !important;
  border-top-color: #ecfdf5 !important;

  /* force the same rounded cap as the green bars */
  border-top-left-radius: 8px !important;
  border-top-right-radius: 8px !important;
  border-radius: 8px 8px 4px 4px !important;

  /* optional: add a subtle crisp edge like the green cap */
  box-shadow: 0 0 0 1px rgba(236,253,245,.65) inset;
}
  .ds-count{ position:absolute; top:-18px; left:50%; transform:translateX(-50%); font-size:11px; font-weight:700; color:#d1fae5; text-shadow:0 1px 0 rgba(0,0,0,.45); }
  .ds-x{ margin-top:6px; display:grid; gap:10px;
         grid-template-columns: repeat(var(--bins,1), minmax(16px,1fr)); font-size:11px; opacity:.8; text-align:center; }

  .ds-legend{ display:flex; gap:12px; flex-wrap:wrap; margin-top:6px; font-size:11px; opacity:.85; }
  .ds-key{ display:inline-flex; align-items:center; gap:6px; }
  .ds-swatch{ width:12px; height:12px; border-radius:3px; border:1px solid rgba(255,255,255,.5); }

  /* Pie charts (conic-gradient) */
  .ds-pies{ display:grid; gap:12px; grid-template-columns: 1fr; }
  @media (min-width: 900px){ .ds-pies{ grid-template-columns: 1fr 1fr; } }
  .ds-piecard{ }
.ds-piewrap{ display:flex; gap:12px; align-items:center; flex-direction:column; }
.ds-pie{
    --size: 120px;
    width: var(--size); height: var(--size); border-radius: 50%;
    border:2px solid rgba(236,253,245,0.7);
    box-shadow: inset 0 0 16px rgba(0,0,0,0.35);
  }
  .ds-list{ font-size:12px; line-height:1.6; }
  .ds-list .row{ display:flex; justify-content:space-between; gap:12px; }
  .ds-small{ font-size:12px; opacity:.8; }
  
  
  /* Stretched toggle bar for Deck Statistics */
.stats-toggle{
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: rgba(31,41,55,0.85);
  border: 1px solid rgba(139,92,246,0.55);
  border-radius: 10px;
  font-size: 14px; font-weight: 700;
  color: #e9d5ff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(139,92,246,0.25);
  transition: border-color .15s ease, background .15s ease, transform .08s ease;
  margin-bottom: 10px;
}
.stats-toggle:hover{ border-color:#a78bfa; background: rgba(31,41,55,0.95); }
.stats-toggle:active{ transform: translateY(1px); }
.stats-toggle .left{ display:flex; align-items:center; gap:10px; }
.stats-toggle .chip{
  width: 10px; height:10px; border-radius:50%;
  background: linear-gradient(180deg,#34d399 0%,#10b981 100%);
  border: 1px solid #ecfdf5;
  box-shadow: 0 0 0 2px rgba(16,185,129,.25);
}
.stats-toggle .chev{
  font-size: 16px; opacity: .9; transition: transform .15s ease;
}
.stats-toggle.open .chev{ transform: rotate(90deg); } /* ▸ → ▾ */
  `;
  document.head.appendChild(s);
})();


// --- NEW: type/color helpers for stats ---
function isLand(c){ return ((c.type||'')+'' ).toLowerCase().includes('land'); }
function isBasicLand(c){ const t=(c.type||'').toLowerCase(); return t.includes('basic') && t.includes('land'); }
function isCreature(c){ return ((c.type||'')+'' ).toLowerCase().includes('creature'); }

// getCMC is defined once, near the mana-curve helpers at the top of this file.
// The duplicate that used to live here shadowed it (function declarations in the
// same scope: last one wins), so edits to the canonical copy silently did nothing.

// Count W/U/B/R/G symbols in mana *costs*
function countManaSymbols(cards){
  const out = {W:0,U:0,B:0,R:0,G:0};
  for (const c of cards){
    const s = (c?.manaCost || c?.manacost || c?.cost || '').toString().toUpperCase();
    if (!s) continue;
    const tokens = s.match(/\{([^}]+)\}/g) || [];
    for (const t of tokens){
      const inner = t.slice(1,-1).toUpperCase();
      // split hybrids "G/U" => "GU"
      for (const ch of inner.split(/[^A-Z]/).join('')){
        if (out.hasOwnProperty(ch)) out[ch] += 1;
      }
    }
    if (!tokens.length){
      // unbraced fallback: count letters
      (s.match(/[WUBRG]/g)||[]).forEach(ch => out[ch] += 1);
    }
  }
  return out;
}

// Group types (with "Artifact Creature" kept separate)
function typesBreakdown(cards){
  const map = new Map();
  const push = (k)=> map.set(k, (map.get(k)||0)+1);
  for (const c of cards){
    const t = (c.type||'').toLowerCase();
    if (!t){ push('Other'); continue; }
    if (t.includes('artifact') && t.includes('creature')) { push('Artifact Creature'); continue; }
    if (t.includes('creature'))     { push('Creature'); continue; }
    if (t.includes('instant'))      { push('Instant'); continue; }
    if (t.includes('sorcery'))      { push('Sorcery'); continue; }
    if (t.includes('enchantment'))  { push('Enchantment'); continue; }
    if (t.includes('planeswalker')) { push('Planeswalker'); continue; }
    if (t.includes('artifact'))     { push('Artifact'); continue; }
    if (t.includes('basic') && t.includes('land')) { push('Basic Land'); continue; }
    if (t.includes('land'))         { push('Land'); continue; }
    push('Other');
  }
  return map;
}

// Stacked curve data (exclude lands)
function stackedCurve(cards){
  const bins = new Map();  // cmc -> {crea, non}
  let peak = 0;
  for (const c of cards){
    if (isLand(c)) continue;                 // exclude lands from curve & avg
    const cmc = getCMC(c);
    if (cmc === null || !Number.isFinite(cmc)) continue;
    const k = cmc;
    const o = bins.get(k) || {crea:0, non:0};
    if (isCreature(c)) o.crea += 1; else o.non += 1;
    bins.set(k, o);
    const tot = o.crea + o.non;
    if (tot > peak) peak = tot;
  }
  const keys = [...bins.keys()].sort((a,b)=>a-b);
  return { keys, bins, peak };
}

// Average mana cost (spells only; lands excluded)
function averageCMC(cards){
  let sum = 0, n = 0;
  for (const c of cards){
    if (isLand(c)) continue;
    const cmc = getCMC(c);
    if (cmc === null || !Number.isFinite(cmc)) continue;
    sum += cmc; n += 1;
  }
  return n ? (sum/n) : 0;
}

// Build conic-gradient for a pie
function pieStyleFromCounts(obj, palette){
  const entries = Object.entries(obj).filter(([k,v]) => v>0);
  const total = entries.reduce((a, [,v])=>a+v, 0) || 1;
  let acc = 0;
  const stops = entries.map(([k,v])=>{
    const start = acc / total * 360;
    acc += v;
    const end = acc / total * 360;
    const color = palette[k] || '#999';
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');
  return `background: conic-gradient(${stops});`;
}


// --- NEW: render Deck Statistics into existing mount ---
function renderDeckStatsInto(containerId){
  const mount = div.querySelector('#' + containerId);
  if (!mount) return;

  const deck = state.decks[key] || [];
  const avg  = averageCMC(deck);
  const { keys, bins, peak } = stackedCurve(deck);

  // Colors pie (W/U/B/R/G)
  const manaColors = countManaSymbols(deck);
  const colorPalette = { W:'#fef08a', U:'#60a5fa', B:'#6b7280', R:'#f87171', G:'#34d399' };

  // Types pie
  const tb = typesBreakdown(deck);
  const typeObj = Object.fromEntries(tb);
  // stable palette for common types
  const typePalette = {
    'Creature':'#10b981', 'Artifact Creature':'#22c55e', 'Instant':'#60a5fa',
    'Sorcery':'#93c5fd', 'Enchantment':'#f59e0b', 'Artifact':'#d1d5db',
    'Planeswalker':'#f472b6', 'Basic Land':'#a3e635', 'Land':'#84cc16', 'Other':'#c084fc'
  };

  // Build stacked curve columns
  const cols = keys.map(k=>{
  const o = bins.get(k) || {crea:0, non:0};
  const tot = o.crea + o.non;
  const hC = (peak && o.crea) ? Math.max(4, Math.round(o.crea/peak*100)) : 0;
  const hN = peak ? Math.max(0, Math.round(o.non/peak*100)) : 0;
  return `
    <div class="ds-col" title="Total ${tot} (Creatures ${o.crea}, Non-creatures ${o.non})">
      ${hN?`<div class="ds-seg noncrea${hC ? '' : ' only'}" style="height:${hN}%"></div>`:''}
      ${hC?`<div class="ds-seg crea" style="height:${hC}%"></div>`:''}
    </div>`;
}).join('');


  const xlabels = keys.map(k=>`<div>${k}</div>`).join('');

  // Legends
  const curveLegend = `
    <div class="ds-legend">
      <span class="ds-key"><span class="ds-swatch" style="background:#10b981; border-color:#ecfdf5"></span> Creature</span>
      <span class="ds-key"><span class="ds-swatch" style="background:#8b5cf6; border-color:#ede9fe"></span> Non-Creature</span>
      <span class="ds-small">Avg CMC (spells): <strong>${avg.toFixed(2)}</strong></span>
    </div>`;

  // Color pie legend/list
  const colorRows = Object.entries(manaColors)
    .map(([k,v])=>`<div class="row"><span>${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[k]}</span><span>${v}</span></div>`)
    .join('');
  const colorPieStyle = pieStyleFromCounts(manaColors, colorPalette);

  // Type pie legend/list
  const typeEntries = Object.entries(typeObj).filter(([,v])=>v>0);
  const typeTotal = typeEntries.reduce((a,[,v])=>a+v,0) || 1;
  const typePieStyle = pieStyleFromCounts(typeObj, typePalette);
  const typeRows = typeEntries
    .sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>{
      const pct = (v/typeTotal*100).toFixed(1)+'%';
      const sw = `<span class="ds-swatch" style="background:${typePalette[k]||'#999'}"></span>`;
      return `<div class="row"><span class="ds-key">${sw}${k}</span><span>${v} <span class="ds-small">(${pct})</span></span></div>`;
    }).join('');
    
    const colorTitle = Object.entries(manaColors)
  .filter(([,v])=>v>0)
  .map(([k,v])=>`${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[k]}: ${v}`)
  .join(' • ');


  // Assemble
  mount.innerHTML = `
    <div class="ds-card">
      <div class="ds-title"></div>

      <div class="ds-row">
        <!-- Stacked Mana Curve -->
        <div>
          <div class="ds-title" style="margin-bottom:4px;">Mana Curve</div>
          <div class="ds-curve" style="--bins:${Math.max(keys.length,1)}">
            ${cols || `<div class="text-xs" style="opacity:.7;">No spell costs found (lands excluded).</div>`}
          </div>
          <div class="ds-x" style="--bins:${Math.max(keys.length,1)}">${xlabels}</div>
          ${curveLegend}
        </div>

        <!-- Colors in Mana Cost -->
        <div class="ds-piecard">
          <div class="ds-title">Colors in Mana Cost</div>
          <div class="ds-piewrap">
            <div class="ds-pie" style="${colorPieStyle}" title="${colorTitle}"></div>
            <div class="ds-list">
              ${colorRows || `<div class="ds-small">No mana symbols found.</div>`}
            </div>
          </div>
        </div>

        <!-- Types -->
        <div class="ds-piecard">
          <div class="ds-title">Types</div>
          <div class="ds-piewrap">
            <div class="ds-pie" style="${typePieStyle}"></div>
            <div class="ds-list">
              ${typeRows || `<div class="ds-small">No type info available.</div>`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}


  // mana-curve helpers: use the canonical top-level getCMC() / manaCurveData()
  // (the former per-screen duplicates were identical and have been removed).

  function renderManaCurveDeck() {
    const mount = div.querySelector('#manaCurveDeckChart');
    if (!mount) return;

    const deck = state.decks[key] || [];
    const { bins, max } = manaCurveData(deck);

    if (bins.length === 0) {
      mount.innerHTML = `
        <div class="mana-curve-wrap">
          <div class="mana-curve-title">Mana Curve</div>
          <div style="opacity:.7; font-size:12px;">No mana-cost data in this deck.</div>
        </div>`;
      return;
    }

const cols = bins.map(b=>{
  const h = max ? Math.max(4, Math.round(b.count / max * 100)) : 0;
  const label = `${b.count} card${b.count===1?'':'s'} at CMC ${b.cmc}`;
  return `
    <div class="mc-col">
      <div class="mc-bar" style="height:${h}%" title="${label}" aria-label="${label}"></div>
    </div>`;
}).join('');
    
    const labels = bins.map(b => `<div>${b.cmc}</div>`).join('');

    mount.innerHTML = `
      <div class="mana-curve-wrap">
        <div class="mana-curve-title">Mana Curve</div>
        <div class="mana-curve" style="--bins:${bins.length}">${cols}</div>
        <div class="mc-x" style="--bins:${bins.length}">${labels}</div>
      </div>`;
  }

  // ---------- helpers (local to builder) ----------
  const updateCardInfo = () => {
    const infoDiv = div.querySelector('#cardInfoSidebar');
    if (!infoDiv) return;
    const c = state.hoveredCard;
    if (!c) {
      infoDiv.innerHTML = '<p class="text-gray text-xs text-center" style="padding: 20px;">Hover over a card to see details</p>';
      return;
    }
    infoDiv.innerHTML = `
      <div class="card-preview">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
          <div class="text-center mb-2" style="font-weight:700;font-size:16px;flex:1;">${c.name}</div>
          ${c.cost ? `<div style="font-size:14px;color:#fbbf24;white-space:nowrap;">${c.cost}</div>` : ''}
        </div>
        <div class="text-xs text-gray text-center mb-2">${c.type || ''}</div>
        ${cardImageMarkup(c, { style: 'width:100%;border-radius:6px;margin-bottom:12px;display:block' })}
        ${(c.type||'').includes('Creature') ? `
          <div class="mb-2" style="display:flex;justify-content:space-between;">
            <span class="text-sm"><strong>PWR:</strong> ${c.power ?? 0}</span>
            <span class="text-sm"><strong>TGH:</strong> ${c.toughness ?? 0}</span>
          </div>` : ''
        }
        <div class="text-sm" style="margin-top:12px;"><strong>Effect:</strong></div>
        <div class="text-xs" style="margin-top:8px;line-height:1.4;">${c.effect || 'No effect'}</div>
      </div>
    `;
  };
  
  ////
  function uid(){ return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

const BASIC_LANDS = ['Plains','Island','Swamp','Mountain','Forest'];

async function fetchBasicLandCard(landName){
  // Cache on state to avoid repeated fetches
  const D = state.draft;
  D._landCache = D._landCache || {};
  if (D._landCache[landName]) return D._landCache[landName];

  // Honour the printing chosen in the land picker.
  const art = chosenLandArt(landName);
  if (art && art.imageUrl) {
    const picked = {
      id: art.id, name: art.name || landName, type: art.type || 'Basic Land',
      cost: '', colors: [], effect: '', power: 0, toughness: 0,
      imageUrl: art.imageUrl, rarity: 'common'
    };
    D._landCache[landName] = picked;
    return picked;
  }

  const r = await scryfetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(landName)}`);
  if (!r.ok) throw new Error('Land fetch failed: ' + landName);
  const c = await r.json();

  const img = c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || '';
  const normalized = {
    id: c.id,
    name: c.name,
    type: c.type_line || 'Basic Land',
    cost: '',
    colors: [],
    effect: '',
    power: 0,
    toughness: 0,
    imageUrl: img,
    rarity: c.rarity || 'common'
  };
  D._landCache[landName] = normalized;
  return normalized;
}

function cloneCard(base){
  return { ...base, id: uid() }; // ensure unique ids for duplicates
}


  const createCardElement = (c, isInDeck) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'deck-card';

    const img = setCardImageElement(document.createElement('img'), c, { loading: 'lazy', width: 100, height: 140 });

    cardDiv.onmouseenter = () => { state.hoveredCard = c; updateCardInfo(); };
    cardDiv.onmouseleave = () => { state.hoveredCard = null; updateCardInfo(); };
    cardDiv.appendChild(img);

    if (isInDeck) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        const i = state.decks[key].indexOf(c);
        if (i > -1) state.decks[key].splice(i, 1);
        render(); // will rebuild and re-render the chart
      };
      cardDiv.appendChild(removeBtn);
    }

    return cardDiv;
  };

  // ---------- build main containers ----------
  const deckContainer = document.createElement('div');
  deckContainer.style.cssText = 'background:#1f2937;padding:16px;border-radius:8px;min-height:200px;';
  if (!state.decks[key] || state.decks[key].length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'text-gray text-center';
    emptyMsg.style.padding = '32px 0';
    emptyMsg.textContent = 'No cards in deck. Click cards below to add them!';
    deckContainer.appendChild(emptyMsg);
  } else {
    state.decks[key].forEach(c => deckContainer.appendChild(createCardElement(c, true)));
  }

  const availContainer = document.createElement('div');
  availContainer.style.cssText = 'background:#1f2937;padding:16px;border-radius:8px;min-height:200px;';
  if (!state.cards || state.cards.length === 0) {
    availContainer.innerHTML = '<p class="text-gray text-center" style="padding:32px;">No cards available. Go to Card Creator to add some!</p>';
  } else {
    state.cards.forEach(c => {
      const el = createCardElement(c, false);
      el.style.cursor = 'pointer';
      el.onclick = () => {
        const copy = { ...c, deckId: Date.now() + Math.random() };
        state.decks[key] = state.decks[key] || [];
        state.decks[key].push(copy);
        render(); // will rebuild and re-render the chart
      };
      availContainer.appendChild(el);
    });
  }

  function jumpstartPanelHtml(){
    if (mode.id !== 'jumpstart') return '';
    const options = JUMPSTART_THEMES.map(t => `<option value="${t.id}">${htmlEscape(t.title)}</option>`).join('');
    return `
      <div class="card p-4 mb-4" id="jumpstartMixer">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Jumpstart Packet Mixer</h3>
            <p class="text-sm text-gray">Pick two themes, then build a shuffled 40-card packet deck for Player ${state.currentPlayer}.</p>
          </div>
          <div class="badge" id="jumpstartDeckName">40 cards</div>
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:12px">
          <div>
            <label class="text-xs">Packet A</label>
            <select id="jumpPacketA" class="input">${options}</select>
          </div>
          <div>
            <label class="text-xs">Packet B</label>
            <select id="jumpPacketB" class="input">${options}</select>
          </div>
          <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
            <button id="randomJumpstart" class="btn btn-secondary">Randomize</button>
            <button id="buildJumpstart" class="btn btn-primary">Build Deck</button>
          </div>
        </div>
      </div>
    `;
  }

  function cubePanelHtml(){
    if (mode.id !== 'cube') return '';
    return `
      <div class="card p-4 mb-4" id="cubeStackTools">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Cube Center Stack</h3>
            <p class="text-sm text-gray">Use your current deck as the shared center stack, import a cube list, or generate a starter cube for quick testing.</p>
          </div>
          <div class="badge">Shared draw pile</div>
        </div>
        <div class="grid" style="grid-template-columns:160px auto;gap:12px;margin-top:12px;align-items:end">
          <div>
            <label class="text-xs">Starter size</label>
            <input id="cubeStackSize" class="input" type="number" min="40" max="180" value="90">
          </div>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <button id="buildCubeStack" class="btn btn-primary">Generate Starter Cube Stack</button>
          </div>
        </div>
      </div>
    `;
  }

  function dandanPanelHtml(){
    if (mode.id !== 'dandan') return '';
    return `
      <div class="card p-4 mb-4" id="dandanLibraryTools">
        <div class="flex justify-between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <h3 style="font-size:18px;font-weight:800;margin-bottom:6px">Dandan Shared Library</h3>
            <p class="text-sm text-gray">Generate a blue shared-library stack with Dandan, counterplay, cantrips, bounce, and Islands.</p>
          </div>
          <div class="badge">Shared draw pile</div>
        </div>
        <div class="grid" style="grid-template-columns:160px auto;gap:12px;margin-top:12px;align-items:end">
          <div>
            <label class="text-xs">Library size</label>
            <input id="dandanLibrarySize" class="input" type="number" min="40" max="160" value="80">
          </div>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <button id="buildDandanLibrary" class="btn btn-primary">Generate Dandan Library</button>
          </div>
        </div>
      </div>
    `;
  }

  const deckValidation = validateDeckForMode(state.decks[key] || [], mode);

  // ---------- template ----------
  div.innerHTML = `
    <div class="header flex items-center justify-between gap-3">
      <button id="backBtn" class="btn btn-secondary h-9 px-3 text-sm">← Back</button>
      <h1 class="text-xl font-bold">Deck Editor • ${htmlEscape(mode.title)}</h1>
      <button id="changeMode" class="btn btn-secondary h-9 px-3 text-sm">Change Format</button>
    </div>

    <div class="flex mb-4" style="gap:8px;flex-wrap:wrap">
      <div class="segmented" role="group" aria-label="Deck Editor section">
        <button id="tabDeck" class="${state.builderTab !== 'cards' ? 'active' : ''}">🛠️ Build deck</button>
        <button id="tabCards" class="${state.builderTab === 'cards' ? 'active' : ''}">✨ Create cards</button>
      </div>
    </div>

    <div id="builderBody">

    <div class="card p-4 mb-4 deck-library">
      <div class="flex justify-between" style="align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="font-weight:800;font-size:15px">📚 My Decks</h3>
          <p class="text-xs text-gray mt-1">Save the deck you are building, then load it into any game.</p>
        </div>
        <div class="flex" style="gap:8px;align-items:center;flex-wrap:wrap">
          <input id="deckNameInput" class="input" style="width:200px" placeholder="Deck name"
                 value="${htmlEscape(state.lastDeckName || '')}">
          <button id="saveDeckToLib" class="btn btn-primary text-sm">Save deck</button>
        </div>
      </div>

      <div class="flex mt-3" style="gap:10px;align-items:center;flex-wrap:wrap">
        <span class="text-xs text-gray" style="letter-spacing:.06em;text-transform:uppercase">Editing</span>
        <div class="segmented" role="group" aria-label="Which deck to edit">
          <button id="editDeck1" class="${state.currentPlayer === 1 ? 'active' : ''}">Your deck · ${(state.decks.player1 || []).length}</button>
          <button id="editDeck2" class="${state.currentPlayer === 2 ? 'active' : ''}">Opponent deck · ${(state.decks.player2 || []).length}</button>
        </div>
        ${state.currentPlayer === 2 ? '<span class="text-xs text-gray">The bot plays this deck in vs-AI games.</span>' : ''}
      </div>

      ${(state.deckLibrary || []).length ? `
        <div class="deck-shelf mt-3">
          ${state.deckLibrary.map(d => `
            <div class="deck-shelf-item">
              <div style="min-width:0">
                <div class="deck-shelf-name">${htmlEscape(d.name)}</div>
                <div class="text-xs text-gray">${htmlEscape(libraryDeckSummary(d))}</div>
              </div>
              <div class="flex" style="gap:6px">
                <button class="btn btn-secondary text-xs libLoad" data-id="${d.id}">Load</button>
                <button class="btn btn-red text-xs libDelete" data-id="${d.id}" aria-label="Delete ${htmlEscape(d.name)}">✕</button>
              </div>
            </div>`).join('')}
        </div>`
      : '<div class="text-xs text-gray mt-3">No saved decks yet — name this one and press Save.</div>'}
    </div>

    <div class="card p-4 mb-4">
      <div class="flex justify-between" style="align-items:flex-start;gap:12px;">
        <div>
          <span class="mode-family">${htmlEscape(mode.family)}</span>
          <div class="text-sm text-gray mt-2">${htmlEscape(mode.summary)}</div>
          <div class="text-xs text-gray mt-2">
            ${mode.target ? `Target ${mode.target} cards` : 'Open deck size'}
            ${mode.singleton ? ' • Singleton' : ''}
            ${mode.rarity === 'common' ? ' • Commons only' : ''}
            ${mode.commanderZone ? ' • Commander zone in battle' : ''}
          </div>
        </div>
      </div>
    </div>

    ${deckValidationPanelHtml(deckValidation)}

    ${jumpstartPanelHtml()}
    ${cubePanelHtml()}
    ${dandanPanelHtml()}

    <div class="action-panel-grid" style="margin-bottom:16px;">
      <button id="draftCTA" class="action-panel" type="button">
        <span>Draft</span>
        <small>Open the draft or pool builder for this mode.</small>
      </button>
      <button id="importCTA" class="action-panel" type="button">
        <span>Import</span>
        <small>Paste or upload a decklist.</small>
      </button>
      <button id="exportCTA" class="action-panel" type="button">
        <span>Export</span>
        <small>Download the current deck.</small>
      </button>
      <button id="landsCTA" class="action-panel" type="button">
        <span>🏞️ Lands</span>
        <small>Choose which basic land printing your decks use.</small>
      </button>
    </div>

<!-- Stretched toggle bar for Deck Statistics -->
<button id="statsToggle" class="stats-toggle" type="button" aria-expanded="false" aria-controls="deckStatsCard">
  <span class="left"><span class="chip"></span><span id="statsLabel">Decklist Statistics</span></span>
  <span class="chev" id="statsChevron">▸</span>
</button>

<!-- Collapsible stats card (initially hidden) -->
<div class="card p-4 hidden" id="deckStatsCard" style="margin-bottom:16px">
  <div id="manaCurveDeckChart"></div>
</div>


    <!-- Collapsed Import panel -->
    <div class="card p-4 hidden" id="importCard" style="margin-bottom:16px">
      <div class="flex justify-between" style="align-items:center;margin-bottom:8px">
        <h3 style="font-weight:800;letter-spacing:.2px">Import decklist</h3>
        <div class="text-xs text-gray">
          <strong>.json</strong> upload = replace current deck immediately.<br>
          <strong>.txt</strong> or pasted text = Parse → Import parsed.
        </div>
      </div>

      <div class="grid" style="grid-template-columns:1fr 320px;gap:12px">
        <div>
          <textarea id="importDeckTA" class="input" style="min-height:120px" placeholder="Examples:
4 Lightning Bolt
3x Counterspell
Island x14
# comments & Sideboard: are ignored"></textarea>

          <div class="flex" style="gap:8px;margin-top:8px;flex-wrap:wrap">
            <label class="btn btn-secondary text-sm" style="cursor:pointer">
              Upload .txt or .json
              <input id="importDeckFile" type="file" accept=".txt,.json" class="hidden">
            </label>

            <div class="flex" style="gap:8px;align-items:center">
              <span class="text-xs text-gray">Prefer set (optional)</span>
              <input id="importSetPref" class="input" type="text" placeholder="e.g. ltr" style="width:100px">
            </div>

            <label class="text-xs flex" style="gap:6px;align-items:center;cursor:pointer">
              <input id="importIncludeImages" type="checkbox" checked>
              Include images
            </label>

            <label class="text-xs flex" style="gap:6px;align-items:center;cursor:pointer">
              <input id="importReplace" type="checkbox">
              Replace current deck (instead of add)
            </label>

            <button id="btnImportParse"  class="btn btn-primary text-sm">Parse</button>
            <button id="btnImportApply"  class="btn btn-secondary text-sm" disabled>Import parsed</button>
          </div>
        </div>

        <div>
          <div id="importStatus" class="text-xs text-gray">Status: collapsed.</div>
          <div id="importPreview" style="margin-top:8px;max-height:200px;overflow:auto;border:1px solid #374151;border-radius:8px;padding:8px"></div>
        </div>
      </div>
    </div>

    <!-- The mana curve renders inside the collapsible stats card above; a second
         mount with the same id was always left empty (querySelector takes the first). -->

    <div style="display:grid;grid-template-columns:1fr 1fr 300px;gap:20px;">
      <div class="card">
        <h3 class="mb-4" style="font-weight:bold;">Decklist [${(state.decks[key]||[]).length}]</h3>
        <p class="text-xs text-gray mb-4">Click the ✕ to remove cards</p>
        <div id="deckContainer"></div>
      </div>
      <div class="card">
        <h3 class="mb-4" style="font-weight:bold;">Collection [${(state.cards||[]).length}]</h3>
        <p class="text-xs text-gray mb-4">Click cards to add to deck</p>
        <div id="availContainer"></div>
      </div>
      <div class="card" style="position:sticky;top:20px;height:fit-content;">
        <h3 class="mb-4" style="font-weight:bold;text-align:center;">Card Info</h3>
        <div id="cardInfoSidebar">
          <p class="text-gray text-xs text-center" style="padding:20px;">Hover over a card to see details</p>
        </div>
      </div>
    </div>
    </div>
  `;

  // ---------- mount dynamic containers ----------
  // (skipped when the Create-cards tab has replaced the body)
  const deckMount = div.querySelector('#deckContainer');
  if (deckMount) deckMount.appendChild(deckContainer);
  const availMount = div.querySelector('#availContainer');
  if (availMount) availMount.appendChild(availContainer);

  // ---------- header / tiles wiring ----------
  const backBtn   = div.querySelector('#backBtn');
  if (backBtn) backBtn.onclick = () => {
    state.screen = state.battleMode === state.selectedMode ? 'mode-studio' : 'menu';
    render();
  };

  const changeModeBtn = div.querySelector('#changeMode');
  if (changeModeBtn) changeModeBtn.onclick = () => { state.modeIntent = 'build'; state.screen = 'modes'; render(); };

  // Which deck the builder edits (replaces the old P1/P2 profile switcher).
  const tabDeck = div.querySelector('#tabDeck');
  const tabCards = div.querySelector('#tabCards');
  if (tabDeck) tabDeck.onclick = () => { state.builderTab = 'deck'; render(); };
  if (tabCards) tabCards.onclick = () => { state.builderTab = 'cards'; render(); };

  // "Create cards" swaps the deck panels for the card creator, so both halves
  // of deck editing live behind one door instead of two separate screens.
  if (state.builderTab === 'cards') {
    const body = div.querySelector('#builderBody');
    if (body) {
      body.innerHTML = '';
      state.embedCreator = true;
      try { body.appendChild(CardCreator()); }
      finally { state.embedCreator = false; }
    }
  }

  const saveDeckBtn = div.querySelector('#saveDeckToLib');
  if (saveDeckBtn) saveDeckBtn.onclick = () => {
    const nameInput = div.querySelector('#deckNameInput');
    const entry = saveDeckToLibrary(nameInput?.value, state.decks[key], state.selectedMode);
    if (entry) {
      state.lastDeckName = entry.name;
      toast(`Saved "${entry.name}".`);
      render();
    }
  };
  div.querySelectorAll('.libLoad').forEach(btn => {
    btn.onclick = () => {
      const entry = loadDeckFromLibrary(btn.dataset.id, key);
      if (entry) { state.lastDeckName = entry.name; toast(`Loaded "${entry.name}".`); render(); }
    };
  });
  div.querySelectorAll('.libDelete').forEach(btn => {
    btn.onclick = () => {
      const entry = (state.deckLibrary || []).find(d => d.id === btn.dataset.id);
      if (entry && !confirm(`Delete "${entry.name}"?`)) return;
      deleteDeckFromLibrary(btn.dataset.id);
      render();
    };
  });

  const editDeck1 = div.querySelector('#editDeck1');
  const editDeck2 = div.querySelector('#editDeck2');
  if (editDeck1) editDeck1.onclick = () => { state.currentPlayer = 1; render(); };
  if (editDeck2) editDeck2.onclick = () => { state.currentPlayer = 2; render(); };

  const exportCTA = div.querySelector('#exportCTA');
  if (exportCTA) exportCTA.onclick = () => saveDeck();

  const landsCTA = div.querySelector('#landsCTA');
  if (landsCTA) landsCTA.onclick = () => openLandPicker('Plains');

  const importCTA = div.querySelector('#importCTA');
  const importCard = div.querySelector('#importCard');
  if (importCTA && importCard) {
    importCTA.onclick = () => {
      importCard.classList.toggle('hidden');
      const ta = div.querySelector('#importDeckTA');
      const st = div.querySelector('#importStatus');
      if (!importCard.classList.contains('hidden')) {
        if (st) st.textContent = 'Status: ready.';
        if (ta) ta.focus();
        importCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        if (st) st.textContent = 'Status: collapsed.';
      }
    };
  }

  // Draft entry (image tile)
  const openDraft = div.querySelector('#draftCTA') || div.querySelector('#openDraft');
  if (openDraft) {
    openDraft.onclick = () => {
      resetDraftForMode(state.selectedMode || 'casual', { screen: 'mode' });
      state.screen = 'draft';
      render();
    };
  }

  const jumpA = div.querySelector('#jumpPacketA');
  const jumpB = div.querySelector('#jumpPacketB');
  const randomJumpstart = div.querySelector('#randomJumpstart');
  const buildJumpstart = div.querySelector('#buildJumpstart');
  if (jumpA && jumpB && JUMPSTART_THEMES.length > 1) jumpB.value = JUMPSTART_THEMES[1].id;
  function randomizeJumpstart(){
    if (!jumpA || !jumpB) return;
    const themes = shuffleCopy(JUMPSTART_THEMES);
    jumpA.value = themes[0].id;
    jumpB.value = (themes[1] || themes[0]).id;
  }
  if (randomJumpstart) randomJumpstart.onclick = randomizeJumpstart;
  if (buildJumpstart) buildJumpstart.onclick = async () => {
    buildJumpstart.disabled = true;
    buildJumpstart.textContent = 'Fetching cards…';
    let deck = null;
    try { deck = await buildRealJumpstartDeck(jumpA?.value, jumpB?.value); } catch {}
    if (!deck) deck = buildJumpstartDeck(jumpA?.value, jumpB?.value);   // offline fallback
    state.decks[key] = tagAutoDeck(deck.cards, 'jumpstart');
    toast(`Jumpstart deck built: ${deck.name}`);
    render();
  };

  const buildCubeStack = div.querySelector('#buildCubeStack');
  if (buildCubeStack) buildCubeStack.onclick = () => {
    const sizeInput = div.querySelector('#cubeStackSize');
    const size = Math.max(40, Math.min(180, parseInt(sizeInput?.value || '90', 10)));
    state.decks[key] = tagAutoDeck(makeStarterCubeStack(size), 'cube');
    upgradeDeckSlot(key, 'cube', () => buildRealStarterPool(size));
    toast(`Starter cube stack built: ${size} cards`);
    render();
  };

  const buildDandanLibrary = div.querySelector('#buildDandanLibrary');
  if (buildDandanLibrary) buildDandanLibrary.onclick = () => {
    const sizeInput = div.querySelector('#dandanLibrarySize');
    const size = Math.max(40, Math.min(160, parseInt(sizeInput?.value || '80', 10)));
    state.decks[key] = tagAutoDeck(makeDandanLibrary(size), 'dandan');
    toast(`Dandan library built: ${size} cards`);
    render();
  };

  // ---------- Import panel wiring ----------
  const importTA    = div.querySelector('#importDeckTA');
  const importFile  = div.querySelector('#importDeckFile');
  const importSet   = div.querySelector('#importSetPref');
  const importImgs  = div.querySelector('#importIncludeImages');
  const importRepl  = div.querySelector('#importReplace');
  const importParse = div.querySelector('#btnImportParse');
  const importApply = div.querySelector('#btnImportApply');
  const importStat  = div.querySelector('#importStatus');
  const importPrev  = div.querySelector('#importPreview');

  // Keep a cache of the last parsed result (for TXT or pasted JSON)
  let lastParsedCards = null;

  function renderImportPreview(map){
    if (!map || map.size === 0) { importPrev.innerHTML = ''; return; }
    const rows = [];
    let total = 0;
    // Names come straight from pasted text — escape before injecting as HTML.
    for (const [name, qty] of map){ rows.push(`<tr><td style="width:40px">${htmlEscape(String(qty))}</td><td>${htmlEscape(name)}</td></tr>`); total += qty; }
    importPrev.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr><th style="text-align:left;width:40px">Qty</th><th style="text-align:left">Name</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="text-xs text-gray" style="margin-top:6px">
        Parsed <strong>${map.size}</strong> unique names / <strong>${total}</strong> total.
        Supported lines: <code>4 Lightning Bolt</code>, <code>Lightning Bolt x2</code>, <code>3x Counterspell</code>, or just the name.
        Lines beginning with <code>#</code> or <code>//</code> and headers like <code>Sideboard:</code> are ignored.
      </div>`;
  }

  function ensureImages(cards){
    return cards.map(c => {
      if (!c.imageUrl || !c.imageUrl.length){
        const nm = encodeURIComponent(c.name || '');
        c.imageUrl = `https://api.scryfall.com/cards/named?format=image&version=normal&exact=${nm}`;
      }
      return c;
    });
  }

  function applyToDeck(cards, replace){
    const key2 = 'player' + state.currentPlayer;
    if (replace) state.decks[key2] = cards.slice();
    else state.decks[key2] = (state.decks[key2] || []).concat(cards);
    toast(replace ? 'Deck replaced ✓' : `Added ${cards.length} card(s) ✓`);
    render();
  }

  async function doParse(raw){
    lastParsedCards = null;
    importApply.disabled = true;
    try{
      if (!raw || !raw.trim()){
        if (importStat) importStat.textContent = 'Nothing to parse.';
        return;
      }
      if (raw.trim().startsWith('{')){
        const j = JSON.parse(raw);
        if (Array.isArray(j.cards)){
          lastParsedCards = ensureImages(j.cards);
          importPrev.innerHTML = `<div class="text-xs text-gray">Ready: JSON with <strong>${lastParsedCards.length}</strong> card objects.</div>`;
          if (importStat) importStat.textContent = 'JSON parsed. Click “Import parsed” to load it.';
          importApply.disabled = false;
          return;
        }
      }
      const m = parseDecklist(raw);
      renderImportPreview(m);
      if (!m.size){ if (importStat) importStat.textContent = 'No valid card names found.'; return; }

      if (importStat) importStat.textContent = 'Fetching Scryfall data…';
      const setPref = (importSet && importSet.value || '').trim();
      const includeImages = !!(importImgs && importImgs.checked);
      const { out, errors } = await convertDecklist(raw, state.currentPlayer, setPref, includeImages, { textContent: (t)=> { if(importStat) importStat.textContent = t; } });

      lastParsedCards = out.cards;
      importApply.disabled = false;

      const warn = errors && errors.length ? ` • ${errors.length} could not be matched.` : '';
      if (importStat) importStat.textContent = `Parsed ${m.size} unique (${[...m.values()].reduce((a,b)=>a+b,0)} total). Resolved ${out.cards.length} objects${warn}.`;
    } catch(e){
      if (importStat) importStat.textContent = 'Error: ' + e.message;
    }
  }

  function doImportParsed(){
    if (!lastParsedCards || !lastParsedCards.length){
      toast('Nothing parsed yet. Click Parse first.');
      return;
    }
    const replace = !!(importRepl && importRepl.checked);
    applyToDeck(lastParsedCards, replace);
  }

  if (importParse) importParse.onclick = () => {
    const raw = (importTA && importTA.value) ? importTA.value : '';
    doParse(raw);
  };
  if (importApply) importApply.onclick = () => doImportParsed();

  if (importFile) importFile.onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const name = (f.name || '').toLowerCase();

    if (name.endsWith('.json') || text.trim().startsWith('{')){
      try{
        const j = JSON.parse(text);
        if (!Array.isArray(j.cards)) throw new Error('Not a compatible deck JSON (missing "cards" array).');
        const cards = ensureImages(j.cards);
        applyToDeck(cards, true);
        if (importStat) importStat.textContent = `Loaded JSON deck: ${cards.length} cards (replaced).`;
        return;
      } catch(err){
        if (importStat) importStat.textContent = 'Invalid JSON: ' + err.message;
        return;
      }
    }
    if (importTA) importTA.value = text;
    try { const m = parseDecklist(text); renderImportPreview(m); } catch {}
    if (importStat) importStat.textContent = 'TXT loaded. Click “Parse” to resolve via Scryfall, then “Import parsed”.';
    importApply.disabled = true;
  };

// --- Deck Statistics toggle wiring ---
const statsToggle = div.querySelector('#statsToggle');
const statsCard   = div.querySelector('#deckStatsCard');
const statsLabel  = div.querySelector('#statsLabel');
const statsChev   = div.querySelector('#statsChevron');

function openStats(){
  statsCard.classList.remove('hidden');
  statsToggle.classList.add('open');
  statsToggle.setAttribute('aria-expanded','true');
  if (statsChev) statsChev.textContent = '▾';
  // render when opened (fresh each time)
  renderDeckStatsInto('manaCurveDeckChart');
}

function closeStats(){
  statsCard.classList.add('hidden');
  statsToggle.classList.remove('open');
  statsToggle.setAttribute('aria-expanded','false');
  if (statsChev) statsChev.textContent = '▸';
}

if (statsToggle && statsCard){
  // default closed
  closeStats();

  statsToggle.onclick = () => {
    if (statsCard.classList.contains('hidden')) openStats();
    else closeStats();
  };
}


  return div;
}

// GAME BOARD ----------------------------
// ---------------------------------------------------------------------------
// Battlefield zones
//
// The board is laid out the way a real table is: creatures (and planeswalkers)
// in front, artifacts/enchantments beside them, and lands + mana rocks in the
// back row next to the command zone, library and graveyard. Cards auto-route to
// the right zone when played and can still be dragged anywhere.
// ---------------------------------------------------------------------------

const BATTLE_ZONES = [
  { key: 'creatureField', label: 'Creatures',               short: 'Creatures' },
  { key: 'supportField',  label: 'Artifacts, Enchantments', short: 'Artifacts' },
  { key: 'landField',     label: 'Lands & Rocks',           short: 'Lands' }
];
const BATTLE_ZONE_KEYS = BATTLE_ZONES.map(z => z.key);

function battleZoneLabel(key){
  return (BATTLE_ZONES.find(z => z.key === key) || {}).label || key;
}

// Every permanent the player controls, across all three battlefield zones.
function battlefieldCards(player){
  if (!player) return [];
  return BATTLE_ZONE_KEYS.flatMap(k => player[k] || []);
}

// A mana rock belongs with the lands, per the table layout.
function isManaRock(card){
  const type = ((card?.type || '') + '').toLowerCase();
  if (!type.includes('artifact')) return false;
  return /add \{|add one mana|mana of any|adds? \w+ mana/i.test((card?.effect || '') + '');
}

function defaultZoneForCard(card){
  const type = ((card?.type || '') + '').toLowerCase();
  if (type.includes('land')) return 'landField';
  if (type.includes('creature')) return 'creatureField';
  if (type.includes('planeswalker') || type.includes('battle')) return 'creatureField';
  if (isManaRock(card)) return 'landField';
  if (type.includes('artifact') || type.includes('enchantment')) return 'supportField';
  return 'supportField';
}

// Guarantee the three zones exist, folding any legacy upper/lower board into
// them (older saved snapshots, or a peer still on the previous layout).
function normalizePlayerZones(player){
  if (!player) return player;
  for (const key of BATTLE_ZONE_KEYS) {
    if (!Array.isArray(player[key])) player[key] = [];
  }
  const legacy = [...(player.upperField || []), ...(player.lowerField || [])];
  if (legacy.length) {
    for (const card of legacy) player[defaultZoneForCard(card)].push(card);
  }
  if ('upperField' in player) delete player.upperField;
  if ('lowerField' in player) delete player.lowerField;
  return player;
}

function normalizeGameStateZones(gs){
  if (!gs) return gs;
  normalizePlayerZones(gs.player1);
  normalizePlayerZones(gs.player2);
  return gs;
}

// --- Battle-card + Horde engine (top level so the AI autopilot can drive it) ---

function initBattleCard(card){
  if (!card) return card;
  if (!('tapped' in card)) card.tapped = false;
  if (!('pt' in card)) card.pt = { p: 0, t: 0 };
  if (!('stun' in card)) card.stun = 0;
  return card;
}

function isHordeGameActive(){
  return (state.gameState.mode || state.battleMode) === 'horde';
}

// The Horde library deliberately does NOT recycle. Survivors win by emptying
// it, so shuffling the graveyard back made the win condition unreachable — the
// game could only ever end with the survivors dead.
function recycleHordeDeckIfNeeded(){
  const hordePlayer = state.gameState.player2;
  hordePlayer.deck = hordePlayer.deck || [];
  hordePlayer.graveyard = hordePlayer.graveyard || [];
}

// Survivors win once the Horde has no library and nothing left on the board.
function checkHordeVictory(){
  if (!isHordeGameActive() || state.winner) return;
  const horde = state.gameState.player2;
  if ((horde.deck || []).length) return;
  if (battlefieldCards(horde).length) return;
  state.winner = 1;
  state.gameStarted = false;
  state.actionMessage = 'The Horde is spent — the survivors win!';
}

function hordePlayerRef(){ return state.gameState.player2; }

function drawHordeCard(){
  recycleHordeDeckIfNeeded();
  const hordePlayer = state.gameState.player2;
  return hordePlayer.deck.length ? initBattleCard(hordePlayer.deck.shift()) : null;
}

function placeHordeToken(card){
  // Fresh tokens are summoning-sick: without this the Horde can reveal a dozen
  // tokens and swing for lethal on the very first turn.
  state.gameState.player2.creatureField.push(initBattleCard({ ...card, tapped: false, aiSick: true }));
}

function resolveHordeAction(card){
  const hordePlayer = state.gameState.player2;
  const survivorPlayer = state.gameState.player1;
  let message = card.name;
  if (card.hordeEffect === 'drain') {
    survivorPlayer.health = Math.max(0, survivorPlayer.health - 2);
    message = 'Gnawing Dread: survivors lose 2 life.';
  } else if (card.hordeEffect === 'regrow') {
    const returned = [];
    for (let i = hordePlayer.graveyard.length - 1; i >= 0 && returned.length < 2; i--) {
      const candidate = hordePlayer.graveyard[i];
      if (candidate?.hordeRole === 'token' || candidate?.isToken) {
        returned.push(hordePlayer.graveyard.splice(i, 1)[0]);
      }
    }
    returned.forEach(placeHordeToken);
    message = `Graveborn Return: ${returned.length} token${returned.length === 1 ? '' : 's'} returned.`;
  } else if (card.hordeEffect === 'untap') {
    battlefieldCards(hordePlayer).forEach(c => { c.tapped = false; });
    message = 'Endless Moan: the Horde untaps.';
  } else if (card.hordeEffect === 'surge') {
    message = 'Mindless Surge: reveal two extra Horde cards.';
  }
  hordePlayer.graveyard.push(card);
  return message;
}

function revealHorde(){
  if (!isHordeGameActive()) return;
  executeGameAction('horde_reveal', {}, () => {
    let tokens = 0;
    let stumbled = 0;
    let actions = [];
    let guard = 0;

    // Two separate dials, which is what makes the mode tunable:
    //  - revealPerTurn is the CLOCK. Survivors win by emptying the library, so
    //    this decides how long the game runs, the same on every difficulty.
    //  - tokenCap is the THREAT. Only this many revealed tokens actually join
    //    the battlefield; the rest stumble into the graveyard. Capping reveals
    //    instead would have slowed the clock as well, which is why Easy used
    //    to be both gentle AND unwinnable.
    const tier = aiTier();
    const revealPerTurn = 5;
    const tokenCap = { easy: 1, normal: 2, hard: 4 }[tier] ?? 2;
    let toReveal = revealPerTurn;

    while (guard < 60 && toReveal > 0) {
      guard++;
      const card = drawHordeCard();
      if (!card) break;
      toReveal--;
      const isToken = card.hordeRole === 'token' || card.isToken || (card.type || '').includes('Token');
      if (isToken) {
        if (tokens < tokenCap) { placeHordeToken(card); tokens++; }
        else { hordePlayerRef().graveyard.push(card); stumbled++; }
        continue;
      }

      const actionMessage = resolveHordeAction(card);
      actions.push(actionMessage);
      if (card.hordeEffect === 'surge') toReveal += 2;
    }

    checkWinner();
    checkHordeVictory();
    return { tokens, stumbled, actions };
  }, ({ tokens, stumbled, actions }) =>
    `Horde reveal: ${tokens} token${tokens === 1 ? '' : 's'} joined${stumbled ? `, ${stumbled} stumbled` : ''}${actions.length ? ' - ' + actions.join(' ') : ''}`);
}

function hordeAttack(){
  if (!isHordeGameActive()) return;
  executeGameAction('horde_attack', {}, () => {
    const hordePlayer = state.gameState.player2;
    const survivorPlayer = state.gameState.player1;
    const attackers = battlefieldCards(hordePlayer)
      .filter(card => (card.type || '').includes('Creature') || card.isToken)
      .filter(card => !card.tapped && !card.aiSick);
    const damage = attackers.reduce((sum, card) => sum + Math.max(0, effectivePT(card).p), 0);
    attackers.forEach(card => { card.tapped = true; });
    survivorPlayer.health = Math.max(0, survivorPlayer.health - damage);
    checkWinner();
    checkHordeVictory();
    return { count: attackers.length, damage };
  }, ({ count, damage }) => `Horde attack: ${count} creature${count === 1 ? '' : 's'} dealt ${damage} damage.`);
}

// --- Basic Land Game helpers (top level so the AI autopilot can score/win) ---

function basicLandName(card){
  return BASIC_LAND_NAMES.includes(card?.name) ? card.name : '';
}

function landGameFieldCards(player){
  return battlefieldCards(player).filter(card => basicLandName(card));
}

function landGameCounts(player){
  const counts = Object.fromEntries(BASIC_LAND_NAMES.map(name => [name, 0]));
  for (const card of landGameFieldCards(player)) counts[card.name] += 1;
  return counts;
}

function formatLandGameProgress(player){
  const counts = landGameCounts(player);
  const domain = BASIC_LAND_NAMES.filter(name => counts[name] > 0).length;
  const best = Math.max(...BASIC_LAND_NAMES.map(name => counts[name]));
  const short = BASIC_LAND_NAMES.map(name => `${name[0]}:${counts[name]}`).join(' ');
  return `${short} • Domain ${domain}/5 • Pair ${best}/5`;
}

function checkLandGameVictory(){
  if ((state.gameState.mode || state.battleMode) !== 'land-game' || state.winner) return;
  for (const [playerNum, player] of [[1, state.gameState.player1], [2, state.gameState.player2]]) {
    const counts = landGameCounts(player);
    const hasDomain = BASIC_LAND_NAMES.every(name => counts[name] > 0);
    const hasFive = BASIC_LAND_NAMES.some(name => counts[name] >= 5);
    if (hasDomain || hasFive) {
      state.winner = playerNum;
      state.actionMessage = `Player ${playerNum} completes the Basic Land Game goal.`;
      return;
    }
  }
}

function GameBoard() {
  const div = document.createElement('div');

  // checkWinner() clears gameStarted, so guard on the winner too — otherwise a
  // life-based win silently returns players to the pre-game screen and the
  // victory modal below is never reachable.
  if (!state.gameStarted && !state.winner) {
    div.className = 'container screen';
    let connUI = '';
    const statusLine = state.connectionStatus
      ? `<div class="text-xs text-gray mt-2">Connection: ${htmlEscape(state.connectionStatus)}${
          state.candidateSummary ? ` · ${htmlEscape(state.candidateSummary)}` : ''}</div>`
      : '';
    // If STUN never answered, the code only contains LAN addresses and will
    // fail across networks. Say so before it gets shared, not after.
    const localOnlyWarning = state.localOnlyCode ? `
      <div class="conn-warn mt-3">
        <strong>⚠ This code only works on your local network.</strong>
        Your browser could not reach a STUN server, so the code contains no
        internet-routable address. Check that a VPN, firewall or strict
        network policy is not blocking UDP, then press Back and host again.
      </div>` : '';
    if (state.onlineMode && state.dataChannel && state.dataChannel.readyState === 'open') {
      connUI = '<div class="card text-green mb-4 text-center p-4">✅ Connected! Ready to play.</div>';
    } else if (state.onlineMode && state.waitingForAnswer) {
      connUI = `
        <div class="card" style="background: rgba(30, 64, 175, 0.2); border-color: #3b82f6; margin-bottom: 24px;">
          <h3 class="mb-4" style="font-weight: bold;">📋 Step 1: Share This Code</h3>
          <textarea readonly class="input mb-4" rows="3" id="offerCode" style="font-size: 11px;">${state.roomCode}</textarea>
          <button id="copyOffer" class="btn btn-blue mb-4" style="width: 100%;">Copy Code</button>
          <hr style="border-color: #4b5563; margin: 16px 0;">
          <h3 class="mb-4" style="font-weight: bold;">📥 Step 2: Enter Their Response</h3>
          <textarea class="input mb-4" rows="3" id="answerInput" placeholder="Paste answer code..." style="font-size: 11px;"></textarea>
          <button id="submitAnswer" class="btn btn-green" style="width: 100%;">Connect</button>
          ${statusLine}
          ${localOnlyWarning}
        </div>
      `;
    } else if (state.onlineMode && state.answerCode) {
      connUI = `
        <div class="card" style="background: rgba(5, 150, 105, 0.2); border-color: #059669; margin-bottom: 24px;">
          <h3 class="mb-4" style="font-weight: bold;">✅ Send This Code Back</h3>
          <textarea readonly class="input mb-4" rows="3" id="answerCode" style="font-size: 11px;">${state.answerCode}</textarea>
          <button id="copyAnswer" class="btn btn-green" style="width: 100%;">Copy Answer Code</button>
          <p class="text-green text-sm mt-4">Waiting for host...</p>
          ${statusLine}
          ${localOnlyWarning}
        </div>
      `;
    } else if (state.onlineMode) {
      connUI = `<div class="card mb-4 text-center p-4">
        <strong>Preparing connection…</strong>
        <div class="text-xs text-gray mt-1">Finding a network route. This can take a few seconds — wait for the code before sharing it.</div>
        ${statusLine}
      </div>`;
    }
    const mode = currentModeConfig();
    const rules = getModeRules(mode);
    applyAutoDeck(mode);
    const sharedStackReady = rules.sharedLibrary && (((state.decks.player1 || []).length > 0) || ((state.decks.player2 || []).length > 0));
    const sharedStackOwner = (state.decks.player1 || []).length ? 'your' : ((state.decks.player2 || []).length ? "the opponent's" : '');
    const sharedStackCount = sharedStackOwner === 'your' ? (state.decks.player1 || []).length : (state.decks.player2 || []).length;
    const sharedStackDeck = sharedStackOwner === 'your' ? (state.decks.player1 || []) : (state.decks.player2 || []);
    const decksReady = rules.sharedLibrary ? sharedStackReady : ((state.decks.player1 || []).length > 0 && (state.decks.player2 || []).length > 0);
    const waitForHost = state.onlineMode && !state.isHost;
    const readyMessage = !decksReady
      ? (rules.sharedLibrary ? 'Build or import a shared stack first.' : 'Both players need decks to start.')
      : (waitForHost ? 'Waiting for the host to start the game.' : '');
    const readyValidationHtml = rules.sharedLibrary
      ? deckValidationPanelHtml(validateDeckForMode(sharedStackDeck, mode), {
          id: 'readyDeckValidation',
          title: `${rules.sharedLabel || 'Shared Stack'} Check`,
          compact: true
        })
      : `<div class="grid grid-2" style="gap:12px;margin-top:12px;text-align:left">
          ${deckValidationPanelHtml(validateDeckForMode(state.decks.player1 || [], mode), { id: 'readyP1DeckValidation', title: 'Your Deck', compact: true })}
          ${deckValidationPanelHtml(validateDeckForMode(state.decks.player2 || [], mode), { id: 'readyP2DeckValidation', title: state.vsAI ? 'Bot Deck' : 'Opponent Deck', compact: true })}
        </div>`;
    
    div.innerHTML = `
      <div style="max-width: 800px; width: 100%;">
        <div class="header">
          <button id="backBtn" class="btn btn-secondary text-sm">← Back</button>
          <button id="logoutBtn" class="btn btn-secondary text-sm">Logout</button>
        </div>
        ${connUI}
        <div class="card text-center">
          <h1 class="mb-4" style="font-size: 28px; font-weight: bold;">⚔️ Ready to Play?</h1>
          <div class="mode-family" style="margin:0 auto 8px">${htmlEscape(mode.title)}</div>

          <!-- Game setup + a short how-to-play for this format -->
          <div class="setup-card mb-4">
            <div class="setup-title">How this game is set up</div>
            <ul class="setup-list">
              <li><strong>Opening hand:</strong> ${rules.startingHand || rules.openingHand || 7} cards dealt to each player.</li>
              <li><strong>Starting life:</strong> ${rules.botOpponent ? rules.health + ({ easy: 20, normal: 8, hard: 0 }[aiTier()] || 0) : rules.health}${rules.opponentHealth ? ` — opponent starts at ${Math.round(rules.opponentHealth * ({ easy: 0.75, normal: 1, hard: 1.25 }[aiTier()] || 1))}` : ''}.</li>
              <li><strong>Each turn:</strong> you untap and draw automatically when the turn passes to you.</li>
              ${state.strictMana && state.vsAI ? '<li><strong>Strict mana:</strong> cards tap lands for their cost; one land per turn.</li>' : ''}
              ${!state.vsAI ? '<li><strong>Rules:</strong> self-enforced — play your own legal moves.</li>' : ''}
              <li><strong>Deck:</strong> ${htmlEscape(deckSizeSummary(mode))}.</li>
              ${rules.botOpponent ? '<li><strong>Opponent:</strong> played automatically by the computer. Its deck and life scale with the chosen difficulty.</li>' : ''}
              ${state.vsAI ? `<li><strong>Bot difficulty:</strong> ${htmlEscape((window.GALDUR_AI && window.GALDUR_AI.difficulty().label) || 'Normal')}.</li>` : ''}
            </ul>
            ${(rules.modeRules || []).length ? `
              <div class="setup-title mt-3">Rules of ${htmlEscape(mode.title)}</div>
              <ul class="setup-list">
                ${rules.modeRules.map(r => `<li>${htmlEscape(r)}</li>`).join('')}
              </ul>` : ''}
            ${mode.note ? `<div class="text-xs text-gray mt-3">${htmlEscape(mode.note)}</div>` : ''}
          </div>
          ${rules.sharedLibrary ? `<div class="mode-note mb-4" style="text-align:left">
            ${sharedStackReady
              ? `${htmlEscape(rules.sharedLabel || 'Shared Library')} will use ${sharedStackOwner} deck as one center stack (${sharedStackCount} cards). Both players draw from that stack.`
              : `Build, import, or generate a shared center stack before starting ${htmlEscape(mode.title)}.`}
          </div>` : ''}
          ${readyValidationHtml}
          <p class="text-gray mb-8">${
            state.onlineMode ? 'Waiting for both players to be ready…'
              : state.coop ? 'Co-op: two survivors share one board against the computer.'
              : state.vsAI ? 'The computer plays the opposing seat and takes its own turns.'
              : 'Local game — two players share this device.'}</p>
          <button id="startBtn" class="btn btn-primary" style="padding: 16px 32px; font-size: 18px;" ${(!decksReady || waitForHost) ? 'disabled' : ''}>Start Game</button>
          ${mode.id === 'cube' && !sharedStackReady ? '<button id="starterCubeReady" class="btn btn-secondary mt-4">Generate Starter Cube Stack</button>' : ''}
          ${mode.id === 'dandan' && !sharedStackReady ? '<button id="starterDandanReady" class="btn btn-secondary mt-4">Generate Dandan Library</button>' : ''}
          ${readyMessage ? `<p class="${decksReady ? 'text-gray' : 'text-red'} mt-4">⚠️ ${htmlEscape(readyMessage)}</p>` : ''}
        </div>
      </div>
    `;
    
    const copyFrom = async (selector, btn, label) => {
      const el = div.querySelector(selector);
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.value);
      } catch {
        el.select();
        document.execCommand('copy');     // fallback for non-secure contexts
      }
      const original = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = original || label; }, 1200);
    };
    if (div.querySelector('#copyOffer')) {
      const b = div.querySelector('#copyOffer');
      b.onclick = () => copyFrom('#offerCode', b, 'Copy Code');
    }
    if (div.querySelector('#submitAnswer')) {
      div.querySelector('#submitAnswer').onclick = () => {
        const val = div.querySelector('#answerInput').value.trim();
        if (val) completeConnection(val);
        else alert('Please paste the answer code first!');
      };
    }
    if (div.querySelector('#copyAnswer')) {
      const b = div.querySelector('#copyAnswer');
      b.onclick = () => copyFrom('#answerCode', b, 'Copy Answer Code');
    }
    const starterCubeReady = div.querySelector('#starterCubeReady');
    if (starterCubeReady) starterCubeReady.onclick = () => {
      state.decks.player1 = tagAutoDeck(makeStarterCubeStack(90), 'cube');
    upgradeDeckSlot('player1', 'cube', () => buildRealStarterPool(90));
      toast('Starter cube stack generated.');
      render();
    };
    const starterDandanReady = div.querySelector('#starterDandanReady');
    if (starterDandanReady) starterDandanReady.onclick = () => {
      state.decks.player1 = tagAutoDeck(makeDandanLibrary(80), 'dandan');
      toast('Dandan library generated.');
      render();
    };
    
    div.querySelector('#backBtn').onclick = () => { 
      if (state.onlineMode) disconnectOnline();
      state.screen = 'menu'; 
      render(); 
    };
    div.querySelector('#logoutBtn').onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
    div.querySelector('#startBtn').onclick = () => beginGame(mode, rules);
    return div;
  }

  // GAME SCREEN
  const pKey = 'player' + state.currentPlayer;
  const oKey = 'player' + (state.currentPlayer === 1 ? 2 : 1);
  normalizeGameStateZones(state.gameState);   // belt-and-braces: never render a half-built board
  const me = state.gameState[pKey];
  const opp = state.gameState[oKey];
  const mode = getModeConfig(state.gameState.mode || state.battleMode || state.selectedMode);
  const rules = getModeRules(mode);
  const sharedGame = isSharedGame();
  const shared = state.gameState.shared || { enabled:false, label:'Shared Library', deck:[], graveyard:[], exile:[] };
  if (!state.gameState.shared) state.gameState.shared = shared;
  me.commanderZone = me.commanderZone || [];
  opp.commanderZone = opp.commanderZone || [];
  state.gameState.stack = state.gameState.stack || [];
  state.gameState.phase = state.gameState.phase || 'Main';
  shared.deck = shared.deck || [];
  shared.graveyard = shared.graveyard || [];
  shared.exile = shared.exile || [];
  const myDeckCount = sharedGame ? shared.deck.length : me.deck.length;
  const oppDeckCount = sharedGame ? shared.deck.length : opp.deck.length;
  const gameStack = state.gameState.stack;
  const commanderZoneOn = !!rules.commanderZone;
  const commandMeta = commandZoneMeta(mode);
  const hordeMode = mode.id === 'horde';
  const bossMode = mode.id === 'boss';
  const landGameMode = mode.id === 'land-game';
  const hordePlayer = state.gameState.player2;
  const survivorPlayer = state.gameState.player1;

  function isPermanentCard(card){
    const type = (card?.type || '').toLowerCase();
    return ['creature', 'artifact', 'enchantment', 'planeswalker', 'battle', 'land'].some(t => type.includes(t));
  }

  function ownerPlayerFromStackItem(item){
    return state.gameState['player' + (item?.owner || state.currentPlayer)] || me;
  }

  function stackCardLabel(item){
    return item?.card?.name || 'Unknown spell';
  }

  // Strict mode gatekeeper: returns false (with a toast) when the card cannot
  // be paid for, otherwise taps the lands used and lets the play proceed.
  function payStrictCost(card){
    // Rules enforcement applies to bot games only. Human games — local or
    // online — stay a friendly sandbox where each player polices their own
    // legal moves, which is how this app is meant to be played.
    if (!state.strictMana || !state.vsAI) return true;
    const isLandPlay = ((card.type || '') + '').toLowerCase().includes('land');
    if (isLandPlay) {
      if ((state.landsPlayedThisTurn || 0) >= 1) {
        toast('Strict mana: one land per turn.');
        return false;
      }
      state.landsPlayedThisTurn = (state.landsPlayedThisTurn || 0) + 1;
      return true;
    }
    if (!card.cost) return true;             // tokens / free effects
    const payment = planManaPayment(me, card.cost);
    if (!payment) {
      toast(`Not enough untapped mana for ${card.cost}.`);
      return false;
    }
    payment.forEach(land => { land.tapped = true; });
    return true;
  }

  function castSelectedCardToStack(){
    const card = me.hand[state.selectedCard];
    if (!card) return;
    if (!payStrictCost(card)) return;
    executeGameAction('cast_to_stack', { cardName: card.name, owner: state.currentPlayer }, () => {
      me.hand.splice(state.selectedCard, 1);
      gameStack.push({
        id: makeId('stack'),
        owner: state.currentPlayer,
        card: initBattleCard({ ...card }),
        phase: state.gameState.phase || 'Main'
      });
      state.selectedCard = null;
      state.selectedFieldCard = null;
    }, `Player ${state.currentPlayer} cast ${card.name} to the stack.`);
  }

  function resolveTopStack(){
    if (!gameStack.length) { showAction('The stack is empty.'); return; }
    const topName = stackCardLabel(gameStack[gameStack.length - 1]);
    executeGameAction('resolve_stack', { cardName: topName }, () => {
      const item = gameStack.pop();
      const owner = ownerPlayerFromStackItem(item);
      const card = initBattleCard({ ...item.card, tapped: false });
      if (isPermanentCard(card)) {
        owner[defaultZoneForCard(card)].push(card);
        fireEnterTrigger(card, owner);
        if (rules.winCondition === 'basic-land-game') checkLandGameVictory();
      } else {
        owner.graveyard.push(card);
      }
      return card;
    }, (card) => `Resolved ${card.name}.`);
  }

  function counterTopStack(){
    if (!gameStack.length) { showAction('The stack is empty.'); return; }
    const topName = stackCardLabel(gameStack[gameStack.length - 1]);
    executeGameAction('counter_stack', { cardName: topName }, () => {
      const item = gameStack.pop();
      const owner = ownerPlayerFromStackItem(item);
      owner.graveyard.push(initBattleCard({ ...item.card, tapped: false }));
      return item;
    }, (item) => `Countered ${stackCardLabel(item)}.`);
  }

  function setTurnPhase(phase){
    executeGameAction('set_phase', { phase }, () => {
      state.gameState.phase = phase;
    }, `Phase: ${phase}.`);
  }

  function advanceTurnPhase(){
    const current = state.gameState.phase || 'Main';
    const idx = TURN_PHASES.indexOf(current);
    const next = TURN_PHASES[(idx + 1 + TURN_PHASES.length) % TURN_PHASES.length];
    setTurnPhase(next);
  }

  function canMoveToCommandZone(player){
    if (!commandMeta.max) return true;
    if ((player.commanderZone || []).length < commandMeta.max) return true;
    toast(`${commandMeta.label} is full (${commandMeta.max} cards).`);
    return false;
  }

  function dragTargetLabel(target){
    const labels = {
      creatureField: 'Creatures',
      supportField: 'Artifacts & Enchantments',
      landField: 'Lands & Rocks',
      commanderZone: commandMeta.label,
      hand: 'Hand',
      graveyard: 'Graveyard',
      exile: 'Exile',
      deck: sharedGame ? `${shared.label} bottom` : 'Deck bottom',
      stack: 'Stack'
    };
    return labels[target] || target;
  }

  function setCardDragData(event, source, idx){
    const payload = JSON.stringify({ owner: 'me', source, idx });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', payload);
    event.dataTransfer.setData('text/plain', payload);
  }

  function readCardDragData(event){
    try {
      const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function removeDraggedCard(payload){
    if (!payload || payload.owner !== 'me') return null;
    if (!['hand', ...BATTLE_ZONE_KEYS].includes(payload.source)) return null;
    const idx = Number(payload.idx);
    const source = me[payload.source];
    if (!Array.isArray(source) || !Number.isInteger(idx) || idx < 0 || idx >= source.length) return null;
    return source.splice(idx, 1)[0];
  }

  // Drop onto the open battlefield: the card keeps its exact spot, and the
  // underlying zone array is chosen from its type so the rules engine and the
  // bot still see a normal board.
  function dropOntoCanvas(payload, pos){
    if (!payload || payload.owner !== 'me') return;

    // Moving a card already on the battlefield: just reposition it.
    if (BATTLE_ZONE_KEYS.includes(payload.source)) {
      const card = me[payload.source] && me[payload.source][Number(payload.idx)];
      if (!card) return;
      executeGameAction('move_on_field', { cardName: card.name }, () => {
        card.pos = pos;
        state.selectedFieldCard = null;
      }, '', { ms: 500, log: false });
      return;
    }

    if (payload.source !== 'hand') return;
    const card = me.hand[Number(payload.idx)];
    if (!card) return;
    if (!payStrictCost(card)) return;
    const zone = defaultZoneForCard(card);
    executeGameAction('hand_to_field', { cardName: card.name, zone }, () => {
      const placed = initBattleCard({ ...card, tapped: false, pos });
      me[zone].push(placed);
      me.hand.splice(Number(payload.idx), 1);
      state.selectedCard = null;
      state.selectedFieldCard = null;
      fireEnterTrigger(placed, me);
      checkLandGameVictory();
    }, `Played ${card.name}.`);
  }

  // Re-flow every permanent into tidy rows by type.
  function tidyBattlefield(){
    executeGameAction('tidy_field', {}, () => {
      BATTLE_ZONE_KEYS.forEach(zoneKey => {
        (me[zoneKey] || []).forEach((c, i) => { c.pos = autoPosFor(me, zoneKey, i, 'me'); });
      });
    }, 'Tidied the battlefield.', { ms: 900 });
  }

  function moveDraggedCard(payload, target){
    if (!payload || !target) return;
    if (target === 'stack' && payload.source !== 'hand') {
      showAction('Only cards from hand can be cast to the stack.');
      return;
    }
    // Check before removing the card, or a rejected move would delete it.
    if (target === 'commanderZone' && !canMoveToCommandZone(me)) return;
    // Playing from hand onto the battlefield or stack costs mana in strict mode.
    if (payload.source === 'hand' && (BATTLE_ZONE_KEYS.includes(target) || target === 'stack')) {
      const dragCard = me.hand[Number(payload.idx)];
      if (dragCard && !payStrictCost(dragCard)) return;
    }

    executeGameAction('move_card', { source: payload.source, target }, () => {
      const card = removeDraggedCard(payload);
      if (!card) return null;
      const battleCard = initBattleCard({ ...card, tapped: false });

      if (BATTLE_ZONE_KEYS.includes(target)) {
        me[target].push(battleCard);
        checkLandGameVictory();
      } else if (target === 'hand') {
        me.hand.push(card);
      } else if (target === 'graveyard') {
        me.graveyard.push(battleCard);
      } else if (target === 'exile') {
        me.exile.push(battleCard);
      } else if (target === 'deck') {
        const targetDeck = sharedGame ? shared.deck : me.deck;
        targetDeck.push(battleCard);
      } else if (target === 'commanderZone') {
        me.commanderZone.push(battleCard);
      } else if (target === 'stack') {
        gameStack.push({
          id: makeId('stack'),
          owner: state.currentPlayer,
          card: battleCard,
          phase: state.gameState.phase || 'Main'
        });
      }

      state.selectedCard = null;
      state.selectedFieldCard = null;
      return card;
    }, (card) => card ? `Moved ${card.name} to ${dragTargetLabel(target)}.` : '');
  }

  function drawTopTo(player){
    if (!player.deck.length) return null;
    const card = initBattleCard(player.deck.shift());
    player.hand.push(card);
    return card;
  }

  function landGameTargetCandidates(landName){
    if (landName === 'Forest') {
      return me.graveyard
        .map((card, idx) => ({ owner: 'me', zone: 'graveyard', idx, card, label: `Return ${card.name}` }))
        .filter(item => basicLandName(item.card));
    }
    if (landName === 'Swamp') {
      return opp.hand
        .map((card, idx) => ({ owner: 'opp', zone: 'hand', idx, card, label: `Discard ${card.name}` }))
        .filter(item => basicLandName(item.card));
    }
    if (landName === 'Mountain') {
      return BATTLE_ZONE_KEYS.flatMap(zone =>
        opp[zone].map((card, idx) => ({ owner: 'opp', zone, idx, card, label: `Destroy ${card.name}` }))
      ).filter(item => basicLandName(item.card));
    }
    return [];
  }

  function landGameTargetPrompt(landName){
    if (landName === 'Forest') return 'Choose one of your basic lands in the graveyard.';
    if (landName === 'Swamp') return 'Choose a basic land from the opponent hand to discard.';
    if (landName === 'Mountain') return 'Choose an opponent basic land in play to destroy.';
    return '';
  }

  function beginLandGameEffect(landName){
    if (!landGameMode) return;
    if (landName === 'Island') {
      executeGameAction('land_game_effect', { land: landName }, () => {
        const drawn = drawTopTo(me);
        checkLandGameVictory();
        state.selectedFieldCard = null;
        return drawn;
      }, (drawn) => drawn ? `Island: drew ${drawn.name}.` : 'Island: no card left to draw.');
      return;
    } else if (landName === 'Plains') {
      const repeat = landGameFieldCards(me).find(card => card.name !== 'Plains');
      if (repeat) {
        beginLandGameEffect(repeat.name);
        return;
      }
      showAction('Plains: no non-Plains land available to repeat.');
      return;
    }

    const candidates = landGameTargetCandidates(landName);
    if (!candidates.length) {
      const emptyMessage = landName === 'Forest'
        ? 'Forest: no basic land in your graveyard.'
        : landName === 'Swamp'
          ? 'Swamp: opponent has no basic land in hand.'
          : 'Mountain: opponent has no land in play.';
      state.selectedFieldCard = null;
      showAction(emptyMessage);
      return;
    }
    state.targeting = { type: 'land-game-effect', effect: landName };
    state.selectedFieldCard = null;
    render();
  }

  function completeLandGameTarget(index){
    const targeting = state.targeting;
    if (!targeting || targeting.type !== 'land-game-effect') return;
    const landName = targeting.effect;
    const candidates = landGameTargetCandidates(landName);
    const target = candidates[index];
    if (!target) {
      state.targeting = null;
      render();
      return;
    }

    executeGameAction('land_game_effect', { land: landName, targetZone: target.zone }, () => {
      let message = '';
      if (landName === 'Forest') {
        const card = me.graveyard.splice(target.idx, 1)[0];
        me.hand.push(card);
        message = `Forest: returned ${card.name} from graveyard to hand.`;
      } else if (landName === 'Swamp') {
        const card = opp.hand.splice(target.idx, 1)[0];
        opp.graveyard.push(card);
        message = `Swamp: opponent discarded ${card.name}.`;
      } else if (landName === 'Mountain') {
        const card = opp[target.zone].splice(target.idx, 1)[0];
        opp.graveyard.push(card);
        message = `Mountain: destroyed opponent's ${card.name}.`;
      }
      checkLandGameVictory();
      state.targeting = null;
      state.selectedFieldCard = null;
      return message;
    }, (message) => message);
  }

  function gameCardPreviewHtml(card){
    return cardImageMarkup(card, {
      height: 120,
      style: 'width:100%;height:120px;object-fit:cover;border-radius:6px;display:block'
    });
  }

  function aiAttackers(){
    return battlefieldCards(state.gameState.player2)
      .filter(c => c.aiAttacking);
  }

  // Evergreen keywords worth seeing during combat, pulled from the rules text.
  const COMBAT_KEYWORDS = ['Flying', 'Trample', 'Deathtouch', 'First strike', 'Double strike',
    'Lifelink', 'Menace', 'Vigilance', 'Reach', 'Haste', 'Defender', 'Indestructible'];
  function keywordsOf(card){
    const text = ((card && card.effect) || '').toLowerCase();
    return COMBAT_KEYWORDS.filter(k => text.includes(k.toLowerCase())).join(', ');
  }

  // Creatures that could attack right now (vs-AI games only).
  function myReadyAttackers(){
    return battlefieldCards(me).filter(c => {
      const type = (c.type || '').toLowerCase();
      if (!(type.includes('creature') || c.isToken)) return false;
      if (c.tapped) return false;
      if ((c.effect || '').toLowerCase().includes('defender')) return false;
      return effectivePT(c).p > 0;
    });
  }

  function attackModalHtml(){
    if (!state.declaringAttack) return '';
    const ready = myReadyAttackers();
    const chosen = state.attackSelection || [];
    const blockers = window.GALDUR_AI ? window.GALDUR_AI.aiUntappedBlockers().length : 0;
    const totalPower = ready
      .filter(c => chosen.includes(c.gameId || c.id))
      .reduce((s, c) => s + effectivePT(c).p, 0);
    return `
      <div class="modal">
        <div class="modal-content" style="max-width:820px">
          <div class="flex justify-between mb-4" style="align-items:flex-start;gap:12px">
            <div>
              <h3 style="font-weight:800;font-size:18px">Declare attackers</h3>
              <div class="text-xs text-gray mt-1">
                Pick who swings. The opponent has ${blockers} untapped creature${blockers === 1 ? '' : 's'} and will block on its own.
              </div>
            </div>
            <button id="cancelAttack" class="btn btn-secondary text-sm">Cancel</button>
          </div>
          ${ready.length ? `
            <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;max-height:52vh;overflow:auto">
              ${ready.map(c => {
                const id = c.gameId || c.id;
                const pt = effectivePT(c);
                const on = chosen.includes(id);
                return `
                  <button class="attackPick card${on ? ' picked' : ''}" data-id="${htmlEscape(String(id))}" style="padding:8px;text-align:left;cursor:pointer">
                    <div style="height:120px;overflow:hidden;border-radius:6px">${gameCardPreviewHtml(c)}</div>
                    <div class="text-xs mt-2" style="font-weight:700">${htmlEscape(c.name)}</div>
                    <div class="text-xs text-red">${pt.p}/${pt.t}${keywordsOf(c) ? ` · ${htmlEscape(keywordsOf(c))}` : ''}</div>
                  </button>`;
              }).join('')}
            </div>
            <div class="flex mt-4" style="gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap">
              <div class="text-sm">Attacking with <strong>${chosen.length}</strong>. Opponent drops to <strong>${Math.max(0, opp.health - totalPower)}</strong> life if nothing blocks.</div>
              <div class="flex" style="gap:8px">
                <button id="attackAll" class="btn btn-secondary text-sm">Select all</button>
                <button id="confirmAttack" class="btn btn-red text-sm" ${chosen.length ? '' : 'disabled'}>Attack</button>
              </div>
            </div>`
          : '<div class="text-center text-gray p-4">No untapped creatures are able to attack.</div>'}
        </div>
      </div>`;
  }

  function aiBlockersModalHtml(){
    if (!state.targeting || state.targeting.type !== 'ai-blockers' || !window.GALDUR_AI) return '';
    const attackers = aiAttackers();
    if (!attackers.length) return '';
    const myBlockers = battlefieldCards(me)
      .filter(c => ((c.type || '').toLowerCase().includes('creature') || c.isToken) && !c.tapped);
    const incoming = attackers.reduce((sum, a) => sum + effectivePT(a).p, 0);
    return `
      <div class="modal">
        <div class="modal-content" style="max-width:760px">
          <div class="flex justify-between mb-4">
            <div>
              <h3 style="font-weight:800;font-size:18px">Incoming attack</h3>
              <div class="text-xs text-gray mt-1">Assign a blocker to each attacker, or let the damage through. Unblocked total: <strong>${incoming}</strong>. You would drop to <strong>${Math.max(0, me.health - incoming)}</strong> life.</div>
            </div>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;max-height:56vh;overflow:auto">
            ${attackers.map(a => {
              const apt = effectivePT(a);
              const legal = myBlockers.filter(b => window.GALDUR_AI.canBlock(a, b));
              return `
              <div class="card" style="padding:10px;display:flex;flex-direction:column;gap:6px">
                <div style="height:120px;overflow:hidden;border-radius:6px;flex:0 0 auto">${gameCardPreviewHtml(a)}</div>
                <div class="text-xs" style="font-weight:700">${htmlEscape(a.name)} <span class="text-red">${apt.p}/${apt.t}</span></div>
                ${keywordsOf(a) ? `<div class="text-xs text-gray">${htmlEscape(keywordsOf(a))}</div>` : ''}
                ${(a.effect || '') ? `<div class="text-xs text-gray" style="max-height:32px;overflow:hidden">${htmlEscape(a.effect)}</div>` : ''}
                <select class="input text-xs aiBlockPick" style="margin-top:auto" data-attacker="${htmlEscape(String(a.gameId || a.id))}">
                  <option value="">No block, take ${apt.p}</option>
                  ${legal.map(b => {
                    const bpt = effectivePT(b);
                    return `<option value="${htmlEscape(String(b.gameId || b.id))}">${htmlEscape(b.name)} (${bpt.p}/${bpt.t})</option>`;
                  }).join('')}
                </select>
              </div>`;
            }).join('')}
          </div>
          <div class="flex mt-4" style="gap:8px;justify-content:flex-end">
            <button id="aiNoBlocks" class="btn btn-secondary text-sm">No blocks, take ${incoming}</button>
            <button id="aiResolveCombat" class="btn btn-primary text-sm">Resolve combat</button>
          </div>
        </div>
      </div>
    `;
  }

  function targetingModalHtml(){
    if (!state.targeting || state.targeting.type !== 'land-game-effect') return '';
    const landName = state.targeting.effect;
    const candidates = landGameTargetCandidates(landName);
    return `
      <div class="modal">
        <div class="modal-content" style="max-width:720px">
          <div class="flex justify-between mb-4">
            <div>
              <h3 style="font-weight:800;font-size:18px">${htmlEscape(landName)} target</h3>
              <div class="text-xs text-gray mt-1">${htmlEscape(landGameTargetPrompt(landName))}</div>
            </div>
            <button id="cancelTargeting" class="btn btn-secondary text-xs">Cancel</button>
          </div>
          <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;max-height:60vh;overflow:auto">
            ${candidates.map((item, i) => `
              <button class="targetChoice card" data-i="${i}" style="padding:8px;text-align:left;cursor:pointer">
                ${gameCardPreviewHtml(item.card)}
                <div class="text-xs mt-2" style="font-weight:700">${htmlEscape(item.card.name)}</div>
                <div class="text-xs text-gray">${htmlEscape(item.zone)}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function landGameEffectPanelHtml(card){
    const land = basicLandName(card);
    if (!landGameMode || !land) return '';
    const repeatNames = [...new Set(landGameFieldCards(me).map(c => c.name).filter(name => name !== 'Plains'))];
    const repeatButtons = repeatNames.map(name => `<button class="repeatLandEffect btn btn-secondary text-xs" data-land="${name}">Repeat ${name}</button>`).join('');
    return `
      <div class="card p-3 mb-3" style="background:rgba(5,150,105,.16);border-color:#10b981">
        <div class="text-xs text-gray mb-2">Basic Land Game effect</div>
        ${land === 'Plains'
          ? `<div class="flex" style="gap:8px;flex-wrap:wrap">${repeatButtons || '<span class="text-xs text-gray">No non-Plains land to repeat.</span>'}</div>`
          : `<button id="resolveLandGameEffect" class="btn btn-green text-sm" style="width:100%">Resolve ${land}</button>`}
      </div>
    `;
  }
  
  const createGameCardImg = (c) => {
    const img = document.createElement('img');
    return setCardImageElement(img, c, { loading: 'eager', width: 100, height: 140 });
  };
  
  const showCardInfo = (card, target) => {
    const sidebar = target || div.querySelector('#cardInfo');
    if (sidebar && card) {
      const c = card;
      const countersDisplay = c.counters && c.counters > 0 ? `<div class="text-green text-sm mt-2">+${c.counters}/+${c.counters} counters</div>` : '';
      sidebar.innerHTML = `
        <div class="card-preview">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div class="text-center mb-2" style="font-weight: bold; flex: 1;">${htmlEscape(c.name || '')}</div>
            ${c.cost ? `<div style="font-size: 12px; color: #fbbf24;">${htmlEscape(c.cost)}</div>` : ''}
          </div>
          <div class="text-xs text-gray text-center mb-2">${htmlEscape(c.type || '')}${c.isToken ? ' (Token)' : ''}</div>
          ${cardImageMarkup(c, { style: 'width:100%;border-radius:6px;margin-bottom:8px;display:block' })}
          ${c.type && (c.type.includes('Creature') || c.isToken) ? `<div class="mb-2 text-xs"><strong>PWR:</strong> ${parseInt(c.power || 0) + (c.counters || 0)} <strong>TGH:</strong> ${parseInt(c.toughness || 0) + (c.counters || 0)}</div>` : ''}
${(c.type && (c.type.includes('Creature') || c.isToken)) ? (() => { const e = effectivePT(c); return `<div class="text-xs text-green mt-1">P/T: ${e.p} / ${e.t}</div>`; })() 
  : ''}
          <div class="text-xs">${htmlEscape(c.effect || 'No effect')}</div>
          ${c.tapped ? '<div class="text-xs text-red mt-2">Tapped</div>' : ''}
          ${countersDisplay}
        </div>
      `;
    }
  };
  
  // Dynamic sizing classes based on card count
  const getFieldClass = (cards) => {
    const count = cards.length;
    if (count > 10) return ' lots-cards';
    if (count > 6) return ' many-cards';
    return '';
  };

  const zoneCardsHtml = (player, zoneKey, owner) => (player[zoneKey] || []).map((c, i) => {
    const sel = owner === 'me'
      && state.selectedFieldCard
      && state.selectedFieldCard.zone === zoneKey
      && state.selectedFieldCard.idx === i;
    return `<div class="field-card${c.tapped ? ' tapped' : ''}${sel ? ' selected' : ''}" data-zone="${zoneKey}" data-owner="${owner}" data-idx="${i}"></div>`;
  }).join('');

  // --- Free-placement battlefield -----------------------------------------
  //
  // One open canvas per player instead of separate typed boxes: cards sit
  // wherever they are dropped. The three zone ARRAYS remain the data model
  // (the bot, horde, land-game rules, sync and undo all key off them) — free
  // placement is purely a card.pos = {x,y} percentage carried alongside.
  const canvasCardsHtml = (player, owner) => BATTLE_ZONE_KEYS.flatMap(zoneKey =>
    (player[zoneKey] || []).map((c, i) => {
      const sel = owner === 'me'
        && state.selectedFieldCard
        && state.selectedFieldCard.zone === zoneKey
        && state.selectedFieldCard.idx === i;
      const pos = c.pos || autoPosFor(player, zoneKey, i, owner);
      return `<div class="field-card canvas-card${c.tapped ? ' tapped' : ''}${sel ? ' selected' : ''}"
        data-zone="${zoneKey}" data-owner="${owner}" data-idx="${i}"
        style="left:${pos.x}%;top:${pos.y}%"></div>`;
    })).join('');

  // Cards that have never been placed get a sensible default spot, grouped by
  // type in three lanes. A card is about a third of the canvas tall, so the
  // lanes are spaced accordingly, and a crowded lane fans its cards closer
  // together rather than spilling out of the canvas.
  const LANE_Y = {
    me:  { supportField: 2, creatureField: 31, landField: 60 },
    opp: { landField: 2, creatureField: 31, supportField: 60 }
  };
  function autoPosFor(player, zoneKey, i, owner){
    const y = (LANE_Y[owner === 'opp' ? 'opp' : 'me'])[zoneKey] ?? 34;
    const count = (player[zoneKey] || []).length || 1;
    const step = Math.min(8.2, 90 / Math.max(1, count));   // fan when crowded
    return { x: 1.5 + i * step, y };
  }

  const canvasBox = (player, owner) => {
    const count = battlefieldCards(player).length;
    const drop = owner === 'me' ? ' data-drop-target="canvas"' : '';
    return `
      <div class="battle-canvas ${owner === 'me' ? 'mine' : 'theirs'}"${drop} data-canvas-owner="${owner}">
        <span class="canvas-label">${owner === 'me' ? 'Your battlefield' : 'Opponent battlefield'}${count ? ` · ${count}` : ''}</span>
        ${canvasCardsHtml(player, owner)}
        ${count ? '' : `<span class="canvas-hint">${owner === 'me' ? 'Drag cards here — place them anywhere you like' : ''}</span>`}
      </div>`;
  };

  // Compact, text-only stat tiles. The ids and the .pile-count class are
  // load-bearing: other handlers and the test suite key off them. A player's
  // own piles double as drop targets, so a card can be dragged from the
  // battlefield straight onto the graveyard.
  const pileBox = (id, label, count, clickable = true, dropTarget = '') => {
    const body = `
      <span class="zone-title">${htmlEscape(label)}</span>
      <span class="pile-count">${count}</span>`;
    const drop = dropTarget ? ` data-drop-target="${dropTarget}"` : '';
    return clickable
      ? `<button class="battle-zone pile" id="${id}"${drop}>${body}</button>`
      : `<div class="battle-zone pile is-static"${drop}>${body}</div>`;
  };

  const statStrip = (player, owner) => {
    const isMe = owner === 'me';
    const deckCount = sharedGame ? shared.deck.length : (player.deck || []).length;
    const name = isMe
      ? (state.coop ? `Survivors (Player ${state.coopSeat} acting)` : 'You')
      : (bossMode ? 'Boss' : hordeMode ? 'The Horde' : 'Opponent');
    // Life is adjustable wherever a human holds the seat.
    const humanSeat = isMe || !state.vsAI;
    const step = (id, sign, title) =>
      `<button id="${id}" class="life-step" title="${title}">${sign}</button>`;
    const life = `
      ${humanSeat ? step(isMe ? 'minusLP' : 'oppMinusLP', '−', 'Lose 1 life') : ''}
      <span class="stat-life">${htmlEscape(name)} - LP: ${player.health}</span>
      ${humanSeat ? step(isMe ? 'plusLP' : 'oppPlusLP', '+', 'Gain 1 life') : ''}`;
    const handTile = `<div class="stat-tile"><span class="zone-title">Hand</span><span class="stat-count">${player.hand.length}</span></div>`;
    const piles = [
      commanderZoneOn
        ? pileBox(isMe ? 'viewCommander' : 'viewOppCommander', commandMeta.shortLabel,
            (player.commanderZone || []).length, true, isMe ? 'commanderZone' : '')
        : '',
      // The opponent's library is hidden information: count only, no click.
      pileBox(isMe ? 'viewDeck' : '', sharedGame ? shared.label : 'Library',
        deckCount, isMe || sharedGame, isMe ? 'deck' : ''),
      handTile,
      pileBox(isMe ? 'viewGY' : 'viewOppGY', 'Graveyard',
        (player.graveyard || []).length, true, isMe ? 'graveyard' : ''),
      pileBox(isMe ? 'viewExile' : 'viewOppExile', 'Exile',
        (player.exile || []).length, true, isMe ? 'exile' : '')
    ].filter(Boolean).join('');
    const notes = [
      (!isMe && sharedGame) ? `<span class="stat-note">${htmlEscape(shared.label)} center stack, top-to-bottom draw</span>` : '',
      (!isMe && landGameMode) ? `<span class="stat-note">Opponent lands: ${formatLandGameProgress(opp)}</span>` : '',
      (!isMe && hordeMode) ? `<span class="stat-note">Horde field: ${battlefieldCards(hordePlayer).length}</span>` : '',
      (isMe && landGameMode) ? `<span class="stat-note">Goal: control all five basic land names, or five copies of one basic. Your lands: ${formatLandGameProgress(me)}</span>` : ''
    ].filter(Boolean).join('');
    return `
      <div class="stat-strip ${isMe ? 'you' : 'opponent'}">
        <div class="stat-life-group">${life}</div>
        <div class="stat-tiles">${piles}</div>
        ${notes ? `<div class="stat-notes">${notes}</div>` : ''}
      </div>`;
  };

  // Each half is one open canvas plus that player's stat strip.
  const opponentHalf = `<div class="battle-half opponent">${statStrip(opp, 'opp')}${canvasBox(opp, 'opp')}</div>`;
  const myHalf = `<div class="battle-half you">${canvasBox(me, 'me')}${statStrip(me, 'me')}</div>`;

  const layout = boardLayout();
  const PHASE_HINTS = {
    Draw: 'Untap and draw for the turn',
    Main: 'Play lands and cast spells',
    Combat: 'Declare attackers, then blockers',
    'Second Main': 'Cast what you held back',
    End: 'Finish up, then pass the turn'
  };
  const phaseNow = state.gameState.phase || 'Main';
  const turnLabel = state.aiActing ? 'Bot is playing'
    : state.activePlayer === state.currentPlayer ? 'Your turn'
    : state.vsAI ? "Bot's turn" : "Opponent's turn";

  // Group runs of consecutive bot entries so one bot turn reads as one line.
  const logRows = (() => {
    const entries = (state.gameLog || []).slice(0, 24);
    const isBot = (e) => /^(AI |Bot |The Horde )/.test(e.message || '');
    const rows = [];
    for (const entry of entries) {
      const last = rows[rows.length - 1];
      if (isBot(entry) && last && last.bot) { last.lines.push(entry.message); continue; }
      rows.push({ bot: isBot(entry), lines: [entry.message] });
    }
    return rows.slice(0, 14);
  })();

  div.innerHTML = `
    <div class="battle-shell" style="--sidebar-w:${layout.sidebarPx}px;--opp-pct:${layout.oppPct}%">
      <div class="battle-main">
        <div class="battle-topbar">
          <button id="exitBtn" class="btn btn-secondary text-xs">Exit</button>
          <div class="text-center battle-turn-panel">
            <div class="battle-mode-line">
              <span class="mode-family">${htmlEscape(mode.title)}</span>
              <span class="badge">${state.onlineMode ? 'Online' : state.vsAI ? 'vs AI' : 'Local'}</span>
              ${state.coop ? `<span class="badge">Co-op, survivor ${state.coopSeat}</span>` : ''}
              ${sharedGame ? `<span class="badge">${htmlEscape(shared.label)}</span>` : ''}
              <span class="badge">Turn ${state.turnCount || 1}</span>
              <span class="turn-pill ${state.activePlayer === state.currentPlayer ? 'yours' : 'theirs'}">${turnLabel}</span>
            </div>
            <div class="phase-bar">
              ${TURN_PHASES.map(phase => `<button class="phaseBtn ${phaseNow === phase ? 'is-active' : ''}" data-phase="${phase}">${phase}</button>`).join('')}
              <button id="nextPhase" class="phase-next" title="Advance to the next phase">Next phase</button>
            </div>
            <div class="phase-hint">${htmlEscape(PHASE_HINTS[phaseNow] || '')}</div>
          </div>
          <div class="battle-topbar-right">
            <button id="endTurn" class="btn ${state.activePlayer === state.currentPlayer ? 'btn-primary end-turn-ready' : 'btn-secondary'}">End turn</button>
            <button id="toggleShortcuts" class="btn btn-secondary text-xs" aria-expanded="${state.showShortcuts ? 'true' : 'false'}">Keys</button>
          </div>
        </div>
        ${state.showShortcuts ? `<div class="shortcut-legend">Space ends the turn. A opens the attack picker. D draws. Double-click a hand card to play it. Right-click a card you control for its menu.</div>` : ''}
        <div class="battle-board">
          ${opponentHalf}
          <div class="field-divider" id="fieldDivider" role="separator" aria-orientation="horizontal" title="Drag to resize. Double-click to reset."></div>
          ${myHalf}
        </div>
        <div class="battle-tools">
          <div class="battle-toolbar">
            <button id="drawBtn" class="btn btn-secondary text-xs">Draw (${myDeckCount})</button>
            <button id="upkeepBtn" class="btn btn-secondary text-xs">Upkeep</button>
            <button id="undoAction" class="btn btn-secondary text-xs" ${(state.gameHistory || []).length ? '' : 'disabled'}>Undo</button>
            ${state.vsAI ? '<button id="declareAttack" class="btn btn-red text-xs">Attack</button>' : ''}
            <button id="tidyField" class="btn btn-secondary text-xs" title="Arrange your battlefield into tidy rows">Tidy</button>
            <button id="saveReplay" class="btn btn-secondary text-xs" title="Save this game as a replay file">Replay</button>
            <button id="createToken" class="btn btn-secondary text-xs">Create token</button>
            ${sharedGame ? `<button id="revealSharedTop" class="btn btn-secondary text-xs">Reveal top</button><button id="burnSharedTop" class="btn btn-red text-xs">Burn top</button><button id="shuffleSharedStack" class="btn btn-secondary text-xs">Shuffle stack</button><button id="viewSharedGY" class="btn btn-secondary text-xs">Shared GY (${shared.graveyard.length})</button>` : ''}
            ${hordeMode && state.currentPlayer === 1 ? '<button id="hordeReveal" class="btn btn-secondary text-xs">Horde reveal</button><button id="hordeAttack" class="btn btn-red text-xs">Horde attack</button>' : ''}
            <button id="mulliganBtn" class="btn btn-secondary text-xs" ${rules.noMulligan ? 'disabled' : ''}>Mulligan</button>
            ${state.coop ? '<button id="passSeat" class="btn btn-secondary text-xs">Pass to teammate</button>' : ''}
            <label class="text-xs text-gray hand-zoom-label">
              Hand size
              <input id="handZoom" type="range" min="0.7" max="1.8" step="0.1" value="${state.handZoom || 1}">
            </label>
            <button id="toggleHand" class="btn btn-secondary text-xs">${state.handCollapsed ? 'Show hand' : 'Hide hand'}</button>
            <span class="drop-zone-row" aria-label="Quick card zones">
              <span id="handDrop" class="drop-zone" data-drop-target="hand">Hand</span>
              <span id="graveyardDrop" class="drop-zone" data-drop-target="graveyard">Graveyard</span>
              <span id="exileDrop" class="drop-zone" data-drop-target="exile">Exile</span>
              <span id="deckDrop" class="drop-zone" data-drop-target="deck">Deck bottom</span>
            </span>
          </div>
        </div>
        <div id="handContainer" class="battle-hand${state.handCollapsed ? ' collapsed' : ''}" data-drop-target="hand"></div>
      </div>
      <div class="sidebar-divider" id="sidebarDivider" role="separator" aria-orientation="vertical" title="Drag to resize. Double-click to reset."></div>
      <div class="sidebar battle-sidebar">
        <h3 class="text-sm font-bold mb-2 text-center">Stack</h3>
        <div id="stackPanel" class="card p-3 mb-4 battle-side-card" data-drop-target="stack">
          ${gameStack.length ? (() => {
            const top = gameStack[gameStack.length - 1];
            return `
              <div class="text-xs text-gray mb-2">Top of stack</div>
              <div style="font-weight:800;font-size:13px">${htmlEscape(top.card?.name || 'Spell')}</div>
              <div class="text-xs text-gray mt-1">Player ${top.owner} • ${htmlEscape(top.card?.type || '')}</div>
              <div class="flex mt-3" style="gap:6px;flex-wrap:wrap">
                <button id="resolveStackTop" class="btn btn-green text-xs">Resolve Top</button>
                <button id="counterStackTop" class="btn btn-red text-xs">Counter Top</button>
              </div>
              ${gameStack.length > 1 ? `<div class="text-xs text-gray mt-2">${gameStack.length - 1} below</div>` : ''}
            `;
          })() : '<div class="text-xs text-gray text-center">Stack empty</div>'}
        </div>
        <h3 class="text-sm font-bold mb-2 text-center">Card Info</h3>
        <div id="cardInfo">
          <p class="text-gray text-xs text-center" style="padding: 20px;">Hover over a card</p>
        </div>
        <div class="mt-4" style="border-top:1px solid rgba(255,255,255,.12);padding-top:12px">
          <h3 class="text-sm font-bold mb-2 text-center">Action Log</h3>
          <div id="actionLog" class="battle-action-log">
            ${logRows.map(row => `
              <div class="log-row${row.bot ? ' bot' : ''}">
                ${row.lines.map(m => `<div class="text-xs text-gray">${htmlEscape(m)}</div>`).join('')}
              </div>
            `).join('') || '<div class="text-xs text-gray text-center">No actions yet.</div>'}
          </div>
        </div>
      </div>
    </div>
    ${state.showTurnNotification ? `<div class="turn-banner">Your turn</div>` : ''}
    ${state.actionMessage ? `<div class="turn-banner action">${htmlEscape(state.actionMessage)}</div>` : ''}
    ${state.creatingToken ? `
      <div class="modal">
        <div class="modal-content" style="max-width: 400px;">
          <h3 class="mb-4" style="font-weight: bold; font-size: 18px; text-align: center;">Create token</h3>
          <div class="mb-4">
            <label>Token Name</label>
            <input id="tokenName" class="input" placeholder="Soldier Token" value="Token">
          </div>
          <div class="mb-4">
            <label>Token Type</label>
            <input id="tokenType" class="input" placeholder="Creature — Soldier" value="Creature Token">
          </div>
          <div class="grid grid-2 mb-4">
            <div>
              <label>Power</label>
              <input id="tokenPower" class="input" type="number" value="1">
            </div>
            <div>
              <label>Toughness</label>
              <input id="tokenToughness" class="input" type="number" value="1">
            </div>
          </div>
          <div class="mb-4">
            <label>Effect (Optional)</label>
            <textarea id="tokenEffect" class="input" rows="2" placeholder="Flying, Haste"></textarea>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="createTokenUpper" class="btn btn-primary">Create in Creatures</button>
            <button id="createTokenLower" class="btn btn-primary">Create in Artifacts</button>
          </div>
          <button id="cancelToken" class="btn btn-secondary mt-3" style="width: 100%;">Cancel</button>
        </div>
      </div>
    ` : ''}
    
    ${state.selectedFieldCard !== null ? (() => {
  const sel = me[state.selectedFieldCard.zone][state.selectedFieldCard.idx];
  return `
  <div style="position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%); background: #1f2937; border: 3px solid #8b5cf6; border-radius: 12px; padding: 20px; z-index: 9999; min-width: 360px; box-shadow: 0 8px 30px rgba(139, 92, 246, 0.5);">
    <div class="text-center mb-4" style="font-weight: bold; font-size: 18px; color: #a78bfa;">${sel.name}</div>
    ${landGameEffectPanelHtml(sel)}

    <!-- ACTION GRID: always two columns, evenly spaced -->
    <div class="action-grid" style="display:grid; grid-template-columns: repeat(2, minmax(160px, 1fr)); gap: 12px; align-items: stretch;">
      <button id="tapCard" class="btn ${sel.tapped ? 'btn-green' : 'btn-blue'} text-sm" style="padding: 14px; width:100%; text-align:center;">${sel.tapped ? 'Untap' : 'Tap'}</button>
      <button id="toHand" class="btn btn-secondary text-sm" style="padding: 14px; width:100%; text-align:center;">To hand</button>

      <button id="toGraveyard" class="btn btn-red text-sm" style="padding: 14px; width:100%; text-align:center;">To graveyard</button>
      <button id="toExile" class="btn btn-red text-sm" style="padding: 14px; width:100%; text-align:center;">To exile</button>

      <button id="plusCounter" class="btn btn-green text-sm" style="padding: 14px; width:100%; text-align:center;">+1/+1 counter</button>
      <button id="minusCounter" class="btn btn-red text-sm" style="padding: 14px; width:100%; text-align:center;">-1/-1 counter</button>

      <!-- COUNTERS: spans full width so grid stays balanced; collapsed by default -->
      <details class="counter-panel" style="grid-column: 1 / -1; margin-top: 0;">
        <summary class="btn btn-secondary text-sm" style="display:block; width: 100%; padding: 14px; text-align:center;">
          More counters
        </summary>
        <div style="padding: 10px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; margin-top: 8px;">
          <div class="text-xs mb-1">P/T: <span id="ptNow"></span></div>
          <div class="flex mb-2">
            <button id="incP" class="btn btn-secondary text-xs">+P</button>
            <button id="decP" class="btn btn-secondary text-xs">-P</button>
            <button id="incT" class="btn btn-secondary text-xs">+T</button>
            <button id="decT" class="btn btn-secondary text-xs">-T</button>
          </div>

          <div class="text-xs mb-1">Stun: <span id="stunNow"></span></div>
          <div class="flex">
            <button id="incS" class="btn btn-secondary text-xs">+S</button>
            <button id="decS" class="btn btn-secondary text-xs">-S</button>
          </div>
        </div>
      </details>

      <button id="toTopDeck" class="btn btn-secondary text-sm" style="padding: 14px; width:100%;">To top of library</button>
      <button id="toBottomDeck" class="btn btn-secondary text-sm" style="padding: 14px; width:100%;">To bottom of library</button>
      <button id="duplicateCard" class="btn btn-secondary text-sm" style="padding: 14px; width:100%;">Duplicate as token</button>
      ${commanderZoneOn ? `<button id="fieldToCommand" class="btn btn-secondary text-sm" style="padding: 14px; width:100%;">To ${htmlEscape(commandMeta.label)}</button>` : ''}
    </div>

    <button id="cancelFieldSelect" class="btn btn-secondary text-sm mt-3" style="width: 100%; padding: 14px;">Close</button>
  </div>`;
})() : ''}

    
    
    
    
    
    
    
    ${state.viewingZone ? `
      <div class="modal">
        <div class="modal-content" style="max-width: 700px;">
          <div class="flex justify-between mb-4">
            <h3 style="font-weight: bold; font-size: 18px;">${state.viewingZone.title}</h3>
            <button id="closeZone" class="btn btn-secondary text-xs">Close</button>
          </div>
          ${state.viewingZone.owner === 'me' && state.selectedZoneCard !== null && state.viewingZone.cards[state.selectedZoneCard] ? `
            <div style="background: #374151; border: 2px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div class="text-center mb-3" style="font-weight: bold; color: #fbbf24;">${state.viewingZone.cards[state.selectedZoneCard].name}</div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                <button id="zoneToHand" class="btn btn-primary text-xs">To hand</button>
                <button id="zoneToUpper" class="btn btn-primary text-xs">To creatures</button>
                <button id="zoneToLower" class="btn btn-primary text-xs">To support</button>
                ${state.viewingZone.zone !== 'deck' ? '<button id="zoneToDeck" class="btn btn-secondary text-sm">To deck</button>' : ''}
                ${commanderZoneOn && state.viewingZone.zone !== 'commanderZone' ? `<button id="zoneToCommand" class="btn btn-secondary text-xs">${htmlEscape(commandMeta.shortLabel)}</button>` : ''}
                ${state.viewingZone.zone === 'graveyard' ? '<button id="zoneToExile" class="btn btn-red text-xs">Exile</button>' : ''}
                ${state.viewingZone.zone === 'exile' ? '<button id="zoneToGY" class="btn btn-red text-xs">To graveyard</button>' : ''}
                <button id="cancelZoneSelect" class="btn btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          ` : ''}
          <div id="zoneCards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; max-height: 60vh; overflow-y: auto;">
            ${state.viewingZone.cards.length === 0 ? '<p class="text-gray text-center p-4">Empty</p>' : ''}
          </div>
        </div>
      </div>
    ` : ''}
    ${state.selectedCard !== null && me.hand[state.selectedCard] ? `
      <div style="position: fixed; bottom: 140px; left: 50%; transform: translateX(-50%); background: #1f2937; border: 3px solid #3b82f6; border-radius: 12px; padding: 20px; z-index: 9999; min-width: 340px; box-shadow: 0 8px 30px rgba(59, 130, 246, 0.5);">
        <div class="text-center mb-4" style="font-weight: bold; font-size: 18px; color: #60a5fa;">${me.hand[state.selectedCard].name}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${(() => {
            const card = me.hand[state.selectedCard];
            const suggested = defaultZoneForCard(card);
            // The suggested zone leads; the others stay available for odd cases.
            return [suggested, ...BATTLE_ZONE_KEYS.filter(k => k !== suggested)]
              .map((k, i) => `<button class="placeCard btn ${i === 0 ? 'btn-primary' : 'btn-secondary'} text-sm" data-zone="${k}" style="padding:14px${i === 0 ? ';grid-column:1 / -1' : ''}">${i === 0 ? '▶ Play to ' : ''}${htmlEscape(battleZoneLabel(k))}</button>`)
              .join('');
          })()}
          <button id="castToStack" class="btn btn-blue text-sm" style="padding: 14px; grid-column:1 / -1;">Cast to Stack</button>
          <button id="discardCard" class="btn btn-red text-sm" style="padding: 14px;">Discard</button>
          <button id="toDeck" class="btn btn-green text-sm" style="padding: 14px;">To deck</button>
          ${commanderZoneOn ? `<button id="toCommand" class="btn btn-secondary text-sm" style="padding: 14px; grid-column:1 / -1;">To ${htmlEscape(commandMeta.label)}</button>` : ''}
        </div>
        <button id="cancelSelect" class="btn btn-secondary text-sm mt-4" style="width: 100%; padding: 14px;">Cancel</button>
      </div>
    ` : ''}
    ${state.replayMode ? (() => {
      const frames = (state.replayData && state.replayData.frames) || [];
      const f = frames[state.replayIndex] || {};
      return `
      <div class="replay-bar">
        <div class="flex" style="gap:10px;align-items:center;flex-wrap:wrap">
          <span class="badge">▶ Replay</span>
          <button id="replayFirst" class="btn btn-secondary text-xs">⏮</button>
          <button id="replayPrev" class="btn btn-secondary text-xs">◀ Prev</button>
          <button id="replayPlay" class="btn btn-primary text-xs">${state.replayPlaying ? '⏸ Pause' : '▶ Play'}</button>
          <button id="replayNext" class="btn btn-secondary text-xs">Next ▶</button>
          <button id="replayLast" class="btn btn-secondary text-xs">⏭</button>
          <input id="replayScrub" type="range" min="0" max="${Math.max(0, frames.length - 1)}"
                 value="${state.replayIndex}" style="flex:1;min-width:180px">
          <span class="text-xs text-gray">${state.replayIndex + 1} / ${frames.length}</span>
          <button id="replayExit" class="btn btn-red text-xs">Close</button>
        </div>
        <div class="text-xs text-gray mt-2">${htmlEscape(f.message || f.actionType || '')}</div>
      </div>`;
    })() : ''}
    ${targetingModalHtml()}
    ${attackModalHtml()}
    ${aiBlockersModalHtml()}
    ${state.winner ? (() => {
      const outcome = state.winner === 'draw' ? 'Draw'
        : state.winner === state.currentPlayer ? 'You win' : 'You lose';
      const detail = state.winner === 'draw'
        ? 'Both players hit 0 life at the same time.'
        : `Player ${state.winner} took the game.`;
      return `
      <div class="modal">
        <div class="modal-content text-center" style="max-width:460px">
          <h2 class="mb-2" style="font-size:28px;font-weight:800">${outcome}</h2>
          <div class="text-xs text-gray mb-2">${htmlEscape(mode.title)} · Turn ${state.turnCount || 1}</div>
          <p class="text-gray mb-4">${detail}</p>
          <div class="flex" style="gap:10px;justify-content:center;flex-wrap:wrap">
            ${state.replayMode ? '' : '<button id="saveReplayEnd" class="btn btn-secondary">Save replay</button>'}
            <button id="rematchBtn" class="btn btn-primary">Rematch</button>
            <button id="returnBtn" class="btn btn-secondary">Menu</button>
          </div>
        </div>
      </div>`;
    })() : ''}
  `;
  
  if (state.replayMode) {
    const frames = (state.replayData && state.replayData.frames) || [];
    const go = (i) => { stopReplayPlayback(); showReplayFrame(i); };
    div.querySelector('#replayFirst').onclick = () => go(0);
    div.querySelector('#replayPrev').onclick = () => go(state.replayIndex - 1);
    div.querySelector('#replayNext').onclick = () => go(state.replayIndex + 1);
    div.querySelector('#replayLast').onclick = () => go(frames.length - 1);
    div.querySelector('#replayExit').onclick = () => { stopReplayPlayback(); exitReplay(); };
    const scrub = div.querySelector('#replayScrub');
    if (scrub) scrub.oninput = () => go(parseInt(scrub.value, 10) || 0);
    div.querySelector('#replayPlay').onclick = () => {
      if (state.replayPlaying) { stopReplayPlayback(); render(); return; }
      state.replayPlaying = setInterval(() => {
        if (state.replayIndex >= frames.length - 1) { stopReplayPlayback(); render(); return; }
        showReplayFrame(state.replayIndex + 1);
      }, 1100);
      render();
    };
    // Nothing on the board itself is interactive while watching.
    const shell = div.querySelector('.battle-board');
    if (shell) shell.style.pointerEvents = 'none';
  }

  const handContainer = div.querySelector('#handContainer');
  if (handContainer) handContainer.style.setProperty('--hand-zoom', String(state.handZoom || 1));
  const handZoomInput = div.querySelector('#handZoom');
  if (handZoomInput) handZoomInput.oninput = () => {
    state.handZoom = parseFloat(handZoomInput.value) || 1;
    // Apply live without a re-render so the slider keeps its grab.
    if (handContainer) handContainer.style.setProperty('--hand-zoom', String(state.handZoom));
    scheduleSave();
  };

  div.querySelectorAll('[data-drop-target]').forEach(dropTarget => {
    dropTarget.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropTarget.classList.add('drag-over');
    });
    dropTarget.addEventListener('dragleave', (event) => {
      if (!event.relatedTarget || !dropTarget.contains(event.relatedTarget)) {
        dropTarget.classList.remove('drag-over');
      }
    });
    dropTarget.addEventListener('drop', (event) => {
      event.preventDefault();
      dropTarget.classList.remove('drag-over');
      const payload = readCardDragData(event);
      const target = dropTarget.dataset.dropTarget;
      if (target === 'canvas') {
        // Where on the battlefield did it land? Store as percentages so the
        // layout survives resizing and travels intact over the network.
        const box = dropTarget.getBoundingClientRect();
        const pos = {
          x: Math.max(0, Math.min(92, ((event.clientX - box.left - 34) / box.width) * 100)),
          y: Math.max(0, Math.min(88, ((event.clientY - box.top - 24) / box.height) * 100))
        };
        dropOntoCanvas(payload, pos);
        return;
      }
      moveDraggedCard(payload, target);
    });
  });
  
  
  if (me.hand.length === 0) {
    const emptyMsg = document.createElement('span');
    emptyMsg.className = 'text-gray text-xs';
    emptyMsg.textContent = 'No cards in hand. Press Draw.';
    handContainer.appendChild(emptyMsg);
  } else {
    me.hand.forEach((card, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card' + (state.selectedCard === idx ? ' selected' : '');
      cardDiv.draggable = true;
      cardDiv.addEventListener('dragstart', (event) => {
        cardDiv.classList.add('dragging');
        setCardDragData(event, 'hand', idx);
      });
      cardDiv.addEventListener('dragend', () => {
        cardDiv.classList.remove('dragging');
      });
      cardDiv.appendChild(createGameCardImg(card));
      
      cardDiv.onclick = () => {
        state.selectedCard = state.selectedCard === idx ? null : idx;
        state.selectedFieldCard = null;
        render();
      };

      // Double-click: play straight to the card's natural zone. The click
      // handler fires first, but the action's re-render supersedes it.
      cardDiv.title = 'Click for options · double-click to play';
      cardDiv.ondblclick = () => {
        const zone = defaultZoneForCard(card);
        if (!payStrictCost(card)) return;
        executeGameAction('hand_to_field', { cardName: card.name, zone }, () => {
          const cardToPlace = initBattleCard({ ...card, tapped: false });
          me[zone].push(cardToPlace);
          me.hand.splice(idx, 1);
          state.selectedCard = null;
          state.selectedFieldCard = null;
          fireEnterTrigger(cardToPlace, me);
          checkLandGameVictory();
        }, `Played ${card.name} to ${battleZoneLabel(zone)}.`);
      };
      
      cardDiv.onmouseenter = () => {
        showCardInfo(card);
      };
      
      handContainer.appendChild(cardDiv);
    });
  }
  
  div.querySelectorAll('.field-card').forEach(fieldCard => {
    const zone = fieldCard.dataset.zone;
    const owner = fieldCard.dataset.owner;
    const idx = parseInt(fieldCard.dataset.idx);
    const card = owner === 'me' ? me[zone][idx] : opp[zone][idx];
    
    if (card) {
      const img = createGameCardImg(card);
      img.style.pointerEvents = 'none'; // Critical: let parent handle events
      fieldCard.appendChild(img);
      
      
      // P/T delta badge (e.g., +1/0, 0/+1, -1/-1)
if (!card.pt) card.pt = { p: 0, t: 0 };
if (card.pt.p !== 0 || card.pt.t !== 0) {
  const badge = document.createElement('div');
  badge.className = 'counter-badge';
  const s = (n) => (n >= 0 ? '+' + n : String(n));
  badge.textContent = `${s(card.pt.p)}/${s(card.pt.t)}`;
  fieldCard.appendChild(badge);
}

// Stun badge (e.g., S2)
if (card.stun && card.stun > 0) {
  const sBadge = document.createElement('div');
  sBadge.className = 'stun-badge';
  sBadge.textContent = 'S' + card.stun;
  fieldCard.appendChild(sBadge);
}
      
      
      // Hover handler - works for ALL cards (yours and opponent's)
      fieldCard.addEventListener('mouseenter', (e) => {
        showCardInfo(card);
      });
      
      fieldCard.addEventListener('mouseleave', (e) => {
        // Optional: clear card info when mouse leaves
      });
      
      // Click handler - only for YOUR cards
      if (owner === 'me') {
        fieldCard.draggable = true;
        fieldCard.addEventListener('dragstart', (event) => {
          fieldCard.classList.add('dragging');
          setCardDragData(event, zone, idx);
        });
        fieldCard.addEventListener('dragend', () => {
          fieldCard.classList.remove('dragging');
        });
        // Right-click opens the same per-card menu as a left click.
        fieldCard.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.selectedCard = null;
          state.selectedFieldCard = { zone, idx, owner };
          render();
        });
        fieldCard.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          state.selectedCard = null;
          if (state.selectedFieldCard && state.selectedFieldCard.zone === zone && state.selectedFieldCard.idx === idx) {
            state.selectedFieldCard = null;
          } else {
            state.selectedFieldCard = { zone, idx, owner };
          }
          render();
        });
        
        // Double-click handler to tap/untap (only for your cards)
        fieldCard.addEventListener('dblclick', () => {
          const wasTapped = !!card.tapped;
          executeGameAction('toggle_tap', { cardName: card.name }, () => {
            let removedStun = false;
            if (card.tapped) {
              if (typeof card.stun === 'number' && card.stun > 0) {
                card.stun -= 1;
                removedStun = true;
              } else {
                card.tapped = false;
              }
            } else {
              card.tapped = true;
            }
            state.selectedFieldCard = null;
            return { removedStun };
          }, ({ removedStun }) => removedStun ? `Removed a stun counter from ${card.name}.` : `${wasTapped ? 'Untapped' : 'Tapped'} ${card.name}.`, { ms: 1200 });
        });
        
      }
    }
  });
  
  const exitBtn = div.querySelector('#exitBtn');
  const drawBtn = div.querySelector('#drawBtn');
  const upkeepBtn = div.querySelector('#upkeepBtn');
  const createTokenBtn = div.querySelector('#createToken');
  const undoActionBtn = div.querySelector('#undoAction');
  const gyBtn = div.querySelector('#viewGY');
  const minusBtn = div.querySelector('#minusLP');
  const plusBtn = div.querySelector('#plusLP');
  const endBtn = div.querySelector('#endTurn');
  const viewDeckBtn = div.querySelector('#viewDeck');
  const mulliganBtn = div.querySelector('#mulliganBtn');
  div.querySelectorAll('.phaseBtn').forEach(btn => {
    btn.onclick = () => setTurnPhase(btn.dataset.phase);
  });
  const nextPhaseBtn = div.querySelector('#nextPhase');
  if (nextPhaseBtn) nextPhaseBtn.onclick = advanceTurnPhase;

  const shortcutsBtn = div.querySelector('#toggleShortcuts');
  if (shortcutsBtn) shortcutsBtn.onclick = () => { state.showShortcuts = !state.showShortcuts; render(); };
  const handToggleBtn = div.querySelector('#toggleHand');
  if (handToggleBtn) handToggleBtn.onclick = () => { state.handCollapsed = !state.handCollapsed; render(); };

  // Opponent life, for seats a human holds.
  const oppMinus = div.querySelector('#oppMinusLP');
  const oppPlus = div.querySelector('#oppPlusLP');
  const adjustOppLife = (delta) => {
    executeGameAction('life_change', { player: state.currentPlayer === 1 ? 2 : 1, delta }, () => {
      opp.health = Math.max(0, opp.health + delta);
      checkWinner();
      return opp.health;
    }, `Opponent ${delta > 0 ? 'gains' : 'loses'} ${Math.abs(delta)} life.`, { ms: 1200 });
  };
  if (oppMinus) oppMinus.onclick = () => adjustOppLife(-1);
  if (oppPlus) oppPlus.onclick = () => adjustOppLife(1);

  // --- Draggable dividers ------------------------------------------------
  // The shell carries the sizes as CSS variables, so a drag can update the
  // board live without a re-render tearing the pointer capture away.
  const shellEl = div.querySelector('.battle-shell');
  const boardEl = div.querySelector('.battle-board');
  const wireDivider = (el, opts) => {
    if (!el || !shellEl) return;
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      el.classList.add('dragging');
      const move = (ev) => shellEl.style.setProperty(opts.varName, opts.valueAt(ev));
      const up = () => {
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        saveBoardLayout(opts.read(shellEl));
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', () => {
      saveBoardLayout({ [opts.key]: LAYOUT_DEFAULTS[opts.key] });
      render();
    });
  };
  wireDivider(div.querySelector('#fieldDivider'), {
    key: 'oppPct',
    varName: '--opp-pct',
    valueAt: (ev) => {
      const box = boardEl.getBoundingClientRect();
      const pct = Math.min(70, Math.max(20, ((ev.clientY - box.top) / box.height) * 100));
      return pct.toFixed(2) + '%';
    },
    read: (shell) => ({ oppPct: parseFloat(shell.style.getPropertyValue('--opp-pct')) || LAYOUT_DEFAULTS.oppPct })
  });
  wireDivider(div.querySelector('#sidebarDivider'), {
    key: 'sidebarPx',
    varName: '--sidebar-w',
    valueAt: (ev) => {
      const box = shellEl.getBoundingClientRect();
      const px = Math.min(520, Math.max(220, box.right - ev.clientX));
      return Math.round(px) + 'px';
    },
    read: (shell) => ({ sidebarPx: parseFloat(shell.style.getPropertyValue('--sidebar-w')) || LAYOUT_DEFAULTS.sidebarPx })
  });
  const resolveStackTopBtn = div.querySelector('#resolveStackTop');
  if (resolveStackTopBtn) resolveStackTopBtn.onclick = resolveTopStack;
  const counterStackTopBtn = div.querySelector('#counterStackTop');
  if (counterStackTopBtn) counterStackTopBtn.onclick = counterTopStack;
  
  
  if (exitBtn) exitBtn.onclick = () => {
    if (confirm('Exit game? Progress will be lost.')) {
      if (state.onlineMode) disconnectOnline();
      state.screen = 'menu';
      state.gameStarted = false;
      state.winner = null;
      state.selectedCard = null;
      state.selectedFieldCard = null;
      state.selectedZoneCard = null;
      state.viewingZone = null;
      state.targeting = null;
      render();
    }
  };
  
  
  if (drawBtn) drawBtn.onclick = () => {
    const drawPile = sharedGame ? shared.deck : me.deck;
    if (drawPile.length > 0) {
      executeGameAction('draw_card', { source: sharedGame ? shared.label : 'deck' }, () => {
        const card = drawPile.shift();
        initBattleCard(card);
        me.hand.push(card);
        return card;
      }, `Player ${state.currentPlayer} drew ${sharedGame ? `from ${shared.label}` : 'a card'}.`, { ms: 900 });
    }
  };


  // Upkeep button - untap all your cards
  if (upkeepBtn) upkeepBtn.onclick = () => {
    executeGameAction('upkeep', { player: state.currentPlayer }, () => {
      let untapped = 0;
      let stunRemoved = 0;
      battlefieldCards(me).forEach(card => {
        if (!card.tapped) return;
        if (typeof card.stun === 'number' && card.stun > 0) {
          card.stun -= 1;
          stunRemoved += 1;
        } else {
          card.tapped = false;
          untapped += 1;
        }
      });
      return { untapped, stunRemoved };
    }, ({ untapped, stunRemoved }) => {
      const stunText = stunRemoved ? `, removed ${stunRemoved} stun counter${stunRemoved === 1 ? '' : 's'}` : '';
      return `Upkeep: untapped ${untapped} card${untapped === 1 ? '' : 's'}${stunText}.`;
    }, { ms: 1200 });
  };
  
  if (createTokenBtn) createTokenBtn.onclick = () => {
    state.creatingToken = true;
    render();
  };

  if (undoActionBtn) undoActionBtn.onclick = undoLastGameAction;
  
  if (gyBtn) gyBtn.onclick = () => { 
    state.viewingZone = { title: 'Your graveyard', cards: me.graveyard, zone: 'graveyard', owner: 'me' };
    state.selectedZoneCard = null;
    render();
  };
  
  const viewExileBtn = div.querySelector('#viewExile');
  if (viewExileBtn) viewExileBtn.onclick = () => {
    state.viewingZone = { title: 'Your exile', cards: me.exile, zone: 'exile', owner: 'me' };
    state.selectedZoneCard = null;
    render();
  };
  
  const viewOppGYBtn = div.querySelector('#viewOppGY');
  if (viewOppGYBtn) viewOppGYBtn.onclick = () => {
    state.viewingZone = { title: "Opponent's graveyard", cards: opp.graveyard, zone: 'graveyard', owner: 'opp' };
    state.selectedZoneCard = null;
    render();
  };
  
  const viewOppExileBtn = div.querySelector('#viewOppExile');
  if (viewOppExileBtn) viewOppExileBtn.onclick = () => {
    state.viewingZone = { title: "Opponent's exile", cards: opp.exile, zone: 'exile', owner: 'opp' };
    state.selectedZoneCard = null;
    render();
  };
  
      if (mulliganBtn) mulliganBtn.onclick = () => {
  if (rules.noMulligan) { toast('This mode has no mulligans.'); return; }
  const n = me.hand.length;
  if (n === 0) { toast('No cards in hand to mulligan.'); return; }
  const targetDeck = sharedGame ? shared.deck : me.deck;
  executeGameAction('mulligan', { player: state.currentPlayer, count: n, shared: sharedGame }, () => {
    targetDeck.push(...me.hand);
    me.hand.length = 0;
    // Proper mulligan: shuffle, then draw one fewer than you put back.
    const shuffled = shuffleCopy(targetDeck.splice(0));
    targetDeck.push(...shuffled);
    for (let i = 0; i < n - 1 && targetDeck.length; i++) {
      me.hand.push(initBattleCard(targetDeck.shift()));
    }
  }, `Mulligan: drew a fresh hand of ${Math.max(0, n - 1)}.`);
};
  
  if (viewDeckBtn) viewDeckBtn.onclick = () => {
  state.viewingZone = sharedGame
    ? { title: `${shared.label} (top to bottom)`, cards: shared.deck, zone: 'deck', owner: 'me', shared: true }
    : { title: 'Your library (top to bottom)', cards: me.deck, zone: 'deck', owner: 'me' };
  state.selectedZoneCard = null;
  render();
};

  const viewOppCommanderBtn = div.querySelector('#viewOppCommander');
  if (viewOppCommanderBtn) viewOppCommanderBtn.onclick = () => {
    state.viewingZone = { title: `Opponent ${commandMeta.label}`, cards: opp.commanderZone, zone: 'commanderZone', owner: 'opp' };
    state.selectedZoneCard = null;
    render();
  };

  const viewCommanderBtn = div.querySelector('#viewCommander');
  if (viewCommanderBtn) viewCommanderBtn.onclick = () => {
    state.viewingZone = { title: `${commandMeta.label}`, cards: me.commanderZone, zone: 'commanderZone', owner: 'me' };
    state.selectedZoneCard = null;
    render();
  };

  const tidyBtn = div.querySelector('#tidyField');
  if (tidyBtn) tidyBtn.onclick = tidyBattlefield;
  const saveReplayBtn = div.querySelector('#saveReplay');
  if (saveReplayBtn) saveReplayBtn.onclick = replayToFile;

  const passSeatBtn = div.querySelector('#passSeat');
  if (passSeatBtn) passSeatBtn.onclick = () => {
    state.coopSeat = state.coopSeat === 1 ? 2 : 1;
    state.selectedCard = null;
    state.selectedFieldCard = null;
    state.viewingZone = null;
    showAction(`Survivor ${state.coopSeat} takes over.`, 1600, true, 'coop_pass', { seat: state.coopSeat });
  };

  const hordeRevealBtn = div.querySelector('#hordeReveal');
  if (hordeRevealBtn) hordeRevealBtn.onclick = revealHorde;
  const hordeAttackBtn = div.querySelector('#hordeAttack');
  if (hordeAttackBtn) hordeAttackBtn.onclick = hordeAttack;

  const revealSharedTopBtn = div.querySelector('#revealSharedTop');
  if (revealSharedTopBtn) revealSharedTopBtn.onclick = () => {
    const top = shared.deck[0];
    showAction(top ? `${shared.label} top card: ${top.name}` : `${shared.label} is empty.`);
  };
  const burnSharedTopBtn = div.querySelector('#burnSharedTop');
  if (burnSharedTopBtn) burnSharedTopBtn.onclick = () => {
    if (!shared.deck.length) { showAction(`${shared.label} is empty.`); return; }
    executeGameAction('shared_burn', { source: shared.label }, () => {
      const card = shared.deck.shift();
      shared.graveyard.push(card);
      return card;
    }, (card) => `Burned ${card.name} from ${shared.label}.`);
  };
  const shuffleSharedStackBtn = div.querySelector('#shuffleSharedStack');
  if (shuffleSharedStackBtn) shuffleSharedStackBtn.onclick = () => {
    executeGameAction('shared_shuffle', { source: shared.label }, () => {
      shared.deck = shuffleCopy(shared.deck);
      state.gameState.shared = shared;
    }, `${shared.label} shuffled.`, { ms: 1200 });
  };
  const viewSharedGYBtn = div.querySelector('#viewSharedGY');
  if (viewSharedGYBtn) viewSharedGYBtn.onclick = () => {
    state.viewingZone = { title: `${shared.label} graveyard`, cards: shared.graveyard, zone: 'sharedGraveyard', owner: 'me', shared: true };
    state.selectedZoneCard = null;
    render();
  };

  const cancelTargetingBtn = div.querySelector('#cancelTargeting');
  if (cancelTargetingBtn) cancelTargetingBtn.onclick = () => {
    state.targeting = null;
    render();
  };
  div.querySelectorAll('.targetChoice').forEach(btn => {
    btn.onclick = () => completeLandGameTarget(parseInt(btn.dataset.i, 10));
  });

  // Human attack: choose attackers, then the bot blocks and damage resolves.
  const declareAttackBtn = div.querySelector('#declareAttack');
  if (declareAttackBtn) declareAttackBtn.onclick = () => {
    if (state.activePlayer !== state.currentPlayer) { toast('Wait for your turn to attack.'); return; }
    const ready = myReadyAttackers();
    if (!ready.length) { toast('No untapped creatures can attack.'); return; }
    state.declaringAttack = true;
    state.attackSelection = [];
    render();
  };
  div.querySelectorAll('.attackPick').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const sel = state.attackSelection || [];
      state.attackSelection = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
      render();
    };
  });
  const attackAllBtn = div.querySelector('#attackAll');
  if (attackAllBtn) attackAllBtn.onclick = () => {
    state.attackSelection = myReadyAttackers().map(c => String(c.gameId || c.id));
    render();
  };
  const cancelAttackBtn = div.querySelector('#cancelAttack');
  if (cancelAttackBtn) cancelAttackBtn.onclick = () => {
    state.declaringAttack = false;
    state.attackSelection = [];
    render();
  };
  const confirmAttackBtn = div.querySelector('#confirmAttack');
  if (confirmAttackBtn) confirmAttackBtn.onclick = () => {
    const ids = (state.attackSelection || []).slice();
    state.declaringAttack = false;
    state.attackSelection = [];
    if (window.GALDUR_AI) window.GALDUR_AI.playerAttack(ids);
  };

  // AI combat: collect blocker assignments and hand them back to the AI module.
  const aiResolveCombatBtn = div.querySelector('#aiResolveCombat');
  const aiNoBlocksBtn = div.querySelector('#aiNoBlocks');
  const collectAiBlocks = () => {
    const assignments = {};
    const usedBlockers = new Set();
    div.querySelectorAll('.aiBlockPick').forEach(sel => {
      const blockerId = sel.value;
      if (!blockerId || usedBlockers.has(blockerId)) return; // each creature blocks once
      usedBlockers.add(blockerId);
      assignments[sel.dataset.attacker] = blockerId;
    });
    return assignments;
  };
  if (aiResolveCombatBtn) aiResolveCombatBtn.onclick = () => {
    if (window.GALDUR_AI) window.GALDUR_AI.resolveAiCombat(collectAiBlocks());
  };
  if (aiNoBlocksBtn) aiNoBlocksBtn.onclick = () => {
    if (window.GALDUR_AI) window.GALDUR_AI.resolveAiCombat({});
  };
  
  if (minusBtn) minusBtn.onclick = () => {
    executeGameAction('life_change', { player: state.currentPlayer, delta: -1 }, () => {
      me.health = Math.max(0, me.health - 1);
      checkWinner();
      return me.health;
    }, `Player ${state.currentPlayer} loses 1 life.`, { ms: 1200 });
  };
  if (plusBtn) plusBtn.onclick = () => {
    executeGameAction('life_change', { player: state.currentPlayer, delta: 1 }, () => {
      me.health += 1;
      return me.health;
    }, `Player ${state.currentPlayer} gains 1 life.`, { ms: 1200 });
  };
  if (endBtn) endBtn.onclick = () => {
    const previousPlayer = state.activePlayer;
    const nextPlayer = state.activePlayer === 1 ? 2 : 1;
    executeGameAction('end_turn', { from: previousPlayer, to: nextPlayer }, () => {
      state.activePlayer = nextPlayer;
      state.selectedCard = null;
      state.selectedFieldCard = null;
      state.selectedZoneCard = null;
      state.landsPlayedThisTurn = 0;

      // Untap and draw for whoever is taking over, so a turn starts ready to
      // play instead of needing two manual clicks. The AI runs its own upkeep.
      const takingOver = state.gameState['player' + nextPlayer];
      let drewName = '';
      if (takingOver && !(state.vsAI && nextPlayer === 2)) {
        battlefieldCards(takingOver).forEach(c => {
          if (!c.tapped) return;
          if (typeof c.stun === 'number' && c.stun > 0) c.stun -= 1;
          else c.tapped = false;
        });
        const drawPile = sharedGame ? shared.deck : takingOver.deck;
        if (drawPile.length) {
          const card = initBattleCard(drawPile.shift());
          takingOver.hand.push(card);
          drewName = card.name;
        }
      }
      state.turnDrewName = drewName;

      state.turnCount = (state.turnCount || 1) + 1;
      if (state.activePlayer === state.currentPlayer) {
        state.showTurnNotification = true;
        setTimeout(() => {
          state.showTurnNotification = false;
          render();
        }, 1200);
      }
    }, () => {
      const who = seatLabel(nextPlayer);
      const drew = state.turnDrewName ? ` ${who} untap${who === 'You' ? '' : 's'} and draw${who === 'You' ? '' : 's'}.` : '';
      return `Turn passed to ${seatLabel(nextPlayer, { capital: false })}.${drew}`;
    }, { ms: 1200 });
  };
  
  // Token creation modal
  if (state.creatingToken) {
    const cancelTokenBtn = div.querySelector('#cancelToken');
    const createUpperBtn = div.querySelector('#createTokenUpper');
    const createLowerBtn = div.querySelector('#createTokenLower');
    
    if (cancelTokenBtn) cancelTokenBtn.onclick = () => {
      state.creatingToken = false;
      render();
    };
    
    const createToken = (field) => {
      const name = div.querySelector('#tokenName').value || 'Token';
      const type = div.querySelector('#tokenType').value || 'Creature Token';
      const power = div.querySelector('#tokenPower').value || '1';
      const toughness = div.querySelector('#tokenToughness').value || '1';
      const effect = div.querySelector('#tokenEffect').value || '';
      
      const token = {
        id: Date.now() + Math.random(),
        gameId: 'token-' + Date.now(),
        name: name,
        type: type,
        power: power,
        toughness: toughness,
        effect: effect,
        cost: '',
        colors: [],
        image: '',
        imageUrl: '',
        tapped: false,
        isToken: true,
        counters: 0
      };
      
      executeGameAction('create_token', { field, tokenName: token.name }, () => {
        me[field].push(token);
        state.creatingToken = false;
        return token;
      }, `Created ${token.name} in ${battleZoneLabel(field)}.`);
    };
    
    if (createUpperBtn) createUpperBtn.onclick = () => createToken('creatureField');
    if (createLowerBtn) createLowerBtn.onclick = () => createToken('supportField');
  }
  
  // Zone viewer
  if (state.viewingZone) {
    const closeZoneBtn = div.querySelector('#closeZone');
    if (closeZoneBtn) closeZoneBtn.onclick = () => {
      state.viewingZone = null;
      state.selectedZoneCard = null;
      render();
    };
    
    // Ensure a modal-scoped hover box exists so it won't be blurred
let zoneHover = div.querySelector('#zoneHoverBox');
if (!zoneHover) {
  zoneHover = document.createElement('div');
  zoneHover.id = 'zoneHoverBox';
  zoneHover.className = 'zone-hover';
  const modal = div.querySelector('.modal');
  if (modal) modal.appendChild(zoneHover);
}
    
    const zoneCardsDiv = div.querySelector('#zoneCards');
    
    
    if (zoneCardsDiv && state.viewingZone.cards.length > 0) {
      state.viewingZone.cards.forEach((card, idx) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'zone-card' + (state.selectedZoneCard === idx ? ' selected' : '');
        const img = createGameCardImg(card);
        img.style.pointerEvents = 'none';
        cardDiv.appendChild(img);
        
       cardDiv.onmousemove = (e) => {
  if (!zoneHover) return;
  zoneHover.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">${htmlEscape(card.name || '')}</div>
    <div class="text-xs text-gray" style="margin-bottom:6px">${htmlEscape(card.type || '')}</div>
    ${cardImageMarkup(card, { style: 'width:100%;border-radius:6px;margin-bottom:8px;display:block' })}
    <div style="font-size:12px;white-space:pre-wrap;line-height:1.3">
      ${htmlEscape(card.effect || '')}
    </div>
  `;
  placeHoverBox(zoneHover, e);
};
cardDiv.onmouseleave = () => { if (zoneHover) zoneHover.style.display = 'none'; };
 
        
        // Only allow interaction with own zones
        if (state.viewingZone.owner === 'me') {
          cardDiv.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.selectedZoneCard === idx) {
              state.selectedZoneCard = null;
            } else {
              state.selectedZoneCard = idx;
            }
            render();
          });
        }
        
        zoneCardsDiv.appendChild(cardDiv);
      });
    }
    
    // Zone card action handlers
    if (state.selectedZoneCard !== null && state.viewingZone.owner === 'me') {
      const card = state.viewingZone.cards[state.selectedZoneCard];
      const zoneKey = state.viewingZone.zone;
      const sourcePlayer = me;
      const sourceCards = state.viewingZone.cards;
      
      const toHandBtn = div.querySelector('#zoneToHand');
      const toUpperBtn = div.querySelector('#zoneToUpper');
      const toLowerBtn = div.querySelector('#zoneToLower');
      const toDeckBtn = div.querySelector('#zoneToDeck');
      const toCommandBtn = div.querySelector('#zoneToCommand');
      const toExileBtn = div.querySelector('#zoneToExile');
      const toGYBtn = div.querySelector('#zoneToGY');
      const cancelZoneBtn = div.querySelector('#cancelZoneSelect');
      const moveZoneCard = (target, label, placeCard, options = {}) => {
        if (!card) return;
        executeGameAction('zone_move', { cardName: card.name, from: zoneKey, to: target }, () => {
          const idx = state.selectedZoneCard;
          const moving = sourceCards[idx];
          if (!moving) return null;
          placeCard(moving);
          sourceCards.splice(idx, 1);
          state.selectedZoneCard = null;
          if (sourceCards.length === 0) {
            state.viewingZone = null;
          }
          if (options.checkVictory) checkLandGameVictory();
          return moving;
        }, (moving) => moving ? `Moved ${moving.name} to ${label}.` : '');
      };
      
if (toHandBtn) toHandBtn.onclick = () => {
  moveZoneCard('hand', 'hand', moving => sourcePlayer.hand.push(moving));
};

      
      if (toUpperBtn) toUpperBtn.onclick = () => {
        moveZoneCard('creatureField', 'Creatures', moving => {
          const cardToPlace = initBattleCard({ ...moving, tapped: false });
          sourcePlayer.creatureField.push(cardToPlace);
        }, { checkVictory: true });
      };
      
      if (toLowerBtn) toLowerBtn.onclick = () => {
        moveZoneCard('supportField', 'Artifacts & Enchantments', moving => {
          const cardToPlace = initBattleCard({ ...moving, tapped: false });
          sourcePlayer.supportField.push(cardToPlace);
        }, { checkVictory: true });
      };
      
      if (toDeckBtn) toDeckBtn.onclick = () => {
        const targetDeck = sharedGame ? shared.deck : sourcePlayer.deck;
        moveZoneCard('deck', sharedGame ? shared.label : 'deck', moving => targetDeck.push(moving));
      };

      if (toCommandBtn) toCommandBtn.onclick = () => {
        if (!canMoveToCommandZone(sourcePlayer)) return;
        moveZoneCard('commanderZone', commandMeta.label, moving => sourcePlayer.commanderZone.push(moving));
      };
      
      if (toExileBtn) toExileBtn.onclick = () => {
        moveZoneCard('exile', 'exile', moving => sourcePlayer.exile.push(moving));
      };
      
      if (toGYBtn) toGYBtn.onclick = () => {
        moveZoneCard('graveyard', 'graveyard', moving => sourcePlayer.graveyard.push(moving));
      };
      
      if (cancelZoneBtn) cancelZoneBtn.onclick = () => {
        state.selectedZoneCard = null;
        render();
      };
    }
  }
  
  // Field card actions
  if (state.selectedFieldCard) {
    const tapBtn = div.querySelector('#tapCard');
    const toHandBtn = div.querySelector('#toHand');
    const toGYBtn = div.querySelector('#toGraveyard');
    const toExileBtn = div.querySelector('#toExile');
    const toBottomDeckBtn = div.querySelector('#toBottomDeck');
    const toTopDeckBtn = div.querySelector('#toTopDeck');
    const duplicateBtn = div.querySelector('#duplicateCard');
    const plusCounterBtn = div.querySelector('#plusCounter');
    const minusCounterBtn = div.querySelector('#minusCounter');
    const fieldToCommandBtn = div.querySelector('#fieldToCommand');
    const cancelFieldBtn = div.querySelector('#cancelFieldSelect');
    const card = me[state.selectedFieldCard.zone][state.selectedFieldCard.idx];
    
    if (tapBtn) tapBtn.onclick = () => {
      const wasTapped = !!card.tapped;
      executeGameAction('toggle_tap', { cardName: card.name }, () => {
        let removedStun = false;
        if (card.tapped) {
          if (typeof card.stun === 'number' && card.stun > 0) {
            card.stun -= 1;
            removedStun = true;
          } else {
            card.tapped = false;
          }
        } else {
          card.tapped = true;
        }
        state.selectedFieldCard = null;
        return { removedStun };
      }, ({ removedStun }) => removedStun ? `Removed a stun counter from ${card.name}.` : `${wasTapped ? 'Untapped' : 'Tapped'} ${card.name}.`, { ms: 1200 });
    };
    
const incP = div.querySelector('#incP');
const decP = div.querySelector('#decP');
const incT = div.querySelector('#incT');
const decT = div.querySelector('#decT');
const incS = div.querySelector('#incS');
const decS = div.querySelector('#decS');
const resolveLandGameEffectBtn = div.querySelector('#resolveLandGameEffect');

const refreshLabels = () => {
  if (!card.pt) card.pt = { p: 0, t: 0 };
  if (typeof card.stun !== 'number') card.stun = 0;
  const s = (n) => (n >= 0 ? '+' + n : String(n));
  const ptNow = div.querySelector('#ptNow');
  const stunNow = div.querySelector('#stunNow');
  if (ptNow) ptNow.textContent = `${s(card.pt.p)}/${s(card.pt.t)}`;
  if (stunNow) stunNow.textContent = `S${card.stun}`;
};
refreshLabels();

const adjustFieldValue = (type, delta) => {
  executeGameAction('adjust_card_marker', { cardName: card.name, type, delta }, () => {
    if (type === 'power') {
      if (!card.pt) card.pt = { p: 0, t: 0 };
      card.pt.p += delta;
      return card.pt.p;
    }
    if (type === 'toughness') {
      if (!card.pt) card.pt = { p: 0, t: 0 };
      card.pt.t += delta;
      return card.pt.t;
    }
    if (typeof card.stun !== 'number') card.stun = 0;
    card.stun = Math.max(0, card.stun + delta);
    return card.stun;
  }, `${card.name}: ${type} ${delta > 0 ? '+' : ''}${delta}.`, { ms: 1000 });
};

if (incP) incP.onclick = () => adjustFieldValue('power', 1);
if (decP) decP.onclick = () => adjustFieldValue('power', -1);
if (incT) incT.onclick = () => adjustFieldValue('toughness', 1);
if (decT) decT.onclick = () => adjustFieldValue('toughness', -1);

if (incS) incS.onclick = () => adjustFieldValue('stun', 1);
if (decS) decS.onclick = () => adjustFieldValue('stun', -1);
if (resolveLandGameEffectBtn) resolveLandGameEffectBtn.onclick = () => beginLandGameEffect(card.name);
div.querySelectorAll('.repeatLandEffect').forEach(btn => {
  btn.onclick = () => beginLandGameEffect(btn.dataset.land);
});

    
    if (toHandBtn) toHandBtn.onclick = () => {
      executeGameAction('field_to_hand', { cardName: card.name }, () => {
        me.hand.push(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to hand.`);
    };
    
    if (toGYBtn) toGYBtn.onclick = () => {
      executeGameAction('field_to_graveyard', { cardName: card.name }, () => {
        me.graveyard.push(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to graveyard.`);
    };
    
    if (toExileBtn) toExileBtn.onclick = () => {
      executeGameAction('field_to_exile', { cardName: card.name }, () => {
        me.exile.push(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Exiled ${card.name}.`);
    };
    
    if (toBottomDeckBtn) toBottomDeckBtn.onclick = () => {
      const targetDeck = sharedGame ? shared.deck : me.deck;
      executeGameAction('field_to_deck', { cardName: card.name, shared: sharedGame }, () => {
        targetDeck.push(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to ${sharedGame ? shared.label : 'deck'}.`);
    };

    if (toTopDeckBtn) toTopDeckBtn.onclick = () => {
      const targetDeck = sharedGame ? shared.deck : me.deck;
      executeGameAction('field_to_deck_top', { cardName: card.name, shared: sharedGame }, () => {
        targetDeck.unshift(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Put ${card.name} on top of ${sharedGame ? shared.label : 'your library'}.`);
    };

    // A copy of the permanent, marked as a token so it is clearly not the card.
    if (duplicateBtn) duplicateBtn.onclick = () => {
      const zone = state.selectedFieldCard.zone;
      executeGameAction('duplicate_token', { cardName: card.name, zone }, () => {
        const copy = initBattleCard({
          ...cloneJSON(card),
          id: makeId('token'),
          gameId: makeId('token'),
          isToken: true,
          tapped: false,
          pos: null
        });
        me[zone].push(copy);
        state.selectedFieldCard = null;
        return copy;
      }, `Copied ${card.name} as a token.`);
    };

    // One button per direction, moving power and toughness together.
    const adjustCounter = (delta) => {
      executeGameAction('adjust_card_marker', { cardName: card.name, type: 'counter', delta }, () => {
        if (!card.pt) card.pt = { p: 0, t: 0 };
        card.pt.p += delta;
        card.pt.t += delta;
        return card.pt;
      }, `${card.name}: ${delta > 0 ? '+1/+1' : '-1/-1'} counter.`, { ms: 1000 });
    };
    if (plusCounterBtn) plusCounterBtn.onclick = () => adjustCounter(1);
    if (minusCounterBtn) minusCounterBtn.onclick = () => adjustCounter(-1);

    if (fieldToCommandBtn) fieldToCommandBtn.onclick = () => {
      if (!canMoveToCommandZone(me)) return;
      executeGameAction('field_to_command', { cardName: card.name }, () => {
        me.commanderZone.push(card);
        me[state.selectedFieldCard.zone].splice(state.selectedFieldCard.idx, 1);
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to ${commandMeta.label}.`);
    };
    
    if (cancelFieldBtn) cancelFieldBtn.onclick = () => {
      state.selectedFieldCard = null;
      render();
    };
  }
  
  // Card action handlers
  if (state.selectedCard !== null) {
    const discardBtn = div.querySelector('#discardCard');
    const toDeckBtn = div.querySelector('#toDeck');
    const toCommandBtn = div.querySelector('#toCommand');
    const castToStackBtn = div.querySelector('#castToStack');
    const cancelBtn = div.querySelector('#cancelSelect');
    
    if (discardBtn) discardBtn.onclick = () => {
      const card = me.hand[state.selectedCard];
      executeGameAction('hand_to_graveyard', { cardName: card.name }, () => {
        me.graveyard.push(card);
        me.hand.splice(state.selectedCard, 1);
        state.selectedCard = null;
        state.selectedFieldCard = null;
      }, `Discarded ${card.name}.`);
    };
    
    if (toDeckBtn) toDeckBtn.onclick = () => {
      const card = me.hand[state.selectedCard];
      const targetDeck = sharedGame ? shared.deck : me.deck;
      executeGameAction('hand_to_deck', { cardName: card.name, shared: sharedGame }, () => {
        targetDeck.push(card);
        me.hand.splice(state.selectedCard, 1);
        state.selectedCard = null;
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to ${sharedGame ? shared.label : 'deck'}.`);
    };

    if (toCommandBtn) toCommandBtn.onclick = () => {
      if (!canMoveToCommandZone(me)) return;
      const card = me.hand[state.selectedCard];
      executeGameAction('hand_to_command', { cardName: card.name }, () => {
        me.commanderZone.push(card);
        me.hand.splice(state.selectedCard, 1);
        state.selectedCard = null;
        state.selectedFieldCard = null;
      }, `Moved ${card.name} to ${commandMeta.label}.`);
    };

    if (castToStackBtn) castToStackBtn.onclick = castSelectedCardToStack;
    
    if (cancelBtn) cancelBtn.onclick = () => {
      state.selectedCard = null;
      state.selectedFieldCard = null;
      render();
    };
    
    div.querySelectorAll('.placeCard').forEach(btn => {
      btn.onclick = () => {
        const zone = btn.dataset.zone;
        const card = me.hand[state.selectedCard];
        if (!payStrictCost(card)) return;
        executeGameAction('hand_to_field', { cardName: card.name, zone }, () => {
          const cardToPlace = { ...card, tapped: false };
          if (!('pt' in cardToPlace)) cardToPlace.pt = { p: 0, t: 0 };
          if (!('stun' in cardToPlace)) cardToPlace.stun = 0;
          me[zone].push(cardToPlace);
          me.hand.splice(state.selectedCard, 1);
          state.selectedCard = null;
          state.selectedFieldCard = null;
          fireEnterTrigger(cardToPlace, me);
          checkLandGameVictory();
        }, `Moved ${card.name} to ${battleZoneLabel(zone)}.`);
      };
    });
  }
  
  const saveReplayEnd = div.querySelector('#saveReplayEnd');
  if (saveReplayEnd) saveReplayEnd.onclick = replayToFile;
  const rematchBtn = div.querySelector('#rematchBtn');
  // Same decks, same mode, same difficulty: just deal again.
  if (rematchBtn) rematchBtn.onclick = () => beginGame(mode, rules);
  if (state.winner && div.querySelector('#returnBtn')) {
    div.querySelector('#returnBtn').onclick = () => {
      if (state.onlineMode) disconnectOnline();
      state.screen = 'menu';
      state.gameStarted = false;
      state.winner = null;
      state.selectedCard = null;
      state.selectedFieldCard = null;
      state.selectedZoneCard = null;
      state.viewingZone = null;
      state.targeting = null;
      render();
    };
  }
  
  return div;
}

// --- Bridge for ai.js (loaded after this file) -------------------------------
// Everything above lives inside this IIFE; the AI module needs a deliberate,
// documented surface rather than reaching into globals.
window.GALDUR_APP = {
  state,
  render,
  toast,
  showAction,
  executeGameAction,
  checkWinner,
  checkLandGameVictory,
  effectivePT,
  getCMC,
  initBattleCard,
  makeBasicLandCard,
  shuffleCopy,
  getModeConfig,
  getModeRules,
  hordeReveal: revealHorde,
  hordeAttack,
  checkHordeVictory,
  // Replays, exposed so they can be driven and tested.
  enterReplay,
  exitReplay,
  showReplayFrame,
  replayToFile,
  BATTLE_ZONE_KEYS,
  battlefieldCards,
  defaultZoneForCard,
  // Online handshake, exposed so the connection flow can be driven in tests.
  createOnlineRoom,
  joinOnlineRoom,
  completeConnection,
  sdpHasPublicCandidate
};

// Keyboard shortcuts on the battlefield. Registered once; modal states and
// text inputs are respected.
document.addEventListener('keydown', (e) => {
  if (state.screen !== 'game' || !state.gameStarted || state.winner) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (state.targeting || state.declaringAttack || state.viewingZone || state.creatingToken || state.landPicker) return;
  if (e.code === 'Space') {
    e.preventDefault();
    document.getElementById('endTurn')?.click();
  } else if (e.key === 'a' || e.key === 'A') {
    document.getElementById('declareAttack')?.click();
  } else if (e.key === 'd' || e.key === 'D') {
    document.getElementById('drawBtn')?.click();
  }
});

loadLocal();          // restore saved collection + decks before first paint
setTimeout(render, 100);

})();
