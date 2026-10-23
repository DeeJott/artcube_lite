'use client';

import { useState } from 'react';
import { LuBox } from 'react-icons/lu';
import { HiMenu, HiX } from 'react-icons/hi';

interface OnepagerHeaderProps {
  onOpenWallet: () => void;
  onNavigateTo: (id: string) => void;
}

export function OnepagerHeader({ onOpenWallet, onNavigateTo }: OnepagerHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Was ist art.cube?', href: 'vision' },
    { label: 'Jetzt das Kunstwerk erleben', href: 'erleben' },
    { label: 'Roadmap', href: 'roadmap' },
    { label: 'Community', href: 'newsletter' },
  ];

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    onNavigateTo(id);
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 h-16 border-b border-white/10 backdrop-blur-xl bg-[rgba(10,5,16,0.72)] transition-all duration-300">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <button
          type="button"
          onClick={() => handleNavClick('top')}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff2a9d] to-[#7928ca] flex items-center justify-center shadow-[0_0_15px_rgba(255,42,157,0.4)] group-hover:scale-105 group-hover:shadow-[0_0_22px_rgba(255,42,157,0.7)] transition-all duration-300">
            <LuBox className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-[0.22em] text-white leading-none">
              ART<span className="text-[#ff2a9d]">.</span>CUBE
            </span>
            <span className="text-[9px] tracking-[0.25em] text-pink-300/60 uppercase font-medium mt-0.5">
              art.cube
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => handleNavClick(link.href)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions / CTA Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenWallet}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/[0.05] text-[10px] font-semibold tracking-widest text-white/80 hover:text-white hover:border-[#ff2a9d]/50 hover:bg-[#ff2a9d]/10 transition-all duration-300 cursor-pointer"
          >
            <span>WALLET</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('erleben')}
            className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-[#ff2a9d] to-[#4ee2ec] shadow-[0_0_20px_rgba(255,42,157,0.4)] hover:shadow-[0_0_30px_rgba(78,226,236,0.6)] hover:scale-[1.03] transition-all duration-300 cursor-pointer"
          >
            Kunstwerke starten
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Navigation öffnen"
          >
            {mobileMenuOpen ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Overlay Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bg-[rgba(12,8,22,0.96)] border-b border-pink-500/20 backdrop-blur-2xl p-5 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => handleNavClick(link.href)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold tracking-wider text-white/90 hover:text-white hover:bg-pink-500/15 border border-transparent hover:border-pink-500/30 transition-all"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-white/10 flex justify-between items-center mt-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenWallet();
                }}
                className="text-xs font-semibold tracking-widest text-pink-300 uppercase py-2 px-3"
              >
                Connect Wallet
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('erleben')}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#ff2a9d] to-[#4ee2ec] text-white"
              >
                Kunstwerke starten
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
