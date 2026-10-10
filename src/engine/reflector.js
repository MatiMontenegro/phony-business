// Planar reflections for the floor (y = 0): the scene is rendered from a
// mirrored camera into a small target with mipmaps; floor materials sample it
// projectively and blur it by their roughness.
import * as THREE from 'three';

export class FloorReflector {
  constructor(renderer, { scale = 0.5 } = {}) {
    this.renderer = renderer;
    this.scale = scale;
    this.enabled = true;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.enableAll();
    this.target = new THREE.WebGLRenderTarget(256, 256, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.textureMatrix = new THREE.Matrix4();
    this.uniforms = {
      tReflect: { value: this.target.texture },
      uReflectMatrix: { value: this.textureMatrix },
      uReflectStrength: { value: 0 },
    };
    this.hidden = []; // objects not to draw in the mirror (the floor itself)
    this.frame = 0;
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
  }

  setSize(w, h) {
    const s = this.scale;
    this.target.setSize(Math.max(64, Math.round(w * s)), Math.max(64, Math.round(h * s)));
  }

  setStrength(v) { this.uniforms.uReflectStrength.value = v; }

  // patch a MeshStandardMaterial so it adds the mirrored scene
  apply(material, { strength = 1, rough = 1 } = {}) {
    const u = this.uniforms;
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.tReflect = u.tReflect;
      sh.uniforms.uReflectMatrix = u.uReflectMatrix;
      sh.uniforms.uReflectStrength = u.uReflectStrength;
      sh.uniforms.uReflectLocal = { value: strength };
      sh.uniforms.uReflectRough = { value: rough };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uReflectMatrix;\nvarying vec4 vReflUv;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vReflUv = uReflectMatrix * modelMatrix * vec4(transformed, 1.0);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tReflect;\nuniform float uReflectStrength;\nuniform float uReflectLocal;\nuniform float uReflectRough;\nvarying vec4 vReflUv;')
        .replace('#include <opaque_fragment>', `
  {
    float rgh = clamp(roughnessFactor * uReflectRough, 0.0, 1.0);
    vec3 nv = normalize(vViewPosition);
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, nv), 0.0, 1.0), 5.0);
    vec4 ruv = vReflUv;
    ruv.xy += normal.xz * 0.02 * ruv.w;
    vec3 refl = textureProj(tReflect, ruv, rgh * 5.0).rgb;
    float k = uReflectStrength * uReflectLocal * mix(0.55, 1.0, fres) * (1.0 - rgh * 0.85);
    outgoingLight += refl * k;
  }
#include <opaque_fragment>`);
    };
    const key = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : () => '';
    material.customProgramCacheKey = () => key() + '|refl';
    material.needsUpdate = true;
  }

  update(scene, camera, every = 1) {
    if (!this.enabled || this.uniforms.uReflectStrength.value <= 0) return;
    this.frame++;
    if (every > 1 && this.frame % every) return;
    const cam = this.camera;
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < 0.05) return;
    // mirror the camera across y = 0
    cam.position.set(camPos.x, -camPos.y, camPos.z);
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    look.y = -look.y;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    up.y = -up.y;
    cam.up.copy(up);
    cam.lookAt(cam.position.clone().add(look));
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    // oblique near plane = the floor (Lengyel)
    const plane = this._plane.clone().applyMatrix4(cam.matrixWorldInverse);
    const clip = this._clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = cam.projectionMatrix;
    const q = this._q;
    q.x = (Math.sign(clip.x) + p.elements[8]) / p.elements[0];
    q.y = (Math.sign(clip.y) + p.elements[9]) / p.elements[5];
    q.z = -1.0;
    q.w = (1.0 + p.elements[10]) / p.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    p.elements[2] = clip.x;
    p.elements[6] = clip.y;
    p.elements[10] = clip.z + 1.0 - 0.003;
    p.elements[14] = clip.w;
    cam.projectionMatrixInverse.copy(p).invert();
    // texture matrix: world -> mirror clip space -> [0,1]
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // render
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevShadow = r.shadowMap.autoUpdate;
    const prevXr = r.xr.enabled;
    r.xr.enabled = false;
    r.shadowMap.autoUpdate = false;
    for (const o of this.hidden) o.visible = false;
    const fog = scene.fog;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, cam);
    for (const o of this.hidden) o.visible = true;
    scene.fog = fog;
    r.setRenderTarget(prevTarget);
    r.shadowMap.autoUpdate = prevShadow;
    r.xr.enabled = prevXr;
  }

  dispose() { this.target.dispose(); }
}
