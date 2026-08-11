const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BPM = 76;
const BEAT_DUR = 60.0 / BPM;
const BAR_DUR = BEAT_DUR * 4;
const NUM_BARS = 16;
const TOTAL_DURATION = NUM_BARS * BAR_DUR; // ~50.5s
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * TOTAL_DURATION);

console.log(`Generating Dryhope-inspired Lo-Fi Track in Node.js...`);
console.log(`BPM: ${BPM}, Duration: ${TOTAL_DURATION.toFixed(2)}s, Samples: ${TOTAL_SAMPLES}`);

// Helper: Note name to frequency
function noteToFreq(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatMap = { 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#' };
    let name = note.slice(0, -1);
    const octave = parseInt(note.slice(-1), 10);
    if (flatMap[name]) name = flatMap[name];
    const idx = notes.indexOf(name);
    const midi = 12 * (octave + 1) + idx;
    return 440.0 * Math.pow(2.0, (midi - 69) / 12.0);
}

// Chords (Abmaj9 -> Fm9 -> Cm9 -> Gm7) inspired by Dryhope - Contrasts
const CHORDS = [
    { name: 'Abmaj9', bass: noteToFreq('Ab2'), notes: ['Ab3', 'C4', 'Eb4', 'G4', 'Bb4'].map(noteToFreq) },
    { name: 'Fm9',    bass: noteToFreq('F2'),  notes: ['F3', 'Ab3', 'C4', 'Eb4', 'G4'].map(noteToFreq) },
    { name: 'Cm9',    bass: noteToFreq('C2'),  notes: ['C3', 'Eb3', 'G3', 'Bb3', 'D4'].map(noteToFreq) },
    { name: 'Gm7',    bass: noteToFreq('G2'),  notes: ['G3', 'Bb3', 'D4', 'F4'].map(noteToFreq) }
];

// Lead melody notes
const MELODY = [
    { beat: 0.5, note: 'G5', dur: 1.5, vel: 0.75 },
    { beat: 2.0, note: 'Eb5', dur: 1.0, vel: 0.65 },
    { beat: 3.0, note: 'F5', dur: 1.0, vel: 0.80 },
    { beat: 4.5, note: 'C5', dur: 1.5, vel: 0.70 },
    { beat: 6.0, note: 'Bb4', dur: 2.0, vel: 0.60 },
    { beat: 8.5, note: 'Bb5', dur: 1.0, vel: 0.80 },
    { beat: 9.5, note: 'G5', dur: 1.5, vel: 0.75 },
    { beat: 11.0, note: 'Eb5', dur: 1.0, vel: 0.65 },
    { beat: 12.5, note: 'F5', dur: 1.5, vel: 0.75 },
    { beat: 14.0, note: 'D5', dur: 2.0, vel: 0.60 }
];

const leftBuf = new Float32Array(TOTAL_SAMPLES);
const rightBuf = new Float32Array(TOTAL_SAMPLES);

// 1. Vinyl Crackle & Ambient Low-Pass Hiss
console.log("Generating Vinyl Crackle & Ambient Texture...");
let lpfL = 0, lpfR = 0;
const alphaHiss = 0.05;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const rawL = (Math.random() * 2 - 1) * 0.012;
    const rawR = (Math.random() * 2 - 1) * 0.012;
    lpfL += alphaHiss * (rawL - lpfL);
    lpfR += alphaHiss * (rawR - lpfR);

    let crackle = 0;
    if (Math.random() < 0.00018) {
        crackle = (Math.random() * 2 - 1) * (0.05 + Math.random() * 0.12);
    }
    leftBuf[i] += lpfL + crackle;
    rightBuf[i] += lpfR + crackle;
}

