#!/usr/bin/env node
// enrich-domain-skills.mjs
// Deterministically enrich every non-REC domain skill from the canonical strategy,
// workflow and domain-model manifests. REC is intentionally excluded because its
// lifecycle and model contracts are authored in detail.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/workflows/index.json'), 'utf8')).workflows;
const STRATEGY = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/strategy-model.json'), 'utf8'));
const MODELS = Object.fromEntries(
  fs.readdirSync(path.join(ROOT, 'manifests/domain-model'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/domain-model', file), 'utf8'));
      return [model.domain, model];
    }),
);

const BLUEPRINTS = {
  strat: {
    lifecycle: '环境/竞品输入 -> 战略解码 -> OKR/KR 定版 -> 组织与预算分解 -> 月度滚动复盘 -> 季度关账',
    decisions: ['目标是否仍有战略有效性', 'KR 是否可量化且责任到人', '资源与组织是否支撑目标', '偏差是否需要调整举措或预算'],
    controls: ['目标口径与数据来源一致', '双审批后方可关账', '薪酬话题只出区间', '决议必须有责任人、期限和复核点'],
    metrics: ['战略目标达成率', 'KR 达成数', '预测偏差', '重大风险关闭率'],
  },
  'mkt-on': {
    lifecycle: '受众与渠道策略 -> 内容/投放计划 -> 合规与发布审批 -> 线索获取与培育 -> ROI/内容/SEO 复盘',
    decisions: ['预算是否转向高 ROI 渠道', '内容是否符合品牌和合规', '线索质量是否达到销售标准', 'SEO/投放优化优先级'],
    controls: ['触达素材必须经过个人信息与品牌检查', '线索联系信息只出掩码', '广告与内容外发需审批', '归因口径不得混用'],
    metrics: ['合格线索数', '预计商机价值', 'CAC', '渠道 ROI'],
  },
  'mkt-off': {
    lifecycle: '活动立项 -> 预算/展位/物料审批 -> 现场执行 -> 线索去重移交 -> 活动 ROI 与经销商复盘',
    decisions: ['活动是否继续投入', '供应商/场地是否可签约', '物料能否对外', '预算是否超包'],
    controls: ['展位和物料对外前强制审批', '预算超阈值升级', '线索移交前去重和脱敏', '经销商条款按 L3 处理'],
    metrics: ['活动 ROI', '有效商机', '线索移交率', '经销商履约率'],
  },
  sales: {
    lifecycle: '线索分配 -> 商机资格评估 -> 方案报价 -> 合同条款评审 -> 赢单/交付/回款 -> 输单与打法复盘',
    decisions: ['商机是否值得继续投入', '报价折扣是否可接受', '合同条款是否可承担', '输单原因是否可修正'],
    controls: ['低于底价或高折扣必须升级审批', '合同回款条款偏离必须评审', '客户敏感信息只出必要字段', '赢单与财务收入勾稽'],
    metrics: ['有效管道', '赢单收入', '赢单率', '销售周期'],
  },
  fin: {
    lifecycle: '预算与凭证输入 -> 发票/报销三单匹配 -> 预算和税务校验 -> 审批支付/入账 -> 月报/现金流/预算复盘',
    decisions: ['费用是否合规可报', '预算是否充足', '发票和税务是否异常', '收入确认与现金流风险'],
    controls: ['金额、税号、抬头和连号强制校验', '超预算和阈值审批', '银行账户与发票税号脱敏', '财报数字必须凭证级追溯'],
    metrics: ['确认收入', '净额', '预算执行率', '现金流余额'],
  },
  trn: {
    lifecycle: '能力缺口识别 -> 培养计划 -> 课程排期 -> 报名和完成 -> 考试/证书 -> 学时与绩效成效复盘',
    decisions: ['培训是否值得投入', '候选课程是否匹配能力缺口', '证书是否续期或拦截上岗', '培训成效是否改善绩效'],
    controls: ['外部课程和预算需审批', '换证审批前不得解除上岗拦截', '讲师/场地/学员冲突机检', '培训结论与绩效证据可追溯'],
    metrics: ['能力缺口闭合率', '培训通过率', '证书合规率', '培训 ROI'],
  },
  prf: {
    lifecycle: '战略目标分解 -> KPI/OKR 设定 -> 日常跟踪 -> 自评/上级评 -> 校准会 -> 结果沟通/PIP -> 分布与激励复盘',
    decisions: ['目标权重是否合理', '绩效证据是否充分', '校准等级是否公平', '是否进入 PIP/调薪候选'],
    controls: ['L4 评语和分数强制脱敏', '双审批后方可生效', '校准纪要禁入记忆层', '申诉必须进入员工关系闭环'],
    metrics: ['目标达成率', '校准一致性', '强分布偏差', 'PIP 转化率'],
  },
  comp: {
    lifecycle: '岗位与带宽维护 -> 提案/晋级/绩效触发 -> 成本测算 -> 双审批 -> 生效 -> 薪酬对账和预算复盘',
    decisions: ['定薪是否在带宽', '调薪包是否可承担', '是否产生公平性风险', '何时生效和回溯'],
    controls: ['个体薪酬不落明文', '带宽和成本可追溯', '批量调薪双审批', '社保/公积金/个税公式固定版本'],
    metrics: ['Compa-Ratio', '薪酬成本', '带宽偏离', '关键人才留存'],
  },
  ben: {
    lifecycle: '福利策略 -> 供应商/方案比选 -> 参保和积分配置 -> 使用/理赔协办 -> 满意度 -> 成本与留存复盘',
    decisions: ['方案是否入选', '积分额度是否可持续', '理赔/参保变更是否合规', '福利投入是否有效'],
    controls: ['健康数据只出聚合且 n<5 抑制', '心理支持内容转 EAP 匿名流程', '个人理赔金额只出区间', '供应商实名按掩码处理'],
    metrics: ['福利使用率', '员工满意度', '人均福利成本', '理赔时效'],
  },
  admin: {
    lifecycle: '需求申请 -> 三家比价/供应商评估 -> 审批 -> 下单/入库 -> 资产分配 -> 盘点/维修/报废 -> SLA 复盘',
    decisions: ['供应商是否中选', '采购是否在预算内', '资产如何分配/处置', '是否允许用印'],
    controls: ['至少三家比价或说明例外', '用印必须人工放行', '资产与离职流程联动', '价格与供应商敏感信息受控'],
    metrics: ['采购节约率', '资产利用率', '服务 SLA', '预算执行率'],
  },
  cmp: {
    lifecycle: '法规/制度输入 -> 风险识别与控制映射 -> PIPIA -> 整改 -> 证据封存 -> 审计和培训复盘',
    decisions: ['是否允许上线/处理数据', '风险是否可接受', '整改是否关闭', '是否触发外部申报'],
    controls: ['法律依据和证据引用必备', '高风险未降级禁止上线', '证据包 append-only', '审计留痕和双审批'],
    metrics: ['合规率', '风险闭环率', '审计留痕覆盖率', '整改及时率'],
  },
  'er-eap': {
    lifecycle: '案件/匿名转介受理 -> 风险评估与分级 -> 双审批 -> 调查/调解/转介 -> 结案 -> 离职/争议/组织健康复盘',
    decisions: ['是否受理和升级', '转介方向是否适当', '离职/处分是否生效', '证据与隐私边界是否满足'],
    controls: ['EAP 只处理匿名编号', '禁网、禁记忆层、独立命名空间', '双审批不可绕过', 'n<5 不出分'],
    metrics: ['案件闭环率', '争议升级率', '匿名转介完成率', '组织健康脉搏'],
  },
};

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (pair) fields[pair[1]] = pair[2].replace(/^['"]|['"]$/g, '');
  }
  return fields;
}

