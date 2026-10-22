"use client";

import { motion } from "motion/react";

export function FalImagePlaceholder({
  label,
  description,
  width = 400,
  height = 300,
}: {
  label: string;
  description: string;
  width?: number;
  height?: number;
}) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#f2f2f3] to-[#fafafb] shadow-[0_0_0_1px_rgba(4,23,43,0.05),_0_20px_25px_-5px_rgba(0,0,0,0.05)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(4,23,43,0.08),_0_25px_35px_-5px_rgba(0,0,0,0.12)]"
      style={{ width, height }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-[#fbe1d1] flex items-center justify-center text-[#5d2a1a] text-xs font-bold shadow-md shadow-[#fbe1d1]/30">
          fal
        </div>
        <div>
          <p className="text-sm font-semibold text-[#17191c]">{label}</p>
          <p className="mt-1 text-xs text-[#777b86]">{description}</p>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 rounded-full bg-[#17191c] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xl">
        fal-ai/flux/schnell
      </div>
    </motion.div>
  );
}
