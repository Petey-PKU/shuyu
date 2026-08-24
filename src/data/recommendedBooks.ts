import type { BookGenre, BookLength, RecommendedBook } from '../types';

const accents = ['#D76A43', '#4F7462', '#6F7FA2', '#8A6E92', '#B68A4D', '#4C7D8B'];

interface BookSeed {
  id: string;
  title: string;
  author: string;
  difficulty: number;
  genres: BookGenre[];
  length: BookLength;
  edition: string;
  summary: string;
  fitReason: string;
}

function makeBooks(level: RecommendedBook['level'], seeds: BookSeed[]): RecommendedBook[] {
  return seeds.map((seed, index) => ({ ...seed, level, accent: accents[(index + level.charCodeAt(0)) % accents.length] }));
}

export const recommendedBooks: RecommendedBook[] = [
  ...makeBooks('A1', [
    { id: 'a1-christmas-carol', title: 'A Christmas Carol', author: 'Charles Dickens', difficulty: 10, genres: ['classic', 'society'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '吝啬的斯克鲁奇在圣诞夜经历三次神奇拜访，重新理解善意与分享。', fitReason: '情节熟悉，改写版句子短，核心词汇反复出现。' },
    { id: 'a1-little-women', title: 'Little Women', author: 'Louisa May Alcott', difficulty: 12, genres: ['classic', 'society'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '马奇家四姐妹在成长、家庭与梦想之间寻找各自的道路。', fitReason: '家庭生活词汇实用，对话清楚，人物关系容易跟随。' },
    { id: 'a1-treasure-island', title: 'Treasure Island', author: 'Robert Louis Stevenson', difficulty: 14, genres: ['adventure', 'classic'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '少年吉姆得到藏宝图，登船寻找宝藏，却遇上一群危险的海盗。', fitReason: '动作推动情节，改写版减少了原作中的航海术语。' },
    { id: 'a1-jekyll-hyde', title: 'Jekyll and Hyde', author: 'Robert Louis Stevenson', difficulty: 16, genres: ['classic', 'mystery'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '受人尊敬的杰基尔医生与可怕的海德先生之间藏着一个秘密。', fitReason: '悬念强、人物少，适合用基础过去时持续阅读。' },
    { id: 'a1-enormous-crocodile', title: 'The Enormous Crocodile', author: 'Roald Dahl', difficulty: 9, genres: ['fantasy', 'humor'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '一只贪吃的鳄鱼想出许多诡计，森林动物决定一起阻止它。', fitReason: '重复句式和鲜明动作很多，初学者容易形成语感。' },
    { id: 'a1-giraffe-pelly-me', title: 'The Giraffe and the Pelly and Me', author: 'Roald Dahl', difficulty: 13, genres: ['fantasy', 'humor'], length: 'short', edition: '英语分级改写版 · Level 1', summary: '男孩比利和长颈鹿、鹈鹕、猴子组成了非同寻常的擦窗队。', fitReason: '插图型故事线直观，生活动作词汇丰富但句法简单。' },
    { id: 'a1-green-eggs-ham', title: 'Green Eggs and Ham', author: 'Dr. Seuss', difficulty: 8, genres: ['humor'], length: 'short', edition: '英文原版 · 韵文图画书', summary: '山姆不断邀请一位固执的朋友尝试绿色鸡蛋和火腿。', fitReason: '极高重复度与押韵结构，适合建立开口阅读的信心。' },
    { id: 'a1-very-hungry-caterpillar', title: 'The Very Hungry Caterpillar', author: 'Eric Carle', difficulty: 7, genres: ['science'], length: 'short', edition: '英文原版 · 图画书', summary: '一条小毛毛虫一天天吃过不同食物，最后完成生命变化。', fitReason: '数字、星期和食物词汇集中，文本很短。' },
    { id: 'a1-snowy-day', title: 'The Snowy Day', author: 'Ezra Jack Keats', difficulty: 11, genres: ['contemporary'], length: 'short', edition: '英文原版 · 图画书', summary: '彼得走进一场大雪，在城市里发现脚印、声音和小小惊喜。', fitReason: '日常动作与感官词汇自然，叙述节奏舒缓。' },
    { id: 'a1-cat-hat', title: 'The Cat in the Hat', author: 'Dr. Seuss', difficulty: 15, genres: ['fantasy', 'humor'], length: 'short', edition: '英文原版 · 韵文读物', summary: '雨天里，一只戴帽子的猫闯入家中，把无聊变成一场混乱。', fitReason: '基础高频词为主，押韵帮助记忆和朗读。' },
    { id: 'a1-frog-toad', title: 'Frog and Toad Are Friends', author: 'Arnold Lobel', difficulty: 18, genres: ['humor', 'society'], length: 'short', edition: '英文原版 · 初级桥梁书', summary: '青蛙和蟾蜍在五个温暖的小故事里互相陪伴、解决麻烦。', fitReason: '对话短而自然，是从图画书走向章节书的好过渡。' },
    { id: 'a1-peter-rabbit', title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', difficulty: 20, genres: ['classic', 'adventure'], length: 'short', edition: '英文原版 · 经典童话', summary: '不听劝的小兔彼得溜进麦格雷戈先生的菜园，开始紧张逃亡。', fitReason: '故事短且因果明确，可在少量旧式词汇中练习猜义。' },
  ]),
  ...makeBooks('A2', [
    { id: 'a2-wizard-oz', title: 'The Wizard of Oz', author: 'L. Frank Baum', difficulty: 24, genres: ['adventure', 'fantasy'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '多萝西被龙卷风带到奥兹国，与三位伙伴踏上寻找魔法师的旅程。', fitReason: '旅行结构清楚，每一章都有明确目标和重复表达。' },
    { id: 'a2-hound-baskervilles', title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', difficulty: 27, genres: ['crime', 'mystery'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '福尔摩斯调查荒原上的家族诅咒与一只传说中的巨大猎犬。', fitReason: '线索推动阅读，改写版保留悬念并控制长句。' },
    { id: 'a2-charlie-chocolate', title: 'Charlie and the Chocolate Factory', author: 'Roald Dahl', difficulty: 29, genres: ['fantasy', 'humor'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '查理得到金奖券，进入神秘而奇妙的旺卡巧克力工厂。', fitReason: '场景鲜明、动作密集，新词容易从上下文推断。' },
    { id: 'a2-bfg', title: 'The BFG', author: 'Roald Dahl', difficulty: 31, genres: ['adventure', 'fantasy'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '孤儿苏菲遇见好心巨人，两人合作阻止其他巨人伤害孩子。', fitReason: '核心情节线性，改写版降低了原作自造词的负担。' },
    { id: 'a2-george-medicine', title: "George's Marvellous Medicine", author: 'Roald Dahl', difficulty: 26, genres: ['fantasy', 'humor'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '乔治为脾气糟糕的祖母调制了一锅效果惊人的神奇药水。', fitReason: '大量常用物品和动作词，故事夸张而易懂。' },
    { id: 'a2-james-peach', title: 'James and the Giant Peach', author: 'Roald Dahl', difficulty: 33, genres: ['adventure', 'fantasy'], length: 'short', edition: '英语分级改写版 · Level 3', summary: '詹姆斯乘坐一颗巨大的桃子，与昆虫伙伴展开跨海冒险。', fitReason: '章节目标明确，适合练习连续阅读和事件顺序。' },
    { id: 'a2-fantastic-fox', title: 'Fantastic Mr Fox', author: 'Roald Dahl', difficulty: 30, genres: ['adventure', 'humor'], length: 'short', edition: '英文原版 · 儿童章节书', summary: '狐狸先生用聪明计划对抗三个凶狠农场主，帮助地下的动物家庭。', fitReason: '篇幅短、对话多，是尝试第一本英文原版的稳妥选择。' },
    { id: 'a2-magic-finger', title: 'The Magic Finger', author: 'Roald Dahl', difficulty: 25, genres: ['fantasy', 'humor'], length: 'short', edition: '英文原版 · 儿童章节书', summary: '一个女孩用魔法让喜欢打猎的一家人体验被追猎的滋味。', fitReason: '句式直接、篇幅很短，主题又足以引发思考。' },
    { id: 'a2-twits', title: 'The Twits', author: 'Roald Dahl', difficulty: 32, genres: ['humor'], length: 'short', edition: '英文原版 · 儿童章节书', summary: '一对坏脾气夫妻互相恶作剧，还欺负动物，最终遭到反击。', fitReason: '动作和对话占比高，能在快速情节中巩固过去时。' },
    { id: 'a2-dinosaurs-before-dark', title: 'Dinosaurs Before Dark', author: 'Mary Pope Osborne', difficulty: 28, genres: ['adventure', 'fantasy'], length: 'short', edition: '英文原版 · Magic Tree House 1', summary: '杰克和安妮走进树屋，意外来到恐龙生活的史前世界。', fitReason: '短章、重复结构与有限角色特别适合建立阅读习惯。' },
    { id: 'a2-flat-stanley', title: 'Flat Stanley', author: 'Jeff Brown', difficulty: 34, genres: ['adventure', 'humor'], length: 'short', edition: '英文原版 · 桥梁书', summary: '斯坦利被压成纸一样扁，反而获得许多奇特旅行方式。', fitReason: '生活英语与想象情节结合，句子长度逐步增加。' },
    { id: 'a2-my-fathers-dragon', title: "My Father's Dragon", author: 'Ruth Stiles Gannett', difficulty: 35, genres: ['adventure', 'fantasy'], length: 'short', edition: '英文原版 · 儿童章节书', summary: '一个男孩带着背包前往野岛，想办法营救被困的小龙。', fitReason: '闯关式结构提供强语境，陌生词不会妨碍理解主线。' },
  ]),
  ...makeBooks('B1', [
    { id: 'b1-charlottes-web', title: "Charlotte's Web", author: 'E. B. White', difficulty: 39, genres: ['classic', 'society'], length: 'medium', edition: '英文原版', summary: '小猪威尔伯与蜘蛛夏洛特之间的友谊，改变了农场里所有人的生活。', fitReason: '叙述清晰、情感丰富，少量农场词汇可由情境理解。' },
    { id: 'b1-little-prince', title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', difficulty: 40, genres: ['classic', 'fantasy'], length: 'short', edition: '英文译本', summary: '一位来自小行星的王子游历不同世界，谈论友谊、爱与责任。', fitReason: '表层故事简洁，可先顺畅阅读，再体会更深含义。' },
    { id: 'b1-wonder', title: 'Wonder', author: 'R. J. Palacio', difficulty: 42, genres: ['contemporary', 'society'], length: 'medium', edition: '英文原版', summary: '面部与众不同的奥吉第一次进入普通学校，和家人同学一起成长。', fitReason: '现代校园语言自然，多视角章节短，阅读节奏友好。' },
    { id: 'b1-coraline', title: 'Coraline', author: 'Neil Gaiman', difficulty: 44, genres: ['fantasy', 'mystery'], length: 'short', edition: '英文原版', summary: '卡洛琳穿过家中暗门，发现一个看似完美却危险的另一个世界。', fitReason: '篇幅紧凑、悬念连续，描写词汇可以通过氛围猜测。' },
    { id: 'b1-holes', title: 'Holes', author: 'Louis Sachar', difficulty: 46, genres: ['adventure', 'mystery'], length: 'medium', edition: '英文原版', summary: '被冤枉的斯坦利在少年营每天挖洞，逐渐揭开跨越数代的秘密。', fitReason: '短章和交错线索能训练长篇跟读，不依赖复杂句法。' },
    { id: 'b1-giver', title: 'The Giver', author: 'Lois Lowry', difficulty: 48, genres: ['fantasy', 'society'], length: 'medium', edition: '英文原版', summary: '乔纳斯生活在一个消除痛苦与选择的社区，直到他开始接收真实记忆。', fitReason: '语言克制，高频词承载抽象主题，适合从故事走向思辨。' },
    { id: 'b1-animal-farm', title: 'Animal Farm', author: 'George Orwell', difficulty: 49, genres: ['classic', 'society'], length: 'short', edition: '英文原版', summary: '农场动物推翻主人建立新秩序，却看着权力再次集中。', fitReason: '篇幅短、叙事直白，可在理解故事后认识政治寓意。' },
    { id: 'b1-old-man-sea', title: 'The Old Man and the Sea', author: 'Ernest Hemingway', difficulty: 50, genres: ['classic', 'adventure'], length: 'short', edition: '英文原版', summary: '老渔夫圣地亚哥独自出海，与一条巨大的马林鱼进行漫长较量。', fitReason: '句式相对简练，重复的海洋语境帮助吸收专门词汇。' },
    { id: 'b1-fool-me-once', title: 'Fool Me Once', author: 'Harlan Coben', difficulty: 45, genres: ['crime', 'mystery'], length: 'medium', edition: '英语分级改写版 · Level 5', summary: '丈夫遇害后，玛雅却在家中摄像头里再次看到他的身影。', fitReason: '现代悬疑动力强，改写版让线索关系比原版更易跟随。' },
    { id: 'b1-ashes-snow', title: 'Ashes in the Snow', author: 'Ruta Sepetys', difficulty: 47, genres: ['history', 'society'], length: 'medium', edition: '英语分级改写版 · Level 5', summary: '立陶宛少女莉娜与家人被迫流放，她用绘画保存希望和线索。', fitReason: '历史背景有挑战，但改写文本控制了词汇与句子复杂度。' },
    { id: 'b1-alchemist', title: 'The Alchemist', author: 'Paulo Coelho', difficulty: 43, genres: ['adventure', 'society'], length: 'short', edition: '英文译本', summary: '牧羊少年追随关于宝藏的梦，在旅途中学习倾听内心与世界。', fitReason: '语言简洁、象征反复出现，适合作为成人原版入门。' },
    { id: 'b1-because-winn-dixie', title: 'Because of Winn-Dixie', author: 'Kate DiCamillo', difficulty: 41, genres: ['contemporary', 'society'], length: 'medium', edition: '英文原版', summary: '女孩欧宝收养一只流浪狗，并因此认识小镇上许多孤独的人。', fitReason: '第一人称口吻亲切，日常词汇和清晰情感线占主导。' },
  ]),
  ...makeBooks('B2', [
    { id: 'b2-harry-potter-stone', title: "Harry Potter and the Philosopher's Stone", author: 'J. K. Rowling', difficulty: 55, genres: ['adventure', 'fantasy'], length: 'long', edition: '英文原版', summary: '哈利发现自己的巫师身份，在霍格沃茨开始第一学年并接近一块秘密魔法石。', fitReason: '情节熟悉可降低理解压力，但需适应魔法词汇与英式表达。' },
    { id: 'b2-lightning-thief', title: 'The Lightning Thief', author: 'Rick Riordan', difficulty: 56, genres: ['adventure', 'fantasy'], length: 'long', edition: '英文原版', summary: '少年珀西发现自己是希腊神祇后代，并被卷入一场寻找闪电的任务。', fitReason: '现代口语推动快节奏冒险，神话专名是主要难点。' },
    { id: 'b2-hobbit', title: 'The Hobbit', author: 'J. R. R. Tolkien', difficulty: 62, genres: ['adventure', 'fantasy'], length: 'long', edition: '英文原版', summary: '安逸的霍比特人比尔博加入矮人远征队，前往孤山面对恶龙。', fitReason: '线性冒险便于跟随，可练习较长描写和传统叙述语气。' },
    { id: 'b2-1984', title: 'Nineteen Eighty-Four', author: 'George Orwell', difficulty: 64, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '温斯顿生活在被全面监控的社会，开始怀疑权力塑造的现实。', fitReason: '语言总体直接，但政治概念、心理描写和新造词需要耐心。' },
    { id: 'b2-mockingbird', title: 'To Kill a Mockingbird', author: 'Harper Lee', difficulty: 65, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '女孩斯库特观察父亲为一名黑人辩护，并逐渐看见小镇的偏见。', fitReason: '故事可读性强，同时训练地域口语与社会文化理解。' },
    { id: 'b2-great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', difficulty: 63, genres: ['classic', 'society'], length: 'medium', edition: '英文原版', summary: '尼克来到长岛，见证盖茨比对爱情与美国梦的执着追逐。', fitReason: '篇幅适中，叙事主线明确，难点集中在隐喻与时代背景。' },
    { id: 'b2-lord-flies', title: 'Lord of the Flies', author: 'William Golding', difficulty: 66, genres: ['classic', 'society'], length: 'medium', edition: '英文原版', summary: '一群男孩困在荒岛，尝试建立秩序，却逐步滑向恐惧与暴力。', fitReason: '情节集中但象征丰富，适合练习描述和含蓄意义。' },
    { id: 'b2-mice-men', title: 'Of Mice and Men', author: 'John Steinbeck', difficulty: 58, genres: ['classic', 'society'], length: 'short', edition: '英文原版', summary: '两名流动工人怀抱拥有农场的梦想，在现实困境中彼此依靠。', fitReason: '篇幅短、对话多，主要挑战是方言拼写和历史语境。' },
    { id: 'b2-curious-incident', title: 'The Curious Incident of the Dog in the Night-Time', author: 'Mark Haddon', difficulty: 57, genres: ['contemporary', 'mystery'], length: 'medium', edition: '英文原版', summary: '少年克里斯托弗调查邻居家狗的死亡，也发现家庭中的隐秘事实。', fitReason: '第一人称逻辑清晰，章节短，兼有日常表达与推理线索。' },
    { id: 'b2-and-then-none', title: 'And Then There Were None', author: 'Agatha Christie', difficulty: 60, genres: ['crime', 'mystery'], length: 'medium', edition: '英文原版', summary: '十名陌生人受邀来到孤岛，随后按照童谣预示接连死亡。', fitReason: '封闭场景和有限角色帮助理解，推理语言值得反复阅读。' },
    { id: 'b2-martian', title: 'The Martian', author: 'Andy Weir', difficulty: 61, genres: ['adventure', 'science'], length: 'long', edition: '英文原版', summary: '宇航员马克被独自留在火星，依靠工程知识和幽默感努力生存。', fitReason: '口语化日志易读，科学术语可由解决问题的过程理解。' },
    { id: 'b2-never-let-me-go', title: 'Never Let Me Go', author: 'Kazuo Ishiguro', difficulty: 59, genres: ['contemporary', 'society'], length: 'long', edition: '英文原版', summary: '凯西回望寄宿学校生活，并逐渐揭开自己与朋友被安排的命运。', fitReason: '表面语言平静清楚，真正挑战来自暗示和非线性回忆。' },
  ]),
  ...makeBooks('C1', [
    { id: 'c1-pride-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', difficulty: 72, genres: ['classic', 'romance'], length: 'long', edition: '英文原版', summary: '伊丽莎白与达西在误解、阶级与家庭期待中重新认识彼此。', fitReason: '需要掌握长句、反讽和十九世纪社交语境。' },
    { id: 'c1-jane-eyre', title: 'Jane Eyre', author: 'Charlotte Brontë', difficulty: 74, genres: ['classic', 'romance'], length: 'long', edition: '英文原版', summary: '孤女简·爱坚持独立与尊严，在桑菲尔德庄园面对爱情和秘密。', fitReason: '叙述细腻，古典词汇、心理描写与长句密度较高。' },
    { id: 'c1-frankenstein', title: 'Frankenstein', author: 'Mary Shelley', difficulty: 76, genres: ['classic', 'science'], length: 'long', edition: '英文原版', summary: '维克多创造生命后逃避责任，被造物与自己的选择一路追赶。', fitReason: '书信嵌套叙事与哲学讨论要求稳定的长篇理解能力。' },
    { id: 'c1-dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', difficulty: 78, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '道林的容貌永远年轻，画像却替他承受欲望与道德腐败的痕迹。', fitReason: '机锋、隐喻和审美讨论丰富，适合精读语言层次。' },
    { id: 'c1-beloved', title: 'Beloved', author: 'Toni Morrison', difficulty: 83, genres: ['history', 'society'], length: 'long', edition: '英文原版', summary: '逃离奴役的塞丝与家人被过去的创伤和一个神秘女子重新纠缠。', fitReason: '时间跳跃、文化语境与诗性语言对推断能力要求很高。' },
    { id: 'c1-handmaids-tale', title: "The Handmaid's Tale", author: 'Margaret Atwood', difficulty: 77, genres: ['society', 'fantasy'], length: 'long', edition: '英文原版', summary: '奥芙弗雷德在剥夺女性权利的政权中讲述受控生活与微小反抗。', fitReason: '叙事碎片化且包含大量暗示，需要理解语气背后的权力关系。' },
    { id: 'c1-remains-day', title: 'The Remains of the Day', author: 'Kazuo Ishiguro', difficulty: 79, genres: ['history', 'society'], length: 'long', edition: '英文原版', summary: '英国管家史蒂文斯在旅途中回望职业忠诚、错失感情与时代选择。', fitReason: '正式克制的叙述中充满不可靠表达和言外之意。' },
    { id: 'c1-brief-history-time', title: 'A Brief History of Time', author: 'Stephen Hawking', difficulty: 80, genres: ['nonfiction', 'science'], length: 'long', edition: '英文原版', summary: '从宇宙起源、黑洞到时间方向，介绍现代物理的核心问题。', fitReason: '句法清楚但概念密集，需要跨段整合说明与论证。' },
    { id: 'c1-thinking-fast-slow', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', difficulty: 81, genres: ['nonfiction', 'science'], length: 'long', edition: '英文原版', summary: '通过实验与案例解释直觉思维、审慎思维以及常见判断偏差。', fitReason: '学术词汇和论证结构较多，适合训练非虚构深度阅读。' },
    { id: 'c1-educated', title: 'Educated', author: 'Tara Westover', difficulty: 73, genres: ['biography', 'society'], length: 'long', edition: '英文原版', summary: '作者回忆封闭家庭中的童年，以及教育如何重塑她的世界。', fitReason: '叙述可读性强，但文化背景与反思性词汇达到高级水平。' },
    { id: 'c1-road', title: 'The Road', author: 'Cormac McCarthy', difficulty: 75, genres: ['adventure', 'society'], length: 'long', edition: '英文原版', summary: '灾难后的世界里，一对父子沿公路南行，守护彼此与残存善意。', fitReason: '句子表面简洁，却有非常规标点、象征和省略表达。' },
    { id: 'c1-name-rose', title: 'The Name of the Rose', author: 'Umberto Eco', difficulty: 82, genres: ['history', 'mystery'], length: 'long', edition: '英文译本', summary: '中世纪修道院发生连续死亡，一位修士用推理追查知识与权力之谜。', fitReason: '历史、神学和符号学词汇密集，需较强背景推断能力。' },
  ]),
  ...makeBooks('C2', [
    { id: 'c2-moby-dick', title: 'Moby-Dick', author: 'Herman Melville', difficulty: 88, genres: ['adventure', 'classic'], length: 'long', edition: '英文原版', summary: '以实玛利登上捕鲸船，见证亚哈船长执意追逐白鲸的毁灭性航程。', fitReason: '航海术语、圣经典故、哲学旁论与多种文体交织。' },
    { id: 'c2-middlemarch', title: 'Middlemarch', author: 'George Eliot', difficulty: 89, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '一座英国小城中，多组人物的婚姻、理想和社会关系彼此影响。', fitReason: '长句、自由间接引语和细微社会观察需要接近熟练水平。' },
    { id: 'c2-ulysses', title: 'Ulysses', author: 'James Joyce', difficulty: 99, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '都柏林普通一天里的行走与思绪，被写成一场语言和意识的巨大实验。', fitReason: '文体不断变化，典故、双关与意识流构成极高理解门槛。' },
    { id: 'c2-sound-fury', title: 'The Sound and the Fury', author: 'William Faulkner', difficulty: 96, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '康普生家族的衰落通过多个破碎、彼此冲突的意识视角呈现。', fitReason: '非线性时间、意识流和不可靠叙述要求持续重构文本。' },
    { id: 'c2-mrs-dalloway', title: 'Mrs Dalloway', author: 'Virginia Woolf', difficulty: 91, genres: ['classic', 'society'], length: 'medium', edition: '英文原版', summary: '克拉丽莎筹备晚宴的一天，与战后伦敦中不同人物的意识交错。', fitReason: '视角无缝流动，语义常依靠节奏、联想和文化知识建立。' },
    { id: 'c2-to-lighthouse', title: 'To the Lighthouse', author: 'Virginia Woolf', difficulty: 93, genres: ['classic', 'society'], length: 'medium', edition: '英文原版', summary: '拉姆齐一家关于灯塔之行的愿望，在时间、战争和记忆中发生变化。', fitReason: '内心意识胜过外部情节，抽象意象与句法变化密集。' },
    { id: 'c2-invisible-man', title: 'Invisible Man', author: 'Ralph Ellison', difficulty: 92, genres: ['classic', 'society'], length: 'long', edition: '英文原版', summary: '一位无名黑人讲述自己如何被社会角色定义、利用并选择隐身。', fitReason: '演说、俚语、象征和美国历史语境同时发挥作用。' },
    { id: 'c2-midnights-children', title: "Midnight's Children", author: 'Salman Rushdie', difficulty: 94, genres: ['history', 'fantasy'], length: 'long', edition: '英文原版', summary: '与印度独立同一时刻出生的萨利姆，把个人命运与国家历史缠绕起来。', fitReason: '魔幻现实、语言混合、历史典故和复杂时间线层层叠加。' },
    { id: 'c2-gravity-rainbow', title: "Gravity's Rainbow", author: 'Thomas Pynchon', difficulty: 98, genres: ['history', 'science'], length: 'long', edition: '英文原版', summary: '二战末期的欧洲，火箭、情报、欲望与阴谋组成难以固定的网络。', fitReason: '跨学科典故、突然转调和碎片化结构挑战极限阅读能力。' },
    { id: 'c2-clockwork-orange', title: 'A Clockwork Orange', author: 'Anthony Burgess', difficulty: 90, genres: ['society', 'fantasy'], length: 'medium', edition: '英文原版', summary: '少年亚历克斯在暴力、惩罚与自由意志之间经历强制改造。', fitReason: '大量自造俚语迫使读者完全依赖上下文建立词义。' },
    { id: 'c2-cloud-atlas', title: 'Cloud Atlas', author: 'David Mitchell', difficulty: 95, genres: ['history', 'science'], length: 'long', edition: '英文原版', summary: '六个跨越时代与体裁的故事互相嵌套，展示权力和反抗的循环。', fitReason: '每部分都有独立语域和文体，需要快速切换阅读策略。' },
    { id: 'c2-blood-meridian', title: 'Blood Meridian', author: 'Cormac McCarthy', difficulty: 97, genres: ['history', 'classic'], length: 'long', edition: '英文原版', summary: '美国边疆暴力旅程被写成一部关于战争、人性与荒原的黑暗史诗。', fitReason: '古老词汇、无标点对话、圣经式句法和高密度意象并存。' },
  ]),
];

export const recommendedBookById = new Map(recommendedBooks.map((book) => [book.id, book]));
