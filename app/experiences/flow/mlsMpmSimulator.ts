/* eslint-disable @typescript-eslint/no-explicit-any */
// Realtime MLS-MPM (Moving Least Squares Material Point Method) fluid simulator.
// Faithful WebGPU/TSL port of the algorithm from holtsetio/flow: a 64^3 background grid,
// APIC particle<->grid transfer, weakly-compressible equation-of-state pressure + viscous
// stress, plus curl-noise turbulence, a mouse-ray force, and audio-driven impulses.
//
// Pipeline per step: clearGrid -> p2g1 (scatter mass+momentum) -> p2g2 (scatter stress)
//                    -> updateGrid (solve velocity, walls) -> g2p (gather, advect, color).

import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

import { StructuredArray } from './structuredArray';

// TSL is a dynamically-typed shader-builder DSL; the strict @types/three signatures don't
// model the fluent proxy chains used in compute kernels, so we bind the primitives as `any`.
/* eslint-disable @typescript-eslint/no-explicit-any */
const {
  Fn, If, Return, Loop, instanceIndex, uniform,
  int, float, uint, vec3, vec4, mat3,
  array, atomicAdd, max, pow, clamp, cross, mix, time, ivec3, instancedArray,
} = TSL as any;

// ---- Directional triangle-noise (curl-ish) field, used to add turbulence to velocity ----
const tri = Fn(([x]: any) => x.fract().sub(0.5).abs())
  .setLayout({ name: 'flow_tri', type: 'float', inputs: [{ name: 'x', type: 'float' }] });

const triVec = Fn(([x]: any) => x.fract().sub(0.5).abs())
  .setLayout({ name: 'flow_triVec', type: 'vec3', inputs: [{ name: 'x', type: 'vec3' }] });

const tri3 = Fn(([p]: any) => vec3(
  tri(p.z.add(tri(p.y))),
  tri(p.z.add(tri(p.x))),
  tri(p.y.add(tri(p.x))),
)).setLayout({ name: 'flow_tri3', type: 'vec3', inputs: [{ name: 'p', type: 'vec3' }] });

const triNoise3D = Fn(([position, speed, t]: any) => {
  const p = vec3(position).toVar();
  const z = float(1.4).toVar();
  const rz = vec3(0.0).toVar();
  const bp = vec3(p).toVar();
  Loop({ start: float(0.0), end: float(3.0), type: 'float', condition: '<=' }, () => {
    const dg = vec3(tri3(bp.mul(2.0))).toVar();
    p.addAssign(dg.add(t.mul(float(0.1).mul(speed))));
    bp.mulAssign(1.8);
    z.mulAssign(1.5);
    p.mulAssign(1.2);
    const tt = triVec(p.zxy.add(triVec(p.xyz.add(triVec(p.yzx))))).toVar();
    rz.addAssign(tt.div(z));
    bp.addAssign(0.14);
  });
  return rz;
}).setLayout({
  name: 'flow_triNoise3D',
  type: 'vec3',
  inputs: [
    { name: 'position', type: 'vec3' },
    { name: 'speed', type: 'float' },
    { name: 'time', type: 'float' },
  ],
});

// ---- HSV -> RGB (matches the original's saturated palette) ----
const hsv2rgb = Fn(([c]: any) => {
  const rgb = clamp(
    c.x.mul(6.0).add(vec3(0.0, 4.0, 2.0)).mod(6.0).sub(3.0).abs().sub(1.0),
    0.0, 1.0,
  );
  return c.z.mul(mix(vec3(1.0), rgb, c.y));
}).setLayout({
  name: 'flow_hsv2rgb',
  type: 'vec3',
  inputs: [{ name: 'c', type: 'vec3' }],
});

export interface SimParams {
  maxParticles: number;
  particles: number;
}

export class MlsMpmSimulator {
  renderer: any;
  numParticles = 0;
  gridSize = new THREE.Vector3(64, 64, 64);
  fixedPointMultiplier = 1e7;
  uniforms: Record<string, any> = {};
  kernels: Record<string, any> = {};
  particleBuffer!: StructuredArray;
  cellBuffer!: StructuredArray;
  cellBufferF: any;
  mousePos = new THREE.Vector3();
  private mouseTrail: THREE.Vector3[] = [];

