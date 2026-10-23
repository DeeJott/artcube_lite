'use client';

import { FiCheckCircle, FiClock, FiFlag } from 'react-icons/fi';

export function RoadmapSection() {
  const steps = [
    {
      step: 'Step 1',
      status: 'DONE',
      statusLabel: 'Abgeschlossen',
      statusColor: 'emerald',
      title: 'Digitaler & Interaktiver Prototyp',
      description:
        'Erfolgreicher Launch von Sakuraverse: WebGL- und WebRTC-fähige Kunstwerke direkt im Browser auf allen Endgeräten mit Echtzeit-Kollaboration und digitalem Souvenir.',
      badge: 'Live',
    },
    {
      step: 'Step 2',
      status: 'COMING SOON',
      statusLabel: 'Coming Soon',
      statusColor: 'pink',
      title: 'Physischer Prototyp & Test-Setup',
      description:
        'Test und Präsentation eines ersten physischen Prototypen. Ein simples, wirkungsvolles Setup für die erste echte Real Life-Erfahrung mit art.cube und Smartphone-Steuerung.',
      badge: 'In Entwicklung',
    },
    {
      step: 'Step 3',
      status: '2027',
      statusLabel: '2027',
      statusColor: 'cyan',
      title: 'Der erste vollwertige art.cube',
      description:
        'Planung, Konstruktion und Eröffnung des ersten maßgeschneiderten, begehbaren 360°-art.cubes für immersive Ausstellungsevents und kollektive Kunsterlebnisse.',
      badge: 'Vision 2027',
    },
  ];

  return (
    <section id="roadmap" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Background Ambience */}
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-pink-600/10 rounded-full blur-[90px] pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-300 text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
          Meilensteine
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Die{' '}
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            art.cube Roadmap
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-white/75 font-light leading-relaxed">
          Vom ersten Pixel im Browser bis zum immersiven Raum: so wird art.cube Realität.
        </p>
      </div>

      {/* Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative">
        {steps.map((item, index) => (
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
              <p className="text-sm text-white/75 leading-relaxed font-light">
                {item.description}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>Phase 0{index + 1}</span>
              <span className="font-semibold text-white/80">{item.badge}</span>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
