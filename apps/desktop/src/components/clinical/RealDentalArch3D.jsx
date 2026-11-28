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

// ── Standard 32 Permanent Teeth (FDI System) ───────────────────────────────
const UPPER_ARCH_IDS = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_ARCH_IDS = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const TOOTH_NAMES = {
  18: 'Upper Right 3rd Molar (Wisdom)', 17: 'Upper Right 2nd Molar', 16: 'Upper Right 1st Molar',
  15: 'Upper Right 2nd Premolar', 14: 'Upper Right 1st Premolar', 13: 'Upper Right Canine',
  12: 'Upper Right Lateral Incisor', 11: 'Upper Right Central Incisor',
  21: 'Upper Left Central Incisor', 22: 'Upper Left Lateral Incisor', 23: 'Upper Left Canine',
  24: 'Upper Left 1st Premolar', 25: 'Upper Left 2nd Premolar', 26: 'Upper Left 1st Molar',
  27: 'Upper Left 2nd Molar', 28: 'Upper Left 3rd Molar (Wisdom)',
  48: 'Lower Right 3rd Molar', 47: 'Lower Right 2nd Molar', 46: 'Lower Right 1st Molar',
  45: 'Lower Right 2nd Premolar', 44: 'Lower Right 1st Premolar', 43: 'Lower Right Canine',
  42: 'Lower Right Lateral Incisor', 41: 'Lower Right Central Incisor',
  31: 'Lower Left Central Incisor', 32: 'Lower Left Lateral Incisor', 33: 'Lower Left Canine',
  34: 'Lower Left 1st Premolar', 35: 'Lower Left 2nd Premolar', 36: 'Lower Left 1st Molar',
  37: 'Lower Left 2nd Molar', 38: 'Lower Left 3rd Molar'
};

