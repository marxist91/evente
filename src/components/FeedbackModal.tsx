import React, { useState } from 'react';
import { X, Send, MessageSquare, Bug, Lightbulb } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'suggestion' | 'other'>('suggestion');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !message.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonyme',
        type,
        message: message.trim(),
        status: 'new',
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setMessage('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0B0814]/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="relative w-full max-w-lg bg-[#1A1525] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-white tracking-tight">Donner son avis</h2>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} className="text-white" />
              </button>
            </div>

            {success ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Merci pour votre retour !</h3>
                <p className="text-purple-200/70">Votre message a bien été envoyé à notre équipe.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('suggestion')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                      type === 'suggestion' 
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300" 
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Lightbulb size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider">Idée</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                      type === 'bug' 
                        ? "bg-red-500/20 border-red-500/50 text-red-300" 
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Bug size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider">Bug</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('other')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                      type === 'other' 
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300" 
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <MessageSquare size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider">Autre</span>
                  </button>
                </div>

                <div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Décrivez votre idée, le bug rencontré ou votre suggestion..."
                    className="w-full bg-[#0B0814] border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 h-32 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={20} />
                      Envoyer
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
