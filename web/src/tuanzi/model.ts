import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type Surface = 'felt' | 'soft';

export interface Model {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  bones: Map<string, THREE.Bone>;
  body: THREE.SkinnedMesh[];
  eyes: THREE.Mesh[];
  /** 场景里所有带 blink 形态键的网格 */
  blinkers: { mesh: THREE.Mesh; index: number }[];
  strideLength: number;
  triangles: number;
  bytes: number;
}

/** 读 glb；文件不存在（开发服务器会回退成 index.html）时返回 null。 */
export async function loadModel(url: string): Promise<Model | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength)));
  if (magic !== 'glTF') return null;

  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const bones = new Map<string, THREE.Bone>();
  const body: THREE.SkinnedMesh[] = [];
  const eyes: THREE.Mesh[] = [];
  const blinkers: Model['blinkers'] = [];
  let strideLength = 0;
  let triangles = 0;

  gltf.scene.traverse((object) => {
    if (typeof object.userData.strideLength === 'number') strideLength = object.userData.strideLength;
    if ((object as THREE.Bone).isBone) bones.set(object.name, object as THREE.Bone);
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // 蒙皮网格的包围盒按绑定姿势算，动作一大就会被错误裁掉
    mesh.frustumCulled = false;
    const index = mesh.geometry.index;
    triangles += (index ? index.count : mesh.geometry.attributes.position!.count) / 3;
    const blink = mesh.morphTargetDictionary?.blink;
    if (blink !== undefined) blinkers.push({ mesh, index: blink });
    const materialName = (mesh.material as THREE.Material).name;
    if (materialName.includes('eye')) eyes.push(mesh);
    else if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) body.push(mesh as THREE.SkinnedMesh);
  });

  return { scene: gltf.scene, clips: gltf.animations, bones, body, eyes, blinkers, strideLength, triangles, bytes: buffer.byteLength };
}

interface Look {
  surface: Surface;
  outline: boolean;
  fuzz: boolean;
}

/**
 * 材质与描边的几版对比（方案 4.4）。身体原材质的颜色贴图保留，只换表面参数；
 * 描边是外扩背面，短绒以四层连续纤维薄壳随骨骼变形。
 */
export class Appearance {
  private bodyMaterials = new Map<THREE.SkinnedMesh, THREE.MeshPhysicalMaterial>();
  private eyeMaterials = new Map<THREE.Mesh, THREE.MeshPhysicalMaterial>();
  private outlines: THREE.SkinnedMesh[] = [];
  private shells: THREE.SkinnedMesh[] = [];
  /** 每个材质原本的颜色，乘色时从它算 */
  private readonly baseColors = new Map<THREE.Material & { color: THREE.Color }, THREE.Color>();
  private readonly tint = new THREE.Color(1, 1, 1);

  constructor(private model: Model) {
    for (const mesh of model.body) {
      const source = mesh.material as THREE.MeshStandardMaterial;
      const material = new THREE.MeshPhysicalMaterial({ map: source.map, color: source.color });
      this.bodyMaterials.set(mesh, material);
      mesh.material = material;

      const outline = shareSkin(mesh, makeOutlineMaterial());
      outline.castShadow = false;
      outline.renderOrder = -1;
      this.outlines.push(outline);

      for (let layer = 1; layer <= 4; layer++) {
        const shell = shareSkin(mesh, makeShellMaterial(source.map, source.color, layer));
        shell.castShadow = false;
        this.shells.push(shell);
      }
    }
    for (const mesh of model.eyes) {
      const source = mesh.material as THREE.MeshStandardMaterial;
      const material = new THREE.MeshPhysicalMaterial({ color: source.color });
      this.eyeMaterials.set(mesh, material);
      mesh.material = material;
    }
    for (const mesh of [...model.body, ...model.eyes, ...this.outlines, ...this.shells]) {
      const material = mesh.material as THREE.Material & { color: THREE.Color };
      this.baseColors.set(material, material.color.clone());
    }
  }

  /** 整体乘色，给院子按时段天色压暗或偏色用；默认白色即原色 */
  setTint(color: THREE.ColorRepresentation) {
    this.tint.set(color);
    for (const [material, base] of this.baseColors) material.color.copy(base).multiply(this.tint);
  }

