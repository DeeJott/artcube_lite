/**
 * Generates particle destination positions forming a Berlin skyline silhouette.
 * Each particle gets a target (x, y, z, stiffness) — particles spring toward
 * these targets and are disturbed by the fluid velocity field.
 *
 * Landmarks (left → right):
 *   Siegessäule · Berlin Cathedral · Rotes Rathaus · Fernsehturm (TV Tower)
 *   Brandenburg Gate · Reichstag · Potsdamer Platz
 *
 * Coordinate space: x ∈ [-3.7, 3.7] (left→right), y ∈ [-1.8, 1.5] (ground→sky)
 * Matches the camera at (0,0,5.2) with 45° FOV and 16:9 aspect.
 */

interface Region {
  w: number;
  gen: (r1: number, r2: number) => [number, number];
  stiffness?: number;
}

// ── Brandenburg Gate geometry constants — single source of truth so every
// architectural piece (columns, lintel, attic, pedestal, quadriga) stays
// perfectly flush with its neighbor and nothing floats or leaves a gap. ──
const GATE_LEFT = 0.15;
const GATE_RIGHT = 1.5;
const GATE_WIDTH = GATE_RIGHT - GATE_LEFT;
const GATE_CENTER = (GATE_LEFT + GATE_RIGHT) / 2;
const GATE_NUM_COLS = 6;
const GATE_COL_SPACING = GATE_WIDTH / GATE_NUM_COLS;
const GATE_COL_WIDTH = GATE_COL_SPACING * 0.62;
const GATE_GROUND_Y = -1.8;
const GATE_COL_TOP_Y = -0.75;

