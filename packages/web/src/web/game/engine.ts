import { buildSprites, type Sprites } from "./sprites";
import { playJump } from "./sound";

export type GameState = "ready" | "playing" | "over";

interface Callbacks {
  onScore: (score: number) => void;
  onState: (state: GameState, score: number, best: number) => void;
}

interface ObstacleType {
  key: keyof Omit<Sprites, "run" | "jump" | "idle" | "hurt">;
  scale: number; // pixels per sprite pixel
  weight: number; // spawn weight
  minLevel: number; // 0..1 difficulty at which it can appear
  extraSpeed?: number; // rolls faster than the ground
  rolls?: boolean;
  // hitbox inset (in logical px): left, top, right
  inset: [number, number, number];
}

interface Obstacle {
  type: ObstacleType;
  x: number;
  w: number;
  h: number;
  rot: number;
}

// Logical world: fixed height, width adapts to the screen aspect ratio.
const H = 680;
const GROUND = 648; // feet line, sits on the dirt track of the background
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 1.6;

const GRAVITY = 2500;
const JUMP_V = 840; // apex ≈ 141px, air time ≈ 0.67s
const AIR_TIME = (2 * JUMP_V) / GRAVITY;
const JUMP_BUFFER = 0.1; // seconds a tap is remembered just before landing

const BASE_SPEED = 330;
const MAX_SPEED = 640;
const ACCEL = 6; // px/s per second → max speed after ~50s

const CHAR_SCALE = 4;
const CHAR_W = 16 * CHAR_SCALE;
const CHAR_H = 20 * CHAR_SCALE;
// Forgiving hitbox inside the 64x80 sprite (ignores hair tips, band tail, feet edges)
const HIT = { l: 14, t: 10, r: 14, b: 4 };

const TYPES: ObstacleType[] = [
  { key: "stone", scale: 4, weight: 3, minLevel: 0, inset: [4, 4, 4] },
  { key: "rock", scale: 4, weight: 3, minLevel: 0, inset: [6, 6, 6] },
  { key: "hurdle", scale: 4, weight: 3, minLevel: 0, inset: [4, 3, 4] },
  { key: "sign", scale: 4, weight: 2, minLevel: 0.1, inset: [8, 10, 8] },
  { key: "barrel", scale: 4, weight: 2, minLevel: 0.15, extraSpeed: 90, rolls: true, inset: [7, 7, 7] },
  { key: "crates", scale: 4, weight: 2, minLevel: 0.25, inset: [4, 3, 4] },
];

const BEST_KEY = "runner-best";

// Background layers (in source-image rows, image is 707 x 1000)
const BG_W = 707;
const BG_H = 1000;
const LAYERS = [
  { sy: 0, sh: 677, factor: 0.12 }, // sky + stadium
  { sy: 677, sh: 180, factor: 0.55 }, // field
  { sy: 857, sh: 143, factor: 1 }, // grass edge + track
];

export class RunnerGame {
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  private sprites: Sprites;
  private bg: HTMLCanvasElement | null = null;
  private sheet: { img: HTMLImageElement; frames: number } | null = null;

  private W = 480;
  private view = 1; // logical → device pixel scale
  private ro: ResizeObserver;
  private raf = 0;
  private last = 0;

