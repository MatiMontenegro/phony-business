// WebGL2 renderer + post stack: ground-truth-ish AO (N8AO), bloom, AgX tone
// mapping, depth of field when sitting at a desk, film grain, SMAA, planar
// floor reflections and screen shake.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, HueSaturationEffect, BrightnessContrastEffect, DepthOfFieldEffect,
  ChromaticAberrationEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { FloorReflector } from './reflector.js';
import { settings } from '../settings.js';

export const QUALITY_PRESETS = {
  low: { pixelRatio: 0.75, shadows: false, shadowSize: 1024, ao: null, bloom: true, smaa: false, grain: false, dof: false, reflect: 0, avatar: 'low' },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, ao: 'Performance', aoHalf: true, bloom: true, smaa: true, grain: true, dof: false, reflect: 0, avatar: 'low' },
  high: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, ao: 'Low', aoHalf: true, bloom: true, smaa: true, grain: true, dof: true, reflect: 0.35, avatar: 'high' },
  ultra: { pixelRatio: 2, shadows: true, shadowSize: 4096, ao: 'Medium', aoHalf: false, bloom: true, smaa: true, grain: true, dof: true, reflect: 0.5, avatar: 'high' },
};

export class Renderer {
  constructor(container, opts = {}) {
    this.container = container;
    const r = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.className = 'game-canvas';
    container.appendChild(r.domElement);
    this.renderer = r;
    RectAreaLightUniformsLib.init();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.get('graphics.fov') || 60, 1, 0.06, 220);
    this.camera.position.set(0, 3, 8);
    const pm = new THREE.PMREMGenerator(r);
    this.envTexture = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.26;
    this.qualityName = opts.quality || 'high';
    this.quality = QUALITY_PRESETS[this.qualityName];
    this.reflector = new FloorReflector(r, { scale: 0.5 });
    this.composer = null;
    this.shake = 0;
    this._shakeOffset = new THREE.Vector3();
    this.dofOn = false;
    this.dofAmount = 0;
    this.dofFocus = 1;
    this.aberration = 0;
    this.buildComposer();
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  setQuality(name) {
    if (!QUALITY_PRESETS[name]) return;
    this.qualityName = name;
    this.quality = QUALITY_PRESETS[name];
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.scene.traverse((o) => {
      if (o.isLight && o.castShadow && o.shadow) {
        o.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
        if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
      }
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
    });
    this.buildComposer();
    this.resize();
    if (this.onQuality) this.onQuality(name);
  }

  buildComposer() {
    if (this.composer) this.composer.dispose();
    const q = this.quality;
    this.renderer.shadowMap.enabled = q.shadows;
    const c = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(this.scene, this.camera));
    this.aoPass = null;
    if (q.ao) {
      const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
      const ao = new N8AOPostPass(this.scene, this.camera, w, h);
      ao.setQualityMode(q.ao);
      ao.configuration.halfRes = !!q.aoHalf;
      ao.configuration.aoRadius = 0.5;
      ao.configuration.distanceFalloff = 1;
      ao.configuration.intensity = 3.0;
      ao.configuration.color = new THREE.Color('#120a24');
      ao.configuration.gammaCorrection = false;
      c.addPass(ao);
      this.aoPass = ao;
    }
    this.dof = null;
    if (q.dof) {
      this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 1, focusRange: 0.6, bokehScale: 0, resolutionScale: 0.5 });
      c.addPass(new EffectPass(this.camera, this.dof));
    }
    const fx = [];
    if (q.bloom) {
      this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.96, luminanceSmoothing: 0.14, intensity: 0.95, radius: 0.62 });
      fx.push(this.bloom);
    }
    this.chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.2 });
    fx.push(this.chroma);
    fx.push(new HueSaturationEffect({ saturation: 0.08 }));
    fx.push(new BrightnessContrastEffect({ contrast: 0.1 }));
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.55 });
    fx.push(this.vignette);
    if (q.grain) {
      const n = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
      n.blendMode.opacity.value = 0.035;
      fx.push(n);
    }
    c.addPass(new EffectPass(this.camera, ...fx));
    if (q.smaa) c.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    this.composer = c;
    const refl = settings.get('graphics.reflections') !== false ? q.reflect : 0;
    this.reflector.setStrength(refl);
  }

  setReflections(on) { this.reflector.setStrength(on ? this.quality.reflect : 0); }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.reflector.setSize(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  addShake(v) {
    if (settings.get('graphics.shake') === false) return;
    this.shake = Math.min(1.2, this.shake + v);
  }

  hitFlash(v = 1) { this.aberration = Math.min(1, this.aberration + v); }

  // depth of field: focus on something at `dist` metres (0 = off)
  setFocus(on, dist = 1) {
    this.dofOn = on;
    if (on) this.dofFocus = dist;
  }

  render(dt) {
    // dof easing
    if (this.dof) {
      this.dofAmount += ((this.dofOn ? 1 : 0) - this.dofAmount) * Math.min(1, dt * 4);
      this.dof.bokehScale = this.dofAmount * 2.2;
      this.dof.cocMaterial.focusDistance = this.dofFocus;
      this.dof.cocMaterial.focusRange = 0.35 + this.dofFocus * 0.35;
    }
    if (this.aberration > 0.001) {
      this.aberration *= Math.exp(-dt * 5);
      const a = this.aberration * 0.006;
      this.chroma.offset.set(a, a * 0.6);
    } else if (this.chroma.offset.x) this.chroma.offset.set(0, 0);
    const cam = this.camera;
    if (this.shake > 0.001) {
      const s = this.shake * 0.12;
      this._shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      cam.position.add(this._shakeOffset);
      cam.updateMatrixWorld();
      this.reflector.update(this.scene, cam, this.quality.reflect >= 0.5 ? 1 : 2);
      this.composer.render(dt);
      cam.position.sub(this._shakeOffset);
      this.shake *= Math.exp(-dt * 6);
    } else {
      cam.updateMatrixWorld();
      this.reflector.update(this.scene, cam, this.quality.reflect >= 0.5 ? 1 : 2);
      this.composer.render(dt);
    }
  }
}
