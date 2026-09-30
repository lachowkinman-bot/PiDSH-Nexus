#!/usr/bin/env node
// gen-workflows.mjs — 工作流库生成器（P2/P3 落地）：
//   ① 把 26 条旧 YAML（行内节点写法，非标准 YAML）重建为标准结构；
//   ② 每域扩充到 6 条（13 域 = 78 条），每条带 deliverable 交付规范（P3：文件/格式/字段/验收标准）；
//   ③ 产出 manifests/workflows/index.json（服务端读取，避免运行时 YAML 依赖）+ 逐条 YAML（可读留档）。
// 节点模板（kind）：approve=skill→condition→approval→tool→audit（hitl）；report=skill→tool→audit；calc=skill→tool→audit（轻）。
// 用法：node scripts/gen-workflows.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'manifests/workflows');

// 域 → scene 声明的技能（manifests/scenes/*.yaml 的 skills 列表，保证 skill ref 与 scene 一致）
const SKILLS = {
  strat: ['strategy-decode', 'biz-analysis', 'competitor-watch'],
  'mkt-on': ['content-gen', 'ad-analysis', 'seo-audit'],
  'mkt-off': ['event-plan', 'material-compliance', 'roi-review'],
  sales: ['quote-calc', 'win-review', 'quota-dashboard'],
  fin: ['expense-precheck', 'budget-analysis', 'invoice-check'],
  rec: ['funnel-analysis', 'jd-gen', 'interview-summary'],
  trn: ['course-schedule', 'hour-stats', 'cert-expiry'],
  prf: ['kpi-track', 'calibration-analysis', 'goal-cascade'],
  comp: ['band-analysis', 'payroll-recon', 'compa-ratio'],
  ben: ['plan-compare', 'checkup-report', 'flex-benefit'],
  admin: ['purchase-compare', 'asset-inventory', 'meeting-minutes'],
  cmp: ['policy-checklist', 'pipia-list', 'evidence-pack'],
  'er-eap': ['offboarding-flow', 'dispute-ops', 'eap-referral'],
};

// 语义技能绑定表（域 → stem → skill）。
// 原实现按"域内序号取模"轮转，只保证 skill ∈ scene 声明技能、不保证语义正确，
// 实测后果：admin.asset-inventory 绑成 meeting-minutes、trn.cert-expiry 绑成 course-schedule、
// 且 EAP 转介跑 dispute-ops（015 §15.4 明令禁止 ER 技能顶替）。改为逐条显式绑定。
// 约束（下方 assert 强制）：① 每个 stem 都有绑定；② skill ∈ 该域 scene 声明技能；
// ③ 每个声明技能至少被 1 条工作流覆盖（否则场景声明的技能无法被 GT 触达）。
const STEM_SKILL = {
  strat: { 'quarterly-review': 'strategy-decode', 'okr-set': 'strategy-decode', 'quarter-close': 'strategy-decode', 'weekly-report': 'biz-analysis', 'org-inventory': 'biz-analysis', 'competitor-brief': 'competitor-watch' },
  'mkt-on': { 'publish-approve': 'content-gen', 'content-calendar': 'content-gen', 'campaign-report': 'ad-analysis', 'ad-spend-review': 'ad-analysis', 'seo-audit': 'seo-audit', 'lead-funnel': 'seo-audit' },
  'mkt-off': { 'event-plan': 'event-plan', 'booth-approve': 'event-plan', 'material-review': 'material-compliance', 'vendor-brief': 'material-compliance', 'event-roi': 'roi-review', 'lead-handoff': 'roi-review' },
  sales: { 'quote-calc': 'quote-calc', 'quote-approve': 'quote-calc', 'win-review': 'win-review', 'contract-review': 'win-review', 'target-split': 'quota-dashboard', 'pipeline-report': 'quota-dashboard' },
  fin: { 'expense-approve': 'expense-precheck', 'reimburse-audit': 'expense-precheck', 'monthly-report': 'budget-analysis', 'budget-review': 'budget-analysis', 'invoice-check': 'invoice-check', 'cashflow-week': 'invoice-check' },
  rec: { 'funnel-weekly': 'funnel-analysis', 'offer-approve': 'funnel-analysis', 'jd-draft': 'jd-gen', 'resume-forward': 'jd-gen', 'interview-schedule': 'interview-summary', 'onboarding-check': 'interview-summary' },
  trn: { 'course-schedule': 'course-schedule', 'plan-approve': 'course-schedule', 'enroll-approve': 'course-schedule', 'hours-report': 'hour-stats', 'cert-renew': 'hour-stats', 'cert-expiry': 'cert-expiry' },
  prf: { 'kpi-tracking': 'kpi-track', 'review-cycle': 'kpi-track', 'calibration-approve': 'calibration-analysis', 'grade-distribution': 'calibration-analysis', 'cascade-report': 'goal-cascade', 'one-on-one': 'goal-cascade' },
  comp: { 'salary-adjust': 'band-analysis', 'band-report': 'band-analysis', 'payroll-recon': 'payroll-recon', 'cost-projection': 'payroll-recon', 'compa-ratio': 'compa-ratio', 'queue-approve': 'compa-ratio' },
  ben: { 'vendor-compare': 'plan-compare', 'plan-enroll': 'plan-compare', 'checkup-report': 'checkup-report', 'claim-review': 'checkup-report', 'points-calc': 'flex-benefit', 'annual-survey': 'flex-benefit' },
  admin: { 'purchase-approve': 'purchase-compare', 'vendor-price': 'purchase-compare', 'asset-inventory': 'asset-inventory', 'supply-order': 'asset-inventory', 'meeting-minutes': 'meeting-minutes', 'seal-request': 'meeting-minutes' },
  cmp: { 'policy-review': 'policy-checklist', 'audit-trail': 'policy-checklist', 'pipia-review': 'pipia-list', 'training-check': 'pipia-list', 'evidence-pack': 'evidence-pack', 'reg-filing': 'evidence-pack' },
  'er-eap': { 'offboard-approve': 'offboarding-flow', 'exit-interview': 'offboarding-flow', 'dispute-case': 'dispute-ops', 'eap-referral': 'eap-referral', 'anon-report': 'eap-referral', 'wellbeing-check': 'eap-referral' },
};

