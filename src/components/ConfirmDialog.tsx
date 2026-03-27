import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const colors = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/50',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/50',
    info: 'bg-purple-600 hover:bg-purple-700 shadow-orange-500/40'
  };

  const iconColors = {
    danger: 'text-rose-500 bg-rose-500/20 border border-rose-500/30',
    warning: 'text-amber-500 bg-amber-500/20 border border-amber-500/30',
    info: 'text-purple-400 bg-purple-500/20 border border-purple-500/30'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0B0814]/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#1A1525] w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          <div className="p-6 text-center">
            <div className={`w-16 h-16 ${iconColors[variant]} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-xl font-black text-white mb-2">{title}</h3>
            <p className="text-purple-200/70 text-sm leading-relaxed mb-8">
              {message}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={onConfirm}
                className={`w-full py-4 rounded-2xl text-white font-bold shadow-lg transition-all ${colors[variant]}`}
              >
                {confirmLabel}
              </button>
              <button
                onClick={onCancel}
                className="w-full py-4 rounded-2xl text-purple-200/70 font-bold hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
