import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const TerminalLog = ({ logs }) => {
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="terminal-box custom-scrollbar">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/20 animate-scanline-fast" />
      
      <div className="space-y-1.5">
        {logs.length === 0 ? (
          <div className="flex gap-3">
            <span className="terminal-timestamp">[{getTimeString()}]</span>
            <span className="terminal-content text-slate-800">Awaiting audio signal...</span>
          </div>
        ) : (
          logs.map((log, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="terminal-log-line"
            >
              <span className="terminal-timestamp">[{log.time || getTimeString()}]</span>
              <span className={`terminal-content ${log.type === 'error' ? 'text-danger' : log.type === 'success' ? 'text-success' : 'text-slate-400'}`}>
                {log.message}
              </span>
            </motion.div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default TerminalLog;
