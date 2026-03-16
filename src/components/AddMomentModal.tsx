import React, { useState } from 'react';
import { X, Video, Type, MapPin, Upload } from 'lucide-react';
import { TogoCity, TOGO_CITIES } from '../types';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AddMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: TogoCity;
}

export function AddMomentModal({ isOpen, onClose, selectedCity }: AddMomentModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    caption: '',
    city: selectedCity,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // 800KB limit for Firestore document size
        alert("La vidéo est trop volumineuse (max 800Ko pour cette démo). Veuillez choisir une vidéo plus courte ou plus compressée.");
        return;
      }
      setVideoFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Veuillez vous connecter pour partager un moment.");
      return;
    }

    if (!videoFile) {
      alert("Veuillez sélectionner une vidéo.");
      return;
    }

    setLoading(true);
    try {
      // Read video file as base64 string
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Video = reader.result as string;
        
        const momentData = {
          videoUrl: base64Video, // Storing base64 directly in Firestore
          caption: formData.caption,
          city: formData.city,
          authorUid: auth.currentUser!.uid,
          authorName: auth.currentUser!.displayName || 'Anonyme',
          createdAt: new Date().toISOString(),
        };

        try {
          await addDoc(collection(db, 'moments'), momentData);
          onClose();
          // Reset
          setFormData({ caption: '', city: selectedCity });
          setVideoFile(null);
          setVideoPreview(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'moments');
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        alert("Erreur lors de la lecture de la vidéo.");
        setLoading(false);
      };

      reader.readAsDataURL(videoFile);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Partager un Moment</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* Video Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Vidéo du moment</label>
            <div 
              onClick={() => document.getElementById('moment-video')?.click()}
              className="relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all overflow-hidden bg-gray-50"
            >
              {videoPreview ? (
                <video 
                  src={videoPreview} 
                  className="w-full h-full object-cover"
                  autoPlay 
                  muted 
                  loop 
                />
              ) : (
                <>
                  <div className="bg-emerald-100 p-4 rounded-full mb-3">
                    <Upload className="text-emerald-600" size={32} />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Sélectionner une vidéo</span>
                  <span className="text-xs text-gray-400 mt-1">Format vertical recommandé</span>
                </>
              )}
              <input 
                id="moment-video"
                type="file" 
                accept="video/*" 
                className="hidden" 
                onChange={handleVideoChange}
              />
            </div>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Type size={14} /> Légende
            </label>
            <textarea
              required
              rows={2}
              value={formData.caption}
              onChange={e => setFormData({ ...formData, caption: e.target.value })}
              placeholder="Décrivez ce moment incroyable..."
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <MapPin size={14} /> Ville
            </label>
            <select
              value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value as TogoCity })}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              {TOGO_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !videoFile}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publication...
              </>
            ) : (
              <>
                <Video size={20} />
                Publier le Moment
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
