'use client';

import { useState } from 'react';
import { LuBox } from 'react-icons/lu';
import { FiArrowUp, FiMail, FiShield, FiFileText } from 'react-icons/fi';
import { PiX } from 'react-icons/pi';

interface OnepagerFooterProps {
  onScrollToTop: () => void;
}

export function OnepagerFooter({ onScrollToTop }: OnepagerFooterProps) {
  const [legalModal, setLegalModal] = useState<'impressum' | 'datenschutz' | null>(null);

  return (
    <footer className="relative border-t border-white/10 bg-[rgba(10,5,16,0.85)] backdrop-blur-xl py-12 px-4 sm:px-6 lg:px-8 mt-12 text-white/70">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Brand & Claim */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff2a9d] to-[#7928ca] flex items-center justify-center">
              <LuBox className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-base tracking-[0.2em] text-white">
              ART<span className="text-[#ff2a9d]">.</span>CUBE
            </span>
          </div>
          <p className="text-xs text-white/50 tracking-wider">
            Art in Connection — Kollaborative Kunst im digitalen & physischen Raum.
          </p>
        </div>

        {/* Links & Contact */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium">
          <a
            href="mailto:hallo@artcube.art"
            className="flex items-center gap-1.5 text-white/80 hover:text-[#ff80df] transition-colors"
          >
            <FiMail className="w-4 h-4" />
            <span>Kontakt</span>
          </a>

          <button
            type="button"
            onClick={() => setLegalModal('impressum')}
            className="flex items-center gap-1.5 text-white/80 hover:text-[#ff80df] transition-colors cursor-pointer"
          >
            <FiFileText className="w-4 h-4" />
            <span>Impressum</span>
          </button>

          <button
            type="button"
            onClick={() => setLegalModal('datenschutz')}
            className="flex items-center gap-1.5 text-white/80 hover:text-[#ff80df] transition-colors cursor-pointer"
          >
            <FiShield className="w-4 h-4" />
            <span>Datenschutz</span>
          </button>

          <button
            type="button"
            onClick={onScrollToTop}
            className="flex items-center gap-1.5 text-pink-300 hover:text-white px-3 py-1 rounded-full bg-white/5 border border-white/10 hover:border-pink-500/40 transition-all cursor-pointer"
          >
            <FiArrowUp className="w-3.5 h-3.5" />
            <span>Nach oben</span>
          </button>
        </div>

      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 text-center text-[11px] text-white/40 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© 2026 artcube. All rights reserved.</span>
        <span>Made for collaborative experiences.</span>
      </div>

      {/* Lightweight Legal Notice Modal (Impressum & Datenschutz) */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-[28px] p-6 sm:p-8 bg-[rgba(18,12,28,0.96)] border border-pink-500/40 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <PiX className="w-5 h-5" />
            </button>

            {legalModal === 'impressum' ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white tracking-wide uppercase">
                  Impressum
                </h3>
                <div className="text-xs text-white/80 space-y-3 leading-relaxed font-light">
                  <p>
                    <strong>artcube Initiative</strong><br />
                    Forschungs- und Kunstprojekt für kollaborative Medienkunst.
                  </p>
                  <p>
                    <strong>Kontakt:</strong><br />
                    E-Mail: <a href="mailto:hallo@artcube.art" className="text-pink-300 hover:underline">hallo@artcube.art</a>
                  </p>
                  <p>
                    <strong>Hinweis:</strong><br />
                    Dieses Projekt befindet sich im Prototypen- und Entwicklungsstadium. Alle dargestellten Kunstwerke und Prototypen dienen künstlerischen und technologischen Demonstrationszwecken.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white tracking-wide uppercase">
                  Datenschutzerklärung
                </h3>
                <div className="text-xs text-white/80 space-y-3 leading-relaxed font-light">
                  <p>
                    <strong>Keine Werbetracker oder Tracking-Cookies:</strong><br />
                    Wir verwenden keine Marketing-Cookies oder Analyse-Tools Dritter.
                  </p>
                  <p>
                    <strong>Lokale Speicherung (localStorage):</strong><br />
                    Dein Künstlername wird rein lokal in deinem Browser gespeichert, um die Bedienung bei erneuten Besuchen zu erleichtern.
                  </p>
                  <p>
                    <strong>Echtzeit-Kollaboration (PeerJS / WebRTC):</strong><br />
                    Bei der Nutzung des Mehrspielermodus wird eine direkte, verschlüsselte Peer-to-Peer-Verbindung zwischen den teilnehmenden Geräten aufgebaut. Es werden keine Interaktionsdaten dauerhaft auf zentralen Servern gespeichert.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </footer>
  );
}
