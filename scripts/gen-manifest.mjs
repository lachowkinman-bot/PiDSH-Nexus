#!/usr/bin/env node
// gen-manifest.mjs — 从 offline/npm/pkgmeta.json 生成 manifests/ 三件套（可复现，015 U1 证据链）
// 用法：node scripts/gen-manifest.mjs（在 bundle 根目录执行）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'offline/npm/pkgmeta.json'), 'utf8'));
const find = (npmName) => {
  const base = npmName.replace(/^@/, '').replace('/', '-');
  const hit = meta.find((r) => r.base === base);
  if (!hit) throw new Error(`tarball missing for ${npmName} (base=${base})`);
  return hit;
};
const q = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cols) => cols.map(q).join(',');

// —— P0（17）/ P1（7）npm 行：tarball 已预置 ——
const npmRows = [
  // [tier, npm, role, purpose, industries, install, test, note]
  ['P0', '@deepseek-ai/dsh', 'engine', 'DSH引擎内核与Cordis插件运行时', 'ALL', 'npm i -g @deepseek-ai/dsh@<VER>', 'dsh --version 输出版本号且≥0.1.2', '缺失则整个工作台不可用；版本断言见 §6 S2'],
  ['P0', 'pi2dsh', 'bridge', 'Pi生态桥接层-加载pi-package', 'ALL', 'dsh plugin --profile web add <TGZ>', '重启dsh后命令列表出现Pi生态命令', 'server插件-安装后必须重启'],
  ['P0', 'dsh-better-sidebar', 'ui', '侧边工作台-文件树/终端/Git面板', 'ALL', 'dsh plugin --profile web add <TGZ>', '硬刷新后侧边栏出现且文件树可展开', 'client插件-需pnpm approve-builds后重装'],
  ['P0', 'dsh-plugin', 'os-market', '插件市场入口-设置与插件中心', 'ALL', 'dsh plugin --profile web add <TGZ>', '插件中心可打开且能搜索浏览未装插件', '仅作本机中心入口；外部市场站禁作来源'],
  ['P0', 'pi-hermes-memory', 'memory', '跨会话记忆载体', 'ALL', 'dsh plugin --profile web add <TGZ>', '重开新会话仍能回忆上轮偏好', '要素9承载；EAP域在policies.memory.exclude排除'],
  ['P0', 'pi-approval-guardian', 'approval', '审批守卫-敏感操作真实拦截', 'ALL', 'dsh plugin --profile web add <TGZ>', '未确认时agent停在审批节点不继续', '假审批即FAIL（010-02口径）'],
  ['P0', 'pi-redact-all', 'security', '全局工具输出脱敏-密钥/PII/连接串', 'ALL', 'dsh plugin --profile web add <TGZ>', '工具输出含PII时自动替换为REDACTED', '必须验证作用于审计层而非仅聊天层'],
  ['P0', 'pi-mcp-adapter', 'connector', 'MCP数据源只读接入-预留HRIS/邮箱/日历', 'ALL', 'dsh plugin --profile web add <TGZ>', '只读数据源连接可用', '从可选提升为必装'],
  ['P0', 'dsh-excel-panel', 'connector', '真实xlsx面板-多sheet/格式/公式', 'ALL', 'dsh plugin --profile web add <TGZ>', '真实xlsx可打开可编辑且公式结果可见', '必须用真实结构脱敏xlsx测试'],
  ['P0', 'dsh-docs-panel', 'connector', 'Docs面板-文档类产物在线预览', 'ALL', 'dsh plugin --profile web add <TGZ>', 'Docs标签可打开', '—'],
  ['P0', '@rmrdeveloper/sideroom-pi', 'ui-hitl', '实时todo看板与澄清提问对话框', 'ALL', 'dsh plugin --profile web add <TGZ>', 'todo看板出现且主动提问时弹出对话框', '需与sidebar实测同框不遮挡'],
  ['P0', 'pi-stats-footer', 'observability', '页脚状态行-模型/token/缓存/成本', 'ALL', 'dsh plugin --profile web add <TGZ>', '页脚状态行出现且token非空', '—'],
  ['P0', 'dsh-undo-savepoint', 'recovery', '崩溃救援-配置快照与回滚', 'ALL', 'dsh plugin --profile web add <TGZ>', '二次覆盖产物可用快照恢复到第一版', '必须实做回退演练'],
  ['P0', '@tintinweb/pi-subagents', 'orchestration', '通用并行子代理', 'ALL', 'dsh plugin --profile web add <TGZ>', '并行任务可汇总输出双份结果', '—'],
  ['P0', 'pi-dag-core', 'orchestration-hitl', 'DAG工作流状态机与人工审批节点', 'ALL', 'dsh plugin --profile web add <TGZ>', '带依赖的DAG按序执行', '必须验证依赖顺序'],
  ['P0', 'graph-memory', 'knowledge', '知识图谱记忆与三元组召回', 'ALL', 'dsh plugin --profile web add <TGZ>', '注入2-3份脱敏文档后能正确召回', '要素5核心；EAP域排除'],
  ['P0', '@mutmutco/pi-plugin', 'approval-multi', '多级审批与组织门禁工作流', 'ALL', 'dsh plugin --profile web add <TGZ>', '低风险自动过/高风险二次确认分路径', 'repo 历史死链已在本包内核验可安装'],
  ['P1', 'pi-deepseek-search', 'research', '联网搜索-行业对标与政策查询', 'ALL', 'dsh plugin --profile web add <TGZ>', '提示词要求搜索可返回结果', '默认关闭；L3/L4数据禁送公网'],
  ['P1', 'pi-queue-steer-factory', 'observability-queue', '可见任务队列与会话控制', 'ALL', 'dsh plugin --profile web add <TGZ>', '队列显示排队/进行中/完成', '验证过程状态而非仅最终结果'],
  ['P1', 'pi-loop-mode', 'autonomy', '无人值守循环模式', 'ALL', 'dsh plugin --profile web add <TGZ>', '命令可用即可-本次不实跑长任务', '高风险-默认禁用；启用须 S8 演练通过'],
  ['P1', '@anionex/dsh-vision-toolkit', 'ocr', '视觉工具箱-扫描件/证件/长截图OCR', 'MANUFACTURING;CONSTRUCTION;HEALTHCARE;RETAIL', 'dsh plugin --profile web add <TGZ>', '粘贴图片可识别且长截图OCR返回文字', '证件类行业强依赖'],
  ['P1', '@ychris12138/dsh-usage-stats', 'cost', 'Provider余额/配额/token分析', 'ALL', 'dsh plugin --profile web add <TGZ>', '用量面板可打开且数据非空', '多用户/多分支建议启用'],
  ['P1', '@changfenhuang/dsh-annotation', 'review', '选中批注-产物审阅协作标注', 'ALL', 'dsh plugin --profile web add <TGZ>', '选中文字可加批注且气泡可隐藏', '人工审阅流水时启用'],
  ['P1', 'dsh-network-settings', 'network', '网络诊断与代理检测修复', 'MULTI-BRANCH;CROSS-BORDER', 'dsh plugin --profile web add <TGZ>', '网络诊断面板可打开且代理修复可用', '内网隔离/多地域部署必需'],
];

