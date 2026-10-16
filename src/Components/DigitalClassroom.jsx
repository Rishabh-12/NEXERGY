import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import {
  Building2,
  Users,
  Lightbulb,
  Snowflake,
  AlertTriangle,
  Camera,
  Zap,
  Gauge,
  Minus,
  Plus,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { CLASSROOM_CAPACITY } from "../services/energyCalculations";
import { FLOORS, getRoomSnapshot } from "./campusData";
import DigitalTwinJourney from "./DigitalTwinJourney";

const STEPS = [
  {
    step: 1,
    tag: "spatial layout, mapped!",
    title: "Augmented\nBlueprint",
    desc: "Classroom 2D spatial coordinates and CAD layout projected onto the virtual architectural drafting table.",
    badge: "Spatial CAD Grid",
    action: "Explore Massing",
  },
  {
    step: 2,
    tag: "campus twin, generated!",
    title: "Adaptive\nMassing",
    desc: "Three connected floors, nine modeled rooms, and a clear view of occupancy, lighting, and cooling across the building.",
    badge: "03-Floor Digital Twin",
    action: "Inspect Interior",
  },
  {
    step: 3,
    tag: "vision occupancy, synced!",
    title: "Agentic\nOccupancy",
    desc: "Real-time student headcount from YOLOv8 computer vision mapped dynamically across interactive classroom desks.",
    badge: "YOLOv8 Headcount",
    action: "Optimize Systems",
  },
  {
    step: 4,
    tag: "energy waste, eliminated!",
    title: "Instant\nEfficiency",
    desc: "Dynamic control over 10 ceiling fixtures and 3 independent climate zones with automatic standby cutoff.",
    badge: "Gemini AI Guided",
    action: "Back to Blueprint",
  },
];

// Camera keyframes for steps: [camX, camY, camZ, lookX, lookY, lookZ, fov]
const KEYFRAMES = [
  [-3.4, 5.6, 8.2, -1.8, 1.1, 0.8, 38], // Step 1: Blueprint perspective
  [3.8, 5.3, 9.4, 0.0, 2.2, 0.0, 36],   // Step 2: Full three-floor building
  [0.6, 4.8, 6.4, 0.0, 2.3, -0.2, 32],  // Step 3: Selected room cutaway
  [5.6, 4.6, 9.2, 0.5, 2.2, 0.0, 36],   // Step 4: Facade and energy systems
];

const allOn = (length, enabled) => Array.from({ length }, () => enabled);

export default function DigitalClassroom({
  settings = {},
  backend = {},
  onOccupancyChange,
  selectedRoom = "A-101",
  onSelectRoom,
  roomEquipmentByRoom,
  roomOccupancy,
  onSampleOccupancyChange,
  onRoomEquipmentChange,
  onNavigate,
}) {
  const [twinViewMode, setTwinViewMode] = useState("scroll-journey"); // "3d-arcova" | "scroll-journey"
  const currentRoomId = selectedRoom || "A-101";

  const snapshot = getRoomSnapshot(
    currentRoomId,
    settings,
    roomEquipmentByRoom?.[currentRoomId],
    roomOccupancy?.[currentRoomId]
  );

  const roomEquipment = roomEquipmentByRoom?.[currentRoomId];
  const lights = roomEquipment?.lights ?? allOn(10, snapshot.lightsOn ?? true);
  const acs = roomEquipment?.acs ?? allOn(3, snapshot.acOn ?? true);
  const occupancy = snapshot.occupancy ?? 0;
  const isWasteAlert = Boolean(backend?.energyWasteAlert) && snapshot.connected;
  const selectedFloorIndex = Math.max(0, FLOORS.findIndex((floor) => floor.rooms.some((room) => room.id === currentRoomId)));
  const selectedRoomIndex = Math.max(0, FLOORS[selectedFloorIndex].rooms.findIndex((room) => room.id === currentRoomId));
  const modelRooms = useMemo(() => FLOORS.flatMap((floor) => floor.rooms.map((room) => {
    const equipment = roomEquipmentByRoom?.[room.id];
    const roomSnapshot = getRoomSnapshot(room.id, settings, equipment, roomOccupancy?.[room.id]);
    return {
      id: room.id,
      occupancy: roomSnapshot.occupancy ?? 0,
      activeLights: equipment?.lights?.filter(Boolean).length ?? (roomSnapshot.lightsOn ? 10 : 0),
      activeAcUnits: equipment?.acs?.filter(Boolean).length ?? (roomSnapshot.acOn ? 3 : 0),
    };
  })), [settings, roomEquipmentByRoom, roomOccupancy]);

  const [currentStep, setCurrentStep] = useState(0);
  const [targetTemp, setTargetTemp] = useState(settings?.setpoint ?? 22);
  const canvasRef = useRef(null);

  // Live state reference for Three.js render loop
  const sceneStateRef = useRef({
    occupancy,
    lightsOn: lights.some(Boolean),
    acOn: acs.some(Boolean),
    isWasteAlert,
    targetStep: currentStep,
    roomName: snapshot.name,
    rooms: modelRooms,
    selectedRoomId: currentRoomId,
    selectedFloorIndex,
    selectedRoomIndex,
  });

  useEffect(() => {
    sceneStateRef.current = {
      occupancy,
      lightsOn: lights.some(Boolean),
      acOn: acs.some(Boolean),
      isWasteAlert,
      targetStep: currentStep,
      roomName: snapshot.name,
      rooms: modelRooms,
      selectedRoomId: currentRoomId,
      selectedFloorIndex,
      selectedRoomIndex,
    };
  }, [occupancy, lights, acs, isWasteAlert, currentStep, snapshot.name, modelRooms, currentRoomId, selectedFloorIndex, selectedRoomIndex]);

  // Electrical load & efficiency
  const watts = lights.filter(Boolean).length * 40 + acs.filter(Boolean).length * 600;
  const kw = (watts / 1000).toFixed(2);

  const efficiency = useMemo(() => {
    if (occupancy === 0 && (lights.some(Boolean) || acs.some(Boolean))) return 22;
    if (occupancy === 0) return 96;
    const base = 65 + (occupancy / CLASSROOM_CAPACITY) * 28;
    return Math.min(98, Math.round(base));
  }, [occupancy, lights, acs]);

  // Handlers for actuators
  const toggleLight = (index) => {
    const next = lights.map((on, i) => (i === index ? !on : on));
    if (onRoomEquipmentChange) {
      onRoomEquipmentChange(currentRoomId, { lights: next });
    }
  };

  const toggleAc = (index) => {
    const next = acs.map((on, i) => (i === index ? !on : on));
    if (onRoomEquipmentChange) {
      onRoomEquipmentChange(currentRoomId, { acs: next });
    }
  };

  const setPeople = (next) => {
    const count = Math.max(0, Math.min(CLASSROOM_CAPACITY, next));
    if (snapshot.connected && onOccupancyChange) {
      onOccupancyChange(count);
    } else if (onSampleOccupancyChange) {
      onSampleOccupancyChange(currentRoomId, count);
    }
  };

  // -------------------------------------------------------------
  // THREE.JS CANVAS RENDERER & SCENE (Arcova Architecture)
  // -------------------------------------------------------------
  useEffect(() => {
    if (twinViewMode !== "3d-arcova") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId;
    let width = canvas.clientWidth || 800;
    let height = canvas.clientHeight || 580;

    // 1. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0a1426, 1);

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 150);
    const initialKf = KEYFRAMES[0];
    camera.position.set(initialKf[0], initialKf[1], initialKf[2]);
    const lookTarget = new THREE.Vector3(initialKf[3], initialKf[4], initialKf[5]);
    camera.lookAt(lookTarget);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x7c9ae0, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.15);
    dirLight.position.set(-10, 14, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);

    const classroomLight = new THREE.PointLight(0xffe8a3, 1.8, 12);
    classroomLight.position.set(0, 6.8, 0);
    scene.add(classroomLight);

    const acCoolLight = new THREE.PointLight(0x38bdf8, 1.2, 8);
    acCoolLight.position.set(1.5, 6.6, 0);
    scene.add(acCoolLight);

    const alertLight = new THREE.PointLight(0xef4444, 0, 10);
    alertLight.position.set(0, 7.5, 0);
    scene.add(alertLight);

    // 4. Procedural Blueprint Textures
    const createTex = (w, h, drawFn) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      drawFn(c.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      return t;
    };

    const planTex = createTex(1024, 720, (ctx, w, h) => {
      ctx.fillStyle = "rgba(180, 204, 238, 0.94)";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(40, 70, 130, 0.25)";
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let j = 0; j < h; j += 32) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }

      ctx.strokeStyle = "#1b315e";
      ctx.lineWidth = 3;
      [
        [100, 100, 340, 220],
        [460, 100, 280, 340],
        [100, 340, 340, 240],
        [460, 460, 390, 180],
        [760, 100, 200, 170],
      ].forEach((r) => ctx.strokeRect(...r));

      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#16284d";
      ctx.fillText("CAMPUS DIGITAL TWIN · ROOM MODEL", 120, 140);
      ctx.font = "12px monospace";
      ctx.fillText("CAPACITY: 40 SEATS · ZONE A · 120 SQ M", 120, 165);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#274278";
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          ctx.strokeRect(130 + c * 38, 190 + r * 30, 26, 16);
        }
      }
    });

    const facTex = createTex(128, 128, (ctx, w, h) => {
      ctx.strokeStyle = "#223b6b";
      ctx.lineWidth = 3;
      for (let i = 4; i < w; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
      for (let j = 18; j < h; j += 32) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }
    });
    facTex.wrapS = facTex.wrapT = THREE.RepeatWrapping;
    facTex.repeat.set(3, 1);

    const matLam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const makeBox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const addMesh = (geo, mat, x, y, z, parent = scene, cast = true, rec = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = rec;
      parent.add(mesh);
      return mesh;
    };
    const makeFlat = (mesh) => {
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    };

    // 5. Ground Planes
    makeFlat(addMesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshBasicMaterial({ color: 0xd8cbaf }), 0, 0, 0, scene, false, false));
    makeFlat(addMesh(new THREE.PlaneGeometry(80, 60), new THREE.ShadowMaterial({ color: 0x092257, opacity: 0.95 }), 0, 0.004, 0, scene, false, true));

    const sheetMat = new THREE.MeshLambertMaterial({ map: planTex, transparent: true });
    const sheetA = makeFlat(addMesh(new THREE.PlaneGeometry(9.2, 6.4), sheetMat, -2.4, 0.05, 1, scene, false, true));
    sheetA.rotation.z = 0.45;

    // Drafting tools
    addMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 24), matLam(0xd5c6a5), -6.2, 0.45, -3.2);
    addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), matLam(0x5677b8), -6.2, 0.95, -3.2);
    [
      [7.2, 0.18, -2.2, 2.8, 0.36, 2.2, 0xcec0a4],
      [7.3, 0.48, -2.1, 2.6, 0.28, 2.0, 0x7e9ccf],
      [7.0, 0.74, -2.0, 2.4, 0.26, 1.8, 0xd8caa8],
    ].forEach(([x, y, z, w, h, d, c]) => addMesh(makeBox(w, h, d), matLam(c), x, y, z));

    // 6. Three-floor, nine-room campus model
    const towerGroup = new THREE.Group();
    towerGroup.position.set(0, 0, -0.4);
    scene.add(towerGroup);

    const N_FLOORS = FLOORS.length;
    const FLOOR_H = 1.62;
    const BUILDING_W = 7.2;
    const BUILDING_D = 4.2;
    const floorGroups = [];
    const roomEntities = [];

    const floorMat = matLam(0x526781);
    const floorEdgeMat = matLam(0x263b57);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xdce8f2, roughness: 0.35, metalness: 0.12 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x6fc6e5, transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1, transmission: 0.25 });
    const dividerMat = new THREE.MeshStandardMaterial({ color: 0x7188a2, roughness: 0.42, metalness: 0.24 });
    const deskMat = matLam(0x27437a);
    const activeLightMat = new THREE.MeshStandardMaterial({ color: 0xffe69a, emissive: 0xffc857, emissiveIntensity: 1.5, roughness: 0.3 });
    const inactiveLightMat = matLam(0x56677d);
    const activeAcMat = new THREE.MeshStandardMaterial({ color: 0x8be7ff, emissive: 0x18bdf0, emissiveIntensity: 0.8, roughness: 0.25 });
    const inactiveAcMat = matLam(0x67788b);
    const occupiedAvatarMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.2 });
    const emptyAvatarMat = new THREE.MeshStandardMaterial({ color: 0x475569, emissive: 0x1e293b, emissiveIntensity: 0.1, transparent: true, opacity: 0.35 });

    for (let floorIndex = 0; floorIndex < N_FLOORS; floorIndex++) {
      const floorGroup = new THREE.Group();
      floorGroup.position.set(0, floorIndex * FLOOR_H, 0);
      towerGroup.add(floorGroup);

      addMesh(makeBox(BUILDING_W + 0.14, 0.12, BUILDING_D + 0.14), floorEdgeMat, 0, 0, 0, floorGroup);
      addMesh(makeBox(BUILDING_W, 0.09, BUILDING_D), floorMat, 0, 0.08, 0, floorGroup);
      addMesh(makeBox(BUILDING_W, 0.11, 0.1), wallMat, 0, FLOOR_H - 0.05, -BUILDING_D / 2, floorGroup);
      addMesh(makeBox(0.1, FLOOR_H - 0.14, BUILDING_D), wallMat, -BUILDING_W / 2, FLOOR_H / 2, 0, floorGroup);
      addMesh(makeBox(0.1, FLOOR_H - 0.14, BUILDING_D), wallMat, BUILDING_W / 2, FLOOR_H / 2, 0, floorGroup);

      const roomWidth = BUILDING_W / 3;
      for (let roomIndex = 0; roomIndex < FLOORS[floorIndex].rooms.length; roomIndex++) {
        const room = FLOORS[floorIndex].rooms[roomIndex];
        const roomGroup = new THREE.Group();
        const roomX = -BUILDING_W / 2 + roomWidth * (roomIndex + 0.5);
        roomGroup.position.set(roomX, 0, 0);
        floorGroup.add(roomGroup);

        addMesh(makeBox(roomWidth - 0.1, 0.035, BUILDING_D - 0.12), matLam(0x526b84), 0, 0.16, 0, roomGroup, false, true);
        addMesh(makeBox(roomWidth - 0.12, FLOOR_H - 0.22, 0.08), wallMat, 0, FLOOR_H / 2, -BUILDING_D / 2 + 0.04, roomGroup);
        addMesh(makeBox(roomWidth - 0.18, 0.92, 0.06), glassMat, 0, 0.76, BUILDING_D / 2 - 0.04, roomGroup, false, false);
        addMesh(makeBox(roomWidth - 0.18, 0.06, 0.12), floorEdgeMat, 0, 0.22, BUILDING_D / 2 - 0.02, roomGroup);
        if (roomIndex > 0) {
          addMesh(makeBox(0.055, FLOOR_H - 0.22, BUILDING_D - 0.14), dividerMat, -roomWidth / 2, FLOOR_H / 2, 0, roomGroup);
        }

        const lightUnits = [];
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 5; col++) {
            const light = addMesh(makeBox(0.22, 0.035, 0.12), inactiveLightMat, -roomWidth * 0.36 + col * roomWidth * 0.18, FLOOR_H - 0.16, -0.72 + row * 1.35, roomGroup, false, false);
            lightUnits.push(light);
          }
        }

        const acUnits = [];
        for (let acIndex = 0; acIndex < 3; acIndex++) {
          const ac = addMesh(makeBox(0.34, 0.15, 0.12), inactiveAcMat, -roomWidth * 0.3 + acIndex * roomWidth * 0.3, FLOOR_H * 0.72, -BUILDING_D / 2 + 0.12, roomGroup, false, false);
          acUnits.push(ac);
        }

        const avatars = [];
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 4; col++) {
            const x = -roomWidth * 0.3 + col * roomWidth * 0.2;
            const z = -0.7 + row * 0.65;
            addMesh(makeBox(0.28, 0.07, 0.2), deskMat, x, 0.26, z, roomGroup);
            const avatar = addMesh(new THREE.SphereGeometry(0.085, 12, 12), emptyAvatarMat, x, 0.42, z + 0.1, roomGroup, false, false);
            avatars.push(avatar);
          }
        }

        const selectedRoomMat = new THREE.MeshBasicMaterial({
          color: 0x54ddcc,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const highlight = addMesh(makeBox(roomWidth - 0.12, 0.025, BUILDING_D - 0.18), selectedRoomMat, 0, 0.19, 0, roomGroup, false, false);
        roomEntities.push({ id: room.id, floorIndex, lightUnits, acUnits, avatars, highlight });
      }

      floorGroups.push(floorGroup);
    }

    // Rooftop beacon signals a connected room waste alert.
    const alertBeacon = addMesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0 }),
      0,
      FLOOR_H + 0.14,
      0,
      floorGroups[N_FLOORS - 1],
      false,
      false
    );

    // Trees
    [
      [-2.4, 2.0],
      [2.8, 2.2],
      [3.6, -0.9],
      [-3.2, -1.9],
      [1.4, 3.2],
    ].forEach(([x, z]) => {
      const tg = new THREE.Group();
      tg.position.set(x, 0, z);
      scene.add(tg);
      addMesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 8), matLam(0x65543e), 0, 0.25, 0, tg);
      const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x5a9a56, flatShading: true });
      addMesh(new THREE.IcosahedronGeometry(0.48, 1), treeLeafMat, 0, 0.8, 0, tg);
      addMesh(new THREE.IcosahedronGeometry(0.3, 1), treeLeafMat, 0.2, 1.1, 0.1, tg);
    });

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    let smoothMx = 0;
    let smoothMy = 0;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = cx;
      mouseY = cy;
    };
    canvas.addEventListener("pointermove", handleMouseMove);
    const handlePointerLeave = () => { mouseX = 0; mouseY = 0; };
    canvas.addEventListener("pointerleave", handlePointerLeave);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.clientWidth || 800;
      height = canvas.clientHeight || 580;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // -----------------------------------------------------------
    // ANIMATION & RENDER LOOP
    // -----------------------------------------------------------
    let lastTime = performance.now();

    const animate = (now) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const {
        lightsOn: curLights,
        acOn: curAc,
        isWasteAlert: curWaste,
        targetStep: curStepIdx,
        rooms: curRooms,
        selectedRoomId: curRoomId,
        selectedFloorIndex: curFloorIdx,
        selectedRoomIndex: curRoomIdx,
      } = sceneStateRef.current;

      smoothMx += (mouseX - smoothMx) * (1 - Math.exp(-dt * 4));
      smoothMy += (mouseY - smoothMy) * (1 - Math.exp(-dt * 4));

      const kf = KEYFRAMES[curStepIdx] || KEYFRAMES[0];
      const targetCamPos = new THREE.Vector3(
        kf[0] + smoothMx * 1.2,
        kf[1] - smoothMy * 0.8,
        kf[2]
      );
      const targetLook = new THREE.Vector3(kf[3], kf[4], kf[5]);
      camera.fov += (kf[6] - camera.fov) * (1 - Math.exp(-dt * 3.5));
      camera.updateProjectionMatrix();
      if (curStepIdx === 2) {
        const focusX = (curRoomIdx - 1) * (BUILDING_W / 3);
        const focusY = curFloorIdx * FLOOR_H + 0.88;
        targetCamPos.set(focusX + 1.15 + smoothMx * 0.35, focusY + 1.15 - smoothMy * 0.25, 5.5);
        targetLook.set(focusX, focusY + 0.3, 0);
      }

      camera.position.lerp(targetCamPos, 1 - Math.exp(-dt * 3.5));
      lookTarget.lerp(targetLook, 1 - Math.exp(-dt * 3.5));
      camera.lookAt(lookTarget);

      classroomLight.intensity = curLights ? 1.8 : 0.15;
      classroomLight.color.setHex(curLights ? 0xfff0ad : 0x223355);

      acCoolLight.intensity = curAc ? 1.4 : 0.05;
      acCoolLight.color.setHex(curAc ? 0x38bdf8 : 0x112233);

      if (curWaste) {
        const pulse = 0.5 + Math.sin(now * 0.008) * 0.5;
        alertBeacon.material.emissiveIntensity = pulse * 1.5;
        alertLight.intensity = pulse * 2.2;
      } else {
        alertBeacon.material.emissiveIntensity = 0;
        alertLight.intensity = 0;
      }

      const roomStateById = new Map(curRooms.map((room) => [room.id, room]));
      roomEntities.forEach((entity) => {
        const roomState = roomStateById.get(entity.id);
        if (!roomState) return;
        const selected = entity.id === curRoomId;
        entity.highlight.visible = selected;
        entity.highlight.material.opacity = selected ? 0.15 + Math.sin(now * 0.003) * 0.035 : 0;
        entity.avatars.forEach((avatar, idx) => {
          avatar.visible = idx < Math.min(roomState.occupancy, entity.avatars.length);
          avatar.material = avatar.visible ? occupiedAvatarMat : emptyAvatarMat;
        });
        entity.lightUnits.forEach((light, idx) => {
          light.material = idx < roomState.activeLights ? activeLightMat : inactiveLightMat;
        });
        entity.acUnits.forEach((ac, idx) => {
          ac.material = idx < roomState.activeAcUnits ? activeAcMat : inactiveAcMat;
        });
      });

      floorGroups.forEach((fg, fi) => {
        const s = Math.min(1, Math.max(0.001, (now - 200 - fi * 40) / 600));
        fg.scale.setScalar(s);
      });

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("pointermove", handleMouseMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          material?.dispose();
        });
      });
      renderer.dispose();
    };
  }, [twinViewMode]);

  const activeStepObj = STEPS[currentStep];

  const handleNextStep = () => {
    setCurrentStep((prev) => (prev + 1) % STEPS.length);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
  };

  const enterSelectedRoom = () => {
    setCurrentStep(1);
    setTwinViewMode("3d-arcova");
  };

  if (twinViewMode === "scroll-journey") {
    return (
      <section className="page active arcova-theme-page">
        <DigitalTwinJourney
          settings={settings}
          backend={backend}
          roomEquipment={roomEquipmentByRoom}
          roomOccupancy={roomOccupancy}
          selectedRoom={selectedRoom}
          onSelectRoom={onSelectRoom}
          onEnterRoom={enterSelectedRoom}
          onNavigate={onNavigate}
        />
      </section>
    );
  }

  return (
    <section className="page active arcova-theme-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <PageHeader
          eyebrow="CAMPUS DIGITAL TWIN"
          title="Room energy inspection"
          subtitle="Inspect a selected room inside a three-floor, nine-room campus model. Occupancy and equipment changes stay connected to the dashboard and energy estimates."
          pill={snapshot.connected && backend?.status === "online" ? "AI Vision Live" : "Simulation Mode"}
        />

        <button
          type="button"
          className="arcova-btn arcova-story-back"
          onClick={() => setTwinViewMode("scroll-journey")}
        >
          <ArrowLeft size={14} /> Back to building story
        </button>
      </div>

      {twinViewMode === "scroll-journey" ? (
        <DigitalTwinJourney
          settings={settings}
          backend={backend}
          roomEquipment={roomEquipmentByRoom}
          roomOccupancy={roomOccupancy}
          selectedRoom={selectedRoom}
          onSelectRoom={onSelectRoom}
          onEnterRoom={() => setTwinViewMode("3d-arcova")}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          {/* AI Energy Waste Alert Banner */}
          {isWasteAlert && (
            <div className="arcova-waste-alert">
              <AlertTriangle size={20} className="arcova-alert-icon" />
              <div className="arcova-waste-text">
                <strong>AI COMPUTER VISION WASTE ALERT:</strong> {snapshot.name} is vacant while cooling and lighting remain active.
                Turn off equipment or trigger automated setback to eliminate standby loss.
              </div>
            </div>
          )}

          {/* Room Selector Strip */}
          <div className="twin-room-selector-strip" style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "16px", paddingBottom: "4px" }}>
            {FLOORS.flatMap((floor) => floor.rooms).map((r) => {
              const isSelected = r.id === currentRoomId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRoom && onSelectRoom(r.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: isSelected ? "1px solid #38bdf8" : "1px solid #27364b",
                    background: isSelected ? "rgba(56, 189, 248, 0.15)" : "#0e1828",
                    color: isSelected ? "#38bdf8" : "#94a3b8",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.18s",
                  }}
                >
                  <Building2 size={13} />
                  <span>{r.id} · {r.name}</span>
                  {r.id === "A-101" && (
                    <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "999px", background: "rgba(52, 211, 153, 0.2)", color: "#34d399" }}>
                      LIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Main Arcova Stage Layout */}
          <div className="arcova-stage">
            <canvas ref={canvasRef} className="arcova-canvas" />

            {/* The Signature Arcova Left Paper Panel */}
            <aside className="arcova-panel">
              <div className="arcova-panel-header">
                <span className="arcova-brand-pill">
                  <Building2 size={12} /> {currentRoomId} · TWIN
                </span>
                <span className="arcova-step-count">
                  STEP {currentStep + 1} OF {STEPS.length}
                </span>
              </div>

              <div className="arcova-step-content">
                <div className="arcova-tag">
                  <b>{activeStepObj.step}</b> {activeStepObj.tag}
                </div>

                <h2 className="arcova-step-title">
                  {activeStepObj.title.split("\n").map((line, i) => (
                    <span key={i} className="arcova-title-line">
                      {line}
                    </span>
                  ))}
                </h2>

                <p className="arcova-step-desc">{activeStepObj.desc}</p>

                <div className="arcova-btn-row">
                  <button
                    type="button"
                    className="arcova-btn"
                    onClick={handleNextStep}
                    title="Transition camera view"
                  >
                    <i />
                    {activeStepObj.action}
                  </button>
                </div>
              </div>

              {/* Quick HUD Telemetry in side panel */}
              <div className="arcova-side-telemetry">
                <div className="arcova-tele-row">
                  <span className="arcova-tele-label">Headcount</span>
                  <strong className="arcova-tele-val text-green">
                    <Users size={12} /> {occupancy} / {CLASSROOM_CAPACITY}
                  </strong>
                </div>
                <div className="arcova-tele-row">
                  <span className="arcova-tele-label">Active Load</span>
                  <strong className="arcova-tele-val text-amber">
                    <Zap size={12} /> {kw} kW
                  </strong>
                </div>
                <div className="arcova-tele-row">
                  <span className="arcova-tele-label">Efficiency</span>
                  <strong className="arcova-tele-val text-blue">
                    <Gauge size={12} /> {efficiency}%
                  </strong>
                </div>
              </div>

              {/* Step Progress Rail */}
              <div className="arcova-dots">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.step}
                    type="button"
                    className={`arcova-dot-btn ${currentStep === idx ? "active" : ""}`}
                    onClick={() => setCurrentStep(idx)}
                    aria-label={`Jump to step ${s.step}`}
                  >
                    <span />
                  </button>
                ))}
              </div>
            </aside>

            {/* Floating Top-Right HUD Badge */}
            <div className="arcova-top-hud">
              <div className="arcova-hud-room">
                <span className="arcova-live-dot" />
                <span>ROOM {currentRoomId} · FLOOR 0{selectedFloorIndex + 1}</span>
              </div>
              <div className="arcova-hud-status">
                {snapshot.connected && backend?.status === "online" ? "LIVE SYNCED" : "SIMULATION"}
              </div>
            </div>

            {/* Floating Navigation Buttons (Prev / Next) */}
            <div className="arcova-nav-controls">
              <button
                type="button"
                className="arcova-nav-arrow"
                onClick={handlePrevStep}
                title="Previous step"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="arcova-nav-arrow"
                onClick={handleNextStep}
                title="Next step"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Camera Feed Link Chip */}
            {onNavigate && (
              <button
                type="button"
                className="arcova-cam-pill"
                onClick={() => onNavigate("camera")}
              >
                <Camera size={13} />
                <span>Open YOLOv8 Live Camera</span>
              </button>
            )}
          </div>

          {/* Classroom Actuator & Controls Deck */}
          <div className="arcova-controls-deck">
            {/* Occupancy Stepper */}
            <div className="arcova-control-card">
              <div className="arcova-card-header">
                <div>
                  <p className="eyebrow">OCCUPANCY CONTROLS</p>
                  <h3>Classroom Headcount</h3>
                </div>
                <span className="tiny-badge">
                  {occupancy > 0 ? "Occupied" : "Vacant"}
                </span>
              </div>

              <div className="arcova-occupancy-row">
                <button
                  type="button"
                  className="arcova-step-btn"
                  disabled={occupancy === 0}
                  onClick={() => setPeople(occupancy - 1)}
                  aria-label="Decrease occupancy"
                >
                  <Minus size={16} />
                </button>

                <div className="arcova-occupancy-display">
                  <strong className="arcova-big-number">{occupancy}</strong>
                  <span>Students Present</span>
                </div>

                <button
                  type="button"
                  className="arcova-step-btn"
                  disabled={occupancy === CLASSROOM_CAPACITY}
                  onClick={() => setPeople(occupancy + 1)}
                  aria-label="Increase occupancy"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="arcova-progress-track">
                <div
                  className="arcova-progress-bar"
                  style={{
                    width: `${(occupancy / CLASSROOM_CAPACITY) * 100}%`,
                  }}
                />
              </div>
              <div className="arcova-card-sub">
                <span>Empty</span>
                <span>Capacity: {CLASSROOM_CAPACITY} Seats</span>
              </div>

              {/* Interactive Seat Grid */}
              <div style={{ marginTop: "16px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "8px" }}>
                  Interactive Seating Matrix ({occupancy} active)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "4px" }}>
                  {Array.from({ length: CLASSROOM_CAPACITY }, (_, idx) => {
                    const isOccupied = idx < occupancy;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPeople(isOccupied ? occupancy - 1 : occupancy + 1)}
                        title={`Desk ${idx + 1}: ${isOccupied ? "Occupied" : "Vacant"}`}
                        style={{
                          height: "22px",
                          borderRadius: "4px",
                          border: isOccupied ? "1px solid #10b981" : "1px solid #27364b",
                          background: isOccupied ? "rgba(16, 185, 129, 0.25)" : "#0f172a",
                          color: isOccupied ? "#6ee7b7" : "#64748b",
                          fontSize: "9px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s",
                        }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Equipment Actuator Matrix */}
            <div className="arcova-control-card">
              <div className="arcova-card-header">
                <div>
                  <p className="eyebrow">EQUIPMENT AUTOMATION</p>
                  <h3>Lighting & Climate Arrays</h3>
                </div>
                <span className="tiny-badge">
                  Active Draw: {watts} W
                </span>
              </div>

              {/* 10 Ceiling Lights Fixture Grid */}
              <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#fcd34d", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "600" }}>
                    <Lightbulb size={14} /> Ceiling Lighting Array
                  </span>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {lights.filter(Boolean).length} / 10 Active ({lights.filter(Boolean).length * 40} W)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                  {lights.map((on, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleLight(idx)}
                      style={{
                        padding: "6px 4px",
                        borderRadius: "6px",
                        border: on ? "1px solid #f59e0b" : "1px solid #334155",
                        background: on ? "#332b1b" : "#131b28",
                        color: on ? "#fcd34d" : "#64748b",
                        fontSize: "10px",
                        fontWeight: "700",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.18s",
                      }}
                    >
                      L{idx + 1} {on ? "ON" : "OFF"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Climate AC Units */}
              <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "600" }}>
                    <Snowflake size={14} /> 3-Zone Climate (AC)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Target: {targetTemp}°C</span>
                    <button
                      type="button"
                      onClick={() => setTargetTemp((t) => Math.min(30, t + 1))}
                      style={{ padding: "2px 6px", borderRadius: "4px", background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", fontSize: "10px" }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetTemp((t) => Math.max(16, t - 1))}
                      style={{ padding: "2px 6px", borderRadius: "4px", background: "#1e293b", border: "1px solid #334155", color: "#cbd5e1", fontSize: "10px" }}
                    >
                      -
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {acs.map((on, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleAc(idx)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "8px",
                        border: on ? "1px solid #0284c7" : "1px solid #334155",
                        background: on ? "#172e47" : "#131b28",
                        color: on ? "#7dd3fc" : "#64748b",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 0.18s",
                      }}
                    >
                      <Snowflake size={16} />
                      <span>AC {idx + 1}</span>
                      <small style={{ fontSize: "9px", opacity: 0.8 }}>{on ? `${targetTemp}°C · ON` : "STANDBY"}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
