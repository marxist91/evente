import React, { useState } from 'react';
import { X, Upload, Calendar, MapPin, Tag, Type, AlignLeft, Loader2 } from 'lucide-react';
import { TogoCity, TOGO_CITIES, Event } from '../types';
import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: TogoCity;
}

export function AddEventModal({ isOpen, onClose, selectedCity }: AddEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '20:00',
    location: '',
    city: selectedCity,
    category: 'party' as Event['category'],
    isRecurring: false,
    recurringDay: 4, // Default to Thursday (4)
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) { // 800KB limit for Firestore document size
        alert("L'image est trop volumineuse (max 800Ko pour cette démo). Veuillez choisir une image plus petite.");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Veuillez vous connecter pour ajouter un événement.");
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
        imageUrl: imagePreview || '', // Base64 string
        authorUid: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        favoriteCount: 0,
      };

      if (formData.time) {
        eventData.time = formData.time;
      }

      if (formData.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurringDay = Number(formData.recurringDay);
      }

      await addDoc(collection(db, 'events'), eventData);
      onClose();
      // Reset form
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
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Ajouter un Événement</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Image de l'événement</label>
            <div 
              onClick={() => !loading && document.getElementById('event-image')?.click()}
              className={`relative aspect-video rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center ${!loading ? 'cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/30' : 'cursor-not-allowed opacity-70'} transition-all overflow-hidden`}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  {loading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <span className="text-sm font-bold">Téléchargement...</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Upload className="text-gray-300 mb-2" size={32} />
                  <span className="text-sm text-gray-400">Cliquez pour ajouter une photo</span>
                </>
              )}
              <input 
                id="event-image"
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageChange}
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Type size={14} /> Titre
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Soirée Blanche au Patio"
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <AlignLeft size={14} /> Description
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Décrivez l'événement..."
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
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
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            {/* Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                Heure
              </label>
              <input
                required
                type="time"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Recurring Event Toggle */}
          <div className="space-y-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 transition-all"
              />
              <span className="text-sm font-bold text-gray-700">Événement récurrent (chaque semaine)</span>
            </label>
            
            {formData.isRecurring && (
              <div className="pl-8 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Jour de la semaine</label>
                <select
                  value={formData.recurringDay}
                  onChange={e => setFormData({ ...formData, recurringDay: Number(e.target.value) })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <MapPin size={14} /> Lieu précis
            </label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Le Patio, Cité OUA"
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* City */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Ville</label>
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
            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Tag size={14} /> Catégorie
              </label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Event['category'] })}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Publication en cours...
              </>
            ) : 'Publier l\'événement'}
          </button>
        </form>
      </div>
    </div>
  );
}
