import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { segmentAudio } from '../utils/segmenter';
import { 
  Upload, Music, CheckCircle, BarChart3, Loader2, Disc, Waves, 
  Activity, Radio, Cpu, Share2, Terminal, Plus, Box, Play, Signal, 
  Database, DatabaseZap, AudioLines, FileMusic, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DURATION = 600; // 10 Minutes

const SongUploader = ({ onUpload }) => {
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    if (uploadedFile.size > MAX_FILE_SIZE) {
      alert('FILE_SIZE_LIMIT: 10MB Maximum.');
      return;
    }

    setLoading(true);

    try {
      const analysis = await segmentAudio(uploadedFile);
      
      if (analysis.duration > MAX_DURATION) {
        alert('DURATION_LIMIT: 10:00 Maximum.');
        setLoading(false);
        return;
      }

      const result = {
        ...analysis,
        name: uploadedFile.name,
        size: uploadedFile.size,
        file: uploadedFile
      };
      
      onUpload(result);
    } catch (error) {
      console.error('Buffer decryption error:', error.message);
      alert('DECRYPTION_ERROR: Invalid signal source.');
    } finally {
      setLoading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav']
    },
    multiple: false
  });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center group/ingest">
      <div 
        {...getRootProps()} 
        className={cn(
          "w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2.5rem] p-12 transition-all duration-700 cursor-pointer relative group-hover/ingest:border-primary/40",
          isDragActive && "border-primary bg-primary/[0.03] scale-[0.98] shadow-2xl"
        )}
      >
        <input {...getInputProps()} />
        
        {loading ? (
          <div className="flex flex-col items-center gap-8">
             <Loader2 className="animate-spin text-primary" size={48} strokeWidth={2.5} />
             <div className="space-y-2">
                <h3 className="text-[14px] font-black text-white uppercase tracking-widest">Processing Shard</h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Awaiting Neural Map</p>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-10">
             <div className="relative group/btn">
                <div className="w-24 h-24 bg-slate-900 rounded-[2rem] border border-slate-800 flex items-center justify-center transition-all group-hover/ingest:scale-110 group-hover/ingest:bg-primary/20 group-hover/ingest:border-primary/40 shadow-xl overflow-hidden">
                   <Zap className="text-slate-600 group-hover/ingest:text-primary transition-all group-hover/ingest:fill-primary" size={40} strokeWidth={2.5} />
                   <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/ingest:opacity-100 transition-opacity" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-[12px] font-black text-white shadow-lg border border-slate-900 group-hover/ingest:translate-x-1 group-hover/ingest:translate-y-1 transition-transform">
                   +
                </div>
             </div>
             
             <div className="max-w-xs">
                <h3 className="text-[16px] font-black text-white mb-3 uppercase tracking-tighter">Enter the Song</h3>
                <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest leading-relaxed opacity-60 group-hover/ingest:opacity-100 transition-opacity">
                   WAV or MP3 (Max 10MB) to initialize the visual synthesis protocol.
                </p>
             </div>
             
             <div className="flex items-center gap-4 py-3 px-6 bg-slate-900 border border-slate-800 rounded-2xl opacity-40 group-hover/ingest:opacity-100 transition-opacity">
                <Terminal size={14} className="text-slate-600" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">SIGNAL_READYv4.2</span>
             </div>
          </div>
        )}
        
        {/* Subtle grid in background of uploader */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-900/10 to-transparent pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-grid-pattern rounded-[2.5rem]" />
      </div>
    </div>
  );
};

export default SongUploader;
