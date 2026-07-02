import * as THREE from 'three';

export function createCinematicCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
  cam.position.set(0, 0, 1.2);
  cam.lookAt(0, 0, 0);
  return cam;
}

export function updateCinematicCamera(
  cam: THREE.PerspectiveCamera,
  time: number,
  mouseX: number,
  mouseY: number,
  driftScale = 1.0,
): void {
  cam.position.x = Math.sin(time * 0.08) * 0.08 * driftScale + mouseX * 0.06;
  cam.position.y = Math.cos(time * 0.06) * 0.05 * driftScale + mouseY * 0.06;
  cam.lookAt(0, 0, 0);
}
