# 开发与发布指南

## 本地开发

### 环境与调试

使用 Node.js 24，与 `.nvmrc` 和 CI 保持一致。

```bash
npm ci
npm test
```

推荐直接打开 `.vscode/refclip.code-workspace`，工作区中已包含编译、单元测试、CT、打包和持续编译任务，以及 **RefClip: Run Extension** 和 **RefClip: Debug CT runner** 调试配置。按 F5 可启动扩展，默认在开发宿主中打开项目目录。也可以按原方式打开仓库文件夹，使用 **Run RefClip**。开发宿主打开后，通过“文件 → 打开文件夹”选择测试项目。

若希望每次自动打开该目录，在 `.vscode/launch.json` 的 `args` 中添加测试项目绝对路径。TypeScript 由 watch task 自动编译；修改后在宿主执行 **Developer: Reload Window**。

### 打包与目录

```bash
npm run package
code --install-extension out/refclip-0.3.0.vsix --force
```

包名从 `package.json` 自动生成，输出目录固定为 `out/`，与编译后的 JavaScript 放在同一目录。`.vscodeignore` 使用允许列表，仅收录运行文件、清单、翻译、README、许可证和截图；不会把已有 VSIX 嵌入新包。

`out/` 不纳入 Git。README 使用的截图和视频统一放在 `docs/.assets/README.md/`，引用路径以 `./` 开头。新增附件时使用能说明内容的文件名，并补上图片说明或视频标题。

## 自动检查

### CI workflow

`.github/workflows/ci.yml` 在分支推送、PR、手动触发和其他 workflow 调用时运行。

CI 在 Ubuntu 上执行 `npm ci`、`npm test`、`xvfb-run -a npm run test:ct` 和 `npm run package`，并上传 `out/*.vsix`，产物保留 14 天。任一步骤失败都会阻止发布。扩展没有原生运行依赖，生成的 JavaScript 和 VSIX 可供三个平台使用，因此不重复构建。路径测试显式覆盖 Windows 和 POSIX 规则；真实 VS Code 的跨平台交互仍需人工验证。

测试使用 Node.js 自带测试框架。删除测试时应确认它只覆盖已删除的功能，或确实重复；范围、路径、配置兼容、过期选项保护和翻译完整性属于需要保留的回归检查。

### 人工验收

发布前在开发宿主确认：

1. 非空选区原样复制；空选区选择最小符号，无符号时复制当前行。
2. 面板能列出嵌套函数、类和折叠代码块，范围与编辑器一致。
3. 小灯泡显示 `RefClip.` 前缀和文本符号；右键快捷项可以执行。
4. 三种路径格式、两个按钮开关和位置设置均生效。
5. 切换英文、简体中文后，设置说明和下拉选项完整显示。
6. 文档变化后不能复制旧选项；关闭文档后也不能复制旧引用。

CT 会启动真实 VS Code，但通过 API 执行操作，不验证菜单渲染、图标颜色和鼠标点击，所以仍需人工检查这些界面行为。

## 发布 GitHub Release

### 版本与触发方式

`.github/workflows/release.yml` 由推送 `v*` 标签触发。例如包版本为 `0.3.0` 时，标签必须为 `v0.3.0`。

更新版本时先执行 `npm version <新版本> --no-git-tag-version`，同步 `package.json` 和锁文件，再提交版本变更。检查通过后创建并推送标签，例如：

```bash
git tag -a v0.3.0 -m "RefClip 0.3.0"
git push origin v0.3.0
```

该命令会启动发布流程，请只对准备发布的提交执行。workflow 的流程为：

1. 核对标签、`package.json` 和锁文件根版本。
2. 调用同一份 CI workflow，完成检查与打包。
3. 下载本次运行的通用 VSIX，创建 GitHub Release 并附加安装包。

发布使用仓库自带的 `GITHUB_TOKEN`，仅发布 job 拥有 `contents: write` 权限，无需额外 PAT。仓库或组织策略需要允许 Actions 创建 Release。已有同名 Release 时创建步骤会失败，不覆盖已发布文件。

失败时可以重跑对应 workflow；如需修复已发布版本，应使用新版本和新标签。工作流不会修改源码、提交版本或自动创建标签。

