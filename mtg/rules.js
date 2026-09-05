/* Galdur rules engine — card text that actually does something.
 *
 * Loaded after app.js. Registers window.GALDUR_RULES.
 *
 * SCOPE, deliberately narrow: this interprets a subset of real Magic wording —
 * static anthems, enter/die/attack triggers, and a few one-shot effects. It is
 * NOT a complete rules implementation and never will be. Anything it does not
 * recognise is simply left alone for the players to adjudicate, which is the
 * same contract the rest of the app has always had.
 *
 * It runs in BOT GAMES ONLY. Games between people stay self-enforced, so a
 * misparse can never overrule a human opponent.
 */
(function(){
'use strict';

const POLL_MS = 120;

function boot(){
  const A = window.GALDUR_APP;
  if (!A) { setTimeout(boot, POLL_MS); return; }
  const { state } = A;

  const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const num = (s) => WORD_NUM[String(s).toLowerCase()] || parseInt(s, 10) || 0;
  const textOf = (card) => ((card && card.effect) || '') + '';
  const typeOf = (card) => ((card && card.type) || '') + '';
  const isCreature = (c) => /creature/i.test(typeOf(c)) || !!(c && c.isToken);

  // Enforcement is for bot games; human tables stay on the honour system.
  function active(){
    return !!(state.vsAI && !state.onlineMode && !state.replayMode);
  }

  // --- parsing --------------------------------------------------------------

  // "Other creatures you control get +1/+1" / "Creatures you control get +2/+0"
  const ANTHEM_RE = /(other\s+)?(creatures|goblins|zombies|elves|soldiers|knights|spirits)\s+you\s+control\s+get\s+([+-]\d+)\/([+-]\d+)/i;

  function parseAnthem(card){
    const m = textOf(card).match(ANTHEM_RE);
    if (!m) return null;
    return {
      othersOnly: !!m[1],
      tribe: m[2].toLowerCase() === 'creatures' ? null : m[2].toLowerCase().replace(/s$/, ''),
      p: parseInt(m[3], 10) || 0,
      t: parseInt(m[4], 10) || 0
    };
  }

  // One-shot effects, shared by triggers and by cast spells.
  function parseEffects(text){
    const out = [];
    const src = String(text || '').toLowerCase();

    let m = src.match(/deals?\s+(\d+)\s+damage\s+to\s+(any target|target creature or player|target creature|target player|each opponent|you)/);
    if (m) out.push({ kind: 'damage', n: num(m[1]), target: m[2] });

    m = src.match(/(?:you\s+)?gain\s+(\d+|a|an|one|two|three|four|five)\s+life/);
    if (m) out.push({ kind: 'lifegain', n: num(m[1]) });

    m = src.match(/(?:each opponent|target player)\s+loses\s+(\d+|a|one|two|three)\s+life/);
    if (m) out.push({ kind: 'drain', n: num(m[1]) });

    m = src.match(/draw\s+(a|an|one|two|three|four|\d+)\s+cards?/);
    if (m) out.push({ kind: 'draw', n: num(m[1]) });

    m = src.match(/destroy\s+target\s+creature/);
    if (m) out.push({ kind: 'destroy' });

    m = src.match(/put\s+(a|an|one|two|\d+)\s+\+1\/\+1\s+counters?\s+on/);
    if (m) out.push({ kind: 'counters', n: num(m[1]) });

    m = src.match(/create\s+(a|an|one|two|three|\d+)\s+(\d+)\/(\d+)\s+([a-z ]+?)\s+creature\s+token/);
    if (m) out.push({ kind: 'token', n: num(m[1]), p: num(m[2]), t: num(m[3]), name: m[4].trim() });

    m = src.match(/scry\s+(\d+)/);
    if (m) out.push({ kind: 'scry', n: num(m[1]) });

    return out;
  }

  // Triggers, keyed by the wording that introduces them.
  function parseTriggers(card){
    const text = textOf(card);
    const triggers = { etb: [], dies: [], attacks: [] };
    // Split on sentence boundaries so one card can carry several abilities.
    for (const sentence of text.split(/(?<=\.)\s+/)) {
      const low = sentence.toLowerCase();
      if (/^when(ever)?\s+(this|~|[a-z' ]+)\s+enters/.test(low) || /^when\s+this\s+creature\s+enters/.test(low)) {
        triggers.etb.push(...parseEffects(sentence));
      } else if (/^when(ever)?\s+(this|~|[a-z' ]+)\s+dies/.test(low)) {
        triggers.dies.push(...parseEffects(sentence));
      } else if (/^when(ever)?\s+(this|~|[a-z' ]+)\s+attacks/.test(low)) {
        triggers.attacks.push(...parseEffects(sentence));
      }
    }
    return triggers;
  }

  // Parsed abilities are cached on the card — text never changes.
  function abilitiesOf(card){
    if (!card) return { anthem: null, triggers: { etb: [], dies: [], attacks: [] } };
    if (!card._abilities) {
      // Non-enumerable: this cache must not end up in JSON.stringify output,
      // which would bloat replay frames, WebRTC payloads and localStorage.
      Object.defineProperty(card, '_abilities', {
        value: { anthem: parseAnthem(card), triggers: parseTriggers(card) },
        enumerable: false, writable: true, configurable: true
      });
    }
    return card._abilities;
  }

  // --- static buffs ---------------------------------------------------------

  function tribeMatches(card, tribe){
    if (!tribe) return true;
    return typeOf(card).toLowerCase().includes(tribe);
  }

  // Total anthem bonus a creature is receiving from its controller's board.
  function staticBonus(card, player){
    if (!active() || !player || !isCreature(card)) return { p: 0, t: 0 };
    let p = 0, t = 0;
    for (const other of A.battlefieldCards(player)) {
      const anthem = abilitiesOf(other).anthem;
      if (!anthem) continue;
      if (anthem.othersOnly && other === card) continue;
      if (!tribeMatches(card, anthem.tribe)) continue;
      p += anthem.p; t += anthem.t;
    }
    return { p, t };
  }

  function ownerOf(card){
    const gs = state.gameState;
    if (!gs) return null;
    for (const key of ['player1', 'player2']) {
      if (A.battlefieldCards(gs[key]).includes(card)) return gs[key];
    }
    return null;
  }

  // --- resolving ------------------------------------------------------------

  function opponentOf(player){
    const gs = state.gameState;
    return player === gs.player1 ? gs.player2 : gs.player1;
  }

  function applyEffects(effects, ctx){
    const notes = [];
    const me = ctx.controller;
    const foe = opponentOf(me);
    if (!me || !foe) return notes;

    for (const fx of effects) {
      if (fx.kind === 'damage') {
        // Without a targeting UI for bot triggers, damage goes at the
        // opponent's face unless the wording clearly names a creature.
        if (/creature/.test(fx.target || '') ) {
          const victim = biggestCreature(foe);
          if (victim) {
            const survived = A.effectivePT(victim).t > fx.n;
            if (!survived) { moveToGraveyard(foe, victim); notes.push(`${fx.n} damage destroys ${victim.name}`); }
            else notes.push(`${fx.n} damage to ${victim.name}`);
          }
        } else {
          foe.health = Math.max(0, foe.health - fx.n);
          notes.push(`${fx.n} damage`);
        }
      } else if (fx.kind === 'lifegain') {
        me.health += fx.n; notes.push(`gain ${fx.n} life`);
      } else if (fx.kind === 'drain') {
        foe.health = Math.max(0, foe.health - fx.n); notes.push(`drain ${fx.n}`);
      } else if (fx.kind === 'draw') {
        for (let i = 0; i < fx.n && me.deck.length; i++) me.hand.push(me.deck.shift());
        notes.push(`draw ${fx.n}`);
      } else if (fx.kind === 'destroy') {
        const victim = biggestCreature(foe);
        if (victim) { moveToGraveyard(foe, victim); notes.push(`destroy ${victim.name}`); }
      } else if (fx.kind === 'counters') {
        const target = ctx.source && isCreature(ctx.source) ? ctx.source : biggestCreature(me);
        if (target) {
          target.pt = target.pt || { p: 0, t: 0 };
          target.pt.p += fx.n; target.pt.t += fx.n;
          notes.push(`+${fx.n}/+${fx.n} on ${target.name}`);
        }
      } else if (fx.kind === 'token') {
        for (let i = 0; i < fx.n; i++) {
          me.creatureField.push(A.initBattleCard({
            id: 'tok' + Math.random(), gameId: 'tok-' + Math.random().toString(36).slice(2),
            name: titleCase(fx.name) + ' Token', type: `Creature Token - ${titleCase(fx.name)}`,
            cost: '', colors: [], effect: '', power: fx.p, toughness: fx.t, isToken: true
          }));
        }
        notes.push(`create ${fx.n} ${fx.p}/${fx.t} ${fx.name}`);
      }
      // 'scry' is a look-at-library effect with no visible board change here.
    }
    return notes;
  }

  function titleCase(s){
    return String(s || 'Creature').replace(/\b\w/g, c => c.toUpperCase());
  }

  function biggestCreature(player){
    let best = null;
    for (const c of A.battlefieldCards(player)) {
      if (!isCreature(c)) continue;
      if (!best || A.effectivePT(c).p > A.effectivePT(best).p) best = c;
    }
    return best;
  }

  function moveToGraveyard(player, card){
    for (const zone of A.BATTLE_ZONE_KEYS) {
      const i = (player[zone] || []).indexOf(card);
      if (i >= 0) { player[zone].splice(i, 1); break; }
    }
    player.graveyard.push({ ...card, tapped: false, pos: undefined });
  }

  // --- public trigger hooks -------------------------------------------------

  function fire(event, card, controller){
    if (!active() || !card) return '';
    const trig = abilitiesOf(card).triggers[event];
    if (!trig || !trig.length) return '';
    const owner = controller || ownerOf(card) || state.gameState.player1;
    const notes = applyEffects(trig, { controller: owner, source: card });
    if (!notes.length) return '';
    A.checkWinner();
    return `${card.name}: ${notes.join(', ')}.`;
  }

  window.GALDUR_RULES = {
    active,
    abilitiesOf,
    parseEffects,
    parseAnthem,
    staticBonus,
    onEnter: (card, controller) => fire('etb', card, controller),
    onDies: (card, controller) => fire('dies', card, controller),
    onAttacks: (card, controller) => fire('attacks', card, controller)
  };
}

boot();
})();
