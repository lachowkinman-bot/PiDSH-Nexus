# promo-video · 引流宣传片制作工作区（独立文件夹）

本文件夹是「自主设计工作台方案」引流宣传视频的**完整独立制作工作区**。
所有过程文件（工程、音频、快照、依赖）都在本文件夹内，**不改动、不依赖
上级目录的任何方案内容**；整个文件夹可随时删除，不影响源方案包。

> 保密说明：视频与工程中**不包含**任何方案包的具体内容（文档、场景、
> 包名、配置、截图等），仅呈现对外宣传话术。

## 成品

- 渲染输出：`dist/` 下的 MP4（1080×1920 竖屏，约 55 秒，H.264 + AAC）
- 配音：微软晓晓 `zh-CN-XiaoxiaoNeural`（edge-tts 合成，`assets/audio/s1–s6.mp3`）
- 字幕：逐句烧录进画面（词级时间戳对轴，`assets/audio/timing.json`）

## 内容结构（55 秒）

| 时间 | 段落 | 要点 |
|---|---|---|
| 0–8s | 钩子 | 网页版工作台的“隔层感”（划线 ✕ 隐喻） |
| 8–20s | 定位 | 完全自主设计 · 长在本地工作区 · 跟 AI 工具原生协同 |
| 20–28s | 拿来即用 | 文件放进工作区 → 按说明执行 → 环境就位 → 开跑 |
| 28–34s | 价格 | 一整套 ¥299（数字滚动） |
| 34–46s | 诚实提示 | 环境不同、场景不同 → 迭代修订要结合自己的情况 |
| 46–55s | 行动召唤 | 评论区扣「工作台」或直接私信（终端打字动画） |

## 常用命令（在本文件夹内执行）

```bash
npm run dev       # 浏览器实时预览（Studio）
npm run check     # 完整校验（lint / 运行时 / 布局 / 对比度）
npm run render    # 重新渲染 MP4 到 dist/
npx hyperframes snapshot . --at 3.1,31.9   # 抽帧检查
```

## 关键文件

- `BRIEF.md` — 需求真源（卖点、语气、保密约束）
- `STORYBOARD.md` — 分镜与设计规范（配色、字体、每幕蓝图引用）
- `index.html` — 视频构图本体（6 幕 + 字幕轨 + 旁白音轨，绝对时间对轴）
- `assets/audio/` — 旁白 mp3、词级时间戳 `vo_meta.json`、对轴结果 `timing.json`
- `compositions/` — 安装的注册表原语（code-typing、success-check，供改编参考）

## 改台词 / 改价格流程

1. 改 `index.html` 中对应场景文字与台词；
2. 重新合成旁白（edge-tts Python API，注意 7.x 必须显式传 `boundary="WordBoundary"`）：

   ```python
   import edge_tts, asyncio
   async def run():
       c = edge_tts.Communicate("台词", "zh-CN-XiaoxiaoNeural", rate="+8%",
                                boundary="WordBoundary")
       async for ch in c.stream():
           if ch["type"] == "audio": ...
           elif ch["type"] == "WordBoundary": ...  # offset/1e7 = 秒
   asyncio.run(run())
   ```

3. 用词级时间戳把字幕组对轴（对齐逻辑见 `timing.json` 的生成规则：
   场景 lead 0.40s / tail 0.60s，字幕起点=首词 offset，终点=下一组起点）；
4. 更新 `index.html` 中音频与字幕的 `data-start / data-duration`；
5. `npm run check` → `npm run render`。
