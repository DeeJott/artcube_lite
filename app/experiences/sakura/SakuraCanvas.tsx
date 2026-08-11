'use client';

import { useEffect } from 'react';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

export function SakuraCanvas({ onRendererReady }: ExperienceComponentProps) {
  useEffect(() => {
    const api: ExperienceRendererAPI = {
      start: () => {},
    };
    onRendererReady(api);
  }, [onRendererReady]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#08000c]">
      <iframe
        src="/sakura-v3.html"
        className="w-full h-full border-0 block"
        title="Sakura V3 Interactive Artwork"
        allow="autoplay; clipboard-write; encrypted-media"
      />
    </div>
  );
}
