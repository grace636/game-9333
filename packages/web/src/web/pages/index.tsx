import { useEffect, useRef, useState } from "react";
import { RunnerGame, type GameState } from "../game/engine";
import { unlockAudio } from "../game/sound";

function Index() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const gameRef = useRef<RunnerGame | null>(null);
  const [state, setState] = useState<GameState>("ready");
  const [result, setResult] = useState({ score: 0, best: 0 });

  useEffect(() => {
    const stage = stageRef.current!;
    const frame = frameRef.current!;
    const game = new RunnerGame(canvasRef.current!, stage, {
      // Score text is written straight to the DOM — no React re-render per frame.
      onScore: (s) => {
        if (scoreRef.current) scoreRef.current.textContent = String(s);
      },
      onState: (st, score, best) => {
        setState(st);
        setResult({ score, best });
      },
    });
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { __rg: RunnerGame }).__rg = game;

    const isButton = (t: EventTarget | null) => t instanceof Element && !!t.closest("button");

    // PC: Space → start / jump / restart
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      e.preventDefault();
      if (e.repeat) return;
      unlockAudio();
      if (game.state === "playing") game.jump();
      else game.start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Stop a focused button from also firing a click on Space release.
      if (e.code === "Space" || e.key === " ") e.preventDefault();
    };

    // Touch / pointer on the game area → jump (buttons handle themselves)
    const onPointerDown = (e: PointerEvent) => {
      unlockAudio();
      if (isButton(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (game.state === "playing") {
        e.preventDefault();
        game.jump();
      }
    };

    // Block page scroll, pull-to-refresh, double-tap / pinch zoom.
    const block = (e: Event) => {
      if (!isButton(e.target)) e.preventDefault();
    };
    const blockAll = (e: Event) => e.preventDefault();

    // iOS Safari only unlocks audio on touchend/click — unlock there too.
    const unlock = () => unlockAudio();
    document.addEventListener("touchend", unlock, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("touchstart", block, { passive: false });
    document.addEventListener("touchmove", blockAll, { passive: false });
    document.addEventListener("dblclick", blockAll);
    document.addEventListener("gesturestart", blockAll);
    document.addEventListener("contextmenu", blockAll);

    return () => {
      document.removeEventListener("touchend", unlock);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("touchstart", block);
      document.removeEventListener("touchmove", blockAll);
      document.removeEventListener("dblclick", blockAll);
      document.removeEventListener("gesturestart", blockAll);
      document.removeEventListener("contextmenu", blockAll);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const start = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    unlockAudio();
    gameRef.current?.start();
  };

  return (
    <div className="rg-page">
      <div className="rg-hud">
        <div className="rg-score">
          <b>SCORE</b>
          <span ref={scoreRef}>0</span>
        </div>
      </div>

      <div className="rg-stage" ref={stageRef}>
        <div className="rg-frame" ref={frameRef}>
          <canvas ref={canvasRef} aria-label="CHEER RUSH 게임 화면">게임 화면</canvas>

          {state === "ready" && (
            <div className="rg-overlay">
              <div className="rg-card">
                <h1 className="rg-title">CHEER RUSH</h1>
                <p className="rg-sub">장애물을 피해 최대한 오래 달려보세요!</p>
                <button type="button" className="rg-btn" onClick={start}>
                  게임 시작
                </button>
                <p className="rg-hint">PC: Space 점프 · 모바일: 화면 터치</p>
              </div>
            </div>
          )}

          {state === "over" && (
            <div className="rg-overlay">
              <div className="rg-card">
                <h2 className="rg-title over">GAME OVER</h2>
                <p className="rg-final">
                  점수: <b>{result.score}</b>
                </p>
                <p className="rg-best">BEST {result.best}</p>
                <button type="button" className="rg-btn" onClick={start}>
                  다시 시작
                </button>
                <p className="rg-hint kbd">Space 키로도 다시 시작할 수 있어요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Index;
