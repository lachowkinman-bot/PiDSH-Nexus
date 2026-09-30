#!/usr/bin/env node
// Build the canonical module -> work item -> workflow -> stage hierarchy.
// The generator fails closed unless every one of the 78 workflows is mapped exactly once.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOW_INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8'));
const STRATEGY = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/strategy-model.json'), 'utf8'));
const BENCHMARKS = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/benchmark-sources.json'), 'utf8')).sources;
const DOMAIN_MODELS = Object.fromEntries(
  fs.readdirSync(path.join(ROOT, 'manifests/domain-model'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-model', file), 'utf8'));
      return [model.domain, model];
    }),
);

const workflowById = Object.fromEntries(WORKFLOW_INDEX.workflows.map((workflow) => [workflow.workflow_id, workflow]));

const CROSS_DOMAIN_EFFECTS = {
  'rec.onboarding-check@1.0.0': [
    ['training.onboarding.plan', 'trn', 'backupPlanId', 'person_key'],
    ['performance.onboarding.goals', 'prf', 'goalSetId', 'person_key'],
    ['admin.onboarding.equipment', 'admin', 'assetAssignmentId', 'person_key'],
  ],
  'mkt-off.lead-handoff@1.0.0': [
    ['sales.pipeline.lead', 'sales', 'leadKey', 'customer_key'],
  ],
  'sales.contract-review@1.0.0': [
    ['finance.revenue.recognition', 'fin', 'contractKey', 'contract_key'],
  ],
  'fin.budget-review@1.0.0': [
    ['strategy.budget.commitment', 'strat', 'initiativeKey', 'initiative_key'],
  ],
  'prf.calibration-approve@1.0.0': [
    ['comp.adjustment.candidate', 'comp', 'personKey', 'person_key'],
  ],
  'ben-plan-enroll@1.0.0': [
    ['payroll.benefit.deduction', 'comp', 'personKey', 'person_key'],
  ],
  'admin-purchase-approve@1.0.0': [
    ['finance.purchase.commitment', 'fin', 'purchaseOrderKey', 'contract_key'],
  ],
  'cmp-policy-review@1.0.0': [
    ['compliance.remediation', 'cmp', 'findingKey', 'trace_id'],
  ],
  'er-eap-offboard-approve@1.0.0': [
    ['admin.asset.recovery', 'admin', 'assetRecoveryId', 'person_key'],
    ['comp.payroll.final-settlement', 'comp', 'settlementId', 'person_key'],
  ],
};

function findWorkflowForItem(domain, itemId) {
  const candidates = WORKFLOW_INDEX.workflows.filter((candidate) => candidate.domain === domain);
  const exact = candidates.find((candidate) =>
    `${domain}-${candidate.workflow_id.split('@')[0].split('.')[1]}` === itemId);
  if (exact) return exact;
  const suffixMatches = candidates.filter((candidate) =>
    itemId.endsWith(`-${candidate.workflow_id.split('@')[0].split('.')[1]}`));
  if (suffixMatches.length === 1) return suffixMatches[0];
  if (suffixMatches.length > 1) throw new Error(`事项匹配到多个工作流：${domain}/${itemId}`);
  return null;
}

