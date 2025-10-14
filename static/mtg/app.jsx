(function(){
'use strict';

const Icon = {
  Plus: () => '<svg class="lucide" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  Trash2: () => '<svg class="lucide" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  ArrowLeft: () => '<svg class="lucide" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  Edit3: () => '<svg class="lucide" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  LogOut: () => '<svg class="lucide" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  Heart: () => '<svg class="lucide" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
};

function $(sel) { return document.querySelector(sel); }

const state = {
  screen: 'login',
  currentPlayer: null,
  cards: [
    { id: 1, name: 'Fire Dragon', type: 'Monster', attack: 2500, defense: 2000, effect: 'When summoned, deal 500 damage to opponent.', image: '' },
    { id: 2, name: 'Magic Shield', type: 'Spell', attack: 0, defense: 0, effect: 'Negate one attack this turn.', image: '' }
  ],
  decks: { player1: [], player2: [] },
  editingCard: null,
  activePlayer: 1,
  gameState: {
    player1: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 },
    player2: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 }
  },
  gameStarted: false,
  winner: null,
  selectedCard: null
};

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 200, maxHeight = 200;
      let width = img.width, height = img.height;
      if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
      else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function checkWinner() {
  if (state.gameStarted) {
    if (state.gameState.player1.health <= 0) { state.winner = 2; state.gameStarted = false; }
    else if (state.gameState.player2.health <= 0) { state.winner = 1; state.gameStarted = false; }
  }
}

function render() {
  const root = $('#root');
  root.innerHTML = '';
  
  if (state.screen === 'login') root.appendChild(LoginScreen());
  else if (state.screen === 'menu') root.appendChild(MainMenu());
  else if (state.screen === 'creator') root.appendChild(CardCreator());
  else if (state.screen === 'builder') root.appendChild(DeckBuilder());
  else if (state.screen === 'game') root.appendChild(GameBoard());
}

function LoginScreen() {
  const div = document.createElement('div');
  div.className = 'min-h-screen bg-gray-900 flex items-center justify-center p-8';
  div.innerHTML = '<div class="text-center"><h1 class="text-5xl font-bold text-gray-100 mb-2">Card Game Platform</h1><p class="text-gray-400 mb-12">Select your player</p><div class="flex gap-6"><button id="p1btn" class="bg-gray-800 hover:bg-gray-700 text-gray-100 px-12 py-8 rounded-lg font-semibold text-xl border border-gray-700 transition">Player 1</button><button id="p2btn" class="bg-gray-800 hover:bg-gray-700 text-gray-100 px-12 py-8 rounded-lg font-semibold text-xl border border-gray-700 transition">Player 2</button></div></div>';
  div.querySelector('#p1btn').onclick = () => { state.currentPlayer = 1; state.screen = 'menu'; render(); };
  div.querySelector('#p2btn').onclick = () => { state.currentPlayer = 2; state.screen = 'menu'; render(); };
  return div;
}

function MainMenu() {
  const div = document.createElement('div');
  div.className = 'min-h-screen bg-gray-900 flex items-center justify-center p-8';
  div.innerHTML = '<div class="text-center"><div class="flex justify-between items-center mb-8"><div></div><h1 class="text-4xl font-bold text-gray-100">Player ' + state.currentPlayer + '</h1><button id="logoutBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition">' + Icon.LogOut() + ' Logout</button></div><div class="grid gap-4 max-w-md mx-auto"><button id="createBtn" class="bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition">Create Cards</button><button id="buildBtn" class="bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition">Build Deck</button><button id="playBtn" class="bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition">Play Game</button></div></div>';
  div.querySelector('#logoutBtn').onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
  div.querySelector('#createBtn').onclick = () => { state.screen = 'creator'; render(); };
  div.querySelector('#buildBtn').onclick = () => { state.screen = 'builder'; render(); };
  div.querySelector('#playBtn').onclick = () => { state.screen = 'game'; render(); };
  return div;
}

