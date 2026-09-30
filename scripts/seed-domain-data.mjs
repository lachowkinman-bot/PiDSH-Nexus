#!/usr/bin/env node
// seed-domain-data.mjs — 13 业务域数据资产种子（合成冷启动数据，015 §15.4：合成数据仅作冷启动，
// 字段/脱敏口径与 templates/Type-Dict/type-dict.csv 一致；个体标识一律 **** 掩码，敏感字段给区间/等级不给原值）。
// 用法：node scripts/seed-domain-data.mjs  → templates/workspace/data/<domain>/<table>.csv
// 幂等：覆盖重写；UI 经 /workbench/api/data?domain=<code> 读取。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'templates/workspace/data');

const D = {
  strat: {
    okr: 'objective,kr,progress_pct,quarter,owner\n华南区营收增长,KR1 新客数 +30%,42,Q4,销售VP\n华南区营收增长,KR2 客户续约率 92%,68,Q4,客户成功部\n华南区营收增长,KR3 客单价 +18%,25,Q4,产品商业化\n组织效能提升,KR1 关键岗位到位率 95%,80,Q4,HRBP\n组织效能提升,KR2 人均产出 +12%,35,Q4,各BU负责人',
    weekly: 'week,revenue_wan,orders,new_customers,risk_note\nW39,1286,312,41,"华南经销商回款延迟（行政跟进）"\nW40,1352,338,45,-\nW41,1194,295,38,"投放ROI 周环比 -7%（市场部复盘）"\nW42,1478,356,52,-',
  },
  'mkt-on': {
    content_calendar: 'date,channel,title,status,owner\n10-08,公众号,Q4 产品白皮书发布,已排期,内容组\n10-10,抖音,客户案例短视频 ×3,待审核,视频组\n10-12,官网,双11 专题页上线,草稿,市场运营\n10-15,公众号,行业报告解读,已排期,内容组\n10-18,视频号,直播预告,待审核,活动组',
    leads: 'lead_id,source,stage,score,contact_masked\nLEAD-2101,官网表单,新线索,72,138****2341\nLEAD-2102,行业展,接触中,85,chen****@corp.com\nLEAD-2103,投放落地页,新线索,61,139****8870\nLEAD-2104,转介绍,报价中,91,158****0912\nLEAD-2105,官网表单,已赢单,88,li****@corp.com',
  },
  'mkt-off': {
    events: 'event,budget_wan,actual_wan,roi,city,owner\n华南渠道会,80,76,1.9,广州,渠道部\n经销商大会,150,168,2.4,佛山,市场部\n行业展位,60,55,1.2,深圳,品牌组\n年终答谢会,40,0,0,广州,筹备中',
    materials: 'material,review_status,legal_check,brand_check,owner\n经销商手册 V5,通过,通过,通过,品牌组\n展台易拉宝,审核中,通过,待改,设计组\n伴手礼包装,通过,通过,通过,行政支持\n现场背板,驳回,通过,字号不合规,设计组',
  },
  sales: {
    pipeline: 'opportunity,stage,amount_k,owner,close_date\n商机-A（制造业）,报价,420,王****,10-20\n商机-B（零售连锁）,接触,180,李****,11-05\n商机-C（物流集团）,赢单,660,王****,10-12\n商机-D（医药流通）,线索,90,张****,12-01\n商机-E（教育集团）,报价,310,李****,10-28',
    quotes: 'quote_id,customer_masked,items,discount_pct,total_wan,status\nQT-3301,某制造集团,标准版×3+实施,8,46.8,待审批\nQT-3302,某连锁超市,专业版×1,0,12.0,已发出\nQT-3303,某物流集团,旗舰版×2+培训,12,89.5,已审批\nQT-3304,某医药公司,标准版×2,5,21.6,草稿',
  },
  fin: {
    expenses: 'expense_id,applicant_masked,amount_yuan,reason,level,status\nEXP-8812,张****,3860,差旅-深圳出差,L2,已批准\nEXP-8813,李****,15600,设备采购,L3,待审批\nEXP-8814,王****,820,市内交通,L1,已报销\nEXP-8815,陈****,42800,市场活动尾款,L4,双审批中\nEXP-8816,赵****,1350,办公用品,L1,已报销',
    budget: 'dept,budget_wan,used_wan,remain_wan,period\n销售部,320,214,106,Q4\n市场部,280,199,81,Q4\n研发部,410,187,223,Q4\n行政部,120,96,24,Q4\n人力资源部,150,88,62,Q4',
  },
  rec: {
    candidates: 'candidate_masked,position,stage,interview_at,source\n张****,销售经理,面试安排,10-02 14:00,猎头\n李****,财务分析,简历筛选,-,内推\n王****,HRBP,面试安排,10-05 16:00,官网\n陈****,前端工程师,已发offer,10-09 10:00,内推\n赵****,渠道销售,简历筛选,-,招聘网站',
    funnel: 'stage,count,conversion_pct\n简历投递,486,100\n初筛通过,172,35\n面试通过,58,12\noffer发放,21,4\n入职,17,3',
  },
  trn: {
    courses: 'course,hours,enrolled,next_session,category\n新员工入职,6,32,10-11,必修\n合规与信息安全,4,57,10-13,必修\n销售进阶谈判,12,18,10-18,进阶\n管理者 First 30 天,8,9,10-22,领导力',
    certificates: 'certificate,holder_masked,issue_date,expire_date,status\n特种作业操作证,王****,2023-10-15,2026-10-14,90天内到期\n注册会计师,李****,2024-06-01,2027-05-31,有效\n安全员C证,陈****,2021-11-02,2024-10-01,已过期\n一级建造师,赵****,2025-03-20,2028-03-19,有效',
  },
  prf: {
    calibration: 'employee_masked,dept,manager_grade,calibrated_grade,delta_note\nEMP-****12,销售部,B+,A-,超出：大单突破\nEMP-****35,研发部,A,A,一致\nEMP-****07,市场部,C+,C,一致\nEMP-****51,财务部,B,B+,超出：跨部门支持\nEMP-****29,行政部,B-,C+,下调：两次客诉',
    kpi: 'kpi,target,actual,rate,period\n新签销售额(万),4800,3912,81.5,Q4\n客户续约率,92,89.6,97.4,Q4\n需求交付准时率,90,93.2,103.6,Q4\n人效指数,110,104,94.5,Q4',
  },
  comp: {
    bands: 'band,p25_wan,p50_wan,p75_wan,zone\nP3,18,24,30,基准\nP4,28,36,46,基准\nP5,42,55,70,基准\nP6,60,80,105,基准\nM2,70,95,125,管理带',
    adjust_queue: 'employee_masked,current_band,proposed_band,reason,status,approvals\nEMP-****12,P4,P5,晋升答辩通过,双审批中,HRD✓/CFO待\nEMP-****35,P5,P5,带宽内调薪,已批准,HRD✓/CFO✓\nEMP-****51,P4,P4,超带宽校准,双审批中,HRD待/CFO待\nEMP-****63,P3,P4,关键人才保留,草稿,-',
  },
  ben: {
    plans: 'plan,points_per_year,covers,provider_masked\n升级商保(家属),1600,门诊+住院+体检,某保险公司\n高端体检套餐,900,全面体检+齿科,某体检机构\n弹性健身,600,健身房通兑,某运动平台\nEAP心理支持,300,全年8次匿名咨询,某EAP机构',
    usage: 'employee_masked,points_used,plan,remaining\nEMP-****12,1450,升级商保(家属),150\nEMP-****35,900,高端体检套餐,0\nEMP-****07,300,弹性健身,300\nEMP-****51,600,EAP心理支持,0',
  },
  admin: {
    purchases: 'item,vendor_masked,unit_price_yuan,lead_days,selected\n办公笔记本×20,供应商A,6800,7,No\n办公笔记本×20,供应商B,6580,10,Yes(最低价)\n办公笔记本×20,供应商C,7100,3,No\n会议椅×40,供应商A,860,12,No\n会议椅×40,供应商C,799,15,Yes(最低价)',
    assets: 'asset_id,asset,holder_masked,location,status\nAST-0101,投影仪(会议室A),公共,A栋3层,在用\nAST-0107,笔记本电脑,张****,销售部,在用\nAST-0113,打印机,公共,行政仓库,维修中\nAST-0121,测试手机,李****,研发部,已归还',
  },
  cmp: {
    policy_checklist: 'policy,item,status,owner,review_date\n劳动用工制度,加班与调休条款,合规,人力资源部,2026-09-12\n数据管理制度,数据出境评估,待整改,法务部,2026-10-30\n个人信息保护,PIPIA 年度评估,进行中,安全合规部,2026-11-15\n采购合规,供应商准入审查,合规,采购部,2026-09-28',
    pipia: 'process,risk_level,residual_risk,next_review,owner\n员工考勤人脸识别,高,中,2026-12-01,安全合规部\n客户线索营销外呼,中,低,2027-01-10,市场部\nEAP 匿名咨询,高,低,2027-03-01,EAP专员',
  },
  'er-eap': {
    eap_referrals: 'anon_id,direction,status,approvals,sessions_left\nEAP-ANON-0731,心理咨询(外部机构),进行中,主管✓/专员✓,5\nEAP-ANON-0733,法律援助(劳动咨询),已结案,主管✓/专员✓,0\nEAP-ANON-0734,心理咨询(内部),待双审批,主管待/专员待,8\nEAP-ANON-0735,危机干预,进行中,主管✓/专员✓,2',
    er_cases: 'case_id,case_type,stage,owner,note\nER-1201,绩效申诉,调解中,HRBP,已安排面谈\nER-1202,离职交接,审批中,HR专员,N+1 方案\nER-1203,团队争议,已结案,HRBP,双方签字归档\nER-1204,违纪调查,调查中,合规部,证据已封存',
  },
};