const MODULE_DESIGNS = {
  strat: [
    ['strategy-formulation', '战略制定与解码', '形成可量化目标、竞争判断和组织能力假设', ['COSO-ERM', 'ISO-30414'], [
      ['strategy-okr-set', '战略目标与 KR 定版', '把战略意图转为可度量、可归责的关键结果', '战略负责人', '季度'],
      ['strategy-competitor-brief', '竞争态势与应对', '形成面向管理层的竞争判断和应对建议', '战略研究负责人', '月度/事件触达'],
    ]],
    ['strategy-operations', '经营监控与组织协同', '把目标转成周度经营动作和组织能力决策', ['COSO-ERM', 'ISO-30414'], [
      ['strategy-weekly-report', '经营周报与偏差归因', '解释收入、订单与风险偏差并形成动作', '经营分析负责人', '每周'],
      ['strategy-org-inventory', '关键岗位与继任盘点', '识别关键岗位缺口、继任风险和优先行动', '组织发展负责人', '季度'],
    ]],
    ['strategy-governance', '战略复盘与关账', '以证据复盘目标达成并授权资源调整', ['COSO-ERM', 'XBRL'], [
      ['strategy-quarterly-review', '季度战略复盘', '评估目标达成、风险和下一周期举措', '总经理办公室', '季度'],
      ['strategy-quarter-close', '季度关账与调薪包决议', '完成经营关账并触发预算/薪酬联动', 'CFO/HRD', '季度'],
    ]],
  ],
  'mkt-on': [
    ['content-planning', '内容与发布计划', '建立受众、主题、渠道与发布节奏并完成品牌/隐私审批', ['GOOGLE-SEARCH-ESSENTIALS', 'NIST-PRIVACY'], [
      ['mkt-on-content-calendar', '内容日历与排期', '形成无冲突、可执行、可审批的内容计划', '内容负责人', '双周滚动'],
      ['mkt-on-publish-approve', '内容发布审批', '确保对外内容通过品牌、法务与隐私门禁', '品牌负责人', '按发布批次'],
    ]],
    ['paid-growth', '付费增长与预算控制', '用可追溯归因管理渠道预算和 ROI', ['NIST-AI-RMF', 'GREATEXPECTATIONS'], [
      ['mkt-on-campaign-report', '投放周报与渠道 ROI', '识别渠道效率、浪费和预算迁移建议', '增长负责人', '每周'],
      ['mkt-on-ad-spend-review', '投放加预算审批', '在阈值与预期 ROI 约束下调整预算', '市场负责人', '按预算事件'],
    ]],
    ['acquisition-quality', '线索质量与自然增长', '把自然流量和线索质量接回销售管道', ['GOOGLE-SEARCH-ESSENTIALS', 'SCHEMA-ORDER'], [
      ['mkt-on-lead-funnel', '线索漏斗与质量分析', '按来源和阶段识别合格线索瓶颈', '营销运营负责人', '每周'],
      ['mkt-on-seo-audit', 'SEO 技术与内容诊断', '形成抓取、索引、内容和结构化数据修复清单', 'SEO 负责人', '月度/版本发布'],
    ]],
  ],
  'mkt-off': [
    ['event-portfolio', '活动组合与立项', '选择活动组合并控制预算、场地和签约风险', ['OPENACTIVE', 'COSO-ERM'], [
      ['mkt-off-event-plan', '活动策划与立项', '形成目标、受众、预算、场地和排期一致方案', '活动负责人', '按项目'],
      ['mkt-off-booth-approve', '展位与场地签约审批', '在成本和日期约束下完成场地决策', '市场负责人', '按签约事件'],
    ]],
    ['event-execution', '现场执行与物料控制', '确保物料合规、现场执行可控、线索可回收', ['OPENACTIVE', 'NIST-PRIVACY'], [
      ['mkt-off-material-review', '物料合规与品牌审查', '对外物料满足法务、品牌和隐私要求', '品牌/法务负责人', '按物料版本'],
      ['mkt-off-event-roi', '活动 ROI 复盘', '比较预算与实际并沉淀可复制的活动经验', '营销运营负责人', '活动结束后'],
    ]],
    ['channel-enablement', '渠道与线索移交', '让经销商执行可衡量、线索可归因、隐私可控制', ['OPENACTIVE', 'SCHEMA-ORDER'], [
      ['mkt-off-vendor-brief', '经销商条款执行简报', '识别条款偏离、渠道风险和整改动作', '渠道负责人', '月度'],
      ['mkt-off-lead-handoff', '线下线索去重与移交', '在脱敏和去重后把线索转为销售机会', '线索运营负责人', '按活动批次'],
    ]],
  ],
  sales: [
    ['pipeline-planning', '目标与管道规划', '把区域目标转为个人目标和健康管道结构', ['SCHEMA-ORDER', 'XBRL'], [
      ['sales-target-split', '销售目标分解', '目标分解守恒且责任人和区域一致', '销售运营负责人', '季度'],
      ['sales-pipeline-report', '管道健康与预测', '按阶段、金额和概率识别管道风险', '销售负责人', '每周'],
    ]],
    ['deal-execution', '报价与成交执行', '以成本、折扣和客户价值约束推进交易', ['SCHEMA-ORDER', 'NIST-AI-RMF'], [
      ['sales-quote-calc', '报价测算', '规格、数量、底价和折扣计算一致', '销售代表/销售运营', '按商机'],
      ['sales-quote-approve', '报价审批', '折扣和风险触发正确审批路径', '销售负责人/CFO', '按报价事件'],
    ]],
    ['contract-revenue', '合同、收入与复盘', '让条款风险、收入确认和打法沉淀闭环', ['SCHEMA-ORDER', 'XBRL'], [
      ['sales-contract-review', '合同条款评审', '回款、责任和法律风险经过会签', '法务/财务/销售负责人', '按合同'],
      ['sales-win-review', '赢单/输单复盘', '形成可复用打法、产品反馈和管道改进', '销售负责人', '月度/按关键商机'],
    ]],
  ],
  fin: [
    ['planning-budget', '预算与经营计划', '让预算、收入和成本口径一致并支持调整', ['XBRL', 'COSO-ERM'], [
      ['fin-budget-review', '预算调整审批', '预算变化有理由、影响和审批链', '财务负责人/部门负责人', '月度/季度'],
      ['fin-monthly-report', '月度经营报告', '收入、成本、净额自洽且可追溯', '财务负责人', '每月'],
    ]],
    ['transaction-control', '交易与费用控制', '用三单匹配和审批控制费用与发票风险', ['XBRL', 'GREATEXPECTATIONS'], [
      ['fin-invoice-check', '发票要素与疑点校验', '税号、抬头、金额、连号和关联单一致', '财务专员', '按发票批次'],
      ['fin-expense-approve', '报销预审与审批', '费用合规、预算充足且审批级别正确', '财务/部门负责人', '按报销单'],
    ]],
    ['treasury-assurance', '资金与合规抽审', '让现金流、抽样审计和整改闭环', ['XBRL', 'COSO-ERM'], [
      ['fin-cashflow-week', '周现金流简报', '流入、流出与余额勾稽且异常可解释', '资金负责人', '每周'],
      ['fin-reimburse-audit', '报销抽审', '抽样比例、问题率和整改动作达到标准', '内控负责人', '月度'],
    ]],
  ],
  rec: [
    ['demand-planning', '需求与招聘标准', '把战略和组织缺口转成岗位标准与招聘节奏', ['HR-OPEN', 'SCHEMA-JOBPOSTING'], [
      ['rec-jd-draft', 'JD 与岗位能力模型', '岗位职责、能力、薪酬带和评价口径一致', '招聘负责人/用人经理', '按岗位需求'],
      ['rec-funnel-weekly', '招聘漏斗与留存复盘', '按渠道和阶段优化质量、速度与 90 天留存', '招聘负责人', '每周/每月'],
    ]],
    ['selection-operations', '筛选与面试运营', '用证据完成筛选、邀约和结构化面试', ['HR-OPEN', 'NIST-PRIVACY', 'NIST-AI-RMF'], [
      ['rec-resume-forward', '简历解析、筛选与外发', '证据、匹配、脱敏和外发审批完整', '招聘专员', '按候选人批次'],
      ['rec-interview-schedule', '面试安排、题库与评分卡', '能力覆盖、无冲突、评分锚点明确', '招聘专员/面试官', '按面试批次'],
    ]],
    ['hiring-closure', '录用、入职与成效', '让面试反馈、Offer、入职和成效闭环', ['HR-OPEN', 'NIST-PRIVACY'], [
      ['rec-offer-approve', '面试反馈综合与 Offer 双审批', '录用证据充分、薪酬合规、双审批完成', '用人经理/HRD', '按候选人'],
      ['rec-onboarding-check', '入职任务与 30/60/90 天成效', '阻断项完成且招聘质量回写战略指标', 'HRBP/用人经理', '按入职批次'],
    ]],
  ],
  trn: [
    ['training-plan', '能力需求与培训计划', '把能力缺口转成预算、学时和课程计划', ['HR-OPEN', 'ISO-30414'], [
      ['trn-plan-approve', '培训计划审批', '课程、预算、学时与能力缺口对齐', '培训负责人/部门负责人', '季度/年度'],
    ]],
    ['learning-delivery', '学习交付与报名', '保证课程排期、讲师、场地和报名条件可控', ['XAPI', 'HR-OPEN'], [
      ['trn-course-schedule', '课程排期与冲突检测', '讲师、场地、学员和时间不冲突', '培训运营', '按课程批次'],
      ['trn-enroll-approve', '报名确认', '名额、前置课与资格条件满足', '培训专员', '按报名批次'],
    ]],
    ['compliance-effectiveness', '证书合规与学习成效', '确保资质不过期、培训有效并被业务验证', ['XAPI', 'ISO-30414'], [
      ['trn-hours-report', '学时统计与补齐计划', '部门、计划和完成学时可追溯', '培训负责人', '月度'],
      ['trn-cert-expiry', '证书到期预警', '90 天预警、过期拦截和责任明确', '合规培训负责人', '每日/每周'],
      ['trn-cert-renew', '证书复审与换证审批', '续期证据、费用和上岗状态一致', '合规负责人', '按证书事件'],
    ]],
  ],
  prf: [
    ['goal-system', '目标与 KPI 系统', '让战略目标分解到部门和个人并可追踪', ['ISO-30414', 'SHRM-HR-QA'], [
      ['prf-cascade-report', '目标分解报告', '目标层级、权重和责任人完整', '绩效负责人', '季度'],
      ['prf-kpi-tracking', 'KPI 跟踪与预警', '实际、目标、权重和风险一致', '部门负责人/绩效运营', '月度'],
    ]],
    ['review-cycle', '考核与反馈周期', '让周期、证据、沟通和改进动作闭环', ['SHRM-HR-QA', 'XAPI'], [
      ['prf-review-cycle', '考核周期发起', '模板、目标、期限和全员覆盖完整', '绩效运营', '季度/年度'],
      ['prf-one-on-one', '一对一沟通纪要', '主题、行动项、责任人和下次时间明确', '直属经理', '月度'],
    ]],
    ['calibration-governance', '校准与分布治理', '用双审批和分布证据保证公平可解释', ['ISO-30414', 'COSO-ERM'], [
      ['prf-calibration-approve', '绩效校准双审批', '等级证据、分歧和审批意见完整', 'HRD/业务负责人', '季度/年度'],
      ['prf-grade-distribution', '等级分布分析', '分布、目标和异常偏差可解释', '绩效负责人', '季度/年度'],
    ]],
  ],
  comp: [
    ['job-architecture', '岗位与薪酬架构', '维护带宽、职级和薪酬公平基线', ['WORLDATWORK-TOTAL-REWARDS', 'ISO-30414'], [
      ['comp-band-report', '薪酬带宽偏离报告', '仅用区间口径识别偏离和公平风险', '薪酬负责人', '季度'],
    ]],
    ['adjustment-planning', '调薪方案与成本测算', '让调薪依据、区间和成本约束可解释', ['WORLDATWORK-TOTAL-REWARDS', 'COSO-ERM'], [
      ['comp-cost-projection', '调薪包成本测算', '情景、比例、成本和预算影响一致', '薪酬/财务负责人', '季度/年度'],
      ['comp-salary-adjust', '个体调薪双审批', '带宽、幅度、理由和双审批完整', '部门负责人/HRD', '按调薪事件'],
    ]],
    ['payroll-controls', '核算、对账与队列审批', '让支付、社保、个税和批量审批一致', ['WORLDATWORK-TOTAL-REWARDS', 'XBRL'], [
      ['comp-payroll-recon', 'Payroll 对账', '应发、实发、差异和项目可追溯', '薪酬/财务', '每月'],
      ['comp-compa-ratio', 'Compa-Ratio 分析', 'CR 分档、带宽与异常可解释', '薪酬负责人', '季度'],
      ['comp-queue-approve', '调薪队列批量审批', '批量影响、预算和授权链完整', 'HRD/CFO', '按批次'],
    ]],
  ],
  ben: [
    ['benefit-design', '福利策略与方案设计', '用成本、满意度和风险选择福利方案', ['WORLDATWORK-TOTAL-REWARDS', 'NIST-PRIVACY'], [
      ['ben-vendor-compare', '福利方案比选', '成本、覆盖、满意度和供应商风险可比较', '福利负责人', '年度/按项目'],
      ['ben-annual-survey', '年度福利满意度调查', '聚合问卷、开放题脱敏并形成改进行动', '福利运营', '年度'],
    ]],
    ['enrollment-experience', '参保与弹性福利', '让参保、积分和资格规则透明可执行', ['HR-OPEN', 'NIST-PRIVACY'], [
      ['ben-plan-enroll', '方案投保/变更审批', '资格、生效日、费用和家属信息合规', '福利负责人', '按参保事件'],
      ['ben-points-calc', '弹性积分测算', '额度、使用和余额守恒', '福利运营', '月度/年度'],
    ]],
    ['claims-health', '理赔与健康聚合', '让理赔服务和健康数据在隐私边界内闭环', ['NIST-PRIVACY', 'EAPA'], [
      ['ben-checkup-report', '体检聚合报告', '只出分布、n<5 抑制、无个体健康原值', '福利/健康负责人', '年度'],
      ['ben-claim-review', '理赔协办周报', '时效、结案和金额区间可控', '福利运营', '每周'],
    ]],
  ],
  admin: [
    ['procurement', '采购与供应商管理', '用三家比价、预算和入库闭环控制成本', ['ISO-55000', 'COSO-ERM'], [
      ['admin-vendor-price', '供应商比价', '报价、最低价、预算和选择理由一致', '采购负责人', '按采购申请'],
      ['admin-purchase-approve', '采购审批', '预算、数量和授权链完整', '行政/财务负责人', '按采购申请'],
      ['admin-supply-order', '用品下单', '引用比价结果并正确登记数量和金额', '行政专员', '按补货批次'],
    ]],
    ['asset-lifecycle', '资产全生命周期', '让采购、分配、盘点、维修和报废闭环', ['ISO-55000'], [
      ['admin-asset-inventory', '资产盘点与差异处理', '账实一致、使用人和状态可追溯', '资产管理员', '季度/年度'],
    ]],
    ['workplace-services', '用印与会议服务', '让高风险动作留痕、会议决议可跟踪', ['ISO-41001', 'BPMN20'], [
      ['admin-seal-request', '用印申请', '用印材料、次数和保管人确认完整', '印章管理员', '按用印事件'],
      ['admin-meeting-minutes', '会议纪要与待办', '决议、责任人、期限和状态明确', '行政/会议秘书', '按会议'],
    ]],
  ],
  cmp: [
    ['policy-control', '制度与培训合规', '把法律/制度要求映射为检查项和整改动作', ['NIST-PRIVACY', 'COSO-ERM'], [
      ['cmp-policy-review', '制度审查 Checklist', '法律依据、检查项、证据和整改期限完整', '合规负责人', '季度/按制度变更'],
      ['cmp-training-check', '合规培训完成度核查', '必修覆盖、完成率和缺口部门可追踪', '合规/培训负责人', '月度/季度'],
    ]],
    ['privacy-ai', '隐私、AI 与证据', '让 PIPIA、风险处置和证据包可验证', ['NIST-PRIVACY', 'NIST-AI-RMF'], [
      ['cmp-pipia-review', 'PIPIA 评审', '处理目的、法律依据、风险和控制措施完整', '隐私负责人', '按新流程/产品'],
      ['cmp-evidence-pack', '审计级证据打包', '证据引用、哈希、时间戳和封存链完整', '合规审计负责人', '按案件/审计'],
    ]],
    ['audit-regulatory', '审计与监管报送', '让留痕覆盖率、整改和监管截止日闭环', ['COSO-ERM', 'XBRL'], [
      ['cmp-audit-trail', '审计留痕月报', '覆盖率、缺口、责任人和整改期限明确', '内审负责人', '每月'],
      ['cmp-reg-filing', '监管报送清单', '主体、材料、截止日和状态完整', '合规申报负责人', '按监管周期'],
    ]],
  ],
  'er-eap': [
    ['case-management', '员工关系案件管理', '让争议、调查、调解和证据链可控', ['SHRM-HR-QA', 'NIST-PRIVACY', 'EAPA'], [
      ['er-eap-dispute-case', '争议案件台账与证据', '阶段、责任人、证据引用和下一步明确', '员工关系负责人', '按案件'],
      ['er-eap-exit-interview', '离职面谈结构化', '原因、改进项和再雇佣建议脱敏留痕', 'HRBP', '按离职事件'],
    ]],
    ['offboarding', '离职与权限资产回收', '让离职审批、交接、资产和合同终止闭环', ['BPMN20', 'ISO-55000'], [
      ['er-eap-offboard-approve', '离职流程与双审批', '交接、资产、权限、合同和薪酬结算完成', 'HRD/员工关系负责人', '按离职事件'],
    ]],
    ['employee-care', 'EAP 匿名支持与组织健康', '在匿名、禁网和严格隐私边界下提供支持', ['EAPA', 'NIST-PRIVACY'], [
      ['er-eap-eap-referral', 'EAP 匿名转介', '仅匿名编号、双审批和独立命名空间', 'EAP 专员/主管', '按转介事件'],
      ['er-eap-anon-report', 'EAP 匿名使用月报', '只出聚合、n<5 抑制、无个体可识别信息', 'EAP 负责人', '每月'],
      ['er-eap-wellbeing-check', '组织健康脉搏', '维度、样本量、趋势和抑制规则完整', '员工体验负责人', '月度/季度'],
    ]],
  ],
};