  /**
   * 自发光提亮 0–1：夜里、雨天光线很暗时让团子不至于一团黑。
   * 按贴图颜色发光，所以纹样还在；0 为关。
   */
  setGlow(amount: number) {
    for (const [material] of this.baseColors) {
      if (!(material instanceof THREE.MeshPhysicalMaterial) || !material.map) continue;
      material.emissive.set(amount > 0 ? 0xffffff : 0x000000);
      material.emissiveMap = amount > 0 ? material.map : null;
      material.emissiveIntensity = amount;
      material.needsUpdate = true;
    }
  }

  apply(look: Look) {
    for (const material of this.bodyMaterials.values()) {
      if (look.surface === 'felt') {
        material.roughness = 0.73;
        material.sheen = 0.8;
        material.sheenRoughness = 0.55;
        material.sheenColor.set('#ffe3b9');
      } else {
        material.roughness = 0.6;
        material.sheen = 0;
      }
      material.needsUpdate = true;
    }
    for (const material of this.eyeMaterials.values()) {
      material.roughness = look.surface === 'felt' ? 0.28 : 0.2;
      material.clearcoat = look.surface === 'felt' ? 0.25 : 1;
      material.clearcoatRoughness = 0.22;
    }
    for (const outline of this.outlines) outline.visible = look.outline;
    for (const shell of this.shells) shell.visible = look.fuzz && look.surface === 'felt';
  }
}

/** 共用同一副骨骼和形态键权重的副本网格。 */
function shareSkin(mesh: THREE.SkinnedMesh, material: THREE.Material) {
  const copy = new THREE.SkinnedMesh(mesh.geometry, material);
  copy.bind(mesh.skeleton, mesh.bindMatrix);
  copy.frustumCulled = false;
  if (mesh.morphTargetInfluences) copy.morphTargetInfluences = mesh.morphTargetInfluences;
  mesh.parent!.add(copy);
  copy.position.copy(mesh.position);
  copy.quaternion.copy(mesh.quaternion);
  copy.scale.copy(mesh.scale);
  return copy;
}

const HASH = /* glsl */ `
float maomaoHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`;

function makeOutlineMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: '#6b4a33', side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${HASH}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // 宽度带噪声抖动，读作毛糙的暖棕轮廓而不是卡通硬边
        transformed += normalize(normal) * 0.0032 * (0.55 + 0.9 * maomaoHash(position * 180.0));`,
      );
  };
  return material;
}

/** 薄壳使用相同毛根和逐层收细的截面，避免各层独立白噪声变成悬浮砂粒。 */
function makeShellMaterial(map: THREE.Texture | null, color: THREE.Color, layer: number) {
  const material = new THREE.MeshPhysicalMaterial({
    map, color, roughness: 0.84, sheen: 0.8, sheenRoughness: 0.55,
    transparent: true, depthWrite: false,
  });
  material.sheenColor.set('#ffe3b9');
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFuzzPosition;\nvarying vec3 vFuzzNormal;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFuzzPosition = position;
        vFuzzNormal = normal;
        // 2.8mm 短绒，四层连续毛根；位移发生在蒙皮之前。
        transformed += normalize(normal) * ${(0.0007 * layer).toFixed(4)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFuzzPosition;\nvarying vec3 vFuzzNormal;\n${HASH}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec3 restN = abs(normalize(vFuzzNormal));
        vec2 roots = restN.z > max(restN.x, restN.y) ? vFuzzPosition.xy
          : (restN.x > restN.y ? vFuzzPosition.yz : vFuzzPosition.xz);
        vec2 cell = roots * 1250.0;
        vec2 id = floor(cell);
        vec2 jitter = vec2(maomaoHash(vec3(id, 1.0)), maomaoHash(vec3(id, 2.0)));
        vec2 root = 0.32 + 0.36 * jitter;
        // 同一毛根到尖端逐渐收细，轻微倾斜使轮廓柔软。
        root += vec2(0.018, -0.022) * ${layer.toFixed(1)};
        float radius = ${(0.29 - layer * 0.039).toFixed(3)};
        float dist = length(fract(cell) - root);
        float aa = max(fwidth(dist), 0.015);
        float fiber = 1.0 - smoothstep(radius - aa, radius + aa, dist);
        float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float visibility = mix(0.12, 0.7, 1.0 - smoothstep(0.06, 0.48, facing));
        float furAlpha = fiber * visibility;
        if (furAlpha < 0.015) discard;`,
      )
      .replace('#include <opaque_fragment>', `diffuseColor.a *= furAlpha;\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `maomao-short-fur-v2-${layer}`;
  return material;
}
