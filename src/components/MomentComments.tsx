import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Trash2, User, X, Loader2, MessageSquare } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, increment, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Comment {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: string;
}

interface MomentCommentsProps {
  momentId: string;
  onClose: () => void;
}

export function MomentComments({ momentId, onClose }: MomentCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `moments/${momentId}/comments`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [momentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim()) return;

    setLoading(true);
    try {
      const path = `moments/${momentId}/comments`;
      await addDoc(collection(db, path), {
        text: newComment.trim(),
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Utilisateur',
        authorPhoto: auth.currentUser.photoURL,
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(doc(db, 'moments', momentId), {
        commentsCount: increment(1)
      });

      setNewComment('');
    } catch (error) {
      console.error("Erreur lors de l'ajout du commentaire:", error);
      handleFirestoreError(error, OperationType.WRITE, `moments/${momentId}/comments`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!auth.currentUser) return;
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    
    try {
      const path = `moments/${momentId}/comments`;
      await deleteDoc(doc(db, path, commentId));
      await updateDoc(doc(db, 'moments', momentId), {
        commentsCount: increment(-1)
      });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      handleFirestoreError(error, OperationType.DELETE, `moments/${momentId}/comments/${commentId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-[#0B0814]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-[#1A1525] w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-3xl flex flex-col shadow-2xl border border-white/10"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">Commentaires</h3>
          <button onClick={onClose} className="p-2 text-purple-200/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-white/5 p-4 rounded-full mb-3">
                <MessageSquare size={32} className="text-purple-400/20" />
              </div>
              <p className="text-sm text-purple-200/50">Aucun commentaire pour le moment.<br />Soyez le premier !</p>
            </div>
          ) : (
            comments.map(comment => (
              <motion.div 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={comment.id} 
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30 overflow-hidden">
                  {comment.authorPhoto ? (
                    <img src={comment.authorPhoto} alt={comment.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={14} className="text-purple-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{comment.authorName}</span>
                    <span className="text-[10px] text-purple-200/50 font-medium">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-purple-200/80 mt-1 leading-relaxed">{comment.text}</p>
                </div>
                {(auth.currentUser?.uid === comment.authorUid) && (
                  <button 
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-purple-200/30 hover:text-rose-500 transition-colors self-start"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </motion.div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-[#0B0814]/50">
          {auth.currentUser ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 bg-white/5 border border-white/10 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-purple-200/30"
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || loading}
                className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white disabled:opacity-50 transition-opacity hover:bg-purple-600 shadow-lg shadow-orange-500/20"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-purple-200/50">
                Connectez-vous pour commenter
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
