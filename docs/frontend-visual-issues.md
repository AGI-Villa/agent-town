# Agent Town 前端视觉问题清单（技术审查版）

> 日期：2026-03-08 | 状态：待修复
> 
> 本文档从代码层面分析所有前端视觉问题的根本原因，并给出可直接执行的修复指令。
> 每个问题都包含：现象、代码路径、根因、修复指令。

---

## 架构概览

```
渲染管线:
  Phaser Game (800×600 canvas)
    → TownScene / OfficeScene
      → Ground Layer: 1200 个独立 Graphics 对象（每 tile 一个）
      → Furniture Layer: ~200 个独立 Graphics 对象
      → AgentSprite (extends Container)
        → Sprite (引用程序化生成的 spritesheet texture)
        → StatusIndicator (Graphics)
      → DayNightCycle overlay (Rectangle, depth=1000, MULTIPLY blend)
      → SocialSystem dialogue bubbles (Container, depth=1000-1001)

数据流:
  /api/agents → TownScene.fetchAndUpdateAgents (每 5s) → createAgent / updateAgent
  GameTimeSystem → ScheduleSystem → moveAgentToLocation → 改变 agent 在地图上的位置
```

---

## BUG-1：Sprite 渲染为"小人矩阵" 🔴 P0 — 阻塞性 bug

### 用户现象
每个 agent 不是一个 16×24 的小人，而是显示为一个 128×120 的**小人矩阵**（8 列×5 行的完整 spritesheet）。

### 代码路径
```
src/game/sprites/AgentSprite.ts
  → constructor() 第 57 行: this.generateSpriteTexture()
  → generateSpriteTexture() 第 82-103 行
```

### 根因分析

`generateSpriteTexture()` 执行了以下操作：
1. ✅ 创建 Graphics，遍历 5 行×8 列，绘制 40 帧小人到各自位置
2. ✅ 调用 `graphics.generateTexture(this.textureKey, 128, 120)` 生成纹理
3. ❌ **缺失关键步骤：从未调用 `texture.add()` 注册帧切片数据**

Phaser 的 `generateTexture()` 只创建一个"整张图"纹理，不含帧信息。  
当 `scene.add.sprite(0, 0, this.textureKey, 0)` 请求 frame 0 时，  
Phaser 找不到已注册的子帧 → 回退到整张纹理作为 frame 0 → 显示 128×120 全部内容。

动画同理失效：`ANIMATION_DEFS` 引用的 frame index 0-39 全部指向不存在的帧。

### 修复指令

在 `generateSpriteTexture()` 的 `graphics.generateTexture()` 之后、`graphics.destroy()` 之前，添加帧注册逻辑：

```ts
// 在 graphics.generateTexture(this.textureKey, width, height); 之后添加：
const texture = this.scene.textures.get(this.textureKey);
let frameIndex = 0;
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < framesPerRow; col++) {
    texture.add(
      frameIndex,        // frame index (0-39)
      0,                 // source index (always 0 for generated textures)
      col * frameWidth,  // x offset in texture
      row * frameHeight, // y offset in texture
      frameWidth,        // frame width (16)
      frameHeight        // frame height (24)
    );
    frameIndex++;
  }
}
```

### 验收标准
- 每个 agent 在画面上是一个 16×24 像素的单个小人
- 行走动画正常播放（4 帧循环）
- work/think/rest/error 状态动画正常

### 影响范围
此 bug 同时影响 **TownScene** 和 **OfficeScene**（两者共用 `AgentSprite` 类）。

---

## BUG-2：Office 页面显示异常 + 导航丢失 TOWN 入口 🔴 P0

### 用户现象
1. 点击 OFFICE 后画布空白或渲染异常
2. 到了 `/office` 页面后，顶部导航栏里**没有 TOWN 链接**，无法返回

### 代码路径

**导航问题：**
```
src/app/office/page.tsx 第 64-89 行
nav 链接列表: HOME / STATUS / OFFICE(当前) / FEED
缺失: TOWN
```

