/**
 * Original VOIDBREAK industrial combat machines. Three.js only; faces local +Z.
 * createRobot(THREE, 'drone'|'heavy'|'warden', materials?)
 * Supplied material objects are shared and must not be disposed by callers.
 * All other geometry/material resources are owned by this model. Clone-safe body
 * material supports the game's emissive damage flash. Animate never changes it.
 * group stays scale 1; rig contains the normalized articulated model.
 */
export function createRobot(T, type = 'drone', materials = {}) {
  if (!['drone', 'heavy', 'warden'].includes(type)) type = 'drone';
  const heavy = type === 'heavy', boss = type === 'warden';
  const radius = boss ? 5.0 : heavy ? 3.8 : 3.0;
  const group = new T.Group();
  group.name = `industrial-${type}`;
  const rig = new T.Group(); group.add(rig);
  const local = (color, metalness = .75, roughness = .48, more = {}) =>
    new T.MeshStandardMaterial({ color, metalness, roughness, ...more });
  function supplied(name, fallback) {
    if (!materials[name]) return fallback();
    materials[name].userData.shared = true;
    return materials[name];
  }
  const armor = supplied('armor', () => local(boss ? 0x353837 : heavy ? 0x48504f : 0x49545a));
  const steel = supplied('steel', () => local(0x7b858b, .87, .3));
  const rubber = supplied('rubber', () => local(0x10151a, .15, .87));
  const brass = supplied('brass', () => local(0x827451, .71, .43));
  const bodyMat = armor.clone();
  bodyMat.userData = { ...bodyMat.userData, shared: false };
  bodyMat.emissive = new T.Color(0x000000);
  bodyMat.emissiveIntensity = 1;
  const graphite = local(0x232c32, .68, .56);
  const cavity = local(0x030609, .02, .96);
  const warning = local(0xa98a43, .5, .67);
  const opticMat = local(0x68170d, .15, .24, { emissive: 0xff2d0b, emissiveIntensity: 4.2 });
  const chargeMat = local(0x342318, .3, .35, { emissive: 0xff6c20, emissiveIntensity: 1.3 });
  const exhaustMat = local(0x1b4d5a, .12, .35, { emissive: 0x69c5de, emissiveIntensity: 2.6 });
  const pistons = [], arms = [], rotors = [], thrusters = [];
  const bolts = [], caution = [];
  const unitY = new T.Vector3(0, 1, 0);
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geometry, material); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(parent, w, h, d, x, y, z, mat = graphite) {
    return mesh(parent, new T.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function hull(parent, w, h, d, x, y, z, mat = armor, taper = .73) {
    const shape = new T.Shape();
    shape.moveTo(-w * .34, h * .5);
    shape.lineTo(w * .34, h * .5); shape.lineTo(w * .5, h * .3);
    shape.lineTo(w * .5, -h * .22); shape.lineTo(w * .5 * taper, -h * .5);
    shape.lineTo(-w * .5 * taper, -h * .5); shape.lineTo(-w * .5, -h * .22);
    shape.lineTo(-w * .5, h * .3); shape.closePath();
    const bevel = Math.min(w, h, d) * .115;
    const geo = new T.ExtrudeGeometry(shape, { depth: d, steps: 1,
      bevelEnabled: true, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel });
    geo.translate(0, 0, -d / 2);
    return mesh(parent, geo, mat, x, y, z);
  }
  function axial(parent, rt, rb, length, x, y, z, mat = steel, radial = 12) {
    const m = mesh(parent, new T.CylinderGeometry(rt, rb, length, radial), mat, x, y, z);
    m.rotation.x = Math.PI / 2; return m;
  }
  function rod(parent, a, b, r, mat = steel, r2 = r) {
    const av = new T.Vector3(...a), bv = new T.Vector3(...b), direction = bv.sub(av);
    const m = mesh(parent, new T.CylinderGeometry(r2, r, direction.length(), 8), mat);
    m.position.copy(av).addScaledVector(direction, .5);
    m.quaternion.setFromUnitVectors(unitY, direction.normalize()); return m;
  }
  function cable(parent, points, r = .055) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    return mesh(parent, new T.TubeGeometry(curve, 9, r, 5, false), rubber);
  }
  function ringGeometry(outer, inner, depth, segments = 12) {
    const points = [new T.Vector2(inner, -depth / 2), new T.Vector2(outer, -depth / 2),
      new T.Vector2(outer, depth / 2), new T.Vector2(inner, depth / 2), new T.Vector2(inner, -depth / 2)];
    const g = new T.LatheGeometry(points, segments); g.rotateX(Math.PI / 2); return g;
  }
  function ring(parent, outer, inner, depth, x, y, z, mat = steel) {
    return mesh(parent, ringGeometry(outer, inner, depth), mat, x, y, z);
  }
  function instance(parent, geometry, mat, placements) {
    const m = new T.InstancedMesh(geometry, mat, placements.length), dummy = new T.Object3D();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]; dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0);
      dummy.scale.set(p[6] || 1, p[7] || 1, p[8] || 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true;
    parent.add(m); return m;
  }

  // Nonhuman machine hull: elongated overlapping slabs, no eyes/mouth/chin layout.
  const width = boss ? 2.65 : heavy ? 2.1 : 1.75;
  const height = boss ? 2.4 : heavy ? 1.9 : 1.65;
  const depth = boss ? 2.1 : 1.72;
  const body = hull(rig, width, height, depth, 0, .18, 0, bodyMat, .88);
  body.name = 'damage-flash-carapace';
  hull(rig, width * .95, height * .82, .30, 0, -.05, depth * .55, graphite, .90);
  const prow = hull(rig, width * .85, height * .73, .37, -.06, -.06, depth * .67, armor, .91);
  prow.rotation.x = -.08; prow.rotation.y = -.08;
  const overlap = hull(rig, width * .48, height * .88, .26,
    -width * .27, .12, depth * .72, armor, .87);
  overlap.rotation.y = .14; overlap.rotation.z = -.11;
  // A single offset sensor snout, hidden in a vertical dark slit under a slab hood.
  const sensorX = width * .235, sensorY = height * .24, sensorZ = depth * .84;
  hull(rig, .56, .79, .48, sensorX, sensorY, sensorZ - .11, graphite, .96);
  box(rig, .22, .57, .08, sensorX + .025, sensorY, sensorZ + .151, cavity);
  const hood = hull(rig, .68, .20, .72, sensorX - .035, sensorY + .37, sensorZ - .075, armor, .94);
  hood.rotation.x = -.17;
  const eye = box(rig, boss ? .105 : .085, boss ? .38 : .30, .025,
    sensorX + .026, sensorY + .015, sensorZ + .198, opticMat);
  eye.name = 'asymmetric-recessed-vertical-camera';
  // Plain black intake: offset and vertical so it cannot read as a toothed smile.
  box(rig, width * .15, height * .36, .055, -width * .13, -.16, depth * .815, cavity);
  hull(rig, .19, height * .43, .18, -width * .27, -.10, depth * .83, graphite, .92);
  for (const side of [-1, 1]) {
    const edgePlate = hull(rig, width * .22, height * .72, .29,
      side * width * .445, -.08, depth * .55, armor, .91);
    edgePlate.rotation.z = side * -.07;
    for (const y of [-.58, .64]) bolts.push([side * width * .36, y * height, depth * .565]);
  }
  const abdomenY = -height * .43;
  hull(rig, width * .77, .44, 1.05, 0, abdomenY, -.34, rubber, .93);
  instance(rig, new T.BoxGeometry(width * .79, .075, 1.1), graphite,
    [0, 1, 2].map(i => [0, abdomenY + .12 - i * .13, -.34, 0, 0, 0]));
  // Hydraulic underside stays tucked into the hull; no hanging humanoid jaw.
  rod(rig, [-width * .34, -.4, .34], [-width * .32, abdomenY - .14, .24], .07, steel);
  rod(rig, [width * .34, -.4, .34], [width * .32, abdomenY - .14, .24], .07, steel);
  cable(rig, [[-.36, -.45, .13], [-.65, -.8, .25], [-.28, abdomenY - .13, .11]], .065);

  // Rear lift engines: armored casings, dark hollow bells and recessed blue cores.
  for (const side of [-1, 1]) {
    const engine = new T.Group(); engine.position.set(side * width * .58, .17, -.55); rig.add(engine);
    hull(engine, .67, 1.1, 1.28, 0, 0, -.12, graphite, .9);
    ring(engine, .39, .28, .6, 0, -.16, -.84, steel);
    ring(engine, .305, .225, .13, 0, -.16, -1.17, graphite);
    const flame = axial(engine, .224, .224, .025, 0, -.16, -.99, exhaustMat, 12); thrusters.push(flame);
    // Backward engine cores remain recessed so silhouettes stay metallic.
    const fin = hull(engine, .22, 1.5, .60, side * .3, .32, -.28, armor, .48);
    fin.rotation.z = side * -.20;
    instance(engine, new T.BoxGeometry(.55, .055, .15), rubber,
      Array.from({ length: 4 }, (_, i) => [0, .07 + i * .14, .56]));
  }

  function cannon(parent, scale, count = 4) {
    const gun = new T.Group(); gun.scale.setScalar(scale); parent.add(gun);
    hull(gun, 1.04, .93, 1.28, 0, 0, .42, graphite, .96);
    axial(gun, .50, .54, .32, 0, 0, 1.04, armor);
    const rotating = new T.Group(); rotating.position.z = 1.02; gun.add(rotating); rotors.push(rotating);
    const tubePlaces = [], muzzlePlaces = [], holePlaces = [];
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const x = Math.sin(angle) * .30, y = Math.cos(angle) * .30;
      tubePlaces.push([x, y, .74]); muzzlePlaces.push([x, y, 1.42]); holePlaces.push([x, y, 1.25]);
    }
    instance(rotating, ringGeometry(.14, .086, 1.35), steel, tubePlaces);
    instance(rotating, ringGeometry(.18, .087, .14), graphite, muzzlePlaces);
    // Physical bore depth and black disks deep inside the tube, never solid tips.
    const holeGeo = new T.CircleGeometry(.084, 10);
    instance(rotating, holeGeo, cavity, holePlaces);
    ring(rotating, .51, .395, .23, 0, 0, .40, armor);
    ring(rotating, .51, .395, .14, 0, 0, 1.14, brass);
    axial(rotating, .11, .11, 1.10, 0, 0, .61, graphite, 8);
    box(gun, .29, .16, .40, 0, .57, .36, armor);
    box(gun, .07, .075, .04, 0, .575, .58, opticMat);
    return gun;
  }
  function claw(parent, side, scale = 1) {
    const g = new T.Group(); parent.add(g); g.scale.setScalar(scale);
    axial(g, .21, .3, .42, 0, 0, .13, steel, 10);
    for (const s of [-1, 1]) {
      const finger = hull(g, .19, .76, .23, s * .28, -.06, .50, graphite, .30);
      finger.rotation.x = -1.04; finger.rotation.z = s * -.32;
      rod(g, [s * .17, 0, .14], [s * .31, -.1, .69], .052, steel);
      const tip = hull(g, .135, .44, .16, s * .21, -.25, .91, steel, .09);
      tip.rotation.x = -.75; tip.rotation.z = s * .27;
    }
    return g;
  }
  function arm(side, y, kind, reach, phase, drop = 0) {
    const pivot = new T.Group(); pivot.position.set(side * width * .51, y, -.05); rig.add(pivot);
    pivot.rotation.z = side * drop;
    arms.push({ pivot, phase, rest: side * drop, strength: kind === 'cannon' ? .026 : .09 });
    const shoulder = hull(pivot, .81, .82, .95, side * .28, .02, .0, armor, .89);
    shoulder.rotation.z = side * -.16;
    // Real horizontal elbow axle and offset hydraulic strut.
    rod(pivot, [side * .35, -.06, -.04], [side * reach, -.37, .27], .145, graphite);
    rod(pivot, [side * .34, .20, .31], [side * (reach - .1), -.05, .45], .074, steel);
    rod(pivot, [side * .37, .20, .31], [side * (reach * .67), .04, .40], .117, graphite);
    const joint = axial(pivot, .23, .23, .30, side * reach, -.35, .25, brass, 10);
    joint.rotation.y = Math.PI / 2;
    hull(pivot, .59, .54, .89, side * reach, -.34, .58, armor, .84);
    cable(pivot, [[side * .17, -.05, -.25], [side * .55, -.49, -.39], [side * reach, -.52, .22]], .064);
    const tool = new T.Group(); tool.position.set(side * reach, -.35, .98); pivot.add(tool);
    if (kind === 'cannon') cannon(tool, boss ? 1.28 : heavy ? 1.10 : .95, boss ? 6 : heavy ? 5 : 4);
    else if (kind === 'drill') {
      axial(tool, .28, .32, .64, 0, 0, .26, graphite, 10);
      const drill = new T.Group(); tool.add(drill); rotors.push(drill);
      const drillGeo = new T.ConeGeometry(.26, .86, 6, 4); drillGeo.rotateX(Math.PI / 2);
      drillGeo.rotateY(Math.PI); mesh(drill, drillGeo, steel, 0, 0, .86);
      instance(drill, ringGeometry(.275, .19, .055, 8), brass,
        [0, 1, 2].map(i => [0, 0, .43 + i * .16, 0, 0, i * .35, 1 - i * .16, 1 - i * .16, 1]));
    } else claw(tool, side, boss ? 1.16 : .83);
    return pivot;
  }

  for (const side of [-1, 1]) {
    if (boss) {
      arm(side, .87, 'cannon', 1.24, side, -.14);
      arm(side, -.16, 'claw', 1.86, side + 2, -.04);
      arm(side, -1.08, 'drill', 1.17, side + 4, .28);
    } else {
      arm(side, .28, heavy || side === 1 ? 'cannon' : 'claw', heavy ? 1.08 : .83, side, -.12);
    }
  }

  if (boss) {
    // Armored reactor chest and an excavator sensor gantry: recognizably a siege machine.
    const coreZ = depth * .78;
    hull(rig, 1.68, 1.48, .28, -.17, -.27, coreZ, armor, .95);
    box(rig, .33, 1.02, .10, -.32, -.27, coreZ + .19, cavity);
    instance(rig, new T.BoxGeometry(.26, .085, .03), chargeMat,
      Array.from({ length: 6 }, (_, i) => [-.32, -.67 + i * .16, coreZ + .253]));
    instance(rig, new T.BoxGeometry(.06, 1.13, .09), graphite,
      [[-.50, -.25, coreZ + .26], [-.14, -.25, coreZ + .26]]);
    for (const side of [-1, 1]) {
      rod(rig, [side * .73, .95, -.43], [side * .85, 1.85, -.32], .13, graphite);
      bolts.push([side * .68, -.72, coreZ + .17], [side * .68, .2, coreZ + .17]);
    }
    hull(rig, 2.18, .43, .54, 0, 1.91, -.30, graphite, .90);
    instance(rig, ringGeometry(.14, .085, .20, 10), steel,
      [-.65, -.32, 0, .32, .65].map(x => [x, 1.91, .04]));
    instance(rig, new T.CircleGeometry(.082, 10), opticMat,
      [-.65, -.32, 0, .32, .65].map(x => [x, 1.91, .149]));
    rod(rig, [.57, 2.01, -.27], [.57, 2.65, -.27], .025, steel);
  } else {
    // Offset mine scanner and an exposed heat exchanger make the silhouettes asymmetrical.
    hull(rig, .35, .45, .44, -.38, height * .65, -.24, graphite, .75);
    axial(rig, .1, .13, .20, -.38, height * .65, .08, steel, 8);
    axial(rig, .055, .055, .012, -.38, height * .65, .188, opticMat, 8);
    if (heavy) {
      hull(rig, .64, 1.13, .43, -.45, -.2, -.99, graphite, .85);
      hull(rig, .64, 1.13, .43, .45, -.2, -.99, graphite, .85);
      instance(rig, new T.BoxGeometry(.44, .045, .11), steel,
        Array.from({ length: 12 }, (_, i) => [(i < 6 ? -1 : 1) * .45, -.61 + (i % 6) * .16, -1.24]));
    }
  }

  // Hardware and chipped-ochre recognition tabs; no glossy toy-wide color blocks.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) caution.push([side * (width * .36 + i * .027), -.13 - i * .075, depth * .755, 0, 0, side * -.42]);
    bolts.push([side * width * .36, .32, depth * .71], [side * width * .28, -.6, depth * .74]);
  }
  const boltGeo = new T.CylinderGeometry(.039, .039, .035, 6); boltGeo.rotateX(Math.PI / 2);
  instance(rig, boltGeo, steel, bolts);
  instance(rig, new T.BoxGeometry(.12, .038, .012), warning, caution);

  // One internal scale preserves caller-owned world / outer group scaling.
  rig.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(rig), sphere = bounds.getBoundingSphere(new T.Sphere());
  // Center the complete machinery and fit an honest spherical gameplay hitbox.
  const normalization = radius / sphere.radius;
  rig.position.copy(sphere.center).multiplyScalar(-normalization);
  rig.scale.setScalar(normalization);
  // Batch every rigid subassembly. Vertex surface attributes preserve rubber,
  // brass and steel response inside one standard PBR shader draw call; moving
  // pivots and rotary barrels remain separate, so detail is affordable in a swarm.
  const batchedMetal = armor.clone();
  batchedMetal.userData = { shared: false };
  batchedMetal.color.setHex(0xffffff);
  batchedMetal.vertexColors = true;
  batchedMetal.emissive.setHex(0x000000);
  batchedMetal.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 surfaceData;\nvarying vec2 vSurfaceData;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvSurfaceData = surfaceData;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSurfaceData;')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vSurfaceData.x / max(roughness, 0.001), 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = clamp(metalnessFactor * vSurfaceData.y / max(metalness, 0.001), 0.0, 1.0);');
  };
  batchedMetal.customProgramCacheKey = () => 'voidbreak-robot-surface-v2';
  // Keep roughness and metalness nonzero so texture maps retain their modulation.
  batchedMetal.roughness = 1; batchedMetal.metalness = 1;
  const animatedRoots = new Set([rig, ...arms.map(a => a.pivot), ...rotors]);
  const retiredGeometry = new Set(), retiredMaterial = new Set();
  group.updateMatrixWorld(true);
  for (const root of animatedRoots) {
    const batches = new Map(), obsolete = [];
    const inverseRoot = root.matrixWorld.clone().invert();
    const collect = node => {
      if (node !== root && animatedRoots.has(node)) return;
      if (node.isMesh && node !== body && node !== eye) {
        const sourceMaterial = node.material;
        const luminous = sourceMaterial.emissive && sourceMaterial.emissive.getHex() !== 0;
        const targetMaterial = luminous ? sourceMaterial : batchedMetal;
        if (!batches.has(targetMaterial)) batches.set(targetMaterial, []);
        batches.get(targetMaterial).push(node); obsolete.push(node);
      }
      for (const child of node.children) collect(child);
    };
    collect(root);
    for (const [material, parts] of batches) {
      const positions = [], normals = [], uvs = [], colors = [], surfaces = [];
      for (const part of parts) {
        const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
        const p = geo.getAttribute('position'), n = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
        const sourceColor = part.material.color || new T.Color(1, 1, 1);
        const instanceMatrix = new T.Matrix4(), transform = new T.Matrix4(), normalMatrix = new T.Matrix3();
        const vertex = new T.Vector3(), normal = new T.Vector3();
        const count = part.isInstancedMesh ? part.count : 1;
        for (let i = 0; i < count; i++) {
          transform.multiplyMatrices(inverseRoot, part.matrixWorld);
          if (part.isInstancedMesh) { part.getMatrixAt(i, instanceMatrix); transform.multiply(instanceMatrix); }
          normalMatrix.getNormalMatrix(transform);
          for (let j = 0; j < p.count; j++) {
            vertex.fromBufferAttribute(p, j).applyMatrix4(transform);
            normal.set(0, 0, 1); if (n) normal.fromBufferAttribute(n, j);
            normal.applyNormalMatrix(normalMatrix);
            positions.push(vertex.x, vertex.y, vertex.z); normals.push(normal.x, normal.y, normal.z);
            uvs.push(uv ? uv.getX(j) : 0, uv ? uv.getY(j) : 0);
            colors.push(sourceColor.r, sourceColor.g, sourceColor.b);
            surfaces.push(part.material.roughness ?? .5, part.material.metalness ?? .75);
          }
        }
        if (geo !== part.geometry) geo.dispose();
        retiredGeometry.add(part.geometry); retiredMaterial.add(part.material);
      }
      const merged = new T.BufferGeometry();
      merged.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      merged.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      merged.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      // Emissive materials retain their uniform color and use ordinary shaders.
      if (material === batchedMetal) {
        merged.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        merged.setAttribute('surfaceData', new T.Float32BufferAttribute(surfaces, 2));
      }
      merged.computeBoundingSphere(); merged.computeBoundingBox();
      const combined = mesh(root, merged, material); combined.name = 'rigid-machine-batch';
    }
    for (const part of obsolete) part.removeFromParent();
  }
  const retainedGeometry = new Set(), retainedMaterial = new Set();
  group.traverse(node => { if (node.isMesh) { retainedGeometry.add(node.geometry); retainedMaterial.add(node.material); } });
  for (const geometry of retiredGeometry) if (!retainedGeometry.has(geometry)) geometry.dispose();
  for (const material of retiredMaterial) if (!material.userData.shared && !retainedMaterial.has(material)) material.dispose();
  group.userData.robotType = type;
  group.userData.hitRadius = radius;
  group.userData.detail = 'original articulated industrial combat machine';
  let spin = 0;
  function animate(t, dt = 1 / 60, charge = 0, velocity = 0) {
    const c = Math.max(0, Math.min(1, Number(charge) || 0));
    const speed = typeof velocity === 'number' ? velocity : velocity?.length?.() || 0;
    spin += Math.min(.06, Math.max(0, dt)) * (2.1 + c * 24);
    for (let i = 0; i < rotors.length; i++) rotors[i].rotation.z = spin * (i % 2 ? -1 : 1);
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      a.pivot.rotation.z = a.rest + Math.sin(t * .67 + a.phase) * a.strength;
      a.pivot.rotation.x = Math.sin(t * .89 + a.phase) * .035 - c * .045;
    }
    opticMat.emissiveIntensity = 3.8 + c * 3.5 + Math.sin(t * 3.7) * .3;
    chargeMat.emissiveIntensity = 1.5 + c * 4 + Math.sin(t * 2.8) * .25;
    exhaustMat.emissiveIntensity = 2.2 + Math.min(2, speed * .04) + Math.sin(t * 26) * .3;
  }
  return { group, body, eye, rig, radius, animate };
}
