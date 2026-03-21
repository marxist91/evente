import React, { useState, useEffect } from 'react';
import { Send, Trash2, User, X } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, increment, updateDoc } from 'firebase/firestore';

interface Comment {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
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
      await addDoc(collection(db, `moments/${momentId}/comments`), {
        text: newComment.trim(),
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Utilisateur',
        createdAt: new Date().toISOString()
      });
      
      await updateDoc(doc(db, 'moments', momentId), {
        commentsCount: increment(1)
      });

      setNewComment('');
    } catch (error) {
      console.error("Erreur lors de l'ajout du commentaire:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    
    try {
      await deleteDoc(doc(db, `moments/${momentId}/comments`, commentId));
      await updateDoc(doc(db, 'moments', momentId), {
        commentsCount: increment(-1)
      });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">Commentaires</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Aucun commentaire pour le moment. Soyez le premier !</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
                  <User size={14} className="text-brand-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{comment.authorName}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{comment.text}</p>
                </div>
                {(auth.currentUser?.uid === comment.authorUid) && (
                  <button 
                    onClick={() => handleDelete(comment.id)}
                    className="p-1 text-slate-500 hover:text-red-500 transition-colors self-start"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-slate-900/50">
          {auth.currentUser ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 bg-slate-800 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || loading}
                className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-slate-900 disabled:opacity-50 transition-opacity"
              >
                <Send size={16} />
              </button>
            </form>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Connectez-vous pour commenter
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
