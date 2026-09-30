#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""功能调用验证脚本：用被演练的包 jsonschema 校验采购订单报文。

设计要点（保证跨版本可断言）：
  * 断言口径 = 退出码 + 错误定位路径(path) + 校验关键字(rule)
  * 不依赖任何异常消息文本（消息文本随包版本漂移）
  * 退出码约定：0=报文合法；1=报文非法；2=用法/文件错误
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
    from jsonschema.exceptions import SchemaError
except ImportError:  # 未安装时应显式失败，便于验证卸载效果
    print("IMPORT_ERROR jsonschema 不可用", file=sys.stderr)
    sys.exit(3)


def load_json(path: str) -> object:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="JSON Schema 契约校验")
    parser.add_argument("--schema", required=True, help="schema 文件路径")
    parser.add_argument("--payload", required=True, help="待校验报文路径")
    args = parser.parse_args()

    try:
        schema = load_json(args.schema)
        payload = load_json(args.payload)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"USAGE_ERROR {exc}", file=sys.stderr)
        return 2

    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        print(f"SCHEMA_INVALID {exc.message}", file=sys.stderr)
        return 2

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: [str(p) for p in e.absolute_path])

    if not errors:
        print(f"VALID payload={args.payload} draft=2020-12")
        return 0

    for err in errors:
        path = "/".join(str(p) for p in err.absolute_path) or "<root>"
        print(f"INVALID path={path} rule={err.validator}")
    print(f"INVALID_TOTAL {len(errors)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
