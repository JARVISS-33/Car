# OpenDrive 3D — GitHub Pages starter

A small browser-based 3D driving prototype built with HTML, CSS, JavaScript and Three.js.

## Features
- Procedural demo city and roads
- Simple 3D sports car model
- Keyboard and mobile touch controls
- Chase and close camera modes
- Demo nickname entry (not real authentication)
- No database or backend

## Run locally
Because `game.js` uses JavaScript modules, run it through a local static web server rather than opening `index.html` as a `file://` URL. For example, use VS Code Live Server or Python's built-in server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages
1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root.
3. Open the repository's **Settings → Pages**.
4. Under build/deployment, select **Deploy from a branch**.
5. Choose the `main` branch and `/(root)`, then save.
6. Wait for deployment and open the Pages URL shown by GitHub.

## Controls
- W / Up Arrow: accelerate
- S / Down Arrow: brake/reverse
- A / Left Arrow: steer left
- D / Right Arrow: steer right
- C: switch camera
- On mobile, use the on-screen buttons.

## Important limitations
- This is a starter prototype, not a finished commercial-quality simulator.
- It uses a simple procedural car model and simplified movement, not a full tire/suspension simulation.
- Three.js is loaded from jsDelivr, so the first load needs internet access.
- The nickname screen is a demo gate, not secure authentication. Never enter a real password.
- Session data is not stored in a database. Browser session storage is cleared on fresh page load and normally when the tab closes.
- This project is inspired by open-world driving games; it does not include the original game's proprietary assets or source code.
