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

## Android 离线英文发音

书语使用 `react-native-sherpa-onnx@0.4.3` 调用 sherpa-onnx，在 Android 设备上完成离线语音合成和 PCM 播放。构建已关闭该组件中本项目未使用的 FFmpeg 与 libarchive 功能。

- React Native 封装：https://github.com/XDcobra/react-native-sherpa-onnx （MIT License）
- sherpa-onnx 1.12.34-2：https://github.com/k2-fsa/sherpa-onnx （Apache License 2.0）
- ONNX Runtime：https://github.com/microsoft/onnxruntime （MIT License）

随 Android APK 分发的 `vits-piper-en_US-amy-medium` 模型来自 sherpa-onnx 官方 TTS Models Release，源模型由 Piper Voices 提供，模型卡指向 Mycroft Mimic 3 Voices 数据集。该语音模型按 **Creative Commons Attribution-ShareAlike 4.0 International（CC BY-SA 4.0）** 使用；允许商业使用，但复制、再分发或改编模型时须遵守署名与相同方式共享等条款。书语不修改该模型权重。

- 模型与试听：https://k2-fsa.github.io/sherpa/onnx/tts/all/English/vits-piper-en_US-amy-medium.html
- 源模型卡：https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/medium
- 数据集来源：https://github.com/MycroftAI/mimic3-voices
- 许可证：https://creativecommons.org/licenses/by-sa/4.0/
- 固定归档 SHA-256：`9a5d1fc497f85e8022b785bff5f8105203b1e33099ee6265203efc70b0cb0264`

## 可选在线翻译服务

书语默认可由用户设备直接请求必应翻译网页服务的临时会话；这是实验性兼容方式，不是 Microsoft 面向开发者承诺稳定性的正式 API。App 也可以按配置先调用自有网关中的 Microsoft Azure Translator 与腾讯云机器翻译 API，并在前述服务不可用时使用 MyMemory。它们不是随安装包分发的软件组件，分别受对应服务条款、隐私政策、免费额度和限制约束。

- 必应翻译：https://www.bing.com/translator
- Microsoft 隐私声明：https://privacy.microsoft.com/privacystatement
- Microsoft Azure Translator：https://learn.microsoft.com/azure/ai-services/translator/
- 腾讯云机器翻译：https://cloud.tencent.com/document/product/551
- MyMemory：https://mymemory.translated.net/doc/spec.php

其余 JavaScript 与原生组件的精确版本以 `package-lock.json` 和 Gradle 构建解析结果为准，并遵循各自许可证或服务条款。
