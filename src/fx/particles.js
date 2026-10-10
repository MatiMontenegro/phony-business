// Particles: gas clouds, droplets, money, confetti, glass, dizzy stars and
// liquid streams. Everything is pooled and drawn in a few draw calls.
import * as THREE from 'three';
import * as TX from '../engine/textures.js';

const _v = new THREE.Vector3();

class PointPool {
  constructor(scene, max, { map, blending = THREE.NormalBlending, sizeScale = 300 }) {
    this.max = max;
    this.items = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: sizeScale } },
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
          if (gl_FragColor.a < 0.003) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  spawn(p) {
    if (this.items.length >= this.max) this.items.shift();
    p.age = 0;
    p.color = p.color || new THREE.Color('#ffffff');
    this.items.push(p);
    return p;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vel.y += (p.gravity || 0) * dt;
      p.vel.multiplyScalar(Math.exp(-(p.drag || 0) * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.floor !== undefined && p.pos.y < p.floor) {
        p.pos.y = p.floor;
        p.vel.y *= -0.2; p.vel.x *= 0.6; p.vel.z *= 0.6;
      }
    }
    let n = 0;
    for (const p of this.items) {
      const k = p.age / p.life;
      const fin = Math.min(1, p.age / (p.fadeIn || 0.08));
      this.pos[n * 3] = p.pos.x; this.pos[n * 3 + 1] = p.pos.y; this.pos[n * 3 + 2] = p.pos.z;
      this.col[n * 3] = p.color.r; this.col[n * 3 + 1] = p.color.g; this.col[n * 3 + 2] = p.color.b;
      this.alpha[n] = (p.alpha ?? 1) * fin * (1 - k * k);
      this.size[n] = p.size * (1 + (p.grow || 0) * k);
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'aColor', 'aAlpha', 'aSize']) this.geo.attributes[a].needsUpdate = true;
  }
}

class QuadPool {
  constructor(scene, max, map, size = [0.16, 0.08]) {
    this.max = max;
    this.items = [];
    const geo = new THREE.PlaneGeometry(size[0], size[1]);
    const mat = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.6, transparent: !map, color: '#ffffff' });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    if (!map) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
  }

  spawn(p) {
    if (this.items.length >= this.max) this.items.shift();
    p.age = 0;
    p.rot = p.rot || new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin = p.spin || new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    this.items.push(p);
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age > p.life) { this.items.splice(i, 1); continue; }
      p.vel.y += (p.gravity ?? -6) * dt;
      p.vel.multiplyScalar(Math.exp(-(p.drag ?? 1.2) * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.01) { p.pos.y = 0.01; p.vel.set(0, 0, 0); p.spin.multiplyScalar(0.8); p.rot.x = -Math.PI / 2; }
      p.rot.addScaledVector(p.spin, dt);
    }
    this.items.forEach((p, i) => {
      const k = p.age / p.life;
      const s = k > 0.85 ? (1 - k) / 0.15 : 1;
      this._q.setFromEuler(this._e.set(p.rot.x, p.rot.y, p.rot.z));
      this._m.compose(p.pos, this._q, this._s.set(s, s, s));
      this.mesh.setMatrixAt(i, this._m);
      if (this.mesh.instanceColor && p.color) this.mesh.setColorAt(i, p.color);
    });
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// A liquid arc drawn as chained thin cylinders along a ballistic path.
export class Stream {
  constructor(scene, color = '#ffe46b', segs = 18) {
    this.segs = segs;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.78, emissive: color, emissiveIntensity: 0.18 });
    this.mesh = new THREE.InstancedMesh(geo, mat, segs);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.active = false;
    this.flow = 0;
    this.t = 0;
    this.landing = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  // origin, initial velocity and the height where it lands; returns landing point
  update(dt, on, origin, vel, floorY = 0.0) {
    this.t += dt;
    this.flow += ((on ? 1 : 0) - this.flow) * Math.min(1, dt * (on ? 6 : 10));
    if (this.flow < 0.03 || !origin) { this.mesh.count = 0; return null; }
    const g = -9.8;
    // time to reach floorY
    const a = 0.5 * g, b = vel.y, c = origin.y - floorY;
    const disc = b * b - 4 * a * c;
    const T = disc > 0 ? (-b - Math.sqrt(disc)) / (2 * a) : 0.4;
    const n = this.segs;
    const r = 0.0045 * this.flow;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const t0 = (T * i) / n, t1 = (T * (i + 1)) / n;
      const w0 = Math.sin(this.t * 31 + i * 0.9) * 0.004 * i / n, w1 = Math.sin(this.t * 31 + (i + 1) * 0.9) * 0.004 * (i + 1) / n;
      this._a.set(origin.x + vel.x * t0 + w0, origin.y + vel.y * t0 + 0.5 * g * t0 * t0, origin.z + vel.z * t0 - w0);
      this._b.set(origin.x + vel.x * t1 + w1, origin.y + vel.y * t1 + 0.5 * g * t1 * t1, origin.z + vel.z * t1 - w1);
      this._d.subVectors(this._b, this._a);
      const len = this._d.length();
      if (len < 1e-4) continue;
      this._q.setFromUnitVectors(this._up, this._d.multiplyScalar(1 / len));
      const rr = r * (1 - 0.35 * i / n);
      this._m.compose(this._a, this._q, new THREE.Vector3(rr, len, rr));
      this.mesh.setMatrixAt(count++, this._m);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.landing.set(origin.x + vel.x * T, floorY, origin.z + vel.z * T);
    return this.landing;
  }

  dispose() { this.mesh.removeFromParent(); }
}

