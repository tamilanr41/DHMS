import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import Badge from '../ui/Badge.jsx';

// ── 32 Permanent Teeth Anatomical Arc Mapping ───────────────────────────────
const UPPER_TEETH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_TEETH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

export default function RealDentalArch3D({
  selectedTooth = null,
  onSelectTooth,
  records = new Map(),
  dentition = 'permanent'
}) {
  const mountRef = useRef(null);
  const [viewPreset, setViewPreset] = useState('full'); // 'full' | 'upper' | 'lower' | 'occlusal'
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);

  // References to communicate with 3D animation loop
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const toothMeshesRef = useRef(new Map());
  const jawGroupRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── 1. Setup Three.js Scene, Camera, Renderer ──
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 7, 16);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ── 2. Operatory Medical Studio Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight1.position.set(6, 12, 10);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xccfbf1, 1.4);
    dirLight2.position.set(-8, -4, 6);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(0, 10, -10);
    scene.add(rimLight);

    // ── 3. Base Materials ──
    const naturalEnamelMat = new THREE.MeshPhysicalMaterial({
      color: 0xfaf9f5,
      emissive: 0x052e33,
      emissiveIntensity: 0.04,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
      transmission: 0.12,
      thickness: 0.7
    });

    const goldCrownMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xca8a04,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.75
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.25
    });

    const rootMat = new THREE.MeshStandardMaterial({
      color: 0xf5ebd5,
      roughness: 0.45
    });

    const gingivaGumMat = new THREE.MeshStandardMaterial({
      color: 0xe07a8b,
      roughness: 0.4,
      metalness: 0.02
    });

    // ── 4. Construct Real Maxillary & Mandibular Arches ──
    const jawGroup = new THREE.Group();
    jawGroupRef.current = jawGroup;
    scene.add(jawGroup);

    const toothMeshes = new Map();
    toothMeshesRef.current = toothMeshes;

    const buildArch = (teethList, isUpper) => {
      const archGroup = new THREE.Group();
      const count = teethList.length; // 16 teeth per arch

      // Parabolic Arch Curve equation
      for (let i = 0; i < count; i++) {
        const toothId = teethList[i];
        const rec = records.get(toothId);

        // Position along parabolic horseshoe arch
        const t = (i / (count - 1)) * 2 - 1; // -1 to +1
        const x = t * 6.2;
        const z = -(1 - t * t) * 4.8;
        const y = isUpper ? 1.4 : -1.4;

        const toothNode = new THREE.Group();
        toothNode.position.set(x, y, z);

        // Angle tooth normal to the arch curve
        const angle = Math.atan2(x * 0.8, -z + 5.5);
        toothNode.rotation.y = angle;

        // Condition checks
        const code = rec?.conditionCode || '';
        const isCrown = code === 'crown';
        const isImplant = code === 'implant';
        const isMissing = code === 'missing' || code === 'extraction_required';
        const isSelected = selectedTooth === toothId;

        if (!isMissing) {
          // Crown Mesh
          const posNum = Number(toothId[1]);
          const isMolar = posNum >= 6;
          const isPre = posNum === 4 || posNum === 5;
          const isCanine = posNum === 3;

          let crownGeo;
          if (isMolar) {
            crownGeo = new THREE.CylinderGeometry(0.72, 0.6, 0.9, 14);
          } else if (isPre) {
            crownGeo = new THREE.CylinderGeometry(0.55, 0.45, 0.85, 12);
          } else if (isCanine) {
            crownGeo = new THREE.ConeGeometry(0.48, 1.0, 10);
          } else {
            crownGeo = new THREE.BoxGeometry(0.68, 0.88, 0.4, 4, 4, 4);
          }

          let mat = naturalEnamelMat;
          if (isCrown) mat = goldCrownMat;
          if (isImplant) mat = titaniumMat;

          const crownMesh = new THREE.Mesh(crownGeo, mat);
          crownMesh.castShadow = true;
          crownMesh.userData = { toothId, isUpper };
          toothNode.add(crownMesh);

          // Root Cone pointing into gum
          const rootGeo = new THREE.ConeGeometry(isMolar ? 0.35 : 0.25, 1.4, 8);
          const rootMesh = new THREE.Mesh(rootGeo, isImplant ? titaniumMat : rootMat);
          rootMesh.position.y = isUpper ? 1.0 : -1.0;
          if (isUpper) rootMesh.rotation.x = 0;
          else rootMesh.rotation.x = Math.PI;
          toothNode.add(rootMesh);

          // Highlight halo if selected
          if (isSelected) {
            const haloGeo = new THREE.TorusGeometry(0.85, 0.08, 8, 16);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0x00d1dc });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2;
            toothNode.add(halo);
          }

          toothMeshes.set(toothId, crownMesh);
        } else {
          // Missing Tooth: subtle dashed outline / ghost
          const ghostGeo = new THREE.BoxGeometry(0.6, 0.7, 0.4);
          const ghostMat = new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true, transparent: true, opacity: 0.35 });
          const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
          ghostMesh.userData = { toothId, isUpper };
          toothNode.add(ghostMesh);
          toothMeshes.set(toothId, ghostMesh);
        }

        archGroup.add(toothNode);
      }

      // Smooth Pink Gingiva / Gum Arch Ribbon
      const gumCurvePoints = [];
      for (let i = 0; i <= 30; i++) {
        const t = (i / 30) * 2 - 1;
        gumCurvePoints.push(new THREE.Vector3(t * 6.3, isUpper ? 2.1 : -2.1, -(1 - t * t) * 4.9));
      }
      const gumCurve = new THREE.CatmullRomCurve3(gumCurvePoints);
      const gumGeo = new THREE.TubeGeometry(gumCurve, 32, 0.65, 8, false);
      const gumMesh = new THREE.Mesh(gumGeo, gingivaGumMat);
      archGroup.add(gumMesh);

      return archGroup;
    };

    const upperArch = buildArch(UPPER_TEETH, true);
    const lowerArch = buildArch(LOWER_TEETH, false);
    jawGroup.add(upperArch);
    jawGroup.add(lowerArch);

    // Initial slight natural tilt
    jawGroup.rotation.x = 0.25;

    // ── 5. Mouse & Touch Drag 360° Orbit Controls ──
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

      // Raycasting for Tooth Hover
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const interactiveObjects = Array.from(toothMeshes.values());
      const intersects = raycaster.intersectObjects(interactiveObjects, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.toothId) {
          setHoveredTooth(hit.userData.toothId);
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

      const interactiveObjects = Array.from(toothMeshes.values());
      const intersects = raycaster.intersectObjects(interactiveObjects, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData?.toothId && onSelectTooth) {
          onSelectTooth(hit.userData.toothId);
        }
      }
    };

    // Zoom on wheel
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(8, Math.min(24, camera.position.z + e.deltaY * 0.015));
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
      if (isAutoRotating && !isDragging) {
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
  }, [selectedTooth, records, onSelectTooth, isAutoRotating]);

  // View angle preset controls
  const handlePresetChange = (preset) => {
    setViewPreset(preset);
    if (!jawGroupRef.current || !cameraRef.current) return;

    if (preset === 'full') {
      jawGroupRef.current.rotation.set(0.25, 0, 0);
      cameraRef.current.position.set(0, 5, 16);
    } else if (preset === 'upper') {
      jawGroupRef.current.rotation.set(-0.7, 0, 0); // tilted to view upper arch
      cameraRef.current.position.set(0, 8, 14);
    } else if (preset === 'lower') {
      jawGroupRef.current.rotation.set(0.9, 0, 0); // tilted to view lower arch
      cameraRef.current.position.set(0, -6, 14);
    } else if (preset === 'occlusal') {
      jawGroupRef.current.rotation.set(1.5, 0, 0); // top-down occlusal plane
      cameraRef.current.position.set(0, 14, 2);
    }
    cameraRef.current.lookAt(0, 0, 0);
  };

  return (
    <div className="relative rounded-3xl border border-teal-500/30 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-4 text-white shadow-2xl overflow-hidden select-none">
      {/* ── Top 3D Control Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-[#00d1dc]">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wide text-white">
                Ultra-Realistic 3D Interactive Dental Arch
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30">
                WebGL 360° Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Drag anywhere to rotate 360° · Scroll wheel / pinch to zoom · Click any tooth in 3D to inspect
            </p>
          </div>
        </div>

        {/* View Angle Preset Pills */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          <button
            type="button"
            onClick={() => handlePresetChange('full')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              viewPreset === 'full'
                ? 'bg-[#009da6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Full Mouth 3D
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('upper')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              viewPreset === 'upper'
                ? 'bg-[#009da6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upper Arch
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('lower')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              viewPreset === 'lower'
                ? 'bg-[#009da6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lower Arch
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('occlusal')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              viewPreset === 'occlusal'
                ? 'bg-[#009da6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Occlusal (Bite)
          </button>
        </div>
      </div>

      {/* ── 3D Canvas Mounting Container ── */}
      <div
        ref={mountRef}
        className="w-full h-80 sm:h-96 flex items-center justify-center cursor-grab active:cursor-grabbing"
      />

      {/* ── Bottom Status Strip ── */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 px-2 text-xs">
        <div className="flex items-center gap-2">
          {hoveredTooth ? (
            <span className="flex items-center gap-1.5 text-teal-300 font-black">
              <span>Tooth #{hoveredTooth}</span>
              <span className="text-slate-400 font-normal">· Click to select for charting</span>
            </span>
          ) : selectedTooth ? (
            <span className="text-emerald-400 font-bold">
              Active Selection: Tooth #{selectedTooth}
            </span>
          ) : (
            <span className="text-slate-500">
              Hover or click any 3D tooth to select
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
              isAutoRotating ? 'bg-teal-500/20 text-[#00d1dc]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAutoRotating ? 'Auto-Orbit: ON' : 'Auto-Orbit: OFF'}
          </button>

          <button
            type="button"
            onClick={() => handlePresetChange('full')}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Camera</span>
          </button>
        </div>
      </div>
    </div>
  );
}