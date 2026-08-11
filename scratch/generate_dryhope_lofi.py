import math
import random
import struct
import wave
import os

# Output settings
SAMPLE_RATE = 44100
BPM = 76
BEAT_DUR = 60.0 / BPM
BAR_DUR = BEAT_DUR * 4
NUM_BARS = 16
TOTAL_DURATION = NUM_BARS * BAR_DUR # ~50.5 seconds
TOTAL_SAMPLES = int(SAMPLE_RATE * TOTAL_DURATION)

print(f"Generating Lo-Fi Track inspired by Dryhope - Contrasts...")
print(f"BPM: {BPM}, Bars: {NUM_BARS}, Duration: {TOTAL_DURATION:.2f} seconds ({TOTAL_SAMPLES} samples)")

# Helper functions for frequency calculation
def note_to_freq(note_name):
    # E.g., 'C4', 'Ab3', 'Eb4'
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    flat_map = {'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#', 'Bb':'A#'}
    name = note_name[:-1]
    octave = int(note_name[-1])
    if name in flat_map:
        name = flat_map[name]
    idx = notes.index(name)
    midi = 12 * (octave + 1) + idx
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))

# Precompute chord frequencies (Lo-Fi Jazz progression: Abmaj9, Fm9, Cm9, Gm7)
# Abmaj9: Ab3, C4, Eb4, G4, Bb4
# Fm9: F3, Ab3, C4, Eb4, G4
# Cm9: C3, Eb3, G3, Bb3, D4
# Gm7: G3, Bb3, D4, F4
CHORD_PROGRESSION = [
    # Bar 1 & 5 & 9 & 13
    {'name': 'Abmaj9', 'bass': note_to_freq('Ab2'), 'notes': [note_to_freq(n) for n in ['Ab3', 'C4', 'Eb4', 'G4', 'Bb4']]},
    # Bar 2 & 6 & 10 & 14
    {'name': 'Fm9',    'bass': note_to_freq('F2'),  'notes': [note_to_freq(n) for n in ['F3', 'Ab3', 'C4', 'Eb4', 'G4']]},
    # Bar 3 & 7 & 11 & 15
    {'name': 'Cm9',    'bass': note_to_freq('C2'),  'notes': [note_to_freq(n) for n in ['C3', 'Eb3', 'G3', 'Bb3', 'D4']]},
    # Bar 4 & 8 & 12 & 16
    {'name': 'Gm7',    'bass': note_to_freq('G2'),  'notes': [note_to_freq(n) for n in ['G3', 'Bb3', 'D4', 'F4']]}
]

# Lead melody notes (pentatonic / smooth lofi pitch accents)
LEAD_MELODY = [
    # (time_in_beats, note_name, duration_beats, velocity)
    (0.5, 'G5', 1.5, 0.7),
    (2.0, 'Eb5', 1.0, 0.6),
    (3.0, 'F5', 1.0, 0.8),
    (4.5, 'C5', 1.5, 0.7),
    (6.0, 'Bb4', 2.0, 0.6),
    (8.5, 'Bb5', 1.0, 0.8),
    (9.5, 'G5', 1.5, 0.7),
    (11.0, 'Eb5', 1.0, 0.6),
    (12.5, 'F5', 1.5, 0.7),
    (14.0, 'D5', 2.0, 0.6),
]

# Audio buffers
left_channel = [0.0] * TOTAL_SAMPLES
right_channel = [0.0] * TOTAL_SAMPLES

# 1. Vinyl Crackle & Ambient Low-Pass Hiss Texture
print("Generating Vinyl & Ambient texture...")
random.seed(42)
lpf_state_l = 0.0
lpf_state_r = 0.0
hiss_alpha = 0.05 # Low pass coefficient for warm noise

for i in range(TOTAL_SAMPLES):
    t = i / SAMPLE_RATE
    # Subtle rumble/hiss noise
    raw_noise_l = (random.random() * 2.0 - 1.0) * 0.015
    raw_noise_r = (random.random() * 2.0 - 1.0) * 0.015
    
    lpf_state_l += hiss_alpha * (raw_noise_l - lpf_state_l)
    lpf_state_r += hiss_alpha * (raw_noise_r - lpf_state_r)
    
    # Occasional dust crackle pops
    crackle = 0.0
    if random.random() < 0.0002: # dust pop probability
        crackle = (random.random() * 2.0 - 1.0) * random.choice([0.08, 0.12, 0.2])
    
    left_channel[i] += lpf_state_l + crackle
    right_channel[i] += lpf_state_r + crackle

