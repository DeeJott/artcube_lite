// Type definitions for art.cube

export type Scene = 1 | 2 | 3;
export type OwnerId = 'host' | 'guest' | 'merge';
export type UserRole = 'host' | 'guest';

export interface User {
  name: string;
  status: 'online' | 'offline';
}

export interface SessionState {
  host: User;
  guest: User;
  joined: boolean;
}

export interface PeerMessage {
  type: 'STATUS' | 'START_EXPERIENCE' | 'SYNC_TIME' | 'INTERACTION';
  name?: string;
  status?: 'online' | 'offline';
  role?: UserRole;
  elapsed?: number;
  kind?: 'SHOOTING_STAR' | 'NEBULA_GAS';
  rx?: number;
  ry?: number;
  vx?: number;
  vy?: number;
  w?: number;
  d?: number;
  cid?: number;
  ownerId?: OwnerId;
  dir?: number;
  ownerName?: string;
  palette?: NebulaPalette;
  nid?: number;
  size?: number;
  born?: number;
}

export interface NebulaPalette {
  base: string;
  bright: string;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  lifetime: number;
  update(dt: number): void;
  draw(elapsed: number, ctx: CanvasRenderingContext2D): boolean;
}

export interface ShootingStarData {
  vx: number;
  vy: number;
  w: number;
  d: number;
  cid: number;
  ownerId: OwnerId;
  dir: number;
  born: number;
}

export interface GasParticleData {
  vx: number;
  vy: number;
  size: number;
  born: number;
}

export interface Explosion {
  particles: ExplosionParticle[];
  born: number;
  isBirthFlash?: boolean;
  x?: number;
  y?: number;
}

export interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  born: number;
}

export interface Label {
  x: number;
  y: number;
  text: string;
  born: number;
}

export interface BokehOrb {
  relX: number;
  relY: number;
  size: number;
  opacity: number;
  phase: number;
  speed: number;
}

export interface CentralStar {
  x: number;
  y: number;
  born: number;
  bokeh: BokehOrb[];
}

export interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
  color2?: string;
  ownerId: OwnerId;
  id: number;
  centerAlpha: number;
  decayRate: number;
  expansionRate: number;
  alive: boolean;
}

export interface NewbornStar {
  x: number;
  y: number;
  radius: number;
  color: string;
  flickerSpeed: number;
  flickerOffset: number;
  born: number;
}

export interface StellarWind {
  x: number;
  y: number;
  vx: number;
  length: number;
  alpha: number;
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  decay: number;
  burst: boolean;
}
