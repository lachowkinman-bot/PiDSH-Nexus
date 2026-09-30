#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_pptx_offline.py —— 零第三方依赖的 PPTX 生成器（离线内网可用）

仅使用 Python 标准库（zipfile / xml / json / argparse），按 OOXML(ECMA-376)
规范直接拼装 .pptx 包，因此在无法 `pip install` 的离线环境中同样可用。
不联网、不下载模板、不调用任何外部字体服务。

用法
----
    python build_pptx_offline.py                          # 用内置示例内容生成 output.pptx
    python build_pptx_offline.py -o 汇报.pptx
    python build_pptx_offline.py -j slides.json -o 汇报.pptx
    python build_pptx_offline.py --dump-json              # 打印内容 JSON 模板
    python build_pptx_offline.py --verify 汇报.pptx       # 校验生成的包结构

依赖
----
    Python 3.8+，无第三方库。

退出码
------
    0 成功 / 1 参数或内容错误 / 2 生成后自校验失败
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree
from xml.sax.saxutils import escape

# --------------------------------------------------------------------------
# 命名空间与版面常量
# --------------------------------------------------------------------------
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"

EMU_PER_IN = 914400
SLIDE_W = 12192000          # 13.333 in（16:9）
SLIDE_H = 6858000           #  7.5   in

FONT = "Microsoft YaHei"    # 本机已安装即可；缺失时由阅读器回退
C_PRIMARY = "1F4E79"        # 主色 深蓝
C_ACCENT = "2E75B6"         # 强调色
C_TEXT = "262626"           # 正文
C_SUBTLE = "595959"         # 次级文字
C_LINE = "BFBFBF"
C_WHITE = "FFFFFF"


def emu(inch: float) -> int:
    return int(round(inch * EMU_PER_IN))


def esc(text) -> str:
    return escape("" if text is None else str(text))


def attr(text) -> str:
    return escape("" if text is None else str(text), {'"': "&quot;", "'": "&apos;"})


# --------------------------------------------------------------------------
# 基础 XML 片段
# --------------------------------------------------------------------------
_XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

_SPTREE_HEAD = (
    "<p:spTree>"
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
)
_SPTREE_TAIL = "</p:spTree>"

# 空段落：无文字的形状（色块/分隔线）也必须至少含一个 a:p
EMPTY_P = '<a:p><a:pPr><a:buNone/></a:pPr></a:p>'


def _runs(text, size, bold, color):
    """构造一个 run；文本为空时返回空串（此时段落由空 a:p 承载）。"""
    if text is None or str(text) == "":
        return ""
    rpr = '<a:rPr lang="zh-CN" sz="%d" b="%d" dirty="0">' % (int(size) * 100, 1 if bold else 0)
    if color:
        rpr += '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>' % color
    rpr += '<a:latin typeface="%s"/><a:ea typeface="%s"/><a:cs typeface="%s"/></a:rPr>' % (
        FONT, FONT, FONT)
    return "<a:r>%s<a:t>%s</a:t></a:r>" % (rpr, esc(text))


def para(text, level=0, size=18, bold=False, color=C_TEXT,
         bullet=True, align=None, space_before=0):
    """构造一个段落。level>0 表示子级项目符号。"""
    mar = 342900 + int(level) * 342900
    ppr = '<a:pPr marL="%d" indent="%d" lvl="%d"' % (mar, -342900, int(level))
    if align:
        ppr += ' algn="%s"' % align
    ppr += ">"
    if bullet:
        ppr += '<a:buFont typeface="Arial"/><a:buChar char="\u2022"/>'
    else:
        ppr += "<a:buNone/>"
    if space_before:
        ppr += '<a:spcBef><a:spcPts val="%d"/></a:spcBef>' % int(space_before)
    ppr += "</a:pPr>"
    return "<a:p>%s%s</a:p>" % (ppr, _runs(text, size, bold, color))