**对比 town 页面：**
```
src/app/town/page.tsx 第 64-96 行
nav 链接列表: HOME / STATUS / OFFICE / TOWN(当前) / FEED
✅ 完整
```

**渲染问题（链式依赖 BUG-1）：**
`OfficeScene` 使用同一个 `AgentSprite` 类，因此有完全相同的小人矩阵 bug。

### 修复指令

1. **导航修复**：在 `src/app/office/page.tsx` 的 `<nav>` 中，在 STATUS 和 OFFICE 之间添加 TOWN 链接：
```html
<a href="/town" className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors">TOWN</a>
```

2. **渲染修复**：修复 BUG-1 即可同时解决。

### 验收标准
- 所有页面（/, /town, /office, /status, /feed）的导航栏包含完整的 5 个链接
- Office 画布中 agent 正常显示为单个小人

---

## BUG-3：tileset-generator 生成的纹理从未被使用 🟠 P1

### 代码路径
```
src/game/tiles/tileset-generator.ts → generateTileset()
  → 生成 'office-tileset' 纹理（320×256px）
  → 被 OfficeScene.preload() 调用

src/game/scenes/OfficeScene.ts → drawTile()
  → 没有使用 'office-tileset'，而是每个 tile 重新创建 Graphics 对象手绘

src/game/scenes/TownScene.ts → drawGroundTile() / drawFurnitureTile()
  → 同样每个 tile 创建独立 Graphics 对象，完全不使用任何预生成纹理
```

### 根因
`tileset-generator.ts` 是一个"死代码"——它确实正确地生成了一张 tileset atlas 纹理（包含地板、墙壁、家具等），但两个 Scene 都没有引用它。两个 Scene 各自用 `this.add.graphics()` 在循环中逐 tile 手绘，造成了：
- **~1400 个独立 Phaser Graphics 对象**（ground 1200 + furniture ~200）
- 每帧 Phaser 需要遍历和 draw call 所有对象
- 首次加载卡顿

### 修复指令（两种方案选一）

**方案 A（最小改动）：** 将 ground/furniture 各自用**一个** Graphics 对象绘制，最后 `generateTexture()` 转为静态 Image：
```ts
// 替代当前的 renderGroundLayer 循环
const gfx = this.add.graphics();
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    // 在同一个 gfx 上绘制所有 tile
    this.drawGroundTileOnGraphics(gfx, x, y, layers.ground[y][x]);
  }
}
gfx.generateTexture('ground-layer', mapWidth, mapHeight);
gfx.destroy();
this.add.image(mapWidth/2, mapHeight/2, 'ground-layer');
```

**方案 B（彻底重构）：** 使用 `tileset-generator.ts` 已生成的 atlas，改用 Phaser `Tilemap` API。

### 验收标准
- 地图渲染使用 ≤4 个 GameObject（ground image + furniture image + overlay + UI）
- 首屏加载无明显卡顿

---

## BUG-4：Social 系统产生大量叠加对话气泡 🟠 P1

### 用户现象
画面上出现大量重叠的对话气泡（如截图中看到的 "Hi there!" "Hey!" 等）。

### 代码路径
```
src/game/systems/SocialInteractionSystem.ts
  → checkProximity() 第 122-147 行
  → startInteraction() 第 153-193 行
```

### 根因

`checkProximity()` 对所有已注册 agent 做两两距离检测：
```ts
const distance = Math.sqrt(dx*dx + dy*dy); // 以 tile 为单位
if (distance <= this.config.interactionDistance) { // 默认 2 tiles
  this.startInteraction(id1, id2, sprite1, sprite2);
}
```

由于 BUG-5（agent 叠堆在同一位置），15 个 agent 中有 10 个距离为 0 → **C(10,2) = 45 个 interaction 同时触发**，每个产生循环播放的对话气泡。

即使 BUG-5 修复后，如果 office 只有 6 个工位，6 个 agent 之间距离仍然 ≤2 tiles → C(6,2) = 15 个同时对话。

### 修复指令
- [ ] 限制每个 agent 同时只能参与 1 个 interaction
- [ ] 增加 interaction 冷却时间（如 30 秒内不重复同一对 agent）
- [ ] 或直接把 `interactionDistance` 改为 1，且限制全局最大并发 interaction 数为 3

