# OpenDrive 3D — Technical Design Document

> **Scope and honesty note:** This repository is a browser-playable prototype, not a reverse-engineered copy of Extreme Car Driving Simulator. The commercial game's internal source code and architecture are not public. This document describes a proposed production architecture and maps the parts that are implemented in this small Three.js demo. A true production mobile simulator would normally use Unity/Unreal, a dedicated vehicle-physics solution, authored assets, profiling, QA, and platform-specific build pipelines.

## 1. System architecture

### Runtime layers
1. **Presentation:** HTML/CSS menus and HUD, Three.js renderer, camera, meshes, effects.
2. **Simulation:** vehicle input, simplified longitudinal/lateral motion, traffic movement, collision proximity checks, nitro, mission timer.
3. **Domain state:** player session, vehicle condition, nitro, mission state, camera mode, total distance.
4. **Persistence adapter:** this demo deliberately has no server or database. Nickname is session-only and cleared on a fresh page load. A production save adapter would use a versioned local profile or authenticated backend.
5. **Platform integration:** keyboard, pointer/touch controls, Web Audio, resize handling, CDN-loaded Three.js.

### Recommended production module contracts
| Module | Purpose / inputs | Outputs and events | Dependencies | Failure handling |
|---|---|---|---|---|
| GameManager | Owns lifecycle, delta time, pause/resume, system updates | `gameStarted`, `gamePaused`, `gameResumed`, `gameStopped` | Scene, input, vehicle, UI | Clamp delta time; stop loop on fatal renderer failure |
| SceneManager | Loads world chunks and scene transitions | `sceneReady`, `sceneChanged` | Asset loader, world definitions | Show loading/error state; retry or load fallback scene |
| UIManager | Menus, HUD, dialogs; receives domain state | UI actions such as `pauseRequested`, `cameraRequested` | DOM/UI framework, game state | Disable unavailable actions; display recoverable error |
| AudioManager | Engine RPM, tire slip, impacts, horn, ambience | One-shots and continuous audio parameters | Web Audio/audio assets | Respect mute/autoplay rules; no crash if audio is blocked |
| SaveLoadManager | Versioned profile read/write, migrations | `saveSucceeded`, `saveFailed`, `profileLoaded` | Storage adapter | Validate schema, retain last valid save, never overwrite on parse failure |
| SettingsManager | Input sensitivity, graphics, audio, camera preferences | `settingsChanged` | UI, storage | Clamp invalid values and fall back to defaults |
| VehicleManager | Selects car configuration and creates vehicle instances | `vehicleSpawned`, `vehicleChanged` | Vehicle definitions, physics | Spawn safe fallback vehicle |
| MissionManager | Objective, timer, checkpoints, completion/reward | `missionStarted`, `checkpointReached`, `missionCompleted`, `missionFailed` | World markers, reward manager | Timeouts, reset objective, reject duplicate reward claim |
| TrafficManager | Spawn budget, routes, lane state, avoidance, despawn | `trafficSpawned`, `trafficCollision` | Navigation graph, vehicle physics | Cap NPC count; despawn outside streaming radius |
| Physics/Collision | Integrates forces and resolves contacts | `collisionEntered`, `vehicleDamaged`, `vehicleRecovered` | Vehicle body, collider shapes | Clamp extreme impulses; recover stuck/flipped car |
| Economy/Garage | Currency ledger, purchases, unlocks, upgrades | `purchaseRequested`, `purchaseCompleted` | Profile, vehicle catalog | Validate affordability and item IDs atomically |
| EffectsManager | Dust, tire smoke, sparks, nitro particles, damage visuals | Effect lifecycle | Renderer, collision/vehicle state | Pool effects; degrade gracefully on low-end devices |

## 2. Vehicle simulation

### Prototype behaviour
The current browser demo uses a deliberately simplified kinematic model: acceleration and braking change a scalar speed, steering changes heading in proportion to speed, and position advances along the car's forward vector. It rotates visible wheels. It does **not** currently use a true rigid-body solver, realistic tire forces, spring-damper suspension, deformable damage, or production-grade contact resolution.

