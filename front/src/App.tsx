import React from 'react';
import { AlertCircle } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl flex flex-col items-center border border-white/10 shadow-2xl">
        <AlertCircle className="w-16 h-16 text-purple-500 mb-6" />
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
          Under Maintenance
        </h1>
        <p className="text-gray-400 mb-6 leading-relaxed">
          Sogni Studio is currently undergoing scheduled maintenance to bring you exciting new features and improvements. We'll be back online shortly.
        </p>
        <div className="text-sm text-gray-500">
          Thank you for your patience!
        </div>
      </div>
    </div>
  );
}

export default App;
