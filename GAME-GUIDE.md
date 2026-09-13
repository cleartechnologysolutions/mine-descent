# Mine Descent

Original six-degree-of-freedom WebGL space shooter. Three connected mine sectors containing 18, 24 and 30 chambers, protected reactor fights, immediate extraction, optional upgrade choices, open-space exploration, an optional derelict encounter, and a final extraction gate. Procedural original Web Audio soundtrack and effects. Three.js is vendored under its MIT license. All resources are served by one Cloudflare Worker; no CDN or runtime API keys.


## Controls

Mouse: cursor-position joystick for ship and gun aim, with no browser mouse capture or permission prompts. Move the cursor away from the screen center to keep turning even while the mouse is still; farther out turns faster. Return it to the center deadzone, or press Z, to stop turning. Pitch and yaw support unrestricted 360-degree loops. Turn speed and inverted Y are adjustable while paused. Leaving the game canvas clears held inputs and stops steering; returning the cursor resumes steering from its screen position. Hold left mouse: forward thrust. Hold right mouse: reverse thrust. Hold Space: equipped cannon. X: homing missile. Q/E: optional roll. R/F: rise/descend. A/D: strafe. W/S: optional keyboard forward/reverse. Shift: boost. C: enter mine, jump, or interact. U: install recovered upgrades while in space. Tab: enlarge the survey map. Escape: pause. Arrow keys: ship-local up/down/left/right translation, without turning. Mouse wheel: browse recovered cannons. Middle click: equip the previewed cannon. Both mouse buttons: quick brake. Releasing thrust automatically slows the ship; reversing thrust brakes promptly before accelerating backwards.

## Survival and checkpoints

Start with 100 hull and 100 shields. Damage drains shields first, then hull. Shields never regenerate: collect shield cells to restore them. Each capacitor adds 45 capacity without refilling it. Full shields leave cells available for later. Destroyed drones and evasive defenders have a 50% chance to drop a 25-point cell; heavies have a 75% chance to drop 35 points. At 25% shield capacity or lower these chances rise to 85%. Wardens always drop 60 points. Independent missile-drop probability remains 12%. Shield cells have a bright blue ring and a nearby collection label. At 25% shield capacity or below, a steady red edge vignette strengthens as shields drain; the aiming area stays clear. The warning disappears when recovered shields exceed the threshold. Hull requires repair: caches restore 15 and the derelict restores 35. Mine transitions and optional upgrades preserve remaining shields. New campaigns and sector retries start with full shields; hull repair and rearming retain their existing behavior. The space anomaly releases a physical shield cell instead of directly restoring shields. Zero hull means death. Sustained cannon fire enters a brief single-shot recovery window.

Retries are unlimited. Retrying restores the current sector checkpoint, resets its enemies and discoveries, and rolls score, salvage, and upgrades back to sector entry. Earlier sectors remain cleared. The existing browser save keys are retained across the Mine Descent rename so old checkpoints and volume preferences continue to work.

## Mine exploration and progression

The mines have 18/24/30 rooms, branches, dead ends and 1/3/4 loops. Reactors are 9/11/13 portal hops from the entrance. There are no directional objective, enemy or next-room markers underground. The survey map reveals rooms only after entry; space destination navigation remains available.

Armored bulkheads automatically slide open on approach, stay open around ships, and close after passage. The panels block movement, sight and projectiles at their actual positions. Deeper approach rooms contain smaller, faster evasive defenders with tighter cannon aim assistance. Reactor chambers have three destructible shield relays and a Warden-led guardian group. Destroy both local defenses to expose the 420/620/820-health core; enemies elsewhere do not need to be cleared.

The reactor's killing hit extracts directly into playable space, repairs/rearms the ship, saves the new sector and grants an upgrade choice. Fly toward the next mine, explore, or press U to install it. Upgrade choices can be deferred and remain saved across retries and later sectors. The final core leads to the extraction jump gate.


## Visual and audio overhaul

Version 2 adds original rock and metal textures, geometric bedrock and industrial machinery, articulated armored robot models with batched material geometry, shadowed lighting, a cinematic glare pass, metal cockpit assemblies, pressure-vessel reactors, smoke and flashes, and distance-attenuated robot detection, charge, cannon, servo and destruction sounds.

The cannon combines a held low-frequency impact, metallic crack, charged-metal body and short recoil tail; missile launches add bass pressure and an ignition crack. The existing output limiter and bounded voice cleanup remain in the sound path.

Run `node tests/audio.cjs` to check sound scheduling and cleanup without an audio device. Run `node tests/mechanics.mjs` for the physics/combat/progression regression checks. The suite uses actual Three.js geometry and raycasting, with browser/audio device interfaces stubbed.


## Recoverable cannons

Each mine introduces one new model in a branch supply cache: Breach Cannon (mine 1, five-pellet spread), Vulcan Cannon (mine 2, rapid precise rounds), and Siege Cannon (mine 3, explosive plasma). Earlier models missed by the player can be found in later mines. Weapon crates include starter ammunition; separate color-matched ammo crates resupply each model throughout eligible mines and space routes. Ammo can be stored before its weapon is recovered. Full ammo crates remain available for later.

Pulse Cannon remains unlimited; other cannons consume one shell, round, or cell per trigger pull, including the entire Breach spread. Empty special cannons return to Pulse when firing is attempted. Browsing changes only the preview; middle-click confirms, without thrust, firing, or resetting heat/cooldown. The rack closes after six seconds or when controls are released. Existing pulse upgrades still add its second barrel; special cannons receive the existing damage/rate bonus, not extra barrels.

Cannons and remaining ammunition persist across sector transitions. Retrying restores the sector-entry loadout/ammo; discoveries within that sector reset. Repair/rearm and system upgrades do not create special ammo. Optional upgrades preserve the original sector-entry arsenal snapshot. Legacy saves safely start with Pulse only.

Sustained cannon fire is limited to approximately four seconds (thermal buildup can trigger it sooner). Recovery lasts 2.2 seconds: automatic fire stops, fresh Space presses can fire single shots at no faster than 0.45-second intervals, and holding Space resumes automatic fire after recovery. Browser key repeat is not a fresh press. All cannons share the limiter; switching weapons or pausing cannot clear recovery. Single shots during recovery do not extend it, and missiles are unchanged.