### Production vehicle model
Represent the vehicle state as position `p`, orientation quaternion `q`, linear velocity `v`, angular velocity `ω`, engine RPM, gear, steering angle, wheel angular velocities, suspension compression, nitro amount, and damage. For a rigid-body vehicle:
- Longitudinal tire force is limited by available normal force and friction: `|F_tire| <= μ * F_normal`.
- Approximate engine wheel force: `F_drive = (engineTorque * gearRatio * finalDrive * efficiency) / wheelRadius`.
- Drag: `F_drag = 0.5 * airDensity * Cd * frontalArea * speed²` opposite velocity.
- Rolling resistance: `F_roll ≈ Crr * mass * g` opposite motion.
- Net translation: `a = (F_drive + F_brake + F_drag + F_roll + F_contact) / mass`.
- Steering angle should reduce with speed; tire slip angle and lateral grip limit cornering force.
- Suspension uses spring-damper force `F = -k*x - c*v_suspension`, clamped to travel limits.
- Center of mass is moved lower to reduce unrealistic rolling; it should not make flips impossible.
- Airborne state disables grounded tire forces and applies gravity; landing resolves contact impulses.

### Gears, braking and drift
- Forward: apply positive wheel torque while engine is in a forward gear.
- Brake: apply brake torque and reduce speed; if near zero, optionally transition to reverse.
- Reverse: cap reverse speed and invert drive direction; steering response is mirrored appropriately.
- Drift: allow controlled rear slip when lateral demand exceeds grip, with tire smoke/audio based on slip energy. Avoid simply rotating the car without velocity changes in a production simulation.
- Stabilization: modest yaw/roll damping and anti-roll forces, disabled or reduced in the air so stunts remain possible.

## 3. Collision and damage design

### Pipeline
1. Broad phase: spatial grid or BVH identifies nearby collider pairs.
2. Narrow phase: sphere/capsule/box/convex collider tests establish contact points and normals.
3. Resolve: rigid-body solver applies impulses using relative velocity, inverse mass, restitution, and friction.
4. Damage: use impact energy proxy `E = 0.5 * effectiveMass * normalRelativeSpeed²`; convert energy to damage by material/part coefficients and clamp per hit.
5. Feedback: reduce speed through physics resolution, trigger audio, camera shake, sparks/debris, HUD damage, and cooldown-based event throttling.
6. Recovery: detect prolonged upside-down or stuck state; offer a reset/respawn action.

### Collision cases
- **Building:** large static collider; high impulse, high damage at speed, car should not pass through it. Damage can target front/side panels by contact location.
- **Wall:** static planar collider; resolve normal velocity, apply tangential friction, and limit repeated damage while contact persists.
- **Pole:** narrow collider; contact may produce a concentrated local damage event and rotation around the impact point. Use capsule/cylinder approximation.
- **Another vehicle:** both bodies can move; compute relative velocity and resolve impulses on both. NPC AI then chooses braking/steering avoidance.
- **Fall from height:** while airborne, integrate gravity; on landing compare vertical impact speed to thresholds and apply suspension compression/damage.
- **Upside down:** orientation/roof contact plus roll angle can start a timer; after a threshold, show recovery. Never silently teleport the vehicle without user feedback.

The current prototype uses distance-based proximity checks for traffic and cone obstacles and lowers a health-like condition meter. This is intentionally not a full collision solver.

## 4. Camera system

- **Chase:** spring-damped camera behind and above vehicle; target anticipates velocity and steering.
- **Close chase:** shorter follow distance for a more immediate view.
- **First person:** camera near the cabin with a limited field of view and optional dashboard.
- **Dynamic:** blend FOV based on speed, shift camera on sharp steering, and add brief impulse-based shake after impact.
- **Collision prevention:** sphere-cast from target to desired camera position; shorten the arm when a wall blocks it.
- **Smoothing:** critically damped spring or exponential interpolation; avoid direct snapping except on reset.

