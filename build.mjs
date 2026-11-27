// build.mjs — 김팀장의 시세랩(서비스) 대시보드 빌드
//  개인용 '아파트 시세 트래킹'의 국토부 기반 산출물을 슬림 가공해 대시보드.template.html에 주입 → 대시보드.html
//  ⚠️ 국토부 공개 실거래 데이터만 사용(네이버 호가·분양권·수급지수 제외 → 공개 재배포 안전)
//  실행: node build.mjs
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dir, "..", "아파트 시세 트래킹");         // 개인용 프로젝트(데이터 원천)
const TEMPLATE = join(__dir, "대시보드.template.html");
const OUT = join(__dir, "app.html");

const readJson = (p) => existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;

// 1) 단지 리포트(국토부 단지×평형 10년 중위가) — 필요한 필드만 슬림(호가·순위·쌍둥이 배열 제거)
const cr = readJson(join(SRC, "complex_report.json")) || { rows: [] };
const reports = (cr.rows || []).map((r) => ({
  r: r.r, u: r.u, n: r.n, a: r.a, y0: r.y0, s: r.s, c: r.c, m: r.m, d: r.d, b: r.b, h: r.h,
}));

// 2) 이달의 신고가(국토부) — 월별 집계 그대로
const mh = readJson(join(SRC, "monthly_highs.json"));
const highs = mh ? { latest: mh.latest, months: mh.months, data: mh.data } : null;

// 3) 급지 사다리(국토부) — 구/시 중위·대표단지
const ld = readJson(join(SRC, "ladder_data.json"));
const ladder = ld && ld.ladder ? ld.ladder.map((x) => ({
  prov: x.prov, region: x.region, med84: x.med84, deals84: x.deals84,
  champ: x.champ ? { name: x.champ.name, price: x.champ.price } : null,
})) : [];

// 4) 분양권 단지 — ⚠️ 네이버 호가·프리미엄은 제외. 공개 안전 필드만(단지 정체성·입주예정·공급가=분양가)
const ps = readJson(join(SRC, "presale_data.json"));
const presale = ps && ps.complexes ? ps.complexes.map((c) => {
  const hist = (c.history || []);
  const last = hist.length ? hist[hist.length - 1] : null; // 최신 회차(공급가·입주예정만 사용)
  return {
    n: c.name, r: c.region, prov: c.prov,
    moveIn: last ? last.move_in : null,
    supply: last ? (last.supply_price_avg || null) : null, // 공급가(공개 분양정보)
    size: last ? (last.size || null) : null,
  };
}).filter((x) => x.n) : [];

// 5) 지도 핀 — ⚠️ 좌표·단지명만(호가 미포함). 카카오 지도 표시용. 클릭 시 국토부 리포트로.
const ad = readJson(join(SRC, "apartment_data.json")) || [];
const seen = {};
const pins = [];
for (const d of ad) {
  if (!d.lat || !d.lng) continue;
  const key = d.complex_name + "|" + (d.region2 || "");
  if (seen[key]) continue; seen[key] = 1;
  pins.push({ n: d.complex_name, r: d.region2 || d.region1 || "", lat: +d.lat, lng: +d.lng });
}
// 분양권 단지 좌표도 핀에 포함(위치 정보는 공개)
if (ps && ps.complexes) for (const c of ps.complexes) {
  if (!c.lat || !c.lng) continue;
  const key = c.name + "|ps";
  if (seen[key]) continue; seen[key] = 1;
  pins.push({ n: c.name, r: c.region || "", lat: +c.lat, lng: +c.lng, ps: 1 });
}

// 카카오 지도 JavaScript 키(도메인 제한 공개키) — 개인용 프로젝트의 .kakao_map_key 재사용
const kakaoKey = existsSync(join(SRC, ".kakao_map_key")) ? readFileSync(join(SRC, ".kakao_map_key"), "utf8").replace(/^﻿/, "").trim() : "";

const payload = {
  generated: cr.generated || (mh && mh.generated) || "",
  peakYear: cr.peakYear || "2021",
  reports, highs, ladder, presale, pins, kakaoKey,
};

const tpl = readFileSync(TEMPLATE, "utf8");
if (!tpl.includes("__SVC_DATA__")) { console.error("템플릿에 __SVC_DATA__ 가 없습니다."); process.exit(1); }
const html = tpl.replace("__SVC_DATA__", JSON.stringify(payload).replace(/</g, "\\u003c"));
writeFileSync(OUT, html);

const kb = Math.round(statSync(OUT).size / 1024);
console.log(`✓ 대시보드.html 생성 (${kb}KB) · 단지×평형 ${reports.length.toLocaleString()} · 신고가 ${highs ? highs.months.length + "개월" : "없음"} · 급지 ${ladder.length}곳 · 분양권 ${presale.length}단지 · 지도핀 ${pins.length} · 카카오키 ${kakaoKey ? "O" : "X"}`);
console.log("  (국토부 공개 실거래만 · 호가·분양권·수급 제외)");
