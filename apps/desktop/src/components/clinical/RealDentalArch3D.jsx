import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Sparkles,
  Layers,
  Eye,
  Sliders,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

// ── Tooth Definitions (Ordered from Midline Central Incisor outward) ─────────
// Upper Arch: 11 outward to 18 (Right), and 21 outward to 28 (Left)
const UPPER_RIGHT = ['11', '12', '13', '14', '15', '16', '17', '18'];
const UPPER_LEFT  = ['21', '22', '23', '24', '25', '26', '27', '28'];

// Lower Arch: 41 outward to 48 (Right), and 31 outward to 38 (Left)
const LOWER_RIGHT = ['41', '42', '43', '44', '45', '46', '47', '48'];
const LOWER_LEFT  = ['31', '32', '33', '34', '35', '36', '37', '38'];

const TOOTH_NAMES = {
  11: 'Upper Right Central Incisor', 12: 'Upper Right Lateral Incisor', 13: 'Upper Right Canine',
  14: 'Upper Right 1st Premolar', 15: 'Upper Right 2nd Premolar', 16: 'Upper Right 1st Molar',
  17: 'Upper Right 2nd Molar', 18: 'Upper Right 3rd Molar (Wisdom)',
  21: 'Upper Left Central Incisor', 22: 'Upper Left Lateral Incisor', 23: 'Upper Left Canine',
  24: 'Upper Left 1st Premolar', 25: 'Upper Left 2nd Premolar', 26: 'Upper Left 1st Molar',
  27: 'Upper Left 2nd Molar', 28: 'Upper Left 3rd Molar (Wisdom)',
  41: 'Lower Right Central Incisor', 42: 'Lower Right Lateral Incisor', 43: 'Lower Right Canine',
  44: 'Lower Right 1st Premolar', 45: 'Lower Right 2nd Premolar', 46: 'Lower Right 1st Molar',
  47: 'Lower Right 2nd Molar', 48: 'Lower Right 3rd Molar',
  31: 'Lower Left Central Incisor', 32: 'Lower Left Lateral Incisor', 33: 'Lower Left Canine',
  34: 'Lower Left 1st Premolar', 35: 'Lower Left 2nd Premolar', 36: 'Lower Left 1st Molar',
  37: 'Lower Left 2nd Molar', 38: 'Lower Left 3rd Molar'
};

// Anatomical widths of human teeth in mm / unit scale (for seamless interproximal contacts)
const TOOTH_WIDTHS = {
  1: 0.86, // Central incisor
  2: 0.68, // Lateral incisor
  3: 0.78, // Canine
  4: 0.72, // 1st Premolar
  5: 0.72, // 2nd Premolar
  6: 1.08, // 1st Molar
  7: 0.98, // 2nd Molar
  8: 0.88  // 3rd Molar
};

