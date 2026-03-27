import React, { useState } from 'react';
import { X, Upload, Calendar, MapPin, Tag, Type, AlignLeft, Loader2, Video, Trash2, Plus } from 'lucide-react';
import { TogoCity, TOGO_CITIES, Event, EventMedia } from '../types';
import { auth, db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: TogoCity;
  eventToEdit?: Event | null;
}

export function AddEventModal({ isOpen, onClose, selectedCity, eventToEdit }: AddEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: eventToEdit?.title || '',
    description: eventToEdit?.description || '',
    date: eventToEdit?.date ? eventToEdit.date.split('T')[0] : '',
    time: eventToEdit?.time || (eventToEdit?.date && eventToEdit.date.includes('T') ? eventToEdit.date.split('T')[1].substring(0, 5) : '20:00'),
    location: eventToEdit?.location || '',
    city: (eventToEdit?.city as TogoCity) || selectedCity,
    category: (eventToEdit?.category as Event['category']) || 'party',
    isRecurring: eventToEdit?.isRecurring || false,
    recurringDay: eventToEdit?.recurringDay !== undefined ? eventToEdit.recurringDay : 4,
  });
  const [mediaItems, setMediaItems] = useState<EventMedia[]>(eventToEdit?.media || (eventToEdit?.imageUrl ? [{ type: 'image', url: eventToEdit.imageUrl }] : []));
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  // Update form data when eventToEdit changes
  React.useEffect(() => {
    if (eventToEdit) {
      setFormData({
        title: eventToEdit.title,
        description: eventToEdit.description,
        date: eventToEdit.date.split('T')[0],
        time: eventToEdit.time || (eventToEdit.date.includes('T') ? eventToEdit.date.split('T')[1].substring(0, 5) : '20:00'),
        location: eventToEdit.location,
        city: eventToEdit.city as TogoCity,
        category: eventToEdit.category as Event['category'],
        isRecurring: eventToEdit.isRecurring || false,
        recurringDay: eventToEdit.recurringDay !== undefined ? eventToEdit.recurringDay : 4,
      });
      setMediaItems(eventToEdit.media || (eventToEdit.imageUrl ? [{ type: 'image', url: eventToEdit.imageUrl }] : []));
    } else {
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '20:00',
        location: '',
        city: selectedCity,
        category: 'party',
        isRecurring: false,
        recurringDay: 4,
      });
      setMediaItems([]);
    }
  }, [eventToEdit, selectedCity]);

  if (!isOpen) return null;

  const MAX_TOTAL_SIZE = 800 * 1024; // 800KB total limit for Firestore document

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Slightly more compression
            resolve(dataUrl);
          } else {
            reject(new Error("Could not get canvas context"));
          }
        };
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  };

  const processVideo = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 500 * 1024) {
        reject(new Error("La vidéo est trop volumineuse (max 500Ko)"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingMedia(true);
    try {
      const newItems: EventMedia[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const url = type === 'image' ? await processImage(file) : await processVideo(file);
          newItems.push({ type, url });
        } catch (err: any) {
          alert(err.message || "Erreur lors du traitement du fichier");
        }
      }
      setMediaItems(prev => [...prev, ...newItems]);
    } finally {
      setIsProcessingMedia(false);
      e.target.value = ''; // Reset input
    }
  };

  const removeMediaItem = (index: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Veuillez vous connecter pour ajouter un événement.");
      return;
    }

    if (mediaItems.length === 0) {
      alert("Veuillez ajouter au moins une affiche ou une vidéo.");
      return;
    }

    // Estimate total size
    const totalSize = mediaItems.reduce((acc, item) => acc + item.url.length, 0);
    if (totalSize > 1000000) { // ~1MB limit
      alert("Le contenu média total est trop volumineux. Veuillez réduire le nombre d'images ou de vidéos.");
      return;
    }

    setLoading(true);
    try {
      const dateString = formData.time ? `${formData.date}T${formData.time}` : formData.date;
      const parsedDate = new Date(dateString);
      
      const eventData: any = {
        title: formData.title,
        description: formData.description,
        date: isNaN(parsedDate.getTime()) ? formData.date : parsedDate.toISOString(),
        location: formData.location,
        city: formData.city,
        category: formData.category,
        imageUrl: mediaItems.find(m => m.type === 'image')?.url || mediaItems[0].url,
        media: mediaItems,
        authorUid: auth.currentUser.uid,
        favoriteCount: eventToEdit?.favoriteCount || 0,
      };

      if (!eventToEdit) {
        eventData.createdAt = new Date().toISOString();
      }

      if (formData.time) {
        eventData.time = formData.time;
      }

      if (formData.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurringDay = Number(formData.recurringDay);
      } else {
        eventData.isRecurring = false;
        eventData.recurringDay = null;
      }

      if (eventToEdit) {
        await updateDoc(doc(db, 'events', eventToEdit.id), eventData);
      } else {
        await addDoc(collection(db, 'events'), eventData);
      }
      
      onClose();
      if (!eventToEdit) {
        // Reset form only if adding new
        setFormData({
          title: '',
          description: '',
          date: '',
          time: '20:00',
          location: '',
          city: selectedCity,
          category: 'party',
          isRecurring: false,
          recurringDay: 4,
        });
        setMediaItems([]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, eventToEdit ? `events/${eventToEdit.id}` : 'events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B0814]/80 backdrop-blur-sm">
      <div className="bg-[#1A1525] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/10">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1525] sticky top-0 z-10">
          <h2 className="text-xl font-black text-white tracking-tight">
            {eventToEdit ? 'Modifier l\'Événement' : 'Ajouter un Événement'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-purple-200/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* Media Upload */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 block">Affiches et Vidéos (Instagram Style)</label>
            
            <div className="grid grid-cols-3 gap-3">
              {mediaItems.map((item, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <video src={`${item.url}#t=0.001`} className="w-full h-full object-cover" preload="metadata" referrerPolicy="no-referrer" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMediaItem(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[8px] font-bold text-white uppercase">
                    {item.type}
                  </div>
                </div>
              ))}
              
              {mediaItems.length < 5 && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isProcessingMedia}
                    onClick={() => document.getElementById('event-images-input')?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-purple-200/30"
                  >
                    {isProcessingMedia ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                    <span className="text-[8px] font-bold mt-1 uppercase">Image</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingMedia}
                    onClick={() => document.getElementById('event-videos-input')?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-purple-200/30"
                  >
                    {isProcessingMedia ? <Loader2 className="animate-spin" size={20} /> : <Video size={20} />}
                    <span className="text-[8px] font-bold mt-1 uppercase">Vidéo</span>
                  </button>
                </div>
              )}
            </div>
            
            <input 
              id="event-images-input"
              type="file" 
              accept="image/*" 
              multiple
              className="hidden" 
              onChange={(e) => handleMediaChange(e, 'image')}
            />
            <input 
              id="event-videos-input"
              type="file" 
              accept="video/*" 
              multiple
              className="hidden" 
              onChange={(e) => handleMediaChange(e, 'video')}
            />
            
            <p className="text-[10px] text-purple-200/30 italic">
              Ajoutez jusqu'à 5 éléments. Les vidéos doivent être courtes (&lt; 500Ko).
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
              <Type size={14} /> Titre
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Soirée Blanche au Patio"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-purple-200/30 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
              <AlignLeft size={14} /> Description
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Décrivez l'événement..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-purple-200/30 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
                <Calendar size={14} /> Date {formData.isRecurring && '(Première date)'}
              </label>
              <input
                required
                type="date"
                value={formData.date}
                onChange={e => {
                  const newDate = e.target.value;
                  const parsedDate = new Date(newDate);
                  const dayOfWeek = isNaN(parsedDate.getTime()) ? undefined : parsedDate.getDay();
                  setFormData({ ...formData, date: newDate, recurringDay: dayOfWeek });
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all [color-scheme:dark]"
              />
            </div>
            {/* Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
                Heure
              </label>
              <input
                required
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Recurring Event Toggle */}
          <div className="space-y-3 bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-5 h-5 text-purple-500 rounded border-white/20 bg-white/5 focus:ring-purple-500 focus:ring-offset-0 transition-all"
              />
              <span className="text-sm font-bold text-white">Événement récurrent (chaque semaine)</span>
            </label>
            
            {formData.isRecurring && (
              <div className="pl-8 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 block mb-2">Jour de la semaine</label>
                <select
                  value={formData.recurringDay}
                  onChange={e => setFormData({ ...formData, recurringDay: Number(e.target.value) })}
                  className="w-full bg-[#0B0814] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
                >
                  <option value={1}>Tous les Lundis</option>
                  <option value={2}>Tous les Mardis</option>
                  <option value={3}>Tous les Mercredis</option>
                  <option value={4}>Tous les Jeudis</option>
                  <option value={5}>Tous les Vendredis</option>
                  <option value={6}>Tous les Samedis</option>
                  <option value={0}>Tous les Dimanches</option>
                </select>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
              <MapPin size={14} /> Lieu précis
            </label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Le Patio, Cité OUA"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-purple-200/30 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* City */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50">Ville</label>
              <select
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value as TogoCity })}
                className="w-full bg-[#0B0814] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              >
                {TOGO_CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-200/50 flex items-center gap-2">
                <Tag size={14} /> Catégorie
              </label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Event['category'] })}
                className="w-full bg-[#0B0814] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              >
                <option value="party">Fête / Nightlife</option>
                <option value="culture">Culture / Expo</option>
                <option value="concert">Concert / Live</option>
                <option value="dance">Soirée dansante (Latines/Salons/Afro)</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/40 hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Publication en cours...
              </>
            ) : (eventToEdit ? 'Enregistrer les modifications' : 'Publier l\'événement')}
          </button>
        </form>
      </div>
    </div>
  );
}
