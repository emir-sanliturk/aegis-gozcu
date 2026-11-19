#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION_SEC = 30;
const TOTAL_FRAMES = FPS * DURATION_SEC; // 900 frames

const OUT_DIR = path.resolve('public/media');
const MP4_OUT = path.join(OUT_DIR, 'aegis-gozcu-tanitim.mp4');
const SRT_OUT = path.join(OUT_DIR, 'aegis-gozcu-tanitim.tr.srt');
const WORK_DIR = path.resolve('.tmp_verify/promo_build');
const FRAMES_DIR = path.join(WORK_DIR, 'frames');
const AUDIO_WAV = path.join(WORK_DIR, 'underscore.wav');

const COLORS = {
  bgLight: '#F5F8FA',
  bgTint: '#EAF0F5',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F7',
  border: '#C6D3DF',
  borderStrong: '#8FA3B8',
  navyDark: '#071A2B',
  navy: '#102A43',
  navyMid: '#243B53',
  slate: '#486581',
  muted: '#627D98',
  teal: '#2E9B72',
  tealBright: '#6ED6C1',
  tealSoft: '#E3F5EE',
  gold: '#D9822B',
  goldBright: '#F6C86E',
  goldSoft: '#FDF3E6',
  seaFill: '#DDE7F0',
  landFill: '#F9FBFD',
};

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function easeInOutCubic(t) {
  const c = clamp(t, 0, 1);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

function easeOutCubic(t) {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

function segProgress(time, start, end) {
  return clamp((time - start) / (end - start), 0, 1);
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Geographic polygon rings [lon, lat] for orthographic -> local conformal zoom
const EUROPE_NORTH_POLY = [
  [-9.5, 37.0], [-9.2, 43.0], [-2.0, 43.4], [-4.5, 48.2], [2.0, 51.0],
  [5.0, 53.5], [8.5, 54.0], [8.2, 57.0], [10.6, 57.7], [12.0, 55.6],
  [10.0, 59.0], [5.2, 60.5], [6.5, 63.0], [14.0, 67.5], [20.0, 70.0],
  [28.5, 71.0], [32.0, 69.5], [40.0, 67.5], [44.0, 66.0], [58.0, 68.0],
  [62.0, 55.0], [52.0, 47.0], [47.0, 45.5], [43.0, 43.5], [39.5, 43.5],
  [37.0, 45.2], [33.5, 44.5], [31.0, 46.2], [29.6, 45.2], [28.0, 43.2],
  [27.8, 41.9], [26.1, 40.7], [23.8, 40.8], [22.8, 39.0], [23.8, 37.8],
  [22.4, 36.4], [21.3, 38.2], [19.5, 40.5], [16.5, 43.5], [13.8, 45.5],
  [12.5, 44.0], [15.5, 41.2], [18.3, 40.2], [16.0, 38.0], [12.5, 41.8],
  [9.8, 44.2], [7.2, 43.7], [3.2, 42.4], [0.0, 39.5], [-2.0, 36.8],
  [-5.6, 36.0], [-9.5, 37.0],
];

const UK_POLY = [
  [-5.5, 50.1], [-3.0, 51.4], [-4.8, 54.8], [-5.8, 58.4], [-2.0, 57.6],
  [-1.5, 55.2], [1.7, 52.5], [1.3, 51.1], [-3.2, 50.5], [-5.5, 50.1],
];

const AFRICA_NORTH_POLY = [
  [-17.0, 15.0], [-16.0, 22.0], [-13.0, 27.5], [-9.6, 32.0], [-5.8, 35.8],
  [0.0, 35.9], [7.8, 37.0], [10.8, 36.8], [11.5, 33.0], [15.0, 32.4],
  [20.0, 32.0], [25.0, 31.6], [30.0, 31.4], [32.6, 31.2], [33.5, 28.0],
  [37.0, 22.0], [43.0, 12.5], [51.0, 12.0], [45.0, 2.0], [35.0, -5.0],
  [15.0, -5.0], [5.0, 4.0], [-10.0, 6.0], [-17.0, 15.0],
];

const MIDDLE_EAST_POLY = [
  [32.6, 31.2], [34.4, 31.5], [35.5, 33.8], [35.9, 35.9], [36.1, 36.8],
  [41.5, 37.2], [44.5, 39.5], [48.5, 39.2], [50.0, 37.0], [54.0, 37.2],
  [60.0, 36.5], [62.0, 25.5], [56.5, 26.2], [54.5, 24.4], [51.5, 25.3],
  [48.5, 30.0], [44.0, 30.0], [39.0, 21.5], [43.3, 12.8], [52.0, 16.5],
  [59.5, 22.5], [56.0, 26.0], [48.0, 29.0], [36.5, 29.5], [34.8, 29.5],
  [32.6, 31.2],
];

// Detailed Turkey mainland (Anatolia + Thrace) for zoom transitions
const TURKEY_ANATOLIA_POLY = [
  [26.15, 39.50], [26.85, 40.35], [27.30, 40.42], [28.10, 40.40], [28.88, 40.62],
  [29.18, 41.00], [29.22, 41.22], [30.40, 41.15], [31.80, 41.48], [33.50, 42.02],
  [35.15, 42.05], [36.05, 41.65], [37.90, 41.05], [39.75, 41.00], [41.55, 41.52],
  [42.80, 41.45], [43.65, 40.70], [44.78, 39.65], [44.40, 38.20], [44.75, 37.30],
  [42.40, 37.15], [40.70, 36.75], [38.90, 36.85], [36.60, 36.80], [36.15, 35.92],
  [35.85, 36.55], [34.90, 36.80], [33.90, 36.25], [32.90, 36.02], [32.15, 36.45],
  [30.72, 36.85], [30.40, 36.20], [29.10, 36.62], [27.45, 36.72], [27.25, 37.45],
  [26.95, 38.42], [26.25, 38.30], [26.68, 39.15], [26.15, 39.50],
];

const TURKEY_THRACE_POLY = [
  [26.05, 40.62], [26.35, 41.70], [27.95, 42.00], [28.45, 41.48],
  [29.06, 41.24], [29.02, 41.01], [28.88, 40.97], [28.20, 41.02],
  [27.45, 40.95], [26.80, 40.55], [26.18, 40.10], [26.05, 40.62],
];

// High-detail Istanbul European & Asian peninsulas + Marmara/Black Sea coasts around the Bosphorus
const ISTANBUL_EUROPE_POLY = [
  [27.80, 41.00], [27.80, 41.65], [28.78, 41.45], [29.02, 41.25], [29.115, 41.225],
  [29.085, 41.18], [29.065, 41.135], [29.068, 41.09], [29.050, 41.052], [29.015, 41.032],
  [28.988, 41.024], [28.948, 41.045], [28.936, 41.036], [28.972, 41.018], [28.987, 41.011],
  [28.982, 41.001], [28.930, 40.992], [28.830, 40.968], [28.680, 40.985], [28.450, 41.020],
  [28.100, 40.980], [27.80, 41.00],
];

const ISTANBUL_ASIA_POLY = [
  [29.148, 41.228], [29.38, 41.20], [29.85, 41.18], [29.95, 40.72], [29.40, 40.78],
  [29.24, 40.87], [29.12, 40.93], [29.06, 40.97], [29.015, 41.006], [29.028, 41.028],
  [29.048, 41.048], [29.075, 41.078], [29.095, 41.125], [29.122, 41.182], [29.148, 41.228],
];

function projectGeo(lon, lat, centerLon, centerLat, scale, cx, cy, orthoBlend) {
  const rad = Math.PI / 180;
  const dLon = (lon - centerLon) * rad;
  const latR = lat * rad;
  const cLatR = centerLat * rad;

  // Orthographic projection coordinates (in radians * scale)
  const cosC = Math.sin(cLatR) * Math.sin(latR) + Math.cos(cLatR) * Math.cos(latR) * Math.cos(dLon);
  const ox = Math.cos(latR) * Math.sin(dLon);
  const oy = -(Math.cos(cLatR) * Math.sin(latR) - Math.sin(cLatR) * Math.cos(latR) * Math.cos(dLon));

  // Local conformal tangent-plane coordinates
  const lx = dLon * Math.cos(cLatR);
  const ly = -(latR - cLatR);

  const px = lerp(ox, lx, orthoBlend);
  const py = lerp(oy, ly, orthoBlend);

  return {
    x: cx + px * scale,
    y: cy + py * scale,
    visible: orthoBlend > 0.5 ? true : cosC > -0.05,
  };
}

function polyPath(ring, centerLon, centerLat, scale, cx, cy, orthoBlend, closed = true) {
  const pts = [];
  let anyVisible = false;
  for (const [lon, lat] of ring) {
    const p = projectGeo(lon, lat, centerLon, centerLat, scale, cx, cy, orthoBlend);
    if (p.visible) anyVisible = true;
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  if (!anyVisible || pts.length < 2) return '';
  return `M ${pts.join(' L ')}${closed ? ' Z' : ''}`;
}

// Background blueprint grid (shared across scenes)
function renderGrid(opacity = 0.45) {
  const lines = [];
  const step = 80;
  for (let x = 0; x <= WIDTH; x += step) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="#CBD7E3" stroke-width="1" opacity="${opacity}"/>`);
  }
  for (let y = 0; y <= HEIGHT; y += step) {
    lines.push(`<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="#CBD7E3" stroke-width="1" opacity="${opacity}"/>`);
  }
  return lines.join('\n');
}

// Geometric Aegis Shield Emblem (sharp crisp vector, no glow/neon)
function renderAegisShield(cx, cy, size, fill = COLORS.navy) {
  const s = size / 64;
  return `<g transform="translate(${(cx - size / 2).toFixed(1)}, ${(cy - size / 2).toFixed(1)}) scale(${s.toFixed(4)})">
    <path d="M32 4 L54 12 L54 30 C54 44 45 55 32 60 C19 55 10 44 10 30 L10 12 Z" fill="${fill}" stroke="${COLORS.goldBright}" stroke-width="2.6"/>
    <path d="M19 31 C23 25 27.5 22.5 32 22.5 C36.5 22.5 41 25 45 31 C41 37 36.5 39.5 32 39.5 C27.5 39.5 23 37 19 31 Z" fill="none" stroke="${COLORS.tealBright}" stroke-width="2.6"/>
    <rect x="29" y="28" width="6" height="6" fill="${COLORS.goldBright}"/>
    <line x1="32" y1="14" x2="32" y2="20" stroke="${COLORS.tealBright}" stroke-width="2"/>
    <line x1="32" y1="42" x2="32" y2="50" stroke="${COLORS.tealBright}" stroke-width="2"/>
  </g>`;
}

// Top progress / chapter indicator (shown 0..28.5s, hidden for pure final frame)
function renderSceneHeader(time, sceneIndex, sectionLabel, alpha = 1) {
  if (alpha <= 0.01) return '';
  const pct = clamp(time / DURATION_SEC, 0, 1);
  return `<g opacity="${alpha.toFixed(3)}">
    <rect x="72" y="40" width="1776" height="44" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <rect x="72" y="40" width="8" height="44" fill="${COLORS.navyDark}"/>
    <text x="98" y="68" font-family="Noto Sans" font-weight="bold" font-size="16" fill="${COLORS.navy}">AEGIS GÖZCÜ</text>
    <text x="234" y="68" font-family="JetBrains Mono" font-size="14" fill="${COLORS.muted}">|  0${sceneIndex} / 06  ·  ${esc(sectionLabel)}</text>
    <text x="1824" y="68" text-anchor="end" font-family="JetBrains Mono" font-size="14" fill="${COLORS.navy}">${time.toFixed(1)}s / 30.0s</text>
    <rect x="72" y="84" width="1776" height="3" fill="${COLORS.border}"/>
    <rect x="72" y="84" width="${(1776 * pct).toFixed(1)}" height="3" fill="${COLORS.teal}"/>
  </g>`;
}

// =====================================================================
// SCENE 1 (0.0s - 5.0s): Globe -> Turkey -> Istanbul Zoom
// =====================================================================
function renderScene1(time) {
  const t = clamp(time / 5.0, 0, 1);
  // Camera interpolation across 3 keyframes:
  // 0.0..0.42: Globe centered near Med/Europe -> Anatolia
  // 0.42..0.78: Turkey scale -> Marmara/Istanbul
  // 0.78..1.00: Istanbul Bosphorus close-up lock
  let lon, lat, scale, orthoBlend;
  if (t < 0.42) {
    const k = easeInOutCubic(t / 0.42);
    lon = lerp(18.0, 34.5, k);
    lat = lerp(34.0, 39.3, k);
    scale = Math.exp(lerp(Math.log(390), Math.log(2450), k));
    orthoBlend = lerp(0.0, 0.75, k);
  } else if (t < 0.78) {
    const k = easeInOutCubic((t - 0.42) / 0.36);
    lon = lerp(34.5, 29.02, k);
    lat = lerp(39.3, 41.03, k);
    scale = Math.exp(lerp(Math.log(2450), Math.log(22000), k));
    orthoBlend = lerp(0.75, 1.0, k);
  } else {
    const k = easeOutCubic((t - 0.78) / 0.22);
    lon = lerp(29.02, 29.01, k);
    lat = lerp(41.03, 41.035, k);
    scale = lerp(22000, 27500, k);
    orthoBlend = 1.0;
  }

  // Right map focal center shifts slightly right so left title has crisp space
  const mapCx = lerp(1080, 1180, smoothstep(t * 1.4));
  const mapCy = 555;

  const globeRadius = scale * 1.0;
  const globeFade = 1 - smoothstep((t - 0.15) / 0.35);

  const graticule = [];
  const lonStep = t < 0.45 ? 15 : t < 0.75 ? 5 : 0.25;
  const latStep = t < 0.45 ? 15 : t < 0.75 ? 5 : 0.25;
  const minLon = t < 0.45 ? -45 : t < 0.75 ? 20 : 28.0;
  const maxLon = t < 0.45 ? 75 : t < 0.75 ? 50 : 30.2;
  const minLat = t < 0.45 ? -15 : t < 0.75 ? 32 : 40.4;
  const maxLat = t < 0.45 ? 75 : t < 0.75 ? 45 : 41.7;

  for (let glon = minLon; glon <= maxLon + 0.001; glon += lonStep) {
    const pts = [];
    for (let glat = minLat; glat <= maxLat; glat += (maxLat - minLat) / 24) {
      const p = projectGeo(glon, glat, lon, lat, scale, mapCx, mapCy, orthoBlend);
      if (p.visible) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    if (pts.length > 1) {
      graticule.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#B6C6D6" stroke-width="1" opacity="0.55"/>`);
    }
  }
  for (let glat = minLat; glat <= maxLat + 0.001; glat += latStep) {
    const pts = [];
    for (let glon = minLon; glon <= maxLon; glon += (maxLon - minLon) / 24) {
      const p = projectGeo(glon, glat, lon, lat, scale, mapCx, mapCy, orthoBlend);
      if (p.visible) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    if (pts.length > 1) {
      graticule.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#B6C6D6" stroke-width="1" opacity="0.55"/>`);
    }
  }

  const macroFade = 1 - smoothstep((t - 0.50) / 0.22);
  const macroPolys =
    macroFade > 0.02
      ? [EUROPE_NORTH_POLY, UK_POLY, AFRICA_NORTH_POLY, MIDDLE_EAST_POLY]
          .map((ring) => polyPath(ring, lon, lat, scale, mapCx, mapCy, orthoBlend, true))
          .filter(Boolean)
          .map(
            (d) =>
              `<path d="${d}" fill="${COLORS.landFill}" stroke="#9AB0C4" stroke-width="1.4" opacity="${macroFade.toFixed(3)}"/>`
          )
          .join('\n')
      : '';

  const trMainFade = clamp(1 - smoothstep((t - 0.54) / 0.22), 0, 1);
  const trPaths =
    trMainFade > 0.02
      ? [TURKEY_ANATOLIA_POLY, TURKEY_THRACE_POLY]
          .map((ring) => polyPath(ring, lon, lat, scale, mapCx, mapCy, orthoBlend, true))
          .filter(Boolean)
          .map(
            (d) =>
              `<path d="${d}" fill="#E4EEF4" stroke="${COLORS.navy}" stroke-width="${lerp(1.8, 3.0, clamp(t * 2, 0, 1)).toFixed(1)}" opacity="${trMainFade.toFixed(3)}"/>`
          )
          .join('\n')
      : '';

  const istFade = smoothstep((t - 0.56) / 0.2);
  const istPaths =
    istFade > 0.02
      ? [ISTANBUL_EUROPE_POLY, ISTANBUL_ASIA_POLY]
          .map((ring) => polyPath(ring, lon, lat, scale, mapCx, mapCy, orthoBlend, true))
          .filter(Boolean)
          .map(
            (d) =>
              `<path d="${d}" fill="#EEF4F8" stroke="${COLORS.navyDark}" stroke-width="2.4" opacity="${istFade.toFixed(3)}"/>`
          )
          .join('\n')
      : '';

  // Target pin for Istanbul (41.0082 N, 28.9784 E)
  const istPt = projectGeo(28.9784, 41.0082, lon, lat, scale, mapCx, mapCy, orthoBlend);
  const pinScale = 1 + 0.15 * Math.sin(time * 4.5);
  const targetRingSize = lerp(18, 42, smoothstep((t - 0.5) / 0.45));

  // Location breadcrumb label
  const regionStep =
    t < 0.36 ? 'KÜRESEL KONUM · 39°K 35°D' : t < 0.72 ? 'TÜRKİYE · ANADOLU & MARMARA' : 'İSTANBUL · 41.0082°K 28.9784°D';

  const titleAlpha = smoothstep(time / 0.75);
  const titleOffset = (1 - easeOutCubic(clamp(time / 0.9, 0, 1))) * 24;

  return `<g>
    <!-- Viewport map frame (sharp 0px) -->
    <rect x="72" y="108" width="1776" height="892" fill="${COLORS.seaFill}" stroke="${COLORS.border}" stroke-width="1"/>
    <clipPath id="mapClip1">
      <rect x="72" y="108" width="1776" height="892"/>
    </clipPath>
    <g clip-path="url(#mapClip1)">
      ${
        globeFade > 0.02
          ? `<circle cx="${mapCx.toFixed(1)}" cy="${mapCy}" r="${globeRadius.toFixed(1)}" fill="#CFE0EE" stroke="${COLORS.navy}" stroke-width="2" opacity="${globeFade.toFixed(3)}"/>`
          : ''
      }
      ${graticule.join('\n')}
      ${macroPolys}
      ${trPaths}
      ${istPaths}

      <!-- Architectural crosshair on Istanbul -->
      ${
        istPt.visible
          ? `<g>
              <line x1="${(istPt.x - 160).toFixed(1)}" y1="${istPt.y.toFixed(1)}" x2="${(istPt.x - targetRingSize).toFixed(1)}" y2="${istPt.y.toFixed(1)}" stroke="${COLORS.teal}" stroke-width="1.6"/>
              <line x1="${(istPt.x + targetRingSize).toFixed(1)}" y1="${istPt.y.toFixed(1)}" x2="${(istPt.x + 160).toFixed(1)}" y2="${istPt.y.toFixed(1)}" stroke="${COLORS.teal}" stroke-width="1.6"/>
              <line x1="${istPt.x.toFixed(1)}" y1="${(istPt.y - 160).toFixed(1)}" x2="${istPt.x.toFixed(1)}" y2="${(istPt.y - targetRingSize).toFixed(1)}" stroke="${COLORS.teal}" stroke-width="1.6"/>
              <line x1="${istPt.x.toFixed(1)}" y1="${(istPt.y + targetRingSize).toFixed(1)}" x2="${istPt.x.toFixed(1)}" y2="${(istPt.y + 160).toFixed(1)}" stroke="${COLORS.teal}" stroke-width="1.6"/>
              <rect x="${(istPt.x - targetRingSize * pinScale * 0.5).toFixed(1)}" y="${(istPt.y - targetRingSize * pinScale * 0.5).toFixed(1)}" width="${(targetRingSize * pinScale).toFixed(1)}" height="${(targetRingSize * pinScale).toFixed(1)}" fill="none" stroke="${COLORS.gold}" stroke-width="2.2"/>
              <rect x="${(istPt.x - 6).toFixed(1)}" y="${(istPt.y - 6).toFixed(1)}" width="12" height="12" fill="${COLORS.navyDark}" stroke="${COLORS.goldBright}" stroke-width="2"/>
              <rect x="${(istPt.x + 26).toFixed(1)}" y="${(istPt.y - 44).toFixed(1)}" width="210" height="34" fill="${COLORS.navyDark}"/>
              <text x="${(istPt.x + 38).toFixed(1)}" y="${(istPt.y - 22).toFixed(1)}" font-family="JetBrains Mono" font-weight="bold" font-size="14" fill="${COLORS.tealBright}">İSTANBUL MERKEZ</text>
            </g>`
          : ''
      }
    </g>

    <!-- Top-right coordinate telemetry block -->
    <rect x="1420" y="136" width="400" height="50" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <rect x="1420" y="136" width="6" height="50" fill="${COLORS.teal}"/>
    <text x="1442" y="166" font-family="JetBrains Mono" font-weight="bold" font-size="14" fill="${COLORS.navy}">${esc(regionStep)}</text>

    <!-- Primary Title Block (bottom-left, sharp 0px corners) -->
    <g transform="translate(0, ${titleOffset.toFixed(1)})" opacity="${titleAlpha.toFixed(3)}">
      <rect x="116" y="676" width="680" height="260" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
      <rect x="116" y="676" width="12" height="260" fill="${COLORS.navyDark}"/>
      ${renderAegisShield(192, 748, 58)}
      <text x="240" y="742" font-family="JetBrains Mono" font-weight="bold" font-size="15" fill="${COLORS.teal}">KİŞİSEL OPERASYON ALTYAPISI</text>
      <text x="240" y="796" font-family="Noto Sans" font-weight="bold" font-size="56" fill="${COLORS.navyDark}">Aegis Gözcü</text>
      <line x1="158" y1="832" x2="756" y2="832" stroke="${COLORS.border}" stroke-width="1.5"/>
      <text x="158" y="880" font-family="Noto Sans" font-weight="bold" font-size="28" fill="${COLORS.navy}">Kişisel Güvenlik ve Olay Merkezi</text>
      <text x="158" y="914" font-family="JetBrains Mono" font-size="14" fill="${COLORS.muted}">DÜNYA  →  TÜRKİYE  →  İSTANBUL  ·  GERÇEK VERİ MİMARİSİ</text>
    </g>
  </g>`;
}

// =====================================================================
// SCENE 2 (5.0s - 10.0s): Abstract Infrastructure Network Map
// =====================================================================
function renderScene2(time) {
  const localT = time - 5.0; // 0..5s
  const fade = smoothstep(localT / 0.55);

  // Center Hub + 4 endpoint device nodes (clear space below top-left title banner)
  const hub = { x: 1060, y: 615, label: 'Aegis Gözcü Merkezi', sub: 'Korelasyon & Olay Doğrulama' };
  const nodes = [
    { x: 520, y: 410, title: 'Masaüstü İstemci', sub: 'Windows / macOS Ajanı', tag: 'ETW · ES', accent: COLORS.navy },
    { x: 520, y: 820, title: 'Mobil Uç Birim', sub: 'Android Ön Plan Servisi', tag: 'FGS · İZİN', accent: COLORS.teal },
    { x: 1600, y: 410, title: 'Doğrulama Ucu', sub: 'Sahip Onay Cihazı', tag: 'ONAY · KİLİT', accent: COLORS.gold },
    { x: 1600, y: 820, title: 'Güvenli Paylaşım', sub: 'Süreli ve İptal Edilebilir', tag: 'X25519 · TTL', accent: COLORS.navy },
  ];

  const linksSvg = [];
  const packetsSvg = [];
  nodes.forEach((n, idx) => {
    const reveal = smoothstep((localT - 0.35 - idx * 0.18) / 0.55);
    if (reveal <= 0.01) return;
    const midX = (n.x + hub.x) / 2;
    const pathD = `M ${n.x} ${n.y} L ${midX} ${n.y} L ${midX} ${hub.y} L ${hub.x} ${hub.y}`;

    linksSvg.push(
      `<path d="${pathD}" fill="none" stroke="#B6C6D6" stroke-width="3" opacity="${reveal.toFixed(2)}"/>`,
      `<path d="${pathD}" fill="none" stroke="${COLORS.teal}" stroke-width="2" stroke-dasharray="10 8" opacity="${(0.85 * reveal).toFixed(2)}"/>`
    );

    // Compute animated packet position along the 3 orthogonal segments
    const pPhase = ((localT * 0.45 + idx * 0.24) % 1);
    let px, py;
    if (pPhase < 0.35) {
      const k = pPhase / 0.35;
      px = lerp(n.x, midX, k);
      py = n.y;
    } else if (pPhase < 0.65) {
      const k = (pPhase - 0.35) / 0.3;
      px = midX;
      py = lerp(n.y, hub.y, k);
    } else {
      const k = (pPhase - 0.65) / 0.35;
      px = lerp(midX, hub.x, k);
      py = hub.y;
    }

    const packetColor = idx % 2 === 0 ? COLORS.teal : COLORS.gold;
    packetsSvg.push(
      `<rect x="${(px - 7).toFixed(1)}" y="${(py - 7).toFixed(1)}" width="14" height="14" fill="${packetColor}" stroke="${COLORS.navyDark}" stroke-width="1.5" opacity="${reveal.toFixed(2)}"/>`
    );
  });

  const nodesSvg = nodes
    .map((n, idx) => {
      const reveal = smoothstep((localT - 0.25 - idx * 0.16) / 0.5);
      const slide = (1 - easeOutCubic(reveal)) * 18;
      const bx = n.x - 170;
      const by = n.y - 68 + slide;
      return `<g opacity="${reveal.toFixed(3)}">
        <rect x="${bx}" y="${by.toFixed(1)}" width="340" height="136" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
        <rect x="${bx}" y="${by.toFixed(1)}" width="8" height="136" fill="${n.accent}"/>
        <rect x="${bx + 24}" y="${(by + 18).toFixed(1)}" width="128" height="24" fill="${COLORS.surfaceMuted}" stroke="${COLORS.border}" stroke-width="1"/>
        <text x="${bx + 34}" y="${(by + 35).toFixed(1)}" font-family="JetBrains Mono" font-weight="bold" font-size="12" fill="${COLORS.navy}">${esc(n.tag)}</text>
        <text x="${bx + 24}" y="${(by + 74).toFixed(1)}" font-family="Noto Sans" font-weight="bold" font-size="24" fill="${COLORS.navyDark}">${esc(n.title)}</text>
        <text x="${bx + 24}" y="${(by + 106).toFixed(1)}" font-family="Noto Sans" font-size="16" fill="${COLORS.slate}">${esc(n.sub)}</text>
      </g>`;
    })
    .join('\n');

  // Cross-links between peer layers
  const peerAlpha = smoothstep((localT - 1.5) / 0.7);

  return `<g opacity="${fade.toFixed(3)}">
    <rect x="72" y="108" width="1776" height="892" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
    ${renderGrid(0.32)}

    <!-- Subtle Istanbul vector silhouette watermark in center background -->
    <g opacity="0.14">
      <rect x="820" y="340" width="480" height="420" fill="none" stroke="${COLORS.navy}" stroke-width="1" stroke-dasharray="6 6"/>
      <line x1="1060" y1="220" x2="1060" y2="880" stroke="${COLORS.navy}" stroke-width="1"/>
      <line x1="420" y1="550" x2="1700" y2="550" stroke="${COLORS.navy}" stroke-width="1"/>
    </g>

    ${linksSvg.join('\n')}

    <!-- Peer control vertical brackets -->
    <g opacity="${(peerAlpha * 0.6).toFixed(2)}">
      <line x1="520" y1="478" x2="520" y2="752" stroke="${COLORS.borderStrong}" stroke-width="1.5" stroke-dasharray="4 4"/>
      <line x1="1600" y1="478" x2="1600" y2="752" stroke="${COLORS.borderStrong}" stroke-width="1.5" stroke-dasharray="4 4"/>
    </g>

    ${packetsSvg.join('\n')}
    ${nodesSvg}

    <!-- Central Hub Box (sharp 0px) -->
    <g>
      <rect x="${hub.x - 190}" y="${hub.y - 96}" width="380" height="192" fill="${COLORS.navyDark}" stroke="${COLORS.tealBright}" stroke-width="2"/>
      <rect x="${hub.x - 190}" y="${hub.y - 96}" width="380" height="8" fill="${COLORS.teal}"/>
      ${renderAegisShield(hub.x, hub.y - 34, 48, COLORS.navy)}
      <text x="${hub.x}" y="${hub.y + 18}" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="25" fill="#FFFFFF">${esc(hub.label)}</text>
      <text x="${hub.x}" y="${hub.y + 48}" text-anchor="middle" font-family="Noto Sans" font-size="16" fill="${COLORS.tealBright}">${esc(hub.sub)}</text>
      <text x="${hub.x}" y="${hub.y + 76}" text-anchor="middle" font-family="JetBrains Mono" font-size="12" fill="#B6C6D6">ŞİFRELİ KANAL · APPEND-ONLY ZİNCİR</text>
    </g>

    <!-- Required Text Overlay Banner (Top-Left, sharp 0px) -->
    <g>
      <rect x="116" y="138" width="520" height="118" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
      <rect x="116" y="138" width="10" height="118" fill="${COLORS.teal}"/>
      <text x="148" y="186" font-family="Noto Sans" font-weight="bold" font-size="34" fill="${COLORS.navyDark}">Gerçek cihaz verisi</text>
      <text x="148" y="230" font-family="Noto Sans" font-weight="bold" font-size="34" fill="${COLORS.teal}">Güvenli olay takibi</text>
    </g>
  </g>`;
}

// =====================================================================
// SCENE 3 (10.0s - 16.0s): Layered Architecture Data Flow
// Tarayıcı -> Nginx -> Fastify API -> PostgreSQL
// =====================================================================
function renderScene3(time) {
  const localT = time - 10.0; // 0..6s
  const fade = smoothstep(localT / 0.5);

  const layers = [
    {
      x: 136,
      title: 'Tarayıcı',
      role: 'Operasyon Konsolu',
      reqText: 'İstemci Oturumu · HTTPS',
      detail1: 'credentials: "include"',
      detail2: 'Onaysız komut gönderilmez',
      accent: COLORS.navy,
      activeAt: 0.4,
    },
    {
      x: 568,
      title: 'Nginx',
      role: 'Ağ Geçidi Katmanı',
      reqText: 'TLS · Reverse Proxy',
      detail1: '443 TLS Sonlandırma',
      detail2: '/api/ → Fastify Yönlendirme',
      accent: COLORS.teal,
      activeAt: 1.5,
    },
    {
      x: 1000,
      title: 'Fastify API',
      role: 'Uygulama & Güvenlik',
      reqText: 'Strict CORS · Session',
      detail1: 'Açık Origin Doğrulama',
      detail2: '__Host-aegis_session Kontrolü',
      accent: COLORS.gold,
      activeAt: 2.7,
    },
    {
      x: 1432,
      title: 'PostgreSQL',
      role: 'Veri Depolama Katmanı',
      reqText: 'Kalıcı gerçek veri',
      detail1: 'Cihazlar, Olaylar ve Paylaşımlar',
      detail2: 'Denetlenebilir Bütünlük Kaydı',
      accent: COLORS.navyDark,
      activeAt: 3.9,
    },
  ];

  const boxW = 352;
  const boxH = 380;
  const boxY = 340;

  // Animated progressive flow arrow between consecutive boxes
  const arrowsSvg = [];
  for (let i = 0; i < 3; i++) {
    const x1 = layers[i].x + boxW;
    const x2 = layers[i + 1].x;
    const midY = boxY + boxH / 2;
    const flowT = clamp((localT - (0.9 + i * 1.15)) / 0.85, 0, 1);
    const arrowColor = flowT > 0.1 ? COLORS.teal : COLORS.borderStrong;

    arrowsSvg.push(
      `<line x1="${x1}" y1="${midY}" x2="${x2 - 14}" y2="${midY}" stroke="${COLORS.border}" stroke-width="4"/>`,
      `<line x1="${x1}" y1="${midY}" x2="${lerp(x1, x2 - 14, flowT).toFixed(1)}" y2="${midY}" stroke="${arrowColor}" stroke-width="4"/>`,
      `<polygon points="${x2 - 16},${midY - 9} ${x2 - 2},${midY} ${x2 - 16},${midY + 9}" fill="${flowT > 0.8 ? COLORS.teal : COLORS.borderStrong}"/>`
    );

    if (flowT > 0.02 && flowT < 0.99) {
      const px = lerp(x1 + 6, x2 - 20, flowT);
      arrowsSvg.push(`<rect x="${(px - 6).toFixed(1)}" y="${midY - 6}" width="12" height="12" fill="${COLORS.gold}" stroke="${COLORS.navyDark}" stroke-width="1.5"/>`);
    }
  }

  const boxesSvg = layers
    .map((l, idx) => {
      const appear = smoothstep((localT - idx * 0.22) / 0.45);
      const isActive = localT >= l.activeAt;
      const highlight = isActive ? 1 : 0;
      const topBar = isActive ? l.accent : COLORS.borderStrong;
      const borderCol = isActive ? COLORS.navyDark : COLORS.borderStrong;
      const badgeBg = isActive ? l.accent : COLORS.surfaceMuted;
      const badgeFg = isActive ? '#FFFFFF' : COLORS.navy;

      return `<g opacity="${appear.toFixed(3)}">
        <rect x="${l.x}" y="${boxY}" width="${boxW}" height="${boxH}" fill="${COLORS.surface}" stroke="${borderCol}" stroke-width="${isActive ? '2' : '1.2'}"/>
        <rect x="${l.x}" y="${boxY}" width="${boxW}" height="10" fill="${topBar}"/>

        <!-- Layer index badge -->
        <rect x="${l.x + 24}" y="${boxY + 34}" width="84" height="28" fill="${COLORS.navyDark}"/>
        <text x="${l.x + 66}" y="${boxY + 53}" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="13" fill="${COLORS.tealBright}">KATMAN 0${idx + 1}</text>

        <!-- Layer Title -->
        <text x="${l.x + 24}" y="${boxY + 114}" font-family="Noto Sans" font-weight="bold" font-size="34" fill="${COLORS.navyDark}">${esc(l.title)}</text>
        <text x="${l.x + 24}" y="${boxY + 148}" font-family="Noto Sans" font-size="17" fill="${COLORS.muted}">${esc(l.role)}</text>

        <!-- Required Key Highlight Box inside Layer -->
        <rect x="${l.x + 24}" y="${boxY + 180}" width="${boxW - 48}" height="56" fill="${badgeBg}" stroke="${COLORS.navy}" stroke-width="1"/>
        <text x="${l.x + boxW / 2}" y="${boxY + 215}" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="19" fill="${badgeFg}">${esc(l.reqText)}</text>

        <!-- Technical specs -->
        <line x1="${l.x + 24}" y1="${boxY + 266}" x2="${l.x + boxW - 24}" y2="${boxY + 266}" stroke="${COLORS.border}" stroke-width="1"/>
        <rect x="${l.x + 24}" y="${boxY + 292}" width="8" height="8" fill="${highlight ? COLORS.teal : COLORS.muted}"/>
        <text x="${l.x + 42}" y="${boxY + 301}" font-family="JetBrains Mono" font-size="14" fill="${COLORS.navy}">${esc(l.detail1)}</text>
        <rect x="${l.x + 24}" y="${boxY + 328}" width="8" height="8" fill="${highlight ? COLORS.gold : COLORS.muted}"/>
        <text x="${l.x + 42}" y="${boxY + 337}" font-family="JetBrains Mono" font-size="14" fill="${COLORS.navy}">${esc(l.detail2)}</text>
      </g>`;
    })
    .join('\n');

  return `<g opacity="${fade.toFixed(3)}">
    <rect x="72" y="108" width="1776" height="892" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
    ${renderGrid(0.3)}

    <!-- Top heading -->
    <rect x="136" y="148" width="1648" height="122" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <rect x="136" y="148" width="10" height="122" fill="${COLORS.navyDark}"/>
    <text x="172" y="192" font-family="JetBrains Mono" font-weight="bold" font-size="15" fill="${COLORS.teal}">KATMANLI VERİ AKIŞI · ÜRETİM MİMARİSİ</text>
    <text x="172" y="242" font-family="Noto Sans" font-weight="bold" font-size="38" fill="${COLORS.navyDark}">Tarayıcı  →  Nginx  →  Fastify API  →  PostgreSQL</text>

    ${arrowsSvg.join('\n')}
    ${boxesSvg}

    <!-- Bottom architecture baseline bar -->
    <rect x="136" y="776" width="1648" height="148" fill="${COLORS.navyDark}"/>
    <rect x="136" y="776" width="1648" height="4" fill="${COLORS.teal}"/>
    <text x="176" y="832" font-family="Noto Sans" font-weight="bold" font-size="24" fill="#FFFFFF">Tek Yönlü Güven Sınırı: Dış İstekler Yalnızca TLS Reverse Proxy Üzerinden API Katmanına Ulaşır</text>
    <text x="176" y="878" font-family="JetBrains Mono" font-size="16" fill="${COLORS.tealBright}">[HTTPS 443] → [Nginx /api/] → [Fastify CORS + Session Guard] → [Internal Network PostgreSQL]</text>
  </g>`;
}

// =====================================================================
// SCENE 4 (16.0s - 21.0s): Security Layers
// =====================================================================
function renderScene4(time) {
  const localT = time - 16.0; // 0..5s
  const fade = smoothstep(localT / 0.5);

  const cards = [
    {
      y: 296,
      badge: 'CORS KURALI',
      title: 'Açık origin CORS listesi',
      desc: 'Yalnızca AEGIS_ALLOWED_ORIGINS listesindeki tanımlı HTTPS origin adreslerine izin verilir.',
      meta: '403 cors_origin_not_allowed  ·  Vary: Origin',
      accent: COLORS.gold,
      delay: 0.2,
    },
    {
      y: 468,
      badge: 'OTURUM ÇEREZİ',
      title: 'HttpOnly · Secure · SameSite=Strict',
      desc: '__Host-aegis_session çerezi tarayıcı betiklerinden gizlenir ve yalnızca güvenli HTTPS ile taşınır.',
      meta: 'AEGIS_SESSION_SECRET ≥ 32 karakter  ·  /run/secrets',
      accent: COLORS.teal,
      delay: 0.85,
    },
    {
      y: 640,
      badge: 'AĞ İZOLASYONU',
      title: 'Internal Docker Network',
      desc: 'Veritabanı ve arka plan servisleri dış ağa kapalı internal Docker ağı içinde izole çalışır.',
      meta: 'internal: true  ·  Non-root container  ·  Port maruziyeti yok',
      accent: COLORS.navy,
      delay: 1.5,
    },
  ];

  const cardsSvg = cards
    .map((c) => {
      const k = smoothstep((localT - c.delay) / 0.55);
      const tx = (1 - easeOutCubic(k)) * -28;
      return `<g transform="translate(${tx.toFixed(1)}, 0)" opacity="${k.toFixed(3)}">
        <rect x="136" y="${c.y}" width="1080" height="146" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
        <rect x="136" y="${c.y}" width="10" height="146" fill="${c.accent}"/>
        <rect x="172" y="${c.y + 22}" width="190" height="26" fill="${c.accent}"/>
        <text x="267" y="${c.y + 40}" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="12" fill="#FFFFFF">${esc(c.badge)}</text>
        <text x="382" y="${c.y + 42}" font-family="JetBrains Mono" font-size="14" fill="${COLORS.muted}">${esc(c.meta)}</text>
        <text x="172" y="${c.y + 84}" font-family="Noto Sans" font-weight="bold" font-size="30" fill="${COLORS.navyDark}">${esc(c.title)}</text>
        <text x="172" y="${c.y + 118}" font-family="Noto Sans" font-size="18" fill="${COLORS.slate}">${esc(c.desc)}</text>
      </g>`;
    })
    .join('\n');

  const panelReveal = smoothstep((localT - 0.55) / 0.65);

  return `<g opacity="${fade.toFixed(3)}">
    <rect x="72" y="108" width="1776" height="892" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
    ${renderGrid(0.3)}

    <!-- Top Header -->
    <rect x="136" y="148" width="1648" height="114" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <rect x="136" y="148" width="10" height="114" fill="${COLORS.gold}"/>
    <text x="172" y="190" font-family="JetBrains Mono" font-weight="bold" font-size="15" fill="${COLORS.gold}">SAVUNMA DERİNLİĞİ · GÜVENLİK POLİTİKALARI</text>
    <text x="172" y="236" font-family="Noto Sans" font-weight="bold" font-size="38" fill="${COLORS.navyDark}">Wildcard CORS yok — Kullanıcı verisi ve oturum korunur</text>

    ${cardsSvg}

    <!-- Right-side Geometric Security Lock Matrix (sharp 0px) -->
    <g opacity="${panelReveal.toFixed(3)}">
      <rect x="1256" y="296" width="528" height="490" fill="${COLORS.navyDark}" stroke="${COLORS.navy}" stroke-width="2"/>
      <rect x="1256" y="296" width="528" height="8" fill="${COLORS.gold}"/>

      <!-- Geometric padlock icon (pure sharp lines/rects) -->
      <rect x="1474" y="346" width="92" height="58" fill="none" stroke="${COLORS.tealBright}" stroke-width="3"/>
      <rect x="1456" y="404" width="128" height="96" fill="${COLORS.navy}" stroke="${COLORS.goldBright}" stroke-width="2.5"/>
      <rect x="1514" y="438" width="12" height="28" fill="${COLORS.goldBright}"/>

      <rect x="1296" y="534" width="448" height="58" fill="${COLORS.gold}"/>
      <text x="1520" y="572" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="26" fill="${COLORS.navyDark}">Wildcard CORS yok</text>

      <text x="1520" y="636" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="24" fill="#FFFFFF">Kullanıcı verisi ve</text>
      <text x="1520" y="670" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="24" fill="${COLORS.tealBright}">oturum korunur</text>

      <line x1="1296" y1="708" x2="1744" y2="708" stroke="${COLORS.navyMid}" stroke-width="1.5"/>
      <text x="1520" y="748" text-anchor="middle" font-family="JetBrains Mono" font-size="14" fill="#B6C6D6">Access-Control-Allow-Origin: * YASAK</text>
    </g>

    <!-- Bottom summary bar -->
    <rect x="136" y="822" width="1648" height="94" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <rect x="136" y="822" width="8" height="94" fill="${COLORS.teal}"/>
    <text x="172" y="862" font-family="Noto Sans" font-weight="bold" font-size="22" fill="${COLORS.navyDark}">Doğrulanmış İstemci Politikası</text>
    <text x="172" y="894" font-family="JetBrains Mono" font-size="15" fill="${COLORS.muted}">401 session_required  ·  403 cors_origin_not_allowed  ·  428 explicit_user_confirmation_required</text>
  </g>`;
}

// =====================================================================
// SCENE 5 (21.0s - 26.0s): Clean Aegis Gözcü Console (Honest Empty States)
// =====================================================================
function renderScene5(time) {
  const localT = time - 21.0; // 0..5s
  const fade = smoothstep(localT / 0.5);
  const p1 = smoothstep((localT - 0.35) / 0.55);
  const p2 = smoothstep((localT - 0.85) / 0.55);
  const p3 = smoothstep((localT - 1.35) / 0.55);

  const sidebarItems = [
    { label: 'Durum Özeti', active: false },
    { label: 'Bağlı Cihazlar', active: false },
    { label: 'Cihaz Ağı', active: true },
    { label: 'Güvenlik Olayları', active: true },
    { label: 'Tanılama', active: true },
    { label: 'Onaylı İşlemler', active: false },
    { label: 'Güvenli Paylaşımlar', active: false },
  ];

  const navSvg = sidebarItems
    .map((item, idx) => {
      const y = 308 + idx * 54;
      return `<g>
        <rect x="154" y="${y}" width="248" height="44" fill="${item.active ? COLORS.navy : 'transparent'}" stroke="${item.active ? COLORS.teal : 'transparent'}" stroke-width="1"/>
        <rect x="166" y="${y + 17}" width="10" height="10" fill="${item.active ? COLORS.tealBright : COLORS.muted}"/>
        <text x="190" y="${y + 28}" font-family="Noto Sans" font-weight="${item.active ? 'bold' : 'normal'}" font-size="16" fill="${item.active ? '#FFFFFF' : '#B6C6D6'}">${esc(item.label)}</text>
      </g>`;
    })
    .join('\n');

  return `<g opacity="${fade.toFixed(3)}">
    <rect x="72" y="108" width="1776" height="892" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
    ${renderGrid(0.25)}

    <!-- Top caption bar above console frame -->
    <text x="136" y="160" font-family="JetBrains Mono" font-weight="bold" font-size="15" fill="${COLORS.teal}">AEGIS GÖZCÜ KONSOLU  ·  DÜRÜST BOŞ DURUM SÖZLEŞMESİ</text>
    <text x="1784" y="160" text-anchor="end" font-family="Noto Sans" font-weight="bold" font-size="18" fill="${COLORS.navy}">Gerçek veri yoksa sahte cihaz veya alarm üretilmez</text>

    <!-- Console Application Frame (sharp 0px) -->
    <rect x="136" y="182" width="1648" height="760" fill="${COLORS.bgLight}" stroke="${COLORS.navyDark}" stroke-width="2"/>

    <!-- Console Sidebar (#071A2B) -->
    <rect x="136" y="182" width="284" height="760" fill="${COLORS.navyDark}"/>
    ${renderAegisShield(182, 236, 40)}
    <text x="214" y="232" font-family="Noto Sans" font-weight="bold" font-size="20" fill="#FFFFFF">Aegis Gözcü</text>
    <text x="214" y="254" font-family="Noto Sans" font-size="11" fill="#B6C6D6">Kişisel Güvenlik ve Olay Merkezi</text>
    <line x1="154" y1="284" x2="402" y2="284" stroke="${COLORS.navyMid}" stroke-width="1"/>
    ${navSvg}

    <!-- Sidebar footer honest connection label -->
    <rect x="154" y="862" width="248" height="58" fill="${COLORS.navy}" stroke="${COLORS.gold}" stroke-width="1"/>
    <rect x="168" y="886" width="10" height="10" fill="${COLORS.goldBright}"/>
    <text x="188" y="897" font-family="JetBrains Mono" font-weight="bold" font-size="14" fill="${COLORS.goldBright}">Bağlantı bekleniyor</text>

    <!-- Console TopBar -->
    <rect x="420" y="182" width="1364" height="72" fill="${COLORS.surface}" stroke="${COLORS.border}" stroke-width="1"/>
    <text x="454" y="226" font-family="Noto Sans" font-weight="bold" font-size="21" fill="${COLORS.navyDark}">Aegis Gözcü  /  Operasyon Görünümü</text>
    <rect x="1488" y="200" width="268" height="36" fill="${COLORS.goldSoft}" stroke="${COLORS.gold}" stroke-width="1.5"/>
    <rect x="1504" y="213" width="10" height="10" fill="${COLORS.gold}"/>
    <text x="1524" y="224" font-family="JetBrains Mono" font-weight="bold" font-size="14" fill="${COLORS.navyDark}">Bağlantı bekleniyor</text>

    <!-- Honest Banner -->
    <rect x="454" y="278" width="1298" height="74" fill="${COLORS.surface}" stroke="${COLORS.borderStrong}" stroke-width="1"/>
    <rect x="454" y="278" width="8" height="74" fill="${COLORS.gold}"/>
    <text x="484" y="310" font-family="Noto Sans" font-weight="bold" font-size="20" fill="${COLORS.navyDark}">Gerçek API bağlantısı kurulana kadar tüm modüller dürüst boş durum gösterir</text>
    <text x="484" y="336" font-family="JetBrains Mono" font-size="14" fill="${COLORS.muted}">apiConnected: false  ·  devices: []  ·  incidents: []  ·  Sahte veri kapalı</text>

    <!-- Panel 1: Cihaz Ağı -->
    <g opacity="${p1.toFixed(3)}">
      <rect x="454" y="378" width="418" height="528" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
      <rect x="454" y="378" width="418" height="48" fill="${COLORS.navy}"/>
      <text x="478" y="409" font-family="Noto Sans" font-weight="bold" font-size="19" fill="#FFFFFF">Cihaz Ağı</text>
      <text x="850" y="409" text-anchor="end" font-family="JetBrains Mono" font-size="13" fill="${COLORS.tealBright}">0 DÜĞÜM</text>

      <!-- Empty geometric grid canvas -->
      <rect x="478" y="450" width="370" height="290" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1" stroke-dasharray="6 4"/>
      <line x1="663" y1="470" x2="663" y2="720" stroke="${COLORS.border}" stroke-width="1"/>
      <line x1="498" y1="595" x2="828" y2="595" stroke="${COLORS.border}" stroke-width="1"/>
      <rect x="641" y="573" width="44" height="44" fill="${COLORS.surface}" stroke="${COLORS.borderStrong}" stroke-width="1.5"/>
      <line x1="653" y1="595" x2="673" y2="595" stroke="${COLORS.muted}" stroke-width="2"/>

      <rect x="478" y="762" width="370" height="118" fill="${COLORS.surfaceMuted}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="663" y="810" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="22" fill="${COLORS.navyDark}">Eşleşmiş cihaz yok</text>
      <text x="663" y="846" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="${COLORS.muted}">Bağlantı bekleniyor</text>
    </g>

    <!-- Panel 2: Güvenlik Olayları -->
    <g opacity="${p2.toFixed(3)}">
      <rect x="894" y="378" width="418" height="528" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
      <rect x="894" y="378" width="418" height="48" fill="${COLORS.navy}"/>
      <text x="918" y="409" font-family="Noto Sans" font-weight="bold" font-size="19" fill="#FFFFFF">Güvenlik Olayları</text>
      <text x="1290" y="409" text-anchor="end" font-family="JetBrains Mono" font-size="13" fill="${COLORS.goldBright}">0 OLAY</text>

      <!-- Clean empty table rows -->
      <rect x="918" y="450" width="370" height="36" fill="${COLORS.surfaceMuted}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="934" y="473" font-family="JetBrains Mono" font-weight="bold" font-size="12" fill="${COLORS.navy}">ZAMAN   ·   OLAY BAŞLIĞI   ·   DURUM</text>
      <rect x="918" y="486" width="370" height="254" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
      <line x1="940" y1="540" x2="1266" y2="540" stroke="${COLORS.border}" stroke-width="1"/>
      <line x1="940" y1="595" x2="1266" y2="595" stroke="${COLORS.border}" stroke-width="1"/>
      <line x1="940" y1="650" x2="1266" y2="650" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="1103" y="622" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="${COLORS.muted}">Kayıt akışı boş</text>

      <rect x="918" y="762" width="370" height="118" fill="${COLORS.surfaceMuted}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="1103" y="810" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="22" fill="${COLORS.navyDark}">Gerçek olay kaydı yok</text>
      <text x="1103" y="846" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="${COLORS.muted}">Veri yok · Gerçek API akışı bekleniyor</text>
    </g>

    <!-- Panel 3: Tanılama -->
    <g opacity="${p3.toFixed(3)}">
      <rect x="1334" y="378" width="418" height="528" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
      <rect x="1334" y="378" width="418" height="48" fill="${COLORS.navy}"/>
      <text x="1358" y="409" font-family="Noto Sans" font-weight="bold" font-size="19" fill="#FFFFFF">Tanılama</text>
      <text x="1730" y="409" text-anchor="end" font-family="JetBrains Mono" font-size="13" fill="#B6C6D6">SİSTEM</text>

      <rect x="1358" y="450" width="370" height="84" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="1378" y="482" font-family="JetBrains Mono" font-size="12" fill="${COLORS.muted}">API SAĞLIK KONTROLÜ (/healthz)</text>
      <text x="1378" y="512" font-family="Noto Sans" font-weight="bold" font-size="18" fill="${COLORS.gold}">Bağlantı bekleniyor</text>

      <rect x="1358" y="550" width="370" height="84" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="1378" y="582" font-family="JetBrains Mono" font-size="12" fill="${COLORS.muted}">OTURUM &amp; HAZIRLIK (/readyz)</text>
      <text x="1378" y="612" font-family="Noto Sans" font-weight="bold" font-size="18" fill="${COLORS.navy}">Veri yok</text>

      <rect x="1358" y="650" width="370" height="90" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
      <text x="1378" y="682" font-family="JetBrains Mono" font-size="12" fill="${COLORS.muted}">CİHAZ TELEMETRİSİ</text>
      <text x="1378" y="712" font-family="Noto Sans" font-weight="bold" font-size="18" fill="${COLORS.navy}">Eşleşmiş cihaz yok</text>

      <rect x="1358" y="762" width="370" height="118" fill="${COLORS.goldSoft}" stroke="${COLORS.gold}" stroke-width="1"/>
      <text x="1543" y="810" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="22" fill="${COLORS.navyDark}">Bağlantı bekleniyor</text>
      <text x="1543" y="846" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="${COLORS.slate}">Yanıltıcı yeşil durum yok</text>
    </g>
  </g>`;
}

// =====================================================================
// SCENE 6 (26.0s - 30.0s): User-Approved Workflow + Clean Final Hold
// =====================================================================
function renderScene6(time) {
  const localT = time - 26.0; // 0..4.0s
  // 0.0..2.35s: Workflow (Olay kartı -> Onay ekranı -> Komut kuyruğu)
  // 2.35..2.80s: Crossfade into pure final hold frame
  // 2.80..4.00s (28.8s..30.0s): Pure final hold with ONLY the 3 required lines
  const workflowFade =
    localT < 0.35
      ? smoothstep(localT / 0.35)
      : localT < 2.25
        ? 1
        : 1 - smoothstep((localT - 2.25) / 0.45);

  const finalHoldFade = smoothstep((localT - 2.4) / 0.45);

  const step2Active = localT >= 0.65;
  const step3Active = localT >= 1.35;
  const flow1 = clamp((localT - 0.3) / 0.45, 0, 1);
  const flow2 = clamp((localT - 1.0) / 0.45, 0, 1);

  const workflowSvg =
    workflowFade > 0.01
      ? `<g opacity="${workflowFade.toFixed(3)}">
          <rect x="72" y="108" width="1776" height="892" fill="${COLORS.bgLight}" stroke="${COLORS.border}" stroke-width="1"/>
          ${renderGrid(0.3)}

          <!-- Top Header -->
          <rect x="136" y="148" width="1648" height="126" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="1.5"/>
          <rect x="136" y="148" width="12" height="126" fill="${COLORS.teal}"/>
          <text x="176" y="196" font-family="JetBrains Mono" font-weight="bold" font-size="16" fill="${COLORS.teal}">ONAYLI İŞLEM AKIŞI  ·  KULLANICI KONTROLÜ</text>
          <text x="176" y="246" font-family="Noto Sans" font-weight="bold" font-size="38" fill="${COLORS.navyDark}">Olay kartı  →  Onay ekranı  →  Komut kuyruğu</text>

          <!-- Step 1: Olay kartı -->
          <rect x="136" y="346" width="460" height="390" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="2"/>
          <rect x="136" y="346" width="460" height="10" fill="${COLORS.navyDark}"/>
          <rect x="166" y="382" width="110" height="28" fill="${COLORS.navyDark}"/>
          <text x="221" y="401" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="13" fill="#FFFFFF">ADIM 01</text>
          <text x="166" y="458" font-family="Noto Sans" font-weight="bold" font-size="32" fill="${COLORS.navyDark}">Olay kartı</text>
          <text x="166" y="494" font-family="Noto Sans" font-size="17" fill="${COLORS.slate}">Gerçek güvenlik olayı incelenir</text>
          <rect x="166" y="528" width="400" height="172" fill="${COLORS.surfaceMuted}" stroke="${COLORS.border}" stroke-width="1"/>
          <text x="188" y="564" font-family="JetBrains Mono" font-weight="bold" font-size="14" fill="${COLORS.navy}">DURUM: İNCELEME BEKLİYOR</text>
          <text x="188" y="602" font-family="Noto Sans" font-size="16" fill="${COLORS.slate}">Cihaz ve olay bütünlük özeti doğrulandı.</text>
          <text x="188" y="634" font-family="Noto Sans" font-size="16" fill="${COLORS.slate}">Otomatik sessiz komut tetiklenmez.</text>
          <text x="188" y="676" font-family="JetBrains Mono" font-size="13" fill="${COLORS.muted}">explicit_user_confirmation: false</text>

          <!-- Arrow 1 -> 2 -->
          <line x1="596" y1="541" x2="714" y2="541" stroke="${COLORS.border}" stroke-width="4"/>
          <line x1="596" y1="541" x2="${lerp(596, 714, flow1).toFixed(1)}" y2="541" stroke="${COLORS.teal}" stroke-width="4"/>
          <polygon points="712,532 728,541 712,550" fill="${flow1 > 0.7 ? COLORS.teal : COLORS.borderStrong}"/>

          <!-- Step 2: Onay ekranı -->
          <rect x="730" y="346" width="460" height="390" fill="${COLORS.surface}" stroke="${step2Active ? COLORS.gold : COLORS.borderStrong}" stroke-width="${step2Active ? '2.5' : '1.5'}"/>
          <rect x="730" y="346" width="460" height="10" fill="${COLORS.gold}"/>
          <rect x="760" y="382" width="110" height="28" fill="${COLORS.gold}"/>
          <text x="815" y="401" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="13" fill="${COLORS.navyDark}">ADIM 02</text>
          <text x="760" y="458" font-family="Noto Sans" font-weight="bold" font-size="32" fill="${COLORS.navyDark}">Onay ekranı</text>
          <text x="760" y="494" font-family="Noto Sans" font-size="17" fill="${COLORS.slate}">Kullanıcı açık biçimde onay verir</text>
          <rect x="760" y="528" width="400" height="172" fill="${COLORS.goldSoft}" stroke="${COLORS.gold}" stroke-width="1"/>
          <text x="782" y="564" font-family="Noto Sans" font-weight="bold" font-size="18" fill="${COLORS.navyDark}">İşlem onayı gerekiyor</text>
          <text x="782" y="596" font-family="Noto Sans" font-size="15" fill="${COLORS.slate}">Onay olmadan API 428 ile isteği reddeder.</text>
          <rect x="782" y="628" width="150" height="44" fill="${COLORS.surface}" stroke="${COLORS.borderStrong}" stroke-width="1.5"/>
          <text x="857" y="656" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="15" fill="${COLORS.navy}">Vazgeç</text>
          <rect x="948" y="628" width="190" height="44" fill="${step2Active ? COLORS.navyDark : COLORS.slate}"/>
          <text x="1043" y="656" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="15" fill="${COLORS.tealBright}">İşlemi onayla</text>

          <!-- Arrow 2 -> 3 -->
          <line x1="1190" y1="541" x2="1308" y2="541" stroke="${COLORS.border}" stroke-width="4"/>
          <line x1="1190" y1="541" x2="${lerp(1190, 1308, flow2).toFixed(1)}" y2="541" stroke="${COLORS.teal}" stroke-width="4"/>
          <polygon points="1306,532 1322,541 1306,550" fill="${flow2 > 0.7 ? COLORS.teal : COLORS.borderStrong}"/>

          <!-- Step 3: Komut kuyruğu -->
          <rect x="1324" y="346" width="460" height="390" fill="${COLORS.surface}" stroke="${step3Active ? COLORS.teal : COLORS.borderStrong}" stroke-width="${step3Active ? '2.5' : '1.5'}"/>
          <rect x="1324" y="346" width="460" height="10" fill="${COLORS.teal}"/>
          <rect x="1354" y="382" width="110" height="28" fill="${COLORS.teal}"/>
          <text x="1409" y="401" text-anchor="middle" font-family="JetBrains Mono" font-weight="bold" font-size="13" fill="#FFFFFF">ADIM 03</text>
          <text x="1354" y="458" font-family="Noto Sans" font-weight="bold" font-size="32" fill="${COLORS.navyDark}">Komut kuyruğu</text>
          <text x="1354" y="494" font-family="Noto Sans" font-size="17" fill="${COLORS.slate}">Denetlenebilir işlem cihaz kuyruğunda</text>
          <rect x="1354" y="528" width="400" height="172" fill="${COLORS.tealSoft}" stroke="${COLORS.teal}" stroke-width="1"/>
          <text x="1376" y="564" font-family="JetBrains Mono" font-weight="bold" font-size="15" fill="${COLORS.navyDark}">POST /v1/commands → 202 Accepted</text>
          <text x="1376" y="600" font-family="JetBrains Mono" font-size="14" fill="${COLORS.navy}">status: "queued_for_device"</text>
          <text x="1376" y="634" font-family="JetBrains Mono" font-size="14" fill="${COLORS.navy}">explicit_user_confirmation: true</text>
          <text x="1376" y="672" font-family="Noto Sans" font-weight="bold" font-size="16" fill="${COLORS.teal}">İşlem cihaz kuyruğuna alındı</text>

          <!-- Bottom status summary -->
          <rect x="136" y="790" width="1648" height="126" fill="${COLORS.navyDark}"/>
          <text x="960" y="846" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="28" fill="#FFFFFF">Kullanıcı onayı olmadan işlem yapılmaz</text>
          <text x="960" y="886" text-anchor="middle" font-family="JetBrains Mono" font-size="18" fill="${COLORS.tealBright}">Güvenli  ·  Gerçek Veri  ·  Denetlenebilir</text>
        </g>`
      : '';

  // Clean final hold frame (at 30s end hold, ONLY the 3 specified lines appear cleanly)
  const finalHoldSvg =
    finalHoldFade > 0.01
      ? `<g opacity="${finalHoldFade.toFixed(3)}">
          <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.bgLight}"/>
          ${renderGrid(0.28)}
          <rect x="310" y="300" width="1300" height="480" fill="${COLORS.surface}" stroke="${COLORS.navy}" stroke-width="2"/>
          <rect x="310" y="300" width="1300" height="10" fill="${COLORS.navyDark}"/>
          <rect x="310" y="770" width="1300" height="10" fill="${COLORS.teal}"/>

          ${renderAegisShield(960, 412, 84)}

          <text x="960" y="528" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="68" fill="${COLORS.navyDark}">Aegis Gözcü</text>
          <text x="960" y="596" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="34" fill="${COLORS.navy}">Kişisel Güvenlik ve Olay Merkezi</text>
          <line x1="560" y1="642" x2="1360" y2="642" stroke="${COLORS.border}" stroke-width="1.5"/>
          <text x="960" y="698" text-anchor="middle" font-family="Noto Sans" font-weight="bold" font-size="26" fill="${COLORS.teal}">Gerçek veriyle çalışan güvenli operasyon altyapısı</text>
        </g>`
      : '';

  return `<g>
    ${workflowSvg}
    ${finalHoldSvg}
  </g>`;
}

function renderFrameSvg(frameIdx) {
  const time = frameIdx / FPS;
  let body = '';
  let sceneIndex = 1;
  let sceneLabel = 'KÜRESEL KONUM VE MERKEZ';

  if (time < 5.0) {
    sceneIndex = 1;
    sceneLabel = 'DÜNYA → TÜRKİYE → İSTANBUL';
    body = renderScene1(time);
  } else if (time < 10.0) {
    sceneIndex = 2;
    sceneLabel = 'DİJİTAL ALTYAPI AĞ HARİTASI';
    body = renderScene2(time);
  } else if (time < 16.0) {
    sceneIndex = 3;
    sceneLabel = 'KATMANLI VERİ AKIŞI';
    body = renderScene3(time);
  } else if (time < 21.0) {
    sceneIndex = 4;
    sceneLabel = 'GÜVENLİK KATMANLARI';
    body = renderScene4(time);
  } else if (time < 26.0) {
    sceneIndex = 5;
    sceneLabel = 'AEGIS GÖZCÜ KONSOLU';
    body = renderScene5(time);
  } else {
    sceneIndex = 6;
    sceneLabel = 'ONAYLI İŞLEM AKIŞI';
    body = renderScene6(time);
  }

  // Hide top bar cleanly during final hold crossfade (after 28.4s) so final frame shows ONLY the 3 required lines
  const headerAlpha = time >= 28.35 ? 1 - smoothstep((time - 28.35) / 0.35) : 1;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.bgLight}"/>
  ${body}
  ${renderSceneHeader(time, sceneIndex, sceneLabel, headerAlpha)}
</svg>`;
}

// Subtle low-volume corporate underscore audio (WAV PCM 48kHz stereo)
// Note: Does NOT synthesize spoken speech; pairs cleanly with SRT subtitles & live browser TTS
function writeSubtleUnderscoreWav(filePath) {
  const sampleRate = 48000;
  const totalSamples = sampleRate * DURATION_SEC;
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF/WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const cueTimes = [0.1, 5.0, 10.0, 16.0, 21.0, 26.0, 28.5];
  const cueFreqs = [220, 293.66, 329.63, 392.0, 329.63, 440.0, 293.66];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const masterEnv =
      clamp(t / 1.0, 0, 1) * clamp((DURATION_SEC - t) / 1.2, 0, 1);

    // Warm D-minor/D-sus2 clean sine pad (ultra subtle -26dB)
    const pad =
      0.018 * Math.sin(2 * Math.PI * 146.83 * t) +
      0.012 * Math.sin(2 * Math.PI * 220.0 * t) +
      0.008 * Math.sin(2 * Math.PI * 329.63 * t);

    let cue = 0;
    for (let c = 0; c < cueTimes.length; c++) {
      const dt = t - cueTimes[c];
      if (dt >= 0 && dt < 0.7) {
        const env = Math.exp(-dt * 6.5) * Math.min(1, dt / 0.015);
        cue += 0.032 * env * Math.sin(2 * Math.PI * cueFreqs[c] * dt);
      }
    }

    const left = Math.max(-1, Math.min(1, (pad + cue) * masterEnv));
    const right = Math.max(-1, Math.min(1, (pad + cue * 0.96) * masterEnv));
    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(left * 32767), offset);
    buffer.writeInt16LE(Math.round(right * 32767), offset + 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function writeTurkishSrt(filePath) {
  const srt = `1
00:00:00,200 --> 00:00:05,000
Aegis Gözcü, kişisel güvenlik ve olay yönetimi için tasarlanmış
gerçek veri odaklı bir merkezdir.

2
00:00:05,000 --> 00:00:10,000
Gerçek cihaz verisi ve güvenli olay takibiyle cihazları tek merkezde buluşturur.

3
00:00:10,000 --> 00:00:16,000
Tarayıcıdan güvenli API katmanına, oradan kalıcı veritabanına uzanan mimarisiyle
cihazları, olayları ve kullanıcı kontrollü işlemleri tek bir yapıda birleştirir.

4
00:00:16,000 --> 00:00:21,000
Strict CORS, güvenli oturum çerezleri ve internal ağ izolasyonu sayesinde
kullanıcı verisi ve oturum korunur.

5
00:00:21,000 --> 00:00:26,000
Gerçek veri yoksa dürüst boş durumları korur; yanıltıcı cihaz veya alarm göstermez.

6
00:00:26,000 --> 00:00:29,800
Açık kullanıcı onayı sayesinde her işlem denetlenebilir ve güvenli biçimde yürütülür.
`;
  fs.writeFileSync(filePath, srt, 'utf8');
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  console.log(`[promo] Rendering ${TOTAL_FRAMES} SVG frames (1920x1080 @ ${FPS}fps)...`);
  const tStart = Date.now();
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const svg = renderFrameSvg(i);
    const frameFile = path.join(FRAMES_DIR, `f_${String(i).padStart(4, '0')}.svg`);
    fs.writeFileSync(frameFile, svg, 'utf8');
  }
  console.log(`[promo] SVG frames generated in ${((Date.now() - tStart) / 1000).toFixed(2)}s`);

  console.log('[promo] Generating subtle corporate underscore WAV & Turkish SRT...');
  writeSubtleUnderscoreWav(AUDIO_WAV);
  writeTurkishSrt(SRT_OUT);

  console.log('[promo] Encoding 1080p MP4 with ffmpeg...');
  const tEnc = Date.now();
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(FRAMES_DIR, 'f_%04d.svg'),
      '-i',
      AUDIO_WAV,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      '-movflags',
      '+faststart',
      MP4_OUT,
    ],
    { stdio: 'inherit' }
  );
  console.log(`[promo] MP4 encoded in ${((Date.now() - tEnc) / 1000).toFixed(2)}s -> ${MP4_OUT}`);
}

main();
