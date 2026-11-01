#!/usr/bin/env node
/**
 * tools/offline-package.mjs — AI Game Developer（Unity-MCP）离线包与更新检查
 *
 * 三个子命令：
 *   check    比对「上游最新 / 本地 vendor 离线包 / 项目已装」三层版本，给出该不该更新
 *   fetch    下载插件 tarball + GameDev-MCP-Server zip 到 vendor/，校验 SHA256，写 vendor/manifest.json
 *   install  把 tarball 复制到 <工程>/UnityMcpOffline/ 并写相对 Packages 的 file: 依赖（--vendor bridge 则写插件目录绝对路径）
 *
 * 网络策略（实测）：
 *   - OpenUPM / npm registry 直连可达 → 插件 tarball 与版本查询优先直连，失败再走代理。
 *   - GitHub（Server zip、SHA256SUMS、release API）直连不通 → 必须走代理；代理从
 *     --proxy / 环境变量 HTTPS_PROXY 取，脚本会补 NODE_USE_ENV_PROXY=1（Node 24 的
 *     全局 fetch 默认不读 *_PROXY，实测设了等于没设）。
 *
 * 无第三方依赖，Node 24。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
const VENDOR_DIR = path.join(PLUGIN_ROOT, 'vendor');
const VENDOR_MANIFEST = path.join(VENDOR_DIR, 'manifest.json');

const PKG_ID = 'com.ivanmurzak.unity.mcp';
const PLUGIN_REPO = 'IvanMurzak/Unity-MCP';
const SERVER_REPO = 'IvanMurzak/GameDev-MCP-Server';
const CLI_NPM = 'unity-mcp-cli';
const OPENUPM = 'https://package.openupm.com';

/* ------------------------------------------------------------------ 参数 */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-proxy') { out.noProxy = true; continue; }
    const flag = ['proxy', 'project', 'plugin-version', 'server-version', 'rid', 'cli-version', 'out', 'vendor'].find(f => a === `--${f}`);
    if (flag) { out[flag] = argv[++i]; continue; }
    if (a === '--json') { out.json = true; continue; }
    if (a === '--force') { out.force = true; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a.startsWith('--')) { fail(`未知参数: ${a}`); }
    out._.push(a);
  }
  return out;
}
function fail(msg) { console.error(`ERROR: ${msg}`); process.exit(1); }
function usage() {
  console.log(`用法:
  node tools/offline-package.mjs check   [--project <Unity工程>] [--cli-version <v>] [--json]
  node tools/offline-package.mjs fetch   [--plugin-version <v>] [--server-version <v>] [--rid <rid>] [--proxy <url>] [--force]
  node tools/offline-package.mjs install [--project <Unity工程>] [--vendor project|bridge] [--dry-run]

--vendor project（默认）把 tarball 复制到 <工程>/UnityMcpOffline/ 并写相对路径（可移植）；
--vendor bridge 沿用旧行为，写 <插件目录>/vendor/ 的绝对 file: 路径。

vendor/ 目录: ${VENDOR_DIR}`);
  process.exit(0);
}

/* ------------------------------------------------------------------ 代理 */
/**
 * 网络策略（实测 2026-10-30）：undici 的 global fetch 按请求读 env，所以进程内切换
 * *_PROXY 是有效的；但 Node 24 默认不读，必须先设 NODE_USE_ENV_PROXY=1。
 * 代理来源：--proxy > 环境变量 HTTPS_PROXY/HTTP_PROXY。没有代理就全程直连。
 */
let PROXY = null;
function setProxyMode(on) {
  if (on && PROXY) {
    for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) process.env[k] = PROXY;
    process.env.NODE_USE_ENV_PROXY = '1';
  } else {
    for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete process.env[k];
  }
}
function applyProxy(args) {
  PROXY = args.noProxy ? null : (args.proxy || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || null);
  setProxyMode(!!PROXY);
  return PROXY || '(direct)';
}
/** 先按 preferProxy 选模式跑，失败再换另一种（代理/直连互为兜底）。 */
async function withNetRetry(label, fn, preferProxy = true) {
  const order = PROXY ? (preferProxy ? [true, false] : [false, true]) : [false];
  let last;
  for (const useProxy of order) {
    setProxyMode(useProxy);
    try { return await fn(); } catch (e) {
      last = e;
      console.log(`  ${label}: ${useProxy ? '代理' : '直连'}失败 → ${e.message}`);
    }
  }
  throw last;
}

