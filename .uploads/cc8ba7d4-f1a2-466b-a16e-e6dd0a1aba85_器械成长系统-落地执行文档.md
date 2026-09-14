# 器械成长系统（Gear）设计方案

> 本文是
>
> **设计文档**
>
> ：只回答 "系统是什么、为什么这么设计、加在架构哪里"。
> **不含实现代码**
>
> —— 落地时由开发按 
>
> [玩法实现.md](玩法实现.md)
>
> （服务器新增玩法插件）、
> [分层与命令驱动.md](分层与命令驱动.md)
>
> （客户端新增域插件）的既有流程执行。
> 适用工程：
>
> `E:\Projects\Game\ShutterCrisis`
>
> （Client / Server / Tools）
> 关联文档：
>
> [游戏设定.md](游戏设定.md)
>
>  · 
>
> [玩法实现.md](玩法实现.md)
>
>  · 
>
> [框架总览.md](框架总览.md)
>
>  · 
>
> [原型设定-V2.md](原型设定-V2.md)



***

## 一、系统是什么

**器械成长系统（Gear）** 是门店的**具体器械资产经营系统**：



* 老板拥有**具体型号**的相机、镜头、灯光（如 "索尼 A7M4 #1"、"24-70mm f/2.8 #2"），不是抽象等级；

* 可以**购买**新器械、**卖出**旧器械；

* 卖出有**二手折价**（亏损是常态），但**经典款保值、热门款有涨价机会**（赚差价是乐趣）；

* 器械是资产：占用现金、每日折旧、计入门店估值 —— 买多会拖累现金流，买对是成长加速器。



***

## 二、架构定位图（系统加在哪里）



