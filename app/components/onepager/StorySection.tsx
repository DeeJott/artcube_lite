'use client';

import { FiSmartphone, FiMonitor, FiVideo, FiMaximize2, FiCpu, FiRadio } from 'react-icons/fi';

export function StorySection() {
  return (
    <section id="vision" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
          Die Vision
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Ein Raum für Co-Kreation: <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            Zwei Welten, eine Idee
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-white/75 font-light leading-relaxed">
          Mit artcube wird Kunst für dich zu einem kreativen und interaktiven Erlebnis, das du gemeinsam mit anderen teilen kannst. Unsere Kunstwerke starten zuerst weltweit im Browser — später entstehen begehbare, immersive Räume, in denen ihr zusammen die Kunst mit euren Smartphones steuert.
        </p>
      </div>

      {/* 2-Columns Side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        
        {/* Card 1: Der digitale Prototyp (Now Live) */}
        <div className="relative rounded-[32px] p-7 sm:p-10 bg-[rgba(18,12,28,0.85)] border border-pink-500/30 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(255,42,157,0.15)] flex flex-col justify-between overflow-hidden group hover:border-pink-500/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now Live
              </span>
              <span className="text-xs font-mono text-pink-300/60 tracking-wider">PHASE 1</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide mb-3">
              Der digitale Prototyp
            </h3>
            <p className="text-sm text-white/80 leading-relaxed mb-6 font-light">
              Die erste interaktive Kunstplattform direkt in deinem Browser. Keine Apps, kein Download — pure Co-Creation in Echtzeit.
            </p>

            <ul className="space-y-4">
              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiSmartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Allein oder zu zweit erleben</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Verbindet euch per Einladungslink in Sekundenschnelle und gestaltet synchron die visuellen Elemente.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiMonitor className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Auf allen Geräten erlebbar</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Optimiert für Desktop, Tablets und Smartphones mit flüssiger WebGL-GPU-Beschleunigung.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiVideo className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Eigenes digitales Souvenir</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Haltet eure Schöpfung in einem 14-sekündigen animierten Video-Souvenir für immer fest.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-pink-200/80">
            <span>Plattform: WebGL & WebRTC</span>
            <span className="font-semibold text-[#ff80df]">Kostenlos testen ↓</span>
          </div>
        </div>

        {/* Card 2: Der artcube. Loading... */}
        <div className="relative rounded-[32px] p-7 sm:p-10 bg-[rgba(18,12,28,0.85)] border border-cyan-500/30 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(78,226,236,0.15)] flex flex-col justify-between overflow-hidden group hover:border-cyan-500/60 transition-all duration-300">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Coming Soon
              </span>
              <span className="text-xs font-mono text-cyan-300/60 tracking-wider">PHASE 2</span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
                Der artcube.
              </h3>
              <span className="text-sm sm:text-base font-semibold text-cyan-300 tracking-wider">
                Loading...
              </span>
            </div>

            {/* Animated Loading Progress Bar */}
            <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden mb-6">
              <div className="animate-loading-bar h-full rounded-full bg-gradient-to-r from-pink-500 via-[#ff2a9d] to-[#4ee2ec] shadow-[0_0_12px_rgba(78,226,236,0.8)]" />
            </div>

            <p className="text-sm text-white/80 leading-relaxed mb-6 font-light">
              Die physische Vollendung: Ein begehbarer Raum für Kunstliebhaber, in dem ihr die Dimensionen der digitalen Kunst physisch betretet.
            </p>

            <ul className="space-y-4">
              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiMaximize2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Audioreaktive 360° Projektionen</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Gemeinsam in Gruppen raumfüllende 360-Grad-Projektionen erleben, die auf Klang, Bewegung und Berührung reagieren.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiRadio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Smartphone als magischer Controller</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Mit euren eigenen Smartphones steuert und formt ihr die Lichtbahnen und Partikelströme im Raum.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiCpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Einzigartige Gruppen-Erlebnisse</h4>
                  <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
                    Keine zwei Besuche sind gleich: Das kollektive Verhalten der Gruppe formt das Kunstwerk jedes Mal neu.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-cyan-200/80">
            <span>Vision: Physischer Erlebnisraum</span>
            <span className="font-semibold text-[#4ee2ec]">2026/2027</span>
          </div>
        </div>

      </div>
    </section>
  );
}
