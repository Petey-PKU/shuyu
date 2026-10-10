<div align="center">
  <img src="assets/shuyu-icon.png" alt="Shuyu app icon" width="112" />
  <h1>Shuyu · 书语</h1>
  <p><strong>Learn a language in the pages you read.</strong></p>
  <p>A local-first English reading companion for Chinese learners.<br />Bring your own books, look up words in context, listen, save vocabulary, and review with the original sentence.</p>
  <p><a href="https://github.com/Petey-PKU/shuyu/releases/download/v1.4.0/Shuyu-v1.4.0-release.apk">Download v1.4.0 APK</a> · <a href="https://github.com/Petey-PKU/shuyu/releases">View releases</a> · <a href="GITHUB_BUILD.md">Build from source</a> · <a href="README.zh-CN.md">中文 README</a></p>
  <p>
    <img src="https://img.shields.io/github/actions/workflow/status/Petey-PKU/shuyu/android-apk.yml?branch=main&label=Android%20build&style=flat-square" alt="Android build" />
    <img src="https://img.shields.io/github/v/release/Petey-PKU/shuyu?display_name=tag&style=flat-square" alt="Latest release" />
    <img src="https://img.shields.io/badge/Expo-57-000020?logo=expo&logoColor=white&style=flat-square" alt="Expo 57" />
    <img src="https://img.shields.io/badge/license-GPL--3.0--only-2f6f52?style=flat-square" alt="GPL-3.0-only license" />
  </p>
</div>

---

## English

### What Shuyu does

<table>
  <tr>
    <td width="33%"><strong>📚 Read your books</strong><br />Import TXT, EPUB, DRM-free MOBI/AZW3/KF8, and PDF files you are allowed to use.</td>
    <td width="33%"><strong>🔎 Learn in context</strong><br />Tap a word for a local definition, save the original sentence, and review it later.</td>
    <td width="33%"><strong>🎧 Listen and remember</strong><br />Use system voices or download the optional Amy voice for fully offline Android playback.</td>
  </tr>
  <tr>
    <td><strong>📖 Stay in the flow</strong><br />Real text pagination, edge taps, swipe navigation, themes, and responsive tablet layouts.</td>
    <td><strong>🧠 Build a habit</strong><br />Vocabulary review, reading goals, minutes, streaks, level assessment, and graded recommendations.</td>
    <td><strong>🔒 Keep control</strong><br />Books, progress, vocabulary, and preferences stay on the device by default.</td>
  </tr>
</table>

### Formats and platform support

- **Text and ebooks:** UTF-8 TXT, EPUB 2/3, DRM-free MOBI, AZW3, and KF8.
- **PDF:** local text extraction on Android, with optional page-by-page OCR for English scans.
- **Platforms:** Android is the primary distribution target. Web is useful for UI and text-format previews; the iOS code path is present but has not had a real-device release validation.
- **Dictionary:** ECDICT Core is bundled for offline word lookup. Sentence translation is opt-in.

### A smaller base APK

The current source build does not bundle the Amy model. On Android, open **Settings → English voice** to download the pinned Amy archive when you want fully offline neural speech.

- Download: about **67 MB**
- Extracted app data: about **77 MiB**
- No download: the app continues with the device system voice
- The published **v1.4.0 APK** is the current release and keeps the Amy voice optional. The older **v1.3.1 APK** is a historical release that still includes its bundled voice.

### Download and run

The latest published Android APK is [Shuyu v1.4.0](https://github.com/Petey-PKU/shuyu/releases/tag/v1.4.0). For a current build, use the [GitHub Actions workflow](https://github.com/Petey-PKU/shuyu/actions/workflows/android-apk.yml) and download its artifact.

~~~bash
npm install
npm run start
~~~

Use <code>npm run web</code> for a quick browser preview or <code>npm run android</code> with a native Android environment. PDF extraction, OCR, native speech, and file-system backup require a native build rather than Expo Go.

### Documentation

| Need | Guide |
| --- | --- |
| Build an installable Android APK | [GITHUB_BUILD.md](GITHUB_BUILD.md) |
| Validate a release on a real device | [ANDROID_ACCEPTANCE.md](ANDROID_ACCEPTANCE.md) |
| Understand privacy and network behavior | [PRIVACY.md](PRIVACY.md) |
| Contribute or extend the project | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Translation gateway (optional) | [translation-proxy/README.md](translation-proxy/README.md) |
| Brand and naming conventions | [BRAND.md](BRAND.md) |

<details>
<summary>Current scope</summary>

Shuyu does not bypass DRM or distribute books. PDF OCR can be affected by blur, rotation, columns, and unusual reading order. Online translation is disabled by default and may send user-selected text to a third-party provider only after it is enabled.

</details>

### License

Shuyu is available under [GNU GPL-3.0-only](LICENSE). Commercial use is allowed when the GPL obligations are met. A separate commercial license is available for closed-source derivative products; see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

---

## 中文摘要

书语是一款面向中文母语学习者的本地优先英语阅读器：导入自己有权使用的英文读物，在原文中点词查义、听发音、收藏带语境的生词，再用原句复习。

- 支持 TXT、EPUB、无 DRM 的 MOBI/AZW3/KF8 与 PDF；Android 扫描版英文 PDF 可逐页离线 OCR。
- 内置 ECDICT Core 离线词典，阅读器支持真实分页、左右点击、滑动翻页、主题和字号调节，并适配平板宽屏。
- Android 可在设置中按需下载约 67 MB 的 Piper Amy 音色，解压后约 77 MiB；不下载时继续使用系统 TTS。
- 书籍正文、阅读进度、生词和偏好默认保存在设备本地；整句在线翻译需要主动开启。
- 当前公开 APK 为 [v1.4.0](https://github.com/Petey-PKU/shuyu/releases/tag/v1.4.0)，当前源码生成的基础 APK 不内置 Amy，安装后按需下载；上一版 v1.3.1 是仍内置音色的历史版本。

完整中文说明见 [README.zh-CN.md](README.zh-CN.md)。