```
\<html style="margin:0;padding:0;">

\<div style="background-color:transparent;box-sizing:border-box;font-family:'Roboto','PingFang SC','Segoe UI',Arial,sans-serif;">

&#x20; \<div style="box-sizing:border-box;padding:16px;border-radius:16px;background:linear-gradient(135deg, rgba(148,212,208,0.08), rgba(148,212,208,0.02));">

&#x20;   \<div style="font-size:16px;font-weight:600;color:#1A1B1C;margin-bottom:12px;">器械成长系统（Gear）在架构中的位置\</div>

&#x20;   \<!-- UI 层 -->

&#x20;   \<div style="display:flex;flex-direction:column;gap:6px;">

&#x20;     \<div style="display:flex;flex-wrap:wrap;gap:8px;">

&#x20;       \<div style="flex:1 1 260px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.08);">

&#x20;         \<div style="font-size:11px;color:#6B7280;font-weight:600;">UI 面板层 · 现有\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">主界面 / 订单 / 员工 / 市场 / 日报面板\</div>

&#x20;       \</div>

&#x20;       \<div style="flex:1 1 240px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg, rgba(148,212,208,0.18), rgba(148,212,208,0.35));border:1px solid rgba(148,212,208,0.6);">

&#x20;         \<div style="font-size:11px;color:#0E6B63;font-weight:600;">＋ 新增：器械库面板\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">我的器械（库存/卖出）｜器械商店（购买）｜价格走势\</div>

&#x20;       \</div>

&#x20;     \</div>

&#x20;     \<!-- 客户端插件层 -->

&#x20;     \<div style="display:flex;flex-wrap:wrap;gap:8px;">

&#x20;       \<div style="flex:1 1 260px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.08);">

&#x20;         \<div style="font-size:11px;color:#6B7280;font-weight:600;">客户端玩法插件层 · 现有\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">Studio / Orders / Staff / Market / Incidents 五域\</div>

&#x20;       \</div>

&#x20;       \<div style="flex:1 1 240px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg, rgba(148,212,208,0.18), rgba(148,212,208,0.35));border:1px solid rgba(148,212,208,0.6);">

&#x20;         \<div style="font-size:11px;color:#0E6B63;font-weight:600;">＋ 新增：Gear 域插件\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">只读快照投影 + buyGear / sellGear 行动入口\</div>

&#x20;       \</div>

&#x20;     \</div>

&#x20;     \<!-- 服务器插件层（核心） -->

&#x20;     \<div style="display:flex;flex-wrap:wrap;gap:8px;">

&#x20;       \<div style="flex:1 1 260px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.08);">

&#x20;         \<div style="font-size:11px;color:#6B7280;font-weight:600;">服务器玩法插件层 · 现有\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">studio / orders / staff / market / incidents / random\_events\</div>

&#x20;       \</div>

&#x20;       \<div style="flex:1 1 240px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg, rgba(148,212,208,0.22), rgba(148,212,208,0.4));border:1.5px solid #0E6B63;">

&#x20;         \<div style="font-size:11px;color:#0E6B63;font-weight:600;">★ 新增：gear.py 插件（挂这里）\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">购买判定 ｜ 卖出定价 ｜ 每日价格波动 ｜ 折旧 —— 全部服务器权威\</div>

&#x20;       \</div>

&#x20;     \</div>

&#x20;     \<!-- 共享状态契约 -->

&#x20;     \<div style="display:flex;flex-wrap:wrap;gap:8px;">

&#x20;       \<div style="flex:1 1 260px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.08);">

&#x20;         \<div style="font-size:11px;color:#6B7280;font-weight:600;">共享状态契约 · 现有\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">\_studio.py 定义现金/口碑/粉丝/订单等全部状态键\</div>

&#x20;       \</div>

&#x20;       \<div style="flex:1 1 240px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg, rgba(148,212,208,0.18), rgba(148,212,208,0.35));border:1px solid rgba(148,212,208,0.6);">

&#x20;         \<div style="font-size:11px;color:#0E6B63;font-weight:600;">＋ 新增：State\["Gear"] 顶层键\</div>

&#x20;         \<div style="font-size:12.5px;color:#1A1B1C;margin-top:3px;line-height:1.5;">器械实例列表 + 市场价 + 价格历史 + 跨域查询（折旧/市值/最高档）\</div>

&#x20;       \</div>

&#x20;     \</div>

&#x20;   \</div>

&#x20;   \<!-- 接入点 -->

&#x20;   \<div style="font-size:13px;font-weight:600;color:#1A1B1C;margin:16px 0 8px;">只接三个既有系统的口子（P0 必须）\</div>

&#x20;   \<div style="display:flex;flex-wrap:wrap;gap:8px;">

&#x20;     \<div style="flex:1 1 200px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);">

&#x20;       \<div style="font-size:12.5px;font-weight:600;color:#1A1B1C;">① 每日现金流结算\</div>

&#x20;       \<div style="font-size:12px;color:#6B7280;margin-top:3px;line-height:1.5;">器械折旧（买入价总和 ×0.003/天）计入固定支出\</div>

&#x20;     \</div>

&#x20;     \<div style="flex:1 1 200px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);">

&#x20;       \<div style="font-size:12.5px;font-weight:600;color:#1A1B1C;">② 门店估值\</div>

&#x20;       \<div style="font-size:12px;color:#6B7280;margin-top:3px;line-height:1.5;">器械当前市值 ×0.7 计入 storeValue（店铺升星用）\</div>

&#x20;     \</div>

&#x20;     \<div style="flex:1 1 200px;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;background:#FFFFFF;border:1px solid rgba(0,0,0,0.08);">

&#x20;       \<div style="font-size:12.5px;font-weight:600;color:#1A1B1C;">③ 目录下发\</div>

&#x20;       \<div style="font-size:12px;color:#6B7280;margin-top:3px;line-height:1.5;">/api/catalog 新增 gear\_camera / gear\_lens / gear\_light 三域\</div>

&#x20;     \</div>

&#x20;   \</div>

&#x20;   \<!-- 不动区 -->

&#x20;   \<div style="box-sizing:border-box;margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(234,166,178,0.10);border:1px solid rgba(234,166,178,0.4);">

&#x20;     \<div style="font-size:12.5px;font-weight:600;color:#8A2B3D;">✕ 不要动：Facilities 设备等级系统（升级 / 降级卖）原样保留\</div>

&#x20;     \<div style="font-size:12px;color:#6B7280;margin-top:3px;line-height:1.5;">它与订单解锁、拍摄评分、店铺天梯深度耦合，动它伤筋动骨。Gear 只做"软联动"：后期用最高档器械给 Facilities 有效等级 +0\~+1，用镜头焦段解锁特定订单。\</div>

&#x20;   \</div>

&#x20;   \<div style="font-size:11px;color:#6B7280;margin-top:10px;line-height:1.5;">示意：架构定位图，非代码结构图。依据《游戏设定.md》《玩法实现.md》《分层与命令驱动.md》绘制。\</div>

&#x20; \</div>

\</div>

\</html>
```



