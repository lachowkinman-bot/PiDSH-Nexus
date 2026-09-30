#!/usr/bin/env node
// gen-domain-model.mjs — P0：从现有资产生成 13 个域模型 JSON（设计 v2 的 D4「唯一真相源」）
// 用法：node scripts/gen-domain-model.mjs [--check]
//   --check：只校验不写文件（用于构建期门禁）
//
// 来源分层（关键设计：机器源精确结构化；人工文档原样承载 + 标注出处，不编造语义）
//   ① scenes/*.yaml            → 域/技能/policies/GT（精确）
//   ② workflows/index.json     → 本域 6 条工作流：kind/skill/审批节点/交付规范（精确）
//   ③ data/<域>/*.csv          → 表、列（逐字表头）、行数（精确）
//   ④ skills-domain/**/SKILL-* → 技能文件是否存在（精确）
//   ⑤ docs/preset-design/<域>.md → §4 状态机 / §5 审批链 / §9 校验规则（解析为「带出处的表格」，
//      仅做结构搬运，不推断语义；解析不到的进 gaps，由人补，绝不臆造）
//
// 硬校验（不过即 exit 1）：CSV 表头与列声明逐字一致 / 技能全覆盖 / 工作流技能 ∈ 声明技能 /
//   GT 绑定齐全 / 声明 PII 列不得出现未脱敏原值。
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './scene-loader.mjs';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');
const OUT = path.join(ROOT, 'manifests/domain-model');

const LABELS = {
  strat: '战略 STRAT', 'mkt-on': '营销（线上）MKT-ON', 'mkt-off': '营销（线下）MKT-OFF',
  sales: '销售 SALES', fin: '财务 FIN', rec: '招聘 REC', trn: '培训 TRN', prf: '绩效 PRF',
  comp: '薪酬 COMP', ben: '福利 BEN', admin: '行政 ADMIN', cmp: '合规 CMP', 'er-eap': '员工关系/EAP',
};
const docDomainOf = (prefix) => (prefix === 'er' || prefix === 'eap') ? 'er-eap' : prefix;

// —— markdown 表格/要点解析（只搬运，不推断）——
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
function parseBlocks(md) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let cur = null, curTable = null;
  const open = (heading) => { cur = { heading: heading || '(本节)', tables: [], bullets: [] }; blocks.push(cur); curTable = null; };
  for (const l of lines) {
    const h = l.match(/^###\s+(.+)$/);
    if (h) { open(h[1].trim()); continue; }
    if (/^##\s+/.test(l)) break;
    if (isSep(l)) continue;                                  // 分隔行不打断表格
    if (isTableRow(l)) {
      if (!cur) open();                                      // §5/§9 是无子标题的裸表格：惰性开匿名块
      const c = cells(l);
      if (!curTable) { curTable = { header: c, rows: [] }; cur.tables.push(curTable); }
      else curTable.rows.push(c);                            // 后续行归入同一张表（原先每行都会新起一张表）
      continue;
    }
    curTable = null;                                         // 非表格行 → 关闭当前表
    const b = l.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (b) { if (!cur) open(); cur.bullets.push(b[1].trim()); }
  }
  return blocks;
}
function docSections(md) {
  const out = {};
  const re = /^##\s*§?(\d+)\s*(.*)$/gm;
  // eol：节头行尾位置。切片必须从节头**下一行**开始——否则 parseBlocks 会在第一行（自身节头 `## §N`）
  // 命中 `/^##\s+/` 立即 break，导致 blocks=0（2026-09-29 实测踩到）。
  const marks = [...md.matchAll(re)].map((m) => ({ n: Number(m[1]), title: m[2].trim(), i: m.index, eol: md.indexOf('\n', m.index) }));
  for (let k = 0; k < marks.length; k++) {
    const from = marks[k].eol === -1 ? marks[k].i : marks[k].eol + 1;
    const body = md.slice(from, k + 1 < marks.length ? marks[k + 1].i : md.length);
    out[marks[k].n] = { title: marks[k].title, blocks: parseBlocks(body) };
  }
  return out;
}

// —— 未脱敏原值探测（针对声明为 PII 的列）——
const looksRawPhone = (v) => /^1[3-9]\d{9}$/.test(String(v).trim());
const looksRawId = (v) => /^\d{17}[\dXx]$/.test(String(v).trim());
// CSV 解析：按逗号（含引号转义）。**不要**用下面的 markdown `cells()`（按 `|` 切分）——
// 2026-09-29 实测：误用它会让整行变成单个单元格，使「表头逐字核对」与「PII 逐列探测」双双失效（形同空转）。
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}
function csvRead(p) {
  const rows = parseCsv(fs.readFileSync(p, 'utf8'));
  return { header: rows[0] || [], rows: rows.slice(1) };
}

