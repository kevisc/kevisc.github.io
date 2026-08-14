/* Galdur AI — computer opponent, draft bots, and autopilots.
 *
 * Loaded after app.js. app.js exposes window.GALDUR_APP (state + helpers);
 * this module registers window.GALDUR_AI, which app.js calls from:
 *   - render()            -> GALDUR_AI.onRender()   (schedules pending bot moves)
 *   - end-turn handler    -> (via onRender: AI turn starts whenever it's the
 *                             AI's turn in a local vs-AI game)
 *   - blocker modal       -> GALDUR_AI.resolveAiCombat(assignments)
 *
 * The AI plays the manual sandbox the way a casual human would: untap, draw,
 * play a land, cast what it can afford, attack when favorable. It resolves
 * simple spell text itself (damage / draw / lifegain / removal) and holds
 * anything it cannot understand. Combat honors flying/reach, deathtouch,
 * trample, lifelink and first strike; everything else stays manual.
 */
(function(){
'use strict';

const READY_POLL_MS = 120;

function boot(){
  const A = window.GALDUR_APP;
  if (!A) { setTimeout(boot, READY_POLL_MS); return; }

  const { state } = A;

  // ---------------------------------------------------------------- helpers

  const AI_SEAT = 2;                       // the AI always plays player2
  const aiKey = 'player' + AI_SEAT;
  const humanKey = 'player1';

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  function aiPlayer(){ return state.gameState[aiKey]; }
  function humanPlayer(){ return state.gameState[humanKey]; }

  function aiGameActive(){
    return !!(state.vsAI && !state.onlineMode && state.gameStarted && !state.winner && state.screen === 'game');
  }

  function fieldCards(player){
    return [...(player.upperField || []), ...(player.lowerField || [])];
  }

  function isLandCard(c){ return ((c?.type || '') + '').toLowerCase().includes('land'); }
  function isCreatureCard(c){
    return ((c?.type || '') + '').toLowerCase().includes('creature') || !!c?.isToken;
  }
  function isPermanentCard(c){
    const t = ((c?.type || '') + '').toLowerCase();
    return ['creature', 'artifact', 'enchantment', 'planeswalker', 'battle', 'land'].some(k => t.includes(k));
  }

  const KEYWORDS = ['flying', 'reach', 'deathtouch', 'trample', 'lifelink', 'first strike', 'vigilance', 'defender', 'haste', 'menace', 'hexproof'];
  function keywordsOf(c){
    const text = ((c?.effect || '') + '').toLowerCase();
    const found = {};
    for (const k of KEYWORDS) if (text.includes(k)) found[k] = true;
    return found;
  }

  function creatureValue(c){
    const pt = A.effectivePT(c);
    const kw = keywordsOf(c);
    let v = pt.p + pt.t;
    if (kw.flying) v += 1.5;
    if (kw.deathtouch) v += 1.5;
    if (kw.trample) v += 1;
    if (kw.lifelink) v += 1;
    if (kw['first strike']) v += 1;
    if (kw.defender) v -= 2;
    return v;
  }

  // ------------------------------------------------------------ mana engine

  const BASIC_COLOR = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

  function landColor(card){
    if (BASIC_COLOR[card.name]) return BASIC_COLOR[card.name];
    const m = ((card.effect || '') + '').match(/add\s*\{?([WUBRG])\}?/i);
    if (m) return m[1].toUpperCase();
    return '*'; // treat unknown lands as any-color
  }

  function untappedLands(){
    return fieldCards(aiPlayer()).filter(c => isLandCard(c) && !c.tapped);
  }

  // Parse "{2}{R}{R}" -> { generic: 2, colored: ['R','R'] }. Hybrid symbols
  // ("{W/U}") accept either color; X counts as 0.
  function parseCost(cost){
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
    return { generic, colored };
  }

  // Greedy payment check/plan over the AI's untapped lands.
  function planPayment(cost){
    const { generic, colored } = parseCost(cost);
    const lands = untappedLands().map(c => ({ card: c, color: landColor(c) }));
    const used = new Set();
    for (const opts of colored) {
      let hit = lands.find(l => !used.has(l.card) && opts.includes(l.color));
      if (!hit) hit = lands.find(l => !used.has(l.card) && l.color === '*');
      if (!hit) return null;
      used.add(hit.card);
    }
    const rest = lands.filter(l => !used.has(l.card));
    if (rest.length < generic) return null;
    // Pay generic with any-color lands first so basics stay open.
    rest.sort((a, b) => (a.color === '*' ? -1 : 0) - (b.color === '*' ? -1 : 0));
    for (let i = 0; i < generic; i++) used.add(rest[i].card);
    return [...used];
  }

  function tapLands(lands){
    for (const land of lands) land.tapped = true;
  }

  // ------------------------------------------------------- spell text engine

  // Understand a handful of common effect templates; anything else stays in hand.
  function analyzeSpell(card){
    const text = ((card.effect || '') + '').toLowerCase();
    const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
    const num = (s) => WORD_NUM[s] || parseInt(s, 10) || 0;

    let m = text.match(/deal(?:s)? (\d+) damage/);
    if (m) return { kind: 'damage', n: num(m[1]) };
    m = text.match(/destroy target creature/);
    if (m) return { kind: 'destroy' };
    m = text.match(/draw (a|an|one|two|three|four|\d+) cards?/);
    if (m) return { kind: 'draw', n: num(m[1]) };
    m = text.match(/(?:you )?gain (\d+) life/);
    if (m) return { kind: 'lifegain', n: num(m[1]) };
    return { kind: 'unknown' };
  }

  function bestHumanCreatureIdx(zone, predicate){
    const human = humanPlayer();
    let best = null;
    for (const z of ['upperField', 'lowerField']) {
      (human[z] || []).forEach((c, idx) => {
        if (!isCreatureCard(c)) return;
        if (predicate && !predicate(c)) return;
        if (!best || creatureValue(c) > creatureValue(best.card)) best = { zone: z, idx, card: c };
      });
    }
    return best;
  }

  function removeFromZone(player, zone, card){
    const arr = player[zone];
    const i = arr.indexOf(card);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0;
  }

  // ------------------------------------------------------------ the AI turn

  let aiRunning = false;
  // Set while the human is assigning blockers: the AI turn is suspended, not
  // finished, so onRender must not start a second one behind it.
  let awaitingBlocks = false;

  async function runAiTurn(){
    if (aiRunning || awaitingBlocks || !aiGameActive() || state.activePlayer !== AI_SEAT) return;
    aiRunning = true;
    try {
      const mode = state.gameState.mode || state.battleMode;
      if (mode === 'horde') { await runHordeTurn(); return; }
      if (mode === 'land-game') { await runLandGameTurn(); return; }
      if (mode === 'boss') { await runBossTurn(); return; }
      await runStandardTurn();
    } finally {
      // Keep the lock held across the blocker prompt; resolveAiCombat frees it.
      if (!awaitingBlocks) aiRunning = false;
    }
  }

  async function step(ms = 650){
    await delay(ms);
    return aiGameActive() && state.activePlayer === AI_SEAT;
  }

  function act(type, payload, mutator, message){
    return A.executeGameAction(type, payload, mutator, message, { ms: 1200 });
  }

  async function runStandardTurn(){
    const me = aiPlayer();

    // Untap + clear last turn's summoning sickness.
    act('ai_upkeep', { player: AI_SEAT }, () => {
      let untapped = 0;
      fieldCards(me).forEach(c => {
        delete c.aiSick;
        if (!c.tapped) return;
        if (typeof c.stun === 'number' && c.stun > 0) { c.stun -= 1; }
        else { c.tapped = false; untapped++; }
      });
      state.gameState.phase = 'Draw';
    }, `AI untaps.`);
    if (!await step()) return;

    // Draw.
    const drawPile = (state.gameState.shared && state.gameState.shared.enabled) ? state.gameState.shared.deck : me.deck;
    if (drawPile.length) {
      act('ai_draw', { player: AI_SEAT }, () => {
        const card = drawPile.shift();
        if (!('tapped' in card)) card.tapped = false;
        me.hand.push(card);
        state.gameState.phase = 'Main';
      }, `AI draws a card (${me.hand.length + 1} in hand).`);
    } else {
      act('ai_no_draw', { player: AI_SEAT }, () => { state.gameState.phase = 'Main'; }, 'AI has no cards left to draw.');
    }
    if (!await step()) return;

    // Play a land: pick the color the remaining hand needs most.
    const landsInHand = me.hand.filter(isLandCard);
    if (landsInHand.length) {
      const needs = {};
      for (const c of me.hand) {
        if (isLandCard(c)) continue;
        for (const opts of parseCost(c.cost).colored) for (const col of opts) needs[col] = (needs[col] || 0) + 1;
      }
      landsInHand.sort((a, b) => (needs[landColor(b)] || 0) - (needs[landColor(a)] || 0));
      const land = landsInHand[0];
      act('ai_play_land', { cardName: land.name }, () => {
        me.hand.splice(me.hand.indexOf(land), 1);
        me.upperField.push({ ...land, tapped: false });
      }, `AI plays ${land.name}.`);
      if (!await step()) return;
    }

    // Main phase: cast greedily until nothing is affordable.
    let castGuard = 0;
    while (castGuard++ < 12) {
      const played = castBestSpell();
      if (!played) break;
      if (!await step(800)) return;
    }

    // Combat.
    const attackers = chooseAttackers();
    if (attackers.length) {
      act('ai_attack_declare', { count: attackers.length }, () => {
        state.gameState.phase = 'Combat';
        attackers.forEach(c => { if (!keywordsOf(c).vigilance) c.tapped = true; c.aiAttacking = true; });
      }, `AI attacks with ${attackers.length} creature${attackers.length === 1 ? '' : 's'}.`);
      if (!await step()) return;

      const legalBlockers = humanUntappedBlockers();
      if (legalBlockers.length) {
        // Hand control to the human: GameBoard shows the blocker modal and
        // calls resolveAiCombat() when they confirm.
        awaitingBlocks = true;
        state.targeting = { type: 'ai-blockers' };
        A.render();
        return; // turn resumes in resolveAiCombat -> finishAiTurn
      }
      resolveCombatDamage({});
      if (!await step()) return;
    }

    await finishAiTurn();
  }

  function castBestSpell(){
    const me = aiPlayer();
    const candidates = [];
    for (const card of me.hand) {
      if (isLandCard(card)) continue;
      const payment = planPayment(card.cost);
      if (!payment) continue;
      const cmc = A.getCMC(card) || 0;
      if (isCreatureCard(card)) {
        candidates.push({ card, payment, score: 10 + creatureValue(card) - 0.3 * cmc, kind: 'creature' });
      } else if (isPermanentCard(card)) {
        candidates.push({ card, payment, score: 6 + cmc * 0.5, kind: 'permanent' });
      } else {
        const spell = analyzeSpell(card);
        if (spell.kind === 'damage') {
          const target = bestHumanCreatureIdx(null, c => A.effectivePT(c).t <= spell.n);
          if (target) candidates.push({ card, payment, spell, target, score: 8 + creatureValue(target.card), kind: 'spell' });
          else if (humanPlayer().health <= spell.n * 4) candidates.push({ card, payment, spell, target: null, score: 5 + spell.n, kind: 'spell' });
        } else if (spell.kind === 'destroy') {
          const target = bestHumanCreatureIdx(null, c => !keywordsOf(c).hexproof);
          if (target && creatureValue(target.card) >= 4) candidates.push({ card, payment, spell, target, score: 7 + creatureValue(target.card), kind: 'spell' });
        } else if (spell.kind === 'draw') {
          candidates.push({ card, payment, spell, score: 6 + spell.n, kind: 'spell' });
        } else if (spell.kind === 'lifegain') {
          if (aiPlayer().health < 14) candidates.push({ card, payment, spell, score: 4 + spell.n, kind: 'spell' });
        }
        // unknown spells stay in hand — the sandbox can't resolve their text
      }
    }
    if (!candidates.length) return false;
    candidates.sort((a, b) => b.score - a.score);
    const pick = candidates[0];

    act('ai_cast', { cardName: pick.card.name }, () => {
      tapLands(pick.payment);
      const me2 = aiPlayer();
      me2.hand.splice(me2.hand.indexOf(pick.card), 1);
      const battleCard = { ...pick.card, tapped: false };
      if (!('pt' in battleCard)) battleCard.pt = { p: 0, t: 0 };
      if (!('stun' in battleCard)) battleCard.stun = 0;

      if (pick.kind === 'creature') {
        if (!keywordsOf(battleCard).haste) battleCard.aiSick = true;
        me2.lowerField.push(battleCard);
        return `AI casts ${battleCard.name}.`;
      }
      if (pick.kind === 'permanent') {
        me2.lowerField.push(battleCard);
        return `AI casts ${battleCard.name}.`;
      }
      // instants / sorceries the AI understands
      const human = humanPlayer();
      let msg = `AI casts ${battleCard.name}`;
      if (pick.spell.kind === 'damage') {
        if (pick.target) {
          const victim = pick.target.card;
          if (A.effectivePT(victim).t <= pick.spell.n) {
            removeFromZone(human, pick.target.zone, victim);
            human.graveyard.push({ ...victim, tapped: false });
            msg += ` — ${pick.spell.n} damage destroys your ${victim.name}.`;
          } else {
            msg += ` — ${pick.spell.n} damage to ${victim.name} (survives; adjust manually if needed).`;
          }
        } else {
          human.health = Math.max(0, human.health - pick.spell.n);
          msg += ` — ${pick.spell.n} damage to you.`;
        }
      } else if (pick.spell.kind === 'destroy') {
        const victim = pick.target.card;
        removeFromZone(human, pick.target.zone, victim);
        human.graveyard.push({ ...victim, tapped: false });
        msg += ` — destroys your ${victim.name}.`;
      } else if (pick.spell.kind === 'draw') {
        for (let i = 0; i < pick.spell.n && me2.deck.length; i++) me2.hand.push(me2.deck.shift());
        msg += ` — draws ${pick.spell.n}.`;
      } else if (pick.spell.kind === 'lifegain') {
        me2.health += pick.spell.n;
        msg += ` — gains ${pick.spell.n} life.`;
      }
      me2.graveyard.push(battleCard);
      A.checkWinner();
      return msg + '';
    }, (msg) => msg);
    return true;
  }

  function humanUntappedBlockers(){
    return fieldCards(humanPlayer()).filter(c => isCreatureCard(c) && !c.tapped);
  }

  function canBlock(attacker, blocker){
    const ak = keywordsOf(attacker);
    const bk = keywordsOf(blocker);
    if (ak.flying && !(bk.flying || bk.reach)) return false;
    return true;
  }

  function chooseAttackers(){
    const me = aiPlayer();
    const human = humanPlayer();
    const ready = fieldCards(me).filter(c =>
      isCreatureCard(c) && !c.tapped && !c.aiSick && !keywordsOf(c).defender && A.effectivePT(c).p > 0);
    if (!ready.length) return [];

    const blockers = humanUntappedBlockers();
    if (!blockers.length) return ready; // open field: everyone swings

    const totalPower = ready.reduce((s, c) => s + A.effectivePT(c).p, 0);
    if (totalPower >= human.health) return ready; // potential lethal: all-in

    return ready.filter(a => {
      const apt = A.effectivePT(a);
      const ak = keywordsOf(a);
      const eligible = blockers.filter(b => canBlock(a, b));
      if (!eligible.length) return true; // evasive
      // Attack when no eligible blocker both survives and kills it.
      return !eligible.some(b => {
        const bpt = A.effectivePT(b);
        const bk = keywordsOf(b);
        const killsMe = bpt.p >= apt.t || (bk.deathtouch && bpt.p > 0);
        const survivesMe = apt.p < bpt.t && !(ak.deathtouch && apt.p > 0);
        return killsMe && survivesMe;
      });
    });
  }

  // assignments: { attackerGameId: blockerGameId | '' }
  function resolveCombatDamage(assignments){
    act('ai_combat', {}, () => {
      const me = aiPlayer();
      const human = humanPlayer();
      const lines = [];
      const deadAi = [];
      const deadHuman = [];
      const attackers = fieldCards(me).filter(c => c.aiAttacking);

      for (const attacker of attackers) {
        delete attacker.aiAttacking;
        const apt = A.effectivePT(attacker);
        const ak = keywordsOf(attacker);
        const blockerId = assignments[attacker.gameId || attacker.id];
        const blocker = blockerId
          ? fieldCards(human).find(c => (c.gameId || c.id) === blockerId)
          : null;

        if (!blocker) {
          human.health = Math.max(0, human.health - apt.p);
          if (ak.lifelink) me.health += apt.p;
          lines.push(`${attacker.name} hits you for ${apt.p}.`);
          continue;
        }

        const bpt = A.effectivePT(blocker);
        const bk = keywordsOf(blocker);
        const aFirst = ak['first strike'] && !bk['first strike'];
        const bFirst = bk['first strike'] && !ak['first strike'];

        const aKills = apt.p >= bpt.t || (ak.deathtouch && apt.p > 0);
        const bKills = bpt.p >= apt.t || (bk.deathtouch && bpt.p > 0);

        let attackerDies = bKills;
        let blockerDies = aKills;
        if (aFirst && aKills) attackerDies = false;   // blocker never strikes back
        if (bFirst && bKills) blockerDies = false;    // attacker never connects

        if (blockerDies && ak.trample) {
          const excess = Math.max(0, apt.p - bpt.t);
          if (excess > 0) {
            human.health = Math.max(0, human.health - excess);
            lines.push(`${attacker.name} tramples over for ${excess}.`);
          }
        }
        if (ak.lifelink && !(bFirst && bKills)) me.health += apt.p;

        if (blockerDies) deadHuman.push(blocker);
        if (attackerDies) deadAi.push(attacker);
        lines.push(`${blocker.name} blocks ${attacker.name}${blockerDies ? ` — ${blocker.name} dies` : ''}${attackerDies ? ` — ${attacker.name} dies` : ''}.`);
      }

      for (const c of deadHuman) {
        for (const z of ['upperField', 'lowerField']) if (removeFromZone(human, z, c)) break;
        human.graveyard.push({ ...c, tapped: false, aiAttacking: undefined });
      }
      for (const c of deadAi) {
        for (const z of ['upperField', 'lowerField']) if (removeFromZone(me, z, c)) break;
        me.graveyard.push({ ...c, tapped: false, aiAttacking: undefined });
      }
      A.checkWinner();
      return lines.length ? 'Combat: ' + lines.join(' ') : 'No combat damage.';
    }, (msg) => msg);
  }

  async function resolveAiCombat(assignments){
    if (!awaitingBlocks) return;          // ignore stray/double clicks
    state.targeting = null;
    try {
      resolveCombatDamage(assignments || {});
      await delay(900);
      await finishAiTurn();
    } finally {
      awaitingBlocks = false;
      aiRunning = false;
    }
  }

  async function finishAiTurn(){
    if (!aiGameActive()) return;
    state.gameState.phase = 'Second Main';
    // one more casting window with whatever mana is left
    let guard = 0;
    while (guard++ < 6) {
      if (!castBestSpell()) break;
      if (!await step(800)) return;
    }
    act('ai_end_turn', {}, () => {
      state.gameState.phase = 'Draw';
      state.activePlayer = 1;
      state.showTurnNotification = true;
      setTimeout(() => { state.showTurnNotification = false; A.render(); }, 2000);
    }, 'AI ends its turn. Your turn!');
  }

  // ------------------------------------------------ mode-specific autopilots

  // The boss plays a normal turn, then escalates: every other round it adds a
  // free minion, and from round 7 it also drains the survivors.
  // Escalation runs first, then the boss takes an ordinary turn — that way the
  // normal turn still owns the combat/blocker handoff and its own ending.
  async function runBossTurn(){
    state.bossRound = (state.bossRound || 0) + 1;
    const round = state.bossRound;

    if (round >= 3 && round % 3 === 0) {
      const size = Math.min(2 + Math.floor(round / 3), 8);
      act('boss_minion', { round }, () => {
        aiPlayer().lowerField.push({
          id: 'minion' + round + Math.random(),
          gameId: 'boss-minion-' + round + '-' + Math.random().toString(36).slice(2),
          name: `Summoned Horror ${round / 3}`,
          type: 'Creature Token - Horror',
          cost: '', colors: ['B'], effect: round >= 8 ? 'Trample.' : '',
          power: size, toughness: size,
          tapped: false, isToken: true, generated: true, aiSick: true,
          pt: { p: 0, t: 0 }, stun: 0
        });
      }, `The boss summons a ${size}/${size} Horror.`);
      if (!await step(900)) return;
    }

    if (round >= 9) {
      act('boss_drain', { round }, () => {
        humanPlayer().health = Math.max(0, humanPlayer().health - 2);
        aiPlayer().health += 2;
        A.checkWinner();
      }, 'The boss drains 2 life from the survivors.');
      if (!await step(900)) return;
    }

    await runStandardTurn();
  }

  async function runHordeTurn(){
    if (!await step(500)) return;
    // Everything that survived to this turn can attack; this turn's reveals
    // arrive sick and wait for the next one.
    act('horde_upkeep', {}, () => {
      fieldCards(aiPlayer()).forEach(c => { delete c.aiSick; c.tapped = false; });
    }, 'The Horde stirs.');
    if (!await step(700)) return;
    A.hordeReveal();
    if (!await step(1400)) return;
    A.hordeAttack();
    if (!await step(1200)) return;
    act('ai_end_turn', {}, () => {
      state.activePlayer = 1;
      state.showTurnNotification = true;
      setTimeout(() => { state.showTurnNotification = false; A.render(); }, 2000);
    }, 'The Horde is done. Your turn!');
  }

  async function runLandGameTurn(){
    const me = aiPlayer();
    const human = humanPlayer();
    act('ai_upkeep', { player: AI_SEAT }, () => { fieldCards(me).forEach(c => { c.tapped = false; }); }, 'AI untaps.');
    if (!await step()) return;

    if (me.deck.length) {
      act('ai_draw', {}, () => { me.hand.push(me.deck.shift()); }, 'AI draws.');
      if (!await step()) return;
    }

    // Play the land that best advances domain (new name first) or pairs.
    if (me.hand.length) {
      const counts = {};
      fieldCards(me).forEach(c => { counts[c.name] = (counts[c.name] || 0) + 1; });
      const scored = me.hand.map(c => ({ c, s: (counts[c.name] ? counts[c.name] : 10) + (counts[c.name] >= 3 ? 5 : 0) }));
      scored.sort((x, y) => y.s - x.s);
      const land = scored[0].c;
      act('ai_play_land', { cardName: land.name }, () => {
        me.hand.splice(me.hand.indexOf(land), 1);
        me.lowerField.push({ ...land, tapped: false });
        // resolve the land's effect, AI-side
        if (land.name === 'Island' && me.deck.length) { me.hand.push(me.deck.shift()); return `AI plays Island and draws.`; }
        if (land.name === 'Forest') {
          const back = me.graveyard.find(g => BASIC_COLOR[g.name]);
          if (back) { me.graveyard.splice(me.graveyard.indexOf(back), 1); me.hand.push(back); return `AI plays Forest, returning ${back.name}.`; }
        }
        if (land.name === 'Swamp' && human.hand.length) {
          const i = Math.floor(Math.random() * human.hand.length);
          const gone = human.hand.splice(i, 1)[0];
          human.graveyard.push(gone);
          return `AI plays Swamp — you discard ${gone.name}.`;
        }
        if (land.name === 'Mountain') {
          const targets = fieldCards(human);
          if (targets.length) {
            const t = targets[Math.floor(Math.random() * targets.length)];
            for (const z of ['upperField', 'lowerField']) if (removeFromZone(human, z, t)) break;
            human.graveyard.push(t);
            return `AI plays Mountain — destroys your ${t.name}.`;
          }
        }
        return `AI plays ${land.name}.`;
      }, (m) => m);
      A.checkLandGameVictory && A.checkLandGameVictory();
      if (!await step(900)) return;
    }

    act('ai_end_turn', {}, () => {
      state.activePlayer = 1;
      state.showTurnNotification = true;
      setTimeout(() => { state.showTurnNotification = false; A.render(); }, 2000);
    }, 'AI ends its turn. Your turn!');
  }

  // --------------------------------------------------------------- draft bot

  const RARITY_SCORE = { mythic: 5, rare: 4, uncommon: 2.6, common: 1.6, special: 3, bonus: 3 };

  function draftCardScore(card, myPicks){
    let s = RARITY_SCORE[(card.rarity || '').toLowerCase()] || 2;
    const cmc = A.getCMC(card) || 0;
    if (isCreatureCard(card)) s += 1;
    if (cmc >= 2 && cmc <= 4) s += 0.8;
    if (cmc >= 7) s -= 1;
    const myColors = {};
    for (const p of myPicks) for (const col of (p.colors || [])) myColors[col] = (myColors[col] || 0) + 1;
    const overlap = (card.colors || []).reduce((acc, col) => acc + Math.min(myColors[col] || 0, 5), 0);
    s += overlap * 0.35;
    if (myPicks.length >= 6 && (card.colors || []).length && overlap === 0) s -= 1.2;
    return s;
  }

  let draftBotTimer = null;

  function maybeBotDraftPick(){
    const D = state.draft;
    if (!D || !D.active || D.mode !== 'draftoff') return;
    if (!D.off.isLocal || !D.off.vsBot) return;
    if (D.screen === 'landsfill' || D.screen === 'landswait') { maybeBotLandsFill(); return; }
    if (D.off.currentPicker !== 2 || !D.off.table.length) return;
    if (draftBotTimer) return;
    draftBotTimer = setTimeout(() => {
      draftBotTimer = null;
      const D2 = state.draft;
      if (!D2 || D2.off.currentPicker !== 2 || !D2.off.table.length || !D2.off.vsBot) return;
      let bestIdx = 0, bestScore = -Infinity;
      D2.off.table.forEach((card, idx) => {
        const s = draftCardScore(card, D2.off.p2);
        if (s > bestScore) { bestScore = s; bestIdx = idx; }
      });
      const picked = D2.off.table[bestIdx];
      A.toast(`Bot drafts ${picked.name}.`);
      window.draftOffApplyPick(bestIdx, 2);
    }, 1000);
  }

  function maybeBotLandsFill(){
    const D = state.draft;
    if (!D || !D.off.vsBot || D.off.p2LandsDone) return;
    // Bot fills its own basics immediately: ~30% lands, split by mana symbols.
    const picks = D.off.p2.slice();
    const symbolCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const c of picks) {
      const tokens = ((c.cost || '') + '').match(/\{([^}]+)\}/g) || [];
      for (const t of tokens) for (const ch of t.slice(1, -1)) if (symbolCounts[ch] !== undefined) symbolCounts[ch]++;
    }
    const total = Object.values(symbolCounts).reduce((a, b) => a + b, 0) || 1;
    const landTarget = Math.max(10, Math.round(picks.length * 0.42));
    const NAMES = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
    const lands = [];
    for (const col of Object.keys(symbolCounts)) {
      const n = Math.round(landTarget * symbolCounts[col] / total);
      for (let i = 0; i < n; i++) lands.push(A.makeBasicLandCard(NAMES[col], i + 1, 'bot'));
    }
    while (lands.length < landTarget) lands.push(A.makeBasicLandCard('Plains', lands.length + 1, 'bot'));
    D.off.p2 = picks.concat(lands);
    D.off.p2LandsDone = true;
    A.toast(`Bot finishes its deck (${D.off.p2.length} cards).`);
    if (D.off.p1LandsDone) {
      state.decks.player1 = (D.off.p1 || []).slice();
      state.decks.player2 = (D.off.p2 || []).slice();
      D.screen = 'decklists';
    }
    A.render();
  }

  // -------------------------------------------------------------- winston bot

  let winstonBotTimer = null;

  // The winston engine lives inside DraftScreen's closure; like the draft-off
  // engine it exposes its moves on window (re-assigned every render).
  function maybeWinstonBotMove(){
    const D = state.draft;
    const W = D && D.winston;
    if (!W || !W.vsBot || !Array.isArray(W.pool)) return;
    if (state.screen !== 'draft' || D.mode !== 'winston' || D.screen !== 'winston') return;
    if (W.activePlayer !== 2) return;
    if (winstonBotTimer) return;
    winstonBotTimer = setTimeout(() => {
      winstonBotTimer = null;
      const W2 = state.draft && state.draft.winston;
      if (!W2 || W2.activePlayer !== 2 || !W2.vsBot) return;
      if (typeof window.winstonTakePile !== 'function' || typeof window.winstonSkipPile !== 'function') return;
      const pile = W2.piles[W2.currentPile] || [];
      const isLastPile = W2.currentPile >= W2.piles.length - 1;
      const avg = pile.length
        ? pile.reduce((s, c) => s + draftCardScore(c, W2.p2), 0) / pile.length
        : 0;
      // Bigger piles and later piles are more tempting; on the last pile with
      // an empty pool a skip would waste the turn, so the bot takes.
      const threshold = 2.6 - pile.length * 0.25 - W2.currentPile * 0.15;
      if (pile.length && (avg >= threshold || (isLastPile && !W2.pool.length))) {
        A.toast(`Bot takes pile ${W2.currentPile + 1} (${pile.length} cards).`);
        window.winstonTakePile();
      } else {
        window.winstonSkipPile();
      }
    }, 1100);
  }

  // ------------------------------------------------------------- render hook

  let aiTurnTimer = null;

  function onRender(){
    // Leaving/ending a game while the blocker prompt is open must not leave the
    // AI locked out of every future game.
    if (!aiGameActive() && awaitingBlocks) { awaitingBlocks = false; aiRunning = false; }
    // AI battle turn
    if (aiGameActive() && state.activePlayer === AI_SEAT && !aiRunning && !state.targeting) {
      if (!aiTurnTimer) {
        aiTurnTimer = setTimeout(() => { aiTurnTimer = null; runAiTurn(); }, 700);
      }
    }
    // Draft bots
    maybeBotDraftPick();
    maybeWinstonBotMove();
  }

  window.GALDUR_AI = {
    onRender,
    runAiTurn,
    resolveAiCombat,
    humanUntappedBlockers,
    canBlock,
    keywordsOf,
    creatureValue,
    draftCardScore
  };
}

boot();
})();
