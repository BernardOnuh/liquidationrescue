"use client";
// The hero's collateral: a liquid-metal sphere in orbiting signals. In "hero" mode an 11-second story loops: calm, a red
// market shockwave approaches and the metal destabilises, a cyan shield forms, the wave dissolves on it, calm again.
// In "calm" mode (the final section) the shield simply holds. Rendering pauses while off screen; reduced motion shows
// one still frame with the shield up.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type Phase = "calm" | "threat" | "shield" | "safe";

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const metalVert = /* glsl */ `
uniform float uTime; uniform float uInstab; uniform float uRipple; uniform vec3 uDir;
varying vec3 vWorld; varying float vHeat;
${NOISE}
void main(){
  vec3 p = position; vec3 n = normalize(normal);
  float slow = snoise(p * 1.4 + vec3(0., uTime * .22, uTime * .11));
  float fast = snoise(p * 3.2 - vec3(uTime * .6));
  float rim = 1. - abs(dot(n, uDir));
  float ripple = sin(rim * 16. - uTime * 14.) * uRipple * smoothstep(.1, 1., rim);
  float d = slow * (.05 + .16 * uInstab) + fast * .07 * uInstab + ripple * .08;
  p += n * d;
  vHeat = clamp(slow * .5 + .5, 0., 1.) * uInstab;
  vec4 w = modelMatrix * vec4(p, 1.); vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const metalFrag = /* glsl */ `
