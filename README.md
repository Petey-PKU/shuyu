# 书语 Shuyu

> 在书里，学会一门语言。

书语是一款面向中文母语学习者的开源英语语境阅读 App。用户导入自己有权使用的英文读物，在原文里点词查义、听发音、收藏带语境的生词，再用原句复习。当前支持英文 TXT 与 EPUB。

> 当前版本为 v1.2，Android 优先，基于 Expo / React Native / TypeScript。它不是书城，也不内置受版权保护的书籍。

产品与技术标识的统一命名约定见 [BRAND.md](./BRAND.md)。

## 已实现

- 导入 UTF-8 编码的 `.txt` 与无 DRM 的标准 `.epub`
- EPUB 目录、书名、作者和正文解析；TXT 自动识别英文 `Chapter / Part / Book` 分章
- 本地书架、阅读进度和最近阅读
- 纸张、明亮、夜间三种阅读主题，字号和行高调节
- 内置 120,000 词条 ECDICT Core，点词中文释义与词形还原无需联网
- 可选的整句在线翻译增强；可在设置中彻底关闭
- 英文单词及当前段落朗读
- 生词收藏、来源原句、掌握状态与遮词复习
- 阅读分钟、词数和连续天数统计
- A1–C2 本地阅读水平测试、72 本分级推荐、兴趣筛选与想读收藏
- 推荐只提供选书信息，不提供图书下载、购买、试读或搜索入口
- 原文、进度和生词默认保存在设备本地

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

## 验证

```bash
npm run typecheck
npm test
npm run test:dictionary
npm run export:android
```

`export:android` 验证 Android 生产 bundle。

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
  services/       导入、EPUB 解析、本地存储、查词翻译
  utils/          文本分章、分词与句子定位
scripts/          本地自动验证脚本
```

## 当前边界

- TXT v1 仅支持 UTF-8；不自动猜测 GBK 等旧编码。
- EPUB v1 读取 spine 中的文本章节，不复刻出版社 CSS，不显示插图、复杂表格、脚注弹窗或 DRM 内容。
- 词义优先来自随包分发的 ECDICT Core。未收录词与整句翻译可请求 MyMemory 公开演示服务，并有短超时保护；公开发布前应换成位于中国大陆、由服务端代签名的正式翻译接口。
- iOS 代码路径已兼容，但本版本只完成 Android / Web 构建验证，尚未在真实 iPhone 上验收。

## 隐私与版权

书籍正文只在本地解析和保存。常规查词由本地词典完成；开启在线增强后，未收录单词与用户点按时的当前句子可能发送给第三方翻译服务。详见 [PRIVACY.md](./PRIVACY.md)。用户应只导入自己有权使用的内容。本项目不提供电子书文件、获取入口或分发服务。

## 参与开发

请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。项目使用 [MIT License](./LICENSE)，第三方数据声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