/* ------------------------------------------------------------------ HTTP */
async function get(url, { timeoutMs = 30_000, accept } = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'dsh-unity-mcp-bridge/offline-package', ...(accept ? { Accept: accept } : {}) },
  });
  return res;
}
async function getJson(url, timeoutMs = 15_000) {
  const res = await get(url, { timeoutMs, accept: 'application/json' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** 带退避重试的下载；每次失败保留 .part，下次续传。 */
async function download(url, dest, { timeoutMs = 300_000, attempts = 4 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await downloadOnce(url, dest, { timeoutMs });
    } catch (e) {
      lastErr = e;
      if (i < attempts) {
        process.stderr.write(`  第 ${i}/${attempts} 次失败: ${e.message}（${2 * i}s 后续传重试）\n`);
        await new Promise(r => setTimeout(r, 2000 * i));
      }
    }
  }
  throw lastErr;
}

async function downloadOnce(url, dest, { timeoutMs = 300_000 } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  let start = fs.existsSync(part) ? fs.statSync(part).size : 0;
  const headers = start ? { Range: `bytes=${start}-` } : {};
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
  if (start && res.status === 416) { // part 已完整或无效 → 重来
    fs.rmSync(part); start = 0;
    return download(url, dest, { timeoutMs });
  }
  if (!res.ok && res.status !== 206) throw new Error(`${url} → HTTP ${res.status}`);
  if (start && res.status !== 206) { fs.rmSync(part); start = 0; } // 服务端不支持 Range
  const totalHeader = res.headers.get('content-range') || res.headers.get('content-length');
  const total = res.status === 206 ? Number(String(totalHeader).split('/')[1]) : start + Number(res.headers.get('content-length') || 0);
  const fh = fs.openSync(part, start ? 'a' : 'w');
  let done = start;
  try {
    for await (const chunk of res.body) {
      fs.writeSync(fh, chunk);
      done += chunk.length;
      if (done - start === 0 || done % (2 * 1024 * 1024) < chunk.length) {
        process.stderr.write(`  ${path.basename(dest)}: ${done} / ${total || '?'} B\n`);
      }
    }
  } finally { fs.closeSync(fh); }
  if (total && done !== total) throw new Error(`${path.basename(dest)}: 下载不完整 ${done}/${total}（保留 .part，可重跑续传）`);
  fs.renameSync(part, dest);
  return dest;
}

function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

/* ------------------------------------------------- tarball 内取文件（无依赖） */
/** 从 .tgz 里按名字正则取第一个成员的内容（ustar，512B 头）。 */
function tarEntry(tgzPath, nameRe) {
  const buf = zlib.gunzipSync(fs.readFileSync(tgzPath));
  let off = 0;
  while (off + 512 <= buf.length) {
    const hdr = buf.subarray(off, off + 512);
    if (hdr.every(b => b === 0)) break;
    let name = hdr.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = hdr.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(hdr.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim(), 8) || 0;
    const dataOff = off + 512;
    if (nameRe.test(name)) return buf.subarray(dataOff, dataOff + size).toString('utf8');
    off = dataOff + Math.ceil(size / 512) * 512;
  }
  return null;
}

/** 读插件 tarball 里 McpServerManager.ServerVersion —— 插件与 Server 的 lockstep 事实来源。 */
function pinnedServerVersion(tgzPath) {
  const src = tarEntry(tgzPath, /(^|\/)Editor\/Scripts\/McpServerManager\.cs$/);
  if (!src) return null;
  const m = /public\s+const\s+string\s+ServerVersion\s*=\s*"([^"]+)"/.exec(src);
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------ 上游 */
async function upstream() {
  const out = {};
  // 插件：OpenUPM 直连优先（实测可达），失败走 GitHub release
  try {
    out.pluginLatest = await withNetRetry('OpenUPM 插件版本', async () => {
      const j = await getJson(`${OPENUPM}/${PKG_ID}`);
      return j?.['dist-tags']?.latest ?? null;
    }, false);
  } catch {
    const rel = await withNetRetry('GitHub 插件 release', () => getJson(`https://api.github.com/repos/${PLUGIN_REPO}/releases/latest`, 20_000));
    out.pluginLatest = String(rel.tag_name || '').replace(/^v/, '');
    out.pluginSource = 'github';
  }
  const rel = await withNetRetry('GitHub Server release', () => getJson(`https://api.github.com/repos/${SERVER_REPO}/releases/latest`, 20_000));
  out.serverLatest = String(rel.tag_name || '').replace(/^v/, '');
  try {
    out.cliLatest = await withNetRetry('npm CLI 版本', async () => (await getJson(`https://registry.npmjs.org/${CLI_NPM}/latest`, 20_000)).version ?? null, false);
  } catch { out.cliLatest = null; }
  return out;
}

/* --------------------------------------------------------------- vendor */
function readVendor() {
  if (!fs.existsSync(VENDOR_MANIFEST)) return null;
  try { return JSON.parse(fs.readFileSync(VENDOR_MANIFEST, 'utf8')); } catch { return null; }
}
function writeVendor(obj) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  fs.writeFileSync(VENDOR_MANIFEST, JSON.stringify(obj, null, 2) + '\n');
}
function defaultRid() {
  if (process.platform === 'win32') return process.arch === 'arm64' ? 'win-arm64' : 'win-x64';
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'osx-arm64' : 'osx-x64';
  return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
}

