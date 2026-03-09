import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Zap, Upload, History, Trash2, Download, Settings, X, Info, AlertCircle, Wand2, PlayCircle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from './db';
import type { ProjectRecord } from './db';

const API_BASE = 'http://localhost:3001';
const ESTIMATED_SPARK_PER_SEC = 1.6;
const SPARK_PER_IMAGE = 0.5; // Sogni image gen cost estimate

function estimateSparkCost(chunks: any[]): { chunks: any[], totalSpark: number } {
  const detailed = chunks.map((c: any, i: number) => {
    const imgCost = SPARK_PER_IMAGE;
    const vidCost = parseFloat(c.duration || 5) * ESTIMATED_SPARK_PER_SEC;
    return { index: i + 1, text: c.text, duration: c.duration, imgCost, vidCost, total: imgCost + vidCost };
  });
  const totalSpark = detailed.reduce((sum, c) => sum + c.total, 0);
  return { chunks: detailed, totalSpark };
}

export default function App() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyTab, setPolicyTab] = useState<'privacy' | 'terms' | 'license'>('license');
  const [costEstimate, setCostEstimate] = useState<{ chunks: any[], totalSpark: number } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const [theme, setTheme] = useState('');
  const [mood, setMood] = useState('');
  const [style, setStyle] = useState('Cinematic Realism (Default)');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [authConfig, setAuthConfig] = useState(() => {
    const saved = localStorage.getItem('sogni_auth');
    return saved ? JSON.parse(saved) : { username: '', password: '', apiKey: '' };
  });
  const [tokenType, setTokenType] = useState<'spark' | 'sogni'>(() => {
    return (localStorage.getItem('sogni_token_type') as 'spark' | 'sogni') || 'spark';
  });
  const [balance, setBalance] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('sogni_auth', JSON.stringify(authConfig));
    localStorage.setItem('sogni_token_type', tokenType);
  }, [authConfig, tokenType]);

  useEffect(() => {
    loadProjects();
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const query = new URLSearchParams({ auth: JSON.stringify(authConfig) }).toString();
      const res = await fetch(`${API_BASE}/api/balance?${query}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      }
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
  };

  const loadProjects = async () => {
    const all = await db.getAllProjects();
    setProjects(all.sort((a, b) => b.timestamp - a.timestamp));
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this project forever?')) {
      await db.deleteProject(id);
      loadProjects();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | any) => {
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    if (!authConfig.apiKey && (!authConfig.username || !authConfig.password)) {
      setShowSettings(true);
      alert("Please configure your Sogni Auth in Settings first.");
      return;
    }

    setIsProcessing(true);
    setActiveProjectId(null);

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('theme', theme);
    formData.append('mood', mood);
    formData.append('style', style);
    formData.append('customPrompt', customPrompt);
    formData.append('tokenType', tokenType);
    formData.append('auth', JSON.stringify(authConfig));

    try {
      const res = await fetch(`${API_BASE}/api/generate-song-video`, { method: 'POST', body: formData });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server Error: ${text.substring(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Store cost estimate from returned chunks
      if (data.chunks) {
        setCostEstimate(estimateSparkCost(data.chunks));
      }

      await db.saveProject({
        id: data.projectId,
        type: 'song-video',
        prompt: customPrompt || `Cinematics for: ${selectedFile.name}`,
        status: 'processing',
        progress: 0,
        timestamp: Date.now(),
        step: 'Initializing Sogni Pipeline...'
      });
      setActiveProjectId(data.projectId);
      loadProjects();
      fetchBalance();
      setSelectedFile(null); // Reset after success
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(`Process failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let interval: any;
    const poll = async () => {
      const processing = projects.filter((p: ProjectRecord) => p.status === 'processing');
      if (processing.length === 0) return;

      for (const p of processing) {
        try {
          const res = await fetch(`${API_BASE}/api/status/${p.id}`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === 'completed' && data.videoUrl && !p.localVideoBlob) {
            await db.persistMedia(p.id, `${API_BASE}/api/proxy?url=${encodeURIComponent(data.videoUrl)}`, 'video');
            // Notify backend to purge server-side files
            fetch(`${API_BASE}/api/cleanup/${p.id}`, { method: 'DELETE' }).catch(() => { });
          }
          await db.updateProject(p.id, {
            status: data.status,
            progress: data.progress,
            step: data.step,
            error: data.error,
            videoUrl: data.videoUrl,
            logs: data.logs
          });
        } catch (e) { }
      }
      loadProjects();
    };
    interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [projects]);

  const activeJob = projects.find(p => p.id === activeProjectId);

  return (
    <div className="flex flex-col min-h-screen">

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="ultra-card w-full max-w-md p-8 relative">
              <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="text-[var(--neon-purple)]" /> Configuration</h2>

              <div className="bg-[var(--neon-purple)]/5 border border-[var(--neon-purple)]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Info size={18} className="text-[var(--neon-purple)] mt-0.5 shrink-0" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-white font-bold">Privacy Note:</span> Your credentials are encrypted and stored <span className="text-white">only locally</span> in your browser's IndexedDB. They never leave your device except to authenticate directly with the Sogni API via our stateless bridge.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="subheader mb-2 block">Token Mode</label>
                  <div className="flex gap-2">
                    <button onClick={() => setTokenType('spark')} className={`flex-1 py-3 rounded-xl transition-all font-semibold ${tokenType === 'spark' ? 'bg-[var(--neon-purple)] text-white' : 'bg-[#111] text-gray-500 hover:bg-[#222]'}`}>Spark</button>
                    <button onClick={() => setTokenType('sogni')} className={`flex-1 py-3 rounded-xl transition-all font-semibold ${tokenType === 'sogni' ? 'bg-[var(--neon-cyan)] text-black' : 'bg-[#111] text-gray-500 hover:bg-[#222]'}`}>Sogni</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="subheader block">Sogni Credentials</label>
                  <input type="text" placeholder="Username" value={authConfig.username} onChange={e => setAuthConfig({ ...authConfig, username: e.target.value })} className="input-recessed" />
                  <input type="password" placeholder="Password" value={authConfig.password} onChange={e => setAuthConfig({ ...authConfig, password: e.target.value })} className="input-recessed" />
                  <div className="text-center text-xs text-gray-600 font-bold uppercase tracking-widest my-4">— OR —</div>
                  <input type="text" placeholder="Cloud API Key" value={authConfig.apiKey} onChange={e => setAuthConfig({ ...authConfig, apiKey: e.target.value })} className="input-recessed" />
                </div>
                <button onClick={() => { setShowSettings(false); fetchBalance(); }} className="sogni-btn-ultra primary w-full mt-6 py-4">Save Configuration</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showPolicy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="ultra-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative p-0">
              <button onClick={() => setShowPolicy(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white z-10 p-2"><X size={20} /></button>

              <div className="p-8 border-b border-white/5">
                <h2 className="text-3xl font-black font-['Geist'] tracking-tight mb-6">Legal & Open Source</h2>
                <div className="flex gap-4">
                  {(['license', 'privacy', 'terms'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setPolicyTab(tab)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${policyTab === tab ? 'border-[var(--neon-purple)] bg-[var(--neon-purple)]/10 text-white' : 'border-white/5 text-gray-500 hover:text-white'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar text-gray-400 leading-relaxed space-y-4 text-sm font-['Geist']">
                {policyTab === 'license' && (
                  <div className="space-y-4">
                    <p className="font-bold text-white uppercase tracking-widest text-xs">MIT License</p>
                    <p>Copyright (c) {new Date().getFullYear()} Basit</p>
                    <p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction...</p>
                    <p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.</p>
                  </div>
                )}
                {policyTab === 'privacy' && (
                  <div className="space-y-4">
                    <p className="font-bold text-white uppercase tracking-widest text-xs">Privacy Protocol</p>
                    <p>SONG2VID is a client-first application designed with maximum privacy in mind.</p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li><strong>Local Storage:</strong> All project data, including generated videos and metadata, resides in your browser's IndexedDB.</li>
                      <li><strong>Stateless Compute:</strong> Our server acts as a transient bridge only. Files are purged from the server immediately after they are synced to your browser.</li>
                      <li><strong>No Tracking:</strong> We do not track your prompts, identity, or usage patterns outside of your local session.</li>
                    </ul>
                  </div>
                )}
                {policyTab === 'terms' && (
                  <div className="space-y-4">
                    <p className="font-bold text-white uppercase tracking-widest text-xs">Terms of Usage</p>
                    <p>By using this open-sourced pipeline, you agree to the following terms:</p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>You are responsible for the content you generate and must comply with Sogni AI's underlying safety guidelines.</li>
                      <li>This software is provided for experimental and cinematic synthesis purposes.</li>
                      <li>Commercial use of generated output depends on your specific Sogni AI license tier.</li>
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Power Meter */}
      <div className="power-meter">
        <div className="flex items-center gap-2">
          <Zap className="text-[var(--neon-purple)]" size={16} fill="currentColor" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Power</span>
        </div>
        <div className="h-4 w-[1px] bg-white/20"></div>
        <div className="meter-value">~{ESTIMATED_SPARK_PER_SEC} SPARK / S</div>
      </div>

      {/* Top Navigation Bar */}
      <header className="w-full h-20 px-8 flex items-center justify-between z-40 relative border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center cursor-pointer hover:border-[var(--neon-purple)] transition-colors" onClick={() => { setActiveProjectId(null); setShowHistory(false); }}>
            <Wand2 className="text-[var(--neon-cyan)]" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="status-dot-ultra"></span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--neon-purple)]">Sogni V2.1 Pipeline Online</span>
            </div>
            <div className="font-['Geist'] font-bold text-xl tracking-tight text-white leading-none">SONG2VID</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {balance && (
            <div className="mr-6 bg-[#111] px-4 py-2 rounded-lg border border-white/5 flex items-center gap-2">
              <span className="subheader">Wallet</span>
              <span className="text-sm font-bold text-white">
                {(Number(balance.sparkBalance || balance.spark || 0)).toFixed(2)} SPRK
              </span>
            </div>
          )}
          <button onClick={() => setShowHistory(!showHistory)} className={`p-2.5 rounded-xl transition-colors ${showHistory ? 'bg-white/10 text-white' : 'text-gray-500 bg-[#0d0d0f] hover:text-white hover:bg-[#1a1a1a] border border-white/5'}`} title="Archive">
            <History size={18} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl transition-colors text-gray-500 bg-[#0d0d0f] hover:text-[var(--neon-purple)] hover:bg-[#1a1a1a] border border-white/5" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex px-6 py-8 md:px-12 md:py-12 justify-center">

        {/* Default View: Card-in-Card */}
        {!activeJob && !showHistory && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl ultra-card flex flex-col items-center justify-center p-8 md:p-12">

            <div className="w-full text-center mb-10">
              <h1 className="text-4xl md:text-5xl font-['Geist'] font-bold tracking-tight text-white mb-3">Cinematic Synthesis</h1>
              <p className="text-gray-400 max-w-xl mx-auto">Upload a master track and configure atmosphere controls to render a high-fidelity audio-reactive video sequence.</p>
            </div>

            <div className="w-full grid lg:grid-cols-12 gap-10 xl:gap-16">

              {/* Left Column: Heavy Dropzone */}
              <div className="lg:col-span-12 xl:col-span-5 flex flex-col">
                <div
                  className={`dropzone-ultra flex-1 ${isDragging ? 'active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-glow"></div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} />

                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-6 z-10 relative">
                      <Loader2 className="animate-spin text-[var(--neon-purple)]" size={40} />
                      <h3 className="font-['Geist'] text-lg font-bold text-white tracking-wide">Syncing to Sogni...</h3>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex flex-col items-center text-center px-8 z-10 relative">
                      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[var(--neon-cyan)] flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <PlayCircle className="text-[var(--neon-cyan)]" size={32} />
                      </div>
                      <h3 className="font-['Geist'] text-xl font-bold text-white mb-2">Track Loaded</h3>
                      <p className="text-sm text-[var(--neon-cyan)] font-mono truncate max-w-[200px] mb-8">{selectedFile.name}</p>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-xs text-gray-500 hover:text-white transition-colors underline decoration-gray-700 underline-offset-4 mb-4">Remove File</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center px-8 z-10 relative">
                      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center mb-6 shadow-xl">
                        <Upload className="dropzone-icon text-gray-400" size={32} />
                      </div>
                      <h3 className="font-['Geist'] text-xl font-bold text-white mb-2">Drop Master Track</h3>
                      <p className="text-sm text-gray-500 max-w-[200px] mb-8 leading-relaxed">MP3 or WAV format. Engine processes up to 10 minutes.</p>
                      <button className="sogni-btn-ultra">Browse System</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Atmosphere Controls Grid */}
              <div className="lg:col-span-12 xl:col-span-7 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                  <Layers className="text-[var(--text-secondary)]" size={20} />
                  <h3 className="subheader">Atmosphere Controls</h3>
                </div>

                {/* 2-Column Grid for Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="subheader block">Cinematic Theme</label>
                    <input type="text" value={theme} onChange={e => setTheme(e.target.value)} placeholder="Cyberpunk, lush forest..." className="input-recessed" />
                  </div>

                  <div className="space-y-2">
                    <label className="subheader block">Vibe & Mood</label>
                    <input type="text" value={mood} onChange={e => setMood(e.target.value)} placeholder="Melancholic, aggressive..." className="input-recessed" />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="subheader">Visual Style Engine</label>
                      <span className="text-[9px] text-[var(--neon-cyan)] border border-[var(--neon-cyan)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Premium</span>
                    </div>
                    <select value={style} onChange={e => setStyle(e.target.value)} className="input-recessed appearance-none cursor-pointer">
                      <option>Cinematic Realism (Default)</option>
                      <option>Studio Ghibli</option>
                      <option>Vaporwave Aesthetic</option>
                      <option>Unreal Engine 5</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="subheader block">Prompt Injection</label>
                    <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Direct scene descriptors and lighting overrides..." className="input-recessed resize-none h-28" />
                  </div>
                </div>

                {/* Generate Action */}
                <div className="mt-10 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-5 flex-wrap justify-center">
                    <button
                      onClick={handleGenerate}
                      disabled={!selectedFile || isProcessing}
                      className={`sogni-btn-ultra primary px-12 py-5 text-lg flex items-center gap-3 transition-all ${!selectedFile || isProcessing ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-[1.02] active:scale-95'}`}
                    >
                      {isProcessing ? (
                        <><Loader2 className="animate-spin" size={24} />Synthesizing...</>
                      ) : (
                        <><Zap size={24} fill="currentColor" />INITIATE GENERATION</>
                      )}
                    </button>

                    {costEstimate && (
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-gray-500 font-bold text-sm">~</span>
                          <span className="text-2xl font-black text-white">{costEstimate.totalSpark.toFixed(2)}</span>
                          <span className="text-xs text-[var(--neon-cyan)] font-bold">SPRK</span>
                        </div>
                        <button onClick={() => setShowReceipt(!showReceipt)} className="text-[10px] text-gray-600 hover:text-[var(--neon-purple)] transition-colors underline underline-offset-2">
                          {showReceipt ? 'hide receipt' : 'full receipt ↓'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Receipt Breakdown */}
                  {showReceipt && costEstimate && (
                    <div className="w-full max-w-sm bg-[#0d0d0f] border border-white/5 rounded-xl p-4">
                      <div className="grid grid-cols-5 text-[10px] uppercase tracking-widest text-gray-600 font-bold pb-2 border-b border-white/5 mb-2">
                        <span>#</span><span className="col-span-2">Segment</span><span className="text-right">Img</span><span className="text-right">Total</span>
                      </div>
                      {costEstimate.chunks.map((c: any) => (
                        <div key={c.index} className="grid grid-cols-5 text-xs text-gray-400 items-center py-1">
                          <span className="text-white font-bold">{c.index}</span>
                          <span className="col-span-2 truncate text-gray-500 pr-2">{c.text?.substring(0, 25)}…</span>
                          <span className="text-right text-gray-600">{c.imgCost.toFixed(1)}</span>
                          <span className="text-right text-white font-bold">{c.total.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-white/5 pt-2 mt-1 flex justify-between text-xs">
                        <span className="text-gray-500">Total Est.</span>
                        <span className="text-[var(--neon-cyan)] font-black">~{costEstimate.totalSpark.toFixed(2)} SPRK</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Ready for visual deployment</p>
                </div>

              </div>
          </motion.div>
        )}

        {/* Active Job Dashboard - Cinematic Card */}
        {activeJob && !showHistory && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-[1400px] ultra-card flex flex-col lg:flex-row overflow-hidden flex-1">

            {/* Visualizer Frame */}
            <div className="lg:w-2/3 bg-black flex flex-col relative border-r border-white/5">
              <div className="absolute top-6 left-6 z-20 flex gap-3">
                <button onClick={() => setActiveProjectId(null)} className="sogni-btn-ultra !py-2 !px-4 !text-xs !bg-black/50 !backdrop-blur-md">
                  <X size={14} /> Close
                </button>
                {activeJob.status === 'processing' && (
                  <button onClick={(e) => handleDeleteProject(activeJob.id, e)} className="sogni-btn-ultra !py-2 !px-4 !text-xs !bg-red-900/20 !text-red-400 !border-red-500/30 hover:!bg-red-900/50">
                    <Trash2 size={14} /> Terminate
                  </button>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative overflow-hidden">
                {/* Decorative background glow for visualizer */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.05)_0%,transparent_60%)] pointer-events-none"></div>

                {activeJob.localVideoBlob || (activeJob.videoUrl && activeJob.status === 'completed') ? (
                  <video controls autoPlay loop className="w-full h-full object-contain rounded-xl border border-white/10 shadow-2xl relative z-10 bg-[#08080a]" src={activeJob.localVideoBlob ? URL.createObjectURL(activeJob.localVideoBlob) : `${API_BASE}/api/proxy?url=${encodeURIComponent(activeJob.videoUrl!)}`} />
                ) : (
                  <div className="flex flex-col items-center relative z-10">
                    <div className="w-24 h-24 border-2 border-dashed border-white/20 rounded-full flex items-center justify-center mb-8 relative">
                      <div className="absolute inset-[-2px] border-2 border-[var(--neon-cyan)] rounded-full animate-[spin_3s_linear_infinite] border-t-transparent border-l-transparent"></div>
                      <Loader2 className="text-[var(--neon-purple)] animate-spin" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold font-['Geist'] text-white tracking-wide mb-2">{activeJob.step}</h2>
                    <p className="subheader text-[var(--neon-purple)]">Engine Processing Sequence</p>
                  </div>
                )}
              </div>
            </div>

            {/* Telemetry Panel */}
            <div className="lg:w-1/3 bg-[#0d0d0f] p-8 lg:p-10 flex flex-col relative">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <h3 className="font-['Geist'] text-xl font-bold flex items-center gap-3"><Info className="text-[var(--neon-cyan)]" size={20} /> Telemetry</h3>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--neon-purple)] font-bold mb-1">Status</div>
                  <div className="text-sm font-bold text-white uppercase">{activeJob.status}</div>
                </div>
              </div>

              <div className="mb-10">
                <div className="flex justify-between items-end mb-3">
                  <span className="subheader">Render Progress</span>
                  <span className="text-3xl font-black font-['Geist'] text-white leading-none">{activeJob.progress}<span className="text-lg text-gray-500 ml-1">%</span></span>
                </div>
                <div className="w-full h-2 bg-[#050505] rounded-full overflow-hidden border border-[#222]">
                  <div className="h-full bg-[var(--neon-cyan)] transition-all duration-500 relative" style={{ width: `${activeJob.progress}%` }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-[200%] animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
              </div>

              {/* Terminal Output */}
              <div className="flex-1 bg-[#050505] border border-[#1a1a1a] p-5 flex flex-col overflow-hidden mb-8 rounded-xl relative shadow-inner">
                <div className="flex items-center justify-between border-b mx-[-20px] px-5 border-[#222] pb-3 mb-4 mt-[-4px]">
                  <span className="subheader">System Output</span>
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[11px] pr-3 custom-scrollbar">
                  {activeJob.logs?.map((log: string, i: number) => (
                    <div key={i} className={`leading-relaxed break-words flex gap-3 ${i === 0 ? 'text-white' : 'text-gray-500'}`}>
                      <span className={`select-none ${i === 0 ? 'text-[var(--neon-cyan)]' : 'text-[#333]'}`}>&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {(!activeJob.logs || activeJob.logs.length === 0) && <div className="text-[#444] animate-pulse">Awaiting data stream...</div>}
                </div>
              </div>

              <div className="mt-auto pt-4 relative z-10">
                {activeJob.status === 'completed' && activeJob.videoUrl && (
                  <a href={activeJob.videoUrl} download className="sogni-btn-ultra primary w-full flex justify-center py-4 text-base">
                    <Download size={18} /> Export Master Video
                  </a>
                )}
                {activeJob.status === 'failed' && (
                  <div className="p-4 rounded-xl bg-[#110505] border border-red-500/20 text-red-400 flex items-start gap-3 shadow-[0_0_20px_rgba(255,0,0,0.05)_inset]">
                    <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={18} />
                    <div className="text-sm font-medium leading-relaxed">{activeJob.error}</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Archives View */}
        {showHistory && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-7xl ultra-card p-8 md:p-12 min-h-[70vh]">
            <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
              <h2 className="text-3xl font-['Geist'] font-bold flex items-center gap-3"><History className="text-[var(--neon-purple)]" /> Render Archives</h2>
              <button onClick={() => setShowHistory(false)} className="sogni-btn-ultra !px-4 !py-2"><X size={16} /> close</button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((p: ProjectRecord) => (
                <div key={p.id} onClick={() => { setActiveProjectId(p.id); setShowHistory(false); }} className="group cursor-pointer bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden hover:border-[var(--neon-cyan)] transition-colors shadow-lg">
                  <div className="h-40 bg-[#050505] relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,255,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {p.status === 'completed' && p.videoUrl ? (
                      <PlayCircle size={48} className="text-[#333] group-hover:text-white transition-colors relative z-10" />
                    ) : (
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest relative z-10">{p.status}</div>
                    )}
                    <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-cyan)]" style={{ width: `${p.progress}%` }}></div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-white truncate text-sm flex-1 mr-3 leading-tight">{p.prompt}</h4>
                      <button onClick={(e) => handleDeleteProject(p.id, e)} className="text-[#444] hover:text-red-500 transition-colors bg-[#111] p-1.5 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                    <div className="text-[10px] text-[#666] uppercase tracking-wider font-semibold">{new Date(p.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <div className="text-[#444] p-12 text-center col-span-full border border-dashed border-[#222] rounded-2xl">No visual experiments archived yet.</div>}
            </div>
          </motion.div>
        )}
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-white/5 bg-[#050505] mt-auto py-8">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col items-center md:items-start">
            <div className="font-['Geist'] font-bold text-lg text-white mb-2 tracking-tight">SONG2VID</div>
            <p className="text-sm text-gray-500 max-w-sm text-center md:text-left">
              Cinematic audio-reactive video synthesis. Experience the future of music visualization powered by the Sogni V2.1 Pipeline.
            </p>
          </div>

          <div className="flex gap-8 text-sm text-gray-400">
            <div className="flex flex-col gap-2 text-center md:text-left">
              <span className="text-white font-semibold mb-1">Ecosystem</span>
              <a href="https://sogni.ai" target="_blank" rel="noreferrer" className="hover:text-[var(--neon-cyan)] transition-colors">Sogni AI</a>
              <a href="https://Basitresume.xyz/" target="_blank" rel="noreferrer" className="hover:text-[var(--neon-cyan)] transition-colors">Basit</a>
              <a href="https://x.com/soft4211" target="_blank" rel="noreferrer" className="hover:text-[var(--neon-cyan)] transition-colors">X of Basit</a>
            </div>
            <div className="flex flex-col gap-2 text-center md:text-left">
              <span className="text-white font-semibold mb-1">Legal</span>
              <button onClick={() => { setShowPolicy(true); setPolicyTab('terms'); }} className="text-left hover:text-[var(--neon-purple)] transition-colors">Terms of Service</button>
              <button onClick={() => { setShowPolicy(true); setPolicyTab('privacy'); }} className="text-left hover:text-[var(--neon-purple)] transition-colors">Privacy Policy</button>
              <button onClick={() => { setShowPolicy(true); setPolicyTab('license'); }} className="text-left hover:text-[var(--neon-purple)] transition-colors">MIT License</button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Sogni AI Apps from Basit. All rights reserved.</p>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Systems Normal — {ESTIMATED_SPARK_PER_SEC} SPARK/s Compute Ratio</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(50%); } }
      `}</style>
    </div>
  );
}