const WORKFLOW_TO_ITEM = {};
for (const [domain, modules] of Object.entries(MODULE_DESIGNS)) {
  for (const [moduleId, moduleName, moduleOutcome, benchmarkRefs, items] of modules) {
    for (const [itemId, itemName, itemOutcome, ownerRole, frequency] of items) {
      const workflow = findWorkflowForItem(domain, itemId);
      if (!workflow) throw new Error(`事项未匹配工作流：${itemId}`);
      if (WORKFLOW_TO_ITEM[workflow.workflow_id]) throw new Error(`工作流重复绑定：${workflow.workflow_id}`);
      WORKFLOW_TO_ITEM[workflow.workflow_id] = {
        moduleId,
        moduleName,
        moduleOutcome,
        benchmarkRefs,
        itemId,
        itemName,
        itemOutcome,
        ownerRole,
        frequency,
      };
    }
  }
}

const missing = WORKFLOW_INDEX.workflows.map((workflow) => workflow.workflow_id).filter((id) => !WORKFLOW_TO_ITEM[id]);
if (missing.length) throw new Error(`有工作流未映射到事项：\n${missing.join('\n')}`);
const extra = Object.keys(WORKFLOW_TO_ITEM).filter((id) => !workflowById[id]);
if (extra.length) throw new Error(`存在无效工作流映射：\n${extra.join('\n')}`);

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function inferType(field, value) {
  const name = String(field || '').toLowerCase();
  if (/(^|_)(at|datetime)$/.test(name) || /(_at|_time)$/.test(name)) return { type: 'string', format: 'date-time' };
  if (/(date|deadline|due|last_day|effective|expire|next_review)/.test(name)) return { type: 'string', format: 'date' };
  if (/(flag|_ok$|checked|selected|retained|rehire|exclusive|suppressed)/.test(name)) return { type: 'boolean' };
  if (/(items|list|risks|refs|approvals|evidence|recommendations|findings|competenc|goals|conflicts|quotes|vendors|reasons|actions|todos|owners|highlights|channels|targets)/.test(name)) return { type: 'array', items: { type: 'string' } };
  if (/(summary|band|offer_band|criteria_results|feedback_summary|proposed_range|scorecard|question_bank|data_categories)/.test(name)) return { type: 'object' };
  if (/(count|qty|headcount|sessions|days_left|rank|^n$|orders|seats|sample_size)/.test(name)) return { type: 'integer' };
  if (/(amount|price|cost|budget|revenue|net|total|rate|pct|score|roi|hours|days|weight|confidence|delta|impact|balance|salary|fee|lead_days|sellthrough|cr$)/.test(name)) return { type: 'number' };
  if (value !== undefined && value !== '' && !Number.isNaN(Number(value))) return { type: 'number' };
  return { type: 'string' };
}

function fieldDescription(model, field) {
  const dictionaries = [];
  for (const section of Object.values(model.sections || {})) {
    for (const block of section.blocks || []) {
      for (const table of block.tables || []) {
        const header = table.header || [];
        const nameIndex = header.findIndex((item) => /字段名|field/i.test(item));
        const descriptionIndex = header.findIndex((item) => /说明|含义|description/i.test(item));
        if (nameIndex >= 0 && descriptionIndex >= 0) {
          for (const row of table.rows || []) if (row[nameIndex] === field) dictionaries.push(row[descriptionIndex]);
        }
      }
    }
  }
  return dictionaries[0] || '';
}

function sourceFieldInfo(model, field) {
  for (const table of model.tables || []) {
    if ((table.columns || []).includes(field)) {
      return {
        source: `${model.domain}/${table.file}`,
        pii: (table.pii_likely || []).includes(field),
        required: true,
      };
    }
  }
  return { source: 'workflow_input_or_user_upload', pii: /phone|idcard|taxid|bank|salary|employee|applicant|customer|contact/.test(field), required: true };
}