  // audio / sim tunables (updated each frame from the component)
  noise = 1.0;
  speed = 1.0;
  stiffness = 3.0;
  restDensity = 1.0;
  dynamicViscosity = 0.1;
  gravityVec = new THREE.Vector3(0, 0, 0.2);
  audioPulse = 0;
  swirl = 0;

  constructor(renderer: any) {
    this.renderer = renderer;
  }

  async init(params: SimParams) {
    const { maxParticles, particles } = params;
    this.numParticles = particles;

    const particleStruct: any = {
      position: { type: 'vec3' },
      density: { type: 'float' },
      velocity: { type: 'vec3' },
      mass: { type: 'float' },
      C: { type: 'mat3' },
      direction: { type: 'vec3' },
      color: { type: 'vec3' },
    };
    this.particleBuffer = new StructuredArray(particleStruct, maxParticles, 'flowParticleData');

    // Seed particles inside a sphere, slightly varied mass for visual variety.
    const v = new THREE.Vector3();
    for (let i = 0; i < maxParticles; i++) {
      let dist = 2;
      while (dist > 1) {
        v.set(Math.random(), Math.random(), Math.random()).multiplyScalar(2.0).subScalar(1.0);
        dist = v.length();
      }
      v.multiplyScalar(0.8).addScalar(1.0).divideScalar(2.0).multiply(this.gridSize);
      const mass = 1.0 - Math.random() * 0.002;
      this.particleBuffer.set(i, 'position', v);
      this.particleBuffer.set(i, 'mass', mass);
    }

    const cellCount = this.gridSize.x * this.gridSize.y * this.gridSize.z;
    const cellStruct: any = {
      x: { type: 'int', atomic: true },
      y: { type: 'int', atomic: true },
      z: { type: 'int', atomic: true },
      mass: { type: 'int', atomic: true },
    };
    this.cellBuffer = new StructuredArray(cellStruct, cellCount, 'flowCellData');
    this.cellBufferF = instancedArray(cellCount, 'vec4').label('flowCellDataF');

    const U = this.uniforms;
    U.gravity = uniform(this.gravityVec);
    U.stiffness = uniform(0);
    U.restDensity = uniform(0);
    U.dynamicViscosity = uniform(0);
    U.noise = uniform(0);
    U.gridSize = uniform(this.gridSize, 'ivec3');
    U.dt = uniform(0.1);
    U.numParticles = uniform(particles, 'uint');
    U.mouseRayDirection = uniform(new THREE.Vector3());
    U.mouseRayOrigin = uniform(new THREE.Vector3());
    U.mouseForce = uniform(new THREE.Vector3());
    U.audioPulse = uniform(0);
    U.swirl = uniform(0);

    const fixedMul = this.fixedPointMultiplier;
    const encode = (f: any) => int(f.mul(fixedMul));
    const decode = (i: any) => float(i).div(fixedMul);

    const getCellPtr = (ipos: any) => {
      const g = U.gridSize;
      return int(ipos.x).mul(g.y).mul(g.z)
        .add(int(ipos.y).mul(g.z))
        .add(int(ipos.z)).toConst();
    };
    const getCell = (ipos: any) => this.cellBuffer.element(getCellPtr(ipos));

    // Quadratic B-spline weights for a particle's 3x3x3 cell neighborhood.
    const bsplineWeights = (cellDiff: any) => {
      const w0 = float(0.5).mul(float(0.5).sub(cellDiff)).mul(float(0.5).sub(cellDiff));
      const w1 = float(0.75).sub(cellDiff.mul(cellDiff));
      const w2 = float(0.5).mul(float(0.5).add(cellDiff)).mul(float(0.5).add(cellDiff));
      return array([w0, w1, w2]).toConst('weights');
    };

    // --- clearGrid ---
    this.kernels.clearGrid = Fn(() => {
      this.cellBuffer.setAtomic('x', false);
      this.cellBuffer.setAtomic('y', false);
      this.cellBuffer.setAtomic('z', false);
      this.cellBuffer.setAtomic('mass', false);

      If(instanceIndex.greaterThanEqual(uint(cellCount)), () => { Return(); });
      this.cellBuffer.element(instanceIndex).get('x').assign(0);
      this.cellBuffer.element(instanceIndex).get('y').assign(0);
      this.cellBuffer.element(instanceIndex).get('z').assign(0);
      this.cellBuffer.element(instanceIndex).get('mass').assign(0);
      this.cellBufferF.element(instanceIndex).assign(vec4(0));
    })().compute(cellCount);

    // --- p2g1: scatter mass + APIC momentum into the grid ---
    this.kernels.p2g1 = Fn(() => {
      this.cellBuffer.setAtomic('x', true);
      this.cellBuffer.setAtomic('y', true);
      this.cellBuffer.setAtomic('z', true);
      this.cellBuffer.setAtomic('mass', true);

      If(instanceIndex.greaterThanEqual(U.numParticles), () => { Return(); });
      const p = this.particleBuffer.element(instanceIndex);
      const pos = p.get('position').xyz.toConst('pos');
      const vel = p.get('velocity').xyz.toConst('vel');
      const C = p.get('C').toConst('C');

      const cellIndex = ivec3(pos).sub(1).toConst('cellIndex');
      const cellDiff = pos.fract().sub(0.5).toConst('cellDiff');
      const weights = bsplineWeights(cellDiff);

      Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({ gx }: any) => {
        Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({ gy }: any) => {
          Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({ gz }: any) => {
            const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
            const cellX = cellIndex.add(ivec3(gx, gy, gz)).toConst();
            const cellDist = vec3(cellX).add(0.5).sub(pos).toConst('cellDist');
            const Q = C.mul(cellDist);
            const massContrib = weight;
            const velContrib = massContrib.mul(vel.add(Q)).toConst('velContrib');
            const cell = getCell(cellX);
            atomicAdd(cell.get('x'), encode(velContrib.x));
            atomicAdd(cell.get('y'), encode(velContrib.y));
            atomicAdd(cell.get('z'), encode(velContrib.z));
            atomicAdd(cell.get('mass'), encode(massContrib));
          });
        });
      });
    })().compute(particles);

    // --- p2g2: density estimate + EOS pressure & viscous stress scattered as momentum ---
    this.kernels.p2g2 = Fn(() => {
      this.cellBuffer.setAtomic('x', true);
      this.cellBuffer.setAtomic('y', true);
      this.cellBuffer.setAtomic('z', true);
      this.cellBuffer.setAtomic('mass', false);

      If(instanceIndex.greaterThanEqual(U.numParticles), () => { Return(); });
      const p = this.particleBuffer.element(instanceIndex);
      const pos = p.get('position').xyz.toConst('pos');

      const cellIndex = ivec3(pos).sub(1).toConst('cellIndex');
      const cellDiff = pos.fract().sub(0.5).toConst('cellDiff');
      const weights = bsplineWeights(cellDiff);

      const density = float(0).toVar('density');
      Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({ gx }: any) => {
        Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({ gy }: any) => {
          Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({ gz }: any) => {
            const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
            const cellX = cellIndex.add(ivec3(gx, gy, gz)).toConst();
            density.addAssign(decode(getCell(cellX).get('mass')).mul(weight));
          });
        });
      });
      const densityStore = p.get('density');
      densityStore.assign(mix(densityStore, density, 0.05));

      const volume = float(1).div(density);
      const pressure = max(
        0.0,
        pow(density.div(U.restDensity), 5.0).sub(1).mul(U.stiffness),
      ).toConst('pressure');
      const stress = mat3(
        pressure.negate(), 0, 0,
        0, pressure.negate(), 0,
        0, 0, pressure.negate(),
      ).toVar('stress');
      const dudv = p.get('C').toConst('Cmat');
      const strain = dudv.add(dudv.transpose());
      stress.addAssign(strain.mul(U.dynamicViscosity));
      const eq16Term0 = volume.mul(-4).mul(stress).mul(U.dt);

      Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({ gx }: any) => {
        Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({ gy }: any) => {
          Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({ gz }: any) => {
            const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
            const cellX = cellIndex.add(ivec3(gx, gy, gz)).toConst();
            const cellDist = vec3(cellX).add(0.5).sub(pos).toConst('cellDist');
            const momentum = eq16Term0.mul(weight).mul(cellDist).toConst('momentum');
            const cell = getCell(cellX);
            atomicAdd(cell.get('x'), encode(momentum.x));
            atomicAdd(cell.get('y'), encode(momentum.y));
            atomicAdd(cell.get('z'), encode(momentum.z));
          });
        });
      });
    })().compute(particles);

    // --- updateGrid: normalize momentum -> velocity, enforce wall boundaries ---
    this.kernels.updateGrid = Fn(() => {
      this.cellBuffer.setAtomic('x', false);
      this.cellBuffer.setAtomic('y', false);
      this.cellBuffer.setAtomic('z', false);
      this.cellBuffer.setAtomic('mass', false);

      If(instanceIndex.greaterThanEqual(uint(cellCount)), () => { Return(); });
      const cell = this.cellBuffer.element(instanceIndex).toConst('cell');
      const mass = decode(cell.get('mass')).toConst('cmass');
      If(mass.lessThanEqual(0), () => { Return(); });

      const vx = decode(cell.get('x')).div(mass).toVar('vx');
      const vy = decode(cell.get('y')).div(mass).toVar('vy');
      const vz = decode(cell.get('z')).div(mass).toVar('vz');

      const g = U.gridSize;
      const x = int(instanceIndex).div(g.z).div(g.y);
      const y = int(instanceIndex).div(g.z).mod(g.y);
      const z = int(instanceIndex).mod(g.z);

      If(x.lessThan(int(2)).or(x.greaterThan(g.x.sub(int(2)))), () => { vx.assign(0); });
      If(y.lessThan(int(2)).or(y.greaterThan(g.y.sub(int(2)))), () => { vy.assign(0); });
      If(z.lessThan(int(2)).or(z.greaterThan(g.z.sub(int(2)))), () => { vz.assign(0); });

      this.cellBufferF.element(instanceIndex).assign(vec4(vx, vy, vz, mass));
    })().compute(cellCount);

    // --- g2p: gather velocity, rebuild affine C, integrate, color ---
    this.kernels.g2p = Fn(() => {
      If(instanceIndex.greaterThanEqual(U.numParticles), () => { Return(); });
      const p = this.particleBuffer.element(instanceIndex);
      const particleMass = p.get('mass').toConst('particleMass');
      const particleDensity = p.get('density').toConst('particleDensity');
      const pos = p.get('position').xyz.toVar('pos');
      const vel = vec3(0).toVar('vel');

      // gravity
      vel.addAssign(U.gravity.mul(U.dt));

      // curl-noise turbulence (treble-driven via U.noise)
      const n = triNoise3D(pos.mul(0.015), time, 0.11).sub(0.285).normalize().mul(0.28).toVar('n');
      vel.subAssign(n.mul(U.noise).mul(U.dt));

      // audio swirl + radial pulse around the grid center
      const center = vec3(U.gridSize).mul(0.5);
      const toC = pos.sub(center).toConst('toC');
      const radial = toC.normalize();
      vel.addAssign(radial.mul(U.audioPulse).mul(U.dt));
      const tangent = cross(radial, vec3(0, 1, 0)).normalize();
      vel.addAssign(tangent.mul(U.swirl).mul(U.dt));

      const cellIndex = ivec3(pos).sub(1).toConst('cellIndex');
      const cellDiff = pos.fract().sub(0.5).toConst('cellDiff');
      const weights = bsplineWeights(cellDiff);

      const B = mat3(0).toVar('B');
      Loop({ start: 0, end: 3, type: 'int', name: 'gx', condition: '<' }, ({ gx }: any) => {
        Loop({ start: 0, end: 3, type: 'int', name: 'gy', condition: '<' }, ({ gy }: any) => {
          Loop({ start: 0, end: 3, type: 'int', name: 'gz', condition: '<' }, ({ gz }: any) => {
            const weight = weights.element(gx).x.mul(weights.element(gy).y).mul(weights.element(gz).z);
            const cellX = cellIndex.add(ivec3(gx, gy, gz)).toConst();
            const cellDist = vec3(cellX).add(0.5).sub(pos).toConst('cellDist');
            const wv = this.cellBufferF.element(getCellPtr(cellX)).xyz.mul(weight).toConst('wv');
            const term = mat3(wv.mul(cellDist.x), wv.mul(cellDist.y), wv.mul(cellDist.z));
            B.addAssign(term);
            vel.addAssign(wv);
          });
        });
      });

      // mouse-ray force: distance from the picking ray pushes particles along mouseForce
      const dist = cross(U.mouseRayDirection, pos.mul(vec3(1, 1, 0.4)).sub(U.mouseRayOrigin)).length();
      const force = dist.mul(0.1).oneMinus().max(0.0).pow(2).toConst('force');
      vel.addAssign(U.mouseForce.mul(force));
      vel.mulAssign(particleMass);

      p.get('C').assign(B.mul(4));
      pos.addAssign(vel.mul(U.dt));
      pos.assign(clamp(pos, vec3(2), vec3(U.gridSize).sub(2)));

      // soft walls (predictive)
      const wallStiffness = 0.3;
      const xN = pos.add(vel.mul(U.dt).mul(3.0)).toConst('xN');
      const wallMin = vec3(3).toConst('wallMin');
      const wallMax = vec3(U.gridSize).sub(3).toConst('wallMax');
      If(xN.x.lessThan(wallMin.x), () => { vel.x.addAssign(wallMin.x.sub(xN.x).mul(wallStiffness)); });
      If(xN.x.greaterThan(wallMax.x), () => { vel.x.addAssign(wallMax.x.sub(xN.x).mul(wallStiffness)); });
      If(xN.y.lessThan(wallMin.y), () => { vel.y.addAssign(wallMin.y.sub(xN.y).mul(wallStiffness)); });
      If(xN.y.greaterThan(wallMax.y), () => { vel.y.addAssign(wallMax.y.sub(xN.y).mul(wallStiffness)); });
      If(xN.z.lessThan(wallMin.z), () => { vel.z.addAssign(wallMin.z.sub(xN.z).mul(wallStiffness)); });
      If(xN.z.greaterThan(wallMax.z), () => { vel.z.addAssign(wallMax.z.sub(xN.z).mul(wallStiffness)); });

      p.get('position').assign(pos);
      p.get('velocity').assign(vel);

      const direction = p.get('direction');
      direction.assign(mix(direction, vel, 0.1));

      const hue = particleDensity.div(U.restDensity).mul(0.25).add(time.mul(0.05));
      const sat = vel.length().mul(0.5).clamp(0, 1).mul(0.3).add(0.7);
      const val = force.mul(0.3).add(0.7);
      p.get('color').assign(hsv2rgb(vec3(hue, sat, val)));
    })().compute(particles);
  }

  /** Feed the picking ray (origin/dir in world space) + intersection point into the sim. */
  setMouseRay(origin: THREE.Vector3, direction: THREE.Vector3, pos: THREE.Vector3) {
    const o = origin.clone().multiplyScalar(64).add(new THREE.Vector3(32, 0, 0));
    const pp = pos.clone().multiplyScalar(64);
    this.uniforms.mouseRayDirection.value.copy(direction.clone().normalize());
    this.uniforms.mouseRayOrigin.value.copy(o);
    this.mousePos.copy(pp);
  }

  setParticleCount(n: number) {
    if (n === this.numParticles) return;
    this.numParticles = n;
    this.uniforms.numParticles.value = n;
    this.kernels.p2g1.count = n;
    this.kernels.p2g1.updateDispatchCount();
    this.kernels.p2g2.count = n;
    this.kernels.p2g2.updateDispatchCount();
    this.kernels.g2p.count = n;
    this.kernels.g2p.updateDispatchCount();
  }

  async update(interval: number) {
    const U = this.uniforms;
    U.noise.value = this.noise;
    U.stiffness.value = this.stiffness;
    U.restDensity.value = this.restDensity;
    U.dynamicViscosity.value = this.dynamicViscosity;
    U.gravity.value.copy(this.gravityVec);
    U.audioPulse.value = this.audioPulse;
    U.swirl.value = this.swirl;

    const dt = Math.min(interval, 1 / 60) * 6 * this.speed;
    U.dt.value = dt;

    // smoothed mouse velocity over a short trail
    this.mouseTrail.push(this.mousePos.clone());
    if (this.mouseTrail.length > 3) this.mouseTrail.shift();
    if (this.mouseTrail.length > 1) {
      U.mouseForce.value
        .copy(this.mouseTrail[this.mouseTrail.length - 1])
        .sub(this.mouseTrail[0])
        .divideScalar(this.mouseTrail.length);
    }

    await this.renderer.computeAsync([
      this.kernels.clearGrid,
      this.kernels.p2g1,
      this.kernels.p2g2,
      this.kernels.updateGrid,
      this.kernels.g2p,
    ]);
  }

  dispose() {
    // GPU buffers are released when the renderer is disposed by the host component.
    this.kernels = {};
  }
}
