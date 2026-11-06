import * as THREE from 'three';

/** 与动作时间一致，恢复/定格不必重新等一次渐变。 */
export function faceWeight(clip: string, time: number, duration: number) {
  const [kind, phase] = clip.split('_');
  const weight = phase === 'down' ? THREE.MathUtils.smoothstep(time, 0, Math.min(.65, duration))
    : phase === 'up' ? 1 - THREE.MathUtils.smoothstep(time, 0, Math.min(.65, duration)) : 1;
  return new THREE.Vector2(kind === 'sulk' ? weight : 0, kind === 'sad' ? weight : 0);
}

/** 改原有脸部材质与眼球，保留同一套毛色、灯光、蒙皮和眨眼。 */
export class Face {
  readonly emotion = { value: new THREE.Vector2() };

  update(clip: string, time: number, duration: number) {
    this.emotion.value.copy(faceWeight(clip, time, duration));
  }

  mouth(material: THREE.Material) {
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.faceEmotion = this.emotion;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFaceRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFaceRest = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFaceRest;\nuniform vec2 faceEmotion;')
        .replace('#include <map_fragment>', /* glsl */ `
          #ifdef USE_MAP
          vec2 faceUV = vMapUv;
          // 原始嘴纹两侧各是一道笑弧。按模型绑定坐标改采样，鼻子和脸外不受影响。
          float ax = abs(vFaceRest.x);
          float t = acos(clamp(1.0 - 2.0 * ax / .0105, -1.0, 1.0)) / 3.14159265;
          float oldY = .175 - .0037 * pow(max(0.0, sin(3.14159265 * t)), .8) + .001 * t;
          float sulkY = .173 - .0007 * pow(ax / .0105, 2.0);
          float sadY = .176 - .0045 * pow(ax / .0105, 2.0);
          float offsetY = faceEmotion.x * (oldY - sulkY) + faceEmotion.y * (oldY - sadY);
          float zone = (1.0 - smoothstep(.013, .016, ax))
            * smoothstep(.164, .167, vFaceRest.y) * (1.0 - smoothstep(.179, .182, vFaceRest.y))
            * smoothstep(.18, .20, vFaceRest.z);
          // 局部 UV 雅可比：即使 UV 岛有旋转，也沿脸部竖轴移动纹样。
          vec2 px = dFdx(vFaceRest.xy), py = dFdy(vFaceRest.xy);
          float det = px.x * py.y - px.y * py.x;
          vec2 uvY = (dFdy(vMapUv) * px.x - dFdx(vMapUv) * py.x) / (abs(det) > 1e-12 ? det : 1e-12);
          faceUV += uvY * offsetY * zone;
          vec4 sampledDiffuseColor = texture2D(map, faceUV);
          diffuseColor *= sampledDiffuseColor;
          #endif
        `);
    };
    material.customProgramCacheKey = () => `${key}-emotion-mouth-v1`;
  }

  eyes(mesh: THREE.Mesh, material: THREE.Material) {
    // glTF 保留的坐标来自 Blender，换为导出后的 Y 向上、Z 朝前。
    const raw = mesh.userData.eye_center as number[];
    const basis = mesh.userData.eye_basis as number[][];
    const center = new THREE.Vector3(raw[0], raw[2], -raw[1]!);
    const right = new THREE.Vector3(basis[0]![0], basis[2]![0], -basis[1]![0]!);
    const up = new THREE.Vector3(basis[0]![1], basis[2]![1], -basis[1]![1]!);
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      Object.assign(shader.uniforms, { faceEmotion: this.emotion, faceEyeCenter: { value: center }, faceEyeRight: { value: right }, faceEyeUp: { value: up }, faceEyeSide: { value: Math.sign(center.x) } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec2 faceEmotion;\nuniform vec3 faceEyeCenter, faceEyeRight, faceEyeUp;\nuniform float faceEyeSide;')
        .replace('#include <morphtarget_vertex>', /* glsl */ `#include <morphtarget_vertex>
          vec3 eyeDelta = transformed - faceEyeCenter;
          float eyeX = dot(eyeDelta, faceEyeRight), eyeY = dot(eyeDelta, faceEyeUp);
          float squeeze = .60 * faceEmotion.x + .38 * faceEmotion.y;
          float slant = .38 * faceEmotion.x - .28 * faceEmotion.y;
          transformed += faceEyeUp * (-eyeY * squeeze + eyeX * faceEyeSide * slant);
        `);
    };
    material.customProgramCacheKey = () => 'maomao-emotion-eyes-v1';
  }
}
