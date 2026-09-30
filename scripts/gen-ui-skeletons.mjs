#!/usr/bin/env node
// gen-ui-skeletons.mjs — 生成 U15 界面骨架（基线；Agent 在 U15 实装为真实界面并截图）
// 产出：templates/ui/pages/*.html（8 功能页 + 13 域工作台）+ templates/ui/README.md
// 纪律：骨架 ≠ U15 证据（UI-DELIVERY-SPEC）；每页含 TODO(U15) 实装点与数据态占位
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const DOMAINS = ['strat', 'mkt-on', 'mkt-off', 'sales', 'fin', 'rec', 'trn', 'prf', 'comp', 'ben', 'admin', 'cmp', 'er-eap'];
let n = 0;
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); n++; };
const page = (id, title, blocks) => `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>${id} · ${title}</title>
<style>
body{font-family:system-ui,'PingFang SC','Microsoft YaHei';margin:0;background:#f6f8fb;color:#1f2937}
header{background:#0f172a;color:#fff;padding:10px 16px;font-weight:700}
main{padding:16px;display:grid;gap:12px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px}
.state{font-size:12px;color:#6b7280}
.todo{background:#fffbeb;border:1px dashed #f59e0b;border-radius:8px;padding:8px;font-size:12px;color:#92400e}
button{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
</style></head><body>
<header>${id} · ${title} <span style="float:right;font-weight:400;font-size:12px">preset: <span data-bind="current-preset">未装载</span></span></header>
<main>
${blocks.map(([t, d]) => `  <section class="card"><h3>${t}</h3><div class="state" data-state="${t}">空态占位</div><div class="todo">TODO(U15)：${d}</div></section>`).join('\n')}
  <section class="card"><h3>preset 生命周期（F14，绑定 scene-loader.mjs）</h3>
    <button data-op="list">选：列出 Scene</button> <button data-op="apply">用：应用</button>
    <button data-op="save">存：持久化</button> <button data-op="switch">切：切换域</button>
    <div class="state" data-state="lifecycle">未操作</div>
    <div class="todo">TODO(U15)：按钮接通 scripts/scene-loader.mjs（运行时消费方 ≥1）；操作留 png 截图</div>
  </section>
</main></body></html>\n`;

const FUNCS = [
  ['F2-task-center', '任务中心首页', [['任务卡列表', 'Task-centric：进行中/待审批/待输入/失败，点卡进详情']], [['待审批', 'F4 联动']]],
  ['F3-domain-nav', '12 业务域入口', [['域导航', '13 域入口（营销双变体），点击进域工作台'], ['preset 选择器', '列出 manifests/scenes 全部 Scene（F14）']]],
  ['F4-approvals', '审批中心', [['待审列表', 'L3/L4 过滤'], ['审批详情', '批准/拒绝/查看详情；拒绝→任务回规划态']]],
  ['F5-audit-viewer', '脱敏与审计查看器', [['redact 日志', 'REDACTED 高亮'], ['trajectory 回放', 'append-only 事件流']]],
  ['F6-memory-panel', '记忆与知识面板', [['记忆条目', '跨会话偏好'], ['KG 召回', '种子召回查询；EAP 排除开关灰显']]],
  ['F10-gt-smoke', 'GT 冒烟入口', [['域选择+一键跑', 'UI 内触发，实时进度；产物在界面呈现']]],
  ['F12-eap-ns', 'EAP 隔离命名空间', [['L4+ 横幅', '禁网/禁记忆/双审批指示']]],
  ['F13-orchestrator', '主控编排', [['任务拆解树', 'Chief of Staff：分派/并行/汇总']]],
];
for (const [id, title, blocks] of FUNCS) w(path.join(ROOT, `templates/ui/pages/${id}.html`), page(id, title, blocks));
for (const d of DOMAINS) {
  w(path.join(ROOT, `templates/ui/pages/domain-${d}.html`), page(`domain-${d}`, `${d} 域工作台`, [
    ['数据资产表', 'data_assets 渲染（L3/L4 标注；空态）'], ['域技能触发', 'skills 快捷卡片'],
    ['域工作流入口', 'workflows 触发（审批落点提示）'], ['域 GT', 'golden_tasks 列表与最近产物'],
  ]));
}
w(path.join(ROOT, 'templates/ui/README.md'), `# templates/ui（U15 界面基线）\n\n> 本目录是 U15 的**基线骨架**，不是交付证据。U15 要求：每页完成 TODO(U15) 实装（接通 scene-loader.mjs 与真实数据/动作），按 UI-DELIVERY-SPEC 截图 ≥13+12 张 png。\n\n- pages/F*.html：8 个功能页（F2-F6/F10/F12/F13 + F3 域导航）\n- pages/domain-*.html：13 个域工作台骨架\n- preset 生命周期按钮统一接通 scripts/scene-loader.mjs（运行时消费方 ≥1）\n- 纪律：纯 md 报告、骨架本身、HTTP 可达——均不构成 U15 证据（015 §14.6 语义禁令）\n`);
console.log(`ui skeletons: ${n} files`);