uniform float uDanger; uniform float uShield;
varying vec3 vWorld; varying float vHeat;
void main(){
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.) N = -N;
  vec3 R = reflect(-V, N);
  float fres = pow(1. - max(dot(N, V), 0.), 3.);
  // A studio environment for chrome: a dark floor, a steel horizon, a bright softbox overhead, a cyan fill.
  vec3 floorC = vec3(.015, .02, .045), horizon = vec3(.32, .36, .45), sky = vec3(.78, .84, .95);
  vec3 env = mix(floorC, horizon, smoothstep(-.35, .05, R.y));
  env = mix(env, sky, smoothstep(.15, .75, R.y));
  env += vec3(.1, .55, .75) * pow(max(dot(R, normalize(vec3(-.8, .1, .5))), 0.), 6.) * .9;
  env += vec3(1.) * pow(max(dot(R, normalize(vec3(.5, .8, .6))), 0.), 40.) * 1.6;
  vec3 col = env * .92 + fres * vec3(.35, .5, .7);
  vec3 molten = vec3(1., .28, .08);
  col = mix(col, col * .35 + molten * (.7 + .6 * vHeat), uDanger * (.35 + .65 * vHeat));
  col += vec3(.15, .85, 1.) * fres * uShield * .9;
  gl_FragColor = vec4(col, 1.);
}`;

const shieldVert = /* glsl */ `
varying vec3 vN; varying vec3 vWorld; varying vec3 vObj;
void main(){ vN = normalize(normalMatrix * normal); vObj = normalize(position); vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const shieldFrag = /* glsl */ `
uniform float uShield; uniform float uHit; uniform vec3 uDir; uniform float uTime;
varying vec3 vN; varying vec3 vWorld; varying vec3 vObj;
${NOISE}
void main(){
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1. - abs(dot(normalize(vN), V)), 2.4);
  float cells = abs(snoise(vObj * 6. + uTime * .15));
  float lines = smoothstep(.06, .0, cells) * .55;
  float hit = pow(1. - abs(dot(vObj, uDir)), 3.) * uHit;
  float flow = .5 + .5 * sin(vObj.y * 9. - uTime * 2.);
  float a = uShield * (fres * .85 + lines * (.35 + .4 * flow) + hit * 1.4);
  vec3 col = mix(vec3(.1, .75, 1.), vec3(.75, .98, 1.), hit + fres * .3);
  gl_FragColor = vec4(col * a, a);
}`;

const waveFrag = /* glsl */ `
uniform float uAlpha; uniform float uTime; uniform float uRadius; varying vec2 vUv;
${NOISE}
void main(){
  vec2 c = (vUv - .5) * 16.; float r = length(c);
  float n = snoise(vec3(c * .9, uTime * 1.6)) * .5 + .5;
  float w = .1 + .12 * n;
  float front = exp(-pow((r - uRadius) / w, 2.));
  float wake = smoothstep(uRadius, uRadius + 2.2, r) * smoothstep(uRadius + 5., uRadius + 2.2, r) * .22 * n;
  float a = (front * (.6 + .8 * n) + wake) * uAlpha;
  vec3 col = mix(vec3(1., .18, .04), vec3(1., .66, .25), n * front);
  gl_FragColor = vec4(col * a, a);
}`;
const uvVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const orbitVert = /* glsl */ `
uniform float uTime; uniform float uDanger; uniform float uPixel;
attribute vec3 aOrbit; attribute float aSeed; varying vec3 vCol; varying float vA;
void main(){
  float ang = aOrbit.y + uTime * aOrbit.z;
  vec3 p = vec3(cos(ang) * aOrbit.x, sin(aSeed * 6.283 + uTime * .3) * .35 + (aSeed - .5) * 2.4, sin(ang) * aOrbit.x);
  float tilt = .35; p.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.yz;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_PointSize = uPixel * (1.2 + aSeed * 2.2) * (6. / -mv.z);
  gl_Position = projectionMatrix * mv;
  float red = step(.62, aSeed) * uDanger;
  vCol = mix(mix(vec3(.25, .6, 1.), vec3(.4, .95, 1.), aSeed), vec3(1., .35, .12), red);
  vA = .35 + .5 * aSeed;
}`;
const pointFrag = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d) * vA; gl_FragColor = vec4(vCol * a, a); }`;
const burstVert = /* glsl */ `
uniform float uPixel; attribute float aLife; varying vec3 vCol; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = uPixel * 3. * (6. / -mv.z); gl_Position = projectionMatrix * mv;
  vCol = mix(vec3(1., .75, .3), vec3(1., .25, .08), 1. - aLife); vA = aLife; }`;

const CYCLE = 11;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function Scene({ mode, onPhase, still, small }: { mode: "hero" | "calm"; onPhase?: (p: Phase) => void; still: boolean; small: boolean }) {
  const { gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const phase = useRef<Phase | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const dir = useMemo(() => new THREE.Vector3(0, 0, 1), []); // the ring closes in around the view axis
  const pixel = gl.getPixelRatio();

  const metal = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: metalVert, fragmentShader: metalFrag,
    uniforms: { uTime: { value: 0 }, uInstab: { value: 0 }, uRipple: { value: 0 }, uDir: { value: dir }, uDanger: { value: 0 }, uShield: { value: 0 } },
  }), [dir]);
  const shield = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: shieldVert, fragmentShader: shieldFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uShield: { value: 0 }, uHit: { value: 0 }, uDir: { value: dir }, uTime: { value: 0 } },
  }), [dir]);
  const waveMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: uvVert, fragmentShader: waveFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uRadius: { value: 8 } },
  }), []);

  const count = small ? 700 : 1600;
  const orbit = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const o = new Float32Array(count * 3), s = new Float32Array(count), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      o[i * 3] = 2.1 + Math.random() * 1.9; o[i * 3 + 1] = Math.random() * Math.PI * 2; o[i * 3 + 2] = (0.04 + Math.random() * 0.16) * (Math.random() < 0.5 ? -1 : 1);
      s[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aOrbit", new THREE.BufferAttribute(o, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    return g;
  }, [count]);
  const orbitMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: orbitVert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDanger: { value: 0 }, uPixel: { value: pixel } },
  }), [pixel]);

  const BURST = small ? 180 : 420;
  const burst = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BURST * 3), 3));
    g.setAttribute("aLife", new THREE.BufferAttribute(new Float32Array(BURST), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
    return g;
  }, [BURST]);
  const burstVel = useMemo(() => Array.from({ length: BURST }, () => new THREE.Vector3()), [BURST]);
  const burstMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: burstVert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPixel: { value: pixel } },
  }), [pixel]);
  const burstAt = useRef(-1);

  useEffect(() => {
    const move = (e: PointerEvent) => { mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame((state, delta) => {
    const t = still ? 7.4 : state.clock.elapsedTime;
    const c = mode === "hero" ? t % CYCLE : 7.4;
    // The story's levers, as functions of the cycle time c.
    const approach = smooth(2, 5, c);                         // wave travels in
    const shieldOn = mode === "calm" ? 0.7 : smooth(4.1, 4.7, c) * (1 - smooth(9, 10.6, c));
    const hit = smooth(4.95, 5.1, c) * (1 - smooth(5.1, 6.6, c));
    const settle = 1 - smooth(5.1, 7.5, c);
    const instab = mode === "calm" ? 0.04 : Math.max(approach * (1 - smooth(5, 6.4, c)), 0.05) * (c < 5 ? 1 : settle);
    const danger = mode === "calm" ? 0 : smooth(2.6, 4.6, c) * (1 - smooth(5, 6.2, c));

    metal.uniforms.uTime.value = t; metal.uniforms.uInstab.value = instab; metal.uniforms.uDanger.value = danger;
    metal.uniforms.uShield.value = shieldOn; metal.uniforms.uRipple.value = mode === "calm" ? 0 : hit + approach * 0.25 * (c < 5 ? 1 : 0);
    shield.uniforms.uShield.value = shieldOn * (mode === "calm" ? 0.8 + 0.2 * Math.sin(t * 1.3) : 1); shield.uniforms.uHit.value = hit; shield.uniforms.uTime.value = t;
    orbitMat.uniforms.uTime.value = t; orbitMat.uniforms.uDanger.value = danger;

    if (wave.current) {
      waveMat.uniforms.uRadius.value = THREE.MathUtils.lerp(7.8, 1.66, approach);
      waveMat.uniforms.uAlpha.value = mode === "calm" ? 0 : smooth(2, 2.6, c) * (1 - smooth(4.95, 5.2, c));
      waveMat.uniforms.uTime.value = t;
    }

    // The wave breaks on the shield: red particles scatter and fade.
    const pos = burst.attributes.position as THREE.BufferAttribute, life = burst.attributes.aLife as THREE.BufferAttribute;
    if (mode === "hero" && !still && c >= 5 && c < 5.2 && burstAt.current !== Math.floor(t / CYCLE)) {
      burstAt.current = Math.floor(t / CYCLE);
      for (let i = 0; i < BURST; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.66 + Math.random() * 0.08, v = 0.5 + Math.random() * 1.8;
        pos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.6);
        burstVel[i].set(Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * 0.8);
        life.setX(i, 0.6 + Math.random() * 0.4);
      }
    }
    for (let i = 0; i < BURST; i++) {
      const l = life.getX(i); if (l <= 0) continue;
      pos.setXYZ(i, pos.getX(i) + burstVel[i].x * delta, pos.getY(i) + burstVel[i].y * delta, pos.getZ(i) + burstVel[i].z * delta);
      burstVel[i].multiplyScalar(0.985);
      life.setX(i, Math.max(0, l - delta * 0.55));
    }
    pos.needsUpdate = true; life.needsUpdate = true;

    if (group.current) {
      group.current.rotation.y += ((still ? 0 : mouse.current.x * 0.35) - group.current.rotation.y) * 0.04 + (still ? 0 : delta * 0.04);
      group.current.rotation.x += ((still ? 0 : mouse.current.y * 0.2) - group.current.rotation.x) * 0.04;
    }

    const next: Phase = mode === "calm" ? "safe" : c < 2.4 ? "calm" : c < 4.4 ? "threat" : c < 5.4 ? "shield" : c < 9.4 ? "safe" : "calm";
    if (next !== phase.current) { phase.current = next; onPhase?.(next); }
  });

  const detail = small ? 40 : 96;
  return (
    <>
      <group ref={group}>
        <mesh material={metal}><icosahedronGeometry args={[1.15, detail]} /></mesh>
        <mesh material={shield}><sphereGeometry args={[1.62, small ? 48 : 96, small ? 32 : 64]} /></mesh>
        <points geometry={orbit} material={orbitMat} />
      </group>
      <mesh ref={wave} material={waveMat} position={[0, 0, -0.2]}><planeGeometry args={[16, 16]} /></mesh>
      <points geometry={burst} material={burstMat} />
    </>
  );
}

export function LiquidSphere({ mode = "hero", onPhase, className }: { mode?: "hero" | "calm"; onPhase?: (p: Phase) => void; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches); setSmall(window.innerWidth < 768);
    const onChange = () => setStill(mq.matches);
    mq.addEventListener("change", onChange);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    if (wrap.current) io.observe(wrap.current);
    return () => { mq.removeEventListener("change", onChange); io.disconnect(); };
  }, []);
  return (
    <div ref={wrap} className={className} aria-hidden>
      <Canvas
        frameloop={!visible ? "never" : still ? "demand" : "always"}
        dpr={[1, small ? 1.5 : 1.75]}
        camera={{ position: [0, 0, 6.4], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene mode={mode} onPhase={onPhase} still={still} small={small} />
      </Canvas>
    </div>
  );
}