// 2. Synthesize Rhodes Chords
console.log("Synthesizing Warm Rhodes Chords...");
function synthRhodesNote(freq, durSec, vel) {
    const numS = Math.floor(durSec * SAMPLE_RATE);
    const bL = new Float32Array(numS);
    const bR = new Float32Array(numS);
    let lpL = 0, lpR = 0;
    const alpha = 0.12;

    for (let i = 0; i < numS; i++) {
        const t = i / SAMPLE_RATE;
        const env = t < 0.015 ? (t / 0.015) : Math.exp(-(t - 0.015) * 1.8);
        const vEnv = env * vel;

        // Tape wobble vibrato
        const freqMod = freq * (1.0 + 0.0025 * Math.sin(2 * Math.PI * 1.2 * t));
        const phaseL = 2 * Math.PI * freqMod * t;
        const phaseR = phaseL + 0.15;

        const sigL = Math.sin(phaseL) * 0.6 + Math.sin(phaseL * 2) * 0.25 + Math.sin(phaseL * 3) * 0.1 + Math.sin(phaseL * 4.02) * 0.05;
        const sigR = Math.sin(phaseR) * 0.6 + Math.sin(phaseR * 2) * 0.25 + Math.sin(phaseR * 3) * 0.1 + Math.sin(phaseR * 4.02) * 0.05;

        lpL += alpha * (sigL * vEnv - lpL);
        lpR += alpha * (sigR * vEnv - lpR);

        bL[i] = lpL * 0.18;
        bR[i] = lpR * 0.18;
    }
    return { bL, bR };
}

for (let bar = 0; bar < NUM_BARS; bar++) {
    const chord = CHORDS[bar % 4];
    const barStart = Math.floor(bar * BAR_DUR * SAMPLE_RATE);
    const hits = [
        { beat: 0.0, dur: 3.2, vel: 0.8 },
        { beat: 2.5, dur: 1.8, vel: 0.65 }
    ];

    for (const h of hits) {
        const hitStart = barStart + Math.floor(h.beat * BEAT_DUR * SAMPLE_RATE);
        const durSec = h.dur * BEAT_DUR;

        chord.notes.forEach((freq, idx) => {
            const strumDelay = Math.floor(idx * 0.012 * SAMPLE_RATE);
            const startIdx = hitStart + strumDelay;
            const { bL, bR } = synthRhodesNote(freq, durSec, h.vel);

            for (let i = 0; i < bL.length; i++) {
                const target = startIdx + i;
                if (target < TOTAL_SAMPLES) {
                    leftBuf[target] += bL[i];
                    rightBuf[target] += bR[i];
                }
            }
        });
    }
}

// 3. Sub-Bass
console.log("Synthesizing Sub-Bass...");
for (let bar = 0; bar < NUM_BARS; bar++) {
    const chord = CHORDS[bar % 4];
    const bassFreq = chord.bass;
    const barStart = Math.floor(bar * BAR_DUR * SAMPLE_RATE);
    const hits = [
        { beat: 0.0, dur: 2.3, vel: 0.85 },
        { beat: 2.5, dur: 1.4, vel: 0.70 }
    ];

    for (const h of hits) {
        const startIdx = barStart + Math.floor(h.beat * BEAT_DUR * SAMPLE_RATE);
        const numS = Math.floor(h.dur * BEAT_DUR * SAMPLE_RATE);
        let lpBass = 0;

        for (let i = 0; i < numS; i++) {
            const t = i / SAMPLE_RATE;
            const env = t < 0.02 ? (t / 0.02) : Math.exp(-(t - 0.02) * 1.5);
            const phase = 2 * Math.PI * bassFreq * t;
            const raw = Math.sin(phase) + 0.3 * Math.sin(phase * 2);
            const sat = Math.tanh(raw * 1.2);
            lpBass += 0.08 * (sat * env * h.vel - lpBass);

            const target = startIdx + i;
            if (target < TOTAL_SAMPLES) {
                leftBuf[target] += lpBass * 0.25;
                rightBuf[target] += lpBass * 0.25;
            }
        }
    }
}

// 4. Drums (Kick, Snare/Rim, Hi-Hats)
console.log("Synthesizing Drums...");
function synthKick() {
    const numS = Math.floor(0.35 * SAMPLE_RATE);
    const buf = new Float32Array(numS);
    let phase = 0;
    for (let i = 0; i < numS; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 12.0);
        const freq = 45.0 + 95.0 * Math.exp(-t * 40.0);
        phase += 2 * Math.PI * freq * (1.0 / SAMPLE_RATE);
        buf[i] = Math.tanh(Math.sin(phase) * 1.8) * env * 0.38;
    }
    return buf;
}