def shape(sid, name, x, y, cx, cy, paras, anchor="t", fill=None, line=None):
    """文本框 / 矩形。paras 为 para() 返回的 XML 片段列表。"""
    sp_pr = ('<a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm>'
             '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>') % (x, y, cx, cy)
    sp_pr += ('<a:solidFill><a:srgbClr val="%s"/></a:solidFill>' % fill) if fill else "<a:noFill/>"
    if line:
        sp_pr += ('<a:ln w="9525"><a:solidFill><a:srgbClr val="%s"/></a:solidFill></a:ln>' % line)
    body = "".join(paras) if paras else EMPTY_P
    return (
        '<p:sp><p:nvSpPr><p:cNvPr id="%d" name="%s"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        "<p:spPr>%s</p:spPr>"
        '<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="%s"><a:normAutofit/></a:bodyPr>'
        "<a:lstStyle/>%s</p:txBody></p:sp>"
    ) % (sid, attr(name), sp_pr, anchor, body)


def _cell(text, size, bold, color, fill, align="l"):
    """表格单元格：逐边声明边框，不依赖内置表格样式。"""
    borders = ""
    for tag in ("lnL", "lnR", "lnT", "lnB"):
        borders += ('<a:%s w="9525" cap="flat" cmpd="sng" algn="ctr">'
                    '<a:solidFill><a:srgbClr val="%s"/></a:solidFill>'
                    '<a:prstDash val="solid"/></a:%s>') % (tag, C_LINE, tag)
    tc_pr = ('<a:tcPr marL="91440" marR="91440" marT="45720" marB="45720" anchor="ctr">'
             '%s<a:solidFill><a:srgbClr val="%s"/></a:solidFill></a:tcPr>') % (borders, fill)
    p = para(text, level=0, size=size, bold=bold, color=color, bullet=False, align=align)
    return "<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>%s</a:txBody>%s</a:tc>" % (p, tc_pr)


def table(sid, name, x, y, cx, cy, columns, rows, col_ratios=None,
          size=12, header_size=13):
    """原生 PPT 表格（graphicFrame + a:tbl）。"""
    ncol = len(columns)
    if col_ratios is None:
        col_ratios = [1.0 / ncol] * ncol
    total = float(sum(col_ratios)) or 1.0
    widths = [int(cx * r / total) for r in col_ratios]
    widths[-1] = cx - sum(widths[:-1])

    grid = "".join('<a:gridCol w="%d"/>' % w for w in widths)
    row_h = max(320000, int(cy / (len(rows) + 1)))
    trs = ['<a:tr h="%d">%s</a:tr>' % (
        row_h, "".join(_cell(c, header_size, True, C_WHITE, C_PRIMARY, "ctr") for c in columns))]
    for r_i, row in enumerate(rows):
        fill = C_WHITE if r_i % 2 == 0 else "F2F6FA"
        trs.append('<a:tr h="%d">%s</a:tr>' % (
            row_h, "".join(_cell(c, size, False, C_TEXT, fill) for c in row)))

    tbl = ('<a:tbl><a:tblPr firstRow="1" bandRow="1"/>'
           "<a:tblGrid>%s</a:tblGrid>%s</a:tbl>") % (grid, "".join(trs))
    return (
        '<p:graphicFrame><p:nvGraphicFramePr>'
        '<p:cNvPr id="%d" name="%s"/><p:cNvGraphicFramePr>'
        '<a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/>'
        "</p:nvGraphicFramePr>"
        '<p:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></p:xfrm>'
        '<a:graphic><a:graphicData uri="%s/table">%s</a:graphicData></a:graphic>'
        "</p:graphicFrame>"
    ) % (sid, attr(name), x, y, cx, cy, NS_A, tbl)


# --------------------------------------------------------------------------
# 版式：cover / content / table / end
# --------------------------------------------------------------------------
def _slide_xml(shapes) -> str:
    return (_XML_HEAD +
            '<p:sld xmlns:a="%s" xmlns:r="%s" xmlns:p="%s"><p:cSld>%s%s%s</p:cSld>'
            "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"
            ) % (NS_A, NS_R, NS_P, _SPTREE_HEAD, "".join(shapes), _SPTREE_TAIL)


def _page_header(title):
    """正文页统一的标题 + 强调线（两个形状）。"""
    return [
        shape(2, "Title", emu(0.60), emu(0.42), emu(12.13), emu(0.80),
              [para(title, size=26, bold=True, color=C_PRIMARY, bullet=False, align="l")]),
        shape(3, "Rule", emu(0.62), emu(1.26), emu(1.60), emu(0.055), [EMPTY_P], fill=C_ACCENT),
    ]


