import { MyceliumCanvas } from './MyceliumCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300; // 5 minutes

const SCENE_LABELS: [number, string][] = [
  [0,   'MYCELIUM NETWORK'],
  [60,  'TOUCH TO GROW'],
  [130, 'THE NETWORK EXPANDS'],
  [200, 'BIOLUMINESCENCE'],
  [260, 'ROOT SYSTEM'],
];

export const myceliumExperience: ExperienceDefinition = {
  id: 'mycelium',
  title: 'MYCELIUM',
  description: 'A bioluminescent fungal network that grows from your touch',
  duration: DURATION,
  Component: MyceliumCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) {
      if (elapsed >= t) label = text;
    }
    return label;
  },
};