function synthSnare() {
    const numS = Math.floor(0.25 * SAMPLE_RATE);
    const bL = new Float32Array(numS);
    const bR = new Float32Array(numS);
    let lpf = 0;
    for (let i = 0; i < numS; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 22.0);
        const body = Math.sin(2 * Math.PI * 175.0 * t) * Math.exp(-t * 35.0);
        const noise = Math.random() * 2 - 1;
        lpf += 0.2 * (noise - lpf);
        const sig = (body * 0.4 + lpf * 0.6) * env;
        bL[i] = sig * 0.24;
        bR[i] = sig * 0.22;
    }
    return { bL, bR };
}

function synthHat(isOpen) {
    const durSec = isOpen ? 0.12 : 0.05;
    const numS = Math.floor(durSec * SAMPLE_RATE);
    const bL = new Float32Array(numS);
    const bR = new Float32Array(numS);
    let hpfPrev = 0;
    const decay = isOpen ? 25.0 : 65.0;

    for (let i = 0; i < numS; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * decay);
        const noise = Math.random() * 2 - 1;
        const hpf = noise - hpfPrev;
        hpfPrev = noise * 0.6;
        const sig = hpf * env;
        bL[i] = sig * 0.07;
        bR[i] = sig * 0.10;
    }
    return { bL, bR };
}

const kickBuf = synthKick();
const snareBuf = synthSnare();
const hatClosed = synthHat(false);
const hatOpen = synthHat(true);

for (let bar = 2; bar < NUM_BARS; bar++) {
    const barStart = Math.floor(bar * BAR_DUR * SAMPLE_RATE);
    const kicks = [0.0, 2.25];
    const snares = [1.0, 3.0];

    for (const kb of kicks) {
        const startIdx = barStart + Math.floor(kb * BEAT_DUR * SAMPLE_RATE);
        for (let i = 0; i < kickBuf.length; i++) {
            const idx = startIdx + i;
            if (idx < TOTAL_SAMPLES) {
                leftBuf[idx] += kickBuf[i];
                rightBuf[idx] += kickBuf[i];
            }
        }
    }

    for (const sb of snares) {
        const delay = (0.005 + Math.random() * 0.007);
        const startIdx = barStart + Math.floor((sb * BEAT_DUR + delay) * SAMPLE_RATE);
        for (let i = 0; i < snareBuf.bL.length; i++) {
            const idx = startIdx + i;
            if (idx < TOTAL_SAMPLES) {
                leftBuf[idx] += snareBuf.bL[i];
                rightBuf[idx] += snareBuf.bR[i];
            }
        }
    }

    for (let step = 0; step < 8; step++) {
        let b = step * 0.5;
        if (step % 2 === 1) b += 0.04; // Swing
        const isOpen = (step === 7);
        const hat = isOpen ? hatOpen : hatClosed;
        const delay = Math.random() * 0.005;
        const startIdx = barStart + Math.floor((b * BEAT_DUR + delay) * SAMPLE_RATE);

        for (let i = 0; i < hat.bL.length; i++) {
            const idx = startIdx + i;
            if (idx < TOTAL_SAMPLES) {
                leftBuf[idx] += hat.bL[i];
                rightBuf[idx] += hat.bR[i];
            }
        }
    }
}

// 5. Synthesize Pluck Lead Melody
console.log("Synthesizing Pluck Lead...");
function synthPluckNote(freq, durSec, vel) {
    const numS = Math.floor(durSec * SAMPLE_RATE);
    const bL = new Float32Array(numS);
    const bR = new Float32Array(numS);
    let lpf = 0;
    for (let i = 0; i < numS; i++) {
        const t = i / SAMPLE_RATE;
        const env = Math.exp(-t * 4.5) * vel;
        const phase = 2 * Math.PI * freq * t;
        const sig = Math.sin(phase) + 0.4 * Math.sin(phase * 2) + 0.15 * Math.sin(phase * 3);
        lpf += 0.15 * (sig * env - lpf);
        bL[i] = lpf * 0.14;
        bR[i] = lpf * 0.09;
    }
    return { bL, bR };
}