// —— P2 行 ——
const p2 = [
  ['dsh-web', 'github-source', 'zhu1090093659/dsh-web', 'shell', '桌面工作台外壳-任务看板/Git历史/主题', 'ALL', 'git clone --depth 1 https://github.com/zhu1090093659/dsh-web 后本地构建再 dsh plugin --profile web add <本地目录>', '任务看板可打开且Git历史可视化可用', '2026-09-24实测 npm E404；2026-09-27实测 dev 分支 zip 452MB 过重→改浅克隆。不作为U1门禁条件，失败登记gap后流水线继续'],
  ['skills-cockpit', 'workspace-template', 'templates/skills-domain/', 'orchestrator', 'Chief of Staff主控编排与意图路由', 'ALL', '从templates复制并按域改写intentions', '多域并行任务可汇总输出', '非npm包'],
  ['industrypack-base', 'workspace-template', 'templates/workspace/', 'preset-base', 'Base层-内核契约/通用能力/默认UI', 'ALL', 'preset resolve --preset __base', 'Base自身通过Gate P0-P2', '所有preset共同祖先'],
];
const packs = [
  ['manufacturing', '制造业包-班次/技能等级/特种作业证/OEE口径', '特种作业到期拦截场景'],
  ['retail', '零售包-门店/坪效/排班工时上限/未成年工限制', '排班生成后触发工时合规审批'],
  ['healthcare', '医疗包-执业资质/连班限制/院感培训', '资质到期前拦截排班'],
  ['construction', '建筑包-实名制/工伤保险/特种工/项目制用工', '项目开工前完成实名制与保险校验'],
  ['internet', '互联网包-迭代节奏/技术序列/竞业保密', '入职前竞业核查且简历外发强制脱敏'],
  ['finance', '金融包-从业资格/合规留痕/轮岗亲属回避', '从业资格缺失阻断岗位调整'],
];
const domains = [
  ['strat', '战略管理-OKR/经营分析/竞品监测', '合并薪酬数据双审批'],
  ['mkt', '营销管理-线上/线下双场景（内容/投放/活动）', '对外发布L4强审批+脱敏'],
  ['sales', '销售管理-CRM只读/报价/合同/业绩', '报价审批DAG+折扣阈值'],
  ['fin', '财务管理-报销/预算/发票/财报', '报销强审批；财报分级出数'],
  ['rec', '招聘管理-漏斗/JD/面试纪要（原六职能招聘）', '简历外发强制脱敏'],
  ['trn', '培训管理-课程/学时/证书资质', '资质到期拦截排班'],
  ['prf', '绩效管理-KPI/考核/校准', '绩效校准双审批'],
  ['comp', '薪酬管理-带宽/对账/CR（全域L4）', '调薪双审批+redact_gate'],
  ['ben', '福利设计-商保/体检/弹性福利（健康L4）', '体检报告脱敏'],
  ['admin', '行政管理-采购/资产/用印', '用印强制人工HITL'],
  ['cmp', '合规管理-制度/审计留痕/PIPIA', '证据打包append-only对齐'],
  ['er-eap', '员工关系+EAP-处分/离职/心理援助（EAP为L4+特例）', 'EAP转介双审批+匿名化+禁网禁记忆'],
];
const slots = [
  ['cap.ind.mes-readonly', '制造MES只读接入'],
  ['cap.ind.his-readonly', '医疗HIS只读接入'],
  ['cap.ind.regulatory-filing', '行业监管报送材料生成'],
  ['cap.ind.pos-readonly', '零售POS只读接入'],
  ['cap.ind.gov-formatter', '政企公文格式化'],
  ['cap.ind.lms-readonly', '企业LMS学习记录只读接入'],
  ['cap.ind.appsec-scan', '应用安全扫描结果接入'],
];

