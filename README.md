# 书语 Shuyu

> 在书里，学会一门语言。

[下载 Android APK（v1.3.1）](https://github.com/Petey-PKU/shuyu/releases/download/v1.3.1/Shuyu-v1.3.1-release.apk) · [查看 v1.3.1 发布说明](https://github.com/Petey-PKU/shuyu/releases/tag/v1.3.1) · [历史版本](https://github.com/Petey-PKU/shuyu/releases)

书语是一款面向中文母语学习者的开源英语语境阅读 App。用户导入自己有权使用的英文读物，在原文里点词查义、听发音、收藏带语境的生词，再用原句复习。当前支持英文 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8，以及数字文本型和英文扫描版 PDF。

> 当前稳定版本为 v1.3.1，Android 优先，基于 Expo / React Native / TypeScript。它不是书城，也不内置受版权保护的书籍。

产品与技术标识的统一命名约定见 [BRAND.md](./BRAND.md)。

## 下载安装

从 [GitHub Releases](https://github.com/Petey-PKU/shuyu/releases/tag/v1.3.1) 下载最新正式版，或直接下载 [Shuyu-v1.3.1-release.apk](https://github.com/Petey-PKU/shuyu/releases/download/v1.3.1/Shuyu-v1.3.1-release.apk)。安装包已内置离线英语音色，大小约 340 MB；首次安装时，Android 可能要求为浏览器或文件管理器临时开启“安装未知应用”权限。

APK SHA-256：`ED05055B0EF55EDF2CDAE6533647C3174DE83410AA1836DB30E927F8344EA1FE`

v1.3.1 重点加入真实文字布局分页、左右点击与滑动翻页、字号即时预览和内置 Piper Amy 离线神经音色；同时包含 EPUB/MOBI/AZW3/KF8/PDF 导入、英文扫描版 PDF OCR 和整句翻译兼容性改进。

## 已实现

- 导入 UTF-8 编码的 `.txt`、无 DRM 的 `.epub` / `.mobi` / `.azw3` / `.kf8`，以及数字文本型或英文扫描版 `.pdf`
- EPUB 2/3 目录、书名、作者和正文解析，并兼容常见路径编码、大小写差异与字体混淆
- MOBI 7 与 AZW3/KF8 目录、元数据和正文解析；Android 文件选择器对缺失或错误的 AZW3 MIME 类型进行扩展名与 `BOOKMOBI` 文件头识别，并在 KF8/MOBI 解析路径间安全回退
- PDF 优先本地提取文本层，Android 扫描版自动提示并逐页离线 OCR；TXT/PDF 自动识别英文 `Chapter / Part / Book` 分章
- 本地书架、阅读进度和最近阅读
- 设置中可将书籍正文、进度、生词、统计和偏好导出为本地 JSON 备份，并在另一台正式安装包中恢复
- 书架支持编辑导入书籍的书名与作者
- 纸张、明亮、夜间三种阅读主题，字号和行高调节；阅读器用当前段落即时预览，确认后按当前位置重新分页
- 内置 120,000 词条 ECDICT Core，点词中文释义与词形还原无需联网
- 可主动开启的整句在线翻译增强；默认保持离线，开启后由手机直连必应网页翻译兼容模式，并以 MyMemory 兜底，也可优先配置自有正式翻译代理
- 英文单词、句子及当前页朗读；Android APK 内置可离线使用的 Piper Amy 神经音色，也可切换到设备系统音色
- 长章节依据设备实际文字布局切成固定书页，只渲染当前页的可点词节点；支持左右边缘点击和横向滑动翻页
- 生词收藏、来源原句、掌握状态与遮词复习
- 到期生词复习；选择“再看看”后 10 分钟可再次复习，复习页显示下次可复习时间
- 阅读分钟、词数和连续天数统计
- 首页区分今日阅读分钟与累计阅读统计
- 可在设置中关闭新增阅读统计，不影响阅读进度
- 可设置每日 10、15、20 或 30 分钟阅读目标
- A1–C2 本地阅读水平测试、72 本分级推荐、兴趣筛选与想读收藏
- 推荐只提供选书信息，不提供图书下载、购买、试读或搜索入口
- 原文、进度和生词默认保存在设备本地
- 本地记录读取失败时提供重新读取入口，避免把读取失败误当成空书架

## 快速运行

需要 Node.js 22 LTS、npm，以及 Android 手机上的 Expo Go 或 Android 模拟器。

```bash
npm install
npm run start
```

终端出现二维码后，用 Expo Go 扫码。也可以运行：

```bash
npm run android
npm run web
```

PDF 文本提取、OCR 与内置离线音色使用原生模块，不能在 Expo Go 或 Web 预览中完整测试；请使用正式安装包。Android 支持文本层提取、英文扫描版 OCR 和内置 Amy 音色，iOS 当前只支持文本层提取并回退到系统音色。TXT、EPUB、MOBI 与 AZW3/KF8 不受此限制。

Web 预览用于体验界面和 TXT/EPUB/MOBI 导入，暂不载入随包 SQLite 离线词典；关闭在线增强时仅使用内置基础兜底，开启后未收录词才会请求在线服务。

本地备份需要 Android / iOS 的系统目录选择器；Web 预览不支持选择本地备份目录。

## 验证

正式 Android APK 发布前，请按 [Android 发布前验收清单](./ANDROID_ACCEPTANCE.md) 在真实设备上验证文件导入、离线词典、离线语音、OCR 取消、后台恢复和备份恢复。Web 预览与 Android bundle 导出只能证明打包和界面代码可用，不能替代真机验收。

```bash
npm run typecheck
npm test
npm run test:translation
npm run test:dictionary
npm run test:translation-proxy
npm run export:android
```

`export:android` 验证 Android 生产 bundle。

若 Windows 环境在 Hermes 字节码步骤报 `spawn EPERM`，可用 `npx expo export --platform android --no-bytecode --output-dir dist` 验证 Android JavaScript bundle；这只适合受限环境排查，关闭字节码会降低启动性能，不能替代正式 APK 和真机验收。

若受限环境无法启动 esbuild 子进程，可在 Node.js 24 中运行 `npm run test:in-process`，以同一进程执行相同的解析、分页和阅读恢复测试。翻译测试可运行 `npm run test:in-process -- scripts/verify-translation.ts`。此方式不会替代类型检查或原生构建验证。

同进程测试还覆盖备份结构校验及恢复中断后的回滚。恢复会先将正文写入独立副本，再更新书架；未提交的恢复由启动流程还原原索引。真实设备的文件权限、空间不足和进程退出场景仍需安装包验收。

在限制子进程数量的环境中，可给 `expo export` 添加 `--max-workers 1`。Android 导出仍需允许启动项目所用的 Hermes 编译器；不要把 Web 导出成功当作 Android 安装包验收。

首次运行 `npm run android` 时会从 sherpa-onnx 官方 Release 下载约 67 MB 的固定 Amy 模型归档，核对 SHA-256 后放入 Android 原生资源；后续构建复用 `.cache/tts-models`。GitHub Actions 会自动执行相同步骤，最终用户无需下载模型或配置服务。

### 配置正式翻译服务

App 默认不需要 API Key：Android 客户端会直接取得必应翻译网页的临时会话并翻译，失败时再使用 MyMemory。该兼容模式不是 Microsoft 面向开发者承诺稳定性的正式 API，可能因网页接口或限制变化而失效；界面因此明确标为“实验性”。

仓库另包含可独立部署的[书语翻译网关](./translation-proxy/README.md)。它是可选的高质量优先项，接收 `POST { text, source, target }`，默认优先调用 Azure Translator，再回退到腾讯云 TMT，并返回 `{ translation, provider }`。供应商密钥只能保存在网关环境变量中，不能写入 `EXPO_PUBLIC_*`。本地 App 可复制 `.env.example` 为 `.env.local` 后配置公开地址：

```dotenv
EXPO_PUBLIC_TRANSLATION_ENDPOINT=https://your-proxy.example/translate
EXPO_PUBLIC_TRANSLATION_PROVIDER_NAME=Azure Translator → 腾讯云 TMT
```

GitHub Actions 构建时，可在 **Settings → Secrets and variables → Actions → Variables** 添加 `SHUYU_TRANSLATION_ENDPOINT` 与 `SHUYU_TRANSLATION_PROVIDER_NAME`。未配置时构建仍可直接使用内置的必应兼容模式和 MyMemory 兜底，设置页会显示当前策略。

### 通过 GitHub 生成可安装 APK

项目以 GitHub Actions 为主要构建方式。把仓库推送到 GitHub 后，打开 **Actions → Build installable Android APK → Run workflow**；完成后在运行详情的 **Artifacts** 下载 APK。完整的新手步骤与正式签名配置见 [GITHUB_BUILD.md](./GITHUB_BUILD.md)。

未配置 GitHub Secrets 时，工作流生成可直接安装的 `test.apk`，仅供个人测试；配置永久 release keystore 后，同一工作流生成可持续升级的 `release.apk`。正式分发前必须完成签名配置。

## 项目结构

```text
src/
  components/     通用视觉组件
  context/        本地状态与业务操作
  data/           分级推荐书目与本地水平测试题
  screens/        首页、书架、阅读器、生词、复习、设置
  services/       导入、EPUB/Kindle/PDF 解析、本地存储、查词翻译与朗读
  utils/          文本分章、分词与句子定位
scripts/          本地自动验证脚本
translation-proxy/ Azure 主源、腾讯备用的独立翻译网关
```

## 当前边界

- TXT v1 仅支持 UTF-8；不自动猜测 GBK 等旧编码。
- EPUB 读取 spine 与目录中的文本章节，不复刻出版社 CSS，不显示插图、复杂表格或脚注弹窗；字体混淆不会阻止正文导入，但 DRM 内容不受支持。
- MOBI/AZW3/KF8 仅解析无 DRM 的可重排文字内容，不绕过加密，不复刻原书 CSS、图片、固定版式与复杂排版；KFX、Topaz 和 AZW4 暂不支持。
- PDF 不复刻页面排版、图片、表格或脚注弹窗。Android 可对英文扫描版和纯图片版逐页 OCR，但模糊、旋转、双栏或复杂版式可能影响准确率和阅读顺序；密码保护 PDF 与 iOS 扫描版 OCR 暂不支持。
- 词义优先来自随包分发的 ECDICT Core。未收录词与整句在用户开启在线增强时，按“可选自有网关 → 手机直连必应实验性兼容模式 → MyMemory”回退。免费额度、可用地区、稳定性、数据处理位置和服务条款以供应商当前规则为准。
- iOS 代码路径已兼容，但本版本只完成 Android / Web 构建验证，尚未在真实 iPhone 上验收。

## 隐私与版权

书籍正文只在本地解析和保存。Android 常规查词由本地词典完成；开启在线增强后，未收录单词与用户主动请求翻译的句子可能发送给第三方翻译服务。详见 [PRIVACY.md](./PRIVACY.md)。用户应只导入自己有权使用的内容。本项目不提供电子书文件、获取入口或分发服务。

## 参与开发

请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。第三方数据声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 许可证

书语采用双重许可：

- 开源使用遵循 [GNU General Public License v3.0 only（GPL-3.0-only）](./LICENSE)。GPL 允许包括收费分发在内的商业使用，但使用、修改或分发时必须遵守 GPL 的全部条款。
- 如果你希望在不遵守 GPL 要求的情况下使用书语代码，例如发布闭源衍生产品，请参阅[商业许可说明](./COMMERCIAL_LICENSE.md)，并向相关版权所有者取得单独的书面商业许可证。

GitHub Release `v1.2.0` 及此前已经发布的版本继续适用发布时随附的 MIT License；既有授权不因当前仓库改用 GPL-3.0-only 而撤销。
