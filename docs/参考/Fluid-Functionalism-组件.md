# Fluid Functionalism 组件 · 参考 · 2026-09-17

用户给的外部组件规范，**之后设计网页版界面时要用到**。这里只记"有什么、怎么用、和我们现有东西哪里对不上"，还没决定采用，也还没装。

文档站：<https://www.fluidfunctionalism.com/docs>

## 为什么现在没装

`web/` 是 Vite + TypeScript + three.js，**没有 React、没有 Tailwind、没有 shadcn、没有 `@/` 别名**。这三个组件都要求 shadcn 式项目（Tailwind v4、`@/` 别名、加载 Inter 可变字体做字重动画）。直接装等于给 `web/` 换技术栈，要先写方案评审（CLAUDE.md 硬规矩）。

和已定的事对不上的地方，采用前要先说清楚：

| 组件要求／默认 | 已定的 | 出处 |
|---|---|---|
| Inter 可变字体，字重动画 | 标题思源宋体，正文系统中文栈 | `../方案/网页版-院子页面与天气-方案-2026-09-17.md` 3.2 |
| 自带配色与 shadcn 令牌 | 米白薄面、珊瑚 `#C25A3E` 唯一强调、深墨字，傍晚后整套换浅字 | 同上；`docs/决策/2026-09-12` 第 12 条 |
| 自带圆角 | 面 20、控件 14、胶囊全圆三档，不新开 | 同上 |
| 尺寸阶梯 36 / 28px | 未定 | — |
| `--overwrite` 会覆盖同名 `button.tsx`、`dialog.tsx` 等 | `web/` 目前没有这些文件 | — |

值得借的是**交互层**：Fluid Hover（高亮跟着光标走到最近一项、不闪、点缝隙归给亮着的那项）可以对应地点轨 C6、天色盘 C7 这类一排可选项。

## 安装命令（采用时再跑，在 shadcn 式项目根目录）

```bash
npx shadcn@latest add https://www.fluidfunctionalism.com/r/use-fluid-hover.json --overwrite
npx shadcn@latest add https://www.fluidfunctionalism.com/r/base/button.json --overwrite
npx shadcn@latest add https://www.fluidfunctionalism.com/r/card.json --overwrite
```

`--overwrite` 不加的话，CLI 遇到已有同名文件会逐个询问，在非交互 shell 里直接退出、一个组件都不写。装好的文件落在 `components/ui`、`lib`、`hooks`；**用 props 和 className 组合，不改源文件**。Button 是 Base UI 版，Radix 版 API 相同：`/r/button.json`。

## Fluid Hover

```tsx
import { useRef } from "react";
import { useFluidHover, useRegisterFluidHoverItem } from "@/hooks/use-fluid-hover";
import { FluidHoverHighlight } from "@/components/ui/fluid-hover-highlight";

function List({ rows }: { rows: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(containerRef); // { axis: "y" | "x" | "xy" }
  return (
    <div ref={containerRef} className="relative flex flex-col p-2" {...hover.handlers}>
      <FluidHoverHighlight hover={hover} className="rounded-lg" />
      {rows.map((label, i) => <Row key={label} index={i} registerItem={hover.registerItem}>{label}</Row>)}
    </div>
  );
}
// Row 里：const ref = useRef<HTMLButtonElement>(null); useRegisterFluidHoverItem(registerItem, index, ref);
// 渲染 <button ref={ref} className="relative z-10 ...">
```

| 名字 | 类型（默认） | 说明 |
|---|---|---|
| `axis` | `"y" \| "x" \| "xy"`（`"y"`） | 钩子选项。列表 y，横条 x，网格 xy |
| `isItemDisabled` | `(el) => boolean` | 钩子选项。跳过某项：不亮、不可点 |
| `gapClick` | `boolean \| { maxDistance? }`（`true`） | 钩子选项。点在两项之间算点亮着的那项 |
| `handlers` | `{ onMouseEnter, onMouseMove, onMouseLeave, onClick }` | 返回值，展开到容器上 |
| `registerItem` | `(index, el \| null) => void` | 返回值，经 `useRegisterFluidHoverItem` 交给每行，下标从 0 起 |
| `activeIndex` | `number \| null` | 返回值，亮着的项；同时写在该项的 `data-fluid-hover-active` |
| `setActiveIndex` | `(index \| null) => void` | 返回值，自己点亮，用于键盘焦点 |
| `remeasure` | `() => void` | 返回值，重新量并在量完前隐藏高亮；弹层打开时调 |
| `FluidHoverHighlight hover` | 钩子返回值 | 高亮自己从里面取需要的 |
| `FluidHoverHighlight transition` | `Transition \| false`（`spring.fast`） | 移动动画；`false` 在重排后直接定位 |

## Button

```tsx
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";

<Button variant="primary">Primary</Button>
<Button variant="secondary" leadingIcon={Plus}>Create</Button>
<Button variant="tertiary" trailingIcon={ArrowRight}>Next</Button>
<Button variant="ghost">Ghost</Button>
<Button loading>Saving</Button>
<Button disabled>Disabled</Button>
```

| 名字 | 类型（默认） | 说明 |
|---|---|---|
| `variant` | `"primary" \| "secondary" \| "tertiary" \| "ghost"`（`"primary"`） | 样式 |
| `size` | `"default" \| "compact" \| "icon" \| "icon-compact"`（取 SizeProvider） | 36px 默认、28px 紧凑 |
| `loading` | `boolean`（`false`） | 显示转圈并禁用 |
| `active` | `boolean`（`false`） | 强制按下态，比如它打开的菜单正开着 |
| `leadingIcon` / `trailingIcon` | 图标组件 | 文字前／后的图标 |
| `asChild` | `boolean`（`false`） | 把 props 合并到子元素上，不渲染 `<button>` |
| `disabled` | `boolean`（`false`） | 禁用 |

