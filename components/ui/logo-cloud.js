import React from "react";
import { cn } from "@/lib/utils";

const LOGOS = [
  {
    src: "https://svgl.app/library/nvidia-wordmark-light.svg",
    alt: "Nvidia Logo",
  },
  {
    src: "https://svgl.app/library/supabase_wordmark_light.svg",
    alt: "Supabase Logo",
  },
  {
    src: "https://svgl.app/library/github_wordmark_light.svg",
    alt: "GitHub Logo",
  },
  {
    src: "https://svgl.app/library/openai_wordmark_light.svg",
    alt: "OpenAI Logo",
  },
  {
    src: "https://svgl.app/library/turso-wordmark-light.svg",
    alt: "Turso Logo",
  },
  {
    src: "https://svgl.app/library/clerk-wordmark-light.svg",
    alt: "Clerk Logo",
  },
  {
    src: "https://svgl.app/library/claude-ai-wordmark-icon_light.svg",
    alt: "Claude AI Logo",
  },
  {
    src: "https://svgl.app/library/vercel_wordmark.svg",
    alt: "Vercel Logo",
  },
];

export function LogoCloud({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border-y border-white/10 py-10",
        className
      )}
      {...props}
    >
      <div className="flex animate-marquee gap-12 items-center">
        {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, index) => (
          <div
            key={`${logo.alt}-${index}`}
            className="flex shrink-0 items-center justify-center px-4"
          >
            <img
              alt={logo.alt}
              className="pointer-events-none h-5 select-none brightness-0 invert opacity-40 hover:opacity-100 transition-opacity duration-300"
              src={logo.src}
            />
          </div>
        ))}
      </div>
      
      {/* Gradients for fading edges */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#171717] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#171717] to-transparent z-10" />
    </div>
  );
}