// ── Organic Anatomical Geometry Builders (Smooth Natural Teeth) ───────────────
function createAnatomicalCrownGeometry(toothId) {
  const posNum = Number(toothId[1]);
  const isMolar = posNum >= 6;
  const isPremolar = posNum === 4 || posNum === 5;
  const isCanine = posNum === 3;
  const isCentral = posNum === 1;
  const isLateral = posNum === 2;

  let geo;

  if (isMolar) {
    // Sculpted Multi-Cusped Molar Crown
    geo = new THREE.CylinderGeometry(0.82, 0.72, 0.88, 24, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Occlusal surface sculpting: 4 natural cusps and central groove
      if (y > 0.2) {
        const angle = Math.atan2(z, x);
        const dist = Math.sqrt(x * x + z * z);
        const cuspBulge = Math.cos(angle * 4) * 0.12 * (dist / 0.8);
        const centralFossa = Math.exp(-dist * 4) * 0.18;
        pos.setY(i, y + cuspBulge - centralFossa);
      }
      // Cervical constriction (waist at gum line)
      if (y < -0.2) {
        pos.setX(i, x * 0.92);
        pos.setZ(i, z * 0.92);
      }
    }
  } else if (isPremolar) {
    // Bicuspid Anatomical Crown (Buccal & Lingual Cusps)
    geo = new THREE.CylinderGeometry(0.64, 0.54, 0.82, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      if (y > 0.15) {
        // Two distinct cusps along buccal-lingual axis
        const cuspLift = Math.abs(x) * 0.18 - Math.abs(z) * 0.08;
        pos.setY(i, y + cuspLift);
      }
      // Natural mesial-distal compression
      pos.setZ(i, z * 0.85);
    }
  } else if (isCanine) {
    // Conical Diamond Canine with prominent labial ridge
    geo = new THREE.ConeGeometry(0.56, 1.1, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Labial bulge & pointed canine cusp tip
      if (z > 0) {
        pos.setZ(i, z * 1.25);
      }
      pos.setX(i, x * 0.9);
    }
  } else {
    // Incisor (Central / Lateral) - Graceful Curved Spade with chisel edge
    const width = isCentral ? 0.78 : 0.62;
    const height = isCentral ? 0.98 : 0.86;
    const thickness = 0.38;

    geo = new THREE.BoxGeometry(width, height, thickness, 8, 8, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Incisal thinning (sharp chisel biting edge at top)
      if (y > 0.1) {
        const factor = (y - 0.1) / (height * 0.5);
        z *= 1 - factor * 0.45;
        // Natural labial curvature
        z += Math.cos(x * 3) * 0.05;
      }
      // Cervical taper towards root
      if (y < 0) {
        const taper = 1 - Math.abs(y) * 0.35;
        x *= taper;
      }
      pos.setXYZ(i, x, y, z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

// Scalloped Natural Gingiva Arch (Gum Tissue)
function createScallopedGingivaMesh(teethList, isUpper, gumMaterial) {
  const count = teethList.length;
  const points = [];

  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * 2 - 1; // -1 to 1
    const x = t * 6.0;
    const z = -(1 - t * t) * 4.6;
    // Scalloped undulating wave hugging each tooth collar
    const scallop = Math.sin(i * 1.57) * 0.15;
    const y = (isUpper ? 1.6 : -1.6) + scallop;
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.72, 12, false);
  tubeGeo.computeVertexNormals();
  return new THREE.Mesh(tubeGeo, gumMaterial);
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
  const [xrayMode, setXrayMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const jawGroupRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 740;
    const height = container.clientHeight || 460;

    // ── 1. Three.js Scene & Perspective Camera ──
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3, 15.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ── 2. Natural Medical Operatory Lighting ──
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambient);

    // Main operatory lamp (soft daylight 5500K)
    const keyLight = new THREE.DirectionalLight(0xfffdf7, 2.8);
    keyLight.position.set(4, 10, 8);
    scene.add(keyLight);

    // Fill bounce light (warm tissue reflection)
    const fillLight = new THREE.DirectionalLight(0xfce7f3, 1.2);
    fillLight.position.set(-6, -3, 6);
    scene.add(fillLight);

    // Enamel Specular Rim Light (Highlights tooth contours)
    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
    rimLight.position.set(0, 8, -8);
    scene.add(rimLight);

    // ── 3. High-Fidelity Medical Materials ──
    // Genuine Ivory Pearl Enamel with realistic subsurface clearcoat
    const realEnamelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfaf8f2, // Natural enamel pearl white (not flat blue plastic)
      emissive: 0x071e22,
      emissiveIntensity: 0.04,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      transmission: 0.14, // Subtle light transmission like real hydroxyapatite enamel
      thickness: 0.9
    });

    // Natural Coral Pink Gingiva (Gum Tissue)
    const naturalGingivaMaterial = new THREE.MeshStandardMaterial({
      color: 0xd96b7d,
      roughness: 0.42,
      metalness: 0.02,
      transparent: xrayMode,
      opacity: xrayMode ? 0.35 : 1.0
    });

    // Gold / Zirconia Crown
    const goldCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0x854d0e,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.85
    });

    // Titanium Dental Implant
    const titaniumImplantMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.92,
      roughness: 0.2
    });

    // RCT Illuminated Canal Material
    const rctMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xd97706,
      emissiveIntensity: 0.8
    });

    // ── 4. Build Complete Dental Arches with Anatomical Teeth ──
    const jawGroup = new THREE.Group();
    jawGroupRef.current = jawGroup;
    scene.add(jawGroup);

    const toothMeshMap = new Map();

    const buildArch = (teethList, isUpper) => {
      const arch = new THREE.Group();
      const count = teethList.length;

      // Scalloped gum tissue ribbon
      const gumMesh = createScallopedGingivaMesh(teethList, isUpper, naturalGingivaMaterial);
      arch.add(gumMesh);

      for (let i = 0; i < count; i++) {
        const toothId = teethList[i];
        const rec = records.get(toothId);

        // Parabolic Arch Curve coordinates
        const t = (i / (count - 1)) * 2 - 1; // -1 to 1
        const x = t * 5.8;
        const z = -(1 - t * t) * 4.4;
        const y = isUpper ? 1.05 : -1.05;

        const toothNode = new THREE.Group();
        toothNode.position.set(x, y, z);

        // Natural inward arch inclination angle
        const normalAngle = Math.atan2(x * 0.85, -z + 5.2);
        toothNode.rotation.y = normalAngle;

        // Slight natural axial inclination (incisors tilt slightly outward, molars vertical)
        const posNum = Number(toothId[1]);
        const isAnterior = posNum <= 3;
        if (isAnterior) {
          toothNode.rotation.x = isUpper ? -0.12 : 0.12;
        }

        const code = rec?.conditionCode || '';
        const isCrown = code === 'crown';
        const isImplant = code === 'implant';
        const isRct = code === 'rct';
        const isCaries = code === 'caries';
        const isMissing = code === 'missing' || code === 'extraction_required';
        const isSelected = selectedTooth === toothId;

        if (!isMissing) {
          // Crown Mesh
          const crownGeo = createAnatomicalCrownGeometry(toothId);
          let mat = realEnamelMaterial;
          if (isCrown) mat = goldCrownMaterial;
          if (isImplant) mat = titaniumImplantMaterial;

          const crownMesh = new THREE.Mesh(crownGeo, mat);
          crownMesh.userData = { toothId, isUpper, name: TOOTH_NAMES[toothId] };
          toothNode.add(crownMesh);
          toothMeshMap.set(toothId, crownMesh);

          // Anatomical Root (Hidden inside gum, visible in X-Ray mode)
          if (xrayMode || isImplant || isRct) {
            const rootLength = posNum >= 6 ? 1.8 : 1.4;
            const rootGeo = new THREE.ConeGeometry(posNum >= 6 ? 0.35 : 0.24, rootLength, 12);
            const rootMat = isImplant
              ? titaniumImplantMaterial
              : new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.45 });

            const rootMesh = new THREE.Mesh(rootGeo, rootMat);
            rootMesh.position.y = isUpper ? 1.05 : -1.05;
            rootMesh.rotation.x = isUpper ? 0 : Math.PI;
            toothNode.add(rootMesh);

            // Illuminated Root Canal Gutta-Percha if RCT
            if (isRct) {
              const canalGeo = new THREE.CylinderGeometry(0.05, 0.03, rootLength * 0.85, 8);
              const canalMesh = new THREE.Mesh(canalGeo, rctMaterial);
              canalMesh.position.copy(rootMesh.position);
              canalMesh.rotation.copy(rootMesh.rotation);
              toothNode.add(canalMesh);
            }
          }

          // Active Selection Cyan Ring Indicator
          if (isSelected) {
            const ringGeo = new THREE.TorusGeometry(0.72, 0.06, 8, 20);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d1dc });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = isUpper ? 0.4 : -0.4;
            toothNode.add(ring);
          }
        } else {
          // Missing Tooth: subtle dashed outline
          const ghostGeo = new THREE.BoxGeometry(0.55, 0.65, 0.35);
          const ghostMat = new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.25 });
          const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
          ghostMesh.userData = { toothId, isUpper, name: `${TOOTH_NAMES[toothId]} (Missing)` };
          toothNode.add(ghostMesh);
          toothMeshMap.set(toothId, ghostMesh);
        }

        arch.add(toothNode);
      }

      return arch;
    };

    const upperArch = buildArch(UPPER_ARCH_IDS, true);
    const lowerArch = buildArch(LOWER_ARCH_IDS, false);
    jawGroup.add(upperArch);
    jawGroup.add(lowerArch);

    // Initial Natural Smile Tilt
    jawGroup.rotation.x = 0.12;

    // ── 5. Natural Drag 360° Orbit & Interaction ──
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
        jawGroup.rotation.y += deltaX * 0.012;
        jawGroup.rotation.x += deltaY * 0.01;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }

      // Raycasting for interactive hover
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
      camera.position.z = Math.max(7.5, Math.min(22, camera.position.z + e.deltaY * 0.012));
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
      jawGroup.rotation.y += deltaX * 0.015;
      jawGroup.rotation.x += deltaY * 0.012;
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
        jawGroup.rotation.y += 0.005;
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
  }, [selectedTooth, records, onSelectTooth, xrayMode, autoRotate]);

  // View Angle Switcher
  const handleAngleChange = (angle) => {
    setViewAngle(angle);
    if (!jawGroupRef.current || !cameraRef.current) return;

    if (angle === 'smile') {
      jawGroupRef.current.rotation.set(0.12, 0, 0);
      cameraRef.current.position.set(0, 3, 15.5);
    } else if (angle === 'occlusal') {
      // Top-Down Occlusal Chewing Surface
      jawGroupRef.current.rotation.set(1.45, 0, 0);
      cameraRef.current.position.set(0, 14, 1.5);
    } else if (angle === 'upper') {
      jawGroupRef.current.rotation.set(-0.65, 0, 0);
      cameraRef.current.position.set(0, 7, 13.5);
    } else if (angle === 'lower') {
      jawGroupRef.current.rotation.set(0.75, 0, 0);
      cameraRef.current.position.set(0, -5, 13.5);
    }
    cameraRef.current.lookAt(0, 0, 0);
  };

  return (
    <div className="relative rounded-3xl border border-teal-500/30 bg-gradient-to-b from-[#06151a] via-[#030c0e] to-[#010608] p-4 text-white shadow-2xl overflow-hidden select-none">
      {/* ── Top Header Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-900/60 pb-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d1dc] to-[#009da6] text-white shadow-md">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wide text-white">
                Photorealistic 3D Dental Arch Anatomy
              </h3>
              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-black text-teal-300 border border-teal-500/40 font-mono">
                Medical-Grade 360°
              </span>
            </div>
            <p className="text-[11px] text-teal-100/70">
              Natural pearl enamel luster &amp; scalloped gingival collars. Click any tooth to chart.
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
              Clinical Smile
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
              Upper Arch
            </button>
            <button
              type="button"
              onClick={() => handleAngleChange('lower')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                viewAngle === 'lower' ? 'bg-[#009da6] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Lower Arch
            </button>
          </div>

          {/* X-Ray / Bone Transparency Mode */}
          <button
            type="button"
            onClick={() => setXrayMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition cursor-pointer ${
              xrayMode
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 ring-1 ring-cyan-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Eye size={13} />
            <span>{xrayMode ? 'X-Ray Roots: ON' : 'X-Ray Roots: OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── 3D Viewport ── */}
      <div
        ref={mountRef}
        className="w-full h-80 sm:h-96 flex items-center justify-center cursor-grab active:cursor-grabbing"
      />

      {/* ── Bottom Information Bar ── */}
      <div className="flex items-center justify-between border-t border-teal-900/60 pt-2 px-2 text-xs">
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
              Drag anywhere to rotate 360° · Scroll to zoom into cusps
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
              autoRotate ? 'bg-teal-500/20 text-[#00d1dc]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {autoRotate ? 'Auto-Orbit: ON' : 'Auto-Orbit: OFF'}
          </button>

          <button
            type="button"
            onClick={() => handleAngleChange('smile')}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>
        </div>
      </div>
    </div>
  );
}