function stageStandards(workflow, item, model, benchmarkRefs) {
  const approval = workflow.approval || ((workflow.hitl_nodes || []).length
    ? {
      node: (workflow.hitl_nodes || [])[0],
      level: model.level,
      dual: !!workflow.dual,
    }
    : null);
  const redact = model.redact_fields || [];
  const sourceTables = (model.tables || []).map((table) => table.file);
  const base = {
    owner_role: item.owner_role,
    entry_criteria: '上游阶段通过且实例 revision、策略版本和数据版本可读取',
    input_contract_ref: `manifests/workflow-contracts/${model.domain}.json#${workflow.workflow_id}/stage_contracts/intake/input`,
    output_contract_ref: `manifests/workflow-contracts/${model.domain}.json#${workflow.workflow_id}/stage_contracts/intake/output`,
    evidence: ['source_refs', 'file_hashes', 'data_version'],
    timeout_seconds: 300,
    retry_policy: { max_attempts: 1, backoff: 'none' },
    idempotency_key: '${instance_id}:${stage_id}:${revision}',
    ui_help: '按字段说明填写；来源必须引用具体表、文件或上游实例。',
    failure_severity: 'blocking',
  };
  const stages = [
    {
      ...base,
      id: 'intake',
      type: 'data_intake',
      name: '业务输入与资料接收',
      inputs: workflow.deliverable.fields,
      outputs: ['validated_input_payload', 'source_refs', 'file_hashes'],
      standard: `必填字段 ${workflow.deliverable.fields.join('、')} 完整；来源、上传文件、数据版本和文件哈希可追溯。`,
      gate: 'required_fields_and_upload_safety',
      on_fail: 'retain_draft_and_request_user_input',
      rule_refs: [`${item.id}-INPUT-REQUIRED`, `${item.id}-SOURCE-TRACEABLE`],
    },
    {
      ...base,
      id: 'validate',
      type: 'rule_gate',
      name: '结构与业务规则校验',
      inputs: ['validated_input_payload', ...sourceTables],
      outputs: ['validation_report', 'normalized_payload'],
      standard: `${workflow.deliverable.acceptance}；字段类型、枚举、区间、单位、主外键和血缘必须按 TypeDict 校验。`,
      gate: 'typedict_and_domain_rules',
      on_fail: 'field_level_error_without_write',
      rule_refs: [`${item.id}-DOMAIN-RULE`, `${item.id}-TYPEDICT`],
      benchmark_refs: benchmarkRefs.filter((id) => ['TABLESCHEMA1', 'GREATEXPECTATIONS', 'OPENLINEAGE153'].includes(id)),
    },
    {
      ...base,
      id: 'llm',
      type: 'llm_task',
      name: 'LLM 结构化分析与生成',
      inputs: ['normalized_payload', 'skill_and_policy_version'],
      outputs: ['summary', 'findings', 'recommendations', 'confidence', 'evidence_refs'],
      standard: `使用技能 ${workflow.skill} 和当前策略版本；输出必须符合 JSON Schema，结论逐项引用 evidence_refs，confidence 为 0-1，未知字段、无证据结论和 PII 一律拒绝。`,
      gate: 'schema_citation_pii_model_availability',
      on_fail: 'blocked_model_or_quality_retry',
      rule_refs: [`${item.id}-LLM-SCHEMA`, `${item.id}-LLM-EVIDENCE`, `${item.id}-LLM-PII`],
      benchmark_refs: benchmarkRefs.filter((id) => ['NIST-AI-RMF', 'JSONSCHEMA202012', 'OPENLINEAGE153'].includes(id)),
      timeout_seconds: 240000,
      retry_policy: { max_attempts: 1, backoff: 'manual_after_credentials_restore' },
      ui_help: '模型失败会保留草稿并进入 blocked_model；恢复凭据后可从断点继续。',
    },
    {
      ...base,
      id: 'quality',
      type: 'quality_gate',
      name: '质量、证据与一致性复核',
      inputs: ['llm_result', 'source_refs', 'business_metric_definitions'],
      outputs: ['quality_score', 'approved_analysis', 'redaction_log'],
      standard: `业务验收：${workflow.deliverable.acceptance}；证据引用可解析，金额、数量、比例和阶段人数守恒，结论与指标定义不冲突。`,
      gate: 'Great-Expectations-style_assertions',
      on_fail: 'retry_then_manual_review',
      rule_refs: [`${item.id}-QUALITY-EVIDENCE`, `${item.id}-QUALITY-CONSISTENCY`],
      benchmark_refs: ['GREATEXPECTATIONS', 'OPENLINEAGE153'],
    },
    approval ? {
      ...base,
      id: 'approval',
      type: 'human_approval',
      name: '人工审批',
      inputs: ['approved_analysis', 'data_version', 'artifact_hash'],
      outputs: ['approval_records', 'rejection_reason_or_approval_hash'],
      standard: `审批等级 ${approval.level}；${approval.dual ? '双审批必须两个不同角色和两个不同操作者' : '单审批需角色、操作者签名和意见'}；签名绑定 workflow、instance、revision、数据版本、草稿哈希、决定和时间。`,
      gate: approval.dual ? 'distinct_identity_role_and_operator' : 'registered_identity_signed_role',
      on_fail: 'reject_and_preserve_draft',
      rule_refs: [`${item.id}-APPROVAL-IDENTITY`, `${item.id}-APPROVAL-BINDING`],
      benchmark_refs: ['BPMN20', 'NIST-AI-RMF'],
      timeout_seconds: 86400,
      ui_help: '从本地身份注册表选择操作者与已授权角色，不能自由填写身份。',
    } : {
      ...base,
      id: 'approval',
      type: 'no_human_approval',
      name: '免人工审批声明',
      inputs: ['approved_analysis', 'quality_score'],
      outputs: ['approval_policy_evaluation'],
      standard: '仅允许无对外、无生效、无高风险个体数据的流程免审批；策略评估必须留痕，出现对外或不可逆动作时升级人工审批。',
      gate: 'no_external_or_irreversible_action',
      on_fail: 'escalate_to_human',
      rule_refs: [`${item.id}-NO-APPROVAL-POLICY`],
      benchmark_refs: ['COSO-ERM'],
      ui_help: '本流程不生成正式审批件；但外部发送、生效或高风险动作仍会被门禁阻断。',
    },
    {
      ...base,
      id: 'publish',
      type: 'writeback_and_delivery',
      name: '业务落盘与交付物生成',
      inputs: ['approved_analysis', 'approval_records', 'source_data_version'],
      outputs: ['instance_result_json', 'report_markdown', '7_format_package', 'artifact_manifest'],
      standard: '写前备份，原子写入；产物含来源、审批、数据版本和 SHA-256；Markdown/CSV/HTML/XLSX/DOCX/PPTX/PDF 必须通过结构、公式、文本、哈希和重新打开校验。',
      gate: 'backup_atomic_write_and_format_validation',
      on_fail: 'rollback_to_pre_write_snapshot',
      rule_refs: [`${item.id}-DELIVERY-MANIFEST`, `${item.id}-DELIVERY-FORMATS`, `${item.id}-DELIVERY-HASH`],
      benchmark_refs: ['TABLESCHEMA1', 'OPENLINEAGE153'],
      timeout_seconds: 600,
      retry_policy: { max_attempts: 1, backoff: 'rollback_first' },
    },
    {
      ...base,
      id: 'outcome',
      type: 'outcome_evaluation',
      name: '成效与质量评估',
      inputs: ['artifact_manifest', 'business_outcome_data'],
      outputs: ['metric_snapshot', 'quality_evaluation', 'next_actions'],
      standard: `回写域北极星“${STRATEGY.domains[model.domain].north_star}”并链接 ${(STRATEGY.domains[model.domain].contributes_to || []).join('、')}；结果可下钻到实例、源表和产物，未成熟结果保持 pending。`,
      gate: 'metric_lineage_and_data_freshness',
      on_fail: 'mark_outcome_pending',
      rule_refs: [`${item.id}-OUTCOME-LINEAGE`, `${item.id}-OUTCOME-FRESHNESS`],
      benchmark_refs: ['XBRL', 'ISO-30414'],
    },
    {
      ...base,
      id: 'strategy_rollup',
      type: 'strategy_writeback',
      name: '战略回写与下一周期行动',
      inputs: ['metric_snapshot', 'strategy_model', 'instance_evidence'],
      outputs: ['strategy_contribution', 'variance_reason', 'next_period_actions'],
      standard: `按 KR 权重回写 ${(STRATEGY.domains[model.domain].contributes_to || []).join('、')}，输出偏差原因、置信度和下一周期行动；禁止手工覆盖来源可追溯的正式数值。`,
      gate: 'strategy_versioned_contribution',
      on_fail: 'mark_strategy_pending',
      rule_refs: [`${item.id}-STRATEGY-WRITEBACK`, `${item.id}-STRATEGY-VARIANCE`],
      benchmark_refs: ['COSO-ERM', 'XBRL'],
    },
  ];
  if (redact.length) {
    stages[1].standard += `；脱敏字段 ${redact.join('、')} 只能以掩码或区间形式进入后续阶段。`;
  }
  return stages;
}