***

## 三、设计决策表（核心）



| #   | 决策点                                   | 选择                                                                                             | 理由（取舍）                                                                               |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D1  | **挂在哪一层**                             | 服务器玩法插件层，新增独立 `gear` 域（服务器 `gameplay/plugins/` 自动发现）；客户端与 UI 各加一个对应口                           | 玩法规则只放玩法层（框架不替你决定经济系统）；插件自动发现，零侵入、不改注册清单                                             |
| D2  | **为什么不塞进现有&#x20;**`studio`**&#x20;域** | 独立成域                                                                                           | `studio` 已管现金流 / 场地 / 定价，器械资产是独立的玩法域；塞进去会让该插件职责失控，违背 "一个域一个插件"                       |
| D3  | **与 Facilities 的关系**                  | **平行并存 + 软联动**，绝不合并、不替换                                                                        | Facilities 是抽象等级，已深度耦合订单解锁 / 拍摄评分 / 店铺天梯；器械是具体资产实例，两者是 "能力底座 vs 资产经营" 两层。合并会同时毁掉两个系统 |
| D4  | **判定权在哪**                             | 服务器权威：买入价、卖出价、价格波动、折旧全部服务器计算                                                                   | 防作弊 + 离线推进可复现（工程红线）；客户端只读快照、只发行动                                                     |
| D5  | **状态存哪**                              | 单局状态新增顶层键 `State["Gear"]`，走 `_studio` 状态契约                                                     | 与 `Facilities` / `Resources` / `Staff` 平级；旧存档经 `EnsureFields` 补默认值，不破坏存档协议           |
| D6  | **初始资产**                              | 2 台索尼 A7M4 + 常用镜头（24-70 / 35 / 85 各双份共 6 支）+ 灯（基础影室灯 ×2 + 柔光箱 ×2），共 14 件；作为开店已有资产**注入，不扣开局现金** | 符合 "开店自带设备" 设定；初始总成本约 11 万是账面资产不是现金；调数值只改一处配置                                        |
| D7  | **购买规则**                              | 按**当前市场价**支付，受店铺等级（星级）解锁限制                                                                     | 价格波动直接影响购买决策；成长阶梯由 "星级解锁" 组织，与店铺天梯一致                                                 |
| D8  | **卖出定价**                              | 卖出价 = 当前市场价 × 保值率 × 使用折旧系数                                                                     | 三个因子各管一件事：市场价管 "涨跌机会"，保值率管 "型号差异"，使用折旧管 "持有越久越不值钱"—— 同时表达 "二手亏损常态" 与 "保值 / 涨价可能"     |
| D9  | **价格波动**                              | 每日确定性随机波动（± 型号波动率，限基准价 50%\~150%）；小概率触发 "缺货涨价 / 新品跳水" 事件                                       | 有保值涨价的机会空间；确定性随机保证存档可复现（本作离线推进的硬约束）                                                  |
| D10 | **折旧**                                | 买入价总和 × 0.003 / 天，计入每日固定支出                                                                     | 器械是资产不是免费资源，压现金流、防 "无脑买买买"；与 Facilities 折旧（0.006）并行，基数不同不重复                          |
| D11 | **UI 入口**                             | 独立 "器械库" 面板，两个 Tab：我的器械（库存 / 卖出 / 盈亏）、器械商店（目录 / 现价 / 购买）                                       | 一屏管完资产，与采购 / 决策类操作并列；卖出确认和盈亏展示放在同一面板，反馈即时可见                                          |
| D12 | **目录下发**                              | `/api/catalog` 新增三域：`gear_camera` / `gear_lens` / `gear_light`                                 | 客户端不硬编码经营数值（工程单一事实源原则），型号 / 价格 / 保值率全走目录                                             |
| D13 | **旧档兼容**                              | 无 `Gear` 字段的旧存档自动补空器械库，不报错                                                                     | 存档协议兼容红线                                                                             |
| D14 | **首版不做**                              | 不替换 Facilities；不做贷款 / 分期、拆机翻新、二手平台拍卖（P2）                                                       | 控制首版范围，先把 "买→卖→波动→折旧" 闭环做扎实                                                          |



***

## 四、器械目录设计