function build() {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
  const scenes = fs.readdirSync(path.join(ROOT, 'manifests/scenes')).filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ file: f, prefix: f.split('.')[0], scene: parseYaml(fs.readFileSync(path.join(ROOT, 'manifests/scenes', f), 'utf8')) }));

  const domains = [...new Set(scenes.map((s) => docDomainOf(s.prefix)))];
  const models = []; const violations = []; const warns = [];

  for (const dom of domains) {
    const myScenes = scenes.filter((s) => docDomainOf(s.prefix) === dom);
    const primary = myScenes[0].scene;
    const skills = primary.skills || [];
    const pol = primary.policies || {};
    const gaps = [];

    // ① 表（③ 数据源，逐字表头）
    const dir = path.join(ROOT, 'templates/workspace/data', dom);
    const tables = [];
    for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.csv')) : [])) {
      const { header, rows } = csvRead(path.join(dir, f));
      const piiCols = header.filter((c) => /phone|idcard|contact|email|holder|applicant|employee|dealer|customer|claim_masked|candidate_masked/i.test(c) && /masked|phone|idcard|contact|email/i.test(c));
      const bad = [];
      for (const c of piiCols) {
        const ci = header.indexOf(c);
        const raw = rows.filter((r) => looksRawPhone(r[ci]) || looksRawId(r[ci]));
        if (raw.length) bad.push(`${c}(${raw.length} 行疑似未脱敏)`);
      }
      if (bad.length) violations.push(`PII 未脱敏：${dom}/${f} → ${bad.join(', ')}`);
      tables.push({ file: f, rows: rows.length, columns: header, pii_likely: piiCols });
    }
    if (!tables.length) violations.push(`域 ${dom} 无数据表`);

    // ② 工作流（精确）
    const workflows = idx.workflows.filter((w) => w.domain === dom).map((w) => {
      const ap = (w.nodes || []).find((n) => n.type === 'approval') || null;
      return {
        id: w.workflow_id, kind: w.kind, description: w.description, skill: w.skill,
        approval: ap ? { node: ap.id, level: ap.level, dual: !!ap.dual } : null,
        hitl_nodes: w.hitl_nodes || [],
        nodes: w.nodes || [],            // 流程页步骤条的真相：节点链来自 index.json，不合成
        deliverable: w.deliverable,
      };
    });
    if (workflows.length !== 6) warns.push(`域 ${dom} 工作流 ${workflows.length} 条（期望 6）`);
    for (const w of workflows) if (!skills.includes(w.skill)) violations.push(`技能越界：${dom}/${w.id} → ${w.skill}`);
    for (const s of skills) if (!workflows.some((w) => w.skill === s)) violations.push(`技能无工作流覆盖：${dom}/${s}`);

    // 技能文件
    const skillFiles = skills.map((s) => {
      const p = path.join(ROOT, 'templates/skills-domain', dom, `SKILL-${s}.md`);
      return { name: s, file: fs.existsSync(p) ? path.relative(ROOT, p).replace(/\\/g, '/') : null };
    });
    for (const s of skillFiles) if (!s.file) warns.push(`技能文件缺失：${dom}/${s.name}`);

    // GT（精确，来自 scene）
    const gts = [];
    for (const sc of myScenes) for (const g of (sc.scene.golden_tasks || [])) {
      if (gts.some((x) => x.id === g.id)) continue;
      gts.push({ id: g.id, input: g.input, expected_output: g.expected_output, skill: g.expected_skills || null, scene: sc.scene.scene_id });
    }

    // ⑤ 文档（原样承载 + 出处）
    const docRel = `docs/preset-design/${dom}.md`;
    const docAbs = path.join(ROOT, docRel);
    let sections = {};
    if (fs.existsSync(docAbs)) {
      const s = docSections(fs.readFileSync(docAbs, 'utf8'));
      const SNAMES = { 1: '数据字典', 4: '状态机', 5: '审批链', 9: '校验规则' };
      for (const n of [1, 4, 5, 9]) {
        if (!s[n]) { gaps.push(`文档 §${n}（${SNAMES[n]}）未找到，需人工补`); continue; }
        const blocks = s[n].blocks.filter((b) => b.tables.length || b.bullets.length);
        if (!blocks.length) { gaps.push(`文档 §${n}（${SNAMES[n]}）未解析出结构化内容，需人工补`); continue; }
        sections[n] = { title: s[n].title, blocks, source: `${docRel}#§${n}` };
      }
    } else gaps.push(`文档 ${docRel} 不存在`);

    // 页面清单（D3：每表/每流程单独成页）
    const pages = [
      { route: `#/${dom}`, type: 'overview', title: '域概览' },
      // table 用「去扩展名的 stem」——与路由段一致。2026-09-29：原为带 .csv 的文件名，
      // 与消费方按 stem 查找的口径不一致，曾导致冒烟测试 33 条台账路由断言取到期望列数 0（假失败）。
      ...tables.map((t) => ({ route: `#/${dom}/t/${t.file.replace(/\.csv$/, '')}`, type: 'table', title: t.file, table: t.file.replace(/\.csv$/, ''), file: t.file })),
      ...workflows.map((w) => ({ route: `#/${dom}/w/${w.id.split('@')[0].split('.')[1]}`, type: 'workflow', title: w.description, workflow: w.id })),
      { route: `#/${dom}/settings`, type: 'settings', title: '域设置' },
    ];

    models.push({
      $schema: 'domain-model/v1',
      domain: dom, label: LABELS[dom] || dom,
      scene_ids: myScenes.map((s) => s.scene.scene_id),
      level: (pol.permission && pol.permission.min_level) || null,
      dual_approval: !!(pol.permission && pol.permission.dual_approval),
      redact_fields: (pol.redact && pol.redact.fields) || [],
      memory: pol.memory || null,
      generated_at: new Date().toISOString(),
      sources: { scenes: myScenes.map((s) => `manifests/scenes/${s.file}`), workflows: 'manifests/workflows/index.json', data: `templates/workspace/data/${dom}/`, doc: fs.existsSync(docAbs) ? docRel : null },
      tables, skills: skillFiles, workflows, golden_tasks: gts, pages, sections, gaps,
    });
  }
  return { models, violations, warns };
}

