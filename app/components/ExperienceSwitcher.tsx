'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ExperienceDefinition } from '../lib/experience-types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExperienceSwitcherProps {
  experiences: ExperienceDefinition[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function ExperienceSwitcher({
  experiences,
  selectedId,
  disabled = false,
  onSelect,
}: ExperienceSwitcherProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-mono text-[0.65rem] tracking-[0.22em] text-foreground-muted uppercase">
        Experience
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {experiences.map((exp) => (
          <button
            key={exp.id}
            onClick={() => !disabled && onSelect(exp.id)}
            disabled={disabled}
            title={exp.description}
            className={cn(
              'px-3 py-3 text-[0.65rem] tracking-[0.14em] border border-dashed transition-all duration-300 font-sans uppercase text-center',
              selectedId === exp.id
                ? 'border-accent text-accent bg-background-elevated'
                : 'border-border text-foreground-secondary/60 bg-background/20 hover:border-border-hover hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-70'
            )}
          >
            {exp.title}
          </button>
        ))}
      </div>
    </div>
  );
}
