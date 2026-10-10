<div align="center">
  <img src="assets/shuyu-icon.png" alt="书语应用图标" width="112" />
  <h1>书语 Shuyu</h1>
  <p><strong>在书里，学会一门语言。</strong></p>
  <p>面向中文母语学习者的本地优先英语语境阅读器。导入自己的书，在原文里点词、听读、收藏和复习。</p>
  <p><a href="README.md">English README</a> · <a href="https://github.com/Petey-PKU/shuyu/releases">下载与历史版本</a> · <a href="GITHUB_BUILD.md">从源码构建</a></p>
</div>

---

## 产品定位

书语把英语学习放回完整语境中：你带入自己有权使用的英文读物，在阅读过程中查词、保存原句、听发音，再回到原句复习。书籍正文、阅读进度、生词和偏好默认保存在设备本地。

## 核心功能

- **导入自己的书：** UTF-8 TXT、EPUB 2/3、无 DRM MOBI/AZW3/KF8，以及 PDF。
- **语境查词：** 内置 ECDICT Core，点词查看中文释义、词形并保存原句。
- **离线朗读：** 使用系统音色，或在 Android 上下载可选 Amy 音色进行完全离线朗读。
- **专注阅读：** 真实文字分页、左右点击、滑动翻页、纸张/明亮/夜间主题和字号预览。
- **持续复习：** 生词到期复习、阅读目标、分钟数、连续天数、水平测试和分级推荐。
- **本地优先：** 默认不上传书籍和学习记录；整句在线翻译需要主动开启。

## 格式与平台

- **TXT 与电子书：** UTF-8 TXT、EPUB 2/3、无 DRM MOBI、AZW3、KF8。
- **PDF：** Android 优先提取文本层；英文扫描版或纯图片 PDF 可逐页离线 OCR。模糊、旋转、双栏和复杂版式可能影响结果。
- **Android：** 当前主要发布平台，支持原生导入、OCR、备份和朗读。
- **Web：** 用于体验界面及 TXT/EPUB/MOBI/AZW3/KF8 导入，不替代 Android 真机验收。
- **iOS：** 代码路径已兼容，但当前没有真实 iPhone 发布验收。

## 更小的基础 APK

当前源码不会把 Amy 模型打进基础 APK。安装 Android 版本后，打开 **设置 → 英语发音音色**，需要时再下载固定版本的 Amy 音色：

- 下载归档约 **67 MB**
- 解压后的应用数据约 **77 MiB**
- 不下载时继续使用设备系统 TTS
- 公开的 **v1.3.1 APK** 是历史版本，仍随包内置音色；当前 <code>main</code> 源码使用安装后按需下载方案

## 下载与运行

当前公开 Android APK：[Shuyu v1.3.1](https://github.com/Petey-PKU/shuyu/releases/tag/v1.3.1)。

使用源码运行：

~~~bash
npm install
npm run start
~~~

网页预览可运行 <code>npm run web</code>；原生 Android 环境可运行 <code>npm run android</code>。PDF 提取、OCR、原生朗读和系统目录备份需要正式原生构建，Expo Go 和 Web 预览不能完整替代真机测试。

## 文档入口

- [Android APK 构建](GITHUB_BUILD.md)
- [Android 真机发布前验收](ANDROID_ACCEPTANCE.md)
- [隐私与联网行为](PRIVACY.md)
- [参与开发](CONTRIBUTING.md)
- [可选翻译网关](translation-proxy/README.md)
- [品牌与命名约定](BRAND.md)
- [第三方数据声明](THIRD_PARTY_NOTICES.md)

<details>
<summary>当前边界</summary>

书语不绕过 DRM，也不提供电子书下载或分发。PDF OCR 可能受到清晰度、旋转、分栏和阅读顺序影响。在线翻译默认关闭，开启后，用户主动选择的单词或句子可能发送给第三方翻译服务。

</details>

## 许可证

书语当前代码采用 [GNU GPL-3.0-only](LICENSE)。在遵守 GPL 义务的前提下允许商业使用；如果要发布不遵守 GPL 要求的闭源衍生产品，请阅读 [商业许可说明](COMMERCIAL_LICENSE.md)。

早期已发布的版本继续适用其发布时附带的许可证，既有授权不会因当前仓库的许可证变更而撤销。