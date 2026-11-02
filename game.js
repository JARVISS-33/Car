import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { Sky } from 'three/addons/objects/Sky.js';

const loginScreen = document.querySelector('#login-screen');
const gameScreen = document.querySelector('#game-screen');
const loginForm = document.querySelector('#login-form');
const nameInput = document.querySelector('#player-name');
const logoutButton = document.querySelector('#logout-button');
const playerLabel = document.querySelector('#player-label');
const speedLabel = document.querySelector('#speed');
const toast = document.querySelector('#toast');
const nitroBar = document.querySelector('#nitro-bar');
const nitroLabel = document.querySelector('#nitro-label');
const healthBar = document.querySelector('#health-bar');
const healthLabel = document.querySelector('#health-label');
const missionLabel = document.querySelector('#mission-label');
const modeLabel = document.querySelector('#mode-label');
const cameraButton = document.querySelector('#camera-button');
const missionButton = document.querySelector('#mission-button');

let renderer, scene, camera, car, wheels = [], clock, animationId;
let speed = 0, heading = 0, steer = 0, cameraMode = 0, nitro = 100, health = 100, nitroActive = false, mission = null, missionTarget = null, missionClock = 0, totalDistance = 0, crashCooldown = 0;
let running = false, playerName = 'Driver';
const keys = new Set();
const maxSpeed = 31;
const world = { roadWidth: 14, block: 38, blocksEachSide: 5 };
const traffic = [];
const obstacles = [];
let audioContext = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  playerName = nameInput.value.trim().slice(0, 24) || 'Driver';
  // Demo-only session: no password, server, or database.
  sessionStorage.setItem('opendrive_session', playerName);
  startGame();
});

logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('opendrive_session');
  stopGame();
  gameScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  nameInput.value = '';
});

function startGame() {
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  playerLabel.textContent = playerName;
  if (!renderer) initWorld();
  running = true;
  clock.start();
  showToast('Welcome, ' + playerName + '! Enjoy the drive.');
  animate();
}

function stopGame() {
  running = false;
  cancelAnimationFrame(animationId);
  keys.clear();
  speed = 0;
}

function initWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc8df);
  scene.fog = new THREE.Fog(0x9cc8df, 120, 520);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
  renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xe5f5ff, 0x5b684f, 2.1));
  const sun = new THREE.DirectionalLight(0xfff0d3, 3.2);
  sun.position.set(-70, 110, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x637966, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.13; ground.receiveShadow = true; scene.add(ground);

  buildRoads();
  buildCity();
  buildCar();
  addDecorations();
  buildTraffic();
  buildObstacles();
  updateCamera(1);
  window.addEventListener('resize', onResize);
}

function mat(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function buildRoads() {
  const roadMat = mat(0x343b43, 0.95), lineMat = mat(0xf5e7a2), curbMat = mat(0xb8c2c5);
  const length = 460;
  for (let i = -world.blocksEachSide; i <= world.blocksEachSide; i++) {
    const p = i * world.block;
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(world.roadWidth, 0.18, length), roadMat);
    vertical.position.set(p, -0.02, 0); vertical.receiveShadow = true; scene.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(length, 0.18, world.roadWidth), roadMat);
    horizontal.position.set(0, -0.02, p); horizontal.receiveShadow = true; scene.add(horizontal);
    for (const offset of [-world.roadWidth / 2 - 0.45, world.roadWidth / 2 + 0.45]) {
      const vcurb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, length), curbMat);
      vcurb.position.set(p + offset, 0, 0); scene.add(vcurb);
      const hcurb = new THREE.Mesh(new THREE.BoxGeometry(length, 0.24, 0.45), curbMat);
      hcurb.position.set(0, 0, p + offset); scene.add(hcurb);
    }
    // Dashed lane markings.
    for (let d = -220; d < 220; d += 12) {
      const dashV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 4.5), lineMat);
      dashV.position.set(p, 0.085, d); scene.add(dashV);
      const dashH = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.025, 0.16), lineMat);
      dashH.position.set(d, 0.085, p); scene.add(dashH);
    }
  }
}

