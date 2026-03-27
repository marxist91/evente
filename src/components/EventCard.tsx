import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, MapPin, Tag, Heart, Share2, Facebook, Twitter, MessageCircle, ChevronRight, Info, Send, Trash2, User as UserIcon, X, CalendarPlus, Pencil } from 'lucide-react';
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
  onView?: (event: Event) => void;
  onEdit?: (event: Event) => void;
}

export function EventCard({ event, isFavorite, onToggleFavorite, allEvents, onView, onEdit }: EventCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const mediaItems = useMemo(() => {
    if (event.media && event.media.length > 0) return event.media;
    if (event.imageUrl) return [{ type: 'image', url: event.imageUrl }];
    return [{ type: 'image', url: `https://picsum.photos/seed/${event.id}/800/600` }];
  }, [event]);

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
  try {
    if (event.isRecurring && event.recurringDay !== undefined) {
      displayDate = `Tous les ${dayNames[event.recurringDay]}`;
      if (event.time) {
        displayDate += ` à ${event.time}`;
      } else if (event.date && event.date.includes('T')) {
        const dateObj = new Date(event.date);
        if (!isNaN(dateObj.getTime()) && (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0)) {
          displayDate += ` à ${format(dateObj, "HH:mm")}`;
        }
      }
    } else {
      const dateObj = new Date(event.date);
      if (!isNaN(dateObj.getTime())) {
        displayDate = format(dateObj, "EEEE d MMMM", { locale: fr });
        if (event.time) {
          displayDate += ` à ${event.time}`;
        } else if (event.date && event.date.includes('T')) {
          if (dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0) {
            displayDate += ` à ${format(dateObj, "HH:mm")}`;
          }
        }
      } else {
        displayDate = 'Date non spécifiée';
      }
    }
  } catch (e) {
    displayDate = 'Date invalide';
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

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const dateObj = new Date(event.date);
    if (isNaN(dateObj.getTime())) {
      alert("La date de cet événement n'est pas valide.");
      return;
    }

    if (event.time) {
      const [hours, minutes] = event.time.split(':');
      dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    }

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startDate = formatDate(dateObj);
    const endDateObj = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000); // Assume 2 hours duration
    const endDate = formatDate(endDateObj);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Togo Vibes//FR',
      'BEGIN:VEVENT',
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location}, ${event.city}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const similarEvents = useMemo(() => {
    if (!allEvents) return [];
    return allEvents
      .filter(e => e.id !== event.id && (e.category === event.category || e.city === event.city))
      .slice(0, 3);
  }, [allEvents, event]);

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    const nextIndex = (currentMediaIndex + newDirection + mediaItems.length) % mediaItems.length;
    setCurrentMediaIndex(nextIndex);
  };

  return (
    <div className="event-card-wrapper">
      <div 
        className={cn("bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 mb-6 relative flex flex-col cursor-pointer transition-all duration-300 hover:shadow-orange-500/10", showDetails ? "shadow-md" : "")}
        onClick={() => {
          if (!showDetails && onView) {
            onView(event);
          }
          setShowDetails(!showDetails);
        }}
      >
        <div 
          className={cn("relative transition-all duration-500 group overflow-hidden", showDetails ? "h-72" : "h-48")}
          onClick={(e) => {
            if (showDetails) {
              e.stopPropagation();
              setShowImageModal(true);
            }
          }}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={currentMediaIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold) {
                  paginate(-1);
                }
              }}
            >
              {mediaItems[currentMediaIndex].type === 'image' ? (
                <img
                  src={mediaItems[currentMediaIndex].url}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <video
                  src={`${mediaItems[currentMediaIndex].url}#t=0.001`}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {mediaItems.length > 1 && (
            <>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {mediaItems.map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      currentMediaIndex === i ? "bg-white w-3" : "bg-white/40"
                    )}
                  />
                ))}
              </div>
              
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    paginate(-1);
                  }}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    paginate(1);
                  }}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          )}

          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none" />
          <div className="absolute top-4 left-4 bg-[#0B0814]/90 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/10">
            <Tag size={12} className="text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">
              {categoryLabels[event.category] || event.category}
            </span>
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2">
            {isOwner && (
              <>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(event);
                  }}
                  className="w-10 h-10 rounded-full bg-[#0B0814]/90 backdrop-blur-sm text-purple-200/50 hover:text-purple-400 flex items-center justify-center transition-all shadow-lg border border-white/10"
                  title="Modifier"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmDeleteOpen(true);
                  }}
                  className="w-10 h-10 rounded-full bg-[#0B0814]/90 backdrop-blur-sm text-purple-200/50 hover:text-rose-500 flex items-center justify-center transition-all shadow-lg border border-white/10"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </>
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
                  "h-10 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all shadow-xl z-10 border border-white/10",
                  isFavorite 
                    ? "bg-rose-500 text-white shadow-lg shadow-orange-500/40" 
                    : "bg-[#0B0814]/95 backdrop-blur-sm text-purple-200/50 hover:text-rose-500"
                )}
              >
                <motion.div
                  animate={isFavorite ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3, type: "tween" }}
                >
                  <Heart 
                    size={18} 
                    fill={isFavorite ? "currentColor" : "none"} 
                    className={cn("transition-colors duration-300", isFavorite ? "text-white" : "text-purple-200/50")}
                  />
                </motion.div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-200/70 text-sm">
                <Calendar size={14} className="text-purple-400" />
                <span className={event.isRecurring ? "font-bold text-purple-300" : ""}>{displayDate}</span>
              </div>
              <button 
                onClick={handleAddToCalendar}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg transition-colors border border-purple-500/20"
                title="Ajouter au calendrier"
              >
                <CalendarPlus size={14} />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>
            <a 
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-purple-200/70 text-sm hover:text-purple-400 transition-colors group"
            >
              <MapPin size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="underline decoration-purple-500/30 underline-offset-2">{event.location}, {event.city}</span>
            </a>
          </div>
        
        <p className={cn("mt-4 text-purple-200/80 text-sm transition-all leading-relaxed", !showDetails && "line-clamp-2")}>{event.description}</p>
        
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200/50 flex items-center gap-2">
            <Share2 size={12} /> Partager
          </span>
          <div className="flex gap-3">
            <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors border border-blue-500/30">
              <Facebook size={14} />
            </a>
            <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center hover:bg-sky-500 hover:text-white transition-colors border border-sky-500/30">
              <Twitter size={14} />
            </a>
            <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors border border-green-500/30">
              <MessageCircle size={14} />
            </a>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center text-purple-200/30">
          <ChevronRight size={20} className={cn("transition-transform duration-300", showDetails && "rotate-90")} />
        </div>
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
              <div className="mt-6 pt-6 border-t border-white/10">
                {/* Comments Section */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle size={16} className="text-purple-400" />
                    <h4 className="text-sm font-bold text-white">Commentaires ({comments.length})</h4>
                  </div>

                  {auth.currentUser ? (
                    <form onSubmit={handlePostComment} className="flex gap-2 mb-6">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 transition-all text-white placeholder:text-purple-200/40"
                      />
                      <button
                        type="submit"
                        disabled={isSubmitting || !newComment.trim()}
                        className="bg-purple-600 text-white p-2 rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  ) : (
                    <p className="text-[10px] text-purple-200/50 mb-6 italic">Connectez-vous pour laisser un commentaire.</p>
                  )}

                  <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    {comments.length > 0 ? (
                      comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 overflow-hidden border border-purple-500/30">
                            {comment.authorPhoto ? (
                              <img src={comment.authorPhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={14} className="text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-white">{comment.authorName}</span>
                              <span className="text-[10px] text-purple-200/50">
                                {(() => {
                                  try {
                                    const d = new Date(comment.createdAt);
                                    return isNaN(d.getTime()) ? '' : format(d, 'HH:mm', { locale: fr });
                                  } catch (e) {
                                    return '';
                                  }
                                })()}
                              </span>
                            </div>
                            <p className="text-xs text-purple-200/80 leading-relaxed">{comment.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-purple-200/50 text-center py-4">Soyez le premier à commenter !</p>
                    )}
                  </div>
                </div>

                {/* Similar Events */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Info size={16} className="text-purple-400" />
                    <h4 className="text-sm font-bold text-white">Événements similaires</h4>
                  </div>
                  
                  {similarEvents.length > 0 ? (
                    <div className="space-y-3">
                      {similarEvents.map(similar => (
                        <div key={similar.id} className="flex gap-3 items-center p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                          <img 
                            src={similar.imageUrl || `https://picsum.photos/seed/${similar.id}/100/100`} 
                            className="w-12 h-12 rounded-lg object-cover"
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{similar.title}</p>
                            <p className="text-[10px] text-purple-200/50">{similar.city} • {similar.category}</p>
                          </div>
                          <ChevronRight size={14} className="text-purple-200/30" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-purple-200/50 italic">Aucun événement similaire trouvé pour le moment.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-full max-h-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              {mediaItems[currentMediaIndex].type === 'image' ? (
                <img
                  src={mediaItems[currentMediaIndex].url}
                  alt={event.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <video
                  src={mediaItems[currentMediaIndex].url}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  controls
                  autoPlay
                  referrerPolicy="no-referrer"
                />
              )}
              
              {mediaItems.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                  {mediaItems.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentMediaIndex(i)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        currentMediaIndex === i ? "bg-white scale-125" : "bg-white/40"
                      )}
                    />
                  ))}
                </div>
              )}
            </motion.div>
            <button 
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