const REGIONS: Region[] = [
  // ── Left apartment blocks (Berlin Altbau) ──────────────────────
  { w: 3, gen: (r1, r2) => [-3.7 + r1 * 0.7, -1.8 + r2 * 1.1] },
  { w: 3, gen: (r1, r2) => [-3.0 + r1 * 0.55, -1.8 + r2 * 1.0] },

  // ── Siegessäule (Victory Column) ───────────────────────────────
  // Wider base
  { w: 1.5, gen: (r1, r2) => [-2.95 + r1 * 0.3, -1.8 + r2 * 0.4], stiffness: 1.2 },
  // Tall slender column
  { w: 2.5, gen: (r1, r2) => [-2.85 + r1 * 0.14, -1.4 + r2 * 1.5], stiffness: 1.3 },
  // Golden statue / sphere on top
  { w: 1.5, gen: (r1, r2) => {
    const a = r1 * Math.PI * 2;
    const r = Math.sqrt(r2) * 0.12;
    return [-2.78 + Math.cos(a) * r, 0.1 + Math.sin(a) * r];
  }, stiffness: 1.4 },
  // Spire above statue
  { w: 0.5, gen: (r1, r2) => [-2.8 + r1 * 0.06, 0.22 + r2 * 0.28], stiffness: 1.5 },

  // ── Berlin Cathedral (Berliner Dom) ────────────────────────────
  // Main body
  { w: 5, gen: (r1, r2) => [-2.4 + r1 * 0.9, -1.8 + r2 * 1.1] },
  // Central dome (large half-sphere)
  { w: 3, gen: (r1, r2) => {
    const a = r1 * Math.PI;
    const r = Math.sqrt(r2) * 0.38;
    return [-1.95 + Math.cos(a) * r, -0.7 + Math.sin(a) * r];
  }},
  // Dome lantern (small cylinder on top of dome)
  { w: 1, gen: (r1, r2) => [-2.02 + r1 * 0.14, -0.35 + r2 * 0.18] },
  // Left tower
  { w: 1.5, gen: (r1, r2) => [-2.42 + r1 * 0.14, -1.8 + r2 * 1.35] },
  // Right tower
  { w: 1.5, gen: (r1, r2) => [-1.58 + r1 * 0.14, -1.8 + r2 * 1.35] },

  // ── Rotes Rathaus (Red City Hall) — widened to close the street gap ──
  // Main body (widened + shifted to touch/overlap both neighbors, no dead space)
  { w: 7, gen: (r1, r2) => [-1.46 + r1 * 1.11, -1.8 + r2 * 1.0] },
  // Central tower (recentered on the wider body)
  { w: 1.5, gen: (r1, r2) => [-0.995 + r1 * 0.18, -0.8 + r2 * 0.85], stiffness: 1.2 },
  // Tower spire
  { w: 0.5, gen: (r1, r2) => [-0.945 + r1 * 0.08, 0.05 + r2 * 0.3], stiffness: 1.3 },

  // ── Fernsehturm (TV Tower) — the icon, made imposing ───────────
  // Thick stem (wider, more particles)
  { w: 8, gen: (r1, r2) => [-0.16 + r1 * 0.32, -1.8 + r2 * 2.35], stiffness: 1.5 },
  // Large observation sphere
  { w: 7, gen: (r1, r2) => {
    const a = r1 * Math.PI * 2;
    const r = Math.sqrt(r2) * 0.33;
    return [Math.cos(a) * r, 0.55 + Math.sin(a) * r];
  }, stiffness: 1.5 },
  // Sphere outer ring detail
  { w: 1, gen: (r1, r2) => {
    const a = r1 * Math.PI * 2;
    return [Math.cos(a) * 0.31, 0.55 + Math.sin(a) * 0.31];
  }, stiffness: 1.6 },
  // Long antenna spike
  { w: 3, gen: (r1, r2) => [-0.04 + r1 * 0.08, 0.88 + r2 * 0.7], stiffness: 1.6 },
  // Antenna tip
  { w: 0.5, gen: (r1, r2) => [-0.02 + r1 * 0.04, 1.5 + r2 * 0.08], stiffness: 1.7 },

  // ── Brandenburg Gate (Brandenburger Tor) — matches reference icon ─
  // 6 evenly-spaced Doric columns, flush with the ground and the lintel
  { w: 10, gen: (r1, r2) => {
    const colIdx = Math.min(GATE_NUM_COLS - 1, Math.floor(r1 * GATE_NUM_COLS));
    const fracInCol = r1 * GATE_NUM_COLS - colIdx;
    const x = GATE_LEFT + colIdx * GATE_COL_SPACING + fracInCol * GATE_COL_WIDTH;
    return [x, GATE_GROUND_Y + r2 * (GATE_COL_TOP_Y - GATE_GROUND_Y)];
  }, stiffness: 1.2 },
  // Lintel / architrave — spans the FULL gate width, flush with the columns
  { w: 3, gen: (r1, r2) => [GATE_LEFT + r1 * GATE_WIDTH, GATE_COL_TOP_Y + r2 * 0.15], stiffness: 1.2 },
  // Attic — left block
  { w: 1, gen: (r1, r2) => [GATE_LEFT + r1 * 0.4, -0.6 + r2 * 0.14], stiffness: 1.25 },
  // Attic — right block
  { w: 1, gen: (r1, r2) => [GATE_RIGHT - 0.4 + r1 * 0.4, -0.6 + r2 * 0.14], stiffness: 1.25 },
  // Attic — center block (taller, carries the pedestal), flush with the lintel
  { w: 1.5, gen: (r1, r2) => [GATE_CENTER - 0.18 + r1 * 0.36, -0.6 + r2 * 0.22], stiffness: 1.25 },
  // Pedestal beneath the Quadriga, flush with the center attic block
  { w: 0.4, gen: (r1, r2) => [GATE_CENTER - 0.09 + r1 * 0.18, -0.38 + r2 * 0.12], stiffness: 1.3 },
  // Quadriga — three-pronged silhouette, flush on the pedestal (no floating gap)
  { w: 0.3, gen: (r1, r2) => [GATE_CENTER - 0.09 + r1 * 0.03, -0.26 + r2 * 0.1], stiffness: 1.35 },
  { w: 0.4, gen: (r1, r2) => [GATE_CENTER - 0.02 + r1 * 0.04, -0.26 + r2 * 0.14], stiffness: 1.35 },
  { w: 0.3, gen: (r1, r2) => [GATE_CENTER + 0.06 + r1 * 0.03, -0.26 + r2 * 0.1], stiffness: 1.35 },

  // ── Reichstag ──────────────────────────────────────────────────
  // Main body (nudged left to overlap the gate's right attic, no gap)
  { w: 5, gen: (r1, r2) => [1.48 + r1 * 0.8, -1.8 + r2 * 1.1] },
  // Modern glass dome (hemisphere)
  { w: 3, gen: (r1, r2) => {
    const a = r1 * Math.PI;
    const r = Math.sqrt(r2) * 0.3;
    return [2.0 + Math.cos(a) * r, -0.7 + Math.sin(a) * r];
  }, stiffness: 1.1 },
  // Dome ring detail
  { w: 0.5, gen: (r1, r2) => {
    const a = r1 * Math.PI * 2;
    return [2.0 + Math.cos(a) * 0.22, -0.55 + Math.sin(a) * 0.22];
  }, stiffness: 1.2 },

  // ── Right buildings (Potsdamer Platz) — overlapping, no dead gaps ──
  { w: 3, gen: (r1, r2) => [2.3 + r1 * 0.55, -1.8 + r2 * 1.3] },
  { w: 3, gen: (r1, r2) => [2.8 + r1 * 0.6, -1.8 + r2 * 1.0] },

  // ── Stars in the sky (low stiffness — drift freely with fluid) ─
  { w: 1, gen: (r1, r2) => [-3.5 + r1 * 7.0, 0.5 + r2 * 1.3], stiffness: 0.3 },
];

