# RefClip

**在 VS Code 中，一键复制选区、函数、类或代码块的引用，直接粘贴到聊天框或开发笔记里。**

复制格式可以自己定，文件路径、行号和符号名都能按需组合。

https://github.com/user-attachments/assets/0c1cb1d5-b47a-4969-9a87-9ea2aa454f3d

<video controls src="./docs/.assets/README.md/overview.mp4" title="RefClip 使用演示"></video>

[查看使用演示视频](./docs/.assets/README.md/overview.mp4)

## 安装

1. 打开 [Releases](https://github.com/Huffer342-WSH/Ref-Clip/releases)，下载所需版本的 `.vsix` 文件。
2. 在 VS Code 扩展视图右上角的菜单中选择 **从 VSIX 安装…**。
3. 选择下载的文件，按提示重新加载窗口。

需要 VS Code **1.85 或更新版本**。
要识别函数、类等符号，需要启用对应的语言扩展，并确保 VS Code 大纲中能看到这些符号。

## 使用

### 快捷复制

选好代码后，点击底部状态栏的 **Ref**：

- 选中了代码：只引用选中的范围，不会自动扩大到整个函数。
- 没有选区：引用光标所在的最小符号，比如函数或方法；找不到符号就引用当前行。

复制后，直接粘贴到需要的地方即可。状态栏会短暂显示复制结果。

<p align="center">
<img src="./docs/.assets/README.md/status-bar.png" alt="状态栏中的 Ref 快捷复制按钮和 Refs 选项按钮" height="50" style="width: auto;">
</p>

### 选择函数、类或代码块

点击状态栏的 **Refs** 打开引用选项面板。列表先显示当前选区或当前行，再从小到大列出包住这段代码的符号和折叠代码块。

符号使用类似 VS Code 大纲的类型图标。代码块会显示折叠首行；如果可以从首行识别 `if`、`for` 等关键字，也会显示相应提示。

<p align="center">
<img src="./docs/.assets/README.md/reference-options.png" alt="引用选项面板，按范围大小列出符号和代码块" height="195" style="width: auto;">
</p>

右键 **RefClip** 子菜单还提供三个直接复制项：

| 菜单项             | 复制目标                           |
| ------------------ | ---------------------------------- |
| 复制选区 / 当前行  | 当前选中的范围；无选区时为当前行   |
| 复制最小符号       | 包含选区或光标的最小函数、类等符号 |
| 复制最小折叠代码块 | 包含选区或光标的最小折叠范围       |

如果没找到对应的符号或代码块，插件会提示你，不会覆盖剪贴板里的内容。

<p align="center">
<img src="./docs/.assets/README.md/context-menu.png" alt="RefClip 右键菜单中的快捷复制选项" height="500" style="width: auto;">
</p>

### 使用小灯泡

在编辑器中按 **Ctrl+.**，macOS 使用 **Cmd+.**，或点击小灯泡，在“更多操作”中选择以 **RefClip.** 开头的项目。

这里用 `ƒ`、`◇`、`▱`、`{}` 等文本符号区分类型。VS Code 不允许扩展自定义小灯泡的分组标题，因此 RefClip 使用“更多操作”分组。

<p align="center">
<img src="./docs/.assets/README.md/code-actions.png" alt="小灯泡菜单中的 RefClip 引用选项" height="247" style="width: auto;">
</p>

## 常用设置

在 VS Code 设置中搜索 `@ext:refclip.refclip`，就能找到插件的全部设置。

### 路径格式

`refclip.pathStyle` 决定默认模板中的链接目标：

| 设置值              | 路径基准                   | 示例                             |
| ------------------- | -------------------------- | -------------------------------- |
| `absolute`，默认    | 系统绝对路径               | `/home/user/project/src/user.ts` |
| `workspaceRelative` | 当前文件所属的工作区文件夹 | `./src/user.ts`                  |
| `fileRelative`      | 当前文件所在目录           | `./user.ts`                      |

如果 AI 编程助手和 VS Code 能访问同一份文件，可以优先用绝对路径，减少工作目录不同带来的歧义。如果要把引用分享给别人，或在不同机器上使用，相对路径通常更方便，但双方需要约定相同的基准目录。

### 状态栏按钮设置

下面的配置使用工作区相对路径，保留两个按钮，并将它们放在状态栏右侧：

```json
{
  "refclip.pathStyle": "workspaceRelative",
  "refclip.quickCopyBehavior": "selectionOrSymbol",
  "refclip.showQuickCopyButton": true,
  "refclip.showOptionsButton": true,
  "refclip.statusBarAlignment": "right",
  "refclip.statusBarPriority": -100
}
```

`quickCopyBehavior` 可选值：

| 设置值                    | 点击 Ref 后的行为                    |
| ------------------------- | ------------------------------------ |
| `selectionOrSymbol`，默认 | 优先选区，否则最小符号，再回退当前行 |
| `selection`               | 选区或当前行                         |
| `symbol`                  | 最小所属符号                         |
| `block`                   | 最小所属折叠代码块                   |

不需要的按钮可以单独关闭。`statusBarAlignment` 可设为 `left` 或 `right`；`statusBarPriority` 越大，按钮在所选一侧越靠左。位置设置立即生效，不过，其他扩展的按钮仍有可能插在两者之间。

### 自定义复制文本

插件会把文件名、行号和符号名填入模板。你可以直接使用下面的示例，也可以按自己的习惯修改。

#### Codex 模板（默认）

粘贴给 Codex 时，可以使用 RefClip 默认的 Markdown 链接模板，在文本中同时提供文件路径和行号。普通范围和符号使用不同的链接文字：

```json
{
  "refclip.rangeTemplate": "[{fileName}#L{startLine}-L{endLine}]({path}#L{startLine}-L{endLine})",
  "refclip.singleLineTemplate": "[{fileName}#L{startLine}]({path}#L{startLine})",
  "refclip.symbolTemplate": "[{fileName} {symbolName}]({path}#L{startLine}{lineRangeSuffix})"
}
```

复制结果示例：

```text
[user.ts#L20-L35](/home/user/project/src/user.ts#L20-L35)
[user.ts#L20](/home/user/project/src/user.ts#L20)
[user.ts createUser](/home/user/project/src/user.ts#L20-L35)
```

#### Claude Code 模板

如果主要粘贴到 Claude Code，可以使用 `@文件路径#起始行-结束行` 格式。

> [Claude Code 官方 VS Code 文档](https://code.claude.com/docs/en/ide-integrations)使用的行号格式是 `#5-10`，不带 `L` 前缀。

将下面的配置加入 VS Code 设置：

```json
{
  "refclip.rangeTemplate": "@{relativePath}#{startLine}-{endLine}",
  "refclip.singleLineTemplate": "@{relativePath}#{startLine}",
  "refclip.symbolTemplate": "@{relativePath}#{startLine}-{endLine} ({symbolName})"
}
```

复制结果示例：

```text
@./src/user.ts#20-35
@./src/user.ts#20
@./src/user.ts#20-35 (createUser)
```

这些示例使用工作区相对路径。请让 Claude Code 使用同一个工作区目录作为基准。

#### 模板变量

| 变量                                                       | 含义                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `{path}`                                                   | 跟随路径格式设置的路径                               |
| `{absolutePath}` / `{relativePath}` / `{fileRelativePath}` | 固定使用绝对路径 / 工作区相对路径 / 文件目录相对路径 |
| `{fileName}`                                               | 文件名                                               |
| `{startLine}` / `{endLine}`                                | 起止行号，从 1 开始                                  |
| `{startCharacter}` / `{endCharacter}`                      | 起止字符偏移，从 0 开始，结束位置不包含在内          |
| `{symbolName}` / `{symbolKind}`                            | 符号名称 / VS Code 符号类型编号                      |
| `{lineRangeSuffix}`                                        | 单行为空，多行为 `-L` 加结束行号                     |

模板仅替换变量，不执行代码。缺失的可选值替换为空文本，未知变量保持原样。旧模板若写死了 `{absolutePath}`，需要改为 `{path}` 才会跟随路径设置。

选项面板的符号提示可以单独设置，不影响复制内容：

```json
{
  "refclip.symbolOptionTemplate": "{symbolIcon} {symbolName} · {symbolKind} → {range}"
}
```

这里的 `{symbolKind}` 显示类型名称，`{symbolIcon}` 显示大纲图标，`{range}` 显示行号范围。

## 使用说明与限制

- 多光标时只处理主选区；选区终点位于下一行第 0 列时，不包含该行。
- 符号引用使用当前文件中的声明信息，不会从函数调用跳转到定义。
- Block 使用 VS Code 返回的折叠范围，可能不包含闭合大括号。手动创建的折叠范围不在该 API 的返回结果中。
- `if`、`for` 等提示来自折叠首行，不代表完整语法解析。

## 开发与贡献

### 环境

安装 Node.js 24 和 VS Code 1.85 或更新版本，在项目根目录安装依赖：

```bash
npm ci
```

### 开发调试

打开 [RefClip 工作区](./.vscode/refclip.code-workspace)，选择 **RefClip: Run Extension** 并按 **F5**。工作区已包含任务和调试配置，开发宿主窗口可以打开要测试的项目文件夹。

修改源码后会自动编译；在开发宿主中执行 **Developer: Reload Window** 加载更新。

```bash
npm test          # 单元测试
npm run test:ct   # 真实 VS Code 宿主组件测试
```

### 打包

```bash
npm run package
```

安装包生成在 `out/refclip-<版本>.vsix`，可通过 VS Code 的“从 VSIX 安装…”命令安装。

进一步说明见 [架构文档](./docs/architecture.md)和[开发与发布指南](./docs/development.md)。

问题反馈请使用 [Issues](https://github.com/Huffer342-WSH/Ref-Clip/issues)。

本项目采用 [MIT 许可证](./LICENSE)。
