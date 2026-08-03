"use client";

import React from "react";
import { LazyMotion, domAnimation, m } from "motion/react";

const BG = "#171717";
const FG = "#faebd7";

const Card = ({
  number,
  title,
  description,
  accentColor,
  className,
  rotate,
}) => {
  const cardBg = `${accentColor}10`;
  const cardBorder = `${accentColor}25`;
  const cardAccent = accentColor;

  return (
    <div
      className={`relative w-full md:w-[280px] transition-transform duration-300 hover:scale-105 ${rotate} ${className}`}
      style={{ zIndex: 10 }}
    >
      <div
        style={{
          backgroundColor: `${BG}cc`,
          borderColor: `${FG}15`,
          boxShadow: `0px 10px 30px 0px rgba(0,0,0,0.4)`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        className="p-2 rounded-[25px] border"
      >
        <div
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            zIndex: 1,
          }}
          className="border rounded-[15px] p-[15px] h-full flex flex-col relative overflow-hidden"
        >
          <span
            className="text-4xl mb-5"
            style={{
              color: cardAccent,
              fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
            }}
          >
            {number}
          </span>
          <h3
            style={{ color: FG }}
            className="text-2xl font-semibold leading-none mb-[10px] font-headline"
          >
            {title}
          </h3>
          <p
            style={{ color: `${FG}70` }}
            className="text-sm/5 tracking-tight"
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_CARD_POSITIONS = [
  { className: "md:absolute md:top-0 md:left-[15%]", rotate: "rotate-8" },
  {
    className: "md:absolute md:top-[120px] md:right-[15%]",
    rotate: "-rotate-8",
  },
  { className: "md:absolute md:top-[450px] md:left-[15%]", rotate: "rotate-8" },
  {
    className: "md:absolute md:top-[570px] md:right-[10%]",
    rotate: "-rotate-8",
  },
  { className: "md:absolute md:top-[850px] md:left-[15%]", rotate: "rotate-8" },
];

const DEFAULT_STEPS = [
  {
    title: "Connect Data Sources",
    description:
      "Plug in CSV, JSON, SQL databases, or image folders. Our engine auto-detects schemas and prepares tensor flow.",
    accentColor: "#f97316",
  },
  {
    title: "Compose Nodes",
    description:
      "Drag dataset, transform, and lifecycle nodes onto the infinite canvas. Connect edges to define your graph.",
    accentColor: "#3b82f6",
  },
  {
    title: "Compile & Validate",
    description:
      "The spatial compiler type-checks every edge, validates shapes, and generates production-ready Python code.",
    accentColor: "#a855f7",
  },
  {
    title: "Run Experiments",
    description:
      "Execute your pipeline with a single click. Preview outputs, inspect tensors, and iterate in real-time.",
    accentColor: "#f97316",
  },
  {
    title: "Export & Deploy",
    description:
      "Export to PyTorch, TensorFlow, or JAX. Or push directly to our serverless inference edge for production.",
    accentColor: "#3b82f6",
  },
];

export default function HowItWorks({
  features,
  className,
  stepPositions,
}) {
  const data = features && features.length > 0 ? features : DEFAULT_STEPS;
  const positions = stepPositions || DEFAULT_CARD_POSITIONS;

  let height = 1130;
  if (data.length === 1) height = 400;
  else if (data.length === 2) height = 450;
  else if (data.length === 3) height = 800;
  else if (data.length === 4) height = 900;
  else height = 1130;

  const styleVars = { "--md-height": `${height}px` };

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={`max-md:pt-10 max-md:pb-25 md:py-20 px-8 relative ${className}`}
        style={{ backgroundColor: BG }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${FG}08 1px, transparent 1px)`,
            backgroundSize: "100% 32px",
            marginTop: "4px",
            opacity: 0.08,
          }}
        ></div>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
          style={{
            background: `linear-gradient(to right, ${BG}, transparent)`,
          }}
        ></div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          style={{
            background: `linear-gradient(to left, ${BG}, transparent)`,
          }}
        ></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div
            className="relative w-full max-w-[1000px] mx-auto flex flex-col space-y-8 md:space-y-0 md:block h-auto"
            style={{ height: `${height}px` }}
          >
            <div
              className="relative w-full h-full"
              style={styleVars}
            >
              {data.length > 1 && (
                <svg
                  className="absolute top-0 left-0 w-full h-full pointer-events-none hidden md:block"
                  viewBox={`0 0 1000 ${height}`}
                  preserveAspectRatio="none"
                  style={{ height: `${height}px`, zIndex: 0 }}
                >
                  {(() => {
                    const pathD = data.reduce((acc, _, index) => {
                      if (index >= data.length - 1) return acc;
                      if (index === 0)
                        return "M 290 150 C 500 150, 550 270, 710 270";
                      if (index === 1)
                        return acc + " C 850 270, 500 350, 290 450";
                      if (index === 2)
                        return acc + " C 290 600, 550 720, 750 720";
                      if (index === 3)
                        return acc + " C 950 720, 500 800, 290 850";
                      return acc;
                    }, "");
                    return (
                      <m.path
                        d={pathD}
                        stroke={FG}
                        strokeOpacity="0.35"
                        strokeWidth="2"
                        strokeDasharray="8 6"
                        fill="none"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        initial={{ strokeDashoffset: 0 }}
                        animate={{
                          strokeDashoffset: -140,
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    );
                  })()}
                </svg>
              )}

              {data.map((step, index) => {
                const position = positions[index % positions.length];

                return (
                  <Card
                    key={step.title}
                    number={`0${index + 1}`}
                    title={step.title}
                    description={step.description}
                    accentColor={step.accentColor || "#3b82f6"}
                    rotate={position.rotate}
                    className={position.className}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
