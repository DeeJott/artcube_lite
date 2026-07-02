'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ExperienceDefinition } from '../lib/experience-types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExperienceBarProps {
  experiences: ExperienceDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ExperienceBar({
  experiences,
  selectedId,
  onSelect,
}: ExperienceBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex justify-center pb-4 px-4">
        <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 border border-dashed border-border bg-background/70 backdrop-blur-md">
          {experiences.map((exp) => (
            <button
              key={exp.id}
              onClick={() => onSelect(exp.id)}
              title={exp.description}
              className={cn(
                'px-3 py-2 text-[0.6rem] tracking-[0.14em] border transition-all duration-300 font-sans uppercase text-center whitespace-nowrap cursor-pointer',
                selectedId === exp.id
                  ? 'border-accent text-accent bg-background-elevated'
                  : 'border-transparent text-foreground-secondary/50 hover:text-foreground hover:border-border-hover'
              )}
            >
              {exp.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
