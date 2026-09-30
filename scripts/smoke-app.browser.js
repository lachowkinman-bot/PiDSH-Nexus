/* smoke-app.browser.js — P4 生成式全量冒烟（浏览器侧脚本）
   装载方式：以普通 <script src> 注入本文件，它只挂一个全局函数 window.runAppSmoke()，调用方 await 其返回值。
   **不使用 eval / new Function / 动态执行远端代码**（安全扫描已就此类模式拦截过一次，此处为安全写法）。

   设计要点（均为前几轮假失败换来的教训）：
   ① 每轮先重置 localStorage（flows/audit/域数据）→ 状态可复现，避免上一轮遗留把 3 节点流程推成 done；
   ② 每步先关抽屉，避免上一轮残留的 drawer 抢选择器；
   ③ 数值/日期列注入合法值 → 否则会触发（正确的）校验，把"入库成功"断言打成假失败；
   ④ 驳回用例重建新实例，确保处于 running 态 → 否则按钮不存在；
   ⑤ 结果 POST 到收集端落盘，不绕经模型上下文。
   调用（页面内两行）：
     await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/scripts/smoke-app.browser.js'; s.onload = res; s.onerror = () => rej(new Error('load fail')); document.head.append(s); });
     const r = await window.runAppSmoke(); */