/* --------------------------------------------------------------- check */
async function cmdCheck(args) {
  const proxy = applyProxy(args);
  const vendor = readVendor();
  const up = await upstream();
  const rows = [];
  const verdict = [];

  const vPlugin = vendor?.plugin?.version ?? null;
  const vServer = vendor?.server?.version ?? null;
  const pinned = vendor?.plugin?.pinnedServerVersion ?? null;
  // manifest 记了但磁盘上没有（43 MB 的 zip 不进 git/npm，profile 里的安装副本常常缺）
  const missing = [vendor?.plugin?.file, vendor?.server?.file]
    .filter(f => f && !fs.existsSync(path.join(VENDOR_DIR, f)));
  if (missing.length) verdict.push(`vendor/manifest.json 记录的包不在本地：${missing.join(', ')} → 跑 fetch 补齐（代理优先）`);

  rows.push(['plugin  com.ivanmurzak.unity.mcp', up.pluginLatest, vPlugin]);
  rows.push(['server  GameDev-MCP-Server', up.serverLatest, vServer]);
  rows.push(['cli     unity-mcp-cli', up.cliLatest, args['cli-version'] ?? null]);

  if (vPlugin && up.pluginLatest && vPlugin !== up.pluginLatest) {
    verdict.push(`插件落后：vendor ${vPlugin} → 上游 ${up.pluginLatest}；更新：node tools/offline-package.mjs fetch --plugin-version ${up.pluginLatest}`);
  }
  if (vPlugin && pinned && vServer && pinned !== vServer) {
    verdict.push(`Server 与插件不 lockstep：插件 ${vPlugin} 钉住 Server ${pinned}，vendor 里是 ${vServer}；fetch --server-version ${pinned}`);
  }
  if (vServer && up.serverLatest && vServer !== up.serverLatest) {
    verdict.push(`（信息）Server 上游已到 ${up.serverLatest}；以插件钉住的版本为准，不要单独追新`);
  }
  if (args['cli-version'] && up.cliLatest && args['cli-version'] !== up.cliLatest) {
    verdict.push(`CLI 落后：${args['cli-version']} → ${up.cliLatest}；npm install -g ${CLI_NPM}`);
  }
  if (!vendor) verdict.push('vendor/ 里没有离线包：先 node tools/offline-package.mjs fetch');

  // 项目侧
  let proj = null;
  if (args.project) {
    const m = path.join(args.project, 'Packages', 'manifest.json');
    if (!fs.existsSync(m)) fail(`不是 Unity 工程（缺 ${m}）`);
    const mj = JSON.parse(fs.readFileSync(m, 'utf8'));
    const dep = mj.dependencies?.[PKG_ID] ?? null;
    const cache = path.join(args.project, 'Library', 'PackageCache');
    const cached = fs.existsSync(cache)
      ? fs.readdirSync(cache).filter(d => d.startsWith(`${PKG_ID}@`)).map(d => d.split('@')[1]).sort().pop() ?? null
      : null;
    proj = { manifestDep: dep, packageCache: cached };
    const eff = cached ?? (dep && !/^(file:|git\+|https?:)/.test(dep) ? dep : null);
    if (eff && up.pluginLatest && eff !== up.pluginLatest) {
      verdict.push(`项目已装 ${eff}，上游 ${up.pluginLatest}：先 fetch，再 install --project <proj>（或 install-plugin --plugin-version ${up.pluginLatest}）`);
    }
    if (dep && dep.startsWith('file:')) verdict.push(`项目走本地包依赖：${dep}`);
  }

  if (args.json) {
    console.log(JSON.stringify({ proxy, upstream: up, vendor, project: proj, verdict }, null, 2));
    return;
  }
  console.log(`代理: ${proxy}`);
  console.log('\n层级                                   上游最新        本地/已装');
  for (const [k, a, b] of rows) console.log(`${k.padEnd(38)}  ${String(a ?? '?').padEnd(14)}  ${b ?? '—'}`);
  if (vendor) {
    console.log(`\nvendor: plugin ${vendor.plugin?.version} (pinned server ${vendor.plugin?.pinnedServerVersion ?? '?'}) | server ${vendor.server?.version}/${vendor.server?.rid ?? '?'} | ${vendor.generatedAt}`);
  }
  if (proj) console.log(`project: manifest 依赖 = ${proj.manifestDep ?? '（无）'} | PackageCache = ${proj.packageCache ?? '（未解析）'}`);
  console.log('\n结论:');
  if (!verdict.length) console.log('  已是最新，无需更新。');
  else verdict.forEach(v => console.log(`  - ${v}`));
}

