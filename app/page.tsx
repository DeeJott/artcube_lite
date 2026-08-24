'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [srcUrl, setSrcUrl] = useState('sakura-v3.html?v=3.3');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const search = window.location.search;
      const isGitHubPages = path.includes('/artcube_lite');
      const base = isGitHubPages ? '/artcube_lite' : '';
      const versionParam = search ? `${search}&v=3.3` : '?v=3.3';
      setSrcUrl(`${base}/sakura-v3.html${versionParam}`);
    }
  }, []);

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#08000c]">
      <iframe
        src={srcUrl}
        className="w-full h-full border-none block z-50"
        allow="fullscreen; autoplay; clipboard-write; microphone"
        title="Sakura Reborn Experience"
      />
    </main>
  );
}
