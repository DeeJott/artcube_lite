import { AuroraCanvas } from './AuroraCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'AURORA BOREALIS'],
  [60,  'TOUCH THE LIGHT'],
  [120, 'NORTHERN WINDS'],
  [200, 'STELLAR PULSE'],
  [260, 'FADE TO DARK'],
];

export const auroraExperience: ExperienceDefinition = {
  id: 'aurora',
  title: 'AURORA',
  description: 'Northern lights shimmer and respond to your touch',
  duration: DURATION,
  Component: AuroraCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
