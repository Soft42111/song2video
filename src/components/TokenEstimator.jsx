import React from 'react';
import { estimateTokens } from '../utils/sogni';
import { 
  Coins, Zap, HardDrive, Info, Activity, PieChart, Layers, 
  Database, ShieldCheck, Box, Terminal, Gauge, CreditCard, Signal, Search,
  ChevronDown, Hexagon
} from 'lucide-react';
import { motion } from 'framer-motion';

const TokenEstimator = ({ segments }) => {
  if (!segments || segments.length === 0) return null;

  const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0);
  
  // Calculate total tokens based on LTX-2.3 (720p/24fps)
  const totalTokens = segments.reduce((acc, s) => {
    return acc + estimateTokens(s.duration);
  }, 0);

  const formatTokens = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-10 relative overflow-hidden group/estimator shadow-bento">
      <div className="absolute top-0 right-0 p-8">
         <Hexagon className="text-primary/20 group-hover/estimator:text-primary/40 transition-colors" size={24} />
      </div>
      
      <header className="mb-12">
        <div className="flex items-center gap-3">
           <div className="w-1.5 h-6 bg-primary rounded-full" />
           <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Resource Ledger</h2>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        {/* Main Consumption Stat */}
        <div className="flex flex-col">
           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 mb-4 block">Neural Asset Balance</span>
           <div className="flex items-end gap-3 px-2">
              <motion.span 
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 className="text-6xl font-heading font-black text-white tracking-tighter drop-shadow-md"
              >
                 {formatTokens(totalTokens)}
              </motion.span>
              <span className="text-xl font-heading font-black text-slate-700 mb-2 uppercase tracking-widest">SPK</span>
           </div>
        </div>

        {/* Secondary Telemetry */}
        <div className="grid grid-cols-1 gap-5">
          <StatLine label="Allocated Shards" value={segments.length} unit="Units" />
          <StatLine label="Production Window" value={totalDuration.toFixed(2)} unit="Seconds" />
        </div>

        {/* Audit Disclaimer */}
        <div className="mt-4 pt-8 border-t border-slate-800/50 flex items-start gap-4 opacity-40 hover:opacity-100 transition-opacity">
           <ShieldCheck size={16} className="text-slate-600 shrink-0 mt-0.5" />
           <p className="text-[9px] text-slate-600 leading-relaxed font-bold uppercase tracking-tight">
             Verified on <span className="text-slate-400">SOGNI-WAN-V4.2</span>. Resource allocation is finalized upon shard commit.
           </p>
        </div>
      </div>
      
      <div className="absolute inset-0 bg-shimmer-gradient animate-shimmer opacity-[0.02] pointer-events-none" />
    </div>
  );
};

const StatLine = ({ label, value, unit }) => (
  <div className="flex items-center justify-between px-2">
     <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{label}</span>
     <div className="flex items-baseline gap-2">
        <span className="text-[16px] font-heading font-black text-slate-300 tracking-tight">{value}</span>
        <span className="text-[9px] font-bold text-slate-800 uppercase">{unit}</span>
     </div>
  </div>
);

export default TokenEstimator;
