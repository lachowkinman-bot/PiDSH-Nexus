/* app.js — 独立单页工作台（设计 v2：D1 独立应用 / D5 两级侧栏+驾驶舱 / D6 真实读写+持久化）
   数据与页面清单全部来自 window.__DOMAIN_MODELS__（manifests/domain-model/*.json，由 gen-domain-model.mjs 生成）。 */
(() => {
  const MODELS = window.__DOMAIN_MODELS__;
  const SEED = window.__DATA__;
  const ORDER = window.__DOMAIN_ORDER__;
  const DELIVERY = window.__DELIVERY__ || { domains: {}, formats: [] };
  // 4.0.0-dev8 集成层：集成中心 / 升级与兼容 / 自定义工作台（http 下走实时 API，file:// 用烘焙快照）
  const INTEGRATION = window.__INTEGRATION__ || { projects: [] };
  const UPGRADE_SNAPSHOT = window.__UPGRADE__ || null;
  const PREVIEW = window.__PREVIEW__ || null;
  const LIVE = location.protocol === 'http:' || location.protocol === 'https:';
  const $ = (s, r) => (r || document).querySelector(s);

  // ———— hyperscript ————
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
    return el;
  }

  async function api(path, options) {
    const r = await fetch(path, Object.assign({ headers: { 'content-type': 'application/json' } }, options || {}));
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }
    if (!r.ok) throw new Error((body && (body.error || body.message)) || `HTTP ${r.status}`);
    return body;
  }

  async function copyToClipboard(text) {
    const value = String(text || '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(value); return true; }
    } catch { /* 退化为 execCommand */ }
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch { return false; }
  }

  function openArtifact(file) {
    const url = '/workbench/api/artifact?id=' + encodeURIComponent(file);
    const a = h('a', { href: url, download: file.split('/').pop() || 'artifact' });
    document.body.append(a);
    a.click();
    a.remove();
  }

  function deliveryCenter(domain) {
    const status = h('div', { class: 'muted' }, '读取交付记录…');
    const list = h('div');
    let busy = false;
    let targetDomain = domain || ORDER[0];
    const run = async (formats) => {
      if (busy) return;
      busy = true;
      status.textContent = `正在生成 ${MODELS[targetDomain].label} 交付包…`;
      try {
        const r = await api('/workbench/api/deliver', {
          method: 'POST',
          body: JSON.stringify({ domain: targetDomain, formats: formats || undefined }),
        });
        status.textContent = `已完成 ${r.artifacts.length} 个文件：${r.manifestPath}`;
        audit('delivery.ui', { domain: targetDomain, formats: formats || 'all', runId: r.runId });
        await refresh();
      } catch (e) {
        status.textContent = '生成失败：' + e.message;
      } finally {
        busy = false;
      }
    };
    const formatButton = (label, formats) => h('button', {
      class: 'btn sm' + (formats ? '' : ' p'),
      onclick: () => run(formats),
    }, label);
    let refresh = async () => {
      try {
        const rows = await api('/workbench/api/artifacts' + (domain ? `?domain=${encodeURIComponent(domain)}` : ''));
        if (!rows.length) {
          list.replaceChildren(h('div', { class: 'empty' }, domain ? '本域尚无交付包，点击上方按钮生成。' : '尚无交付包。'));
          return;
        }
        list.replaceChildren(...rows.slice(0, 5).map((item) => h('div', { style: 'padding:10px 0;border-bottom:1px solid var(--line-c)' },
          h('div', null, h('b', null, item.title || item.domain), ' ', h('span', { class: 'tag p' }, item.domain), ' ', h('span', { class: 'tag ok' }, `${item.artifactCount} 文件`)),
          h('div', { class: 'muted', style: 'font-size:.86em' }, item.generatedAt + ' · ' + item.path),
          h('div', { class: 'toolbar', style: 'margin-top:6px' }, ...(item.artifacts || []).map((artifact) => h('button', {
            class: 'btn sm',
            onclick: () => openArtifact(artifact.file),
          }, artifact.format.toUpperCase()))))));
      } catch (e) {
        list.replaceChildren(h('div', { class: 'err' }, '交付记录不可用：' + e.message));
      }
    };
    queueMicrotask(refresh);
    return card(domain ? `${MODELS[domain].label} · 交付中心` : '跨域交付中心',
      status,
      h('div', { class: 'toolbar', style: 'margin-top:10px' },
        domain ? null : h('select', { class: 'btn sm', onchange: (e) => { targetDomain = e.target.value; refresh(); } },
          ...ORDER.map((d) => h('option', { value: d }, MODELS[d].label))),
        formatButton('生成全部格式'),
        ...['MD', 'CSV', 'HTML', 'XLSX', 'DOCX', 'PPTX', 'PDF'].map((label) => formatButton(label, label.toLowerCase()))),
      h('div', { style: 'margin-top:8px' }, list));
  }

  // ———— 持久化（D6：localStorage，前缀 hr_workbench_）————
  const K_DATA = (d) => 'hr_workbench_data_' + d, K_AUDIT = 'hr_workbench_audit', K_UI = 'hr_workbench_ui', K_FLOW = 'hr_workbench_flows';
  const read = (k, dflt) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch { return dflt; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  // 实时数据（http 下读服务端；file:// 用内联种子回退）
  const LIVE_CACHE = {};
  const LIVE_META = {};
  async function ensureLiveData(domain) {
    if (!LIVE || LIVE_META[domain]) return;
    LIVE_META[domain] = 'loading';
    try {
      const payload = await api('/workbench/api/data?domain=' + encodeURIComponent(domain));
      const data = { __header: {} };
      for (const table of payload.tables || []) {
        const file = table.name.endsWith('.csv') ? table.name : table.name + '.csv';
        data.__header[file] = table.head || [];
        data[file] = table.rows || [];
      }
      LIVE_CACHE[domain] = data;
      LIVE_META[domain] = 'live';
      if (parse().dom === domain) render();
    } catch {
      LIVE_META[domain] = 'seed';
    }
  }
  const dataOf = (d) => (LIVE && LIVE_CACHE[d]) || read(K_DATA(d), null) || SEED[d] || {};
  const saveData = (d, v) => write(K_DATA(d), v);
  const flows = () => read(K_FLOW, {});
  const saveFlows = (v) => write(K_FLOW, v);
  function audit(action, detail) { const a = read(K_AUDIT, []); a.unshift(Object.assign({ ts: new Date().toISOString(), action }, detail)); write(K_AUDIT, a.slice(0, 800)); }
  const ui = () => read(K_UI, { theme: 'ocean', density: 'comfortable' });
  const setUI = (patch) => { write(K_UI, Object.assign(ui(), patch)); applyUI(); };

  function applyUI() {
    const u = ui();
    document.documentElement.dataset.theme = u.theme;
    document.documentElement.dataset.density = u.density;
  }

  // ———— 路由 ————
  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { name: 'dash' };
    const p = raw.split('/');
    if (p[0] === 'custom') return { name: 'custom' };
    if (p[0] === 'upgrade') return { name: 'upgrade' };
    if (p[0] === 'market') return { name: 'market' };
    if (p[0] === 'integration') return { name: 'market' };
    if (p[0] === 'audit') return { name: 'audit' };
    if (p[0] === 'deliverables') return { name: 'delivs' };
    const dom = p[0];
    if (!MODELS[dom]) return { name: 'dash' };
    if (!p[1]) return { name: 'overview', dom };
    if (p[1] === 'settings') return { name: 'settings', dom };
    if (p[1] === 't') return { name: 'table', dom, table: p[2] };
    if (p[1] === 'w') return { name: 'workflow', dom, wf: p[2] };
    return { name: 'overview', dom };
  }
  const go = (hash) => { location.hash = hash; };

  // ———— 侧边栏（D5：两级）————
  function sidebar(r) {
    const items = [];
    items.push(h('button', { class: 'nav-item' + (r.name === 'dash' ? ' active' : ''), onclick: () => go('#/') }, '◲ 主驾驶舱'));
    for (const d of ORDER) {
      const m = MODELS[d];
      const active = r.dom === d;
      items.push(h('button', { class: 'nav-item' + (active ? ' active' : ''), onclick: () => go('#/' + d) },
        h('span', null, m.label), h('span', { class: 'spacer' }), h('span', { class: 'tag' }, String(m.pages.length))));
      if (active) {
        items.push(h('button', { class: 'nav-sub' + (r.name === 'overview' ? ' active' : ''), onclick: () => go('#/' + d) }, '域概览'));
        for (const t of m.tables) items.push(h('button', {
          class: 'nav-sub kind-t' + (r.name === 'table' && r.table === t.file.replace(/\.csv$/, '') ? ' active' : ''),
          onclick: () => go(`#/${d}/t/${t.file.replace(/\.csv$/, '')}`),
        }, t.file.replace(/\.csv$/, '')));
        for (const w of m.workflows) items.push(h('button', {
          class: 'nav-sub kind-w' + (r.name === 'workflow' && r.wf === w.id.split('@')[0].split('.')[1] ? ' active' : ''),
          onclick: () => go(`#/${d}/w/${w.id.split('@')[0].split('.')[1]}`),
        }, w.description.length > 14 ? w.description.slice(0, 14) + '…' : w.description));
        items.push(h('button', { class: 'nav-sub' + (r.name === 'settings' ? ' active' : ''), onclick: () => go(`#/${d}/settings`) }, '域设置'));
      }
    }
    items.push(h('div', { class: 'nav-group' }, h('div', { class: 'nav-sec' }, '集成'),
      h('button', { class: 'nav-item' + (r.name === 'market' ? ' active' : ''), onclick: () => go('#/market') }, '工作台市场'),
      h('button', { class: 'nav-item' + (r.name === 'custom' ? ' active' : ''), onclick: () => go('#/custom') }, '自定义工作台'),
      h('button', { class: 'nav-item' + (r.name === 'upgrade' ? ' active' : ''), onclick: () => go('#/upgrade') }, '升级与兼容')));
    items.push(h('div', { class: 'nav-group' }, h('div', { class: 'nav-sec' }, '全过程'),
      h('button', { class: 'nav-item' + (r.name === 'audit' ? ' active' : ''), onclick: () => go('#/audit') }, '审计事件流'),
      h('button', { class: 'nav-item' + (r.name === 'delivs' ? ' active' : ''), onclick: () => go('#/deliverables') }, '交付物')));
    return h('aside', { class: 'sidebar' }, h('div', { class: 'brand' }, 'PiDSH Nexus · 全能工作台'), h('nav', { class: 'nav' }, items));
  }

  // ———— 顶栏 ————
  const DENS = { comfortable: '舒适', compact: '紧凑' };
  const THEMES = { ocean: '海洋', emerald: '翡翠', violet: '紫罗兰' };
  function topbar(r, crumb) {
    const u = ui();
    return h('header', { class: 'topbar' },
      h('div', { class: 'crumb' }, crumb),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm', title: '返回 DSH 主壳：聊天会话 / 插件市场 / 技能中心 / 记忆系统', onclick: () => { location.href = '/'; } }, '⟵ 主壳 · 会话/插件/技能'),
      h('button', { class: 'btn sm', onclick: () => go('#/') }, '主驾驶舱'),
      h('button', { class: 'btn sm', title: '密度', onclick: () => setUI({ density: u.density === 'comfortable' ? 'compact' : 'comfortable' }) }, '密度：' + DENS[u.density]),
      h('select', { class: 'btn sm', onchange: (e) => setUI({ theme: e.target.value }) },
        ...Object.entries(THEMES).map(([k, v]) => h('option', { value: k, selected: u.theme === k }, v))),
      h('button', { class: 'btn sm', onclick: () => { if (confirm('重置全部本地数据（数据/审计/流程）？')) { ORDER.forEach((d) => localStorage.removeItem(K_DATA(d))); localStorage.removeItem(K_AUDIT); localStorage.removeItem(K_FLOW); render(); } } }, '重置数据'));
  }

  // ———— 通用块 ————
  const kpi = (label, value) => h('div', { class: 'card kpi' }, h('div', { class: 'v' }, String(value)), h('div', { class: 'l' }, label));
  const card = (title, ...body) => h('section', { class: 'card' }, title ? h('h3', null, title) : null, ...body);

  function modelTable(block) {   // 渲染域模型里的「带出处的表格」（状态机/审批链/校验规则）
    if (!block) return h('div', { class: 'muted' }, '（无结构化内容）');
    return h('div', null,
      block.blocks.map((b) => h('div', { style: 'margin-bottom:12px' },
        h('div', { class: 'muted', style: 'margin-bottom:6px' }, b.heading),
        ...b.tables.map((t) => h('div', { class: 'tbl-wrap', style: 'margin-bottom:8px' },
          h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...t.header.map((c) => h('th', null, c)))),
            h('tbody', null, ...t.rows.map((row) => h('tr', null, ...row.map((c) => h('td', null, c)))))))),
        ...b.bullets.map((x) => h('div', { class: 'muted', style: 'margin:4px 0' }, '· ' + x)))),
      h('div', { class: 'muted', style: 'font-size:.85em' }, '出处：' + block.source));
  }

  // ———— 抽屉 ————
  function drawer(title, bodyNodes, footNodes) {
    const close = () => { $('.scrim')?.remove(); $('.drawer')?.remove(); };
    document.body.append(
      h('div', { class: 'scrim', onclick: close }),
      h('aside', { class: 'drawer' }, h('header', null, h('b', null, title), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: close }, '关闭')),
        h('div', { class: 'body' }, ...bodyNodes), h('footer', null, ...(footNodes || []))));
  }

  // ———— 页：驾驶舱 ————
  function pageDash() {
    const tot = ORDER.reduce((s, d) => s + MODELS[d].tables.reduce((x, t) => x + t.rows, 0), 0);
    const wf = ORDER.reduce((s, d) => s + MODELS[d].workflows.length, 0);
    const gt = ORDER.reduce((s, d) => s + MODELS[d].golden_tasks.length, 0);
    const fl = flows(); const running = Object.values(fl).filter((x) => x.status === 'running').length;
    return h('div', { class: 'wrap' },
      h('h1', { style: 'font-size:24px;margin:0 0 4px;color:var(--head)' }, '主驾驶舱'),
      h('div', { class: 'muted', style: 'margin-bottom:16px' }, '跨域 KPI、业务域入口与交付状态总览'),
      h('div', { class: 'grid k4' }, kpi('业务域', ORDER.length), kpi('数据表 / 行数', `${ORDER.reduce((s, d) => s + MODELS[d].tables.length, 0)} / ${tot}`), kpi('工作流', wf), kpi('Golden Tasks', gt)),
      h('div', { class: 'grid k4' }, kpi('在途流程', running), kpi('审计事件', read(K_AUDIT, []).length), kpi('页面', ORDER.reduce((s, d) => s + MODELS[d].pages.length, 0) + 3), kpi('交付物', '见交付物页')),
      card('业务域', h('div', { class: 'grid k2' }, ...ORDER.map((d) => {
        const m = MODELS[d];
        return h('div', { class: 'card', style: 'margin:0;cursor:pointer', onclick: () => go('#/' + d) },
          h('h3', null, m.label),
          h('div', { class: 'muted' }, m.tables.map((t) => t.file.replace(/\.csv$/, '')).join(' ｜ ')),
          h('div', { style: 'margin-top:8px' }, h('span', { class: 'tag p' }, m.level || '-'), ' ', h('span', { class: 'tag' }, m.dual_approval ? '双审批' : '单审批'), ' ', h('span', { class: 'tag' }, m.workflows.length + ' 流程'), ' ', h('span', { class: 'tag' }, m.golden_tasks.length + ' GT')));
      }))),
      deliveryCenter(null));
  }

  // ———— 页：域概览 ————
  function pageOverview(d) {
    ensureLiveData(d);
    const m = MODELS[d], data = dataOf(d);
    const delivery = DELIVERY.domains[d] || {};
    const rows = m.tables.reduce((s, t) => s + ((data[t.file] || []).length || t.rows), 0);
    return h('div', { class: 'wrap' },
      h('div', { class: 'grid k4' },
        kpi('数据表', m.tables.length), kpi('行数', rows), kpi('工作流', m.workflows.length), kpi('Golden Tasks', m.golden_tasks.length)),
      card('交付规范', h('div', null,
        h('h3', null, delivery.title || `${m.label} 交付包`),
        h('div', { class: 'muted' }, '代表工作流：' + (delivery.workflow_id || '-')),
        h('div', { style: 'margin-top:8px' }, ...(DELIVERY.formats || []).map((f) => h('span', { class: 'tag p', style: 'margin-right:4px' }, f.toUpperCase()))))),
      card('域策略', h('div', null,
        h('span', { class: 'tag p' }, '级别 ' + (m.level || '-')), ' ',
        h('span', { class: 'tag' }, m.dual_approval ? '双审批' : '单审批'), ' ',
        ...(m.redact_fields || []).map((f) => h('span', { class: 'tag warn', style: 'margin-left:4px' }, '脱敏 ' + f)),
        m.memory ? h('div', { class: 'muted', style: 'margin-top:8px' }, '记忆层：' + JSON.stringify(m.memory)) : null)),
      h('div', { class: 'grid k2' },
        card('状态机（§4）', modelTable(m.sections['4'])),
        card('审批链（§5）', modelTable(m.sections['5']))),
      card('数据资产', h('div', { class: 'grid k2' }, ...m.tables.map((t) => h('div', { class: 'card', style: 'margin:0' },
        h('h3', null, t.file), h('div', { class: 'muted' }, t.columns.length + ' 列 ｜ ' + ((data[t.file] || []).length || t.rows) + ' 行'),
        t.pii_likely.length ? h('div', { style: 'margin-top:6px' }, ...t.pii_likely.map((c) => h('span', { class: 'tag warn', style: 'margin-right:4px' }, c))) : null,
        h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: () => go(`#/${d}/t/${t.file.replace(/\.csv$/, '')}`) }, '打开台账')))))),
      card('Golden Tasks', h('div', null, ...m.golden_tasks.map((g) => h('div', { style: 'padding:6px 0;border-bottom:1px solid var(--line-c)' },
        h('b', null, g.id), ' ', h('span', { class: 'muted' }, g.input), g.expected_output ? h('div', { class: 'muted', style: 'font-size:.88em' }, '产物：' + g.expected_output) : null)))),
      card('校验规则（§9）', modelTable(m.sections['9'])),
      deliveryCenter(d));
  }

  // ———— 页：台账（每表一页）————
  const PAGE = 15;
  function pageTable(d, fileStem) {
    ensureLiveData(d);
    const m = MODELS[d];
    const tb = m.tables.find((t) => t.file.replace(/\.csv$/, '') === fileStem);
    if (!tb) return h('div', { class: 'wrap' }, h('div', { class: 'empty' }, '未找到该表'));
    const file = tb.file;
    const box = h('div', { class: 'wrap' });
    let page = 1, q = '';
    const draw = () => {
      const data = dataOf(d);
      const all = data[file] || [];
      const header = (data.__header && data.__header[file]) || tb.columns;
      const idx = header.map((c, i) => [c, i]);
      const rows = q ? all.filter((r) => r.join(' ').toLowerCase().includes(q.toLowerCase())) : all;
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      if (page > pages) page = pages;
      const slice = rows.slice((page - 1) * PAGE, page * PAGE);
      const importButton = () => {
        const input = h('input', {
          type: 'file',
          accept: '.csv,text/csv',
          style: 'display:none',
          onchange: async (event) => {
            const picked = event.target.files && event.target.files[0];
            if (!picked) return;
            try {
              const text = await picked.text();
              const result = await api('/workbench/api/data/import', { method: 'POST', body: JSON.stringify({ domain: d, table: file, csv: text, mode: 'strict' }) });
              if (result.ok) {
                audit('table.import', { domain: d, table: file, rows: result.rows });
                delete LIVE_CACHE[d];
                delete LIVE_META[d];
                ensureLiveData(d);
                draw();
              } else {
                const validation = result.validation || {};
                alert(`导入未通过：${result.message || ''}\n缺失列：${(validation.missing || []).join('、') || '—'}\n多余列：${(validation.extra || []).join('、') || '—'}`);
              }
            } catch (error) {
              alert('导入失败：' + error.message);
            }
          },
        });
        document.body.append(input);
        input.click();
        input.remove();
      };
      box.replaceChildren(
        h('div', { class: 'toolbar' },
          h('input', { placeholder: '搜索（跨列）', value: q, oninput: (e) => { q = e.target.value; page = 1; draw(); }, style: 'width:260px' }),
          h('span', { class: 'tag' }, rows.length + ' 行'),
          h('span', { class: 'tag ' + (LIVE_META[d] === 'live' ? 'ok' : '') }, LIVE ? (LIVE_META[d] === 'live' ? '实时数据（服务端）' : '种子数据（离线回退）') : '本地数据'),
          h('div', { class: 'spacer' }),
          LIVE ? h('button', { class: 'btn sm p', onclick: importButton }, '导入 CSV（严格校验）') : h('button', { class: 'btn sm p', onclick: () => editRow(null) }, '新增'),
          h('button', { class: 'btn sm', onclick: () => exportCsv(file, header, all) }, '导出 CSV')),
        h('div', { class: 'tbl-wrap' }, rows.length ? h('table', { class: 'tbl' },
          h('thead', null, h('tr', null, ...header.map((c) => h('th', null, c)))),
          h('tbody', null, ...slice.map((r, i) => h('tr', { onclick: () => detail((page - 1) * PAGE + i) },
            ...idx.map(([, ci]) => h('td', null, r[ci] == null ? '' : String(r[ci])))))))
          : h('div', { class: 'empty' }, '暂无数据，点击「新增」录入')),
        h('div', { class: 'pager' },
          h('button', { class: 'btn sm', disabled: page <= 1, onclick: () => { page--; draw(); } }, '上一页'),
          h('span', { class: 'muted' }, `第 ${page} / ${pages} 页`),
          h('button', { class: 'btn sm', disabled: page >= pages, onclick: () => { page++; draw(); } }, '下一页')),
        h('div', { class: 'muted', style: 'margin-top:12px' }, '本表校验规则见「域设置」页 §9。'));
    };
    const detail = (i) => {
      const data = dataOf(d); const all = data[file] || [];
      const header = (data.__header && data.__header[file]) || tb.columns;
      const r = all[i];
      drawer(file + ' · 行 ' + (i + 1),
        [h('dl', { class: 'kv' }, ...header.flatMap((c, ci) => [h('dt', null, c), h('dd', null, r[ci] == null ? '—' : String(r[ci]))]))],
        LIVE
          ? [h('span', { class: 'tag' }, '实时数据只读；修改请用「导入 CSV」或桌面应用')]
          : [h('button', { class: 'btn p', onclick: () => editRow(i) }, '编辑'),
             h('button', { class: 'btn', onclick: () => { if (confirm('删除该行？')) { all.splice(i, 1); data[file] = all; saveData(d, data); audit('table.delete', { domain: d, table: file, row: i }); $('.drawer')?.remove(); $('.scrim')?.remove(); draw(); } } }, '删除')]);
    };
    const editRow = (i) => {
      const data = dataOf(d);
      data.__header = data.__header || {};
      if (!data.__header[file]) data.__header[file] = tb.columns.slice();
      const header = data.__header[file];
      const all = data[file] || [];
      const cur = i == null ? header.map(() => '') : all[i].slice();
      const inputs = header.map((c, ci) => h('div', { class: 'field' }, h('label', null, c),
        h('input', { value: cur[ci] == null ? '' : String(cur[ci]), oninput: (e) => { cur[ci] = e.target.value; }, 'data-ci': String(ci) })));
      const errBox = h('div', { class: 'err' });
      drawer((i == null ? '新增 · ' : '编辑 · ') + file, [...inputs, errBox], [
        h('button', {
          class: 'btn p', onclick: () => {
            // 通用校验：必填非空、金额/数量类必须为数字且 > 0（域级规则见 §9）
            const errs = [];
            header.forEach((c, ci) => { if (String(cur[ci]).trim() === '') errs.push(`「${c}」不能为空`); });
            header.forEach((c, ci) => { if (/amount|price|budget|used|remain|revenue|net|cost|total|qty|count|hours|days|_wan|_yuan|pct|score|rate/i.test(c) && String(cur[ci]).trim() !== '' && !/^-?\d+(\.\d+)?%?$/.test(String(cur[ci]).trim())) errs.push(`「${c}」应为数值`); });
            if (errs.length) { errBox.textContent = errs.join('；'); return; }
            if (i == null) { all.push(cur); audit('table.create', { domain: d, table: file }); }
            else { all[i] = cur; audit('table.update', { domain: d, table: file, row: i }); }
            data[file] = all; saveData(d, data);
            $('.drawer')?.remove(); $('.scrim')?.remove(); draw();
          }
        }, '保存'), h('button', { class: 'btn', onclick: () => { $('.drawer')?.remove(); $('.scrim')?.remove(); } }, '取消')]);
    };
    const exportCsv = (f, header, all) => {
      const txt = [header, ...all].map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: f });
      document.body.append(a); a.click(); a.remove();
      audit('table.export', { domain: d, table: f, rows: all.length });
    };
    draw();
    return box;
  }

  // ———— 页：流程（每流程一页）————
  const NLABEL = { skill: '技能', condition: '条件', approval: '审批(HITL)', tool: '工具', audit: '审计' };
  function pageWorkflow(d, stem) {
    const m = MODELS[d];
    const w = m.workflows.find((x) => x.id.split('@')[0].split('.')[1] === stem);
    if (!w) return h('div', { class: 'wrap' }, h('div', { class: 'empty' }, '未找到该工作流'));
    const box = h('div', { class: 'wrap' });
    const draw = () => {
      const fl = flows(); const inst = fl[w.id] || { step: w.nodes.length, status: 'not_started', log: [] };
      const curStep = inst.status === 'running' ? inst.step : (inst.status === 'done' ? w.nodes.length + 1 : 0);
      const steps = h('div', { class: 'steps' }, ...w.nodes.flatMap((n, i) => {
        const state = i + 1 < curStep ? 'done' : (i + 1 === curStep ? 'cur' : '');
        const el = h('div', { class: 'step ' + state }, h('span', { class: 'n' }, i + 1),
          h('span', null, n.id + ' ' + (NLABEL[n.type] || n.type) + (n.ref ? ' · ' + n.ref : '') + (n.dual ? ' · 双审批' : '')));
        return i < w.nodes.length - 1 ? [el, h('span', { class: 'step-arrow' }, '→')] : [el];
      }));
      const statusTag = { not_started: h('span', { class: 'tag' }, '未发起'), running: h('span', { class: 'tag p' }, '进行中 · 第 ' + inst.step + ' 步'), done: h('span', { class: 'tag ok' }, '已完成'), rejected: h('span', { class: 'tag bad' }, '已驳回'), cancelled: h('span', { class: 'tag' }, '已取消') }[inst.status];
      const rejectReason = h('input', { placeholder: '驳回原因（必填）', style: 'width:280px' });
      const act = [];
      if (inst.status === 'not_started' || !fl[w.id]) act.push(h('button', { class: 'btn p', onclick: () => { fl[w.id] = { step: 2, status: 'running', log: [{ ts: new Date().toISOString(), msg: '发起' }] }; saveFlows(fl); audit('flow.start', { domain: d, workflow: w.id }); draw(); } }, '发起流程'));
      if (inst.status === 'running') {
        act.push(h('button', { class: 'btn p', onclick: () => { inst.step++; if (inst.step > w.nodes.length) { inst.status = 'done'; } inst.log.push({ ts: new Date().toISOString(), msg: '推进 → 第 ' + inst.step + ' 步' }); fl[w.id] = inst; saveFlows(fl); audit('flow.advance', { domain: d, workflow: w.id, step: inst.step, status: inst.status }); draw(); } }, '通过 / 推进'));
        act.push(rejectReason, h('button', { class: 'btn', onclick: () => { if (!rejectReason.value.trim()) { alert('驳回必须填写原因'); return; } inst.status = 'rejected'; inst.log.push({ ts: new Date().toISOString(), msg: '驳回：' + rejectReason.value }); fl[w.id] = inst; saveFlows(fl); audit('flow.reject', { domain: d, workflow: w.id, reason: rejectReason.value }); draw(); } }, '驳回'));
        act.push(h('button', { class: 'btn', onclick: () => { inst.status = 'cancelled'; fl[w.id] = inst; saveFlows(fl); audit('flow.cancel', { domain: d, workflow: w.id }); draw(); } }, '取消'));
      }
      box.replaceChildren(
        h('div', { class: 'card' }, h('h3', null, w.description + '  '), statusTag,
          h('div', { style: 'margin:12px 0' }, steps),
          h('div', { class: 'toolbar' }, ...act),
          h('div', { class: 'muted' }, '工作流 ' + w.id + ' ｜ kind=' + w.kind + ' ｜ 技能 ' + w.skill + (w.approval ? ` ｜ 审批节点 ${w.approval.node} (${w.approval.level}${w.approval.dual ? ' + 双审批' : ''})` : ' ｜ 无审批节点'))),
        h('div', { class: 'grid k2' },
          card('交付规范', h('dl', { class: 'kv' },
            h('dt', null, '产物文件'), h('dd', null, w.deliverable.file),
            h('dt', null, '格式'), h('dd', null, w.deliverable.format),
            h('dt', null, '必填字段'), h('dd', null, w.deliverable.fields.join('、')),
            h('dt', null, '验收标准'), h('dd', null, w.deliverable.acceptance))),
          card('实例日志', inst.log && inst.log.length
            ? h('div', { class: 'audit' }, ...inst.log.slice().reverse().map((l) => h('div', null, l.ts + '  ' + l.msg)))
            : h('div', { class: 'muted' }, '尚未发起'))),
        card('节点链（来自 index.json，未合成）', h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', null, h('tr', null, h('th', null, '节点'), h('th', null, '类型'), h('th', null, '引用'), h('th', null, '说明'))),
          h('tbody', null, ...w.nodes.map((n) => h('tr', null, h('td', null, n.id), h('td', null, NLABEL[n.type] || n.type),
            h('td', null, n.ref || '—'), h('td', null, n.record || n.expr || (n.dual ? 'dual=true' : '') || '—')))))))
      );
    };
    draw();
    return box;
  }

  // ———— 页：域设置 ————
  function pageSettings(d) {
    const m = MODELS[d];
    const data = dataOf(d);
    return h('div', { class: 'wrap' },
      card('权限与策略', h('dl', { class: 'kv' },
        h('dt', null, '最低数据级别'), h('dd', null, m.level || '—'),
        h('dt', null, '双审批'), h('dd', null, m.dual_approval ? '是' : '否'),
        h('dt', null, '脱敏字段（redact_gate）'), h('dd', null, (m.redact_fields || []).join('、') || '—'),
        h('dt', null, '记忆层'), h('dd', null, JSON.stringify(m.memory || {})))),
      card('技能', h('div', null, ...m.skills.map((s) => h('div', { style: 'padding:4px 0' }, h('b', null, s.name), ' ', h('span', { class: 'muted' }, s.file || '（技能文件缺失）'))))),
      card('数据管理', h('div', { class: 'toolbar' },
        h('button', { class: 'btn', onclick: () => { if (confirm('重置本域数据为种子？')) { localStorage.removeItem(K_DATA(d)); audit('domain.reset', { domain: d }); render(); } } }, '重置本域数据'),
        h('button', { class: 'btn', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(dataOf(d), null, 1)], { type: 'application/json' })), download: d + '.json' }); document.body.append(a); a.click(); a.remove(); audit('domain.export', { domain: d }); } }, '导出本域 JSON'))),
      card('校验规则（§9，域定义原文）', modelTable(m.sections['9'])));
  }

  // ———— 页：审计 / 交付物 ————
  function pageAudit() {
    const a = read(K_AUDIT, []);
    return h('div', { class: 'wrap' }, card('审计事件流（本地 append-only，近 800 条）',
      a.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, '时间'), h('th', null, '动作'), h('th', null, '明细'))),
        h('tbody', null, ...a.slice(0, 300).map((e) => h('tr', null, h('td', null, e.ts), h('td', null, e.action), h('td', { class: 'audit' }, JSON.stringify(Object.assign({}, e, { ts: undefined, action: undefined }))))))))
        : h('div', { class: 'empty' }, '暂无审计事件；在台账或流程页操作后会在此留痕')));
  }
  function pageDelivs() {
    const rows = [];
    for (const d of ORDER) for (const w of MODELS[d].workflows) {
      rows.push(h('tr', null,
        h('td', null, MODELS[d].label), h('td', null, w.id), h('td', null, w.deliverable.file),
        h('td', null, w.deliverable.fields.join('、')), h('td', null, w.deliverable.acceptance)));
    }
    const table = h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, '域'), h('th', null, '工作流'), h('th', null, '产物'), h('th', null, '必填字段'), h('th', null, '验收标准'))),
      h('tbody', null, ...rows));
    return h('div', { class: 'wrap' },
      card('本域交付规范一览（来自 78 条工作流）', h('div', { class: 'tbl-wrap' }, table)),
      deliveryCenter(null));
  }

  // ———— 渲染 ————
  // ———— 页：自定义工作台 ————
  const DRAFT_STATUS = { draft: '草稿', verified: '校验通过', 'preview-ready': '预览就绪', exported: '已导出合入包', consolidated: '已固化' };
  function pageCustom() {
    const note = h('div', { class: 'muted' }, LIVE ? '读取草稿…' : '离线模式（file://）：草稿管理需在桌面应用的「自定义工作台」里操作；本页为流程说明。');
    const listBox = h('div');
    const kindSel = h('select', { class: 'btn sm' },
      h('option', { value: 'revise' }, '修订现有工作域'), h('option', { value: 'new-domain' }, '新增自定义域'));
    const domSel = h('select', { class: 'btn sm' }, ...ORDER.map((d) => h('option', { value: d }, MODELS[d].label)));
    const newDomain = h('input', { placeholder: '新域 id（小写字母/数字/连字符）', style: 'width:240px' });
    const title = h('input', { placeholder: '标题', style: 'width:240px' });
    const req = h('textarea', { rows: 3, placeholder: '需求原文：服务谁、什么场景、核心流程', style: 'width:100%' });
    const domField = h('div', { class: 'field' }, h('label', null, '目标域'), domSel);
    const newField = h('div', { class: 'field' }, h('label', null, '新域 id'), newDomain);
    let kindState = 'revise';
    const syncKind = () => {
      domField.style.display = kindState === 'revise' ? '' : 'none';
      newField.style.display = kindState === 'revise' ? 'none' : '';
    };
    syncKind();
    kindSel.addEventListener('change', (e) => { kindState = e.target.value; });
    const refresh = async () => {
      if (!LIVE) { listBox.replaceChildren(h('div', { class: 'empty' }, '离线模式：打开桌面应用后可用。')); return; }
      try {
        const data = await api('/workbench/api/custom/drafts');
        const drafts = data.drafts || [];
        note.textContent = drafts.length ? `共 ${drafts.length} 个草稿（规范：${data.guide_path}）` : '尚无草稿：按下面三步创建第一个草稿。';
        listBox.replaceChildren(...drafts.map((draft) => {
          const verify = draft.verify;
          const target = draft.kind === 'new-domain' ? draft.newDomain : draft.targetDomain;
          const act = async (path, label) => {
            try {
              const r = await api(path, { method: 'POST', body: JSON.stringify({ id: draft.id }) });
              note.textContent = `${label}：${r.ok === false ? '未通过' : '完成'}`;
              await refresh();
            } catch (e) { note.textContent = `${label}失败：${e.message}`; }
          };
          return h('section', { class: 'card' },
            h('h3', null, draft.title || draft.id),
            h('div', { class: 'toolbar' },
              h('span', { class: 'tag p' }, draft.kind === 'new-domain' ? '新增域' : '修订'),
              h('span', { class: 'tag' }, String(target || '')),
              h('span', { class: 'tag ok' }, DRAFT_STATUS[draft.status] || draft.status),
              draft.verify_running ? h('span', { class: 'tag warn' }, '完整门禁运行中…') : null),
            h('div', { class: 'muted', style: 'margin:6px 0' }, (draft.requirements || '（未填写需求原文）').slice(0, 200)),
            verify ? h('div', { class: 'muted', style: 'font-size:.86em' },
              `域级：${verify.ok ? '通过' : '未通过'} ｜ 基线：${verify.baseline_status} ｜ 完整门禁：${verify.heavy_status}`,
              verify.gaps && verify.gaps.length ? h('div', { style: 'color:#b54708' }, '缺口：' + verify.gaps.slice(0, 3).join('；')) : null) : null,
            h('div', { class: 'toolbar', style: 'margin-top:8px' },
              h('button', { class: 'btn sm', onclick: async () => { const ok = await copyToClipboard(draft.instruction); note.textContent = ok ? '定制指令已复制' : '复制失败'; } }, '复制指令'),
              h('button', { class: 'btn sm p', onclick: () => act('/workbench/api/custom/verify', '校验') }, '运行校验'),
              h('button', { class: 'btn sm', onclick: () => act('/workbench/api/custom/verify-heavy', '完整门禁（后台）') }, '完整门禁（后台）'),
              h('button', { class: 'btn sm', onclick: () => act('/workbench/api/custom/preview-build', '构建预览') }, '构建预览'),
              draft.preview_available ? h('button', { class: 'btn sm', onclick: () => window.open('/workbench/api/app-page?draft=' + encodeURIComponent(draft.id), '_blank') }, '打开预览 ↗') : null,
              h('button', { class: 'btn sm', onclick: () => act('/workbench/api/custom/consolidate', '导出合入包') }, '导出合入包')));
        }));
      } catch (e) {
        note.textContent = '草稿接口不可用：' + e.message;
        listBox.replaceChildren(h('div', { class: 'empty' }, '请在桌面应用内打开本页。'));
      }
    };
    const create = async () => {
      try {
        await api('/workbench/api/custom/draft-create', {
          method: 'POST',
          body: JSON.stringify({ kind: kindState, targetDomain: domSel.value, newDomain: newDomain.value, title: title.value, requirements: req.value }),
        });
        note.textContent = '草稿已创建：先「复制指令」交给 Agent，回来再「运行校验」。';
        await refresh();
      } catch (e) { note.textContent = '创建失败：' + e.message; }
    };
    queueMicrotask(refresh);
    return h('div', { class: 'wrap' },
      h('h1', { style: 'font-size:24px;margin:0 0 4px;color:var(--head)' }, '自定义工作台'),
      h('div', { class: 'muted', style: 'margin-bottom:12px' }, '与 13 域工作台分开管理：草稿可校验与预览，正式生效必须过门禁并重打包。'),
      card('第一步 · 新建草稿',
        h('div', { class: 'grid k3' },
          h('div', { class: 'field' }, h('label', null, '类型'), kindSel), domField, newField),
        h('div', { class: 'field' }, h('label', null, '标题'), title),
        h('div', { class: 'field' }, h('label', null, '需求原文'), req),
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn p', onclick: create }, '创建草稿'),
          h('a', { class: 'btn sm', href: '/workbench/api/custom/development-guide', target: '_blank' }, '打开定制规范'))),
      card('第二步 · 草稿与状态', note, listBox));
  }

  // ———— 页：升级与兼容 ————
  function pageUpgrade() {
    const box = h('div', { class: 'wrap' });
    const draw = (data) => {
      const engine = data.engine || {};
      const compat = data.compatibility || {};
      const corridor = (data.corridor && data.corridor.references) || [];
      box.replaceChildren(
        h('h1', { style: 'font-size:24px;margin:0 0 4px;color:var(--head)' }, '升级与兼容'),
        h('div', { class: 'muted', style: 'margin-bottom:12px' }, '只读中心：版本基线、兼容豁免、升级证据与走廊覆盖；不提供在线升级执行。'),
        h('div', { class: 'grid k4' },
          kpi('DSH 引擎', engine.dsh || '—'), kpi('runtime 依赖', engine.dependency_count == null ? '—' : engine.dependency_count),
          kpi('精确豁免', compat.exempt_packages == null ? '—' : compat.exempt_packages), kpi('引擎工件', (engine.tarballs || []).length)),
        card('升证审计证据', h('div', { class: 'muted' }, (data.evidence && data.evidence.adrs || []).join('、') || '—'),
          h('div', { class: 'tbl-wrap', style: 'margin-top:8px' }, h('table', { class: 'tbl' },
            h('thead', null, h('tr', null, h('th', null, '证据文件'), h('th', null, '字节'))),
            h('tbody', null, ...((data.evidence && data.evidence.files) || []).slice(0, 12).map((item) => h('tr', null, h('td', null, item.file), h('td', null, String(item.bytes)))))))),
        card('走廊覆盖（vendor 技能 vs 当前版本）', corridor.length
          ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
            h('thead', null, h('tr', null, h('th', null, '边'), h('th', null, 'from'), h('th', null, 'to'), h('th', null, '状态'), h('th', null, '卡片数'))),
            h('tbody', null, ...corridor.map((item) => h('tr', null, h('td', null, item.file), h('td', null, item.from), h('td', null, item.to), h('td', null, item.status), h('td', null, String(item.cardCount)))))))
          : h('div', { class: 'muted' }, '走廊数据不可用（需 tools/dsh-upgrade-skill）。')),
        card('工具版本', h('pre', { style: 'max-height:200px;overflow:auto;background:var(--panel);padding:8px;border-radius:8px' }, (data.tools_versions || '—').slice(0, 1500))));
    };
    if (LIVE) {
      api('/workbench/api/upgrade-status').then(draw).catch(() => draw(UPGRADE_SNAPSHOT || { note: 'upgrade-status 不可用' }));
    } else {
      draw(UPGRADE_SNAPSHOT || { note: '离线快照不可用' });
    }
    return box;
  }

  // ———— 页：集成中心 ————
  const ADOPTION_TONE = { adopted: 'ok', 'in-progress': 'p', planned: 'warn', 'not-adopted': 'bad' };
  // ———— 页：工作台市场（dev9：已安装管理 / 样例 / 数据源 / 关于）————
  function pageMarket() {
    const box = h('div', { class: 'wrap' });
    const note = h('div', { class: 'muted' }, LIVE ? '读取工作台市场…' : '离线模式（file://）：安装/卸载需在桌面应用内操作；下方为来源说明。');
    const sections = h('div');
    const act = async (path, body, label) => {
      try {
        await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
        note.textContent = `${label}：完成`;
        await draw();
      } catch (error) {
        note.textContent = `${label}失败：${error.message}`;
      }
    };
    const draw = async () => {
      let catalog = { catalog: { categories: [], workbenches: [] } };
      let installed = [];
      let datasources = { sources: [] };
      let integration = INTEGRATION;
      let updates = { records: [] };
      let wbState = { favorites: [], enabled: true, added: [] };
      if (LIVE) {
        try {
          const [nextCatalog, nextInstalled, nextSources, nextIntegration, nextUpdates, nextState] = await Promise.all([
            api('/workbench/api/custom/catalog'),
            api('/workbench/api/custom/installed'),
            api('/workbench/api/datasources'),
            api('/workbench/api/integration-status').catch(() => INTEGRATION),
            api('/workbench/api/custom/check-updates').catch(() => ({ records: [] })),
            api('/workbench/api/custom/state').catch(() => null),
          ]);
          catalog = nextCatalog;
          installed = nextInstalled.installed || [];
          datasources = nextSources;
          integration = nextIntegration;
          updates = nextUpdates || { records: [] };
          wbState = (nextState && nextState.state) || wbState;
          const entries = ((nextCatalog.catalog && nextCatalog.catalog.workbenches) || []);
          note.textContent = `目录 ${entries.length} 个条目；已安装 ${installed.length} 个；${(updates.records || []).filter((item) => item.status === 'update-available').length} 个可更新。`;
        } catch (error) {
          note.textContent = '市场接口不可用：' + error.message;
        }
      }
      const entries = ((catalog.catalog && catalog.catalog.workbenches) || []);
      const installedByCatalog = new Map(installed.map((item) => [item.catalog_id || ('pids:' + item.id), item]));
      const updateById = new Map((updates.records || []).map((item) => [item.identity, item]));
      const favorites = new Set(wbState.favorites || []);
      const toggleFavorite = async (entry) => {
        try {
          const current = await api('/workbench/api/custom/state');
          const next = new Set(favorites);
          if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id);
          await api('/workbench/api/custom/state', { method: 'POST', body: JSON.stringify({ revision: current.revision, state: { ...current.state, favorites: [...next] } }) });
          await draw();
        } catch (error) { note.textContent = '收藏失败：' + error.message; }
      };
      sections.replaceChildren(
        card('已安装工作台', installed.length
          ? h('div', null, ...installed.map((item) => h('div', { class: 'toolbar' },
            h('b', null, item.title || item.name || item.label || item.id),
            h('span', { class: 'tag p' }, 'v' + (item.version || '—')),
            h('span', { class: 'tag ' + (item.status === 'installed' ? 'ok' : '') }, item.status === 'installed' ? '已启用' : '已停用'),
            h('span', { class: 'tag p' }, item.kind === 'revision' ? '修订内置域' : '自定义域'),
            item.kind === 'revision' ? h('button', { class: 'btn sm', onclick: () => go('#/' + item.id) }, '打开域页面') : null,
            h('button', { class: 'btn sm', onclick: () => act('/workbench/api/custom/market-uninstall', { id: item.catalog_id || ('pids:' + item.id) }, '卸载') }, '卸载'))))
          : h('div', { class: 'empty' }, '尚未安装工作台。'),
          h('div', { class: 'muted', style: 'font-size:.85em' }, '本地工作台的完整页面在桌面壳左侧边栏的「⧉ 名称」入口打开（含工作流向导/审批/交付）。')),
        card('工作台市场（目录 v2）', entries.length
          ? h('div', { class: 'grid k2' }, ...entries.map((entry) => {
            const shot = (entry.screenshots || [])[0];
            const imgUrl = shot && shot.url ? shot.url : ('/workbench/api/custom/catalog/asset?id=' + encodeURIComponent(entry.id) + '&file=' + encodeURIComponent((shot && shot.file) || ''));
            const installedEntry = installedByCatalog.get(entry.id);
            const record = updateById.get(entry.id);
            return h('div', { class: 'card', style: 'margin:0' },
              shot ? h('img', { src: imgUrl, alt: shot.alt || entry.name, style: 'width:100%;height:120px;object-fit:cover;border-radius:8px' }) : null,
              h('h3', null, entry.name, ' ', h('span', { class: 'tag' }, 'v' + entry.version)),
              h('div', { class: 'muted' }, (entry.description && entry.description.zh) || ''),
              h('div', { class: 'toolbar', style: 'margin-top:8px' },
                h('span', { class: 'tag p' }, entry.category),
                installedEntry ? h('span', { class: 'tag ok' }, '已安装') : null,
                record && record.status === 'update-available' ? h('span', { class: 'tag warn' }, '可更新 → ' + record.latest) : null,
                h('button', { class: 'btn sm', title: favorites.has(entry.id) ? '取消收藏' : '收藏工作台', onclick: () => toggleFavorite(entry) }, favorites.has(entry.id) ? '★' : '☆'),
                LIVE && !installedEntry && entry.distribution && entry.distribution.type === 'pids-runtime'
                  ? h('button', { class: 'btn sm p', onclick: () => act('/workbench/api/custom/market-install', { id: entry.id }, '安装') }, '安装')
                  : null));
          }))
          : h('div', { class: 'muted' }, '目录为空（manifests/workbench-catalog.json 或 workspace/config/market-sources.json）。'),
          h('div', { class: 'muted', style: 'font-size:.85em' }, '远程目录源与联网安装默认关闭；插件式工作台（.tgz）在桌面应用内安装并重启生效。')),
        card('数据源（只读外部源骨架）', ((datasources.sources) || []).length
          ? h('div', null, ...datasources.sources.map((source) => h('div', { class: 'toolbar' },
            h('b', null, source.id), h('span', { class: 'tag' }, source.type),
            h('span', { class: 'muted' }, `${source.domain || '—'}/${source.table || '—'}`),
            h('span', { class: 'tag' }, source.supported ? (source.enabled ? '可刷新' : '已登记·未启用') : 'not-implemented'))))
          : h('div', { class: 'muted' }, '未登记数据源；配置 workspace/config/datasources.json（凭据只引用环境变量名）。')),
        card('关于 / 来源追溯', h('div', null, ...((integration.projects) || []).map((project) => h('div', { style: 'padding:4px 0' },
          h('a', { href: project.url, target: '_blank', rel: 'noreferrer' }, project.name),
          h('span', { class: 'muted' }, ' · ' + (project.license || '—')))))));
    };
    queueMicrotask(draw);
    return h('div', { class: 'wrap' },
      h('h1', { style: 'font-size:24px;margin:0 0 4px;color:var(--head)' }, '工作台市场'),
      h('div', { class: 'muted', style: 'margin-bottom:12px' }, '本地目录为主（离线可用）；安装后工作台立即出现在桌面壳左侧边栏。远程目录源为预留接口（默认关闭）。'),
      note, sections);
  }

  function pageIntegration() {
    const box = h('div', { class: 'wrap' });
    const draw = (data) => {
      const projects = (data.projects || []);
      box.replaceChildren(
        h('h1', { style: 'font-size:24px;margin:0 0 4px;color:var(--head)' }, '集成中心'),
        h('div', { class: 'muted', style: 'margin-bottom:12px' }, '三个参考项目的采纳痕迹：已采纳 / 进行中 / 待办 / 明确不采纳（附原因与证据路径）。'),
        ...projects.map((project) => card(`${project.name} · ${project.kind || ''}`,
          h('div', { class: 'toolbar' }, h('span', { class: 'tag p' }, project.license || '—'), h('a', { href: project.url, target: '_blank', rel: 'noreferrer' }, project.url),
            project.role ? h('span', { class: 'muted' }, project.role) : null),
          h('div', { class: 'tbl-wrap', style: 'margin-top:8px' }, h('table', { class: 'tbl' },
            h('thead', null, h('tr', null, h('th', null, '采纳项'), h('th', null, '状态'), h('th', null, '证据'))),
            h('tbody', null, ...(project.adoptions || []).map((item) => h('tr', null,
              h('td', null, item.item, item.reason ? h('div', { class: 'muted', style: 'font-size:.85em' }, '不采纳原因：' + item.reason) : null),
              h('td', null, h('span', { class: 'tag ' + (ADOPTION_TONE[item.status] || '') }, item.status)),
              h('td', { class: 'muted' }, (item.evidence || []).join('、') || '—')))))),
          h('div', { class: 'muted', style: 'font-size:.85em;margin-top:6px' }, project.attribution || ''))));
    };
    if (LIVE) {
      api('/workbench/api/integration-status').then(draw).catch(() => draw(INTEGRATION));
    } else {
      draw(INTEGRATION);
    }
    return box;
  }

  function render() {
    const r = parse();
    let page, crumb;
    if (r.name === 'dash') { page = pageDash(); crumb = h('span', null, '主驾驶舱'); }
    else if (r.name === 'custom') { page = pageCustom(); crumb = h('span', null, '自定义工作台'); }
    else if (r.name === 'upgrade') { page = pageUpgrade(); crumb = h('span', null, '升级与兼容'); }
    else if (r.name === 'market') { page = pageMarket(); crumb = h('span', null, '工作台市场'); }
    else if (r.name === 'audit') { page = pageAudit(); crumb = h('span', null, '审计事件流'); }
    else if (r.name === 'delivs') { page = pageDelivs(); crumb = h('span', null, '交付物'); }
    else {
      const m = MODELS[r.dom];
      const tail = { overview: '域概览', table: r.table, workflow: r.wf, settings: '域设置' }[r.name];
      crumb = h('span', null, m.label, ' / ', h('b', null, tail || ''));
      page = r.name === 'overview' ? pageOverview(r.dom)
        : r.name === 'table' ? pageTable(r.dom, r.table)
          : r.name === 'workflow' ? pageWorkflow(r.dom, r.wf)
            : pageSettings(r.dom);
    }
    const banner = PREVIEW
      ? h('div', { style: 'background:#fffaeb;border-bottom:1px solid #fedf89;color:#b54708;padding:8px 16px;font-weight:600' },
        `草稿预览（未固化）：${PREVIEW.id || ''} — 预览不代表已生效，正式生效需过门禁并重打包。`)
      : null;
    $('#app').replaceChildren(h('div', { class: 'layout' }, sidebar(r), h('main', { class: 'main' }, banner, topbar(r, crumb), h('div', { class: 'content' }, page))));
  }

  applyUI();
  window.addEventListener('hashchange', render);
  render();
  window.__APP_READY__ = true;   // 供 P4 生成式冒烟探针使用
})();