// [domain, stem, kind, desc, deliverableFile, format, fields, acceptance, dual]
const T = [
  // —— 战略 STRAT ——
  ['strat', 'quarterly-review', 'approve', '季度战略复盘（合并薪酬盘点走双审批）', 'quarterly-review.json', 'json', ['period', 'okr_reached', 'comp_review_flag', 'decision'], '合并薪酬盘点仅区间口径；双审批通过方可归档', true],
  ['strat', 'weekly-report', 'report', '经营周报（收入/订单/风险三段）', 'weekly-report.json', 'json', ['week', 'revenue_wan', 'orders', 'risks', 'next_actions'], '数字可追溯到 data/strat/weekly.csv 行级', false],
  ['strat', 'okr-set', 'calc', 'OKR 目标与 KR 制定（表格化提交）', 'okr-set.json', 'json', ['objective', 'kr_list', 'quarter', 'owner'], '每条 KR 必须可量化（progress_pct 数值）', false],
  ['strat', 'competitor-brief', 'report', '竞品动态简报（脱敏摘要口径）', 'competitor-brief.json', 'json', ['competitor', 'move_type', 'impact', 'our_response'], '外部检索内容必须经脱敏摘要（禁原文外发）', false],
  ['strat', 'org-inventory', 'report', '组织盘点（关键岗位/继任）', 'org-inventory.json', 'json', ['position', 'incumbent_masked', 'successor_masked', 'risk_level'], '人员字段一律掩码（Type-Dict L4 口径）', false],
  ['strat', 'quarter-close', 'approve', '季度关账经营决议（含调薪包）', 'quarter-close.json', 'json', ['period', 'highlights', 'comp_package_flag', 'approvals'], '调薪包触发 COMP 域双审批联动', true],
  // —— 营销（线上）MKT-ON ——
  ['mkt-on', 'publish-approve', 'approve', '内容发布审批（L4 强审批 + 脱敏）', 'publish-approve.json', 'json', ['title', 'channel', 'publish_at', 'pii_check', 'approver'], '含 PII 的素材必须 redact 后才可发布', true],
  ['mkt-on', 'campaign-report', 'report', '投放周报（渠道×ROI）', 'campaign-report.json', 'json', ['channel', 'spend_wan', 'leads', 'roi', 'week'], 'ROI 数字可追溯到 data/mkt-on/leads.csv', false],
  ['mkt-on', 'content-calendar', 'calc', '内容日历排期（两周滚动）', 'content-calendar.json', 'json', ['date', 'channel', 'title', 'status'], '排期冲突（同日同渠道）须标红', false],
  ['mkt-on', 'lead-funnel', 'report', '线索漏斗周报（阶段转化）', 'lead-funnel.json', 'json', ['stage', 'count', 'conversion_pct', 'week'], '线索手机号/邮箱仅掩码口径', false],
  ['mkt-on', 'seo-audit', 'report', 'SEO 诊断（收录/关键词）', 'seo-audit.json', 'json', ['page', 'keywords', 'rank', 'issue'], '外部抓取仅摘要，禁整站镜像', false],
  ['mkt-on', 'ad-spend-review', 'approve', '投放加预算审批（阈值触发）', 'ad-spend-review.json', 'json', ['channel', 'current_spend_wan', 'increment_wan', 'expected_roi'], '单周加预算 >10 万触发双审批', true],
  // —— 营销（线下）MKT-OFF ——
  ['mkt-off', 'event-roi', 'report', '活动 ROI 复盘（预算 vs 实际）', 'event-roi.json', 'json', ['event', 'budget_wan', 'actual_wan', 'roi', 'lessons'], '数字可追溯到 data/mkt-off/events.csv', false],
  ['mkt-off', 'material-review', 'approve', '物料合规审查（法务→品牌→归档）', 'material-review.json', 'json', ['material', 'legal_check', 'brand_check', 'final_status'], '任一未过即不得外发；外发走审批', true],
  ['mkt-off', 'event-plan', 'calc', '活动策划案（预算/场地/排期）', 'event-plan.json', 'json', ['event', 'city', 'budget_wan', 'schedule'], '预算超部门季度包 20% 触发审批', false],
  ['mkt-off', 'vendor-brief', 'report', '经销商简报（条款执行）', 'vendor-brief.json', 'json', ['dealer_masked', 'terms_exec', 'sellthrough', 'risk'], '经销商条款 L3 脱敏', false],
  ['mkt-off', 'booth-approve', 'approve', '展位/场地签约审批', 'booth-approve.json', 'json', ['venue', 'cost_wan', 'dates', 'approver'], '单场签约 >30 万双审批', true],
  ['mkt-off', 'lead-handoff', 'calc', '线下线索移交销售（去重+脱敏）', 'lead-handoff.json', 'json', ['event', 'leads', 'dedup_pct', 'owner'], '移交前必须过 redact_gate', false],
  // —— 销售 SALES ——
  ['sales', 'quote-approve', 'approve', '报价审批（DAG + 折扣阈值）', 'quote-approve.json', 'json', ['quote_id', 'total_wan', 'discount_pct', 'approvals'], '折扣 ≥10% 双审批；≥15% 加签 CFO', true],
  ['sales', 'win-review', 'report', '赢单复盘（打法沉淀）', 'win-review.json', 'json', ['opportunity', 'amount_k', 'win_factors', 'playbook_update'], '结论可追溯到商机记录', false],
  ['sales', 'quote-calc', 'calc', '报价测算（规格×数量×折扣）', 'quote-calc.json', 'json', ['customer_masked', 'items', 'discount_pct', 'total_wan'], '低于底价必须转 quote-approve', false],
  ['sales', 'pipeline-report', 'report', '管道周报（阶段×金额）', 'pipeline-report.json', 'json', ['stage', 'count', 'amount_k', 'week'], '金额单位万元，可追溯 pipeline.csv', false],
  ['sales', 'contract-review', 'approve', '合同评审（法务/财务会签）', 'contract-review.json', 'json', ['contract_no', 'terms_risk', 'payment_terms', 'approvals'], '回款条款偏离标准必须双审批', true],
  ['sales', 'target-split', 'calc', '销售目标分解（区→人）', 'target-split.json', 'json', ['region', 'owner_masked', 'target_wan', 'quarter'], '合计必须等于区目标', false],
  // —— 财务 FIN ——
  ['fin', 'expense-approve', 'approve', '报销审批（强审批）', 'expense-approve.json', 'json', ['expense_id', 'amount_yuan', 'level', 'approvals'], 'L4 必须双审批；审批单与产物一致', true],
  ['fin', 'monthly-report', 'report', '月度财报（分级输出）', 'monthly-report.json', 'json', ['period', 'revenue_wan', 'cost_wan', 'net_wan'], '财报数字 A 级可溯（凭证级）', false],
  ['fin', 'budget-review', 'approve', '预算调整审批（部门季度包）', 'budget-review.json', 'json', ['dept', 'budget_wan', 'delta_wan', 'reason'], '超包 10% 加签 CFO', true],
  ['fin', 'invoice-check', 'calc', '发票校验（税号/金额/连号）', 'invoice-check.json', 'json', ['invoice_no', 'amount_yuan', 'checks', 'result'], '连号/抬头不一致直接 FAIL', false],
  ['fin', 'reimburse-audit', 'report', '报销抽审（合规抽样）', 'reimburse-audit.json', 'json', ['sample_size', 'issues', 'issue_rate', 'actions'], '抽样比例 ≥10%', false],
  ['fin', 'cashflow-week', 'report', '周现金流简报（进/出/余）', 'cashflow-week.json', 'json', ['week', 'in_wan', 'out_wan', 'balance_wan'], '银行账户字段 L4 只出汇总', false],
  // —— 招聘 REC ——
  ['rec', 'funnel-weekly', 'report', '漏斗周报（阶段转化）', 'funnel-weekly.json', 'json', ['stage', 'count', 'conversion_pct', 'week'], '候选人 PII 仅掩码', false],
  ['rec', 'resume-forward', 'approve', '简历外发（强制脱敏 + 审批）', 'resume-forward.json', 'json', ['candidate_masked', 'target', 'redact_fields', 'approver'], '未脱敏外发 = 一票否决', true],
  ['rec', 'jd-draft', 'calc', 'JD 起草（岗位/要求/薪酬带）', 'jd-draft.json', 'json', ['position', 'requirements', 'band', 'locale'], '薪酬带引用 comp.bands 区间口径', false],
  ['rec', 'interview-schedule', 'calc', '面试安排（ interviewer 冲突检测）', 'interview-schedule.json', 'json', ['candidate_masked', 'slot', 'interviewers', 'mode'], '同一面试官同时段冲突须标红', false],
  ['rec', 'offer-approve', 'approve', 'offer 审批（薪酬带核对）', 'offer-approve.json', 'json', ['candidate_masked', 'position', 'offer_band', 'approvals'], 'offer 超出 P75 必须双审批', true],
  ['rec', 'onboarding-check', 'report', '入职准备清单（账号/设备/导师）', 'onboarding-check.json', 'json', ['item', 'owner', 'due', 'status'], '入职日前 3 天必须全绿', false],
  // —— 培训 TRN ——
  ['trn', 'plan-approve', 'approve', '培训计划审批（预算/学时）', 'plan-approve.json', 'json', ['course', 'hours', 'budget_wan', 'approver'], '外部采购课程走审批', true],
  ['trn', 'hours-report', 'report', '学时统计（人/部门口径）', 'hours-report.json', 'json', ['dept', 'planned_h', 'completed_h', 'rate'], '学时数字可追溯 courses.csv', false],
  ['trn', 'course-schedule', 'calc', '排期（讲师/场地冲突检测）', 'course-schedule.json', 'json', ['course', 'date', 'trainer', 'room'], '冲突自动标红并建议备选', false],
  ['trn', 'cert-expiry', 'report', '资质到期提醒（特种作业/证书）', 'cert-expiry.json', 'json', ['certificate', 'holder_masked', 'expire_date', 'days_left'], '90 天内到期必须列出；过期立即拦截', false],
  ['trn', 'cert-renew', 'approve', '证书复审/换证审批', 'cert-renew.json', 'json', ['certificate', 'holder_masked', 'renew_fee', 'approver'], '岗位强依赖证书过期未续 = 上岗拦截', true],
  ['trn', 'enroll-approve', 'calc', '报名确认（名额/前置课校验）', 'enroll-approve.json', 'json', ['course', 'employee_masked', 'prereq_ok', 'seats_left'], '前置课未修直接拒绝', false],
  // —— 绩效 PRF ——
  ['prf', 'calibration-approve', 'approve', '绩效校准（双审批）', 'calibration-approve.json', 'json', ['employee_masked', 'manager_grade', 'calibrated_grade', 'approvals'], '校准纪要禁入记忆层', true],
  ['prf', 'cascade-report', 'report', '目标分解报告（公司→部门→人）', 'cascade-report.json', 'json', ['level', 'owner_masked', 'goal', 'weight'], '权重合计必须 = 100%', false],
  ['prf', 'kpi-tracking', 'report', 'KPI 追踪（实际 vs 目标）', 'kpi-tracking.json', 'json', ['kpi', 'target', 'actual', 'rate'], '数据可追溯 kpi.csv', false],
  ['prf', 'review-cycle', 'calc', '考核周期发起（模板下发）', 'review-cycle.json', 'json', ['cycle', 'template', 'targets', 'deadline'], '全员覆盖校验（无遗漏人）', false],
  ['prf', 'one-on-one', 'report', '一对一沟通纪要（结构化）', 'one-on-one.json', 'json', ['employee_masked', 'topics', 'actions', 'next_date'], '纪要默认不入记忆层', false],
  ['prf', 'grade-distribution', 'report', '等级分布与强制分布比对', 'grade-distribution.json', 'json', ['grade', 'count', 'pct', 'target_pct'], '偏离强制分布线 >5pct 标红', false],
  // —— 薪酬 COMP（全域 L4）——
  ['comp', 'salary-adjust', 'approve', '调薪审批（双审批 + redact_gate）', 'salary-adjust.json', 'json', ['employee_masked', 'band_from', 'band_to', 'approvals'], '个体薪酬只出区间；redact_gate 强制', true],
  ['comp', 'band-report', 'report', '带宽偏离报告（区间口径）', 'band-report.json', 'json', ['band', 'headcount', 'above_p75', 'below_p25'], '不出现任何个体原值', false],
  ['comp', 'payroll-recon', 'report', 'payroll 对账（应发 vs 实发）', 'payroll-recon.json', 'json', ['period', 'headcount', 'gross_diff', 'items'], '差异 >0.5% 逐项列出', false],
  ['comp', 'compa-ratio', 'report', 'CR 指数报告（人/带宽）', 'compa-ratio.json', 'json', ['employee_masked', 'band', 'cr', 'zone'], 'CR 仅区间展示（0.8–1.2 分档）', false],
  ['comp', 'queue-approve', 'approve', '调薪队列批量审批（HRD+CFO）', 'queue-approve.json', 'json', ['batch', 'items', 'total_impact_wan', 'approvals'], '批量影响 >50 万/年 加签 CEO', true],
  ['comp', 'cost-projection', 'calc', '调薪包成本测算（区间口径）', 'cost-projection.json', 'json', ['scenario', 'pct', 'cost_impact_wan', 'note'], '测算不含个体原值', false],
  // —— 福利 BEN ——
  ['ben', 'vendor-compare', 'approve', '方案比选（DAG：商保/体检/弹性）', 'vendor-compare.json', 'json', ['category', 'vendors', 'points', 'winner'], '健康数据 L4 禁入记忆层', true],
  ['ben', 'checkup-report', 'report', '体检报告聚合（脱敏）', 'checkup-report.json', 'json', ['employee_masked', 'abnormal_items', 'followup', 'year'], '个体健康指标不出原值，仅建议', false],
  ['ben', 'points-calc', 'calc', '弹性积分测算（年度额度）', 'points-calc.json', 'json', ['employee_masked', 'points_total', 'selected', 'remaining'], '剩余分可为负拦截', false],
  ['ben', 'plan-enroll', 'approve', '方案投保/变更审批', 'plan-enroll.json', 'json', ['employee_masked', 'plan', 'effective_date', 'approver'], '家属信息仅掩码', true],
  ['ben', 'claim-review', 'report', '理赔协办周报（时效/结案）', 'claim-review.json', 'json', ['claim_masked', 'type', 'days', 'status'], '理赔金额仅区间', false],
  ['ben', 'annual-survey', 'report', '年度福利满意度调查（聚合）', 'annual-survey.json', 'json', ['dimension', 'score', 'n', 'verbatim_theme'], '开放题经脱敏聚合', false],
  // —— 行政 ADMIN ——
  ['admin', 'purchase-approve', 'approve', '采购审批（DAG + 预算校验）', 'purchase-approve.json', 'json', ['item', 'qty', 'amount_wan', 'budget_ok', 'approvals'], '预算不足直接阻断；用印强制人工', true],
  ['admin', 'seal-request', 'approve', '用印申请（强制人工放行）', 'seal-request.json', 'json', ['doc', 'seal_type', 'copies', 'keeper_confirm'], '用印禁自动放行（必须人工确认）', true],
  ['admin', 'asset-inventory', 'report', '资产盘点（在用/维修/闲置）', 'asset-inventory.json', 'json', ['asset_id', 'status', 'holder_masked', 'location'], '与 assets.csv 勾稽', false],
  ['admin', 'meeting-minutes', 'calc', '会议纪要（决议/待办/责任人）', 'meeting-minutes.json', 'json', ['meeting', 'decisions', 'todos', 'owners'], '待办必须带责任人与期限', false],
  ['admin', 'supply-order', 'calc', '办公用品下单（比价后）', 'supply-order.json', 'json', ['item', 'vendor_masked', 'qty', 'amount_yuan'], '必须引用比价结论（最低价或说明）', false],
  ['admin', 'vendor-price', 'report', '供应商比价报告（三家原则）', 'vendor-price.json', 'json', ['item', 'quotes', 'lowest', 'chosen'], '不足三家须说明理由', false],
  // —— 合规 CMP ——
  ['cmp', 'policy-review', 'report', '制度审查 checklist（逐条比对）', 'policy-review.json', 'json', ['policy', 'items', 'pass_rate', 'gaps'], 'Requirement→Release 链完整', false],
  ['cmp', 'evidence-pack', 'approve', '证据打包（append-only 对齐）', 'evidence-pack.json', 'json', ['case', 'evidence_items', 'hashes', 'packaged_at'], '打包后不可增删（append-only）', true],
  ['cmp', 'pipia-review', 'approve', 'PIPIA 评审（高风险处理）', 'pipia-review.json', 'json', ['process', 'risk_level', 'residual', 'approvals'], '高风险 residual 未降级不得上线', true],
  ['cmp', 'audit-trail', 'report', '审计留痕月报（覆盖率）', 'audit-trail.json', 'json', ['scope', 'events', 'coverage_pct', 'gaps'], '关键动作覆盖率 ≥95%', false],
  ['cmp', 'training-check', 'report', '合规培训完成度核查', 'training-check.json', 'json', ['dept', 'required', 'completed', 'rate'], '必修未完成 >5% 上报管理层', false],
  ['cmp', 'reg-filing', 'calc', '监管报送清单与截止提醒', 'reg-filing.json', 'json', ['filing', 'authority', 'deadline', 'days_left'], '7 天内到期必须置顶', false],
  // —— 员工关系 / EAP（ER=L4，EAP=L4+）——
  ['er-eap', 'offboard-approve', 'approve', '离职流程（多级审批）', 'offboard-approve.json', 'json', ['employee_masked', 'last_day', 'handover_ok', 'approvals'], '交接未完成不得进入最后一步', true],
  ['er-eap', 'eap-referral', 'approve', 'EAP 转介（双审批 + 匿名化）', 'eap-referral.json', 'json', ['anon_id', 'direction', 'approvals', 'sessions'], '输出仅匿名编号；禁网；禁入记忆层', true],
  ['er-eap', 'dispute-case', 'report', '争议处理台账（阶段/证据）', 'dispute-case.json', 'json', ['case_id', 'type', 'stage', 'evidence_refs'], '证据引用指向 evidence-pack', false],
  ['er-eap', 'exit-interview', 'report', '离职面谈纪要（结构化）', 'exit-interview.json', 'json', ['employee_masked', 'reasons', 'improvements', 'rehire_flag'], '敏感表述经脱敏', false],
  ['er-eap', 'anon-report', 'report', 'EAP 匿名使用月报（聚合口径）', 'anon-report.json', 'json', ['month', 'total_referrals', 'by_direction', 'sessions'], '仅聚合数字，无任何个体字段', false],
  ['er-eap', 'wellbeing-check', 'calc', '组织健康度脉搏（匿名问卷聚合）', 'wellbeing-check.json', 'json', ['dimension', 'score', 'n', 'trend'], 'n<5 不出分（防反推）', false],
];