/* --------------------------------------------------------------- fetch */
async function cmdFetch(args) {
  const proxy = applyProxy(args);
  const rid = args.rid || defaultRid();
  const up = await upstream();
  const pluginVersion = args['plugin-version'] || up.pluginLatest;
  if (!pluginVersion) fail('无法确定插件版本，请用 --plugin-version 指定');

  const vendor = readVendor() ?? {};

  console.log(`代理: ${proxy}`);
  console.log(`目标: plugin ${pluginVersion} | rid ${rid}`);

  // 1) 插件 tarball：OpenUPM 直连优先，失败走 GitHub（需代理）
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const tgz = path.join(VENDOR_DIR, `${PKG_ID}-${pluginVersion}.tgz`);
  const tgzSources = [
    `${OPENUPM}/${PKG_ID}/-/${PKG_ID}-${pluginVersion}.tgz`,
    `https://github.com/${PLUGIN_REPO}/releases/download/${pluginVersion}/${PKG_ID}-${pluginVersion}.tgz`,
  ];
  if (fs.existsSync(tgz) && !args.force) {
    console.log(`插件 tarball 已存在，跳过下载: ${path.basename(tgz)}（--force 重下）`);
  } else {
    let ok = false;
    for (const url of tgzSources) {
      try { console.log(`下载 ${url}`); await withNetRetry('插件 tarball', () => download(url, tgz), false); ok = true; break; }
      catch (e) { console.log(`  ${url} 失败: ${e.message}`); }
    }
    if (!ok) fail('插件 tarball 两个源都失败');
  }
  const pinned = pinnedServerVersion(tgz);
  console.log(`插件 tarball: ${fs.statSync(tgz).size} B, sha256 ${sha256(tgz)}`);
  console.log(`插件钉住的 Server 版本 (McpServerManager.ServerVersion): ${pinned ?? '未解析出'}`);

  const wantServer = args['server-version'] || pinned || up.serverLatest;
  const zip = path.join(VENDOR_DIR, `gamedev-mcp-server-${rid}-${wantServer}.zip`);
  const sums = path.join(VENDOR_DIR, `SHA256SUMS-${wantServer}`);
  const base = `https://github.com/${SERVER_REPO}/releases/download/v${wantServer}`;

  if (!fs.existsSync(sums) || args.force) {
    console.log(`下载 ${base}/SHA256SUMS`);
    await withNetRetry('SHA256SUMS', () => download(`${base}/SHA256SUMS`, sums), true);
  }
  const want = new Map(
    fs.readFileSync(sums, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
      const [h, n] = l.trim().split(/\s+/);
      return [n.replace(/^\*/, ''), h.toLowerCase()];
    }),
  );
  const asset = `gamedev-mcp-server-${rid}.zip`;
  const expected = want.get(asset);
  if (!expected) fail(`${asset} 不在 SHA256SUMS 里（rid 或版本不对）`);

  if (fs.existsSync(zip) && !args.force) {
    console.log(`Server zip 已存在，跳过下载: ${path.basename(zip)}（--force 重下）`);
  } else {
    console.log(`下载 ${base}/${asset}（优先代理，失败回落直连）`);
    await withNetRetry(asset, () => download(`${base}/${asset}`, zip, { timeoutMs: 900_000 }), true);
  }
  const got = sha256(zip);
  if (got !== expected) fail(`SHA256 不匹配：${got} ≠ ${expected}（删除该文件后重跑）`);
  console.log(`Server zip: ${fs.statSync(zip).size} B, sha256 校验通过 ${got}`);

  const next = {
    generatedAt: new Date().toISOString(),
    plugin: {
      packageId: PKG_ID,
      version: pluginVersion,
      file: path.basename(tgz),
      bytes: fs.statSync(tgz).size,
      sha256: sha256(tgz),
      pinnedServerVersion: pinned,
      sources: tgzSources,
    },
    server: {
      version: wantServer,
      rid,
      file: path.basename(zip),
      bytes: fs.statSync(zip).size,
      sha256: got,
      sha256sums: `${base}/SHA256SUMS`,
      verified: true,
    },
    cli: { npmPackage: CLI_NPM, expectedVersion: up.cliLatest ?? null },
    upstreamAtCheck: up,
  };
  writeVendor(next);
  console.log(`\n已写入 ${VENDOR_MANIFEST}`);
  console.log(`离线安装：node tools/offline-package.mjs install --project <Unity工程>`);
  console.log(`         unity-mcp-cli install-plugin <proj> --with-server --server-version ${wantServer} --server-source "${path.basename(zip)}"`);
}

