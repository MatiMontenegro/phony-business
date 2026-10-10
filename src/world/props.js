// Dynamic props: rolling chairs, bins, lead boxes, the wet-floor sign and
// staplers thrown by the boss.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { R } from '../engine/physics.js';
import { GROUP, groups } from '../config.js';
import * as TX from '../engine/textures.js';

const propGroups = () => groups(GROUP.PROP, GROUP.STATIC | GROUP.PROP | GROUP.CHAR | GROUP.RAGDOLL | GROUP.PROJECTILE);

function part(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export class Props {
  constructor(scene, physics, office, lang = 'en') {
    this.scene = scene;
    this.physics = physics;
    this.list = [];
    this.chairs = [];
    this.staplers = [];
    this.lang = lang;
    this.mats = {
      seat: new THREE.MeshStandardMaterial({ ...TX.fabric('#2c2a4a'), roughness: 0.9 }),
      plastic: new THREE.MeshStandardMaterial({ color: '#1d1930', roughness: 0.45 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d9dce6', metalness: 1, roughness: 0.2 }),
      bin: new THREE.MeshStandardMaterial({ color: '#3b3560', roughness: 0.5, side: THREE.DoubleSide }),
      paper: new THREE.MeshStandardMaterial({ color: '#f3f0e8', roughness: 0.9 }),
      cardboard: new THREE.MeshStandardMaterial({ map: this.boxLabel(), roughness: 0.85 }),
      wet: new THREE.MeshStandardMaterial({ map: TX.wetFloor(lang), roughness: 0.4 }),
      yellow: new THREE.MeshStandardMaterial({ color: '#ffd84d', roughness: 0.4 }),
      stapler: new THREE.MeshPhysicalMaterial({ color: '#ff4d5e', roughness: 0.3, clearcoat: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: '#221c38', roughness: 0.4 }),
    };
    for (const d of office.desks) {
      const c = this.addChair(d.chairSpawn, d.facing);
      c.desk = d;
      d.chair = c;
      this.chairs.push(c);
    }
    for (const [x, z] of [[-6.2, -0.3], [6.2, 2], [-2.2, 2.4], [2.2, -0.6], [-10.2, -1.6], [8.6, 8.8]]) this.addBin(x, z);
    for (let i = 0; i < 3; i++) this.addBox(7.3, 0.18 + i * 0.36, 9.3, i * 0.2);
    this.addBox(7.85, 0.18, 9.35, 0.5);
    this.addBox(-8.4, 0.18, -8.9, 0.1);
    this.addBox(-8.4, 0.54, -8.9, 0.4);
    this.addWetSign(-8.3, -2.2, 0.6);
  }

  boxLabel() {
    const c = TX.canvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#b98a55';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, 118, 256, 20);
    g.fillStyle = '#3a2410';
    g.font = `bold 46px ${TX.FONT.mono}`;
    g.textAlign = 'center';
    g.fillText(this.lang === 'es' ? 'CLIENTES' : 'LEADS', 128, 100);
    g.font = `bold 22px ${TX.FONT.mono}`;
    g.fillText(this.lang === 'es' ? 'FRÁGIL: GENTE' : 'FRAGILE: PEOPLE', 128, 190);
    return TX.tex(c);
  }

  makeBody(p, yaw, { linDamp = 0.4, angDamp = 0.6, ccd = false } = {}) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return this.physics.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(linDamp).setAngularDamping(angDamp).setCcdEnabled(ccd),
    );
  }

  register(group, body, extra = {}) {
    this.scene.add(group);
    const p = { group, body, ...extra };
    this.list.push(p);
    return p;
  }

  addChair(pos, facing) {
    const mm = this.mats;
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = part(new RoundedBoxGeometry(0.3, 0.035, 0.05, 2, 0.015), mm.plastic, g, Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15, 0, a + Math.PI / 2, 0);
      leg.castShadow = false;
      part(new THREE.SphereGeometry(0.03, 10, 8), mm.dark, g, Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29);
    }
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 12), mm.chrome, g, 0, 0.25, 0);
    part(new RoundedBoxGeometry(0.52, 0.08, 0.5, 3, 0.035), mm.seat, g, 0, 0.44, 0);
    part(new RoundedBoxGeometry(0.5, 0.52, 0.08, 3, 0.035), mm.seat, g, 0, 0.8, -0.24, -0.1);
    part(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), mm.chrome, g, 0, 0.55, -0.24);
    for (const s of [-1, 1]) part(new RoundedBoxGeometry(0.06, 0.04, 0.32, 2, 0.015), mm.plastic, g, 0.27 * s, 0.62, -0.02);
    // the backrest is at local -z: a chair faces +z, the same way as whoever sits on it
    const body = this.makeBody(new THREE.Vector3(pos.x, 0.02, pos.z), facing, { linDamp: 1.6, angDamp: 1.2 });
    const w = this.physics.world, cg = propGroups();
    w.createCollider(R.ColliderDesc.cylinder(0.04, 0.3).setTranslation(0, 0.05, 0).setFriction(0.05).setDensity(0.6).setCollisionGroups(cg), body);
    w.createCollider(R.ColliderDesc.cuboid(0.26, 0.05, 0.25).setTranslation(0, 0.44, 0).setDensity(0.4).setCollisionGroups(cg), body);
    w.createCollider(R.ColliderDesc.cuboid(0.25, 0.26, 0.04).setTranslation(0, 0.8, -0.24).setDensity(0.2).setCollisionGroups(cg), body);
    w.createCollider(R.ColliderDesc.cylinder(0.12, 0.04).setTranslation(0, 0.24, 0).setDensity(0.4).setCollisionGroups(cg), body);
    return this.register(g, body, { kind: 'chair' });
  }

  addBin(x, z) {
    const mm = this.mats;
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.19, 0.16, 0.42, 20, 1, true), mm.bin, g, 0, 0.21, 0);
    part(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), mm.bin, g, 0, 0.01, 0);
    part(new THREE.TorusGeometry(0.19, 0.012, 6, 24), mm.dark, g, 0, 0.42, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) part(new THREE.IcosahedronGeometry(0.06, 0), mm.paper, g, Math.sin(i * 1.7) * 0.08, 0.36 + (i % 2) * 0.04, Math.cos(i * 1.7) * 0.08);
    const body = this.makeBody(new THREE.Vector3(x, 0.01, z), 0, { linDamp: 0.6, angDamp: 0.6 });
    this.physics.world.createCollider(R.ColliderDesc.cylinder(0.21, 0.18).setTranslation(0, 0.21, 0).setDensity(0.3).setFriction(0.5).setCollisionGroups(propGroups()), body);
    return this.register(g, body, { kind: 'bin' });
  }

  addBox(x, y, z, yaw) {
    const g = new THREE.Group();
    part(new RoundedBoxGeometry(0.46, 0.36, 0.38, 2, 0.02), this.mats.cardboard, g);
    const body = this.makeBody(new THREE.Vector3(x, y, z), yaw, { linDamp: 0.3, angDamp: 0.4 });
    this.physics.world.createCollider(R.ColliderDesc.cuboid(0.23, 0.18, 0.19).setDensity(0.25).setFriction(0.7).setCollisionGroups(propGroups()), body);
    return this.register(g, body, { kind: 'box' });
  }

  addWetSign(x, z, yaw) {
    const g = new THREE.Group();
    for (const s of [1, -1]) part(new THREE.BoxGeometry(0.34, 0.6, 0.012), this.mats.wet, g, 0, 0.3, 0.1 * s, 0.17 * s, s < 0 ? Math.PI : 0);
    part(new THREE.BoxGeometry(0.34, 0.03, 0.03), this.mats.yellow, g, 0, 0.6, 0);
    const body = this.makeBody(new THREE.Vector3(x, 0.01, z), yaw, { linDamp: 0.4, angDamp: 0.5 });
    this.physics.world.createCollider(R.ColliderDesc.cuboid(0.17, 0.3, 0.12).setTranslation(0, 0.3, 0).setDensity(0.2).setCollisionGroups(propGroups()), body);
    return this.register(g, body, { kind: 'wet' });
  }

  spawnStapler(pos, vel, spin) {
    const g = new THREE.Group();
    part(new RoundedBoxGeometry(0.18, 0.05, 0.06, 2, 0.015), this.mats.stapler, g);
    part(new RoundedBoxGeometry(0.17, 0.035, 0.05, 2, 0.012), this.mats.dark, g, 0, 0.045, 0, 0, 0, -0.08);
    const body = this.physics.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinvel(vel.x, vel.y, vel.z).setAngvel(spin || { x: 8, y: 2, z: 14 }).setCcdEnabled(true),
    );
    this.physics.world.createCollider(
      R.ColliderDesc.cuboid(0.09, 0.04, 0.03).setDensity(2).setRestitution(0.3).setCollisionGroups(groups(GROUP.PROJECTILE, GROUP.STATIC | GROUP.PROP | GROUP.RAGDOLL)),
      body,
    );
    const p = this.register(g, body, { kind: 'stapler', life: 9, armed: true });
    this.staplers.push(p);
    return p;
  }

  holdChair(chair, seat, facing) {
    const b = chair.body;
    b.setBodyType(R.RigidBodyType.KinematicPositionBased, true);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing);
    b.setNextKinematicTranslation({ x: seat.x, y: 0.02, z: seat.z });
    b.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    chair.held = true;
  }

  releaseChair(chair) {
    chair.body.setBodyType(R.RigidBodyType.Dynamic, true);
    chair.held = false;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      const t = p.body.translation(), r = p.body.rotation();
      p.group.position.set(t.x, t.y, t.z);
      p.group.quaternion.set(r.x, r.y, r.z, r.w);
      if (p.life === undefined) {
        if (t.y < -3 || !Number.isFinite(t.y)) { p.body.setTranslation({ x: 0, y: 0.5, z: 3 }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      } else {
        p.life -= dt;
        if (p.life <= 0 || t.y < -5) this.remove(p);
      }
    }
  }

  remove(p) {
    this.scene.remove(p.group);
    this.physics.world.removeRigidBody(p.body);
    this.list.splice(this.list.indexOf(p), 1);
    const i = this.staplers.indexOf(p);
    if (i >= 0) this.staplers.splice(i, 1);
  }
}
