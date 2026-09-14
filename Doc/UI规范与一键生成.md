# UI 规范与一键生成

本文定义 `ShutterCrisis` 客户端 UI 的分辨率、层级、面板生命周期、注册方式与“一键生成”流水线。核心原则：**面板落盘只走一键生成，禁止手写布局。**

> 适用范围：`Client/Assets/Scripts/UI/`、`Client/Assets/Prefabs/UI/`、`Client/Assets/Resources/UI/`。  
> 相关工具：`UI/Editor/KitchenUIGenerationPipeline.cs`、`UI/Editor/KitchenPanelPrefabGenerator.cs`、`UI/Editor/KitchenPlaceholderPrefabGenerator.cs`、`UI/Editor/UIWidgetFactory.cs`。

## 一、设计分辨率与 CanvasScaler

| 项 | 取值 | 来源 |
| :--- | :--- | :--- |
| 设计分辨率 | 1080 × 1920（竖屏） | `GameConst.UIReferenceResolution` |
| CanvasScaler 模式 | `ScaleWithScreenSize` | `UI/PanelManagerFallback.cs::EnsureCanvasComponents` |
| 宽高匹配权重 | `GameConst.UIMatchWidthOrHeight = 0.5f` | 同上 |
| 安全区 | 面板内容根挂 `UISafeArea` | `UI/Common/UISafeArea.cs` |

约定：

- 面板背景可以铺满全屏；面板内容根必须挂 `UISafeArea`，运行时按 `Screen.safeArea` 收缩，避让刘海、挖孔与手势条。
- 元素按 RectTransform 九宫格锚点放置：顶行贴上、底行贴下、中间居中；不要用“父级高度百分比”定位。
- 屏幕尺寸变化后 `UISafeArea` 需要重新计算；折叠屏 / 分屏 / 转屏场景尤其要验证。

## 二、UI 四层

文件：`Client/Assets/Scripts/UI/PanelNavRule.cs`。

```text
Canvas
├─ NormalRoot      页面层（Page）    普通全屏窗口 / 功能窗
├─ PersistentRoot  常驻 HUD 层（Hud） 登录后常开，透明不挡下层输入
├─ PopupRoot       弹窗层（Popup）   二级弹窗 / 确认框，必须盖住 HUD
└─ ToastRoot       提示层（Toast）   Toast / Loading，最上、不吃点击
```

`PanelNavRule.LayerOrderBottomToTop` 就是上述顺序，场景生成器与兜底结构都按它建层。`eUILayer` 当前枚举：

- `eUILayer.Scene`：已废弃，仅兼容历史序列化数据；地图已改为独立场景的思路在新项目里可直接删掉。
- `eUILayer.Page`：页面层。
- `eUILayer.Hud`：常驻 HUD 层。
- `eUILayer.Popup`：弹窗层。
- `eUILayer.Toast`：提示层。

层根节点名常量：

- `PanelNavRule.RootPage = "NormalRoot"`
- `PanelNavRule.RootHud = "PersistentRoot"`
- `PanelNavRule.RootPopup = "PopupRoot"`
- `PanelNavRule.RootToast = "ToastRoot"`

### 2.1 当前已知缺口

- `Client/Assets/Scripts/UI/PanelManager.cs` 已声明 `m_popupRoot` / `m_toastRoot`；
  `PanelDefine_AutoBuild.cs` / `PanelRule_AutoBuild.cs` / `PanelManager_AutoBuild.cs` 已按
  **13 个面板**（4 个窗口）生成，`PanelNavRule.BuildRules()` / `WindowOf()` 也已登记 —— 面板结构层面是齐的。
- **`Assets/Prefabs/UI/Panels/**` 下的面板 Prefab 尚未落盘**：需要一个可用的 Unity 会话执行
  菜单 `ShutterCrisis/一键初始化工程`。该步骤同时会补场景 UI 层骨架、导出文案表、重建字体子集。
- `PanelManager.cs` 当前没有 `Back()` 方法；`UIPopup.CloseTop()` 存在，但"返回键优先关弹窗、栈空再关面板"的入口尚未落地。
- `PanelManagerFallback.EnsureFallbackUI()` 会补齐四层根，但 `EnsureCanvas()` 的"优先复用场景现有根画布"逻辑要求场景里只有一套 Canvas；新场景生成后必须确认没有第二套 `PanelCanvas`。