# 2. Rhodes / Lo-Fi Chords
print("Synthesizing Lo-Fi Rhodes chords...")
# Chord strum/hit schedule (syncopated lofi pattern)
# Rhythm per bar: hit on beat 0 (vel 0.8), hit on beat 2.5 (vel 0.65)
def synthesize_rhodes_note(freq, duration_sec, velocity):
    num_s = int(duration_sec * SAMPLE_RATE)
    buf_l = [0.0] * num_s
    buf_r = [0.0] * num_s
    
    # Subtle tape wobble (vibrato)
    vibrato_rate = 1.2 # Hz
    vibrato_depth = 0.003 # subtle pitch variation
    
    # Low-pass filter for warm muted tone
    lpf_l = 0.0
    lpf_r = 0.0
    cutoff_alpha = 0.12
    
    for i in range(num_s):
        t = i / SAMPLE_RATE
        # Envelope: soft attack (15ms), exponential decay
        if t < 0.015:
            env = (t / 0.015)
        else:
            env = math.exp(-(t - 0.015) * 1.8)
        
        env *= velocity
        
        # Pitch modulation
        freq_mod = freq * (1.0 + vibrato_depth * math.sin(2 * math.pi * vibrato_rate * t))
        phase = 2 * math.pi * freq_mod * t
        
        # Rhodes tone: Fundamental + 2nd + 3rd harmonic + subtle sine bell
        sig = (math.sin(phase) * 0.6 +
               math.sin(phase * 2) * 0.25 +
               math.sin(phase * 3) * 0.10 +
               math.sin(phase * 4.02) * 0.05)
        
        # Stereo warmth / subtle chorus (slight phase diff)
        phase_r = phase + 0.15
        sig_r = (math.sin(phase_r) * 0.6 +
                 math.sin(phase_r * 2) * 0.25 +
                 math.sin(phase_r * 3) * 0.10 +
                 math.sin(phase_r * 4.02) * 0.05)
        
        lpf_l += cutoff_alpha * (sig * env - lpf_l)
        lpf_r += cutoff_alpha * (sig_r * env - lpf_r)
        
        buf_l[i] = lpf_l * 0.18
        buf_r[i] = lpf_r * 0.18
        
    return buf_l, buf_r

for bar in range(NUM_BARS):
    chord_info = CHORD_PROGRESSION[bar % 4]
    bar_start_sample = int(bar * BAR_DUR * SAMPLE_RATE)
    
    # Hits in this bar:
    # Beat 0: Main chord hit
    # Beat 2.5: Syncopated gentle push chord
    hits = [
        (0.0, 3.2, 0.8),
        (2.5, 1.8, 0.6)
    ]
    
    for beat_off, dur_b, vel in hits:
        hit_start_sample = bar_start_sample + int(beat_off * BEAT_DUR * SAMPLE_RATE)
        dur_sec = dur_b * BEAT_DUR
        
        # Strum effect (notes hit slightly offset by 10-20ms)
        for idx, note_freq in enumerate(chord_info['notes']):
            strum_delay_sec = idx * 0.012 # 12ms strum spread
            note_start_sample = hit_start_sample + int(strum_delay_sec * SAMPLE_RATE)
            
            buf_l, buf_r = synthesize_rhodes_note(note_freq, dur_sec, vel)
            for i in range(len(buf_l)):
                target_idx = note_start_sample + i
                if target_idx < TOTAL_SAMPLES:
                    left_channel[target_idx] += buf_l[i]
                    right_channel[target_idx] += buf_r[i]

# 3. Deep Warm Sub-Bass
print("Synthesizing Sub-Bass...")
for bar in range(NUM_BARS):
    chord_info = CHORD_PROGRESSION[bar % 4]
    bass_freq = chord_info['bass']
    bar_start_sample = int(bar * BAR_DUR * SAMPLE_RATE)
    
    # Bass pattern: Beat 0 (long note), Beat 2.5 (short accent note)
    bass_hits = [
        (0.0, 2.3, 0.85),
        (2.5, 1.4, 0.70)
    ]
    
    for beat_off, dur_b, vel in bass_hits:
        start_sample = bar_start_sample + int(beat_off * BEAT_DUR * SAMPLE_RATE)
        dur_sec = dur_b * BEAT_DUR
        num_s = int(dur_sec * SAMPLE_RATE)
        
        lpf_bass = 0.0
        alpha_bass = 0.08 # Warm low pass cutoff (~120Hz)
        
        for i in range(num_s):
            t = i / SAMPLE_RATE
            # Attack 20ms, decay
            if t < 0.02:
                env = t / 0.02
            else:
                env = math.exp(-(t - 0.02) * 1.5)
            env *= vel
            
            # Sine + slight 2nd harmonic saturation
            phase = 2 * math.pi * bass_freq * t
            raw_bass = math.sin(phase) + 0.3 * math.sin(phase * 2)
            
            # Soft saturation curve
            sat_bass = math.tanh(raw_bass * 1.2)
            lpf_bass += alpha_bass * (sat_bass * env - lpf_bass)
            
            target_idx = start_sample + i
            if target_idx < TOTAL_SAMPLES:
                # Bass is centered in stereo field
                left_channel[target_idx] += lpf_bass * 0.25
                right_channel[target_idx] += lpf_bass * 0.25

