// src/App.js
import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./App.css";

const TIME_OPTIONS = [
  { label: "10 min", value: 10 * 60 },
  { label: "5 min", value: 5 * 60 },
  { label: "1 min", value: 1 * 60 },
];

export default function App() {
  const boardRef = useRef(null); // DOM node for the board
  const boardInstance = useRef(null); // chessboard.js instance
  const game = useRef(new Chess()); // chess.js engine instance

  const [fen, setFen] = useState(game.current.fen());
  const [pgn, setPgn] = useState("");
  const [status, setStatus] = useState("");

  // Add this state to store moves as arrays
  const [whiteMoves, setWhiteMoves] = useState([]);
  const [blackMoves, setBlackMoves] = useState([]);

  const [selectedTime, setSelectedTime] = useState(TIME_OPTIONS[0].value);
  const [whiteTime, setWhiteTime] = useState(TIME_OPTIONS[0].value);
  const [blackTime, setBlackTime] = useState(TIME_OPTIONS[0].value);
  const [activeColor, setActiveColor] = useState("w");
  const timerRef = useRef(null);

  // helper to be compatible with different chess.js versions (in_checkmate / isCheckmate)
  const _inCheck = (g) =>
    g.in_check ? g.in_check() : g.isCheck ? g.isCheck() : false;
  const _inCheckmate = (g) =>
    g.in_checkmate ? g.in_checkmate() : g.isCheckmate ? g.isCheckmate() : false;
  const _inDraw = (g) =>
    g.in_draw ? g.in_draw() : g.isDraw ? g.isDraw() : false;

  useEffect(() => {
    // Callback: prevent illegal drags
    const onDragStart = (source, piece, position, orientation) => {
      // don't pick up pieces if the game is over
      if (_inCheckmate(game.current) || _inDraw(game.current)) return false;

      // only pick up pieces for the side to move:
      // piece strings are like 'wP' or 'bK'
      if (
        (game.current.turn() === "w" && piece.search(/^b/) !== -1) ||
        (game.current.turn() === "b" && piece.search(/^w/) !== -1)
      ) {
        return false;
      }
    };

    // Callback: when piece dropped, ask chess.js if move is legal
    const onDrop = (source, target, piece, newPos, oldPos, orientation) => {
      // attempt the move with automatic queen promotion (demo)
      const move = game.current.move({
        from: source,
        to: target,
        promotion: "q",
      });

      // illegal move
      if (move === null) {
        // return "snapback" to tell chessboard.js to return the piece
        return "snapback";
      }

      // legal: update UI state
      setFen(game.current.fen());
      setPgn(game.current.pgn());
      updateStatus();
      // (no return -> move stays)
    };

    // Callback: after snap animation finishes, ensure board matches engine FEN
    const onSnapEnd = () => {
      // sync board position to engine (use fen() from chess.js)
      if (boardInstance.current) {
        boardInstance.current.position(game.current.fen());
      }
    };

    // Build config and create the board
    const config = {
      draggable: true,
      position: "start",
      // make sure piece images are reachable; public CDN path works:
      pieceTheme:
        "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
      onDragStart,
      onDrop,
      onSnapEnd,
      dropOffBoard: "snapback",
    };

    // chessboard.js exposes global Chessboard (loaded from the CDN script)
    boardInstance.current = window.Chessboard(boardRef.current, config);

    // set initial status
    updateStatus();

    // cleanup on unmount
    return () => {
      if (boardInstance.current && boardInstance.current.destroy) {
        boardInstance.current.destroy();
      }
    };
  }, []); // run once

  // Timer effect
  useEffect(() => {
    if (_inCheckmate(game.current) || _inDraw(game.current)) {
      clearInterval(timerRef.current);
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setWhiteTime((t) => (activeColor === "w" && t > 0 ? t - 1 : t));
      setBlackTime((t) => (activeColor === "b" && t > 0 ? t - 1 : t));
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [activeColor]);

  // Stop timer if time runs out
  useEffect(() => {
    if (whiteTime === 0 || blackTime === 0) {
      clearInterval(timerRef.current);
      setStatus(
        whiteTime === 0 ? "Time's up! Black wins." : "Time's up! White wins."
      );
    }
    // eslint-disable-next-line
  }, [whiteTime, blackTime]);

  // Update activeColor on move
  function updateStatus() {
    const moveColor = game.current.turn() === "w" ? "White" : "Black";
    setActiveColor(game.current.turn());

    // Parse moves for columns
    const history = game.current.history();
    const whites = [];
    const blacks = [];
    history.forEach((move, idx) => {
      if (idx % 2 === 0) whites.push(move);
      else blacks.push(move);
    });
    setWhiteMoves(whites);
    setBlackMoves(blacks);

    if (_inCheckmate(game.current)) {
      setStatus(`Game over, ${moveColor} is in checkmate.`);
      return;
    }
    if (_inDraw(game.current)) {
      setStatus("Game over, drawn position");
      return;
    }

    let s = `${moveColor} to move`;
    if (_inCheck(game.current)) s += `, ${moveColor} is in check`;
    setStatus(s);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // Handle time control change
  const handleTimeChange = (e) => {
    const val = Number(e.target.value);
    setSelectedTime(val);
    setWhiteTime(val);
    setBlackTime(val);
    resetBoard(val);
  };

  // Update resetBoard to accept time
  const resetBoard = (time = selectedTime) => {
    game.current.reset();
    if (boardInstance.current && boardInstance.current.position)
      boardInstance.current.position("start");
    setFen(game.current.fen());
    setPgn("");
    setWhiteTime(time);
    setBlackTime(time);
    setActiveColor("w");
    updateStatus();
  };

  const undoMove = () => {
    game.current.undo();
    if (boardInstance.current)
      boardInstance.current.position(game.current.fen());
    setFen(game.current.fen());
    setPgn(game.current.pgn());
    updateStatus();
  };

  return (
    <div className="App">
      <h2>Bet on Your Intelligence</h2>

      <div className="App-board">
        <div>
          {/* board container: chessboard.js will render into this div */}
          <div ref={boardRef} style={{ width: 480 }} />
        </div>

        <div className="App-info">
          <div>
            <strong>Status:</strong>
          </div>
          <div className="App-info-item">{status}</div>

          <div>
            <strong>FEN:</strong>
          </div>
          <div className="board-snapshot">{fen}</div>

          <div>
            <strong>Time Control:</strong>
            <select
              value={selectedTime}
              onChange={handleTimeChange}
              style={{ marginLeft: 8 }}
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="timers-row">
            <div className="timer-box white-timer">
              <span>White:</span> {formatTime(whiteTime)}
            </div>
            <div className="timer-box black-timer">
              <span>Black:</span> {formatTime(blackTime)}
            </div>
          </div>

          <div>
            <strong>Moves:</strong>
          </div>
          <div className="moves-columns">
            <div className="moves-col">
              <div className="moves-header">White</div>
              <div className="moves-list">
                {whiteMoves.map((move, idx) => (
                  <div key={idx}>{move}</div>
                ))}
              </div>
            </div>
            <div className="moves-col">
              <div className="moves-header">Black</div>
              <div className="moves-list">
                {blackMoves.map((move, idx) => (
                  <div key={idx}>{move}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="App-info-actions">
            <button onClick={resetBoard}>Reset</button>
            <button onClick={undoMove}>Undo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