## 三、PanelManager + BaseMVC

### 3.1 三件套职责

| 文件 | 基类 | 职责 |
| :--- | :--- | :--- |
| `UI/BaseMVC/PanelView.cs` | `MonoBehaviour` | 持有序列化组件引用；负责显示 / 隐藏、淡入淡出、订阅视图按钮事件；不解析协议、不查数据 |
| `UI/BaseMVC/PanelModel.cs` | 普通 C# 类 | 只承载面板自身的 UI 状态（选中项、弹窗阶段、文本草稿等）；不复制服务器状态 |
| `UI/BaseMVC/PanelController.cs` | 抽象类 | 持有 `m_view` / `m_model` 实例字段；初始化、注册 / 注销事件、响应交互 |

`PanelView` 关键成员：

- `IsPersistent`：常驻面板标记，常驻面板挂 `PersistentRoot`，不参与自动清理。
- `IsOpen`、`LastCloseTime`：供 `PanelManager` 清理策略使用。
- `Init()`：初始化 ticker；`OpenPanel()` / `ClosePanel()`：控制显隐与动画；`Clear()`：释放引用。

`PanelController` 当前抽象方法：

- `Init(PanelModel model)`
- `RegisterEvent_Model()`
- `UnregisterEvent_Model()`
- `RegisterEvent_View(PanelView view)`
- `UnregisterEvent_View()`

### 3.2 目标生命周期

```text
Init
  └─ RegisterEvent_View
        └─ （面板打开、交互、事件刷新）
              └─ UnregisterEvent_View
                    └─ Uninit / Clear
```

当前基类没有 `Uninit` 方法；目标语义可用 `PanelView.Clear()` + `PanelModel.Clear()` 承接。若新项目要在门禁里写“Uninit 已调用”，需要先给 `PanelController` 补一个 `Uninit()` 抽象或虚方法，并让 `PanelManager` 在 `ClearView` 时调用。

### 3.3 打开 / 关闭时序（实际代码）

`Client/Assets/Scripts/UI/PanelManager.cs`：

```text
OpenPanel(windowID, panelID)
  ├─ GetPanelView：栏位空则 LoadView（AssetLoader.LoadAssetComponentInstance）
  ├─ RegisterView → controller.RegisterEvent_View(view)
  ├─ 设置 RectTransform 铺满 Canvas
  ├─ view.OpenPanel()
  └─ OnOpenPanel 事件

ClosePanel(windowID, panelID)
  ├─ view.IsOpen 时 view.ClosePanel()
  ├─ UnregisterView → controller.UnregisterEvent_View()
  └─ OnClosePanel 事件
```

**关键顺序**：注册事件必须在 `OpenPanel` 之前，注销事件必须在 `ClosePanel` 之后。顺序反了会出现“第一次打开能点、第二次打开回调翻倍”或“关闭时回调已断”的问题。

### 3.4 清理策略

`GameConst` 中的相关阈值：

- `MaxNormalPanelCount = 10`：常驻面板之外的动态面板数量上限。
- `MaxPanelLifeCycle = 30`：关闭后 30 秒可被自动清理。
- `AutoClearPanelInterval = 10`：清理检查间隔。

`PanelManager.ClearView` 是面板视图唯一销毁点。销毁前必须处理：

1. `UIPopup.CloseAllOf(view)`：关闭属于该面板的弹窗；
2. `UIPopup.RestoreAllOf(view)`：把弹窗节点归位到 Prefab 原父节点；
3. 再 `Destroy(view.gameObject)`。

不要把 `SetParent` 放在 `OnDisable` / `OnDestroy` 调用链里；引擎会在失活级联中拒绝这次调用并报错。

## 四、`eWindowID` / `ePanelID` 与注册

### 4.1 枚举来源

`Client/Assets/Scripts/UI/Editor/CreatePanelRelatedScriptsEditor.cs` 从面板注册数据生成：

- `Client/Assets/Scripts/UI/PanelDefine_AutoBuild.cs`：`eWindowID`、`ePanelID` 枚举。
- `Client/Assets/Scripts/UI/PanelManager_AutoBuild.cs`：`AddModels()` / `AddControllers()` 注册。
- `Client/Assets/Scripts/UI/PanelRule_AutoBuild.cs`：窗口底板类型 / 面板按钮元数据。

