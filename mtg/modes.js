(function(){
'use strict';

const BASIC_LAND_NAMES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
const TURN_PHASES = ['Draw', 'Main', 'Combat', 'Second Main', 'End'];
const MTG_MODE_LIBRARY = [
  {
    id: 'casual',
    title: 'Casual Custom',
    family: 'Kitchen Table',
    summary: 'Open-ended custom-card play with the current decks.',
    build: true,
    play: true,
    format: 'casual',
    target: 60,
    sizePolicy: { kind: 'recommended', count: 60 },
    maxCopies: 4
  },
  {
    id: 'commander',
    title: 'Commander',
    family: 'Constructed',
    summary: '100-card singleton decks with a commander zone available on the battlefield screen.',
    build: true,
    play: true,
    format: 'commander',
    target: 100,
    sizePolicy: { kind: 'exact', count: 100 },
    singleton: true,
    commanderZone: true,
    commandZoneLabel: 'Commander Zone',
    commandZoneShortLabel: 'Cmd',
    scryfall: 'legal:commander'
  },
  {
    id: 'oathbreaker',
    title: 'Oathbreaker',
    family: 'Community',
    summary: '60-card singleton with a planeswalker-led command zone and a signature-spell slot.',
    build: true,
    play: true,
    format: 'oathbreaker',
    target: 60,
    sizePolicy: { kind: 'exact', count: 60 },
    singleton: true,
    commanderZone: true,
    commandZoneLabel: 'Oathbreaker Zone',
    commandZoneShortLabel: 'Oath',
    commandZoneMax: 2,
    scryfall: 'legal:vintage',
    note: 'Use the two-slot Oathbreaker Zone for the Oathbreaker and signature spell.'
  },
  {
    id: 'brawl',
    title: 'Brawl',
    family: 'Constructed',
    summary: 'Commander-like singleton play with a smaller deck and a commander zone.',
    build: true,
    play: true,
    format: 'brawl',
    target: 60,
    sizePolicy: { kind: 'exact', count: 60 },
    singleton: true,
    commanderZone: true,
    commandZoneLabel: 'Command Zone',
    commandZoneShortLabel: 'Cmd',
    scryfall: 'legal:brawl'
  },
  {
    id: 'pioneer',
    title: 'Pioneer',
    family: 'Constructed',
    summary: '60-card constructed using Pioneer legality.',
    build: true,
    play: true,
    draft: true,
    format: 'pioneer',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    maxCopies: 4,
    scryfall: 'legal:pioneer'
  },
  {
    id: 'modern',
    title: 'Modern',
    family: 'Constructed',
    summary: '60-card constructed and draft pulls using Modern legality.',
    build: true,
    play: true,
    draft: true,
    format: 'modern',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    maxCopies: 4,
    scryfall: 'legal:modern'
  },
  {
    id: 'premodern',
    title: 'Premodern',
    family: 'Community',
    summary: 'Era-style play focused on older paper Magic, modeled with a Scryfall year filter.',
    build: true,
    play: true,
    draft: true,
    format: 'premodern',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    maxCopies: 4,
    scryfall: 'year>=1995 year<=2003 -is:digital'
  },
  {
    id: 'pauper',
    title: 'Pauper',
    family: 'Constructed',
    summary: '60-card decks and draft pools restricted to commons.',
    build: true,
    play: true,
    draft: true,
    format: 'pauper',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    rarity: 'common',
    maxCopies: 4,
    scryfall: 'legal:pauper'
  },
  {
    id: 'pauper-draft',
    title: 'Pauper Draft',
    family: 'Limited',
    summary: 'Draft three-card choices from common-only pools, then fill a 60-card deck.',
    draft: true,
    format: 'pauper',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    rarity: 'common',
    scryfall: 'legal:pauper',
    preferredDraftMode: 'traditional'
  },
  {
    id: 'jumpstart',
    title: 'Jumpstart',
    family: 'Limited',
    summary: 'Shuffle together two themed packets for fast 40-card games.',
    build: true,
    play: true,
    format: 'jumpstart',
    target: 40,
    sizePolicy: { kind: 'exact', count: 40 },
    note: 'Use the packet mixer in the deck builder to shuffle two themed 20-card packets into a 40-card deck.'
  },
  {
    id: 'set-draft',
    title: 'Set Draft',
    family: 'Limited',
    summary: 'Draft from a single set code, or switch the setup to an era range.',
    draft: true,
    format: 'set',
    target: 60,
    sizePolicy: { kind: 'min', count: 60 },
    setScoped: true,
    preferredDraftMode: 'traditional'
  },
  {
    id: 'cube',
    title: 'Cube / Center Stack',
    family: 'Community',
    summary: 'Use a custom pool for drafting, or play from one shared center library.',
    build: true,
    play: true,
    draft: true,
    format: 'cube',
    target: 40,
    sizePolicy: { kind: 'recommended', count: 40, min: 24 },
    sharedLibrary: true,
    sharedLabel: 'Cube Stack',
    preferredDraftMode: 'custom'
  },
  {
    id: 'winston',
    title: 'Winston Draft',
    family: 'Limited',
    summary: 'Two-player draft style from a shared pool, usually built from a cube or sealed stack.',
    build: true,
    draft: true,
    play: true,
    format: 'winston',
    target: 40,
    sizePolicy: { kind: 'recommended', count: 40, min: 24 },
    sharedLibrary: true,
    sharedLabel: 'Winston Pool',
    preferredDraftMode: 'winston',
    note: 'Includes a local hotseat Winston pile draft engine for cube or collection pools.'
  },
  {
    id: 'land-game',
    title: 'Basic Land Game',
    family: 'Variant',
    summary: 'A casual variant using only basic lands. Goal: assemble domain or five of one basic in play.',
    play: true,
    format: 'land-game',
    target: 50,
    sizePolicy: { kind: 'exact', count: 50 },
    startingHand: 5,
    noMulligan: true,
    autoDeck: 'basic-land-game',
    note: 'Decks are 10 of each basic land. Forest regrows a land, Swamp discards a land, Mountain destroys a land, Island draws or counters with another land, and Plains repeats another non-Plains land effect.'
  },
  {
    id: 'dandan',
    title: 'Dandan',
    family: 'Community',
    summary: 'Shared-library blue mirror style. Put the shared stack in Player 1 deck, then both players draw from it.',
    build: true,
    play: true,
    format: 'dandan',
    target: 80,
    sizePolicy: { kind: 'recommended', count: 80, min: 40 },
    sharedLibrary: true,
    sharedLabel: 'Dandan Library',
    note: 'Dandan is best as a curated shared deck. This app supports the shared library, shared deck viewing, and normal manual zones.'
  },
  {
    id: 'horde',
    title: 'Horde Magic',
    family: 'Community',
    summary: 'Co-op players face an automated token-heavy opponent deck.',
    build: true,
    play: true,
    format: 'horde',
    target: 100,
    sizePolicy: { kind: 'min', count: 40 },
    autoDeck: 'horde',
    botOpponent: true,        // player 2 is always machine-driven
    coop: true,
    openingHand: 7,
    rules: [
      'You are the survivors. Player 2 is an automated Horde deck.',
      'Each Horde turn it reveals cards until a non-token, then attacks with everything that is not summoning sick.',
      'Survivors win by emptying the Horde library; the Horde wins by reducing you to 0 life.'
    ],
    note: 'Player 2 is the automated Horde deck and takes its own turns. Horde Reveal and Horde Attack still work manually if you want to step through it.'
  },
  {
    id: 'boss',
    title: 'Boss Battle',
    family: 'Variant',
    summary: 'One or two survivors team up against an escalating AI boss with 40 life.',
    build: true,
    play: true,
    format: 'boss',
    target: 60,
    sizePolicy: { kind: 'min', count: 40 },
    autoDeck: 'boss',
    botOpponent: true,        // player 2 is always machine-driven
    coop: true,
    openingHand: 7,
    rules: [
      'One or two survivors share a board against an AI boss with 40 life.',
      'The boss plays its own turns and summons a growing Horror as the rounds pass.',
      'Use the Attack button to swing; the boss assigns its own blockers.'
    ],
    health: 30,             // survivors start higher; the boss out-scales them
    opponentHealth: 40,
    note: 'The boss plays its own turns and grows stronger each round. In co-op, two survivors share one board and pass the device with the Pass to Teammate button.'
  }
];

const JUMPSTART_THEMES = [
  {
    id: 'goblins',
    title: 'Goblins',
    color: 'R',
    land: 'Mountain',
    cards: [
      ['Spark-Mob Ringleader', 'Creature - Goblin Warrior', '{1}{R}', 2, 1, 'When this enters, create pressure with another small attacker.'],
      ['Foundry Skulker', 'Creature - Goblin Rogue', '{R}', 1, 1, 'Haste.'],
      ['Ashpile Captain', 'Creature - Goblin Soldier', '{2}{R}', 3, 2, 'Other Goblins you control get +1/+0.'],
      ['Reckless Torchhand', 'Creature - Goblin Shaman', '{1}{R}', 2, 2, 'Tap: Deal 1 damage to any target.'],
      ['Raid Alarm', 'Instant', '{R}', 0, 0, 'Target creature gets +2/+0 until end of turn.'],
      ['Scrap Barrage', 'Sorcery', '{2}{R}', 0, 0, 'Deal 3 damage to target creature or player.'],
      ['Goblin War Drums', 'Enchantment', '{2}{R}', 0, 0, 'Attacking creatures you control have menace.'],
      ['Blazing Shortcut', 'Instant', '{1}{R}', 0, 0, 'Up to two target creatures gain haste until end of turn.'],
      ['Tin-Street Bruiser', 'Creature - Goblin Berserker', '{3}{R}', 4, 3, 'This attacks each combat if able.'],
      ['Bottle-Rocket Squad', 'Creature - Goblin Artificer', '{2}{R}', 2, 3, 'When this dies, deal 1 damage to any target.'],
      ['Frenzy Banner', 'Artifact', '{2}', 0, 0, 'Creatures you control get +1/+0 until end of turn.'],
      ['Last Spark', 'Instant', '{R}', 0, 0, 'Deal 2 damage to target attacking or blocking creature.']
    ]
  },
  {
    id: 'flyers',
    title: 'Flyers',
    color: 'U',
    land: 'Island',
    cards: [
      ['Mistwing Initiate', 'Creature - Bird Wizard', '{1}{U}', 1, 3, 'Flying.'],
      ['Cloudcourt Adept', 'Creature - Human Wizard', '{2}{U}', 2, 2, 'Flying. When this enters, scry 1.'],
      ['Highwind Drake', 'Creature - Drake', '{3}{U}', 3, 3, 'Flying.'],
      ['Tideglass Sprite', 'Creature - Faerie', '{U}', 1, 1, 'Flying.'],
      ['Sky Tactics', 'Instant', '{1}{U}', 0, 0, 'Target creature gets +1/+1 and gains flying until end of turn.'],
      ['Slipstream Denial', 'Instant', '{1}{U}', 0, 0, 'Counter target spell unless its controller pays 2.'],
      ['Aerial Survey', 'Sorcery', '{2}{U}', 0, 0, 'Draw two cards, then discard a card.'],
      ['Gustcloak Mentor', 'Creature - Human Advisor', '{2}{U}', 2, 3, 'Flyers you control get +0/+1.'],
      ['Riddle of Clouds', 'Enchantment', '{3}{U}', 0, 0, 'Whenever a creature with flying attacks, scry 1.'],
      ['Moonlit Falcon', 'Creature - Bird', '{1}{U}', 2, 1, 'Flying.'],
      ['Updraft Shield', 'Instant', '{U}', 0, 0, 'Untap target creature. It gains hexproof until end of turn.'],
      ['Tower Skimmer', 'Creature - Drake', '{4}{U}', 4, 4, 'Flying.']
    ]
  },
  {
    id: 'graveyard',
    title: 'Graveyard',
    color: 'B',
    land: 'Swamp',
    cards: [
      ['Crypt Sifter', 'Creature - Zombie Rogue', '{1}{B}', 2, 1, 'When this enters, mill two cards.'],
      ['Bonepicker Adept', 'Creature - Vampire', '{2}{B}', 3, 2, 'When this attacks, you may return a creature card from your graveyard to your hand.'],
      ['Rot-Tide Ghoul', 'Creature - Zombie', '{3}{B}', 3, 4, 'This gets +1/+0 if a creature died this turn.'],
      ['Grave Whisper', 'Sorcery', '{1}{B}', 0, 0, 'Return target creature card from your graveyard to your hand.'],
      ['Last Rites', 'Instant', '{B}', 0, 0, 'Target creature gets -1/-1 until end of turn.'],
      ['Carrion Bargain', 'Sorcery', '{2}{B}', 0, 0, 'Draw two cards and lose 2 life.'],
      ['Hollow-Eyed Scout', 'Creature - Skeleton Scout', '{B}', 1, 1, 'When this dies, mill one card.'],
      ['Mire Gravedigger', 'Creature - Zombie', '{4}{B}', 4, 4, 'When this enters, return a creature from your graveyard to your hand.'],
      ['Dread Offering', 'Enchantment', '{2}{B}', 0, 0, 'Whenever a creature you control dies, each opponent loses 1 life.'],
      ['Nightsoil Brawler', 'Creature - Zombie Warrior', '{2}{B}', 3, 3, 'Enters tapped.'],
      ['Unearthly Grip', 'Instant', '{1}{B}', 0, 0, 'Destroy target creature with mana value 3 or less.'],
      ['Crypt Lantern', 'Artifact', '{2}', 0, 0, 'Tap: Add B.']
    ]
  },
  {
    id: 'big-green',
    title: 'Big Green',
    color: 'G',
    land: 'Forest',
    cards: [
      ['Canopy Tender', 'Creature - Elf Druid', '{1}{G}', 1, 2, 'Tap: Add G.'],
      ['Rootbreaker Baloth', 'Creature - Beast', '{4}{G}', 5, 5, 'Trample.'],
      ['Mosshide Veteran', 'Creature - Elf Warrior', '{2}{G}', 3, 3, 'When this enters, put a +1/+1 counter on another creature.'],
      ['Wildsize', 'Instant', '{1}{G}', 0, 0, 'Target creature gets +3/+3 until end of turn.'],
      ['Grove Renewal', 'Sorcery', '{2}{G}', 0, 0, 'Search your deck for a basic Forest and put it into your hand.'],
      ['Sporeback Rhino', 'Creature - Rhino', '{3}{G}', 4, 4, 'Vigilance.'],
      ['Llanowar Trailhand', 'Creature - Elf Scout', '{G}', 1, 1, 'When this enters, scry 1.'],
      ['Colossal Moment', 'Instant', '{3}{G}', 0, 0, 'Target creature gets +5/+5 and gains trample until end of turn.'],
      ['Brambleguard', 'Creature - Plant Wall', '{1}{G}', 0, 4, 'Defender.'],
      ['Ancient Canopy', 'Enchantment', '{3}{G}', 0, 0, 'Creatures you control with power 4 or greater have trample.'],
      ['Stampede Caller', 'Creature - Elf Shaman', '{2}{G}', 2, 3, 'When this enters, target creature gets +2/+2 until end of turn.'],
      ['Titan of the Thicket', 'Creature - Giant', '{5}{G}', 6, 6, 'Trample.']
    ]
  },
  {
    id: 'lifegain',
    title: 'Lifegain',
    color: 'W',
    land: 'Plains',
    cards: [
      ['Sunlit Attendant', 'Creature - Human Cleric', '{1}{W}', 2, 2, 'When this enters, you gain 2 life.'],
      ['Dawnshield Knight', 'Creature - Human Knight', '{2}{W}', 2, 3, 'Vigilance.'],
      ['Sanctuary Griffin', 'Creature - Griffin', '{3}{W}', 3, 3, 'Flying. When this enters, you gain 2 life.'],
      ['Moment of Grace', 'Instant', '{W}', 0, 0, 'Target creature gets +1/+1 and gains lifelink until end of turn.'],
      ['Bright Verdict', 'Sorcery', '{2}{W}', 0, 0, 'Destroy target tapped creature.'],
      ['Chapel Steward', 'Creature - Human Soldier', '{1}{W}', 1, 3, 'Whenever you gain life, this gets +1/+0 until end of turn.'],
      ['Serene Procession', 'Enchantment', '{2}{W}', 0, 0, 'At the beginning of your upkeep, gain 1 life.'],
      ['Aerial Chaplain', 'Creature - Bird Cleric', '{2}{W}', 2, 2, 'Flying, lifelink.'],
      ['Rally the Parish', 'Instant', '{1}{W}', 0, 0, 'Creatures you control get +1/+1 until end of turn.'],
      ['Field Medic', 'Creature - Human Cleric', '{W}', 1, 1, 'Tap: You gain 1 life.'],
      ['Sun-Crowned Bulwark', 'Creature - Wall', '{2}{W}', 0, 5, 'Defender.'],
      ['Restorative Light', 'Sorcery', '{3}{W}', 0, 0, 'Return target creature card with mana value 3 or less from your graveyard to the battlefield.']
    ]
  },
  {
    id: 'artifacts',
    title: 'Artifacts',
    color: 'C',
    land: 'Island',
    cards: [
      ['Brassgear Worker', 'Artifact Creature - Construct', '{2}', 2, 2, 'When this enters, scry 1.'],
      ['Workshop Automaton', 'Artifact Creature - Construct', '{3}', 3, 3, ''],
      ['Signal Lens', 'Artifact', '{1}', 0, 0, 'Tap: Add one mana of any color.'],
      ['Foundry Repair', 'Instant', '{1}{U}', 0, 0, 'Return target artifact card from your graveyard to your hand.'],
      ['Chrome Sentry', 'Artifact Creature - Construct', '{4}', 3, 4, 'Flying.'],
      ['Gearshift Charge', 'Instant', '{R}', 0, 0, 'Target artifact creature gets +2/+0 until end of turn.'],
      ['Pattern Matrix', 'Artifact', '{3}', 0, 0, 'Tap: Draw a card, then discard a card.'],
      ['Scrapyard Bruiser', 'Artifact Creature - Golem', '{5}', 5, 4, 'Trample.'],
      ['Copper Myrling', 'Artifact Creature - Myr', '{2}', 1, 1, 'Tap: Add one mana of any color.'],
      ['Assembly Line', 'Enchantment', '{2}{U}', 0, 0, 'Whenever an artifact enters under your control, scry 1.'],
      ['Welded Shield', 'Artifact', '{2}', 0, 0, 'Equipped creature gets +0/+2.'],
      ['Spark Anvil', 'Artifact', '{3}', 0, 0, 'Tap: Deal 1 damage to any target.']
    ]
  }
];

window.GALDUR_MODE_DATA = Object.freeze({
  BASIC_LAND_NAMES,
  TURN_PHASES,
  MTG_MODE_LIBRARY,
  JUMPSTART_THEMES
});
})();
