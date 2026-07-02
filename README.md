# art.cube - Interactive Space Visualization

A Next.js 15 + TypeScript + Tailwind CSS clone of art.cube lite - an interactive 3-scene space visualization with multiplayer support, audio-reactive visuals, and NFT minting.

## Features

- **3 Timed Scenes**:
  - 0-30s: Shooting stars with beat-reactive comets
  - 30-60s: Nebula drawing with gas particles
  - 60-75s: Recording phase + NFT minting

- **Multiplayer** (PeerJS): Host/guest collaboration with collision detection
- **Audio Visualization**: Web Audio API with beat detection
- **Three.js Shader Background**: Animated noise flare effect
- **Video Recording**: MediaRecorder with Cloudinary upload
- **NFT Integration**: Automatic minting link generation

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Three.js + @react-three/fiber
- PeerJS (WebRTC)
- Cloudinary (video storage)

## Getting Started

### 1. Install dependencies

```bash
cd next-app
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```bash
# Required for Cloudinary video upload
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=artcube

# Optional: NFT minting endpoint
NEXT_PUBLIC_NFT_MINT_URL=https://art-box-beta.vercel.app/mint
```

### 3. Add audio file

Place `Contrasts-Dryhope.mp3` in `public/media/` (or update the audio URL in hooks).

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Usage

1. **Host**: Open the app, enter your name, click "BEITRETEN", then share the generated link
2. **Guest**: Open the shared link, enter your name, click "BEITRETEN", wait for host to start
3. **Experience**: Click/touch to create shooting stars (1-60s), hold and drag to draw nebula (30-60s)
4. **NFT**: At 75s, your recording uploads and a minting link appears

## Project Structure

```
app/
├── components/          # UI components (StartScreen, FinalUI, etc.)
├── hooks/              # React hooks (useCanvasRenderer, usePeerJS, etc.)
├── lib/
│   ├── canvas/         # Particle classes & collision detection
│   ├── three/          # Three.js flare shader
│   ├── constants.ts    # Timing, colors, sizes
│   └── types.ts        # TypeScript interfaces
├── api/
│   └── cloudinary-sign/ # Signed upload endpoint
└── page.tsx            # Main application
```

## License

MIT - Based on art.cube lite original HTML/JS implementation.
