import { FluidCanvas } from './FluidCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'IGNITION'],
  [60,  'TOUCH THE FLAME'],
  [130, 'TURBULENCE'],
  [210, 'DISSOLVE'],
  [265, 'EMBERS'],
];

export const fluidExperience: ExperienceDefinition = {
  id: 'fluid',
  title: 'FLUID',
  description: 'An interactive real-time fluid simulation — push glowing plumes of dye that rise, swirl, and dissolve.',
  duration: DURATION,
  Component: FluidCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
