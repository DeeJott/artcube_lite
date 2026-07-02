import { QuantumCanvas } from './QuantumCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'SPIN CORRELATION'],
  [60,  'WAVE COLLAPSE'],
  [120, 'EPR BRIDGE'],
  [180, 'SUPERPOSITION'],
  [240, 'RE-COHERENCE'],
];

export const quantumExperience: ExperienceDefinition = {
  id: 'quantum',
  title: 'QUANTUM',
  description: 'Entangled subatomic particles respond instantaneously across fields',
  duration: DURATION,
  Component: QuantumCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
export default quantumExperience;
