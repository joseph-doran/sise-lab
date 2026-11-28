// build_deals.mjs — 국토부 개별 실거래(realprice_raw)를 '구별 파일'로 분할.
//  지도 in-box에서 평형 클릭 시 해당 구 파일만 지연 로드 → 날짜별 실거래 리스트.
//  출력: deals/<구index>.json = { "법정동|단지명": { 전용round: [[yyyymmdd, 만원, 층], ... 최근 N] } }
//  구 index는 complexes.json의 gu 배열 순서와 동일.
import fs from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.APT_SRC || join(__dir, "..", "아파트 시세 트래킹");
const rawCandidates = ["realprice_raw.jsonl", "realprice_raw.bak.jsonl"].map((f) => join(SRC, f));
const RAW = rawCandidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 1e6);
if (!RAW) { console.error("✗ realprice_raw(.bak).jsonl 없음"); process.exit(1); }

const cj = JSON.parse(fs.readFileSync(join(__dir, "complexes.json"), "utf8"));
const guIdx = {}; cj.gu.forEach((g, i) => { guIdx[g] = i; });
const N = 25, CAP = 90;           // 평형별 최근 N건 보존, 중간 트림 임계 CAP
const shards = new Map();         // gi → { "umd|apt": { area: [[d,man,fl],...] } }
let total = 0, kept = 0, skipRegion = 0;

const rl = readline.createInterface({ input: fs.createReadStream(RAW, "utf8"), crlfDelay: Infinity });
const trim = (arr) => { arr.sort((a, b) => b[0] - a[0]); if (arr.length > N) arr.length = N; return arr; };

rl.on("line", (line) => {
  if (!line) return; let o; try { o = JSON.parse(line); } catch (e) { return; }
  total++;
  const gi = guIdx[o.region]; if (gi == null) { skipRegion++; return; }
  const area = Math.round(o.area); if (!area) return;
  const d = +String(o.date).replace(/-/g, ""); if (!d) return;
  const man = Math.round(o.amount / 10000);
  const fl = o.floor | 0;
  let shard = shards.get(gi); if (!shard) { shard = {}; shards.set(gi, shard); }
  const k = o.umd + "|" + o.apt;
  let sub = shard[k]; if (!sub) { sub = {}; shard[k] = sub; }
  let arr = sub[area]; if (!arr) { arr = []; sub[area] = arr; }
  arr.push([d, man, fl]);
  if (arr.length > CAP) trim(arr);
});

rl.on("close", () => {
  const outDir = join(__dir, "deals");
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let files = 0, bytes = 0;
  for (const [gi, shard] of shards) {
    for (const k in shard) for (const a in shard[k]) { trim(shard[k][a]); kept += shard[k][a].length; }
    const s = JSON.stringify(shard);
    fs.writeFileSync(join(outDir, gi + ".json"), s);
    files++; bytes += s.length;
  }
  console.log(`✓ 실거래 분할 완료: ${total.toLocaleString()}건 읽음 · 보존 ${kept.toLocaleString()}건 · 구파일 ${files}개 (${(bytes / 1048576).toFixed(1)}MB) · 구밖 스킵 ${skipRegion.toLocaleString()}`);
});