### 验收标准
- 同时可见的对话气泡不超过 3 个
- 每个 agent 同时最多参与 1 个对话

---

## BUG-5：Schedule 系统位置分配导致 Agent 叠堆 🟠 P1

### 代码路径
```
src/game/systems/ScheduleSystem.ts
  → getPositionInArea() 第 137-180 行
```

### 根因

位置分配使用 `hash(agentId) % slots.length`，各区域 slot 数量严重不足：

| 区域 | slot 数量 | 定义位置 |
|------|----------|---------|
| office (workstations) | 6 | town-map.ts 第 34-41 行 |
| park (parkBenches) | 3 | town-map.ts 第 46-49 行 |
| residential (homes) | 3 | town-map.ts 第 55-59 行 |
| coffeeShop (cafeTables) | 3 | town-map.ts 第 63-67 行 |
| store | 无固定 slot，随机位置 | ScheduleSystem 第 169-172 行 |

**15 个 agent 映射到 6 个 office slot：**
- `hash("cto") % 6` 和 `hash("main") % 6` 可能得到相同值
- 多个 agent 被分配到完全相同的像素坐标

### 修复指令
- [ ] 位置分配改为**有序 index**：维护一个 `Map<TownArea, number[]>` 记录每个区域已用的 slot index
- [ ] 新 agent 拿到 `nextAvailableSlot = usedSlots.size % totalSlots`
- [ ] 当 slot 全部占满时，在区域空地上加 (slot.x + offset, slot.y + offset) 偏移，偏移量 = `Math.floor(index / totalSlots)` tiles
- [ ] 扩充每个区域的 slot 数量到至少 8 个

### 验收标准
- 同一个坐标上最多只有 1 个 agent

---

## BUG-6：启动时所有 Agent 同时涌入 Office 🟡 P2

### 代码路径
```
src/game/config/schedules.ts 第 16-56 行
src/game/systems/GameTimeSystem.ts — 默认 startHour=9
```

### 根因

所有 3 种 schedule（default / early_bird / night_owl）在 9:00 AM 对应的位置：
- default: `office`（9-12 点）
- early_bird: `office`（7-12 点）
- night_owl: `residential`（2-10 点 sleep）

`getScheduleForAgent()` 用 `hash(agentId) % 3` 分配 schedule。  
大约 2/3 的 agent 在 9AM 的位置是 office → 10+ 个 agent 瞬间全部到达 office。

### 修复指令
- [ ] 增加更多 schedule 变体（remote_worker 在 residential、field_agent 在 park 等）
- [ ] 或让游戏初始时间设为 12:00（午饭时间，agent 分布在 office/coffeeShop/park）
- [ ] 或给每个 agent 随机偏移 0-60 分钟的初始时间

---

## BUG-7：DayNight Overlay 遮挡画面 🟡 P2

### 代码路径
```
src/game/systems/DayNightCycle.ts
  → create() 第 54-67 行: overlay depth=1000, MULTIPLY blend
  → updateVisuals() 第 111-119 行: invertTint + targetAlpha
```

### 根因

Overlay 使用 `MULTIPLY` 混合模式 + `invertTint()` 函数：
```ts
// night tint = 0x4466aa
// invertTint(0x4466aa) = 0xbb9955
// alpha = 1 - 0.5 = 0.5 → targetAlpha = min(0.5, 0.5) = 0.5
```

在夜间，一个半透明的 `0xbb9955` 色矩形叠加在 MULTIPLY 模式上，会让整个画面**明显变暗变棕**，在本已难以辨识的地图上雪上加霜。

同时 overlay depth=1000 和 SocialSystem 的 dialogue bubbles depth=1000-1001 处于同一层级，可能出现渲染顺序冲突。

### 修复指令
- [ ] 夜间 alpha 降低为 0.2-0.3，让画面仍可看清
- [ ] overlay depth 改为 999，确保始终在 UI 元素之下
- [ ] 或暂时禁用 DayNightCycle，待其他视觉问题修复后再启用

