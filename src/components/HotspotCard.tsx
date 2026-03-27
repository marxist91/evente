import { MapPin, Star, Trash2, ChevronRight, Tag } from 'lucide-react';
import { Hotspot } from '../types';
import { useState } from 'react';
import { auth, db } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ConfirmDialog } from './ConfirmDialog';
import { cn } from '../lib/utils';
import { Reviews } from './Reviews';

interface HotspotCardProps {
  key?: string | number;
  hotspot: Hotspot;
}

export function HotspotCard({ hotspot }: HotspotCardProps) {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // For demo, we'll allow deletion if user is logged in
  const canDelete = !!auth.currentUser;

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'hotspots', hotspot.id));
      setIsConfirmDeleteOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `hotspots/${hotspot.id}`);
    }
  };

  return (
    <div className="bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 mb-6 relative hover:shadow-orange-500/10 transition-all duration-300">
      <div className="relative h-48 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
        <img
          src={hotspot.imageUrl || `https://picsum.photos/seed/${hotspot.id}/800/600`}
          alt={hotspot.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-[#0B0814]/90 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/10">
          <Star size={12} className="text-amber-500 fill-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">
            {hotspot.type}
          </span>
        </div>

        {canDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsConfirmDeleteOpen(true);
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#0B0814]/90 backdrop-blur-md text-purple-200/50 hover:text-rose-500 flex items-center justify-center transition-all shadow-lg border border-white/10"
          >
            <Trash2 size={18} />
          </button>
        )}

        {hotspot.rating && (
          <div className="absolute bottom-4 right-4 bg-[#0B0814]/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 text-white shadow-sm border border-white/10">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold">{hotspot.rating}</span>
          </div>
        )}
      </div>
      <div className="p-5 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
        <h3 className="text-lg font-black text-white leading-tight mb-2">{hotspot.name}</h3>
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotspot.location}, ${hotspot.city}, Togo`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-purple-200/70 text-sm mb-3 hover:text-purple-400 transition-colors group"
        >
          <MapPin size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
          <span className="underline decoration-purple-500/30 underline-offset-2">{hotspot.location}, {hotspot.city}</span>
        </a>
        <p className="text-purple-200/80 text-sm leading-relaxed line-clamp-2">{hotspot.description}</p>
        
        {showDetails && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <Reviews hotspotId={hotspot.id} />
          </div>
        )}

        <div className="mt-6 flex items-center justify-center text-purple-200/30">
          <ChevronRight size={20} className={cn("transition-transform duration-300", showDetails && "rotate-90")} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Supprimer le lieu ?"
        message="Voulez-vous vraiment supprimer ce lieu incontournable ? Cette action est définitive."
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
}
