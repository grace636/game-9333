// Tiny synthesized jump "뿅" — no audio files, just one oscillator per jump.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture (tap / key / click) so mobile browsers allow audio. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state !== "running") void c.resume().catch(() => {});
}

export function playJump() {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") void c.resume().catch(() => {});
  const t = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  // Quick upward pitch sweep = "뿅"
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(1250, t + 0.09);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.16);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
