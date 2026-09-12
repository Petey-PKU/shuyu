import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run after exporting the web build. Serve on a separate local port (4174)
// so the synthetic library never touches the normal preview's browser data.
const directory = resolve('.cache/web-preview');
const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const fixtureScript = String.raw`
(() => {
  if (location.hostname !== '127.0.0.1' || location.port !== '4174') {
    throw new Error('Reader fixtures require the isolated http://127.0.0.1:4174 origin');
  }
  const mode = new URLSearchParams(location.search).get('case') || 'retry';
  const id = 'reader_fixture';
  const contentKey = '@shuyu/content/' + id;
  const chapters = [
    { id: 'fixture_front', title: '前言（空白页）', paragraphs: [], wordCount: 0 },
    { id: 'fixture_body', title: '可以继续阅读', paragraphs: ['A quiet room makes space for a new story.'], wordCount: 10 },
  ];
  const content = { id, title: '阅读恢复测试', chapters: mode === 'blank' ? chapters : chapters.slice(1) };
  const now = new Date().toISOString();
  const book = { id, title: content.title, author: '本地测试数据', format: 'txt',
    createdAt: now, lastOpenedAt: now, currentChapter: 0, currentParagraph: 0,
    progress: mode === 'completed' ? 1 : 0, totalWords: 10, chapterCount: content.chapters.length, accent: '#826E54' };
  localStorage.setItem('@shuyu/books', JSON.stringify([book]));
  localStorage.setItem('@shuyu/words', '[]');
  localStorage.setItem('@shuyu/stats', JSON.stringify({ minutes: 0, words: 0, todayMinutes: 0, todayWords: 0, streak: 0 }));
  localStorage.setItem('@shuyu/preferences', JSON.stringify({ fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper', onlineSentenceTranslation: false }));
  localStorage.setItem('@shuyu/recommendations', JSON.stringify({ preferredGenres: [], savedBookIds: [], feedback: {} }));
  localStorage.setItem('@shuyu/reading-signals', '[]');
  localStorage.setItem('@shuyu/sample-seeded', 'true');
  localStorage.setItem('@shuyu/reader-tap-hint-seen', 'true');
  localStorage.setItem(contentKey, JSON.stringify(content));
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  let attempts = 0;
  let writeAttempts = 0;
  Storage.prototype.getItem = function(key) {
    if (this === localStorage && key === contentKey) {
      attempts += 1;
      if (mode === 'retry' && attempts === 1) throw new Error('本地正文暂时无法读取，请重试。');
      if (mode === 'missing') return null;
      if (mode === 'corrupt') return '{broken';
      if (mode === 'empty') return JSON.stringify({ ...content, chapters: [] });
      if (mode === 'mismatch') return JSON.stringify({ ...content, id: 'wrong_book' });
    }
    return originalGetItem.call(this, key);
  };
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === '@shuyu/books' && mode === 'writefail' && writeAttempts++ === 0) {
      throw new Error('测试存储空间暂不可用');
    }
    return originalSetItem.call(this, key, value);
  };
})();
`;
writeFileSync(resolve(directory, 'reader-recovery-test.html'), html.replace('<head>', '<head><script>' + fixtureScript + '</script>'));
console.log('Prepared isolated reader preview: http://127.0.0.1:4174/reader-recovery-test.html?case=retry');
console.log('Cases: retry, missing, corrupt, empty, mismatch, blank, writefail, completed');
