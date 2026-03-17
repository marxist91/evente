import React, { useState } from 'react';
import { X, Video, Type, MapPin, Upload, Loader2, Camera, Navigation, Check, Clock } from 'lucide-react';
import { TogoCity, TOGO_CITIES } from '../types';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { VideoPlayer } from './VideoPlayer';
import { VideoRecorder } from './VideoRecorder';

interface AddMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: TogoCity;
}

export function AddMomentModal({ isOpen, onClose, selectedCity }: AddMomentModalProps) {
  const [loading, setLoading] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);
  const [formData, setFormData] = useState({
    caption: '',
    city: selectedCity,
    locationName: '',
    time: '',
  });
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const MAX_FILE_SIZE = 700 * 1024; // 700KB limit for Firestore document size (Base64 adds ~33% overhead)

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`La vidéo est trop volumineuse (${Math.round(file.size/1024)}Ko). Le maximum est de 700Ko pour cette démo. Veuillez choisir une vidéo plus courte ou plus compressée.`);
        return;
      }
      setVideoFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const handleRecordingComplete = (file: File, previewUrl: string) => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`La vidéo enregistrée est trop volumineuse (${Math.round(file.size/1024)}Ko). Le maximum est de 700Ko. Veuillez enregistrer une vidéo plus courte (environ 5-10 secondes).`);
      setRecordingMode(false);
      return;
    }
    setVideoFile(file);
    setVideoPreview(previewUrl);
    setRecordingMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Veuillez vous connecter pour partager un moment.");
      return;
    }

    if (!videoFile) {
      alert("Veuillez sélectionner ou enregistrer une vidéo.");
      return;
    }

    setLoading(true);
    try {
      // Read video file as base64 string
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Video = reader.result as string;
        
        // Check if base64 string is too large for Firestore (1MB limit)
        if (base64Video.length > 1000000) {
          alert("La vidéo est trop volumineuse pour être sauvegardée. Veuillez réessayer avec une vidéo plus courte.");
          setLoading(false);
          return;
        }

        const momentData: any = {
          videoUrl: base64Video, // Storing base64 directly in Firestore
          caption: formData.caption,
          city: formData.city,
          authorUid: auth.currentUser!.uid,
          authorName: auth.currentUser!.displayName || 'Anonyme',
          createdAt: new Date().toISOString(),
        };

        if (formData.locationName) {
          momentData.locationName = formData.locationName;
        }
        if (formData.time) {
          momentData.time = formData.time;
        }
        if (coordinates) {
          momentData.coordinates = coordinates;
        }

        try {
          await addDoc(collection(db, 'moments'), momentData);
          onClose();
          // Reset
          setFormData({ caption: '', city: selectedCity, locationName: '', time: '' });
          setCoordinates(null);
          setVideoFile(null);
          setVideoPreview(null);
        } catch (err: any) {
          console.error("Erreur Firestore:", err);
          alert("Erreur lors de la publication. La vidéo est peut-être trop volumineuse pour la base de données.");
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
      alert("Une erreur inattendue est survenue.");
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        alert("Impossible de récupérer votre position. Veuillez vérifier vos permissions.");
        setIsLocating(false);
      }
    );
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

        <div className="p-6 overflow-y-auto space-y-6">
          {recordingMode ? (
            <VideoRecorder 
              onRecordingComplete={handleRecordingComplete} 
              onCancel={() => setRecordingMode(false)} 
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Video Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Vidéo du moment</label>
                <div 
                  onClick={() => !loading && document.getElementById('moment-video')?.click()}
                  className={`relative aspect-[9/16] max-h-[400px] mx-auto rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center ${!loading ? 'cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/5' : 'cursor-not-allowed opacity-70'} transition-all overflow-hidden bg-gray-50`}
                >
                  {videoPreview ? (
                    <>
                      <VideoPlayer 
                        src={videoPreview} 
                        className="w-full h-full object-cover"
                        autoPlay 
                        muted 
                        loop 
                      />
                      {loading && (
                        <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white backdrop-blur-md z-20">
                          <div className="relative flex items-center justify-center mb-4">
                            <svg className="animate-spin h-14 w-14 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                              <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <Video size={18} className="absolute text-white animate-pulse" />
                          </div>
                          <span className="text-sm font-bold tracking-wide">Traitement en cours...</span>
                          <span className="text-xs text-slate-300 mt-2 text-center px-6">Veuillez patienter pendant l'optimisation de votre moment.</span>
                        </div>
                      )}
                      {!loading && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVideoFile(null);
                              setVideoPreview(null);
                            }}
                            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-brand-primary/10 p-4 rounded-full mb-3">
                        <Upload className="text-brand-primary" size={32} />
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
                
                {!videoPreview && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs text-gray-400 font-medium uppercase">ou</span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                )}
                
                {!videoPreview && (
                  <button
                    type="button"
                    onClick={() => setRecordingMode(true)}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    <Camera size={18} />
                    Filmer directement
                  </button>
                )}
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
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none"
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
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all"
                >
                  {TOGO_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Exact Location */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <MapPin size={14} /> Lieu exact (Optionnel)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.locationName}
                    onChange={e => setFormData({ ...formData, locationName: e.target.value })}
                    placeholder="Ex: Plage de Lomé, Bar VIP..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Utiliser ma position actuelle"
                  >
                    {isLocating ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                  </button>
                </div>
                {coordinates && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-medium">
                    <Check size={12} /> Position GPS enregistrée
                  </p>
                )}
              </div>

              {/* Time */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Clock size={14} /> Heure (Optionnel)
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !videoFile}
                className="w-full bg-brand-primary text-slate-900 font-bold py-4 rounded-2xl shadow-lg shadow-brand-primary/20 hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
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
          )}
        </div>
      </div>
    </div>
  );
}
