// Glossy puddles that grow, linger and dry up. People slip on them.
import * as THREE from 'three';

export class Puddles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.mat = new THREE.MeshPhysicalMaterial({
      color: '#f0d34a', roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
      transparent: true, opacity: 0.8, envMapIntensity: 2.4, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.geos = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CircleGeometry(1, 32);
      const p = g.attributes.position;
      for (let i = 1; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x);
        const r = 0.82 + 0.18 * Math.sin(a * 3 + k * 2) + 0.08 * Math.sin(a * 7 + k);
        p.setXY(i, Math.cos(a) * r, Math.sin(a) * r);
      }
      g.rotateX(-Math.PI / 2);
      this.geos.push(g);
    }
  }

  add(pos, size = 0.7, life = 120) {
    const mesh = new THREE.Mesh(this.geos[Math.floor(Math.random() * this.geos.length)], this.mat);
    mesh.position.set(pos.x, 0.016 + this.list.length * 0.0005, pos.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.setScalar(0.01);
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    const p = { mesh, size, age: 0, life, pos: new THREE.Vector3(pos.x, 0, pos.z) };
    this.list.push(p);
    if (this.list.length > 20) this.remove(this.list[0]);
    return p;
  }

  // feed a puddle (a stream landing on the floor); returns the puddle
  feed(pos, amount) {
    let p = this.at(pos, 0.15);
    if (!p) p = this.add(pos, 0.12, 120);
    p.size = Math.min(1.1, p.size + amount);
    p.age = Math.min(p.age, 0.8);
    return p;
  }

  at(pos, pad = 0) {
    for (const p of this.list) {
      const r = p.mesh.scale.x * 0.85 + pad;
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
      if (dx * dx + dz * dz < r * r) return p;
    }
    return null;
  }

  remove(p) {
    this.scene.remove(p.mesh);
    this.list.splice(this.list.indexOf(p), 1);
  }

  clear() { while (this.list.length) this.remove(this.list[0]); }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      const grow = Math.min(1, p.age / 0.8);
      const dry = p.age > p.life - 6 ? Math.max(0, (p.life - p.age) / 6) : 1;
      p.mesh.scale.setScalar(Math.max(0.01, p.size * (0.3 + 0.7 * grow) * dry));
      if (p.age >= p.life) this.remove(p);
    }
  }
}
