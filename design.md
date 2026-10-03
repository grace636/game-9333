# Design — CHEER RUSH

- Style: bright, cute pixel-art (matches provided stadium background).
- Font: Galmuri11 Bold (Korean pixel font, self-hosted in /fonts).
- Colors: sky #3fa6f2→#9fdcff page, cream card #fff8e6, outline #2a1a12, red accent #ff5a4e, orange button #ffb21f, yellow #ffd23a.
- Components: pill score HUD above the game; cream cards with 4px dark outline + hard drop shadow; round chunky buttons (min 56px tall).
- Game: single canvas, logical height 680, width adapts to screen (aspect 0.56–1.6). Sprites drawn as pixel maps, nearest-neighbour scaling.
