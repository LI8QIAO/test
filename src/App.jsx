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
  History,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Clock,
  LogIn,
  User as UserIcon,
  Globe,
  X,
  Trash2
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

const STORAGE_KEY = 'intuition_x_leaderboard';
const USER_STORAGE_KEY = 'intuition_x_user';
const API_URL = '/api/leaderboard';
const AUTH_URL = '/api/auth';
const RUN_URL = '/api/run/submit';

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
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Use refs for game-critical logic to avoid stale closures and double-triggers
  const gameRunning = useRef(false);
  const totalProcessed = useRef(0);
  const timeoutRef = useRef(null);

  const saveScore = useCallback((mode, accuracy, avgTime, antiIndex) => {
    const rawData = localStorage.getItem(STORAGE_KEY);
    const scores = rawData ? JSON.parse(rawData) : {};
    if (!scores[mode]) scores[mode] = [];
    
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      accuracy,
      avgTime,
      antiIndex
    };
    
    scores[mode].push(newEntry);
    // Sort by antiIndex descending
    scores[mode].sort((a, b) => b.antiIndex - a.antiIndex);
    // Keep top 20
    scores[mode] = scores[mode].slice(0, 20);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    
    // Auto-upload if user is logged in
    if (user) {
      uploadBestScores(user.username, scores);
    }
  }, [user]);

  const uploadBestScores = async (username, allScores) => {
    try {
      // Get best score for each mode
      const bestScores = Object.keys(allScores).map(modeId => {
        const topScore = allScores[modeId][0]; // Already sorted in saveScore
        return {
          modeId,
          username,
          accuracy: topScore.accuracy,
          avgTime: topScore.avgTime,
          antiIndex: topScore.antiIndex,
          date: topScore.date
        };
      });

      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, scores: bestScores })
      });
    } catch (error) {
      console.error('Failed to upload scores:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    setIsLoginModalOpen(false);
    
    // Upload existing scores on login
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      uploadBestScores(userData.username, JSON.parse(rawData));
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    setIsUserMenuOpen(false);
  };

  const handleUpdateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setIsAccountModalOpen(false);
    setIsUserMenuOpen(false);
  };

  const handleDeleteAccount = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    setIsDeleteAccountModalOpen(false);
    setIsUserMenuOpen(false);
  };

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
    // Prevent multiple clicks or processing if not in playing state
    if (gameState !== 'playing' || isTransitioning || lastFeedback || timeoutRef.current === 'processing') return;
    
    if (timeoutRef.current && timeoutRef.current !== 'processing') {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = 'processing'; // Lock processing
    
    const endTime = performance.now();
    const reactionTime = Math.round(endTime - startTime);
    const isCorrect = userAnswer === challenge.answer;
    
    // Update ref immediately
    totalProcessed.current += 1;
    const currentTotal = totalProcessed.current;

    if (!isCorrect) {
      setIsShaking(true);
    }

    setStats(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      return {
        correct: isCorrect ? prev.correct + 1 : prev.correct,
        total: currentTotal,
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
      timeoutRef.current = null; // Unlock
      if (currentTotal >= 19) {
        // Calculate and save score
        const finalCorrect = isCorrect ? stats.correct + 1 : stats.correct;
        const finalTimes = isCorrect ? [...stats.times, reactionTime] : stats.times;
        const avgTime = finalTimes.length > 0 
          ? Math.round(finalTimes.reduce((a, b) => a + b, 0) / finalTimes.length) 
          : 0;
        const accuracy = Math.round((finalCorrect / 19) * 100);
        const antiIndex = Math.round((accuracy * 10) - (avgTime / 10));
        
        if (user) {
          fetch(RUN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: user.username,
              modeId: currentMode,
              accuracy,
              avgTime,
              antiIndex,
            }),
          }).catch(() => {});
        }

        saveScore(currentMode, accuracy, avgTime, antiIndex);

        setGameState('result');
        setLastFeedback(null); // Clear feedback when going to result screen
        gameRunning.current = false;
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
    if (gameRunning.current) return; // Prevent double start
    
    gameRunning.current = true;
    totalProcessed.current = 0;
    setCurrentMode(mode);
    setGameState('playing');
    setStats({ correct: 0, total: 0, times: [], streak: 0, maxStreak: 0 });
    setHistory([]);
    setLastFeedback(null); // Clear feedback from previous session
    generateChallenge(mode);
  };

  const backToMenu = () => {
    gameRunning.current = false; // Reset game lock when returning to menu
    setGameState('menu');
    setChallenge(null);
    setLastFeedback(null);
  };

  const showLeaderboard = () => {
    setGameState('leaderboard');
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
          <AntiIndexBox antiIndex={antiIndex} accuracy={accuracy} avgTime={avgTime} />
        </div>

        <div className="w-full bg-white/5 rounded-3xl p-6 border border-white/10">
          <h3 className="text-lg font-bold text-white mb-6">最近 10 次表现 (反应时趋势)</h3>
          <div className="flex items-end justify-center h-48 gap-3">
            {(() => {
              const lastTen = history.slice(-10);
              if (lastTen.length === 0) return <div className="text-gray-500 text-sm">暂无数据</div>;
              
              const times = lastTen.map(h => h.reactionTime);
              const maxTime = Math.max(...times);
              const minTime = Math.min(...times);
              const range = maxTime - minTime;
              
              return lastTen.map((h, i) => {
                // Calculate relative height: 20% to 100%
                // If all times are the same, use 60%
                const relativeHeight = range === 0 ? 60 : ((h.reactionTime - minTime) / range) * 80 + 20;

                return (
                  <div key={i} className="flex-1 max-w-[40px] flex flex-col items-center gap-3 group relative h-full justify-end">
                    {/* The Bar */}
                    <div 
                      className="w-full bg-white rounded-t-sm transition-all duration-700 ease-out shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:bg-blue-400"
                      style={{ 
                        height: `${relativeHeight}%`,
                      }}
                    />
                    {/* The Info Below */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[10px] font-mono text-white/80 mb-0.5">
                        {h.reactionTime}
                      </span>
                      <span className={`text-[12px] font-bold ${h.isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                        {h.isCorrect ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
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
    <div className="min-h-screen bg-animated-gradient text-white selection:bg-purple-500/30 overflow-x-hidden transition-all duration-1000">
      <nav className="p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-sm bg-black/10">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={backToMenu}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase">Intuition.X</span>
        </div>
        
        <div className="flex items-center gap-6">
          {gameState === 'menu' && (
            <div className="flex items-center gap-4 relative">
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 text-white bg-white/10 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/20 transition-all"
                  >
                    <UserIcon size={16} className="text-blue-400" />
                    <span className="font-bold text-xs tracking-wide">{user.username}</span>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                      >
                        <button 
                          onClick={() => setIsAccountModalOpen(true)}
                          className="w-full px-4 py-3 text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          <UserIcon size={14} />
                          管理账户
                        </button>
                        <button 
                          onClick={handleLogout}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5"
                        >
                          <LogIn size={14} className="rotate-180" />
                          Logout
                        </button>
                        <button 
                          onClick={() => setIsDeleteAccountModalOpen(true)}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5"
                        >
                          <Trash2 size={14} />
                          注销账户
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-white transition-colors group"
                >
                  <LogIn size={20} className="group-hover:text-blue-500 transition-colors" />
                  <span className="font-bold text-sm">Login</span>
                </button>
              )}
              
              <button 
                onClick={showLeaderboard}
                className="flex items-center space-x-2 text-gray-500 hover:text-white transition-colors group"
              >
                <ListOrdered size={20} className="group-hover:text-yellow-500 transition-colors" />
                <span className="font-bold text-sm">排行榜</span>
              </button>
            </div>
          )}

          {gameState !== 'menu' && (
            <button 
              onClick={backToMenu}
              className="flex items-center space-x-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              <span>退出</span>
            </button>
          )}
        </div>
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
          {gameState === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LeaderboardView onBack={backToMenu} />
            </motion.div>
          )}
        </AnimatePresence>

        <LoginModal 
           isOpen={isLoginModalOpen} 
           onClose={() => setIsLoginModalOpen(false)} 
           onLogin={handleLogin} 
         />

         <AccountModal 
           isOpen={isAccountModalOpen} 
           user={user}
           onClose={() => setIsAccountModalOpen(false)} 
           onUpdate={handleUpdateUser} 
         />

          <DeleteAccountModal
            isOpen={isDeleteAccountModalOpen}
            user={user}
            onClose={() => setIsDeleteAccountModalOpen(false)}
            onDeleted={handleDeleteAccount}
          />
        </main>

      <footer className="p-12 text-center text-gray-500 text-xs backdrop-blur-sm bg-black/5 mt-auto">
        <a
          href="https://github.com/LI8QIAO/test"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          © 2026 反直觉实验室 - 认知心理学挑战项目
        </a>
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

function AntiIndexBox({ antiIndex, accuracy, avgTime }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = pinned || hovered;

  const togglePinned = () => {
    setPinned((v) => !v);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      togglePinned();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={togglePinned}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="p-6 rounded-3xl border bg-yellow-500 text-black border-yellow-400 cursor-pointer select-none"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2 opacity-80">
          <RotateCcw size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">反直觉指数</span>
        </div>
        <ChevronDown size={16} className={`opacity-60 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </div>

      <div className="text-3xl font-black">{antiIndex}</div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="text-[12px] leading-relaxed text-black/80">
              <div className="font-bold text-black/90">含义</div>
              <div>综合衡量你在认知冲突中的抑制能力与速度，数值越高代表越能“反直觉”地做出正确反应。</div>
              <div className="mt-2 font-bold text-black/90">算法</div>
              <div className="font-mono text-[11px] bg-black/10 rounded-xl px-3 py-2 mt-1">
                round(正确率% × 10 − 平均反应时(ms) ÷ 10)
              </div>
              <div className="mt-2">
                <span className="font-bold">当前：</span>
                正确率 {accuracy}% ，平均反应时 {avgTime}ms
              </div>
              <div className="mt-2 text-black/60">提示：点击（或触摸）可固定展开/收起。</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function LeaderboardView({ onBack }) {
  const [expandedMode, setExpandedMode] = useState(null);
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'global'
  const [personalScores, setPersonalScores] = useState({});
  const [globalScores, setGlobalScores] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) setPersonalScores(JSON.parse(rawData));
  }, []);

  useEffect(() => {
    if (activeTab === 'global') {
      fetchGlobalScores();
    }
  }, [activeTab]);

  const fetchGlobalScores = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setGlobalScores(data);
      }
    } catch (error) {
      console.error('Failed to fetch global scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const modeList = [
    { id: MODES.STROOP, name: '颜色 Stroop', color: 'blue' },
    { id: MODES.DIRECTION, name: '方向矛盾', color: 'purple' },
    { id: MODES.NUMBERS, name: '质合干扰', color: 'green' },
    { id: MODES.MIRROR, name: '镜像映射', color: 'orange' },
    { id: MODES.SEMANTIC, name: '语义翻转', color: 'red' },
    { id: MODES.CHAOS, name: '混战模式', color: 'yellow' },
  ];

  return (
    <div className="flex flex-col items-center py-12 px-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between w-full mb-8">
        <h2 className="text-4xl font-black text-white">排行榜</h2>
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
          <ChevronLeft size={32} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-8">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'personal' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <UserIcon size={16} />
            个人记录
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('global')}
          className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'global' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
          <div className="flex items-center gap-2">
            <Globe size={16} />
            全民排行
          </div>
        </button>
      </div>

      <div className="space-y-4 w-full">
        {modeList.map((mode) => {
          const modeScores = activeTab === 'personal' ? (personalScores[mode.id] || []) : (globalScores[mode.id] || []);
          const isExpanded = expandedMode === mode.id;

          return (
            <div key={mode.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setExpandedMode(isExpanded ? null : mode.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${mode.id === MODES.CHAOS ? 'bg-yellow-500' : 'opacity-0'}`} />
                  <span className="text-xl font-bold text-white">{mode.name}</span>
                  <span className="text-sm text-gray-500">({isLoading && activeTab === 'global' ? '加载中...' : `${modeScores.length} 条记录`})</span>
                </div>
                {isExpanded ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5"
                  >
                    {modeScores.length > 0 ? (
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-4 text-xs font-bold text-gray-500 uppercase tracking-widest pb-2 border-b border-white/5">
                          <span>{activeTab === 'personal' ? '排名 / 日期' : '排名 / 玩家'}</span>
                          <span className="text-center">正确率</span>
                          <span className="text-center">平均用时</span>
                          <span className="text-right">反直觉指数</span>
                        </div>
                        {modeScores.map((score, index) => (
                          <div key={score.id || index} className="grid grid-cols-4 items-center py-2 text-sm border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400'}`}>
                                {index + 1}
                              </span>
                              <span className="text-gray-400 text-[10px] truncate max-w-[80px]">
                                {activeTab === 'personal' ? score.date : score.username}
                              </span>
                            </div>
                            <span className="text-center font-mono text-white">{score.accuracy}%</span>
                            <span className="text-center font-mono text-white">{score.avgTime}ms</span>
                            <span className="text-right font-black text-yellow-500">{score.antiIndex}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-gray-500 italic">
                        {isLoading ? '加载中...' : '暂无测试记录'}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoginModal({ isOpen, onClose, onLogin }) {
  const [view, setView] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // 'available', 'taken', null

  useEffect(() => {
    if (view === 'register' && username.length >= 2) {
      const timer = setTimeout(() => checkUsername(username), 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [username, view]);

  const checkUsername = async (name) => {
    try {
      const res = await fetch(`${AUTH_URL}?username=${name}`);
      const data = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    if (!username || !password) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: view, 
          username, 
          password 
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.message || '操作失败');
      }
    } catch (e) {
      setError('网络错误，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-[#1a1a1a] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {view === 'login' ? <LogIn className="text-blue-500" size={32} /> : <UserIcon className="text-purple-500" size={32} />}
          </div>
          <h3 className="text-2xl font-black text-white">{view === 'login' ? '登入系统' : '创建账户'}</h3>
          <p className="text-gray-500 text-sm mt-1">
            {view === 'login' ? '输入凭据以同步全球排行榜' : '注册以开始你的全球挑战之旅'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">用户名</label>
              {view === 'register' && username.length >= 2 && (
                <span className={`text-[10px] font-bold ${usernameStatus === 'available' ? 'text-green-500' : 'text-red-500'}`}>
                  {usernameStatus === 'available' ? '用户名可用' : usernameStatus === 'taken' ? '用户名已被占用' : '检查中...'}
                </span>
              )}
            </div>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="你的实验编号..."
              className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 transition-all ${
                usernameStatus === 'taken' ? 'border-red-500/50 focus:ring-red-500/50' : 'border-white/10 focus:ring-blue-500/50'
              }`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">密码</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
          
          <button 
            disabled={isLoading || !username || !password || (view === 'register' && usernameStatus !== 'available')}
            onClick={handleSubmit}
            className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg mt-4"
          >
            {isLoading ? '处理中...' : view === 'login' ? '确认登入' : '立即注册'}
          </button>

          <div className="text-center mt-6">
            <button 
              onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
            >
              {view === 'login' ? '还没有账号? 立即注册' : '已有账号? 返回登录'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AccountModal({ isOpen, user, onClose, onUpdate }) {
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setNewUsername(user?.username || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (newUsername !== user?.username && newUsername.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`${AUTH_URL}?username=${newUsername}`);
          const data = await res.json();
          setUsernameStatus(data.available ? 'available' : 'taken');
        } catch (e) { console.error(e); }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [newUsername, user]);

  const handleUpdate = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'update',
          currentUsername: user.username,
          newUsername,
          oldPassword,
          newPassword: newPassword || undefined
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        onUpdate(data.user);
      } else {
        setError(data.message || '修改失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1a1a1a] border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
        
        <h3 className="text-2xl font-black text-white mb-6">管理账户</h3>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">修改用户名</label>
              {newUsername !== user?.username && (
                <span className={`text-[10px] font-bold ${usernameStatus === 'available' ? 'text-green-500' : 'text-red-500'}`}>
                  {usernameStatus === 'available' ? '可用' : '已被占用'}
                </span>
              )}
            </div>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>

          <div className="border-t border-white/5 pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">当前密码 (必填)</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="验证当前身份..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">新密码 (可选)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="设置新密码" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="确认新密码" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
          
          <button 
            disabled={isLoading || !oldPassword || (newUsername !== user?.username && usernameStatus !== 'available')}
            onClick={handleUpdate}
            className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 disabled:opacity-50 transition-all shadow-lg"
          >
            {isLoading ? '保存中...' : '保存更改'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteAccountModal({ isOpen, user, onClose, onDeleted }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!user?.username || !password) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          currentUsername: user.username,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || '注销失败');
        return;
      }
      onDeleted();
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-[#1a1a1a] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="text-red-500" size={32} />
          </div>
          <h3 className="text-2xl font-black text-white">注销账户</h3>
          <p className="text-gray-500 text-sm mt-1">将永久删除你的账户与记录（不可恢复）</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">输入密码确认</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && password && handleDelete()}
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

          <button
            disabled={isLoading || !password}
            onClick={handleDelete}
            className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isLoading ? '处理中...' : '确认注销'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
