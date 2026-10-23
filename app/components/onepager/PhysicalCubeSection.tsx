'use client';

import { LuBox } from 'react-icons/lu';
import { FiUsers, FiSliders } from 'react-icons/fi';

export function PhysicalCubeSection() {
  return (
    <section id="cube" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
          Unsere Vision
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Im art<span className="text-[#ff2a9d]">.</span>cube wirst du die{' '}
          <span className="bg-gradient-to-r from-purple-300 via-pink-400 to-[#ff2a9d] bg-clip-text text-transparent">
            Kunstwerke vollenden
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-white/75 font-light leading-relaxed">
          Das Smartphone in deiner Hand wird zum Pinsel, der Raum um dich herum zur lebendigen Leinwand. Ein noch nie dagewesenes Zusammenspiel aus Licht, Klang und menschlicher Interaktion.
        </p>
      </div>

      {/* 3 Key Aspects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Card 1: Modulare Konstruktion */}
        <div className="relative rounded-[30px] p-7 sm:p-8 bg-[rgba(18,12,28,0.8)] border border-purple-500/25 backdrop-blur-xl shadow-xl flex flex-col justify-between group hover:border-purple-500/50 hover:-translate-y-1 transition-all duration-300">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 mb-6 group-hover:scale-110 transition-transform duration-300">
              <LuBox className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Leichte, begehbare Kuben
            </h3>
            <p className="text-sm text-white/70 leading-relaxed font-light">
              art.cubes werden leichte Konstruktionen sein, die im Inneren verschiedene immersive Kunstwerke präsentieren und Besuchenden ein einmaliges Erlebnis eröffnen.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 text-xs font-mono text-purple-300/60">
            01 / RAUMARCHITEKTUR
          </div>
        </div>

        {/* Card 2: Kollektive Co-Kreation */}
        <div className="relative rounded-[30px] p-7 sm:p-8 bg-[rgba(18,12,28,0.8)] border border-pink-500/25 backdrop-blur-xl shadow-xl flex flex-col justify-between group hover:border-pink-500/50 hover:-translate-y-1 transition-all duration-300">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-[#ff80df] mb-6 group-hover:scale-110 transition-transform duration-300">
              <FiUsers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Echtzeit-Interaktion im Kollektiv
            </h3>
            <p className="text-sm text-white/70 leading-relaxed font-light">
              In kleinen Gruppen interagiert ihr in Echtzeit mit den Kunstwerken. Kein Besuch gleicht dem vorherigen: Euer kollektives Verhalten formt die visuellen Elemente jedes Mal einzigartig.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 text-xs font-mono text-pink-300/60">
            02 / KOLLEKTIVE DYNAMIK
          </div>
        </div>

        {/* Card 3: Intuitives Smartphone-Interface */}
        <div className="relative rounded-[30px] p-7 sm:p-8 bg-[rgba(18,12,28,0.8)] border border-cyan-500/25 backdrop-blur-xl shadow-xl flex flex-col justify-between group hover:border-cyan-500/50 hover:-translate-y-1 transition-all duration-300">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[#4ee2ec] mb-6 group-hover:scale-110 transition-transform duration-300">
              <FiSliders className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Mühelos über das eigene Handy
            </h3>
            <p className="text-sm text-white/70 leading-relaxed font-light">
              Keine sperrige Hardware, keine komplizierten Anleitungen: Eine einfache, intuitive Steuerung über das eigene Smartphone macht das Erlebnis für alle Besuchenden spielend leicht.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 text-xs font-mono text-cyan-300/60">
            03 / NAHTLOSE KONTROLLE
          </div>
        </div>

      </div>

    </section>
  );
}
