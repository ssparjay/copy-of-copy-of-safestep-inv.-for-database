
import React, { useState } from 'react';
import { User } from '../types';
import { ChevronRight, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const SafeStepLogo: React.FC<{ className?: string }> = ({ className = "h-12" }) => (
  <div className={`flex items-center space-x-4 ${className}`}>
    <div className="flex flex-col items-center justify-center space-y-[-5px]">
      <svg width="48" height="24" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="transform scale-y-[-1]">
        <path d="M5 40C20 35 45 10 95 10V40H5Z" stroke="#2E58A3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 40C30 30 45 15 65 20C75 25 85 35 85 40" stroke="#2E58A3" strokeWidth="4" strokeLinecap="round"/>
      </svg>
      <svg width="48" height="24" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 40C20 35 45 10 95 10V40H5Z" stroke="#2E58A3" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M25 40C30 30 45 15 65 20C75 25 85 35 85 40" stroke="#2E58A3" strokeWidth="4" strokeLinecap="round"/>
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-[24px] font-[900] text-slate-900 tracking-tighter uppercase">SafeStep</span>
      <span className="text-[16px] font-[700] text-slate-900 tracking-tight">Philippines</span>
    </div>
  </div>
);

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    // Simulate network delay for premium feel
    setTimeout(() => {
      const user = users.find(u => u.id === selectedUserId);
      if (user && user.password === password) {
        onLogin(user);
      } else {
        setError(true);
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-indigo-100/40 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-lg relative">
        <div className="bg-white rounded-[48px] shadow-2xl border border-slate-100 p-10 md:p-14 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center mb-12">
            <SafeStepLogo />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Access Gateway</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Warehouse Intelligence Terminal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identify Operator</label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setError(false); }}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[24px] focus:border-blue-500 outline-none transition-all font-bold text-slate-900 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select your name...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Credential</label>
              <div className="relative">
                <KeyRound className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  required
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  className={`w-full pl-14 pr-6 py-4 bg-slate-50 border-2 rounded-[24px] focus:border-blue-500 outline-none transition-all font-bold text-slate-900 ${error ? 'border-rose-200 bg-rose-50' : 'border-slate-100'}`}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-rose-600 bg-rose-50 p-4 rounded-2xl animate-in shake duration-300">
                <AlertCircle size={18} />
                <p className="text-xs font-black uppercase tracking-wider">Invalid Access Credentials</p>
              </div>
            )}

            <button
              disabled={isLoading || !selectedUserId}
              type="submit"
              className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Initialize Session</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-50 text-center">
            <div className="flex items-center justify-center space-x-2 text-slate-400">
              <ShieldCheck size={14} />
              <p className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted Terminal</p>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          &copy; 2024 SafeStep Philippines | v2.4.0-Stable
        </p>
      </div>
    </div>
  );
};

export default Login;
