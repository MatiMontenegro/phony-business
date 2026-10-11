// WebGL2 renderer + post stack: ground-truth-ish AO (N8AO), bloom, AgX tone
// mapping, depth of field when sitting at a desk, film grain, SMAA, planar
// floor reflections and screen shake.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, HueSaturationEffect, BrightnessContrastEffect, DepthOfFieldEffect,
  ChromaticAberrationEffect, ShaderPass,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { FloorReflector } from './reflector.js';
import { settings } from '../settings.js';

// post: false renders straight to the screen (tone mapping in the materials),
// skipping every full-screen pass: the mobile path. lod: metres within which
// characters keep their small face/clothing parts. lights: 'full' or 'lite'
// (no area lights or per-desk monitor glows).
// Known (pre-existing): ultra logs WebGL 'texture format / sampler type' warnings
// at startup (N8AO 'Medium'); other levels are clean.
export const QUALITY_PRESETS = {
  low: { pixelRatio: 1, post: false, shadows: false, shadowSize: 1024, ao: null, bloom: false, smaa: false, grain: false, dof: false, reflect: 0, avatar: 'low', lod: 5, lights: 'lite', texScale: 0.6 },
  medium: { pixelRatio: 1, post: true, shadows: true, shadowSize: 1024, ao: null, bloom: true, smaa: false, grain: false, dof: false, reflect: 0, avatar: 'low', lod: 7, lights: 'lite' },
  high: { pixelRatio: 1.5, post: true, shadows: true, shadowSize: 2048, ao: 'Low', aoHalf: true, bloom: true, smaa: true, grain: true, dof: true, reflect: 0.35, avatar: 'high', lod: 10, lights: 'full' },
  ultra: { pixelRatio: 2, post: true, shadows: true, shadowSize: 4096, ao: 'Medium', aoHalf: false, bloom: true, smaa: true, grain: true, dof: true, reflect: 0.5, avatar: 'high', lod: 14, lights: 'full' },
};

let _sanitize = null;
function sanitizeMaterial() {
  if (_sanitize) return _sanitize;
  _sanitize = new THREE.ShaderMaterial({
    uniforms: { inputBuffer: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D inputBuffer; varying vec2 vUv;',
      // NaN fails every comparison; tested two ways so no driver optimises it out
      'bool bad(float x) { return isnan(x) || !(x == x); }',
      'void main() {',
      '  vec4 c = texture2D(inputBuffer, vUv);',
      '  if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);',
      // +Inf (fp16 overflow on a hot highlight) becomes a bright but finite pixel
      '  gl_FragColor = vec4(min(max(c.rgb, vec3(0.0)), vec3(24.0)), clamp(c.a, 0.0, 1.0));',
      '}',
    ].join('\n'),
    depthWrite: false, depthTest: false,
  });
  return _sanitize;
}

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
    // world matrices are refreshed once per frame in render(), not again by
    // every pass (main, shadows, AO...) that draws the scene
    this.scene.matrixWorldAutoUpdate = false;
    // the scene root never moves; if it recomputed its matrix it would force
    // every frozen (static) object below it to recompute theirs too
    this.scene.matrixAutoUpdate = false;
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
    this.dynScale = 1; // extra resolution scale the auto-tuner lowers on slow devices
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
    const refl = settings.get('graphics.reflections') !== false ? q.reflect : 0;
    this.reflector.setStrength(refl);
    this.dof = null;
    this.aoPass = null;
    this.bloom = null;
    this.chroma = null;
    if (!q.post) {
      // mobile path: no full-screen passes at all; the materials tone-map and
      // write sRGB straight to the canvas
      this.composer = null;
      this.renderer.toneMapping = THREE.AgXToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      return;
    }
    this.renderer.toneMapping = THREE.NoToneMapping;
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
    // guard: a single NaN/Inf pixel (e.g. a degenerate normal) gets spread over the
    // whole screen by the mipmap bloom and shows up as a one-frame white flash.
    // Scrub those pixels and cap extreme highlights before any effect runs.
    c.addPass(new ShaderPass(sanitizeMaterial(), 'inputBuffer'));
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
  }

  setReflections(on) { this.reflector.setStrength(on ? this.quality.reflect : 0); }

  // Compile the scene's shaders now (in parallel where the browser supports it)
  // so the first frames of play do not stall on them; on phones each compile
  // can freeze the game for a moment.
  warm() {
    this.scene.updateMatrixWorld();
    try {
      // without the parallel-compile extension compileAsync only warns; compile once, now
      if (this.renderer.extensions.has('KHR_parallel_shader_compile')) return this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
      this.renderer.compile(this.scene, this.camera);
    } catch { /* warming is only an optimisation */ }
    return Promise.resolve();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) * this.dynScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
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

  // the expensive part of a frame: one matrix refresh, then the passes
  draw(dt) {
    this.scene.updateMatrixWorld();
    this.reflector.update(this.scene, this.camera, this.quality.reflect >= 0.5 ? 1 : 2);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  render(dt) {
    // dof easing
    if (this.dof) {
      this.dofAmount += ((this.dofOn ? 1 : 0) - this.dofAmount) * Math.min(1, dt * 4);
      this.dof.bokehScale = this.dofAmount * 2.2;
      this.dof.cocMaterial.focusDistance = this.dofFocus;
      this.dof.cocMaterial.focusRange = 0.35 + this.dofFocus * 0.35;
    }
    if (this.chroma) {
      if (this.aberration > 0.001) {
        this.aberration *= Math.exp(-dt * 5);
        const a = this.aberration * 0.006;
        this.chroma.offset.set(a, a * 0.6);
      } else if (this.chroma.offset.x) this.chroma.offset.set(0, 0);
    } else this.aberration = 0;
    const cam = this.camera;
    if (this.shake > 0.001) {
      const s = this.shake * 0.12;
      this._shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      cam.position.add(this._shakeOffset);
      cam.updateMatrixWorld();
      this.draw(dt);
      cam.position.sub(this._shakeOffset);
      this.shake *= Math.exp(-dt * 6);
    } else {
      cam.updateMatrixWorld();
      this.draw(dt);
    }
  }
}
