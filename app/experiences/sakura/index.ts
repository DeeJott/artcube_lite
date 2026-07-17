import { SakuraCanvas } from './SakuraCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

export const sakuraExperience: ExperienceDefinition = {
  id: 'sakura',
  title: 'Sakura',
  description: 'Ein meditatives Kunstwerk über das Erblühen und Verwelken von Kirschblüten, inspiriert durch die fluiden, dunkelpinken Formen des Shibuya Sakura Stage.',
  duration: 80,
  Component: SakuraCanvas,
  getHUDText: (elapsed: number) => {
    if (elapsed < 20) return 'Wachstum — Der Sakura-Gitterbaum entsteht';
    if (elapsed < 40) return 'Erblühen — Die Blüten entfalten sich';
    if (elapsed < 60) return 'Tanz — Blütenblätter im Datenwind';
    return 'Vergänglichkeit — Rückkehr ins Netzwerk';
  },
};