const rows = [];
let rank = 0;
for (const [tier, npm, role, purpose, ind, install, test, note] of npmRows) {
  rank += 1;
  const m = find(npm);
  rows.push([tier, String(rank).padStart(2, '0'), npm.replace(/[/@]/g, (c) => (c === '/' ? '-' : '')) || npm, npm, 'npm', npm.startsWith('@') ? 'npm-only' : 'npm-only', 'latest', role, purpose, ind, install, test, m.ver, m.file, m.sha, 'PRESET_OK', note]);
}
const addP2 = (name, src, repo, role, purpose, ind, install, test, note, status) => {
  rank += 1;
  rows.push(['P2', String(rank).padStart(2, '0'), name, name, src, repo, 'latest', role, purpose, ind, install, test, '', '', '', status, note]);
};
addP2(...p2[0]);
addP2(...p2[1]);
addP2(...p2[2]);
for (const [code, purpose, test] of packs)
  addP2(`industrypack-${code}`, 'workspace-template', `templates/workspace/presets/industry/${code}`, 'preset-industry', purpose, code.toUpperCase(), '从templates复制并注入行业差异', test, '首批仅试点1个行业（P1-4）', 'PRESET_OK');
for (const [code, purpose, test] of domains)
  addP2(`skills-domain-${code}`, 'workspace-template', `templates/skills-domain/${code}`, 'skill-core', purpose, 'ALL', '从templates/skills-domain复制并按Scene定制', test, '12业务域技能模板（自制层）', 'PRESET_OK');
