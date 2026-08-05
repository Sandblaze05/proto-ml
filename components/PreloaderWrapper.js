'use client';

import Preloader from './Preloader';

export default function PreloaderWrapper({ onComplete }) {
  return <Preloader onComplete={onComplete} />;
}