const delaySamples = Math.floor(BEAT_DUR * 0.75 * SAMPLE_RATE);
const delayFeedback = 0.35;

for (let bar = 4; bar < 12; bar++) {
    const barStart = Math.floor(bar * BAR_DUR * SAMPLE_RATE);
    for (const m of MELODY) {
        const noteFreq = noteToFreq(m.note);
        const startIdx = barStart + Math.floor(m.beat * BEAT_DUR * SAMPLE_RATE);
        const durSec = m.dur * BEAT_DUR;
        const { bL, bR } = synthPluckNote(noteFreq, durSec, m.vel);

        for (let i = 0; i < bL.length; i++) {
            const idx = startIdx + i;
            if (idx < TOTAL_SAMPLES) {
                leftBuf[idx] += bL[i];
                rightBuf[idx] += bR[i];

                const echoIdx = idx + delaySamples;
                if (echoIdx < TOTAL_SAMPLES) {
                    leftBuf[echoIdx] += bL[i] * delayFeedback;
                    rightBuf[echoIdx] += bR[i] * delayFeedback * 0.8;
                }
            }
        }
    }
}

// 6. Master Processing & Limiter
console.log("Applying Master Limiter & Normalization...");
const fadeOutSamples = Math.floor(2.5 * SAMPLE_RATE);
const fadeStart = TOTAL_SAMPLES - fadeOutSamples;
let maxVal = 0;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
    if (i >= fadeStart) {
        const fade = (TOTAL_SAMPLES - i) / fadeOutSamples;
        leftBuf[i] *= fade;
        rightBuf[i] *= fade;
    }

    leftBuf[i] = Math.tanh(leftBuf[i] * 1.1);
    rightBuf[i] = Math.tanh(rightBuf[i] * 1.1);

    if (Math.abs(leftBuf[i]) > maxVal) maxVal = Math.abs(leftBuf[i]);
    if (Math.abs(rightBuf[i]) > maxVal) maxVal = Math.abs(rightBuf[i]);
}

const normFactor = maxVal > 0 ? (0.89 / maxVal) : 1.0;

// 7. Write to WAV File
const outDir = path.join(__dirname, '..', 'public', 'media');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'contrasts_dryhope_inspired.wav');

console.log(`Writing WAV buffer to ${outPath}...`);
const bufferSize = 44 + TOTAL_SAMPLES * 4;
const wavBuffer = Buffer.alloc(bufferSize);

// WAV Header
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(bufferSize - 8, 4);
wavBuffer.write('WAVE', 8);
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16);        // Subchunk1Size (16 for PCM)
wavBuffer.writeUInt16LE(1, 20);         // AudioFormat (1 = PCM)
wavBuffer.writeUInt16LE(2, 22);         // NumChannels (2 = Stereo)
wavBuffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
wavBuffer.writeUInt32LE(SAMPLE_RATE * 4, 28); // ByteRate
wavBuffer.writeUInt16LE(4, 32);         // BlockAlign
wavBuffer.writeUInt16LE(16, 34);        // BitsPerSample (16-bit)
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(TOTAL_SAMPLES * 4, 40);

let offset = 44;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
    let sL = Math.floor(leftBuf[i] * normFactor * 32767.0);
    let sR = Math.floor(rightBuf[i] * normFactor * 32767.0);

    sL = Math.max(-32768, Math.min(32767, sL));
    sR = Math.max(-32768, Math.min(32767, sR));

    wavBuffer.writeInt16LE(sL, offset);
    wavBuffer.writeInt16LE(sR, offset + 2);
    offset += 4;
}

fs.writeFileSync(outPath, wavBuffer);
console.log(`SUCCESS: WAV audio file generated at: ${outPath} (${(fs.statSync(outPath).size / (1024*1024)).toFixed(2)} MB)`);
