'use client';

import { FiCheckCircle, FiClock, FiFlag } from 'react-icons/fi';
import { Language, translations } from './translations';

interface RoadmapSectionProps {
  lang: Language;
}

export function RoadmapSection({ lang }: RoadmapSectionProps) {
  const t = translations[lang].roadmap;

  const steps = [
    {
      step: 'Step 1',
      status: 'DONE',
      statusLabel: t.step1Badge,
      title: t.step1Title,
      description: t.step1Desc,
    },
    {
      step: 'Step 2',
      status: 'COMING SOON',
      statusLabel: t.step2Badge,
      title: t.step2Title,
      description: t.step2Desc,
    },
    {
      step: 'Step 3',
      status: '2027',
      statusLabel: t.step3Badge,
      title: t.step3Title,
      description: t.step3Desc,
    },
  ];

  return (
    <section id="roadmap" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Background Ambience */}
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-pink-600/10 rounded-full blur-[90px] pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300 text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
          {t.pill}
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {t.headline}
        </h2>
        <p className="mt-4 text-sm sm:text-base text-white/75 font-light leading-relaxed">
          {t.subline}
        </p>
      </div>

      {/* Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative">
        {steps.map((item) => (
          <div
            key={item.step}
            className={`relative rounded-[30px] p-7 sm:p-8 bg-[rgba(18,12,28,0.85)] border backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
              item.status === 'DONE'
                ? 'border-emerald-500/40 shadow-[0_15px_35px_rgba(52,211,153,0.15)]'
                : item.status === 'COMING SOON'
                ? 'border-[#ff2a9d]/50 shadow-[0_15px_35px_rgba(255,42,157,0.2)]'
                : 'border-cyan-500/40 shadow-[0_15px_35px_rgba(78,226,236,0.15)]'
            }`}
          >
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-2 mb-6">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-white/50">
                  {item.step}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                    item.status === 'DONE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : item.status === 'COMING SOON'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  {item.status === 'DONE' ? (
                    <FiCheckCircle className="w-3.5 h-3.5" />
                  ) : item.status === 'COMING SOON' ? (
                    <FiClock className="w-3.5 h-3.5" />
                  ) : (
                    <FiFlag className="w-3.5 h-3.5" />
                  )}
                  <span>{item.statusLabel}</span>
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