# 4. Lo-Fi Drums (Kick, Snare/Rim, Hi-Hat)
print("Synthesizing Drums...")

# Pre-synthesize drum sounds
def generate_kick():
    dur_sec = 0.35
    num_s = int(dur_sec * SAMPLE_RATE)
    buf = [0.0] * num_s
    phase = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        # Envelope
        env = math.exp(-t * 12.0)
        # Pitch sweep from 140Hz down to 45Hz
        freq = 45.0 + 95.0 * math.exp(-t * 40.0)
        phase += 2 * math.pi * freq * (1.0 / SAMPLE_RATE)
        # Tanh drive for warm punch
        sig = math.tanh(math.sin(phase) * 1.8) * env
        buf[i] = sig * 0.38
    return buf

def generate_snare():
    dur_sec = 0.25
    num_s = int(dur_sec * SAMPLE_RATE)
    buf_l = [0.0] * num_s
    buf_r = [0.0] * num_s
    
    # Body tone + soft white noise rim sound
    lpf = 0.0
    for i in range(num_s):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 22.0)
        
        # Tonal body
        body = math.sin(2 * math.pi * 175.0 * t) * math.exp(-t * 35.0)
        # Dusty snare noise
        noise = (random.random() * 2.0 - 1.0)
        
        # Filter noise around 1500Hz
        lpf += 0.2 * (noise - lpf)
        
        sig = (body * 0.4 + lpf * 0.6) * env
        
        # Soft stereo width for snare room
        buf_l[i] = sig * 0.24
        buf_r[i] = sig * 0.22
    return buf_l, buf_r

def generate_hihat(open_hat=False):
    dur_sec = 0.12 if open_hat else 0.05
    num_s = int(dur_sec * SAMPLE_RATE)
    buf_l = [0.0] * num_s
    buf_r = [0.0] * num_s
    
    hpf_prev = 0.0
    decay_rate = 25.0 if open_hat else 65.0
    
    for i in range(num_s):
        t = i / SAMPLE_RATE
        env = math.exp(-t * decay_rate)
        
        # High passed noise
        noise = random.random() * 2.0 - 1.0
        hpf = noise - hpf_prev
        hpf_prev = noise * 0.6
        
        sig = hpf * env
        
        # Panned slightly right
        buf_l[i] = sig * 0.07
        buf_r[i] = sig * 0.10
    return buf_l, buf_r

kick_buf = generate_kick()
snare_l, snare_r = generate_snare()
hat_closed_l, hat_closed_r = generate_hihat(open_hat=False)
hat_open_l, hat_open_r = generate_hihat(open_hat=True)

# Lay down drum loop (Intro has no drums for 2 bars, then full groove enters)
for bar in range(2, NUM_BARS):
    bar_start_sample = int(bar * BAR_DUR * SAMPLE_RATE)
    
    # Lo-fi Hip Hop Beat Pattern (in beats):
    # Kick: Beat 0.0, Beat 2.25 (slightly laid back kick)
    # Snare: Beat 1.0, Beat 3.0
    # Hi-hats: Every 8th/16th note with swing
    
    kicks = [0.0, 2.25]
    snares = [1.0, 3.0]
    
    # Hi-hats on 8th notes with slight swing offset on off-beats
    hats = []
    for step in range(8):
        b = step * 0.5
        if step % 2 == 1:
            b += 0.04 # swing delay
        hats.append((b, step == 7)) # open hat on 7th step
        
    # Mix Kick
    for kb in kicks:
        s_idx = bar_start_sample + int(kb * BEAT_DUR * SAMPLE_RATE)
        for i in range(len(kick_buf)):
            idx = s_idx + i
            if idx < TOTAL_SAMPLES:
                left_channel[idx] += kick_buf[i]
                right_channel[idx] += kick_buf[i]
                
    # Mix Snare
    for sb in snares:
        # Micro timing variation for human feel (+5ms to 12ms)
        human_delay = random.uniform(0.005, 0.012)
        s_idx = bar_start_sample + int((sb * BEAT_DUR + human_delay) * SAMPLE_RATE)
        for i in range(len(snare_l)):
            idx = s_idx + i
            if idx < TOTAL_SAMPLES:
                left_channel[idx] += snare_l[i]
                right_channel[idx] += snare_r[i]
                
    # Mix Hi-hats
    for hb, is_open in hats:
        human_delay = random.uniform(0.001, 0.006)
        s_idx = bar_start_sample + int((hb * BEAT_DUR + human_delay) * SAMPLE_RATE)
        hl = hat_open_l if is_open else hat_closed_l
        hr = hat_open_r if is_open else hat_closed_r
        for i in range(len(hl)):
            idx = s_idx + i
            if idx < TOTAL_SAMPLES:
                left_channel[idx] += hl[i]
                right_channel[idx] += hr[i]

