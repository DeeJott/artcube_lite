"use client";

import { PiX } from "react-icons/pi";

type WalletUnavailableModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function WalletUnavailableModal({ open, onClose }: WalletUnavailableModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Wallets currently unavailable"
    >
      <div
        className="relative max-w-2xl w-full p-6 sm:p-8 md:p-12 animate-in zoom-in-95 duration-300"
        style={{
          backgroundColor: "var(--background)",
          borderColor: "var(--accent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 hover:rotate-90 transition-transform duration-300 cursor-pointer"
          style={{ color: "var(--accent)" }}
          aria-label="Close"
        >
          <PiX className="w-6 h-6 hover:rotate-12 hover:scale-110 transition-transform duration-300" />
        </button>

        <h3
          className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight mb-4 sm:mb-6"
          style={{ color: "var(--foreground)" }}
        >
          Wallets are <span style={{ color: "var(--accent)" }}>not available</span>
        </h3>

        <div
          className="space-y-4 sm:space-y-6 font-light text-xs sm:text-sm md:text-xl leading-relaxed"
          style={{ color: "var(--foreground-secondary)" }}
        >
          <p>
            Wallet connections are currently disabled.
          </p>
          <p>
            We're working on enabling wallet registration soon so you can securely claim and manage your digital collectibles.
          </p>
        </div>
      </div>
    </div>
  );
}
