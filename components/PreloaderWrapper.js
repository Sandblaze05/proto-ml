'use client';

import ScribblePreloader from './ScribblePreloader';

export default function PreloaderWrapper({ onComplete }) {
  return <ScribblePreloader onComplete={onComplete} />;
}
