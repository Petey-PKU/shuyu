# 第三方数据与组件声明

## ECDICT Core

书语的离线英汉词典由 `ecdict@0.0.4` 数据包裁剪生成；该包的数据来源注明为 `skywind3000/ECDICT`。

- 数据包：https://www.npmjs.com/package/ecdict
- 上游：https://github.com/skywind3000/ECDICT
- 本项目固定版本：`ecdict@0.0.4`
- 生成规模：120,000 词条、27,960 词形别名
- 许可：MIT License

Copyright (c) 2022 Yan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## MOBI 与 AZW3/KF8 解析

书语使用 `@lingo-reader/mobi-parser@0.4.6` 及其 `@lingo-reader/shared` 组件解析无 DRM 的 MOBI 与 AZW3/KF8 文件。

- 上游：https://github.com/hhk-png/lingo-reader
- 许可：MIT License
- Copyright (c) 2024 hhk-png

## PDF 文本提取

书语使用 `expo-pdf-text-extract@1.1.0` 从数字文本型 PDF 本地提取文字。

- 上游：https://github.com/gr8pathik/expo-pdf-text-extract
- 许可：MIT License
- Copyright (c) 2024 Pathik Gandhi

该组件在 Android 上使用 `pdfbox-android@2.0.27.0`。

- 上游：https://github.com/TomRoush/PdfBox-Android
- 许可：Apache License 2.0

## Android 扫描版 PDF OCR

Android 版使用 Google ML Kit Text Recognition v2 的随包 Latin 模型 `com.google.mlkit:text-recognition:16.0.1`，对系统 `PdfRenderer` 逐页生成的位图进行本地英文文字识别。

- 文档：https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- 条款与隐私：https://developers.google.com/ml-kit/terms
- 使用受 Google APIs Terms of Service 与 ML Kit Terms of Service 约束

其余 JavaScript 与原生组件的精确版本以 `package-lock.json` 和 Gradle 构建解析结果为准，并遵循各自许可证或服务条款。
