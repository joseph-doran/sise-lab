// build_twins.mjs — 쌍둥이 단지(가격 동행) 슬림 룩업 생성.
//  twins_data.json(band별 topNeighbors: 상관 r, 가격레벨 유사도 sstd)을 단지키 → 상위 쌍둥이로 병합.
//  출력: twins.json = { "구|동|단지명": [ {n,g,u,r,price억}, ... 최대 6 ] }
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.APT_SRC || join(__dir, "..", "아파트 시세 트래킹");
const td = JSON.parse(fs.readFileSync(join(SRC, "twins_data.json"), "utf8"));

const map = new Map(); // srcKey → Map(dstKey → {n,g,u,r,price})
for (const band in td.bands) {
  const b = td.bands[band], cx = b.complexes, tn = b.topNeighbors;
  if (!cx || !tn) continue;
  for (let i = 0; i < tn.length; i++) {
    const src = cx[i]; if (!src) continue;
    let m = map.get(src.key); if (!m) { m = new Map(); map.set(src.key, m); }
    for (const nb of tn[i] || []) {
      const dst = cx[nb.j]; if (!dst || dst.key === src.key) continue;
      const prev = m.get(dst.key);
      if (!prev || nb.r > prev.r) m.set(dst.key, { n: dst.apt, g: dst.region, u: dst.umd, r: +nb.r.toFixed(3), price: +(dst.price / 1e8).toFixed(1) });
    }
  }
}
const out = {};
let tot = 0;
for (const [k, m] of map) {
  const arr = [...m.values()].sort((a, b) => b.r - a.r).slice(0, 5);
  if (arr.length) { out[k] = arr; tot += arr.length; }
}
const s = JSON.stringify(out);
fs.writeFileSync(join(__dir, "twins.json"), s);
console.log(`✓ 쌍둥이 룩업: 단지 ${Object.keys(out).length.toLocaleString()} · 쌍 ${tot.toLocaleString()} · ${(s.length / 1048576).toFixed(2)}MB`);
