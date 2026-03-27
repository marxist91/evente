import React, { useState } from 'react';
import { Play, User, Trash2, Maximize2, X, MapPin, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'motion/react';
import { Moment } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { auth, db } from '../firebase';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { MomentComments } from './MomentComments';
import { cn } from '../lib/utils';

interface MomentCardProps {
  key?: string | number;
  moment: Moment;
}

export function MomentCard({ moment }: MomentCardProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px 0px',
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer ce moment ?")) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'moments', moment.id));
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression.");
        setIsDeleting(false);
      }
    }
  };

  const isOwner = auth.currentUser?.uid === moment.authorUid;
  const currentUserId = auth.currentUser?.uid;
  const isLiked = currentUserId ? moment.likedBy?.includes(currentUserId) : false;
  const likesCount = moment.likesCount || 0;
  const commentsCount = moment.commentsCount || 0;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      alert("Veuillez vous connecter pour aimer ce moment.");
      return;
    }
    
    const momentRef = doc(db, 'moments', moment.id);
    try {
      if (isLiked) {
        await updateDoc(momentRef, {
          likedBy: arrayRemove(currentUserId),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(momentRef, {
          likedBy: arrayUnion(currentUserId),
          likesCount: increment(1)
        });
      }
    } catch (error) {
      console.error("Erreur lors du like:", error);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Moment de ${moment.authorName}`,
          text: moment.caption || 'Découvrez ce moment !',
          url: window.location.href,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError' && !error.message?.includes('canceled')) {
          console.error("Erreur de partage:", error);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Lien copié dans le presse-papiers !");
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div 
        ref={ref}
        onClick={() => setIsFullscreen(true)}
        className={`relative aspect-[9/16] rounded-3xl overflow-hidden bg-[#0B0814] shadow-lg group cursor-pointer hover:shadow-orange-500/10 transition-all duration-300 border border-white/10 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {inView ? (
          <VideoPlayer
            src={moment.videoUrl}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
            showControls={true}
          />
        ) : (
          <div className="w-full h-full bg-[#1A1525] animate-pulse flex flex-col justify-between p-5">
            <div className="w-28 h-8 bg-white/5 rounded-full" />
            <div className="space-y-3">
              <div className="w-full h-4 bg-white/5 rounded-md" />
              <div className="w-2/3 h-4 bg-white/5 rounded-md" />
              <div className="w-1/3 h-3 bg-white/5 rounded-md mt-4" />
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0814]/90 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#0B0814]/50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-white/10">
          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
            <User size={12} className="text-purple-400" />
          </div>
          <span className="text-[10px] font-bold text-white">{moment.authorName}</span>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
          className={`absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100 ${isOwner ? 'mr-10' : ''}`}
          title="Plein écran"
        >
          <Maximize2 size={16} />
        </button>

        {isOwner && (
          <button 
            onClick={handleDelete}
            className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        )}

        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-white text-sm font-medium line-clamp-2 mb-2 leading-relaxed">{moment.caption}</p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
              <Play size={10} fill="currentColor" />
              <span>{moment.city}</span>
              {moment.time && (
                <>
                  <span className="w-1 h-1 rounded-full bg-purple-500/50" />
                  <span>{moment.time}</span>
                </>
              )}
            </div>
            {moment.locationName && (
              <div className="flex items-center gap-1.5 text-purple-300 text-[10px] font-bold uppercase tracking-widest">
                <MapPin size={10} />
                <span className="truncate">{moment.locationName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1.5 transition-all",
              isLiked ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'text-purple-200/50 hover:text-rose-500'
            )}
          >
            <motion.div
              animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, type: "tween" }}
            >
              <Heart size={20} fill={isLiked ? "currentColor" : "none"} className="transition-colors duration-300" />
            </motion.div>
            <span className="text-sm font-medium">{likesCount}</span>
          </motion.button>
          <button 
            onClick={handleComment}
            className="flex items-center gap-1.5 text-purple-200/50 hover:text-purple-400 transition-colors"
          >
            <MessageCircle size={20} />
            <span className="text-sm font-medium">{commentsCount}</span>
          </button>
        </div>
        <button 
          onClick={handleShare}
          className="flex items-center gap-1.5 text-purple-200/50 hover:text-purple-400 transition-colors"
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[200] bg-[#0B0814]/95 backdrop-blur-xl flex items-center justify-center">
          <button 
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors border border-white/10"
          >
            <X size={24} />
          </button>
          
          <div className="relative w-full max-w-lg h-[90vh] md:h-[80vh] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <VideoPlayer
              src={moment.videoUrl}
              className="w-full h-full object-contain bg-black"
              autoPlay
              loop
              showControls={true}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0B0814]/90 to-transparent p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <User size={20} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-white">{moment.authorName}</span>
              </div>
              <p className="text-white text-base font-medium mb-3">{moment.caption}</p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold uppercase tracking-widest">
                  <Play size={12} fill="currentColor" />
                  <span>{moment.city}</span>
                  {moment.time && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-purple-500/50" />
                      <span>{moment.time}</span>
                    </>
                  )}
                </div>
                {moment.locationName && (
                  <div className="flex items-center gap-1.5 text-purple-300 text-xs font-bold uppercase tracking-widest">
                    <MapPin size={12} />
                    <span>{moment.locationName}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-6">
                  <motion.button 
                    whileTap={{ scale: 0.8 }}
                    onClick={handleLike}
                    className={cn(
                      "flex items-center gap-2 transition-all",
                      isLiked ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]' : 'text-white hover:text-rose-500'
                    )}
                  >
                    <motion.div
                      animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                      transition={{ duration: 0.3, type: "tween" }}
                    >
                      <Heart size={24} fill={isLiked ? "currentColor" : "none"} className="transition-colors duration-300" />
                    </motion.div>
                    <span className="text-base font-medium">{likesCount}</span>
                  </motion.button>
                  <button 
                    onClick={handleComment}
                    className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors"
                  >
                    <MessageCircle size={24} />
                    <span className="text-base font-medium">{commentsCount}</span>
                  </button>
                </div>
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 text-white hover:text-purple-400 transition-colors"
                >
                  <Share2 size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && (
          <MomentComments 
            momentId={moment.id} 
            onClose={() => setShowComments(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
