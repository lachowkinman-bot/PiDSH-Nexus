#!/usr/bin/env node
// gen-domain-assets.mjs — 生成 12 业务域资产（015 §8 自制层）：
//   manifests/scenes/*.yaml + manifests/workflows/*.yaml + docs/preset-design/*.md
//   + templates/skills-domain/<code>/*.md + templates/Type-Dict/type-dict.csv
// 用法：node scripts/gen-domain-assets.mjs（bundle 根目录执行）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// —— 域定义：每域 2 数据资产 / 3 技能 / 2 工作流 / 3 GT / 权限与脱敏 ——
// fields: code,name,scenes[[sceneId,assets[[file,level,pii],..]],..], skills[[id,purpose]], flows[[id,desc,cond]], gts[[id,input]], minLevel, dual, redact[], special
const D = [
  { code: 'strat', name: '战略管理', min: 'L4', dual: true, redact: ['salary_merged', 'ma_terms'],
    scenes: [['strat.quarterly-review', [['okr_master.xlsx', 'L2', []], ['comp-review-merged.xlsx', 'L4', ['salary_merged']]]]],
    skills: [['strategy-decode', '把年度目标拆解为季度 KR 并标注依赖'], ['biz-analysis', '经营周报指标计算与异动归因'], ['competitor-watch', '竞品公开信息脱敏摘要（禁原始链接直出）']],
    flows: [['strat.review-approve', '季度战略复盘生效', '复盘结论涉及组织与预算变更'], ['strat.weekly-report', '经营周报生成']],
    gts: [['GT-STRAT-01', '把 2026 年度战略拆解为 Q4 季度 KR 并生成追踪表'], ['GT-STRAT-02', '汇总本月经营周报并给出三大异动归因'], ['GT-STRAT-03', '生成竞品季度动态脱敏摘要（禁含未公开财务）']],
    special: '合并薪酬盘点数据仅在 L4 命名空间；竞品检索走脱敏摘要。' },
  { code: 'mkt-on', name: '营销管理（线上）', min: 'L4', dual: false, redact: ['lead_phone', 'lead_idcard'],
    scenes: [['mkt-on.content-publish', [['content-calendar.xlsx', 'L2', []], ['leads-pipeline.xlsx', 'L3', ['lead_phone']]]]],
    skills: [['content-gen', '按品牌语气生成内容草稿（禁虚假承诺话术）'], ['ad-analysis', '投放平台只读数据分析与归因'], ['seo-audit', '落地页 SEO 诊断与关键词建议']],
    flows: [['mkt-on.publish-approve', '内容对外发布审批', '内容将发布到公开渠道'], ['mkt-on.campaign-report', '投放周报生成']],
    gts: [['GT-MKTON-01', '生成本周内容日历草稿并提交发布审批'], ['GT-MKTON-02', '分析上周投放数据并输出渠道 ROI 报告'], ['GT-MKTON-03', '对落地页做 SEO 诊断并生成整改清单']],
    special: '线索 PII（L3）禁入公网搜索与外部工具；发布动作一律 L4 审批。' },
  { code: 'mkt-off', name: '营销管理（线下）', min: 'L3', dual: false, redact: ['dealer_terms'],
    scenes: [['mkt-off.event-roi', [['event-ledger.xlsx', 'L2', []], ['dealer-agreements.xlsx', 'L3', ['dealer_terms']]]]],
    skills: [['event-plan', '线下活动策划案与物料清单生成'], ['material-compliance', '物料合规审查（广告法口径）'], ['roi-review', '活动 ROI 复盘与改善建议']],
    flows: [['mkt-off.material-review', '物料合规审查流', '物料将对外投放'], ['mkt-off.roi-report', '活动 ROI 复盘报告']],
    gts: [['GT-MKTOFF-01', '生成新品发布会活动方案与物料清单'], ['GT-MKTOFF-02', '对三套物料做广告法合规审查'], ['GT-MKTOFF-03', '复盘上季度展会 ROI 并给出改善建议']],
    special: '经销商条款（L3）只做条款要点抽取，不外发原文。' },
  { code: 'sales', name: '销售管理', min: 'L3', dual: false, redact: ['customer_contract', 'discount_floor'],
    scenes: [['sales.quote-approval', [['pipeline.xlsx', 'L2', []], ['contracts.xlsx', 'L3', ['customer_contract']]]]],
    skills: [['quote-calc', '报价测算（成本+折扣策略）'], ['win-review', '赢单/丢单复盘'], ['quota-dashboard', '业绩看板与达成预测']],
    flows: [['sales.quote-approve', '报价审批（DAG：折扣>阈值加签）', '折扣超出一级授权'], ['sales.win-review', '赢单复盘报告']],
    gts: [['GT-SALES-01', '按客户需求生成报价单并走折扣审批'], ['GT-SALES-02', '汇总本月赢单复盘要点'], ['GT-SALES-03', '生成大区业绩达成看板']],
    special: 'CRM 只读接入走扩展位 cap.ind.crm-readonly；合同原文不外发。' },
  { code: 'fin', name: '财务管理', min: 'L4', dual: false, redact: ['bank_account', 'invoice_taxid'],
    scenes: [['fin.expense-approve', [['expense-claims.xlsx', 'L3', ['invoice_taxid']], ['budget-master.xlsx', 'L2', []]]]],
    skills: [['expense-precheck', '报销单预审（预算/标准/发票要素）'], ['budget-analysis', '预算执行分析'], ['invoice-check', '发票要素校验']],
    flows: [['fin.expense-approve', '报销审批（强审批）', '任何对外付款动作'], ['fin.monthly-report', '月度财务报告（分级出数）']],
    gts: [['GT-FIN-01', '预审 10 张报销单并输出异常清单'], ['GT-FIN-02', '生成部门预算执行月报'], ['GT-FIN-03', '发票要素校验并标记疑点']],
    special: '财报数字必须 A 级证据可溯（到 sheet/row）；银行账户 L4 禁入任何输出。' },
  { code: 'rec', name: '招聘管理', min: 'L3', dual: false, redact: ['candidate_phone', 'candidate_idcard'],
    scenes: [['rec.funnel-weekly', [['candidates.xlsx', 'L3', ['candidate_phone', 'candidate_idcard']], ['interviews.xlsx', 'L3', []]]]],
    skills: [['funnel-analysis', '招聘漏斗转化分析'], ['jd-gen', 'JD 生成与合规检查'], ['interview-summary', '面试纪要结构化（脱敏）']],
    flows: [['rec.resume-forward', '简历外发强制脱敏', '简历将发送给外部面试官/客户'], ['rec.funnel-report', '漏斗周报生成']],
    gts: [['GT-REC-01', '生成本周招聘漏斗周报（含瓶颈环节）'], ['GT-REC-02', '按岗位需求生成 JD 并做合规检查'], ['GT-REC-03', '把候选人简历脱敏后转发面试官（走审批）']],
    special: '候选人 PII 脱敏后再流转；demo 数据 6 行模板继承 002。' },
  { code: 'trn', name: '培训管理', min: 'L3', dual: false, redact: ['cert_id'],
    scenes: [['trn.plan-approve', [['courses.xlsx', 'L2', []], ['certificates.xlsx', 'L3', ['cert_id']]]]],
    skills: [['course-schedule', '培训计划排期'], ['hour-stats', '学时统计与达标分析'], ['cert-expiry', '证书资质到期监控']],
    flows: [['trn.plan-approve', '培训计划审批', '涉及预算与工时安排'], ['trn.expiry-block', '资质到期拦截', '资质过期人员不得排班上岗']],
    gts: [['GT-TRN-01', '生成下月培训计划并走审批'], ['GT-TRN-02', '统计上半年学时达标率'], ['GT-TRN-03', '输出 90 天内到期证书清单与拦截建议']],
    special: '行业化：特种作业证/执业证到期拦截（Overlay 预留）。' },
  { code: 'prf', name: '绩效管理', min: 'L4', dual: true, redact: ['review_score', 'review_note'],
    scenes: [['prf.calibration', [['kpi-master.xlsx', 'L2', []], ['review-results.xlsx', 'L4', ['review_score', 'review_note']]]]],
    skills: [['kpi-track', 'KPI 追踪与预警'], ['calibration-analysis', '校准分析（分布/离散度）'], ['goal-cascade', '目标分解']],
    flows: [['prf.calibration-approve', '绩效校准双审批', '校准结果将生效并通知'], ['prf.cascade-report', '目标分解报告']],
    gts: [['GT-PRF-01', '生成本季度 KPI 追踪与预警清单'], ['GT-PRF-02', '输出校准会议材料（分布+离散度）'], ['GT-PRF-03', '把部门目标分解到岗位并生成追踪表']],
    special: '考核结果 L4；校准纪要禁入记忆层。' },
  { code: 'comp', name: '薪酬管理', min: 'L4', dual: true, redact: ['salary', 'bank_account', 'id_number'],
    scenes: [['comp.salary-review', [['salary_master.xlsx', 'L4', ['salary', 'bank_account', 'id_number']], ['salary-band.xlsx', 'L4', []]]]],
    skills: [['band-analysis', '薪酬带宽偏离分析（只出区间不出个体）'], ['payroll-recon', 'payroll 对账'], ['compa-ratio', 'CR 比率报告']],
    flows: [['comp.salary-adjust', '调薪审批（双审批+redact_gate）', 'delta_band != none 时必须双审批'], ['comp.band-report', '带宽偏离报告（区间口径）']],
    gts: [['GT-COMP-01', '分析调薪提案与带宽偏离并生成报告'], ['GT-COMP-02', 'payroll 与发放明细对账出差异表'], ['GT-COMP-03', '输出 CR 比率分布（区间口径）']],
    special: 'redact_gate 物理前置：个体薪酬永不越过闸门流向公网/外部工具。' },
  { code: 'ben', name: '福利设计', min: 'L4', dual: false, redact: ['health_data', 'insurance_id'],
    scenes: [['ben.plan-compare', [['benefits-plan.xlsx', 'L2', []], ['health-checkups.xlsx', 'L4', ['health_data']]]]],
    skills: [['plan-compare', '福利方案比选（成本/覆盖/满意度）'], ['checkup-report', '体检数据脱敏统计报告'], ['flex-benefit', '弹性福利积分测算']],
    flows: [['ben.vendor-compare', '供应商比选（DAG+合规校验）', '涉及合同与预算'], ['ben.checkup-report', '体检报告（脱敏聚合）']],
    gts: [['GT-BEN-01', '生成三套福利方案比选矩阵'], ['GT-BEN-02', '体检数据脱敏聚合报告（只出分布）'], ['GT-BEN-03', '弹性福利积分测算与模拟']],
    special: '健康数据 L4 禁入记忆层；报告只出聚合分布。' },
  { code: 'admin', name: '行政管理', min: 'L3', dual: false, redact: ['seal_record', 'procurement_price'],
    scenes: [['admin.procurement', [['purchase-requests.xlsx', 'L2', []], ['asset-register.xlsx', 'L2', []]]]],
    skills: [['purchase-compare', '采购比价（≥3 供应商）'], ['asset-inventory', '资产台账盘点'], ['meeting-minutes', '会议纪要结构化']],
    flows: [['admin.purchase-approve', '采购审批（DAG+预算校验）', '金额超阈值加签'], ['admin.seal-request', '用印申请（强制人工 HITL）', '任何用印动作']],
    gts: [['GT-ADMIN-01', '生成办公用品采购比价与审批单'], ['GT-ADMIN-02', '输出季度资产盘点差异表'], ['GT-ADMIN-03', '生成会议纪要并跟踪待办']],
    special: '用印不允许任何自动化放行（强制 HITL）。' },
  { code: 'cmp', name: '合规管理', min: 'L4', dual: false, redact: ['audit_working_papers'],
    scenes: [['cmp.policy-review', [['policies.xlsx', 'L2', []], ['audit-papers.xlsx', 'L4', ['audit_working_papers']]]]],
    skills: [['policy-checklist', '制度合规审查 checklist'], ['pipia-list', '个人信息保护影响评估清单'], ['evidence-pack', '审计证据打包（Requirement→Release）']],
    flows: [['cmp.evidence-pack', '审计证据打包（append-only 对齐）', '证据包将提交外部审计'], ['cmp.policy-report', '制度审查报告']],
    gts: [['GT-CMP-01', '对员工手册做合规 checklist 审查'], ['GT-CMP-02', '生成新业务上线 PIPIA 清单'], ['GT-CMP-03', '打包某任务的完整证据链（审计级）']],
    special: '证据链五级：Requirement→Implementation→Test→Evidence→Release。' },
  { code: 'er-eap', name: '员工关系管理（含 EAP）', min: 'L4', dual: true, redact: ['disciplinary_detail', 'eap_content', 'health_mental'],
    scenes: [['er.offboarding', [['cases.xlsx', 'L4', ['disciplinary_detail']]]], ['eap.referral', [['eap-cases.xlsx', 'L4', ['eap_content', 'health_mental']]]]],
    skills: [['offboarding-flow', '离职流程与面谈纪要（脱敏）'], ['dispute-ops', '争议流程与材料准备'], ['eap-referral', 'EAP 匿名化转介建议（仅到建议为止）']],
    flows: [['er.offboard-approve', '离职流程多级审批', '处分/离职决定生效前'], ['eap.referral-approve', 'EAP 转介双审批+匿名化', '转介建议发出前']],
    gts: [['GT-ER-01', '生成分支机构裁撤的员工关系风险清单'], ['GT-ER-02', '离职面谈纪要结构化（脱敏）'], ['GT-EAP-01', '匿名化 EAP 转介建议（双审批+禁网）']],
    special: 'EAP L4+：禁联网、禁入记忆层（exclude=[graph-memory, pi-hermes-memory]）、双审批、独立命名空间 workspace/eap/、全量留痕。' },
];