// ── Organic Anatomical Crown Geometries (Matching Real Typodont) ─────────────
function buildTypodontToothGeometry(toothId, isUpper) {
  const posNum = Number(toothId[1]);
  const isMolar = posNum >= 6;
  const isPremolar = posNum === 4 || posNum === 5;
  const isCanine = posNum === 3;
  const isCentral = posNum === 1;
  const isLateral = posNum === 2;

  let geo;

  if (isMolar) {
    // 4-Cusped Anatomical Molar Crown with Central Fossa
    const width = posNum === 6 ? 1.05 : 0.95;
    geo = new THREE.CylinderGeometry(width * 0.52, width * 0.46, 0.95, 24, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Occlusal chewing table with 4 rounded cusps
      if (y > 0.15) {
        const angle = Math.atan2(z, x);
        const dist = Math.sqrt(x * x + z * z);
        const cuspLift = Math.cos(angle * 4) * 0.14 * (dist / 0.5);
        const centralPit = Math.exp(-dist * 5.0) * 0.18;
        pos.setY(i, y + cuspLift - centralPit);
      }
      // Cervical taper into gum
      if (y < -0.2) {
        pos.setX(i, x * 0.9);
        pos.setZ(i, z * 0.9);
      }
    }
  } else if (isPremolar) {
    // Bicuspid Crown (Buccal & Palatal / Lingual Cusps)
    geo = new THREE.CylinderGeometry(0.42, 0.36, 0.9, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > 0.15) {
        const cusp = (Math.abs(z) * 0.35) - (Math.abs(x) * 0.12);
        pos.setY(i, y + cusp);
      }
      pos.setX(i, x * 0.92);
    }
  } else if (isCanine) {
    // Elegant Diamond Canine with Prominent Cusp & Labial Ridge
    geo = new THREE.ConeGeometry(0.44, 1.15, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > 0) pos.setZ(i, z * 1.3); // Labial convexity
      pos.setX(i, x * 0.88);
    }
  } else {
    // Central or Lateral Incisor (Graceful Spade Crown with Curved Incisal Edge)
    const w = isCentral ? (isUpper ? 0.88 : 0.62) : (isUpper ? 0.72 : 0.6);
    const h = isCentral ? 1.08 : 0.96;
    const d = 0.44;

    geo = new THREE.BoxGeometry(w, h, d, 8, 8, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Incisal thinning & rounded line angles
      if (y > 0.1) {
        const t = (y - 0.1) / (h * 0.5);
        z *= 1 - t * 0.48; // thin incisal biting edge
        z += Math.cos(x * 2.5) * 0.05; // natural labial curvature
      }
      // Cervical constriction towards root
      if (y < 0) {
        const factor = 1 - Math.abs(y) * 0.35;
        x *= factor;
      }
      pos.setXYZ(i, x, y, z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

// ── Realistic Solid Typodont Gum Arch (Pink Acrylic Base like Image 1) ──────
function createTypodontGumBase(isUpper, gumMaterial) {
  const shape = new THREE.Shape();

  // Anatomical outer horseshoe curve
  shape.moveTo(0, 4.8);
  shape.bezierCurveTo(3.8, 4.8, 5.8, 3.2, 5.8, 0.4);
  shape.bezierCurveTo(5.8, -2.6, 4.6, -4.6, 3.6, -5.2);
  shape.lineTo(2.4, -5.2);
  // Inner lingual / palatal horseshoe boundary
  shape.bezierCurveTo(3.2, -4.2, 4.1, -2.2, 4.1, 0.2);
  shape.bezierCurveTo(4.1, 2.4, 2.6, 3.4, 0, 3.4);
  shape.bezierCurveTo(-2.6, 3.4, -4.1, 2.4, -4.1, 0.2);
  shape.bezierCurveTo(-4.1, -2.2, -3.2, -4.2, -2.4, -5.2);
  shape.lineTo(-3.6, -5.2);
  shape.bezierCurveTo(-4.6, -4.6, -5.8, -2.6, -5.8, 0.4);
  shape.bezierCurveTo(-5.8, 3.2, -3.8, 4.8, 0, 4.8);

  const extrudeSettings = {
    steps: 2,
    depth: 1.7,
    bevelEnabled: true,
    bevelThickness: 0.38,
    bevelSize: 0.38,
    bevelOffset: 0,
    bevelSegments: 10
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, gumMaterial);
  mesh.rotation.x = Math.PI / 2;
  if (isUpper) {
    mesh.scale.set(1, 1, -1);
    mesh.position.y = 0.25;
  } else {
    mesh.position.y = -0.25;
  }
  return mesh;
}

// Smooth Tongue for Lower Mandible (Like Image 1)
function createTypodontTongue(tongueMaterial) {
  const geo = new THREE.SphereGeometry(2.4, 24, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x * 1.1, y * 0.55, z * 1.25);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, tongueMaterial);
  mesh.position.set(0, -0.6, -0.8);
  return mesh;
}

export default function RealDentalArch3D({
  selectedTooth = null,
  onSelectTooth,
  records = new Map(),
  dentition = 'permanent'
}) {
  const mountRef = useRef(null);
  const [viewAngle, setViewAngle] = useState('smile'); // 'smile' | 'occlusal' | 'upper' | 'lower'
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);

  const jawGroupRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 760;
    const height = container.clientHeight || 480;

    // ── 1. Scene & Camera Setup ──
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 3.5, 17);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ── 2. Studio Lighting (Soft Medical Photo Studio Quality) ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.9);
    scene.add(ambientLight);

    // Main Soft Key Light (Top-Right)
    const keyLight = new THREE.DirectionalLight(0xfffdf7, 2.6);
    keyLight.position.set(5, 12, 10);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Soft Warm Fill Light (Left)
    const fillLight = new THREE.DirectionalLight(0xfef2f2, 1.4);
    fillLight.position.set(-8, 2, 8);
    scene.add(fillLight);

    // Enamel Specular Rim Highlight (Creates the glossy pearl shine seen in Image 1)
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 2.0);
    rimLight.position.set(0, 8, -10);
    scene.add(rimLight);

    // Soft Oral Cavity Light (Highlights tongue & lingual anatomy)
    const mouthCavityLight = new THREE.PointLight(0xfff7ed, 1.2, 12);
    mouthCavityLight.position.set(0, 0, -0.5);
    scene.add(mouthCavityLight);

    // ── 3. High-Grade Typodont Materials (Matches Image 1 & Image 5) ──
    // Realistic Porcelain / Composite Teeth (Bright Pearl White with Specular Reflection)
    const typodontToothMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x071e22,
      emissiveIntensity: 0.03,
      roughness: 0.15,
      metalness: 0.02,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      transmission: 0.08,
      thickness: 0.8
    });

    // Realistic Glossy Pink Typodont Acrylic Gingiva (Like Image 1)
    const typodontGingivaMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xee7e92,
      emissive: 0x4a121a,
      emissiveIntensity: 0.06,
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12
    });

    // Realistic Soft Pink Tongue
    const tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xe66f85,
      roughness: 0.45,
      metalness: 0.02
    });

    // Gold / Zirconia Crown
    const goldCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0x92400e,
      emissiveIntensity: 0.28,
      roughness: 0.2,
      metalness: 0.85
    });

    // Titanium Dental Implant
    const titaniumMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.94,
      roughness: 0.2
    });

    // ── 4. Build Articulated Typodont Jaw (Upper & Lower in Natural Open Bite) ──
    const jawMasterGroup = new THREE.Group();
    jawGroupRef.current = jawMasterGroup;
    scene.add(jawMasterGroup);

    const toothMeshMap = new Map();

    // Builds 1 half of an arch along an anatomical contact arc
    const layoutArchQuadrant = (archGroup, teethList, isUpper, isLeft) => {
      // Starting from Central Incisor at midline, integrate along curve
      let currentDist = 0.48; // half midline contact spacing

      for (let i = 0; i < teethList.length; i++) {
        const toothId = teethList[i];
        const posNum = Number(toothId[1]);
        const width = TOOTH_WIDTHS[posNum] || 0.75;
        const toothCenterDist = currentDist + width * 0.5;
        currentDist += width * 0.98; // seamless interproximal contact!

        // Map distance along parabolic dental arch:
        // x(d) = d, z(d) = curve
        const t = toothCenterDist / 6.0;
        const x = (isLeft ? 1 : -1) * (toothCenterDist * 0.88);
        const z = 4.2 - Math.pow(t, 1.85) * 5.2;
        const y = 0.0;

        const toothNode = new THREE.Group();
        toothNode.position.set(x, y, z);

        // Compute tangent angle along curve for natural facial/buccal orientation
        const angle = Math.atan2(x * 0.85, 4.5 - z);
        toothNode.rotation.y = angle;

        // Slight natural axial labial inclination
        if (posNum <= 3) {
          toothNode.rotation.x = isUpper ? -0.1 : 0.08;
        }

        const rec = records.get(toothId);
        const code = rec?.conditionCode || '';
        const isCrown = code === 'crown';
        const isImplant = code === 'implant';
        const isMissing = code === 'missing' || code === 'extraction_required';
        const isSelected = selectedTooth === toothId;

        if (!isMissing) {
          const crownGeo = buildTypodontToothGeometry(toothId, isUpper);
          let mat = typodontToothMaterial;
          if (isCrown) mat = goldCrownMaterial;
          if (isImplant) mat = titaniumMaterial;

          const crownMesh = new THREE.Mesh(crownGeo, mat.clone());
          if (isUpper) {
            crownMesh.rotation.z = Math.PI;
          }
          crownMesh.castShadow = true;
          crownMesh.receiveShadow = true;
          crownMesh.userData = { toothId, isUpper, name: TOOTH_NAMES[toothId] };

          // Active Glow if selected
          if (isSelected) {
            crownMesh.material.emissive = new THREE.Color(0x009da6);
            crownMesh.material.emissiveIntensity = 0.45;

            const haloGeo = new THREE.TorusGeometry(0.72, 0.06, 12, 32);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0x00d1dc });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2;
            halo.position.y = isUpper ? -0.45 : 0.45;
            toothNode.add(halo);
          }

          toothNode.add(crownMesh);
          toothMeshMap.set(toothId, crownMesh);
        } else {
          // Missing Tooth: subtle dashed outline
          const ghostGeo = new THREE.BoxGeometry(0.55, 0.65, 0.35);
          const ghostMat = new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.25 });
          const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
          ghostMesh.userData = { toothId, isUpper, name: `${TOOTH_NAMES[toothId]} (Missing)` };
          toothNode.add(ghostMesh);
          toothMeshMap.set(toothId, ghostMesh);
        }

        archGroup.add(toothNode);
      }
    };

    // Upper Maxilla Jaw Group (Hinged slightly upward, like Image 1)
    const upperJaw = new THREE.Group();
    upperJaw.position.set(0, 1.3, -0.6);
    upperJaw.rotation.x = -0.26; // Open mouth upward tilt

    const upperGum = createTypodontGumBase(true, typodontGingivaMaterial);
    upperJaw.add(upperGum);

    layoutArchQuadrant(upperJaw, UPPER_RIGHT, true, false);
    layoutArchQuadrant(upperJaw, UPPER_LEFT, true, true);
    jawMasterGroup.add(upperJaw);

    // Lower Mandible Jaw Group (Like Image 1)
    const lowerJaw = new THREE.Group();
    lowerJaw.position.set(0, -1.3, 0.2);
    lowerJaw.rotation.x = 0.14; // Open mouth downward tilt

    const lowerGum = createTypodontGumBase(false, typodontGingivaMaterial);
    lowerJaw.add(lowerGum);

    // Add Tongue inside lower jaw (Exact match with Image 1)
    const tongue = createTypodontTongue(tongueMaterial);
    lowerJaw.add(tongue);

    layoutArchQuadrant(lowerJaw, LOWER_RIGHT, false, false);
    layoutArchQuadrant(lowerJaw, LOWER_LEFT, false, true);
    jawMasterGroup.add(lowerJaw);

    // Natural 3/4 Perspective Angle (like Image 1)
    jawMasterGroup.rotation.set(0.18, -0.32, 0);

    // ── 5. Mouse & Touch Drag 360° Orbit & Interaction ──
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        jawMasterGroup.rotation.y += deltaX * 0.012;
        jawMasterGroup.rotation.x += deltaY * 0.01;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }

      // Raycasting for interactive tooth hover
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const hitList = raycaster.intersectObjects(Array.from(toothMeshMap.values()), true);
      if (hitList.length > 0) {
        const obj = hitList[0].object;
        if (obj.userData?.toothId) {
          setHoveredTooth(obj.userData);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredTooth(null);
        if (!isDragging) renderer.domElement.style.cursor = 'grab';
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      if (renderer.domElement) renderer.domElement.style.cursor = 'grab';
    };

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const hitList = raycaster.intersectObjects(Array.from(toothMeshMap.values()), true);
      if (hitList.length > 0) {
        const obj = hitList[0].object;
        if (obj.userData?.toothId && onSelectTooth) {
          onSelectTooth(obj.userData.toothId);
        }
      }
    };

    // Zoom on wheel
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(9, Math.min(26, camera.position.z + e.deltaY * 0.012));
    };

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('click', onClick);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Touch events for iPad
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      jawMasterGroup.rotation.y += deltaX * 0.015;
      jawMasterGroup.rotation.x += deltaY * 0.012;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    };
    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchmove', onTouchMove);
    dom.addEventListener('touchend', onMouseUp);

    // ── 6. Animation Loop ──
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDragging) {
        jawMasterGroup.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
    };
    animate();

    // ── 7. Clean up ──
    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onMouseUp);
      renderer.dispose();
      if (container.contains(dom)) container.removeChild(dom);
    };
  }, [selectedTooth, records, onSelectTooth, autoRotate]);

  // View Angle Switcher
  const handleAngleChange = (angle) => {
    setViewAngle(angle);
    if (!jawGroupRef.current || !cameraRef.current) return;

    if (angle === 'smile') {
      jawGroupRef.current.rotation.set(0.18, -0.32, 0); // 3/4 Typodont pose (like Image 1)
      cameraRef.current.position.set(0, 3.5, 17);
    } else if (angle === 'occlusal') {
      // Top-Down Occlusal Chewing Plane
      jawGroupRef.current.rotation.set(1.5, 0, 0);
      cameraRef.current.position.set(0, 16, 2);
    } else if (angle === 'upper') {
      jawGroupRef.current.rotation.set(-0.7, 0, 0);
      cameraRef.current.position.set(0, 8, 14);
    } else if (angle === 'lower') {
      jawGroupRef.current.rotation.set(0.85, 0, 0);
      cameraRef.current.position.set(0, -6, 14);
    }
    cameraRef.current.lookAt(0, 0, 0);
  };

  return (
    <div className="relative rounded-3xl border border-teal-500/30 bg-gradient-to-b from-[#0a2328] via-[#041518] to-[#01090b] p-4 text-white shadow-2xl overflow-hidden select-none">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-800/60 pb-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d1dc] to-[#009da6] text-white shadow-md">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wide text-white">
                3D Realistic Typodont Study Model
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30 font-mono">
                Operatory 360° Studio
              </span>
            </div>
            <p className="text-[11px] text-teal-100/70">
              Anatomical ceramic teeth &amp; pink acrylic typodont arches. Drag 360° to inspect.
            </p>
          </div>
        </div>

        {/* View Angle Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-teal-800/60 shadow-inner">
            <button
              type="button"
              onClick={() => handleAngleChange('smile')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                viewAngle === 'smile' ? 'bg-[#009da6] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Typodont 3D
            </button>
            <button
              type="button"
              onClick={() => handleAngleChange('occlusal')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                viewAngle === 'occlusal' ? 'bg-[#009da6] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Occlusal (Bite)
            </button>
            <button
              type="button"
              onClick={() => handleAngleChange('upper')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                viewAngle === 'upper' ? 'bg-[#009da6] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upper Maxilla
            </button>
            <button
              type="button"
              onClick={() => handleAngleChange('lower')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                viewAngle === 'lower' ? 'bg-[#009da6] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lower Mandible
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
              autoRotate ? 'border-teal-400 bg-teal-500/20 text-[#00d1dc]' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            {autoRotate ? 'Auto-Orbit: ON' : 'Auto-Orbit: OFF'}
          </button>
        </div>
      </div>

      {/* ── 3D Viewport Canvas ── */}
      <div
        ref={mountRef}
        className="w-full h-80 sm:h-96 flex items-center justify-center cursor-grab active:cursor-grabbing"
      />

      {/* ── Bottom Information Bar ── */}
      <div className="flex items-center justify-between border-t border-teal-800/60 pt-2 px-2 text-xs">
        <div>
          {hoveredTooth ? (
            <span className="flex items-center gap-2 font-black text-[#00d1dc]">
              <span>Tooth #{hoveredTooth.toothId}</span>
              <span className="text-slate-300 font-medium">({hoveredTooth.name})</span>
            </span>
          ) : selectedTooth ? (
            <span className="text-emerald-400 font-bold">
              Active Tooth #{selectedTooth} ({TOOTH_NAMES[selectedTooth]})
            </span>
          ) : (
            <span className="text-slate-400">
              Drag anywhere to rotate 360° · Click any tooth to chart
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleAngleChange('smile')}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
        >
          <RotateCcw size={12} />
          <span>Reset Camera</span>
        </button>
      </div>
    </div>
  );
}