window.runAppSmoke = async () => {
  const M = window.__DOMAIN_MODELS__, ORDER = window.__DOMAIN_ORDER__;
  const sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const stem = (s) => String(s).replace(/\.csv$/, '');
  const rows = ['route,type,kind,status,note'], fails = [];
  let total = 0, pass = 0;
  const ck = (r, t, k, ok, n) => {
    total++; ok ? pass++ : fails.push(`${r} :: ${k} :: ${n}`);
    rows.push([r, t, k, ok ? 'PASS' : 'FAIL', String(n || '').replace(/,/g, ';')].join(','));
  };
  const errs = []; window.addEventListener('error', (e) => errs.push(String(e.message)));
  const reset = () => {
    localStorage.removeItem('hr_workbench_flows');
    localStorage.removeItem('hr_workbench_audit');
    for (const d of ORDER) localStorage.removeItem('hr_workbench_data_' + d);
  };
  const closeDrawers = () => { document.querySelectorAll('.scrim,.drawer').forEach((e) => e.remove()); };
  const auditLen = () => JSON.parse(localStorage.getItem('hr_workbench_audit') || '[]').length;
  const setFlows = (f) => localStorage.setItem('hr_workbench_flows', JSON.stringify(f));

  reset();

  // ① 全路由可达 + 类型特有断言
  const routes = [{ r: '#/', t: 'dash' }, { r: '#/audit', t: 'audit' }, { r: '#/deliverables', t: 'delivs' }];
  for (const d of ORDER) for (const p of M[d].pages) routes.push({ r: p.route, t: p.type, dom: d, ref: p });
  for (const rt of routes) {
    let ok = true, n = '';
    try {
      closeDrawers();
      location.hash = rt.r; await sl(30);
      const c = document.querySelector('.content');
      const txt = c ? c.textContent.trim() : '';
      if (!c || txt.length < 20) { ok = false; n = '内容为空'; }
      else if (rt.t === 'table') {
        const th = document.querySelectorAll('.content table.tbl thead th').length;
        const mt = (M[rt.dom].tables.find((t) => stem(t.file) === stem(rt.ref.table)) || {}).columns || [];
        if (th !== mt.length) { ok = false; n = `列数 ${th}≠${mt.length}`; }
        else if (!document.querySelector('.content table.tbl tbody tr')) { ok = false; n = '无数据行'; }
      } else if (rt.t === 'workflow') {
        const st = document.querySelectorAll('.content .step').length;
        // 取工作流 stem：必须先剥 @version 再按 `.` 取末段。
        // 曾写成 stem(workflow).split('.').pop() → 对 `admin.purchase-approve@1.0.0` 得到 "0"，
        // 导致 78 条流程路由断言全部取不到模型（假失败）。
        const key = rt.ref.workflow.split('@')[0].split('.').pop();
        const mw = M[rt.dom].workflows.find((w) => w.id.split('@')[0].split('.').pop() === key);
        if (!mw || st !== mw.nodes.length) { ok = false; n = `步骤 ${st}≠${mw ? mw.nodes.length : '?'}`; }
      } else if (rt.t === 'settings' && !/校验规则/.test(txt)) { ok = false; n = '缺 §9'; }
      else if (rt.t === 'overview' && !/状态机/.test(txt)) { ok = false; n = '缺状态机'; }
    } catch (e) { ok = false; n = '异常 ' + e.message; }
    ck(rt.r, rt.t, 'route', ok, n);
  }

  // ② 台账动作（逐表）：空表单必须被拦 → 填合法值入库 → 审计留痕
  // 顺序要紧：**先判数值、后判日期**。曾把日期判断放前面，因正则子串撞车把
  // `spend_wan`（含 "end"）、`dept_quarter_pkg_wan`（含 "quarter"）、`attendees`（含 "end"）
  // 误判为日期列 → 注入日期字符串 → 被应用（正确地）拒绝 → 4 条假失败。
  const RE_NUM = /amount|price|budget|used|remain|revenue|net|cost|total|qty|count|hours|days|_wan|_yuan|pct|score|rate|year|p25|p50|p75|points|balance|seat|cap/i;
  const RE_DATE = /_date$|^date|_at$|deadline|expire|_start$|_end$|^month$|^period$|^quarter$|_month|_period|_quarter/i;
  const valFor = (col, i) => RE_NUM.test(col) ? String(10 + i)
    : RE_DATE.test(col) ? '2026-09-29'
      : 'SMOKE-' + i;
  for (const d of ORDER) for (const t of M[d].tables) {
    const rt = `#/${d}/t/${stem(t.file)}`;
    try {
      closeDrawers();
      location.hash = rt; await sl(30);
      const key = 'hr_workbench_data_' + d;
      const len = () => (JSON.parse(localStorage.getItem(key) || 'null') || {})[t.file]?.length ?? t.rows;
      const b0 = len();
      [...document.querySelectorAll('.toolbar .btn')].find((x) => x.textContent.includes('新增')).click(); await sl(30);
      document.querySelectorAll('.drawer footer .btn')[0].click(); await sl(30);
      ck(rt, 'table', 'validate-block', !!document.querySelector('.drawer .err')?.textContent, '');
      const ins = [...document.querySelectorAll('.drawer .field input')];
      ins.forEach((el, i) => { el.value = valFor(t.columns[i] || '', i); el.dispatchEvent(new Event('input')); });
      document.querySelectorAll('.drawer footer .btn')[0].click(); await sl(40);
      const b1 = len();
      ck(rt, 'table', 'create-persist', b1 === b0 + 1, `rows ${b0}→${b1}`);
      ck(rt, 'table', 'audit', JSON.parse(localStorage.getItem('hr_workbench_audit') || '[]').some((x) => x.action === 'table.create' && x.table === t.file), '');
      closeDrawers();
    } catch (e) { ck(rt, 'table', 'action', false, '异常 ' + e.message); closeDrawers(); }
  }

  // ③ 流程动作（逐流程）
  for (const d of ORDER) for (const w of M[d].workflows) {
    const rt = `#/${d}/w/${w.id.split('@')[0].split('.').pop()}`;
    try {
      closeDrawers();
      const f0 = JSON.parse(localStorage.getItem('hr_workbench_flows') || '{}'); delete f0[w.id]; setFlows(f0);
      location.hash = rt; await sl(30);
      const a0 = auditLen();
      const btn = (x, exact) => [...document.querySelectorAll('.toolbar .btn')].find((b) => exact ? b.textContent.trim() === x : b.textContent.includes(x));
      btn('发起流程')?.click(); await sl(30);
      btn('通过')?.click(); await sl(30);
      const inst = JSON.parse(localStorage.getItem('hr_workbench_flows') || '{}')[w.id];
      ck(rt, 'workflow', 'start-advance', !!inst && inst.step >= 2, inst ? 'step=' + inst.step : '未落盘');
      ck(rt, 'workflow', 'audit-grew', auditLen() > a0, `${a0}→${auditLen()}`);
      // 驳回：重建新实例保证 running；空原因必须被拦，填原因后状态须转 rejected
      const f1 = JSON.parse(localStorage.getItem('hr_workbench_flows') || '{}'); delete f1[w.id]; setFlows(f1);
      location.hash = '#/'; await sl(20); location.hash = rt; await sl(30);
      btn('发起流程')?.click(); await sl(30);
      let alerted = false; const origAlert = window.alert; window.alert = () => { alerted = true; };
      btn('驳回', true)?.click(); await sl(25);
      ck(rt, 'workflow', 'reject-needs-reason', alerted, alerted ? '' : '空原因未拦');
      const inp = document.querySelector('.toolbar input');
      if (inp) { inp.value = '冒烟：原因说明'; inp.dispatchEvent(new Event('input')); await sl(15); }
      btn('驳回', true)?.click(); await sl(30);
      const inst2 = JSON.parse(localStorage.getItem('hr_workbench_flows') || '{}')[w.id];
      ck(rt, 'workflow', 'reject-applied', !!inst2 && inst2.status === 'rejected', inst2 ? 'status=' + inst2.status : '未落盘');
      window.alert = origAlert;
    } catch (e) { ck(rt, 'workflow', 'action', false, '异常 ' + e.message); }
  }

  const summary = { at: new Date().toISOString(), total, pass, fail: total - pass, jsErrors: errs, fails };
  let posted = 'no';
  try { posted = (await fetch('http://127.0.0.1:3821/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: rows.join('\n'), summary }) })).status; }
  catch (e) { posted = 'ERR ' + e.message; }
  const by = {}; for (const f of fails) { const k = f.split(' :: ')[1]; by[k] = (by[k] || 0) + 1; }
  return { total, pass, fail: total - pass, posted, jsErrors: errs.length, byKind: by, sample: fails.slice(0, 6) };
};
