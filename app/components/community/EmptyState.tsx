

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.6 }}
      className="group relative text-center py-16 border border-dashed border-white/15 rounded-3xl bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      {/* soft top sheen (purely visual) */}
      <div aria-hidden className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 h-16 w-[120%] bg-gradient-to-b from-white/10 to-transparent blur-2xl" />

      <p className="text-lg font-medium">Noch keine Beiträge</p>
      <p className="opacity-70 mt-1">Sei der/die Erste und teile deine Erfahrung zu einer Website.</p>

      <button
        onClick={onOpen}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 transition-all duration-200 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.45)] active:scale-[0.98]"
      >
        <span>＋</span> Neuen Beitrag erstellen
      </button>
    </motion.div>
  );
}