命名规则：

- `WindowKey` → `eWindowID` 成员：`<WindowKey>Window`
- `<WindowKey>` + `<PanelID>` → `ePanelID` 成员：`<WindowKey><PanelID>Panel`

### 4.2 当前注册源

| 文件 | 路径 | 当前角色 |
| :--- | :--- | :--- |
| `PanelMVC.xml` | `Client/Assets/Scripts/UI/Xml/PanelMVC.xml` | 当前一键生成流水线 `XmlWindowDataProvider.Load` 与 `CreatePanelEditorWindow` 读取的编辑源 |
| `PanelDataSO.asset` | `Client/Assets/GameData/PanelDataSO.asset` | 面板注册数据 SO，`PanelDataSO.LoadOrCreate()` 可从旧 XML 迁移；但当前主流水线尚未改为读 SO |
| `PanelDataSO.cs` | `Client/Assets/Scripts/UI/PanelDataSO.cs` | 定义 `XmlWindowData` / `XmlPanelData` / `XmlCurrencyData` 与 `MigrateFromLegacyXml()` |

**规则**：一条配置只能有一个写入位置。当前是 XML 与 SO 并存的过渡状态，新项目必须先决定唯一注册源：

- 若继续用 XML，则把 `PanelDataSO` 视为只读迁移桥梁，不要手工编辑两份；
- 若切到 SO，则把 `XmlWindowDataProvider.Load` 改为读 `PanelDataSO`，并停止在 `CreatePanelEditorWindow.SaveXML` 里写 XML。

### 4.3 跳转规则

`Client/Assets/Scripts/UI/PanelNavRule.cs` 是“谁能开、开在哪层、和谁互斥、是否入返回栈”的目标唯一事实源：

- `eUILayer`：层归属。
- `PanelNavRuleData.ExclusiveGroup`：互斥组名。
- `PanelNavRuleData.PushToNavStack`：是否进返回栈。
- `PanelNavRuleData.SupersededKeepsBackStack`：被同互斥组新面板挤掉时，是否保留在返回栈当返回目标。

目标行为：`PanelManager.OpenPanel` 按规则路由层根、自动收拢同互斥组、决定是否入栈；新增面板只需在规则表加一行，不需要改控制器。

**当前状态（已登记，不是空壳）**：`PanelMVC.xml` 已登记 **4 个窗口 / 13 个面板**；
`PanelDefine_AutoBuild.cs` 生成了 `eWindowID`（LoginWindow / MainWindow / HudWindow / PopupWindow）
与 13 个 `ePanelID`；`PanelNavRule.BuildRules()` 已登记每个面板的层与互斥组，`WindowOf()` 已登记窗口归属。

本作的分层约定：

| 面板 | 层 | 互斥组 | 入返回栈 |
| :--- | :--- | :--- | :--- |
| `LoginMainPanel` | Page | `Login` | 否 |
| `Main*Panel`（8 个功能页） | Page | `Feature` | 是 |
| `HudTopBarPanel` | Hud | — | 否 |
| `Popup{Service,Quarrel,Settle}Panel` | Popup | — | 否 |

> 客服弹窗必须在 **Popup 层**：服务器的行动前置条件会挡住其它操作（模态），
> 界面要能盖住页面层同时看到它，否则玩家会"点了没反应"却不知道原因。

## 五、面板落盘只走“一键生成”

### 5.1 为什么不能手写

- 手写 Prefab 会绕过生成前自检（字段绑定、层序、场景层根）。
- 下次“一键生成（全量重置）”会删除并重建 Prefab，手写调整会丢失。
- 生成器与运行时共用同一套 `UIWidgetFactory` + `UITheme`；手写会引入第二套尺寸 / 配色 / 字体来源。

### 5.2 入口

两个入口：

1. 顶层菜单：`ShutterCrisis/一键初始化工程`（当前代码菜单根已经是 `ShutterCrisis`）。
   - 调用 `GameContentResetTool.ResetAllAndInitialize()`，9 步流水线。