function starTexture() {
  const c = TX.canvas(128, 128);
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.fillStyle = '#ffd84d';
  g.strokeStyle = '#1a1433';
  g.lineWidth = 8;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 24 : 54, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.stroke();
  g.fill();
  return TX.tex(c);
}

function billTexture() {
  const c = TX.canvas(128, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#7fd6a0';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#2f7a4f';
  g.lineWidth = 4;
  g.strokeRect(5, 5, 118, 54);
  g.fillStyle = '#2f7a4f';
  g.beginPath(); g.arc(64, 32, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7fd6a0';
  g.font = `bold 22px ${TX.FONT.mono}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 64, 33);
  g.fillStyle = '#2f7a4f';
  g.font = `bold 14px ${TX.FONT.mono}`;
  g.fillText('100', 22, 18);
  g.fillText('100', 106, 48);
  return TX.tex(c);
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    const dot = TX.softDot();
    this.gas = new PointPool(scene, 500, { map: dot, sizeScale: 420 });
    this.glow = new PointPool(scene, 300, { map: dot, blending: THREE.AdditiveBlending, sizeScale: 260 });
    this.drops = new PointPool(scene, 400, { map: dot, sizeScale: 160 });
    this.money = new QuadPool(scene, 80, billTexture(), [0.17, 0.085]);
    this.confetti = new QuadPool(scene, 400, null, [0.05, 0.08]);
    this.clouds = [];
    this.starTex = starTexture();
    this.dizzy = [];
  }

  fartCloud(pos, dir, power = 0.4, owner = null) {
    const n = Math.floor(18 + power * 46);
    const base = new THREE.Color('#b9d36a');
    for (let i = 0; i < n; i++) {
      const spread = 0.6 + power * 1.4;
      const vel = new THREE.Vector3(
        dir.x * (0.6 + Math.random() * 1.6) * (0.4 + power) + (Math.random() - 0.5) * spread,
        (Math.random() - 0.2) * 0.6,
        dir.z * (0.6 + Math.random() * 1.6) * (0.4 + power) + (Math.random() - 0.5) * spread,
      );
      this.gas.spawn({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15)),
        vel,
        life: 3 + Math.random() * 3 + power * 4,
        size: 0.45 + Math.random() * 0.35 + power * 0.45,
        grow: 2.6,
        color: base.clone().offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.12),
        alpha: 0.5 + power * 0.18,
        drag: 1.4,
        gravity: 0.06,
        fadeIn: 0.15,
      });
    }
    for (let i = 0; i < 6 + power * 10; i++) {
      this.glow.spawn({ pos: pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2, (Math.random() - 0.5) * 2), life: 0.8 + Math.random() * 0.8, size: 0.08, color: new THREE.Color('#e9ff9a').multiplyScalar(1.5), drag: 1.5, gravity: -0.3 });
    }
    this.clouds.push({ pos: pos.clone().addScaledVector(dir, 0.6 + power), radius: 1.2 + power * 2.2, life: 5 + power * 8, owner });
  }

  splash(pos, color = '#ffe46b', n = 18, speed = 2) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      this.drops.spawn({ pos: pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 1.2, (Math.random() - 0.5) * speed), life: 0.6 + Math.random() * 0.4, size: 0.06 + Math.random() * 0.05, color: c, gravity: -9, floor: 0.02, alpha: 0.9 });
    }
  }

  moneyBurst(pos, amount = 300) {
    const n = Math.min(40, 6 + Math.floor(amount / 40));
    for (let i = 0; i < n; i++) this.money.spawn({ pos: pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3), life: 3 + Math.random() * 2, gravity: -5, drag: 1.8 });
    for (let i = 0; i < 16; i++) this.glow.spawn({ pos: pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.7, size: 0.12, color: new THREE.Color('#46e3a0').multiplyScalar(2), drag: 2 });
  }

  confettiRain(center, spread = 8, n = 300) {
    const cols = ['#ff4d5e', '#ffd84d', '#46e3a0', '#8fa7ff', '#c78bff', '#f6f1e3'].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      this.confetti.spawn({
        pos: new THREE.Vector3(center.x + (Math.random() - 0.5) * spread * 2, 3.8 + Math.random() * 0.4, center.z + (Math.random() - 0.5) * spread * 2),
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.5 - Math.random(), (Math.random() - 0.5) * 0.6),
        life: 5 + Math.random() * 3, gravity: -1.2, drag: 1.4, color: cols[i % cols.length],
      });
    }
  }

  glassBurst(pos, dir) {
    for (let i = 0; i < 60; i++) {
      this.glow.spawn({ pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, 0)), vel: new THREE.Vector3(dir.x * 4 + (Math.random() - 0.5) * 3, Math.random() * 3, dir.z * 4 + (Math.random() - 0.5) * 3), life: 1.2, size: 0.06, color: new THREE.Color('#cfe0ff').multiplyScalar(1.4), gravity: -9, drag: 0.4 });
    }
  }

  addDizzy(character, life = 3) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, depthWrite: false, transparent: true }));
      s.scale.setScalar(0.14);
      const a = (i / 3) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
      g.add(s);
    }
    this.scene.add(g);
    this.dizzy.push({ character, group: g, life });
  }

  gasAt(pos, ignoreOwner = null) {
    let best = 0;
    for (const c of this.clouds) {
      if (ignoreOwner && c.owner === ignoreOwner) continue;
      const d = c.pos.distanceTo(_v.set(pos.x, c.pos.y, pos.z));
      if (d < c.radius) best = Math.max(best, (1 - d / c.radius) * Math.min(1, c.life / 2));
    }
    return best;
  }

  update(dt) {
    this.gas.update(dt);
    this.glow.update(dt);
    this.drops.update(dt);
    this.money.update(dt);
    this.confetti.update(dt);
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      c.radius += dt * 0.15;
      if (c.life <= 0) this.clouds.splice(i, 1);
    }
    for (let i = this.dizzy.length - 1; i >= 0; i--) {
      const d = this.dizzy[i];
      d.life -= dt;
      d.character.headWorld(_v);
      d.group.position.set(_v.x, _v.y + 0.18 * d.character.scale, _v.z);
      d.group.rotation.y += dt * 5;
      if (d.life <= 0) { this.scene.remove(d.group); this.dizzy.splice(i, 1); }
    }
  }
}
