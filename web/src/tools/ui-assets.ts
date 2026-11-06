/** 离线配套素材入口，复用正式模型、材质、光色和镜头，不进入 iOS 分发入口。 */
import * as THREE from 'three';
import { World } from '../yard/world';
import { Atmosphere, type TimeSlot, type Weather } from '../yard/atmosphere';
import { FollowCamera } from '../app/follow';
import { Renderer } from '../render/renderer';
import { YARD_BOUNDARY, type PlaceId } from '../yard/layout';
import { loadTuanzi } from '../tuanzi';
import { Walker } from '../yard/cat';
import { addWorldTurn } from '../tuanzi/procedural';
import { avatarMotion } from './avatar-motion';
const world = new World();
if (!await world.loadProps('/models/yard.glb')) throw new Error('院子加载失败');
const atmosphere = new Atmosphere();
const follow = new FollowCamera(true);
follow.setBounds(world.compositionBounds, world.cameraObstacles, world.compositionParts.map(p => p.box), YARD_BOUNDARY.map(p => new THREE.Vector3(p.x, 0, p.z)));
const yard = new Renderer(document.querySelector('canvas')!, true, true, 0);
yard.maxRatio = 1;
yard.bind(world.scene, follow.camera, (w, h) => follow.resize(w, h));
const cat = await loadTuanzi('/models/tuanzi.glb');
if (!cat) throw new Error('团子加载失败');
cat.proceduralEnabled = false;
const portrait = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
portrait.setSize(640, 640); portrait.setClearColor(0, 0);
portrait.toneMapping = THREE.NeutralToneMapping; portrait.toneMappingExposure = 1.4;
const scene = new THREE.Scene(); scene.add(cat.root);
scene.add(new THREE.HemisphereLight('#fff3df', '#a3ad8c', 1.5));
const key = new THREE.DirectionalLight('#fff0d8', 2.4); key.position.set(1.4, 2.4, 1.8); scene.add(key);
const rim = new THREE.DirectionalLight('#e3ecff', 1.1); rim.position.set(-1.8, 1.4, -2); scene.add(rim);
const camera = new THREE.PerspectiveCamera(30, 1, .01, 10);
let motionRest: Map<THREE.Bone, THREE.Quaternion> | undefined;
Object.assign(window, { uiAssets: {
  motion(kind: 'blink' | 'look', time: number) {
    if (!motionRest) {
      this.portrait('fence_grip', false);
      motionRest = new Map([...cat.model.bones.values()].map(b => [b, b.quaternion.clone()]));
    }
    for (const [bone, rotation] of motionRest) bone.quaternion.copy(rotation);
    const pose = avatarMotion(kind, time);
    for (const [name, share] of [['neck_01', .2], ['neck_02', .25], ['head', .55]] as const) {
      const bone = cat.model.bones.get(name)!;
      addWorldTurn(bone, cat.root, pose.yaw * share, pose.pitch * share);
      // 沿角色朝向轴侧倾，而不是把整张图连爪子一起转动。
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(cat.root.getWorldQuaternion(new THREE.Quaternion()));
      const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
      const delta = new THREE.Quaternion().setFromAxisAngle(axis, pose.roll * share);
      bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    }
    for (const { mesh, index } of cat.model.blinkers) mesh.morphTargetInfluences![index] = pose.blink;
    portrait.setSize(256, 256);
    cat.root.updateMatrixWorld(true);
    portrait.render(scene, camera);
    return portrait.domElement.toDataURL('image/png');
  },
  appIcon(appearance: 'default' | 'dark' | 'tinted') {
    this.portrait('sit_idle', false);
    for (const { mesh, index } of cat.model.blinkers) mesh.morphTargetInfluences![index] = 0;
    const head = cat.model.bones.get('head')!;
    const center = head.getWorldPosition(new THREE.Vector3());
    const parent = head.parent!.getWorldQuaternion(new THREE.Quaternion());
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(6));
    head.quaternion.premultiply(parent.clone().invert().multiply(tilt).multiply(parent));
    camera.position.set(0, center.y + .027, center.z + .58);
    camera.lookAt(0, center.y + .027, center.z);
    camera.updateMatrixWorld(); cat.root.updateMatrixWorld(true);
    portrait.setSize(1024, 1024); portrait.render(scene, camera);
    const output = document.createElement('canvas'); output.width = output.height = 1024;
    const context = output.getContext('2d')!;
    if (appearance === 'default') {
      const fill = context.createLinearGradient(0, 0, 850, 1024);
      fill.addColorStop(0, '#edf3f7'); fill.addColorStop(.6, '#f5f5ef'); fill.addColorStop(1, '#eee9de');
      context.fillStyle = fill; context.fillRect(0, 0, 1024, 1024);
    } else if (appearance === 'tinted') {
      context.fillStyle = '#101010'; context.fillRect(0, 0, 1024, 1024);
      context.filter = 'grayscale(1)';
    }
    context.drawImage(portrait.domElement, 0, 0);
    return output.toDataURL('image/png');
  },
  background(slot: TimeSlot, weather: Weather, place: PlaceId) {
    atmosphere.choose(slot, weather, true); atmosphere.update(0);
    follow.lookAtPlace(place, true); follow.update(new THREE.Vector3(), 1);
    world.update(0, atmosphere, follow.camera, false, true);
    yard.gl.toneMappingExposure = atmosphere.current.exposure;
    yard.render(world.scene, follow.camera, 0);
    return yard.gl.domElement.toDataURL('image/jpeg', .88);
  },
  meeting() {
    world.scene.add(cat.root);
    new Walker(cat).teleport('grass'); cat.freeze('sit_idle', 0);
    cat.root.rotation.y = 0;
    atmosphere.choose('day', 'clear', true); atmosphere.update(0);
    const p = cat.position;
    follow.compareAt([p.x, .10, p.z], [p.x, 1.3, p.z + 3.5]);
    world.update(0, atmosphere, follow.camera, false, true);
    yard.gl.toneMappingExposure = atmosphere.current.exposure;
    yard.gl.shadowMap.needsUpdate = true;
    yard.render(world.scene, follow.camera, 0);
    const result = yard.gl.domElement.toDataURL('image/jpeg', .9);
    scene.add(cat.root); cat.root.position.set(0, 0, 0);
    return result;
  },
  portrait(clip: string, full: boolean) {
    cat.freeze('sit_idle', 1);
    const tail = [...cat.model.bones].filter(([name]) => name.startsWith('tail_')).map(([name, bone]) => [name, bone.quaternion.clone()] as const);
    cat.freeze(clip, 1);
    // 窗沿姿势借用已确认的抓握帧，尾巴沿用坐姿，避免尾尖从头顶冒出。
    if (clip === 'fence_grip') for (const [name, rotation] of tail) cat.model.bones.get(name)!.quaternion.copy(rotation);
    cat.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cat.root, true);
    const center = box.getCenter(new THREE.Vector3());
    if (full) { camera.position.set(.32, center.y + .07, .93); camera.lookAt(0, center.y, 0); }
    else {
      const head = cat.model.bones.get('head')!;
      head.getWorldPosition(center);
      camera.position.set(0, center.y + .025, center.z + .68);
      camera.lookAt(center.x, center.y + .025, center.z);
    }
    camera.updateMatrixWorld(); portrait.render(scene, camera);
    return portrait.domElement.toDataURL('image/png');
  }
} });
