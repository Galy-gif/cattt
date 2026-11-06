import * as THREE from 'three';

/**
 * 毛毡质感：完全哑光 + 一点绒光（sheen），表面按世界坐标叠一层纤维起伏。
 * 起始值取 3dviz-pro-max 的 style-felt-wool：roughness 1、sheen 0.6、sheenRoughness 0.8、暖白绒光。
 * 起伏用三维噪声按世界坐标算，不依赖 UV：Blender 出来的物件、程序生成的地形和实例化的石头都能用同一套。
 *
 * 开销：每个像素两次噪声（大块色差再加一次），法线起伏用同一份噪声的屏幕导数，不另外采样。
 * 第一版每像素七次噪声 + 全部带绒光，1440×900 下首屏一帧 41ms，压不进帧率判据，所以收成现在这样；
 * 铺满屏幕的大面（草地、远山、云）不带绒光（sheen: 0，走更便宜的标准材质），绒光只留给物件。
 */
export interface FeltOptions {
  /** 纤维颗粒的密度（每米多少个起伏周期） */
  scale?: number;
  /** 颜色深浅起伏的幅度，0–1 */
  mottle?: number;
  /** 法线起伏的幅度 */
  bump?: number;
  /** 大块的色差（草地用）：在 color 和这个颜色之间缓慢过渡 */
  patch?: THREE.ColorRepresentation;
  /** 绒光强度；0 = 不要绒光 */
  sheen?: number;
}

const NOISE = /* glsl */ `
  float feltHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float feltNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(feltHash(i), feltHash(i + vec3(1, 0, 0)), f.x), mix(feltHash(i + vec3(0, 1, 0)), feltHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(feltHash(i + vec3(0, 0, 1)), feltHash(i + vec3(1, 0, 1)), f.x), mix(feltHash(i + vec3(0, 1, 1)), feltHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

export function feltMaterial(color: THREE.ColorRepresentation, options: FeltOptions = {}) {
  const { scale = 90, mottle = 0.16, bump = 0.32, patch, sheen = 0.5 } = options;
  const material =
    sheen > 0
      ? new THREE.MeshPhysicalMaterial({ color, roughness: 1, metalness: 0, sheen, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffe6cf') })
      : new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const patchColor = new THREE.Color(patch ?? color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFeltScale = { value: scale };
    shader.uniforms.uFeltMottle = { value: mottle };
    shader.uniforms.uFeltBump = { value: bump };
    shader.uniforms.uFeltPatch = { value: patchColor };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFeltPos;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        vec4 feltWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          feltWorld = instanceMatrix * feltWorld;
        #endif
        vFeltPos = (modelMatrix * feltWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFeltPos;
        uniform float uFeltScale; uniform float uFeltMottle; uniform float uFeltBump; uniform vec3 uFeltPatch;
        float feltFine;
        ${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 feltP = vFeltPos * uFeltScale;
        feltFine = feltNoise(feltP) * 0.6 + feltNoise(feltP * 2.7) * 0.4;
        ${patch ? 'diffuseColor.rgb = mix(diffuseColor.rgb, uFeltPatch, smoothstep(0.35, 0.75, feltNoise(vFeltPos * 1.3 + 7.0)) * 0.55);' : ''}
        diffuseColor.rgb *= 1.0 - uFeltMottle * 0.5 + uFeltMottle * feltFine;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        // 用同一份噪声的屏幕导数推一下法线：远处导数大，限幅免得闪
        vec2 feltSlope = clamp(vec2(dFdx(feltFine), dFdy(feltFine)) * 5.0, -0.5, 0.5);
        normal = normalize(normal + vec3(feltSlope, 0.0) * uFeltBump);`,
      );
  };
  // 同一个类、不同选项要编译成不同程序
  material.customProgramCacheKey = () => `felt-${sheen > 0 ? 's' : 'n'}-${patch ? 'p' : 'n'}`;
  return material;
}

/** 把 glb 里的普通材质换成毛毡（按材质缓存，同名只建一次）。发光的窗和水面不换。 */
export function feltify(root: THREE.Object3D, skip: string[]) {
  const cache = new Map<THREE.Material, THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.material as THREE.MeshStandardMaterial;
    if (skip.includes(source.name)) return;
    let felt = cache.get(source);
    if (!felt) {
      const rope = source.name === 'rope';
      const name = source.name;
      const options: FeltOptions = rope ? { scale: 65, bump: .38, mottle: .14 }
        : name.startsWith('wood') ? { scale: 120, bump: .16, mottle: .12, sheen: .15 }
        : name.startsWith('stone') ? { scale: 48, bump: .22, mottle: .12, sheen: 0 }
        : name.startsWith('leaf') ? { scale: 80, bump: .22, mottle: .10, sheen: .25 }
        : { scale: 105, bump: .24, mottle: .10, sheen: .4 };
      felt = feltMaterial(source.color, options);
      felt.name = source.name;
      felt.side = source.side;
      cache.set(source, felt);
    }
    mesh.material = felt;
  });
}
