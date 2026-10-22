import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AssistantState } from "../types";
import { SentimentTheme, THEME_PALETTES } from "../utils/themeEngine";

interface ThreeOrbProps {
  state: AssistantState;
  audioLevel: number; // 0.0 to 1.0 real-time audio amplitude
  quality?: "ultra" | "balanced" | "minimal";
  onClick?: () => void;
  sentiment?: SentimentTheme;
}

// Reusable math objects allocated once to prevent Garbage Collection in the render loop
const _targetColorA = new THREE.Color();
const _targetColorB = new THREE.Color();
const _targetColorRim = new THREE.Color();

// Procedural 3D Simplex-Style GLSL Noise with harmonic octaves
const vertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uDisplacement;
  uniform float uSpeed;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying vec3 vWorldNormal;

  // Classic 3D Simplex noise implementation
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    // Harmonic noise octaves modulated by state speed and audio level
    float t = uTime * uSpeed;
    float n1 = snoise(position * 1.2 + vec3(t * 0.35, t * 0.25, t * 0.45));
    float n2 = snoise(position * 2.4 - vec3(t * 0.55, t * 0.35, t * 0.2)) * 0.5;
    float n3 = snoise(position * 4.2 + vec3(t * 0.8, t * 0.4, t * 0.6)) * 0.25;
    float totalNoise = n1 + n2 + n3;

    float displacement = totalNoise * (uDisplacement + uAudioLevel * 0.58);
    vDisplacement = displacement;

    vec3 newPosition = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fluid Iridescent Fresnel GLSL Fragment Shader with Chromatic Edge Halo
const fragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorRim;
  uniform float uFresnelBias;
  uniform float uFresnelScale;
  uniform float uFresnelPower;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  varying vec3 vWorldNormal;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = uFresnelBias + uFresnelScale * pow(1.0 + dot(viewDir, vNormal), uFresnelPower);
    fresnel = clamp(fresnel, 0.0, 1.0);

    // Dynamic color gradient shifting with displacement and surface curvature
    float mixFactor = clamp((vDisplacement + 0.36) * 1.5, 0.0, 1.0);
    vec3 baseColor = mix(uColorA, uColorB, mixFactor);

    // Luminous inner core glow + high-frequency rim halo
    vec3 finalColor = mix(baseColor, uColorRim, fresnel);

    // Subtle internal specular highlight
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float spec = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 16.0) * 0.35;
    finalColor += uColorRim * spec;

    float alpha = clamp(0.82 + fresnel * 0.28, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const ThreeOrb: React.FC<ThreeOrbProps> = ({
  state,
  audioLevel,
  quality = "ultra",
  onClick,
  sentiment = "neutral",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const innerAuraRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const coreGroupRef = useRef<THREE.Group | null>(null);
  const [hasWebGLError, setHasWebGLError] = useState(false);

  // Critical: Keep latest state, audio, and sentiment in refs to solve stale closure inside animate()
  const stateRef = useRef<AssistantState>(state);
  const audioLevelRef = useRef<number>(audioLevel);
  const sentimentRef = useRef<SentimentTheme>(sentiment);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    sentimentRef.current = sentiment;
  }, [sentiment]);

  // Smooth interpolated animated values
  const currentAudioRef = useRef(0);
  const currentScaleRef = useRef(1);

  // Check reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!mountRef.current || quality === "minimal") return;

    const container = mountRef.current;
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 340;

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;

    try {
      // 1. Scene & Camera setup
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.6);

      // 2. High-Fidelity WebGL Renderer
      const isHeadless =
        navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
      renderer = new THREE.WebGLRenderer({
        antialias: quality === "ultra" && !isHeadless,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("WebGL initialization failed, falling back to 2D canvas:", e);
      setHasWebGLError(true);
      return;
    }

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    coreGroupRef.current = mainGroup;

    // 3. Multi-Layer Luminous Core Sphere with Noise Displacement
    const segs = quality === "ultra" ? 64 : 40;
    const coreGeometry = new THREE.SphereGeometry(1.22, segs, segs);

    const coreMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uDisplacement: { value: 0.12 },
        uSpeed: { value: prefersReducedMotion ? 0.3 : 0.8 },
        uColorA: { value: new THREE.Color(0x06b6d4) }, // Cyan
        uColorB: { value: new THREE.Color(0x8b5cf6) }, // Violet
        uColorRim: { value: new THREE.Color(0x38bdf8) }, // Electric blue rim
        uFresnelBias: { value: 0.08 },
        uFresnelScale: { value: 1.45 },
        uFresnelPower: { value: 2.2 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materialRef.current = coreMaterial;

    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    mainGroup.add(coreMesh);

    // 4. Secondary Translucent Energy Shell (Layered Depth)
    const innerAuraGeo = new THREE.SphereGeometry(1.34, 32, 32);
    const innerAuraMat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      wireframe: false,
      depthWrite: false,
    });
    const innerAuraMesh = new THREE.Mesh(innerAuraGeo, innerAuraMat);
    mainGroup.add(innerAuraMesh);
    innerAuraRef.current = innerAuraMesh;

    // 5. Outer Translucent Atmospheric Corona Shell
    const auraGeometry = new THREE.SphereGeometry(1.48, 32, 32);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      wireframe: false,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    mainGroup.add(auraMesh);
    atmosphereRef.current = auraMesh;

    // 6. Orbiting Luminous Stardust Particles Field
    const particleCount = quality === "ultra" && !prefersReducedMotion ? 120 : 50;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.55 + Math.random() * 0.95;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      posArray[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      posArray[i * 3 + 2] = radius * Math.cos(phi);
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.038,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particles);
    particlesRef.current = particles;

    // 7. Ground Volumetric Contact Glow Disk
    const glowGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gctx = glowCanvas.getContext("2d");
    if (gctx) {
      const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(6, 182, 212, 0.5)");
      grad.addColorStop(0.45, "rgba(139, 92, 246, 0.2)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 128, 128);
    }

    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const groundGlow = new THREE.Mesh(glowGeo, glowMat);
    groundGlow.position.y = -1.8;
    groundGlow.rotation.x = -Math.PI / 2;
    scene.add(groundGlow);

    // 8. Subtle Studio Ambient Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x030712, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.PointLight(0xa855f7, 1.4, 8);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x06b6d4, 1.6, 8);
    rimLight.position.set(-2, -1, 3);
    scene.add(rimLight);

    // Pre-warm and compile shaders
    renderer.compile(scene, camera);

    // 9. Continuous Render Loop with Real State Inspection
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Read real-time values from refs (avoids stale closures)
      const currentState = stateRef.current;
      const targetAudio = audioLevelRef.current;

      // Exponential damping for audio reactivity
      currentAudioRef.current = THREE.MathUtils.damp(
        currentAudioRef.current,
        targetAudio,
        8.0,
        delta
      );

      const audio = currentAudioRef.current;

      // Update shader uniforms based on state
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time;
        materialRef.current.uniforms.uAudioLevel.value = audio;

        // Dynamic State Transitions
        let targetSpeed = 0.8;
        let targetDisp = 0.12;
        let targetScale = 1.0;
        let auraColorHex = 0x06b6d4;

        switch (currentState) {
          case "listening":
            // Vibrant Emerald / Cyan ripples reactive to live mic volume
            _targetColorA.setHex(0x10b981); // Emerald
            _targetColorB.setHex(0x06b6d4); // Cyan
            _targetColorRim.setHex(0x34d399); // Mint rim
            targetSpeed = 1.4;
            targetDisp = 0.22 + audio * 0.48;
            targetScale = 1.08 + audio * 0.18;
            auraColorHex = 0x10b981;
            break;

          case "speaking":
            // Sentiment-Driven Harmonics: Warm Gold (positive), Cool Violet (intellectual), Calm Blue (neutral)
            {
              const sent = sentimentRef.current;
              if (sent === "positive") {
                _targetColorA.setHex(0xf59e0b); // Amber gold
                _targetColorB.setHex(0xeab308); // Sun gold
                _targetColorRim.setHex(0xfef08a); // Warm gold rim
                auraColorHex = 0xf59e0b;
              } else if (sent === "intellectual") {
                _targetColorA.setHex(0x7c3aed); // Cool violet
                _targetColorB.setHex(0xa855f7); // Purple
                _targetColorRim.setHex(0xc084fc); // Lavender rim
                auraColorHex = 0x7c3aed;
              } else {
                _targetColorA.setHex(0x0284c7); // Calm sky blue
                _targetColorB.setHex(0x0ea5e9); // Azure ocean
                _targetColorRim.setHex(0x38bdf8); // Electric blue rim
                auraColorHex = 0x0284c7;
              }
            }
            targetSpeed = 1.7;
            targetDisp = 0.26 + audio * 0.54;
            targetScale = 1.12 + audio * 0.2;
            break;

          case "thinking":
            // Deep iridescent Violet / Purple fluid swirling
            _targetColorA.setHex(0x8b5cf6); // Purple
            _targetColorB.setHex(0xc084fc); // Lavender
            _targetColorRim.setHex(0xe879f9); // Pink rim
            targetSpeed = 2.4;
            targetDisp = 0.32;
            targetScale = 1.02 + Math.sin(time * 4.5) * 0.05;
            auraColorHex = 0xa855f7;
            break;

          case "connecting":
            _targetColorA.setHex(0x0284c7); // Sky blue
            _targetColorB.setHex(0x38bdf8);
            _targetColorRim.setHex(0x7dd3fc);
            targetSpeed = 1.6;
            targetDisp = 0.16;
            targetScale = 0.96;
            auraColorHex = 0x0284c7;
            break;

          case "interrupted":
            // Rose shockwave
            _targetColorA.setHex(0xf43f5e);
            _targetColorB.setHex(0xfb7185);
            _targetColorRim.setHex(0xffa1ad);
            targetSpeed = 3.0;
            targetDisp = 0.38;
            targetScale = 0.93;
            auraColorHex = 0xf43f5e;
            break;

          case "error":
            // Restrained crimson pulse
            _targetColorA.setHex(0xef4444);
            _targetColorB.setHex(0x991b1b);
            _targetColorRim.setHex(0xf87171);
            targetSpeed = 0.5;
            targetDisp = 0.09;
            targetScale = 0.94;
            auraColorHex = 0xef4444;
            break;

          case "idle":
          default:
            // Sentiment-Driven Ambient Idle Breathing
            {
              const sent = sentimentRef.current;
              if (sent === "positive") {
                _targetColorA.setHex(0xd97706); // Warm amber
                _targetColorB.setHex(0xf59e0b); // Gold
                _targetColorRim.setHex(0xfde047); // Sun glow
                auraColorHex = 0xf59e0b;
              } else if (sent === "intellectual") {
                _targetColorA.setHex(0x6d28d9); // Deep violet
                _targetColorB.setHex(0x8b5cf6); // Cool purple
                _targetColorRim.setHex(0xa78bfa); // Lavender
                auraColorHex = 0x8b5cf6;
              } else {
                _targetColorA.setHex(0x06b6d4); // Cyan
                _targetColorB.setHex(0x0284c7); // Calm blue
                _targetColorRim.setHex(0x38bdf8); // Sky blue
                auraColorHex = 0x06b6d4;
              }
            }
            targetSpeed = prefersReducedMotion ? 0.3 : 0.7;
            targetDisp = 0.12;
            targetScale = 1.0 + Math.sin(time * 1.5) * 0.038;
            break;
        }

        // Color damping
        materialRef.current.uniforms.uColorA.value.lerp(_targetColorA, delta * 4.0);
        materialRef.current.uniforms.uColorB.value.lerp(_targetColorB, delta * 4.0);
        materialRef.current.uniforms.uColorRim.value.lerp(_targetColorRim, delta * 4.0);

        materialRef.current.uniforms.uSpeed.value = THREE.MathUtils.damp(
          materialRef.current.uniforms.uSpeed.value,
          targetSpeed,
          4.0,
          delta
        );
        materialRef.current.uniforms.uDisplacement.value = THREE.MathUtils.damp(
          materialRef.current.uniforms.uDisplacement.value,
          targetDisp,
          5.0,
          delta
        );

        currentScaleRef.current = THREE.MathUtils.damp(
          currentScaleRef.current,
          targetScale,
          6.0,
          delta
        );

        // Update atmosphere shell color dynamically
        if (atmosphereRef.current) {
          const mat = atmosphereRef.current.material as THREE.MeshBasicMaterial;
          mat.color.lerp(new THREE.Color(auraColorHex), delta * 3.0);
        }
      }

      // Smooth orbital rotation and gentle levitation
      if (mainGroup) {
        mainGroup.scale.setScalar(currentScaleRef.current);
        if (!prefersReducedMotion) {
          mainGroup.rotation.y = time * 0.18;
          mainGroup.rotation.x = Math.sin(time * 0.3) * 0.08;
          mainGroup.position.y = Math.sin(time * 1.2) * 0.08;
        }
      }

      // Orbiting particles rotation & speed
      if (particlesRef.current && !prefersReducedMotion) {
        const particleSpeedMult = currentState === "thinking" ? 2.5 : 1.0;
        particlesRef.current.rotation.y = -time * 0.12 * particleSpeedMult;
        particlesRef.current.rotation.z = time * 0.06 * particleSpeedMult;
      }

      // Atmosphere aura expansion with audio
      if (atmosphereRef.current) {
        const auraScale = 1.0 + audio * 0.16;
        atmosphereRef.current.scale.setScalar(auraScale);
      }

      if (innerAuraRef.current) {
        const innerScale = 1.0 + audio * 0.1;
        innerAuraRef.current.scale.setScalar(innerScale);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize Observer
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth || 340;
      const h = container.clientHeight || 340;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // 11. Clean Resource Disposal on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerAuraGeo.dispose();
      innerAuraMat.dispose();
      auraGeometry.dispose();
      auraMaterial.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      glowTex.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [quality]);

  // Fallback for WebGL errors or Minimal Quality mode
  if (quality === "minimal" || hasWebGLError) {
    const getStateColorClass = () => {
      switch (state) {
        case "listening":
          return "from-emerald-500 to-cyan-500";
        case "speaking":
          if (sentiment === "positive") return "from-amber-400 via-yellow-500 to-amber-600";
          if (sentiment === "intellectual") return "from-violet-600 via-purple-500 to-indigo-600";
          return "from-sky-500 via-cyan-400 to-blue-600";
        case "thinking":
          return "from-purple-600 to-violet-400";
        case "error":
          return "from-rose-600 to-red-500";
        case "connecting":
          return "from-sky-500 to-cyan-400";
        case "idle":
        default:
          if (sentiment === "positive") return "from-amber-500/80 via-yellow-600/70 to-slate-900";
          if (sentiment === "intellectual") return "from-violet-600/80 via-purple-600/70 to-slate-900";
          return "from-cyan-500 via-sky-500 to-blue-700";
      }
    };

    return (
      <div
        onClick={onClick}
        className="w-64 h-64 sm:w-80 sm:h-80 rounded-full relative flex items-center justify-center cursor-pointer select-none transition-transform duration-300 hover:scale-102 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        role="button"
        tabIndex={0}
        aria-label="Interactive voice assistant orb"
      >
        <div
          className={`w-48 h-48 sm:w-60 sm:h-60 rounded-full blur-3xl opacity-50 absolute transition-all duration-500 bg-gradient-to-tr ${getStateColorClass()}`}
          style={{ transform: `scale(${1 + audioLevel * 0.4})` }}
        />
        <div
          className={`w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-white/20 shadow-2xl flex items-center justify-center backdrop-blur-xl relative z-10 transition-colors duration-500 bg-gradient-to-tr ${getStateColorClass()}`}
        >
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center">
            <span className="text-white text-[11px] font-mono tracking-widest uppercase font-semibold">
              {state}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
      className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-full transition-transform duration-300 active:scale-98"
      title="Click or tap to interact with S.A.M."
      aria-label="S.A.M. 3D interactive voice orb"
    >
      {/* Isolated mount container for Three.js WebGL canvas */}
      <div ref={mountRef} className="w-full h-full pointer-events-none" />
    </div>
  );
};
