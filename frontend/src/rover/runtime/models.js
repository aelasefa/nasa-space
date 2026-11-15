// Lunar Rover: optional scene models (imported from Amanar, js/nasaLoader.js).
// Places one extra glTF model in front of the rover's starting point as a landmark.
// Nothing here is needed to drive: every load can fail (offline, blocked by the server's
// CORS policy, an unreadable file) and the simulation carries on without the model.
// The catalog UI of the original lives in the page (React); this module only loads.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class SceneModels {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.loader = new GLTFLoader();
    // The bundled model is meshopt-compressed.
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.active = null;
  }

  // Load a glTF/GLB from a URL. Resolves when it is in the scene; rejects when it cannot load.
  loadFromURL(url, scale = 1) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, (gltf) => { this.place(gltf.scene, scale); resolve(); }, undefined,
        (error) => reject(error instanceof Error ? error : new Error('The model could not be loaded.')));
    });
  }

  // Load a .glb or self-contained .gltf the player picked from their device.
  async loadFromFile(file) {
    const contents = await file.arrayBuffer();
    await new Promise((resolve, reject) => {
      this.loader.parse(contents, '', (gltf) => { this.place(gltf.scene, 1); resolve(); },
        (error) => reject(error instanceof Error ? error : new Error('The file is not a valid glTF model.')));
    });
  }

  // 25 m ahead of the start, standing on the ground.
  place(model, scale) {
    this.clear();
    const { x, z, heading } = this.terrain.spawn;
    const px = x - Math.sin(heading) * 25;
    const pz = z - Math.cos(heading) * 25;
    model.scale.setScalar(scale);
    model.position.set(px, this.terrain.getHeight(px, pz), pz);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.active = model;
    this.scene.add(model);
  }

  clear() {
    if (this.active) this.scene.remove(this.active);
    this.active = null;
  }
}
