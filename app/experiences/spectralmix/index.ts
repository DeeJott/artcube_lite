import { SpectralMixCanvas } from './SpectralMixCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300;

const SCENE_LABELS: [number, string][] = [
  [0, 'TOUCH THE FIELD'],
  [45, 'SWIPE TO MIX'],
  [105, 'SPECTRAL TURBULENCE'],
  [180, 'CHROMA BLOOM'],
  [245, 'FULL DISPERSION'],
];

export const spectralMixExperience: ExperienceDefinition = {
  id: 'spectralmix',
  title: 'SPECTRAL MIX',
  description: 'A dense particle field that smoothly blends motion fields through click-drag and swipe gestures.',
  duration: DURATION,
  Component: SpectralMixCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
