// Landing hero: three macro-colour orbits (teal protein, lime fat, coral carbs) + an athletic
// particle ring. Pauses off-screen / hidden tab, DPR capped, pointer parallax.
import * as THREE from "three";

export interface HeroCtl { stop(): void }

export function startHero(canvas: HTMLCanvasElement, dark: boolean): HeroCtl {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 7.2);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const disp: { dispose(): void }[] = [];
  const blend = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  const cols = dark ? ["#2CC6DA", "#8BE04E", "#FF7A59"] : ["#16869E", "#5DB022", "#F2674F"];
  const root = new THREE.Group(); scene.add(root);
  const orbits = cols.map((c, i) => {
    const g = new THREE.TorusGeometry(2.1 + i * 0.32, 0.018 + (2 - i) * 0.006, 8, 200, Math.PI * (1.5 - i * 0.2));
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: dark ? 0.95 : 0.8, blending: blend, depthWrite: false });
    disp.push(g, m);
    const mesh = new THREE.Mesh(g, m);
    const pivot = new THREE.Group(); pivot.rotation.set(1.1 + i * 0.35, i * 0.6, 0); pivot.add(mesh);
    // a bright "runner" bead on each orbit
    const bg = new THREE.SphereGeometry(0.075, 16, 12), bm = new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: blend });
    disp.push(bg, bm);
    const bead = new THREE.Mesh(bg, bm); bead.position.set(2.1 + i * 0.32, 0, 0); mesh.add(bead);
    root.add(pivot);
    return mesh;
  });
  // particle ring
  const N = 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cc = cols.map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.7 + (Math.random() - 0.5) * 0.9 * Math.random();
    pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.25, Math.sin(a) * r], i * 3);
    const c = cc[i % 7 === 0 ? 2 : i % 2]!; col.set([c.r, c.g, c.b], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pm = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: dark ? 0.9 : 0.65, blending: blend, depthWrite: false });
  disp.push(pg, pm);
  const ring = new THREE.Points(pg, pm); ring.rotation.x = 1.2; root.add(ring);

  let px = 0, py = 0;
  const onMove = (e: PointerEvent) => { px = (e.clientX / window.innerWidth - 0.5) * 2; py = (e.clientY / window.innerHeight - 0.5) * 2; };
  window.addEventListener("pointermove", onMove, { passive: true });

  let raf = 0, visible = true, running = false, t0 = performance.now();
  const loop = (now: number) => {
    const t = (now - t0) / 1000;
    orbits.forEach((o, i) => { o.rotation.z = t * (0.35 + i * 0.12) * (i % 2 ? -1 : 1); });
    ring.rotation.z = t * 0.08;
    root.rotation.y += ((px * 0.35) - root.rotation.y) * 0.05;
    root.rotation.x += ((py * 0.2) - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  const play = () => { if (!running && visible && !document.hidden) { running = true; raf = requestAnimationFrame(loop); } };
  const pause = () => { running = false; cancelAnimationFrame(raf); };
  const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) play(); else pause(); });
  io.observe(canvas);
  const onVis = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVis);
  renderer.render(scene, camera);
  play();

  return {
    stop() {
      pause(); io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      disp.forEach((d) => d.dispose()); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
