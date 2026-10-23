'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OnepagerHeader } from './OnepagerHeader';
import { HeroSection } from './HeroSection';
import { StorySection } from './StorySection';
import { ExperienceStation } from './ExperienceStation';
import { RoadmapSection } from './RoadmapSection';
import { NewsletterSection } from './NewsletterSection';
import { OnepagerFooter } from './OnepagerFooter';
import WalletUnavailableModal from '../WalletUnavailableModal';

interface OnepagerViewProps {
  isVisible: boolean;
  isHost: boolean;
  sessionId: string;
  myName: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  onStart: (artwork: 'bluten' | 'plexus', mode?: 'test' | 'souvenir') => void;
  isJoined: boolean;
}

export function OnepagerView({
  isVisible,
  isHost,
  sessionId,
  myName,
  onNameChange,
  onJoin,
  onStart,
  isJoined,
}: OnepagerViewProps) {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Restore name from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('artcube_user_name');
        if (stored && !myName) {
          onNameChange(stored);
        }
      } catch {
        // ignore localStorage errors
      }
    }
  }, [myName, onNameChange]);

  // Save name changes
  const handleNameUpdate = useCallback((val: string) => {
    onNameChange(val);
    try {
      localStorage.setItem('artcube_user_name', val);
    } catch {
      // ignore
    }
  }, [onNameChange]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  }, []);

  const handleNavigateTo = useCallback((id: string) => {
    if (id === 'top') {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 overflow-x-hidden overflow-y-auto select-none transition-opacity duration-700 scroll-smooth bg-[rgba(8,0,14,0.45)] backdrop-blur-[2px] text-white ${
        !isVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 1. Sticky Glassmorphic Header */}
      <OnepagerHeader
        onOpenWallet={() => setWalletModalOpen(true)}
        onNavigateTo={handleNavigateTo}
      />

      {/* 2. Hero Section */}
      <HeroSection onNavigateTo={handleNavigateTo} />

      {/* 3. Story Section: Digital zu Physisch */}
      <StorySection />

      {/* 4. Live Experience Station (Unified Sakuraverse Artworks & Launch Console) */}
      <ExperienceStation
        myName={myName}
        onNameChange={handleNameUpdate}
        isHost={isHost}
        sessionId={sessionId}
        isJoined={isJoined}
        onJoin={onJoin}
        onStart={onStart}
        showToast={showToast}
      />

      {/* 5. Roadmap Section */}
      <RoadmapSection />

      {/* 7. Newsletter Section */}
      <NewsletterSection />

      {/* 8. Footer */}
      <OnepagerFooter onScrollToTop={() => handleNavigateTo('top')} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl bg-[rgba(18,12,28,0.95)] border border-[#4ee2ec] text-white text-xs sm:text-sm font-semibold tracking-wider shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(78,226,236,0.4)] backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Wallet Unavailable Modal */}
      <WalletUnavailableModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
}
