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
		// 宿主会话通道（apply 时探测；不可用时定制流程自动退化为“复制指令”）
		let hostStartSession = null;
		// 侧边栏动态入口同步（apply 时注入；已安装工作台 → 一级固定入口）
		let hostSyncWorkbenchEntries = null;
		// 工作台模式：当前激活工作台（apply 时注入；新建会话自动归属）
		let hostSetActiveWorkbench = null;
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
			"custom/installed",
			"custom/catalog",
			"custom/state",
			"custom/check-updates",
			"custom/plugin-cli",
			"custom/notes",
			"datasources",
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

		function DomainsView({ strategy, definitions, instances, designs, domains, onOpen }) {
			const customCount = domains.filter((item) => item[3]).length;
			return h("div", null,
				Card(customCount ? `域工作台（13 内置 + ${customCount} 自定义）` : "13 域工作台", h("div", { style: css.muted }, "每个域包含经营路径、6 条流程、数据台账、审批、交付物和复盘；自定义域来自「自定义工作台」的合入产物。")),
				h("div", { style: css.grid3 }, ...domains.map(([id, label, color, custom]) => {
					const metric = strategy.domains.find((item) => item.domain === id);
					const domainInstances = instances.filter((item) => item.domain === id);
					const design = designs.find((item) => item.domain === id);
					return h("button", {
						key: id,
						type: "button",
						onClick: () => onOpen(id),
						style: Object.assign({}, css.card, { margin: 0, textAlign: "left", cursor: "pointer", borderTop: "3px solid " + color }),
					},
						h("div", { style: css.row }, h("b", null, label), custom ? Tag("自定义", "warn") : null, h("span", { style: css.space }), Tag(domainInstances.filter((item) => item.status === "awaiting_approval").length + " 待审批")),
						h("div", { style: css.muted }, metric ? metric.north_star + "：" + nice(metric.actual) + " " + metric.unit : "指标加载中"),
						h("div", { style: css.small, marginTop: "5px" }, DOMAIN_JOURNEY[id] || "自定义域：模块/事项/流程由该域合入的设计文件驱动。"),
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

		// ———— 4.0.0-dev8 集成层：自定义工作台 / 升级与兼容 / 集成中心 ————
		const STANDALONE_URL = "/workbench/api/app-page";
		function openStandalone(hash) {
			const target = hash ? STANDALONE_URL + hash : STANDALONE_URL;
			const opened = window.open(target, "_blank");
			// Tauri/WebView2 默认丢弃 window.open；Rust 侧 on_new_window 接管时返回窗口句柄，
			// 若仍未打开（被策略拒绝）则退化为同窗口导航，保证任何宿主下都能打开。
			if (!opened) window.location.href = target;
		}
		async function copyText(text) {
			const value = String(text || "");
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(value);
					return true;
				}
			} catch { /* 退化为 execCommand */ }
			try {
				const area = document.createElement("textarea");
				area.value = value;
				area.style.position = "fixed";
				area.style.opacity = "0";
				document.body.appendChild(area);
				area.select();
				const ok = document.execCommand("copy");
				area.remove();
				return ok;
			} catch {
				return false;
			}
		}

		const DRAFT_STATUS_LABEL = {
			draft: "草稿",
			verified: "校验通过",
			"preview-ready": "预览就绪",
			exported: "已导出合入包",
			consolidated: "已固化",
		};
		const ADOPTION_TONE = { adopted: "ok", "in-progress": "p", planned: "warn", "not-adopted": "bad" };

		function CustomView({ drafts, domains, onRefresh, notify }) {
			const [kind, setKind] = useState("revise");
			const [targetDomain, setTargetDomain] = useState("rec");
			const [newDomain, setNewDomain] = useState("");
			const [title, setTitle] = useState("");
			const [requirements, setRequirements] = useState("");
			const [busy, setBusy] = useState("");

			useEffect(() => {
				if (!domains.some((item) => item[0] === targetDomain) && domains[0]) setTargetDomain(domains[0][0]);
			}, [domains, targetDomain]);

			const running = drafts.some((item) => item.verify_running);
			useEffect(() => {
				if (!running) return undefined;
				const timer = setInterval(() => { onRefresh(); }, 6000);
				return () => clearInterval(timer);
			}, [running, onRefresh]);

			const create = async () => {
				setBusy("create");
				try {
					const draft = await api("custom/draft-create", {
						kind,
						targetDomain: kind === "revise" ? targetDomain : "",
						newDomain: kind === "new-domain" ? newDomain : "",
						title,
						requirements,
					});
					setTitle("");
					setRequirements("");
					notify(`已创建草稿 ${draft.id}`);
					await onRefresh();
				} catch (error) {
					notify("创建失败：" + String(error.message || error));
				} finally {
					setBusy("");
				}
			};
			const act = async (op, id, label) => {
				setBusy(op + ":" + id);
				try {
					const result = await api(op, { id });
					if (op === "custom/verify") notify(`校验完成：${result.ok ? "通过" : "未通过"}（缺口 ${(result.gaps || []).length} 项，详见 verify.json）`);
					else if (op === "custom/preview-build") notify(result.ok ? `预览已构建（${result.bytes} bytes）：可在独立驾驶舱查看` : "预览构建失败，请先通过校验");
					else if (op === "custom/consolidate") notify(result.ok ? "合入包已导出：consolidation/（含 verify.json 与变更清单）" : `导出合入包被拦下：${result.error || "未满足前置条件"}`);
					else if (op === "custom/verify-heavy") notify("完整门禁已在后台启动（约数分钟），完成后草稿状态会自动更新");
					else if (op === "custom/install") notify(`已安装「${result.title || result.id}」：左侧边栏将立即出现“⧉ ${result.title || result.id}”入口（本地工作台·未固化）`);
					await onRefresh();
				} catch (error) {
					notify(`${label}失败：` + String(error.message || error));
				} finally {
					setBusy("");
				}
			};
			const copyInstruction = async (draft) => {
				const ok = await copyText(draft.instruction || "");
				notify(ok ? "定制指令已复制：粘贴给任意 DSH 会话即可开始" : "复制失败：请手动从 draft.json 旁获取指令");
			};
			const startSession = async (draft) => {
				const ok = await copyText(draft.instruction || "");
				let opened = false;
				try {
					if (hostStartSession) { hostStartSession(); opened = true; }
				} catch { opened = false; }
				notify(opened
					? (ok ? "已打开新会话；指令已复制，请粘贴并发送" : "已打开新会话；请粘贴定制指令")
					: (ok ? "会话 API 不可用：指令已复制，请手动新建会话并粘贴" : "会话 API 不可用：请手动新建会话"));
			};

			return h("div", null,
				Card("第一步 · 新建草稿",
					h("div", { style: css.muted }, "自定义工作台（与 13 域工作台分开管理）：修订现有 13 域或新增自定义域；草稿可即时校验与预览，正式生效必须过门禁并重打包。"),
					h("div", { style: Object.assign({}, css.grid3, { marginTop: "10px" }) },
						h("div", { style: css.field }, h("label", { style: css.label }, "类型"),
							h("select", { "aria-label": "草稿类型", style: css.input, value: kind, onChange: (event) => setKind(event.target.value) },
								h("option", { value: "revise" }, "修订现有工作域"),
								h("option", { value: "new-domain" }, "新增自定义域"))),
						kind === "revise"
							? h("div", { style: css.field }, h("label", { style: css.label }, "目标域"),
								h("select", { "aria-label": "目标域", style: css.input, value: targetDomain, onChange: (event) => setTargetDomain(event.target.value) },
									...domains.map(([id, label]) => h("option", { key: id, value: id }, label))))
							: h("div", { style: css.field }, h("label", { style: css.label }, "新域 id（小写字母/数字/连字符）"),
								Inp(newDomain, setNewDomain, "例如 cust-learning")),
						h("div", { style: css.field }, h("label", { style: css.label }, "标题"),
							Inp(title, setTitle, "例如：招聘域新增台账表"))),
					h("div", { style: css.field }, h("label", { style: css.label }, "需求原文（写清服务谁、什么场景、核心流程）"),
						Area(requirements, setRequirements, "例如：招聘团队需要在周会上核对渠道转化与面试排期……")),
					h("div", { style: css.row, marginTop: "8px" },
						Btn(busy === "create" ? "创建中…" : "创建草稿", create, "p", { disabled: busy !== "" }),
						Btn("打开定制规范", () => window.open("/workbench/api/custom/development-guide", "_blank")),
						Btn("打开独立驾驶舱 ↗", () => openStandalone("#/custom")))),
				...drafts.map((draft) => {
					const verify = draft.verify || null;
					const status = DRAFT_STATUS_LABEL[draft.status] || draft.status;
					const targetText = draft.kind === "new-domain" ? draft.newDomain : draft.targetDomain;
					return Card(`${draft.title || draft.id}`,
						h("div", { style: css.row },
							Tag(status, draft.status === "draft" ? null : "ok"),
							Tag(draft.kind === "new-domain" ? "新增域" : "修订", "p"),
							Tag(String(targetText || "")),
							draft.verify_running ? Tag("完整门禁运行中…", "warn") : null,
							h("span", { style: css.space }),
							h("span", { style: css.small }, draft.id)),
						h("div", { style: css.muted, marginTop: "4px" }, (draft.requirements || "（未填写需求原文）").slice(0, 200)),
						verify ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) },
							`域级校验：${verify.ok ? "通过" : "未通过"} ｜ 基线：${verify.baseline_status} ｜ 完整门禁：${verify.heavy_status}`,
							verify.gaps && verify.gaps.length ? h("div", { style: { color: "#b54708", marginTop: "4px" } }, `缺口 ${verify.gaps.length} 项：` + verify.gaps.slice(0, 3).join("；")) : null) : null,
						h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) },
							Btn("复制指令", () => copyInstruction(draft)),
							Btn("开始定制会话", () => startSession(draft), "p"),
							Btn(busy === "custom/verify:" + draft.id ? "校验中…" : "运行校验", () => act("custom/verify", draft.id, "校验"), null, { disabled: busy !== "" }),
							Btn("完整门禁（后台）", () => act("custom/verify-heavy", draft.id, "完整门禁"), null, { disabled: busy !== "" || draft.verify_running }),
							Btn("构建预览", () => act("custom/preview-build", draft.id, "构建预览"), null, { disabled: busy !== "" }),
							draft.preview_available ? Btn("打开预览 ↗", () => openStandalone("?draft=" + encodeURIComponent(draft.id))) : null,
							Btn(draft.kind === "new-domain" || (draft.verify && draft.verify.ok) ? "安装（装上即用）" : "安装（需先校验）", () => act("custom/install", draft.id, "安装"), "p", { disabled: busy !== "" || !(draft.verify && draft.verify.ok) }),
							Btn("导出合入包", () => act("custom/consolidate", draft.id, "导出合入包"), null, { disabled: busy !== "" })),
						draft.consolidation_available ? h("div", { style: css.small, marginTop: "4px" }, "合入包：consolidation/（apply-draft 默认 dry-run，见包内 README）") : null);
				}),
				drafts.length ? null : Card("尚无草稿", h("div", { style: css.muted }, "按上面的三步流程创建第一个草稿；定制指令包含需求确认闸门与资产契约。")),
				Card("已生效的自定义域",
					domains.filter((item) => item[3]).length
						? Table(["域", "名称", "来源"], domains.filter((item) => item[3]).map(([id, label]) => [id, label, "自定义（build 内置）"]))
						: h("div", { style: css.muted }, "当前 build 尚无自定义域；新增域经合入与重打包后在此列出。")));
		}

		function UpgradeView({ status, plan, onRollback, onRefresh }) {
			const data = status || {};
			const engine = data.engine || {};
			const compatibility = data.compatibility || {};
			const corridor = (data.corridor && data.corridor.references) || [];
			return h("div", null,
				Card("引擎与锁定",
					h("div", { style: css.grid4 },
						Stat("DSH 引擎", engine.dsh || "—", "manifests/runtime-web.package.json"),
						Stat("runtime 依赖", engine.dependency_count == null ? "—" : engine.dependency_count, "P0/P1 产品集"),
						Stat("精确豁免", compatibility.exempt_packages == null ? "—" : compatibility.exempt_packages, "templates/runtime/compatibility.json"),
						Stat("引擎工件", (engine.tarballs || []).length, (engine.tarballs || []).map((item) => item.file).join("、") || "未登记")),
					(engine.hashes || []).length ? h("pre", { style: { maxHeight: "120px", overflow: "auto", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", marginTop: "8px" } }, (engine.hashes || []).join("\n")) : null),
				Card("升级审计证据（0.2.0-rc.2）",
					(data.evidence && data.evidence.adrs || []).length ? h("div", { style: css.small }, "ADR：" + (data.evidence.adrs || []).join("、")) : null,
					Table(["证据文件", "字节"], ((data.evidence && data.evidence.files) || []).slice(0, 12).map((item) => [item.file, item.bytes]))),
				Card("走廊覆盖（vendor 技能 vs 当前版本）",
					Table(["边", "from", "to", "状态", "卡片数", "校验日"], corridor.map((item) => [item.file, item.from, item.to, item.status, item.cardCount, item.verifiedAt || "—"])),
					h("div", { style: css.small, marginTop: "6px" }, "只读中心：升级执行必须按宿主升级纪律在外部终端按精确版本进行；本页不提供在线升级。")),
				Card("动作（复用既有能力）",
					h("div", { style: css.row },
						Btn("回退演练（dry-run）", onRollback, "p"),
						Btn("刷新状态", onRefresh)),
					plan ? h("pre", { style: { maxHeight: "160px", overflow: "auto", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", marginTop: "8px" } }, JSON.stringify(plan, null, 2)) : null,
					h("pre", { style: { maxHeight: "160px", overflow: "auto", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px", padding: "8px", marginTop: "8px" } }, (data.tools_versions || "加载中…").slice(0, 1200))));
		}

		function IntegrationView({ status }) {
			const projects = (status && status.projects) || [];
			return h("div", null,
				Card("集成中心（三个参考项目的采纳痕迹）",
					h("div", { style: css.muted }, "登记已采纳 / 进行中 / 待办 / 明确不采纳（附原因）与证据路径；来源与许可同步写入 THIRD-PARTY-NOTICES。"),
					status && status.live ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) },
						`vendor=${status.live.upgrade_skill_vendored ? "在位" : "缺失"} ｜ 规范=${status.live.custom_workbench_standard ? "在位" : "缺失"}`) : null),
				...projects.map((project) => Card(`${project.name} · ${project.kind || ""}`,
					h("div", { style: css.row },
						Tag(project.license || "—", "p"),
						h("a", { href: project.url, target: "_blank", rel: "noreferrer", style: { color: "#175cd3", fontSize: "12px" } }, project.url)),
					Table(["采纳项", "状态", "证据"], (project.adoptions || []).map((item) => [
						item.item + (item.reason ? `（不采纳原因：${item.reason}）` : ""),
						h("span", null, Tag(item.status, ADOPTION_TONE[item.status] || null)),
						(item.evidence || []).join("、") || "—",
					])),
					h("div", { style: css.small, marginTop: "4px" }, project.attribution || ""))));
		}

		// ———— 工作台市场（dev9：已安装管理 / 本地目录 / 数据源 / 关于）————
		function MarketView({ catalog, installed, datasources, integration, drafts, notify, onRefresh, onOpenDomain }) {
			const [packageDir, setPackageDir] = useState("");
			const [busy, setBusy] = useState("");
			const [importDomain, setImportDomain] = useState("");
			const [importTable, setImportTable] = useState("");
			const [importCsv, setImportCsv] = useState("");
			const [importMode, setImportMode] = useState("strict");
			const [importResult, setImportResult] = useState(null);
			const [showAbout, setShowAbout] = useState(false);

			const run = async (op, body, label, path) => {
				setBusy(op);
				try {
					const result = await api(path || ("custom/" + op), body);
					notify(`${label}：${result && result.ok === false ? (result.message || "未通过") : "完成"}`);
					setImportResult(op.startsWith("data") ? result : importResult);
					await onRefresh();
					return result;
				} catch (error) {
					notify(`${label}失败：` + String(error.message || error));
					return null;
				} finally {
					setBusy("");
				}
			};

			const samples = (catalog && catalog.samples) || [];
			const sources = (datasources && datasources.sources) || [];
			return h("div", null,
				Card("工作台市场",
					h("div", { style: css.muted }, "本地目录为主（离线可用）：已安装工作台管理、随包样例、从本地包安装；远程目录源为预留接口（默认关闭）。安装后工作台会立即出现在左侧边栏。"),
					h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) },
						Btn("刷新", onRefresh),
						Btn("打开定制规范", () => window.open("/workbench/api/custom/development-guide", "_blank")),
						Btn("打开独立驾驶舱 ↗", () => openStandalone("#/market")))),
				Card("已安装的工作台",
					installed.length
						? Table(["工作台", "类型", "状态", "来源", "目录"], installed.map((item) => [
							item.title || item.label || item.id,
							item.kind === "revision" ? "修订内置域" : "新增自定义域",
							item.status === "installed" ? "已启用" : "已停用",
							item.origin || "—",
							item.dir || "—",
						]).map((row, index) => [row[0], row[1], row[2], row[3], h("span", { style: css.small }, String(row[4]).slice(-48))]))
						: h("div", { style: css.muted }, "尚未安装任何工作台。可从下方样例或本地包安装，也可在「自定义工作台」里把草稿一键安装。"),
					installed.length ? h("div", { style: { marginTop: "8px" } }, ...installed.map((item) => h("div", { key: item.id, style: Object.assign({}, css.row, { padding: "6px 0", borderBottom: "1px solid #f2f4f7" }) },
						h("b", null, item.title || item.label || item.id),
						h("span", { style: css.space }),
						Btn("打开", () => onOpenDomain(item.id)),
						item.status === "installed"
							? Btn("停用", () => run("disable", { id: item.id }, "停用"))
							: Btn("启用", () => run("enable", { id: item.id }, "启用")),
						Btn("卸载", () => run("uninstall", { id: item.id }, "卸载"), "d")))) : null),
				Card("本地目录（随包样例 + 本地包）",
					samples.length
						? h("div", null, ...samples.map((sample) => h("div", { key: sample.id, style: Object.assign({}, css.row, { padding: "6px 0", borderBottom: "1px solid #f2f4f7" }) },
							h("b", null, sample.title || sample.label || sample.id),
							h("span", { style: css.space }),
							h("span", { style: css.small }, sample.description || ""),
							Btn(busy === "sample" ? "安装中…" : "安装样例", async () => run("install", { sampleId: sample.id }, `安装 ${sample.id}`)))))
						: h("div", { style: css.muted }, "随包样例目录为空（manifests/workbench-catalog.json）。"),
					h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) },
						Inp(packageDir, setPackageDir, "本地工作台包目录（含 workbench.json + assets/）"),
						Btn(busy === "import-package" ? "导入中…" : "从目录安装", () => run("import-package", { dir: packageDir }, "导入工作台包"))),
					h("div", { style: css.small, marginTop: "4px" }, "包结构：workbench.json（id/label/color/title/assets）+ assets/（场景·工作流条目·台账·技能·§9 规则）。")),
				Card("导入真实数据（CSV 文本 / 文件路径）",
					h("div", { style: css.grid3 },
						h("div", { style: css.field }, h("label", { style: css.label }, "域（内置或本地工作台）"), Inp(importDomain, setImportDomain, "例如 cust-learning")),
						h("div", { style: css.field }, h("label", { style: css.label }, "台账表"), Inp(importTable, setImportTable, "例如 enrollments 或 enrollments.csv")),
						h("div", { style: css.field }, h("label", { style: css.label }, "校验模式"),
							h("select", { style: css.input, value: importMode, onChange: (event) => setImportMode(event.target.value) },
								h("option", { value: "strict" }, "严格（表头逐字一致）"),
								h("option", { value: "mapping" }, "列映射（需 mapping，经工具/接口使用）")))),
					h("div", { style: css.field }, h("label", { style: css.label }, "CSV 内容（含表头）"), Area(importCsv, setImportCsv, "learner_masked,course,status,hours,updated_at\n学**,课程A,enrolled,-,2026-10-11")),
					h("div", { style: css.row },
						Btn(busy === "data-import" ? "校验中…" : "先预览校验", () => run("data-import", { domain: importDomain, table: importTable, csv: importCsv, mode: importMode, preview: true }, "预览", "data/import")),
						Btn(busy === "data-import-write" ? "写入中…" : "确认导入", () => run("data-import-write", { domain: importDomain, table: importTable, csv: importCsv, mode: importMode }, "导入", "data/import"), "p")),
					importResult ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) },
						importResult.ok ? `校验通过：${importResult.preview ? "预览" : "已写入 " + importResult.rows + " 行"}（数据版本 ${importResult.data_version || "-"}）` : `未通过：${(importResult.validation && (importResult.validation.missing || []).length) ? "缺失列 " + importResult.validation.missing.join("、") : (importResult.message || "")}`,
						importResult.validation && (importResult.validation.extra || []).length ? h("div", { style: { color: "#b54708" } }, "多余列：" + importResult.validation.extra.join("、")) : null,
						importResult.sample_rows && importResult.sample_rows.length ? h("div", { style: css.small }, "预览行：" + JSON.stringify(importResult.sample_rows[0])) : null) : null),
				Card("数据源（只读外部源骨架）",
					sources.length
						? Table(["ID", "类型", "目标", "域/表", "状态"], sources.map((source) => [source.id, source.type, String(source.target || "—"), `${source.domain || "—"}/${source.table || "—"}`, source.supported ? (source.enabled ? "可刷新" : "已登记·未启用") : "not-implemented"]))
						: h("div", { style: css.muted }, "尚未登记外部数据源。配置：workspace/config/datasources.json（凭据只引用环境变量名）。"),
					sources.length ? h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) }, ...sources.map((source) => h("span", { key: source.id, style: css.row },
						Btn(`探测 ${source.id}`, async () => { const r = await run("probe", { id: source.id }, "探测", "datasources/probe"); notify(`探测结果：${r && r.status || "-"}`); }),
						Btn(`刷新 ${source.id}`, async () => { await run("refresh", { id: source.id }, "刷新", "datasources/refresh"); })))) : null),
				Card("关于 / 来源追溯",
					h("div", { style: css.row }, Btn(showAbout ? "收起" : "展开", () => setShowAbout(!showAbout))),
					showAbout ? h("div", null, ...(((integration && integration.projects) || []).map((project) => h("div", { key: project.id, style: { padding: "6px 0" } },
						h("a", { href: project.url, target: "_blank", rel: "noreferrer", style: { color: "#175cd3" } }, project.name),
						h("span", { style: css.muted }, ` · ${project.license || "—"} · 采纳 ${((project.adoptions || []).filter((item) => item.status === "adopted").length)} 项`))))) : null));
		}

		// ———— 本地工作台面板（每个已安装工作台一个侧边栏入口）————
		// ———— dev10：市场 v2（三页签 / 卡片轮播 / 收藏 / 更新 / 主开关 / 确认弹窗）————
		function MarketScreenshot({ entry }) {
			const shots = entry.screenshots || [];
			const [index, setIndex] = useState(0);
			const [zoom, setZoom] = useState(false);
			if (!shots.length) {
				return h("div", { style: { height: "132px", display: "grid", placeItems: "center", background: "#f8fafc", border: "1px solid #e4e7ec", borderRadius: "8px" } },
					h("span", { style: { fontSize: "26px", color: "#98a2b3" } }, "▦"));
			}
			const shot = shots[Math.min(index, shots.length - 1)];
			const url = shot.url || ("/workbench/api/custom/catalog/asset?id=" + encodeURIComponent(entry.id) + "&file=" + encodeURIComponent(shot.file || ""));
			return h("div", null,
				h("div", { style: { position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid #e4e7ec", background: "#0b1220" } },
					h("img", { src: url, alt: shot.alt || entry.name, style: { display: "block", width: "100%", height: "132px", objectFit: "cover", cursor: "zoom-in" }, onClick: () => setZoom(true), loading: "lazy" }),
					shots.length > 1 ? h("div", { style: { position: "absolute", right: "6px", bottom: "6px", display: "flex", gap: "4px", alignItems: "center" } },
						Btn("‹", () => setIndex((index - 1 + shots.length) % shots.length), null, { padding: "0 7px" }),
						h("span", { style: { color: "#fff", fontSize: "11px", background: "rgba(15,23,42,.6)", borderRadius: "999px", padding: "1px 7px" } }, `${index + 1}/${shots.length}`),
						Btn("›", () => setIndex((index + 1) % shots.length), null, { padding: "0 7px" })) : null),
				zoom ? h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.82)", zIndex: 60, display: "grid", placeItems: "center" }, onClick: () => setZoom(false) },
					h("img", { src: url, alt: shot.alt || entry.name, style: { maxWidth: "86vw", maxHeight: "86vh", borderRadius: "10px", boxShadow: "0 20px 60px rgba(0,0,0,.45)" } })) : null);
		}

		function WorkbenchCard({ entry, installedEntry, updateRecord, favorite, busy, onInstall, onUninstall, onFavorite, onOpen }) {
			const author = entry.id.startsWith("pids:") ? "本地/企业" : entry.id.split("/")[0];
			const status = installedEntry
				? (updateRecord && updateRecord.status === "update-available" ? `可更新 → ${updateRecord.latest}` : "已安装")
				: null;
			return h("section", { style: Object.assign({}, css.card, { margin: 0, display: "flex", flexDirection: "column", gap: "8px" }) },
				MarketScreenshot({ entry }),
				h("div", { style: css.row },
					h("b", null, entry.name),
					h("span", { style: css.space }),
					h("button", {
						type: "button",
						title: favorite ? "取消收藏" : "收藏工作台",
						onClick: () => onFavorite(entry),
						style: Object.assign({}, css.btn, { padding: "2px 8px" }, favorite ? css.primary : null),
					}, favorite ? "★" : "☆")),
				h("div", { style: css.small }, `@${author} ｜ ${entry.category} ｜ v${entry.version} ｜ ${entry.license}`),
				h("div", { style: Object.assign({}, css.muted, { minHeight: "34px" }) }, (entry.description && entry.description.zh) || ""),
				h("div", { style: css.row, marginTop: "auto" },
					status ? Tag(status, updateRecord && updateRecord.status === "update-available" ? "warn" : "ok") : null,
					h("span", { style: css.space }),
					installedEntry
						? Btn("打开", () => onOpen(installedEntry.id), "p")
						: Btn(busy ? "安装中…" : "安装", () => onInstall(entry), "p", { disabled: busy }),
					installedEntry ? Btn("卸载", () => onUninstall(entry, installedEntry), "d") : null));
		}

		function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, danger }) {
			return h("div", { style: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 70, display: "grid", placeItems: "center" }, onClick: onCancel },
				h("div", { style: Object.assign({}, css.card, { maxWidth: "520px", background: "#fff" }), onClick: (event) => event.stopPropagation() },
					h("h2", { style: css.h2 }, title),
					h("div", { style: css.muted }, body),
					h("div", { style: Object.assign({}, css.row, { marginTop: "12px" }) },
						h("span", { style: css.space }),
						Btn("取消", onCancel),
						Btn(confirmLabel, onConfirm, danger ? "d" : "p"))));
		}

		function MarketViewV2({ catalogResult, workbenchState, updates, installed, drafts, integration, notify, onRefresh, onOpenDomain, onWizard }) {
			const [tab, setTab] = useState("market");
			const [queryText, setQueryText] = useState("");
			const [category, setCategory] = useState("all");
			const [sort, setSort] = useState("market");
			const [busy, setBusy] = useState("");
			const [confirm, setConfirm] = useState(null);
			const [packageDir, setPackageDir] = useState("");
			const [inlineNote, setInlineNote] = useState("");
			const [importDomain, setImportDomain] = useState("");
			const [importTable, setImportTable] = useState("");
			const [importCsv, setImportCsv] = useState("");
			const [importResult, setImportResult] = useState(null);
			const [showAbout, setShowAbout] = useState(false);

			const catalog = (catalogResult && catalogResult.catalog) || { categories: [], workbenches: [] };
			const state = workbenchState || { added: [], favorites: [], pinned: [], enabled: true };
			const entries = catalog.workbenches || [];
			const installedByCatalog = new Map();
			for (const item of installed) installedByCatalog.set(item.catalog_id || `pids:${item.id}`, item);
			const updateById = new Map(((updates && updates.records) || []).map((record) => [record.identity, record]));
			const favorites = new Set(state.favorites || []);

			const filtered = entries
				.filter((entry) => (tab === "favorites" ? favorites.has(entry.id) : true))
				.filter((entry) => (category === "all" ? true : entry.category === category))
				.filter((entry) => {
					if (!queryText.trim()) return true;
					const haystack = [entry.name, entry.id, entry.category, entry.description && entry.description.zh].join(" ").toLowerCase();
					return haystack.includes(queryText.trim().toLowerCase());
				});
			const sorted = [...filtered].sort((a, b) => {
				if (sort === "stars") return ((b.metrics && b.metrics.stars) || 0) - ((a.metrics && a.metrics.stars) || 0);
				if (sort === "downloads") return ((b.metrics && b.metrics.downloads) || 0) - ((a.metrics && a.metrics.downloads) || 0);
				return 0;
			});
			const installedRows = installed.map((item) => ({ item, entry: entries.find((entry) => entry.id === (item.catalog_id || `pids:${item.id}`)) || null }));

			const call = async (path, body, label, qs) => {
				setBusy(label);
				try {
					const result = await api(path, body, qs);
					if (result && result.error) throw new Error(result.error);
					setInlineNote(`${label}：完成`);
					await onRefresh();
					return result;
				} catch (error) {
					setInlineNote(`${label}失败：` + String(error.message || error));
					return null;
				} finally { setBusy(""); }
			};
			const doInstall = async (entry) => {
				const result = await call("custom/market-install", { id: entry.id }, `安装 ${entry.name}`);
				if (result && result.needs_restart) notify("插件式工作台已装入 profile：重启 Harness 后生效");
			};
			const doUninstall = (entry, installedEntry) => {
				const isPlugin = /^(npm|github)/.test(installedEntry.catalog_id || "") || installedEntry.pluginName;
				setConfirm({
					title: `卸载「${entry.name}」？`,
					body: isPlugin
						? "这将从当前 Profile 卸载插件式工作台并移除左侧固定入口，重启 Harness 后生效；已有会话、项目文件和工作台笔记都会保留。"
						: "这将移除运行时工作台的侧边栏入口与生成物，立即生效；已有会话、文件、笔记与收藏都会保留，之后重新安装仍可继续使用。",
					confirmLabel: "确认卸载",
					onConfirm: async () => { setConfirm(null); await call("custom/market-uninstall", { id: entry.id }, `卸载 ${entry.name}`); },
				});
			};
			const toggleFavorite = async (entry) => {
				const next = new Set(favorites);
				if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id);
				try {
					const current = await api("custom/state");
					await api("custom/state", { revision: current.revision, state: { ...current.state, favorites: [...next] } });
					await onRefresh();
				} catch (error) { setInlineNote("收藏失败：" + String(error.message || error)); }
			};
			const toggleEnabled = async (enabled) => {
				try {
					const current = await api("custom/state");
					await api("custom/state", { revision: current.revision, state: { ...current.state, enabled } });
					notify(enabled ? "已启用工作台功能" : "已关闭工作台功能：工作台不加载，会话与数据不受影响");
					await onRefresh();
				} catch (error) { setInlineNote("主开关保存失败：" + String(error.message || error)); }
			};

			const sourceNote = catalogResult && (catalogResult.stale
				? "目录为缓存副本（刷新失败时的回退），仍可安装已缓存条目。"
				: (catalogResult.errors && catalogResult.errors.length ? `部分目录源不可用：${catalogResult.errors.join("；")}` : null));
			return h("div", null,
				Card("工作台市场",
					h("div", { style: css.muted }, "离线优先：本地目录 + 可选 HTTPS 远程源；安装即用（运行时包）或重启生效（插件包）。"),
					h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) },
						Btn("工作台市场", () => setTab("market"), tab === "market" ? "p" : null),
						Btn("我的收藏", () => setTab("favorites"), tab === "favorites" ? "p" : null),
						Btn("已安装", () => setTab("installed"), tab === "installed" ? "p" : null),
						h("span", { style: css.space }),
						Btn("制作我的工作台", () => onWizard(), "p"),
						Btn(busy === "刷新目录" ? "刷新中…" : "刷新目录", () => call("custom/catalog", null, "刷新目录", "force=1"), null, { disabled: busy !== "" }),
						Btn("检查更新", async () => {
							const result = await call("custom/check-updates", null, "检查更新", "force=1");
							if (result) {
								const available = (result.records || []).filter((record) => record.status === "update-available");
								const blocked = (result.records || []).filter((record) => record.status === "downgrade-blocked");
								notify(`检查更新：${available.length} 个可更新${blocked.length ? `，${blocked.length} 个已阻止降级` : ""}`);
							}
						}),
						h("label", { style: Object.assign({}, css.row, { gap: "6px" }) },
							h("input", { type: "checkbox", checked: state.enabled !== false, onChange: (event) => toggleEnabled(event.target.checked) }),
							"启用工作台功能")),
					sourceNote ? h("div", { style: Object.assign({}, css.small, { color: "#b54708", marginTop: "6px" }) }, sourceNote) : null,
					inlineNote ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) }, inlineNote) : null),
				tab !== "installed" ? Card("目录", 
					h("div", { style: Object.assign({}, css.row, { marginBottom: "8px" }) },
						h("input", { placeholder: "搜索名称、作者或分类", value: queryText, onChange: (event) => setQueryText(event.target.value), style: Object.assign({}, css.input, { width: "260px" }) }),
						h("select", { style: css.input, value: category, onChange: (event) => setCategory(event.target.value) },
							h("option", { value: "all" }, "全部分类"),
							...((catalog.categories || []).map((item) => h("option", { key: item.id, value: item.id }, item.name)))),
						h("select", { style: css.input, value: sort, onChange: (event) => setSort(event.target.value) },
							h("option", { value: "market" }, "市场顺序"),
							h("option", { value: "stars" }, "Star 数量"),
							h("option", { value: "downloads" }, "下载量"))),
					sorted.length
						? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" } },
							...sorted.map((entry) => h(WorkbenchCard, {
								key: entry.id,
								entry,
								installedEntry: installedByCatalog.get(entry.id) || null,
								updateRecord: updateById.get(entry.id) || null,
								favorite: favorites.has(entry.id),
								busy: busy === `安装 ${entry.name}`,
								onInstall: doInstall,
								onUninstall: doUninstall,
								onFavorite: toggleFavorite,
								onOpen: onOpenDomain,
							})))
						: h("div", { style: css.muted }, tab === "favorites" ? "还没有收藏工作台：把鼠标移到市场卡片上，点击 ★ 即可收藏。" : "没有找到匹配的工作台。")) : null,
				tab === "installed" ? Card("已安装工作台",
					installedRows.length
						? h("div", null, ...installedRows.map(({ item, entry }) => {
							const record = updateById.get(item.catalog_id || `pids:${item.id}`);
							return h("div", { key: item.id, style: Object.assign({}, css.row, { padding: "8px 0", borderBottom: "1px solid #f2f4f7" }) },
								h("b", null, item.title || item.name || item.id),
								Tag(`v${item.version || "—"}`, "p"),
								item.kind === "revision" ? Tag("修订内置域", "warn") : Tag("自定义域"),
								record && record.status === "update-available" ? Tag(`可更新 → ${record.latest}`, "warn") : null,
								record && record.status === "downgrade-blocked" ? Tag("已阻止降级", "bad") : null,
								h("span", { style: css.space }),
								item.pluginName ? Tag("插件包 · 重启生效") : Tag("运行时包 · 即装即用"),
								Btn("打开", () => onOpenDomain(item.id), "p"),
								entry ? Btn("卸载", () => doUninstall(entry, item), "d") : Btn("卸载", async () => {
									setConfirm({ title: `卸载「${item.title || item.id}」？`, body: "将移除入口与生成物，数据与笔记保留。", confirmLabel: "确认卸载", onConfirm: async () => { setConfirm(null); await call("custom/market-uninstall", { id: item.catalog_id || `pids:${item.id}` }, "卸载"); } });
								}, "d"));
						}))
						: h("div", { style: css.muted }, "尚未安装工作台：可从目录安装样例，或在“制作我的工作台”里把草稿一键安装。")) : null,
				Card("本地包导入（离线）",
					h("div", { style: css.row },
						Inp(packageDir, setPackageDir, "本地工作台包目录（含 workbench.json + assets/）"),
						Btn(busy === "导入工作台包" ? "导入中…" : "从目录安装", () => call("custom/import-package", { dir: packageDir }, "导入工作台包"))),
					h("div", { style: css.small, marginTop: "4px" }, "插件式工作台：把 .tgz 放到本机后在“制作我的工作台 → 第三步”或工具里安装（需重启生效）。")),
				Card("导入真实数据（CSV 文本 · 严格校验）",
					h("div", { style: css.grid3 },
						h("div", { style: css.field }, h("label", { style: css.label }, "域（内置或本地工作台）"), Inp(importDomain, setImportDomain, "例如 cust-learning")),
						h("div", { style: css.field }, h("label", { style: css.label }, "台账表"), Inp(importTable, setImportTable, "例如 enrollments 或 enrollments.csv"))),
					h("div", { style: css.field }, h("label", { style: css.label }, "CSV 内容（含表头）"), Area(importCsv, setImportCsv, "learner_masked,course,status,hours,updated_at\n学**,课程A,enrolled,-,2026-10-11")),
					h("div", { style: css.row },
						Btn(busy === "预览" ? "校验中…" : "先预览校验", async () => {
							const result = await call("data/import", { domain: importDomain, table: importTable, csv: importCsv, mode: "strict", preview: true }, "预览");
							setImportResult(result);
						}),
						Btn(busy === "导入" ? "写入中…" : "确认导入", async () => {
							const result = await call("data/import", { domain: importDomain, table: importTable, csv: importCsv, mode: "strict" }, "导入");
							setImportResult(result);
						}, "p")),
					importResult ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) },
						importResult.ok ? `校验通过：${importResult.preview ? "预览" : "已写入 " + importResult.rows + " 行"}（数据版本 ${importResult.data_version || "-"}）`
							: `未通过：${((importResult.validation && importResult.validation.missing) || []).length ? "缺失列 " + importResult.validation.missing.join("、") : (importResult.message || importResult.error || "")}`) : null),
				confirm ? ConfirmModal({
					title: confirm.title,
					body: confirm.body,
					confirmLabel: confirm.confirmLabel,
					danger: true,
					onCancel: () => setConfirm(null),
					onConfirm: confirm.onConfirm,
				}) : null,
				Card("关于 / 来源追溯",
					h("div", { style: css.row }, Btn(showAbout ? "收起" : "展开", () => setShowAbout(!showAbout))),
					showAbout ? h("div", null, ...(((integration && integration.projects) || []).map((project) => h("div", { key: project.id, style: { padding: "6px 0" } },
						h("a", { href: project.url, target: "_blank", rel: "noreferrer", style: { color: "#175cd3" } }, project.name),
						h("span", { style: css.muted }, ` · ${project.license || "—"} · 采纳 ${((project.adoptions || []).filter((item) => item.status === "adopted").length)} 项`))))) : null));
		}

		// ———— dev10：三步向导（制作我的工作台）————
		function WizardView({ drafts, installed, notify, onRefresh, onOpenDomain }) {
			const [kind, setKind] = useState("new-domain");
			const [targetDomain, setTargetDomain] = useState("rec");
			const [newDomain, setNewDomain] = useState("");
			const [title, setTitle] = useState("");
			const [requirements, setRequirements] = useState("");
			const [busy, setBusy] = useState("");
			const [note, setNote] = useState("");
			const [selfTest, setSelfTest] = useState({});
			const [exportDir, setExportDir] = useState("");
			const [registerId, setRegisterId] = useState("");

			const call = async (path, body, label, qs) => {
				setBusy(label);
				try {
					const result = await api(path, body, qs);
					if (result && result.error) throw new Error(result.error);
					setNote(`${label}：完成`);
					await onRefresh();
					return result;
				} catch (error) {
					setNote(`${label}失败：` + String(error.message || error));
					return null;
				} finally { setBusy(""); }
			};
			const createDraft = async () => {
				const draft = await call("custom/draft-create", { kind, targetDomain: kind === "revise" ? targetDomain : "", newDomain: kind === "new-domain" ? newDomain : "", title, requirements }, "创建草稿");
				if (draft) { setTitle(""); setRequirements(""); }
			};
			const copyInstruction = async (text, label) => {
				const ok = await copyText(text);
				setNote(ok ? `${label}：已复制` : `${label}：复制失败，请展开指令手动复制`);
			};
			const selfTestItems = [
				"需求三项（服务谁 / 场景 / 核心流程）已由我确认",
				"校验通过（verify.json ok=true），缺口为 0",
				"预览打开过，确认页面/数据/流程符合预期",
				"已安装并能在侧边栏「⧉ 名称」打开",
				"已导入一条真实数据（或确认用样例数据）",
			];
			return h("div", null,
				Card("制作我的工作台 · 三步",
					h("div", { style: css.muted }, "遵循规范开发、安装并自测；想给别人用时，第三步导出包并登记到目录。"),
					h("div", { style: Object.assign({}, css.row, { marginTop: "8px" }) },
						Btn("打开开发规范", () => window.open("/workbench/api/custom/development-guide", "_blank")),
						h("span", { style: css.space }),
						h("span", { style: css.small }, "第 1 步交给 Agent → 第 2 步装到本机自测 → 第 3 步导出并登记")),
					note ? h("div", { style: Object.assign({}, css.small, { marginTop: "6px" }) }, note) : null),
				Card("第一步 · 把开发指令交给 Agent",
					h("div", { style: css.grid3 },
						h("div", { style: css.field }, h("label", { style: css.label }, "类型"),
							h("select", { style: css.input, value: kind, onChange: (event) => setKind(event.target.value) },
								h("option", { value: "new-domain" }, "新增自定义域"),
								h("option", { value: "revise" }, "修订内置域（不改 78 条工作流）"))),
						kind === "new-domain"
							? h("div", { style: css.field }, h("label", { style: css.label }, "新域 id"), Inp(newDomain, setNewDomain, "例如 cust-learning"))
							: h("div", { style: css.field }, h("label", { style: css.label }, "目标域"), Inp(targetDomain, setTargetDomain, "例如 rec")),
						h("div", { style: css.field }, h("label", { style: css.label }, "标题"), Inp(title, setTitle, "例如：采购工作台"))),
					h("div", { style: css.field }, h("label", { style: css.label }, "需求原文（服务谁、什么场景、核心流程）"), Area(requirements, setRequirements, "例如：采购团队需要三家比价与用印审批……")),
					h("div", { style: css.row }, Btn(busy === "创建草稿" ? "创建中…" : "创建草稿", createDraft, "p"))),
				...drafts.map((draft) => h("div", { key: draft.id }, Card(`${draft.title || draft.id} · ${DRAFT_STATUS_LABEL[draft.status] || draft.status}`,
					h("div", { style: Object.assign({}, css.row, { marginBottom: "6px" }) },
						draft.verify_running ? Tag("完整门禁运行中…", "warn") : null,
						draft.verify ? Tag(`域级 ${draft.verify.ok ? "通过" : "未通过"}`, draft.verify.ok ? "ok" : "bad") : Tag("未校验"),
						draft.verify ? Tag(`基线 ${draft.verify.baseline_status}`) : null,
						draft.verify ? Tag(`完整门禁 ${draft.verify.heavy_status}`) : null),
					h("div", { style: Object.assign({}, css.row, { marginTop: "4px" }) },
						Btn("复制开发指令", () => copyInstruction(draft.instruction || "", "复制开发指令")),
						Btn("校验", () => call("custom/verify", { id: draft.id }, "校验"), null, { disabled: busy !== "" }),
						Btn("完整门禁（后台）", () => call("custom/verify-heavy", { id: draft.id }, "完整门禁"), null, { disabled: busy !== "" || draft.verify_running }),
						Btn("构建预览", () => call("custom/preview-build", { id: draft.id }, "构建预览"), null, { disabled: busy !== "" }),
						draft.preview_available ? Btn("打开预览 ↗", () => openStandalone("?draft=" + encodeURIComponent(draft.id))) : null,
						Btn("安装（装上即用）", () => call("custom/install", { id: draft.id }, "安装"), "p", { disabled: busy !== "" || !(draft.verify && draft.verify.ok) })),
					draft.verify && draft.verify.gaps && draft.verify.gaps.length
						? h("div", { style: Object.assign({}, css.small, { color: "#b54708", marginTop: "4px" }) }, `缺口 ${draft.verify.gaps.length} 项：` + draft.verify.gaps.slice(0, 2).join("；"))
						: null))),
				Card("第二步 · 装到本机，自测确认能用",
					h("div", null, ...selfTestItems.map((item, index) => h("label", { key: item, style: Object.assign({}, css.row, { gap: "8px", padding: "4px 0" }) },
						h("input", { type: "checkbox", checked: !!selfTest[index], onChange: (event) => setSelfTest({ ...selfTest, [index]: event.target.checked }) }),
						item))),
					h("div", { style: css.small, marginTop: "4px" }, "自测清单对齐开发规范第 8 节；未通过项不得宣称完成。")),
				Card("第三步 · 导出并登记（可选）",
					h("div", { style: css.grid3 },
						h("div", { style: css.field }, h("label", { style: css.label }, "工作台（已安装）"),
							h("select", { style: css.input, value: registerId, onChange: (event) => setRegisterId(event.target.value) },
								h("option", { value: "" }, "— 选择 —"),
								...installed.filter((item) => !item.pluginName).map((item) => h("option", { key: item.id, value: item.id }, item.title || item.name || item.id)))),
						h("div", { style: css.field }, h("label", { style: css.label }, "导出目录（可选）"), Inp(exportDir, setExportDir, "留空则到数据根 custom/exports/"))),
					h("div", { style: css.row },
						Btn("导出工作台包（.tgz）", () => call("custom/export-package", { id: registerId, outFile: exportDir ? `${exportDir}/${registerId}.tgz` : undefined }, "导出工作台包"), null, { disabled: !registerId }),
						Btn("登记到目录", () => call("custom/register-catalog", { id: registerId }, "登记到目录"), null, { disabled: !registerId }),
						Btn("导出合入包（固化产品基线）", () => call("custom/consolidate", { id: registerId }, "导出合入包"), null, { disabled: !registerId })),
					h("div", { style: css.small, marginTop: "4px" }, "插件式工作台（.tgz）的安装：由 Agent/CLI 走 dsh plugin add，装后重启 Harness 生效。")));
		}

		function LocalWorkbenchPanel({ domain, label, color }) {
			const [data, setData] = useState(null);
			const [workflowId, setWorkflowId] = useState(null);
			const [instance, setInstance] = useState(null);
			const [error, setError] = useState("");
			const [noteText, setNoteText] = useState("");
			const [noteStatus, setNoteStatus] = useState("");
			const refresh = useCallback(async () => {
				try {
					const [design, definitions, instances, strategy, metrics, operators] = await Promise.all([
						api("domain-work-design", null, "domain=" + encodeURIComponent(domain)).catch(() => null),
						api("workflow-definitions"),
						api("workflow-instances", null, "domain=" + encodeURIComponent(domain)),
						api("strategy/overview"),
						api("metrics", null, "limit=100&domain=" + encodeURIComponent(domain)),
						api("operators"),
					]);
					setData({
						design,
						definitions: definitions.filter((item) => item.domain === domain),
						instances,
						metrics,
						operators: operators && Array.isArray(operators.operators) ? operators.operators : [],
						strategy: { domains: (strategy.domains || []).filter((item) => item.domain === domain) },
					});
					setError("");
				} catch (caught) {
					setError(String(caught.message || caught));
				}
			}, [domain]);
			useEffect(() => { refresh(); }, [refresh]);
			useEffect(() => {
				api("custom/notes", null, "id=" + encodeURIComponent(domain))
					.then((payload) => setNoteText(payload.text || ""))
					.catch(() => setNoteText(""));
			}, [domain]);
			const saveNote = async () => {
				try {
					const current = await api("custom/notes", null, "id=" + encodeURIComponent(domain));
					await api("custom/notes", { id: domain, text: noteText, revision: current.revision });
					setNoteStatus("已保存（本地 · 此工作台的会话共用这份笔记）");
				} catch (caught) {
					setNoteStatus("保存失败，当前内容仍保留在界面中：" + String(caught.message || caught));
				}
			};
			const definition = data ? data.definitions.find((item) => item.workflow_id === workflowId) || null : null;
			if (error) return Card(`本地工作台 · ${label || domain}`, h("div", { style: css.muted }, error));
			if (!data) return Card(`本地工作台 · ${label || domain}`, h("div", { style: css.muted }, "加载中…"));
			return h("div", null,
				h("div", { style: Object.assign({}, css.row, { marginBottom: "8px" }) },
					Tag("本地工作台（未固化）", "warn"),
					h("span", { style: css.small }, domain),
					h("span", { style: css.space }),
					Btn("保存笔记", saveNote)),
				noteStatus ? h("div", { style: Object.assign({}, css.small, { marginBottom: "6px" }) }, noteStatus) : null,
				h("textarea", {
					value: noteText,
					onChange: (event) => setNoteText(event.target.value),
					placeholder: "工作台笔记（≤200KB，本地保存）",
					style: Object.assign({}, css.input, { width: "100%", minHeight: "64px", marginBottom: "10px", fontFamily: "inherit" }),
				}),
				workflowId && definition
					? h(WorkflowWizard, { definition, instance, setInstance, refresh, operators: data.operators, onBack: () => { setWorkflowId(null); setInstance(null); } })
					: h(DomainDetail, {
						id: domain,
						label: label || domain,
						color: color || "#0f766e",
						strategy: data.strategy,
						definitions: data.definitions,
						instances: data.instances,
						designs: data.design ? [data.design] : [],
						metrics: data.metrics,
						onBack: () => {},
						onRun: (id) => { setWorkflowId(id); setInstance(null); },
						refresh,
					}));
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
			const [domainsIndex, setDomainsIndex] = useState(null);
			const [drafts, setDrafts] = useState([]);
			const [upgradeStatus, setUpgradeStatus] = useState(null);
			const [integrationStatus, setIntegrationStatus] = useState(null);
			const [installed, setInstalled] = useState([]);
			const [catalog, setCatalog] = useState(null);
			const [catalogResult, setCatalogResult] = useState(null);
			const [workbenchState, setWorkbenchState] = useState(null);
			const [updates, setUpdates] = useState(null);
			const [datasources, setDatasources] = useState(null);
			const [toast, setToast] = useState("");
			const [rollbackPlan, setRollbackPlan] = useState(null);
			const [domain, setDomain] = useState(null);
			const [workflowId, setWorkflowId] = useState(null);
			const [instance, setInstance] = useState(null);
			const [error, setError] = useState("");

			const refresh = useCallback(async () => {
				try {
					const [nextStrategy, nextDefinitions, nextDesignIndex, nextInstances, nextDeliveries, nextAudit, nextMetrics, nextBackups, nextOperators, nextTools, nextDomainsIndex, nextDrafts, nextUpgrade, nextIntegration, nextInstalled, nextCatalog, nextDatasources, nextState, nextUpdates] = await Promise.all([
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
						api("domains-index"),
						api("custom/drafts"),
						api("upgrade-status"),
						api("integration-status"),
						api("custom/installed"),
						api("custom/catalog"),
						api("datasources"),
						api("custom/state").catch(() => null),
						api("custom/check-updates").catch(() => null),
					]);
					const domainIds = ((nextDomainsIndex && nextDomainsIndex.domains) || []).map((item) => item.id);
					const designIds = domainIds.length ? domainIds : DOMAIN_ORDER.map(([id]) => id);
					const nextDesigns = await Promise.all(designIds.map((id) => api("domain-work-design", null, "domain=" + encodeURIComponent(id)).catch(() => null)));
					setStrategy(nextStrategy);
					setDefinitions(nextDefinitions);
					setDesigns(nextDesigns.filter(Boolean));
					setInstances(nextInstances);
					setDeliveries(nextDeliveries);
					setAudit(nextAudit || { stats: {}, tail: [] });
					setMetrics(nextMetrics || []);
					setBackups(nextBackups || []);
					setOperators(nextOperators && Array.isArray(nextOperators.operators) ? nextOperators.operators : []);
					setTools(nextTools);
					setDomainsIndex(nextDomainsIndex || null);
					setDrafts((nextDrafts && nextDrafts.drafts) || []);
					setUpgradeStatus(nextUpgrade || null);
					setIntegrationStatus(nextIntegration || null);
					setInstalled((nextInstalled && nextInstalled.installed) || []);
					setCatalog(nextCatalog || null);
					setCatalogResult(nextCatalog || null);
					setWorkbenchState(nextState && nextState.state ? nextState.state : null);
					setUpdates(nextUpdates && nextUpdates.records ? nextUpdates : null);
					setDatasources(nextDatasources || null);
					if (typeof hostSyncWorkbenchEntries === "function") {
						hostSyncWorkbenchEntries((nextInstalled && nextInstalled.installed) || []);
					}
					setError("");
				} catch (caught) {
					setError(String(caught.message || caught));
				}
			}, []);
			useEffect(() => { refresh(); }, [refresh]);

			const notify = useCallback((text) => {
				setToast(String(text || ""));
				setTimeout(() => setToast(""), 6000);
			}, []);

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
				["market", "工作台市场"],
				["wizard", "制作我的工作台"],
				["upgrade", "升级与兼容"],
				["approvals", "审批中心"],
				["deliveries", "交付物"],
				["audit", "审计与备份"],
				["system", "运行与回退"],
			];
			const domainMeta = domain ? DOMAIN_ORDER.find((item) => item[0] === domain) : null;
			const domainList = ((domainsIndex && domainsIndex.domains) || []).length
				? domainsIndex.domains.map((item) => [item.id, item.label, item.color, !!item.custom])
				: DOMAIN_ORDER.map(([id, label, color]) => [id, label, color, false]);
			const runRollback = async () => {
				try {
					setRollbackPlan(await api("rollback-dryrun", {}));
				} catch (error) {
					setRollbackPlan({ error: String(error.message || error) });
				}
			};
			// 顶部工作台切换器：会话（未绑定）↔ 各工作台；进入工作台后新建会话自动归属
			const setMode = async (id) => {
				try {
					const current = await api("custom/state");
					await api("custom/session-binding", { workbenchId: id, revision: current.revision });
					if (typeof hostSetActiveWorkbench === "function") hostSetActiveWorkbench(id);
					await refresh();
					notify(id ? "已进入工作台模式：之后新建的会话会自动归属该工作台" : "已切回会话模式（新会话保持未绑定）");
				} catch (error) {
					notify("切换失败：" + String(error.message || error));
				}
			};
			const addedList = (workbenchState && workbenchState.added) || [];
			const switcher = h("div", { style: Object.assign({}, css.row, { marginTop: "6px", flexWrap: "wrap", gap: "6px" }) },
				h("span", { style: css.small }, "工作台模式："),
				h("button", { type: "button", onClick: () => setMode(null), style: Object.assign({}, css.btn, workbenchState && workbenchState.active ? null : css.primary) }, "会话（未绑定）"),
				...addedList.map((id) => {
					const item = installed.find((entry) => (entry.catalog_id || `pids:${entry.id}`) === id);
					const label = item ? (item.title || item.name || item.id) : String(id);
					return h("button", {
						type: "button",
						"aria-label": `工作台模式入口：${label}`,
						onClick: () => setMode(id),
						style: Object.assign({}, css.btn, workbenchState && workbenchState.active === id ? css.primary : null),
					}, label);
				}),
				workbenchState && workbenchState.enabled === false ? Tag("工作台功能已关闭", "warn") : null);

			return h("div", { style: css.root },
				h("div", { style: css.shell },
					h("div", { style: css.top },
						h("div", { style: css.title }, "PiDSH Nexus · 全能工作台"),
						h("div", { style: css.nav }, ...nav.map(([key, label]) => Btn(label, () => { setView(key); setWorkflowId(null); setInstance(null); }, view === key ? "p" : null))),
						h("div", { style: css.space }),
						Btn("打开独立驾驶舱 ↗", () => openStandalone("#/")),
						Btn("刷新", refresh)),
					switcher,
					error ? h("div", { style: Object.assign({}, css.card, { borderColor: "#fecdca", color: "#b42318" }) }, error) : null,
					toast ? h("div", { style: Object.assign({}, css.card, { borderColor: "#c7d7fe", background: "#eff4ff", color: "#175cd3" }) }, toast) : null,
					view === "strategy" ? (
						strategyReady
							? h(StrategyView, {
								strategy,
								onDomain: openDomain,
								onRunStrategy: () => openWorkflow("strat.quarterly-review@1.0.0"),
							})
							: Card("正在加载战略总看板", h("div", { style: css.muted }, "正在读取目标、关键结果与 13 域数据…"))
					) : null,
					view === "domains" && !domain ? h(DomainsView, { strategy, definitions, instances, designs, domains: domainList, onOpen: openDomain }) : null,
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
					view === "system" ? h(SystemView, { tools, backups, onRefresh: refresh }) : null,
					view === "custom" ? h(CustomView, { drafts, domains: domainList, onRefresh: refresh, notify }) : null,
					view === "upgrade" ? h(UpgradeView, { status: upgradeStatus, plan: rollbackPlan, onRollback: runRollback, onRefresh: refresh }) : null,
					view === "market" ? h(MarketViewV2, {
						catalogResult,
						workbenchState,
						updates,
						installed,
						drafts,
						integration: integrationStatus,
						notify,
						onRefresh: refresh,
						onOpenDomain: openDomain,
						onWizard: () => setView("wizard"),
					}) : null,
					view === "wizard" ? h(WizardView, {
						drafts,
						installed,
						notify,
						onRefresh: refresh,
						onOpenDomain: openDomain,
					}) : null));
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
			// 宿主会话通道：uiWorkspace.startSession（新会话视图）；不可用时定制流程退化为“复制指令”
			try {
				const uiWorkspace = typeof ctx.get === "function" ? ctx.get("uiWorkspace") : undefined;
				hostStartSession = uiWorkspace && typeof uiWorkspace.startSession === "function"
					? (workspaceId) => uiWorkspace.startSession(workspaceId)
					: null;
			} catch {
				hostStartSession = null;
			}
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
			// dev9：已安装工作台 → 侧边栏一级固定入口（dataelement 式）。安装/卸载后由面板刷新触发同步。
			const dynamicEntries = new Map();
			hostSyncWorkbenchEntries = (installedList) => {
				const enabled = (installedList || []).filter((item) => item && item.status === "installed");
				for (const [id, entry] of [...dynamicEntries]) {
					if (enabled.some((item) => `wb:${item.id}` === id)) continue;
					entry.disposers.splice(0).forEach((dispose) => { try { dispose(); } catch { /* ignore */ } });
					dynamicEntries.delete(id);
				}
				let order = 910;
				for (const item of enabled) {
					const id = `wb:${item.id}`;
					if (dynamicEntries.has(id)) { order += 1; continue; }
					const disposerList = [];
					const label = item.title || item.label || item.id;
					disposerList.push(slots.inject("sidebar.panellist", () => slots.register({
						name: "sidebar.panellist",
						id,
						order: order,
						label: () => `⧉ ${label}`,
					}, WorkbenchIcon)));
					disposerList.push(slots.inject("main", () => slots.register({
						name: "main",
						key: id,
						inject: () => ({}),
					}, () => h(LocalWorkbenchPanel, { domain: item.id, label, color: item.color }))));
					dynamicEntries.set(id, { disposers: disposerList });
					order += 1;
				}
			};
			const dynamicDisposer = () => {
				for (const [, entry] of dynamicEntries) {
					entry.disposers.splice(0).forEach((dispose) => { try { dispose(); } catch { /* ignore */ } });
				}
				dynamicEntries.clear();
				hostSyncWorkbenchEntries = null;
			};
			disposers.push(dynamicDisposer);
			// 工作台模式：订阅宿主会话列表，新建会话在有激活工作台时自动写入归属账本
			let activeWorkbenchId = null;
			hostSetActiveWorkbench = (id) => { activeWorkbenchId = id || null; };
			try {
				const sessionsService = typeof ctx.get === "function" ? ctx.get("sessions") : undefined;
				const list = sessionsService && sessionsService.list;
				if (list && typeof list.subscribe === "function" && typeof list.getSnapshot === "function") {
					const known = new Set(Object.keys((list.getSnapshot() || {}).byId || {}));
					const dispose = list.subscribe(() => {
						const snapshot = list.getSnapshot() || {};
						for (const sessionId of Object.keys(snapshot.byId || {})) {
							if (known.has(sessionId)) continue;
							known.add(sessionId);
							if (!activeWorkbenchId) continue;
							fetch(API + "/custom/session-binding", {
								method: "POST",
								headers: { "content-type": "application/json" },
								body: JSON.stringify({ workbenchId: activeWorkbenchId, sessionId }),
							}).catch(() => { /* 绑定失败不改变既有归属 */ });
						}
					});
					disposers.push(dispose);
				}
			} catch { /* 会话服务不可用时退化为仅记录 active */ }
			fetch(API + "/custom/installed", { headers: { accept: "application/json" } })
				.then((response) => (response.ok ? response.json() : null))
				.then((payload) => { if (payload) hostSyncWorkbenchEntries(payload.installed || []); })
				.catch(() => { /* 首次同步失败不阻塞壳加载 */ });
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