2. 面板生成器窗口：`KitchenToolsWindow` / `CreatePanelEditorWindow` 内的“一键生成（全量重置）”或“一键生成（仅补缺失）”。
   - 调用 `KitchenUIGenerationPipeline.RunAll(resetPrefabs)`。

### 5.3 `KitchenUIGenerationPipeline.RunAll` 的步骤

文件：`Client/Assets/Scripts/UI/Editor/KitchenUIGenerationPipeline.cs`。

```text
[1] 生成 MVC 脚本与枚举
     ├─ 若存在缺失的面板脚本：写出脚本 → 记录 SessionState 待办 → 等 Unity 编译
     └─ 编译完成由 [InitializeOnLoadMethod] ResumeAfterCompile 自动续跑
[2] 生成前自检（不写盘）
     └─ KitchenPanelPrefabGenerator.ValidateAll()
[3] Prefab 落盘
     ├─ resetPrefabs=true  → KitchenPanelPrefabGenerator.ResetAll()
     └─ resetPrefabs=false → KitchenPanelPrefabGenerator.GenerateMissing(...)
[4] 补齐场景 UI 层骨架 + 重接线 PanelManager
     └─ KitchenSceneLayerUtility.EnsureLayerStructure()
[5] 补齐缺失面板的占位 Prefab
     └─ KitchenPlaceholderPrefabGenerator.EnsureAllMissing()
[6] 中文字体子集
     └─ Tools/font_subset/make_ui_font.py
```

**先自检后落盘**：第 [2] 步会把“工厂构建失败 / View 字段未绑定 / 场景层序错误”在删除 Prefab 之前暴露出来。

### 5.4 生成前自检

`Client/Assets/Scripts/UI/Editor/KitchenPanelPrefabGenerator.cs` 的 `ValidateAll()`：

- 在内存里把全部面板构建一遍，不写盘；
- 调用 `UIWidgetFactory.ValidateBindings(view, unbound)` 检查 View 序列化字段是否全部绑定；
- 调用 `ValidateSceneLayers()` 检查当前场景是否按 `PanelNavRule.LayerOrderBottomToTop` 排列层根；
- 结果写入 `KitchenPanelPrefabGenerator.LastReport`。

### 5.5 当前生成器的行为

`KitchenPanelPrefabGenerator` 当前是**基座版通用生成器**：

- `Generate()` 按 `XmlWindowDataProvider.Load` 读到的面板配置逐个产出**标准窗口骨架**：面板根（`PanelView`）→ `WindowCard` → `Header` / `Content` / `Footer`；只绑定 `TitleText` / `ContentRoot` / `StatusText` / `ActionButtons` 四个字段。
- `ResetAll()` 全量删除并重建 `Assets/Prefabs/UI/Panels` 下的 Prefab，**会覆盖手工调整**。
- `GenerateMissing()` 只补缺失，已有面板保持不变，保护手工调整。
- `ResetSingle()` 先删后建单个面板。
- `ValidateAll()` 在内存里构建全部面板并检查字段绑定与场景层序，不写盘。

**基座当前的“长出真实界面”策略**：

1. 先用 `Generate()` / `GenerateMissing()` 产出可运行骨架，保证每个面板都进得去、出得来；
2. 对需要真实内容的面板，在生成的 Prefab 上手工调整，但**必须保留 `TitleText` / `ContentRoot` / `StatusText` / `ActionButtons` 四个字段绑定**；
3. 之后只用“补建缺失（`GenerateMissing`）”，不要用“全量重置”，否则手工调整会丢失；
4. 如果项目要求“面板落盘只走一键生成、完全不手改”，应把界面内容写进 `KitchenPanelPrefabGenerator` 的构建逻辑，而不是手工改 Prefab。

`KitchenPlaceholderPrefabGenerator` 当前只补缺失：它读取面板配置，把没有 Prefab 的面板交给 `KitchenPanelPrefabGenerator.GenerateSingle` 产出标准骨架；因此不存在“正式页 / 占位页两份 UI 漂移”的问题。

`GameContentResetTool` 当前是 9 步流水线（主场景只检查不重建、文案表、面板脚本、自检、Prefab、占位、UI 层、字体、收尾自检）；不再依赖缺失的场景生成器类型。

## 六、字体唯一来源与中文子集

### 6.1 唯一入口

