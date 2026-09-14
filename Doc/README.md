# ShutterCrisis 工程文档索引

`ShutterCrisis` 是**《营业！快门危机》**的工程仓库：单机模拟经营（照相馆 · 现金流驱动 · 无限经营 · 无胜利条件），
引擎团结引擎 Tuanjie 1.10.2 / URP 2D + Python 3 服务器。机制层（客户端四层程序集、服务端 HTTP 基座、
玩法插件机制、资源热更、UI 一键生成与机器门禁）与玩法层（现金流 / 订单拍摄 / 员工 / 场地设备 /
争执锐评 / 客服 / AI 冲击）**都已落地**。

> 适用范围：`E:\Projects\Game\ShutterCrisis` 下的 `Client/`、`Server/`、`Tools/` 与本文档目录。  
> 写法约定：所有文件 UTF-8 with BOM；涉及尚未完成的部分用 `⚠ 待验证` 标注。

## 一、各文档分别回答什么

| 文档 | 回答的问题 | 最适合谁先读 |
| :--- | :--- | :--- |
| [`游戏设定.md`](游戏设定.md) ⭐ | **玩法规则基线**：现金流公式、订单类型与排期、定价档位、员工与出错、场地扩张、微操、吵架、锐评、客服、品牌调性、AI 冲击与随机事件、数值框架、本版本实现范围 | 策划 / 所有人 |
| [`玩法实现.md`](玩法实现.md) ⭐ | **规则落在哪段代码里**：服务端插件分工、`_studio` 状态契约、一天怎么走、行动表与目录域清单、客户端插件套路、调参入口、扩展点 | 客户端 + 服务器开发 |
| [`框架总览.md`](框架总览.md) | 三层拓扑是什么、四层程序集如何依赖、服务器怎么分层、资源热更怎么走、一次请求的完整链路是什么 | 所有人 |
| [`分层与命令驱动.md`](分层与命令驱动.md) | 数据层 / 管理层 / 面板层各自能做什么、服务门面与事件总线怎么用、命令驱动怎么保证“UI 能做的命令也能做”、新增插件要改哪些文件 | 客户端开发 |
| [`UI规范与一键生成.md`](UI规范与一键生成.md) | 设计分辨率、UI 四层、PanelManager + BaseMVC 生命周期、`eWindowID` / `ePanelID` 注册、面板落盘为什么只走“一键生成”、字体唯一来源与中文子集、按钮真禁用/真隐藏、弹窗遮罩关闭 | UI / 客户端开发 |
| [`服务器基座.md`](服务器基座.md) | 路由层 / 服务层 / 玩法插件包职责、完整 API 协议表、登录语义、心跳与会话留痕、`GP_*` 环境变量、双存储后端、如何加玩法插件、本地用例、部署与回滚 | 服务器 / 全栈开发 |
| [`新项目落地清单.md`](新项目落地清单.md) | 从零建一个新项目时的可勾选步骤（改名、改地址、改存档键、改服务器、建首批面板、接门禁、合规检查）。**本工程已执行完毕**，留作下一个项目复用 | 项目负责人 |
| [`验证与门禁.md`](验证与门禁.md) | 每条自检命令的原文、期望退出码、失败先看哪里；“改了什么 → 必须跑哪几条”的对照表 | 所有人 / CI 维护者 |
| [`原型调研.md`](原型调研.md) | 仓库外原型设计稿（`E:\Projects\原型设计\模拟经营-照相馆\`）的内容总结、与本仓库现状逐项对照、采纳结论 | 策划 |
| [`原型调研-双点医院.md`](原型调研-双点医院.md) | **主参考游戏**双点医院（Two Point Hospital）：核心玩法三层嵌套循环拆解、**核心功能栈复盘（F1~F7 做对了什么/它自己的问题）**、好评归因（7 条好评点 + 7 条差评教训）、照搬/改造/不搬清单、采集流程复盘与后续补采规则 | 策划 |
| [`原型设定-V2.md`](原型设定-V2.md) ⭐ | **下一版玩法设计提案**：**老板的反馈循环为主循环**（行动 → 即时反馈 → 再行动；买地/装修/招人/升设备/升星级）+ 双点医院式动线（反馈可视化，主参考）+ **员工按成长空间分两类**（普通员工两因子去留；成长型员工共进退：学徒→骨干→大师→合伙人）、一天四幕结构、客人即可视化现金流（留存/传播/周反思会）、店铺等级 1~5★ 五维门槛天梯、设备具象与空间形态升级线（影射命名）、破产防线（卖设备/救命大单）、服务分级与微操收敛、操作流程与体验优化、P0/P1/P2 落地与代码对接清单 | 策划 / 所有人 |
| `README.md` | 文档索引与阅读路径 | 所有人 |

## 二、推荐阅读顺序

### 路径 A：新人第一次接手

1. 本文件 → 了解各文档的分工。
2. [`游戏设定.md`](游戏设定.md) → 先知道这游戏在玩什么。
3. [`框架总览.md`](框架总览.md) → 建立三层拓扑与一次请求链路的全局图。
4. [`分层与命令驱动.md`](分层与命令驱动.md) → 明确客户端三条线：数据层、管理层、面板层。
5. [`玩法实现.md`](玩法实现.md) → 把设定里的规则对应到具体代码。
6. [`服务器基座.md`](服务器基座.md) → 知道接口边界与登录/心跳语义。
7. [`验证与门禁.md`](验证与门禁.md) → 每次改完跑什么。

### 路径 B：新增一个功能

1. [`玩法实现.md`](玩法实现.md) 的“服务端玩法插件”与“客户端玩法插件”两节（照抄 `Studio` / `studio.py`）。
2. [`分层与命令驱动.md`](分层与命令驱动.md) 的“新增一个玩法插件”清单。
3. [`服务器基座.md`](服务器基座.md) 的“如何加一个玩法插件”。
4. [`UI规范与一键生成.md`](UI规范与一键生成.md) 的“新增面板五步”。
5. [`验证与门禁.md`](验证与门禁.md) 的“改了什么 → 必须跑哪几条”。

### 路径 C：上线前

1. [`新项目落地清单.md`](新项目落地清单.md) 的“上线前合规检查”小节。
2. [`服务器基座.md`](服务器基座.md) 的“部署与回滚”。
3. [`验证与门禁.md`](验证与门禁.md) 的全量门禁清单。
4. 确认 `GameConst.ServerUrl`、CDN 根、`PlatformBuildSO` 三处都已切到已备案 HTTPS 域名。

### 路径 D：排障

1. [`验证与门禁.md`](验证与门禁.md) 找到对应症状的检查项。
2. 客户端 UI/面板问题 → [`UI规范与一键生成.md`](UI规范与一键生成.md)。
3. 玩法数值不对 / 行动被拒绝 → [`玩法实现.md`](玩法实现.md) 的字段表与调参入口，再对 [`游戏设定.md`](游戏设定.md)。
4. 请求不通 / 存档版本异常 / 心跳断链 → [`服务器基座.md`](服务器基座.md)。
5. 插件未加载 / 事件重复 / 服务取不到 → [`分层与命令驱动.md`](分层与命令驱动.md)。
6. 资源热更失败 → [`框架总览.md`](框架总览.md) 的资源热更三层与 [`验证与门禁.md`](验证与门禁.md)。

## 三、工程目录与三层速查

```text
E:\Projects\Game\ShutterCrisis\
├─ Client\                          Unity 2022.3.62t14（团结引擎 1.10.2）+ URP 2D
│  └─ Assets\Scripts\
│     ├─ ShutterCrisis.Framework.asmdef
│     ├─ Data\ShutterCrisis.Data.asmdef
│     ├─ Kitchen\ShutterCrisis.Kitchen.asmdef      ← 11 个插件（框架 6 + 玩法 5）
│     └─ UI\ShutterCrisis.UI.asmdef                ← 面板系统 + 服务门面 KitchenServices
├─ Server\                          Python 3 标准库 HTTP 服务器
│  ├─ server.py                     薄路由层（HTTP / 路由 / 参数 / 启动）
│  ├─ services\                     服务层（account / session / run / catalog / asset / admin / storage）
│  └─ gameplay\                     玩法引擎（actions / rounds / settle / events / state / core）
│     └─ plugins\                   ← 玩法规则：_studio + studio/orders/staff/market/incidents/random_events
└─ Tools\
   ├─ compile_check\                不开 Unity 的桩编译
   ├─ unity_check\                  真实编辑器编译检查
   ├─ font_subset\                  中文字体子集
   ├─ text_table\                   文案表
   └─ rename_project.py             工程改名（本工程从 GamePrototype 改名时用的脚本）
