"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RadialOrbitalTimeline({ timelineData }) {
    // Keep styling deterministic (important for SSR hydration) and consistent with the site theme.
    const BG = "#171717";
    const FG = "#faebd7";

    // Next.js may pre-render Client Components on the server.
    // We render orbit nodes only after mount to avoid SSR/client float transform mismatches.
    const [isMounted, setIsMounted] = useState(false);

    const [expandedItems, setExpandedItems] = useState({});
    const [viewMode, setViewMode] = useState("orbital");
    const [rotationAngle, setRotationAngle] = useState(0);
    const [autoRotate, setAutoRotate] = useState(true);
    const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);
    const orbitRef = useRef(null);
    const nodeRefs = useRef({});
    const orbitCircleRef = useRef(null);
    const [orbitRadius, setOrbitRadius] = useState(192); // Matches the default circle (w-96 => radius 192px)

    const handleContainerClick = (e) => {
        if (e.target === containerRef.current || e.target === orbitRef.current) {
            setExpandedItems({});
            setAutoRotate(true);
        }
    };

    const toggleItem = (id) => {
        setExpandedItems((prev) => {
            const newState = { ...prev };
            Object.keys(newState).forEach((key) => {
                if (parseInt(key) !== id) {
                    newState[parseInt(key)] = false;
                }
            });

            newState[id] = !prev[id];

            if (!prev[id]) {
                setAutoRotate(false);

                centerViewOnNode(id);
            } else {
                setAutoRotate(true);
            }

            return newState;
        });
    };

    useEffect(() => {
        // Defer so eslint doesn't flag "setState synchronously within an effect".
        const t = window.setTimeout(() => setIsMounted(true), 0);
        return () => window.clearTimeout(t);
    }, []);

    useEffect(() => {
        let rotationTimer;

        if (autoRotate && viewMode === "orbital") {
            rotationTimer = setInterval(() => {
                setRotationAngle((prev) => {
                    const newAngle = (prev + 0.3) % 360;
                    return Number(newAngle.toFixed(3));
                });
            }, 50);
        }

        return () => {
            if (rotationTimer) {
                clearInterval(rotationTimer);
            }
        };
    }, [autoRotate, viewMode]);

    // Measure the orbit circle so nodes land exactly on the circumference.
    useEffect(() => {
        const measure = () => {
            const el = orbitCircleRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const nextRadius = rect.width / 2;
            if (!Number.isFinite(nextRadius) || nextRadius <= 0) return;
            setOrbitRadius(nextRadius);
        };

        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    const centerViewOnNode = (nodeId) => {
        if (viewMode !== "orbital" || !nodeRefs.current[nodeId]) return;

        const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
        const totalNodes = timelineData.length;
        const targetAngle = (nodeIndex / totalNodes) * 360;

        setRotationAngle(270 - targetAngle);
    };

    const calculateNodePosition = (index, total) => {
        const angle = ((index / total) * 360 + rotationAngle) % 360;
        // Place node centers exactly on the orbit circumference.
        // We anchor via left/top=50% + translate(-50%, -50%) + translate(x,y).
        const radius = orbitRadius;
        const radian = (angle * Math.PI) / 180;

        const x = radius * Math.cos(radian) + centerOffset.x;
        const y = radius * Math.sin(radian) + centerOffset.y;

        // Cap z-index so the timeline never paints above the fixed navbar (`z-50`).
        const zIndex = Math.round(10 + 20 * Math.cos(radian));
        // Keep orbit nodes visually solid (no fade-to-transparent effect).
        const opacity = 1;

        return { x, y, angle, zIndex, opacity };
    };

    return (
        <div
            className="w-full h-[520px] md:h-[580px] flex flex-col items-center justify-center overflow-visible"
            ref={containerRef}
            onClick={handleContainerClick}
        >
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                <div
                    className="absolute w-full h-full flex items-center justify-center"
                    ref={orbitRef}
                    style={{
                        perspective: "1000px",
                        transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
                    }}
                >
                    <div className="absolute flex items-center justify-center z-10">
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="w-50 h-50 object-contain"
                        />
                    </div>

                    <div
                        ref={orbitCircleRef}
                        className="absolute w-96 h-96 rounded-full border border-white/10"
                    ></div>

                    {isMounted &&
                        timelineData.map((item, index) => {
                            const position = calculateNodePosition(index, timelineData.length);
                            const isExpanded = expandedItems[item.id];
                            const Icon = item.icon;

                            const nodeStyle = {
                                left: "50%",
                                top: "50%",
                                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                                zIndex: isExpanded ? 40 : position.zIndex,
                                opacity: isExpanded ? 1 : position.opacity,
                            };

                            return (
                                <div
                                    key={item.id}
                                    ref={(el) => (nodeRefs.current[item.id] = el)}
                                    className="absolute transition-all duration-700 cursor-pointer"
                                    style={nodeStyle}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItem(item.id);
                                    }}
                                >
                                    <div
                                        className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${isExpanded ? "bg-[#faebd7] text-[#171717]" : "bg-[#171717] text-[#faebd7]"}
                  border-2
                  ${isExpanded ? "border-[#faebd7]" : "border-[#faebd7]/30"}
                  transition-all duration-300 transform
                  ${isExpanded ? "scale-150" : ""}
                `}
                                    >
                                        <Icon size={16} />
                                    </div>

                                    <div
                                        className={`
                  absolute top-12 whitespace-nowrap
                  text-xs font-semibold tracking-wider
                  transition-all duration-300
                  ${isExpanded ? "text-[#faebd7] scale-125" : "text-[#faebd7]/70"}
                `}
                                    >
                                        {item.title}
                                    </div>

                                    {isExpanded && (
                                        <Card className="absolute top-20 left-1/2 -translate-x-1/2 w-64 border-[#faebd7]/20 overflow-visible bg-[#171717]">
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-white/50"></div>
                                            <CardHeader className="pb-2" style={{ color: FG }}>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-mono text-[#faebd7]/60">
                                                        {item.date}
                                                    </span>
                                                </div>
                                                <CardTitle className="text-sm mt-2" style={{ color: FG }}>
                                                    {item.title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-xs text-[#faebd7]/80">
                                                <p>{item.content}</p>

                                                {item.relatedIds.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-white/10">
                                                        <div className="flex items-center mb-2">
                                                            <Link size={10} className="text-[#faebd7]/70 mr-1" />
                                                            <h4 className="text-xs uppercase tracking-wider font-medium text-[#faebd7]/70">
                                                                Connected Nodes
                                                            </h4>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.relatedIds.map((relatedId) => {
                                                                const relatedItem = timelineData.find(
                                                                    (i) => i.id === relatedId
                                                                );
                                                                return (
                                                                    <Button
                                                                        key={relatedId}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="flex items-center h-6 px-2 py-0 text-xs rounded-none border-[#faebd7]/20 bg-transparent hover:bg-[#faebd7]/10 text-[#faebd7]/80 hover:text-[#faebd7] transition-all"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleItem(relatedId);
                                                                        }}
                                                                    >
                                                                        {relatedItem?.title}
                                                                        <ArrowRight
                                                                            size={8}
                                                                            className="ml-1 text-white/60"
                                                                        />
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}