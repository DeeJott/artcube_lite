import { BerlinParticlesCanvas } from './BerlinParticlesCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300;

const SCENE_LABELS: [number, string][] = [
  [0,   'BERLIN · PARTICLES'],
  [30,  'SKYLINE EMERGES'],
  [60,  'CITY IN FLOW'],
  [120, 'LANDMARKS DISSOLVE'],
  [200, 'SKYLINE REBUILDS'],
  [260, 'FADE TO NIGHT'],
];

export const berlinParticlesExperience: ExperienceDefinition = {
  id: 'berlinparticles',
  title: 'BERLIN · PARTICLES',
  description:
    'Berlin landmarks rebuilt from 25K fluid-driven particles. Siegessäule, Cathedral, TV Tower, Brandenburg Gate, and Reichstag shimmer and scatter with every beat — then spring back into shape.',
  duration: DURATION,
  Component: BerlinParticlesCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
