---
workflow: general-video
flow: automation
storyboard: no
mode: autonomous
message: "一套自主设计的本地工作区 AI 工作台方案，299 元一套，拿来即用"
aspect: 1080x1920
language: zh-CN
length: ~55s
voice: zh-CN-XiaoxiaoNeural (微软晓晓, edge-tts, rate +8%)
---

## Design spec（无 frame.md/design.md，此节即设计真源）

1. **概念角度**：整个视频发生在一块放大的「本地工作台」暗色界面上——用终端的
   确定感对抗网页工作台的悬浮感；大字排版是唯一主角，图形只做工作台隐喻
   （抽象窗口、路径、清单、光标），绝不出现方案包的真实内容或截图。
2. **配色**（全片恒定）：bg `#0F0E0C`（暖炭黑）· fg `#F5F1E8`（暖白）·
   accent `#FFB020`（琥珀）· muted `#9A938A` · hairline `rgba(255,176,32,.16)`。
   一个强调色；成功态对勾用琥珀 tint（success-check 原语 amber）。
3. **字体**：中文 微软雅黑（本机字体，构建时自动捕获内嵌）标题 700 / 正文 400；
   终端与数据标签 JetBrains Mono（预置）400/700。sans + mono 跨界配对。
   竖屏信息流字号：标题 ≥90px，说明 ≥32px，字幕 46px，mono 标签 ≥24px。
4. **布局骨架**：持久边缘锚点 = 顶部 mono 状态条（左 `~/workspace`，右 `● LOCAL`
   呼吸点）+ 底部字幕区（居中，y≈72%）；焦点元素每幕居中主体；
   背景 = 暖炭黑 + 淡琥珀网格 + 单个呼吸辉光 + 每幕 3–8% 透明度幽灵大字。

## Audio（真实时长为准，audio_meta 由 assets/audio/vo_meta.json + timing.json 提供）

- 旁白：6 段 mp3（s1–s6），逐句词级 WordBoundary 对轴；场景 lead 0.40s / tail 0.60s
  （s4 尾 1.60s，s6 尾 2.90s 长停帧）。总长约 55s。
- 无 BGM（用户未要求；如需可后续用本地引擎补）。

## Frames

### Frame 1 — hook · `kinetic-type-beats`（Adapt）
- status: outline
- src: index.html#frame-1
- beat text（旁白 s1, 7.4s）：刷到过很多网页版的AI工作台？／HTML页面看着热闹，用起来总隔着一层。
- 视觉：抽象浏览器窗口线稿幽灵居中；大字节拍①「网页版 AI 工作台」 slam 入场 +
  ✗ 印章盖压；节拍②「看着热闹」；节拍③「总隔着一层」+ 半透明玻璃板从字前滑过
  （隔层隐喻）。硬切节拍，spring-pop 收。
- motion 引用：kinetic-type-beats 时间码模板 + spring-pop-entrance 规则。

### Frame 2 — product_intro · `comparison-split`（Adapt）
- status: outline
- src: index.html#frame-2
- beat text（旁白 s2, 10.4s）：这套工作台，完全自主设计。／它不是跑在浏览器里的网页，
  而是直接长在你的本地工作区里，跟你的AI工具原生协同。
- 视觉：两卡自左右两翼镜像 3D book-open 入场——左卡「网页工作台」(✗ 浏览器里，
  隔一层)，右卡「工作区工作台」(✓ 本地运行，原生协同)；随后两卡清场，中央
  statement「完全自主设计 · 长在本地工作区」+ mono 路径线 `~/workspace/` 落定。
- motion 引用：comparison-split mirrored tilts + badge pill spring-pop。

### Frame 3 — feature · `agent-progress-theater`（Adapt）
- status: outline
- src: index.html#frame-3
- beat text（旁白 s3, 7.6s）：拿来即用：整套文件放进工作区，按说明执行，
  环境自动就位，几分钟就能开跑。
- 视觉：触发 beat = mono 胶囊 `workbench — setup`；随后清单行依次到达并打勾
  （success-check 原语 amber tint）：①整套文件放进工作区 ②按说明执行
  ③环境自动就位 ④几分钟，开跑（末行高亮 + 辉光收束）。无打字、无光标 UI。
- motion 引用：agent-progress-theater 状态剧场 + success-check 时间线配方。

### Frame 4 — price · `dataviz-countup`（Adapt · 单仪表节拍）
- status: outline
- src: index.html#frame-4
- beat text（旁白 s4, 3.3s）：这样一整套方案，只要299。
- 视觉：mono 小字「一整套 · 自主设计工作台方案」先行，hero 数字 count-up
  ¥0 → ¥299（tabular-nums），落定瞬间琥珀辉光 bloom + 底部划线横扫；
  长尾停帧给足记忆点。
- motion 引用：dataviz-countup count-up ring/number（单仪表变体）+ ambient-glow-bloom。

### Frame 5 — honest note · `titlecard-reveal`（Adapt · 呼吸/静帧节拍）
- status: outline
- src: index.html#frame-5
- beat text（旁白 s5, 11.2s）：当然，也要跟你说实话：每台电脑的环境不同，
  应用场景也不同。拿到手之后，具体的迭代和修订，要结合你自己的情况来完成。
- 视觉：前幕动势后的静场——上滑淡入三行卡：「说句实话」「环境不同 · 场景不同」
  「迭代修订 → 结合你自己的情况」+ mono 脚注 `env → your machine`；
  低动量是这一幕的表达本身，随后完全静止。
- motion 引用：titlecard-reveal slide-up crossfade（单次克制入场）。

### Frame 6 — cta · `prompt-type-submit-generate`（Adapt · install-command 变体）
- status: outline
- src: index.html#frame-6
- beat text（旁白 s6, 5.9s）：想要一套自己的工作台？／评论区扣个工作台，或者直接私信我。
- 视觉：标题「想要一套自己的工作台？」降位；终端胶囊弹入，逐字打出
  `> 评论区扣「工作台」`，回车换行打出 `> 或直接私信我`；方块光标持续闪烁
  （有限次循环）持有至片尾。长停帧。
- motion 引用：prompt-type-submit-generate 终端打字机制（code-typing 逐字显现 +
  匀速光标滑动配方，适配竖屏胶囊）。

## Notes

- 全片硬切衔接（共享恒定背景使切点干净）；字幕轨道独立于场景轨道，逐句替换。
- 保密约束见 BRIEF.md：任何真实方案内容不得出现。