const TOTAL_W = REGIONS.reduce((s, r) => s + r.w, 0);

// Estimate how "wide vs tall" a region's shape is by probing its own gen()
// function at the edges of r1/r2 space. This lets us lay particles out on a
// grid whose rows/cols roughly match the region's silhouette (e.g. a thin
// spire gets a tall single-column grid, a wide lintel gets a single-row
// grid, a dome gets a square ring/spoke grid) — no manual tuning per shape.
function estimateAspect(gen: Region['gen']): number {
  const dx = Math.abs(gen(1, 0.5)[0] - gen(0, 0.5)[0]);
  const dy = Math.abs(gen(0.5, 1)[1] - gen(0.5, 0)[1]);
  if (dx < 1e-4 && dy < 1e-4) return 1;
  return Math.min(20, Math.max(0.05, dx / Math.max(dy, 1e-4)));
}

// Deterministic stratified grid: particle `i` of `count` maps to a cell
// center in [0,1]x[0,1] instead of a random point. Fed into a region's
// gen(), this makes particles line up in clean rows/columns (or evenly
// spaced rings for polar shapes) instead of scattering wildly inside the
// building's silhouette.
function gridCell(index: number, count: number, aspect: number): [number, number] {
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [(col + 0.5) / cols, (row + 0.5) / rows];
}

export function generateBerlinSkyline(count: number): Float32Array {
  const dest = new Float32Array(count * 4);
  let idx = 0;

  for (const region of REGIONS) {
    const regionCount = Math.round((region.w / TOTAL_W) * count);
    // Free-floating elements (e.g. the star field, stiffness < 0.5) stay
    // randomly scattered — only building structure gets the clean grid.
    const isOrganic = (region.stiffness ?? 1) < 0.5;
    const aspect = isOrganic ? 1 : estimateAspect(region.gen);
    for (let i = 0; i < regionCount && idx < count; i++) {
      const [r1, r2] = isOrganic
        ? [Math.random(), Math.random()]
        : gridCell(i, regionCount, aspect);
      const [x, y] = region.gen(r1, r2);
      dest[idx * 4] = x;
      dest[idx * 4 + 1] = y;
      dest[idx * 4 + 2] = 0;
      dest[idx * 4 + 3] = region.stiffness ?? 1.0;
      idx++;
    }
  }

  // Fill any remaining particles with random building positions
  while (idx < count) {
    const region = REGIONS[Math.floor(Math.random() * (REGIONS.length - 1))];
    const [x, y] = region.gen(Math.random(), Math.random());
    dest[idx * 4] = x;
    dest[idx * 4 + 1] = y;
    dest[idx * 4 + 2] = 0;
    dest[idx * 4 + 3] = region.stiffness ?? 1.0;
    idx++;
  }

  return dest;
}

// World-to-fluid coordinate conversion (fluid uses [0,1] UV space)
const HALF_W = 5.2 * Math.tan((45 * Math.PI / 180) / 2) * (1920 / 1080);
const HALF_H = 5.2 * Math.tan((45 * Math.PI / 180) / 2);

export function worldToFluid(x: number, y: number): [number, number] {
  return [(x / HALF_W + 1) / 2, (y / HALF_H + 1) / 2];
}

// Building x-positions for audio-reactive beat splats
export const BUILDING_X = [-2.8, -1.95, -0.9, 0, GATE_CENTER, 1.9, 2.55, 3.1];
