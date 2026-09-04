/* Galdur AI: computer opponent, draft bots, and autopilots.
 *
 * Loaded after app.js. app.js exposes window.GALDUR_APP (state + helpers);
 * this module registers window.GALDUR_AI, which app.js calls from:
 *   - render()            -> GALDUR_AI.onRender()   (schedules pending bot moves)
 *   - end-turn handler    -> (via onRender: AI turn starts whenever it's the
 *                             AI's turn in a local vs-AI game)
 *   - blocker modal       -> GALDUR_AI.resolveAiCombat(assignments)
 *
 * How the bot thinks:
 *   1. Mana. It plans a whole main phase, not one card, so it prefers the line
 *      that spends the most mana on the most value (planMainPlay).
 *   2. Combat. Before it attacks it models the defender's best blocks
 *      (planBlocks) and scores the attack by what it actually gains: damage,
 *      material traded, and whether the attack wins the game.
 *   3. Blocking. The same block planner runs for real when the human attacks,
 *      including multi-blocks on one large attacker and chump blocks at low
 *      life.
 *   4. Removal. Damage and destroy effects go to the best target, never to a
 *      token while a real threat is on the board, and to the player's face only
 *      when that wins the game or nothing on the board is worth it.
 *
 * The bot never cheats: it reads the board, the graveyards and the life
 * totals, never the human's hand or library. Difficulty is how well it plays.
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

  // --- Difficulty ----------------------------------------------------------
  // Every knob is "how often the bot plays badly on purpose" or "how far ahead
  // it looks", so Hard is the bot with no handicaps rather than a bot with
  // secret bonuses. The boss dials are the documented escalation, nothing else.
  const DIFFICULTY = {
    easy: {
      label: 'Easy',
      blurb: 'Misplays often, attacks carelessly, blocks loosely.',
      castSkip: 0.32,      // chance to pass on its best play
      greedyAttack: 0.45,  // chance to attack into a bad block anyway
      blockSkill: 0.4,     // chance to take a good block it has found
      planDepth: 1,        // no sequencing: it just casts the best single card
      targetSkill: 0.35,   // chance to aim removal at the right target
      holdInstants: false, // dumps its tricks at sorcery speed
      bossEvery: 8,        // boss summons a minion every N rounds
      bossDrainFrom: 99   // never: Easy is the tier that has to be winnable
    },
    normal: {
      label: 'Normal',
      blurb: 'Plays a reasonable curve and trades sensibly.',
      castSkip: 0.14,
      greedyAttack: 0.2,
      blockSkill: 0.7,
      planDepth: 2,
      targetSkill: 0.85,
      holdInstants: true,
      bossEvery: 7,
      bossDrainFrom: 16
    },
    hard: {
      label: 'Hard',
      blurb: 'Always takes its best line, blocks precisely, boss ramps fast.',
      castSkip: 0,
      greedyAttack: 0,
      blockSkill: 1,
      planDepth: 3,
      targetSkill: 1,
      holdInstants: true,
      bossEvery: 5,
      bossDrainFrom: 12
    }
  };

  function diff(){
    return DIFFICULTY[state.aiDifficulty] || DIFFICULTY.normal;
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  function aiPlayer(){ return state.gameState[aiKey]; }
  function humanPlayer(){ return state.gameState[humanKey]; }

  function aiGameActive(){
    // replayMode also sets gameStarted/screen, so it must be excluded or the
    // bot would try to take turns on top of a replay being watched.
    return !!(state.vsAI && !state.onlineMode && !state.replayMode
      && state.gameStarted && !state.winner && state.screen === 'game');
  }

  function fieldCards(player){
    return A.battlefieldCards(player);
  }

  function isLandCard(c){ return ((c?.type || '') + '').toLowerCase().includes('land'); }
  function isCreatureCard(c){
    return ((c?.type || '') + '').toLowerCase().includes('creature') || !!c?.isToken;
  }
  function isTokenCard(c){
    return !!c?.isToken || ((c?.type || '') + '').toLowerCase().includes('token');
  }
  function isInstantCard(c){ return ((c?.type || '') + '').toLowerCase().includes('instant'); }
  function isPermanentCard(c){
    const t = ((c?.type || '') + '').toLowerCase();
    return ['creature', 'artifact', 'enchantment', 'planeswalker', 'battle', 'land'].some(k => t.includes(k));
  }

  const KEYWORDS = ['flying', 'reach', 'deathtouch', 'trample', 'lifelink', 'first strike', 'vigilance', 'defender', 'haste', 'menace', 'hexproof'];
  // Word boundaries, so "gains flying" on a pump spell does not turn a bear
  // into a flier and "unreachable" is not reach.
  const KEYWORD_RE = KEYWORDS.map(k => [k, new RegExp('(^|[^a-z])' + k + '($|[^a-z])', 'i')]);
  function keywordsOf(c){
    const text = ((c?.effect || '') + '');
    const found = {};
    for (const [k, re] of KEYWORD_RE) if (re.test(text)) found[k] = true;
    return found;
  }

  // What a creature is worth as a permanent: body first, then the keywords
  // that change how it fights.
  function creatureValue(c){
    const pt = A.effectivePT(c);
    const kw = keywordsOf(c);
    let v = pt.p + pt.t;
    if (kw.flying) v += 1.5;
    if (kw.deathtouch) v += 1.5;
    if (kw.trample) v += 1;
    if (kw.lifelink) v += 1;
    if (kw['first strike']) v += 1;
    if (kw.menace) v += 0.5;
    if (kw.vigilance) v += 0.5;
    if (kw.defender) v -= 2;
    return v;
  }

  // What a creature is worth as a removal target: a big attacker beats a wall,
  // and a token is worth less than the real card standing next to it.
  function threatValue(c){
    const pt = A.effectivePT(c);
    let v = creatureValue(c) + pt.p * 0.6;
    if (c.aiAttacking || c.playerAttacking) v += 1;
    if (isTokenCard(c)) v -= 2.5;
    if (keywordsOf(c).defender) v -= 1;
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

  // The mana the bot can still spend, as a list the planner can subtract from.
  function manaPool(){
    return untappedLands().map(c => ({ card: c, color: landColor(c) }));
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

  // Greedy payment plan over a given pool. Colored pips are paid from matching
  // lands first, generic from any-color lands, so the basics stay open.
  function planPaymentFrom(cost, pool){
    const { generic, colored } = parseCost(cost);
    const used = new Set();
    for (const opts of colored) {
      let hit = pool.find(l => !used.has(l) && opts.includes(l.color));
      if (!hit) hit = pool.find(l => !used.has(l) && l.color === '*');
      if (!hit) return null;
      used.add(hit);
    }
    const rest = pool.filter(l => !used.has(l));
    if (rest.length < generic) return null;
    rest.sort((a, b) => (a.color === '*' ? -1 : 0) - (b.color === '*' ? -1 : 0));
    for (let i = 0; i < generic; i++) used.add(rest[i]);
    return [...used];
  }

  function planPayment(cost){
    const plan = planPaymentFrom(cost, manaPool());
    return plan ? plan.map(l => l.card) : null;
  }

  function tapLands(lands){
    for (const land of lands) land.tapped = true;
  }

  // ------------------------------------------------------------ combat math

  // Pairwise legality, used by the human's blocker modal too. Menace needs two
  // blockers, which is a property of the whole block, so planBlocks enforces it.
  function canBlock(attacker, blocker){
    const ak = keywordsOf(attacker);
    const bk = keywordsOf(blocker);
    if (ak.flying && !(bk.flying || bk.reach)) return false;
    return true;
  }

  // How the attacker spreads its damage over the blockers that are still up:
  // lethal damage to each in turn (one point each if it has deathtouch), and
  // whatever is left tramples over.
  function assignCombatDamage(apt, ak, list, alive){
    let left = Math.max(0, apt.p);
    const killed = [];
    for (const b of list) {
      if (!alive.has(b) || left <= 0) continue;
      const need = ak.deathtouch ? 1 : Math.max(1, b.pt.t);
      if (left >= need) { left -= need; killed.push(b); }
      else { left = 0; }
    }
    return { killed, trample: ak.trample ? left : 0 };
  }

  // One attacker against nothing, one blocker, or several. Pure: it reads the
  // cards and returns what would happen, so the same function serves the
  // simulation and the real damage step.
  function combatResult(attacker, blockers){
    const apt = A.effectivePT(attacker);
    const ak = keywordsOf(attacker);
    const list = (blockers || []).filter(Boolean).map(b => ({ card: b, pt: A.effectivePT(b), kw: keywordsOf(b) }));
    if (!list.length) {
      const dmg = Math.max(0, apt.p);
      return { blocked: false, attackerDies: false, deadBlockers: [], playerDamage: dmg, lifelink: ak.lifelink ? dmg : 0 };
    }

    const alive = new Set(list);
    const dead = [];
    let attackerAlive = true;
    let playerDamage = 0;
    const aFirst = !!ak['first strike'];

    // Step one: first strike, both sides at once.
    let step1 = { killed: [], trample: 0 };
    if (aFirst) step1 = assignCombatDamage(apt, ak, list, alive);
    let fsDamage = 0, fsTouch = false;
    for (const b of list) {
      if (!b.kw['first strike']) continue;
      fsDamage += Math.max(0, b.pt.p);
      if (b.kw.deathtouch && b.pt.p > 0) fsTouch = true;
    }
    step1.killed.forEach(b => { alive.delete(b); dead.push(b.card); });
    playerDamage += step1.trample;
    if (fsDamage >= apt.t || fsTouch) attackerAlive = false;

    // Step two: everything without first strike, both sides at once. A blocker
    // the attacker kills here still deals its damage, which is what makes a
    // double block work: two 3/3s kill a 5/5 even though one of them dies.
    const standing = new Set(alive);
    if (attackerAlive && !aFirst) {
      const step2 = assignCombatDamage(apt, ak, list, standing);
      step2.killed.forEach(b => { alive.delete(b); dead.push(b.card); });
      playerDamage += step2.trample;
    }
    if (attackerAlive) {
      let dmg = 0, touch = false;
      for (const b of list) {
        if (!standing.has(b) || b.kw['first strike']) continue;
        dmg += Math.max(0, b.pt.p);
        if (b.kw.deathtouch && b.pt.p > 0) touch = true;
      }
      if (dmg >= apt.t || touch) attackerAlive = false;
    }

    const dealt = aFirst || attackerAlive;
    return {
      blocked: true,
      attackerDies: !attackerAlive,
      deadBlockers: dead,
      playerDamage,
      lifelink: ak.lifelink && dealt ? Math.max(0, apt.p) : 0
    };
  }

  // Kept for the old call sites and the tests: would this blocker kill the
  // attacker, and would it live through it?
  function blockIsFavourable(attacker, blocker){
    const r = combatResult(attacker, [blocker]);
    const blockerKills = r.attackerDies;
    const blockerSurvives = !r.deadBlockers.includes(blocker);
    return { blockerKills, blockerSurvives, trade: blockerKills && !blockerSurvives };
  }

  // One pass of the defender's block assignment, scariest attacker first.
  // `allowMulti` decides whether two blockers may gang up on one attacker.
  // Returns the assignment and what it is worth, so the caller can compare.
  function planBlocksPass(attackers, blockers, defenderLife, allowMulti){
    const pairs = new Map();
    const used = new Set();
    let total = 0;
    const pool = (blockers || []).slice();
    if (!pool.length) return { pairs, total };

    const incoming = attackers.reduce((s, a) => s + Math.max(0, A.effectivePT(a).p), 0);
    let unblocked = incoming;
    const facingLethal = incoming >= defenderLife;

    const ordered = [...attackers].sort((a, b) => {
      const pa = A.effectivePT(a).p + creatureValue(a) * 0.4;
      const pb = A.effectivePT(b).p + creatureValue(b) * 0.4;
      return pb - pa;
    });

    for (const attacker of ordered) {
      const options = pool.filter(b => !used.has(b) && canBlock(attacker, b));
      if (!options.length) continue;
      const menace = !!keywordsOf(attacker).menace;
      const power = Math.max(0, A.effectivePT(attacker).p);
      const desperate = facingLethal && unblocked >= defenderLife;

      let best = null;
      const consider = (group) => {
        if (menace && group.length < 2) return;
        const r = combatResult(attacker, group);
        const lost = group
          .filter(b => r.deadBlockers.includes(b))
          .reduce((s, b) => s + creatureValue(b), 0);
        const gained = r.attackerDies ? creatureValue(attacker) : 0;
        const saved = Math.max(0, power - r.playerDamage);
        // Material first in a normal game, life first when the next hit kills.
        let score = gained * 1.2 - lost * 1.0 + saved * (desperate ? 2.4 : 0.85);
        if (desperate && saved > 0) score += 4;
        if (group.length > 1) score -= 0.6;            // multi-blocks cost tempo
        if (!best || score > best.score) best = { group, score, saved };
      };

      options.forEach(b => consider([b]));
      // Two blockers on one attacker: the way a big creature actually dies.
      if (allowMulti && options.length > 1) {
        for (let i = 0; i < options.length; i++) {
          for (let j = i + 1; j < options.length; j++) consider([options[i], options[j]]);
        }
      }

      if (!best) continue;
      // A block has to be worth taking: it kills something, saves real damage,
      // or the alternative is dying this turn.
      if (best.score <= 0 && !desperate) continue;

      pairs.set(attacker, best.group);
      best.group.forEach(b => used.add(b));
      unblocked = Math.max(0, unblocked - best.saved);
      total += best.score;
    }
    return { pairs, total };
  }

  // The defender's best blocks. Used twice: for real when the bot blocks, and
  // as a model of the human when the bot decides whether to attack.
  //
  // Returns a Map of attacker -> [blockers]. A blocker is used once.
  //
  // Two passes, because taking the attackers one at a time is short-sighted:
  // ganging up on the biggest attacker can eat the only blocker that could
  // have handled the flier behind it. Running the assignment with and without
  // multi-blocks and keeping the better total fixes that without a full search.
  function planBlocks(attackers, blockers, defenderLife, opts = {}){
    const skill = typeof opts.skill === 'number' ? opts.skill : 1;
    const multi = planBlocksPass(attackers, blockers, defenderLife, true);
    const single = attackers.length > 1
      ? planBlocksPass(attackers, blockers, defenderLife, false)
      : multi;
    const best = single.total > multi.total ? single : multi;
    if (skill >= 1) return best.pairs;
    // Weaker bots miss blocks they have already found.
    const kept = new Map();
    for (const [attacker, group] of best.pairs) {
      if (Math.random() <= skill) kept.set(attacker, group);
    }
    return kept;
  }

  // What an attack is actually worth, once the defender has blocked as well as
  // it can: damage through, material traded, life gained, and whether it wins.
  function evaluateAttack(attackers, defenderCards, defenderLife, opts = {}){
    const pairs = planBlocks(attackers, defenderCards, defenderLife, { skill: 1 });
    let damage = 0, attackerLoss = 0, blockerLoss = 0, lifegain = 0;
    for (const a of attackers) {
      const r = combatResult(a, pairs.get(a) || []);
      damage += r.playerDamage;
      lifegain += r.lifelink;
      if (r.attackerDies) attackerLoss += creatureValue(a);
      blockerLoss += r.deadBlockers.reduce((s, b) => s + creatureValue(b), 0);
    }
    const wins = damage >= defenderLife;
    // Damage counts for more once the defender is within a couple of swings:
    // at that point life is the resource that decides the game, not material.
    const dmgWeight = defenderLife <= damage * 3 ? 1.6 : 1.0;
    const score = wins ? 1000 : damage * dmgWeight + (blockerLoss - attackerLoss) * 1.25 + lifegain * 0.35;
    return { damage, attackerLoss, blockerLoss, lifegain, wins, score, pairs, ...opts };
  }

  function humanUntappedBlockers(){
    return fieldCards(humanPlayer()).filter(c => isCreatureCard(c) && !c.tapped);
  }

  // A creature that arrived this turn cannot attack, but it can block. The old
  // filter kept summoning-sick creatures out of the block step, which left the
  // bot standing there while a fresh body watched the damage go past.
  function aiUntappedBlockers(){
    return fieldCards(aiPlayer()).filter(c => isCreatureCard(c) && !c.tapped);
  }

  function readyAttackers(){
    return fieldCards(aiPlayer()).filter(c =>
      isCreatureCard(c) && !c.tapped && !c.aiSick && !keywordsOf(c).defender && A.effectivePT(c).p > 0);
  }

  // How hard the human can hit back next turn, and whether the bot has to stop
  // racing and start blocking.
  function pressure(){
    const me = aiPlayer();
    const swingBack = fieldCards(humanPlayer())
      .filter(c => isCreatureCard(c) && !keywordsOf(c).defender)
      .reduce((s, c) => s + Math.max(0, A.effectivePT(c).p), 0);
    return {
      swingBack,
      life: me.health,
      mustStabilise: swingBack > 0 && me.health <= swingBack,
      pressed: swingBack > 0 && me.health <= swingBack + 5
    };
  }

  function chooseAttackers(){
    const ready = readyAttackers();
    if (!ready.length) return [];

    const human = humanPlayer();
    const blockers = humanUntappedBlockers();
    if (!blockers.length) return ready;                  // open field: everyone swings

    // Does swinging with everything win the game right now?
    const all = evaluateAttack(ready, blockers, human.health);
    if (all.wins) return ready;

    const p = pressure();
    // Am I racing or stabilising? If my clock is at least as fast as theirs,
    // holding creatures back only loses the race slowly.
    const myClock = evaluateAttack(ready, blockers, human.health).damage;
    const turnsToWin = myClock > 0 ? Math.ceil(human.health / myClock) : 99;
    const turnsToDie = p.swingBack > 0 ? Math.ceil(p.life / p.swingBack) : 99;
    const racing = turnsToWin <= turnsToDie;

    // Attacking taps the creature, so a creature that has to block at home is
    // worth keeping back. Vigilance costs nothing, and a race costs nothing
    // either: blockers that never win the game are not worth keeping.
    const holdCost = (c) => {
      if (keywordsOf(c).vigilance || racing) return 0;
      // Only worth keeping home while the bot is losing the race. Measured:
      // holding blockers back any more freely than this loses more games than
      // it saves, because the attack that never comes never wins either.
      if (p.mustStabilise) return creatureValue(c) * 0.5;
      return 0;
    };

    const scoreOf = (set) => set.length
      ? evaluateAttack(set, blockers, human.health).score - set.reduce((s, x) => s + holdCost(x), 0)
      : 0;

    // Build up one attacker at a time. This finds the careful attacks.
    const forward = [];
    let forwardScore = 0;
    for (let guard = 0; guard < ready.length; guard++) {
      let bestAdd = null;
      for (const c of ready) {
        if (forward.includes(c)) continue;
        const score = scoreOf([...forward, c]);
        if (score > forwardScore + 0.05 && (!bestAdd || score > bestAdd.score)) bestAdd = { card: c, score };
      }
      if (!bestAdd) break;
      forward.push(bestAdd.card);
      forwardScore = bestAdd.score;
    }

    // Then tear down from the full attack. This finds the swarm: five small
    // creatures into two blockers is a fine attack even though every one of
    // them alone would be eaten, and growing an attack one card at a time can
    // never see it.
    let backward = ready.slice();
    let backwardScore = scoreOf(backward);
    for (let guard = 0; guard < ready.length && backward.length > 1; guard++) {
      let bestDrop = null;
      for (const c of backward) {
        const score = scoreOf(backward.filter(x => x !== c));
        if (score > backwardScore + 0.05 && (!bestDrop || score > bestDrop.score)) bestDrop = { card: c, score };
      }
      if (!bestDrop) break;
      backward = backward.filter(x => x !== bestDrop.card);
      backwardScore = bestDrop.score;
    }

    // Ahead on board, a level trade is still progress: it clears the way.
    const ahead = ready.length > blockers.length;
    const floor = ahead ? -2.5 : 0;
    let chosen = [];
    let bestScore = floor;
    for (const [set, score] of [[forward, forwardScore], [backward, backwardScore]]) {
      if (set.length && score > bestScore) { chosen = set.slice(); bestScore = score; }
    }

    // Weaker bots swing into blocks they should respect.
    const greedy = diff().greedyAttack;
    if (greedy > 0) {
      for (const c of ready) if (!chosen.includes(c) && Math.random() < greedy) chosen.push(c);
    }
    return chosen;
  }

  // Returns { attackerId: [blockers] }. Each blocker is used at most once.
  function aiChooseBlocks(attackers){
    const me = aiPlayer();
    const pairs = planBlocks(attackers, aiUntappedBlockers(), me.health, { skill: diff().blockSkill });
    const assignments = {};
    for (const [attacker, group] of pairs) {
      assignments[attacker.gameId || attacker.id] = group.length === 1 ? group[0] : group;
    }
    return assignments;
  }

  // ------------------------------------------------------- spell text engine

  // Understand a handful of common effect templates; anything else stays in hand.
  function analyzeSpell(card){
    const text = ((card.effect || '') + '').toLowerCase();
    const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
    const num = (s) => WORD_NUM[s] || parseInt(s, 10) || 0;

    let m = text.match(/deal(?:s)? (\d+) damage/);
    if (m) return { kind: 'damage', n: num(m[1]), canHitPlayer: /player|opponent|any target|each opponent/.test(text) };
    m = text.match(/destroy target creature/);
    if (m) return { kind: 'destroy' };
    m = text.match(/draw (a|an|one|two|three|four|\d+) cards?/);
    if (m) return { kind: 'draw', n: num(m[1]) };
    m = text.match(/(?:you )?gain (\d+) life/);
    if (m) return { kind: 'lifegain', n: num(m[1]) };
    return { kind: 'unknown' };
  }

  // Every creature the human controls, with its zone, so removal can lift it
  // out of the right array.
  function humanCreatureTargets(predicate){
    const human = humanPlayer();
    const out = [];
    for (const z of A.BATTLE_ZONE_KEYS) {
      (human[z] || []).forEach((c, idx) => {
        if (!isCreatureCard(c)) return;
        if (keywordsOf(c).hexproof) return;
        if (predicate && !predicate(c)) return;
        out.push({ zone: z, idx, card: c });
      });
    }
    return out;
  }

  // The right thing to point removal at. Weaker bots aim worse on purpose.
  function bestRemovalTarget(predicate){
    const options = humanCreatureTargets(predicate);
    if (!options.length) return null;
    if (Math.random() > diff().targetSkill) {
      return options[Math.floor(Math.random() * options.length)];
    }
    return options.reduce((best, o) => (!best || threatValue(o.card) > threatValue(best.card) ? o : best), null);
  }

  // Would killing this creature open up a lethal attack this turn?
  function removalUnlocksLethal(victim){
    const ready = readyAttackers();
    if (!ready.length) return false;
    const human = humanPlayer();
    const blockers = humanUntappedBlockers().filter(c => c !== victim);
    return evaluateAttack(ready, blockers, human.health).wins;
  }

  function removeFromZone(player, zone, card){
    const arr = player[zone];
    const i = arr.indexOf(card);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0;
  }

  // ----------------------------------------------------------- main planning

  // Every card in `hand` the bot can pay for out of `pool`, scored by what it
  // is worth on this board right now.
  function candidatePlays(hand, pool){
    const me = aiPlayer();
    const human = humanPlayer();
    const p = pressure();
    const holdInstants = diff().holdInstants;
    const out = [];

    for (const card of hand) {
      if (isLandCard(card)) continue;
      const payment = planPaymentFrom(card.cost, pool);
      if (!payment) continue;
      const cmc = Math.max(0, A.getCMC(card) || 0);

      if (isCreatureCard(card)) {
        const pt = A.effectivePT(card);
        let score = 8 + creatureValue(card) * 1.1 - cmc * 0.15;
        if (p.mustStabilise) score += pt.t * 0.9;              // a body to block with
        if (p.mustStabilise && keywordsOf(card).lifelink) score += 2;
        out.push({ card, payment, cmc, kind: 'creature', score });
        continue;
      }
      if (isPermanentCard(card)) {
        out.push({ card, payment, cmc, kind: 'permanent', score: 5 + cmc * 0.4 });
        continue;
      }

      const spell = analyzeSpell(card);
      if (spell.kind === 'damage') {
        // Face for the win first, then the biggest thing it can actually kill.
        if (spell.canHitPlayer !== false && human.health <= spell.n) {
          out.push({ card, payment, cmc, spell, target: null, kind: 'spell', score: 1000 });
          continue;
        }
        const target = bestRemovalTarget(c => A.effectivePT(c).t <= spell.n);
        if (target) {
          const worth = threatValue(target.card);
          const unlocks = removalUnlocksLethal(target.card);
          const hold = holdInstants && isInstantCard(card) && worth < 2.5 && !unlocks && !p.pressed;
          if (!hold) out.push({ card, payment, cmc, spell, target, kind: 'spell', score: unlocks ? 900 : 7 + worth });
          continue;
        }
        // Nothing worth killing: burn the player rather than sit on it, but
        // only once the board has stopped mattering.
        if (spell.canHitPlayer !== false && (!holdInstants || !isInstantCard(card) || human.health <= spell.n * 3)) {
          out.push({ card, payment, cmc, spell, target: null, kind: 'spell', score: 4 + spell.n });
        }
        continue;
      }
      if (spell.kind === 'destroy') {
        const target = bestRemovalTarget();
        if (!target) continue;
        const worth = threatValue(target.card);
        const unlocks = removalUnlocksLethal(target.card);
        const floor = p.pressed ? 2.5 : 3.5;
        if (worth < floor && !unlocks && holdInstants) continue;   // save it for a real threat
        out.push({ card, payment, cmc, spell, target, kind: 'spell', score: unlocks ? 900 : 6 + worth });
        continue;
      }
      if (spell.kind === 'draw') {
        out.push({ card, payment, cmc, spell, kind: 'spell', score: 5 + spell.n - (p.mustStabilise ? 2 : 0) });
        continue;
      }
      if (spell.kind === 'lifegain') {
        if (me.health < 14 || p.mustStabilise) {
          out.push({ card, payment, cmc, spell, kind: 'spell', score: (p.mustStabilise ? 7 : 3) + spell.n });
        }
        continue;
      }
      // unknown spells stay in hand: the sandbox cannot resolve their text
    }
    return out;
  }

  // Spending mana is worth something in itself, which is what makes the bot
  // take two two-drops over one three-drop when both fit.
  const MANA_WEIGHT = 0.9;
  const PLAN_BREADTH = 5;

  // The best sequence of plays for this main phase, looked at `depth` cards
  // deep. Returns the first play of that sequence, which is the one to make.
  function planMainPlay(hand, pool, depth){
    const options = candidatePlays(hand, pool);
    if (!options.length) return null;
    options.sort((a, b) => b.score - a.score);
    const top = options.slice(0, PLAN_BREADTH);
    let best = null;
    for (const play of top) {
      let total = play.score + MANA_WEIGHT * play.cmc;
      if (depth > 1) {
        const restHand = hand.filter(c => c !== play.card);
        const restPool = pool.filter(l => !play.payment.includes(l));
        const sub = planMainPlay(restHand, restPool, depth - 1);
        if (sub) total += sub.total;
      }
      if (!best || total > best.total) best = { ...play, total };
    }
    return best;
  }

  // ------------------------------------------------------------ the AI turn

  let aiRunning = false;
  // Set while the human is assigning blockers: the AI turn is suspended, not
  // finished, so onRender must not start a second one behind it.
  let awaitingBlocks = false;

  async function runAiTurn(){
    if (aiRunning || awaitingBlocks || !aiGameActive() || state.activePlayer !== AI_SEAT) return;
    aiRunning = true;
    state.aiActing = true;
    try {
      const mode = state.gameState.mode || state.battleMode;
      if (mode === 'horde') { await runHordeTurn(); return; }
      if (mode === 'land-game') { await runLandGameTurn(); return; }
      if (mode === 'boss') { await runBossTurn(); return; }
      await runStandardTurn();
    } finally {
      // Keep the lock held across the blocker prompt; resolveAiCombat frees it.
      if (!awaitingBlocks) { aiRunning = false; state.aiActing = false; }
    }
  }

  async function step(ms = 650){
    await delay(ms);
    return aiGameActive() && state.activePlayer === AI_SEAT;
  }

  function act(type, payload, mutator, message){
    return A.executeGameAction(type, payload, mutator, message, { ms: 1200 });
  }

  // Which land to play: the one that lets the bot cast the most this turn, with
  // the colour the rest of the hand needs as the tiebreak.
  function chooseLand(){
    const me = aiPlayer();
    const landsInHand = me.hand.filter(isLandCard);
    if (!landsInHand.length) return null;

    const needs = {};
    for (const c of me.hand) {
      if (isLandCard(c)) continue;
      for (const opts of parseCost(c.cost).colored) for (const col of opts) needs[col] = (needs[col] || 0) + 1;
    }
    const byNeed = [...landsInHand].sort((a, b) => (needs[landColor(b)] || 0) - (needs[landColor(a)] || 0));
    if (diff().planDepth < 2) return byNeed[0];

    // Try each distinct land and keep the one that opens the best main phase.
    const seen = new Set();
    let best = null;
    for (const land of byNeed) {
      const key = land.name + '|' + landColor(land);
      if (seen.has(key)) continue;
      seen.add(key);
      const pool = manaPool().concat([{ card: land, color: landColor(land) }]);
      const hand = me.hand.filter(c => c !== land);
      const plan = planMainPlay(hand, pool, diff().planDepth);
      const total = plan ? plan.total : 0;
      if (!best || total > best.total) best = { land, total };
    }
    return best ? best.land : byNeed[0];
  }

  async function runStandardTurn(){
    const me = aiPlayer();

    // Untap, clear last turn's summoning sickness, and draw: one line in the
    // log, because it is one routine step and not a decision.
    const drawPile = (state.gameState.shared && state.gameState.shared.enabled) ? state.gameState.shared.deck : me.deck;
    act('ai_upkeep', { player: AI_SEAT }, () => {
      fieldCards(me).forEach(c => {
        delete c.aiSick;
        if (!c.tapped) return;
        if (typeof c.stun === 'number' && c.stun > 0) { c.stun -= 1; }
        else { c.tapped = false; }
      });
      state.gameState.phase = 'Main';
      if (drawPile.length) {
        const card = drawPile.shift();
        if (!('tapped' in card)) card.tapped = false;
        me.hand.push(card);
        return true;
      }
      return false;
    }, (drew) => drew
      ? `AI untaps and draws a card (${me.hand.length} in hand).`
      : 'AI untaps. It has no cards left to draw.');
    if (!await step()) return;

    // Play a land.
    const land = chooseLand();
    if (land) {
      act('ai_play_land', { cardName: land.name }, () => {
        me.hand.splice(me.hand.indexOf(land), 1);
        me.landField.push({ ...land, tapped: false });
      }, `AI plays ${land.name}.`);
      if (!await step()) return;
    }

    // Main phase: work down the planned sequence until nothing is worth casting.
    let castGuard = 0;
    while (castGuard++ < 12) {
      const played = castBestSpell();
      if (!played) break;
      if (!await step(700)) return;
    }

    // Combat.
    const attackers = chooseAttackers();
    if (attackers.length) {
      act('ai_attack_declare', { count: attackers.length }, () => {
        state.gameState.phase = 'Combat';
        attackers.forEach(c => { if (!keywordsOf(c).vigilance) c.tapped = true; c.aiAttacking = true; });
        const rules = window.GALDUR_RULES;
        if (rules) attackers.forEach(c => rules.onAttacks(c, aiPlayer()));
      }, `AI attacks with ${attackers.length} creature${attackers.length === 1 ? '' : 's'}.`);
      if (!await step()) return;

      const legalBlockers = humanUntappedBlockers();
      if (legalBlockers.length) {
        // Hand control to the human: GameBoard shows the blocker modal and
        // calls resolveAiCombat() when they confirm.
        awaitingBlocks = true;
        state.aiActing = false;
        state.targeting = { type: 'ai-blockers' };
        A.render();
        return; // turn resumes in resolveAiCombat -> finishAiTurn
      }
      resolveCombatDamage({});
      if (!await step()) return;
    }

    await finishAiTurn();
  }

  // Take the first play of the planned main phase and make it.
  function castBestSpell(){
    const me = aiPlayer();
    const pick = planMainPlay(me.hand, manaPool(), diff().planDepth);
    if (!pick) return false;

    // Weaker bots sit on their best play, or take a worse line instead.
    if (Math.random() < diff().castSkip) {
      const others = candidatePlays(me.hand, manaPool()).filter(p => p.card !== pick.card);
      if (!others.length || Math.random() < 0.5) return false;
      others.sort((a, b) => b.score - a.score);
      return castPlay(others[0]);
    }
    return castPlay(pick);
  }

  function castPlay(pick){
    if (!pick) return false;
    const payment = pick.payment.map(l => l.card || l);

    act('ai_cast', { cardName: pick.card.name }, () => {
      tapLands(payment);
      const me2 = aiPlayer();
      me2.hand.splice(me2.hand.indexOf(pick.card), 1);
      const battleCard = { ...pick.card, tapped: false };
      if (!('pt' in battleCard)) battleCard.pt = { p: 0, t: 0 };
      if (!('stun' in battleCard)) battleCard.stun = 0;

      if (pick.kind === 'creature' || pick.kind === 'permanent') {
        if (pick.kind === 'creature' && !keywordsOf(battleCard).haste) battleCard.aiSick = true;
        me2[A.defaultZoneForCard(battleCard)].push(battleCard);
        const note = window.GALDUR_RULES ? window.GALDUR_RULES.onEnter(battleCard, me2) : '';
        return `AI casts ${battleCard.name}.${note ? ' ' + note : ''}`;
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
            msg += `: ${pick.spell.n} damage destroys your ${victim.name}.`;
          } else {
            msg += `: ${pick.spell.n} damage to ${victim.name}. It survives.`;
          }
        } else {
          human.health = Math.max(0, human.health - pick.spell.n);
          msg += `: ${pick.spell.n} damage to you.`;
        }
      } else if (pick.spell.kind === 'destroy') {
        const victim = pick.target.card;
        removeFromZone(human, pick.target.zone, victim);
        human.graveyard.push({ ...victim, tapped: false });
        msg += `: destroys your ${victim.name}.`;
      } else if (pick.spell.kind === 'draw') {
        for (let i = 0; i < pick.spell.n && me2.deck.length; i++) me2.hand.push(me2.deck.shift());
        msg += `: draws ${pick.spell.n}.`;
      } else if (pick.spell.kind === 'lifegain') {
        me2.health += pick.spell.n;
        msg += `: gains ${pick.spell.n} life.`;
      }
      me2.graveyard.push(battleCard);
      A.checkWinner();
      return msg;
    }, (msg) => msg);
    return true;
  }

  // Shared damage resolution. `assignments` maps an attacker's id to a blocker
  // id (the human blocking), a blocker card, or an array of either (the bot
  // multi-blocking one large attacker).
  function resolveCombat({ attackerPlayer, defenderPlayer, attackers, assignments, label, hitText }){
    act('combat', {}, () => {
      const lines = [];
      const deadAttackers = [];
      const deadBlockers = [];

      for (const attacker of attackers) {
        delete attacker.aiAttacking;
        delete attacker.playerAttacking;
        const raw = assignments[attacker.gameId || attacker.id];
        const list = (Array.isArray(raw) ? raw : [raw])
          .filter(Boolean)
          .map(entry => typeof entry === 'string'
            ? fieldCards(defenderPlayer).find(c => (c.gameId || c.id) === entry)
            : entry)
          .filter(Boolean);

        const r = combatResult(attacker, list);
        if (r.lifelink) attackerPlayer.health += r.lifelink;

        if (!r.blocked) {
          defenderPlayer.health = Math.max(0, defenderPlayer.health - r.playerDamage);
          lines.push(hitText(attacker, r.playerDamage));
          continue;
        }

        if (r.playerDamage > 0) {
          defenderPlayer.health = Math.max(0, defenderPlayer.health - r.playerDamage);
        }
        deadBlockers.push(...r.deadBlockers);
        if (r.attackerDies) deadAttackers.push(attacker);

        const names = list.map(c => c.name).join(' and ');
        const died = [
          ...r.deadBlockers.map(c => `${c.name} dies`),
          ...(r.attackerDies ? [`${attacker.name} dies`] : [])
        ];
        lines.push(`${names} blocks ${attacker.name}`
          + (r.playerDamage > 0 ? `, ${r.playerDamage} tramples over` : '')
          + (died.length ? `: ${died.join(', ')}` : '')
          + '.');
      }

      const rules = window.GALDUR_RULES;
      for (const c of deadBlockers) {
        for (const z of A.BATTLE_ZONE_KEYS) if (removeFromZone(defenderPlayer, z, c)) break;
        defenderPlayer.graveyard.push({ ...c, tapped: false, aiAttacking: undefined, playerAttacking: undefined });
        if (rules) { const n = rules.onDies(c, defenderPlayer); if (n) lines.push(n); }
      }
      for (const c of deadAttackers) {
        for (const z of A.BATTLE_ZONE_KEYS) if (removeFromZone(attackerPlayer, z, c)) break;
        attackerPlayer.graveyard.push({ ...c, tapped: false, aiAttacking: undefined, playerAttacking: undefined });
        if (rules) { const n = rules.onDies(c, attackerPlayer); if (n) lines.push(n); }
      }
      A.checkWinner();
      if (A.checkHordeVictory) A.checkHordeVictory();
      return lines.length ? `${label}: ` + lines.join(' ') : 'No combat damage.';
    }, (msg) => msg);
  }

  // The bot attacked; the human has assigned blockers.
  function resolveCombatDamage(assignments){
    resolveCombat({
      attackerPlayer: aiPlayer(),
      defenderPlayer: humanPlayer(),
      attackers: fieldCards(aiPlayer()).filter(c => c.aiAttacking),
      assignments: assignments || {},
      label: 'Combat',
      hitText: (a, dmg) => `${a.name} hits you for ${dmg}.`
    });
  }

  async function resolveAiCombat(assignments){
    if (!awaitingBlocks) return;          // ignore stray/double clicks
    state.targeting = null;
    state.aiActing = true;
    try {
      resolveCombatDamage(assignments || {});
      await delay(900);
      const mode = state.gameState.mode || state.battleMode;
      if (mode === 'horde') endHordeTurn();
      else await finishAiTurn();
    } finally {
      awaitingBlocks = false;
      aiRunning = false;
      state.aiActing = false;
    }
  }

  // The human declared attackers; the bot blocks and damage resolves.
  async function playerAttack(attackerIds){
    const me = humanPlayer();
    const attackers = fieldCards(me).filter(c => attackerIds.includes(c.gameId || c.id));
    if (!attackers.length) return;

    attackers.forEach(c => { if (!keywordsOf(c).vigilance) c.tapped = true; });
    act('player_attack', { count: attackers.length }, () => {
      state.gameState.phase = 'Combat';
    }, `You attack with ${attackers.length} creature${attackers.length === 1 ? '' : 's'}.`);
    await delay(700);

    const assignments = aiChooseBlocks(attackers);
    const blocked = Object.keys(assignments).length;
    if (blocked) {
      A.showAction(`The opponent blocks ${blocked} attacker${blocked === 1 ? '' : 's'}.`, 1400);
      await delay(900);
    }
    resolveCombat({
      attackerPlayer: me,
      defenderPlayer: aiPlayer(),
      attackers,
      assignments,
      label: 'Your attack',
      hitText: (a, dmg) => `${a.name} hits the opponent for ${dmg}.`
    });
  }

  async function finishAiTurn(){
    if (!aiGameActive()) return;
    state.gameState.phase = 'Second Main';
    // One more casting window with whatever mana combat left over.
    let guard = 0;
    while (guard++ < 6) {
      if (!castBestSpell()) break;
      if (!await step(700)) return;
    }
    act('ai_end_turn', {}, () => {
      state.gameState.phase = 'Draw';
      state.activePlayer = 1;
      state.showTurnNotification = true;
      setTimeout(() => { state.showTurnNotification = false; A.render(); }, 2000);
    }, 'AI ends its turn. Your turn.');
  }

  // ------------------------------------------------ mode-specific autopilots

  // The boss plays a normal turn, then escalates: every few rounds it adds a
  // free minion, and late on it also drains the survivors. Those two dials plus
  // its life total are the whole boss advantage; it plays the same bot.
  // Escalation runs first, then the boss takes an ordinary turn, so the normal
  // turn still owns the combat handoff and its own ending.
  async function runBossTurn(){
    state.bossRound = (state.bossRound || 0) + 1;
    const round = state.bossRound;

    const every = diff().bossEvery;
    if (round >= every && round % every === 0) {
      const size = Math.min(2 + Math.floor(round / every), 6);
      act('boss_minion', { round }, () => {
        aiPlayer().creatureField.push({
          id: 'minion' + round + Math.random(),
          gameId: 'boss-minion-' + round + '-' + Math.random().toString(36).slice(2),
          name: `Summoned Horror ${Math.round(round / every)}`,
          type: 'Creature Token - Horror',
          cost: '', colors: ['B'], effect: round >= 10 ? 'Trample.' : '',
          power: size, toughness: size,
          tapped: false, isToken: true, generated: true, aiSick: true,
          pt: { p: 0, t: 0 }, stun: 0
        });
      }, `The boss summons a ${size}/${size} Horror.`);
      if (!await step(900)) return;
    }

    if (round >= diff().bossDrainFrom) {
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

    // The Horde swings with everything that is awake. The survivors get to
    // block it, exactly like any other attack.
    const attackers = fieldCards(aiPlayer()).filter(c =>
      isCreatureCard(c) && !c.tapped && !c.aiSick);
    if (attackers.length) {
      act('horde_attack_declare', { count: attackers.length }, () => {
        attackers.forEach(c => { c.tapped = true; c.aiAttacking = true; });
      }, `The Horde attacks with ${attackers.length} creature${attackers.length === 1 ? '' : 's'}.`);
      if (!await step(800)) return;

      if (humanUntappedBlockers().length) {
        awaitingBlocks = true;
        state.aiActing = false;
        state.targeting = { type: 'ai-blockers' };
        A.render();
        return;                       // resumes in resolveAiCombat
      }
      resolveCombatDamage({});
      if (!await step(1000)) return;
    }

    await endHordeTurn();
  }

  function endHordeTurn(){
    act('ai_end_turn', {}, () => {
      state.activePlayer = 1;
      state.showTurnNotification = true;
      setTimeout(() => { state.showTurnNotification = false; A.render(); }, 2000);
    }, 'The Horde is done. Your turn.');
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
        me.landField.push({ ...land, tapped: false });
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
          return `AI plays Swamp. You discard ${gone.name}.`;
        }
        if (land.name === 'Mountain') {
          const targets = fieldCards(human);
          if (targets.length) {
            const t = targets[Math.floor(Math.random() * targets.length)];
            for (const z of A.BATTLE_ZONE_KEYS) if (removeFromZone(human, z, t)) break;
            human.graveyard.push(t);
            return `AI plays Mountain. It destroys your ${t.name}.`;
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
    }, 'AI ends its turn. Your turn.');
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
    if (!aiGameActive() && state.aiActing) state.aiActing = false;
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
    playerAttack,
    aiUntappedBlockers,
    DIFFICULTY,
    difficulty: diff,
    humanUntappedBlockers,
    canBlock,
    keywordsOf,
    creatureValue,
    draftCardScore,
    // The decision layer, exposed so the tests and the tuning harness can ask
    // the bot what it would do without waiting for an animated turn.
    chooseAttackers,
    aiChooseBlocks,
    planBlocks,
    evaluateAttack,
    combatResult,
    blockIsFavourable,
    candidatePlays,
    planMainPlay,
    threatValue,
    pressure
  };
}

boot();
})();
