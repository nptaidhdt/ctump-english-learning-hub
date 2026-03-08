import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  Plus, FileUp, Users, Trash2, BookOpen, 
  CheckCircle, MessageSquare, Loader2, ChevronRight, Edit3,
  FileText, X, Sparkles, ClipboardCheck, Volume2, Search, Filter, Download, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractVocabulary, generateQuiz, generateFillInBlanks, evaluateWriting, generateTTS, generateListeningPassage, generateSpeakingSentences } from '../services/geminiService';

export default function TeacherDashboard() {
  const { user, token, logout } = useAuthStore();
  const [lessons, setLessons] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: '', description: '' });
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [selectedLessonVocab, setSelectedLessonVocab] = useState<{title: string, vocab: any[]} | null>(null);
  const [aiEval, setAiEval] = useState({ prompt: '', content: '', result: null as any, loading: false });
  const [manualStudent, setManualStudent] = useState({ name: '', email: '', show: false });
  const [activeTab, setActiveTab] = useState<'lessons' | 'students' | 'progress' | 'assignments'>('lessons');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentsForAssignment, setSelectedStudentsForAssignment] = useState<number[]>([]);
  const [assigningLessonId, setAssigningLessonId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'high_progress' | 'low_progress'>('all');
  const [lessonSearch, setLessonSearch] = useState('');
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);

  useEffect(() => {
    fetchLessons();
    fetchSubmissions();
    fetchStudents();
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    const res = await fetch('/api/teacher/assignments', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setAssignments(data);
  };

  const fetchStudents = async () => {
    const res = await fetch('/api/teacher/students', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setStudents(data);
  };

  const fetchLessons = async () => {
    const res = await fetch('/api/lessons', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setLessons(data);
  };

  const fetchSubmissions = async () => {
    const res = await fetch('/api/teacher/submissions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setSubmissions(data);
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newLesson)
      });
      if (res.ok) {
        setNewLesson({ title: '', description: '' });
        setShowAddLesson(false);
        fetchLessons();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLesson = async (id: number) => {
    setConfirmModal({
      show: true,
      title: 'Xóa bài học',
      message: 'Bạn có chắc chắn muốn xóa bài học này? Mọi dữ liệu liên quan (bài tập, kết quả nộp bài) sẽ bị mất vĩnh viễn.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/lessons/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            fetchLessons();
            fetchSubmissions();
            fetchAssignments();
          } else {
            const data = await res.json();
            alert('Lỗi khi xóa bài học: ' + (data.error || 'Không xác định'));
          }
        } catch (e: any) {
          alert('Lỗi kết nối: ' + e.message);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteStudent = async (id: number) => {
    setConfirmModal({
      show: true,
      title: 'Xóa sinh viên',
      message: 'Bạn có chắc chắn muốn xóa sinh viên này? Mọi dữ liệu liên quan sẽ bị xóa.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/teacher/students/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            fetchStudents();
            fetchSubmissions();
            fetchAssignments();
          }
        } catch (e: any) {
          alert('Lỗi kết nối: ' + e.message);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await fetch(`/api/teacher/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingStudent.name, email: editingStudent.email })
      });
      if (res.ok) {
        setEditingStudent(null);
        fetchStudents();
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    }
  };

  const handleEditLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons/${editingLesson.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: editingLesson.title, description: editingLesson.description })
      });
      if (res.ok) {
        setEditingLesson(null);
        fetchLessons();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (lessonId: number, fileId: number) => {
    if (!confirm('Bạn có chắc muốn xóa file này?')) return;
    try {
      const res = await fetch(`/api/lesson-files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchLessons(); // Refresh lessons to update file list
      } else {
        const data = await res.json();
        alert('Lỗi khi xóa file: ' + (data.error || 'Không xác định'));
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    }
  };

  const handleFileUpload = async (lessonId: number, file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lessonId', lessonId.toString());

    try {
      const res = await fetch('/api/upload-lesson-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi tải file');
      }

      const data = await res.json();
      
      if (data.success && data.content) {
        // AI Processing
        const vocab = await extractVocabulary(data.content);
        
        const [quiz, fillBlanks, listening, speakingSentences] = await Promise.all([
          generateQuiz(data.content),
          generateFillInBlanks(data.content),
          generateListeningPassage(vocab),
          generateSpeakingSentences(vocab)
        ]);
        
        // Generate Listening Audio
        const listeningAudioUrl = await generateTTS(listening.passage);

        // Save vocab
        await fetch(`/api/lesson-files/${data.fileId}/vocabulary`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ vocabulary: vocab })
        });

        // Save exercises
        const exercisesToSave = [
          { title: `Trắc nghiệm: ${file.name}`, content: quiz, type: 'multiple_choice' },
          { title: `Điền từ: ${file.name}`, content: fillBlanks, type: 'fill_in_blank' },
          { title: `Nghe hiểu: ${listening.title}`, content: listening, type: 'listening', audio_url: listeningAudioUrl },
          { title: `Phát âm: ${file.name}`, content: { sentences: speakingSentences }, type: 'pronunciation' }
        ];

        for (const ex of exercisesToSave) {
          await fetch('/api/exercises', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              lesson_id: lessonId,
              ...ex
            })
          });
        }
        
        alert('Đã tải file và tự động tạo từ vựng, trắc nghiệm, bài tập điền từ, nghe hiểu & phát âm thành công!');
        fetchLessons(); 
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewVocab = (lesson: any) => {
    const files = lesson.files || [];
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
    setSelectedLessonVocab({ title: lesson.title, vocab: allVocab });
  };

  const handleStudentUpload = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload-students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (data.count > 0) {
          alert(`Thành công! Đã thêm ${data.count} sinh viên mới vào danh sách.`);
        } else {
          alert('Thông báo: Không có sinh viên mới nào được thêm (có thể do email đã tồn tại hoặc file trống).');
        }
        fetchStudents();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể tải lên danh sách sinh viên'));
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualStudentAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: manualStudent.name, email: manualStudent.email })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Đã thêm sinh viên thành công!');
        setManualStudent({ name: '', email: '', show: false });
        fetchStudents();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể thêm sinh viên'));
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLesson = async () => {
    if (!assigningLessonId || selectedStudentsForAssignment.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          lesson_id: assigningLessonId, 
          student_ids: selectedStudentsForAssignment,
          due_date: dueDate
        })
      });
      if (res.ok) {
        alert('Đã giao bài tập thành công!');
        setAssigningLessonId(null);
        setSelectedStudentsForAssignment([]);
        setDueDate('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAiEvaluate = async () => {
    if (!aiEval.prompt || !aiEval.content) {
      alert('Vui lòng nhập đầy đủ đề bài và nội dung bài làm.');
      return;
    }
    setAiEval(prev => ({ ...prev, loading: true, result: null }));
    try {
      const result = await evaluateWriting(aiEval.prompt, aiEval.content);
      setAiEval(prev => ({ ...prev, result }));
    } catch (e: any) {
      alert('Lỗi khi đánh giá AI: ' + e.message);
    } finally {
      setAiEval(prev => ({ ...prev, loading: false }));
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

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                         s.email.toLowerCase().includes(studentSearch.toLowerCase());
    
    if (studentFilter === 'high_progress') return matchesSearch && (s.submissions?.length || 0) >= 10;
    if (studentFilter === 'low_progress') return matchesSearch && (s.submissions?.length || 0) < 3;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f5f2ed] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm p-1 overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-bold text-gray-900">Giảng viên</h1>
                <p className="text-xs text-gray-500">{user?.name}</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { id: 'lessons', name: 'Bài học', icon: BookOpen },
                { id: 'students', name: 'Sinh viên', icon: Users },
                { id: 'progress', name: 'Tiến độ', icon: CheckCircle },
                { id: 'assignments', name: 'Bài tập', icon: ClipboardCheck },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={logout} className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors">Đăng xuất</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'lessons' && (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-serif text-gray-900">Danh sách bài học</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Tìm bài học..."
                      value={lessonSearch}
                      onChange={(e) => setLessonSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64 shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={() => setShowAddLesson(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Thêm bài học
                  </button>
                </div>
              </div>

              {showAddLesson && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                  <form onSubmit={handleAddLesson} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tiêu đề bài học</label>
                      <input 
                        placeholder="Nhập tiêu đề..." 
                        className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                        value={newLesson.title}
                        onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả bài học</label>
                      <textarea 
                        placeholder="Nhập mô tả ngắn về nội dung bài học..." 
                        className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                        value={newLesson.description}
                        onChange={e => setNewLesson({...newLesson, description: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-medium">Lưu</button>
                      <button type="button" onClick={() => setShowAddLesson(false)} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl text-sm font-medium">Hủy</button>
                    </div>
                  </form>
                </motion.div>
              )}

              {editingLesson && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Chỉnh sửa bài học</h3>
                  <form onSubmit={handleEditLesson} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tiêu đề bài học</label>
                      <input 
                        placeholder="Nhập tiêu đề..." 
                        className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                        value={editingLesson.title}
                        onChange={e => setEditingLesson({...editingLesson, title: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mô tả bài học</label>
                      <textarea 
                        placeholder="Nhập mô tả ngắn về nội dung bài học..." 
                        className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                        value={editingLesson.description}
                        onChange={e => setEditingLesson({...editingLesson, description: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-medium">Cập nhật</button>
                      <button type="button" onClick={() => setEditingLesson(null)} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl text-sm font-medium">Hủy</button>
                    </div>
                  </form>
                </motion.div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {lessons.filter(l => l.title.toLowerCase().includes(lessonSearch.toLowerCase()) || l.description.toLowerCase().includes(lessonSearch.toLowerCase())).map(lesson => (
                  <div key={lesson.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{lesson.title}</h3>
                        <p className="text-sm text-gray-500 mb-4">{lesson.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setAssigningLessonId(lesson.id)}
                          className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
                          title="Giao bài tập"
                        >
                          <ClipboardCheck className="w-5 h-5" />
                        </button>
                        <button onClick={() => setEditingLesson(lesson)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDeleteLesson(lesson.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                      <label className="flex items-center gap-2 text-xs font-semibold text-emerald-600 cursor-pointer hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors">
                        <FileUp className="w-4 h-4" />
                        Tải lên bài giảng (PDF/DOCX)
                        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(lesson.id, e.target.files[0])} />
                      </label>
                      <button 
                        onClick={() => handleViewVocab(lesson)}
                        className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                        Xem từ vựng
                      </button>
                      <div className="text-xs text-gray-400">
                        {lesson.files?.length || 0} file đã tải
                      </div>
                    </div>

                    {lesson.files && lesson.files.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-gray-50 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tài liệu đã tải:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {lesson.files.map((file: any) => (
                            <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl group/file border border-transparent hover:border-gray-200 transition-all">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-[11px] text-gray-600 truncate font-medium">{file.original_name}</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteFile(lesson.id, file.id)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Xóa tài liệu"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'students' && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-serif text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-emerald-600" /> Danh sách sinh viên
                </h2>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Tìm tên, email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-64"
                    />
                  </div>
                  
                  <select 
                    value={studentFilter}
                    onChange={(e: any) => setStudentFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="all">Tất cả tiến độ</option>
                    <option value="high_progress">Tiến độ tốt (≥10 bài)</option>
                    <option value="low_progress">Cần chú ý (&lt;3 bài)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudents.map(student => (
                  <div key={student.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-emerald-200 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                          {student.submissions?.length || 0} bài đã nộp
                        </p>
                        <p className="text-[9px] text-gray-400 mt-1">
                          Gia nhập: {new Date(student.created_at || Date.now()).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingStudent(student)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(student.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Xóa sinh viên"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div className="text-center py-12 col-span-2 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <Search className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400">Không tìm thấy sinh viên phù hợp.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-emerald-600" /> Tiến độ học tập
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('progress')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'progress' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Kết quả nộp bài
                  </button>
                  <button 
                    onClick={() => setActiveTab('assignments')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'assignments' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Theo dõi bài tập
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-4 font-semibold text-gray-500">Sinh viên</th>
                      <th className="pb-4 font-semibold text-gray-500">Bài học</th>
                      <th className="pb-4 font-semibold text-gray-500">Điểm</th>
                      <th className="pb-4 font-semibold text-gray-500 text-right">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {submissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 font-medium text-gray-900">{sub.student_name}</td>
                        <td className="py-4 text-gray-500">{sub.lesson_title}</td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-lg font-bold text-xs ${sub.score >= 8 ? 'bg-emerald-50 text-emerald-600' : sub.score >= 5 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            {sub.score.toFixed(1)}/10
                          </span>
                        </td>
                        <td className="py-4 text-gray-400 text-right text-xs">
                          {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="w-6 h-6 text-emerald-600" /> Theo dõi bài tập
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('progress')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'progress' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Kết quả nộp bài
                  </button>
                  <button 
                    onClick={() => setActiveTab('assignments')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'assignments' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Theo dõi bài tập
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-4 font-semibold text-gray-500">Sinh viên</th>
                      <th className="pb-4 font-semibold text-gray-500">Bài học</th>
                      <th className="pb-4 font-semibold text-gray-500">Hạn nộp</th>
                      <th className="pb-4 font-semibold text-gray-500">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignments.map(assignment => {
                      const hasSubmitted = submissions.some(s => s.student_id === assignment.student_id && s.lesson_id === assignment.lesson_id);
                      const overdue = !hasSubmitted && assignment.due_date && new Date(assignment.due_date) < new Date();
                      
                      return (
                        <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4">
                            <p className="font-medium text-gray-900">{assignment.student_name}</p>
                            <p className="text-[10px] text-gray-400">{assignment.student_email}</p>
                          </td>
                          <td className="py-4 text-gray-500">{assignment.lesson_title}</td>
                          <td className="py-4 text-gray-400 text-xs">
                            {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('vi-VN') : 'Không có'}
                          </td>
                          <td className="py-4">
                            {hasSubmitted ? (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-[10px] uppercase">Đã nộp</span>
                            ) : overdue ? (
                              <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] uppercase">Quá hạn</span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg font-bold text-[10px] uppercase">Chưa nộp</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Management & Results */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
            <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" /> Quản lý sinh viên
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-900 mb-1">Mẫu Excel tải lên:</p>
                    <p className="text-[10px] text-blue-700 leading-relaxed">
                      File Excel (.xlsx) cần có 2 cột chính ở Sheet đầu tiên:<br/>
                      1. <span className="font-bold">name</span>: Họ và tên sinh viên<br/>
                      2. <span className="font-bold">email</span>: Địa chỉ email
                    </p>
                  </div>
                </div>
              </div>

              <label className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-emerald-400 cursor-pointer transition-all group">
                <FileUp className="w-8 h-8 text-gray-300 group-hover:text-emerald-500 mb-2" />
                <span className="text-sm text-gray-500 font-medium">Tải danh sách Excel</span>
                <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleStudentUpload(e.target.files[0])} />
              </label>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-100"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400 font-bold">Hoặc</span>
                </div>
              </div>

              {!manualStudent.show ? (
                <button 
                  onClick={() => setManualStudent({...manualStudent, show: true})}
                  className="w-full py-3 border border-emerald-600 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Thêm thủ công
                </button>
              ) : (
                <motion.form 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleManualStudentAdd} 
                  className="space-y-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100"
                >
                  <input 
                    placeholder="Họ và tên sinh viên" 
                    className="w-full p-2.5 bg-white border border-emerald-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    value={manualStudent.name}
                    onChange={e => setManualStudent({...manualStudent, name: e.target.value})}
                    required
                  />
                  <input 
                    type="email"
                    placeholder="Email sinh viên" 
                    className="w-full p-2.5 bg-white border border-emerald-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    value={manualStudent.email}
                    onChange={e => setManualStudent({...manualStudent, email: e.target.value})}
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Lưu</button>
                    <button type="button" onClick={() => setManualStudent({...manualStudent, show: false})} className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-bold">Hủy</button>
                  </div>
                </motion.form>
              )}
            </div>

            <p className="text-[10px] text-gray-400 mt-3 text-center italic">Mật khẩu mặc định cho sinh viên là 123456A@</p>
          </div>

          {/* AI Evaluation Tool */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm overflow-hidden">
            <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> Công cụ chấm bài AI
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Đề bài / Yêu cầu</label>
                <textarea 
                  placeholder="Ví dụ: Viết một đoạn văn về sở thích của bạn bằng tiếng Anh..." 
                  className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px]"
                  value={aiEval.prompt}
                  onChange={e => setAiEval({...aiEval, prompt: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nội dung bài làm của sinh viên</label>
                <textarea 
                  placeholder="Dán nội dung bài làm vào đây..." 
                  className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px]"
                  value={aiEval.content}
                  onChange={e => setAiEval({...aiEval, content: e.target.value})}
                />
              </div>
              <button 
                onClick={handleAiEvaluate}
                disabled={aiEval.loading}
                className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {aiEval.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {aiEval.loading ? 'Đang chấm bài...' : 'Chấm bài bằng AI'}
              </button>

              <AnimatePresence>
                {aiEval.result && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-4 border-t border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">Kết quả đánh giá</span>
                      <span className={`text-lg font-bold ${aiEval.result.score >= 8 ? 'text-emerald-600' : aiEval.result.score >= 5 ? 'text-blue-600' : 'text-red-500'}`}>
                        {aiEval.result.score}/10
                      </span>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <p className="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap">{aiEval.result.feedback}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Recent Submissions */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
            <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" /> Kết quả mới nhất
            </h3>
            <div className="space-y-4">
              {submissions.slice(0, 5).map(sub => (
                <div key={sub.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-gray-900">{sub.student_name}</span>
                    <span className={`text-xs font-bold ${sub.score >= 5 ? 'text-emerald-600' : 'text-red-500'}`}>{sub.score}/10</span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{sub.exercise_title}</p>
                </div>
              ))}
              {submissions.length === 0 && <p className="text-center text-sm text-gray-400 py-4">Chưa có kết quả nào</p>}
            </div>
          </div>
        </div>
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
            <p className="text-sm font-medium text-gray-600">AI đang xử lý dữ liệu...</p>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      <AnimatePresence>
        {assigningLessonId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-serif text-gray-900">Giao bài tập</h3>
                  <p className="text-sm text-gray-500">Chọn sinh viên để giao bài học này</p>
                </div>
                <button 
                  onClick={() => setAssigningLessonId(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 transform rotate-45 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto max-h-[50vh] space-y-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                  <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Hạn nộp bài (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="flex justify-between mb-2">
                  <button 
                    onClick={() => setSelectedStudentsForAssignment(students.map(s => s.id))}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <button 
                    onClick={() => setSelectedStudentsForAssignment([])}
                    className="text-xs font-bold text-gray-400 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
                {students.map(student => (
                  <label key={student.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-emerald-200 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      checked={selectedStudentsForAssignment.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudentsForAssignment([...selectedStudentsForAssignment, student.id]);
                        else setSelectedStudentsForAssignment(selectedStudentsForAssignment.filter(id => id !== student.id));
                      }}
                    />
                    <div>
                      <p className="font-bold text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => setAssigningLessonId(null)}
                  className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-500"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleAssignLesson}
                  disabled={selectedStudentsForAssignment.length === 0}
                  className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Xác nhận giao bài
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vocabulary Modal */}
      <AnimatePresence>
        {selectedLessonVocab && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-2xl font-serif text-gray-900">Từ vựng bài học</h3>
                  <p className="text-sm text-gray-500">{selectedLessonVocab.title}</p>
                </div>
                <button 
                  onClick={() => setSelectedLessonVocab(null)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-4">
                {selectedLessonVocab.vocab.length === 0 ? (
                  <div className="text-center py-20">
                    <BookOpen className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                    <p className="text-gray-400">Chưa có từ vựng nào được trích xuất cho bài học này.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLessonVocab.vocab.map((v, idx) => (
                      <div key={idx} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-lg font-bold text-emerald-700">{v.word}</h4>
                            <p className="text-xs text-gray-400 font-medium italic">{v.phonetic}</p>
                          </div>
                          <button 
                            onClick={() => playWord(v.word)}
                            disabled={playingWord === v.word}
                            className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md text-emerald-600 transition-all disabled:opacity-50"
                          >
                            {playingWord === v.word ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nghĩa</span>
                            <p className="text-sm text-gray-800 font-medium">{v.meaning}</p>
                          </div>
                          {v.example && (
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ví dụ</span>
                              <p className="text-xs text-gray-600 italic leading-relaxed">"{v.example}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setSelectedLessonVocab(null)}
                  className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Sửa thông tin sinh viên</h3>
                <button onClick={() => setEditingStudent(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleEditStudent} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Họ và tên</label>
                  <input 
                    className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    value={editingStudent.name}
                    onChange={e => setEditingStudent({...editingStudent, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email</label>
                  <input 
                    type="email"
                    className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    value={editingStudent.email}
                    onChange={e => setEditingStudent({...editingStudent, email: e.target.value})}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Lưu thay đổi</button>
                  <button type="button" onClick={() => setEditingStudent(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold">Hủy</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="p-6 bg-gray-50 flex gap-3">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-sm"
                >
                  Chắc chắn xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
