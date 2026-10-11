// workbench-state.mjs — 工作台状态账本（对齐 dataelement state.json v1 的语义与不变量）
//
// 纪律：
//   ① 单文件 `<workspace>/custom/workbench-state.json`，revision 乐观并发（冲突=409）；
//   ② 写入前全量校验；原子写（临时文件 + rename）；
//   ③ 不变量：置顶⊆已添加；active∈added；既有会话归属不可改不可删（迁移白名单除外）；
//      新绑定必须指向已添加工作台；删除工作台保留笔记/隐藏工作区/收藏；recentSessions 必须归属其工作台。
import fs from 'node:fs';
import path from 'node:path';

export const MAX_STATE_BYTES = 1024 * 1024;

export class StateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'StateError';
    this.status = status;
  }
}
const fail = (message) => { throw new StateError(message); };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,255}$/.test(value)
  && !['__proto__', 'prototype', 'constructor'].includes(value);
// 工作台身份：`owner/repo`（目录）或 `pids:<domain>`（本地/运行时）
export const validWorkbenchId = (value) => typeof value === 'string' && value.length <= 255
  && (/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(value) || /^pids:[a-z][a-z0-9-]{1,63}$/.test(value));

export function emptyState() {
  return {
    version: 1,
    enabled: true,
    added: [],
    pinned: [],
    favorites: [],
    active: null,
    sessionBindings: {},
    recentSessions: {},
    notes: {},
    hiddenWorkspaces: {},
  };
}

export function stateFilePath(workspaceRoot) {
  return path.join(workspaceRoot, 'custom', 'workbench-state.json');
}

export function validateState(value, previous = null, migrations = {}) {
  if (!isObject(value) || value.version !== 1) fail('工作台状态版本不受支持。');
  const allowed = new Set(Object.keys(emptyState()));
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('工作台状态包含未知字段。');
  if (typeof value.enabled !== 'boolean') fail('enabled 必须是布尔值。');
  for (const key of ['added', 'pinned', 'favorites']) {
    const list = value[key];
    if (!Array.isArray(list) || !list.every(validWorkbenchId) || new Set(list).size !== list.length) fail(`${key} 工作台 ID 非法。`);
  }
  if (value.pinned.some((id) => !value.added.includes(id))) fail('置顶的工作台必须先被添加。');
  if (value.active !== null && (!validWorkbenchId(value.active) || !value.added.includes(value.active))) fail('当前工作台必须已被添加。');
  if (!isObject(value.sessionBindings) || !Object.entries(value.sessionBindings).every(([session, owner]) => validId(session) && validWorkbenchId(owner))) fail('sessionBindings 非法。');
  if (!isObject(value.recentSessions) || !Object.entries(value.recentSessions).every(([owner, session]) => validWorkbenchId(owner) && validId(session))) fail('recentSessions 非法。');
  if (!isObject(value.notes) || !Object.entries(value.notes).every(([owner, note]) => validWorkbenchId(owner) && typeof note === 'string' && note.length <= 200000)) fail('notes 非法。');
  if (!isObject(value.hiddenWorkspaces) || !Object.entries(value.hiddenWorkspaces).every(([owner, workspaces]) => validWorkbenchId(owner)
    && Array.isArray(workspaces) && workspaces.every(validId) && new Set(workspaces).size === workspaces.length)) fail('hiddenWorkspaces 非法。');
  for (const [workbench, session] of Object.entries(value.recentSessions)) {
    if (value.sessionBindings[session] !== workbench) fail('最近会话必须属于其工作台。');
  }
  if (previous) {
    for (const [session, owner] of Object.entries(previous.sessionBindings)) {
      if (value.sessionBindings[session] !== owner && value.sessionBindings[session] !== migrations[owner]) {
        fail('已有会话的工作台归属不可更改或移除。');
      }
    }
    for (const [session, owner] of Object.entries(value.sessionBindings)) {
      if (!Object.hasOwn(previous.sessionBindings, session) && !value.added.includes(owner)) fail('新会话绑定必须指向已添加的工作台。');
    }
    for (const id of Object.keys(previous.notes)) {
      if (!Object.hasOwn(value.notes, id) && !Object.hasOwn(value.notes, migrations[id])) fail('移除工作台必须保留其笔记。');
    }
    for (const id of Object.keys(previous.hiddenWorkspaces)) {
      if (!Object.hasOwn(value.hiddenWorkspaces, id) && !Object.hasOwn(value.hiddenWorkspaces, migrations[id])) fail('移除工作台必须保留工作区可见性。');
    }
  }
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_STATE_BYTES - 100) fail('工作台状态过大。');
  return JSON.parse(JSON.stringify(value));
}

export function createStateStore(workspaceRoot) {
  const file = stateFilePath(workspaceRoot);
  let pending = Promise.resolve();
  const queue = (operation) => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
  async function read() {
    let raw;
    try {
      raw = await fs.promises.readFile(file);
    } catch (error) {
      if (error.code === 'ENOENT') return { revision: 0, state: emptyState() };
      throw error;
    }
    try {
      if (raw.length > MAX_STATE_BYTES) throw new Error('File exceeds size limit');
      const saved = JSON.parse(raw.toString('utf8'));
      if (!Number.isSafeInteger(saved.revision) || saved.revision < 0) throw new Error('Invalid revision');
      const state = isObject(saved.state) && saved.state.version === 1 ? saved.state : null;
      if (!state) throw new Error('Missing state');
      return { revision: saved.revision, state: validateState(state) };
    } catch {
      throw new StateError('工作台状态文件不可读或非法。', 500);
    }
  }
  const write = (state, { expectedRevision = null, migrations = {} } = {}) => queue(async () => {
    const current = await read();
    if (expectedRevision !== null && expectedRevision !== current.revision) {
      throw new StateError(`工作台状态已被其他操作修改（revision ${current.revision}）：请刷新后重试。`, 409);
    }
    const next = validateState(state, current.revision > 0 ? current.state : null, migrations);
    const revision = current.revision + 1;
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify({ revision, state: next }, null, 2)}\n`, 'utf8');
    await fs.promises.rename(temporary, file);
    return { revision, state: next };
  });
  const mutate = (change, options = {}) => queue(async () => {
    const current = await read();
    if (options.expectedRevision !== undefined && options.expectedRevision !== null && options.expectedRevision !== current.revision) {
      throw new StateError(`工作台状态已被其他操作修改（revision ${current.revision}）：请刷新后重试。`, 409);
    }
    const draft = JSON.parse(JSON.stringify(current.state));
    change(draft);
    const next = validateState(draft, current.revision > 0 ? current.state : null, options.migrations || {});
    const revision = current.revision + 1;
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify({ revision, state: next }, null, 2)}\n`, 'utf8');
    await fs.promises.rename(temporary, file);
    return { revision, state: next };
  });
  return { file, read, write, mutate };
}