function renderSkill(domain, skill, model, workflows, strategy) {
  const blueprint = BLUEPRINTS[domain];
  const related = workflows.filter((workflow) => workflow.skill === skill);
  const fields = [...new Set(related.flatMap((workflow) => workflow.deliverable?.fields || []))];
  const tables = model.tables.map((table) => table.file);
  return `---
name: ${skill}
domain: ${domain}
version: 2.0.0
min_level: ${model.level || 'L3'}
redact_gate: ${(model.redact_fields || []).length > 0 ? 'true' : 'false'}
llm: required
---
# SKILL · ${skill}

## 域定位

- 域：${model.label}
- 北极星：${strategy.domains?.[domain]?.north_star || '业务成效'}
- 领域闭环：${blueprint.lifecycle}

## 输入

- 数据表：${tables.join('、') || '域内业务输入'}。
- 上游工作流证据、用户提交的表单/附件、审批意见与数据版本。
- 策略目标：${(strategy.domains?.[domain]?.contributes_to || []).join('、') || '无'}。

## LLM 任务

1. 读取并校验输入字段、枚举、引用完整性和单位口径；缺失或冲突字段标记为 \`unknown\`，不得猜测。
2. 对本域关键对象执行结构化分析、计算、风险识别、方案比较或文档生成。
3. 输出结论必须引用源数据行、用户输入字段或上游产物；每个建议必须说明预期结果、责任角色和验证指标。
4. 对需要人工决策的事项生成审批摘要，不替代审批人做决定。
5. 在工作流完成后回写域指标、质量和战略贡献证据。

## 输出契约

\`\`\`json
{
  "summary": "string",
  "findings": [{"id": "string", "title": "string", "detail": "string", "severity": "info|warning|critical", "evidence_refs": ["string"]}],
  "recommendations": [{"id": "string", "title": "string", "detail": "string", "owner": "string", "due": "string"}],
  "confidence": 0,
  "evidence_refs": ["string"],
  "redactions": ["string"],
  "fields": ${JSON.stringify(fields)}
}
\`\`\`

## 决策与门禁

${blueprint.decisions.map((item) => `- ${item}`).join('\n')}
${blueprint.controls.map((item) => `- 控制：${item}`).join('\n')}
- 脱敏字段：${(model.redact_fields || []).join('、') || '无'}。
- 记忆层策略：${JSON.stringify(model.memory || {})}。

## 成功指标

${blueprint.metrics.map((item) => `- ${item}`).join('\n')}

## 失败与恢复

- 模型不可用、输出结构不合规或证据不足：状态置 \`blocked_model\`，保留输入和草稿，禁止生成正式审批件或对外文件。
- 业务规则失败：返回可操作的字段级错误，保存前恢复最近备份。
- 连续两次质量失败：进入人工复核，不得自动放宽阈值。
`;
}

