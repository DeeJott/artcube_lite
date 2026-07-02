import { auroraExperience } from './aurora';
import { myceliumExperience } from './mycelium';
import { crystalExperience } from './crystal';
import { tidalExperience } from './tidal';
import { spectralMixExperience } from './spectralmix';
import { fluidExperience } from './fluid';
import { flowExperience } from './flow';
import { particles2dExperience } from './particles2d';
import { berlinParticlesExperience } from './berlinparticles';
import { quantumExperience } from './quantum';
import type { ExperienceDefinition } from '../lib/experience-types';

export const EXPERIENCES: ExperienceDefinition[] = [
  berlinParticlesExperience,
  spectralMixExperience,
  particles2dExperience,
  quantumExperience,
  fluidExperience,
  flowExperience,
  myceliumExperience,
  crystalExperience,
  tidalExperience,

  // Add new experiences here — each entry only needs an id, title, description,
  // duration, a Component, and an optional getHUDText function.
];

export const DEFAULT_EXPERIENCE_ID = EXPERIENCES[0].id;
