'use client';

import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [srcUrl, setSrcUrl] = useState('sakura-v3.html?v=4.1');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const search = window.location.search;
      let base = '';
      if (path.includes('/artcube_lite')) base = '/artcube_lite';
      else if (path.includes('/art-cube-demo')) base = '/art-cube-demo';
      const versionParam = search ? `${search}&v=4.1` : '?v=4.1';
      setSrcUrl(`${base}/sakura-v3.html${versionParam}`);

      // Forward Smartphone PopState Back Gestures to inner Experience
      const onPopState = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PARENT_POPSTATE' }, '*');
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#08000c]">
      <iframe
        ref={iframeRef}
        src={srcUrl}
        className="w-full h-full border-none block z-50"
        allow="fullscreen; autoplay; clipboard-write; microphone; screen-wake-lock; orientation-lock"
        allowFullScreen
        title="Sakuraverse Experience"
      />
    </main>
  );
}