- 运行时：`Client/Assets/Scripts/Common/UIFontProvider.cs` 的 `UIFontProvider.Get()`。
- UI 侧：`Client/Assets/Scripts/UI/Common/UITheme.cs` 的 `UITheme.GetFont()`。
- 生成器：`UIWidgetFactory` 与 `KitchenPanelPrefabGenerator` 必须走 `UITheme.GetFont()`。

**禁止**：

- `Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")`。
- 面板里单独给 `Text` 指定字体、字号、字色；按钮与文字是一组，由 `UIWidgetFactory.CreateButton` 按变体整组装配。

### 6.2 字体产物

| 项 | 值 |
| :--- | :--- |
| 产物路径 | `Client/Assets/Resources/UI/Fonts/ShutterCrisisCN.ttf` |
| Resources 路径 | `UI/Fonts/ShutterCrisisCN` |
| 生成工具 | `Tools/font_subset/make_ui_font.py` |
| 源字体候选（脚本顺序） | `ClientCocos/assets/resources/Fonts/ZCOOLKuaiLe-Regular.ttf` → `Client/Assets/Fonts/msyh.ttc` |
| 扫描范围 | `Client/Assets/Scripts` + `Client/Assets/Prefabs` 下的 `.cs` / `.xml` / `.json` / `.txt` / `.prefab` / `.asset` / `.md` |

### 6.3 中文文案纪律

- 界面文案禁止 Emoji 与字体不含的装饰符号。
- 状态符号统一用 `× ! > ->`；图标走美术资源。
- `.cs` 只扫描**字符串字面量**，注释里的符号不算界面需求。
- 改中文文案后必须重跑字体工具并提交产物。

### 6.4 命令与退出码

```bash
python Tools/font_subset/make_ui_font.py          # 生成
python Tools/font_subset/make_ui_font.py --check  # 只校验现有产物
python Tools/font_subset/make_ui_font.py --stats  # 字符集统计
python Tools/font_subset/make_ui_font.py --report-missing  # 只报告源字体缺字
```

退出码：

- `0`：成功 / 校验通过；
- `1`：`--check` 发现产物缺字；
- `2`：产物不存在；
- `3`：文案里出现字体必然不支持的 Emoji / 装饰符号；
- `4`：源字体缺字。

**当前注意**：源字体第一候选 `ClientCocos/...` 在当前基座中不一定存在；实际会回退到 `Client/Assets/Fonts/msyh.ttc`。微软雅黑是专有字体，发行包不得再分发；新项目应换成有明确再分发授权的源字体。

## 七、按钮：真禁用 / 真隐藏

### 7.1 目标契约

| 语义 | 方法 | 行为 |
| :--- | :--- | :--- |
| 真禁用 | `SetInteractable(false)` | 屏蔽射线；按钮保持布局位置；使用主题禁用色与禁用字色 |
| 真隐藏 | `SetVisible(false)` | alpha = 0 且关闭射线；保留在布局里，避免按钮行宽度跳变 |
| 单纯改透明度 | `SetButtonAlpha(float)` | 只影响视觉，**不等于**禁用或隐藏 |

### 7.2 交互细节

- 按下缩放反馈可以保留，但按住后拖出按钮必须取消点击回调。
- 如果一个按钮只是视觉变灰但仍然响应点击，玩家会认为“点了没反应”；必须用真禁用。
- 如果一个按钮 alpha 为 0 但开着 `raycastTarget`，它会挡住下层控件；必须用真隐藏。

### 7.3 当前缺口

`Client/Assets/Scripts/UI/Common/SimpleButton.cs` 当前只有 `SetButtonAlpha(float)`，尚未实现 `SetInteractable(bool)` / `SetVisible(bool)`。在补齐前，按本文契约验收会失败；新项目要么先补 `SimpleButton`，要么在 `UIWidgetFactory` 里统一用 Button 组件实现同语义。

## 八、弹窗遮罩关闭与回调

### 8.1 唯一工厂

`UIWidgetFactory.CreateDialog(...)` 产出带遮罩的独立弹窗，遮罩根挂 `UIPopup`；弹窗打开时由 `UIPopup.OnEnable` 提升到 `PopupRoot`。

`UIPopup` 关键行为：