# 5. Lead Pluck Melody (Enters from Bar 5 to 13)
print("Synthesizing Pluck Melody...")
def synthesize_pluck_note(freq, duration_sec, velocity):
    num_s = int(duration_sec * SAMPLE_RATE)
    buf_l = [0.0] * num_s
    buf_r = [0.0] * num_s
    
    # Soft pluck envelope + delay feedback
    lpf = 0.0
    alpha = 0.15
    for i in range(num_s):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 4.5) * velocity
        phase = 2 * math.pi * freq * t
        
        # Pluck harmonic waveform
        sig = (math.sin(phase) + 0.4 * math.sin(phase * 2) + 0.15 * math.sin(phase * 3))
        lpf += alpha * (sig * env - lpf)
        
        # Stereo placement (slightly left)
        buf_l[i] = lpf * 0.14
        buf_r[i] = lpf * 0.09
    return buf_l, buf_r

# Simple delay line for space effect (quarter note delay = 0.789s)
delay_samples = int(BEAT_DUR * 0.75 * SAMPLE_RATE) # dotted 8th delay
delay_feedback = 0.35

for bar in range(4, 12):
    bar_start_sample = int(bar * BAR_DUR * SAMPLE_RATE)
    bar_in_section = (bar - 4) % 4
    
    # Pick lead melody notes active in this bar
    for beat_off, note_name, dur_b, vel in LEAD_MELODY:
        # Scale beat_off according to bar
        note_freq = note_to_freq(note_name)
        s_idx = bar_start_sample + int(beat_off * BEAT_DUR * SAMPLE_RATE)
        dur_sec = dur_b * BEAT_DUR
        
        buf_l, buf_r = synthesize_pluck_note(note_freq, dur_sec, vel)
        for i in range(len(buf_l)):
            idx = s_idx + i
            if idx < TOTAL_SAMPLES:
                left_channel[idx] += buf_l[i]
                right_channel[idx] += buf_r[i]
                
                # Add delay echo effect
                d_idx = idx + delay_samples
                if d_idx < TOTAL_SAMPLES:
                    left_channel[d_idx] += buf_l[i] * delay_feedback
                    right_channel[d_idx] += buf_r[i] * delay_feedback * 0.8

# 6. Master Processing: Soft Limiter & Fade-out
print("Applying Master Limiter and Fade-out...")
fade_out_samples = int(2.5 * SAMPLE_RATE)
fade_start_sample = TOTAL_SAMPLES - fade_out_samples

max_val = 0.0
for i in range(TOTAL_SAMPLES):
    # Apply fade out at end
    if i >= fade_start_sample:
        fade = (TOTAL_SAMPLES - i) / fade_out_samples
        left_channel[i] *= fade
        right_channel[i] *= fade
    
    # Soft tanh clip / saturation limiter
    left_channel[i] = math.tanh(left_channel[i] * 1.1)
    right_channel[i] = math.tanh(right_channel[i] * 1.1)
    
    abs_l = abs(left_channel[i])
    abs_r = abs(right_channel[i])
    if abs_l > max_val: max_val = abs_l
    if abs_r > max_val: max_val = abs_r

print(f"Peak amplitude after limiter: {max_val:.3f}")

# Normalize to -1.0 dB (~0.89)
norm_factor = 0.89 / max_val if max_val > 0 else 1.0

# 7. Write to WAV File
out_dir = r"c:\Users\byema\.gemini\antigravity-ide\scratch\artcube_demo\art-cube-demo\public\media"
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "contrasts_dryhope_inspired.wav")

print(f"Writing WAV file to {out_path}...")
with wave.open(out_path, 'wb') as wav_file:
    wav_file.setnchannels(2)      # Stereo
    wav_file.setsampwidth(2)     # 16-bit PCM (2 bytes)
    wav_file.setframerate(SAMPLE_RATE)
    
    frames = bytearray()
    for i in range(TOTAL_SAMPLES):
        sample_l = int(left_channel[i] * norm_factor * 32767.0)
        sample_r = int(right_channel[i] * norm_factor * 32767.0)
        
        # Clamp to 16-bit signed range
        sample_l = max(-32768, min(32767, sample_l))
        sample_r = max(-32768, min(32767, sample_r))
        
        frames.extend(struct.pack('<hh', sample_l, sample_r))
        
    wav_file.writeframes(frames)

print(f"SUCCESS: WAV file created at {out_path}")
