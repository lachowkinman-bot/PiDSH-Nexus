#!/usr/bin/env node
// gt-runner.mjs — U10 场景/工作流 Golden Task 执行器（015 v2.2 §8.5 / §15.4）
// 职责：① Scene 八元组 schema lint；② GT → 语义技能 → 工作流 绑定；③ 经 pi 引擎真实执行并落产物；
//       ④ 技能一致性断言（实际执行技能 ∈ scene 声明技能；EAP 域必须 eap-referral）；
//       ⑤ 审计 engine.run / gt.run。
// 用法：
//   node scripts/gt-runner.mjs --lint                       # 八元组 + 技能一致性静态检查
//   node scripts/gt-runner.mjs --plan                       # 打印 GT↔技能↔工作流 绑定表
//   node scripts/gt-runner.mjs --run [--domain ER] [--only GT-FIN-01] [--limit N] [--model M]
//   node scripts/gt-runner.mjs --report                     # 汇总 gt-results.csv → 报告 + 一致性表
// 引擎：pi（--provider deepseek --model <M> --api-key <env DEEPSEEK_API_KEY>），成功判据为**模型级**
//       （stopReason=stop 且 totalTokens>0 且正文非空），不用"进程退出码 0"（后者在 401 时同样为 0）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseYaml } from './scene-loader.mjs';

const ROOT = process.cwd();
const SCENES_DIR = path.join(ROOT, 'manifests/scenes');
const WF_DIR = path.join(ROOT, 'manifests/workflows');
const AUDIT_DIR = path.join(ROOT, 'templates/workspace/audit');
const REPORTS = path.join(ROOT, 'reports');
const RESULTS_CSV = path.join(REPORTS, 'gt-results.csv');
const CONSIST_CSV = path.join(REPORTS, 'gt-skill-consistency.csv');

// 八元组（015 §8.5：必填）
const OCTET = ['input', 'expected_plan', 'expected_tools', 'expected_permission', 'expected_output', 'expected_files', 'expected_audit', 'expected_quality'];

// GT → 语义技能：U10 §15.4 要求"实际执行技能 vs scene 声明技能逐一比对"，
// 故此表为显式人工语义绑定（非按序轮转），并断言其值 ∈ 该 scene 声明技能。
const GT_SKILL = {
  'GT-ADMIN-01': 'purchase-compare', 'GT-ADMIN-02': 'asset-inventory', 'GT-ADMIN-03': 'meeting-minutes',
  'GT-BEN-01': 'plan-compare', 'GT-BEN-02': 'checkup-report', 'GT-BEN-03': 'flex-benefit',
  'GT-CMP-01': 'policy-checklist', 'GT-CMP-02': 'pipia-list', 'GT-CMP-03': 'evidence-pack',
  'GT-COMP-01': 'band-analysis', 'GT-COMP-02': 'payroll-recon', 'GT-COMP-03': 'compa-ratio',
  'GT-ER-01': 'offboarding-flow', 'GT-ER-02': 'offboarding-flow', 'GT-EAP-01': 'eap-referral',
  'GT-FIN-01': 'expense-precheck', 'GT-FIN-02': 'budget-analysis', 'GT-FIN-03': 'invoice-check',
  'GT-MKTOFF-01': 'event-plan', 'GT-MKTOFF-02': 'material-compliance', 'GT-MKTOFF-03': 'roi-review',
  'GT-MKTON-01': 'content-gen', 'GT-MKTON-02': 'ad-analysis', 'GT-MKTON-03': 'seo-audit',
  'GT-PRF-01': 'kpi-track', 'GT-PRF-02': 'calibration-analysis', 'GT-PRF-03': 'goal-cascade',
  'GT-REC-01': 'funnel-analysis', 'GT-REC-02': 'jd-gen', 'GT-REC-03': 'interview-summary',
  'GT-SALES-01': 'quote-calc', 'GT-SALES-02': 'win-review', 'GT-SALES-03': 'quota-dashboard',
  'GT-STRAT-01': 'strategy-decode', 'GT-STRAT-02': 'biz-analysis', 'GT-STRAT-03': 'competitor-watch',
  'GT-TRN-01': 'course-schedule', 'GT-TRN-02': 'hour-stats', 'GT-TRN-03': 'cert-expiry',
};