```

## 四、五个关键单一事实源

| 事实 | 唯一入口 | 说明 |
| :--- | :--- | :--- |
| 服务器地址 | `GameConst.ServerUrl` | 登录、存档、单局、目录、资源清单都应从它派生；换域名只改一处 |
| UI 设计分辨率 | `GameConst.UIReferenceResolution` | 当前 1080×1920，`UIMatchWidthOrHeight = 0.5` |
| UI 字体 | `UIFontProvider.Get()` / `UITheme.GetFont()` | 禁止再写 `Resources.GetBuiltinResource<Font>(...)` |
| 客户端协议常量 | `KitchenActionType` / `KitchenUiAction` | ActionType 与服务端 `ACTIONS` 注册表双向校验 |
| **玩法状态字段** | `Server/gameplay/plugins/_studio.py` | 现金/口碑/订单/员工/… 的键名与读写契约；客户端经快照只读 |
| **面板注册** | `Client/.../UI/Xml/PanelMVC.xml` + `UI/PanelNavRule.cs` | 结构在 XML，分层/互斥/返回栈在 PanelNavRule；两边都要补 |

## 五、当前工程状态与已知缺口

以下事实来自**实际文件核对与跑门禁**的结果（2026-09-13 实测）：

- `Server/` 已有 `server.py`、`services/*`、`gameplay/*`（引擎 + 6 个玩法插件）、`test_client.py`、
  `e2e_test.py`、`test_heartbeat.py`、`verify_action_contract.py`、`verify_plugin_arch.py`、
  `verify_client_static.py`、`verify_asset_manifest.py`、`verify_deploy.py`、`deploy.py`、
  `install_service.sh`、`shuttercrisis.service`、`migrate_json_to_pg.py`、`admin_client.py`。

- **门禁实测（跑法见 [`验证与门禁.md`](验证与门禁.md)）**：

  | 门禁 | 结果 |
  | :--- | :--- |
  | `python Tools/compile_check/compile_check.py --errors-only` | **通过**（12 个程序集 / 0 错误） |
  | `python -m gameplay.verify` | **通过**（6 个自检套件 / 56 项断言全绿） |
  | `python verify_plugin_arch.py --client ../Client` | **通过 8 项 / 失败 0**（C1：11 个实现 == 11 条目录） |
  | `python verify_action_contract.py --client ../Client` | **通过 6 项 / 失败 0**（17 个 ActionType 双向一致） |
  | `python verify_client_static.py --client ../Client` | **通过 6 项 / 失败 0**（205 个脚本的 meta / asmdef / 枚举） |
  | `python verify_deploy.py` | **通过 12 项 / 失败 0**（含"交付物无历史项目痕迹"） |
  | `python test_client.py` / `e2e_test.py` / `test_heartbeat.py` | **全部通过**（登录 / 存档 / 同步 / 心跳） |
  | `python Tools/font_subset/make_ui_font.py --check` | **通过**（覆盖 863 个字符） |
  | `python Tools/text_table/make_text_table.py --check` | ⚠ 需要 `openpyxl` 与源表 `Tools/text_table/客户端文案.xlsx`，本机未装/未生成 |

- **面板预生成状态**：`PanelMVC.xml` 已登记 13 个面板；`PanelDefine_AutoBuild.cs` /
  `PanelRule_AutoBuild.cs` / `PanelManager_AutoBuild.cs` 与 13 套 MVC 脚本（39 个 `.cs`）
  **已按生成器模板落盘**（枚举、遮罩、模型/控制器注册、View 四字段绑定齐全）。
  **`Assets/Prefabs/UI/Panels/**` 下的面板 Prefab 尚未落盘** —— 需要一次可用的 Unity 会话执行
  菜单 `ShutterCrisis/一键初始化工程`（该方法会连 Prefab、场景层骨架、文案表、字体子集一并做完）。
  在此之前 UI 处在"可编译、面板结构已注册、Prefab 缺失"的状态。

- **字体源可分发性问题（出包前必须处理）**：`Tools/font_subset/make_ui_font.py` 首选 OFL 字体
  `Client/Assets/Fonts/ZCOOLKuaiLe-Regular.ttf`，但**该文件当前不在仓库里**，因此回退到专有字体
  `msyh.ttc`（微软雅黑）。当前产物 `ShutterCrisisCN.ttf` 由雅黑生成，**只可本地预览、不得随发行包发布**；
  正式出包前必须补上 OFL 字体并重跑生成（工具在走回退分支时会打印警告）。

- `Client/Assets/Scripts/UI/PanelManager.cs` 已声明 `m_popupRoot` / `m_toastRoot`，但还没有
  `Back()` / 返回栈入口；`UI/Common/SimpleButton.cs` 还没有 `SetInteractable` / `SetVisible`
  真禁用 / 真隐藏方法（`AGENTS.md` §3.3 已把它们列为 UI 任务必守规则，实现待补）。

- `Server/services/postgres_storage.py` 已实现，但文件自述"未在有 PostgreSQL 的机器上实测过 SQL 执行"，
  属 `⚠ 待验证`。

- `Client/Assets/Resources/GameData/AssetCdnConfig.asset` 里仍是占位 CDN 地址 /
  `m_manifestApi`。它是**真机可读**的资产，会覆盖代码默认值；换真实服务器 / CDN 时**必须改该资产**
  （代码侧唯一源是 `GameConst.ServerUrl`）。

- `Tools/text_table` 需要 `openpyxl`；本机 managed Python 未安装，跑 `--check` 会直接报缺依赖。
  接入 CI 时先把依赖装进隔离环境。

> 说明：重命名过 asmdef 之后，`Client/Library/Bee/artifacts` 里仍是**旧程序集名**的 `.rsp`；
> `compile_check` 已能在新版工程上跑通（会退回兜底引用集），
> 但想拿到与编辑器完全一致的引用集，需要用编辑器打开 `Client/` 重新编译一次。

## 六、文档维护约定

- 改代码前先读对应文档；改完代码后如果文档中的路径、类名、命令、API 受到影响，同轮更新文档。
- 文档只写“可操作规则”，不搬运历史叙事；历史 bug 压缩成“不要做 X（原因：会 Y）”。
- 任何新增命令、路径、类名，先在 `Client/` 或 `Server/` 里 `grep` / 读文件确认，再写入文档。
- 文档文件使用 UTF-8 with BOM；Markdown 代码块标语言；相关文档用相对路径互链。

## 七、常用命令速查

```bash
# ---------- 客户端 ----------
python Tools/compile_check/compile_check.py --errors-only
python Tools/compile_check/compile_check.py --assembly ShutterCrisis.Framework
python Tools/unity_check/unity_check.py --errors-only
python Tools/unity_check/unity_check.py --auto
python Tools/font_subset/make_ui_font.py
python Tools/font_subset/make_ui_font.py --check
python Tools/text_table/make_text_table.py
python Tools/text_table/make_text_table.py --check

# ---------- 服务器 ----------
cd Server
python server.py --port 8611 --data-dir .testdata
python -m compileall -q .
python -m gameplay.verify                                  # 玩法离线自检（快）
python test_client.py http://127.0.0.1:8611                # 账号 / 存档 / 同步协议
python e2e_test.py http://127.0.0.1:8611                   # 端到端
python test_heartbeat.py
python test_heartbeat.py http://127.0.0.1:8611
python test_gameplay_smoke.py http://127.0.0.1:8611        # ⭐ 玩法端到端冒烟（含破产/收店）
python verify_plugin_arch.py --client ../Client
python verify_action_contract.py --client ../Client
python verify_client_static.py --client ../Client
python verify_asset_manifest.py --dir <产物目录> --server <地址> --platform <渠道>
python verify_deploy.py
python verify_deploy.py --host <你的服务器>
python migrate_json_to_pg.py --print-ddl
python migrate_json_to_pg.py --dry-run
python deploy.py --host <你的服务器> --pem ~/.ssh/id_rsa
python deploy.py --host <你的服务器> --gen-key
python admin_client.py http://127.0.0.1:8611 --key <KEY> stats
```

> 本机跑服务端用例时注意：如果 shell 里有 `HTTP_PROXY` / `http_proxy`，
> `urllib` 会把 `127.0.0.1` 也走代理导致 502；先 `unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY`
> 或设 `no_proxy=127.0.0.1,localhost`。

命令的期望退出码与失败排查见 [`验证与门禁.md`](验证与门禁.md)。

## 八、文档与代码的对应关系

| 文档 | 主要对应代码 / 工具 |
| :--- | :--- |
| [`框架总览.md`](框架总览.md) | `Client/Assets/Scripts/` 四层 asmdef、`Server/server.py` / `services/` / `gameplay/`、`Tools/` |
| [`分层与命令驱动.md`](分层与命令驱动.md) | `Kitchen/PluginFramework/`、`Kitchen/Plugins/`、`Kitchen/Command/KitchenCommandRunner.cs`、`Server/verify_plugin_arch.py`、`Server/verify_action_contract.py` |
| [`UI规范与一键生成.md`](UI规范与一键生成.md) | `UI/PanelManager.cs`、`UI/BaseMVC/`、`UI/Common/`、`UI/Editor/KitchenUIGenerationPipeline.cs`、`Tools/font_subset/`、`Tools/text_table/` |
| [`服务器基座.md`](服务器基座.md) | `Server/server.py`、`Server/services/`、`Server/gameplay/`、`Server/test_*.py`、`Server/verify_*.py`、`Server/deploy.py` |
| [`新项目落地清单.md`](新项目落地清单.md) | `Client/ProjectSettings/`、`Client/Assets/Resources/GameData/`、`Server/shuttercrisis.service`、`Server/install_service.sh`、`Server/deploy.py` |
| [`验证与门禁.md`](验证与门禁.md) | `Tools/*`、`Server/verify_*`、`Server/test_*`、`Server/*.service`、`.github/workflows`（由新项目自行接入） |

## 九、框架能做什么 / 游戏代码要写什么

**框架已提供（本工程已具备，直接用）**

- 账号 / 登录 / Token / 存档版本 / 心跳 / 单局生命周期 / 目录下发 / 资源热更 / 后台管理 / 留存清理。
- 四层程序集与插件框架：服务注册、事件总线、行动注册表、命令驱动。
- UI 面板系统与一键生成：面板 MVC、场景层骨架、占位面板、中文字体子集。
- 多平台构建：Build Profile 配置、平台能力抽象、SDK 程序集隔离。

**游戏代码需要写（本作的真正内容）**

- 具体玩法规则与数值。
- `Kitchen/Plugins/<域>/` 客户端插件与服务实现。
- `Server/gameplay/plugins/<域>.py` 服务端玩法插件。
- 首批面板的设计与生成器布局描述。
- 项目身份、包名、服务器域名、CDN 域名、AppID、广告位。
- 合规资质与平台后台配置。

**框架不替你做**

- 不替你决定玩法、经济系统、成长曲线。
- 不提供运营后台的完整业务功能；后台接口只覆盖封禁 / 存档 / 留存 / 资源发布等基础设施。
- 不保证未接入的第三方 SDK 开箱可用；平台 SDK 需自行在 Build Profile 与 Package Manager 中配置。

## 十、下一步

1. 换真实服务器 / CDN 地址：`GameConst.ServerUrl` + `Resources/GameData/AssetCdnConfig.asset`。
2. 定下玩法并加第一个玩法插件：按 [`分层与命令驱动.md`](分层与命令驱动.md) 的“新增一个玩法插件”与 [`服务器基座.md`](服务器基座.md) 的“如何加一个玩法插件”。下一阶段的玩法演进路线（动线层 / 员工生活层 / 操作体验）见 [`原型设定-V2.md`](原型设定-V2.md) 的分期表。
3. 建第一批面板：按 [`UI规范与一键生成.md`](UI规范与一键生成.md) 的“新增面板五步”。
4. 补上 OFL 字体并重新生成中文子集（见第五节字体条目），再接 CI 门禁：按 [`验证与门禁.md`](验证与门禁.md) 的对照表与示例。
5. 上线前：按 [`新项目落地清单.md`](新项目落地清单.md) 的“上线前合规检查”。

## 十一、常见问题

**Q：为什么 `GameConst.ServerUrl` 改了，客户端还是连旧地址？**  
A：检查 `Client/Assets/Scripts/Const/GameConst.cs`、`Client/Assets/Scripts/Data/ServerComm.cs`（已派生自 `GameConst.ServerUrl`）、以及 `Client/Assets/Resources/GameData/AssetCdnConfig.asset` 的 `m_manifestApi` / `m_cdnRoot`；当前资产里仍可能保留旧地址。

**Q：为什么面板 Prefab 不能手写？**  
A：一键生成会删除并重建 `Assets/Prefabs/UI/Panels/` 下的 Prefab；基座当前允许在生成的标准骨架上手工调整，但必须保留 `TitleText` / `ContentRoot` / `StatusText` / `ActionButtons` 四个字段绑定，之后只用“补建缺失”，不要用“全量重置”。如果项目要求完全不手改，应把界面内容写进 `KitchenPanelPrefabGenerator`。

**Q：为什么小游戏里中文全是空白/方块？**  
A：没有使用工程自带的中文字体子集。确认 `UIFontProvider.Get()` 能加载 `Resources/UI/Fonts/ShutterCrisisCN.ttf`，并重跑 `python Tools/font_subset/make_ui_font.py`。

**Q：为什么服务端新增插件没有生效？**  
A：检查文件是否放在 `Server/gameplay/plugins/`、文件名是否以下划线开头、插件模块是否可导入、`ACTIONS` 键是否与客户端 ActionType 一致；跑 `python -m gameplay.verify` 与 `python verify_action_contract.py`。

**Q：为什么保存时提示“客户端存档过期”？**  
A：服务器 `LastSaveTimestamp` 防旧档覆盖生效：客户端提交的时间戳早于服务器已存数据超过 300 秒。检查设备时钟，或先 `sync` 拉到最新存档再改。

**Q：为什么心跳失败但游戏还能玩？**  
A：心跳是静默通道，失败不改变游戏状态，也不应弹窗打扰玩家；但 `SessionOk=false` 时必须停跳并回登录流程。

**Q：为什么换了 PG 后端却还是 JSON 数据？**  
A：确认 `GP_STORAGE=postgres` 与 `GP_DATABASE_URL` 都已配置；确认启动日志没有存储后端错误；`services/postgres_storage.py` 尚未在真实 PG 上实测，上线前先跑 dry-run。

## 十二、术语表

| 术语 | 含义 |
| :--- | :--- |
| 数据层 | `Client/Assets/Scripts/Kitchen/**`，插件 / 服务 / 协议 / 命令执行器，不依赖 UI |
| 管理层 | `Client/Assets/Scripts/UI/Kitchen/*.cs`，服务门面 / 路由 / 会话上报 / 组合根 |
| 面板层 | `Client/Assets/Scripts/UI/Panels/**`，由一键生成产出的 View / Model / Controller |
| 服务门面 | 面板取插件服务的唯一入口，当前 `KitchenServices`，目标命名 `ShutterCrisisServices` |
| 行动注册表 | `KitchenActionRegistry`，把 UiAction 翻译成协议 Body 或流程命令 |
| 命令驱动 | `命令 [字段=值 ...]` 与 UI 按钮同一条执行路径 |
| 一键生成 | 脚本 → 自检 → Prefab → 场景层 → 占位 → 字体子集的流水线 |
| 门禁 | 可机器执行、失败返回非 0 的检查；没有失败能力的检查不是门禁 |
| `GP_*` | 服务器基座环境变量前缀 |
| `ShutterCrisis.*` | 客户端程序集 / 命名空间前缀；新项目改名时替换 |

## 十三、相关文档

- [`框架总览.md`](框架总览.md)
- [`分层与命令驱动.md`](分层与命令驱动.md)
- [`UI规范与一键生成.md`](UI规范与一键生成.md)
- [`服务器基座.md`](服务器基座.md)
- [`新项目落地清单.md`](新项目落地清单.md)
- [`验证与门禁.md`](验证与门禁.md)
