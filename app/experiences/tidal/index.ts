import { TidalCanvas } from './TidalCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'STILL WATERS'],
  [60,  'CAST STONES'],
  [120, 'INTERFERENCE'],
  [200, 'TURBULENT SEA'],
  [260, 'RIPPLES FADE'],
];

export const tidalExperience: ExperienceDefinition = {
  id: 'tidal',
  title: 'TIDAL',
  description: 'Cast ripples into a shader-driven water surface with real-time wave interference',
  duration: DURATION,
  Component: TidalCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