// 个别 GT 的**工作流**显式指定：同一技能下可能有多条工作流，交付规范与任务语义更贴合者优先。
// 例：GT-ER-02（离职面谈纪要结构化）应有的交付物是面谈纪要字段，而非离职流程记录字段。
const GT_WORKFLOW = {
  'GT-ER-02': 'er-eap.exit-interview@1.0.0',
};

const dataDomain = (prefix) => (prefix === 'er' || prefix === 'eap') ? 'er-eap' : prefix;
const csv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
function audit(event, detail) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.appendFileSync(path.join(AUDIT_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`),
    JSON.stringify({ ts: new Date().toISOString(), action: event, ...detail }) + '\n');
}

export function loadAll() {
  const out = [];
  for (const f of fs.readdirSync(SCENES_DIR).filter((x) => x.endsWith('.yaml'))) {
    const scene = parseYaml(fs.readFileSync(path.join(SCENES_DIR, f), 'utf8'));
    const prefix = f.split('.')[0];
    out.push({ file: f, prefix, dataDom: dataDomain(prefix), scene });
  }
  return out;
}
// 域内工作流（以 index.json 为准），并解析其 skill 节点
export function workflowsOf(dom) {
  const idx = JSON.parse(fs.readFileSync(path.join(WF_DIR, 'index.json'), 'utf8'));
  return idx.workflows.filter((w) => w.domain === dom);
}
export function plan() {
  const rows = [];
  for (const { file, prefix, dataDom, scene } of loadAll()) {
    for (const gt of (scene.golden_tasks || [])) {
      const skill = GT_SKILL[gt.id] || null;
      const wfs = workflowsOf(dataDom);
      // 优先取"工作流名 == 技能名"的那条（名实相符），否则取域内首个承载该技能的工作流
      const stemOf = (w) => w.workflow_id.split('@')[0].split('.')[1];
      const forced = GT_WORKFLOW[gt.id] ? wfs.find((w) => w.workflow_id === GT_WORKFLOW[gt.id]) : null;
      const wf = forced || (skill && (wfs.find((w) => stemOf(w) === skill) || wfs.find((w) => w.skill === skill))) || null;
      rows.push({
        gt_id: gt.id, scene_id: scene.scene_id, scene_file: file, domain: scene.domain, data_dom: dataDom,
        input: gt.input, skill, workflow: wf ? wf.workflow_id : null,
        skill_in_scene: skill ? (scene.skills || []).includes(skill) : false,
        eap_rule: gt.id.startsWith('GT-EAP') ? (skill === 'eap-referral') : null,
        expected_output: gt.expected_output, octet_missing: OCTET.filter((k) => gt[k] == null || gt[k] === ''),
        workflow_declared_in_scene: wf ? (scene.workflows || []).some((x) => x.endsWith(wf.workflow_id.split('@')[0] + '.yaml')) : false,
      });
    }
  }
  return rows;
}
function lint() {
  const rows = plan();
  const viol = [];
  for (const r of rows) {
    if (r.octet_missing.length) viol.push(`${r.gt_id}: 八元组缺 ${r.octet_missing.join('/')}`);
    if (!r.skill) viol.push(`${r.gt_id}: GT_SKILL 未绑定语义技能`);
    else if (!r.skill_in_scene) viol.push(`${r.gt_id}: 技能 ${r.skill} 不在 scene 声明技能内`);
    if (!r.workflow) viol.push(`${r.gt_id}: 技能 ${r.skill} 无对应工作流（技能未被工作流覆盖）`);
    if (r.eap_rule === false) viol.push(`${r.gt_id}: EAP 域未绑定 eap-referral（015 §15.4 禁止 ER 技能顶替）`);
  }
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'gt-lint.csv'), 'gt_id,scene_id,domain,octet_missing,skill,skill_in_scene,workflow\n' +
    rows.map((r) => [r.gt_id, r.scene_id, r.domain, r.octet_missing.join('|'), r.skill, r.skill_in_scene, r.workflow].map(csv).join(',')).join('\n') + '\n');
  // 同一 GT 被多 scene 声明时去重统计
  const uniq = new Map(); for (const r of rows) if (!uniq.has(r.gt_id)) uniq.set(r.gt_id, r);
  const byDom = {}; for (const r of uniq.values()) byDom[r.domain] = (byDom[r.domain] || 0) + 1;
  console.log(`LINT ${viol.length ? 'FAIL' : 'PASS'} gt_entries=${rows.length} gt_unique=${uniq.size} domains=${Object.keys(byDom).length} violations=${viol.length}`);
  for (const v of viol) console.log('  - ' + v);
  return viol.length;
}
function piRun({ key, model, prompt, skillFile, timeoutMs = 300000 }) {
  // Windows 下 pi 是 npm shim（.cmd），execFile 直呼 ENOENT、shell:true 又会破坏多行 prompt 的转义；
  // 故经 bash 调用，并把 prompt 落临时文件、key 放到子进程 env（不出现在命令行字符串里）。
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw new Error(`非法 model 名：${model}`);
  const tmpDir = path.join(ROOT, 'reports/.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const pf = path.join(tmpDir, `gt-prompt-${process.pid}-${Date.now()}.md`);
  fs.writeFileSync(pf, prompt, 'utf8');
  const rel = path.relative(ROOT, pf).replace(/\\/g, '/');
  // --skill：让引擎装载场景声明的 SKILL-<skill>.md（否则"执行技能"只是 prompt 里提了个名字）
  const skillArg = skillFile ? ` --skill "${skillFile.replace(/\\/g, '/')}"` : '';
  const cmd = `pi --provider deepseek --model ${model} --api-key "$GT_KEY" --tools read,write${skillArg} -p --mode json "$(cat "${rel}")"`;
  try {
    return execFileSync('bash', ['-lc', cmd], {
      encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, cwd: ROOT,
      env: { ...process.env, GT_KEY: key },
    });
  } finally { try { fs.unlinkSync(pf); } catch { /* 临时文件清理失败不影响判定 */ } }
}
function parsePi(stream) {
  let final = null, errors = [];
  for (const l of String(stream).trim().split(/\r?\n/)) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.type === 'message_end' && j.message && j.message.role === 'assistant' && j.message.stopReason !== 'pending') final = j.message;
    if (j.type === 'message_end' && j.message && j.message.errorMessage) errors.push(j.message.errorMessage);
  }
  return { final, errors };
}
function run(args) {
  const key = process.env.DEEPSEEK_API_KEY || '';
  const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'deepseek-v4-flash';
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const domFilter = args.includes('--domain') ? args[args.indexOf('--domain') + 1].toUpperCase() : null;
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
  if (!key) { console.error('RUN_ABORT no DEEPSEEK_API_KEY in env'); process.exit(3); }

  const seen = new Set();
  const rows = plan().filter((r) => {
    if (only && r.gt_id !== only) return false;
    if (domFilter && String(r.domain).toUpperCase() !== domFilter) return false;
    if (seen.has(r.gt_id)) return false;           // 同 GT 多 scene 声明 → 只跑一次
    seen.add(r.gt_id); return true;
  }).slice(0, limit);

  const results = [];
  let consec = 0, lastErr = '';
  for (const r of rows) {
    const t0 = Date.now();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const delivRel = `templates/workspace/deliverables/${r.data_dom}/${r.gt_id}-${ts}.json`;
    const artRel = r.expected_output;                       // scene 声明的产物路径
    fs.mkdirSync(path.dirname(path.join(ROOT, delivRel)), { recursive: true });
    fs.mkdirSync(path.dirname(path.join(ROOT, artRel)), { recursive: true });
    const dataDir = path.join('templates/workspace/data', r.data_dom);
    const dataFiles = fs.existsSync(path.join(ROOT, dataDir)) ? fs.readdirSync(path.join(ROOT, dataDir)).filter((x) => x.endsWith('.csv')).map((x) => `${dataDir}/${x}`) : [];
    const wf = r.workflow ? JSON.parse(fs.readFileSync(path.join(WF_DIR, 'index.json'), 'utf8')).workflows.find((w) => w.workflow_id === r.workflow) : null;
    const fields = wf && wf.deliverable ? wf.deliverable.fields || [] : [];
    const prompt = [
      '你是企业插件化工作台的一个技能执行节点，按场景约束完成一个 Golden Task。',
      `场景：${r.scene_id}（业务域 ${r.domain}）｜执行技能：${r.skill}｜工作流：${r.workflow || '(无)'}`,
      `数据文件（可读）：${dataFiles.length ? dataFiles.join(', ') : '(本域无数据文件，可基于任务描述与通用业务常识产出)'}`,
      `任务：${r.input}`,
      wf && wf.deliverable ? `交付物规范：文件 ${wf.deliverable.file}；必填字段 ${fields.join(', ')}；验收标准：${wf.deliverable.acceptance}` : '',
      '',
      '请依次完成：',
      `1) 用 read 工具读取数据文件（若存在），结论必须基于读到的真实内容；`,
      `2) 用 write 工具把结构化交付物写入 ${delivRel}，内容为严格 JSON，必须包含全部必填字段，值为真实业务内容（禁止占位符/TODO/示例值）；`,
      `3) 用 write 工具把执行报告（中文 markdown：数据依据、分析结论、脱敏与审批说明）写入 ${artRel}；`,
      `4) 最后回复一行：GT_DONE ${r.gt_id}`,
    ].filter(Boolean).join('\n');

    let engine = { ok: false, err: '' }, modelInfo = {};
    const skillRel = `templates/skills-domain/${r.data_dom}/SKILL-${r.skill}.md`;
    const skillFile = fs.existsSync(path.join(ROOT, skillRel)) ? skillRel : null;
    try {
      const stream = piRun({ key, model, prompt, skillFile });
      const { final, errors } = parsePi(stream);
      if (!final) engine = { ok: false, err: 'no assistant message' + (errors.length ? ' :: ' + errors[0].slice(0, 120) : '') };
      else {
        modelInfo = { stop: final.stopReason, tokens: final.usage && final.usage.totalTokens, cost: final.usage && final.usage.cost && final.usage.cost.total };
        const text = (final.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ');
        if (final.stopReason !== 'stop' || !(final.usage && final.usage.totalTokens > 0)) engine = { ok: false, err: (final.errorMessage || `stop=${final.stopReason}`).slice(0, 160) };
        else if (!text.includes(`GT_DONE ${r.gt_id}`)) engine = { ok: false, err: 'agent 未回报 GT_DONE 标记' };
        else engine = { ok: true, err: '' };
      }
    } catch (e) { engine = { ok: false, err: String(e.message).slice(0, 160) }; }

    // 产物校验（非空 + 结构有效）
    const artAbs = path.join(ROOT, artRel), delivAbs = path.join(ROOT, delivRel);
    const artBytes = fs.existsSync(artAbs) ? fs.statSync(artAbs).size : 0;
    // 结构有效性口径：表类交付物（资产盘点差异表、PIPIA 清单、风险清单等）的 workflow 声明 fields
    // 是**记录级字段（列名）**，不必然是顶层键。判定：字段要么是顶层非空值，要么在某个对象数组里
    // 作为**整列存在**（每条记录都有该键，且至少一条有非空值）——即"schema 完整 + 有真实数据"，
    // 不要求每格非空（真实业务表存在合法空值，如某风险项无 last_day）。
    // 2026-09-29 两次修正：① 原实现只认顶层键，将结构正确的表类产物误判为 NO；
    // ② 继而要求"每格非空"，又把含合法空列的清单误判为 NO（见 gt-runner 修订记录）。
    let structOk = false, missingFields = [], jsonErr = '';
    if (fs.existsSync(delivAbs)) {
      try {
        const j = JSON.parse(fs.readFileSync(delivAbs, 'utf8'));
        const filled = (v) => !(v == null || v === '' || (Array.isArray(v) && !v.length));
        const arrays = Object.values(j).filter((v) => Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object');
        missingFields = fields.filter((f) => !(filled(j[f]) ||
          arrays.some((arr) => arr.every((el) => el && typeof el === 'object' && f in el) && arr.some((el) => filled(el[f])))));
        structOk = missingFields.length === 0;
      } catch (e) { jsonErr = e.message.slice(0, 80); }
    } else jsonErr = 'deliverable 未生成';
    const skillOk = r.skill_in_scene && (!r.gt_id.startsWith('GT-EAP') || r.skill === 'eap-referral');
    const pass = engine.ok && artBytes > 0 && structOk && skillOk;

    audit('engine.run', { engine: 'pi', model, skill: r.skill, gt_id: r.gt_id, ok: engine.ok, stop: modelInfo.stop, tokens: modelInfo.tokens, ...(engine.ok ? {} : { err: engine.err }) });
    audit('gt.run', { gt_id: r.gt_id, scene_id: r.scene_id, skill: r.skill, workflow: r.workflow, pass, artifact: artRel, artifact_bytes: artBytes, deliverable: delivRel, struct_ok: structOk });

    results.push({ ...r, pass, engine_ok: engine.ok, engine_err: engine.err, art_bytes: artBytes, struct_ok: structOk, missing_fields: missingFields.join('|'), json_err: jsonErr, model: modelInfo.stop ? model : '', tokens: modelInfo.tokens || 0, cost: modelInfo.cost || 0, ms: Date.now() - t0 });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${r.gt_id.padEnd(14)} skill=${String(r.skill).padEnd(22)} art=${String(artBytes).padStart(6)}B struct=${structOk ? 'ok' : 'NO'} ${engine.ok ? '' : 'engine:' + engine.err}`);

    // 熔断（015 §10.3 第 7 条）：同一形态连续 3 次失败即停批并诊断，禁止带病连跑
    const sig = engine.ok ? '' : String(engine.err).replace(/\d+/g, '#').slice(0, 60);
    if (!pass && sig && sig === lastErr) { if (++consec >= 3) { audit('gt.batch_abort', { reason: 'circuit_breaker_same_shape', signature: sig, at_gt: r.gt_id }); console.error(`ABORT 连续 3 次同形态失败（${sig}）→ 停批诊断`); break; } }
    else { consec = !pass && sig ? 1 : 0; lastErr = sig; }
  }
  // 追加写 results（保留历史轮次）
  const header = 'ts,gt_id,scene_id,domain,skill,workflow,pass,engine_ok,engine_err,artifact_bytes,struct_ok,missing_fields,tokens,cost,ms,model\n';
  const exists = fs.existsSync(RESULTS_CSV);
  fs.writeFileSync(RESULTS_CSV, (exists ? fs.readFileSync(RESULTS_CSV, 'utf8') : header) +
    results.map((r) => [new Date().toISOString(), r.gt_id, r.scene_id, r.domain, r.skill, r.workflow, r.pass, r.engine_ok, r.engine_err, r.art_bytes, r.struct_ok, r.missing_fields, r.tokens, r.cost, r.ms, r.model].map(csv).join(',')).join('\n') + '\n');
  const p = results.filter((r) => r.pass).length;
  console.log(`RUN_DONE pass=${p}/${results.length} → ${path.relative(ROOT, RESULTS_CSV)}`);
}
function report() {
  if (!fs.existsSync(RESULTS_CSV)) { console.error('无 gt-results.csv，先 --run'); process.exit(1); }
  const rows = fs.readFileSync(RESULTS_CSV, 'utf8').trim().split(/\r?\n/).slice(1)
    .map((l) => l.match(/(".*?"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')))
    .map((c) => ({ gt_id: c[1], scene_id: c[2], domain: c[3], skill: c[4], workflow: c[5], pass: c[6] === 'true', art_bytes: c[9], struct_ok: c[10] === 'true' }));
  // 每 GT 取最近一次
  const last = new Map(); for (const r of rows) last.set(r.gt_id, r);
  const uniq = [...last.values()];
  const byDom = {}; for (const r of uniq) { byDom[r.domain] = byDom[r.domain] || { pass: 0, n: 0 }; byDom[r.domain].n++; if (r.pass) byDom[r.domain].pass++; }
  const pass = uniq.filter((r) => r.pass).length;
  const doms3 = Object.entries(byDom).filter(([, v]) => v.pass >= 3).map(([k]) => k);
  const line = `U10: GT PASS ${pass}/${uniq.length}；达「每域≥3」的域 ${doms3.length}（${doms3.join('/')}）`;
  fs.writeFileSync(CONSIST_CSV, 'gt_id,scene_id,domain,skill,workflow,pass,artifact_bytes,struct_ok\n' +
    uniq.map((r) => [r.gt_id, r.scene_id, r.domain, r.skill, r.workflow, r.pass, r.art_bytes, r.struct_ok].map(csv).join(',')).join('\n') + '\n');
  console.log(line);
  console.log('验收线（015 §8.5）：≥25 GT PASS 覆盖 ≥6 域且每域 ≥3 → ' +
    ((pass >= 25 && doms3.length >= 6) ? 'PASS' : 'NOT MET'));
}

const args = process.argv.slice(2);
if (args.includes('--lint')) process.exit(lint() ? 1 : 0);
else if (args.includes('--plan')) console.table(plan().map((r) => ({ gt: r.gt_id, domain: r.domain, skill: r.skill, workflow: r.workflow, in_scene: r.skill_in_scene })));
else if (args.includes('--run')) run(args);
else if (args.includes('--report')) report();
else console.log('用法：--lint | --plan | --run [--domain D] [--only GT] [--limit N] [--model M] | --report');
