// Collision detection and effects for art.cube

import type { Explosion, DustParticle, NewbornStar, NebulaCloud } from '../types';
import type { ShootingStar } from './particles';
import { hexToRgb } from './particles';
import { COLORS, CANVAS_WIDTH, CANVAS_HEIGHT, PARTICLE_LIMITS } from '../constants';

export function createExplosion(x: number, y: number, elapsed: number, palette: readonly string[], isMobile: boolean): Explosion {
  const particles = [];
  const count = isMobile ? PARTICLE_LIMITS.EXPLOSION_COUNT_MOBILE : PARTICLE_LIMITS.EXPLOSION_COUNT_DESKTOP;
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      size: 2 + Math.random() * 5,
      color: palette[Math.floor(Math.random() * palette.length)],
      born: elapsed,
    });
  }
  return { particles, born: elapsed };
}

export function checkShootingStarCollisions(
  shootingStars: ShootingStar[],
  currentScene: number,
  elapsed: number,
  isMobile: boolean,
  onExplosion: (explosion: Explosion) => void
): void {
  for (let i = 0; i < shootingStars.length; i++) {
    for (let j = i + 1; j < shootingStars.length; j++) {
      const s1 = shootingStars[i];
      const s2 = shootingStars[j];
      if (s1.life <= 0 || s2.life <= 0 || s1.clickId === s2.clickId) continue;
      if (Math.hypot(s1.x - s2.x, s1.y - s2.y) < (s1.width + s2.width) * 0.6) {
        let palette: readonly string[];
        if (s1.ownerId === s2.ownerId && elapsed < 60) {
          palette = COLORS.WHITE;
        } else {
          palette = currentScene >= 3 ? COLORS.SUPERNOVA : currentScene === 2 ? ['#ff2d78', '#00d4ff', '#cc00ff', '#00ffcc', '#fff'] : COLORS.SPACE;
        }
        onExplosion(createExplosion((s1.x + s2.x) / 2, (s1.y + s2.y) / 2, elapsed, palette, isMobile));
        s1.life = 0;
        s2.life = 0;
      }
    }
  }
}

export function createNebulaMerge(c1: NebulaCloud, c2: NebulaCloud): { merged: NebulaCloud; dust: DustParticle[] } {
  const mx = (c1.x + c2.x) / 2;
  const my = (c1.y + c2.y) / 2;
  const merged: NebulaCloud = {
    x: mx,
    y: my,
    radius: (c1.radius + c2.radius) / 2 + 40,
    color: c1.color,
    color2: c2.color,
    ownerId: 'merge',
    id: Date.now() + Math.random(),
    centerAlpha: 0.7,
    decayRate: 0.0006,
    expansionRate: 0.6,
    alive: true,
  };
  const dust: DustParticle[] = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 2;
    dust.push({
      x: mx,
      y: my,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      color: i % 2 === 0 ? c1.color : c2.color,
      alpha: 0.9,
      size: 2 + Math.random() * 2,
      decay: 0.015,
      burst: true,
    });
  }
  return { merged, dust };
}

export function createStarBirth(s1: NebulaCloud, s2: NebulaCloud, elapsed: number, isMobile: boolean): { stars: NewbornStar[]; flash: { x: number; y: number; born: number; isBirthFlash: true } } {
  const mx = (s1.x + s2.x) / 2;
  const my = (s1.y + s2.y) / 2;
  const minCount = isMobile ? PARTICLE_LIMITS.NEWBORN_STAR_MOBILE_MIN : PARTICLE_LIMITS.NEWBORN_STAR_MIN;
  const maxCount = isMobile ? PARTICLE_LIMITS.NEWBORN_STAR_MOBILE_MAX : PARTICLE_LIMITS.NEWBORN_STAR_MAX;
  const count = minCount + Math.floor(Math.random() * (maxCount - minCount));
  const stars: NewbornStar[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 60;
    stars.push({
      x: mx + Math.cos(a) * d,
      y: my + Math.sin(a) * d,
      radius: 2 + Math.random() * 3,
      color: Math.random() < 0.5 ? s1.color : s2.color,
      flickerSpeed: 1.5 + Math.random() * 2.5,
      flickerOffset: Math.random() * Math.PI * 2,
      born: elapsed,
    });
  }
  return {
    stars,
    flash: { x: mx, y: my, born: elapsed, isBirthFlash: true },
  };
}

export function checkNebulaCloudCollisions(
  nebulaClouds: NebulaCloud[],
  triggeredNebulaPairs: Set<string>,
  onMerge: (c1: NebulaCloud, c2: NebulaCloud) => void
): void {
  for (let i = 0; i < nebulaClouds.length; i++) {
    for (let j = i + 1; j < nebulaClouds.length; j++) {
      const c1 = nebulaClouds[i];
      const c2 = nebulaClouds[j];
      if (!c1.alive || !c2.alive || c1.ownerId === c2.ownerId || c1.ownerId === 'merge' || c2.ownerId === 'merge') continue;
      const pid = [c1.id, c2.id].sort().join('-');
      if (triggeredNebulaPairs.has(pid)) continue;
      if (Math.hypot(c1.x - c2.x, c1.y - c2.y) < c1.radius + c2.radius) {
        triggeredNebulaPairs.add(pid);
        onMerge(c1, c2);
        c1.decayRate = 0.005;
        c2.decayRate = 0.005;
      }
    }
  }
}