- `OnEnable` → `Promote()`：挂到 `PopupRoot` 并置顶；记录原父节点与兄弟序号。
- `OnDisable` → `Demote()`：只出栈，**不改层级**（失活级联中改层级会被引擎拒绝）。
- `CloseAllOf(view)`：关闭属于某面板的全部弹窗。
- `RestoreAllOf(view)`：把弹窗归位到 Prefab 原父节点，随面板销毁。
- `CloseTop()`：关闭最上层弹窗；`HasOpen` / `OpenCount`：诊断。

### 8.2 点遮罩关闭

`UI/Common/UIBackdropCloser.cs`：

- 挂载对象必须带 `Image`。
- `Setup(GameObject target, Action callback = null)`：设置关闭目标与回调。
- 点击判定是“按下与抬起都在遮罩上”，拖拽不误触。
- 关闭动作是 `target.SetActive(false)`，不绕过控制器的显隐状态机。

`UIWidgetFactory.SetBackdropCallback(dialog, host, methodName)` 用于把遮罩关闭回调接到控制器方法；**回调里必须同步控制器状态机**，否则下一次 `RefreshDisplay` 可能又把弹窗推回来。

### 8.3 强制选择弹窗

必须做选择的二次确认弹窗不要挂 `UIBackdropCloser`，或把 `target` 设为不可关闭；否则点遮罩会绕过选择。

## 九、主题色统一入口

| 范围 | 唯一入口 | 文件 |
| :--- | :--- | :--- |
| 运行时 UI | `UITheme` | `Client/Assets/Scripts/UI/Common/UITheme.cs` |
| 编辑器工具 | `ShutterCrisisEditorTheme` | `Client/Assets/Scripts/Editor/Common/KitchenEditorTheme.cs` |
| 编辑器配色配置 | `EditorThemeConfig` | `Client/Assets/Scripts/Editor/Common/EditorThemeConfig.cs`，资产 `Assets/GameData/EditorThemeConfig.asset` |

规则：

- 禁止在面板、窗口、生成器里写死 `new Color(...)`。
- 按钮颜色按 `eUIButtonVariant` 与 `UITheme.GetButtonColor` 取；禁用色统一 `UITheme.DisabledFill`。
- 编辑器改色后必须 `ResetStyles()`，因为 `GUIStyle` 把颜色烧进了实例。

## 十、面板能进 / 能关 / 能返回

任何 UI 的验收线：

1. **能进**：从入口或上一级能打开面板；缺失 Prefab 时运行时占位页兜底。
2. **能关**：关闭按钮 / 遮罩 / 返回键至少一种可行，且控制器状态机同步。
3. **能返回**：面板跳转进入返回栈；返回时优先关最上层弹窗，再退页面；栈空时关闭当前面板。
4. **HUD 常驻**：常驻面板 `IsPersistent=true`，挂 `PersistentRoot`，不参与自动清理。
5. **弹窗层级**：弹窗必须在 HUD 之上；`PopupRoot` / `ToastRoot` 必须存在且接线到 `PanelManager`。

当前基座尚未落地 `PanelManager.Back()` 与 `SimpleButton.SetInteractable/SetVisible`，因此第 1 / 3 条中的“真禁用 / 真隐藏 / 返回栈”需要在补齐后重新验收；占位 Prefab 生成器已改为“只补缺失并交给通用生成器产出骨架”。

## 十一、新增面板五步

1. 在面板注册源中登记：`WindowKey` / `PanelID` / `PanelName` / `ButtonName` / `IconName`。
2. 在 `PanelNavRule.BuildRules()` 登记层、互斥组、是否入返回栈。
3. 产出骨架：运行“一键生成”得到标准窗口骨架；需要真实内容的面板可手工调整 Prefab，但必须保留生成器的四个字段绑定，之后只用“补建缺失”。
4. 运行“一键生成”：脚本 → 自检 → Prefab → 场景层 → 占位 → 字体子集。
5. 验收：自检问题为空；面板能进 / 能关 / 能返回；改过中文文案时确认字体子集已刷新。

## 十二、相关文档

- [`框架总览.md`](框架总览.md)
- [`分层与命令驱动.md`](分层与命令驱动.md)
- [`验证与门禁.md`](验证与门禁.md)
- [`新项目落地清单.md`](新项目落地清单.md)
