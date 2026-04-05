import React, { useEffect, useState } from 'react';
import { useAuthStore } from './auth/restAuth';
import SongUploader from './components/SongUploader';
import VideoGenerator from './components/VideoGenerator';
import VideoStitcher from './components/VideoStitcher';
import TerminalLog from './components/TerminalLog';
import { 
  Settings, Music, Play, User as UserIcon, LogOut, Cpu, LayoutDashboard, History, Zap, 
  ShieldAlert, Terminal, Hexagon, Radio, Globe, Activity, Loader2, Command, 
  ChevronRight, Monitor, Film, Share2, Layers, Database, Gauge, Signal, Plus,
  Search, Bell, CreditCard, Sparkles, ChevronDown, Video, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AuthScreen = () => {
  const { login, register, loading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasCreds = username && password;
    const hasApiKey = apiKey;
    
    if (!hasCreds && !hasApiKey) {
      alert("SIGNAL_ERROR: Use (Username + Password) or (Sogni API Key) to establish a session.");
      return;
    }

    try {
      if (isRegistering) {
        await register(username, password, apiKey);
      } else {
        await login(username, password, apiKey);
      }
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden workflow-bg selection:bg-primary/20">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[480px] bg-slate-900/40 border border-slate-800 p-12 md:p-16 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl"
      >
        <div className="text-center mb-16">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-2xl">
             <Film className="text-white" size={32} />
          </div>
          <h1 className="font-heading text-4xl font-black text-white tracking-tighter mb-2 uppercase">
            SOGNI <span className="text-primary italic">VID</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Access Identity Protocol</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Operator Username</label>
            <input 
              type="text" className="workflow-input h-14" placeholder="OPERATOR_X"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Access Key</label>
            <input 
              type="password" className="workflow-input h-14 tracking-widest" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 py-2">
             <div className="h-[1px] flex-1 bg-slate-800" />
             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">OR</span>
             <div className="h-[1px] flex-1 bg-slate-800" />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2">Sogni API Link (Key)</label>
            <input 
              type="password" className="workflow-input h-14 tracking-widest" placeholder="SK-••••••••••••••••"
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" disabled={loading}
            className="w-full workflow-btn h-16 mt-6"
          >
            {loading ? 'CONNECTING...' : 'ESTABLISH SESSION'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const App = () => {
  const { user, loading, logout } = useAuthStore();
  const [songData, setSongData] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState([]);

  // Progress tracked globally for the workflow card
  const [overallProgress, setOverallProgress] = useState(0);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
  };

  useEffect(() => {
    if (songData) {
      addLog(`Song project created successfully. ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, 'success');
      addLog(`Breaking down audio into ${songData.segments.length} scenes...`);
    }
  }, [songData]);

  if (loading) return <div className="min-h-screen bg-slate-950" />;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary/20 relative overflow-x-hidden">
      <div className="workflow-bg" />
      
      {/* 00 / HEADER */}
      <nav className="h-topbar border-b border-slate-800/60 bg-slate-900/30 backdrop-blur-xl flex items-center justify-between px-12 md:px-20">
         <div className="flex items-center gap-6">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
               <Zap className="text-white fill-white" size={20} />
            </div>
            <span className="text-2xl font-black text-white tracking-tighter uppercase">Sogni <span className="text-primary italic">Vid</span></span>
         </div>
         
         <div className="flex items-center gap-8">
            <button className="flex items-center gap-3 px-6 py-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all group">
               <History className="text-slate-500 group-hover:text-primary transition-colors" size={16} />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">History</span>
            </button>
            <div className="w-[1px] h-8 bg-slate-800 mx-2" />
            <button onClick={() => logout()} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest">Logout</button>
         </div>
      </nav>

      {/* 01 / HERO */}
      <header className="text-center mt-24 mb-16 px-8 max-w-4xl mx-auto">
         <motion.h1 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="text-7xl font-heading font-black text-white tracking-tighter mb-8 flex items-center justify-center gap-8"
         >
           Song <span className="text-primary/60 text-5xl">→</span> Video
         </motion.h1>
         <p className="text-lg font-bold text-slate-500 leading-relaxed uppercase tracking-widest max-w-2xl mx-auto">
            Upload a full song to break it down into scenes and generate an epic continuous video.
         </p>
      </header>

      {/* 02 / WORKFLOW WORKSPACE */}
      <div className="workflow-hub px-8 lg:px-0">
         <div className="workflow-card p-1 items-stretch">
            <div className="grid grid-cols-12 bg-slate-950/40 min-h-[720px]">
               
               {/* LEFT Pane: Ingest & Status (Span 5) */}
               <div className="col-span-12 lg:col-span-5 p-12 border-b lg:border-b-0 lg:border-r border-slate-800/60 flex flex-col gap-10">
                  
                  {/* Status Header */}
                  <div className="flex items-center gap-6">
                     <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                        <Video className="text-primary" size={28} />
                     </div>
                     <div>
                        <h2 className="text-[18px] font-black text-white tracking-tight uppercase leading-none mb-1">
                           {songData ? 'Song Generation' : 'Initial Ingest'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                           {isGenerating ? `Rendering Part ${Math.floor(overallProgress / (100 / segments.length)) + 1} of ${segments.length}` : 'Waiting for Signal'} 
                           <span className="text-primary italic ml-2">{overallProgress}%</span>
                        </p>
                     </div>
                  </div>

                  {/* Progress Bar Area */}
                  <div className="space-y-4">
                     <div className="workflow-progress-track">
                        <motion.div 
                          className="workflow-progress-fill" 
                          initial={{ width: 0 }}
                          animate={{ width: `${overallProgress}%` }}
                        />
                     </div>
                  </div>

                  {/* Entry Point / Log Control */}
                  <div className="flex-1 flex flex-col gap-6">
                     {!songData ? (
                        <div className="flex-1 flex items-center justify-center">
                           <SongUploader onUpload={(data) => {
                             setSongData(data);
                             setSegments(data.segments);
                           }} />
                        </div>
                     ) : (
                        <div className="flex-1 flex flex-col gap-8 h-full">
                           <TerminalLog logs={logs} />
                           
                           <div className="flex items-center gap-4">
                              <button 
                                onClick={() => { setSongData(null); setLogs([]); setOverallProgress(0); }} 
                                className="px-6 py-3 bg-slate-900 border border-slate-800 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all"
                              >
                                 Clear
                              </button>
                              <div className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                                 System: SOGNI_WAN_V4.2_NODE
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>

               {/* RIGHT Pane: LIVE MONITOR (Span 7) */}
               <div className="col-span-12 lg:col-span-7 p-12 bg-slate-900/10 flex flex-col gap-10 relative group">
                  <div className="absolute top-10 right-10 opacity-40 group-hover:opacity-100 transition-opacity">
                     <ExternalLink className="text-slate-600" size={20} />
                  </div>

                  <div className="flex-1 flex flex-col">
                     <VideoGenerator 
                        segments={segments} 
                        setSegments={setSegments}
                        isGenerating={isGenerating}
                        setIsGenerating={setIsGenerating}
                        onOverallProgress={setOverallProgress}
                        onLog={addLog}
                     />
                  </div>

                  <AnimatePresence>
                     {segments.length > 0 && segments.every(s => s.videoUrl) && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4"
                        >
                           <VideoStitcher 
                              segments={segments} 
                              audioFile={songData?.file}
                              onLog={addLog}
                           />
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>

            </div>
         </div>
      </div>

      {/* FOOTER INFO */}
      <footer className="mt-20 py-12 px-8 text-center text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] opacity-40 hover:opacity-100 transition-opacity">
         Sogni Vid Studio 4.0 — High Resolution Inference Shield
      </footer>
    </div>
  );
};

export default App;
