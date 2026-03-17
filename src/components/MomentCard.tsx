import React, { useState } from 'react';
import { Play, User, Trash2, Maximize2, X, MapPin } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { Moment } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { auth, db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

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

  return (
    <>
      <div 
        ref={ref}
        onClick={() => setIsFullscreen(true)}
        className={`relative aspect-[9/16] rounded-3xl overflow-hidden bg-slate-900 shadow-lg group cursor-pointer hover:shadow-2xl transition-all duration-300 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {inView ? (
          <VideoPlayer
            src={moment.videoUrl}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 animate-pulse flex flex-col justify-between p-5">
            <div className="w-28 h-8 bg-slate-700/50 rounded-full" />
            <div className="space-y-3">
              <div className="w-full h-4 bg-slate-700/50 rounded-md" />
              <div className="w-2/3 h-4 bg-slate-700/50 rounded-md" />
              <div className="w-1/3 h-3 bg-slate-700/50 rounded-md mt-4" />
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">
          <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center">
            <User size={12} className="text-slate-900" />
          </div>
          <span className="text-[10px] font-bold text-white">{moment.authorName}</span>
        </div>

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
            <div className="flex items-center gap-1.5 text-brand-primary text-[10px] font-bold uppercase tracking-widest">
              <Play size={10} fill="currentColor" />
              <span>{moment.city}</span>
              {moment.time && (
                <>
                  <span className="w-1 h-1 rounded-full bg-brand-primary/50" />
                  <span>{moment.time}</span>
                </>
              )}
            </div>
            {moment.locationName && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                <MapPin size={10} />
                <span className="truncate">{moment.locationName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center">
          <button 
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 z-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="relative w-full max-w-lg h-[90vh] md:h-[80vh] rounded-3xl overflow-hidden shadow-2xl">
            <VideoPlayer
              src={moment.videoUrl}
              className="w-full h-full object-contain bg-black"
              autoPlay
              loop
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center">
                  <User size={20} className="text-slate-900" />
                </div>
                <span className="text-sm font-bold text-white">{moment.authorName}</span>
              </div>
              <p className="text-white text-base font-medium mb-3">{moment.caption}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-brand-primary text-xs font-bold uppercase tracking-widest">
                  <Play size={12} fill="currentColor" />
                  <span>{moment.city}</span>
                  {moment.time && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-brand-primary/50" />
                      <span>{moment.time}</span>
                    </>
                  )}
                </div>
                {moment.locationName && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    <MapPin size={12} />
                    <span>{moment.locationName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