fs.mkdirSync(OUT, { recursive: true });
// 非破坏性播种（2026-09-29 修订）：本脚本内嵌的是"冷启动最小样例"（每表约 4-5 行），
// 而 `templates/workspace/data/` 下的数据已成为域设计的**真实资产**（各域按 preset-design 补齐到 12-29 行，
// 与 docs/preset-design/*.md 的数据字典互为勾稽）。原实现无条件覆盖，重跑会把补齐的数据打回 4 行。
// 现改为**只播种缺失或空文件**：已存在且非空的文件一律跳过，保护人工/设计产物。
const FORCE = process.argv.includes('--force');
let files = 0, rows = 0, skipped = 0;
for (const [domain, tables] of Object.entries(D)) {
  const dir = path.join(OUT, domain);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, csv] of Object.entries(tables)) {
    const p = path.join(dir, `${name}.csv`);
    if (!FORCE && fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim()) { skipped++; continue; }
    fs.writeFileSync(p, csv + '\n', 'utf8');
    files++; rows += csv.trim().split('\n').length - 1;
  }
}
console.log(`SEED_DONE files=${files} data_rows=${rows} skipped_existing=${skipped}${FORCE ? ' (--force 已覆盖)' : ''} → templates/workspace/data/<domain>/*.csv`);
console.log('提示：如需用内置样例覆盖现有数据，显式加 --force；日常请改 docs/preset-design 与数据文件本身。');
