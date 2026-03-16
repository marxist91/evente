import { MapPin, Star, Trash2 } from 'lucide-react';
import { Hotspot } from '../types';
import { useState } from 'react';
import { auth, db } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ConfirmDialog } from './ConfirmDialog';

interface HotspotCardProps {
  key?: string | number;
  hotspot: Hotspot;
}

export function HotspotCard({ hotspot }: HotspotCardProps) {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  
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
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4 relative">
      <div className="relative h-40">
        <img
          src={hotspot.imageUrl || `https://picsum.photos/seed/${hotspot.id}/800/600`}
          alt={hotspot.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
          <Star size={12} className="text-amber-500 fill-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-tight text-gray-700">
            {hotspot.type}
          </span>
        </div>

        {canDelete && (
          <button 
            onClick={() => setIsConfirmDeleteOpen(true)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm text-gray-400 hover:text-rose-600 flex items-center justify-center transition-all shadow-lg"
          >
            <Trash2 size={16} />
          </button>
        )}

        {hotspot.rating && (
          <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 text-white">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold">{hotspot.rating}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{hotspot.name}</h3>
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotspot.location}, ${hotspot.city}, Togo`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-500 text-sm mb-2 hover:text-emerald-600 transition-colors group"
        >
          <MapPin size={14} className="text-emerald-600 group-hover:scale-110 transition-transform" />
          <span className="underline decoration-emerald-500/30 underline-offset-2">{hotspot.location}, {hotspot.city}</span>
        </a>
        <p className="text-gray-600 text-sm line-clamp-2">{hotspot.description}</p>
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
