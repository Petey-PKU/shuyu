import type { LanguageLevel, ReadingLevelProfile } from '../types';

export interface AssessmentQuestion {
  id: string;
  level: LanguageLevel;
  prompt: string;
  passage?: string;
  options: string[];
  correctIndex: number;
}

export const assessmentQuestions: AssessmentQuestion[] = [
  { id: 'a1-1', level: 'A1', prompt: '选择最合适的词：I am hungry. I want some ___.', options: ['food', 'rain', 'music', 'sleep'], correctIndex: 0 },
  { id: 'a1-2', level: 'A1', prompt: '“The shop opens at nine.” 表示什么？', options: ['商店九点关门', '商店九点开门', '商店开了九天', '九家商店开门'], correctIndex: 1 },
  { id: 'a1-3', level: 'A1', passage: 'Lucy walks to the bus stop every morning. Today it is raining, so she takes an umbrella.', prompt: 'Lucy 今天为什么带伞？', options: ['天气很热', '她要去旅行', '正在下雨', '她错过了公交车'], correctIndex: 2 },
  { id: 'a2-1', level: 'A2', prompt: '选择最合适的词：Can I ___ your dictionary? I will return it tomorrow.', options: ['lend', 'borrow', 'teach', 'lose'], correctIndex: 1 },
  { id: 'a2-2', level: 'A2', prompt: '“Maya missed the train because she left home late.” 原因是什么？', options: ['火车提前到站', '她忘了车票', '她离家太晚', '她不想乘火车'], correctIndex: 2 },
  { id: 'a2-3', level: 'A2', passage: 'Ben planned to play football, but the field was too wet after the storm. He went to the library instead.', prompt: 'Ben 最后去了哪里？', options: ['足球场', '图书馆', '电影院', '朋友家'], correctIndex: 1 },
  { id: 'b1-1', level: 'B1', prompt: '选择最合适的词：___ the heavy traffic, we arrived on time.', options: ['Despite', 'Unless', 'During', 'Because'], correctIndex: 0 },
  { id: 'b1-2', level: 'B1', prompt: '“I finally figured out how the machine works.” 中 figured out 最接近：', options: ['拆除了', '解释给别人', '弄明白了', '忘记了'], correctIndex: 2 },
  { id: 'b1-3', level: 'B1', passage: 'Nora had promised herself not to buy another book. Ten minutes after entering the shop, she was standing at the counter with two novels.', prompt: '这段话暗示什么？', options: ['Nora 不喜欢小说', 'Nora 没能坚持原来的决定', '书店拒绝卖书', 'Nora 在书店工作'], correctIndex: 1 },
  { id: 'b2-1', level: 'B2', prompt: '选择最接近 reluctant 的意思：She was reluctant to speak in front of the crowd.', options: ['非常兴奋的', '不太情愿的', '准备充分的', '完全无法'], correctIndex: 1 },
  { id: 'b2-2', level: 'B2', prompt: '“Not until the lights went out did we notice the stars.” 表示：', options: ['灯熄灭后我们才注意到星星', '看到星星后我们关了灯', '灯一直没有熄灭', '星星让灯光更明亮'], correctIndex: 0 },
  { id: 'b2-3', level: 'B2', passage: 'The committee praised the proposal as imaginative, then postponed any decision until the following year. Its supporters left the meeting looking less confident than when they arrived.', prompt: '委员会最可能持什么态度？', options: ['立即支持并执行', '礼貌但并未真正承诺', '完全没有理解', '要求支持者当天修改'], correctIndex: 1 },
  { id: 'c1-1', level: 'C1', prompt: '选择最接近 mitigate 的意思：The new trees may mitigate the effects of extreme heat.', options: ['测量', '加剧', '减轻', '隐藏'], correctIndex: 2 },
  { id: 'c1-2', level: 'C1', prompt: '“Had it not been for her notes, the discovery might have been forgotten.” 表示：', options: ['她的笔记差点被忘记', '正因为她的笔记，发现才没有被遗忘', '她没有记录那项发现', '那项发现让她忘了笔记'], correctIndex: 1 },
  { id: 'c1-3', level: 'C1', passage: 'The report is exhaustive in its detail, although its confidence occasionally exceeds what the evidence can comfortably support.', prompt: '作者的评价是什么？', options: ['报告详尽，但有些结论过度自信', '报告没有任何证据', '报告太短，无法评价', '作者完全赞同所有结论'], correctIndex: 0 },
  { id: 'c2-1', level: 'C2', prompt: '选择最接近 equivocal 的意思：His equivocal reply satisfied neither side.', options: ['热情而明确的', '含糊且可作多种解释的', '经过证实的', '完全无关的'], correctIndex: 1 },
  { id: 'c2-2', level: 'C2', prompt: '“The policy is coherent only insofar as one accepts its least defensible assumption.” 这句话主要在说：', options: ['政策完全合理', '政策没有任何假设', '政策的逻辑依赖一个难以辩护的前提', '政策已经被所有人接受'], correctIndex: 2 },
  { id: 'c2-3', level: 'C2', passage: 'Her apology was impeccable: measured, gracious, and delivered only after it could no longer alter the outcome. Its timing made the performance easier to admire than the intention behind it.', prompt: '作者对道歉的真实态度是：', options: ['毫无保留地赞赏', '认为道歉来得早而真诚', '欣赏表达方式，但怀疑动机', '认为道歉改变了结果'], correctIndex: 2 },
];

export const languageLevels: LanguageLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const scoreBases: Record<LanguageLevel, number> = { A1: 8, A2: 24, B1: 40, B2: 56, C1: 72, C2: 88 };

export function scoreAssessment(answers: Record<string, number>): ReadingLevelProfile {
  const correctByLevel = new Map<LanguageLevel, number>();
  for (const level of languageLevels) correctByLevel.set(level, 0);
  for (const question of assessmentQuestions) {
    if (answers[question.id] === question.correctIndex) {
      correctByLevel.set(question.level, (correctByLevel.get(question.level) ?? 0) + 1);
    }
  }

  let level: LanguageLevel = 'A1';
  for (const candidate of languageLevels) {
    if ((correctByLevel.get(candidate) ?? 0) < 2) break;
    level = candidate;
  }

  const bandCorrect = correctByLevel.get(level) ?? 0;
  const levelIndex = languageLevels.indexOf(level);
  const lowerLevelsConsistent = languageLevels
    .slice(0, levelIndex)
    .every((candidate) => (correctByLevel.get(candidate) ?? 0) >= 2);
  const confidence = bandCorrect === 3 && lowerLevelsConsistent ? 'high' : bandCorrect >= 2 ? 'medium' : 'low';
  const score = Math.min(100, scoreBases[level] + bandCorrect * 4);

  return {
    level,
    score,
    confidence,
    assessedAt: new Date().toISOString(),
    source: 'assessment',
  };
}