for (const [cap, purpose] of slots)
  addP2(`slot-${cap.replace('cap.ind.', '')}`, 'extension-slot', `capability:${cap}`, 'industry-slot', `扩展位：${purpose}（无现成npm包，禁编造）`, 'BY_INDUSTRY', '先npm view核验候选包；找不到→capability-gap降级', '按扩展位验收：gap登记+替代方案', '015 §3.1 缺口层', 'GAP_REGISTERED');
addP2('toolchain-node-git', 'os-package', 'https://nodejs.org', 'runtime', '运行时依赖-Node≥22.19/pnpm≥10/Git≥2.40', 'ALL', 'winget install OpenJS.NodeJS.LTS 或 offline/node/ 离线安装', 'node -v/pnpm -v/git --version 全达标', '版本不达标先修环境（ERR-ENV-001）', 'TO_VERIFY');
addP2('connector-hris', 'external-connector', '企业自建或厂商提供', 'data-source', 'HRIS只读数据源-走pi-mcp-adapter接入', 'ALL', '按connector profile配置', '只读查询返回真实字段且写入被拒绝', '涉真实员工数据：只读+脱敏+审批', 'TO_CONFIGURE');
addP2('connector-mail-calendar', 'external-connector', '企业自建或厂商提供', 'data-source', '邮箱与日历只读接入-邀约与到期提醒', 'ALL', '按connector profile配置', '日历只读查询成功且发送动作触发审批', '发送动作必须走HITL', 'TO_CONFIGURE');

const header = 'tier,rank,name,npm_name,source_type,repo_hint,version_range,role,purpose,industries,install_cmd,test_cmd,resolved_version,resolved_tarball,sha256,status,note';
fs.writeFileSync(path.join(ROOT, 'manifests/packages.manifest.csv'), [header, ...rows.map(csvRow)].join('\n') + '\n');

