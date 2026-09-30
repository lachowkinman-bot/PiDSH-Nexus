// Universal Workbench 插件 · 浏览器半面（dsh web 壳内加载）
// 装载契约逐字对齐范本 @linxin666/dsh-client-ui-task-board@0.4.3：
//   window.__ModuleLoader__.load({ id, factory(require) }) → module.exports = { apply, inject }
// 3.0 复盘落地（2026-09-29，修复用户指出的四类问题）：
//   P1 数据层：每域"数据资产"卡真实读 CSV（/data?domain=）；提交类动作一律 POST /submit → 落盘+审计
//   P2 工作流：新增"工作流"页（78 条，index.json），逐条可发起（/workflow-run）
//   P3 交付产物：新增"交付物"页（/deliverables），发起/提交产生的标准产物可查
//   P4 按钮三件套：F8 两按钮接真实后端；审计页修复空表 bug；preset 新建/编辑补齐；F11 按钮清零表
window.__ModuleLoader__.load({
	id: "@workbench/client-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback } = react;
		const PANEL_ID = "universal-workbench";
		const API = "/workbench/api";
		const GETOPS = ["scenes", "current", "audit", "domains", "workflows", "deliverables", "buttons", "tools-versions", "data"];

		// —— 数据层 ——
		async function api(op, body, qs) {
			const isGet = GETOPS.indexOf(op) >= 0;
			const url = API + "/" + op + (qs ? "?" + qs : "");
			const opt = isGet ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) };
			const r = await fetch(url, opt);
			return r.json();
		}
		const useApi = () => {
			const [scenes, setScenes] = useState([]);
			const [current, setCurrent] = useState({ current: null });
			const [stats, setStats] = useState({});
			const [tail, setTail] = useState([]);
			const [checklist, setChecklist] = useState({});
			const [flows, setFlows] = useState({ count: 0, by_domain: {}, workflows: [] });
			const [delivs, setDelivs] = useState({});
			const [btns, setBtns] = useState([]);
			const refresh = useCallback(async () => {
				try { setScenes(await api("scenes")); } catch (e) { }
				try { setCurrent(await api("current")); } catch (e) { }
				try { const a = await api("audit"); setStats(a.stats || {}); setTail(a.tail || []); } catch (e) { }
				try { setChecklist(await api("domains")); } catch (e) { }
				try { setFlows(await api("workflows")); } catch (e) { }
				try { setDelivs(await api("deliverables")); } catch (e) { }
				try { setBtns(await api("buttons")); } catch (e) { }
			}, []);
			useEffect(() => { refresh(); }, [refresh]);
			return { scenes, current, stats, tail, checklist, flows, delivs, btns, refresh };
		};

		// —— 通用小组件 ——
		const css = {
			root: { padding: "12px 16px", fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif", fontSize: "13px", color: "#1f2937", overflow: "auto", height: "100%", boxSizing: "border-box",
				// 修复「各层重叠」：面板根节点原先没有不透明背景，叠在主区其他内容之上时两层文字会直接重叠。
				// 面板是 main 槽的平级面板，必须自带底色把自己与下层隔开。
				background: "#ffffff", position: "relative", zIndex: 1, isolation: "isolate" },
			h2: { fontSize: "16px", fontWeight: 600, margin: "0 0 10px" },
			h3: { fontSize: "13px", fontWeight: 600, margin: "0 0 8px", color: "#111827" },
			card: { border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", padding: "10px 12px", margin: "0 0 10px" },
			grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px" },
			muted: { color: "#6b7280", fontSize: "12px" },
			btn: { font: "inherit", cursor: "pointer", border: "1px solid #d1d5db", background: "#fff", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", marginRight: "6px" },
			primary: { background: "#2563eb", color: "#fff", borderColor: "#2563eb" },
			green: { background: "#059669", color: "#fff", borderColor: "#059669" },
			input: { font: "inherit", border: "1px solid #d1d5db", borderRadius: "6px", padding: "4px 8px", fontSize: "12px", width: "100%", boxSizing: "border-box" },
			row: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" },
			table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
			th: { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "6px 8px", color: "#6b7280", fontWeight: 500 },
			td: { borderBottom: "1px solid #f3f4f6", padding: "6px 8px" },
			ok: { background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", color: "#065f46" },
			warn: { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", color: "#92400e" },
			badge: { display: "inline-block", borderRadius: "6px", padding: "1px 6px", fontSize: "11px", background: "#eff6ff", color: "#1d4ed8", marginRight: "4px" },
		};
		const Card = (title, children, extra) => h("div", { style: css.card }, h("div", { style: css.h3 }, title, extra || null), children);
		const Btn = (label, onClick, kind) => h("button", { style: Object.assign({}, css.btn, kind === "p" ? css.primary : kind === "g" ? css.green : null), onClick }, label);
		const Inp = (value, onChange, ph) => h("input", { style: css.input, value, placeholder: ph, onChange: (e) => onChange(e.target.value) });
		const Tbl = (head, rows) => h("table", { style: css.table },
			h("thead", null, h("tr", null, head.map((x, i) => h("th", { key: i, style: css.th }, x)))),
			h("tbody", null, rows.map((r, i) => h("tr", { key: i }, r.map((c, j) => h("td", { key: j, style: css.td }, c))))));
		const Bars = (items, color) => h("div", null, items.map((it, i) => h("div", { key: i, style: { marginBottom: "6px" } },
			h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#4b5563" } },
				h("span", null, it.label), h("span", null, String(it.value))),
			h("div", { style: { background: "#f3f4f6", borderRadius: "4px", height: "10px", overflow: "hidden" } },
				h("div", { style: { width: Math.max(2, Math.min(100, Number(it.pct) || 0)) + "%", height: "100%", background: color || "#2563eb" } })))));

		// —— 13 域独有交互卡（P1 改造：提交类动作 → POST /submit → deliverables 落盘 + 审计）——
		// 签名统一 panel(S, set, io)；io = { submit(kind, payload) }
		const DOMAIN_PANELS = {
			strat: (S, set, io) => Card("OKR 目标填写（提交 → 标准交付物）", h("div", null,
				h("div", { style: css.row }, h("span", { style: { width: "72px" } }, "目标 O"), Inp(S.o1 || "", (v) => set("o1", v), "例：Q4 华南区营收 +18%")),
				[1, 2, 3].map((i) => h("div", { key: i, style: css.row },
					h("span", { style: { width: "72px" } }, "KR" + i),
					h("input", { type: "range", min: 0, max: 100, value: S["kr" + i] || 40, style: { flex: 1 }, onChange: (e) => set("kr" + i, e.target.value) }),
					h("span", { style: { width: "38px", textAlign: "right" } }, (S["kr" + i] || 40) + "%"))),
				Btn("提交 OKR", () => io.submit("okr-set", { objective: S.o1 || "", krs: [1, 2, 3].map((i) => ({ kr: "KR" + i, progress_pct: Number(S["kr" + i] || 40) })) }), "p"),
				S["okr-setSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["okr-setSaved"]) : h("div", { style: css.muted }, "提交后生成 okr-set 交付物并记审计"))),
			mktOn: (S, set, io) => Card("内容日历（可点选排期 → 提交落盘）", h("div", null,
				h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px" } },
					["一", "二", "三", "四", "五", "六", "日"].map((d, i) => h("div", { key: i, style: css.muted }, d)),
					Array.from({ length: 14 }, (_, i) => h("button", {
						key: i, style: Object.assign({}, css.btn, { margin: 0, padding: "4px 0", fontSize: "11px" }, S.cal === i ? css.primary : null),
						onClick: () => set("cal", i),
					}, String(i + 1)))),
				h("div", { style: css.row, marginTop: "6px" },
					Btn("提交排期", () => io.submit("content-calendar", { slot: S.cal === undefined ? null : S.cal + 1, channel: "公众号" }), "p"),
					S.cal === undefined ? h("span", { style: css.muted }, "未选择") : h("span", { style: css.muted }, "选中：本月 " + (S.cal + 1) + " 日")),
				S["content-calendarSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["content-calendarSaved"]) : null)),
			sales: (S, set, io) => Card("CRM 管道（阶段可推进 → 快照落盘）",
				h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px" } },
					["线索", "接触", "报价", "赢单"].map((col, ci) => h("div", { key: ci, style: { border: "1px dashed #d1d5db", borderRadius: "8px", padding: "6px", minHeight: "86px" } },
						h("div", { style: css.muted }, col),
						(S.pipe || [0, 1, 0, 0]).map((n, i) => ci === n ? h("div", { key: i, style: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", marginTop: "4px" } },
							"商机 #" + (i + 1) + " ¥" + (80 + i * 35) + "k",
							h("div", null, Btn("推进 →", () => set("pipe", (S.pipe || [0, 1, 0, 0]).map((v, k) => k === i ? Math.min(3, v + 1) : v)), true))) : null)))),
				h("div", { style: css.row, marginTop: "6px" },
					Btn("保存管道快照", () => io.submit("pipeline-report", { stages: S.pipe || [0, 1, 0, 0] }), "p"),
					S["pipeline-reportSaved"] ? h("span", { style: css.ok }, " 已落盘：" + S["pipeline-reportSaved"]) : null)),
			fin: (S, set, io) => Card("报销单（提交 → 强审批交付物）", h("div", null,
				h("div", { style: css.row }, h("span", { style: { width: "72px" } }, "金额 ¥"), Inp(S.amt || "", (v) => set("amt", v), "0.00")),
				h("div", { style: css.row }, h("span", { style: { width: "72px" } }, "事由"), Inp(S.reason || "", (v) => set("reason", v), "差旅/办公")),
				h("div", { style: css.row }, h("span", { style: { width: "72px" } }, "级别"),
					["L1", "L2", "L3", "L4"].map((l) => h("button", { key: l, style: Object.assign({}, css.btn, S.lvl === l ? css.primary : null), onClick: () => set("lvl", l) }, l))),
				Btn("提交报销单", () => io.submit("expense-approve", { amount_yuan: S.amt || "0", reason: S.reason || "-", level: S.lvl || "L1" }), "p"),
				S["expense-approveSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["expense-approveSaved"] + "（L4 将进入双审批队列）") : h("div", { style: css.muted }, "L3/L4 触发强审批"))),
			rec: (S, set, io) => {
				const rows = [["张**", "销售经理", "10-02 14:00"], ["李**", "财务分析", "10-03 10:30"], ["王**", "HRBP", "10-05 16:00"]]
					.map((r, i) => [r[0], r[1],
						h("input", { key: "t", style: css.input, defaultValue: r[2], onChange: (e) => set("iv" + i, e.target.value) }),
						Btn("安排", () => io.submit("interview-schedule", { candidate_masked: r[0], slot: S["iv" + i] || r[2] }), "p")]);
				return Card("候选人看板（PII 脱敏列）", h("div", null,
					Tbl(["候选人", "岗位", "面试时间", "操作"], rows),
					h("div", { style: css.muted }, S["interview-scheduleSaved"] ? "最近安排已落盘：" + S["interview-scheduleSaved"] : "姓名/联系方式列已按 redact_gate 脱敏")));
			},
			trn: (S, set, io) => Card("课程目录 + 学时统计（报名 → 落盘）", h("div", null,
				h("div", { style: css.grid }, ["新员工入职", "合规必修", "销售进阶"].map((c, i) => h("div", { key: i, style: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" } },
					h("div", null, c), h("div", { style: css.muted }, (2 + i * 2) + " 学时"),
					Btn("报名", () => io.submit("enroll-approve", { course: c }), "p")))),
				Bars([{ label: "已完成", value: "18h", pct: 60 }, { label: "在修", value: "6h", pct: 20 }, { label: "待修", value: "6h", pct: 20 }], "#0ea5e9"),
				S["enroll-approveSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["enroll-approveSaved"]) : null)),
			prf: (S, set, io) => Card("校准分布（双审批 → 落盘）", h("div", null,
				Bars([{ label: "S", value: 3, pct: 15 }, { label: "A", value: 8, pct: 40 }, { label: "B", value: 7, pct: 35 }, { label: "C", value: 2, pct: 10 }], "#7c3aed"),
				h("div", { style: css.row }, Btn("一级审批", () => set("prfA1", "已同意"), "p"), Btn("二级审批", () => set("prfA2", "已复核"), "p")),
				h("div", { style: css.row }, Btn("提交校准结论", () => io.submit("calibration-approve", { a1: S.prfA1 || "", a2: S.prfA2 || "" }), "g")),
				S["calibration-approveSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["calibration-approveSaved"]) : h("div", { style: css.muted }, [S.prfA1, S.prfA2].filter(Boolean).join(" / ") || "待双审批"))),
			comp: (S, set, io) => Card("薪酬带宽偏离（区间口径 → 提交队列）", h("div", null,
				h("svg", { width: "100%", height: "76", viewBox: "0 0 300 76" },
					h("rect", { x: 20, y: 12, width: 180, height: 18, fill: "#dbeafe", rx: 4 }),
					h("text", { x: 24, y: 25, fontSize: 9, fill: "#1e40af" }, "带宽 P25–P75（区间口径，不显示个体值）"),
					[60, 140, 240].map((x, i) => h("circle", { key: i, cx: x, cy: 21, r: 5, fill: i === 2 ? "#dc2626" : "#2563eb" })),
					h("text", { x: 232, y: 44, fontSize: 9, fill: "#dc2626" }, "超出带宽")),
				h("div", { style: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", color: "#991b1b" } },
					"redact_gate：个体薪酬字段已脱敏，仅区间口径出数"),
				h("div", { style: css.row }, Btn("提交调薪双审批队列", () => io.submit("queue-approve", { queue: "3 条", approvals: "HRD+CFO" }), "p")),
				S["queue-approveSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["queue-approveSaved"]) : null)),
			ben: (S, set, io) => Card("弹性积分计算器（计入 → 落盘）", h("div", null,
				h("div", { style: css.row }, h("span", { style: { width: "90px" } }, "年度积分"), Inp(S.pts || "5000", (v) => set("pts", v))),
				h("div", { style: css.row }, h("span", { style: { width: "90px" } }, "已选方案"), Inp(S.plan || "商保+体检", (v) => set("plan", v))),
				h("div", { style: css.muted }, "剩余可用：" + (Number(S.pts || 0) - 3200) + " 分；方案：" + (S.plan || "—")),
				Btn("计入福利账本", () => io.submit("points-calc", { points_total: S.pts || "5000", plan: S.plan || "商保+体检" }), "p"),
				S["points-calcSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["points-calcSaved"]) : null)),
			admin: (S, set, io) => Card("采购比价（选定 → 落盘）", h("div", null,
				Tbl(["供应商", "单价 ¥", "交期", ""], [["A 供应商", 128, "3 天"], ["B 供应商", 116, "5 天"], ["C 供应商", 131, "2 天"]].map((r) =>
					[r[0], r[1], r[2], h("button", { style: Object.assign({}, css.btn, Number(r[1]) === 116 ? css.primary : null), onClick: () => { set("vendor", r[0]); io.submit("vendor-price", { chosen: r[0], unit_price: r[1] }); } }, Number(r[1]) === 116 ? "最低价" : "选定")].map((c, j) => h("td", { key: j, style: css.td }, c)))),
				h("div", { style: css.muted }, S.vendor ? "已选并落盘：" + S.vendor : "待选定供应商（不足三家须说明理由）"))),
			cmp: (S, set, io) => Card("制度审查 checklist（完成度 → 提交报告）", h("div", null,
				["劳动用工", "数据出境", "个人信息影响评估"].map((t, i) => h("label", { key: i, style: { display: "block", marginBottom: "4px" } },
					h("input", { type: "checkbox", checked: !!S["ck" + i], onChange: (e) => set("ck" + i, e.target.checked) }), " ", t)),
				h("div", { style: css.row, marginTop: "6px" }, Btn("提交审查记录", () => io.submit("policy-review", { items: [0, 1, 2].map((i) => ({ item: i, ok: !!S["ck" + i] })) }), "p")),
				S["policy-reviewSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["policy-reviewSaved"]) : h("div", { style: css.muted }, "完成度：" + [0, 1, 2].filter((i) => S["ck" + i]).length + "/3"))),
			erEap: (S, set, io) => Card("EAP 转介（匿名化 + 双审批 + 禁网 → 落盘）", h("div", null,
				h("div", { style: css.warn }, "⛔ 禁网指示：本域个体数据禁止流向公网搜索/外部工具（redact_gate 强制）"),
				h("div", { style: css.row }, h("span", { style: { width: "80px" } }, "匿名编号"), Inp(S.anon || "EAP-ANON-0731", (v) => set("anon", v))),
				h("div", { style: css.row }, h("span", { style: { width: "80px" } }, "转介方向"), Inp(S.dir || "心理咨询（外部机构）", (v) => set("dir", v))),
				h("div", { style: css.row }, Btn("主管审批", () => set("eapA1", "已同意"), "p"), Btn("EAP 专员复核", () => set("eapA2", "已复核"), "p")),
				h("div", { style: css.row }, Btn("提交转介单", () => io.submit("eap-referral", { anon_id: S.anon || "", direction: S.dir || "", approvals: [S.eapA1 || "", S.eapA2 || ""].join("/") }), "g")),
				S["eap-referralSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["eap-referralSaved"]) : h("div", { style: css.muted }, [S.eapA1, S.eapA2].filter(Boolean).join(" / ") || "待双审批"))),
			mktOff: (S, set, io) => Card("活动台账 + 物料合规（发起 → 落盘）", h("div", null,
				Tbl(["活动", "预算", "实际", "ROI"], [["华南渠道会", "80k", "76k", "1.9"], ["经销商大会", "150k", "168k", "2.4"]]),
				h("div", { style: css.row, marginTop: "6px" }, Btn("发起物料合规审查", () => io.submit("material-review", { legal: "通过", brand: "待改" }), "p")),
				S["material-reviewSaved"] ? h("div", { style: css.ok }, "已落盘：" + S["material-reviewSaved"]) : null)),
		};
		const DOMAIN_ORDER = [
			["strat", "战略 STRAT", "strat"], ["mkt-on", "营销（线上）MKT-ON", "mktOn"], ["mkt-off", "营销（线下）MKT-OFF", "mktOff"],
			["sales", "销售 SALES", "sales"], ["fin", "财务 FIN", "fin"], ["rec", "招聘 REC", "rec"],
			["trn", "培训 TRN", "trn"], ["prf", "绩效 PRF", "prf"], ["comp", "薪酬 COMP", "comp"],
			["ben", "福利 BEN", "ben"], ["admin", "行政 ADMIN", "admin"], ["cmp", "合规 CMP", "cmp"],
			["er-eap", "员工关系/EAP", "erEap"],
		];

		// —— F7 / F8 / F11 三页（P4：全部接真实后端，零空函数）——
		function PageF7() {
			const [net, setNet] = useState("检测中…");
			useEffect(() => { fetch(API + "/scenes").then(() => setNet("本地服务可达 · 公网调用已禁用（仅 127.0.0.1 回环）")).catch(() => setNet("本地服务不可达")); }, []);
			return h("div", null, Card("F7 离线模式指示页", h("div", null,
				h("div", { style: { background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px", padding: "8px", marginBottom: "8px" } }, "状态：" + net),
				h("div", { style: css.muted }, "规则：Web UI 仅绑 127.0.0.1；公网搜索类工具在 L4/EAP 域强制禁用。"))));
		}
		function PageF8({ refresh }) {
			const [tv, setTv] = useState(null);
			const [plan, setPlan] = useState(null);
			useEffect(() => { api("tools-versions").then((r) => setTv(r.content || "")).catch(() => setTv("(读取失败)")); }, []);
			return h("div", null,
				Card("F8 升级与回退（tools-versions 锁定）", h("div", null,
					h("pre", { style: { fontSize: "11px", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: "6px", padding: "8px", maxHeight: "260px", overflow: "auto", whiteSpace: "pre-wrap" } }, tv || "加载中…"))),
				Card("回退演练（dry-run，记 rollback.dryrun 审计）", h("div", null,
					Btn("执行回退演练（dry-run）", async () => { const r = await api("rollback-dryrun", {}); setPlan(r); refresh(); }, "p"),
					h("div", { style: css.muted }, "真实回退由 dsh-undo-savepoint 承担；本按钮产出回退计划并记审计。"),
					plan ? h("ol", { style: { fontSize: "12px", marginTop: "8px" } }, plan.plan.map((p, i) => h("li", { key: i }, p.action))) : null)));
		}
		function PageF11({ stats, tail, btns }) {
			const rows = Object.keys(stats).map((k) => [k, String(stats[k])]);
			return h("div", null,
				Card("F11 安装自检报告", h("div", null,
					Tbl(["审计事件", "计数"], rows.length ? rows : [["（暂无）", "0"]]),
					h("div", { style: css.muted, marginTop: "6px" }, "最近事件：" + (tail.length ? tail[tail.length - 1].action + " @" + tail[tail.length - 1].ts : "无")))),
				Card("按钮三件套清零表（每个按钮 = handler → 路由 → 审计）", h("div", null,
					Tbl(["按钮", "路由", "审计事件"], btns.map((b) => [b.label, b.route, b.audit])),
					h("div", { style: css.muted, marginTop: "6px" }, "规则：缺 route/audit 的按钮不允许上屏（复盘 P4 落地项）。"))));
		}

		// —— 主面板 ——
		function WorkbenchPanel() {
			const { scenes, current, stats, tail, checklist, flows, delivs, btns, refresh } = useApi();
			const [view, setView] = useState("dash");
			const [domain, setDomain] = useState(null);
			const [S, setS] = useState({});
			const [sel, setSel] = useState("");
			const [newName, setNewName] = useState("");
			const [editNote, setEditNote] = useState("");
			const [derivedFile, setDerivedFile] = useState("");
			const [engineOut, setEngineOut] = useState("");
			const [dataCache, setDataCache] = useState({});
			const [flowFilter, setFlowFilter] = useState("all");
			const [flowResult, setFlowResult] = useState({});
			const set = (k, v) => setS((p) => Object.assign({}, p, { [k]: v }));
			const run = async (op, body) => { const r = await api(op, body); refresh(); return r; };
			const io = {
				submit: async (kind, payload) => {
					const r = await run("submit", { domain: domain || "admin", kind, payload });
					const file = r.file || JSON.stringify(r).slice(0, 80);
					set(kind + "Saved", file);
					return file;
				},
			};
			const loadDomain = async (d) => {
				setDomain(d);
				if (!dataCache[d]) {
					try { const r = await api("data", null, "domain=" + encodeURIComponent(d)); setDataCache((p) => Object.assign({}, p, { [d]: r })); } catch (e) { }
				}
			};
			const runEngine = async () => {
				const r = await api("engine-run", { skill: (domain || "smoke") + "-smoke", prompt: "执行本域冒烟任务" });
				setEngineOut(r.fallback ? ("⚠ " + (r.output || "fallback")) : ("✓ 引擎 " + r.engine + "：" + String(r.output || "").slice(0, 220)));
				refresh();
			};
			const runFlow = async (id) => {
				setFlowResult((p) => Object.assign({}, p, { [id]: { running: true } }));
				const r = await run("workflow-run", { id, payload: {} });
				setFlowResult((p) => Object.assign({}, p, { [id]: r }));
			};
			const nav = [["dash", "主驾驶舱"], ["domains", "13 域工作台"], ["flows", "工作流 (" + (flows.count || 0) + ")"], ["delivs", "交付物"], ["audit", "审计"], ["f7", "F7 离线"], ["f8", "F8 升级回退"], ["f11", "F11 自检"]];
			const d = DOMAIN_ORDER.find((x) => x[0] === domain);
			const domainFlows = (flows.workflows || []).filter((w) => w.domain === domain);
			const dd = domain ? dataCache[domain] : null;

			function DomainDataCard() {
				const [tab, setTab] = useState(0);
				if (!dd) return Card("数据资产", h("div", { style: css.muted }, "加载中…"));
				if (!dd.tables || !dd.tables.length) return Card("数据资产", h("div", { style: css.muted }, "无数据资产"));
				const t = dd.tables[Math.min(tab, dd.tables.length - 1)];
				return Card("数据资产（" + dd.source_note + "）", h("div", null,
					h("div", { style: css.row }, dd.tables.map((x, i) => h("button", { key: i, style: Object.assign({}, css.btn, i === tab ? css.primary : null), onClick: () => setTab(i) }, x.name))),
					Tbl(t.head, t.rows)));
			}
			function DomainFlowsCard() {
				if (!domainFlows.length) return Card("本域工作流", h("div", { style: css.muted }, "无"));
				return Card("本域工作流（发起 → 标准交付物）", h("div", null, domainFlows.map((w) => {
					const r = flowResult[w.workflow_id];
					const line = r && !r.running
						? h("div", { style: r.fallback ? css.warn : css.ok }, (r.fallback ? "本地降级执行（凭据未配置）→ " : "引擎 " + r.engine + " → ") + "产物 " + (r.deliverable ? r.deliverable.file : "-"))
						: (r && r.running ? h("div", { style: css.muted }, "运行中…") : null);
					return h("div", { key: w.workflow_id, style: { borderBottom: "1px solid #f3f4f6", padding: "6px 0" } },
						h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
							h("div", null, h("b", null, w.workflow_id.split("@")[0].split(".")[1]), h("span", { style: css.muted }, "　" + w.description),
								w.dual ? h("span", { style: css.badge }, "双审批") : null),
							Btn("发起", () => runFlow(w.workflow_id), "p")),
						h("div", { style: css.muted }, "交付物：" + w.deliverable.file + " ｜ 验收：" + w.deliverable.acceptance),
						line);
				})));
			}

			// —— 分段构建（每段独立配平）——
			const presetCard = Card("preset 生命周期（F14：选 / 用 / 存 / 切 / 新建 / 编辑 → 各产生审计事件）", h("div", null,
				h("div", { style: css.row },
					h("select", { value: sel, onChange: (e) => setSel(e.target.value), style: Object.assign({}, css.input, { width: "auto" }) },
						[h("option", { key: "0", value: "" }, "— 选择 preset —")].concat(scenes.map((s) => h("option", { key: s.scene_id, value: s.scene_id },
							s.scene_id + "（L" + String(s.min_level).replace("L", "") + (s.dual ? "·双审批" : "") + "）")))),
					Btn("选/用（apply）", () => sel && run("apply", { id: sel }), "p"),
					Btn("存（save）", () => run("save"), false),
					Btn("切（switch）", () => sel && run("switch", { id: sel }), false),
					h("span", { style: css.muted }, "当前：" + (current.current || "未装载"))),
				h("div", { style: css.row },
					Inp(newName, setNewName, "新建 preset 名称（如 my-q4-plan）"),
					Btn("新建（派生自所选 Scene）", async () => {
						const base = sel || current.current;
						if (!base) return;
						const r = await run("preset-new", { base, name: newName });
						if (r.file) { setDerivedFile(r.file); setNewName(""); }
					}, "p"),
					derivedFile ? h("span", { style: css.muted }, "已派生：" + derivedFile) : null),
				h("div", { style: css.row },
					Inp(editNote, setEditNote, derivedFile ? "编辑备注（写入派生 preset）" : "先“新建”一个派生 preset"),
					Btn("编辑保存", async () => {
						if (!derivedFile) return;
						await run("preset-edit", { file: derivedFile, changes: { note: editNote } });
						setEditNote("");
					}, "p")),
				h("div", { style: css.muted },
					"审计计数：preset.apply=" + (stats["preset.apply"] || 0) + " ｜ preset.save=" + (stats["preset.save"] || 0) +
					" ｜ preset.switch=" + (stats["preset.switch"] || 0) + " ｜ preset.new=" + (stats["preset.new"] || 0) +
					" ｜ preset.edit=" + (stats["preset.edit"] || 0) + " ｜ engine.run=" + (stats["engine.run"] || 0) +
					" ｜ workflow.run=" + (stats["workflow.run"] || 0) + " ｜ deliverable.create=" + (stats["deliverable.create"] || 0))));

			const domainList = view === "domains" && !d ? h("div", { style: css.grid }, DOMAIN_ORDER.map(([id, label]) =>
				h("div", { key: id, style: css.card },
					h("div", { style: css.h3 }, label),
					h("div", { style: css.muted }, (checklist[id] || []).join(" ｜ ") || "—"),
					h("div", { style: css.muted }, "工作流 " + ((flows.by_domain || {})[id] || []).length + " 条"),
					// P5 桥接（D7）：主入口改为打开**独立应用**（同源托管，见 index.js 的 /app-page 路由）。
					// 面板不再承载域详情——那正是"各层重叠/挤在一起"的来源；域详情保留为次级"面板内简版"。
					Btn("进入域工作台 ↗", () => window.open("/workbench/api/app-page#/" + id, "_blank"), true),
					h("div", { style: { marginTop: "6px" } }, Btn("面板内简版", () => loadDomain(id)))))) : null;

			const domainDetail = view === "domains" && d ? h("div", null,
				h("div", { style: { marginBottom: "8px" } }, Btn("← 返回域列表", () => setDomain(null)),
					h("b", null, d[1]), h("span", { style: css.muted }, "　清单要求：" + (checklist[d[0]] || []).join(" ｜ "))),
				h("div", { style: css.grid },
					h(DomainDataCard, null),
					DOMAIN_PANELS[d[2]] ? DOMAIN_PANELS[d[2]](S, set, io) : Card("域概览", h("div", { style: css.muted }, "无独有元素")),
					h(DomainFlowsCard, null),
					Card("域 GT（经引擎）", h("div", null,
						Btn("跑一次 GT（经引擎）", runEngine, "p"),
						h("div", { style: css.muted }, "凭据有效时经 pi/dsh 执行并记 engine.run；无效时本地降级（fallback=offline）"),
						h("div", { style: engineOut && engineOut.indexOf("✓") === 0 ? css.ok : css.warn }, engineOut || "未执行"))))) : null;

			const dashStats = [["业务域", DOMAIN_ORDER.length], ["工作流", flows.count || 0],
				["审计事件", Object.values(stats).reduce((a, b) => a + b, 0)],
				["交付文件", Object.values(delivs).reduce((a, files) => a + (Array.isArray(files) ? files.length : 0), 0)]];
			const dashStatCards = dashStats.map(([label, value], i) =>
				h("div", { key: i, style: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px 10px", background: "#f8fafc" } },
					h("div", { style: { fontSize: "20px", fontWeight: 700, color: "#111827" } }, String(value)),
					h("div", { style: css.muted }, label)));
			const dashDomainCards = DOMAIN_ORDER.map(([id, label]) =>
				h("div", { key: id, style: css.card },
					h("div", { style: css.h3 }, label),
					h("div", { style: css.muted }, "工作流 " + ((flows.by_domain || {})[id] || []).length + " 条"),
					Btn("打开域工作台 ↗", () => window.open("/workbench/api/app-page#/" + id, "_blank"), "p")));
			const dashView = view === "dash" ? h("div", null,
				Card("主驾驶舱",
					h("div", null,
						h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "8px", marginBottom: "10px" } }, dashStatCards),
						h("div", { style: css.muted }, "当前 preset：" + (current.current || "未装载")),
						h("div", { style: css.muted }, "主入口：主驾驶舱 → 13 个域工作台 → 交付中心；也可在下方直接进入任一域。")),
					h("div", { style: css.row },
						Btn("打开 13 域驾驶舱 ↗", () => window.open("/workbench/api/app-page#/", "_blank"), "p"),
						Btn("查看 13 域工作台", () => setView("domains")))),
				Card("业务域快捷入口", h("div", { style: css.grid }, dashDomainCards))) : null;

			const flowsView = view === "flows" ? h("div", null,
				Card("工作流库（" + (flows.count || 0) + " 条 = 13 域 × 6；每条带交付规范）", h("div", null,
					h("div", { style: css.row }, ["all"].concat(DOMAIN_ORDER.map((x) => x[0])).map((dm) =>
						h("button", { key: dm, style: Object.assign({}, css.btn, flowFilter === dm ? css.primary : null), onClick: () => setFlowFilter(dm) }, dm === "all" ? "全部" : dm))),
					(flows.workflows || []).filter((w) => flowFilter === "all" || w.domain === flowFilter).map((w) => {
						const r = flowResult[w.workflow_id];
						const line = r && !r.running
							? h("div", { style: r.fallback ? css.warn : css.ok }, (r.fallback ? "本地降级（凭据未配置）→ " : "引擎 " + r.engine + " → ") + "产物 " + (r.deliverable ? r.deliverable.file : "-"))
							: (r && r.running ? h("div", { style: css.muted }, "运行中…") : null);
						return h("div", { key: w.workflow_id, style: { borderBottom: "1px solid #f3f4f6", padding: "6px 0" } },
							h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
								h("div", null, h("b", null, w.workflow_id.split("@")[0]), h("span", { style: css.muted }, "　" + w.description),
									w.kind === "approve" ? h("span", { style: css.badge }, w.dual ? "双审批" : "审批") : h("span", { style: css.badge }, w.kind)),
								Btn("发起", () => runFlow(w.workflow_id), "p")),
							h("div", { style: css.muted }, "交付物：" + w.deliverable.file + "（" + w.deliverable.format + "）字段：" + w.deliverable.fields.join("、") + " ｜ 验收：" + w.deliverable.acceptance),
							line);
					})))) : null;

			const delivsView = view === "delivs" ? h("div", null,
				Card("交付物（按域；提交/工作流运行产生，append-only）", h("div", null,
					h("div", { style: css.row }, Btn("刷新", () => refresh(), "p")),
					Object.keys(delivs).length
						? Object.keys(delivs).map((dm) => h("div", { key: dm, style: { marginBottom: "8px" } },
							h("div", { style: css.h3 }, dm),
							Tbl(["文件", "大小", "时间"], delivs[dm].map((x) => [x.file, x.bytes + " B", x.mtime.replace("T", " ").slice(0, 19)]))))
						: h("div", { style: css.muted }, "暂无——到“业务域工作台”提交表单或发起工作流即产生")))) : null;

			const auditView = view === "audit" ? Card("审计事件流（append-only，近 200 条）", h("div", null,
				Tbl(["时间", "事件", "明细"], tail.map((r, i) => [String(r.ts).replace("T", " ").slice(0, 19), r.action, Object.keys(r).filter((k) => k !== "ts" && k !== "action").map((k) => k + "=" + JSON.stringify(r[k])).join(" ").slice(0, 160)])),
				h("div", { style: css.muted, marginTop: "6px" }, "统计：" + Object.keys(stats).map((k) => k + "=" + stats[k]).join(" ｜ ")))) : null;

			return h("div", { style: css.root },
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" } },
					h("div", { style: css.h2, key: "t" }, "⟡ PiDSH Nexus · 全能工作台"),
					// P5 桥接：面板顶部总入口 → 独立应用的驾驶舱（同源托管，见 index.js 的 /app-page）
					h("button", { key: "app", style: Object.assign({}, css.btn, css.primary), onClick: () => window.open("/workbench/api/app-page#/", "_blank") }, "打开 13 域驾驶舱 ↗"),
					nav.map(([k, label]) => h("button", { key: k, style: Object.assign({}, css.btn, view === k ? css.primary : null), onClick: () => { setView(k); setDomain(null); } }, label))),
				presetCard,
				dashView,
				domainList,
				domainDetail,
				flowsView,
				delivsView,
				auditView,
				view === "f7" ? h(PageF7) : null,
				view === "f8" ? h(PageF8, { refresh }) : null,
				view === "f11" ? h(PageF11, { stats, tail, btns }) : null);
		}

		// —— 侧栏图标（必须给真实组件：传 null 会触发 React error #130）——
		function WorkbenchIcon() {
			return h("span", { style: { fontSize: "16px", lineHeight: "1" } }, "⟡");
		}

		function BrandMark({ size = 24 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 64 64", role: "img", "aria-label": "PiDSH Nexus" },
				h("rect", { x: 4, y: 4, width: 56, height: 56, rx: 16, fill: "#10243e" }),
				h("path", { d: "M20 19h24v7H20zM23 26v20h7V26zM34 26v20h7V26z", fill: "#ffffff" }),
				h("path", { d: "M14 47c8-8 12 7 20-1s11 3 16-4", fill: "none", stroke: "#28c7fa", strokeWidth: 4, strokeLinecap: "round" }),
				h("circle", { cx: 15, cy: 19, r: 4, fill: "#f5b83d" }),
				h("circle", { cx: 49, cy: 15, r: 4, fill: "#7c5cff" }),
				h("circle", { cx: 49, cy: 45, r: 4, fill: "#28c7fa" }));
		}

		function BrandName() {
			return h("div", { style: { lineHeight: 1.05, minWidth: 0 } },
				h("div", { style: { color: "#10243e", fontWeight: 750, fontSize: "14px", letterSpacing: "0" } }, "PiDSH Nexus"),
				h("div", { style: { color: "#64748b", fontWeight: 500, fontSize: "10px", marginTop: "2px" } }, "全能工作台"));
		}

		// —— cordis 客户端插件入口（契约：apply + inject）——
		function apply(ctx) {
			const slots = ctx && ctx.slots;
			if (!slots || typeof slots.inject !== "function") return () => { };
			const disposers = [];
			disposers.push(slots.inject("sidebar.brand.mark", () => slots.inject("sidebar.brand.name", function* () {
				yield slots.register({ name: "sidebar.brand.mark" }, BrandMark);
				yield slots.register({ name: "sidebar.brand.name" }, BrandName);
			})));
			disposers.push(slots.inject("sidebar.panellist", () => slots.register({
				name: "sidebar.panellist", id: PANEL_ID, order: 900, label: () => "⟡ 工作台",
			}, WorkbenchIcon)));
			disposers.push(slots.inject("main", () => slots.register({
				name: "main", key: PANEL_ID, inject: () => ({}),
			}, WorkbenchPanel)));
			return () => { for (const d of disposers.splice(0)) { try { d(); } catch (e) { } } };
		}
		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	},
});