function CardCreator() {
  const formData = state.editingCard || { name: '', type: 'Monster', attack: 0, defense: 0, effect: '', image: '' };
  const div = document.createElement('div');
  div.className = 'min-h-screen bg-gray-900 p-8';
  
  const cardsHtml = state.cards.map((c, idx) => '<div class="relative group"><div class="bg-gray-700 rounded-lg p-3 shadow-lg border border-gray-600"><div class="bg-gray-600 rounded-t-lg p-2 mb-2"><h3 class="font-bold text-gray-100 text-center text-sm truncate">' + (c.name || 'Unnamed') + '</h3><p class="text-xs text-gray-300 text-center">' + c.type + '</p></div><div class="bg-gray-600 rounded-lg aspect-square mb-2 flex items-center justify-center overflow-hidden">' + (c.image ? '<img src="' + c.image + '" alt="' + c.name + '" class="w-full h-full object-cover rounded-lg">' : '<div class="text-gray-500 text-4xl">🃏</div>') + '</div>' + (c.type === 'Monster' ? '<div class="bg-gray-600 rounded-lg p-2 mb-2 flex justify-between"><span class="text-gray-100 font-semibold text-sm">ATK: ' + c.attack + '</span><span class="text-gray-100 font-semibold text-sm">DEF: ' + c.defense + '</span></div>' : '') + '<div class="bg-gray-600 rounded-lg p-2"><p class="text-xs text-gray-200 line-clamp-3">' + (c.effect || 'No effect') + '</p></div></div><div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition"><button class="editCard bg-gray-700 p-2 rounded hover:bg-gray-600 border border-gray-600" data-id="' + idx + '">' + Icon.Edit3() + '</button><button class="delCard bg-gray-700 p-2 rounded hover:bg-gray-600 border border-gray-600" data-id="' + idx + '">' + Icon.Trash2() + '</button></div></div>').join('');

  div.innerHTML = '<div class="flex justify-between items-center mb-6"><button id="backBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition">' + Icon.ArrowLeft() + ' Back</button><button id="logoutBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition">' + Icon.LogOut() + ' Logout</button></div><div class="max-w-6xl mx-auto"><h1 class="text-3xl font-bold text-gray-100 mb-8">' + (state.editingCard ? 'Edit Card' : 'Create New Card') + '</h1><div class="grid md:grid-cols-2 gap-8"><div class="bg-gray-800 rounded-lg p-6 border border-gray-700"><div class="space-y-4"><div><label class="block text-gray-300 mb-2 text-sm">Card Name</label><input id="cardName" type="text" value="' + formData.name + '" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"></div><div><label class="block text-gray-300 mb-2 text-sm">Type</label><select id="cardType" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"><option value="Monster">Monster</option><option value="Spell">Spell</option><option value="Trap">Trap</option></select></div><div id="monsterStats" style="' + (formData.type !== 'Monster' ? 'display:none' : '') + '"><div><label class="block text-gray-300 mb-2 text-sm">Attack</label><input id="cardAtk" type="number" value="' + formData.attack + '" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"></div><div class="mt-4"><label class="block text-gray-300 mb-2 text-sm">Defense</label><input id="cardDef" type="number" value="' + formData.defense + '" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"></div></div><div><label class="block text-gray-300 mb-2 text-sm">Effect Description</label><textarea id="cardEffect" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500 h-24">' + formData.effect + '</textarea></div><div><label class="block text-gray-300 mb-2 text-sm">Card Image</label><input id="cardImage" type="file" accept="image/*" class="w-full px-4 py-2 rounded bg-gray-700 text-gray-100 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500"></div><button id="submitCard" class="w-full bg-gray-700 hover:bg-gray-600 text-gray-100 py-3 rounded-lg font-semibold transition border border-gray-600">' + (state.editingCard ? 'Update Card' : 'Create Card') + '</button></div></div><div><h2 class="text-xl font-bold text-gray-100 mb-4">Preview</h2><div id="preview"></div></div></div><div class="mt-12"><h2 class="text-xl font-bold text-gray-100 mb-4">Your Cards</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-4">' + cardsHtml + '</div></div></div>';

  div.querySelector('#backBtn').onclick = () => { state.screen = 'menu'; state.editingCard = null; render(); };
  div.querySelector('#logoutBtn').onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
  div.querySelector('#cardType').value = formData.type;
  
  const updatePreview = () => {
    formData.name = div.querySelector('#cardName').value;
    formData.type = div.querySelector('#cardType').value;
    formData.attack = parseInt(div.querySelector('#cardAtk').value) || 0;
    formData.defense = parseInt(div.querySelector('#cardDef').value) || 0;
    formData.effect = div.querySelector('#cardEffect').value;
    div.querySelector('#monsterStats').style.display = formData.type === 'Monster' ? 'block' : 'none';
    div.querySelector('#preview').innerHTML = '<div class="bg-gray-700 rounded-lg p-3 shadow-lg border border-gray-600"><div class="bg-gray-600 rounded-t-lg p-2 mb-2"><h3 class="font-bold text-gray-100 text-center text-sm truncate">' + (formData.name || 'Unnamed') + '</h3><p class="text-xs text-gray-300 text-center">' + formData.type + '</p></div><div class="bg-gray-600 rounded-lg aspect-square mb-2 flex items-center justify-center overflow-hidden">' + (formData.image ? '<img src="' + formData.image + '" class="w-full h-full object-cover rounded-lg">' : '<div class="text-gray-500 text-4xl">🃏</div>') + '</div>' + (formData.type === 'Monster' ? '<div class="bg-gray-600 rounded-lg p-2 mb-2 flex justify-between"><span class="text-gray-100 font-semibold text-sm">ATK: ' + formData.attack + '</span><span class="text-gray-100 font-semibold text-sm">DEF: ' + formData.defense + '</span></div>' : '') + '<div class="bg-gray-600 rounded-lg p-2"><p class="text-xs text-gray-200 line-clamp-3">' + (formData.effect || 'No effect') + '</p></div></div>';
  };

  div.querySelector('#cardName').oninput = updatePreview;
  div.querySelector('#cardType').onchange = updatePreview;
  div.querySelector('#cardAtk').oninput = updatePreview;
  div.querySelector('#cardDef').oninput = updatePreview;
  div.querySelector('#cardEffect').oninput = updatePreview;
  div.querySelector('#cardImage').onchange = (e) => {
    const file = e.target.files[0];
    if (file) compressImage(file, (compressed) => { formData.image = compressed; updatePreview(); });
  };
  div.querySelector('#submitCard').onclick = () => {
    if (state.editingCard) {
      state.cards[state.cards.findIndex(c => c.id === state.editingCard.id)] = Object.assign({}, formData, { id: state.editingCard.id });
      state.editingCard = null;
    } else {
      state.cards.push(Object.assign({}, formData, { id: Date.now() }));
    }
    render();
  };
  
  const editBtns = div.querySelectorAll('.editCard');
  for (var i = 0; i < editBtns.length; i++) {
    editBtns[i].onclick = (function(idx) {
      return function() { state.editingCard = state.cards[idx]; render(); window.scrollTo(0, 0); };
    })(i);
  }
  
  const delBtns = div.querySelectorAll('.delCard');
  for (var j = 0; j < delBtns.length; j++) {
    delBtns[j].onclick = (function(idx) {
      return function() { state.cards.splice(idx, 1); render(); };
    })(j);
  }

  updatePreview();
  return div;
}

