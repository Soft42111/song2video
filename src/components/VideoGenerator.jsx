import React, { useState, useEffect } from 'react';
import { getSegmentPrompt } from '../utils/aiAnalyzer';
import { generateVideoSegment } from '../utils/sogni';
import { 
  Sparkles, Play, Edit2, Check, AlertCircle, Loader2, Info, ArrowRight, Video, 
  Fingerprint, Command, Cpu, Hexagon, Database, Hash, Zap, MoreHorizontal, 
  Settings, RefreshCcw, Film, Layers, Monitor, ChevronLeft, ChevronRight, 
  Gauge, Target, Image as ImageIcon, Box, Search, Maximize2, Activity,
  Globe, Radio, Signal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VideoGenerator = ({ segments, setSegments, isGenerating, setIsGenerating, onOverallProgress, onLog }) => {
  const [activeSegment, setActiveSegment] = useState(null);
  const [stylePreset, setStylePreset] = useState('cinematic');

  const updateProgress = (segs) => {
    const total = segs.length;
    const generated = segs.filter(s => s.status === 'generated').length;
    const currentProgress = segs.reduce((acc, s) => acc + (s.progress || 0), 0) / total;
    onOverallProgress(Math.floor((generated / total) * 100 + (currentProgress / total)));
  };

  const handleProcessWorkflow = async () => {
    setIsGenerating(true);
    onLog(`Initializing production matrix with style: ${stylePreset.toUpperCase()}`, 'info');
    
    const updatedSegments = [...segments];

    for (let i = 0; i < updatedSegments.length; i++) {
      if (updatedSegments[i].videoUrl) continue;
      
      setActiveSegment(i);
      onLog(`Analyzing Shard [SH-${(i+1).toString().padStart(3, '0')}]...`, 'info');
      updatedSegments[i].status = 'analyzing';
      setSegments([...updatedSegments]);

      try {
        // Phase 0: Neural Directives (Gemini)
        const prompts = await getSegmentPrompt(updatedSegments[i], stylePreset);
        updatedSegments[i].t2iPrompt = prompts.t2iPrompt;
        updatedSegments[i].i2vPrompt = prompts.i2vPrompt;
        
        // Phase 1: Keyframe Synthesis
        onLog(`   → Phase 1: Synthesizing Keyframe (T2I)...`, 'info');
        const keyframeUrl = await generateImageSegment(updatedSegments[i]);
        updatedSegments[i].imageUrl = keyframeUrl;
        
        // Phase 2: Motion Rendering (I2V)
        onLog(`   → Phase 2: Animating Master (I2V)...`, 'info');
        const videoUrl = await generateVideoSegment(updatedSegments[i], keyframeUrl);
        
        updatedSegments[i].videoUrl = videoUrl;
        updatedSegments[i].status = 'generated';
        updatedSegments[i].progress = 100;
        onLog(`Shard SH-${(i+1).toString().padStart(3, '0')} fully synthesized.`, 'success');
      } catch (err) {
        updatedSegments[i].status = 'failed';
        onLog(`Synthesis failed for SH-${(i+1).toString().padStart(3, '0')}: ${err.message}`, 'error');
      }
      setSegments([...updatedSegments]);
      updateProgress(updatedSegments);
    }

    setIsGenerating(false);
    onLog(`Production matrix complete. Initiating assembly protocol...`, 'success');
  };

  if (!segments || segments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 text-center relative overflow-hidden bg-slate-950/20 rounded-[2rem] border border-slate-800/40">
        <Monitor className="text-slate-900 mb-8" size={80} strokeWidth={0.5} />
        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest mb-2">Live Monitor Offline</h3>
        <p className="text-slate-900 max-w-xs text-[9px] font-black uppercase tracking-widest leading-none">Awaiting signal from the left deck.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-10 animate-slide-up">
      
      {/* 02.A / CINEMATIC VIEWPORT */}
      <div className="relative aspect-video bg-black rounded-[2rem] border border-slate-800 shadow-2xl overflow-hidden group/monitor">
         <div className="absolute inset-x-0 top-0 p-8 flex justify-between items-start z-20">
            <div className="px-5 py-2 bg-slate-950/80 backdrop-blur-3xl border border-slate-800 rounded-full flex items-center gap-4">
               <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]' : (segments.every(s => s.videoUrl) ? 'bg-success shadow-[0_0_8px_#10b981]' : 'bg-slate-700')}`} />
               <span className="text-[10px] font-black text-white uppercase tracking-widest opacity-80">
                  {isGenerating ? 'Live Synthesis' : (segments.every(s => s.videoUrl) ? 'Master Ready' : 'Monitoring Ready')}
               </span>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
               <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-ultra">Engine: FAST-WAN-v2.2</span>
               </div>
            </div>
         </div>

         {/* MONITOR CONTENT */}
         <div className="absolute inset-0 flex items-center justify-center">
            {activeSegment !== null && segments[activeSegment]?.videoUrl ? (
               <video 
                  src={segments[activeSegment].videoUrl} 
                  className="w-full h-full object-cover" 
                  autoPlay 
                  loop 
                  controls 
               />
            ) : isGenerating && activeSegment !== null ? (
               <div className="flex flex-col items-center gap-12 text-center">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                     <svg className="absolute -rotate-90 w-full h-full">
                        <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-900/40"/>
                        <motion.circle 
                          cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="3" fill="transparent" 
                          className="text-primary"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: segments[activeSegment]?.progress / 100 || 0 }}
                        />
                     </svg>
                     <div className="flex flex-col items-center">
                        <span className="text-[32px] font-heading font-black text-white tabular-nums tracking-tighter leading-none mb-1">
                           {Math.round(segments[activeSegment]?.progress || 0)}%
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Shard {activeSegment + 1}/{segments.length}</span>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[11px] font-black text-white uppercase tracking-widest opacity-40">Synthesizing High-Res Lattice</h4>
                     <div className="h-[2px] w-48 bg-slate-900 mx-auto overflow-hidden">
                        <motion.div 
                           className="h-full bg-primary" 
                           animate={{ x: [-200, 200] }} 
                           transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                     </div>
                  </div>
               </div>
            ) : (
               <div className="text-center">
                  <Monitor className="text-slate-900 mb-8 mx-auto" size={80} strokeWidth={0.5} />
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Visual Feedback Link Idle</p>
               </div>
            )}
         </div>

         {/* Shading/Scanline for the Monitor */}
         <div className="absolute inset-0 bg-shimmer-gradient animate-shimmer opacity-[0.03] pointer-events-none" />
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.4)_100%)] pointer-events-none" />
      </div>

      {/* 02.B / DUAL-ACTION TOOLS */}
      <div className="flex flex-col md:flex-row items-center justify-between px-6 gap-8">
         <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 block px-1">Visual Directive Engine</span>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-4 bg-slate-950/80 p-1.5 border border-slate-800 rounded-[1.25rem] shadow-xl">
                  {['cinematic', 'minimalist', 'cyberpunk'].map((p) => (
                     <button 
                       key={p} 
                       onClick={() => setStylePreset(p)}
                       className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                         stylePreset === p ? 'bg-primary text-white shadow-lg' : 'text-slate-700 hover:text-slate-400'
                       }`}
                     >
                       {p}
                     </button>
                  ))}
               </div>
               <div className="w-[1px] h-8 bg-slate-800" />
               <div className="flex items-center gap-4">
                  <Globe className="text-slate-700" size={16} />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-ultra">NETWORK_FAST</span>
               </div>
            </div>
         </div>

         {!isGenerating && !segments.some(s => s.videoUrl) && (
            <button 
              onClick={handleProcessWorkflow}
              className="workflow-btn px-16 h-16 flex items-center gap-4 group"
            >
              Initialize Production <Zap size={16} className="fill-white group-hover:scale-125 transition-transform" />
            </button>
         )}
      </div>

      {/* 02.C / SEQUENCE STRIP */}
      <div className="px-6 flex flex-col gap-6">
         <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
               <Layers className="text-slate-800" size={16} />
               <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">Scene Shards</h3>
            </div>
            <div className="text-[9px] font-black text-slate-800 uppercase tracking-widest">
               ALLOCATED: {segments.length} UNITS
            </div>
         </div>
         
         <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar lg:justify-start">
            {segments.map((s, i) => (
               <div 
                  key={i} 
                  onClick={() => setActiveSegment(i)}
                  className={`relative w-20 h-28 rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden ${
                    activeSegment === i ? 'border-primary ring-4 ring-primary/10' : 'border-slate-800/40 grayscale hover:grayscale-0 hover:border-slate-600'
                  }`}
               >
                  {s.videoUrl ? (
                     <video src={s.videoUrl} className="w-full h-full object-cover" />
                  ) : (
                     <div className="w-full h-full bg-slate-900/40 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-800">0{i+1}</span>
                     </div>
                  )}
                  {s.status === 'generating' && (
                     <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Loader2 className="animate-spin text-primary" size={12} />
                     </div>
                  )}
               </div>
            ))}
         </div>
      </div>
      
    </div>
  );
};

export default VideoGenerator;
