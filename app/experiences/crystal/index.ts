import { CrystalCanvas } from './CrystalCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'CRYSTAL GENESIS'],
  [60,  'GROW THE LATTICE'],
  [120, 'PRISMATIC LIGHT'],
  [200, 'RESONANCE'],
  [260, 'FACETING'],
];

export const crystalExperience: ExperienceDefinition = {
  id: 'crystal',
  title: 'CRYSTAL',
  description: 'Grow crystalline structures with prismatic light beams between them',
  duration: DURATION,
  Component: CrystalCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