---

## BUG-8：地图背景视觉混乱 🟡 P2

### 用户现象
- 办公室地板是高对比棋盘格，非常刺眼
- 各区域之间没有边界，无法区分是什么区域
- 家具色块太小、没有轮廓，看不出是什么物体

### 代码路径
```
src/game/maps/town-map.ts
  → getOfficeFloor(): (x+y)%2==0 ? 0(浅灰0xc2c3c7) : 1(深灰0x5f574f)
  → 区域布局: 5 个区域紧密拼接，无间隔
  → getFurniture(): 返回 tile index

src/game/scenes/TownScene.ts
  → drawGroundTile(): 每种 tile 用 2-3 个 fillRect 绘制
  → drawFurnitureTile(): 物件只有基础色块，无轮廓线
```

### 根因

1. **棋盘格对比度**：浅灰 `0xc2c3c7` 和深灰 `0x5f574f` 亮度差过大
2. **无区域分隔**：地图 5 区域（20×15 + 20×15 + 20×15 + 10×15 + 10×15）直接拼接
3. **家具辨识度**：32px 格内用 2-3 个 `fillRect` 无法表达物体形状，且无轮廓线

### 修复指令
- [ ] 棋盘格两色改为同色系：如 `0xc2c3c7` 和 `0xb0b1b5`（减小亮度差）
- [ ] 区域边界处添加 1 列深色道路 tile（如 `0x3a3a3a`），形成视觉分隔
- [ ] 为家具添加 1px 深色轮廓（`graphics.lineStyle(1, 0x000000, 0.3)`）
- [ ] 每个区域中心添加浮动区域名标签

---

## BUG-9：Agent 无名字标签 🟡 P2

### 代码路径
```
src/game/sprites/AgentSprite.ts — 整个文件无任何文字渲染
```

### 修复指令
- [ ] 在 AgentSprite constructor 中添加 `Phaser.GameObjects.Text` 作为名字标签
- [ ] 位置：sprite 头顶偏上 8px
- [ ] 样式：白色 8px 像素字体，居中，带 1px 黑色描边
- [ ] 长名缩写：`secretary` → `SEC`，`dev-lead` → `DEV`，`ops-assistant` → `OPS`

---

## BUG-10：Sprite 尺寸偏小 🟢 P3

### 根因

- Sprite: 16×24px
- Tile: 32×32px
- Canvas: 800×600px，地图 1280×960px，默认 zoom=1x
- Agent 在画面中的占比约为 1.3%×2.5%，非常小

### 修复指令
- [ ] 默认 zoom 改为 2x（`this.cameras.main.setZoom(2)`）
- [ ] 或 sprite 渲染时 `setScale(1.5)`
- [ ] 需要同步调整 camera bounds 和 UI 元素的 scrollFactor

---

## 用户补充

> 请在此处补充您实际看到的其他问题：

- [ ] （待填写）
- [ ] （待填写）

---

## 修复顺序建议

按依赖关系排序，后项依赖前项的修复：

```
Step 1 — 先让 sprite 正确显示（解除阻塞）
  └─ BUG-1: 添加 texture.add() 帧注册    → 改 1 个函数
  └─ BUG-2: 补全导航链接                  → 改 1 行 HTML

Step 2 — 解决 agent 分布问题
  └─ BUG-5: 位置分配改有序 index           → 改 getPositionInArea()
  └─ BUG-6: 初始时间分散                   → 改 schedules.ts

Step 3 — 控制对话气泡
  └─ BUG-4: 限制并发 interaction           → 改 checkProximity()

Step 4 — 视觉优化
  └─ BUG-8: 地图背景改善                   → 改 town-map.ts + drawGroundTile
  └─ BUG-9: 名字标签                       → 改 AgentSprite constructor
  └─ BUG-7: DayNight overlay 参数          → 改 DayNightCycle.ts
  └─ BUG-10: 缩放调整                      → 改 TownScene.create()

Step 5 — 性能优化
  └─ BUG-3: 用单个 Graphics + generateTexture 替代 1400 个对象
```
