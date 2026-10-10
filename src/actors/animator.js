// Procedural animation: picks a target pose for the current state and eases
// the live pose toward it. Angles in radians; character faces +Z.
// Conventions: negative arm/leg pitch swings the limb forward, positive knee
// bends the shin back, negative elbow bends the forearm forward, positive
// torso/head pitch leans forward / looks down.
import { DIM, defaultPose } from './skeleton.js';

const KEYS = Object.keys(defaultPose());

export class Animator {
  constructor() {
    this.P = defaultPose();
    this.T = defaultPose();
    this.phase = Math.random() * 6;
    this.t = Math.random() * 10;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lookTimer = 0;
    this.gesture = 0;
    this.override = null; // external look target (head yaw/pitch)
  }

  update(dt, s) {
    this.t += dt;
    const t = this.t;
    const r = this.T;
    Object.assign(r, defaultPose());
    const speed = s.speed || 0;
    let rate = 12;
    this.lookTimer -= dt;
    if (this.lookTimer < 0) {
      this.lookYaw = (Math.random() - 0.5) * 0.9;
      this.lookPitch = (Math.random() - 0.5) * 0.2;
      this.lookTimer = 1.5 + Math.random() * 3;
    }
    const br = Math.sin(t * 1.9);
    switch (s.state) {
      case 'move': {
        const run = Math.min(1, Math.max(0, (speed - 2.2) / 2.6));
        const stride = 1.15 + run * 0.9; // metres per step pair / 2
        this.phase += (speed * dt / stride) * Math.PI;
        const p = this.phase;
        const amp = Math.min(1, 0.25 + speed / 2.4);
        const legAmp = (0.5 + run * 0.32) * amp;
        r.legLPitch = -Math.sin(p) * legAmp;
        r.legRPitch = Math.sin(p) * legAmp;
        r.kneeL = Math.max(0, Math.sin(p - Math.PI / 2)) * (0.9 + run * 0.7) * amp + 0.06;
        r.kneeR = Math.max(0, Math.sin(p + Math.PI / 2)) * (0.9 + run * 0.7) * amp + 0.06;
        const armAmp = (0.32 + run * 0.42) * amp;
        r.armLPitch = Math.sin(p) * armAmp;
        r.armRPitch = -Math.sin(p) * armAmp;
        r.elbowL = -0.22 - run * 1.05 - Math.max(0, -Math.sin(p)) * 0.2;
        r.elbowR = -0.22 - run * 1.05 - Math.max(0, Math.sin(p)) * 0.2;
        r.armLRoll = 0.08 + run * 0.06;
        r.armRRoll = -0.08 - run * 0.06;
        r.hipsY = DIM.hipY - 0.02 * amp - run * 0.03 + Math.abs(Math.cos(p)) * (0.028 + run * 0.03) * amp;
        r.hipsYaw = Math.sin(p) * 0.1 * amp;
        r.hipsRoll = Math.cos(p) * 0.03 * amp;
        r.torsoYaw = -Math.sin(p) * (0.12 + run * 0.08) * amp;
        r.torsoPitch = 0.03 + run * 0.16;
        r.torsoRoll = -Math.cos(p) * 0.025 * amp;
        r.headPitch = -run * 0.06;
        r.headYaw = Math.sin(p) * 0.04 * amp;
        rate = 22;
        if (s.wobble) {
          // desperately holding it in
          r.legLRoll = -0.06; r.legRRoll = 0.06;
          r.kneeL += 0.15; r.kneeR += 0.15;
          r.armLPitch = -0.4; r.armRPitch = -0.4;
          r.armLRoll = -0.25; r.armRRoll = 0.25;
          r.elbowL = -0.9; r.elbowR = -0.9;
          r.torsoPitch = 0.14;
        }
        break;
      }
      case 'air': {
        const up = s.vy > 0 ? 1 : 0;
        r.armLRoll = 0.6 + up * 0.5; r.armRRoll = -0.6 - up * 0.5;
        r.armLPitch = -0.3; r.armRPitch = -0.3;
        r.elbowL = -0.5; r.elbowR = -0.5;
        r.legLPitch = -0.5; r.kneeL = 0.85;
        r.legRPitch = 0.12; r.kneeR = 0.45;
        r.torsoPitch = -0.06;
        r.headPitch = up ? -0.15 : 0.12;
        rate = 10;
        break;
      }
      case 'sit': {
        r.hipsY = 0.585; r.hipsZ = -0.03;
        r.legLPitch = -1.5; r.legRPitch = -1.5;
        r.kneeL = 1.48; r.kneeR = 1.48;
        r.legLRoll = 0.07; r.legRRoll = -0.07;
        r.torsoPitch = 0.08;
        // hands on the keyboard
        r.armLPitch = -0.42; r.armRPitch = -0.42;
        r.elbowL = -1.32; r.elbowR = -1.32;
        r.armLRoll = 0.16; r.armRRoll = -0.16;
        r.armLYaw = -0.12; r.armRYaw = 0.12;
        r.headPitch = 0.16;
        if (s.typing) {
          r.elbowL += Math.sin(t * 19) * 0.06;
          r.elbowR += Math.sin(t * 23 + 1) * 0.06;
          r.armLPitch += Math.sin(t * 7) * 0.03;
          r.armRPitch += Math.cos(t * 9) * 0.03;
        }
        if (s.talking) {
          this.gesture += dt;
          if (Math.sin(this.gesture * 1.7) > 0.45 && !s.typing && !s.noGesture) {
            r.armRPitch = -1.1; r.elbowR = -1.25; r.armRRoll = -0.32 - Math.sin(t * 5) * 0.16;
            r.armRYaw = 0.3;
          }
          r.headYaw = Math.sin(t * 1.3) * 0.12;
          r.headRoll = Math.sin(t * 2.3) * 0.06;
          r.torsoPitch = 0.04 + Math.sin(t * 1.1) * 0.03;
        }
        if (s.lean) {
          // leaning back, arms crossed
          r.torsoPitch = -0.16; r.headPitch = 0.05;
          r.armLPitch = -0.6; r.armRPitch = -0.6; r.elbowL = -1.9; r.elbowR = -1.9;
          r.armLRoll = -0.1; r.armRRoll = 0.1; r.armLYaw = -0.5; r.armRYaw = 0.5;
        }
        if (s.sleep) {
          r.torsoPitch = -0.2; r.headPitch = 0.55; r.headRoll = 0.25;
          r.armLPitch = -0.1; r.armRPitch = -0.1; r.elbowL = -0.3; r.elbowR = -0.3;
          r.armLRoll = 0.05; r.armRRoll = -0.05;
        }
        rate = 9;
        break;
      }
      case 'couch': {
        r.hipsY = 0.47; r.hipsZ = -0.06; r.hipsPitch = -0.18;
        r.legLPitch = -1.25; r.legRPitch = -1.25; r.kneeL = 1.2; r.kneeR = 1.2;
        r.legLRoll = 0.12; r.legRRoll = -0.12;
        r.torsoPitch = -0.12;
        r.armLRoll = 0.45; r.armRRoll = -0.45; r.elbowL = -0.3; r.elbowR = -0.3;
        r.headPitch = s.sleep ? 0.3 : -0.05; r.headRoll = s.sleep ? 0.35 : 0;
        rate = 6;
        break;
      }
      case 'toilet': {
        r.hipsY = 0.55; r.hipsZ = -0.04;
        r.legLPitch = -1.45; r.legRPitch = -1.45;
        r.kneeL = 1.45; r.kneeR = 1.45;
        r.legLRoll = 0.16; r.legRRoll = -0.16;
        // elbows on the knees, chin on the hands
        r.torsoPitch = 0.62;
        r.armLPitch = -0.38; r.armRPitch = -0.38;
        r.elbowL = -2.15; r.elbowR = -2.15;
        r.armLRoll = -0.12; r.armRRoll = 0.12;
        r.armLYaw = -0.2; r.armRYaw = 0.2;
        r.headPitch = s.relief ? -0.45 : -0.2;
        r.headRoll = Math.sin(t * 1.5) * 0.08;
        rate = 8;
        break;
      }
      case 'pee': {
        // standing, back to the room, hands busy, whistling at the ceiling
        r.legLRoll = 0.08; r.legRRoll = -0.08;
        r.hipsZ = 0.025; r.hipsPitch = -0.08;
        r.torsoPitch = -0.1;
        r.armLPitch = -0.18; r.armRPitch = -0.18;
        r.elbowL = -0.75; r.elbowR = -0.75;
        r.armLRoll = -0.25; r.armRRoll = 0.25;
        r.armLYaw = -0.35; r.armRYaw = 0.35;
        r.headPitch = s.relief ? -0.32 : 0.35;
        r.headYaw = Math.sin(t * 0.8) * 0.25;
        r.hipsY = DIM.hipY + Math.sin(t * 2) * 0.003;
        rate = 8;
        break;
      }
      case 'potty': {
        const w = Math.sin(t * 14);
        r.hipsY = DIM.hipY - 0.03 + Math.abs(w) * 0.025;
        r.legLRoll = -0.1; r.legRRoll = 0.1;
        r.legLPitch = w > 0 ? -0.3 : 0; r.kneeL = w > 0 ? 0.6 : 0.1;
        r.legRPitch = w < 0 ? -0.3 : 0; r.kneeR = w < 0 ? 0.6 : 0.1;
        r.armLPitch = -0.5; r.armRPitch = -0.5;
        r.armLRoll = -0.25; r.armRRoll = 0.25;
        r.elbowL = -1.0; r.elbowR = -1.0;
        r.torsoPitch = 0.14;
        r.headRoll = Math.sin(t * 9) * 0.1;
        rate = 20;
        break;
      }
      case 'charge': {
        const c = s.charge || 0;
        const j = Math.sin(t * 60) * 0.025 * c;
        r.hipsY = DIM.hipY - 0.12 - c * 0.1; r.hipsZ = -0.06 * c;
        r.legLPitch = -0.7 - c * 0.3; r.legRPitch = -0.7 - c * 0.3;
        r.kneeL = 1.2 + c * 0.4; r.kneeR = 1.2 + c * 0.4;
        r.legLRoll = 0.16; r.legRRoll = -0.16;
        r.torsoPitch = 0.5 + c * 0.15 + j; r.torsoRoll = j;
        r.armLPitch = -0.55; r.armRPitch = -0.55;
        r.armLRoll = 0.4; r.armRRoll = -0.4;
        r.elbowL = -1.1; r.elbowR = -1.1;
        r.headPitch = -0.4;
        rate = 16;
        break;
      }
      case 'fartpop': {
        r.hipsY = DIM.hipY + 0.04; r.hipsZ = -0.06; r.hipsPitch = -0.16;
        r.torsoPitch = -0.12;
        r.armLPitch = 0.5; r.armRPitch = 0.5;
        r.armLRoll = 0.3; r.armRRoll = -0.3;
        r.elbowL = -1.2; r.elbowR = -1.2;
        r.legLPitch = 0.12; r.legRPitch = 0.12;
        r.headPitch = -0.25;
        rate = 25;
        break;
      }
      case 'cough': {
        const c = Math.max(0, Math.sin(t * 9));
        r.torsoPitch = 0.22 + c * 0.22;
        r.headPitch = 0.18 + c * 0.2;
        r.armRPitch = -1.9; r.elbowR = -2.0; r.armRRoll = 0.25;
        r.armLPitch = -0.35; r.elbowL = -0.7;
        rate = 16;
        break;
      }
      case 'wave': {
        // upper arm raised out to the side, forearm up, hand waving side to side
        r.armRRoll = -1.28 + Math.sin(t * 9) * 0.16;
        r.armRPitch = -0.12;
        r.armRYaw = 0.1;
        r.elbowR = -1.5;
        r.headRoll = 0.06; r.headYaw = 0.06; r.torsoRoll = 0.03;
        rate = 12;
        break;
      }
      case 'dance': {
        const p = t * 6;
        r.hipsY = DIM.hipY - 0.05 + Math.abs(Math.sin(p)) * 0.06;
        r.hipsRoll = Math.sin(p) * 0.15;
        r.torsoRoll = -Math.sin(p) * 0.2;
        r.armLRoll = 1.5 + Math.sin(p) * 0.7;
        r.armRRoll = -1.5 + Math.sin(p) * 0.7;
        r.elbowL = -0.8 - Math.sin(p * 2) * 0.5;
        r.elbowR = -0.8 + Math.sin(p * 2) * 0.5;
        r.legLPitch = Math.sin(p) > 0 ? -0.45 : 0; r.kneeL = Math.sin(p) > 0 ? 0.85 : 0.1;
        r.legRPitch = Math.sin(p) < 0 ? -0.45 : 0; r.kneeR = Math.sin(p) < 0 ? 0.85 : 0.1;
        r.headYaw = Math.sin(p * 0.5) * 0.35;
        rate = 18;
        break;
      }
      case 'drink': {
        r.armRPitch = -2.0; r.elbowR = -1.95; r.armRRoll = 0.15;
        r.headPitch = -0.4; r.torsoPitch = -0.08;
        rate = 10;
        break;
      }
      case 'bossWalk': {
        const p = (this.phase += (speed * dt / 1.0) * Math.PI);
        const n = Math.min(1, speed / 2.5);
        r.legLPitch = -Math.sin(p) * 0.5 * n;
        r.legRPitch = Math.sin(p) * 0.5 * n;
        r.kneeL = Math.max(0, Math.sin(p - Math.PI / 2)) * 0.8 * n + 0.05;
        r.kneeR = Math.max(0, Math.sin(p + Math.PI / 2)) * 0.8 * n + 0.05;
        // hands clasped behind the back
        r.armLPitch = 0.5; r.armRPitch = 0.5;
        r.elbowL = -1.3; r.elbowR = -1.3;
        r.armLRoll = -0.12; r.armRRoll = 0.12;
        r.torsoPitch = -0.1;
        r.hipsY = DIM.hipY + Math.abs(Math.cos(p)) * 0.025 * n;
        r.torsoRoll = Math.cos(p) * 0.05 * n;
        rate = 16;
        break;
      }
      case 'throw': {
        if ((s.throwT || 0) < 0.55) { r.armRPitch = -2.7; r.elbowR = -1.4; r.torsoPitch = -0.22; r.torsoYaw = 0.45; }
        else { r.armRPitch = -0.6; r.elbowR = -0.1; r.torsoPitch = 0.32; r.torsoYaw = -0.4; }
        r.legLPitch = -0.35; r.legRPitch = 0.28;
        rate = 26;
        break;
      }
      case 'yell': {
        r.torsoPitch = 0.14 + Math.sin(t * 12) * 0.04;
        r.armLRoll = 0.85 + Math.sin(t * 10) * 0.3;
        r.armRRoll = -0.85 - Math.sin(t * 11) * 0.3;
        r.elbowL = -1.15; r.elbowR = -1.15;
        r.headPitch = -0.1;
        rate = 14;
        break;
      }
      default: {
        r.hipsY = DIM.hipY + br * 0.003;
        r.armLRoll = 0.09 + br * 0.012;
        r.armRRoll = -0.09 - br * 0.012;
        r.elbowL = -0.14; r.elbowR = -0.14;
        r.headYaw = this.lookYaw;
        r.headPitch = this.lookPitch + Math.sin(t * 0.7) * 0.04;
        r.torsoPitch = 0.01 + br * 0.008;
        // weight shift
        const sh = Math.sin(t * 0.37);
        r.hipsX = sh * 0.012; r.hipsRoll = sh * 0.025; r.legLRoll += sh * 0.02; r.legRRoll += sh * 0.02;
        rate = 6;
      }
    }
    if (this.override) {
      r.headYaw = this.override.yaw;
      r.headPitch = this.override.pitch;
    }
    const k = 1 - Math.exp(-dt * rate);
    for (const key of KEYS) this.P[key] += (r[key] - this.P[key]) * k;
    this.P.breath = br;
    return this.P;
  }
}
