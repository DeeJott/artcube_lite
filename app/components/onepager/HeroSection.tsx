'use client';

import { FiArrowDown, FiCompass, FiGlobe, FiUsers, FiBox } from 'react-icons/fi';

interface HeroSectionProps {
  onNavigateTo: (id: string) => void;
}

export function HeroSection({ onNavigateTo }: HeroSectionProps) {
  return (
    <section id="top" className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
      
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] rounded-full bg-gradient-to-tr from-[#ff2a9d]/25 via-[#9d4edd]/20 to-[#4ee2ec]/20 blur-[90px] pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 sm:gap-8">
        
        {/* Subtle Pill Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 backdrop-blur-md shadow-[0_0_20px_rgba(255,42,157,0.2)]">
          <span className="w-2 h-2 rounded-full bg-[#ff2a9d] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-pink-200 uppercase">
            Interactive Art in Connection
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          Art in{' '}
          <span className="bg-gradient-to-r from-white via-[#ff80df] to-[#ff2a9d] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(255,42,157,0.6)]">
            Connection
          </span>
        </h1>

        {/* Lead Text */}
        <p className="max-w-2xl text-base sm:text-xl text-white/85 font-light leading-relaxed tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
          Mit artcube werden Kunstwerke lebendig. Entdeckt gemeinsam das erste Kunstwerk und erstellt dabei eure eigenen Souvenirs.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onNavigateTo('erleben')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-[#ff2a9d] via-[#d946ef] to-[#06b6d4] shadow-[0_10px_35px_rgba(255,42,157,0.45)] hover:shadow-[0_15px_45px_rgba(78,226,236,0.6)] hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
          >
            <span>Kunstwerk jetzt erleben</span>
            <FiArrowDown className="w-4 h-4 animate-bounce" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTo('cube')}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl font-bold text-sm tracking-wider uppercase text-white/90 bg-white/[0.06] border border-white/20 backdrop-blur-md hover:bg-white/[0.12] hover:border-pink-500/50 hover:text-white hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FiCompass className="w-4 h-4 text-[#ff80df]" />
            <span>artcube entdecken</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8 w-full max-w-3xl">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(18,12,28,0.7)] border border-white/10 backdrop-blur-md shadow-lg text-left">
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df]">
              <FiGlobe className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">100% Browserbasiert</span>
              <span className="text-[10px] text-white/60">Keine Installation & Echtzeit</span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(18,12,28,0.7)] border border-white/10 backdrop-blur-md shadow-lg text-left">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec]">
              <FiUsers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Kollaborativer Modus</span>
              <span className="text-[10px] text-white/60">Gemeinsam via Smartphone</span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(18,12,28,0.7)] border border-white/10 backdrop-blur-md shadow-lg text-left">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 text-[#c084fc]">
              <FiBox className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Real Life Installation</span>
              <span className="text-[10px] text-white/60">In the making (Cube Vision)</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