Current demo includes chase, close, and a simple first-person-like camera toggle with smoothing, but no camera sphere-cast or impact shake yet.

## 5. Traffic AI

Production NPC state machine: `Spawned → Cruise → ApproachJunction → Yield/Stop → ChangeLane/Avoid → Recover → Despawn`. Each NPC has a route made of waypoints, lane ID, target speed, following distance, signal state, and cooldowns. Use time-to-collision (TTC) and safe following distance to decide braking. Spawn ahead of the player and despawn behind/outside a streaming radius. Traffic signals should be driven by a junction controller, not independent random lights.

Current demo creates a small fixed pool of colored traffic cars that move along simple lanes and wrap around the map. It has collision proximity checks but no genuine route graph, lane-change planner, or traffic signals.

## 6. Open-world representation

Recommended world data separates immutable content from runtime objects:
- Road graph: nodes/intersections and directed lane edges.
- Road segment: width, speed limit, material, lanes, spline/waypoints.
- Building placement: asset ID, transform, collider profile, LOD distances.
- Interactive object: type, transform, trigger radius, optional mission role.
- Checkpoint: stable ID, transform, radius, next checkpoint IDs.
- World chunk: coordinate, object manifest, loading priority, unload distance.

The demo generates a small grid of roads, simple procedural box buildings, windows, street lights, and cone obstacles. Bridges, highways, ramps, parking areas and authored landmarks are design targets, not yet implemented as bespoke content. A production world should stream chunks instead of keeping every mesh active.

## 7. Mission and reward systems

Mission schema should define objective type, ordered checkpoint IDs, timer, fail conditions, reward bundle, repeat policy, and completion state. `MissionManager` validates objective progression; reward grant is idempotent so a duplicate event cannot award currency twice. Race/time/drift challenges can share a base mission interface and differ in their metrics. The prototype implements a timed checkpoint run with a glowing target and a demo reward message; currency is not persisted.

## 8. Economy and garage

A production economy uses a ledger of grants and spends, not only a mutable coin count. Purchases must validate item availability, price, ownership, and balance in one transaction. Vehicle upgrades should have caps and config effects:
- Engine: torque curve / power multiplier.
- Nitro: capacity and recharge rate.
- Brakes: brake torque and heat/fade model.
- Suspension: spring/damper settings and ride height.
- Tires: grip coefficient and wear.
- Paint: material/color selection only.

The current browser demo has one car and no real shop or persistent wallet. A garage/catalog screen is a future extension, and any client-only currency can be edited by the player and must not be treated as valuable or trusted.

## 9. Nitro

State: `capacity`, `current`, `consumptionRate`, `rechargeRate`, `boostMultiplier`, `active`, `cooldownRemaining`. On input, activate only if there is fuel, the car is accelerating, and the vehicle is eligible. Drain while active, apply a capped power multiplier, trigger exhaust particles/audio, then recharge after release or cooldown. Current demo supports holding Space (or the touch Nitro button) while accelerating, drains the meter, boosts acceleration/top speed, and recharges when unused. Particle exhaust is a planned improvement.

## 10. Audio

Use engine loops controlled by RPM/load, separate tire skid loops controlled by slip, one-shot collision events, horn, wind, city ambience and UI sounds. Spatialize world sources and pool short one-shots. Respect mute/volume settings and browser autoplay restrictions. The demo synthesizes small crash/horn/mission tones with Web Audio; it does not include realistic recorded engine or tire assets.

## 11. Save strategy and privacy

A production profile can contain currency, owned vehicles, upgrades, mission progress, settings and achievements. Store schema version and timestamps; validate every field on load and migrate older versions. For online competitive economy, server-authoritative storage is required. The current project intentionally has no database or server. It clears the demo session on a fresh page load and on exit, so profile/currency/mission state does not persist across sessions. Browser storage is not secure authentication and must not store secrets.

