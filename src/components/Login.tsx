import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, Loader2, Clock, User } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentLogins, setRecentLogins] = useState<any[]>([]);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    fetchRecentLogins();
  }, []);

  const fetchRecentLogins = async () => {
    try {
      const res = await fetch('/api/recent-logins');
      if (res.ok) {
        const data = await res.json();
        setRecentLogins(data);
      }
    } catch (err) {
      console.error('Failed to fetch recent logins:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuth(data.user, data.token);
      } else {
        setError(data.error || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-black/5"
      >
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 p-2 overflow-hidden">
              <img src="/logo.png" alt="CTUMP Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
          </div>
          
          <h2 className="text-3xl font-serif text-center text-gray-900 mb-2">CTUMP English Hub</h2>
          <p className="text-center text-gray-500 mb-8 font-sans">Học viện Tiếng Anh Y Khoa</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  placeholder="name@ctump.edu.vn"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Đăng nhập'}
            </button>
          </form>

          {recentLogins.length > 0 && (
            <div className="mt-10 pt-8 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Sinh viên vừa truy cập
              </h3>
              <div className="space-y-3">
                {recentLogins.map((login, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{login.name}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">
                      {new Date(login.last_login).toLocaleString('vi-VN', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 p-6 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400 leading-relaxed italic">
            Thiết kế bởi Nguyễn Thanh Hùng, Bộ môn Ngoại ngữ,<br />
            Trường Đại học Y Dược Cần Thơ.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