let changed = 0;
for (const [domain, model] of Object.entries(MODELS)) {
  if (domain === 'rec') continue;
  const blueprint = BLUEPRINTS[domain];
  if (!blueprint) throw new Error(`缺少领域蓝图：${domain}`);
  const strategy = STRATEGY;
  const dir = path.join(ROOT, 'templates/skills-domain', domain);
  for (const file of fs.readdirSync(dir).filter((name) => /^SKILL-.*\.md$/.test(name))) {
    if (file === 'SKILL-cockpit-intent.md') {
      const workflows = WORKFLOWS.filter((workflow) => workflow.domain === domain);
      const content = `---
name: ${domain}-intent
domain: ${domain}
version: 2.0.0
llm: required
---
# 意图路由 · ${model.label}

把自然语言意图路由到本域六个工作流；跨域决策由战略总看板和工作流 after_complete 证据链编排。

${workflows.map((workflow) => `- ${workflow.description} -> \`${workflow.workflow_id}\``).join('\n')}
`;
      fs.writeFileSync(path.join(dir, file), content, 'utf8');
      changed += 1;
      continue;
    }
    const meta = frontmatter(path.join(dir, file));
    const skill = meta.name || file.replace(/^SKILL-/, '').replace(/\.md$/, '');
    const content = renderSkill(domain, skill, model, WORKFLOWS, strategy);
    fs.writeFileSync(path.join(dir, file), content, 'utf8');
    changed += 1;
  }
}
console.log(`ENRICH_SKILLS_OK changed=${changed} domains=${Object.keys(BLUEPRINTS).length}`);