function itemBusinessRules(domain, itemId, workflow, model, benchmarkRefs) {
  const clauses = String(workflow.deliverable.acceptance || '')
    .split(/[；;。]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const rules = [
    {
      id: `${itemId}-INPUT-REQUIRED`,
      kind: 'invariant',
      severity: 'blocking',
      expression: `all_required(${workflow.deliverable.fields.join(',')})`,
      evidence: ['validated_input_payload', 'source_refs'],
      source: 'workflow_contract',
    },
    {
      id: `${itemId}-SOURCE-TRACEABLE`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'source_refs.length >= 1 && file_hashes.valid',
      evidence: ['source_refs', 'file_hashes'],
      source: 'OPENLINEAGE153',
    },
    {
      id: `${itemId}-TYPEDICT`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'types_enums_ranges_units_keys_valid',
      evidence: ['validation_report', 'typedict_ref'],
      source: 'TABLESCHEMA1',
    },
    {
      id: `${itemId}-DOMAIN-RULE`,
      kind: 'domain_rule',
      severity: 'blocking',
      expression: workflow.deliverable.acceptance,
      evidence: ['validation_report', 'source_refs'],
      source: benchmarkRefs.length ? benchmarkRefs.join('|') : 'workflow_acceptance',
      status: 'active',
    },
    {
      id: `${itemId}-LLM-SCHEMA`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'model_output.matches(workflow_output_schema)',
      evidence: ['model', 'prompt_version', 'output_schema'],
      source: 'JSONSCHEMA202012',
    },
    {
      id: `${itemId}-LLM-EVIDENCE`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'findings.every(has_evidence_ref) && confidence in [0,1]',
      evidence: ['evidence_refs', 'confidence'],
      source: 'NIST-AI-RMF',
    },
    {
      id: `${itemId}-LLM-PII`,
      kind: 'policy',
      severity: 'blocking',
      expression: 'pii_scan(model_input, model_output, logs, memory, deliverables) == clean',
      evidence: ['redaction_log'],
      source: 'NIST-PRIVACY',
      status: 'invariant',
    },
    {
      id: `${itemId}-QUALITY-EVIDENCE`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'evidence_refs.every(resolvable)',
      evidence: ['quality_score', 'source_refs'],
      source: 'GREATEXPECTATIONS',
    },
    {
      id: `${itemId}-QUALITY-CONSISTENCY`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'amounts_quantities_rates_funnel_reconcile',
      evidence: ['quality_score', 'business_metric_definitions'],
      source: 'GREATEXPECTATIONS',
    },
    {
      id: `${itemId}-DELIVERY-MANIFEST`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'artifact_manifest.complete && artifacts.every(has_sha256)',
      evidence: ['artifact_manifest'],
      source: 'OPENLINEAGE153',
    },
    {
      id: `${itemId}-DELIVERY-FORMATS`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'formats == [md,csv,html,xlsx,docx,pptx,pdf] && reopen_ok',
      evidence: ['delivery_manifest'],
      source: 'workflow_contract',
    },
    {
      id: `${itemId}-DELIVERY-HASH`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'sha256_before == sha256_after',
      evidence: ['artifact_manifest'],
      source: 'workflow_contract',
    },
    {
      id: `${itemId}-OUTCOME-LINEAGE`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'metric_snapshot.has_instance_source_and_artifact_refs',
      evidence: ['metric_snapshot', 'artifact_manifest'],
      source: 'XBRL',
    },
    {
      id: `${itemId}-OUTCOME-FRESHNESS`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'outcome_data_date <= now && maturity_policy_satisfied',
      evidence: ['business_outcome_data', 'quality_evaluation'],
      source: 'ISO-30414',
    },
    {
      id: `${itemId}-STRATEGY-WRITEBACK`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'contribution_references_metric_snapshot_and_data_version',
      evidence: ['strategy_contribution', 'metric_snapshot'],
      source: 'COSO-ERM',
    },
    {
      id: `${itemId}-STRATEGY-VARIANCE`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'variance_reason && next_period_actions.length >= 1',
      evidence: ['variance_reason', 'next_period_actions'],
      source: 'XBRL',
    },
  ];
  const approval = workflow.approval || ((workflow.hitl_nodes || []).length ? { dual: !!workflow.dual, level: model.level } : null);
  if (approval) {
    rules.splice(8, 0,
      {
        id: `${itemId}-APPROVAL-IDENTITY`,
        kind: 'invariant',
        severity: 'blocking',
        expression: approval.dual
          ? 'distinct(operator_id, role) == 2 && all_registered_and_authorized'
          : 'registered_operator && authorized_role',
        evidence: ['approval_records', 'operator_registry'],
        source: 'BPMN20',
      },
      {
        id: `${itemId}-APPROVAL-BINDING`,
        kind: 'invariant',
        severity: 'blocking',
        expression: 'hmac_valid && workflow_id && instance_id && revision && data_version && artifact_hash',
        evidence: ['approval_records'],
        source: 'NIST-AI-RMF',
      });
  } else {
    rules.splice(8, 0, {
      id: `${itemId}-NO-APPROVAL-POLICY`,
      kind: 'invariant',
      severity: 'blocking',
      expression: 'no_external_send && no_effective_change && no_high_risk_individual_data',
      evidence: ['approval_policy_evaluation'],
      source: 'COSO-ERM',
    });
  }
  for (const [index, clause] of clauses.entries()) {
    const threshold = /[%≥≤<>]|\d/.test(clause);
    rules.push({
      id: `${itemId}-ACCEPT-${index + 1}`,
      kind: threshold ? 'policy_threshold' : 'domain_rule',
      severity: 'blocking',
      expression: clause,
      evidence: ['validation_report', 'quality_score', 'artifact_manifest'],
      source: benchmarkRefs.length ? benchmarkRefs.join('|') : 'workflow_acceptance',
      status: threshold ? 'draft_requires_owner_confirmation' : 'active',
    });
  }
  return rules.map((rule) => ({ status: 'active', ...rule }));
}

function approvalRoles(ownerRole, dual) {
  const owners = String(ownerRole || '业务负责人')
    .split('/')
    .map((role) => role.trim())
    .filter(Boolean);
  if (!dual) return [owners[0] || '业务负责人'];
  return [...new Set([owners[0] || '业务负责人', '风险负责人'])];
}

function buildDomainDesign(domain, model) {
  const modules = MODULE_DESIGNS[domain];
  if (!modules) throw new Error(`缺少模块设计：${domain}`);
  const benchmarkSet = new Set(['BPMN20', 'JSONSCHEMA202012', 'OPENAPI321', 'TABLESCHEMA1', 'OPENLINEAGE153', 'GREATEXPECTATIONS', 'NIST-PRIVACY', 'NIST-AI-RMF']);
  const output = {
    schema: 'pids-nexus/domain-work-design/v1',
    domain,
    label: model.label,
    level: model.level,
    north_star: STRATEGY.domains[domain].north_star,
    contributes_to: STRATEGY.domains[domain].contributes_to,
    modules: [],
  };
  for (const [moduleId, moduleName, moduleOutcome, benchmarkRefs, items] of modules) {
    const module = {
      id: moduleId,
      name: moduleName,
      outcome: moduleOutcome,
      benchmark_refs: benchmarkRefs,
      items: [],
    };
    for (const itemSpec of items) {
      const [itemId, itemName, itemOutcome, ownerRole, frequency] = itemSpec;
      const workflow = findWorkflowForItem(domain, itemId);
      if (!workflow) throw new Error(`事项未匹配工作流：${domain}/${itemId}`);
      const itemBenchmarks = [...new Set([...benchmarkRefs, ...(workflow.domain === 'rec' ? ['HR-OPEN', 'SCHEMA-JOBPOSTING'] : [])])]
        .filter((id) => BENCHMARKS.some((source) => source.id === id));
      const dataContractRef = `manifests/workflow-contracts/${domain}.json#${workflow.workflow_id}`;
      const typedictRef = `manifests/typedict/${domain}.json`;
      const effects = (CROSS_DOMAIN_EFFECTS[workflow.workflow_id] || []).map(([eventId, targetDomain, payloadKey, keyType], index) => ({
        event_id: eventId,
        target_domain: targetDomain,
        trigger_stage: 'strategy_rollup',
        payload_key: payloadKey,
        anonymous_key: keyType,
        delivery: 'append_only_event',
        idempotency_key: `${eventId}:${index}:\${instance_id}`,
        on_fail: 'retain_outbox_and_retry',
      }));
      const item = {
        id: itemId,
        name: itemName,
        outcome: itemOutcome,
        owner_role: ownerRole,
        frequency,
        workflow: {
          id: workflow.workflow_id,
          description: workflow.description,
          kind: workflow.kind,
          skill: workflow.skill,
          trigger: workflow.trigger,
          nodes: workflow.nodes,
          deliverable: workflow.deliverable,
          approval: workflow.approval || ((workflow.hitl_nodes || []).length
            ? {
              node: (workflow.hitl_nodes || [])[0],
              level: model.level,
              dual: !!workflow.dual,
              required_roles: approvalRoles(ownerRole, !!workflow.dual),
            }
            : null),
        },
        stages: stageStandards(workflow, { id: itemId, name: itemName, owner_role: ownerRole }, model, itemBenchmarks),
        business_rules: itemBusinessRules(domain, itemId, workflow, model, itemBenchmarks),
        cross_domain_effects: effects,
        data_contract: {
          input_schema_ref: `${dataContractRef}/input`,
          output_schema_ref: `${dataContractRef}/output`,
          typedict_ref: typedictRef,
          source_tables: (model.tables || []).map((table) => table.file),
          source_refs_required: true,
        },
        controls: {
          min_level: model.level,
          redact_fields: model.redact_fields || [],
          memory: model.memory || {},
          backup: 'pre_write_snapshot',
          audit: 'append_only_jsonl',
        },
        metrics: [STRATEGY.domains[domain].north_star, ...STRATEGY.domains[domain].contributes_to],
        benchmark_refs: itemBenchmarks,
      };
      if (item.workflow.approval) {
        item.workflow.approval.required_roles = item.workflow.approval.required_roles
          || approvalRoles(ownerRole, !!item.workflow.approval.dual);
      }
      for (const stage of item.stages) {
        stage.input_contract_ref = `manifests/workflow-contracts/${domain}.json#${workflow.workflow_id}/stage_contracts/${stage.id}/input`;
        stage.output_contract_ref = `manifests/workflow-contracts/${domain}.json#${workflow.workflow_id}/stage_contracts/${stage.id}/output`;
      }
      module.items.push(item);
      itemBenchmarks.forEach((id) => benchmarkSet.add(id));
    }
    output.modules.push(module);
  }
  output.benchmark_refs = [...benchmarkSet].filter((id) => BENCHMARKS.some((source) => source.id === id));
  return output;
}

function semanticTypeForField(field) {
  const name = String(field).toLowerCase();
  if (/(^|_)(id|key|no|code)$/.test(name) || /(_id|_key|_no|_code)$/.test(name)) return 'identifier';
  if (/(amount|budget|cost|revenue|net|salary|price|fee|balance|wan|yuan)/.test(name)) return 'money';
  if (/(rate|pct|ratio|conversion|progress|score|confidence)/.test(name)) return 'measure';
  if (/(date|month|week|quarter|period|deadline|due|expire|effective|review)/.test(name)) return 'temporal';
  if (/(status|stage|result|level|band|type|category|mode|zone|risk)/.test(name)) return 'categorical';
  if (/(flag|ok|enabled|approved|retained|suppressed)/.test(name)) return 'boolean';
  if (/(summary|note|reason|comment|description|detail|mission|requirement)/.test(name)) return 'text';
  return 'attribute';
}

function unitForField(field) {
  const name = String(field).toLowerCase();
  if (/wan$|_wan|万元/.test(name)) return '万元';
  if (/yuan$|_yuan|元$/.test(name)) return '元';
  if (/k$|_k/.test(name)) return '千元';
  if (/pct|percent|_rate|ratio|progress/.test(name)) return '%';
  if (/hours?|_hours/.test(name)) return '小时';
  if (/days?|_days/.test(name)) return '天';
  if (/count|qty|headcount|sample_size|seats/.test(name)) return '个';
  return '';
}

function enumValuesForField(field, values) {
  const name = String(field).toLowerCase();
  if (!/(status|stage|result|level|band|type|category|mode|zone|risk|direction|decision)/.test(name)) return [];
  const unique = [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
  return unique.length > 0 && unique.length <= 12 ? unique : [];
}

function constraintsForField(field, values, inferred) {
  const constraints = [];
  if (inferred.type === 'number' || inferred.type === 'integer') {
    const numbers = values.map(Number).filter(Number.isFinite);
    if (numbers.length) {
      constraints.push({ kind: 'minimum', value: Math.min(...numbers) });
      constraints.push({ kind: 'maximum', value: Math.max(...numbers) });
    }
  }
  if (/phone/.test(field)) constraints.push({ kind: 'masked_pattern', value: '1XX****XXXX' });
  if (/idcard|id_number/.test(field)) constraints.push({ kind: 'masked_pattern', value: '********XXXX' });
  if (/email/.test(field)) constraints.push({ kind: 'masked_pattern', value: '***@***' });
  return constraints;
}

function foreignKeyForField(field) {
  const known = [
    'person_key',
    'position_key',
    'customer_key',
    'contract_key',
    'initiative_key',
    'trace_id',
  ];
  return known.includes(field) ? { table: 'manifests/strategy-model.json', field } : null;
}

function buildTypedict(domain, model, design) {
  const fields = new Map();
  for (const table of model.tables || []) {
    const csvPath = path.join(ROOT, 'templates', 'workspace', 'data', domain, table.file);
    const rows = fs.existsSync(csvPath) ? parseCsv(fs.readFileSync(csvPath, 'utf8')) : [];
    const headers = rows[0] || table.columns || [];
    for (const field of headers) {
      const info = sourceFieldInfo(model, field);
      const values = rows.slice(1).map((row) => row[headers.indexOf(field)]).filter((value) => value !== '' && value != null);
      const inferred = inferType(field, values[0] || '');
      fields.set(`${table.file}:${field}`, {
        id: `${table.file}:${field}`,
        entity: table.file,
        field,
        physical_type: 'csv',
        logical_type: inferred.type,
        format: inferred.format || null,
        semantic_type: semanticTypeForField(field),
        unit: unitForField(field),
        nullable: false,
        enum_values: enumValuesForField(field, values),
        constraints: constraintsForField(field, values, inferred),
        example: values[0] || '',
        foreign_key: foreignKeyForField(field),
        required: true,
        source: info.source,
        pii: info.pii,
        level: model.level,
        description: fieldDescription(model, field),
        lineage: {
          upstream: [`dataset:${domain}/${table.file}`, `field:${field}`],
          downstream: [],
        },
        used_by_workflows: [],
      });
    }
  }
  for (const module of design.modules) {
    for (const item of module.items) {
      const workflowId = item.workflow.id;
      for (const field of item.workflow.deliverable.fields) {
        const sourceInfo = sourceFieldInfo(model, field);
        const inferred = inferType(field);
        const id = `workflow_output:${workflowId}:${field}`;
        const existing = fields.get(id);
        fields.set(id, {
          id,
          entity: `workflow_output/${workflowId.split('@')[0]}`,
          field,
          physical_type: 'json',
          logical_type: inferred.type,
          format: inferred.format || null,
          semantic_type: semanticTypeForField(field),
          unit: unitForField(field),
          nullable: false,
          enum_values: enumValuesForField(field, []),
          constraints: constraintsForField(field, [], inferred),
          example: '',
          foreign_key: foreignKeyForField(field),
          required: true,
          source: sourceInfo.source,
          pii: sourceInfo.pii || (model.redact_fields || []).includes(field),
          level: model.level,
          description: fieldDescription(model, field),
          lineage: {
            upstream: [`workflow:${workflowId}`, 'stage:quality'],
            downstream: ['artifact_manifest', ...(STRATEGY.domains[domain]?.contributes_to || [])],
          },
          used_by_workflows: [...new Set([...(existing?.used_by_workflows || []), workflowId])],
        });
      }
    }
  }
  return {
    schema: 'pids-nexus/typedict/v1',
    domain,
    label: model.label,
    source_standard: 'Frictionless Table Schema v1 + JSON Schema 2020-12',
    fields: [...fields.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function jsonSchemaForField(field, definition) {
  const inferred = inferType(field, definition);
  const schema = { type: inferred.type };
  if (inferred.format) schema.format = inferred.format;
  if (inferred.items) schema.items = inferred.items;
  schema.description = definition?.description || field;
  return schema;
}

function schemaObject(id, required, properties, description = '') {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    title: description || id,
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  };
}

function schemaForStage(domain, workflowId, stage, typedict) {
  const stringArray = { type: 'array', minItems: 1, items: { type: 'string' } };
  const objectValue = { type: 'object' };
  const props = {
    normalized_payload: objectValue,
    validation_report: objectValue,
    llm_result: objectValue,
    approved_analysis: objectValue,
    approval_records: { type: 'array', items: { type: 'object' } },
    artifact_manifest: objectValue,
    metric_snapshot: objectValue,
    business_outcome_data: objectValue,
  };
  let inputs = { normalized_payload: objectValue };
  let outputs = { validation_report: objectValue };
  if (stage.id === 'intake') {
    inputs = Object.fromEntries(stage.inputs.map((field) => {
      const definition = typedict.fields.find((entry) => entry.field === field) || {};
      return [field, jsonSchemaForField(field, definition)];
    }));
    inputs.notes = { type: 'string' };
    inputs.source_refs = stringArray;
    inputs.uploaded_files = { type: 'array', items: { type: 'object' } };
    outputs = {
      validated_input_payload: objectValue,
      source_refs: stringArray,
      file_hashes: { type: 'array', minItems: 1, items: { type: 'object' } },
    };
  } else if (stage.id === 'validate') {
    inputs = {
      validated_input_payload: objectValue,
      source_tables: stringArray,
    };
    outputs = {
      validation_report: objectValue,
      normalized_payload: objectValue,
    };
  } else if (stage.id === 'llm') {
    inputs = {
      normalized_payload: objectValue,
      skill: { type: 'string', minLength: 1 },
      policy_version: { type: 'string', minLength: 1 },
    };
    outputs = {
      summary: { type: 'string', minLength: 1 },
      findings: { type: 'array', minItems: 1, items: { type: 'object' } },
      recommendations: { type: 'array', minItems: 1, items: { type: 'object' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      evidence_refs: stringArray,
      redactions: { type: 'array', items: { type: 'string' } },
    };
  } else if (stage.id === 'quality') {
    inputs = {
      llm_result: objectValue,
      source_refs: stringArray,
      business_metric_definitions: objectValue,
    };
    outputs = {
      quality_score: { type: 'number', minimum: 0, maximum: 1 },
      approved_analysis: objectValue,
      redaction_log: { type: 'array', items: { type: 'object' } },
    };
  } else if (stage.id === 'approval') {
    inputs = {
      approved_analysis: objectValue,
      data_version: { type: 'string', minLength: 8 },
      artifact_hash: { type: 'string', minLength: 32 },
    };
    outputs = stage.type === 'human_approval'
      ? {
        approval_records: { type: 'array', minItems: 1, items: { type: 'object' } },
        rejection_reason_or_approval_hash: { type: 'string', minLength: 1 },
      }
      : { approval_policy_evaluation: objectValue };
  } else if (stage.id === 'publish') {
    inputs = {
      approved_analysis: objectValue,
      approval_records: { type: 'array', items: { type: 'object' } },
      source_data_version: { type: 'string', minLength: 8 },
    };
    outputs = {
      instance_result_json: objectValue,
      report_markdown: { type: 'string', minLength: 1 },
      format_package: { type: 'array', minItems: 7, items: { type: 'object' } },
      artifact_manifest: objectValue,
    };
  } else if (stage.id === 'outcome') {
    inputs = {
      artifact_manifest: objectValue,
      business_outcome_data: objectValue,
    };
    outputs = {
      metric_snapshot: objectValue,
      quality_evaluation: objectValue,
      next_actions: { type: 'array', minItems: 1, items: { type: 'object' } },
    };
  } else if (stage.id === 'strategy_rollup') {
    inputs = {
      metric_snapshot: objectValue,
      strategy_model: objectValue,
      instance_evidence: objectValue,
    };
    outputs = {
      strategy_contribution: objectValue,
      variance_reason: { type: 'string', minLength: 1 },
      next_period_actions: { type: 'array', minItems: 1, items: { type: 'object' } },
    };
  }
  return {
    input: schemaObject(
      `urn:pids-nexus:${domain}:${workflowId}:stage:${stage.id}:input`,
      Object.keys(inputs),
      inputs,
      `${stage.name} input`,
    ),
    output: schemaObject(
      `urn:pids-nexus:${domain}:${workflowId}:stage:${stage.id}:output`,
      Object.keys(outputs),
      outputs,
      `${stage.name} output`,
    ),
  };
}

function buildContracts(domain, model, design, typedict) {
  const definitions = {};
  for (const module of design.modules) {
    for (const item of module.items) {
      const fields = item.workflow.deliverable.fields;
      const inputProperties = {};
      const outputProperties = {};
      for (const field of fields) {
        const definition = typedict.fields.find((entry) => entry.field === field) || {};
        inputProperties[field] = jsonSchemaForField(field, definition);
        outputProperties[field] = jsonSchemaForField(field, definition);
      }
      const stageContracts = Object.fromEntries(
        item.stages.map((stage) => [stage.id, schemaForStage(domain, item.workflow.id, stage, typedict)]),
      );
      definitions[item.workflow.id] = {
        workflow_id: item.workflow.id,
        module_id: module.id,
        work_item_id: item.id,
        input: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: `urn:pids-nexus:${domain}:${item.workflow.id}:input`,
          type: 'object',
          additionalProperties: false,
          required: fields,
          properties: {
            ...inputProperties,
            notes: { type: 'string', description: '补充业务背景、范围和约束' },
            source_refs: { type: 'array', items: { type: 'string' }, minItems: 1, description: '来源表、文件或上游实例引用' },
            uploaded_files: { type: 'array', items: { type: 'object' }, description: '用户上传文件元数据和哈希' },
          },
        },
        output: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: `urn:pids-nexus:${domain}:${item.workflow.id}:output`,
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'findings', 'recommendations', 'confidence', 'evidence_refs', 'deliverable'],
          properties: {
            summary: { type: 'string', minLength: 1 },
            findings: { type: 'array', minItems: 1, items: { type: 'object' } },
            recommendations: { type: 'array', minItems: 1, items: { type: 'object' } },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            evidence_refs: { type: 'array', minItems: 1, items: { type: 'string' } },
            redactions: { type: 'array', items: { type: 'string' } },
            deliverable: {
              type: 'object',
              additionalProperties: false,
              required: fields,
              properties: outputProperties,
            },
          },
        },
        acceptance: item.workflow.deliverable.acceptance,
        business_rules: item.business_rules,
        cross_domain_effects: item.cross_domain_effects,
        stage_contracts: stageContracts,
        stages: item.stages.map((stage) => ({ id: stage.id, type: stage.type, standard: stage.standard, gate: stage.gate })),
      };
    }
  }
  return {
    schema: 'pids-nexus/workflow-contracts/v1',
    domain,
    source_standards: ['JSONSCHEMA202012', 'TABLESCHEMA1', 'BPMN20', 'OPENLINEAGE153'],
    contracts: definitions,
  };
}

function markdownForDomain(design, typedict, contracts) {
  const lines = [
    `# ${design.label} · 工作模块与闭环设计`,
    '',
    `- 北极星：${design.north_star}`,
    `- 战略贡献：${design.contributes_to.join('、')}`,
    `- 数据级别：${design.level}`,
    `- 基准：${design.benchmark_refs.join('、')}`,
    '',
    '## 外部标杆',
    '',
    '| ID | 标准/项目 | 状态 | 采纳模式 |',
    '|---|---|---|---|',
    ...design.benchmark_refs
      .map((id) => BENCHMARKS.find((source) => source.id === id))
      .filter(Boolean)
      .map((source) => `| [${source.id}](${source.url}) | ${source.name} | ${source.status} | ${source.adopted} |`),
    '',
  ];
  for (const module of design.modules) {
    lines.push(`## ${module.name}`, '', module.outcome, '');
    for (const item of module.items) {
      lines.push(
        `### ${item.name}`,
        '',
        `- 工作流：\`${item.workflow.id}\``,
        `- 责任角色：${item.owner_role}`,
        `- 频率：${item.frequency}`,
        `- 结果：${item.outcome}`,
        `- 输入契约：\`${item.data_contract.input_schema_ref}\``,
        `- 输出契约：\`${item.data_contract.output_schema_ref}\``,
        `- TypeDict：\`${item.data_contract.typedict_ref}\``,
        `- 验收：${item.workflow.deliverable.acceptance}`,
        '',
        '| 环节 | 类型 | 标准 | 门禁 |',
        '|---|---|---|---|',
        ...item.stages.map((stage) => `| ${stage.name} | ${stage.type} | ${stage.standard.replace(/\|/g, '\\|')} | ${stage.gate} |`),
        '',
        '**业务规则**',
        '',
        '| 规则 | 类型 | 表达式 | 状态 |',
        '|---|---|---|---|',
        ...item.business_rules.map((rule) => `| \`${rule.id}\` | ${rule.kind} | ${String(rule.expression).replace(/\|/g, '\\|')} | ${rule.status || 'active'} |`),
        '',
        item.cross_domain_effects.length ? '**跨域副作用**' : '',
        item.cross_domain_effects.length ? '' : '',
        ...item.cross_domain_effects.map((effect) => `- ${effect.event_id} → ${effect.target_domain}（键：${effect.anonymous_key}，失败：${effect.on_fail}）`),
        item.cross_domain_effects.length ? '' : '',
      );
    }
  }
  lines.push('## 字段 TypeDict', '', `- 字段数：${typedict.fields.length}`, `- 契约数：${Object.keys(contracts.contracts).length}`, '');
  return lines.join('\n');
}

function workflowTestCases(design) {
  const cases = [];
  for (const module of design.modules) {
    for (const item of module.items) {
      const hasApproval = item.workflow.approval || (item.workflow.nodes || []).some((node) => node.type === 'approval');
      const dual = !!(item.workflow.approval?.dual || (item.workflow.nodes || []).some((node) => node.type === 'approval' && node.dual));
      const common = {
        workflow_id: item.workflow.id,
        module_id: module.id,
        work_item_id: item.id,
        contract_ref: item.data_contract.input_schema_ref,
      };
      cases.push(
        { ...common, case_id: 'normal', expected_status: 'completed', mutation: 'valid_fixture' },
        { ...common, case_id: 'validation_reject', expected_status: 'blocked', mutation: 'remove_required_field' },
        hasApproval
          ? { ...common, case_id: 'approval_reject', expected_status: 'rejected', mutation: 'reject_with_comment' }
          : { ...common, case_id: 'approval_reject', expected_status: 'not_applicable', mutation: 'no_approval_stage' },
        dual
          ? { ...common, case_id: 'dual_approval_missing', expected_status: 'awaiting_approval', mutation: 'one_signature_then_same_operator' }
          : { ...common, case_id: 'dual_approval_missing', expected_status: 'not_applicable', mutation: 'single_or_no_approval' },
        { ...common, case_id: 'model_failure_resume', expected_status: 'completed', mutation: 'disable_stub_then_retry' },
        { ...common, case_id: 'sensitive_egress_block', expected_status: 'blocked_model', mutation: 'inject_phone_in_model_output' },
        { ...common, case_id: 'restart_resume', expected_status: 'completed', mutation: 'reload_instance_then_continue' },
      );
    }
  }
  return cases;
}

function buildTermDictionary(allTypedicts) {
  const terms = [];
  for (const typedict of Object.values(allTypedicts)) {
    for (const field of typedict.fields) {
      terms.push({
        term_id: `${typedict.domain}:${field.field}`,
        domain: typedict.domain,
        preferred_label: field.description || field.field,
        field: field.field,
        data_type: field.logical_type,
        semantic_type: field.semantic_type,
        unit: field.unit,
        level: field.level,
        pii: field.pii,
        definition: field.description || `工作台字段 ${field.field}`,
        enum_values: field.enum_values || [],
        foreign_key: field.foreign_key || null,
      });
    }
  }
  return {
    schema: 'pids-nexus/term-dictionary/v1',
    generated_at: new Date().toISOString(),
    terms,
  };
}

function buildLineage(allDesigns, allTypedicts, allContracts) {
  const edges = [];
  for (const design of Object.values(allDesigns)) {
    const typedict = allTypedicts[design.domain];
    for (const module of design.modules) {
      for (const item of module.items) {
        const contract = allContracts[design.domain].contracts[item.workflow.id];
        const sourceTables = item.data_contract.source_tables || [];
        for (const table of sourceTables) edges.push({
          from: `dataset:${design.domain}/${table}`,
          to: `workflow:${item.workflow.id}:intake`,
          relation: 'input',
          workflow_id: item.workflow.id,
        });
        for (const stage of item.stages) {
          edges.push({
            from: `workflow:${item.workflow.id}:${stage.id}`,
            to: `contract:${contract.$id || item.workflow.id}:${stage.id}`,
            relation: 'contract',
            workflow_id: item.workflow.id,
          });
        }
        edges.push({
          from: `workflow:${item.workflow.id}:publish`,
          to: `artifact_manifest:${item.workflow.id}`,
          relation: 'produce',
          workflow_id: item.workflow.id,
        });
        edges.push({
          from: `artifact_manifest:${item.workflow.id}`,
          to: `metric:${design.domain}:north_star`,
          relation: 'measure',
          workflow_id: item.workflow.id,
        });
        for (const kr of design.contributes_to) edges.push({
          from: `metric:${design.domain}:north_star`,
          to: `strategy:${kr}`,
          relation: 'contribute',
          workflow_id: item.workflow.id,
        });
        for (const field of typedict.fields.filter((entry) => entry.used_by_workflows.includes(item.workflow.id))) {
          edges.push({
            from: `field:${field.id}`,
            to: `workflow:${item.workflow.id}:intake`,
            relation: 'field_input',
            workflow_id: item.workflow.id,
          });
        }
      }
    }
  }
  const unique = new Map(edges.map((edge) => [`${edge.from}|${edge.to}|${edge.relation}|${edge.workflow_id || ''}`, edge]));
  return {
    schema: 'pids-nexus/lineage/v1',
    generated_at: new Date().toISOString(),
    edges: [...unique.values()],
  };
}

const allDesigns = {};
const allTypedicts = {};
const allContracts = {};
for (const [domain, model] of Object.entries(DOMAIN_MODELS)) {
  const design = buildDomainDesign(domain, model);
  const typedict = buildTypedict(domain, model, design);
  const contracts = buildContracts(domain, model, design, typedict);
  allDesigns[domain] = design;
  allTypedicts[domain] = typedict;
  allContracts[domain] = contracts;
  writeJson(path.join(ROOT, 'manifests/domain-work-design', `${domain}.json`), design);
  writeJson(path.join(ROOT, 'manifests/typedict', `${domain}.json`), typedict);
  writeJson(path.join(ROOT, 'manifests/workflow-contracts', `${domain}.json`), contracts);
  ensureDir(path.join(ROOT, 'docs/domain-work-design'));
  fs.writeFileSync(path.join(ROOT, 'docs/domain-work-design', `${domain}.md`), markdownForDomain(design, typedict, contracts), 'utf8');
}

const csvRows = [
  ['domain', 'entity', 'field', 'physical_type', 'logical_type', 'format', 'required', 'source', 'level', 'pii', 'used_by_workflows', 'description'],
];
for (const typedict of Object.values(allTypedicts)) {
  for (const field of typedict.fields) {
    csvRows.push([
      typedict.domain,
      field.entity,
      field.field,
      field.physical_type,
      field.logical_type,
      field.format || '',
      String(field.required),
      field.source,
      field.level || '',
      String(field.pii),
      (field.used_by_workflows || []).join(';'),
      field.description || '',
    ]);
  }
}
ensureDir(path.join(ROOT, 'templates/Type-Dict'));
fs.writeFileSync(
  path.join(ROOT, 'templates/Type-Dict/field-type-dict.csv'),
  `${csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')}\n`,
  'utf8',
);

const termDictionary = buildTermDictionary(allTypedicts);
ensureDir(path.join(ROOT, 'manifests/dictionaries'));
writeJson(path.join(ROOT, 'manifests/dictionaries/term-dictionary.json'), termDictionary);

const businessRules = {
  schema: 'pids-nexus/business-rules/v1',
  generated_at: new Date().toISOString(),
  rules: Object.values(allDesigns).flatMap((design) =>
    design.modules.flatMap((module) =>
      module.items.flatMap((item) => item.business_rules.map((rule) => ({
        ...rule,
        domain: design.domain,
        module_id: module.id,
        work_item_id: item.id,
        workflow_id: item.workflow.id,
      })))),
  ),
};
writeJson(path.join(ROOT, 'manifests/business-rules.json'), businessRules);

const benchmarkMapping = {
  schema: 'pids-nexus/benchmark-mapping/v1',
  generated_at: new Date().toISOString(),
  mappings: BENCHMARKS.map((source) => {
    const matchingWorkflows = Object.values(allDesigns).flatMap((design) =>
      design.modules.flatMap((module) =>
        module.items.filter((item) =>
          (item.benchmark_refs || []).includes(source.id)
          || (item.stages || []).some((stage) => (stage.benchmark_refs || []).includes(source.id)))
          .map((item) => item.workflow.id)));
    const matchingRules = businessRules.rules.filter((rule) => String(rule.source || '').split('|').includes(source.id));
    return {
      source_id: source.id,
      name: source.name,
      url: source.url,
      authority: source.authority,
      status: source.status,
      adoption_mode: source.adopted,
      workflow_refs: [...new Set(matchingWorkflows)],
      rule_refs: [...new Set(matchingRules.map((rule) => rule.id))],
      workflow_count: new Set(matchingWorkflows).size,
      rule_count: new Set(matchingRules.map((rule) => rule.id)).size,
      scope: matchingWorkflows.length ? 'workflow' : matchingRules.length ? 'rule' : 'runtime',
    };
  }),
};
writeJson(path.join(ROOT, 'manifests/benchmark-mapping.json'), benchmarkMapping);

const crossDomainEvents = {
  schema: 'pids-nexus/cross-domain-events/v1',
  generated_at: new Date().toISOString(),
  events: Object.values(allDesigns).flatMap((design) =>
    design.modules.flatMap((module) =>
      module.items.flatMap((item) => item.cross_domain_effects.map((effect) => ({
        ...effect,
        source_domain: design.domain,
        source_workflow_id: item.workflow.id,
        source_work_item_id: item.id,
      })))),
  ),
};
writeJson(path.join(ROOT, 'manifests/cross-domain-events.json'), crossDomainEvents);

const lineage = buildLineage(allDesigns, allTypedicts, allContracts);
writeJson(path.join(ROOT, 'manifests/lineage.json'), lineage);

const workflowTests = {
  schema: 'pids-nexus/workflow-tests/v1',
  generated_at: new Date().toISOString(),
  case_count: 0,
  cases: [],
};
for (const design of Object.values(allDesigns)) workflowTests.cases.push(...workflowTestCases(design));
workflowTests.case_count = workflowTests.cases.length;
ensureDir(path.join(ROOT, 'manifests/workflow-tests'));
writeJson(path.join(ROOT, 'manifests/workflow-tests/index.json'), workflowTests);

const summary = {
  schema: 'pids-nexus/domain-work-design-index/v1',
  generated_at: new Date().toISOString(),
  domains: Object.keys(allDesigns).length,
  modules: Object.values(allDesigns).reduce((sum, design) => sum + design.modules.length, 0),
  work_items: Object.values(allDesigns).reduce((sum, design) => sum + design.modules.reduce((count, module) => count + module.items.length, 0), 0),
  workflows: WORKFLOW_INDEX.workflows.length,
  typedict_fields: Object.values(allTypedicts).reduce((sum, typedict) => sum + typedict.fields.length, 0),
  contracts: Object.values(allContracts).reduce((sum, contract) => sum + Object.keys(contract.contracts).length, 0),
  business_rules: businessRules.rules.length,
  benchmark_mappings: benchmarkMapping.mappings.length,
  terms: termDictionary.terms.length,
  lineage_edges: lineage.edges.length,
  cross_domain_events: crossDomainEvents.events.length,
  workflow_test_cases: workflowTests.case_count,
};
writeJson(path.join(ROOT, 'manifests/domain-work-design/index.json'), summary);

const readme = [
  '# 13 域工作模块与闭环设计',
  '',
  `生成时间：${summary.generated_at}`,
  '',
  `- 域：${summary.domains}`,
  `- 模块：${summary.modules}`,
  `- 工作事项：${summary.work_items}`,
  `- 工作流：${summary.workflows}`,
  `- TypeDict 字段：${summary.typedict_fields}`,
  `- 输入/输出契约：${summary.contracts}`,
  '',
  '| 域 | 模块 | 工作事项 | 设计文档 |',
  '|---|---:|---:|---|',
  ...Object.values(allDesigns).map((design) => `| ${design.label} | ${design.modules.length} | ${design.modules.reduce((sum, module) => sum + module.items.length, 0)} | [${design.domain}.md](./${design.domain}.md) |`),
  '',
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs/domain-work-design/README.md'), readme, 'utf8');

console.log(`WORK_DESIGN_OK domains=${summary.domains} modules=${summary.modules} items=${summary.work_items} workflows=${summary.workflows} typedict=${summary.typedict_fields} contracts=${summary.contracts} rules=${summary.business_rules} terms=${summary.terms} lineage=${summary.lineage_edges} events=${summary.cross_domain_events} tests=${summary.workflow_test_cases}`);
