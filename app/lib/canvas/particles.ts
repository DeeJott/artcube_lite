// Canvas particle classes for art.cube

import type { NebulaPalette, OwnerId, ShootingStarData, GasParticleData } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PALETTES, TIMING, SIZES, SPEEDS } from '../constants';

// Utility functions
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function getCurrentPalette(elapsed: number): readonly string[] {
  const index = Math.floor(elapsed / 15);
  return PALETTES[Math.min(index, PALETTES.length - 1)];
}

export function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Beat Shooting Star (background element)
export class BeatShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  headSize: number;
  color: string;
  prevColor: string;
  targetColor: string;
  lastPaletteIndex: number;
  transitionStartTime: number;
  born: number;

  constructor(elapsed: number) {
    this.born = elapsed;
    if (Math.random() < 0.5) {
      this.x = Math.random() * CANVAS_WIDTH * 1.2 - (CANVAS_WIDTH * 0.2);
      this.y = -200;
    } else {
      this.x = -200;
      this.y = Math.random() * CANVAS_HEIGHT * 1.2 - (CANVAS_HEIGHT * 0.2);
    }
    const angle = Math.PI * 30 / 180;
    const speed = (4 + Math.random() * 4) * 0.25;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.length = SIZES.BEAT_STAR_MIN_LENGTH + Math.random() * (SIZES.BEAT_STAR_MAX_LENGTH - SIZES.BEAT_STAR_MIN_LENGTH);
    this.headSize = SIZES.BEAT_STAR_MIN_HEAD + Math.random() * (SIZES.BEAT_STAR_MAX_HEAD - SIZES.BEAT_STAR_MIN_HEAD);

    const initialPalette = getCurrentPalette(elapsed);
    this.color = initialPalette[Math.floor(Math.random() * initialPalette.length)];
    this.prevColor = this.color;
    this.targetColor = this.color;
    this.lastPaletteIndex = Math.floor(elapsed / 15);
    this.transitionStartTime = 0;
  }

  update(dt: number, elapsed: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const currentPaletteIndex = Math.floor(elapsed / 15);
    if (currentPaletteIndex !== this.lastPaletteIndex && currentPaletteIndex < PALETTES.length) {
      this.lastPaletteIndex = currentPaletteIndex;
      this.prevColor = this.color;
      const newPalette = PALETTES[currentPaletteIndex];
      this.targetColor = newPalette[Math.floor(Math.random() * newPalette.length)];
      this.transitionStartTime = elapsed;
    }
    if (this.transitionStartTime > 0) {
      const progress = Math.min(1, (elapsed - this.transitionStartTime) / 1.0);
      this.color = lerpColor(this.prevColor, this.targetColor, progress);
      if (progress >= 1) this.transitionStartTime = 0;
    }
  }

  getAlpha(elapsed: number): number {
    const age = elapsed - this.born;
    if (age < 1.0) return age / 1.0;
    if (this.x > CANVAS_WIDTH || this.y > CANVAS_HEIGHT) {
      const exitDist = Math.max(this.x - CANVAS_WIDTH, this.y - CANVAS_HEIGHT);
      return Math.max(0, 1 - exitDist / 400);
    }
    return 1.0;
  }

  alive(elapsed: number): boolean {
    return this.x < CANVAS_WIDTH + 500 && this.y < CANVAS_HEIGHT + 500;
  }

  draw(elapsed: number, ctx: CanvasRenderingContext2D, lastBeatTime: number, intensity: number): void {
    const a = this.getAlpha(elapsed);
    if (a <= 0) return;

    const timeSinceBeat = performance.now() - lastBeatTime;
    const attack = 150;
    const decay = 800;
    let beatEffect = 0;
    if (timeSinceBeat < attack) beatEffect = timeSinceBeat / attack;
    else if (timeSinceBeat < attack + decay) beatEffect = 1 - (timeSinceBeat - attack) / decay;
    beatEffect = 0.5 - 0.5 * Math.cos(beatEffect * Math.PI);

    const angle = Math.atan2(this.vy, this.vx);
    const currentHeadSize = this.headSize * (1 + beatEffect * 1.5 + intensity);
    const currentLength = this.length * (1 + beatEffect * 0.5);

    const { r, g, b } = hexToRgb(this.color);
    const headAlpha = Math.min(1, a * (1 + beatEffect * 2));
    const headColor = beatEffect > 0.3 ? `rgba(255,255,255,${headAlpha})` : `rgba(${r},${g},${b},${a})`;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    const bodyGrad = ctx.createLinearGradient(0, 0, -currentLength, 0);
    bodyGrad.addColorStop(0, headColor);
    bodyGrad.addColorStop(0.2, `rgba(${r},${g},${b},${a})`);
    bodyGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 15 * (1 + beatEffect * 3 + intensity * 2);
    ctx.shadowColor = this.color;

    ctx.beginPath();
    ctx.arc(0, 0, currentHeadSize, Math.PI / 2, -Math.PI / 2, true);
    ctx.lineTo(-currentLength, 0);
    ctx.closePath();
    ctx.fill();

    if (beatEffect > 0.1) {
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentHeadSize);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${a * beatEffect})`);
      coreGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, currentHeadSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Interactive Shooting Star
export class ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  width: number;
  angle: number;
  clickId: number;
  ownerId: OwnerId;
  born: number;

  constructor(
    startX: number,
    startY: number,
    vx?: number,
    vy?: number,
    widthVal?: number,
    decayVal?: number,
    clickId?: number,
    ownerId?: OwnerId,
    direction: number = 1,
    syncData?: ShootingStarData
  ) {
    this.x = startX;
    this.y = startY;
    if (syncData && syncData.born !== undefined) {
      this.born = syncData.born;
    } else {
      this.born = performance.now() / 1000;
    }

    if (vx !== undefined && vy !== undefined) {
      this.vx = vx;
      this.vy = vy;
    } else {
      const angle = (Math.random() - 0.5) * (Math.PI * 40 / 180);
      const speed = SPEEDS.SHOOTING_STAR_MIN_SPEED + Math.random() * (SPEEDS.SHOOTING_STAR_MAX_SPEED - SPEEDS.SHOOTING_STAR_MIN_SPEED);
      this.vx = direction * Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }
    this.life = 1.0;
    this.decay = decayVal !== undefined ? decayVal : TIMING.SHOOTING_STAR_LIFE_DECAY;
    this.width = widthVal !== undefined ? widthVal : SIZES.SHOOTING_STAR_MIN_WIDTH + Math.random() * (SIZES.SHOOTING_STAR_MAX_WIDTH - SIZES.SHOOTING_STAR_MIN_WIDTH);
    this.angle = Math.atan2(this.vy, this.vx);
    this.clickId = clickId || 0;
    this.ownerId = ownerId || 'host';
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= this.decay * dt;
  }

  draw(elapsed: number, ctx: CanvasRenderingContext2D): void {
    if (this.life <= 0) return;
    const age = elapsed - this.born;
    let alpha = 1.0;
    if (age < 0.5) alpha = age / 0.5;
    const fadeOutThreshold = 0.5 * 60 * this.decay;
    if (this.life < fadeOutThreshold) alpha = this.life / fadeOutThreshold;

    const length = this.width * SIZES.SHOOTING_STAR_LENGTH_MULTIPLIER;
    const ex = this.x - Math.cos(this.angle) * length;
    const ey = this.y - Math.sin(this.angle) * length;
    const flicker = 0.8 + Math.random() * 0.2;
    const grad = ctx.createLinearGradient(this.x, this.y, ex, ey);
    grad.addColorStop(0, `rgba(255,255,255,${alpha * this.life * flicker})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = this.width * 0.3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
  }
}

