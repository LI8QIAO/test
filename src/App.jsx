import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Palette, 
  Move, 
  Hash, 
  Hand, 
  Smile, 
  RotateCcw, 
  ChevronLeft,
  Trophy,
  History
} from 'lucide-react';

// --- Constants & Types ---
const MODES = {
  STROOP: 'stroop',
  DIRECTION: 'direction',
  NUMBERS: 'numbers',
  MIRROR: 'mirror',
  SEMANTIC: 'semantic',
  CHAOS: 'chaos'
};

const COLORS = [
  { name: '红', value: '#ef4444', colorName: 'red' },
  { name: '蓝', value: '#3b82f6', colorName: 'blue' },
  { name: '绿', value: '#22c55e', colorName: 'green' },
  { name: '黄', value: '#eab308', colorName: 'yellow' },
];

const EMOTIONS = [
  { word: '快乐', type: 'positive' },
  { word: '美丽', type: 'positive' },
  { word: '成功', type: 'positive' },
  { word: '甜蜜', type: 'positive' },
  { word: '痛苦', type: 'negative' },
  { word: '恶心', type: 'negative' },
  { word: '失败', type: 'negative' },
  { word: '丑陋', type: 'negative' },
];

// --- Utilities ---
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isPrime = (num) => {
  if (num <= 1) return false;
  for (let i = 2; i <= Math.sqrt(num); i++) {
    if (num % i === 0) return false;
  }
  return true;
};

