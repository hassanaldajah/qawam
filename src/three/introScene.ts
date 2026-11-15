// Cinematic intro: the logo runner sprinting in place, neon rim, ground glow, leaf swoosh,
// speed lines; then it dissolves into sparks that converge where the wordmark appears.
import * as THREE from "three";
import { createRunner } from "./Runner";

export const INTRO_MS = 3800;
export interface IntroCtl { stop(): void }
export interface IntroHooks { onWord(): void; onOut(): void; onDone(): void }

const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;

export function startIntro(canvas: HTMLCanvasElement, hooks: IntroHooks, frozenAt?: number): IntroCtl {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x070c18, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070c18, 6, 13);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 46 : 34; camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener("resize", resize);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  const runner = createRunner();
  scene.add(runner.group);

  // Ground glow ring
  const groundMat = keep(new THREE.ShaderMaterial({
    ...ADD, uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uA: { value: new THREE.Color("#2CC6DA") }, uB: { value: new THREE.Color("#8BE04E") } },
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform float uT; uniform float uFade; uniform vec3 uA; uniform vec3 uB; varying vec2 vU;
      void main(){ vec2 p = vU-.5; float d = length(p)*2.0; float a = atan(p.y,p.x);
        float ring = smoothstep(.06,.0,abs(d-.62)) * (.6+.4*sin(a*3.0+uT*4.0));
        float pool = smoothstep(.75,.0,d)*.35;
        vec3 c = mix(uA,uB,.5+.5*sin(a+uT)); gl_FragColor = vec4(c*(ring+pool)*uFade, (ring+pool)*uFade); }`,
  }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(4.2, 4.2)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.01; scene.add(ground);

  // Leaf swoosh arcs (the logo's leaf curve) orbiting the runner
  const swooshMat = (c: string) => keep(new THREE.MeshBasicMaterial({ ...ADD, color: new THREE.Color(c), opacity: 0.9 }));
  const arcA = new THREE.Mesh(keep(new THREE.TorusGeometry(1.25, 0.022, 8, 140, Math.PI * 1.25)), swooshMat("#2CC6DA"));
  const arcB = new THREE.Mesh(keep(new THREE.TorusGeometry(1.05, 0.016, 8, 140, Math.PI * 0.95)), swooshMat("#8BE04E"));
  const swoosh = new THREE.Group(); swoosh.add(arcA, arcB); swoosh.position.y = 1.05; swoosh.rotation.x = 1.25; scene.add(swoosh);

  // Speed lines streaming past
  const N = 110;
  const linePos = new Float32Array(N * 6), lineCol = new Float32Array(N * 6), seeds: { y: number; z: number; x: number; len: number; v: number }[] = [];
  const cA = new THREE.Color("#2CC6DA"), cB = new THREE.Color("#8BE04E");
  for (let i = 0; i < N; i++) {
    seeds.push({ x: Math.random() * 12 - 6, y: 0.05 + Math.random() * 2.4, z: -2.6 + Math.random() * 4.2, len: 0.3 + Math.random() * 0.9, v: 0.6 + Math.random() * 0.8 });
    const c = i % 3 === 0 ? cB : cA;
    lineCol.set([c.r, c.g, c.b, 0, 0, 0], i * 6);
  }
  const lineGeo = keep(new THREE.BufferGeometry());
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lineMat = keep(new THREE.LineBasicMaterial({ ...ADD, vertexColors: true, opacity: 0.85 }));
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // Dissolve sparks
  const P = 700;
  const sp = new Float32Array(P * 3), start = new Float32Array(P * 3), pc = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const y = 0.1 + Math.random() * 1.75, r = 0.12 + Math.random() * 0.22, a = Math.random() * Math.PI * 2;
    start.set([Math.cos(a) * r * 0.8, y, Math.sin(a) * r * 0.5], i * 3);
    const c = Math.random() < 0.6 ? cA : cB; pc.set([c.r, c.g, c.b], i * 3);
  }
  const sparkGeo = keep(new THREE.BufferGeometry());
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(pc, 3));
  const dotCv = document.createElement("canvas"); dotCv.width = dotCv.height = 32;
  const g2 = dotCv.getContext("2d");
  if (g2) { const gr = g2.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g2.fillStyle = gr; g2.fillRect(0, 0, 32, 32); }
  const dotTex = keep(new THREE.CanvasTexture(dotCv));
  const sparkMat = keep(new THREE.PointsMaterial({ ...ADD, map: dotTex, size: 0.07, vertexColors: true, opacity: 0, sizeAttenuation: true }));
  scene.add(new THREE.Points(sparkGeo, sparkMat));

  const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const target = new THREE.Vector3(0, 1.05, 0);
  let fired = { word: false, out: false, done: false };

  const frame = (t: number) => {
    const ms = t * 1000;
    const speed = 1 + ease((t - 1.2) / 1.2) * 1.5;
    runner.update(t, speed);
    const dis = ease((t - 2.2) / 0.8);
    runner.setDissolve(dis);
    runner.setOpacity(ease(t / 0.35));
    groundMat.uniforms.uT!.value = t;
    swoosh.rotation.z = t * (0.8 + speed * 0.5);
    arcB.rotation.z = -t * 1.3;
    swoosh.scale.setScalar(1 + dis * 0.6);
    (arcA.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - dis);
    (arcB.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - dis);
    groundMat.uniforms.uFade!.value = 1 - dis;
    // camera: slow orbit + push-in
    const fit = 2.5 / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect); // keep runner + swoosh inside narrow (portrait) screens
    const ang = 0.55 - t * 0.22, rad = Math.max(4.9, fit) * (1 - ease(t / 3) * 0.17);
    camera.position.set(Math.sin(ang) * rad, 1.25 + Math.sin(t * 0.8) * 0.06, Math.cos(ang) * rad);
    camera.lookAt(target);
    // speed lines (stream toward -x)
    for (let i = 0; i < N; i++) {
      const s = seeds[i]!;
      const x = ((s.x - t * s.v * speed * 5.5) % 12 + 12) % 12 - 6;
      const len = s.len * (0.6 + speed * 0.6);
      linePos.set([x, s.y, s.z, x + len, s.y, s.z], i * 6);
    }
    lineGeo.attributes.position!.needsUpdate = true;
    lineMat.opacity = 0.85 * ease(t / 0.4) * (1 - dis);
    // sparks: burst out then converge at the wordmark center
    const k = ease((t - 2.2) / 1.1);
    sparkMat.opacity = dis > 0 ? Math.min(1, dis * 2) * (1 - ease((t - 3.0) / 0.5)) : 0;
    for (let i = 0; i < P; i++) {
      const sx = start[i * 3]!, sy = start[i * 3 + 1]!, sz = start[i * 3 + 2]!;
      const burst = Math.sin(k * Math.PI) * 0.9;
      const ox = sx * (1 + burst * 3) + Math.sin(i) * burst * 0.4;
      const oy = sy + (target.y - sy) * k + Math.cos(i * 1.7) * burst * 0.35;
      sp.set([ox * (1 - k * 0.9), oy, sz * (1 + burst * 2) * (1 - k)], i * 3);
    }
    sparkGeo.attributes.position!.needsUpdate = true;
    renderer.render(scene, camera);
    if (!fired.word && ms >= 2650) { fired.word = true; hooks.onWord(); }
    if (!fired.out && ms >= 3250) { fired.out = true; hooks.onOut(); }
    if (!fired.done && ms >= INTRO_MS) { fired.done = true; hooks.onDone(); }
  };

  let raf = 0, stopped = false, elapsed = 0, lastNow = 0;
  if (frozenAt !== undefined) {
    // Debug: deterministic still frame (simulate up to t for correct cycle phase).
    fired = { word: frozenAt * 1000 < 2650, out: true, done: true };
    for (let t = 0; t < frozenAt; t += 1 / 60) runner.update(t, 1 + ease((t - 1.2) / 1.2) * 1.5);
    if (frozenAt * 1000 >= 2650) hooks.onWord();
    const still = () => { if (stopped) return; frame(frozenAt); raf = requestAnimationFrame(still); };
    raf = requestAnimationFrame(still);
  } else {
    const loop = (now: number) => {
      if (stopped) return;
      if (lastNow) elapsed += Math.min(50, now - lastNow);
      lastNow = now;
      frame(elapsed / 1000);
      if (elapsed < INTRO_MS + 100) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(raf); lastNow = 0; }
    else if (!stopped && frozenAt === undefined && elapsed < INTRO_MS) raf = requestAnimationFrame((n) => { lastNow = n; raf = requestAnimationFrame(function l(now) { if (stopped) return; elapsed += Math.min(50, now - lastNow); lastNow = now; frame(elapsed / 1000); if (elapsed < INTRO_MS + 100) raf = requestAnimationFrame(l); }); });
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    stop() {
      stopped = true; cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      runner.dispose(); disposables.forEach((d) => d.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