  state: GameState = "ready";
  private score = 0;
  private shownScore = -1;
  private best = 0;
  private speed = BASE_SPEED;
  private elapsed = 0;
  private scroll = 0;
  private y = 0; // height above ground (>= 0)
  private vy = 0;
  private grounded = true;
  private buffer = 0;
  private animT = 0;
  private obstacles: Obstacle[] = [];
  private nextGap = 0;
  private nextType: ObstacleType | null = null;
  private overAt = 0;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement, cb: Callbacks) {
    this.canvas = canvas;
    this.container = container;
    this.cb = cb;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.sprites = buildSprites();
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }

    const img = new Image();
    img.onload = () => {
      // Mirror-tile the background so it can scroll seamlessly.
      const c = document.createElement("canvas");
      c.width = BG_W * 2;
      c.height = BG_H;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, BG_W, BG_H);
      g.translate(BG_W * 2, 0);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, BG_W, BG_H);
      this.bg = c;
      this.render();
    };
    img.src = "/images/bg.webp";

    // Optional: drop a horizontal sprite sheet of square run frames at
    // /images/character.png and it replaces the built-in pixel character.
    const sheet = new Image();
    sheet.onload = () => {
      const frames = Math.max(1, Math.round(sheet.width / sheet.height));
      this.sheet = { img: sheet, frames };
    };
    sheet.onerror = () => {};
    sheet.src = "/images/character.png";

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  get bestScore() {
    return this.best;
  }

  /** True if an input right now should be ignored (just died). */
  get locked() {
    return this.state === "over" && performance.now() - this.overAt < 450;
  }

  start() {
    if (this.locked || this.state === "playing") return;
    this.score = 0;
    this.shownScore = -1;
    this.speed = BASE_SPEED;
    this.elapsed = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.buffer = 0;
    this.obstacles = [];
    this.nextType = null;
    this.nextGap = BASE_SPEED * 1.1; // first obstacle after ~1s + travel
    this.state = "playing";
    this.emitScore();
    this.cb.onState("playing", 0, this.best);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  jump() {
    if (this.state !== "playing") return;
    if (this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
      this.buffer = 0;
      playJump();
    } else {
      // Remember the press briefly; it fires only once we have landed.
      this.buffer = JUMP_BUFFER;
    }
  }

  private resize() {
    // Available size = container content box (padding leaves room for the frame border)
    const cs = getComputedStyle(this.container);
    const r = {
      width: this.container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      height: this.container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
    };
    if (r.width < 10 || r.height < 10) return;
    const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, r.width / r.height));
    this.W = Math.round(H * aspect);
    const cssScale = Math.min(r.width / this.W, r.height / H);
    const cssW = Math.floor(this.W * cssScale);
    const cssH = Math.floor(H * cssScale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.view = this.canvas.width / this.W;
    this.render();
  }

  private get charX() {
    return Math.round(Math.min(140, Math.max(48, this.W * 0.14)));
  }

  private loop(now: number) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.state === "playing") this.update(dt);
    else if (this.state === "ready") this.animT += dt;
    this.render();
    if (this.state !== "over") this.raf = requestAnimationFrame(this.loop);
  }

  private level() {
    return (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
  }

  private update(dt: number) {
    this.elapsed += dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + ACCEL * this.elapsed);
    const dx = this.speed * dt;
    this.scroll += dx;
    this.animT += dt * (this.speed / BASE_SPEED);

    // Jump physics
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        if (this.buffer > 0) {
          this.buffer = 0;
          this.jump();
        }
      }
    }
    if (this.buffer > 0) this.buffer = Math.max(0, this.buffer - dt);

    // Move & cull obstacles
    for (const o of this.obstacles) {
      const v = this.speed + (o.type.extraSpeed ?? 0);
      o.x -= v * dt;
      if (o.type.rolls) o.rot -= (v * dt) / (o.w / 2);
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -20);

    // Spawn
    this.nextGap -= dx;
    if (this.nextGap <= 0) this.spawn();

    // Collision
    const cx = this.charX;
    const top = GROUND - this.y - CHAR_H;
    const a = { l: cx + HIT.l, r: cx + CHAR_W - HIT.r, t: top + HIT.t, b: GROUND - this.y - HIT.b };
    for (const o of this.obstacles) {
      const [il, it, ir] = o.type.inset;
      const ol = o.x + il;
      const or = o.x + o.w - ir;
      const ot = GROUND - o.h + it;
      if (a.r > ol && a.l < or && a.b > ot) {
        this.gameOver();
        return;
      }
    }

    // Score grows with time (and a bit with speed)
    this.score += dx / 30;
    this.emitScore();
  }

  private pickType(prev: ObstacleType | null): ObstacleType {
    const lv = this.level();
    const pool = TYPES.filter((t) => lv >= t.minLevel);
    const total = pool.reduce((s, t) => s + t.weight, 0);
    let pick = Math.random() * total;
    let type = pool[0];
    for (const t of pool) {
      pick -= t.weight;
      if (pick <= 0) {
        type = t;
        break;
      }
    }
    // Avoid two tall crates back to back
    if (prev && prev.key === "crates" && type.key === "crates") type = TYPES[0];
    return type;
  }

  private spawn() {
    const lv = this.level();
    const type = this.nextType ?? this.pickType(null);
    const spr = this.sprites[type.key];
    const w = spr.width * type.scale;
    const h = spr.height * type.scale;
    this.obstacles.push({ type, x: this.W + 20, w, h, rot: 0 });

    // Decide the following obstacle now, so its gap can account for it.
    const next = this.pickType(type);
    this.nextType = next;

    // Gap until the next spawn, in seconds of travel. Always longer than one
    // full jump plus reaction time, so every sequence can be cleared.
    const minT = AIR_TIME + 0.42 - 0.14 * lv; // ~1.14s -> ~1.0s
    const maxT = 2.1 - 0.6 * lv; // 2.1s -> 1.5s
    let gap = this.speed * (minT + Math.random() * (maxT - minT)) + w;
    // A rolling barrel catches up with whatever is ahead of it: add the
    // distance it can close before reaching the runner.
    if (next.extraSpeed) gap += (next.extraSpeed * (this.W + 20 - this.charX)) / this.speed;
    this.nextGap = gap;
  }

  private gameOver() {
    this.state = "over";
    this.overAt = performance.now();
    const final = Math.floor(this.score);
    if (final > this.best) {
      this.best = final;
      try {
        localStorage.setItem(BEST_KEY, String(final));
      } catch {
        /* ignore */
      }
    }
    this.cb.onState("over", final, this.best);
  }

  private emitScore() {
    const s = Math.floor(this.score);
    if (s !== this.shownScore) {
      this.shownScore = s;
      this.cb.onScore(s);
    }
  }

  // ── Rendering ────────────────────────────────────────────────────
  private render() {
    const ctx = this.ctx;
    const k = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Background (drawn in device pixels to keep pixel edges stable)
    if (this.bg) {
      const s = (H / BG_H) * k; // source px → device px
      const period = BG_W * 2 * s;
      let dy = 0;
      for (const L of LAYERS) {
        const dh = Math.ceil(L.sh * s) + 1;
        const off = ((this.scroll * L.factor * k) % period + period) % period;
        for (let x = -Math.round(off); x < this.canvas.width; x += period) {
          ctx.drawImage(this.bg, 0, L.sy, BG_W * 2, L.sh, Math.round(x), Math.round(dy), Math.ceil(period) + 1, dh);
        }
        dy += L.sh * s;
      }
    } else {
      ctx.fillStyle = "#4fb4f7";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Obstacles
    for (const o of this.obstacles) {
      const spr = this.sprites[o.type.key];
      this.shadow(o.x + o.w / 2, o.w * 0.55, 1);
      if (o.type.rolls) {
        ctx.save();
        ctx.translate(Math.round(o.x + o.w / 2), Math.round(GROUND - o.h / 2));
        ctx.rotate(o.rot);
        ctx.drawImage(spr, -o.w / 2, -o.h / 2, o.w, o.h);
        ctx.restore();
      } else {
        ctx.drawImage(spr, Math.round(o.x), GROUND - o.h, o.w, o.h);
      }
    }

    // Character
    const cx = this.charX;
    const lift = Math.min(1, this.y / 160);
    this.shadow(cx + CHAR_W / 2, 26 - 10 * lift, 1 - 0.6 * lift);
    const top = Math.round(GROUND - this.y - CHAR_H);

    if (this.sheet) {
      const { img, frames } = this.sheet;
      const f = this.state === "playing" && this.grounded ? Math.floor(this.animT * 12) % frames : 0;
      const fw = img.width / frames;
      const dh = CHAR_H;
      const dw = (fw / img.height) * dh;
      ctx.drawImage(img, f * fw, 0, fw, img.height, cx + CHAR_W / 2 - dw / 2, top, dw, dh);
    } else {
      let spr: HTMLCanvasElement;
      let bob = 0;
      if (this.state === "over") spr = this.sprites.hurt;
      else if (this.state === "ready") {
        spr = this.sprites.idle;
        bob = Math.floor(this.animT * 2.5) % 2;
      } else if (!this.grounded) spr = this.sprites.jump;
      else {
        const f = Math.floor(this.animT * 11) % 4;
        spr = this.sprites.run[f];
        bob = f % 2 === 1 ? -1 : 0;
      }
      ctx.drawImage(spr, cx, top + bob * CHAR_SCALE, CHAR_W, CHAR_H);
    }

    if (this.state === "over") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(0, 0, this.W, H);
    }
  }

  private shadow(x: number, rx: number, alpha: number) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(60, 20, 10, ${0.28 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, GROUND + 1, rx, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