const yamlQ = (s) => JSON.stringify(s).replaceAll(',', '，'); // keep YAML scalar simple
const sceneYaml = (d, [sid, assets]) => `apiVersion: workbench.pi-dsh/v1
scene_id: ${sid}@1.0.0
domain: ${d.code.split('-')[0].toUpperCase()}
industry_overlay: null            # 首批 0 个；后续按 P1-4 只扩 1 个行业试点
required_capabilities:
  - cap.excel.panel
  - cap.approval.${d.dual ? 'multi' : 'single'}
  - cap.redact.all
data_assets:
${assets.map(([f, lv, pii]) => `  - name: ${f}\n    level: ${lv}\n    pii_fields: [${pii.join(', ')}]`).join('\n')}
skills: [${d.skills.map(([id]) => id).join(', ')}]
workflows: [${d.flows.map(([id]) => `workflows/${id}.yaml`).join(', ')}]
policies:
  permission:
    min_level: ${d.min}
    dual_approval: ${d.dual}
  redact:
    fields: [${d.redact.join(', ')}]
    gate: redact_gate
  memory:
    pii_allowed: false
    exclude: ${d.code === 'er-eap' ? '[graph-memory, pi-hermes-memory]' : '[]'}
knowledge_seeds: [seeds/${d.code}/README.md]
golden_tasks:
${d.gts.map(([id, input], i) => `  - id: ${id}\n    input: "${input}"\n    expected_plan: "见 docs/preset-design/${d.code}.md 任务分解"\n    expected_tools: [cap.excel.panel, cap.approval.${d.dual ? 'multi' : 'single'}]\n    expected_permission: "${d.min}${d.dual ? '+双审批' : ''}"\n    expected_output: reports/${d.code}/gt-${String(i + 1).padStart(2, '0')}.md\n    expected_files: [${assets.map(([f]) => `data/${d.code}/${f}`).join(', ')}]\n    expected_audit: "读/算/写审计事件${d.dual ? ' + 双审批记录' : ''}"\n    expected_quality: "结论可溯源到 sheet/row 级证据"`).join('\n')}
# 特殊约束：${d.special}
`;
const flowYaml = (d, [id, desc, cond], i) => `apiVersion: workbench.pi-dsh/v1
workflow_id: ${id}@1.0.0
description: "${desc}"
trigger: { type: command, expr: "${id.split('.')[1]}" }
nodes:
  - id: n1; type: skill; ref: ${d.skills[i % d.skills.length][0]}
  - id: n2; type: condition; expr: "${cond}"
  - id: n3; type: approval; level: ${d.min}; dual: ${d.dual}   # condition 的 then 分支禁止绕过审批直连外部写能力
  - id: n4; type: tool; ref: cap.excel.panel.write
  - id: n5; type: audit; record: "${desc} + 审批人 + 依据数据版本"
check: { expected: "产物与审批单一致", actual_ref: audit/n5, on_fail: rollback }
hitl_nodes: [n3]
rollback: { method: savepoint, tag: pre-${id.split('.')[1]} }
`;
const designMd = (d) => `# Preset 设计文档 · ${d.name}（${d.code}）\n\n> 015 §9.2 自制层基线。Agent 定制化时只许细化、不许删域（§8.3）。\n\n## 1. 数据字典\n\n| 文件 | 级别 | PII 字段 | 说明 |\n|---|---|---|---|\n${d.scenes[0][1].map(([f, lv, pii]) => `| ${f} | ${lv} | ${pii.join(', ') || '—'} | 合成脱敏样例 ≥10 行 |`).join('\n')}\n\n## 2. 技能规格\n\n| 技能 | 用途 | 输入 | 输出 | 权限 |\n|---|---|---|---|---|\n${d.skills.map(([id, p]) => `| ${id} | ${p} | data/${d.code}/* | reports/${d.code}/* | ${d.min} |`).join('\n')}\n\n## 3. 工作流\n\n| 工作流 | 审批落点 | 说明 |\n|---|---|---|\n${d.flows.map(([id, desc, cond]) => `| ${id} | ${cond} | ${desc} |`).join('\n')}\n\n## 4. 权限矩阵\n\n- 最低数据级别：${d.min}；双审批：${d.dual}\n- 脱敏字段（redact_gate）：${d.redact.join(', ')}\n- 记忆层：pii_allowed=false${d.code === 'er-eap' ? '；exclude=[graph-memory, pi-hermes-memory]' : ''}\n\n## 5. Golden Tasks（八元组见 Scene YAML）\n\n${d.gts.map(([id, input]) => `- **${id}**：${input}`).join('\n')}\n\n## 6. 特殊约束\n\n${d.special}\n`;
const skillMd = (d, [id, purpose]) => `---\nname: ${id}\ndomain: ${d.code}\nversion: 1.0.0\nmin_level: ${d.min}\nredact_gate: true\n---\n# SKILL · ${id}\n\n**用途**：${purpose}\n\n**触发词**：${id.replace(/-/g, ' ')}\n\n**步骤**：\n1. 读取 data/${d.code}/ 输入（校验 Level ≤ ${d.min}，越级即 DENY）\n2. 经 Permission Gateway 授权后执行\n3. 产出写入 reports/${d.code}/（附证据来源 sheet/row）\n4. 自检：Expected vs Actual 逐项比对，失败进入 RETRY\n\n**依赖能力**：cap.excel.panel, cap.redact.all\n**失败处理**：连续 3 次失败→登记 capability-gap 并停止当前任务\n`;
const typeDictRows = [['domain', 'field', 'type', 'level', 'pii', 'note'].join(',')];
for (const d of D) for (const [f, lv, pii] of d.scenes[0][1]) typeDictRows.push([d.code, f.replace(/\.xlsx$/, ''), 'table', lv, pii.join(';') || 'none', ''].map((x) => (/[",]/.test(x) ? `"${x}"` : x)).join(','));

// —— 落盘 ——
let n = 0;
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); n++; };
for (const d of D) {
  for (const s of d.scenes) w(path.join(ROOT, `manifests/scenes/${s[0]}.yaml`), sceneYaml(d, s));
  d.flows.forEach((f, i) => w(path.join(ROOT, `manifests/workflows/${f[0]}.yaml`), flowYaml(d, f, i)));
  w(path.join(ROOT, `docs/preset-design/${d.code}.md`), designMd(d));
  for (const sk of d.skills) w(path.join(ROOT, `templates/skills-domain/${d.code}/SKILL-${sk[0]}.md`), skillMd(d, sk));
  w(path.join(ROOT, `templates/skills-domain/${d.code}/SKILL-cockpit-intent.md`), `---\nname: ${d.code}-intent\ndomain: ${d.code}\nversion: 1.0.0\n---\n# 意图路由 · ${d.name}\n\n把用户自然语言意图路由到本域技能/工作流；跨域意图交 Chief of Staff（cap.orchestration.chief）。\n\n| 意图 | 路由 |\n|---|---|\n${d.flows.map(([id]) => `| ${id.split('.')[1]} | workflows/${id}.yaml |`).join('\n')}\n`);
}
w(path.join(ROOT, 'templates/Type-Dict/type-dict.csv'), typeDictRows.join('\n') + '\n');
console.log(`generated ${n} files`);
