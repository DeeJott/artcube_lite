'use client';

import { useState } from 'react';
import { FiUsers, FiMonitor, FiVideo, FiMaximize2, FiSmartphone, FiCpu, FiX, FiCheckCircle } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';

export function StorySection() {
  const [isNftModalOpen, setIsNftModalOpen] = useState(false);

  return (
    <section id="vision" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
          Was ist art.cube?
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Ein Raum für Co-Kreation: <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            Zwei Welten, eine Idee
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-white/80 font-light leading-relaxed">
          Mit <span className="font-semibold text-white">art<span className="text-[#ff2a9d]">.</span>cube</span> wird Kunst für dich zu einem kreativen und interaktiven Erlebnis, das du gemeinsam mit anderen teilen kannst. Unsere Kunstwerke starten zuerst weltweit im Browser — später entstehen begehbare, immersive Orte, in denen ihr zusammen die Kunst mit euren Smartphones steuert. Der Raum um dich herum zur lebendigen Leinwand. Ein noch nie dagewesenes Zusammenspiel aus Licht, Klang und menschlicher Interaktion.
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

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide mb-6">
              Der digitale Prototyp
            </h3>

            <ul className="space-y-5">
              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiUsers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Allein oder zu zweit erleben</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Verbindet euch per Einladungslink in Sekundenschnelle und gestaltet synchron die visuellen Elemente. Keine Apps und kein Download — es geht direkt los.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiMonitor className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Auf allen Geräten erlebbar</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Läuft auf Desktops, Tablets und Smartphones.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0 text-[#ff80df] mt-0.5">
                  <FiVideo className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Eigenes digitales Souvenir</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Haltet eure Schöpfung in einem 14-sekündigen animierten Video-Souvenir{' '}
                    <span className="font-extrabold bg-gradient-to-r from-[#ff2a9d] via-[#d946ef] to-[#4ee2ec] bg-clip-text text-transparent">
                      für immer
                    </span>{' '}
                    fest.{' '}
                    <button
                      type="button"
                      onClick={() => setIsNftModalOpen(true)}
                      className="inline-flex items-center gap-1 font-semibold text-[#4ee2ec] hover:text-[#ff80df] underline underline-offset-4 decoration-[#4ee2ec]/60 hover:decoration-[#ff80df] transition-colors cursor-pointer"
                    >
                      <span>Wie funktioniert das?</span>
                      <LuSparkles className="w-3.5 h-3.5 inline" />
                    </button>
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Card 2: Der art.cube. Loading... */}
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
                Der art.cube.
              </h3>
              <span className="text-sm sm:text-base font-semibold text-cyan-300 tracking-wider">
                Loading...
              </span>
            </div>

            {/* Animated Loading Progress Bar */}
            <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden mb-6">
              <div className="animate-loading-bar h-full rounded-full bg-gradient-to-r from-pink-500 via-[#ff2a9d] to-[#4ee2ec] shadow-[0_0_12px_rgba(78,226,236,0.8)]" />
            </div>

            <ul className="space-y-5">
              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiMaximize2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Audioreaktive 360° Projektionen</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Gemeinsam in Gruppen 360-Grad-Projektionen erleben, die auf Interaktion reagieren.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiSmartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Smartphone als magischer Controller</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Mit euren eigenen Smartphones steuert und formt ihr Kunstwerke auf magische Art und Weise.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-[#4ee2ec] mt-0.5">
                  <FiCpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Einzigartige Gruppen-Erlebnisse</h4>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    Keine zwei Besuche sind gleich: Das kollektive Verhalten der Gruppe formt das Kunstwerk jedes Mal neu.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* Lightbox Modal: Wie funktioniert das? (NFT & Blockchain Permanenz) */}
      {isNftModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 bg-[rgba(18,12,28,0.96)] border border-pink-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(255,42,157,0.25)] text-left flex flex-col gap-5">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff2a9d] to-[#4ee2ec] flex items-center justify-center shadow-[0_0_15px_rgba(255,42,157,0.5)]">
                  <LuSparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
                    Wie funktioniert das?
                  </h3>
                  <span className="text-[11px] font-mono tracking-wider text-pink-300/70 uppercase">
                    Digitale Kunst & Web3-Permanenz
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNftModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                aria-label="Schließen"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-white/80 font-light leading-relaxed">
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <FiCheckCircle className="w-5 h-5 text-[#4ee2ec] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-white block mb-0.5">Dein persönliches Unikat</strong>
                  Jedes 14-sekündige Video-Souvenir entsteht live aus deinen individuellen Entscheidungen und Berührungen. Kein anderes Kunstwerk existiert ein zweites Mal so wie deins.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <FiCheckCircle className="w-5 h-5 text-[#ff80df] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-white block mb-0.5">Was ist ein NFT?</strong>
                  Ein NFT (Non-Fungible Token) funktioniert wie eine digitale Besitzurkunde. Auf einer modernen, dezentralen Blockchain gesichert, belegt es unwiderruflich, wer das Werk erschaffen hat und wem es gehört.
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <FiCheckCircle className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-white block mb-0.5">Für immer gültig & abrufbar</strong>
                  Weil Blockchain-Einträge nicht gelöscht oder manipuliert werden können, bleibt dein Kunstwerk für immer dezentral erhalten — ohne Abhängigkeit von einzelnen Apps oder Betreibern.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNftModalOpen(false)}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-[#ff2a9d] via-[#d946ef] to-[#06b6d4] shadow-[0_10px_25px_rgba(255,42,157,0.4)] hover:shadow-[0_12px_30px_rgba(78,226,236,0.6)] hover:scale-[1.01] transition-all duration-300 cursor-pointer"
            >
              Verstanden & Schließen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
