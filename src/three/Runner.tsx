// Procedural low-poly mannequin (the logo's runner) with a run cycle and a neon rim shader.
// Pure Three.js, no assets. Imported lazily only (keeps three out of the app bundle).
// Reusable: intro now, workouts screen later. Call update() each frame, dispose() when done.
import * as THREE from "three";

export interface RunnerOptions { rimA?: string; rimB?: string; base?: string }
export interface Runner {
  group: THREE.Group;
  /** t: seconds, speed: 1 = jog, 2 = sprint. */
  update(t: number, speed?: number): void;
  /** 0 = solid, 1 = fully dissolved into sparks. */
  setDissolve(v: number): void;
  setOpacity(v: number): void;
  dispose(): void;
}

const VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  vW = w.xyz;
  vN = normalize(normalMatrix * normal);
  vec4 mv = viewMatrix * w;
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uBase; uniform float uDissolve; uniform float uOpacity;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){
  float n = noise(vW*9.0) * .7 + noise(vW*23.0) * .3;
  float edge = uDissolve * 1.15 - .1;
  if (n < edge) discard;
  vec3 N = normalize(vN);
  float rim = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 2.2);
  vec3 L = normalize(vec3(.3,.8,.6));
  float diff = max(dot(N,L),0.0)*.55 + .25;
  vec3 rimCol = mix(uA, uB, smoothstep(-.6,.6,N.x));
  vec3 col = uBase*diff + rimCol*rim*1.9;
  float burn = smoothstep(edge+.08, edge, n) * step(.001,uDissolve);
  col += mix(uA,uB,.5)*burn*2.5;
  gl_FragColor = vec4(col, uOpacity);
}`;

export function createRunner(opts: RunnerOptions = {}): Runner {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: false,
    uniforms: {
      uA: { value: new THREE.Color(opts.rimA ?? "#2CC6DA") }, uB: { value: new THREE.Color(opts.rimB ?? "#8BE04E") },
      uBase: { value: new THREE.Color(opts.base ?? "#1A2747") }, uDissolve: { value: 0 }, uOpacity: { value: 1 },
    },
  });
  const geos: THREE.BufferGeometry[] = [];
  const cap = (r: number, len: number) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2 - r, 0); geos.push(g); return g; };
  const part = (g: THREE.BufferGeometry, parent: THREE.Object3D, y = 0, x = 0, z = 0) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
    pivot.add(new THREE.Mesh(g, mat)); return pivot;
  };

  const group = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.0; group.add(hips);
  const pelvis = new THREE.Mesh((() => { const g = new THREE.SphereGeometry(0.16, 12, 10); g.scale(1.2, 0.8, 0.9); geos.push(g); return g; })(), mat);
  hips.add(pelvis);
  // torso (pivot at hips, built upward)
  const torso = new THREE.Group(); hips.add(torso);
  const chestG = new THREE.CapsuleGeometry(0.17, 0.34, 4, 12); chestG.translate(0, 0.32, 0); chestG.scale(1.05, 1, 0.75); geos.push(chestG);
  torso.add(new THREE.Mesh(chestG, mat));
  const headG = new THREE.SphereGeometry(0.13, 16, 12); headG.scale(0.92, 1.05, 1); geos.push(headG);
  const neck = new THREE.Group(); neck.position.y = 0.72; torso.add(neck);
  const head = new THREE.Mesh(headG, mat); head.position.set(0.02, 0.12, 0); neck.add(head);

  const mkArm = (side: number) => {
    const sh = part(cap(0.055, 0.22), torso, 0.62, 0, side * 0.22);
    const el = part(cap(0.048, 0.2), sh, -0.33);
    return { sh, el };
  };
  const mkLeg = (side: number) => {
    const hip = part(cap(0.075, 0.34), hips, -0.04, 0, side * 0.1);
    const knee = part(cap(0.062, 0.34), hip, -0.48);
    const footG = new THREE.CapsuleGeometry(0.045, 0.14, 3, 8); footG.rotateZ(Math.PI / 2); footG.translate(0.06, -0.02, 0); geos.push(footG);
    const ankle = new THREE.Group(); ankle.position.y = -0.47; knee.add(ankle); ankle.add(new THREE.Mesh(footG, mat));
    return { hip, knee, ankle };
  };
  const armL = mkArm(1), armR = mkArm(-1), legL = mkLeg(1), legR = mkLeg(-1);
  // Faces +x; limbs swing about z, so a camera on the z axis sees the logo's side profile.

  let phase = 0, last = 0;
  return {
    group,
    update(t, speed = 1) {
      const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
      phase += dt * (7.5 + speed * 3.2);
      const s = Math.sin(phase), c = Math.cos(phase);
      const amp = 0.75 + speed * 0.18;
      // legs (opposite phase): thigh swing, knee folds on the back swing, foot follows
      const leg = (l: typeof legL, k: number) => {
        const sp = Math.sin(phase + k), cp = Math.cos(phase + k);
        l.hip.rotation.z = sp * amp;
        l.knee.rotation.z = -Math.max(0, cp) * (1.2 + speed * 0.35) - 0.15;
        l.ankle.rotation.z = Math.max(0, -sp) * 0.4 - 0.1;
      };
      leg(legL, 0); leg(legR, Math.PI);
      // arms counter-swing with bent elbows
      armL.sh.rotation.z = -s * amp * 0.85; armR.sh.rotation.z = s * amp * 0.85;
      armL.el.rotation.z = 1.35 + Math.max(0, s) * 0.3; armR.el.rotation.z = 1.35 + Math.max(0, -s) * 0.3;
      // torso lean, twist and bob
      torso.rotation.z = -0.16 - speed * 0.06;
      torso.rotation.y = s * 0.12;
      neck.rotation.z = 0.12 + speed * 0.04;
      hips.position.y = 1.0 + Math.abs(c) * 0.06 * (0.8 + speed * 0.3) - 0.03;
      hips.rotation.y = -s * 0.08;
    },
    setDissolve(v) { mat.uniforms.uDissolve!.value = v; },
    setOpacity(v) {
      mat.uniforms.uOpacity!.value = v;
      const tr = v < 0.999;
      if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
    },
    dispose() { geos.forEach((g) => g.dispose()); mat.dispose(); group.removeFromParent(); },
  };
}
