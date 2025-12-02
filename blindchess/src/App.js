import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Chess } from 'chess.js';
import './App.css'; 
const BlindChessTrainer = () => {
  const [game, setGame] = useState(null);
  const [position, setPosition] = useState({});
  const [moveHistory, setMoveHistory] = useState([]);
  const [currentMove, setCurrentMove] = useState('');
  const [turn, setTurn] = useState('white');
  const [showBoard, setShowBoard] = useState(true);
  const [message, setMessage] = useState('');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [playerColor, setPlayerColor] = useState('white');
  const [engineLevel, setEngineLevel] = useState(5);
  const [engineThinking, setEngineThinking] = useState(false);

  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    updatePosition(newGame);
    
    if (playerColor === 'black') {
      setTimeout(() => makeEngineMove(newGame), 500);
    }
  };

  const updatePosition = (gameObj) => {
    const board = gameObj.board();
    const pos = {};
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          const square = files[j] + (8 - i);
          const symbols = {
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙'
          };
          pos[square] = piece.color === 'w' ? 
            symbols[piece.type.toUpperCase()] : 
            symbols[piece.type];
        }
      }
    }
    setPosition(pos);
    setTurn(gameObj.turn() === 'w' ? 'white' : 'black');
  };

  const speakText = (text) => {
    if (speechEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const makePlayerMove = () => {
    if (!game || engineThinking) return;
    
    const moveStr = currentMove.trim();
    if (!moveStr) return;

    const currentTurn = game.turn();
    if ((currentTurn === 'w' && playerColor === 'black') || 
        (currentTurn === 'b' && playerColor === 'white')) {
      setMessage("It's not your turn!");
      return;
    }

    try {
      const move = game.move(moveStr, { sloppy: true });
      
      if (move === null) {
        setMessage('Invalid move! Try again.');
        speakText('Invalid move');
        return;
      }

      setCurrentMove('');
      updateAfterMove(move);

      if (!game.isGameOver()) {
        setTimeout(() => makeEngineMove(game), 800);
      }
    } catch (error) {
      setMessage('Invalid move! Try again.');
      speakText('Invalid move');
    }
  };

  const makeEngineMove = (gameObj) => {
    const currentGame = gameObj || game;
    if (!currentGame || currentGame.isGameOver()) return;
    
    setEngineThinking(true);
    setMessage('Engine thinking...');

    setTimeout(() => {
      const move = getEngineMove(currentGame);
      if (move) {
        try {
          const moveObj = currentGame.move({
            from: move.substring(0, 2),
            to: move.substring(2, 4),
            promotion: move.length > 4 ? move[4] : undefined
          });

          if (moveObj) {
            updateAfterMove(moveObj);
          }
        } catch (error) {
          console.error('Engine move error:', error);
        }
      }
      
      setEngineThinking(false);
      setMessage('');
    }, 500);
  };

  const getEngineMove = (gameObj) => {
    const moves = gameObj.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Difficulty-based move selection
    const depth = Math.min(3, Math.floor(engineLevel / 5) + 1);
    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
      gameObj.move(move);
      const score = -negamax(gameObj, depth - 1, -Infinity, Infinity);
      gameObj.undo();

      // Add randomness based on difficulty
      const randomFactor = Math.random() * (21 - engineLevel);
      const finalScore = score + randomFactor;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMove = move;
      }
    }

    return bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}` : null;
  };

  const negamax = (gameObj, depth, alpha, beta) => {
    if (depth === 0 || gameObj.isGameOver()) {
      return evaluatePosition(gameObj);
    }

    const moves = gameObj.moves({ verbose: true });
    let maxScore = -Infinity;

    for (const move of moves) {
      gameObj.move(move);
      const score = -negamax(gameObj, depth - 1, -beta, -alpha);
      gameObj.undo();

      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }

    return maxScore;
  };

  const evaluatePosition = (gameObj) => {
    if (gameObj.isCheckmate()) {
      return gameObj.turn() === 'w' ? -10000 : 10000;
    }
    if (gameObj.isDraw()) return 0;

    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;

    const board = gameObj.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          const value = pieceValues[piece.type];
          score += piece.color === 'w' ? value : -value;
        }
      }
    }

    // Add bonus for checks
    if (gameObj.inCheck()) {
      score += gameObj.turn() === 'w' ? -50 : 50;
    }

    return gameObj.turn() === 'w' ? score : -score;
  };

  const updateAfterMove = (move) => {
    setMoveHistory(prev => [...prev, move.san]);
    updatePosition(game);
    
    const pieceName = getPieceName(move.piece);
    const colorName = move.color === 'w' ? 'White' : 'Black';
    speakText(`${colorName} ${pieceName} to ${move.to}`);

    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White';
      setMessage(`Checkmate! ${winner} wins!`);
      speakText(`Checkmate! ${winner} wins!`);
    } else if (game.isDraw()) {
      setMessage('Game drawn!');
      speakText('Game drawn');
    } else if (game.inCheck()) {
      setMessage('Check!');
      speakText('Check');
    }
  };

  const getPieceName = (piece) => {
    const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
    return names[piece] || 'piece';
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    updatePosition(newGame);
    setMoveHistory([]);
    setCurrentMove('');
    setMessage('');
    setEngineThinking(false);
    speakText('New game started');
    
    if (playerColor === 'black') {
      setTimeout(() => makeEngineMove(newGame), 500);
    }
  };

  const undoMove = () => {
    if (!game || moveHistory.length === 0) return;
    
    game.undo();
    const newHistory = [...moveHistory];
    newHistory.pop();
    
    if (newHistory.length > 0 && 
        ((game.turn() === 'w' && playerColor === 'white') || 
         (game.turn() === 'b' && playerColor === 'black'))) {
      game.undo();
      newHistory.pop();
    }

    setMoveHistory(newHistory);
    updatePosition(game);
    setMessage('Move undone');
    speakText('Move undone');
  };

  const readMoves = () => {
    if (moveHistory.length === 0) {
      speakText('No moves yet');
      return;
    }

    let text = 'Move history: ';
    for (let i = 0; i < moveHistory.length; i += 2) {
      text += `${Math.floor(i/2) + 1}. ${moveHistory[i]}`;
      if (moveHistory[i + 1]) {
        text += `, ${moveHistory[i + 1]}. `;
      }
    }
    speakText(text);
  };

  const handleColorChange = (color) => {
    setPlayerColor(color);
    setTimeout(() => resetGame(), 100);
  };

  const renderBoard = () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    return (
      <div className="inline-block border-4 border-gray-800 shadow-2xl">
        {ranks.map(rank => (
          <div key={rank} className="flex">
            {files.map(file => {
              const square = file + rank;
              const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
              return (
                <div
                  key={square}
                  className={`w-16 h-16 flex items-center justify-center text-4xl ${
                    isLight ? 'bg-amber-100' : 'bg-amber-700'
                  }`}
                >
                  {position[square] || ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">♟️ Blind Chess</h1>
        <p className="text-slate-300 mb-6 text-center">Practice chess against an AI opponent</p>

        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex gap-4 mb-4 flex-wrap">
            <button
              onClick={() => { setShowBoard(!showBoard); speakText(showBoard ? 'Board hidden' : 'Board visible'); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {showBoard ? <EyeOff size={20} /> : <Eye size={20} />}
              {showBoard ? 'Hide' : 'Show'} Board
            </button>
            <button
              onClick={readMoves}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Volume2 size={20} />
              Read Moves
            </button>
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <RotateCcw size={20} />
              New Game
            </button>
            <button
              onClick={undoMove}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              ↶ Undo
            </button>
          </div>

          <div className="flex gap-4 mb-4 flex-wrap items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={speechEnabled}
                onChange={(e) => setSpeechEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Speech</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm">Play as:</span>
              <select
                value={playerColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm">Strength:</span>
              <select
                value={engineLevel}
                onChange={(e) => setEngineLevel(parseInt(e.target.value))}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="1">Beginner (400)</option>
                <option value="3">Easy (800)</option>
                <option value="5">Medium (1200)</option>
                <option value="10">Advanced (1600)</option>
                <option value="15">Strong (2000)</option>
                <option value="20">Maximum (2400+)</option>
              </select>
            </label>
          </div>

          {showBoard && (
            <div className="flex justify-center mb-6">
              {renderBoard()}
            </div>
          )}

          <div className="mb-4">
            <p className="text-2xl font-bold mb-2">
              Turn: <span className={turn === 'white' ? 'text-gray-800' : 'text-gray-900'}>{turn}</span>
              {engineThinking && <span className="text-sm text-blue-600 ml-2">(Engine thinking...)</span>}
            </p>
            {message && <p className="text-blue-600 mb-2 font-semibold">{message}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMove}
                onChange={(e) => setCurrentMove(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && makePlayerMove()}
                placeholder="Enter move (e.g., e4, Nf3, O-O)"
                disabled={engineThinking}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
              />
              <button
                onClick={makePlayerMove}
                disabled={engineThinking}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-gray-400 transition"
              >
                Move
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-bold text-lg mb-2">Move History</h3>
            <div className="bg-gray-50 p-4 rounded max-h-48 overflow-y-auto">
              {moveHistory.length === 0 ? (
                <p className="text-gray-500">No moves yet</p>
              ) : (
                <div className="space-y-1">
                  {moveHistory.map((m, i) => (
                    i % 2 === 0 && (
                      <div key={i} className="flex gap-4">
                        <span className="font-semibold text-gray-600 w-8">{Math.floor(i/2) + 1}.</span>
                        <span className="w-16">{moveHistory[i]}</span>
                        <span className="w-16">{moveHistory[i + 1] || ''}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 text-white p-4 rounded-lg">
          <h3 className="font-bold mb-2">How to use:</h3>
          <ul className="text-sm space-y-1 text-slate-300">
            <li>• Enter moves in standard notation: e4, Nf3, Bxc4, O-O</li>
            <li>• Choose your color and engine strength (400-2400+ ELO)</li>
            <li>• Hide the board to practice truly blind</li>
            <li>• The engine will respond automatically</li>
            <li>• Use "Read Moves" to hear the game</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BlindChessTrainer;