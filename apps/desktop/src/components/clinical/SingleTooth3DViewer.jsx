import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Sparkles, Eye } from 'lucide-react';

export default function SingleTooth3DViewer({
  toothNumber = '14',
  conditionCode = '',
  conditionLabel = '',
  dentition = 'permanent',
  size = 260
}) {
  const mountRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const num = Number(toothNumber) || 14;
  const pos = Number(String(num)[1]) || 4;
  const isMolar = pos >= 6;
  const isPremolar = pos === 4 || pos === 5;
  const isCanine = pos === 3;
  const isIncisor = pos <= 2;

  const isCrown = conditionCode === 'crown' || conditionLabel?.toLowerCase().includes('crown');
  const isRct = conditionCode === 'rct' || conditionLabel?.toLowerCase().includes('root canal') || conditionLabel?.toLowerCase().includes('rct');
  const isImplant = conditionCode === 'implant' || conditionLabel?.toLowerCase().includes('implant');
  const isCaries = conditionCode === 'caries' || conditionLabel?.toLowerCase().includes('caries') || conditionLabel?.toLowerCase().includes('decay');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── 1. Scene & Camera Setup ──
    const scene = new THREE.Scene();
    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ── 2. Studio Lighting (Clinical Operatory Quality) ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.2);
    mainLight.position.set(4, 8, 5);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xccfbf1, 1.2);
    fillLight.position.set(-5, -2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(0, -6, -4);
    scene.add(rimLight);

    // ── 3. Realistic Materials ──
    // Natural Pearl Dental Enamel
    const enamelMaterial = new THREE.MeshPhysicalMaterial({
      color: isCrown ? 0xfef08a : 0xfcfbf7,
      emissive: isCrown ? 0x854d0e : 0x0a1f24,
      emissiveIntensity: isCrown ? 0.2 : 0.04,
      roughness: isCrown ? 0.22 : 0.18,
      metalness: isCrown ? 0.75 : 0.04,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
      transmission: isCrown ? 0 : 0.15, // realistic tooth translucency
      thickness: 0.8
    });

    const rootDentinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5eedc,
      roughness: 0.45,
      metalness: 0.02
    });

    const titaniumMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.25
    });

    const rctGuttaPerchaMaterial = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });

    const cariesMaterial = new THREE.MeshStandardMaterial({
      color: 0x271406,
      roughness: 0.9,
      metalness: 0.0
    });

    // ── 4. Anatomical 3D Tooth Geometry Construction ──
    const toothGroup = new THREE.Group();

    // Crown Mesh (Morphs based on tooth kind)
    let crownGeo;
    if (isMolar) {
      crownGeo = new THREE.CylinderGeometry(1.05, 0.85, 1.25, 16, 4);
    } else if (isPremolar) {
      crownGeo = new THREE.CylinderGeometry(0.85, 0.7, 1.2, 14, 4);
    } else if (isCanine) {
      crownGeo = new THREE.ConeGeometry(0.8, 1.4, 12);
    } else {
      // Incisor chisel crown
      crownGeo = new THREE.BoxGeometry(1.1, 1.35, 0.65, 4, 4, 4);
    }

    const crownMesh = new THREE.Mesh(crownGeo, enamelMaterial);
    crownMesh.position.y = 0.5;
    crownMesh.castShadow = true;
    toothGroup.add(crownMesh);

    // Occlusal Surface Fissures / Cusp Sculpt
    if (isMolar || isPremolar) {
      const cuspCount = isMolar ? 4 : 2;
      for (let i = 0; i < cuspCount; i++) {
        const cuspGeo = new THREE.SphereGeometry(isMolar ? 0.32 : 0.28, 8, 8);
        const cuspMesh = new THREE.Mesh(cuspGeo, enamelMaterial);
        const angle = (i / cuspCount) * Math.PI * 2;
        const rad = isMolar ? 0.45 : 0.35;
        cuspMesh.position.set(Math.cos(angle) * rad, 1.15, Math.sin(angle) * rad);
        cuspMesh.scale.set(1, 0.6, 1);
        toothGroup.add(cuspMesh);
      }
    }

    // Caries Decay Cavity Hole (If present)
    if (isCaries) {
      const decayGeo = new THREE.SphereGeometry(0.28, 8, 8);
      const decayMesh = new THREE.Mesh(decayGeo, cariesMaterial);
      decayMesh.position.set(0.2, 1.12, 0.15);
      decayMesh.scale.set(1.4, 0.5, 1.2);
      toothGroup.add(decayMesh);
    }

    // Roots Construction (Anatomical bifurcation/trifurcation)
    if (!isImplant) {
      const rootCount = isMolar ? (num < 30 ? 3 : 2) : 1;
      for (let r = 0; r < rootCount; r++) {
        const rootLength = 1.9;
        const rootGeo = new THREE.ConeGeometry(0.35, rootLength, 12);
        const rootMesh = new THREE.Mesh(rootGeo, rootDentinMaterial);
        const offsetAngle = (r / rootCount) * Math.PI * 2;
        const spread = rootCount > 1 ? 0.38 : 0;
        rootMesh.position.set(Math.cos(offsetAngle) * spread, -0.85, Math.sin(offsetAngle) * spread);
        rootMesh.rotation.x = Math.PI; // points downward
        rootMesh.rotation.z = Math.sin(offsetAngle) * 0.12;
        toothGroup.add(rootMesh);

        // Illuminated RCT Root Canal Core
        if (isRct) {
          const canalGeo = new THREE.CylinderGeometry(0.06, 0.04, rootLength * 0.85, 8);
          const canalMesh = new THREE.Mesh(canalGeo, rctGuttaPerchaMaterial);
          canalMesh.position.copy(rootMesh.position);
          canalMesh.rotation.copy(rootMesh.rotation);
          toothGroup.add(canalMesh);
        }
      }
    } else {
      // Titanium Implant Screw Post
      const implantGroup = new THREE.Group();
      const screwBodyGeo = new THREE.CylinderGeometry(0.42, 0.28, 2.1, 16);
      const screwBody = new THREE.Mesh(screwBodyGeo, titaniumMaterial);
      implantGroup.add(screwBody);

      // Thread Ridges
      for (let t = -0.8; t < 0.9; t += 0.24) {
        const threadGeo = new THREE.TorusGeometry(0.44, 0.04, 8, 16);
        const threadMesh = new THREE.Mesh(threadGeo, titaniumMaterial);
        threadMesh.position.y = t;
        threadMesh.rotation.x = Math.PI / 2;
        implantGroup.add(threadMesh);
      }

      implantGroup.position.y = -0.9;
      toothGroup.add(implantGroup);
    }

    // Subtle natural tilt
    toothGroup.rotation.x = 0.15;
    scene.add(toothGroup);

    // ── 5. Mouse & Touch Drag Rotation ──
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      toothGroup.rotation.y += deltaX * 0.018;
      toothGroup.rotation.x += deltaY * 0.015;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Touch events for iPad / tablets
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
      toothGroup.rotation.y += deltaX * 0.02;
      toothGroup.rotation.x += deltaY * 0.018;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart);
    dom.addEventListener('touchmove', onTouchMove);
    dom.addEventListener('touchend', onMouseUp);

    // ── 6. Animation Loop ──
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDragging) {
        toothGroup.rotation.y += 0.009;
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
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onMouseUp);
      renderer.dispose();
      if (container.contains(dom)) container.removeChild(dom);
    };
  }, [toothNumber, conditionCode, conditionLabel, dentition, isMolar, isPremolar, isCanine, isIncisor, isCrown, isRct, isImplant, isCaries, autoRotate]);

  return (
    <div className="relative rounded-2xl border border-teal-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-inner overflow-hidden select-none">
      <div className="flex items-center justify-between px-2 pt-1 pb-1">
        <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-300">
          <Sparkles size={13} className="text-[#00d1dc]" />
          <span>Real 3D Tooth Anatomy · #{toothNumber}</span>
        </span>
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
            autoRotate
              ? 'bg-[#009da6] text-white shadow-2xs'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {autoRotate ? 'Auto Orbit ON' : 'Paused (Drag to Turn)'}
        </button>
      </div>

      <div
        ref={mountRef}
        className="w-full h-56 cursor-grab active:cursor-grabbing flex items-center justify-center"
      />

      <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-semibold text-slate-400 border-t border-slate-800/80 pt-1.5">
        <span>👆 Drag 360° to inspect cusps &amp; roots</span>
        <span className="text-teal-400 font-mono">
          {isCrown ? '👑 Zirconia Crown' : isImplant ? '🔩 Titanium Post' : isRct ? '⚡ Endodontic RCT' : isCaries ? '🕳️ Caries Cavity' : 'Natural Pearl Enamel'}
        </span>
      </div>
    </div>
  );
}