## Card

```tsx
import {
  Card, CardGroup, CardHeader, CardMedia,
  CardTitle, CardDescription, CardFooter, CardButton,
} from "@/components/ui/card";
import { Circle } from "lucide-react";

<CardGroup orientation="inline">
  <Card onClick={() => open(item)}>
    <CardMedia icon={Circle} />
    <CardHeader>
      <CardTitle>Fluid motion</CardTitle>
      <CardDescription>Spring-tuned transitions across three tiers</CardDescription>
    </CardHeader>
    <CardFooter><CardButton>Connect</CardButton></CardFooter>
  </Card>
</CardGroup>
```

| 名字 | 类型（默认） | 说明 |
|---|---|---|
| `onClick` | `() => void` | 整张卡可点（拉伸按钮） |
| `href` | `string` | 整张卡是链接（拉伸锚点） |
| `selected` | `boolean`（`false`） | 常驻选中底色、标题加重，叠在 fluid hover 上 |
| `disabled` | `boolean`（`false`） | 变淡并禁用 |
| `dismissible` | `boolean`（`false`） | 有关闭按钮，悬停或聚焦时出现 |
| `onDismiss` | `() => void` | 按关闭时调用 |
| `CardGroup orientation` | `"card" \| "inline"`（`"card"`） | 竖排或横排一行 |
| `CardGroup columns` | `number`（`1`） | 网格列数；大于 1 时开二维 fluid hover |
| `CardGroup border` | `"none" \| "outlined"`（`"none"`） | 无边框加分隔线，或画边框 |
| `CardGroup separated` | `boolean`（`false`） | 分开的独立卡片加间距，而不是一整块分隔 |

## ChatMessage

```bash
npx shadcn@latest add https://www.fluidfunctionalism.com/r/chat-message.json --overwrite
```

```tsx
import { ChatMessage } from "@/components/ui/chat-message";
import { Copy } from "lucide-react";

const actions = <button aria-label="Copy"><Copy size={13} /></button>;

<div className="flex flex-col gap-2">
  <ChatMessage from="user" time="Wednesday 6:06 PM" actions={actions}>
    What does "good design" actually mean?
  </ChatMessage>
  <ChatMessage from="assistant" actions={actions}>
    Good design is mostly invisible. You only notice it when it is missing.
  </ChatMessage>
</div>
```

| 名字 | 类型（默认） | 说明 |
|---|---|---|
| `from` | `"user" \| "assistant"` | user 右对齐强调色气泡；assistant 左对齐纯文字无底 |
| `children` | ReactNode | 消息正文；省略则只显示附件 |
| `time` | ReactNode | 悬停才出现的元信息行里的时间，只对 user 生效，调用方自己格式化 |
| `actions` | ReactNode | 时间旁的纯图标按钮；这一行始终占高度，出现时不跳 |
| `files` | `File[]` | 气泡上方的方形缩略图，支持图片和 PDF |
| `thumbnailSize` | `number`（64） | 缩略图边长 px |
| `className` | string | 合到外层动效容器上，比如改最大宽度 |

源码里的细节：气泡最大宽 80%；字 14px（紧凑 13）、上下内边距 8px、左右 14px；元信息行 12px（紧凑 11）、等宽数字；入场透明 0 → 1、下移 8px、缩放 0.96 → 1，从贴边那个角长出，moderate 档；`layout="position"` 让旧消息平移让位；触屏上元信息行常显；流式输出的助手消息**不用** `text-wrap: pretty`，否则每来一个字前面几行会重新折行。

## CommandMenu

```bash
npx shadcn@latest add https://www.fluidfunctionalism.com/r/base/command-menu.json --overwrite
```

输入过滤动作列表，方向键移动，回车执行；行上有快捷键帽、分组、建议，以及全局快捷键唤起的弹窗外壳。文档：<https://www.fluidfunctionalism.com/docs/command-menu>。

源码里的细节：弹窗高 `min(440px, 76dvh)`，距顶 `max(12dvh, 50dvh − 220px)`；输入框字 14px（紧凑 13）；快捷键帽高 20px、字 11px；底栏高 40px、字 12px；列表高度变化走 moderate 档。

## 共用的底层令牌（源码读出）

- 字号角色：display 28／title 16／subtitle 14／body 13／caption 12，紧凑档各降 1。
- 控件阶梯：默认 36px 高、13px 字、16px 图标、左右 12px；紧凑 28px、12px、14px、10px。
- 动效：fast 80ms、moderate 160ms 不回弹；slow 240ms 回弹 0.12；退场各为 60／120／160ms 补间。
- 字重：Inter 可变，`wght/opsz` 成对 400/14、450/15、550/18、700/25，保证加粗不改字宽。
- 悬停／按下填充：白天黑 4%／7%，夜里白 6%／10%；焦点环 1px 外偏 2px。
- 圆角：rounded 档 8px（容器 12），pill 档 20px（容器 24）。

以上怎么借到网页版，见 [../方案/网页版-控件细节借鉴Fluid-方案-2026-09-17.md](../方案/网页版-控件细节借鉴Fluid-方案-2026-09-17.md)。