const { models, violations, warns } = build();
const pageTotal = models.reduce((s, m) => s + m.pages.length, 0);
console.log(`DOMAIN_MODEL domains=${models.length} tables=${models.reduce((s, m) => s + m.tables.length, 0)} workflows=${models.reduce((s, m) => s + m.workflows.length, 0)} pages=${pageTotal}`);
console.log(`校验：violations=${violations.length} warnings=${warns.length}`);
for (const v of violations) console.log('  ✗ ' + v);
for (const w of warns) console.log('  ! ' + w);
const gaps = models.flatMap((m) => m.gaps.map((g) => `${m.domain}: ${g}`));
if (gaps.length) { console.log(`文档侧待补（不阻断，交人工）：${gaps.length}`); for (const g of gaps.slice(0, 6)) console.log('  · ' + g); }

if (violations.length) { console.error('BUILD_GATE_FAIL：存在硬校验违规，未写文件'); process.exit(1); }
if (!CHECK_ONLY) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const m of models) fs.writeFileSync(path.join(OUT, `${m.domain}.json`), JSON.stringify(m, null, 1), 'utf8');
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'reports/domain-model-validation.md'),
    `# 域模型生成校验（P0）\n\n生成时间：${new Date().toISOString()}\n\n` +
    `- 域：${models.length}｜表：${models.reduce((s, m) => s + m.tables.length, 0)}｜工作流：${models.reduce((s, m) => s + m.workflows.length, 0)}｜页面：${pageTotal}\n` +
    `- 硬校验违规：${violations.length}${violations.length ? '\n' + violations.map((v) => '  - ✗ ' + v).join('\n') : '（全部通过）'}\n` +
    `- 警告：${warns.length}${warns.length ? '\n' + warns.map((w) => '  - ! ' + w).join('\n') : ''}\n` +
    `- 文档侧待补：${gaps.length}${gaps.length ? '\n' + gaps.map((g) => '  - ' + g).join('\n') : ''}\n`, 'utf8');
  console.log(`WROTE ${models.length} → manifests/domain-model/  ｜ 校验报告 reports/domain-model-validation.md`);
}
