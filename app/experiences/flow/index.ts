import { FlowCanvas } from './FlowCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0, 'MATERIAL POINT GENESIS'],
  [60, 'VISCOUS BLOOM'],
  [120, 'TURBULENT CASCADE'],
  [200, 'RESONANT VORTEX'],
  [260, 'DISSOLUTION'],
];

export const flowExperience: ExperienceDefinition = {
  id: 'flow',
  title: 'FLOW',
  description: 'Realtime MLS-MPM particle fluid simulated on the GPU with WebGPU compute',
  duration: DURATION,
  Component: FlowCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