## 12. UI screens and flow

Target screen inventory: splash/loading, demo entry, main menu, garage, car selection, settings, gameplay HUD, pause, mission complete/failure, recovery prompt. Current prototype includes nickname entry, gameplay HUD, camera switch, mission start, nitro/condition meters, and exit session. Main menu, garage and settings are future screens.

### Flow diagrams
```text
ENTRY:  Page Load → Clear Demo Session → Nickname Form → Validate Name
        → Initialize Renderer/World → Gameplay

GAMEPLAY: Input → Normalize/Validate → Vehicle Update → Traffic Update
          → Collision Checks → Mission Update → HUD/Camera → Render Frame
          → (Pause/Exit/Recovery?)

GARAGE (planned): Open Garage → Load Catalog → Select Vehicle → Check Unlock
                  → Preview → Purchase/Equip → Validate → Apply Config → Return

MISSION: Idle → Start → Spawn Checkpoint → Tick Timer/Measure Distance
         → Reached? Yes → Complete/Grant Session Reward → Idle
         → Timeout? Yes → Fail → Clear Marker → Idle

COLLISION: Broad Phase → Narrow Phase → Contact/Impulse → Damage Calculation
           → Reduce Velocity → Audio/Visual Feedback → Recovery if Disabled

SAVE (production only): State Change → Debounce → Validate Schema → Serialize
                         → Write Adapter → Verify → Success Event
                         → On Failure: keep prior save + show warning
```

## 13. Event examples

1. **Accelerate:** key/touch input → input state set → acceleration/boost calculation → speed and position update → speed HUD update → (production) engine loop pitch changes.
2. **Impact:** collision candidate → contact confirmed → relative velocity/impact energy → resolve impulse → update condition/damage → play crash cue → camera/effects → show HUD feedback. Demo uses proximity thresholds and a tone.
3. **Nitro:** Space held while accelerating → verify nitro > 0 → boost multiplier → drain reservoir → update meter → recharge after release. Particle exhaust is a production extension.
4. **Mission checkpoint:** start button → spawn marker and timer → player reaches radius → mark complete once → grant demo reward feedback → clear marker.

## 14. Recommended production folder structure

```text
/Game
  /Scripts/{Core,Input,Managers,Events}
  /Vehicles/{Controllers,Configs,Models,Materials}
  /Physics/{Vehicle,Collision,Surfaces}
  /Traffic/{AI,Navigation,Signals,Spawning}
  /Missions/{Definitions,Runtime,Rewards}
  /Audio/{Events,Music,Ambience}
  /UI/{Screens,HUD,Widgets}
  /SaveSystem/{Models,Migrations,Adapters}
  /Maps/{Roads,Chunks,Landmarks}
  /Materials
  /Effects/{Particles,Camera}
  /Models
  /Prefabs
  /Resources
  /Tests/{Unit,Integration,Performance}
```

For this GitHub Pages version, `index.html`, `style.css`, and `game.js` are the runnable application files. `TECHNICAL_DESIGN.md` describes the broader architecture; `data-models.json` gives sample data contracts. The design document is not evidence that every listed production feature is already implemented.

## 15. Quality, performance and security checklist

- Pin CDN versions; show an explicit message if WebGL or CDN access fails.
- Use delta-time-based updates, object pooling, instancing, LOD, texture compression and chunk streaming.
- Profile frame time on low-end mobile devices; provide low/medium/high graphics settings.
- Keep game state separate from DOM nodes; use a central event bus in a larger implementation.
- Unit-test mission transitions, reward idempotency, collision thresholds and save migrations.
- Sanitize display names and never use a nickname as proof of identity.
- Do not trust client-only coin counts or purchase events in a competitive game.
- Test keyboard, touch, pause/resume, tab visibility, resize, refresh, network/CDN failure and recovery flows.
