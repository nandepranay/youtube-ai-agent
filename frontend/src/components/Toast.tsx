import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg animate-fade-in text-xs font-medium text-slate-800">
      {type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      {type === 'error' && <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />}
      {type === 'info' && <AlertCircle className="h-4 w-4 text-sky-500 shrink-0" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