三大类，按 "档次（Tier 1\~5）× 基准价 × 保值率 × 波动率" 组织。核心设计意图：**用保值率区分 "理财产品" 与 "消耗品"，用波动率区分 "热门新品" 与 "经典稳款"**。

### 4.1 相机（9 款）



| 型号（设计用名）       | 档次 | 基准价             | 保值率         | 波动率         | 星级解锁 | 设计意图               |
| -------------- | -- | --------------- | ----------- | ----------- | ---- | ------------------ |
| 索尼 A7M3        | 1  | 8,000           | 0.90        | 0.08        | 1★   | 经典保值款：跌不动，适合长期持有   |
| 索尼 A7M4（默认 ×2） | 2  | 16,000          | 0.85        | 0.12        | 1★   | 主力干活机，价格平稳         |
| 索尼 A7S3        | 3  | 23,000          | 0.80        | 0.15        | 2★   | 视频旗舰：热度高波动大，有涨有跌   |
| 索尼 A7R5        | 3  | 26,000          | 0.78        | 0.15        | 2★   | 高像素款：竞争激烈，贬值偏快     |
| 佳能 R5 / 尼康 Z8  | 3  | 25,000 / 27,000 | 0.82 / 0.80 | 0.14 / 0.15 | 2★   | 竞品同档：给玩家换门选择       |
| 索尼 A1          | 4  | 48,000          | 0.75        | 0.18        | 3★   | 旗舰：买时贵、波动大，赌涨价     |
| 富士 GFX 50S II  | 4  | 35,000          | 0.88        | 0.10        | 3★   | 小众保值：涨得慢但几乎不亏      |
| 哈苏 X2D         | 5  | 55,000          | 0.92        | 0.08        | 4★   | "理财产品"：顶级保值，可作资产配置 |

### 4.2 镜头（8 款，默认 6 支）



| 型号                   | 档次 | 基准价    | 保值率  | 星级解锁 | 焦段定位        |
| -------------------- | -- | ------ | ---- | ---- | ----------- |
| 24-70mm f/2.8（默认 ×2） | 2  | 14,000 | 0.88 | 1★   | 标准干活焦段      |
| 35mm f/1.4（默认 ×2）    | 2  | 11,000 | 0.87 | 1★   | 人文焦段        |
| 85mm f/1.4（默认 ×2）    | 2  | 12,000 | 0.87 | 1★   | 人像焦段        |
| 70-200mm f/2.8       | 3  | 19,000 | 0.86 | 2★   | 长焦（婚纱 / 活动） |
| 16-35mm f/2.8        | 2  | 15,000 | 0.85 | 2★   | 广角（空间 / 商业） |
| 50mm f/1.2           | 3  | 16,000 | 0.84 | 2★   | 顶级标准定焦      |
| 90mm 微距              | 2  | 8,000  | 0.82 | 2★   | 产品 / 微距     |
| 电影定焦套装               | 4  | 60,000 | 0.80 | 3★   | 视频 / 广告商拍   |

### 4.3 灯光（8 款，默认 4 件）



| 型号                | 档次 | 基准价            | 保值率         | 星级解锁 | 定位        |
| ----------------- | -- | -------------- | ----------- | ---- | --------- |
| 基础影室灯 250W（默认 ×2） | 1  | 1,500          | 0.70        | 1★   | 入门消耗品     |
| 柔光箱套装（默认 ×2）      | 1  | 800            | 0.65        | 1★   | 附件，贬值最快   |
| LED 平板灯 / 棒灯套装    | 2  | 3,000 / 2,500  | 0.72 / 0.70 | 1★   | 常亮 / 氛围灯  |
| 专业影室灯 500W        | 2  | 4,000          | 0.75        | 1★   | 主力影室灯     |
| 宝富灯 D2 / 外拍灯      | 3  | 12,000 / 8,000 | 0.82 / 0.78 | 2★   | 高端影室 / 外拍 |
| 外拍电箱套装            | 4  | 25,000         | 0.85        | 3★   | 顶级外拍，保值   |

> 设计口径：灯光整体保值率低于相机（器材市场规律：灯跌得快），相机里哈苏 / 富士 / 经典款高于新品旗舰。



***

## 五、核心规则设计

### 5.1 购买



* 玩家从器械商店选型号 → 按**当日市场价**支付 → 得到一件该型号的器械实例；

* 受店铺星级解锁限制（1★ 只能买入门 / 常用档，4★ 才买得到哈苏）；

