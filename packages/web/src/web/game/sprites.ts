// Pixel-art sprites defined as character maps and pre-rendered once to small
// offscreen canvases. Drawn later with image smoothing off, so they stay crisp.

const PALETTE: Record<string, string> = {
  K: "#2a1a12", // outline
  H: "#6b3a1f", // hair
  h: "#9a5a30", // hair highlight
  R: "#ff5a4e", // headband / shirt
  r: "#c93b34", // shirt shade
  S: "#ffd6b0", // skin
  s: "#eeb089", // skin shade
  P: "#ff8f9a", // cheek
  W: "#ffffff",
  B: "#3a6ee8", // shorts
  b: "#2a4fb0",
  O: "#ffb21f", // shoe
  o: "#d9831a",
  g: "#9aa3ad", // stone
  G: "#d3dae1",
  d: "#6b737c",
  y: "#c8813a", // wood
  Y: "#eba95c",
  Z: "#ffd23a", // sign yellow
  z: "#e0a91c",
  n: "#8a4d22", // barrel
  N: "#b8692e",
  m: "#5b5f66", // metal
};

function build(rows: string[]): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = PALETTE[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// ── Character (16 x 20) ─────────────────────────────────────────────
const HEAD = [
  "....KKKKKKK.....",
  "..KKhhhHHHHKK...",
  ".KHhhHHHHHHHHK..",
  "KRRRRRRRRRRRRK..",
  "KRKSSSSSSSSSSK..",
  ".KSSSSSSKSSKSK..",
  ".KSSSSSSKSSKSK..",
  ".KSSSSSPSKSSPK..",
  "..KsSSSSSSSSK...",
  "...KKKKKKKKK....",
];

const RUN_BODIES = [
  // stride A: right leg forward
  [
    "....KRRRRRKK....",
    "...KRRRRRRSSK...",
    "..KSKrRRRRKK....",
    "...KKBBBBBK.....",
    "...KBBBKBBBK....",
    "..KBBK..KSSK....",
    ".KSSK....KSK....",
    "KOOK.....KOOK...",
    "KKK......KOOOK..",
    ".........KKKKK..",
  ],
  // passing
  [
    "....KRRRRRK.....",
    "....KRRRRRK.....",
    "....KRSSrRK.....",
    "....KBBBBBK.....",
    "....KBBBBBK.....",
    ".....KSKSK......",
    "....KSSKSK......",
    "...KOOKKSK......",
    "...KOOOKOOK.....",
    "...KKKKKKKK.....",
  ],
  // stride B: left leg forward
  [
    "...KKRRRRRK.....",
    "..KSSRRRRRRK....",
    "...KKrRRRRKSK...",
    "....KBBBBBKK....",
    "...KBBBKBBBK....",
    "...KSSK..KBBK...",
    "...KSK....KSSK..",
    "..KOOK....KOOK..",
    ".KOOOK....KKK...",
    ".KKKKK..........",
  ],
  // passing (other leg)
  [
    "....KRRRRRK.....",
    "....KRRRRRK.....",
    "....KRrSSRK.....",
    "....KBBBBBK.....",
    "....KBBBBBK.....",
    ".....KSKSK......",
    ".....KSKSSK.....",
    ".....KSKKOOK....",
    "....KOOKOOOK....",
    "....KKKKKKKK....",
  ],
];

const JUMP_BODY = [
  "..KSKRRRRRKSK...",
  "..KSKRRRRRKSK...",
  "...KKrRRRRKK....",
  "....KBBBBBK.....",
  "...KBBBBBBBK....",
  "..KSSK..KSSK....",
  "..KOOK..KOOK....",
  "..KOOOK.KOOOK...",
  "..KKKKK.KKKKK...",
  "................",
];

const HURT_HEAD = [
  "....KKKKKKK.....",
  "..KKhhhHHHHKK...",
  ".KHhhHHHHHHHHK..",
  "KRRRRRRRRRRRRK..",
  "KRKSSSSSSKSKSK..",
  ".KSSSSSSSKSSSK..",
  ".KSSSSSSKSKSSK..",
  ".KSSSSSPSSKKPK..",
  "..KsSSSSSKKSK...",
  "...KKKKKKKKK....",
];

const IDLE_BODY = [
  "....KRRRRRK.....",
  "...KRRRRRRRK....",
  "...KSKrRRRKSK...",
  "....KBBBBBK.....",
  "....KBBKBBK.....",
  ".....KSKSK......",
  ".....KSKSK......",
  "....KOOKOOK.....",
  "....KOOKOOOK....",
  "....KKKKKKKK....",
];

// ── Obstacles ───────────────────────────────────────────────────────
const STONE = [
  "..KKKK..",
  ".KgGGgK.",
  "KgGgggdK",
  "KggggddK",
  "KKKKKKKK",
];

const ROCK = [
  "....KKKK.....",
  "..KKgGGGK....",
  ".KggGGGgKKK..",
  ".KgggggggGgK.",
  "KdggggggggggK",
  "KddgggggggggK",
  "KdddggggggddK",
  "KdddddddddddK",
  "KKKKKKKKKKKKK",
];

const HURDLE = [
  "KKKKKKKKKKKK",
  "KWWRRWWRRWWK",
  "KWWRRWWRRWWK",
  "KKKKKKKKKKKK",
  ".KmK....KmK.",
  ".KmK....KmK.",
  ".KmK....KmK.",
  ".KmK....KmK.",
  ".KmK....KmK.",
  ".KmK....KmK.",
  "KKmKK..KKmKK",
  "KKKKK..KKKKK",
];

const CRATE = [
  "KKKKKKKKKK",
  "KyYYYYYYyK",
  "KYKyyyyKYK",
  "KYyKyyKyYK",
  "KYyyKKyyYK",
  "KYyKyyKyYK",
  "KYKyyyyKYK",
  "KyYYYYYYyK",
  "KKKKKKKKKK",
];

const SIGN = [
  ".....K.....",
  "....KZK....",
  "...KZZZK...",
  "...KZKZK...",
  "..KZZKZZK..",
  "..KZZKZZK..",
  ".KZZZZZZZK.",
  ".KZZZKZZZK.",
  "KzzzzzzzzzK",
  "KKKKKKKKKKK",
  "..KmK.KmK..",
  ".KmK...KmK.",
  ".KmK...KmK.",
  "KKKK...KKKK",
];

const BARREL = [
  "...KKKKK...",
  ".KKnnnnnKK.",
  ".KnNNKNNnK.",
  "KnNNNKNNNnK",
  "KnNNNKNNNnK",
  "KKKKKKKKKKK",
  "KnNNNKNNNnK",
  "KnNNNKNNNnK",
  ".KnNNKNNnK.",
  ".KKnnnnnKK.",
  "...KKKKK...",
];

export interface Sprites {
  run: HTMLCanvasElement[];
  jump: HTMLCanvasElement;
  idle: HTMLCanvasElement;
  hurt: HTMLCanvasElement;
  stone: HTMLCanvasElement;
  rock: HTMLCanvasElement;
  hurdle: HTMLCanvasElement;
  crates: HTMLCanvasElement;
  crate: HTMLCanvasElement;
  sign: HTMLCanvasElement;
  barrel: HTMLCanvasElement;
}

export function buildSprites(): Sprites {
  return {
    run: RUN_BODIES.map((b) => build([...HEAD, ...b])),
    jump: build([...HEAD, ...JUMP_BODY]),
    idle: build([...HEAD, ...IDLE_BODY]),
    hurt: build([...HURT_HEAD, ...JUMP_BODY]),
    stone: build(STONE),
    rock: build(ROCK),
    hurdle: build(HURDLE),
    crate: build(CRATE),
    crates: build([...CRATE, ...CRATE]),
    sign: build(SIGN),
    barrel: build(BARREL),
  };
}