function nodesFor(kind, skill, desc, dual) {
  if (kind === 'approve') return [
    { id: 'n1', type: 'skill', ref: skill },
    { id: 'n2', type: 'condition', expr: `${desc} 触发对外/生效动作` },
    { id: 'n3', type: 'approval', level: 'L4', dual },
    { id: 'n4', type: 'tool', ref: 'cap.excel.panel.write' },
    { id: 'n5', type: 'audit', record: `${desc}：审批人 + 依据数据版本 + 产物哈希` },
  ];
  if (kind === 'report') return [
    { id: 'n1', type: 'skill', ref: skill },
    { id: 'n2', type: 'tool', ref: 'cap.excel.panel.write' },
    { id: 'n3', type: 'audit', record: `${desc}：数据版本 + 产物哈希` },
  ];
  return [ // calc
    { id: 'n1', type: 'skill', ref: skill },
    { id: 'n2', type: 'tool', ref: 'cap.excel.panel.write' },
    { id: 'n3', type: 'audit', record: `${desc}：输入参数 + 结果快照` },
  ];
}
function hitlFor(nodes) { return nodes.filter((n) => n.type === 'approval').map((n) => n.id); }

const byDomain = {};
const list = T.map(([domain, stem, kind, desc, dfile, format, fields, acceptance, dual]) => {
  const skill = STEM_SKILL[domain] && STEM_SKILL[domain][stem];
  if (!skill) throw new Error(`STEM_SKILL 未覆盖：${domain}.${stem}（新增工作流必须显式绑定技能，禁止回退轮转）`);
  if (!SKILLS[domain].includes(skill)) throw new Error(`STEM_SKILL 越界：${domain}.${stem} → ${skill} 不在 ${domain} 的 scene 声明技能内`);
  const nodes = nodesFor(kind, skill, desc, !!dual);
  const id = `${domain}.${stem}`;
  byDomain[domain] = byDomain[domain] || [];
  byDomain[domain].push(`${id}@1.0.0`);
  return { workflow_id: `${id}@1.0.0`, domain, kind, description: desc, skill, trigger: { type: 'command', expr: stem }, nodes, deliverable: { file: `${stem}-<ts>.${format === 'json' ? 'json' : 'xlsx'}`, format, fields, acceptance }, hitl_nodes: hitlFor(nodes), dual: !!dual, rollback: { method: 'savepoint', tag: `pre-${stem}` } };
});

