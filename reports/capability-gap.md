# capability-gap 能力缺口登记

> 015 §3.5：单包失败→登记本表→判定是否 Chassis 必需→非必需剔除并标 NOT_IMPLEMENTED（附替代方案）。不得中断流水线，不得假成功。

| 包名/能力 | 档 | 失败原因 | 影响要素 | 替代方案 |
|---|---|---|---|---|
| dsh-web | P2 | npm E404（设计如此）；dev 分支 zip 实测 452MB→改 git clone --depth 1 | 要素1 | offline 构建兜底（人工可选，不阻断） |
| cap.ind.*（7 项扩展位） | P2 | 无现成 npm 包 | 按行业 | 企业自建 MCP / 人工导出 / 暂缓 |
| dsh-web | P2 | npm E404（设计如此）；dev 分支 zip 实测 452MB→git clone --depth 1 | 要素1 | git clone https://github.com/zhu1090093659/dsh-web 后本地构建（人工可选） |
| skills-cockpit | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-base | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-manufacturing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-retail | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-healthcare | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-construction | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-internet | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-finance | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-strat | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-mkt | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-sales | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-fin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-rec | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-trn | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-prf | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-comp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-ben | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-admin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-cmp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-er-eap | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-mes-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-his-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-regulatory-filing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-pos-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-gov-formatter | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-lms-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-appsec-scan | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| toolchain-node-git | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-hris | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-mail-calendar | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| dsh-web | P2 | npm E404（设计如此）；dev 分支 zip 实测 452MB→git clone --depth 1 | 要素1 | git clone https://github.com/zhu1090093659/dsh-web 后本地构建（人工可选） |
| skills-cockpit | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-base | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-manufacturing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-retail | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-healthcare | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-construction | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-internet | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-finance | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-strat | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-mkt | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-sales | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-fin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-rec | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-trn | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-prf | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-comp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-ben | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-admin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-cmp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-er-eap | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-mes-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-his-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-regulatory-filing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-pos-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-gov-formatter | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-lms-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-appsec-scan | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| toolchain-node-git | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-hris | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-mail-calendar | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| dsh-web | P2 | npm E404（设计如此）；dev 分支 zip 实测 452MB→git clone --depth 1 | 要素1 | git clone https://github.com/zhu1090093659/dsh-web 后本地构建（人工可选） |
| skills-cockpit | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-base | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-manufacturing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-retail | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-healthcare | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-construction | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-internet | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| industrypack-finance | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-strat | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-mkt | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-sales | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-fin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-rec | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-trn | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-prf | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-comp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-ben | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-admin | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-cmp | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| skills-domain-er-eap | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-mes-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-his-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-regulatory-filing | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-pos-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-gov-formatter | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-lms-readonly | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| slot-appsec-scan | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| toolchain-node-git | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-hris | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
| connector-mail-calendar | P2 | npm view 失败 | 十要素映射待评 | 登记降级 |
