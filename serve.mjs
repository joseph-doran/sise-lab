// serve.mjs — 김팀장의 시세랩 로컬 서버
//  카카오 지도는 file:// 에선 도메인 제한에 걸립니다. 로컬 http 주소로 열어야 보입니다.
//  실행: node serve.mjs   →  http://localhost:5500/대시보드_소개.html
//  카카오 개발자센터에 http://localhost:5500 을 'JavaScript SDK 도메인'과 '플랫폼>Web 사이트 도메인'에 등록하세요.
import { createServer } from "node:http";
import { readFile } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT = 5500;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = join(__dir, p);
  readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 Not Found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`▶ 김팀장의 시세랩 로컬 서버: http://localhost:${PORT}/대시보드_소개.html`);
  console.log(`  카카오 지도를 보려면 http://localhost:${PORT} 를 카카오 도메인에 등록하세요.`);
});