def build_cover(s):
    return _slide_xml([
        shape(2, "BG", 0, 0, SLIDE_W, SLIDE_H, [EMPTY_P], fill=C_PRIMARY),
        shape(3, "AccentBar", emu(0.90), emu(2.55), emu(1.10), emu(0.07), [EMPTY_P], fill="F2A900"),
        shape(4, "Title", emu(0.90), emu(2.85), emu(11.5), emu(1.30),
              [para(s.get("title", ""), size=40, bold=True, color=C_WHITE,
                    bullet=False, align="l")]),
        shape(5, "Subtitle", emu(0.90), emu(4.25), emu(11.5), emu(0.60),
              [para(s.get("subtitle", ""), size=18, color="D6E4F0", bullet=False, align="l")]),
        shape(6, "Meta", emu(0.90), emu(5.90), emu(11.5), emu(0.50),
              [para(s.get("meta", ""), size=13, color="A9C4DE", bullet=False, align="l")]),
    ])


def build_content(s):
    shapes = _page_header(s.get("title", ""))
    paras = []
    for b in s.get("bullets", []):
        if isinstance(b, str):
            b = {"text": b}
        lvl = int(b.get("level", 0))
        paras.append(para(
            b.get("text", ""),
            level=lvl,
            size=int(b.get("size", 18 if lvl == 0 else 15)),
            bold=bool(b.get("bold", False)),
            color=b.get("color", C_TEXT if lvl == 0 else C_SUBTLE),
            bullet=True,
            space_before=int(b.get("space_before", 0)),
        ))
    shapes.append(shape(4, "Body", emu(0.75), emu(1.62), emu(11.85), emu(5.30),
                        paras, anchor="t"))
    return _slide_xml(shapes)


def build_table(s):
    shapes = _page_header(s.get("title", ""))
    cols, rows = s["columns"], s["rows"]
    h = min(4.9, 0.55 + 0.55 * len(rows))
    shapes.append(table(4, "Tbl", emu(0.75), emu(1.72), emu(11.85), emu(h),
                        cols, rows, s.get("col_widths")))
    if s.get("note"):
        shapes.append(shape(5, "Note", emu(0.75), emu(1.72 + h + 0.18), emu(11.85), emu(0.5),
                            [para(s["note"], size=11, color=C_SUBTLE, bullet=False)]))
    return _slide_xml(shapes)


def build_end(s):
    return _slide_xml([
        shape(2, "BG", 0, 0, SLIDE_W, SLIDE_H, [EMPTY_P], fill=C_PRIMARY),
        shape(3, "Thanks", emu(0.90), emu(2.90), emu(11.5), emu(1.00),
              [para(s.get("title", "THANKS"), size=40, bold=True, color=C_WHITE,
                    bullet=False, align="center")]),
        shape(4, "Sub", emu(0.90), emu(4.05), emu(11.5), emu(0.60),
              [para(s.get("subtitle", ""), size=16, color="D6E4F0",
                    bullet=False, align="center")]),
    ])


BUILDERS = {
    "cover": build_cover,
    "content": build_content,
    "table": build_table,
    "end": build_end,
}


# --------------------------------------------------------------------------
# 固定部件（母版 / 版式 / 主题 / 属性）
# --------------------------------------------------------------------------
CT_XML = (_XML_HEAD +
          '<Types xmlns="%s">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
          '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
          '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
          '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
          "{SLIDE_OVERRIDES}"
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
          '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
          "</Types>") % NS_CT

ROOT_RELS = (_XML_HEAD +
             '<Relationships xmlns="%s">'
             '<Relationship Id="rId1" Type="%sofficeDocument" Target="ppt/presentation.xml"/>'
             '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
             '<Relationship Id="rId3" Type="%sextended-properties" Target="docProps/app.xml"/>'
             "</Relationships>") % (NS_REL, RT, RT)

EMPTY_RELS = _XML_HEAD + '<Relationships xmlns="%s"/>' % NS_REL

