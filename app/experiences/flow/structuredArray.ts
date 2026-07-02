/* eslint-disable @typescript-eslint/no-explicit-any */
// Typed, std140-ish packed GPU storage buffer built on TSL `struct` + `instancedArray`.
// Lets us declare a struct-of-arrays layout once and read/write members by name on
// both the CPU (initial seeding) and the GPU (compute kernels). Atomic members can be
// toggled per-kernel so the same buffer is usable for scatter (atomicAdd) and read passes.

import { struct, instancedArray } from 'three/tsl';

type MemberType =
  | 'int' | 'uint' | 'float'
  | 'vec2' | 'ivec2' | 'uvec2'
  | 'vec3' | 'ivec3' | 'uvec3'
  | 'vec4' | 'ivec4' | 'uvec4'
  | 'mat2' | 'mat3' | 'mat4';

interface TypeInfo { size: number; alignment: number; isFloat: boolean; }

const TYPES: Record<MemberType, TypeInfo> = {
  int: { size: 1, alignment: 1, isFloat: false },
  uint: { size: 1, alignment: 1, isFloat: false },
  float: { size: 1, alignment: 1, isFloat: true },
  vec2: { size: 2, alignment: 2, isFloat: true },
  ivec2: { size: 2, alignment: 2, isFloat: false },
  uvec2: { size: 2, alignment: 2, isFloat: false },
  vec3: { size: 3, alignment: 4, isFloat: true },
  ivec3: { size: 3, alignment: 4, isFloat: false },
  uvec3: { size: 3, alignment: 4, isFloat: false },
  vec4: { size: 4, alignment: 4, isFloat: true },
  ivec4: { size: 4, alignment: 4, isFloat: false },
  uvec4: { size: 4, alignment: 4, isFloat: false },
  mat2: { size: 4, alignment: 2, isFloat: true },
  mat3: { size: 12, alignment: 4, isFloat: true },
  mat4: { size: 16, alignment: 4, isFloat: true },
};

interface ParsedMember {
  type: MemberType;
  atomic?: boolean;
  size: number;
  isFloat: boolean;
  offset: number;
}

export type StructLayout = Record<string, MemberType | { type: MemberType; atomic?: boolean }>;

type Vec = number[] | { x: number; y?: number; z?: number; w?: number };

export class StructuredArray {
  readonly layout: Record<string, ParsedMember>;
  readonly length: number;
  structSize = 0;
  readonly structNode: any;
  readonly floatArray: Float32Array;
  readonly intArray: Int32Array;
  readonly buffer: any;

  constructor(layout: StructLayout, length: number, label: string) {
    this.layout = this._parse(layout);
    this.length = length;
    this.structNode = struct(this.layout as any);
    this.floatArray = new Float32Array(this.structSize * this.length);
    this.intArray = new Int32Array(this.floatArray.buffer);
    this.buffer = instancedArray(this.floatArray, this.structNode).label(label);
  }

  /** Toggle WGSL atomic<T> generation for a member before building a kernel that uses it. */
  setAtomic(element: string, value: boolean): void {
    const index = Object.keys(this.layout).findIndex((k) => k === element);
    if (index >= 0) {
      this.buffer.structTypeNode.membersLayout[index].atomic = value;
    }
  }

  /** CPU-side write of a member for a given element index (used to seed the buffer). */
  set(index: number, element: string, value: number | Vec): void {
    const member = this.layout[element];
    if (!member) {
      console.error(`StructuredArray: unknown element '${element}'`);
      return;
    }
    const offset = index * this.structSize + member.offset;
    const array = member.isFloat ? this.floatArray : this.intArray;

    if (member.size === 1) {
      if (typeof value !== 'number') {
        console.error(`StructuredArray: expected a number for '${element}'`);
        return;
      }
      array[offset] = value;
      return;
    }

    let arr: number[];
    if (typeof value === 'object' && !Array.isArray(value)) {
      arr = [value.x, value.y ?? 0, value.z ?? 0, value.w ?? 0];
    } else {
      arr = value as number[];
    }
    if (!Array.isArray(arr) || arr.length < member.size) {
      console.error(`StructuredArray: expected ${member.size} components for '${element}'`);
      return;
    }
    for (let i = 0; i < member.size; i++) array[offset + i] = arr[i];
  }

  element(index: any): any {
    return this.buffer.element(index);
  }

  get(index: any, element: string): any {
    return this.buffer.element(index).get(element);
  }

  private _parse(layout: StructLayout): Record<string, ParsedMember> {
    let offset = 0;
    const parsed: Record<string, ParsedMember> = {};

    for (const key of Object.keys(layout)) {
      const raw = layout[key];
      const def = typeof raw === 'string' ? { type: raw } : raw;
      const info = TYPES[def.type];
      if (!info) {
        console.error(`StructuredArray: unknown type '${def.type}'`);
        continue;
      }
      const rest = offset % info.alignment;
      if (rest !== 0) offset += info.alignment - rest;

      parsed[key] = {
        type: def.type,
        atomic: (def as { atomic?: boolean }).atomic,
        size: info.size,
        isFloat: info.isFloat,
        offset,
      };
      offset += info.size;
    }

    const tail = offset % 4;
    if (tail !== 0) offset += 4 - tail;
    this.structSize = offset;
    return parsed;
  }
}