* 现金不足拒绝。购买是**资产购置**：扣现金，但**不记入当日经营支出**（不是 "今天花了"）。

### 5.2 卖出



```
卖出价 = 当前市场价 × 保值率 × 使用折旧系数

使用折旧系数 = max(60%, 1 − 持有天数 × 0.3%)   （每天掉 0.3%，持有越久越不值钱，最低六成）
```



* 三个因子组合出的结果：**同一型号，买入当天就卖 ≈ 亏损 30\~40%**（二手折价）；**经典款 + 市场涨价时卖出可盈利**；

* UI 必须显示盈亏（买入价 vs 卖出价），这是 "资产经营" 反馈的核心；

* 卖出是**资产变现**：加现金，但不记入当日经营收入。

### 5.3 每日价格波动



* 每个型号每天在 ± 波动率范围内**确定性随机**波动（由天数 + 型号派生，存档可复现）；

* 价格钳制在基准价 50%\~150% 之间，防止失控；

* **涨价机会**：经典款 / 稀缺款受 "缺货" 事件推高；**跳水风险**：新品受 "降价 / 换代" 事件打压（P1 引入事件，首版先做基础波动）；

* 保留近 14 天价格历史，UI 画走势图。

### 5.4 折旧



* 每日固定支出 += 在库器械买入价总和 × 0.003；

* 与 Facilities 折旧（升级投入 × 0.006）**并行、基数不同、不重复**；

* 设计效果：买一堆闲置器械 = 每天白白流血，逼玩家 "买能用上的" 或 "及时出手"。



***

## 六、与现有系统的边界



| 关系        | 内容                                                                           | 优先级 |
| --------- | ---------------------------------------------------------------------------- | --- |
| **必须接入**  | 每日现金流结算（器械折旧进固定支出）                                                           | P0  |
| **必须接入**  | 门店估值（器械当前市值 ×0.7 计入 storeValue，影响店铺升星）                                       | P0  |
| **必须接入**  | 目录下发（`/api/catalog` 新增三域）                                                    | P0  |
| **不动**    | Facilities 设备等级、`upgradeFacility` / `sellEquipment`（现有降级卖 40% 保留，作为破产防线的一部分） | —   |
| **后期软联动** | 最高档器械 → Facilities 有效等级 +0\~+1（不超过星级上限）                                      | P1  |
| **后期软联动** | 镜头焦段标签 → 解锁特定订单（长焦→婚纱，微距→产品）                                                 | P1  |
| **后期软联动** | 在库相机数量 = 可同时拍摄机位上限                                                           | P1  |
| **后期软联动** | 随机事件：相机被偷 / 二手商高价收 / 新品发布跳水                                                  | P1  |



***

## 七、玩家体验流程（设计目标）



```
第 1 天：器械库看到 2 台索尼 + 6 支镜头 + 4 件灯，市值 ≈ 11 万（账面资产，不心疼）

第 3 天：想接婚纱单 → 缺长焦 → 商店看 70-200mm，现价 18,900（比基准价高）

&#x20;        → 等两天价格回落再买（价格策略第一次起作用）

第 8 天：现金吃紧 → 卖掉闲置的 35mm 一支，显示"亏损 ¥1,240"

&#x20;        → 意识到器械占用现金 + 每天折旧，开始精打细算

第 20 天：哈苏涨价到 60,000（缺货事件）→ 当初低价买入的玩家选择出手，赚差价

&#x20;        → "理财"叙事成立

每晚日报：固定支出里出现"器械折旧 ¥XX"，和房租并列
```

反馈原则：**每次买卖都即时可见盈亏；每天价格波动可见（走势图）；每月折旧可见（日报）**。



***

## 八、验收要点（设计口径）



1. 新档默认 14 件器械（2 相机 + 6 镜头 + 4 灯），不扣开局现金；

2. 买入按当日市场价，星级解锁生效，现金不足拒绝；

3. 卖出显示盈亏：买入当天卖必亏，经典款 + 涨价时可盈利；

4. 推进一天后市场价变化，且同一存档重复推进结果一致（确定性）；

5. 日报固定支出包含器械折旧；

6. 门店估值随器械市值变化；

7. 旧存档（无 Gear 字段）能正常加载，自动补空器械库；

8. 命令驱动可表达买卖（`buyGear` / `sellGear`），UI 与命令同一条路径。