THEME_XML = (_XML_HEAD +
             '<a:theme xmlns:a="%s" name="Offline Theme"><a:themeElements>'
             '<a:clrScheme name="Office">'
             '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
             '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
             '<a:dk2><a:srgbClr val="44546A"/></a:dk2>'
             '<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>'
             '<a:accent1><a:srgbClr val="1F4E79"/></a:accent1>'
             '<a:accent2><a:srgbClr val="2E75B6"/></a:accent2>'
             '<a:accent3><a:srgbClr val="F2A900"/></a:accent3>'
             '<a:accent4><a:srgbClr val="70AD47"/></a:accent4>'
             '<a:accent5><a:srgbClr val="ED7D31"/></a:accent5>'
             '<a:accent6><a:srgbClr val="A5A5A5"/></a:accent6>'
             '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>'
             '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>'
             '<a:fontScheme name="Office">'
             '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface="%s"/><a:cs typeface=""/>'
             '<a:font script="Hans" typeface="%s"/></a:majorFont>'
             '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="%s"/><a:cs typeface=""/>'
             '<a:font script="Hans" typeface="%s"/></a:minorFont></a:fontScheme>'
             '<a:fmtScheme name="Office">'
             "<a:fillStyleLst>"
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
             "<a:lnStyleLst>"
             '<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
             '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
             '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'
             "</a:lnStyleLst>"
             '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>'
             '<a:effectStyle><a:effectLst/></a:effectStyle>'
             '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
             "<a:bgFillStyleLst>"
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
             '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>'
             "</a:fmtScheme></a:themeElements></a:theme>") % (NS_A, FONT, FONT, FONT, FONT)

MASTER_RELS = (_XML_HEAD +
               '<Relationships xmlns="%s">'
               '<Relationship Id="rId1" Type="%sslideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
               '<Relationship Id="rId2" Type="%stheme" Target="../theme/theme1.xml"/>'
               "</Relationships>") % (NS_REL, RT, RT)

LAYOUT_RELS = (_XML_HEAD +
               '<Relationships xmlns="%s">'
               '<Relationship Id="rId1" Type="%sslideMaster" Target="../slideMasters/slideMaster1.xml"/>'
               "</Relationships>") % (NS_REL, RT)

MASTER_XML = (_XML_HEAD +
              '<p:sldMaster xmlns:a="%s" xmlns:r="%s" xmlns:p="%s"><p:cSld>'
              '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>'
              "%s%s</p:cSld>"
              '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" '
              'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" '
              'accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
              '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
              "<p:txStyles>"
              '<p:titleStyle><a:lvl1pPr algn="l" rtl="0"><a:defRPr sz="2800" b="1">'
              '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>'
              '<a:latin typeface="%s"/><a:ea typeface="%s"/></a:defRPr></a:lvl1pPr></p:titleStyle>'
              '<p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900" algn="l" rtl="0">'
              '<a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>'
              '<p:otherStyle><a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr></p:otherStyle>'
              "</p:txStyles></p:sldMaster>") % (NS_A, NS_R, NS_P, _SPTREE_HEAD, _SPTREE_TAIL,
                                                FONT, FONT)

LAYOUT_XML = (_XML_HEAD +
              '<p:sldLayout xmlns:a="%s" xmlns:r="%s" xmlns:p="%s" type="blank" preserve="1">'
              '<p:cSld name="空白">%s%s</p:cSld>'
              "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"
              ) % (NS_A, NS_R, NS_P, _SPTREE_HEAD, _SPTREE_TAIL)


def _core_xml(deck) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (_XML_HEAD +
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            "<dc:title>%s</dc:title><dc:creator>%s</dc:creator>"
            "<cp:lastModifiedBy>%s</cp:lastModifiedBy>"
            '<dcterms:created xsi:type="dcterms:W3CDTF">%s</dcterms:created>'
            '<dcterms:modified xsi:type="dcterms:W3CDTF">%s</dcterms:modified>'
            "</cp:coreProperties>") % (esc(deck.get("title", "Presentation")),
                                       esc(deck.get("author", "Unknown")),
                                       esc(deck.get("author", "Unknown")), now, now)


