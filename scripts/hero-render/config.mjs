// Shared by the browser scene and the Node renderer. Frame numbers are 1-based and inclusive.
// Scene ranges line up with the scroll ranges in src/lib/hero-config.ts (360 frames = 100%).
export const FPS = 30;
export const FRAME_COUNT = 360;

export const SCENES = {
  rip: [1, 54],
  void: [55, 126],
  wait: [127, 198],
  slab: [199, 270],
  reveal: [271, 342],
  hold: [343, 360],
};

// anchor: where the subject sits (world units, camera at z = 10 looking down -z).
// Desktop keeps the left third calm for captions; mobile sits slightly above middle.
export const FORMATS = {
  desktop: { width: 1920, height: 1080, fov: 30, anchor: [1.45, 0.05, 0] },
  mobile: { width: 1080, height: 1920, fov: 42, anchor: [0, 0.45, 0] },
};

export const KEY_FRAMES = [1, 54, 126, 198, 270, 315, 360];
