# Preset 设计文档 · 学习运营（cust-learning，自定义域示例）

> 本文件是夹具示例：演示自定义域的 §4/§5/§9 结构，正式域需按业务实际编写。

## 1 数据字典（总表）

### 1.1 字段级数据字典

#### 1.1.1 enrollments.csv（5 行）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| learner_masked | string | 是 | 学员掩码标识 |
| course | string | 是 | 课程名称 |
| status | enum | 是 | enrolled/completed/dropped |
| hours | number | 否 | 完成学时 |
| updated_at | date | 是 | 最近更新时间（YYYY-MM-DD） |

## 4 状态机

### 4.1 enrollments 状态（ENROLL_STATUS）

| 当前 | 事件 | 下一状态 |
|---|---|---|
| enrolled | 完成课程 | completed |
| enrolled | 放弃 | dropped |

## 5 审批链

| 节点 | 角色 | 级别 | 双审批 |
|---|---|---|---|
| 周报归档 | 学习运营 | L2 | 否 |

## 9 校验规则

| 规则 | 说明 | 出处 |
|---|---|---|
| 完成率口径 | 以报名人数为基期；未到期填 pending | §4.1 |
| 掩码 | 仅使用掩码标识，不使用姓名与联系方式 | §1.1 |