function buildCity() {
  const palette = [0x9aa9b4, 0xc5b9a7, 0x788c98, 0xd0d1c8, 0x8d9c8b, 0x6f7c8e, 0xb8a49b];
  for (let x = -world.blocksEachSide; x < world.blocksEachSide; x++) {
    for (let z = -world.blocksEachSide; z < world.blocksEachSide; z++) {
      if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
      const centerX = x * world.block + world.block / 2;
      const centerZ = z * world.block + world.block / 2;
      // Several buildings per block, set back from the roads.
      const count = 1 + ((Math.abs(x * 7 + z * 3) % 3));
      for (let n = 0; n < count; n++) {
        const bx = centerX + (n - (count - 1) / 2) * 8;
        const bz = centerZ + (n % 2 ? 6 : -5);
        const height = 8 + (Math.abs(x * 17 + z * 11 + n * 13) % 40);
        const width = 7 + (n % 2) * 2;
        const depth = 8 + ((x + z + n + 9) % 3 + 3) % 3 * 2;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          mat(palette[Math.abs(x * 5 + z * 3 + n) % palette.length], 0.92)
        );
        building.position.set(bx, height / 2 - 0.05, bz);
        building.castShadow = true; building.receiveShadow = true; scene.add(building);
        addWindows(building.position, width, height, depth);
      }
    }
  }
}

function addWindows(position, width, height, depth) {
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x9dc6d5, emissive: 0x1b3440, roughness: 0.45, metalness: 0.25 });
  const rows = Math.min(8, Math.floor(height / 4));
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col <= 1; col++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.08), windowMat);
      w.position.set(position.x + col * 2.1, 1.8 + row * 3.4, position.z + depth / 2 + 0.045);
      scene.add(w);
    }
  }
}

function buildCar() {
  car = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x13b98c, metalness: 0.72, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.15 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x182b3c, metalness: 0.25, roughness: 0.12, transparent: true, opacity: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.58, 4.4), bodyMat);
  body.position.y = 0.83; body.castShadow = true; car.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 1.15), bodyMat);
  hood.position.set(0, 1.13, -1.15); car.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.65, 1.85), glassMat);
  cabin.position.set(0, 1.35, 0.22); cabin.castShadow = true; car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 1.35), bodyMat);
  roof.position.set(0, 1.72, 0.25); car.add(roof);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf5f2d2, emissive: 0x8b7c4b, emissiveIntensity: 0.7 });
  for (const x of [-0.68, 0.68]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    head.position.set(x, 0.88, -2.22); car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.06), mat(0xe74349));
    tail.position.set(x, 0.88, 2.22); car.add(tail);
  }
  const tireMat = mat(0x171a20, 0.98), rimMat = mat(0xb8c6cc, 0.32, 0.7);
  wheels = [];
  for (const x of [-1.12, 1.12]) for (const z of [-1.42, 1.42]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.28, 20), tireMat);
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.292, 16), rimMat);
    rim.rotation.z = Math.PI / 2; wheel.add(rim);
    wheel.position.set(x, 0.48, z); car.add(wheel); wheels.push({ group: wheel, front: z < 0 });
  }
  car.position.set(0, 0, 0);
  scene.add(car);
}

function addDecorations() {
  // Street lights placed beside selected intersections.
  const poleMat = mat(0x333d43, 0.6, 0.3);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff0bf, emissive: 0xffc66d, emissiveIntensity: 1.2 });
  for (let x = -4; x <= 4; x += 2) {
    for (let z = -4; z <= 4; z += 2) {
      const px = x * world.block + world.roadWidth / 2 + 1.8;
      const pz = z * world.block + world.roadWidth / 2 + 1.8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.2, 8), poleMat);
      pole.position.set(px, 2.6, pz); scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), poleMat);
      arm.position.set(px + 0.55, 5.1, pz); scene.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.28), lampMat);
      lamp.position.set(px + 1.05, 5.02, pz); scene.add(lamp);
    }
  }
}

function buildTraffic() {
  const colors = [0xe4a23b, 0x4779d1, 0xd94e54, 0xd9dedf, 0x8a67c7];
  for (let i = 0; i < 9; i++) {
    const npc = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 3.7), mat(colors[i % colors.length], 0.38, 0.3));
    body.position.y = 0.72; body.castShadow = true; npc.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 1.6), mat(0x203447, 0.22, 0.2));
    cabin.position.set(0, 1.22, 0.1); npc.add(cabin);
    const tireMat = mat(0x15181d);
    for (const x of [-0.95, 0.95]) for (const z of [-1.15, 1.15]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.18,12), tireMat);
      w.rotation.z = Math.PI/2; w.position.set(x,0.38,z); npc.add(w);
    }
    const lane = i % 2 ? -4 : 4;
    npc.position.set(lane, 0, -170 + i * 38);
    npc.userData = { lane, direction: i % 2 ? 1 : -1, speed: 7 + (i % 4) * 2, phase: i * 1.7 };
    scene.add(npc); traffic.push(npc);
  }
}

