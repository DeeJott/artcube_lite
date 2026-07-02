import type { ExperienceDefinition } from '../../lib/experience-types';
import { Particles2DCanvas } from './Particles2DCanvas';

export const particles2dExperience: ExperienceDefinition = {
  id: 'particles2d',
  title: 'Particles',
  description:
    'A GPGPU particle cloud driven by a real-time fluid simulation. Pointer strokes paint flow into the velocity field; particles carry momentum and settle back with spring-damper physics. Audio-reactive forces and bloom.',
  duration: 180,
  Component: Particles2DCanvas,
  getHUDText: (elapsed: number) => {
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    return `PARTICLES 2D · ${mins}:${secs.toString().padStart(2, '0')}`;
  },
};
