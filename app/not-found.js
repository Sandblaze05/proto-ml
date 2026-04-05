"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { WarningGraphic } from "@/components/ui/warning-graphic";

export default function NotFound() {
  const BG = "#171717";
  const FG = "#faebd7";

  return (
    <div
      style={{ backgroundColor: BG, color: FG }}
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center font-body overflow-hidden"
    >
      <div className="relative mb-12">
        {/* Background glow for the graphic */}
        <div 
          className="absolute inset-0 blur-[100px] opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${FG} 0%, transparent 70%)` }}
        />
        
        <WarningGraphic 
          width={400} 
          height={130} 
          color={FG}
          className="relative z-10"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8, duration: 0.8 }}
        className="max-w-xl"
      >
        <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter mb-4 leading-none">
          404
        </h1>
        <h2 className="text-xl md:text-2xl font-medium mb-8 opacity-60 uppercase tracking-[0.2em]">
          Pipeline Interrupted
        </h2>
        <p className="text-lg mb-12 opacity-40 leading-relaxed">
          The node you're looking for doesn't exist in our current architecture. 
          The path might have been recompiled or deleted.
        </p>
        
        <Link
          href="/"
          style={{ backgroundColor: FG, color: BG }}
          className="inline-block px-10 py-4 font-bold rounded-full hover:-translate-y-1 transition-all duration-300 shadow-xl"
        >
          Return to Canvas
        </Link>
      </motion.div>

      {/* Decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-5">
        <div className="absolute top-1/4 left-1/4 w-px h-screen bg-white rotate-45" />
        <div className="absolute top-1/4 right-1/4 w-px h-screen bg-white -rotate-45" />
        <div className="absolute bottom-1/4 left-1/2 w-screen h-px bg-white" />
      </div>
    </div>
  );
}
