import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const CAMERA_STOPS = [
  { at: 0, position: [9.5, 7.2, 13.4], target: [0, 2.9, 0] },
  { at: 0.24, position: [7.8, 6.2, 11.1], target: [0, 2.8, 0] },
  { at: 0.48, position: [-5.8, 5.7, 10.8], target: [0, 3.1, 0] },
  { at: 0.72, position: [-8.5, 8.4, 12.2], target: [0, 3.7, 0] },
  { at: 1, position: [2.5, 9.5, 14.2], target: [0, 3, 0] },
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => value * value * (3 - 2 * value);
const lerp = (from, to, amount) => from + (to - from) * amount;

function cameraPose(progress) {
  let from = CAMERA_STOPS[0];
  let to = CAMERA_STOPS[CAMERA_STOPS.length - 1];
  for (let index = 0; index < CAMERA_STOPS.length - 1; index += 1) {
    if (progress <= CAMERA_STOPS[index + 1].at) {
      from = CAMERA_STOPS[index];
      to = CAMERA_STOPS[index + 1];
      break;
    }
  }
  const span = Math.max(0.001, to.at - from.at);
  const amount = ease(clamp((progress - from.at) / span));
  return {
    position: from.position.map((value, index) => lerp(value, to.position[index], amount)),
    target: from.target.map((value, index) => lerp(value, to.target[index], amount)),
  };
}

function FallbackBuilding({ settings }) {
  const floors = [
    { id: 3, y: 8, room: "A-301" },
    { id: 2, y: 158, room: "A-201" },
    { id: 1, y: 308, room: "A-101" },
  ];
  return (
    <svg className="hero-building hero-building-fallback" viewBox="0 0 760 540" aria-hidden="true">
      <defs>
        <linearGradient id="hero-fallback-roof" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffdf7"/><stop offset="1" stopColor="#c5d5e7"/></linearGradient>
        <linearGradient id="hero-fallback-wall" x1="0" x2="1"><stop stopColor="#f1f0e8"/><stop offset="1" stopColor="#b9c8d1"/></linearGradient>
      </defs>
      <ellipse cx="382" cy="515" rx="230" ry="25" fill="#091a42" opacity=".4"/>
      {floors.map(({ id, y, room }) => (
        <g key={id} transform={`translate(0 ${y})`}>
          <polygon points="380,0 570,78 380,156 190,78" fill="url(#hero-fallback-roof)" stroke="#f6f6f1" strokeWidth="3"/>
          <polygon points="190,78 380,156 380,203 190,125" fill="url(#hero-fallback-wall)" stroke="#b4c1cc" strokeWidth="2"/>
          <polygon points="380,156 570,78 570,125 380,203" fill="#bdc9ce" stroke="#aebbc7" strokeWidth="2"/>
          <polygon points="190,125 380,203 570,125 380,149" fill="#7289a3" stroke="#edf2f5" strokeWidth="2"/>
          <path d="M254 104l66 27v41l-66-27zM337 138l32 13v41l-32-13zM410 131l52-21v41l-52 21zM480 102l48-20v41l-48 20z" fill="#8fbdd0" stroke="#f2f5ef" strokeWidth="5"/>
          <path d="M190 78l190 78 190-78M380 156v47" fill="none" stroke="#6e8197" strokeWidth="2" opacity=".8"/>
          <g fill={settings.lightsOn ? "#ffe6a3" : "#9daab5"}>
            <path d="M325 34l23 10-18 8-23-10zM372 54l23 10-18 8-23-10zM419 36l23 10-18 8-23-10z"/>
          </g>
          <text x="380" y="193" textAnchor="middle" fill="#334e70" fontSize="13" fontWeight="700">0{id} · {room}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HeroBuilding3D({ settings, motionRef }) {
  const mountRef = useRef(null);
  const lampMeshesRef = useRef([]);
  const acMeshesRef = useRef([]);
  const peopleGroupRef = useRef(null);
  const floorGroupsRef = useRef([]);
  const lampMaterialsRef = useRef(null);
  const acMaterialsRef = useRef(null);
  const personMaterialsRef = useRef(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      const fallbackTimer = window.setTimeout(() => setWebglUnavailable(true), 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    let disposed = false;
    let animationFrame = 0;
    let lastTime = performance.now();
    const ownedResources = new Set();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const building = new THREE.Group();
    scene.add(building);

    const makeMaterial = (options) => {
      const material = new THREE.MeshStandardMaterial(options);
      ownedResources.add(material);
      return material;
    };
    const box = new THREE.BoxGeometry(1, 1, 1);
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    const personBodyGeometry = new THREE.CylinderGeometry(0.1, 0.13, 0.32, 8);
    const personHeadGeometry = new THREE.SphereGeometry(0.105, 12, 10);
    [box, sphere, cylinder, personBodyGeometry, personHeadGeometry].forEach((geometry) => ownedResources.add(geometry));

    const materials = {
      slab: makeMaterial({ color: 0xe8edf3, roughness: 0.42, metalness: 0.12 }),
      edge: makeMaterial({ color: 0xaab9ca, roughness: 0.35, metalness: 0.24 }),
      frame: makeMaterial({ color: 0xf1f4f7, roughness: 0.3, metalness: 0.2 }),
      glass: makeMaterial({ color: 0x82c8ee, roughness: 0.18, metalness: 0.08, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false }),
      divider: makeMaterial({ color: 0x91b4d0, roughness: 0.42, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false }),
      furniture: makeMaterial({ color: 0x263f65, roughness: 0.58, metalness: 0.14 }),
      people: makeMaterial({ color: 0x63d9bf, roughness: 0.44, emissive: 0x0e574a, emissiveIntensity: 0.42 }),
      personHead: makeMaterial({ color: 0xe8bd9d, roughness: 0.58 }),
      acOn: makeMaterial({ color: 0xdceaf2, roughness: 0.36, emissive: 0x78d5ed, emissiveIntensity: 0.72 }),
      acOff: makeMaterial({ color: 0x71839b, roughness: 0.46 }),
      lampOn: makeMaterial({ color: 0xffe7a8, roughness: 0.28, emissive: 0xffce62, emissiveIntensity: 2.2 }),
      lampOff: makeMaterial({ color: 0x8293a8, roughness: 0.38 }),
      foundation: makeMaterial({ color: 0x142b51, roughness: 0.4, metalness: 0.35 }),
    };
    lampMaterialsRef.current = { on: materials.lampOn, off: materials.lampOff };
    acMaterialsRef.current = { on: materials.acOn, off: materials.acOff };
    personMaterialsRef.current = {
      bodyGeometry: personBodyGeometry,
      headGeometry: personHeadGeometry,
      bodyMaterial: materials.people,
      headMaterial: materials.personHead,
    };

    const addBox = (parent, material, position, size, castShadow = true, receiveShadow = true) => {
      const mesh = new THREE.Mesh(box, material);
      mesh.position.set(...position);
      mesh.scale.set(...size);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      parent.add(mesh);
      return mesh;
    };

    scene.add(new THREE.HemisphereLight(0xdcecff, 0x314564, 2.05));
    const keyLight = new THREE.DirectionalLight(0xfff2dc, 3.1);
    keyLight.position.set(-9, 14, 9);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x4e9dff, 62, 24, 2);
    fillLight.position.set(6, 7, 5);
    scene.add(fillLight);

    const plinth = addBox(building, materials.foundation, [0, -0.43, 0], [8.25, 0.32, 5.8]);
    plinth.receiveShadow = true;
    const floorGroups = [];
    const lamps = [];
    const acs = [];

    [1, 2, 3].forEach((floorNumber) => {
      const floor = new THREE.Group();
      const baseY = (floorNumber - 1) * 1.92;
      floor.position.y = baseY;
      floor.userData.baseY = baseY;
      building.add(floor);

      addBox(floor, materials.slab, [0, 0, 0], [7.8, 0.2, 5.25]);
      addBox(floor, materials.edge, [0, -0.13, 0], [7.92, 0.08, 5.36]);

      // A glass-and-steel shell with three open classroom bays along the front.
      addBox(floor, materials.glass, [0, 0.83, -2.52], [7.66, 1.52, 0.1]);
      addBox(floor, materials.glass, [-3.82, 0.83, 0], [0.1, 1.52, 5.12]);
      addBox(floor, materials.glass, [3.82, 0.83, 0], [0.1, 1.52, 5.12]);
      [-3.8, 0, 3.8].forEach((x) => addBox(floor, materials.frame, [x, 0.84, 2.53], [0.14, 1.56, 0.14]));
      [-2.55, -0.85, 0.85, 2.55].forEach((x) => addBox(floor, materials.glass, [x, 0.83, 2.52], [1.56, 1.31, 0.07]));
      [-2.52, 0, 2.52].forEach((z) => addBox(floor, materials.divider, [-1.3, 0.75, z], [0.07, 1.38, 0.07]));
      [-2.52, 0, 2.52].forEach((z) => addBox(floor, materials.divider, [1.3, 0.75, z], [0.07, 1.38, 0.07]));

      // Three independent climate units and ten visible ceiling fixtures per floor.
      [-2.5, 0, 2.5].forEach((x) => acs.push(addBox(floor, materials.acOn, [x, 1.48, -2.43], [0.92, 0.22, 0.24])));
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const lamp = addBox(floor, materials.lampOn, [-2.8 + col * 1.4, 1.61, -1.55 + row * 3.1], [0.48, 0.055, 0.25], false, false);
          lamps.push(lamp);
        }
      }

      // Twelve small desks give the model scale; the connected room also shows people.
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          addBox(floor, materials.furniture, [-2.7 + col * 1.8, 0.32, -1.55 + row * 1.05], [0.72, 0.08, 0.42], false, true);
        }
      }
      floorGroups.push(floor);
    });

    const people = new THREE.Group();
    people.position.set(0, 0, 0);
    floorGroups[0].add(people);

    const orbitPoints = [];
    for (let step = 0; step <= 128; step += 1) {
      const angle = (step / 128) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(angle) * 5.2, -0.24, Math.sin(angle) * 3.9));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xb8d9ff, transparent: true, opacity: 0.25 });
    ownedResources.add(orbitGeometry);
    ownedResources.add(orbitMaterial);
    building.add(new THREE.LineLoop(orbitGeometry, orbitMaterial));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "hero-three-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    lampMeshesRef.current = lamps;
    acMeshesRef.current = acs;
    peopleGroupRef.current = people;
    floorGroupsRef.current = floorGroups;

    const lookTarget = new THREE.Vector3();
    const desiredPosition = new THREE.Vector3();
    const desiredTarget = new THREE.Vector3();
    let smoothedPointerX = 0;
    let smoothedPointerY = 0;
    const animate = (time) => {
      if (disposed) return;
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const motion = motionRef.current;
      const progress = motion.reduced ? 0 : clamp(motion.scrollProgress || 0);
      const pointerEase = 1 - Math.exp(-delta * 4.8);
      smoothedPointerX = lerp(smoothedPointerX, motion.pointerX || 0, pointerEase);
      smoothedPointerY = lerp(smoothedPointerY, motion.pointerY || 0, pointerEase);

      const pose = cameraPose(progress);
      desiredPosition.set(...pose.position);
      desiredPosition.x += smoothedPointerX * 2.3;
      desiredPosition.y -= smoothedPointerY * 1.15;
      desiredPosition.z += smoothedPointerY * 0.4;
      desiredTarget.set(...pose.target);
      desiredTarget.x += smoothedPointerX * 0.42;
      desiredTarget.y -= smoothedPointerY * 0.22;

      const cameraEase = 1 - Math.exp(-delta * 5.2);
      camera.position.lerp(desiredPosition, cameraEase);
      lookTarget.lerp(desiredTarget, cameraEase);
      camera.lookAt(lookTarget);
      const velocityKick = motion.reduced ? 0 : Math.min(Math.abs(motion.scrollVelocity || 0) * 0.45, 2.5);
      const nextFov = 32 + velocityKick;
      if (Math.abs(camera.fov - nextFov) > 0.02) {
        camera.fov = lerp(camera.fov, nextFov, cameraEase);
        camera.updateProjectionMatrix();
      }

      const separation = motion.reduced ? 0 : progress * 0.2;
      floorGroups.forEach((floor, index) => {
        const direction = index - 1;
        floor.position.y = floor.userData.baseY + direction * separation;
        floor.scale.setScalar(1 - progress * 0.025);
      });
      building.rotation.y = -0.22 + smoothedPointerX * 0.24 + progress * 0.68;
      building.rotation.x = 0.025 - smoothedPointerY * 0.055;
      building.position.y = Math.sin(time * 0.0008) * 0.045 + progress * 0.04;
      // A subtle stage lift follows the scroll chapter without hiding any floor.
      building.position.x = ((motion.stage || 0) - 2) * 0.025;

      renderer.render(scene, camera);
    };
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.dispose();
      ownedResources.forEach((resource) => resource.dispose());
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      lampMeshesRef.current = [];
      acMeshesRef.current = [];
      peopleGroupRef.current = null;
      floorGroupsRef.current = [];
      lampMaterialsRef.current = null;
      acMaterialsRef.current = null;
      personMaterialsRef.current = null;
    };
  }, [motionRef]);

  useEffect(() => {
    lampMeshesRef.current.forEach((lamp) => { lamp.material = settings.lightsOn ? lampMaterialsRef.current?.on : lampMaterialsRef.current?.off; });
    acMeshesRef.current.forEach((unit) => { unit.material = settings.acOn ? acMaterialsRef.current?.on : acMaterialsRef.current?.off; });
  }, [settings.acOn, settings.lightsOn]);

  useEffect(() => {
    const group = peopleGroupRef.current;
    if (!group) return;
    group.clear();
    const numberOfPeople = clamp(Number(settings.occupancy) || 0, 0, 12);
    const materials = personMaterialsRef.current;
    if (!materials) return;
    for (let index = 0; index < numberOfPeople; index += 1) {
      const person = new THREE.Group();
      const col = index % 4;
      const row = Math.floor(index / 4);
      person.position.set(-2.7 + col * 1.8, 0.38, -1.55 + row * 1.05);
      const body = new THREE.Mesh(materials.bodyGeometry, materials.bodyMaterial);
      body.position.y = 0.22;
      const head = new THREE.Mesh(materials.headGeometry, materials.headMaterial);
      head.position.y = 0.46;
      person.add(body, head);
      group.add(person);
    }
  }, [settings.occupancy]);

  return (
    <div className="hero-building-3d" ref={mountRef} role="img" aria-label="Interactive three-dimensional three-floor campus model with classrooms, lights, cooling units, and connected room occupancy">
      {webglUnavailable && <FallbackBuilding settings={settings}/>}
    </div>
  );
}