// 覆盖断言：每个域声明的每个技能至少被 1 条工作流触达——否则该技能的 GT 无法绑定到语义正确的工作流
for (const [d, skills] of Object.entries(SKILLS)) {
  const used = new Set(list.filter((w) => w.domain === d).map((w) => w.skill));
  const miss = skills.filter((s) => !used.has(s));
  if (miss.length) throw new Error(`技能未被任何工作流覆盖：${d} → ${miss.join(',')}`);
}

// —— 逐条写标准 YAML（可读留档；解析以 index.json 为准，避免运行时 YAML 依赖）——
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const w of list) {
  const y = [];
  y.push('apiVersion: workbench.pi-dsh/v1');
  y.push(`workflow_id: ${w.workflow_id}`);
  y.push(`domain: ${w.domain}`);
  y.push(`description: "${w.description}"`);
  y.push('trigger:');
  y.push(`  type: ${w.trigger.type}`);
  y.push(`  expr: ${w.trigger.expr}`);
  y.push('nodes:');
  for (const nd of w.nodes) {
    y.push(`  - id: ${nd.id}`);
    y.push(`    type: ${nd.type}`);
    if (nd.ref) y.push(`    ref: ${nd.ref}`);
    if (nd.expr) y.push(`    expr: "${nd.expr}"`);
    if (nd.level) y.push(`    level: ${nd.level}`);
    if (nd.type === 'approval') y.push(`    dual: ${w.dual}`);
    if (nd.record) y.push(`    record: "${nd.record}"`);
  }
  y.push('deliverable:');
  y.push(`  file: ${w.deliverable.file}`);
  y.push(`  format: ${w.deliverable.format}`);
  y.push('  fields:');
  for (const f of w.deliverable.fields) y.push(`    - ${f}`);
  y.push(`  acceptance: "${w.deliverable.acceptance}"`);
  y.push('hitl_nodes:');
  for (const h of w.hitl_nodes) y.push(`  - ${h}`);
  y.push('rollback:');
  y.push(`  method: ${w.rollback.method}`);
  y.push(`  tag: ${w.rollback.tag}`);
  fs.writeFileSync(path.join(OUT, `${w.workflow_id.split('@')[0]}.yaml`), y.join('\n') + '\n', 'utf8');
  n++;
}
// —— index.json（服务端消费）——
const index = { generated_at: new Date().toISOString(), count: list.length, by_domain: byDomain, workflows: list };
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1), 'utf8');
const per = Object.entries(byDomain).map(([d, a]) => `${d}:${a.length}`).join(' ');
console.log(`WORKFLOWS_DONE yaml=${n} total=${list.length} (${per}) → manifests/workflows/ + index.json`);