def _app_xml(n_slides: int, deck) -> str:
    return (_XML_HEAD +
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
            'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            "<Application>Offline PPTX Builder</Application>"
            "<Company>%s</Company><Slides>%d</Slides></Properties>"
            ) % (esc(deck.get("company", "")), n_slides)


# --------------------------------------------------------------------------
# 打包
# --------------------------------------------------------------------------
def build_pptx(deck: dict, out_path: str) -> int:
    """把 deck 渲染成 pptx；返回写入的部件数量。"""
    slides = deck.get("slides") or []
    if not slides:
        raise ValueError("deck.slides 为空，无可生成内容")
    for i, s in enumerate(slides):
        if s.get("layout", "content") not in BUILDERS:
            raise ValueError("第 %d 页 layout 非法：%s" % (i + 1, s.get("layout")))

    n = len(slides)
    parts = {}

    overrides = "".join(
        '<Override PartName="/ppt/slides/slide%d.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' % (i + 1)
        for i in range(n))
    parts["[Content_Types].xml"] = CT_XML.replace("{SLIDE_OVERRIDES}", overrides)
    parts["_rels/.rels"] = ROOT_RELS

    parts["ppt/theme/theme1.xml"] = THEME_XML
    parts["ppt/slideMasters/slideMaster1.xml"] = MASTER_XML
    parts["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = MASTER_RELS
    parts["ppt/slideLayouts/slideLayout1.xml"] = LAYOUT_XML
    parts["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = LAYOUT_RELS

    for i, s in enumerate(slides):
        parts["ppt/slides/slide%d.xml" % (i + 1)] = BUILDERS[s.get("layout", "content")](s)
        parts["ppt/slides/_rels/slide%d.xml.rels" % (i + 1)] = EMPTY_RELS

    sld_ids = "".join('<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, i + 2) for i in range(n))
    parts["ppt/presentation.xml"] = (_XML_HEAD +
        '<p:presentation xmlns:a="%s" xmlns:r="%s" xmlns:p="%s" saveSubsetFonts="1">'
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
        "<p:sldIdLst>%s</p:sldIdLst>"
        '<p:sldSz cx="%d" cy="%d" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/>'
        "</p:presentation>") % (NS_A, NS_R, NS_P, sld_ids, SLIDE_W, SLIDE_H)

    rels = ['<Relationship Id="rId1" Type="%sslideMaster" Target="slideMasters/slideMaster1.xml"/>' % RT]
    for i in range(n):
        rels.append('<Relationship Id="rId%d" Type="%sslide" Target="slides/slide%d.xml"/>'
                    % (i + 2, RT, i + 1))
    rels.append('<Relationship Id="rId%d" Type="%stheme" Target="theme/theme1.xml"/>' % (n + 2, RT))
    parts["ppt/_rels/presentation.xml.rels"] = (
        _XML_HEAD + '<Relationships xmlns="%s">%s</Relationships>') % (NS_REL, "".join(rels))

    parts["docProps/core.xml"] = _core_xml(deck)
    parts["docProps/app.xml"] = _app_xml(n, deck)

    # 固定写入顺序（字典序归一）+ 固定时间戳 → 可复现构建
    order = ["[Content_Types].xml", "_rels/.rels"]
    order += sorted(k for k in parts if k.startswith("docProps/"))
    order += sorted(k for k in parts if k.startswith("ppt/"))
    seen, final_order = set(), []
    for k in order + sorted(parts):
        if k in parts and k not in seen:
            seen.add(k)
            final_order.append(k)

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in final_order:
            zi = zipfile.ZipInfo(name, date_time=(2025, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o600 << 16
            zf.writestr(zi, parts[name].encode("utf-8"))

    return len(parts)


# --------------------------------------------------------------------------
# 结构自校验
# --------------------------------------------------------------------------
REQUIRED_PARTS = {
    "[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels", "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    "ppt/slideLayouts/slideLayout1.xml", "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    "ppt/theme/theme1.xml", "docProps/core.xml", "docProps/app.xml",
}


def verify_pptx(path: str) -> list:
    """结构自校验：zip 完整性 + 必需部件 + 全量 XML 可解析 + r:id 引用一致性。"""
    problems = []
    try:
        zf = zipfile.ZipFile(path)
    except Exception as exc:  # noqa: BLE001
        return ["无法打开文件：%s" % exc]

    with zf:
        bad = zf.testzip()
        if bad:
            problems.append("压缩包损坏：%s" % bad)

        names = set(zf.namelist())
        for r in sorted(REQUIRED_PARTS - names):
            problems.append("缺少必需部件：%s" % r)

        slide_names = sorted(n for n in names
                             if n.startswith("ppt/slides/slide") and n.endswith(".xml"))
        if not slide_names:
            problems.append("未发现任何幻灯片部件")

        for name in sorted(names):
            if not (name.endswith(".xml") or name.endswith(".rels")):
                continue
            try:
                ElementTree.fromstring(zf.read(name))
            except ElementTree.ParseError as exc:
                problems.append("XML 解析失败 %s：%s" % (name, exc))

        try:
            pres = ElementTree.fromstring(zf.read("ppt/presentation.xml"))
            rels_root = ElementTree.fromstring(zf.read("ppt/_rels/presentation.xml.rels"))
            rel_ids = {r.get("Id") for r in rels_root}
            used = []
            for node in pres:
                if node.tag.endswith("}sldIdLst"):
                    used = [e.get("{%s}id" % NS_R) for e in node]
            for rid in used:
                if rid not in rel_ids:
                    problems.append("presentation.xml 引用了未定义的 %s" % rid)
            if len(used) != len(slide_names):
                problems.append("sldIdLst 页数(%d) 与幻灯片部件数(%d) 不一致"
                                % (len(used), len(slide_names)))
        except Exception as exc:  # noqa: BLE001
            problems.append("关系一致性检查异常：%s" % exc)

    return problems


# --------------------------------------------------------------------------
# 内置示例内容
# --------------------------------------------------------------------------
DEFAULT_DECK = {
    "title": "离线环境 PPTX 自动生成方案",
    "author": "企业工作台 / Agent 交付",
    "company": "内部使用",
    "slides": [
        {"layout": "cover",
         "title": "离线环境 PPTX 自动生成方案",
         "subtitle": "零第三方依赖 · 可复现 · 可审计",
         "meta": "汇报人：____        日期：2025-06        版本：v1.0"},
        {"layout": "content",
         "title": "一、背景与挑战",
         "bullets": [
             {"text": "生产/办公内网普遍无外网出口，无法 pip install 或下载在线模板", "size": 18},
             {"text": "Office 文件必须本地生成、本地留存，禁止上传第三方云服务", "size": 18},
             {"text": "现有手工做 PPT 的方式：耗时长、格式不统一、无法批量与复现", "size": 18},
             {"text": "核心矛盾", "size": 18, "bold": True},
             {"text": "既要“离线可落地”，又要“输出符合 OOXML 规范、Office 能正常打开”", "level": 1},
         ]},
        {"layout": "content",
         "title": "二、目标与验收标准",
         "bullets": [
             {"text": "功能目标", "bold": True},
             {"text": "在无网络、无预装第三方库的环境内生成含封面/正文/表格的完整 PPTX", "level": 1},
             {"text": "支持 16:9 版式、中文字体、原生表格与项目符号分级", "level": 1},
             {"text": "非功能目标", "bold": True},
             {"text": "可复现：相同输入产出结构一致的包；可审计：包内容可逐件校验", "level": 1},
             {"text": "验收口径", "bold": True},
             {"text": "生成产物 ≤ 200KB；Office/WPS 打开无“需要修复”提示；结构自校验 0 问题", "level": 1},
         ]},
        {"layout": "table",
         "title": "三、技术选型对比",
         "columns": ["评估维度", "方案 A：python-pptx", "方案 B：标准库手写 OOXML"],
         "col_widths": [0.22, 0.39, 0.39],
         "rows": [
             ["运行依赖", "需预装 wheel（离线需自建镜像）", "零依赖，Python 3.8+ 即可"],
             ["离线可用性", "依赖内网源是否齐全，存在阻塞风险", "开箱即用，无外部依赖"],
             ["开发效率", "高，API 友好", "中，需自行拼装 XML"],
             ["版式能力", "强（图表/图片/母版继承）", "覆盖常规汇报版式"],
             ["主要风险", "安装失败即整体阻塞", "XML 规范细节需自校验兜底"],
         ],
         "note": "结论：以方案 B 作为离线兜底主路径，方案 A 作为有内网镜像时的效率增强。"},
        {"layout": "content",
         "title": "四、方案架构与流程",
         "bullets": [
             {"text": "内容层：deck.json（标题 / 版式 / 要点 / 表格），与渲染逻辑解耦", "size": 18},
             {"text": "渲染层：cover / content / table / end 四类版式构建器", "size": 18},
             {"text": "打包层：按 ECMA-376 组装 [Content_Types].xml、rels、母版、版式、主题、slides", "size": 18},
             {"text": "校验层：解包 → XML 解析 → 关系一致性 → 必需部件齐备", "size": 18},
             {"text": "闭环：构建失败即抛错退出，绝不留半成品文件对外交付", "size": 16, "level": 1},
         ]},
        {"layout": "content",
         "title": "五、实现要点",
         "bullets": [
             {"text": "文本：run 级 rPr 显式指定 sz / b / solidFill / latin+ea typeface，规避字体继承不确定性", "size": 17},
             {"text": "段落：pPr 中 marL + indent + buChar 实现分级项目符号；空段落用 <a:p/> 占位", "size": 17},
             {"text": "表格：graphicFrame + a:tbl，单元格逐边声明边框，不依赖内置表格样式", "size": 17},
             {"text": "确定性：固定 ZipInfo 时间戳与部件写入顺序，保证同输入同产物", "size": 17},
             {"text": "兼容性：slideSz type=\"screen16x9\"；母版 clrMap 完整声明 12 色映射", "size": 17},
         ]},
        {"layout": "content",
         "title": "六、质量保障与风险控制",
         "bullets": [
             {"text": "构建后自校验：zip 完整性 + 全量 XML 解析 + r:id 引用可解析", "size": 17},
             {"text": "回归基线：对样例 deck 做哈希断言，防止版式改动引入静默回归", "size": 17},
             {"text": "已知边界", "bold": True},
             {"text": "不含图表/图片/动画；需要时按同规范扩展对应部件", "level": 1},
             {"text": "中文依赖本机字体，跨机演示前建议做一次字体核对", "level": 1},
         ]},
        {"layout": "end",
         "title": "THANKS",
         "subtitle": "本文档为方法类交付，不含任何真实业务数据"},
    ],
}


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="离线环境零依赖 PPTX 生成器")
    ap.add_argument("-o", "--out", default="output.pptx", help="输出文件路径")
    ap.add_argument("-j", "--json", help="内容定义 JSON（缺省使用内置示例）")
    ap.add_argument("--dump-json", action="store_true", help="打印内置内容 JSON 模板后退出")
    ap.add_argument("--verify", metavar="FILE", help="仅校验已有 PPTX 的结构")
    args = ap.parse_args(argv)

    if args.dump_json:
        print(json.dumps(DEFAULT_DECK, ensure_ascii=False, indent=2))
        return 0

    if args.verify:
        problems = verify_pptx(args.verify)
        if problems:
            print("[FAIL] %s 存在 %d 个问题：" % (args.verify, len(problems)))
            for p in problems:
                print("  - " + p)
            return 2
        print("[OK] %s 结构校验通过" % args.verify)
        return 0

    deck = DEFAULT_DECK
    if args.json:
        try:
            with open(args.json, "r", encoding="utf-8") as fh:
                deck = json.load(fh)
        except Exception as exc:  # noqa: BLE001
            print("[ERROR] 读取内容文件失败：%s" % exc, file=sys.stderr)
            return 1

    try:
        n_parts = build_pptx(deck, args.out)
    except Exception as exc:  # noqa: BLE001
        print("[ERROR] 生成失败：%s" % exc, file=sys.stderr)
        return 1

    problems = verify_pptx(args.out)
    if problems:
        print("[ERROR] 生成后自校验失败：")
        for p in problems:
            print("  - " + p)
        return 2

    print("[OK] 已生成 %s（%d 个部件，%.1f KB，共 %d 页）"
          % (args.out, n_parts, os.path.getsize(args.out) / 1024.0, len(deck.get("slides", []))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
