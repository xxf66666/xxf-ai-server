# ADR 0007 — 国际化方案：扁平化 dict + Context hook

- **状态**：已采纳
- **日期**：2026-04-18
- **决策人**：xxf

## 背景

目标用户有中英双语需求：前端所有页面都要能一键切换语言。候选方案：

1. **next-intl**：Next.js 官方推荐，功能全（含复数规则、日期格式化、路由前缀）
2. **react-i18next**：React 生态老牌
3. **自研 Context + dict**：轻量，但少了生态（复数、ICU 语法）

## 决策

**自研**：`lib/i18n/dict.ts` + `lib/i18n/context.tsx` + `useT()` hook + 
`<LocaleSwitcher>` 切换器。

## 关键实现

- `dict.ts` 导出 `en` 和 `zh` 两个对象，键相同。类型
  `Dict = Record<keyof typeof en, string>` 保证两边键同步（漏译 zh 值 → typecheck 失败）。
- `DictKey = keyof typeof en`，`t()` 签名 `t(key: DictKey, params?): string`，
  带 `{name}` 参数替换。
- 使用 `as const` 的 `en` 被类型化，IDE 能自动补全所有字典键。
- `I18nProvider` 用 `localStorage` 持久化选择；首次加载按 `navigator.language`
  `'zh'` 前缀自动挑中文。
- SSR **固定渲染英文**，挂载后用 `useEffect` 切到用户选择的语言 —— 避免 Next.js
  hydration mismatch 警告。
- 客户端开销：约 `dict.ts` 文件大小（gzip 后 ~6 KB），Context 本身零运行时。

## 后果

**优点**

- 零依赖。不装 100 KB+ 的库也能满足 2 种语言、200+ 键。
- 类型安全：`useT()('invites.title')` 在 IDE 有自动补全，键打错立刻报错。
- 参数替换简单（`t('hello', { name: 'Alice' })` → `'hello {name}'` → `'hello Alice'`）。
- 运营想加第三种语言只需新增一个 `ko: Dict = {...}` 对象 + 把 `'ko'` 加入
  `LOCALES`。
- 没用路由前缀（`/zh/dashboard` 之流），URL 保持稳定。

**缺点**

- **不支持复数规则**。`'1 item' vs '3 items'` 这种只能手工写两个键或用条件。
- **不支持日期/货币格式化**。全靠 `Intl.NumberFormat` / `Intl.DateTimeFormat` 自己
  调用，按 `locale` 参数传。
- **没做服务端翻译**。SSR 阶段固定英文，这让首屏英文用户看着自然，中文用户会见到
  一瞬间的英文闪烁 —— 可接受。

## 未来迁移路径

如果规模涨到：

- 超过 **3 种语言**
- 需要**复数规则**（阿拉伯语、波兰语等复杂复数）
- 需要**服务端 SEO**（翻译后的页面被搜索引擎抓取）

→ 迁移到 **next-intl**。当前扁平 dict 的结构可以一对一映射到 next-intl 的 JSON
messages，迁移成本可控。

## 实现

相关文件：
- `apps/web/lib/i18n/dict.ts`：中英字典
- `apps/web/lib/i18n/context.tsx`：Provider + hook
- `apps/web/lib/i18n/LocaleSwitcher.tsx`：EN / 中 按钮组

## 备选方案

- **next-intl**：被拒于当前规模。它的好处（复数、ICU、路由前缀、messages 按页切割）
  在我们只有 2 种语言、100+ 键的情况下没必要。
- **react-i18next**：同上，且 i18next 的 Hook API 不如自研的 `useT()` 类型友好。
