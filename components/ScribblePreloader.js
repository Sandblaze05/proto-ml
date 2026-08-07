'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function ScribblePreloader({ onComplete }) {
  const scribbleRef = useRef(null);
  const pathRef = useRef(null);
  const logoGroupRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scribble = scribbleRef.current;
    const path = pathRef.current;
    const logoGroup = logoGroupRef.current;

    if (!scribble || !path || !logoGroup) return;

    const pathLength = path.getTotalLength();
    const l = pathLength + 5;

    gsap.set(path, {
      strokeDasharray: l,
      strokeDashoffset: l,
      strokeWidth: '8%',
      opacity: 1,
    });
    gsap.set(logoGroup, {
      opacity: 1,
      scale: 0.8,
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
    });

    const tl = gsap.timeline({
      onComplete() {
        sessionStorage.setItem('proto-ml-preloader', '1');
        onComplete?.();
        window.dispatchEvent(new CustomEvent('preloader:done'));
      },
    });

    tl.to(
      path,
      { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' },
      0
    );
    tl.to(
      path,
      { strokeWidth: '50%', duration: 2.2, ease: 'power2.inOut' },
      0
    );

    tl.to(
      logoGroup,
      { scale: 1, duration: 0.8, ease: 'power2.out' },
      2.0
    );

    tl.to(logoGroup, { x: -10, y: -8, duration: 0.07, ease: 'steps(1)' }, 2.3);
    tl.to(logoGroup, { x: 10, y: 8, duration: 0.07, ease: 'steps(1)' }, 2.37);
    tl.to(logoGroup, { x: -10, y: -8, duration: 0.07, ease: 'steps(1)' }, 2.44);
    tl.to(logoGroup, { x: 10, y: 8, duration: 0.07, ease: 'steps(1)' }, 2.51);
    tl.to(logoGroup, { x: -10, y: -8, duration: 0.07, ease: 'steps(1)' }, 2.58);
    tl.to(logoGroup, { x: 0, y: 0, duration: 0.07, ease: 'steps(1)' }, 2.65);

    tl.to(
      path,
      { strokeDashoffset: -l, duration: 2.7, ease: 'power2.inOut' },
      3.1
    );
    tl.to(
      path,
      { strokeWidth: '8%', duration: 2.7, ease: 'power2.inOut' },
      3.1
    );

    tl.to(
      logoGroup,
      { opacity: 0, scale: 0.8, duration: 0.4, ease: 'power2.in' },
      3.1
    );

    tl.set(scribble, { opacity: 0 }, 5.8);

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <svg
        ref={scribbleRef}
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        viewBox="0 0 3222 3114"
        fill="none"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '140%',
          height: '140%',
          transform: 'translate(-50%, -50%)',
          color: '#44d8f1',
        }}
      >
        <path
          ref={pathRef}
          d="M299.654 453.865C505.574 319.225 711.494 184.585 836.054 109.945C960.614 35.3048 997.574 24.7448 944.014 110.385C890.454 196.025 745.254 378.185 571.454 634.385C397.654 890.585 199.654 1215.3 110.854 1382.58C22.0544 1549.86 48.4544 1549.86 77.8944 1540.62C107.334 1531.38 139.014 1512.9 367.854 1319.9C596.694 1126.9 1021.73 759.945 1255.21 555.065C1488.69 350.185 1517.73 318.505 1527.41 306.145C1537.09 293.785 1526.53 301.705 1346.85 618.625C1167.17 935.545 818.694 1561.22 635.214 1896.74C451.734 2232.26 443.814 2258.66 447.654 2268.3C451.494 2277.94 467.334 2270.02 511.134 2236.9C554.934 2203.78 626.214 2145.7 966.534 1817.46C1306.85 1489.22 1914.05 892.585 2263.81 557.505C2613.57 222.425 2687.49 166.985 2741.41 129.185C2795.33 91.3848 2827.01 72.9048 2843.33 67.3448C2859.65 61.7848 2859.65 69.7048 2849.09 96.2248C2838.53 122.745 2817.41 167.625 2584.77 544.505C2352.13 921.385 1370.37 2165.43 1139.25 2537.83C908.134 2910.23 902.854 2926.07 902.774 2939.51C902.694 2952.95 907.974 2963.51 1255.21 2613.87C1602.45 2264.23 2829.73 1017.54 2903.53 1071.46C2977.33 1125.38 2176.12 2817.04 2128 3037C2079.88 3256.96 2911.24 2018.56 3172 1793"
          stroke="currentColor"
          strokeLinecap="round"
          style={{ strokeWidth: '0%', strokeDashoffset: '0.001', strokeDasharray: '0px, 999999px' }}
        />
      </svg>

      <div
        ref={logoGroupRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <img
          src="/logo.png"
          alt="proto-ML logo"
          width={120}
          height={120}
          loading="eager"
          fetchPriority="high"
          style={{
            objectFit: 'contain',
          }}
        />
        <span
          style={{
            color: '#faebd7',
            fontSize: '2.5rem',
            fontWeight: 900,
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          proto-ML
        </span>
      </div>
    </div>
  );
}
