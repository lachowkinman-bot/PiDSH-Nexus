// PiDSH Nexus workbench client v4.
// Canonical shell-internal surface: strategy overview -> 13 domains -> 78 workflow
// instances -> signed approvals -> deliverables -> outcome and strategy roll-up.
window.__ModuleLoader__.load({
	id: "@workbench/client-ui",
	factory: (require) => {
		const module = { exports: {} };
		const exports = module.exports;
		const react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback } = react;
		const PANEL_ID = "universal-workbench";
		const API = "/workbench/api";
		const GETOPS = new Set([
			"strategy/overview",
			"domain-work-design",
			"operators",
			"workflow-definitions",
			"workflow-instances",
			"metrics",
			"backups",
			"domains",
			"workflows",
			"deliverables",
			"data",
			"audit",
			"tools-versions",
			"buttons",
		]);

		async function api(op, body, qs) {
			const url = API + "/" + op + (qs ? "?" + qs : "");
			const options = GETOPS.has(op)
				? {}
				: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) };
			const response = await fetch(url, options);
			const text = await response.text();
			let payload = null;
			try {
				payload = text ? JSON.parse(text) : null;
			} catch {
				payload = { error: text };
			}
			if (!response.ok) throw new Error((payload && (payload.error || payload.message)) || `HTTP ${response.status}`);
			return payload;
		}

		const css = {
			root: {
				padding: "14px 18px 28px",
				fontFamily: "system-ui,-apple-system,Segoe UI,Microsoft YaHei,sans-serif",
				fontSize: "13px",
				lineHeight: 1.5,
				color: "#172033",
				overflow: "auto",
				height: "100%",
				boxSizing: "border-box",
				background: "#f4f6f8",
				position: "relative",
				zIndex: 1,
				isolation: "isolate",
			},
			shell: { maxWidth: "1440px", margin: "0 auto" },
			top: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" },
			title: { fontSize: "18px", fontWeight: 750, color: "#111827", marginRight: "4px" },
			nav: { display: "flex", gap: "6px", flexWrap: "wrap" },
			card: {
				background: "#fff",
				border: "1px solid #dde3ea",
				borderRadius: "8px",
				padding: "12px 14px",
				marginBottom: "10px",
				boxShadow: "0 1px 2px rgba(16,24,40,.04)",
			},
			grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "10px" },
			grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "10px" },
			grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "10px" },
			row: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
			space: { flex: 1 },
			h2: { fontSize: "15px", fontWeight: 700, margin: "0 0 8px" },
			h3: { fontSize: "13px", fontWeight: 700, margin: "0 0 6px", color: "#111827" },
			muted: { color: "#667085", fontSize: "12px" },
			small: { color: "#667085", fontSize: "11px" },
			btn: {
				border: "1px solid #cfd7e2",
				background: "#fff",
				color: "#243247",
				borderRadius: "7px",
				padding: "5px 10px",
				cursor: "pointer",
				font: "inherit",
			},
			primary: { background: "#1458d4", borderColor: "#1458d4", color: "#fff" },
			danger: { background: "#c62828", borderColor: "#c62828", color: "#fff" },
			ok: { color: "#067647", fontWeight: 650 },
			warn: { color: "#b54708", fontWeight: 650 },
			bad: { color: "#b42318", fontWeight: 650 },
			input: {
				width: "100%",
				border: "1px solid #cfd7e2",
				borderRadius: "7px",
				padding: "6px 8px",
				font: "inherit",
				background: "#fff",
				boxSizing: "border-box",
			},
			field: { display: "grid", gridTemplateColumns: "150px minmax(0,1fr)", gap: "8px", alignItems: "center", marginBottom: "8px" },
			label: { color: "#344054", fontWeight: 600 },
			tag: {
				display: "inline-flex",
				alignItems: "center",
				padding: "1px 7px",
				borderRadius: "999px",
				border: "1px solid #d0d5dd",
				background: "#f8fafc",
				color: "#475467",
				fontSize: "11px",
			},
			progress: { height: "8px", background: "#e8edf3", borderRadius: "999px", overflow: "hidden" },
			progressFill: { height: "100%", background: "#1458d4" },
			divider: { height: "1px", background: "#e4e7ec", margin: "10px 0" },
		};

		const DOMAIN_ORDER = [
			["strat", "战略 STRAT", "#1458d4"],
			["mkt-on", "营销（线上）MKT-ON", "#7c3aed"],
			["mkt-off", "营销（线下）MKT-OFF", "#b54708"],
			["sales", "销售 SALES", "#067647"],
			["fin", "财务 FIN", "#0e7490"],
			["rec", "招聘 REC", "#c11574"],
			["trn", "培训 TRN", "#175cd3"],
			["prf", "绩效 PRF", "#6941c6"],
			["comp", "薪酬 COMP", "#c4320a"],
			["ben", "福利 BEN", "#027a48"],
			["admin", "行政 ADMIN", "#475467"],
			["cmp", "合规 CMP", "#344054"],
			["er-eap", "员工关系/EAP", "#9e165f"],
		];

		const DOMAIN_JOURNEY = {
			strat: "目标设定 -> KR 量化 -> 部门分解 -> 周期复盘 -> 决策归档",
			"mkt-on": "渠道输入 -> 投放分析 -> 内容与线索质量 -> 审批发布 -> ROI/线索复盘",
			"mkt-off": "活动方案 -> 预算与物料 -> 现场与线索 -> 商机移交 -> 活动 ROI 复盘",
			sales: "线索/商机 -> 方案报价 -> 合同条款 -> 审批 -> 赢单与输单复盘",
			fin: "凭证/预算输入 -> 勾稽校验 -> 异常分析 -> 审批 -> 报表/现金流/预算复盘",
			rec: "岗位与简历 -> 解析筛选 -> 邀约/题库 -> 面试反馈 -> 双审批 Offer -> 入职与留存复盘",
			trn: "能力缺口 -> 课程计划 -> 报名与完成 -> 证书合规 -> 学时与成效复盘",
			prf: "目标分解 -> KPI 跟踪 -> 校准 -> 申诉/改进 -> 等级分布与激励建议",
			comp: "薪酬带宽 -> 调薪提案 -> 成本测算 -> 双审批 -> 生效与预算复盘",
			ben: "方案比选 -> 参保/积分 -> 使用与理赔 -> 满意度 -> 成本与留存复盘",
			admin: "需求/采购 -> 三家比价 -> 审批 -> 入账/资产 -> 用印/盘点/SLA 复盘",
			cmp: "制度/PIPIA -> 风险识别 -> 整改 -> 证据链 -> 合规率与审计复盘",
			"er-eap": "案件/转介 -> 匿名化 -> 双审批 -> 处置 -> 离职/争议/健康脉搏复盘",
		};

		const FIELD_HELP = {
			candidate_masked: { label: "候选人匿名编号", help: "只使用不可还原的掩码编号，不使用姓名、手机号或身份证号。" },
			position: { label: "招聘岗位", help: "填写岗位名称，并与岗位能力模型和薪酬带对应。" },
			target: { label: "外发对象", help: "说明简历要发送给谁，以及外发目的是什么。" },
			resume_evidence: { label: "简历关键证据", help: "列出教育、经历、项目和技能证据；至少给出来源页码或片段。" },
			criteria_results: { label: "岗位条件匹配结果", help: "逐项填写 met、partial、not_met 或 unknown，并附证据。" },
			match_score: { label: "岗位匹配分（0-100）", help: "由证据和岗位标准计算，不能只凭关键词命中。" },
			redact_fields: { label: "脱敏字段", help: "外发前必须处理的个人字段清单。" },
			approver: { label: "审批人摘要", help: "系统会在审批中心记录完整角色、签名、时间和数据版本。" },
			mission: { label: "岗位使命", help: "用一句话说明岗位为公司创造什么结果。" },
			requirements: { label: "任职要求", help: "区分必备条件和加分条件，禁止歧视性条件。" },
			competencies: { label: "岗位能力模型", help: "每项能力包含权重、必需性和评价证据。" },
			band: { label: "薪酬带", help: "引用 comp 域 p25/p50/p75 区间，不填具体个人薪资。" },
			locale: { label: "语言/地区", help: "用于 JD、邀约和 Offer 的语言及地区适配。" },
			slot: { label: "面试时间", help: "使用 YYYY-MM-DD HH:mm；系统会检查面试官冲突。" },
			interviewers: { label: "面试官角色", help: "使用角色或掩码标识，不记录不必要的个人信息。" },
			mode: { label: "面试方式", help: "现场、视频或电话。" },
			question_bank_id: { label: "针对性题库编号", help: "题库必须依据岗位能力和简历待确认项生成。" },
			scorecard_id: { label: "评分卡编号", help: "每轮面试使用统一评分锚点。" },
			conflicts: { label: "冲突与备选", help: "列出面试官、场地或候选人时间冲突。" },
			feedback_summary: { label: "面试反馈汇总", help: "按能力汇总一致、分歧和证据不足项。" },
			interview_scores: { label: "各轮面试评分", help: "由用户提交各轮分数、评语、证据和结果。" },
			risk_flags: { label: "录用风险项", help: "列出证据冲突、能力缺口、薪酬或入职风险。" },
			offer_band: { label: "Offer 薪酬带", help: "引用岗位带宽；超过 P75 必须双审批。" },
			proposed_range: { label: "建议 Offer 区间", help: "只填区间，不填未经审批的最终个体金额。" },
			approvals: { label: "审批状态", help: "正式状态由审批中心根据角色签名计算。" },
			start_date: { label: "计划入职日", help: "用于倒排账号、设备、合同和培训任务。" },
			item: { label: "任务事项", help: "写清要交付的明确结果。" },
			owner: { label: "责任人", help: "填责任角色或掩码标识。" },
			due: { label: "到期日", help: "每项任务必须有到期日。" },
			status: { label: "当前状态", help: "填写待处理、进行中、完成或阻塞。" },
			goals_30_60_90: { label: "30/60/90 天目标", help: "每阶段给出目标、衡量方式和复核时间。" },
			retention_90d: { label: "90 天留存", help: "未到期时填 pending，不得提前伪造结果。" },
			week: { label: "统计周", help: "使用 ISO 周，例如 2026-W40。" },
			stage: { label: "阶段", help: "填写漏斗阶段名称，后一阶段人数不得大于前一阶段。" },
			count: { label: "人数/数量", help: "填写当前阶段的原始计数。" },
			conversion_pct: { label: "转化率", help: "说明是段间转化还是以投递为基期的累计转化。" },
			source: { label: "来源渠道", help: "填写招聘来源、营销渠道或业务来源。" },
			period: { label: "业务期间", help: "例如 2026-09 或 2026-Q4。" },
			revenue_wan: { label: "收入（万元）", help: "填写已确认口径的收入。" },
			cost_wan: { label: "成本（万元）", help: "填写业务口径成本。" },
			net_wan: { label: "净额（万元）", help: "净额应与收入、成本口径一致。" },
			amount_yuan: { label: "金额（元）", help: "核对发票、报销单和业务凭证是否一致。" },
			amount_k: { label: "金额（千元）", help: "按当前域统一单位填写。" },
			risk_level: { label: "风险等级", help: "按低、中、高或 L1-L4 口径填写。" },
			decision: { label: "决策建议", help: "写清建议、依据和需要人工确认的事项。" },
			notes: { label: "补充说明", help: "背景、范围、约束或判断口径。" },
			source_refs: { label: "证据来源", help: "填写工作区数据表、上传文件或上游实例引用。" },
		};

		function fieldInfo(field) {
			if (FIELD_HELP[field]) return FIELD_HELP[field];
			return {
				label: String(field || "").replace(/_/g, " "),
				help: "按业务实际填写；系统会校验格式、引用和审批门禁。",
			};
		}

		function Btn(label, onClick, kind, extra) {
			const style = Object.assign(
				{},
				css.btn,
				kind === "p" ? css.primary : null,
				kind === "d" ? css.danger : null,
				extra || null,
			);
			return h("button", { type: "button", style, onClick, disabled: !!(extra && extra.disabled) }, label);
		}

		function Card(title, ...children) {
			return h("section", { style: css.card }, title ? h("h2", { style: css.h2 }, title) : null, ...children);
		}

		function Tag(text, tone) {
			const style = Object.assign({}, css.tag);
			if (tone === "ok") Object.assign(style, { background: "#ecfdf3", color: "#067647", borderColor: "#abefc6" });
			if (tone === "warn") Object.assign(style, { background: "#fffaeb", color: "#b54708", borderColor: "#fedf89" });
			if (tone === "bad") Object.assign(style, { background: "#fef3f2", color: "#b42318", borderColor: "#fecdca" });
			if (tone === "p") Object.assign(style, { background: "#eff4ff", color: "#175cd3", borderColor: "#c7d7fe" });
			return h("span", { style }, text);
		}

		function Stat(label, value, note, tone) {
			return h("div", { style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "9px 10px", background: "#fff" } },
				h("div", { style: { fontSize: "10px", color: "#667085" } }, label),
				h("div", { style: Object.assign({ fontSize: "20px", fontWeight: 750, color: "#172033" }, tone ? { color: tone } : null) }, String(value == null ? "—" : value)),
				note ? h("div", { style: css.small }, note) : null);
		}

		function Progress(value, color) {
			const pct = Math.max(0, Math.min(100, Number(value || 0)));
			return h("div", { style: css.progress },
				h("div", { style: Object.assign({}, css.progressFill, { width: pct + "%" }, color ? { background: color } : null) }));
		}

		function nice(value, digits) {
			const number = Number(value);
			if (!Number.isFinite(number)) return value == null ? "—" : String(value);
			return number.toFixed(digits == null ? 1 : digits).replace(/\.0$/, "");
		}

		function Inp(value, onChange, placeholder, type) {
			return h("input", {
				type: type || "text",
				value: value == null ? "" : value,
				placeholder: placeholder || "",
				style: css.input,
				onChange: (event) => onChange(event.target.value),
			});
		}

		function Area(value, onChange, placeholder) {
			return h("textarea", {
				value: value == null ? "" : value,
				placeholder: placeholder || "",
				rows: 3,
				style: Object.assign({}, css.input, { resize: "vertical" }),
				onChange: (event) => onChange(event.target.value),
			});
		}

		function Table(headers, rows) {
			const head = h("thead", null, h("tr", null, ...headers.map((header, index) => h("th", {
				key: index,
				style: { position: "sticky", top: 0, background: "#f8fafc", textAlign: "left", padding: "7px 8px", borderBottom: "1px solid #e4e7ec", whiteSpace: "nowrap" },
			}, header))));
			const body = h("tbody", null, ...rows.map((row, rowIndex) => {
				const cells = row.map((value, cellIndex) => h("td", {
					key: cellIndex,
					style: { padding: "7px 8px", borderBottom: "1px solid #f2f4f7", whiteSpace: "nowrap" },
				}, value == null ? "" : String(value)));
				return h("tr", { key: rowIndex }, ...cells);
			}));
			return h("div", { style: { overflow: "auto", border: "1px solid #e4e7ec", borderRadius: "8px" } },
				h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "12px" } }, head, body));
		}

		function findTable(domainData, name) {
			if (!domainData || !Array.isArray(domainData.tables)) return { head: [], rows: [] };
			return domainData.tables.find((table) => table.name === name) || { head: [], rows: [] };
		}

		function rowsAsObjects(table) {
			const head = table.head || [];
			return (table.rows || []).map((row) => Object.fromEntries(head.map((key, index) => [key, row[index]])));
		}

		function DomainPulse({ id, domainData, metric }) {
			if (!domainData) return h("div", { style: css.muted }, "加载域内数据…");
			const rowsOf = (name) => rowsAsObjects(findTable(domainData, name));
			if (id === "strat") {
				const rows = rowsOf("okr").slice(0, 6);
				return h("div", null, ...rows.map((row, index) => h("div", { key: index, style: { marginBottom: "7px" } },
					h("div", { style: css.row }, h("b", null, row.kr_id || row.kr), h("span", { style: css.space }), Tag((row.progress_pct || "0") + "%")),
					Progress(row.progress_pct, "#1458d4"))));
			}
			if (id === "rec") {
				const rows = rowsOf("funnel").slice(-5);
				return h("div", null, ...rows.map((row, index) => h("div", { key: index, style: { marginBottom: "7px" } },
					h("div", { style: css.row }, h("b", null, row.stage), h("span", { style: css.space }), row.count + " 人"),
					Progress(row.conversion_pct, "#c11574"))));
			}
			if (id === "fin") {
				const rows = rowsOf("budget").slice(0, 6);
				return h("div", null, ...rows.map((row, index) => h("div", { key: index, style: { marginBottom: "7px" } },
					h("div", { style: css.row }, h("b", null, row.dept), h("span", { style: css.space }), `预算 ${row.budget_wan} 万 / 收入 ${row.revenue_wan} 万`),
					Progress(row.budget_wan ? (Number(row.used_wan) / Number(row.budget_wan)) * 100 : 0, "#0e7490"))));
			}
			if (id === "sales") {
				const rows = rowsOf("pipeline");
				const groups = rows.reduce((acc, row) => {
					acc[row.stage] = acc[row.stage] || { count: 0, amount: 0 };
					acc[row.stage].count += 1;
					acc[row.stage].amount += Number(row.amount_k || 0);
					return acc;
				}, {});
				return h("div", { style: css.grid3 }, ...Object.entries(groups).map(([stage, data], index) =>
					h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } },
						h("b", null, stage), h("div", { style: css.muted }, data.count + " 个商机"), h("div", null, data.amount + " 千元"))));
			}
			if (id === "mkt-on") {
				const rows = rowsOf("leads");
				return h("div", { style: css.grid3 }, ...Object.entries(rows.reduce((acc, row) => {
					acc[row.source] = (acc[row.source] || 0) + 1;
					return acc;
				}, {})).map(([source, count], index) => h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } }, h("b", null, source), h("div", null, count + " 条线索"))));
			}
			if (id === "mkt-off") {
				const rows = rowsOf("events");
				return h("div", null, ...rows.slice(0, 6).map((row, index) => h("div", { key: index, style: { padding: "5px 0", borderBottom: "1px solid #f2f4f7" } },
					h("b", null, row.event), " ", Tag("ROI " + row.roi), h("span", { style: css.muted }, "　" + row.leads + " 条线索"))));
			}
			if (id === "trn") {
				const rows = rowsOf("certificates");
				return h("div", { style: css.grid3 }, ...rows.slice(0, 6).map((row, index) => h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } },
					h("b", null, row.certificate), h("div", { style: css.muted }, row.holder_masked + " · " + row.expire_date), Tag(row.status, row.status === "有效" ? "ok" : "warn"))));
			}
			if (id === "prf") {
				const rows = rowsOf("kpi");
				return h("div", null, ...rows.slice(0, 6).map((row, index) => h("div", { key: index, style: { marginBottom: "7px" } },
					h("div", { style: css.row }, h("b", null, row.kpi), h("span", { style: css.space }), row.rate + "%"), Progress(row.rate, "#6941c6"))));
			}
			if (id === "comp") {
				const bands = rowsOf("bands");
				const queue = rowsOf("adjust_queue");
				return h("div", { style: css.grid2 },
					h("div", null, ...bands.slice(0, 6).map((row, index) => h("div", { key: index, style: { padding: "5px 0" } }, h("b", null, row.band), `　${row.p25_wan} - ${row.p75_wan} 万`))),
					h("div", null, h("b", null, "调薪队列"), h("div", { style: css.muted }, queue.length + " 条，待审批 " + queue.filter((row) => /待|草稿|审批/.test(row.status || "")).length + " 条")));
			}
			if (id === "ben") {
				const rows = rowsOf("plans");
				return h("div", null, ...rows.slice(0, 6).map((row, index) => h("div", { key: index, style: { padding: "5px 0", borderBottom: "1px solid #f2f4f7" } },
					h("b", null, row.plan), `　人均 ${row.cost_per_person_yuan} 元　满意度 ${row.satisfaction_score}`)));
			}
			if (id === "admin") {
				const rows = rowsOf("purchases");
				return h("div", { style: css.grid3 }, ...rows.slice(0, 6).map((row, index) => h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } },
					h("b", null, row.item), h("div", { style: css.muted }, row.vendor_masked + " · " + row.amount_yuan + " 元"), Tag(row.selected, row.selected === "Yes" ? "ok" : undefined))));
			}
			if (id === "cmp") {
				const rows = rowsOf("policy_checklist");
				const groups = rows.reduce((acc, row) => {
					acc[row.status] = (acc[row.status] || 0) + 1;
					return acc;
				}, {});
				return h("div", { style: css.grid3 }, ...Object.entries(groups).map(([status, count], index) =>
					h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } }, h("b", null, status), h("div", null, count + " 项"))));
			}
			if (id === "er-eap") {
				const rows = rowsOf("eap_referrals");
				const groups = rows.reduce((acc, row) => {
					acc[row.status] = (acc[row.status] || 0) + 1;
					return acc;
				}, {});
				return h("div", { style: css.grid3 }, ...Object.entries(groups).map(([status, count], index) =>
					h("div", { key: index, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px" } },
						h("b", null, status), h("div", null, count + " 件"), h("div", { style: css.small }, "仅匿名编号"))));
			}
			return h("div", { style: css.muted }, metric ? metric.north_star + "：" + metric.actual + " " + metric.unit : "无域内可视化");
		}

		function statusTone(status) {
			if (["completed", "approved"].includes(status)) return "ok";
			if (["blocked", "blocked_model", "failed", "rejected"].includes(status)) return "bad";
			if (["awaiting_approval", "running"].includes(status)) return "warn";
			return undefined;
		}

		function WorkflowWizard({ definition, instance, setInstance, refresh, onBack, operators = [] }) {
			const [form, setForm] = useState({});
			const [role, setRole] = useState("");
			const [operatorId, setOperatorId] = useState("");
			const [comment, setComment] = useState("");
			const [busy, setBusy] = useState("");
			const [error, setError] = useState("");
			useEffect(() => {
				if (instance) {
					setForm(Object.assign({}, instance.input || {}));
				} else {
					setForm({});
				}
				setError("");
			}, [instance && instance.id]);
			const activeOperators = operators.filter((item) => item.status === "active");
			const selectedOperator = activeOperators.find((item) => item.id === operatorId) || activeOperators[0] || null;
			const requiredRoles = (definition.stages.find((stage) => stage.type === "approval") || {}).requiredRoles || [];
			const availableRoles = selectedOperator
				? selectedOperator.roles.includes("*")
					? requiredRoles
					: selectedOperator.roles.filter((item) => !requiredRoles.length || requiredRoles.includes(item))
				: [];
			useEffect(() => {
				if (selectedOperator && selectedOperator.id !== operatorId) setOperatorId(selectedOperator.id);
				if (availableRoles.length && !availableRoles.includes(role)) setRole(availableRoles[0]);
			}, [selectedOperator && selectedOperator.id, availableRoles.join("|")]);

			const fields = definition.deliverable && definition.deliverable.fields ? definition.deliverable.fields : [];
			const setField = (key, value) => setForm((previous) => Object.assign({}, previous, { [key]: value }));

			const seed = () => {
				const next = {};
				for (const field of fields) {
					if (/amount|budget|cost|revenue|net|total|qty|count|hours|days|score|rate|pct|progress|salary|price/i.test(field)) next[field] = 1;
					else if (/date|period|month|quarter|week|year/i.test(field)) next[field] = "2026-Q4";
					else if (/approval/i.test(field)) next[field] = "pending";
					else if (/flag/i.test(field)) next[field] = "true";
					else next[field] = "示例";
				}
				next.notes = "请在此补充背景、范围和约束。";
				next.source_refs = ["workspace:data/" + definition.domain];
				setForm(next);
			};

			const execute = async (name, fn) => {
				setBusy(name);
				setError("");
				try {
					const result = await fn();
					if (result) setInstance(result);
					await refresh();
				} catch (caught) {
					setError(String(caught.message || caught));
				} finally {
					setBusy("");
				}
			};

			const begin = () => execute("begin", async () => {
				const started = await api("workflow-instances/start", { workflowId: definition.workflow_id, payload: form });
				return api("workflow-instances/actions", { id: started.id, action: "submit_input", payload: form });
			});
			const run = () => execute("run", () => api("workflow-instances/actions", { id: instance.id, action: "run", payload: form }));
			const retry = () => execute("retry", () => api("workflow-instances/actions", { id: instance.id, action: "retry" }));
			const approve = () => execute("approve", () => api("workflow-instances/actions", {
				id: instance.id,
				action: "approve",
				role,
				operatorId: selectedOperator && selectedOperator.id,
				comment,
			}));
			const reject = () => execute("reject", () => api("workflow-instances/actions", {
				id: instance.id,
				action: "reject",
				role,
				operatorId: selectedOperator && selectedOperator.id,
				comment,
			}));

			const stageCards = definition.stages.map((definitionStage) => {
				const runtime = instance && instance.stages ? instance.stages.find((stage) => stage.id === definitionStage.id) : null;
				const status = runtime ? runtime.status : "pending";
				return h("div", { key: definitionStage.id, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", background: "#fff" } },
					h("div", { style: css.row }, Tag(definitionStage.type, statusTone(status)), h("b", null, definitionStage.title)),
					runtime && runtime.error ? h("div", { style: css.bad }, runtime.error) : null);
			});
			const artifactLinks = instance && instance.artifacts
				? instance.artifacts.map((artifact, index) => h("div", { key: index, style: { marginBottom: "5px" } },
					h("a", {
						href: artifact.file.startsWith("instances/")
							? "/workbench/api/instance-artifact?id=" + encodeURIComponent(instance.id) + "&file=" + encodeURIComponent(artifact.file.replace("instances/" + instance.id + "/", ""))
							: "/workbench/api/artifact?id=" + encodeURIComponent(artifact.file),
						download: true,
					}, artifact.format.toUpperCase() + " " + artifact.file),
					h("span", { style: css.small }, "　" + artifact.bytes + " B")))
				: [];
			const deliveryNode = instance && instance.delivery
				? h("div", null,
					h("b", null, "正式交付包"),
					h("div", { style: css.small }, instance.delivery.manifest),
					h("div", { style: css.muted }, instance.delivery.artifacts.length + " 个文件"))
				: null;
			const artifactPanel = instance && instance.artifacts && instance.artifacts.length
				? Card("4. 产出与证据", h("div", { style: css.grid2 }, h("div", null, ...artifactLinks), deliveryNode))
				: null;

			return h("div", null,
				h("div", { style: css.row, marginBottom: "8px" }, Btn("返回工作流列表", onBack), h("b", null, definition.description)),
				Card("流程说明", h("div", null,
					h("div", { style: css.row }, Tag(definition.workflow_id, "p"), definition.dual ? Tag("双审批", "warn") : (definition.hitl_nodes && definition.hitl_nodes.length ? Tag("人工审批", "warn") : Tag("机器流程", "ok")), Tag((definition.deliverable && definition.deliverable.format) || "json")),
					h("div", { style: css.muted, marginTop: "6px" }, DOMAIN_JOURNEY[definition.domain]),
					h("div", { style: css.small, marginTop: "4px" }, "验收：" + ((definition.deliverable && definition.deliverable.acceptance) || "—")))),
				Card("阶段链", h("div", { style: css.grid3 }, ...stageCards)),
				Card("1. 业务输入（小白提示：先点“填入示例”即可完整跑一次）",
					h("div", { style: css.row, marginBottom: "8px" }, Btn("填入示例", seed), Btn("提交输入并校验", begin, "p", { disabled: busy || !Object.keys(form).length })),
					...fields.map((field) => h("div", { key: field, style: css.field },
						h("label", { style: css.label }, fieldInfo(field).label),
						h("div", null,
							Inp(form[field], (value) => setField(field, value), fieldInfo(field).help),
							h("div", { style: css.small }, fieldInfo(field).help)))),
					h("div", { style: css.field }, h("label", { style: css.label }, "补充说明"), Area(form.notes, (value) => setField("notes", value), "背景、范围、约束或判断口径")),
					h("div", { style: css.field }, h("label", { style: css.label }, "来源引用"), Inp((form.source_refs || []).join(","), (value) => setField("source_refs", value.split(",").map((item) => item.trim()).filter(Boolean)), "workspace:data/..."))),
				instance ? Card("2. 运行与门禁", h("div", null,
					h("div", { style: css.row, marginBottom: "8px" },
						Tag("状态 " + instance.status, statusTone(instance.status)),
						instance.status === "blocked_model" ? Btn("模型恢复后重试", retry, "p", { disabled: !!busy }) : null,
						["ready", "running", "blocked", "approved"].includes(instance.status) && instance.status !== "awaiting_approval"
							? Btn("继续运行到下一门禁", run, "p", { disabled: !!busy })
							: null),
					instance.analysis ? h("div", null,
						h("b", null, instance.analysis.summary),
						h("div", { style: css.row, marginTop: "6px" }, Tag("置信度 " + instance.analysis.confidence), Tag("证据 " + instance.analysis.evidence_refs.length), Tag("模型 " + instance.analysis.model)),
						h("ul", null, ...(instance.analysis.findings || []).map((item, index) => h("li", { key: index }, (item.title || item.id) + "：" + (item.detail || "")))))
						: h("div", { style: css.muted }, "提交输入后，点击“继续运行”执行校验、LLM 分析、质量门、审批与交付。"),
					instance.last_error ? h("div", { style: css.bad }, instance.last_error) : null)) : null,
				instance && instance.status === "awaiting_approval" ? Card("3. 人工审批（角色 + 操作者签名）",
					h("div", { style: css.grid2 },
						h("div", { style: css.field }, h("label", { style: css.label }, "审批操作者"), selectedOperator
							? h("select", { "aria-label": "审批操作者", style: css.input, value: selectedOperator.id, onChange: (event) => { setOperatorId(event.target.value); setRole(""); } },
								...activeOperators.map((item) => h("option", { key: item.id, value: item.id }, item.display_name + " · " + item.id)))
							: h("div", { style: css.bad }, "尚未配置可用的本地审批身份，请先在工作台审批中心创建。")),
						h("div", { style: css.field }, h("label", { style: css.label }, "审批角色"), availableRoles.length
							? h("select", { "aria-label": "审批角色", style: css.input, value: role, onChange: (event) => setRole(event.target.value) },
								...availableRoles.map((item) => h("option", { key: item, value: item }, item)))
							: h("div", { style: css.muted }, "该操作者未分配角色。")),
						h("div", { style: css.field }, h("label", { style: css.label }, "审批意见"), Area(comment, setComment, "通过原因；驳回时必填"))),
					h("div", { style: css.row }, Btn("通过", approve, "p", { disabled: !!busy || !selectedOperator || !role }), Btn("驳回", reject, "d", { disabled: !!busy || !selectedOperator || !role }))) : null,
				artifactPanel,
				error ? h("div", { style: Object.assign({}, css.card, { borderColor: "#fecdca", background: "#fffbfa", color: "#b42318" }) }, error) : null);
		}

		function DomainDetail({ id, label, color, strategy, definitions, instances, designs, metrics, onBack, onRun, refresh }) {
			const [data, setData] = useState(null);
			const [tab, setTab] = useState("flows");
			const [importTableName, setImportTableName] = useState("");
			const [importFile, setImportFile] = useState(null);
			const [importStatus, setImportStatus] = useState("");
			const loadData = useCallback(async () => {
				const value = await api("data", null, "domain=" + encodeURIComponent(id));
				setData(value);
				return value;
			}, [id]);
			useEffect(() => {
				let alive = true;
				api("data", null, "domain=" + encodeURIComponent(id)).then((value) => { if (alive) setData(value); });
				return () => { alive = false; };
			}, [id]);
			const metric = strategy.domains.find((item) => item.domain === id);
			const domainFlows = definitions.filter((item) => item.domain === id);
			const domainInstances = instances.filter((item) => item.domain === id);
			const domainMetrics = metrics.filter((item) => item.domain === id);
			const latest = domainInstances[0];
			const design = designs.find((item) => item.domain === id);
			const actions = domainInstances.filter((item) => !["completed", "archived"].includes(item.status));
			const risks = domainInstances.filter((item) => ["blocked", "blocked_model", "failed", "rejected"].includes(item.status));
			const tablePanel = tab === "tables" && data
				? h("div", null,
					Card("导入用户数据（CSV 自动备份后原子写入）",
						h("div", { style: css.grid2 },
							h("div", { style: css.field },
								h("label", { style: css.label }, "目标数据表"),
								h("select", {
									style: css.input,
									value: importTableName,
									onChange: (event) => setImportTableName(event.target.value),
								},
									h("option", { value: "" }, "— 请选择 —"),
									...data.tables.map((table) => h("option", { key: table.name, value: table.name }, table.name + ".csv")))),
							h("div", { style: css.field },
								h("label", { style: css.label }, "CSV 文件"),
								h("input", {
									type: "file",
									accept: ".csv,text/csv",
									style: css.input,
									onChange: (event) => setImportFile(event.target.files && event.target.files[0] ? event.target.files[0] : null),
								}))),
						h("div", { style: css.row },
							Btn("导入并备份", async () => {
								if (!importTableName || !importFile) {
									setImportStatus("请先选择目标表并选择 CSV 文件。");
									return;
								}
								setImportStatus("正在导入…");
								try {
									const csv = await importFile.text();
									const result = await api("imports", { domain: id, table: importTableName, csv });
									setImportStatus(`已导入 ${result.rows} 行；备份 ${result.backup}；数据版本 ${result.data_version.slice(0, 12)}`);
									setImportFile(null);
									await loadData();
									await refresh();
								} catch (error) {
									setImportStatus("导入失败：" + String(error.message || error));
								}
							}, "p", { disabled: !importTableName || !importFile }),
							h("span", { style: importStatus.startsWith("导入失败") ? css.bad : css.muted }, importStatus)),
						h("div", { style: css.small }, "要求：UTF-8 CSV，首行为表头；写入前保存工作区快照，失败不覆盖原表。")),
					...data.tables.map((table, index) => h("details", { key: index, style: css.card },
						h("summary", null, h("b", null, table.name + ".csv"), h("span", { style: css.muted }, "　" + table.rows.length + " 行")),
						h("div", { style: { marginTop: "8px" } }, Table(table.head, table.rows.slice(0, 12))))))
				: null;
			return h("div", null,
				h("div", { style: css.row, marginBottom: "8px" },
					Btn("返回 13 域", onBack),
					h("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: color } }),
					h("b", null, label),
					Tag(metric ? metric.north_star + "：" + nice(metric.actual) + " " + metric.unit : "指标加载中", "p")),
				Card("本域经营路径", h("div", null,
					h("div", null, DOMAIN_JOURNEY[id] || "输入 -> 校验 -> 分析 -> 审批 -> 交付 -> 复盘"),
					h("div", { style: css.small, marginTop: "4px" }, "战略贡献：" + ((metric && metric.contributes_to) || []).join("、"))),
					h("div", { style: css.grid4, marginTop: "10px" },
						Stat("工作流", domainFlows.length, "全部可发起"),
						Stat("实例", domainInstances.length, "运行与历史"),
						Stat("待审批", domainInstances.filter((item) => item.status === "awaiting_approval").length),
						Stat("已完成", domainInstances.filter((item) => item.status === "completed").length))),
				Card("业务脉搏", h(DomainPulse, { id, domainData: data, metric })),
				h("div", { style: css.row, marginBottom: "8px" },
					["flows", "actions", "tables", "approvals", "outputs", "outcome", "history"].map((name) => Btn({
						flows: "工作模块",
						actions: "待办与风险",
						tables: "数据台账",
						approvals: "审批",
						outputs: "交付物",
						outcome: "成效复盘",
						history: "运行记录",
					}[name], () => setTab(name), tab === name ? "p" : null))),
				tab === "flows" && design ? h("div", null,
					...design.modules.map((module) => h("details", {
						key: module.id,
						style: css.card,
						open: true,
					},
						h("summary", null, h("b", null, module.name), h("span", { style: css.muted }, "　" + module.items.length + " 个工作事项")),
						h("div", { style: css.muted, marginTop: "6px" }, module.outcome),
						h("div", { style: css.grid2, marginTop: "8px" }, ...module.items.map((item) => {
							const definition = definitions.find((value) => value.workflow_id === item.workflow.id);
							return h("div", { key: item.id, style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "10px", background: "#fff" } },
								h("div", { style: css.row }, h("b", null, item.name), h("span", { style: css.space }), definition?.dual ? Tag("双审批", "warn") : null),
								h("div", { style: css.muted }, item.workflow.id),
								h("div", { style: css.small, margin: "5px 0" }, "责任：" + item.owner_role + "　频率：" + item.frequency),
								h("div", { style: css.small, marginBottom: "6px" }, "结果：" + item.outcome),
								h("details", null,
									h("summary", null, "查看 " + item.stages.length + " 个环节标准与数据契约"),
									h("div", { style: { marginTop: "6px" } },
										h("div", { style: css.small }, "输入 Schema：" + item.data_contract.input_schema_ref),
										h("div", { style: css.small }, "输出 Schema：" + item.data_contract.output_schema_ref),
										h("div", { style: css.small, marginBottom: "6px" }, "TypeDict：" + item.data_contract.typedict_ref),
										Table(["环节", "类型", "标准", "门禁", "失败处理"], item.stages.map((stage) => [
											stage.name,
											stage.type,
											stage.standard,
											stage.gate,
											stage.on_fail,
										])),
										h("details", { style: { marginTop: "6px" } },
											h("summary", null, "阶段契约与规则（" + item.business_rules.length + " 条）"),
											Table(["稳定 ID", "类型", "表达式", "状态"], item.business_rules.map((rule) => [
												rule.id,
												rule.kind,
												rule.expression,
												rule.status || "active",
											]))),
										item.cross_domain_effects.length ? h("details", { style: { marginTop: "6px" } },
											h("summary", null, "跨域副作用（" + item.cross_domain_effects.length + "）"),
											Table(["事件", "目标域", "匿名键", "失败处理"], item.cross_domain_effects.map((effect) => [
												effect.event_id,
												effect.target_domain,
												effect.anonymous_key,
												effect.on_fail,
											]))) : null)),
								Btn("发起工作流", () => onRun(item.workflow.id), "p", { marginTop: "8px" }));
						}))))) : null,
				tab === "flows" && !design ? h("div", { style: css.muted }, "工作模块设计加载中…") : null,
				tablePanel,
				tab === "actions" ? h("div", { style: css.grid2 },
					Card("待办队列", actions.length
						? Table(["实例", "工作流", "状态", "下一步"], actions.map((item) => [
							item.id,
							item.workflow_id,
							item.status,
							item.status === "awaiting_approval" ? "进入审批中心完成签名"
								: item.status === "blocked_model" ? "恢复模型后从断点重试"
								: "继续运行或补齐输入",
						]))
						: h("div", { style: css.muted }, "当前没有待办。")),
					Card("风险与阻断", risks.length
						? Table(["实例", "风险", "证据"], risks.map((item) => [
							item.id,
							item.status,
							item.last_error || "查看审计与运行记录",
						]))
						: h("div", { style: css.muted }, "当前没有阻断或驳回事项。"))) : null,
				tab === "approvals" ? Card("本域审批", domainInstances.some((item) => item.status === "awaiting_approval")
					? Table(["实例", "工作流", "已签", "更新时间"], domainInstances.filter((item) => item.status === "awaiting_approval").map((item) => [
						item.id,
						item.workflow_id,
						item.approvals.filter((approval) => approval.decision === "approved").length,
						item.updated_at,
					]))
					: h("div", { style: css.muted }, "当前没有待审批事项；审批身份可在全局审批中心维护。")) : null,
				tab === "outcome" ? Card("成效与战略回写", h("div", null,
					metric ? h("div", null,
						h("b", null, metric.north_star + "：" + nice(metric.actual) + " " + metric.unit),
						h("div", { style: css.small }, "战略贡献：" + (metric.contributes_to || []).join("、")),
						h("div", { style: css.small }, "来源：" + (metric.source || "工作区数据"))) : null,
					domainMetrics.length ? Table(["指标", "实际值", "单位", "数据版本", "时间"], domainMetrics.slice(0, 50).map((item) => [
						item.metric,
						nice(item.actual),
						item.unit,
						String(item.data_version || "").slice(0, 12),
						item.ts || "",
					])) : h("div", { style: css.muted, marginTop: "8px" }, "尚无成效快照；完成流程后自动回写。"))) : null,
				tab === "outputs" ? Card("交付物", domainInstances.some((item) => item.artifacts && item.artifacts.length)
					? h("div", null, ...domainInstances.filter((item) => item.artifacts && item.artifacts.length).map((item) => h("div", { key: item.id, style: { padding: "6px 0", borderBottom: "1px solid #f2f4f7" } },
						h("b", null, item.id), " ", Tag(item.status, statusTone(item.status)), h("div", { style: css.small }, item.artifacts.map((artifact) => artifact.format.toUpperCase()).join(" / ")))))
					: h("div", { style: css.muted }, "尚无交付物，先发起一条流程完成审批与交付。")) : null,
				tab === "history" ? Card("运行记录", domainInstances.length
					? Table(["实例", "流程", "状态", "更新时间", "下一步"], domainInstances.map((item) => [
						item.id,
						item.workflow_id,
						item.status,
						item.updated_at,
						item.status === "awaiting_approval" ? "等待审批" : item.status === "blocked_model" ? "恢复模型后重试" : item.status === "completed" ? "下载交付物" : "继续运行",
					]))
					: h("div", { style: css.muted }, "尚无运行记录。")) : null,
				latest ? h("div", { style: css.small }, "最近实例：" + latest.id) : null);
		}

		function StrategyView({ strategy, onDomain, onRunStrategy }) {
			const objective = strategy.objective;
			const colors = { critical: "#b42318", warning: "#b54708", on_track: "#067647", unknown: "#667085" };
			const keyResultCards = strategy.key_results.map((kr) => h("div", {
				key: kr.id,
				style: { border: "1px solid #e4e7ec", borderRadius: "8px", padding: "10px" },
			},
				h("div", { style: css.row },
					h("b", null, kr.title),
					h("span", { style: css.space }),
					Tag(kr.risk, kr.risk === "on_track" ? "ok" : kr.risk === "warning" ? "warn" : "bad")),
				h("div", { style: css.row, margin: "6px 0" },
					h("b", { style: { color: colors[kr.risk] } }, kr.actual == null ? "—" : nice(kr.actual) + " " + kr.unit),
					h("span", { style: css.muted }, "目标 " + kr.target + " " + kr.unit),
					h("span", { style: css.space }),
					(kr.progress_pct == null ? "—" : kr.progress_pct) + "%"),
				Progress(kr.progress_pct, colors[kr.risk]),
				h("div", { style: css.small, marginTop: "4px" }, "来源域：" + kr.domain + "　负责人：" + kr.owner)));
			const domainCards = strategy.domains.map((domain) => h("button", {
				key: domain.domain,
				type: "button",
				onClick: () => onDomain(domain.domain),
				style: Object.assign({}, css.card, { textAlign: "left", cursor: "pointer", margin: 0 }),
			},
				h("div", { style: css.row },
					h("b", null, domain.label),
					h("span", { style: css.space }),
					Tag((domain.weight * 100).toFixed(0) + "%")),
				h("div", { style: css.muted }, domain.north_star),
				h("div", { style: { fontSize: "20px", fontWeight: 750, marginTop: "4px" } }, domain.actual == null ? "—" : nice(domain.actual) + " " + domain.unit),
				h("div", { style: css.small }, "来源：" + (domain.source || "—"))));
			const blockerCard = strategy.blockers.length
				? Card("需要处理", h("div", null, ...strategy.blockers.map((item) => h("div", {
					key: item.instance_id,
					style: { padding: "5px 0" },
				},
					Tag(item.status, "bad"),
					" ",
					h("b", null, item.workflow_id),
					h("span", { style: css.muted }, "　" + (item.error || ""))))))
				: null;
			return h("div", null,
				Card("战略总看板",
					h("div", { style: css.row },
						h("div", null, h("h1", { style: { margin: 0, fontSize: "20px" } }, objective.title), h("div", { style: css.muted }, objective.owner + "　周期 " + strategy.period)),
						h("div", { style: css.space }),
						Btn("运行季度战略复盘", onRunStrategy, "p")),
					h("div", { style: Object.assign({}, css.grid4, { marginTop: "10px" }) },
						Stat("战略达成", objective.actual == null ? "—" : objective.actual + "%", (objective.data_version || "").slice(0, 10), colors[objective.actual >= 85 ? "on_track" : objective.actual >= 60 ? "warning" : "critical"]),
						Stat("关键结果", strategy.key_results.length, "可下钻到数据源"),
						Stat("运行中实例", strategy.active_instances),
						Stat("已完成", strategy.completed_instances)),
					Progress(objective.actual, "#1458d4")),
				Card("关键结果", h("div", { style: css.grid2 }, ...keyResultCards)),
				Card("13 域贡献", h("div", { style: css.grid3 }, ...domainCards)),
				blockerCard);
		}

		function DomainsView({ strategy, definitions, instances, designs, onOpen }) {
			return h("div", null,
				Card("13 域工作台", h("div", { style: css.muted }, "每个域包含经营路径、6 条流程、数据台账、审批、交付物和复盘。")),
				h("div", { style: css.grid3 }, ...DOMAIN_ORDER.map(([id, label, color]) => {
					const metric = strategy.domains.find((item) => item.domain === id);
					const domainInstances = instances.filter((item) => item.domain === id);
					const design = designs.find((item) => item.domain === id);
					return h("button", {
						key: id,
						type: "button",
						onClick: () => onOpen(id),
						style: Object.assign({}, css.card, { margin: 0, textAlign: "left", cursor: "pointer", borderTop: "3px solid " + color }),
					},
						h("div", { style: css.row }, h("b", null, label), h("span", { style: css.space }), Tag(domainInstances.filter((item) => item.status === "awaiting_approval").length + " 待审批")),
						h("div", { style: css.muted }, metric ? metric.north_star + "：" + nice(metric.actual) + " " + metric.unit : "指标加载中"),
						h("div", { style: css.small, marginTop: "5px" }, DOMAIN_JOURNEY[id]),
						h("div", { style: css.row, marginTop: "8px" }, Tag((design?.modules.length || 3) + " 模块"), Tag((design?.modules.reduce((sum, module) => sum + module.items.length, 0) || 6) + " 事项"), Tag(domainInstances.length + " 个实例"), Btn("进入域工作台", () => onOpen(id), "p")));
				})));
		}

		function ApprovalsView({ instances, operators, onOpen, onCreateOperator, refresh }) {
			const pending = instances.filter((item) => item.status === "awaiting_approval");
			const [operatorId, setOperatorId] = useState("");
			const [displayName, setDisplayName] = useState("");
			const [roles, setRoles] = useState("");
			const [error, setError] = useState("");
			const create = async () => {
				setError("");
				try {
					await onCreateOperator({ id: operatorId, displayName, roles });
					setOperatorId("");
					setDisplayName("");
					setRoles("");
					await refresh();
				} catch (caught) {
					setError(String(caught.message || caught));
				}
			};
			return h("div", null,
				Card("审批身份（HMAC 签名绑定实例、数据版本和草稿哈希）",
					operators.length
						? Table(["操作者", "角色", "状态", "创建时间"], operators.map((item) => [
							item.id,
							item.display_name,
							item.roles.join("、"),
							item.status,
						]))
						: h("div", { style: css.muted }, "尚未登记审批身份。"),
					h("div", { style: css.grid3, marginTop: "10px" },
						h("div", { style: css.field }, h("label", { style: css.label }, "操作者 ID"), Inp(operatorId, setOperatorId, "例如：BIZ-001")),
						h("div", { style: css.field }, h("label", { style: css.label }, "显示名称"), Inp(displayName, setDisplayName, "例如：业务负责人甲")),
						h("div", { style: css.field }, h("label", { style: css.label }, "角色列表"), Inp(roles, setRoles, "多个角色用逗号分隔"))),
					h("div", { style: css.row }, Btn("登记/更新审批身份", create, "p", { disabled: !operatorId || !displayName || !roles }), error ? h("span", { style: css.bad }, error) : null)),
				Card("审批中心（角色 + 操作者签名）", pending.length
					? Table(["实例", "域", "工作流", "已签", "更新时间", "操作"], pending.map((item) => [
						item.id,
						item.domain,
						item.workflow_id,
						item.approvals.filter((approval) => approval.decision === "approved").length,
						item.updated_at,
						"打开审批",
					]))
					: h("div", { style: css.muted }, "当前没有待审批事项。")));
		}

		function DeliveriesView({ instances, deliveries }) {
			return h("div", null,
				Card("正式交付包", deliveries.length
					? Table(["域", "标题", "生成时间", "文件数", "清单"], deliveries.map((item) => [
						item.domain,
						item.title,
						item.generatedAt,
						item.artifactCount,
						item.manifest,
					]))
					: h("div", { style: css.muted }, "尚无正式交付包。")),
				Card("工作流实例产出", instances.some((item) => item.artifacts && item.artifacts.length)
					? Table(["实例", "域", "状态", "格式", "更新时间"], instances.filter((item) => item.artifacts && item.artifacts.length).map((item) => [
						item.id,
						item.domain,
						item.status,
						item.artifacts.map((artifact) => artifact.format.toUpperCase()).join(" / "),
						item.updated_at,
					]))
					: h("div", { style: css.muted }, "尚无实例产出。")));
		}

		function AuditView({ audit, instances, backups, metrics }) {
			const tail = audit.tail || [];
			return h("div", null,
				Card("审计统计", h("div", { style: css.grid4 },
					Stat("实例", instances.length),
					Stat("指标快照", metrics.length),
					Stat("备份", backups.length),
					Stat("审计事件", Object.values(audit.stats || {}).reduce((sum, value) => sum + Number(value || 0), 0)))),
				Card("最近审计", tail.length ? Table(["时间", "动作", "明细"], tail.slice(0, 120).map((item) => [
					item.ts,
					item.action,
					Object.keys(item).filter((key) => !["ts", "action"].includes(key)).map((key) => key + "=" + JSON.stringify(item[key])).join(" ").slice(0, 180),
				])) : h("div", { style: css.muted }, "暂无审计事件。")));
		}

		function SystemView({ tools, backups, onRefresh }) {
			const [plan, setPlan] = useState(null);
			const rollback = async () => {
				try {
					setPlan(await api("rollback-dryrun", {}));
				} catch (error) {
					setPlan({ error: String(error.message || error) });
				}
			};
			return h("div", null,
				Card("运行与回退",
					h("div", { style: css.row },
						Btn("刷新状态", onRefresh),
						Btn("F7 离线检查", () => setPlan({ offline: true, message: "本地回环可用；外部能力按各模块配置状态执行。" }), "p"),
						Btn("F8 回退演练", rollback),
						Btn("F11 自检", onRefresh)),
					plan ? h("pre", { style: { maxHeight: "180px", overflow: "auto", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", marginTop: "8px" } }, JSON.stringify(plan, null, 2)) : null,
					h("pre", { style: { maxHeight: "240px", overflow: "auto", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", marginTop: "8px" } }, (tools && tools.content) || "加载中…")),
				Card("备份（最近 30 次）", backups.length ? Table(["备份", "原因", "文件数", "时间"], backups.map((item) => [item.id, item.reason, item.file_count, item.created_at])) : h("div", { style: css.muted }, "尚无备份。")));
		}

		function WorkbenchPanel() {
			const [view, setView] = useState("strategy");
			const [strategy, setStrategy] = useState({ objective: {}, key_results: [], domains: [], blockers: [], active_instances: 0, completed_instances: 0 });
			const [definitions, setDefinitions] = useState([]);
			const [designs, setDesigns] = useState([]);
			const [instances, setInstances] = useState([]);
			const [deliveries, setDeliveries] = useState([]);
			const [audit, setAudit] = useState({ stats: {}, tail: [] });
			const [metrics, setMetrics] = useState([]);
			const [backups, setBackups] = useState([]);
			const [operators, setOperators] = useState([]);
			const [tools, setTools] = useState(null);
			const [domain, setDomain] = useState(null);
			const [workflowId, setWorkflowId] = useState(null);
			const [instance, setInstance] = useState(null);
			const [error, setError] = useState("");

			const refresh = useCallback(async () => {
				try {
					const [nextStrategy, nextDefinitions, nextDesignIndex, nextInstances, nextDeliveries, nextAudit, nextMetrics, nextBackups, nextOperators, nextTools] = await Promise.all([
						api("strategy/overview"),
						api("workflow-definitions"),
						api("domain-work-design"),
						api("workflow-instances"),
						api("deliverables"),
						api("audit"),
						api("metrics", null, "limit=200"),
						api("backups"),
						api("operators"),
						api("tools-versions"),
					]);
					const nextDesigns = await Promise.all(DOMAIN_ORDER.map(([id]) => api("domain-work-design", null, "domain=" + encodeURIComponent(id))));
					setStrategy(nextStrategy);
					setDefinitions(nextDefinitions);
					setDesigns(nextDesigns);
					setInstances(nextInstances);
					setDeliveries(nextDeliveries);
					setAudit(nextAudit || { stats: {}, tail: [] });
					setMetrics(nextMetrics || []);
					setBackups(nextBackups || []);
					setOperators(nextOperators && Array.isArray(nextOperators.operators) ? nextOperators.operators : []);
					setTools(nextTools);
					setError("");
				} catch (caught) {
					setError(String(caught.message || caught));
				}
			}, []);
			useEffect(() => { refresh(); }, [refresh]);

			const definition = definitions.find((item) => item.workflow_id === workflowId) || null;
			const strategyReady = Array.isArray(strategy.domains) && strategy.domains.length > 0;
			const openDomain = (id) => {
				setDomain(id);
				setWorkflowId(null);
				setInstance(null);
				setView("domains");
			};
			const openWorkflow = (id) => {
				setWorkflowId(id);
				const found = definitions.find((item) => item.workflow_id === id);
				setDomain(found ? found.domain : domain);
				setInstance(null);
			};
			const openInstance = (item) => {
				setInstance(item);
				setWorkflowId(item.workflow_id);
				setDomain(item.domain);
			};

			const nav = [
				["strategy", "战略总看板"],
				["domains", "13 域工作台"],
				["approvals", "审批中心"],
				["deliveries", "交付物"],
				["audit", "审计与备份"],
				["system", "运行与回退"],
			];
			const domainMeta = domain ? DOMAIN_ORDER.find((item) => item[0] === domain) : null;

			return h("div", { style: css.root },
				h("div", { style: css.shell },
					h("div", { style: css.top },
						h("div", { style: css.title }, "PiDSH Nexus · 全能工作台"),
						h("div", { style: css.nav }, ...nav.map(([key, label]) => Btn(label, () => { setView(key); setWorkflowId(null); setInstance(null); }, view === key ? "p" : null))),
						h("div", { style: css.space }),
						Btn("刷新", refresh)),
					error ? h("div", { style: Object.assign({}, css.card, { borderColor: "#fecdca", color: "#b42318" }) }, error) : null,
					view === "strategy" ? (
						strategyReady
							? h(StrategyView, {
								strategy,
								onDomain: openDomain,
								onRunStrategy: () => openWorkflow("strat.quarterly-review@1.0.0"),
							})
							: Card("正在加载战略总看板", h("div", { style: css.muted }, "正在读取目标、关键结果与 13 域数据…"))
					) : null,
					view === "domains" && !domain ? h(DomainsView, { strategy, definitions, instances, designs, onOpen: openDomain }) : null,
					view === "domains" && domain && !workflowId ? h(DomainDetail, {
						id: domain,
						label: domainMeta ? domainMeta[1] : domain,
						color: domainMeta ? domainMeta[2] : "#1458d4",
						strategy,
						definitions,
						instances,
						designs,
						metrics,
						onBack: () => setDomain(null),
						onRun: openWorkflow,
						refresh,
					}) : null,
					workflowId && definition ? h(WorkflowWizard, {
						definition,
						instance,
						setInstance,
						refresh,
						operators,
						onBack: () => { setWorkflowId(null); setInstance(null); },
					}) : null,
					view === "approvals" ? h(ApprovalsView, {
						instances,
						operators,
						onOpen: openInstance,
						onCreateOperator: (payload) => api("operators/upsert", payload),
						refresh,
					}) : null,
					view === "deliveries" ? h(DeliveriesView, { instances, deliveries }) : null,
					view === "audit" ? h(AuditView, { audit, instances, backups, metrics }) : null,
					view === "system" ? h(SystemView, { tools, backups, onRefresh: refresh }) : null));
		}

		function WorkbenchIcon() {
			return h("span", { style: { fontSize: "16px", lineHeight: "1" } }, "⟡");
		}

		function BrandMark({ size = 24 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 64 64", role: "img", "aria-label": "PiDSH Nexus" },
				h("rect", { x: 4, y: 4, width: 56, height: 56, rx: 14, fill: "#10243e" }),
				h("path", { d: "M20 19h24v7H20zM23 26v20h7V26zM34 26v20h7V26z", fill: "#ffffff" }),
				h("path", { d: "M14 47c8-8 12 7 20-1s11 3 16-4", fill: "none", stroke: "#28c7fa", strokeWidth: 4, strokeLinecap: "round" }),
				h("circle", { cx: 15, cy: 19, r: 4, fill: "#f5b83d" }),
				h("circle", { cx: 49, cy: 15, r: 4, fill: "#7c5cff" }),
				h("circle", { cx: 49, cy: 45, r: 4, fill: "#28c7fa" }));
		}

		function BrandName() {
			return h("div", { style: { lineHeight: 1.05, minWidth: 0 } },
				h("div", { style: { color: "#10243e", fontWeight: 750, fontSize: "14px" } }, "PiDSH Nexus"),
				h("div", { style: { color: "#64748b", fontWeight: 500, fontSize: "10px", marginTop: "2px" } }, "全能工作台"));
		}

		function apply(ctx) {
			const slots = ctx && ctx.slots;
			if (!slots || typeof slots.inject !== "function") return () => {};
			const disposers = [];
			disposers.push(slots.inject("sidebar.brand.mark", () => slots.inject("sidebar.brand.name", function* () {
				yield slots.register({ name: "sidebar.brand.mark" }, BrandMark);
				yield slots.register({ name: "sidebar.brand.name" }, BrandName);
			})));
			disposers.push(slots.inject("sidebar.panellist", () => slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 900,
				label: () => "⟡ 工作台",
			}, WorkbenchIcon)));
			disposers.push(slots.inject("main", () => slots.register({
				name: "main",
				key: PANEL_ID,
				inject: () => ({}),
			}, WorkbenchPanel)));
			return () => {
				for (const dispose of disposers.splice(0)) {
					try { dispose(); } catch {}
				}
			};
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	},
});
