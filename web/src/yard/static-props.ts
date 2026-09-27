import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 仅用于无动画的物件组；保留材质、世界顶点与阴影，减少细碎零件的绘制批次。 */
export function batchStaticProps(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const batch = batches.get(mesh.material) ?? [];
    batch.push(mesh); batches.set(mesh.material, batch);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, material);
    merged.name = `${root.name}_${material.name}`;
    merged.castShadow = meshes[0]!.castShadow;
    merged.receiveShadow = meshes[0]!.receiveShadow;
    meshes.forEach(mesh => mesh.removeFromParent());
    root.add(merged);
  }
}
