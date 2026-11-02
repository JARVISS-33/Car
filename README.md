# OpenDrive 3D — GitHub Pages demo

A no-backend browser driving prototype built with HTML, CSS, JavaScript and Three.js. It is an original demo inspired by open-world driving games, not a copy of another game's assets or code.

## Features in this build
- Procedurally generated grid city, roads, buildings, street lights and obstacle cones.
- Simple player sports car with keyboard and touch controls.
- Chase, close and simple first-person-like camera modes.
- Traffic cars that cruise around simple lanes.
- Basic traffic/obstacle proximity impacts and a vehicle-condition meter.
- Nitro boost with drain/recharge meter.
- Timed checkpoint mission with glowing marker and completion feedback.
- Basic synthesized Web Audio feedback for impacts and mission completion.
- No backend, no database, no real account authentication. Demo session is cleared on fresh page load/exit.

## Controls
- `W` / `Arrow Up`: accelerate
- `S` / `Arrow Down`: brake/reverse
- `A` / `Arrow Left`: steer left
- `D` / `Arrow Right`: steer right
- `Space`: nitro while accelerating
- `C`: cycle camera
- `R`: recover/reset the car
- On touch screens, use the on-screen buttons.

## Deploy on GitHub Pages
1. Extract the ZIP.
2. Upload `index.html`, `style.css`, `game.js`, `README.md`, `TECHNICAL_DESIGN.md`, and `data-models.json` to the **repository root** (not inside an extra folder).
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**, branch `main`, folder `/(root)`, then save.
5. Wait for deployment, then hard-refresh the site with `Ctrl + F5`.

## Important troubleshooting
The game loads Three.js from jsDelivr, so the browser needs access to `cdn.jsdelivr.net`. The `index.html` includes an import map for the `three` and `three/addons/` module names; keep the import map above the `game.js` script. If the game still shows a blank screen, open F12 → Console and inspect the first red error. Some company networks block external CDNs or WebGL.

## Scope limits
This is a feature-rich prototype, not a production-grade mobile simulator. Physics are simplified kinematics, collision checks are proximity-based, and traffic is basic. Garage purchases, realistic rigid-body physics, detailed suspension, save/load persistence, authored 3D assets, missions beyond a checkpoint run, and real engine audio are documented as production design targets in `TECHNICAL_DESIGN.md` but are not all implemented. `data-models.json` contains sample schemas only; no database is connected.