function buildObstacles() {
  const poleMat = mat(0xe7b84f, 0.65, 0.1);
  for (let i = -4; i <= 4; i += 2) {
    const x = i * world.block + 10;
    const z = ((i * 19) % 150) - 70;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.25, 12), poleMat);
    cone.position.set(x, 0.62, z); cone.castShadow = true; scene.add(cone);
    obstacles.push({ mesh: cone, radius: 1.6, type: 'pole' });
  }
}

function playTone(freq = 180, duration = 0.09, type = 'sawtooth') {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = 0.035;
    osc.connect(gain); gain.connect(audioContext.destination); osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.stop(audioContext.currentTime + duration);
  } catch (_) { /* Audio may be blocked by browser policy. */ }
}

function startMission() {
  mission = { type: 'checkpoint', remaining: 75, target: new THREE.Vector3(car.position.x + 45, 0, car.position.z - 80), reward: 150 };
  missionTarget?.parent?.remove(missionTarget);
  missionTarget = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.45, 12, 32), new THREE.MeshStandardMaterial({ color: 0x50e3b0, emissive: 0x0a6b4a, emissiveIntensity: 1.5 }));
  ring.position.y = 2.5; missionTarget.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), new THREE.MeshBasicMaterial({ color: 0x50e3b0, transparent: true, opacity: 0.45 }));
  beam.position.y = 2.5; missionTarget.add(beam); missionTarget.position.copy(mission.target); scene.add(missionTarget);
  missionLabel.textContent = 'Reach the glowing checkpoint · 75s';
  modeLabel.textContent = 'CHECKPOINT RUN'; missionButton.textContent = 'Restart mission';
  showToast('Mission started: reach the green checkpoint!');
}

function checkCollisions(dt) {
  crashCooldown = Math.max(0, crashCooldown - dt);
  for (const npc of traffic) {
    if (car.position.distanceTo(npc.position) < 2.65 && crashCooldown <= 0) {
      speed *= -0.22; health = Math.max(0, health - 12); crashCooldown = 1.1;
      playTone(95, 0.22, 'square'); showToast('Traffic collision! Vehicle condition reduced.');
      if (health <= 0) { speed = 0; showToast('Vehicle disabled — press R to recover.'); }
    }
  }
  for (const ob of obstacles) {
    if (car.position.distanceTo(ob.mesh.position) < ob.radius && crashCooldown <= 0) {
      speed *= -0.15; health = Math.max(0, health - 8); crashCooldown = 0.9;
      playTone(120, 0.16, 'triangle'); showToast('Obstacle impact!');
    }
  }
}

function resetCar() {
  car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); heading = 0; speed = 0; health = 100; nitro = Math.max(nitro, 30);
  showToast('Vehicle recovered.');
}

function updateCamera(dt) {
  if (!car) return;
  const distance = cameraMode === 0 ? 9.5 : cameraMode === 1 ? 4.3 : 0.2;
  const height = cameraMode === 0 ? 5.0 : cameraMode === 1 ? 2.1 : 1.55;
  const behind = new THREE.Vector3(Math.sin(heading) * distance, height, Math.cos(heading) * distance);
  const target = car.position.clone().add(new THREE.Vector3(0, 1, 0)).add(behind);
  camera.position.lerp(target, Math.min(1, dt * 4.5));
  camera.lookAt(car.position.x, car.position.y + (cameraMode === 2 ? 1.5 : 1.0), car.position.z);
}

