// Constants from art.cube

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const RECORDING_SIZE = 1080;
export const TARGET_ASPECT = 16 / 9;

export const SCENE_TIMES = {
  SCENE_1_END: 30,
  SCENE_2_START: 31.5,
  SCENE_2_END: 60,
  SCENE_3_START: 60,
  RECORDING_START: 65,
  END_SEQUENCE_START: 60,
  FADE_OUT_START: 75,
  TOTAL_DURATION: 75,
} as const;

export const ZONE = {
  x: 260,
  y: 146,
  w: 1400,
  h: 787,
} as const;

export const COLORS = {
  SPACE: ['#00f2ff', '#00ff9f', '#ff00e5', '#bd00ff', '#f0ff00', '#ff3300', '#0077ff'],
  HOST_SCENE2: ['#ff2d78', '#ff6b35', '#cc00ff'],
  GUEST_SCENE2: ['#00d4ff', '#0055ff', '#00ffcc'],
  SUPERNOVA: ['#ff2200', '#ffcc00', '#cc00ff', '#00aaff', '#ffffff'],
  BEAT: ['#ff2d78', '#00d4ff', '#cc00ff', '#ffffff'],
  WHITE: ['#ffffff', '#f0f0f0', '#e0e0e0'],
} as const;

export const PALETTES = [
  ['#4466ff', '#6633ff', '#0044ff', '#8833cc', '#3300ff', '#6600cc', '#3388ff', '#8844ff'], // 0-15s
  ['#FF2400', '#FF0000', '#D3212D', '#A1045A', '#800080', '#BF00FF'], // 15-30s
  ['#FFFF00', '#FFD700', '#FFCC33', '#E5C100', '#D3D3D3', '#A8A8A8'], // 30-45s
  ['#006400', '#004d00', '#228B22', '#3CB371', '#98FF98', '#F5FFFA'], // 45-60s
] as const;

export const NEBULA_PALETTES = [
  { base: '#0d001a', bright: '#330066' },
  { base: '#000d1a', bright: '#003366' },
  { base: '#0d1a00', bright: '#336600' },
  { base: '#1a000d', bright: '#660033' },
  { base: '#001a1a', bright: '#004d4d' },
] as const;

export const AUDIO = {
  FFT_SIZE: 256,
  HISTORY_LIMIT: 60,
  DEFAULT_THRESHOLD: 0.5,
  MIN_THRESHOLD: 0.15,
  BEAT_ATTACK_MS: 150,
  BEAT_DECAY_MS: 800,
} as const;

export const PARTICLE_LIMITS = {
  MOBILE_MULTIPLIER: 0.4,
  EXPLOSION_COUNT_DESKTOP: 40,
  EXPLOSION_COUNT_MOBILE: 15,
  DUST_COUNT_DESKTOP: 40,
  DUST_COUNT_MOBILE: 15,
  STELLAR_WIND_DESKTOP: 25,
  STELLAR_WIND_MOBILE: 10,
  NEWBORN_STAR_MIN: 5,
  NEWBORN_STAR_MAX: 8,
  NEWBORN_STAR_MOBILE_MIN: 2,
  NEWBORN_STAR_MOBILE_MAX: 3,
} as const;

export const TIMING = {
  NEBULA_HOLD_MS: 200,
  NEBULA_MAX_DURATION_MS: 2500,
  NEBULA_FADE_IN_S: 1.5,
  NEBULA_FADE_OUT_S: 3,
  SHOOTING_STAR_LIFE_DECAY: 0.00208,
  SHOOTING_STAR_FADE_IN_S: 0.5,
  SCENE_1_COOLDOWN_MS: 1500,
  SCENE_2_COOLDOWN_MS: 250,
  CLICK_TIMEOUT_MS: 250,
  DOUBLE_CLICK_WINDOW_MS: 250,
} as const;

export const SIZES = {
  BEAT_STAR_MIN_LENGTH: 150,
  BEAT_STAR_MAX_LENGTH: 300,
  BEAT_STAR_MIN_HEAD: 3,
  BEAT_STAR_MAX_HEAD: 5,
  SHOOTING_STAR_MIN_WIDTH: 14,
  SHOOTING_STAR_MAX_WIDTH: 26,
  SHOOTING_STAR_LENGTH_MULTIPLIER: 15,
  GAS_PARTICLE_MIN_SIZE: 30,
  GAS_PARTICLE_MAX_SIZE: 80,
  INTERACTION_STAR_MIN_SIZE: 0.3,
  INTERACTION_STAR_MAX_SIZE: 1.1,
  SUPERNOVA_STAR_MIN_SIZE: 1.2,
  SUPERNOVA_STAR_MAX_SIZE: 2.0,
  CENTRAL_STAR_BOKEH_COUNT: 12,
  CENTRAL_STAR_BOKEH_SIZE_MIN: 60,
  CENTRAL_STAR_BOKEH_SIZE_MAX: 200,
} as const;

export const SPEEDS = {
  BEAT_STAR_MIN_SPEED: 1,
  BEAT_STAR_MAX_SPEED: 2,
  SHOOTING_STAR_MIN_SPEED: 1.25,
  SHOOTING_STAR_MAX_SPEED: 2.0,
  GAS_PARTICLE_DRIFT: 0.15,
  DUST_PARTICLE_DRIFT: 0.15,
  INTERACTION_STAR_DRIFT: 0.05,
  STELLAR_WIND_MIN: 0.5,
  STELLAR_WIND_MAX: 1.0,
} as const;

export const FLARE = {
  FADE_IN_DURATION_S: 5,
  TIME_SCALE: 0.01,
} as const;

export const CLOUDINARY = {
  UPLOAD_PRESET: 'artcube',
} as const;
