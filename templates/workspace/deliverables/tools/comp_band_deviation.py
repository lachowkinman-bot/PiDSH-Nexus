#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
薪酬带宽偏离复算脚本（L4 区间口径 L4-IR-1.0）
用法:
  python comp_band_deviation.py \
    --band templates/workspace/data/comp/comp_band_L4.csv \
    --emp  templates/workspace/data/comp/comp_employees.csv \
    --asof 2025-09-30 --k 5 --observe 0.10 --red 0.15 --band-width 0.20 \
    --out  templates/workspace/deliverables/
口径硬编码在此，禁止在报告侧另立口径（避免口径漂移）。
"""
import argparse, hashlib, hmac, os, sys, json
from datetime import datetime, date

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    sys.exit("需要 pandas: pip install pandas")

MONTHS_MIN_TENURE = 3      # 入职满 3 个月
FTE_MIN = 0.6              # 最低 FTE
SALT_ENV = "COMP_DS1_SALT" # 脱敏 salt 由 HRIS 管理员通过环境变量注入，不落盘、不入库
FX_TO_CNY = {"CNY": 1.0, "USD": 7.10, "HKD": 0.91}  # 见报告 §1.2，随报告归档


def emp_code(emp_id: str, salt: str, prefix: str = "EMP") -> str:
    """不可逆代号：HMAC-SHA256(工号, salt) -> 6 位。报告不携带映射表。"""
    d = hmac.new(salt.encode(), str(emp_id).encode(), hashlib.sha256).hexdigest()
    return f"{prefix}-{int(d[:8], 16) % 1_000_000:06d}"


def load_band(path: str, band_width: float) -> pd.DataFrame:
    b = pd.read_csv(path)
    b["level"] = b["level"].astype(str).str.upper()
    b = b[b["level"] == "L4"].copy()
    if "min" not in b or b["min"].isna().any():
        b["min"] = b["mid"] * (1 - band_width)
    if "max" not in b or b["max"].isna().any():
        b["max"] = b["mid"] * (1 + band_width)
    bad = b[(b["min"] >= b["mid"]) | (b["mid"] >= b["max"])]
    if len(bad):
        sys.exit(f"带宽表校验失败(min<mid<max): \n{bad}")
    return b[["org_scope", "currency", "min", "mid", "max", "effective_date"]]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--band", required=True)
    ap.add_argument("--emp", required=True)
    ap.add_argument("--asof", default=date.today().isoformat())
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--observe", type=float, default=0.10)
    ap.add_argument("--red", type=float, default=0.15)
    ap.add_argument("--band-width", type=float, default=0.20)
    ap.add_argument("--out", default=".")
    a = ap.parse_args()

    salt = os.environ.get(SALT_ENV) or sys.exit(f"缺少环境变量 {SALT_ENV}（salt 不入报告）")
    asof = pd.to_datetime(a.asof)

    band = load_band(a.band, a.band_width)
    e = pd.read_csv(a.emp)
    e["level"] = e["level"].astype(str).str.upper()

    # §1.1 纳入/排除
    e["hire_date"] = pd.to_datetime(e["hire_date"])
    e = e[(e["level"] == "L4")
          & (e["status"].isin(["在职", "试用"]))
          & (e["hire_date"] <= asof - pd.DateOffset(months=MONTHS_MIN_TENURE))
          & (e["fte"] >= FTE_MIN)].copy()
    e = e.sort_values("pay_date").drop_duplicates("emp_id", keep="last")  # 主岗/最新记录

    # §1.2 薪酬口径：FTE 折算 + 年化 + 汇率
    e["AFC"] = e["annual_fixed_cash_raw"].astype(float) / e["fte"].astype(float)
    e["AFC"] = e["AFC"] * e["currency"].map(FX_TO_CNY).fillna(1.0)

    e = e.merge(band, on="org_scope", how="left", suffixes=("", "_band"))
    if e["mid"].isna().any():
        sys.exit("部分记录无对应带宽（org_scope 不匹配），请先补带宽表")
    e["AFC"] = e["AFC"] / e["currency_band"].map(FX_TO_CNY).fillna(1.0)

    # §1.4 偏离度
    e["CR"] = e["AFC"] / e["mid"]
    e["PIR"] = (e["AFC"] - e["min"]) / (e["max"] - e["min"])
    e["index"] = (e["CR"] * 100).round(1)

    # §1.5 分带
    def flag(cr):
        if abs(cr - 1) > a.red:
            return "🔴 超上限" if cr > 1 else "🔴 低于下限"
        if abs(cr - 1) > a.observe:
            return "🟡 观察(上)" if cr > 1 else "🟡 观察(下)"
        return "🟢 合规"

    e["band_flag"] = e["CR"].map(flag)
    e.loc[(e["CR"] - 1).abs() > 0.5, "band_flag"] = "⚠️ 数据疑点"  # §1.6

    # §2.1 脱敏
    e["emp_code"] = e["emp_id"].map(lambda x: emp_code(x, salt, "EMP"))
    e["tenure_years"] = ((asof - e["hire_date"]).dt.days / 365.25)
    e["tenure_bin"] = pd.cut(e["tenure_years"], [-1, 1, 3, 5, 99],
                             labels=["0–1", "1–3", "3–5", "5+"]).astype(str)
    detail = e[["emp_code", "dept_l1", "job_family", "tenure_bin",
                "index", "CR", "PIR", "band_flag"]].copy()
    detail["CR"] = detail["CR"].round(3)
    detail["PIR"] = detail["PIR"].round(2)

    # §1.6 k-匿名抑制：单元 <k 并入「其他」
    grp = e.groupby(["dept_l1", "band_flag"], observed=True).size().rename("n").reset_index()
    small = set(grp.loc[grp["n"] < a.k, "dept_l1"])
    summary = grp.copy()
    summary.loc[summary["dept_l1"].isin(small), "dept_l1"] = "其他(含<k部门合并)"
    summary = summary.groupby(["dept_l1", "band_flag"], observed=True)["n"].sum().reset_index()
    if "dept_l1" in summary.columns:
        summary = summary.rename(columns={"dept_l1": "一级部门", "band_flag": "判定", "n": "人数"})

    group_view = (e.groupby("dept_l1", observed=True)
                   .agg(样本数=("emp_code", "size"),
                        CR中位=("CR", "median"),
                        CR_P10=("CR", lambda s: s.quantile(0.10)),
                        CR_P90=("CR", lambda s: s.quantile(0.90)))
                   .reset_index().rename(columns={"dept_l1": "一级部门"}))
    group_view = group_view[group_view["样本数"] >= a.k]  # §1.6
    for c in ["CR中位", "CR_P10", "CR_P90"]:
        group_view[c] = group_view[c].round(2)

    os.makedirs(a.out, exist_ok=True)
    detail.to_csv(os.path.join(a.out, "明细_脱敏.csv"), index=False)
    summary.to_csv(os.path.join(a.out, "汇总_分布.csv"), index=False)
    group_view.to_csv(os.path.join(a.out, "分组_抑制后.csv"), index=False)

    fingerprint = {"asof": a.asof, "band_width": a.band_width, "observe": a.observe,
                   "red": a.red, "k": a.k,
                   "salt_version": hashlib.sha256(salt.encode()).hexdigest()[:12],
                   "rows": int(len(detail))}
    with open(os.path.join(a.out, "口径指纹.json"), "w", encoding="utf-8") as f:
        json.dump(fingerprint, f, ensure_ascii=False, indent=2)

    # 自检
    assert len(detail) == int(summary["人数"].sum()), "明细与汇总人数不一致"
    assert not {"name", "emp_id", "dept_l3", "perf_score"} & set(detail.columns), "存在未脱敏字段"
    print("OK", fingerprint)


if __name__ == "__main__":
    main()
