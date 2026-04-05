import React, { useState } from 'react';
import { stitchVideos, isThreadReady, loadFFmpeg } from '../utils/stitcher';
import { 
  Film, Download, CheckCircle, Loader2, Play, AlertTriangle, ShieldCheck, 
  Share2, Terminal, Radio, Activity, Cpu, Hexagon, Layers, Box, Monitor, 
  Signal, Zap, Gauge, Disc, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VideoStitcher = ({ segments, audioFile, onLog }) => {
  const [isStitching, setIsStitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleStitch = async () => {
    if (!isThreadReady()) {
      const msg = "THREAD_LOCKED: SharedArrayBuffer not enabled. Verify COOP/COEP.";
      setError(msg);
      onLog(msg, 'error');
      return;
    }

    setIsStitching(true);
    setError(null);
    setProgress(0);
    onLog(`Initializing Assembly Protocol [VFS_MOCK]...`, 'info');

    try {
      const videoUrls = segments.map(s => s.videoUrl);
      const url = await stitchVideos(videoUrls, audioFile, (p) => {
        setProgress(p);
      });
      setFinalVideoUrl(url);
      onLog(`Master assembly complete. Buffer finalized.`, 'success');
      onLog(`PRO-MASTER READY FOR EXPORT.`, 'success');
    } catch (err) {
      console.error("Mastering failed:", err);
      const msg = "ASSEMBLY_INTERRUPTED: Buffer Overflow or Codec Mismatch.";
      setError(msg);
      onLog(msg, 'error');
    } finally {
      setIsStitching(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-10 relative overflow-hidden group/stitcher shadow-2xl">
      
      {!finalVideoUrl && !isStitching ? (
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center">
                 <Layers className="text-slate-600" size={24} />
              </div>
              <div className="space-y-1">
                 <h3 className="text-[14px] font-black text-white uppercase tracking-tight">Master Assembly</h3>
                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Consolidate {segments.length} shards into a continuous stream.</p>
              </div>
           </div>
           
           <button 
             onClick={handleStitch}
             className="px-10 py-3.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-ultra flex items-center gap-3 transition-all hover:scale-[1.02] shadow-xl shadow-primary/20"
           >
             Finalize <Zap size={14} className="fill-white" />
           </button>
        </div>
      ) : isStitching ? (
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="relative w-12 h-12 flex items-center justify-center">
                 <svg className="absolute -rotate-90 w-full h-full">
                    <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-slate-950"/>
                    <motion.circle 
                      cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" fill="transparent" 
                      className="text-primary"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: progress / 100 }}
                    />
                 </svg>
                 <span className="text-[11px] font-black text-white tabular-nums tracking-tighter">{Math.round(progress)}%</span>
              </div>
              <div className="space-y-1">
                 <h3 className="text-[12px] font-black text-white uppercase tracking-widest">Encoding Master</h3>
                 <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Shard Assembly in progress...</p>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <Loader2 className="animate-spin text-primary" size={16} />
           </div>
        </div>
      ) : finalVideoUrl ? (
        <div className="flex items-center justify-between bg-primary/[0.03] p-8 -m-10 mt-0 border-t border-primary/20">
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-primary/20 shadow-md">
                 <CheckCircle className="text-primary" size={24} />
              </div>
              <div>
                 <h3 className="text-[14px] font-black text-white uppercase tracking-tight mb-1">Production Complete</h3>
                 <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">SOGNI_BENTO_MASTER.mp4 READY</p>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <a 
                href={finalVideoUrl} download="SOGNI_BENTO_MASTER.mp4"
                className="px-8 py-3.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-colors hover:bg-primary/80"
              >
                Download <Download size={16} />
              </a>
           </div>
        </div>
      ) : null}

      <div className="absolute inset-0 bg-shimmer-gradient animate-shimmer opacity-[0.02] pointer-events-none" />
    </div>
  );
};

export default VideoStitcher;
