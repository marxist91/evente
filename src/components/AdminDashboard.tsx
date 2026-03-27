import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Event, Moment, UserProfile, Feedback } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { Users, Calendar, Video, MessageSquare, Trash2, CheckCircle, XCircle, ShieldAlert, ChevronLeft, Search, Filter, X, Play } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'content' | 'feedback'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'event' | 'moment', id: string } | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'video' | 'image'} | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });
    const unsubEvents = onSnapshot(query(collection(db, 'events'), orderBy('createdAt', 'desc')), (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    });
    const unsubMoments = onSnapshot(query(collection(db, 'moments'), orderBy('createdAt', 'desc')), (snap) => {
      setMoments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Moment)));
    });
    const unsubFeedback = onSnapshot(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')), (snap) => {
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Feedback)));
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubEvents();
      unsubMoments();
      unsubFeedback();
    };
  }, []);

  const handleDeleteEvent = (id: string) => {
    setConfirmDelete({ type: 'event', id });
  };

  const handleDeleteMoment = (id: string) => {
    setConfirmDelete({ type: 'moment', id });
  };

  const confirmDeletion = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'event') {
        await deleteDoc(doc(db, 'events', confirmDelete.id));
      } else {
        await deleteDoc(doc(db, 'moments', confirmDelete.id));
      }
    } catch (error) {
      console.error("Erreur lors de la suppression :", error);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleUpdateFeedbackStatus = async (id: string, status: 'read' | 'resolved') => {
    await updateDoc(doc(db, 'feedback', id), { status });
  };

  const handleDisconnectUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { forceLogout: true });
    } catch (error) {
      console.error("Erreur lors de la déconnexion de l'utilisateur :", error);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: ShieldAlert },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'content', label: 'Contenu', icon: Calendar },
    { id: 'feedback', label: 'Retours', icon: MessageSquare },
  ] as const;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-6 pb-24"
      >
        <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </button>
        <h2 className="text-2xl font-black text-white tracking-tight">Dashboard Admin</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors",
              activeTab === tab.id 
                ? "bg-purple-600 text-white" 
                : "bg-white/5 text-white/50 hover:bg-white/10"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4">
              <Users size={24} />
            </div>
            <p className="text-3xl font-black text-white mb-1">{users.length}</p>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Utilisateurs</p>
          </div>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4">
              <Calendar size={24} />
            </div>
            <p className="text-3xl font-black text-white mb-1">{events.length}</p>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Événements</p>
          </div>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <div className="w-12 h-12 bg-pink-500/20 text-pink-400 rounded-2xl flex items-center justify-center mb-4">
              <Video size={24} />
            </div>
            <p className="text-3xl font-black text-white mb-1">{moments.length}</p>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Moments</p>
          </div>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
            <div className="w-12 h-12 bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare size={24} />
            </div>
            <p className="text-3xl font-black text-white mb-1">{feedbacks.length}</p>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Retours</p>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {users.map(user => (
            <div key={user.uid} className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
                  <div className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a]",
                    user.isOnline ? "bg-green-500" : "bg-white/20"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{user.displayName}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/70"
                    )}>
                      {user.role || 'user'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 truncate">{user.email}</p>
                </div>
                {user.isOnline && user.role !== 'admin' && (
                  <button 
                    onClick={() => handleDisconnectUser(user.uid)}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-500/30 transition-colors"
                  >
                    Déconnecter
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Dernière connexion</p>
                  <p className="text-xs text-white/70">
                    {user.lastLogin ? format(new Date(user.lastLogin), 'Pp', { locale: fr }) : 'Jamais'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">Dernière déconnexion</p>
                  <p className="text-xs text-white/70">
                    {user.lastLogout ? format(new Date(user.lastLogout), 'Pp', { locale: fr }) : 'N/A'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  user.isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-white/20"
                )} />
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  {user.isOnline ? "En ligne" : "Hors ligne"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'content' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-purple-400" />
              Derniers Événements
            </h3>
            <div className="space-y-4">
              {events.slice(0, 10).map(event => (
                <div 
                  key={event.id} 
                  className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => {
                    const url = event.imageUrl || `https://picsum.photos/seed/${event.id}/100/100`;
                    setSelectedMedia({url, type: 'image'});
                  }}
                >
                  <img src={event.imageUrl || `https://picsum.photos/seed/${event.id}/100/100`} alt={event.title} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{event.title}</h4>
                    <p className="text-xs text-white/50 truncate">{event.city} • {format(new Date(event.date), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                    className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Video size={20} className="text-pink-400" />
              Derniers Moments
            </h3>
            <div className="space-y-4">
              {moments.slice(0, 10).map(moment => (
                  <div 
                    key={moment.id} 
                    className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => {
                      console.log("Moment clicked:", moment);
                      setSelectedMedia({url: moment.url, type: moment.type === 'video' ? 'video' : 'image'});
                    }}
                  >
                  {moment.type === 'video' ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-black/50 flex-shrink-0">
                      <video 
                        src={`${moment.url}#t=0.001`} 
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        referrerPolicy="no-referrer"
                        onLoadedMetadata={(e) => {
                          e.currentTarget.currentTime = 0.1;
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play size={20} className="text-white/80" fill="currentColor" />
                      </div>
                    </div>
                  ) : (
                    <img 
                      src={moment.url} 
                      alt={moment.title} 
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{moment.title}</h4>
                    <p className="text-xs text-white/50 truncate">Par {moment.userName}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMoment(moment.id);
                    }}
                    className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {feedbacks.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>Aucun retour utilisateur pour le moment.</p>
            </div>
          ) : (
            feedbacks.map(feedback => (
              <div key={feedback.id} className={cn(
                "p-4 rounded-2xl border transition-colors",
                feedback.status === 'new' ? "bg-purple-500/10 border-purple-500/30" : "bg-white/5 border-white/10"
              )}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      feedback.type === 'bug' ? "bg-red-500/20 text-red-400" :
                      feedback.type === 'suggestion' ? "bg-purple-500/20 text-purple-400" :
                      "bg-blue-500/20 text-blue-400"
                    )}>
                      {feedback.type}
                    </span>
                    <span className="text-xs text-white/50">
                      {format(new Date(feedback.createdAt), 'dd MMM à HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {feedback.status === 'new' && (
                      <button 
                        onClick={() => handleUpdateFeedbackStatus(feedback.id, 'read')}
                        className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                        title="Marquer comme lu"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {feedback.status !== 'resolved' && (
                      <button 
                        onClick={() => handleUpdateFeedbackStatus(feedback.id, 'resolved')}
                        className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                        title="Marquer comme résolu"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm mb-3">{feedback.message}</p>
                <p className="text-xs text-white/40 font-medium">Par {feedback.userName}</p>
              </div>
            ))
          )}
        </div>
      )}

      </motion.div>

      <AnimatePresence>
        {selectedMedia && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedMedia(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] bg-black rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.type === 'video' ? (
                <VideoPlayer 
                  src={selectedMedia.url} 
                  className="max-w-full max-h-[80vh] object-contain" 
                  wrapperClassName="w-auto h-auto max-w-full max-h-[80vh]"
                  showControls={true} 
                />
              ) : (
                <img src={selectedMedia.url} alt="Media" className="max-w-full max-h-[80vh]" />
              )}
              <button 
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-[#0B0814]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#1A1525] rounded-3xl p-6 shadow-2xl border border-white/10 text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Confirmer la suppression</h3>
              <p className="text-purple-200/70 mb-6">
                Êtes-vous sûr de vouloir supprimer ce contenu ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeletion}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