// --- Main App Component ---
export default function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'result'
  const [currentMode, setCurrentMode] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [stats, setStats] = useState({
    correct: 0,
    total: 0,
    times: [],
    streak: 0,
    maxStreak: 0,
  });
  const [lastFeedback, setLastFeedback] = useState(null); // { correct: boolean, time: number }
  const [startTime, setStartTime] = useState(0);
  const [history, setHistory] = useState([]);
  const [isShaking, setIsShaking] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Timer ref for timeout-based modes
  const timeoutRef = useRef(null);

  // --- Game Logic ---

  const generateChallenge = useCallback((mode = currentMode) => {
    setIsShaking(false);
    setIsTransitioning(false);

    // Pick the mode to actually use for this specific round
    const activeMode = mode === MODES.CHAOS 
      ? getRandomElement([MODES.STROOP, MODES.DIRECTION, MODES.NUMBERS, MODES.MIRROR, MODES.SEMANTIC])
      : mode;

    // Reset everything to base state for the new challenge
    let challengeData = { mode: activeMode };

    // "Old-school" method: Completely isolated data generation for each mode
    if (activeMode === MODES.STROOP) {
      const textItem = getRandomElement(COLORS);
      const colorItem = getRandomElement(COLORS);
      challengeData = {
        ...challengeData,
        text: textItem.name,
        color: colorItem.value,
        answer: colorItem.name,
        options: COLORS.map(c => ({ label: c.name, value: c.name, bgColor: c.value }))
      };
    } else if (activeMode === MODES.DIRECTION) {
      const direction = getRandomElement(['left', 'right']);
      const command = getRandomElement(['同向', '反向']);
      const answer = command === '反向' ? (direction === 'left' ? 'right' : 'left') : direction;
      challengeData = {
        ...challengeData,
        arrow: direction === 'left' ? '←' : '→',
        command,
        answer,
        options: [{ label: '左', value: 'left' }, { label: '右', value: 'right' }]
      };
    } else if (activeMode === MODES.NUMBERS) {
      const num = Math.floor(Math.random() * 90) + 2; // 2-91
      challengeData = {
        ...challengeData,
        number: num,
        fontSizeClass: getRandomElement(['text-2xl', 'text-7xl']),
        answer: isPrime(num) ? 'prime' : 'composite',
        options: [{ label: '质数', value: 'prime' }, { label: '合数', value: 'composite' }]
      };
    } else if (activeMode === MODES.MIRROR) {
      const handType = getRandomElement(['left', 'right']);
      const finger = getRandomElement(['index', 'pinky']);
      const side = handType === 'left' ? 'right' : 'left';
      const vert = finger === 'index' ? 'up' : 'down';
      challengeData = {
        ...challengeData,
        hand: handType,
        finger,
        answer: `${side}-${vert}`,
        options: [
          { label: '左上', value: 'left-up' }, { label: '右上', value: 'right-up' },
          { label: '左下', value: 'left-down' }, { label: '右下', value: 'right-down' }
        ]
      };
    } else if (activeMode === MODES.SEMANTIC) {
      const emotion = getRandomElement(EMOTIONS);
      challengeData = {
        ...challengeData,
        word: emotion.word,
        answer: emotion.type === 'positive' ? 'negative' : 'positive',
        options: [
          { label: '正面', value: 'positive', color: 'green' },
          { label: '负面', value: 'negative', color: 'red' }
        ]
      };
    }

    setChallenge(challengeData);
    setStartTime(performance.now());

    if (activeMode === MODES.SEMANTIC) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => handleAnswer(null), 1500);
    }
  }, [currentMode]);

  const handleAnswer = (userAnswer) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const endTime = performance.now();
    const reactionTime = Math.round(endTime - startTime);
    const isCorrect = userAnswer === challenge.answer;
    const nextTotal = stats.total + 1;

    if (!isCorrect) {
      setIsShaking(true);
    }

    setStats(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      return {
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        total: nextTotal,
        times: isCorrect ? [...prev.times, reactionTime] : prev.times,
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
      };
    });

    setLastFeedback({ correct: isCorrect, time: reactionTime });
    
    // Add to history for error playback or analysis
    setHistory(prev => [...prev, { ...challenge, userAnswer, isCorrect, reactionTime }].slice(-50));

    // Wait a bit before next challenge
    setTimeout(() => {
      if (nextTotal >= 19 && gameState === 'playing') {
        setGameState('result');
      } else {
        // "Forced Refresh" internal state logic
        setIsTransitioning(true);
        setChallenge(null);
        setLastFeedback(null);
        
        // Small delay to ensure the component unmounts and state clears
        setTimeout(() => {
          generateChallenge();
        }, 50);
      }
    }, 300);
  };

  const startGame = (mode) => {
    setCurrentMode(mode);
    setGameState('playing');
    setStats({ correct: 0, total: 0, times: [], streak: 0, maxStreak: 0 });
    setHistory([]);
    generateChallenge(mode);
  };

  const backToMenu = () => {
    setGameState('menu');
    setChallenge(null);
    setLastFeedback(null);
  };

  // --- Render Helpers ---

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center space-y-8 p-8 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tighter text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          反直觉反应力挑战
        </h1>
        <p className="text-gray-400 text-lg">对抗你的潜意识，在认知冲突中存活</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        <MenuCard 
          title="颜色 Stroop" 
          desc="忽略文字含义，点击物理颜色" 
          icon={<Palette />} 
          onClick={() => startGame(MODES.STROOP)}
          color="blue"
        />
        <MenuCard 
          title="方向矛盾" 
          desc="箭头是谎言，听从文字指令" 
          icon={<Move />} 
          onClick={() => startGame(MODES.DIRECTION)}
          color="purple"
        />
        <MenuCard 
          title="质数干扰" 
          desc="数字大小会骗人，判断质数合数" 
          icon={<Hash />} 
          onClick={() => startGame(MODES.NUMBERS)}
          color="green"
        />
        <MenuCard 
          title="镜像映射" 
          desc="左手点右，右手点左" 
          icon={<Hand />} 
          onClick={() => startGame(MODES.MIRROR)}
          color="orange"
        />
        <MenuCard 
          title="语义翻转" 
          desc="正面词按负面，负面词按正面" 
          icon={<Smile />} 
          onClick={() => startGame(MODES.SEMANTIC)}
          color="red"
        />
        <MenuCard 
          title="混战模式" 
          desc="随机切换规则，终极考验" 
          icon={<Zap />} 
          onClick={() => startGame(MODES.CHAOS)}
          color="yellow"
          highlight
        />
      </div>
    </div>
  );

  const renderPlaying = () => {
    if (!challenge || isTransitioning) return <div className="min-h-[80vh]" />;

    return (
      <div className="flex flex-col items-center justify-between min-h-[80vh] py-12 px-4">
        {/* Header Stats */}
        <div className="flex justify-between w-full max-w-2xl text-gray-400 font-mono text-sm">
          <div>进度: {stats.total + 1} / 20</div>
          <div>连击: <span className="text-yellow-500 font-bold">{stats.streak}</span></div>
          <div>准确率: {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100}%</div>
        </div>

        {/* Challenge Area */}
        <div className={`relative flex flex-col items-center justify-center flex-1 w-full max-w-xl transition-transform duration-100 ${isShaking ? 'animate-shake' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${challenge.mode}-${stats.total}`}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center"
            >
              {/* Mode Indicator & Instructions */}
              <div className="absolute -top-20 flex flex-col items-center gap-2">
                <div className="px-4 py-1 bg-white/10 rounded-full text-xs uppercase tracking-widest text-gray-400">
                  {getModeName(challenge.mode)}
                </div>
                <div className="text-sm font-medium text-blue-400/80 italic">
                  {getInstruction(challenge.mode)}
                </div>
              </div>

              {/* Specific Challenge Content */}
              <div className="my-8 text-center min-h-[200px] flex items-center justify-center">
                {challenge.mode === MODES.STROOP && (
                  <span className="text-8xl font-black" style={{ color: challenge.color }}>
                    {challenge.text}
                  </span>
                )}
                {challenge.mode === MODES.DIRECTION && (
                  <div className="flex flex-col items-center space-y-4">
                    <span className="text-9xl font-bold text-white">{challenge.arrow}</span>
                    <span className="text-3xl font-bold bg-white text-black px-4 py-1 rounded">
                      {challenge.command}
                    </span>
                  </div>
                )}
                {challenge.mode === MODES.NUMBERS && (
                  <span className={`font-black text-white ${challenge.fontSizeClass}`}>
                    {challenge.number}
                  </span>
                )}
                {challenge.mode === MODES.MIRROR && (
                  <div className="flex flex-col items-center space-y-6">
                    <div className={`text-9xl transition-transform duration-300 ${challenge.hand === 'left' ? 'scale-x-[-1]' : ''}`}>
                      {challenge.finger === 'index' ? '☝️' : '🤙'}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-bold text-gray-300">
                        {challenge.hand === 'left' ? '左手图' : '右手图'}
                      </span>
                      <span className="text-xs text-gray-500 uppercase tracking-widest">
                        {challenge.finger === 'index' ? '食指 (向上)' : '小指 (向下)'}
                      </span>
                    </div>
                  </div>
                )}
                {challenge.mode === MODES.SEMANTIC && (
                  <span className="text-7xl font-bold text-white tracking-widest italic">
                    {challenge.word}
                  </span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Feedback Overlay */}
          <AnimatePresence>
            {lastFeedback && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`absolute pointer-events-none text-4xl font-black ${
                  lastFeedback.correct ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {lastFeedback.correct ? `${lastFeedback.time}ms` : '错误!'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Control Area */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-12">
          {challenge.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className="py-6 px-4 bg-white/5 hover:bg-white/10 active:scale-95 transition-all rounded-2xl border border-white/10 text-xl font-bold text-white flex flex-col items-center justify-center space-y-2 group"
            >
              {opt.bgColor && (
                <div 
                  className="w-8 h-8 rounded-full mb-1 border border-white/20" 
                  style={{ backgroundColor: opt.bgColor }}
                />
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    const avgTime = stats.times.length > 0 
      ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length) 
      : 0;
    const accuracy = Math.round((stats.correct / 19) * 100);
    
    // "Anti-Intuition Index" Calculation
    const antiIndex = Math.round((accuracy * 10) - (avgTime / 10));

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-4xl font-black text-white">测试完成!</h2>
          <p className="text-gray-400 mt-2">以下是你的反直觉报告</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <StatBox label="平均反应时" value={`${avgTime}ms`} icon={<Zap size={16} />} />
          <StatBox label="正确率" value={`${accuracy}%`} icon={<Trophy size={16} />} />
          <StatBox label="最高连击" value={stats.maxStreak + 1} icon={<History size={16} />} />
          <StatBox label="反直觉指数" value={antiIndex} icon={<RotateCcw size={16} />} highlight />
        </div>

        <div className="w-full bg-white/5 rounded-3xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">最近 10 次表现</h3>
          <div className="flex items-end justify-between h-32 gap-1">
            {history.slice(-10).map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className={`w-full rounded-t ${h.isCorrect ? 'bg-green-500/50' : 'bg-red-500/50'}`}
                  style={{ height: `${Math.min(h.reactionTime / 10, 100)}%` }}
                />
                <span className="text-[10px] text-gray-500 font-mono">{h.reactionTime}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <button 
            onClick={() => startGame(currentMode)}
            className="flex-1 py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 transition-colors"
          >
            再试一次
          </button>
          <button 
            onClick={backToMenu}
            className="flex-1 py-4 bg-white/10 text-white font-black rounded-2xl hover:bg-white/20 transition-colors"
          >
            返回菜单
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-purple-500/30 overflow-x-hidden">
      <nav className="p-6 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={backToMenu}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase">Intuition.X</span>
        </div>
        
        {gameState === 'playing' && (
          <button 
            onClick={backToMenu}
            className="flex items-center space-x-2 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            <span>退出</span>
          </button>
        )}
      </nav>

      <main className="container mx-auto max-w-6xl">
        <AnimatePresence mode="wait">
          {gameState === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderMenu()}
            </motion.div>
          )}
          {gameState === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderPlaying()}
            </motion.div>
          )}
          {gameState === 'result' && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {renderResult()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-12 text-center text-gray-600 text-xs">
        <p>© 2026 反直觉实验室 - 认知心理学挑战项目</p>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function MenuCard({ title, desc, icon, onClick, color, highlight }) {
  const colorMap = {
    blue: 'hover:border-blue-500/50 group-hover:bg-blue-500/10',
    purple: 'hover:border-purple-500/50 group-hover:bg-purple-500/10',
    green: 'hover:border-green-500/50 group-hover:bg-green-500/10',
    orange: 'hover:border-orange-500/50 group-hover:bg-orange-500/10',
    red: 'hover:border-red-500/50 group-hover:bg-red-500/10',
    yellow: 'hover:border-yellow-500/50 group-hover:bg-yellow-500/10',
  };

  return (
    <button 
      onClick={onClick}
      className={`group relative text-left p-6 bg-white/5 border border-white/10 rounded-3xl transition-all duration-300 ${colorMap[color]} ${highlight ? 'ring-2 ring-yellow-500/20' : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 transition-colors ${colorMap[color]}`}>
        {React.cloneElement(icon, { className: highlight ? 'text-yellow-500' : 'text-gray-400 group-hover:text-white' })}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      {highlight && (
        <span className="absolute top-4 right-4 px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-black rounded uppercase">
          RECOMMENDED
        </span>
      )}
    </button>
  );
}

function StatBox({ label, value, icon, highlight }) {
  return (
    <div className={`p-6 rounded-3xl border ${highlight ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 border-white/10 text-white'}`}>
      <div className="flex items-center space-x-2 mb-1 opacity-70">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}

function getModeName(mode) {
  const names = {
    [MODES.STROOP]: '颜色 Stroop',
    [MODES.DIRECTION]: '方向矛盾',
    [MODES.NUMBERS]: '质合干扰',
    [MODES.MIRROR]: '镜像映射',
    [MODES.SEMANTIC]: '语义翻转',
  };
  return names[mode] || mode;
}

function getInstruction(mode) {
  const instructions = {
    [MODES.STROOP]: '点击文字的物理颜色，忽略文字含义',
    [MODES.DIRECTION]: '跟随文字指令，忽略箭头指向',
    [MODES.NUMBERS]: '判断质数合数，忽略字体大小',
    [MODES.MIRROR]: '左手图点右，右手图点左；食指上，小指下',
    [MODES.SEMANTIC]: '正面词选负面，负面词选正面',
  };
  return instructions[mode] || '';
}
