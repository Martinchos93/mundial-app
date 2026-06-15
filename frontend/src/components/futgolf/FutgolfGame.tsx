"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Seeded RNG so everyone at a table plays the same course.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function FutgolfGame({
  seed,
  shotsAllowed,
  onResult,
}: {
  seed: number;
  shotsAllowed: number;
  onResult: (sunk: boolean, shots: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const mount = mountRef.current!;
    const rnd = mulberry32(seed || 1);
    const phaseA = rnd() * 10, phaseB = rnd() * 10;
    const HOLE = new THREE.Vector2((rnd() * 30 - 15), 118 + rnd() * 8);
    const START = new THREE.Vector3(0, 0, -110);
    const W = 280, SEG = 170, HOLE_R = 2.8, CUP_DEPTH = 2.2, BALL_R = 0.7;
    const G = 26, MAX_SPEED = 70, LOFT = 32 * Math.PI / 180;
    const RESTITUTION = 0.45, IMPACT_FRICTION = 0.30, ROLL_DECEL = 11, STOP = 0.5, BOUNCE_MIN = 1.6, CAPTURE_SP = 18;

    function h(x: number, z: number) {
      let y = 1.7 * Math.sin(x * 0.10 + phaseA) * Math.cos(z * 0.075)
            + 1.2 * Math.sin(z * 0.14 + 1.3)
            + 0.9 * Math.cos(x * 0.17 + phaseB)
            + 0.6 * Math.sin((x + z) * 0.06);
      const d = Math.hypot(x - HOLE.x, z - HOLE.y);
      y *= Math.min(1, Math.max(0.1, (d - HOLE_R) / 12));
      const ds = Math.hypot(x - START.x, z - START.z);
      y *= Math.min(1, Math.max(0.4, ds / 8));
      return y;
    }
    function normal(x: number, z: number) {
      const e = 0.6;
      const dx = (h(x + e, z) - h(x - e, z)) / (2 * e);
      const dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
      return new THREE.Vector3(-dx, 1, -dz).normalize();
    }
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b9e6);
    scene.fog = new THREE.Fog(0x87b9e6, 140, 360);
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a3a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(-40, 80, -20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150; sc.far = 300;
    scene.add(sun);

    let base: THREE.BufferGeometry = new THREE.PlaneGeometry(W, W, SEG, SEG);
    base.rotateX(-Math.PI / 2);
    { const p = base.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, h(p.getX(i), p.getZ(i))); }
    base = base.toNonIndexed();
    const src = base.attributes.position, keep: number[] = [];
    for (let i = 0; i < src.count; i += 3) {
      const cx = (src.getX(i) + src.getX(i + 1) + src.getX(i + 2)) / 3;
      const cz = (src.getZ(i) + src.getZ(i + 1) + src.getZ(i + 2)) / 3;
      if (Math.hypot(cx - HOLE.x, cz - HOLE.y) > HOLE_R)
        for (const k of [i, i + 1, i + 2]) keep.push(src.getX(k), src.getY(k), src.getZ(k));
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
    gGeo.computeVertexNormals();
    const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ color: 0x5fae4e, flatShading: true }));
    ground.receiveShadow = true; scene.add(ground);

    const holeY = h(HOLE.x, HOLE.y);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, side: THREE.DoubleSide, roughness: 1 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(HOLE_R + 0.35, HOLE_R * 0.85, CUP_DEPTH, 40, 1, true), cupMat);
    wall.position.set(HOLE.x, holeY - CUP_DEPTH / 2, HOLE.y); scene.add(wall);
    const cupBottom = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R * 0.85, 40), cupMat);
    cupBottom.rotation.x = -Math.PI / 2; cupBottom.position.set(HOLE.x, holeY - CUP_DEPTH, HOLE.y); scene.add(cupBottom);
    const rim = new THREE.Mesh(new THREE.RingGeometry(HOLE_R * 0.96, HOLE_R * 1.16, 40),
      new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.8, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(HOLE.x, holeY + 0.04, HOLE.y); scene.add(rim);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pole.position.set(HOLE.x, holeY + 3.5, HOLE.y); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    flag.position.set(HOLE.x + 1.2, holeY + 6, HOLE.y); scene.add(flag);

    const tex = new THREE.TextureLoader().load("/futgolf-ball.png");
    tex.colorSpace = THREE.SRGBColorSpace;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    ball.castShadow = true; scene.add(ball);
    const aim = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    aim.rotation.x = Math.PI / 2; scene.add(aim);

    // overlay HUD
    const ui = document.createElement("div");
    ui.style.cssText = "position:absolute;inset:0;pointer-events:none;font-family:inherit;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4)";
    ui.innerHTML = `
      <div style="position:absolute;top:10px;left:12px;font-size:14px;font-weight:700" id="fg-strokes"></div>
      <div style="position:absolute;top:10px;right:12px;font-size:13px;font-weight:600" id="fg-dist"></div>
      <div style="position:absolute;bottom:20px;left:12px;width:16px;height:150px;border-radius:9px;background:rgba(0,0,0,.25);overflow:hidden">
        <div id="fg-power" style="position:absolute;bottom:0;left:0;right:0;height:0%;background:linear-gradient(to top,#22c55e,#eab308,#ef4444)"></div></div>
      <button id="fg-kick" style="position:absolute;right:18px;bottom:18px;width:84px;height:84px;border-radius:50%;background:#2563eb;color:#fff;border:4px solid rgba(255,255,255,.5);font-size:13px;font-weight:700;pointer-events:auto;box-shadow:0 6px 18px rgba(0,0,0,.3)">PATEAR</button>
      <div id="fg-end" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.5);text-align:center">
        <div id="fg-endtitle" style="font-size:26px;font-weight:800;margin-bottom:6px"></div>
        <div id="fg-endtext" style="font-size:15px;opacity:.9"></div></div>`;
    mount.appendChild(ui);
    const $ = (id: string) => ui.querySelector("#" + id) as HTMLElement;
    const kick = $("fg-kick");

    let aimAngle = Math.atan2(HOLE.x - START.x, HOLE.y - START.z);
    const P = new THREE.Vector3(START.x, h(START.x, START.z) + BALL_R, START.z);
    const V = new THREE.Vector3();
    let strokes = 0, moving = false, captured = false, done = false;
    let charging = false, chargeT = 0;
    ball.position.copy(P);
    $("fg-strokes").textContent = `Tiro 0/${shotsAllowed}`;

    function finish(sunk: boolean) {
      if (done) return; done = true;
      $("fg-endtitle").textContent = sunk ? "⛳️ ¡Adentro!" : "❌ Erraste";
      $("fg-endtext").textContent = sunk ? `En ${strokes} ${strokes === 1 ? "tiro 🐐" : "tiros"}` : "Se acabaron los tiros";
      $("fg-end").style.display = "flex";
      setTimeout(() => onResultRef.current(sunk, strokes), 900);
    }
    function currentPower() { const Pd = 1.4, ph = (chargeT % Pd) / Pd; return ph < 0.5 ? ph * 2 : 2 - ph * 2; }
    function startCharge() { if (moving || done || strokes >= shotsAllowed) return; charging = true; chargeT = 0; kick.style.background = "#ef4444"; }
    function endCharge() {
      if (!charging) return; charging = false; kick.style.background = "#2563eb";
      const power = currentPower(); $("fg-power").style.height = "0%";
      const sp = MAX_SPEED * power, hor = Math.cos(LOFT) * sp, ver = Math.sin(LOFT) * sp;
      V.set(Math.sin(aimAngle) * hor, ver, Math.cos(aimAngle) * hor);
      moving = true; strokes++; $("fg-strokes").textContent = `Tiro ${strokes}/${shotsAllowed}`;
    }
    kick.addEventListener("pointerdown", (e) => { e.preventDefault(); startCharge(); });

    let dragId: number | null = null, lastX = 0;
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", (e) => { dragId = e.pointerId; lastX = e.clientX; });
    cv.addEventListener("pointermove", (e) => { if (e.pointerId !== dragId) return; aimAngle -= (e.clientX - lastX) * 0.006; lastX = e.clientX; });
    const upHandler = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = null; endCharge(); };
    window.addEventListener("pointerup", upHandler);
    const keyDown = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") aimAngle += 0.05; if (e.key === "ArrowRight") aimAngle -= 0.05; if (e.code === "Space" && !charging) startCharge(); };
    const keyUp = (e: KeyboardEvent) => { if (e.code === "Space") endCharge(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);

    const onResize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3(), gvec = new THREE.Vector3();
    let raf = 0;
    function tick() {
      const dt = Math.min(clock.getDelta(), 0.033);
      if (charging) { chargeT += dt; $("fg-power").style.height = (currentPower() * 100).toFixed(0) + "%"; }

      if (captured) {
        V.y -= G * dt; V.x *= 0.82; V.z *= 0.82; P.addScaledVector(V, dt);
        if (P.y <= holeY - CUP_DEPTH + BALL_R) { P.y = holeY - CUP_DEPTH + BALL_R; captured = false; moving = false; finish(true); }
        ball.position.copy(P);
      } else if (moving) {
        V.y -= G * dt; P.addScaledVector(V, dt);
        const dHole = Math.hypot(P.x - HOLE.x, P.z - HOLE.y);
        const gy = h(P.x, P.z) + BALL_R;
        const horizSp = Math.hypot(V.x, V.z);
        if (dHole < HOLE_R && P.y <= gy + 0.8 && horizSp < CAPTURE_SP) {
          captured = true;
        } else if (P.y <= gy) {
          P.y = gy; const n = normal(P.x, P.z); const vn = V.dot(n);
          if (vn < -BOUNCE_MIN) {
            V.addScaledVector(n, -(1 + RESTITUTION) * vn);
            const vn2 = V.dot(n); tmp.copy(V).addScaledVector(n, -vn2);
            V.copy(tmp.multiplyScalar(1 - IMPACT_FRICTION)).addScaledVector(n, vn2);
          } else {
            V.addScaledVector(n, -vn);
            gvec.set(0, -G, 0); tmp.copy(gvec).addScaledVector(n, -gvec.dot(n)); V.addScaledVector(tmp, dt);
            const sp = V.length(), dec = ROLL_DECEL * dt; if (sp > dec) V.multiplyScalar((sp - dec) / sp); else V.set(0, 0, 0);
          }
        }
        const lim = W / 2 - 4; P.x = clamp(P.x, -lim, lim); P.z = clamp(P.z, -lim, lim);
        const gy2 = h(P.x, P.z) + BALL_R; if (P.y < gy2) P.y = gy2;
        if (V.length() < STOP && Math.abs(P.y - gy2) < 0.06) {
          V.set(0, 0, 0); moving = false;
          if (!done && strokes >= shotsAllowed) finish(false);
        }
        ball.position.copy(P);
        const hs = Math.hypot(V.x, V.z); if (hs > 0.001) { tmp.set(V.z, 0, -V.x).normalize(); ball.rotateOnWorldAxis(tmp, hs * dt / BALL_R); }
      }

      const dir = new THREE.Vector3(Math.sin(aimAngle), 0, Math.cos(aimAngle));
      const bp = ball.position;
      camera.position.lerp(bp.clone().addScaledVector(dir, -14).add(new THREE.Vector3(0, 8, 0)), 0.10);
      camera.lookAt(bp.x + dir.x * 7, bp.y + 1.5, bp.z + dir.z * 7);
      aim.visible = !moving && !captured && !done;
      if (aim.visible) { aim.position.set(bp.x + dir.x * 2.4, bp.y, bp.z + dir.z * 2.4); aim.rotation.set(Math.PI / 2, 0, -aimAngle); }
      $("fg-dist").textContent = "Al hoyo: " + Math.hypot(P.x - HOLE.x, P.z - HOLE.y).toFixed(0) + "m";
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", upHandler);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) mount.removeChild(renderer.domElement);
      if (ui.parentNode) mount.removeChild(ui);
    };
  }, [seed, shotsAllowed]);

  return <div ref={mountRef} className="relative h-[70vh] w-full overflow-hidden rounded-xl bg-[#87b9e6]" />;
}
