import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, MapPin, Tag, Heart, Share2, Facebook, Twitter, MessageCircle, ChevronRight, Info, Send, Trash2, User as UserIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Event, Comment } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ConfirmDialog } from './ConfirmDialog';

interface EventCardProps {
  key?: string | number;
  event: Event;
  isFavorite?: boolean;
  onToggleFavorite?: (eventId: string) => void;
  allEvents?: Event[];
}

export function EventCard({ event, isFavorite, onToggleFavorite, allEvents }: EventCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const shareUrl = window.location.href;
  const shareText = `Découvrez l'événement "${event.title}" à ${event.city} sur Togo Vibes !`;

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.location}, ${event.city}, Togo`)}`;

  const isOwner = auth.currentUser?.uid === event.authorUid;

  const categoryLabels: Record<string, string> = {
    party: 'Fête / Nightlife',
    culture: 'Culture / Expo',
    concert: 'Concert / Live',
    dance: 'Soirée Dansante',
    other: 'Autre'
  };

  const dayNames = ['Dimanches', 'Lundis', 'Mardis', 'Mercredis', 'Jeudis', 'Vendredis', 'Samedis'];

  let displayDate = '';
  if (event.isRecurring && event.recurringDay !== undefined) {
    displayDate = `Tous les ${dayNames[event.recurringDay]}`;
    if (event.time) {
      displayDate += ` à ${event.time}`;
    } else if (event.date.includes('T')) {
      const dateObj = new Date(event.date);
      if (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0) {
        displayDate += ` à ${format(dateObj, "HH:mm")}`;
      }
    }
  } else {
    displayDate = format(new Date(event.date), "EEEE d MMMM", { locale: fr });
    if (event.time) {
      displayDate += ` à ${event.time}`;
    } else if (event.date.includes('T')) {
      const dateObj = new Date(event.date);
      if (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0) {
        displayDate += ` à ${format(dateObj, "HH:mm")}`;
      }
    }
  }

  // Fetch comments
  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('eventId', '==', event.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(fetchedComments);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `comments (event: ${event.id})`);
    });

    return () => unsubscribe();
  }, [event.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        eventId: event.id,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonyme',
        authorPhoto: auth.currentUser.photoURL,
        text: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'comments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await deleteDoc(doc(db, 'events', event.id));
      setIsConfirmDeleteOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${event.id}`);
    }
  };

  const similarEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents
      .filter(e => e.id !== event.id && (e.category === event.category || e.city === event.city))
      .slice(0, 3);
  }, [allEvents, event]);

  return (
    <>
      <div 
        className={cn("bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 mb-6 relative flex flex-col cursor-pointer transition-all duration-300 hover:shadow-md", showDetails ? "shadow-md" : "")}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div 
          className={cn("relative transition-all duration-500 group", showDetails ? "h-72" : "h-48")}
          onClick={(e) => {
            if (showDetails) {
              e.stopPropagation();
              setShowImageModal(true);
            }
          }}
        >
          <img
            src={event.imageUrl || `https://picsum.photos/seed/${event.id}/800/600`}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
            <Tag size={12} className="text-brand-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
              {categoryLabels[event.category] || event.category}
            </span>
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2">
            {isOwner && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmDeleteOpen(true);
                }}
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm text-gray-400 hover:text-rose-600 flex items-center justify-center transition-all shadow-lg"
              >
                <Trash2 size={18} />
              </button>
            )}
            {onToggleFavorite && (
              <motion.button 
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(event.id);
                }}
                className={cn(
                  "h-10 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all shadow-xl z-10",
                  isFavorite 
                    ? "bg-rose-500 text-white" 
                    : "bg-white/95 backdrop-blur-sm text-gray-400 hover:text-rose-500"
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isFavorite ? 'active' : 'inactive'}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                  </motion.div>
                </AnimatePresence>
                {(event.favoriteCount !== undefined && event.favoriteCount > 0) && (
                  <span className="text-xs font-bold">{event.favoriteCount}</span>
                )}
              </motion.button>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            <h3 className="text-white font-bold text-lg leading-tight">{event.title}</h3>
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Calendar size={14} className="text-brand-primary" />
              <span className={event.isRecurring ? "font-bold text-brand-secondary" : ""}>{displayDate}</span>
            </div>
            <a 
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-slate-500 text-sm hover:text-brand-primary transition-colors group"
            >
              <MapPin size={14} className="text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="underline decoration-brand-primary/30 underline-offset-2">{event.location}, {event.city}</span>
            </a>
          </div>
        
        <p className={cn("mt-4 text-slate-600 text-sm transition-all leading-relaxed", !showDetails && "line-clamp-2")}>{event.description}</p>
        
        <div className="mt-6 flex items-center justify-center text-slate-300">
          <ChevronRight size={20} className={cn("transition-transform duration-300", showDetails && "rotate-90")} />
        </div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-6 pt-6 border-t border-gray-100">
                {/* Comments Section */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle size={16} className="text-emerald-600" />
                    <h4 className="text-sm font-bold text-gray-900">Commentaires ({comments.length})</h4>
                  </div>

                  {auth.currentUser ? (
                    <form onSubmit={handlePostComment} className="flex gap-2 mb-6">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !newComment.trim()}
                        className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-100 disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  ) : (
                    <p className="text-[10px] text-gray-400 mb-6 italic">Connectez-vous pour laisser un commentaire.</p>
                  )}

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    {comments.length > 0 ? (
                      comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {comment.authorPhoto ? (
                              <img src={comment.authorPhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={14} className="text-emerald-600" />
                            )}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-gray-900">{comment.authorName}</span>
                              <span className="text-[10px] text-gray-400">
                                {format(new Date(comment.createdAt), 'HH:mm', { locale: fr })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{comment.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">Soyez le premier à commenter !</p>
                    )}
                  </div>
                </div>

                {/* Similar Events */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info size={16} className="text-emerald-600" />
                    <h4 className="text-sm font-bold text-gray-900">Événements similaires</h4>
                  </div>
                  
                  {similarEvents.length > 0 ? (
                    <div className="space-y-3">
                      {similarEvents.map(similar => (
                        <div key={similar.id} className="flex gap-3 items-center p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                          <img 
                            src={similar.imageUrl || `https://picsum.photos/seed/${similar.id}/100/100`} 
                            className="w-12 h-12 rounded-lg object-cover"
                            alt=""
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{similar.title}</p>
                            <p className="text-[10px] text-gray-500">{similar.city} • {similar.category}</p>
                          </div>
                          <ChevronRight size={14} className="text-gray-300" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucun événement similaire trouvé pour le moment.</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Share2 size={12} /> Partager
                  </span>
                  <div className="flex gap-3">
                    <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                      <Facebook size={14} />
                    </a>
                    <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center hover:bg-sky-500 hover:text-white transition-colors">
                      <Twitter size={14} />
                    </a>
                    <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors">
                      <MessageCircle size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Supprimer l'événement ?"
        message="Cette action est irréversible. Toutes les données liées à cet événement seront perdues."
        onConfirm={handleDeleteEvent}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />

      <AnimatePresence>
        {showImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={event.imageUrl || `https://picsum.photos/seed/${event.id}/800/600`}
              alt={event.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
