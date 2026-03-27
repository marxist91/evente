import React, { useState, useEffect } from 'react';
import { Star, Send, Trash2, User } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Review } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface ReviewsProps {
  hotspotId: string;
}

export function Reviews({ hotspotId }: ReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, `hotspots/${hotspotId}/reviews`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Review[];
      setReviews(reviewsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `hotspots/${hotspotId}/reviews`);
    });

    return () => unsubscribe();
  }, [hotspotId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, `hotspots/${hotspotId}/reviews`), {
        hotspotId,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonyme',
        rating: newRating,
        comment: newComment,
        createdAt: new Date().toISOString(),
      });
      setNewComment('');
      setNewRating(5);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `hotspots/${hotspotId}/reviews`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await deleteDoc(doc(db, `hotspots/${hotspotId}/reviews`, reviewId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `hotspots/${hotspotId}/reviews/${reviewId}`);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <h4 className="font-bold text-white">Avis</h4>
      
      {auth.currentUser && (
        <form onSubmit={handleSubmit} className="bg-white/5 p-4 rounded-2xl space-y-3 border border-white/10">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setNewRating(star)}
                className={`p-1 ${newRating >= star ? 'text-amber-400' : 'text-purple-200/30'}`}
              >
                <Star size={20} fill={newRating >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Votre avis..."
            className="w-full bg-[#0B0814]/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-purple-200/50 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all"
            required
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="w-full bg-purple-500 text-white font-bold py-2 rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
          >
            {loading ? 'Envoi...' : <><Send size={16} /> Publier</>}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {reviews.map(review => (
          <div key={review.id} className="border-b border-white/10 pb-4 last:border-0">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <User size={16} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-white">{review.authorName}</span>
              </div>
              {auth.currentUser?.uid === review.authorUid && (
                <button onClick={() => handleDelete(review.id)} className="text-purple-200/50 hover:text-rose-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-purple-200/30'} />
              ))}
            </div>
            <p className="text-sm text-purple-200/80">{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
