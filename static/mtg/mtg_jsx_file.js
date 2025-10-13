(function(){
'use strict';

const { useState, useEffect } = React;
const { Plus, Trash2, Play, ArrowLeft, Edit3, Upload, LogOut, Heart } = lucide;

const CardGamePlatform = () => {
  const [screen, setScreen] = useState('login');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [cards, setCards] = useState([
    { id: 1, name: 'Fire Dragon', type: 'Monster', attack: 2500, defense: 2000, effect: 'When summoned, deal 500 damage to opponent.', image: '' },
    { id: 2, name: 'Magic Shield', type: 'Spell', attack: 0, defense: 0, effect: 'Negate one attack this turn.', image: '' }
  ]);
  const [decks, setDecks] = useState({ player1: [], player2: [] });
  const [editingCard, setEditingCard] = useState(null);
  const [activePlayer, setActivePlayer] = useState(1);
  const [gameState, setGameState] = useState({
    player1: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 20 },
    player2: { hand: [], upperField: [], lowerField: [], graveyard: [], deck: [], health: 20 }
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (gameStarted) {
      if (gameState.player1.health <= 0) { setWinner(2); setGameStarted(false); }
      else if (gameState.player2.health <= 0) { setWinner(1); setGameStarted(false); }
    }
  }, [gameState, gameStarted]);

  const compressImage = (file, callback) => {
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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const Card = ({ card }) => {
    const typeColors = { Monster: 'bg-gray-700', Spell: 'bg-gray-700', Trap: 'bg-gray-700' };
    return React.createElement('div', { className: `${typeColors[card.type]} rounded-lg p-3 shadow-lg border border-gray-600` },
      React.createElement('div', { className: 'bg-gray-600 rounded-t-lg p-2 mb-2' },
        React.createElement('h3', { className: 'font-bold text-gray-100 text-center text-sm truncate' }, card.name || 'Unnamed'),
        React.createElement('p', { className: 'text-xs text-gray-300 text-center' }, card.type)
      ),
      React.createElement('div', { className: 'bg-gray-600 rounded-lg aspect-square mb-2 flex items-center justify-center overflow-hidden' },
        card.image ? React.createElement('img', { src: card.image, alt: card.name, className: 'w-full h-full object-cover rounded-lg' }) :
        React.createElement('div', { className: 'text-gray-500 text-4xl' }, '🃏')
      ),
      card.type === 'Monster' && React.createElement('div', { className: 'bg-gray-600 rounded-lg p-2 mb-2 flex justify-between' },
        React.createElement('span', { className: 'text-gray-100 font-semibold text-sm' }, `ATK: ${card.attack}`),
        React.createElement('span', { className: 'text-gray-100 font-semibold text-sm' }, `DEF: ${card.defense}`)
      ),
      React.createElement('div', { className: 'bg-gray-600 rounded-lg p-2' },
        React.createElement('p', { className: 'text-xs text-gray-200 line-clamp-3' }, card.effect || 'No effect')
      )
    );
  };

  const MiniCard = ({ card }) => {
    const typeColors = { Monster: 'bg-gray-700', Spell: 'bg-gray-700', Trap: 'bg-gray-700' };
    return React.createElement('div', { className: `${typeColors[card.type]} rounded p-2 w-full h-28 shadow-lg border border-gray-600 flex flex-col` },
      React.createElement('h4', { className: 'font-bold text-gray-100 text-xs text-center truncate mb-1' }, card.name),
      React.createElement('div', { className: 'bg-gray-600 rounded flex-1 flex items-center justify-center text-lg mb-1 overflow-hidden' },
        card.image ? React.createElement('img', { src: card.image, alt: card.name, className: 'w-full h-full object-cover rounded' }) : '🃏'
      ),
      card.type === 'Monster' && React.createElement('div', { className: 'text-gray-100 text-xs text-center' }, `${card.attack}/${card.defense}`)
    );
  };

  const CardStack = ({ cards, label, showActions, onMove }) => {
    if (cards.length === 0) {
      return React.createElement('div', {},
        React.createElement('h3', { className: 'text-gray-400 text-sm mb-1' }, label),
        React.createElement('div', { className: 'bg-gray-700/30 rounded-lg p-2 h-16 border border-gray-600 flex items-center justify-center' },
          React.createElement('span', { className: 'text-gray-600 text-xs' }, 'Empty')
        )
      );
    }
    return React.createElement('div', {},
      React.createElement('h3', { className: 'text-gray-400 text-sm mb-1' }, label),
      React.createElement('div', { className: 'relative h-24' },
        cards.slice(-3).map((card, i) =>
          React.createElement('div', { key: card.gameId, className: 'absolute', style: { left: `${i * 30}px`, top: 0 } },
            React.createElement('div', { className: 'w-20 relative group' },
              React.createElement(MiniCard, { card }),
              showActions && i === cards.slice(-3).length - 1 &&
              React.createElement('div', { className: 'absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded' },
                React.createElement('button', { onClick: () => onMove(card), className: 'bg-gray-700 text-gray-100 text-xs py-1 px-2 rounded hover:bg-gray-600 border border-gray-600' }, 'To Hand')
              )
            )
          )
        )
      )
    );
  };

  const FieldRow = ({ cards, label, onMove, readonly = false }) => {
    return React.createElement('div', { className: 'mb-2' },
      React.createElement('h3', { className: 'text-gray-400 text-sm mb-1' }, label),
      React.createElement('div', { className: 'bg-gray-700/30 rounded-lg p-2 min-h-[120px] border border-gray-600' },
        React.createElement('div', { className: 'flex gap-2 overflow-x-auto' },
          cards.map(card =>
            React.createElement('div', { key: card.gameId, className: 'relative group flex-shrink-0' },
              React.createElement('div', { className: 'w-24' }, React.createElement(MiniCard, { card })),
              !readonly && React.createElement('div', { className: 'absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition flex flex-col gap-1 p-1 rounded text-xs' },
                React.createElement('button', { onClick: () => onMove(card, 'toHand'), className: 'bg-gray-700 text-gray-100 py-1 rounded hover:bg-gray-600 border border-gray-600' }, 'To Hand'),
                React.createElement('button', { onClick: () => onMove(card, label.includes('Upper') ? 'toLower' : 'toUpper'), className: 'bg-gray-700 text-gray-100 py-1 rounded hover:bg-gray-600 border border-gray-600' }, label.includes('Upper') ? 'To Lower' : 'To Upper'),
                React.createElement('button', { onClick: () => onMove(card, 'toDeck'), className: 'bg-gray-700 text-gray-100 py-1 rounded hover:bg-gray-600 border border-gray-600' }, 'To Deck'),
                React.createElement('button', { onClick: () => onMove(card, 'toGrave'), className: 'bg-gray-700 text-gray-100 py-1 rounded hover:bg-gray-600 border border-gray-600' }, 'To Grave')
              )
            )
          )
        )
      )
    );
  };

  if (screen === 'login') {
    return React.createElement('div', { className: 'min-h-screen bg-gray-900 flex items-center justify-center p-8' },
      React.createElement('div', { className: 'text-center' },
        React.createElement('h1', { className: 'text-5xl font-bold text-gray-100 mb-2' }, 'Card Game Platform'),
        React.createElement('p', { className: 'text-gray-400 mb-12' }, 'Select your player'),
        React.createElement('div', { className: 'flex gap-6' },
          React.createElement('button', { onClick: () => { setCurrentPlayer(1); setScreen('menu'); }, className: 'bg-gray-800 hover:bg-gray-700 text-gray-100 px-12 py-8 rounded-lg font-semibold text-xl border border-gray-700 transition' }, 'Player 1'),
          React.createElement('button', { onClick: () => { setCurrentPlayer(2); setScreen('menu'); }, className: 'bg-gray-800 hover:bg-gray-700 text-gray-100 px-12 py-8 rounded-lg font-semibold text-xl border border-gray-700 transition' }, 'Player 2')
        )
      )
    );
  }

  if (screen === 'menu') {
    return React.createElement('div', { className: 'min-h-screen bg-gray-900 flex items-center justify-center p-8' },
      React.createElement('div', { className: 'text-center' },
        React.createElement('div', { className: 'flex justify-between items-center mb-8' },
          React.createElement('div', {}),
          React.createElement('h1', { className: 'text-4xl font-bold text-gray-100' }, `Player ${currentPlayer}`),
          React.createElement('button', { onClick: () => { setCurrentPlayer(null); setScreen('login'); }, className: 'flex items-center gap-2 text-gray-400 hover:text-gray-200 transition' },
            React.createElement(LogOut, { size: 20 }), ' Logout'
          )
        ),
        React.createElement('div', { className: 'grid gap-4 max-w-md mx-auto' },
          React.createElement('button', { onClick: () => setScreen('creator'), className: 'bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition' }, 'Create Cards'),
          React.createElement('button', { onClick: () => setScreen('builder'), className: 'bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition' }, 'Build Deck'),
          React.createElement('button', { onClick: () => setScreen('game'), className: 'bg-gray-800 hover:bg-gray-700 text-gray-100 px-8 py-6 rounded-lg font-semibold text-lg border border-gray-700 transition' }, 'Play Game')
        )
      )
    );
  }

  // Simplified version - add full creator, builder, and game screens as needed
  return React.createElement('div', { className: 'min-h-screen bg-gray-900 p-8' },
    React.createElement('div', { className: 'text-center text-gray-100' }, 'Loading...')
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(CardGamePlatform));
})();