// Gas Particle for Nebula
export class GasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  born: number;
  lifetime: number;
  palette: NebulaPalette;
  id: number;
  isGlowing: boolean;
  glowAmount: number;

  constructor(x: number, y: number, palette: NebulaPalette, id: number, syncData?: GasParticleData) {
    this.x = x;
    this.y = y;
    if (syncData) {
      this.vx = syncData.vx;
      this.vy = syncData.vy;
      this.size = syncData.size;
      this.born = syncData.born;
    } else {
      this.vx = (Math.random() - 0.5) * SPEEDS.GAS_PARTICLE_DRIFT;
      this.vy = (Math.random() - 0.5) * SPEEDS.GAS_PARTICLE_DRIFT;
      this.size = SIZES.GAS_PARTICLE_MIN_SIZE + Math.random() * (SIZES.GAS_PARTICLE_MAX_SIZE - SIZES.GAS_PARTICLE_MIN_SIZE);
      this.born = performance.now() / 1000;
    }
    this.lifetime = 10;
    this.palette = palette;
    this.id = id;
    this.isGlowing = false;
    this.glowAmount = 0;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const expansionRate = this.isGlowing ? 0.35 : 0.1;
    this.size += expansionRate * dt;
    if (this.isGlowing) this.glowAmount = Math.min(1, this.glowAmount + 0.08 * dt);
  }

  draw(elapsed: number, ctx: CanvasRenderingContext2D): boolean {
    const age = elapsed - this.born;
    if (age > this.lifetime) return false;
    let alpha = 0.05;
    if (age < TIMING.NEBULA_FADE_IN_S) alpha *= (age / TIMING.NEBULA_FADE_IN_S);
    else if (age > 7) alpha *= (10 - age) / TIMING.NEBULA_FADE_OUT_S;
    const { r: rB, g: gB, b: bB } = hexToRgb(this.palette.base);
    const { r: rH, g: gH, b: bH } = hexToRgb(this.palette.bright);
    const r = Math.floor(rB + (rH - rB) * this.glowAmount);
    const g = Math.floor(gB + (gH - gB) * this.glowAmount);
    const b = Math.floor(bB + (bH - bB) * this.glowAmount);
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true;
  }
}

