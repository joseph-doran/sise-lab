// build_twins.mjs — 쌍둥이 단지(가격 동행) 룩업 생성 (complexes.json 기반, 넓은 커버리지).
//  로직: 같은 평형군 + 현재가 ±20% 후보 중, 연도별 로그중위가의 '동행 상관(Pearson r)' 상위 5곳.
//  ※ 문턱(r≥0.95)은 '정식 쌍둥이' 배지 판정에만 쓰고, 표시는 점수 상위 5곳을 항상(없음 판정 금지).
//  출력: twins.json = { "구|동|단지명": [ {n,g,u,r,price억,strong}, ... 최대 5 ] }
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const cj = JSON.parse(fs.readFileSync(join(__dir, "complexes.json"), "utf8"));
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

const TOP = 5, MIN_OVERLAP = 5, STRONG_R = 0.95, PRICE_BAND = 0.20;
const BANDS = [16, 24, 33, 39, 49, 59, 74, 84, 99, 114, 134, 164, 200];
const nearestBand = (a) => BANDS.reduce((p, c) => (Math.abs(c - a) < Math.abs(p - a) ? c : p), BANDS[0]);
const YMIN = 2006, YMAX = 2026, NY = YMAX - YMIN + 1;

// 대표 전용 시계열(데이터 많고 84에 가까운) 선택
function rep(t) { if (!t || !t.length) return null; let best = null, bs = -1; for (const s of t) { const pts = s.slice(2).filter((v) => v > 0).length; const sc = pts * 100 - Math.abs((s[0] || 0) - 84); if (sc > bs) { bs = sc; best = s; } } return best; }

// 단지별 벡터 구성
const items = [];
for (const row of cj.c) {
  const [gi, u, nRaw, , , , , t] = row; const n = decode(nRaw);
  const s = rep(t); if (!s) continue;
  const lg = new Float64Array(NY).fill(NaN); let obs = 0, last = 0;
  for (let k = 2; k < s.length; k++) { const y = s[1] + (k - 2), v = s[k]; if (v > 0 && y >= YMIN && y <= YMAX) { lg[y - YMIN] = Math.log(v); obs++; last = v; } }
  if (obs < MIN_OVERLAP || !last) continue;
  items.push({ key: cj.gu[gi] + "|" + u + "|" + n, g: cj.gu[gi], u, n, area: s[0], band: nearestBand(s[0]), price: last, lg });
}

// 상관(공통 관측 연도) + 스프레드 표준편차
function corr(a, b) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, sd = 0, sdd = 0;
  for (let i = 0; i < NY; i++) { const x = a[i], y = b[i]; if (x === x && y === y) { n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; const d = x - y; sd += d; sdd += d * d; } }
  if (n < MIN_OVERLAP) return null;
  const cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  if (va <= 0 || vb <= 0) return null;
  const r = cov / Math.sqrt(va * vb), sstd = Math.sqrt(Math.max(0, sdd / n - (sd / n) ** 2));
  return { r, sstd };
}

// 평형군별로 묶고, 가격 정렬 후 ±20% 창에서만 비교(효율)
const byBand = new Map();
for (const it of items) { let a = byBand.get(it.band); if (!a) { a = []; byBand.set(it.band, a); } a.push(it); }
const out = {};
let covered = 0, pairs = 0, strongTot = 0;
for (const [, arr] of byBand) {
  arr.sort((x, y) => x.price - y.price);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i], lo = a.price * (1 - PRICE_BAND), hi = a.price * (1 + PRICE_BAND);
    let j = i - 1; const cand = [];
    while (j >= 0 && arr[j].price >= lo) { cand.push(arr[j]); j--; }
    let k = i + 1; while (k < arr.length && arr[k].price <= hi) { cand.push(arr[k]); k++; }
    const scored = [];
    for (const b of cand) { const c = corr(a.lg, b.lg); if (c) scored.push({ b, r: c.r, sstd: c.sstd }); }
    if (!scored.length) continue;
    scored.sort((x, y) => y.r - x.r);
    const list = scored.slice(0, TOP).map((o) => ({ n: o.b.n, g: o.b.g, u: o.b.u, r: +o.r.toFixed(3), price: +(o.b.price / 100).toFixed(1), strong: o.r >= STRONG_R && o.sstd <= 0.10 ? 1 : 0 }));
    out[a.key] = list; covered++; pairs += list.length; strongTot += list.filter((x) => x.strong).length;
  }
}
const str = JSON.stringify(out);
fs.writeFileSync(join(__dir, "twins.json"), str);
console.log(`✓ 쌍둥이 룩업(넓은): 단지 ${covered.toLocaleString()} / 대상 ${items.length.toLocaleString()} · 쌍 ${pairs.toLocaleString()}(정식 ${strongTot.toLocaleString()}) · ${(str.length / 1048576).toFixed(2)}MB`);
