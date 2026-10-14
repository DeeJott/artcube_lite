'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [srcUrl, setSrcUrl] = useState('sakura-v3.html?v=4.0');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const search = window.location.search;
      let base = '';
      if (path.includes('/artcube_lite')) base = '/artcube_lite';
      else if (path.includes('/art-cube-demo')) base = '/art-cube-demo';
      const versionParam = search ? `${search}&v=4.0` : '?v=4.0';
      setSrcUrl(`${base}/sakura-v3.html${versionParam}`);
    }
  }, []);

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#08000c]">
      <iframe
        src={srcUrl}
        className="w-full h-full border-none block z-50"
        allow="fullscreen; autoplay; clipboard-write; microphone"
        title="Sakuraverse Experience"
      />
    </main>
  );
}