function animate() {
  if (!running) return;
    animationId = requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  const accelerating = keys.has('ArrowUp') || keys.has('KeyW');
  const braking = keys.has('ArrowDown') || keys.has('KeyS');
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');

  nitroActive = keys.has('Space') && nitro > 0 && accelerating;

  if (accelerating) {
    speed = Math.min(
      maxSpeed * (nitroActive ? 1.55 : 1),
      speed + (nitroActive ? 30 : 17) * dt
    );
  } else {
    speed *= Math.pow(0.987, dt * 60);
  }

  if (nitroActive) {
    nitro = Math.max(0, nitro - 32 * dt);
  } else {
    nitro = Math.min(100, nitro + 5 * dt);
  }

  if (braking) speed = Math.max(-8, speed - 25 * dt);

  steer = (left ? 1 : 0) - (right ? 1 : 0);
  const steeringEffect = Math.min(1, Math.abs(speed) / 5);
  heading += steer * steeringEffect * 1.55 * dt * Math.sign(speed || 1);
  car.rotation.y = heading;
  const forward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
  const oldPosition = car.position.clone();
  car.position.addScaledVector(forward, speed * dt);
  totalDistance += Math.abs(speed * dt);
  checkCollisions(dt);
  if (health <= 0) speed *= 0.96;
  for (const npc of traffic) {
    npc.position.z += npc.userData.direction * npc.userData.speed * dt;
    npc.position.x = npc.userData.lane + Math.sin(performance.now() * 0.00025 + npc.userData.phase) * 0.55;
    if (npc.position.z > 225) npc.position.z = -225; if (npc.position.z < -225) npc.position.z = 225;
    npc.rotation.y = npc.userData.direction > 0 ? Math.PI : 0;
  }
  if (mission) {
    mission.remaining -= dt;
    if (missionTarget) missionTarget.rotation.y += dt * 0.8;
    if (car.position.distanceTo(mission.target) < 7) { mission = null; missionTarget?.parent?.remove(missionTarget); missionTarget = null; nitro = Math.min(100, nitro + 35); missionLabel.textContent = 'Completed! Reward: +150 demo credits'; modeLabel.textContent = 'FREE DRIVE'; missionButton.textContent = 'Start mission'; showToast('Checkpoint complete! +150 demo credits (session only).'); playTone(640, 0.2, 'sine'); }
    else if (mission.remaining <= 0) { mission = null; missionTarget?.parent?.remove(missionTarget); missionTarget = null; missionLabel.textContent = 'Mission expired — try again'; modeLabel.textContent = 'FREE DRIVE'; missionButton.textContent = 'Start mission'; showToast('Time is up. Start the mission again.'); }
    else missionLabel.textContent = 'Checkpoint · ' + Math.ceil(mission.remaining) + 's';
  }
  // Simple boundary/obstacle response keeps the prototype playable.
  car.position.x = THREE.MathUtils.clamp(car.position.x, -215, 215);
  car.position.z = THREE.MathUtils.clamp(car.position.z, -215, 215);
  for (const wheel of wheels) {
    if (wheel.front) wheel.group.rotation.y = -steer * 0.28;
    wheel.group.rotation.x += speed * dt / 0.43;
  }
  speedLabel.textContent = String(Math.round(Math.abs(speed) * 3.6)).padStart(3, '0');
  nitroBar.style.width = nitro + '%'; nitroLabel.textContent = Math.round(nitro) + '%';
  healthBar.style.width = health + '%'; healthLabel.textContent = Math.round(health) + '%';
  nitroBar.style.background = nitroActive ? '#e8f879' : '#50e3b0'; healthBar.style.background = health < 35 ? '#f16c73' : '#50e3b0';
  updateCamera(dt);
  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer || !camera) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyC' && running) {
    cameraMode = (cameraMode + 1) % 3;
    cameraButton.textContent = 'Camera: ' + ['Chase','Close','First person'][cameraMode] + ' (C)';
    showToast(['Chase camera','Close camera','First-person camera'][cameraMode]);
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('keydown', (event) => { if (event.code === 'KeyR' && running) resetCar(); if (event.code === 'KeyH' && running) { playTone(520,0.25,'sine'); showToast('Horn!'); } });
cameraButton.addEventListener('click', () => { cameraMode = (cameraMode + 1) % 3; cameraButton.textContent = 'Camera: ' + ['Chase','Close','First person'][cameraMode] + ' (C)'; });
missionButton.addEventListener('click', startMission);
window.addEventListener('blur', () => keys.clear());
document.querySelectorAll('[data-key]').forEach(button => {
  const code = button.dataset.key;
  const down = (event) => { event.preventDefault(); keys.add(code); };
  const up = (event) => { event.preventDefault(); keys.delete(code); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
});

// A closed tab normally clears sessionStorage; also reset any stale demo session on a fresh page load.
sessionStorage.removeItem('opendrive_session');
