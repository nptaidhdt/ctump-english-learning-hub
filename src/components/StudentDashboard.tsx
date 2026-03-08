import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Book, Headphones, Mic, PenTool, 
  MessageCircle, Star, ChevronRight, Play, 
  CheckCircle2, HelpCircle, Loader2, Sparkles, Volume2, Eye, EyeOff, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { evaluateWriting, evaluateSpeaking, generateListeningPassage, generateTTS, generateSpeakingSentences } from '../services/geminiService';

export default function StudentDashboard() {
  const { user, token, logout } = useAuthStore();
  const [lessons, setLessons] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [view, setView] = useState<'lessons' | 'practice' | 'quiz'>('lessons');
  const [lessonSearch, setLessonSearch] = useState('');
  const [vocab, setVocab] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Practice states
  const [writingPrompt, setWritingPrompt] = useState('Hãy viết một đoạn văn ngắn (50-100 từ) giới thiệu về bản thân bằng tiếng Anh.');
  const [writingText, setWritingText] = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const [activeSkill, setActiveSkill] = useState<string>('vocab');
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  // Speaking states
  const [speakingSentences, setSpeakingSentences] = useState<string[]>([]);
  const [currentSpeakingIndex, setCurrentSpeakingIndex] = useState(0);

  // Listening states
  const [listeningData, setListeningData] = useState<{ title: string, passage: string, audioUrl: string, questions: any[] } | null>(null);
  const [showPassage, setShowPassage] = useState(false);
  const [hasFinishedListening, setHasFinishedListening] = useState(false);
  const [listeningAnswers, setListeningAnswers] = useState<number[]>([]);
  const [showListeningResults, setShowListeningResults] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchLessons();
  }, []);

  const fetchAssignments = async () => {
    const res = await fetch('/api/student/assignments', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setAssignments(data);
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  useEffect(() => {
    if (activeSkill === 'listening' && !listeningData && vocab.length > 0) {
      handleGenerateListening();
    }
    if (activeSkill === 'speaking' && speakingSentences.length === 0 && vocab.length > 0) {
      handleGenerateSpeakingSentences();
    }
  }, [activeSkill, vocab]);

  const handleGenerateSpeakingSentences = async () => {
    setLoading(true);
    try {
      const sentences = await generateSpeakingSentences(vocab);
      setSpeakingSentences(sentences);
      setCurrentSpeakingIndex(0);
    } finally {
      setLoading(false);
    }
  };

  const playWord = async (word: string) => {
    setPlayingWord(word);
    try {
      const audioUrl = await generateTTS(`Word: ${word}`);
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (e) {
      console.error("TTS Error:", e);
    } finally {
      setPlayingWord(null);
    }
  };

  const fetchLessons = async () => {
    const res = await fetch('/api/lessons', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setLessons(data);
  };

  const handleSelectLesson = async (lesson: any, assignment: any = null) => {
    setSelectedLesson(lesson);
    setSelectedAssignment(assignment);
    setLoading(true);
    try {
      const [filesRes, exRes] = await Promise.all([
        fetch(`/api/lessons/${lesson.id}/files`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/lessons/${lesson.id}/exercises`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const files = await filesRes.json();
      const ex = await exRes.json();
      
      // Combine vocab from all files
      const allVocab = files.reduce((acc: any[], file: any) => {
        if (file.vocabulary) {
          try {
            const parsed = JSON.parse(file.vocabulary);
            return [...acc, ...parsed];
          } catch (e) {
            return acc;
          }
        }
        return acc;
      }, []);

      setVocab(allVocab);
      setExercises(ex);

      // Check for pre-generated listening
      const listeningEx = ex.find((e: any) => e.type === 'listening');
      if (listeningEx) {
        try {
          const content = typeof listeningEx.content === 'string' ? JSON.parse(listeningEx.content) : listeningEx.content;
          setListeningData({
            title: content.title || 'Bài nghe',
            passage: content.passage,
            audioUrl: listeningEx.audio_url,
            questions: content.questions
          });
        } catch (e) {
          console.error("Error parsing listening exercise:", e);
        }
      } else {
        setListeningData(null);
      }

      // Check for pre-generated pronunciation
      const pronunciationEx = ex.find((e: any) => e.type === 'pronunciation');
      if (pronunciationEx) {
        try {
          const content = typeof pronunciationEx.content === 'string' ? JSON.parse(pronunciationEx.content) : pronunciationEx.content;
          // Handle both array of strings and object with sentences array
          const sentences = Array.isArray(content) ? content : (content.sentences || []);
          setSpeakingSentences(sentences);
          setCurrentSpeakingIndex(0);
        } catch (e) {
          console.error("Error parsing pronunciation exercise:", e);
        }
      } else {
        setSpeakingSentences([]);
      }

      setView('practice');
      setActiveSkill('vocab');
    } finally {
      setLoading(false);
    }
  };

  const handleWritingSubmit = async () => {
    setLoading(true);
    try {
      const result = await evaluateWriting(writingPrompt, writingText);
      setFeedback(result);
    } finally {
      setLoading(false);
    }
  };

  const startSpeakingPractice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleSpeakingSubmit = async () => {
    setLoading(true);
    try {
      const result = await evaluateSpeaking(speakingSentences[currentSpeakingIndex], transcript);
      setFeedback(result);
    } finally {
      setLoading(false);
    }
  };

  const nextSpeakingSentence = () => {
    if (currentSpeakingIndex + 1 < speakingSentences.length) {
      setCurrentSpeakingIndex(currentSpeakingIndex + 1);
      setTranscript('');
      setFeedback(null);
    } else {
      alert('Bạn đã hoàn thành tất cả câu mẫu!');
      handleGenerateSpeakingSentences(); // Generate new ones
    }
  };

  const handleGenerateListening = async () => {
    if (vocab.length === 0) {
      alert('Bài học này chưa có từ vựng để tạo bài nghe.');
      return;
    }
    setLoading(true);
    try {
      const passageData = await generateListeningPassage(vocab);
      const audioUrl = await generateTTS(passageData.passage);
      setListeningData({ ...passageData, audioUrl });
      setShowPassage(false);
      setHasFinishedListening(false);
      setListeningAnswers([]);
      setShowListeningResults(false);
    } catch (e: any) {
      alert('Lỗi khi tạo bài nghe: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleListeningAnswer = (qIndex: number, aIndex: number) => {
    const newAnswers = [...listeningAnswers];
    newAnswers[qIndex] = aIndex;
    setListeningAnswers(newAnswers);
  };

  const submitListeningQuiz = () => {
    if (listeningAnswers.length < (listeningData?.questions.length || 0)) {
      alert('Vui lòng trả lời tất cả các câu hỏi.');
      return;
    }
    setShowListeningResults(true);
  };

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const [fibIndex, setFibIndex] = useState(0);
  const [fibScore, setFibScore] = useState(0);
  const [fibFinished, setFibFinished] = useState(false);
  const [fibAnswer, setFibAnswer] = useState('');
  const [fibFeedback, setFibFeedback] = useState<string | null>(null);

  // Submit scores when finished
  useEffect(() => {
    if (quizFinished && exercises.length > 0) {
      const mcExercises = exercises.filter(e => e.type === 'multiple_choice');
      if (mcExercises.length > 0) {
        fetch('/api/submissions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            exercise_id: mcExercises[0].id,
            answers: {},
            score: (quizScore / mcExercises[0].content.length) * 10,
            feedback: 'Hoàn thành bài tập trắc nghiệm'
          })
        });
      }
    }
  }, [quizFinished]);

  useEffect(() => {
    if (fibFinished && exercises.length > 0) {
      const fibExercises = exercises.filter(e => e.type === 'fill_in_blank');
      if (fibExercises.length > 0) {
        fetch('/api/submissions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            exercise_id: fibExercises[0].id,
            answers: {},
            score: (fibScore / fibExercises[0].content.length) * 10,
            feedback: 'Hoàn thành bài tập điền từ'
          })
        });
      }
    }
  }, [fibFinished]);

  const handleFibSubmit = () => {
    const fibExercises = exercises.filter(e => e.type === 'fill_in_blank');
    const currentFib = fibExercises[0]?.content[fibIndex];
    
    const isCorrect = fibAnswer.trim().toLowerCase() === currentFib.missingWord.toLowerCase();
    
    if (isCorrect) {
      setFibScore(fibScore + 1);
      setFibFeedback('Chính xác!');
    } else {
      setFibFeedback(`Chưa đúng. Đáp án là: ${currentFib.missingWord}`);
    }

    setTimeout(() => {
      setFibFeedback(null);
      setFibAnswer('');
      if (fibIndex + 1 < fibExercises[0]?.content.length) {
        setFibIndex(fibIndex + 1);
      } else {
        setFibFinished(true);
      }
    }, 2000);
  };

  const handleQuizAnswer = (index: number) => {
    const mcExercises = exercises.filter(e => e.type === 'multiple_choice');
    const currentQuiz = mcExercises[0]?.content[quizIndex];
    if (index === currentQuiz.correctIndex) {
      setQuizScore(quizScore + 1);
    }
    if (quizIndex + 1 < mcExercises[0]?.content.length) {
      setQuizIndex(quizIndex + 1);
    } else {
      setQuizFinished(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm p-1 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-gray-900">Sinh viên</h1>
              <p className="text-xs text-gray-500">{user?.name}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors">Đăng xuất</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'lessons' ? (
            <motion.div 
              key="lessons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-serif text-gray-900">Bài tập của bạn</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Tìm bài tập..."
                      value={lessonSearch}
                      onChange={(e) => setLessonSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64 shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-black/5 shadow-sm">
                    <span className="text-xs font-medium text-gray-500">{assignments.length} bài tập được giao</span>
                  </div>
                </div>
              </div>

              {assignments.some(a => isOverdue(a.due_date)) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-700"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Bạn có bài tập quá hạn!</p>
                    <p className="text-xs opacity-80">Hãy hoàn thành các bài tập được đánh dấu đỏ để đảm bảo tiến độ học tập.</p>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignments.filter(a => a.lesson_title.toLowerCase().includes(lessonSearch.toLowerCase()) || a.lesson_description.toLowerCase().includes(lessonSearch.toLowerCase())).map(assignment => (
                  <motion.div 
                    key={assignment.id}
                    whileHover={{ y: -5 }}
                    onClick={() => handleSelectLesson({ id: assignment.lesson_id, title: assignment.lesson_title, description: assignment.lesson_description }, assignment)}
                    className={`bg-white p-6 rounded-[2rem] border-2 transition-all cursor-pointer group ${isOverdue(assignment.due_date) ? 'border-red-100 hover:border-red-200' : 'border-transparent hover:border-emerald-100 shadow-sm hover:shadow-xl'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors ${isOverdue(assignment.due_date) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        <Book className="w-6 h-6 transition-colors group-hover:text-white" />
                      </div>
                      {assignment.due_date && (
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isOverdue(assignment.due_date) ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {isOverdue(assignment.due_date) ? 'Quá hạn' : `Hạn: ${new Date(assignment.due_date).toLocaleDateString('vi-VN')}`}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{assignment.lesson_title}</h3>
                    <p className="text-sm text-gray-500 mb-6 line-clamp-2">{assignment.lesson_description}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${isOverdue(assignment.due_date) ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isOverdue(assignment.due_date) ? 'Làm ngay' : 'Bắt đầu học'}
                      </span>
                      <ChevronRight className={`w-5 h-5 transform group-hover:translate-x-1 transition-all ${isOverdue(assignment.due_date) ? 'text-red-300 group-hover:text-red-600' : 'text-gray-300 group-hover:text-emerald-600'}`} />
                    </div>
                  </motion.div>
                ))}
                {assignments.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
                    <Book className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Bạn chưa có bài tập nào được giao.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="practice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setView('lessons')}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors"
              >
                ← Quay lại danh sách
              </button>

              <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar: Skills */}
                <div className="lg:w-72 flex-shrink-0 space-y-2">
                  <div className="bg-white p-4 rounded-[2rem] border border-black/5 shadow-sm space-y-1">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 ml-2 mt-2">Kỹ năng luyện tập</h3>
                    {[
                      { id: 'vocab', name: 'Từ vựng', icon: Book, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { id: 'listening', name: 'Luyện nghe', icon: Headphones, color: 'text-purple-600', bg: 'bg-purple-50' },
                      { id: 'speaking', name: 'Luyện nói', icon: Mic, color: 'text-orange-600', bg: 'bg-orange-50' },
                      { id: 'writing', name: 'Luyện viết', icon: PenTool, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { id: 'fill_in_blank', name: 'Điền từ', icon: HelpCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                      { id: 'quiz', name: 'Trắc nghiệm', icon: CheckCircle2, color: 'text-red-600', bg: 'bg-red-50' },
                    ].map(skill => (
                      <button 
                        key={skill.id}
                        onClick={() => setActiveSkill(skill.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group ${activeSkill === skill.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'hover:bg-gray-50 text-gray-600'}`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${activeSkill === skill.id ? 'bg-white/20 text-white' : `${skill.bg} ${skill.color}`}`}>
                          <skill.icon className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold">{skill.name}</span>
                        {activeSkill === skill.id && (
                          <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="bg-emerald-600 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Tiến độ bài học</p>
                      <h4 className="text-lg font-bold mb-4">Hoàn thành 65%</h4>
                      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div className="w-[65%] h-full bg-white rounded-full" />
                      </div>
                    </div>
                    <Sparkles className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Main Content: Practice Area */}
                <div className="flex-1 space-y-6">
                  {activeSkill === 'vocab' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <h2 className="text-2xl font-serif text-gray-900 mb-6">Từ vựng mới</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {vocab.map((v, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-6 bg-gray-50 rounded-3xl border border-gray-100 hover:border-emerald-200 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-bold text-emerald-700">{v.word}</h4>
                                <button 
                                  onClick={() => playWord(v.word)}
                                  disabled={playingWord === v.word}
                                  className="p-1.5 bg-white rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm border border-emerald-100"
                                >
                                  {playingWord === v.word ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <Star className="w-4 h-4 text-gray-300 cursor-pointer hover:text-yellow-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-3">{v.definition}</p>
                            <div className="pt-3 border-t border-gray-200">
                              <p className="text-xs italic text-gray-500 mb-1">"{v.example}"</p>
                              <p className="text-[10px] text-gray-400">{v.translation}</p>
                            </div>
                          </motion.div>
                        ))}
                        {vocab.length === 0 && <p className="text-center text-gray-400 py-8 col-span-2">Chưa có từ vựng nào cho bài học này.</p>}
                      </div>
                    </div>
                  )}

                  {activeSkill === 'writing' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <h2 className="text-2xl font-serif text-gray-900 mb-6">Luyện viết cùng AI</h2>
                      <div className="space-y-6">
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                          <p className="text-emerald-800 font-medium">{writingPrompt}</p>
                        </div>
                        <textarea 
                          className="w-full p-6 bg-gray-50 rounded-3xl border-none focus:ring-2 focus:ring-emerald-500 min-h-[200px] outline-none text-gray-700 leading-relaxed"
                          placeholder="Bắt đầu viết tại đây..."
                          value={writingText}
                          onChange={e => setWritingText(e.target.value)}
                        />
                        <button 
                          onClick={handleWritingSubmit}
                          disabled={loading || !writingText}
                          className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Nộp bài & Chấm điểm'}
                        </button>

                        {feedback && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 p-8 bg-white border-2 border-emerald-100 rounded-[2rem] shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="text-xl font-bold text-gray-900">Kết quả đánh giá</h4>
                              <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-200">
                                {feedback.score}
                              </div>
                            </div>
                            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{feedback.feedback}</p>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSkill === 'speaking' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <h2 className="text-2xl font-serif text-gray-900 mb-6">Luyện phát âm</h2>
                      {speakingSentences.length > 0 ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Câu {currentSpeakingIndex + 1} / {speakingSentences.length}</span>
                            <button onClick={handleGenerateSpeakingSentences} className="text-xs font-bold text-emerald-600 hover:underline">Làm mới danh sách</button>
                          </div>
                          <div className="flex items-center gap-4 p-6 bg-orange-50 rounded-3xl border border-orange-100">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 text-orange-600 fill-orange-600" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Câu mẫu</p>
                              <p className="text-orange-900 font-medium text-lg">{speakingSentences[currentSpeakingIndex]}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/30">
                            <button 
                              onClick={startSpeakingPractice}
                              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse shadow-lg shadow-red-200' : 'bg-emerald-600 hover:scale-105 shadow-lg shadow-emerald-200'}`}
                            >
                              <Mic className="w-8 h-8 text-white" />
                            </button>
                            <p className="mt-4 text-sm font-medium text-gray-500">
                              {isRecording ? 'Đang lắng nghe...' : 'Nhấn để bắt đầu nói'}
                            </p>
                            {transcript && (
                              <div className="mt-6 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-600 italic shadow-sm">
                                "{transcript}"
                              </div>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <button 
                              onClick={handleSpeakingSubmit}
                              disabled={loading || !transcript}
                              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50"
                            >
                              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Phân tích phát âm'}
                            </button>
                            {feedback && (
                              <button 
                                onClick={nextSpeakingSentence}
                                className="px-8 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all"
                              >
                                Câu tiếp theo →
                              </button>
                            )}
                          </div>

                          {feedback && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-white border-2 border-orange-100 rounded-[2rem] shadow-lg">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900">Kết quả đánh giá</h4>
                                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                                  {feedback.score}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed mb-2">{feedback.feedback}</p>
                              {feedback.improvements && (
                                <div className="mt-3 p-3 bg-orange-50 rounded-xl text-xs text-orange-800 italic">
                                  💡 {feedback.improvements}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-20">
                          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
                          <p className="text-gray-500">Đang chuẩn bị câu mẫu cho bạn...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeSkill === 'fill_in_blank' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <h2 className="text-2xl font-serif text-gray-900 mb-6">Bài tập điền từ</h2>
                      {exercises.filter(e => e.type === 'fill_in_blank').length > 0 ? (
                        <div className="space-y-8">
                          {!fibFinished ? (
                            <div className="space-y-6">
                              <div className="flex justify-between items-center text-sm font-bold text-gray-400">
                                <span>Câu hỏi {fibIndex + 1}/{exercises.filter(e => e.type === 'fill_in_blank')[0].content.length}</span>
                                <span>Đúng: {fibScore}</span>
                              </div>
                              <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100">
                                <p className="text-xl font-medium text-gray-900 leading-relaxed">
                                  {exercises.filter(e => e.type === 'fill_in_blank')[0].content[fibIndex].sentence.split('[___]').map((part: string, i: number, arr: any[]) => (
                                    <React.Fragment key={i}>
                                      {part}
                                      {i < arr.length - 1 && (
                                        <input 
                                          type="text"
                                          value={fibAnswer}
                                          onChange={e => setFibAnswer(e.target.value)}
                                          className="mx-2 px-3 py-1 bg-white border-b-2 border-emerald-500 outline-none text-emerald-600 font-bold w-32 text-center"
                                          placeholder="..."
                                        />
                                      )}
                                    </React.Fragment>
                                  ))}
                                </p>
                                <p className="mt-4 text-sm text-gray-500 italic">Gợi ý: {exercises.filter(e => e.type === 'fill_in_blank')[0].content[fibIndex].hint}</p>
                              </div>

                              {fibFeedback && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-xl text-center font-bold ${fibFeedback.includes('Chính xác') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                  {fibFeedback}
                                </motion.div>
                              )}

                              <button 
                                onClick={handleFibSubmit}
                                disabled={!fibAnswer || fibFeedback !== null}
                                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                Kiểm tra đáp án
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-12 space-y-6">
                              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                              </div>
                              <h3 className="text-2xl font-bold text-gray-900">Hoàn thành bài tập!</h3>
                              <p className="text-lg text-gray-500">Điểm của bạn: <span className="font-bold text-emerald-600">{((fibScore / exercises.filter(e => e.type === 'fill_in_blank')[0].content.length) * 10).toFixed(1)}/10</span></p>
                              <button 
                                onClick={() => { setFibFinished(false); setFibIndex(0); setFibScore(0); }}
                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold"
                              >
                                Làm lại
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-400 py-12">Chưa có bài tập điền từ cho bài học này.</p>
                      )}
                    </div>
                  )}

                  {activeSkill === 'quiz' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <h2 className="text-2xl font-serif text-gray-900 mb-6">Bài tập trắc nghiệm</h2>
                      {exercises.filter(e => e.type === 'multiple_choice').length > 0 ? (
                        <div className="space-y-8">
                          {!quizFinished ? (
                            <div className="space-y-6">
                              <div className="flex justify-between items-center text-sm font-bold text-gray-400">
                                <span>Câu hỏi {quizIndex + 1}/{exercises.filter(e => e.type === 'multiple_choice')[0].content.length}</span>
                                <span>Đúng: {quizScore}</span>
                              </div>
                              <h3 className="text-xl font-bold text-gray-900">{exercises.filter(e => e.type === 'multiple_choice')[0].content[quizIndex].question}</h3>
                              <div className="grid grid-cols-1 gap-3">
                                {exercises.filter(e => e.type === 'multiple_choice')[0].content[quizIndex].options.map((opt: string, i: number) => (
                                  <button 
                                    key={i}
                                    onClick={() => handleQuizAnswer(i)}
                                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-all font-medium"
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-12 space-y-6">
                              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                              </div>
                              <h3 className="text-2xl font-bold text-gray-900">Hoàn thành bài tập!</h3>
                              <p className="text-lg text-gray-500">Điểm của bạn: <span className="font-bold text-emerald-600">{((quizScore / exercises.filter(e => e.type === 'multiple_choice')[0].content.length) * 10).toFixed(1)}/10</span></p>
                              <button 
                                onClick={() => { setQuizFinished(false); setQuizIndex(0); setQuizScore(0); }}
                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold"
                              >
                                Làm lại
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-gray-400 py-12">Chưa có bài tập trắc nghiệm cho bài học này.</p>
                      )}
                    </div>
                  )}

                  {activeSkill === 'listening' && (
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-serif text-gray-900">Luyện nghe tự động</h2>
                        <button 
                          onClick={handleGenerateListening}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4" />
                          {listeningData ? 'Tạo bài mới' : 'Tạo bài nghe'}
                        </button>
                      </div>

                      {!listeningData ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-[2rem]">
                          <Headphones className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-500 max-w-xs mx-auto">
                            Nhấn nút "Tạo bài nghe" để AI soạn một đoạn văn dựa trên từ vựng của bài học này.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          <div className="p-8 bg-purple-50 rounded-[2rem] border border-purple-100 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 group cursor-pointer hover:scale-110 transition-transform">
                              <Volume2 className="w-10 h-10 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-purple-900 mb-2">{listeningData.title}</h3>
                            <audio 
                              controls 
                              src={listeningData.audioUrl} 
                              className="w-full max-w-md mt-4"
                              onEnded={() => setHasFinishedListening(true)}
                            />
                            {!hasFinishedListening && (
                              <p className="mt-4 text-xs text-purple-400 animate-pulse">Hãy nghe hết đoạn văn để mở khóa câu hỏi và nội dung...</p>
                            )}
                          </div>

                          <AnimatePresence>
                            {hasFinishedListening && (
                              <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                              >
                                {/* Comprehension Questions */}
                                <div className="space-y-6">
                                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-purple-600" /> Câu hỏi hiểu bài
                                  </h3>
                                  <div className="space-y-6">
                                    {listeningData.questions.map((q, qIdx) => (
                                      <div key={qIdx} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                        <p className="font-bold text-gray-800 mb-4">{qIdx + 1}. {q.question}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {q.options.map((opt: string, aIdx: number) => {
                                            const isSelected = listeningAnswers[qIdx] === aIdx;
                                            const isCorrect = q.correctIndex === aIdx;
                                            let btnClass = "w-full p-3 rounded-xl border text-left text-sm transition-all ";
                                            
                                            if (showListeningResults) {
                                              if (isCorrect) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold";
                                              else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                                              else btnClass += "bg-gray-50 border-gray-100 text-gray-400";
                                            } else {
                                              btnClass += isSelected ? "bg-purple-600 border-purple-600 text-white font-bold" : "bg-gray-50 border-gray-100 hover:border-purple-300 text-gray-700";
                                            }

                                            return (
                                              <button 
                                                key={aIdx}
                                                disabled={showListeningResults}
                                                onClick={() => handleListeningAnswer(qIdx, aIdx)}
                                                className={btnClass}
                                              >
                                                {opt}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {!showListeningResults ? (
                                    <button 
                                      onClick={submitListeningQuiz}
                                      className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                                    >
                                      Kiểm tra kết quả
                                    </button>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                                        <p className="text-emerald-800 font-bold">
                                          Bạn đã trả lời đúng {listeningAnswers.filter((a, i) => a === listeningData.questions[i].correctIndex).length}/{listeningData.questions.length} câu!
                                        </p>
                                      </div>
                                      <button 
                                        onClick={handleGenerateListening}
                                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all"
                                      >
                                        Tiếp tục bài nghe tiếp theo →
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Passage Content */}
                                <div className="pt-8 border-t border-gray-100">
                                  <button 
                                    onClick={() => setShowPassage(!showPassage)}
                                    className="flex items-center gap-2 text-sm font-bold text-purple-600 hover:text-purple-700 transition-colors mb-4"
                                  >
                                    {showPassage ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    {showPassage ? 'Ẩn nội dung bài nghe' : 'Xem nội dung bài nghe'}
                                  </button>

                                  <AnimatePresence>
                                    {showPassage && (
                                      <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-6 bg-gray-50 rounded-2xl border border-gray-100"
                                      >
                                        <p className="text-gray-700 leading-relaxed italic">
                                          "{listeningData.passage}"
                                        </p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-black/5 py-4">
        <p className="text-center text-[10px] text-gray-400 italic">
          Thiết kế bởi Nguyễn Thanh Hùng, Bộ môn Ngoại ngữ, Trường Đại học Y Dược Cần Thơ.
        </p>
      </footer>

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-gray-600">AI đang phân tích bài làm của bạn...</p>
          </div>
        </div>
      )}
    </div>
  );
}