### Marketplace

发布者 ID 为 `Huffer342`，扩展 ID 为 `Huffer342.refclip`。正式版本标签会在 CI 通过后，分别发布到 GitHub Release 和 VS Code Marketplace；两个 job 使用同一份已测试的 VSIX。带 `-` 的预发布标签只走 GitHub Release，不上传商店。

首次使用前需要配置 Microsoft Entra ID：

1. 在 Azure 创建用户分配的托管标识，并添加 GitHub 联合凭据，绑定本仓库的 `marketplace` 环境。
2. 在 GitHub 创建 `marketplace` Environment，发布规则允许 `v*` 标签。在该环境的 Variables 中设置 `AZURE_CLIENT_ID` 和 `AZURE_TENANT_ID`，分别为托管标识的客户端 ID 和租户 ID，不能使用订阅 ID。
3. 首次手动运行 `Verify Marketplace identity` workflow 时，取消 `verify_publish_rights`，读取摘要中的 Marketplace member ID；添加成员后启用该选项再运行一次，验证发布权限。验证运行所在分支或标签必须被环境规则允许；若临时允许 `main`，完成后移除规则。
4. 在 Marketplace 的 `Huffer342` 发布者 Members 中添加查询得到的 ID，授予 Contributor 角色。
5. 提交发布配置后，更新版本并推送新的 `v<版本>` 标签。已有 `v0.3.0` 不会自动使用后续修改的 workflow。

发布 job 使用 `azure/login` 交换 GitHub OIDC 令牌，再通过 `vsce publish --azure-credential --packagePath` 上传已测试的 VSIX，不需要 PAT。身份验证失败会使 Marketplace job 失败，但不影响独立的 GitHub Release job。处理权限后，在 Actions 中选择 **Re-run failed jobs**，避免重复执行已经发布成功的步骤。商店不允许覆盖已发布版本，修改内容后应使用新版本。

README 源文件仍使用 `./` 相对链接；`vsce package` 会将包内 README 的相对链接改写为 GitHub HTTPS 地址，供商店展示。

参考：[VS Code 官方发布指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。

参考：[GitHub CLI Release 命令](https://cli.github.com/manual/gh_release_create)、[VS Code 扩展清单](https://code.visualstudio.com/api/references/extension-manifest)。

## 组件测试（CT）

现有单元测试验证范围边界、路径格式、配置兼容、提示转换和入口逻辑，能阻止这些行为被后续修改破坏。但它们使用 VS Code API stub，不能证明扩展能在真实宿主里激活，也不能覆盖跨进程参数传递。

`npm run test:ct` 使用官方 `@vscode/test-electron` 下载并启动独立的 VS Code，测试目录、用户配置和扩展目录均为临时目录，不安装到日常使用的 VS Code。默认测试 stable，可通过 `VSCODE_TEST_VERSION` 指定其他版本。也可设置 `VSCODE_EXECUTABLE_PATH`，使用本机已有的 VS Code 可执行文件，跳过下载；测试用户目录仍然隔离。首次运行需要联网下载 VS Code；这只是开发测试工具的网络行为，插件运行时仍不联网。

CT 验证真实激活、复制命令、剪贴板、符号和折叠 API、Code Action 参数传递与过期保护、配置更新、旧命令，以及内置 TypeScript 语言服务。确定性用例通过官方 API 注册测试 provider，另有真实 TypeScript provider 用例。Linux 无图形界面时使用 `xvfb-run -a npm run test:ct`；工作流已经配置该命令。CT 失败会阻止打包和 Release。

## 翻译文件

翻译源文件集中放在 `l10n/manifest/`。安装依赖时的 `prepare`、编译和打包会执行 `scripts/prepare-localization.cjs`，在根目录生成 VS Code 要求的 `package.nls*.json`。根目录文件已加入 `.gitignore`，请只编辑源目录。

新增语言时，在源目录增加 `package.nls.<locale>.json`，保持与英文文件相同的键，再执行 `npm test`。检查会覆盖目录中的所有语言及生成文件。打包规则自动包含生成的所有语言，不需要逐个修改清单。