/* ------------------------------------------------------------- install */
function cmdInstall(args) {
  const vendor = readVendor();
  if (!vendor?.plugin?.file) fail('vendor/manifest.json 缺失或没有插件条目：先 node tools/offline-package.mjs fetch');
  const tgz = path.join(VENDOR_DIR, vendor.plugin.file);
  if (!fs.existsSync(tgz)) fail(`离线包不存在: ${tgz}`);
  const actual = sha256(tgz);
  if (vendor.plugin.sha256 && actual !== vendor.plugin.sha256) fail(`离线包 sha256 与 manifest 不符: ${actual}`);

  const mode = args.vendor ?? 'project';
  if (mode !== 'project' && mode !== 'bridge') fail(`--vendor 只能是 project 或 bridge（收到 ${mode}）`);

  const proj = args.project || fail('需要 --project <Unity工程>');
  const manifestPath = path.join(proj, 'Packages', 'manifest.json');
  if (!fs.existsSync(path.join(proj, 'ProjectSettings', 'ProjectVersion.txt'))) fail(`不是 Unity 工程: ${proj}`);
  if (!fs.existsSync(manifestPath)) fail(`缺 ${manifestPath}`);

  // 默认把 tarball 复制进工程，依赖写相对 Packages 的路径（Unity 手册：本地 tarball 路径相对 Packages 文件夹）。
  // 这样 profile 重建、工程换机器都不会断；--vendor bridge 保留旧的绝对路径行为。
  const offlineDir = path.join(proj, 'UnityMcpOffline');
  const offlineTgz = path.join(offlineDir, path.basename(tgz));
  const spec = mode === 'project'
    ? `file:../UnityMcpOffline/${path.basename(tgz)}`
    : `file:${tgz.replace(/\\/g, '/')}`;

  const mj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mj.dependencies ??= {};
  const before = mj.dependencies[PKG_ID] ?? null;
  if (args.dryRun) {
    console.log(`dry-run (--vendor ${mode}): ${PKG_ID}: ${before ?? '（无）'} → ${spec}`);
    if (mode === 'project') console.log(`  复制: ${tgz} → ${offlineTgz}`);
    return;
  }

  if (mode === 'project') {
    fs.mkdirSync(offlineDir, { recursive: true });
    const same = fs.existsSync(offlineTgz) && sha256(offlineTgz) === vendor.plugin.sha256;
    if (!same) fs.copyFileSync(tgz, offlineTgz);
    const copied = sha256(offlineTgz);
    if (vendor.plugin.sha256 && copied !== vendor.plugin.sha256) fail(`工程内离线包 sha256 与 manifest 不符: ${copied}`);
    console.log(`已复制离线包到工程: ${offlineTgz}${same ? '（已存在且哈希一致，跳过复制）' : ''}`);
  }

  // 与 unity-mcp-cli 一致：补 OpenUPM 作用域注册表（插件的传递依赖 extensions.unity.* 要它）
  mj.scopedRegistries ??= [];
  let reg = mj.scopedRegistries.find(r => r.name === 'package.openupm.com');
  if (!reg) { reg = { name: 'package.openupm.com', url: OPENUPM, scopes: [] }; mj.scopedRegistries.push(reg); }
  reg.scopes ??= [];
  for (const s of ['com.ivanmurzak', 'extensions.unity']) if (!reg.scopes.includes(s)) reg.scopes.push(s);

  mj.dependencies[PKG_ID] = spec;
  const bak = `${manifestPath}.bak-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-')}`;
  fs.copyFileSync(manifestPath, bak);
  fs.writeFileSync(manifestPath, JSON.stringify(mj, null, 2) + '\n');
  console.log(`已改 ${manifestPath}`);
  console.log(`  ${PKG_ID}: ${before ?? '（无）'} → ${spec}`);
  console.log(`  备份: ${bak}`);
  console.log(`  插件版本 ${vendor.plugin.version}（钉住 Server ${vendor.plugin.pinnedServerVersion}）`);
  if (mode === 'project') {
    console.log('  提示: 依赖是相对 Packages 的路径；profile 重建/删除不会断，工程拷到别的机器也能离线解析。');
    console.log('        tarball 在工程根 UnityMcpOffline/ 下（约 1 MB），可一起提交到版本库。');
  } else {
    console.log('  提示: 依赖是插件目录的绝对路径；重建 profile / 移动工程后会失效，需要重跑 install。');
  }
  const serverZip = vendor.server?.file ? path.join(VENDOR_DIR, vendor.server.file) : null;
  if (serverZip && fs.existsSync(serverZip)) {
    console.log(`下一步：unity-mcp-cli install-plugin ${proj} --with-server --server-version ${vendor.server.version} --server-source "${serverZip}"`);
  } else {
    console.log(`⚠ 本地缺 Server zip（${vendor.server?.file ?? '未记录'}；40 MB 级二进制不进 git/npm）。先补齐再装：`);
    console.log(`  node tools/offline-package.mjs fetch --rid ${vendor.server?.rid ?? defaultRid()}   # 代理优先`);
  }
}

/* ------------------------------------------------------------------ main */
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
try {
  if (cmd === 'check') await cmdCheck(args);
  else if (cmd === 'fetch') await cmdFetch(args);
  else if (cmd === 'install') cmdInstall(args);
  else usage();
} catch (e) {
  const cause = e && e.cause ? ` (${e.cause.code || e.cause.message || ''} ${e.cause.host || ''})` : '';
  fail(`${e instanceof Error ? e.message : e}${cause}`);
}