function DeckBuilder() {
  const playerKey = 'player' + state.currentPlayer;
  const div = document.createElement('div');
  div.className = 'min-h-screen bg-black p-4';

  const mainDeckHtml = state.decks[playerKey].map((c, idx) => '<div class="inline-block relative group m-1"><img src="' + (c.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="%23374151"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="12">' + c.name + '</text></svg>') + '" class="w-20 h-28 object-cover rounded border-2 border-gray-600 hover:border-blue-400 cursor-pointer"><button class="remCard absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded opacity-0 group-hover:opacity-100" data-id="' + idx + '">X</button></div>').join('');
  
  const extraDeckHtml = '';
  
  const availCardsHtml = state.cards.map((c, idx) => '<div class="inline-block relative group m-1"><img src="' + (c.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="%23374151"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="12">' + c.name + '</text></svg>') + '" class="w-20 h-28 object-cover rounded border-2 border-gray-600 hover:border-green-400 cursor-pointer addCard" data-id="' + idx + '"></div>').join('');

  div.innerHTML = '<div class="flex justify-between items-center mb-4"><button id="backBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition text-sm">' + Icon.ArrowLeft() + ' Back</button><div class="text-gray-100 text-xl">Deck: Player ' + state.currentPlayer + '</div><button id="logoutBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition text-sm">' + Icon.LogOut() + ' Logout</button></div><div class="grid grid-cols-2 gap-4 h-screen"><div class="bg-gray-900 rounded-lg p-4 border border-gray-700 overflow-y-auto"><h2 class="text-gray-100 font-bold mb-4">Main [' + state.decks[playerKey].length + ']</h2><div class="bg-gray-800 rounded p-2 min-h-[200px]">' + (mainDeckHtml || '<div class="text-gray-500 text-center py-8">No cards in main deck</div>') + '</div><h2 class="text-gray-100 font-bold mt-6 mb-4">Extra [0]</h2><div class="bg-gray-800 rounded p-2 min-h-[120px]"><div class="text-gray-500 text-center py-4">No extra deck cards</div></div></div><div class="bg-gray-900 rounded-lg p-4 border border-gray-700 overflow-y-auto"><h2 class="text-gray-100 font-bold mb-4">All Cards</h2><div class="bg-gray-800 rounded p-2">' + availCardsHtml + '</div></div></div>';

  div.querySelector('#backBtn').onclick = () => { state.screen = 'menu'; render(); };
  div.querySelector('#logoutBtn').onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
  
  const addBtns = div.querySelectorAll('.addCard');
  for (var i = 0; i < addBtns.length; i++) {
    addBtns[i].onclick = (function(idx) {
      return function() { state.decks[playerKey].push(Object.assign({}, state.cards[idx], { deckId: Date.now() })); render(); };
    })(i);
  }
  
  const remBtns = div.querySelectorAll('.remCard');
  for (var j = 0; j < remBtns.length; j++) {
    remBtns[j].onclick = (function(idx) {
      return function() { state.decks[playerKey].splice(idx, 1); render(); };
    })(j);
  }
  
  return div;
}

function GameBoard() {
  const div = document.createElement('div');
  
  if (!state.gameStarted) {
    div.className = 'min-h-screen bg-gray-900 p-8';
    div.innerHTML = '<div class="flex justify-between items-center mb-6"><button id="backBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition">' + Icon.ArrowLeft() + ' Back</button><button id="logoutBtn" class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition">' + Icon.LogOut() + ' Logout</button></div><div class="max-w-4xl mx-auto text-center"><h1 class="text-3xl font-bold text-gray-100 mb-8">Ready to Play?</h1><p class="text-gray-400 mb-8">Make sure both players have built their decks before starting.</p><button id="startBtn" class="bg-gray-700 hover:bg-gray-600 text-gray-100 px-8 py-4 rounded-lg font-semibold border border-gray-600 transition ' + (state.decks.player1.length === 0 || state.decks.player2.length === 0 ? 'opacity-50 cursor-not-allowed' : '') + '" ' + (state.decks.player1.length === 0 || state.decks.player2.length === 0 ? 'disabled' : '') + '>Start Game</button>' + ((state.decks.player1.length === 0 || state.decks.player2.length === 0) ? '<p class="text-red-400 mt-4">Both players need cards in their decks!</p>' : '') + '</div>';
    
    div.querySelector('#backBtn').onclick = () => { state.screen = 'menu'; render(); };
    div.querySelector('#logoutBtn').onclick = () => { state.currentPlayer = null; state.screen = 'login'; render(); };
    div.querySelector('#startBtn').onclick = () => {
      const shuffleDeck = function(deck) { 
        const shuffled = deck.slice(); 
        for (var i = shuffled.length - 1; i > 0; i--) { 
          var j = Math.floor(Math.random() * (i + 1)); 
          var temp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = temp;
        } 
        return shuffled; 
      };
      
      const p1Deck = shuffleDeck(state.decks.player1.map(function(c, i) { return Object.assign({}, c, { gameId: 'p1-' + i }); }));
      const p2Deck = shuffleDeck(state.decks.player2.map(function(c, i) { return Object.assign({}, c, { gameId: 'p2-' + i }); }));
      
      state.gameState = { 
        player1: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: p1Deck, health: 8000 }, 
        player2: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: p2Deck, health: 8000 } 
      };
      state.activePlayer = 1; 
      state.gameStarted = true; 
      render();
    };
    return div;
  }

  const playerKey = 'player' + state.currentPlayer;
  const opponentKey = 'player' + (state.currentPlayer === 1 ? 2 : 1);
  const myState = state.gameState[playerKey];
  const oppState = state.gameState[opponentKey];
  
  const renderCardSlot = (card, zone, owner, position) => {
    if (!card) {
      return '<div class="w-16 h-24 bg-gray-800 rounded border border-gray-700 hover:border-blue-500 cursor-pointer cardSlot" data-zone="' + zone + '" data-owner="' + owner + '" data-pos="' + position + '"></div>';
    }
    return '<div class="relative group cardSlot" data-zone="' + zone + '" data-owner="' + owner + '" data-pos="' + position + '"><img src="' + (card.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="%23374151"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="10">' + card.name + '</text></svg>') + '" class="w-16 h-24 object-cover rounded border-2 border-blue-400 cursor-pointer"></div>';
  };
  
  const oppUpperRow = '<div class="flex gap-1 justify-center mb-1">' + [0,1,2,3,4,5,6,7].map(i => renderCardSlot(oppState.upperField[i], 'upperField', 'opponent', i)).join('') + '</div>';
  const oppLowerRow = '<div class="flex gap-1 justify-center mb-2">' + [0,1,2,3,4,5,6,7].map(i => renderCardSlot(oppState.lowerField[i], 'lowerField', 'opponent', i)).join('') + '</div>';
  
  const myLowerRow = '<div class="flex gap-1 justify-center mb-1">' + [0,1,2,3,4,5,6,7].map(i => renderCardSlot(myState.lowerField[i], 'lowerField', 'me', i)).join('') + '</div>';
  const myUpperRow = '<div class="flex gap-1 justify-center mb-2">' + [0,1,2,3,4,5,6,7].map(i => renderCardSlot(myState.upperField[i], 'upperField', 'me', i)).join('') + '</div>';
  
  const myHandHtml = myState.hand.map((c, idx) => '<div class="inline-block relative handCard cursor-pointer m-1 hover:transform hover:-translate-y-2 transition" data-idx="' + idx + '"><img src="' + (c.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="%23374151"/><text x="50" y="70" text-anchor="middle" fill="white" font-size="10">' + c.name + '</text></svg>') + '" class="w-20 h-28 object-cover rounded border-2 ' + (state.selectedCard === idx ? 'border-yellow-400' : 'border-gray-600') + '"></div>').join('');
  
  div.className = 'min-h-screen bg-black text-gray-100';
  
  const winnerHtml = state.winner ? '<div class="fixed inset-0 bg-black/90 flex items-center justify-center z-50"><div class="bg-gray-800 p-8 rounded-lg border border-gray-700 text-center"><h2 class="text-3xl font-bold text-gray-100 mb-4">' + (state.winner === state.currentPlayer ? 'You Win!' : 'You Lose!') + '</h2><p class="text-gray-400 mb-6">Player ' + state.winner + ' wins!</p><button id="returnBtn" class="bg-gray-700 hover:bg-gray-600 text-gray-100 px-6 py-3 rounded-lg font-semibold border border-gray-600 transition">Return to Menu</button></div></div>' : '';
  
  div.innerHTML = '<div class="flex justify-between items-center p-2 bg-gray-900"><button id="exitBtn" class="text-gray-400 hover:text-gray-200 text-sm">' + Icon.ArrowLeft() + ' Exit</button><div class="text-sm">Turn: Player ' + state.activePlayer + (state.activePlayer === state.currentPlayer ? ' (YOU)' : '') + '</div><button id="endTurnBtn" class="bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded text-sm">End Turn</button></div><div class="p-4"><div class="mb-4 text-center"><div class="text-red-400 font-bold mb-2">Opponent (Player ' + (state.currentPlayer === 1 ? 2 : 1) + ') - LP: ' + oppState.health + '</div><div class="text-xs text-gray-500 mb-2">Deck: ' + oppState.deck.length + ' | Hand: ' + oppState.hand.length + ' | GY: ' + oppState.graveyard.length + '</div></div>' + oppUpperRow + oppLowerRow + '<div class="my-8 border-t-2 border-purple-600"></div>' + myLowerRow + myUpperRow + '<div class="mt-4 text-center"><div class="text-green-400 font-bold mb-2">You (Player ' + state.currentPlayer + ') - LP: ' + myState.health + '</div><div class="flex justify-center gap-4 mb-2 text-sm"><button id="drawBtn" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Draw (' + myState.deck.length + ')</button><button id="toGrave" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">To GY (' + myState.graveyard.length + ')</button><button id="minusLP" class="bg-red-700 hover:bg-red-600 px-3 py-1 rounded">-100 LP</button><button id="plusLP" class="bg-green-700 hover:bg-green-600 px-3 py-1 rounded">+100 LP</button></div><div class="text-xs text-gray-500 mb-2">' + (state.selectedCard !== null ? 'Selected: ' + myState.hand[state.selectedCard].name + ' - Click a field slot to place' : 'Click a card in your hand to select it') + '</div></div><div class="bg-gray-900 rounded p-2 flex justify-center flex-wrap min-h-[140px]">' + (myHandHtml || '<div class="text-gray-500 py-8">No cards in hand</div>') + '</div></div>' + winnerHtml;
  
  div.querySelector('#exitBtn').onclick = () => {
    state.screen = 'menu';
    state.gameStarted = false;
    state.winner = null;
    state.selectedCard = null;
    state.gameState = {
      player1: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 },
      player2: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 }
    };
    render();
  };
  
  div.querySelector('#drawBtn').onclick = () => {
    if (myState.deck.length > 0) {
      const randomIndex = Math.floor(Math.random() * myState.deck.length);
      const drawnCard = myState.deck[randomIndex];
      myState.deck = myState.deck.filter(function(c, i) { return i !== randomIndex; });
      myState.hand.push(drawnCard);
      render();
    }
  };
  
  div.querySelector('#toGrave').onclick = () => {
    if (state.selectedCard !== null) {
      const card = myState.hand[state.selectedCard];
      myState.graveyard.push(card);
      myState.hand.splice(state.selectedCard, 1);
      state.selectedCard = null;
      render();
    }
  };
  
  div.querySelector('#minusLP').onclick = () => {
    myState.health = Math.max(0, myState.health - 100);
    checkWinner();
    render();
  };
  
  div.querySelector('#plusLP').onclick = () => {
    myState.health += 100;
    render();
  };
  
  div.querySelector('#endTurnBtn').onclick = () => {
    state.activePlayer = state.activePlayer === 1 ? 2 : 1;
    state.selectedCard = null;
    render();
  };
  
  const handCards = div.querySelectorAll('.handCard');
  for (var i = 0; i < handCards.length; i++) {
    handCards[i].onclick = (function(idx) {
      return function() {
        state.selectedCard = state.selectedCard === idx ? null : idx;
        render();
      };
    })(i);
  }
  
  const cardSlots = div.querySelectorAll('.cardSlot');
  for (var j = 0; j < cardSlots.length; j++) {
    cardSlots[j].onclick = (function(slot) {
      return function() {
        const zone = slot.getAttribute('data-zone');
        const owner = slot.getAttribute('data-owner');
        const pos = parseInt(slot.getAttribute('data-pos'));
        
        if (owner === 'me' && state.selectedCard !== null) {
          const card = myState.hand[state.selectedCard];
          if (!myState[zone][pos]) {
            myState[zone][pos] = card;
            myState.hand.splice(state.selectedCard, 1);
            state.selectedCard = null;
            render();
          }
        }
      };
    })(cardSlots[j]);
  }
  
  if (state.winner && div.querySelector('#returnBtn')) {
    div.querySelector('#returnBtn').onclick = () => {
      state.screen = 'menu';
      state.gameStarted = false;
      state.winner = null;
      state.selectedCard = null;
      state.gameState = {
        player1: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 },
        player2: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 8000 }
      };
      render();
    };
  }
  
  return div;
}

function __ready(fn) { 
  if (document.readyState !== 'loading') { 
    fn(); 
  } else { 
    document.addEventListener('DOMContentLoaded', fn); 
  } 
}

__ready(function() {
  render();
});

})();