// Interaction Star
export class InteractionStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  lifetime: number;
  size: number;
  flickerOffset: number;
  isSupernova: boolean;

  constructor(x: number, y: number, isSupernova: boolean = false) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * SPEEDS.INTERACTION_STAR_DRIFT;
    this.vy = (Math.random() - 0.5) * SPEEDS.INTERACTION_STAR_DRIFT;
    this.born = performance.now() / 1000;
    this.lifetime = isSupernova ? 5 : 7 + Math.random() * 3;
    this.size = (isSupernova ? SIZES.SUPERNOVA_STAR_MIN_SIZE : SIZES.INTERACTION_STAR_MIN_SIZE) +
      Math.random() * (isSupernova ? SIZES.SUPERNOVA_STAR_MAX_SIZE - SIZES.SUPERNOVA_STAR_MIN_SIZE : SIZES.INTERACTION_STAR_MAX_SIZE - SIZES.INTERACTION_STAR_MIN_SIZE);
    this.flickerOffset = Math.random() * Math.PI * 2;
    this.isSupernova = isSupernova;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(elapsed: number, ctx: CanvasRenderingContext2D): boolean {
    const age = elapsed - this.born;
    if (age > this.lifetime) return false;
    let alpha = this.isSupernova ? 0.9 : 0.6;
    if (age < 0.5) alpha *= (age / 0.5);
    else if (age > this.lifetime - 1.5) alpha *= (this.lifetime - age) / 1.5;
    const flicker = 0.6 + 0.4 * Math.sin(elapsed * (this.isSupernova ? 6 : 3) + this.flickerOffset);
    ctx.save();
    ctx.shadowBlur = this.isSupernova ? 15 : 4;
    ctx.shadowColor = '#fff6aa';
    ctx.fillStyle = `rgba(255, 246, 170, ${alpha * flicker})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true;
  }
}

// Beat Wisp (persistent background element for scene 2)
export interface BeatWisp {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

export function createBeatWisp(): BeatWisp {
  return {
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    radius: 50 + Math.random() * 80,
    alpha: 0.06 + Math.random() * 0.06,
    color: COLORS.BEAT[Math.floor(Math.random() * COLORS.BEAT.length)],
  };
}