// —— capability-registry.csv ——
const caps = [];
const capCore = [
  ['cap.engine.dsh', 'Agent运行时引擎', '@deepseek-ai/dsh'], ['cap.bridge.pi2dsh', 'Pi生态桥接', 'pi2dsh'],
  ['cap.ui.sidebar', '侧边工作台UI', 'dsh-better-sidebar'], ['cap.marketplace', '插件中心入口', 'dsh-plugin'],
  ['cap.memory.session', '跨会话记忆', 'pi-hermes-memory'], ['cap.approval.single', '单级审批守卫', 'pi-approval-guardian'],
  ['cap.approval.multi', '多级审批/组织门禁', '@mutmutco/pi-plugin'], ['cap.redact.all', '全局脱敏', 'pi-redact-all'],
  ['cap.connector.mcp', 'MCP连接器', 'pi-mcp-adapter'], ['cap.excel.panel', 'Excel面板', 'dsh-excel-panel'],
  ['cap.docs.panel', 'Docs面板', 'dsh-docs-panel'], ['cap.ui.hitl', 'todo看板/澄清对话框', '@rmrdeveloper/sideroom-pi'],
  ['cap.observability.stats', 'token/成本观测', 'pi-stats-footer'], ['cap.recovery.savepoint', '快照回滚', 'dsh-undo-savepoint'],
  ['cap.subagent.parallel', '并行子代理', '@tintinweb/pi-subagents'], ['cap.orchestration.dag', 'DAG编排', 'pi-dag-core'],
  ['cap.knowledge.graph', '知识图谱记忆', 'graph-memory'], ['cap.search.web', '联网搜索', 'pi-deepseek-search'],
  ['cap.orchestration.queue', '任务队列', 'pi-queue-steer-factory'], ['cap.autonomy.loop', '无人值守循环', 'pi-loop-mode'],
  ['cap.vision.ocr', 'OCR视觉', '@anionex/dsh-vision-toolkit'], ['cap.cost.usage', '用量分析', '@ychris12138/dsh-usage-stats'],
  ['cap.review.annotation', '产物批注', '@changfenhuang/dsh-annotation'], ['cap.network.diag', '网络诊断', 'dsh-network-settings'],
  ['cap.shell.desktop', '桌面外壳', 'dsh-web'], ['cap.orchestration.chief', 'Chief of Staff编排', 'skills-cockpit'],
  ['cap.preset.base', 'Preset基础层', 'industrypack-base'],
  ['cap.knowledge.graph', '知识图谱记忆（主图）', 'graph-memory'],
  ['cap.knowledge.vector', '向量+全文+图记忆', 'pi-vault-mind'],
  ['cap.knowledge.longcontext', '长上下文', 'billion-context-pi'],
  ['cap.knowledge.wiki', 'Obsidian wiki 摄取', '@zosmaai/pi-llm-wiki'],
  ['cap.knowledge.injection', '注入语料与召回测试', 'templates/knowledge/'],
];
for (const [id, nm, impl] of capCore) caps.push([id, nm, impl, 'PRESET_OK', '']);
for (const [code] of domains) caps.push([`cap.domain.${code}`, `业务域能力包 ${code}`, `skills-domain-${code}`, 'PRESET_OK', '自制层']);
for (const [cap, purpose] of slots) caps.push([cap, purpose, '', 'GAP_REGISTERED', '扩展位：无现成npm包，先核验后回填或降级']);
fs.writeFileSync(path.join(ROOT, 'manifests/capability-registry.csv'), ['capability_id,capability_name,implementation,tier_status,note', ...caps.map(csvRow)].join('\n') + '\n');

// —— tag-manifest.csv（哈希链种子，供无持久 git 的 Runner 取证）——
const shaOf = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const seed = shaOf(path.join(ROOT, 'offline/npm/SHA256SUMS.txt'));
const now = new Date().toISOString();
fs.writeFileSync(path.join(ROOT, 'manifests/tag-manifest.csv'), 'artifact,sha256,timestamp,prev_hash\n' + csvRow(['BUNDLE-SEED', seed, now, '0'.repeat(64)]) + '\n');

// —— capability-gap.md（强制占位）——
fs.writeFileSync(path.join(ROOT, 'reports/capability-gap.md'), `# capability-gap 能力缺口登记\n\n> 015 §3.5：单包失败→登记本表→判定是否 Chassis 必需→非必需剔除并标 NOT_IMPLEMENTED（附替代方案）。不得中断流水线，不得假成功。\n\n| 包名/能力 | 档 | 失败原因 | 影响要素 | 替代方案 |\n|---|---|---|---|---|\n| dsh-web | P2 | npm E404（设计如此）；dev 分支 zip 实测 452MB→改 git clone --depth 1 | 要素1 | offline 构建兜底（人工可选，不阻断） |\n| cap.ind.*（7 项扩展位） | P2 | 无现成 npm 包 | 按行业 | 企业自建 MCP / 人工导出 / 暂缓 |\n`);
console.log(`manifest: ${rows.length} rows (P0=${rows.filter(r => r[0] === 'P0').length}/P1=${rows.filter(r => r[0] === 'P1').length}/P2=${rows.filter(r => r[0] === 'P2').length})`);
console.log(`registry: ${caps.length} capabilities; tag-seed=${seed.slice(0, 12)}…`);
