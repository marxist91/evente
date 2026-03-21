import { useState, useEffect, useMemo } from 'react';
import { auth, db, requestNotificationPermission } from './firebase';
import Fuse from 'fuse.js';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  limit
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart,
  Sparkles, 
  Plus, 
  Search, 
  Video, 
  Image as ImageIcon,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPin,
  CalendarX,
  SearchX
} from 'lucide-react';

import { Navigation } from './components/Navigation';
import { CitySelector } from './components/CitySelector';
import { EventCard } from './components/EventCard';
import { MomentCard } from './components/MomentCard';
import { TogoCity, Event, Moment, Hotspot } from './types';
import { generateEventPoster, getEventsInfo, generateVeoVideo } from './services/ai';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HotspotCard } from './components/HotspotCard';
import { AddEventModal } from './components/AddEventModal';
import { AddMomentModal } from './components/AddMomentModal';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, loading, error] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedCity, setSelectedCity] = useState<TogoCity>('Lomé');
  const [events, setEvents] = useState<Event[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'relevance' | 'favorites'>('relevance');
  const [eventsLimit, setEventsLimit] = useState(20);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isMomentsLoading, setIsMomentsLoading] = useState(true);
  const [isHotspotsLoading, setIsHotspotsLoading] = useState(true);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(e => e.category === selectedCategory);
    }

    // Search query
    if (searchQuery) {
      const fuse = new Fuse(result, {
        keys: ['title', 'description'],
        threshold: 0.4,
        includeScore: true
      });
      result = fuse.search(searchQuery).map(res => res.item);
    }

    // Sorting
    if (sortBy === 'date') {
      result.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeA - timeB;
      });
    } else if (sortBy === 'favorites') {
      result.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
    }

    return result;
  }, [events, searchQuery, selectedCategory, sortBy]);

  // Sync User Profile
  useEffect(() => {
    if (user) {
      const syncProfile = async () => {
        const userRef = doc(db, 'users', user.uid);
        try {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || 'Utilisateur',
            email: user.email,
            photoURL: user.photoURL,
            role: 'user'
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      };
      syncProfile();
    }
  }, [user]);

  // Request Notification Permission
  useEffect(() => {
    if (user && selectedCity) {
      requestNotificationPermission(user.uid, selectedCity);
    }
  }, [user, selectedCity]);

  // Fetch Events
  useEffect(() => {
    setIsEventsLoading(true);
    const path = 'events';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      eventsData = eventsData.filter(e => {
        const eventDate = new Date(e.date);
        if (isNaN(eventDate.getTime())) return true;
        
        const eventDay = new Date(eventDate);
        eventDay.setHours(0, 0, 0, 0);
        return eventDay.getTime() >= now.getTime();
      });

      if (eventsData.length > eventsLimit) {
        setHasMoreEvents(true);
        setEvents(eventsData.slice(0, eventsLimit));
      } else {
        setHasMoreEvents(false);
        setEvents(eventsData);
      }
      setIsEventsLoading(false);
    }, (err) => {
      setIsEventsLoading(false);
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [selectedCity, eventsLimit]);

  // Fetch Moments
  useEffect(() => {
    setIsMomentsLoading(true);
    const path = 'moments';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const momentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Moment[];
      setMoments(momentsData);
      setIsMomentsLoading(false);
    }, (err) => {
      setIsMomentsLoading(false);
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [selectedCity]);

  // Fetch Hotspots
  useEffect(() => {
    setIsHotspotsLoading(true);
    const path = 'hotspots';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hotspotsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Hotspot[];
      setHotspots(hotspotsData);
      setIsHotspotsLoading(false);
    }, (err) => {
      setIsHotspotsLoading(false);
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [selectedCity]);

  // Fetch Favorites
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }

    const path = `users/${user.uid}/favorites`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const favIds = snapshot.docs.map(doc => doc.id);
      setFavorites(favIds);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsAiLoading(true);
    try {
      const res = await getEventsInfo(selectedCity, searchQuery);
      setAiResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleToggleFavorite = async (eventId: string) => {
    if (!user) return;
    
    const isFav = favorites.includes(eventId);
    const favRef = doc(db, 'users', user.uid, 'favorites', eventId);
    const eventRef = doc(db, 'events', eventId);
    const eventData = events.find(e => e.id === eventId);
    
    try {
      const batch = writeBatch(db);
      if (isFav) {
        batch.delete(favRef);
        batch.update(eventRef, { favoriteCount: increment(-1) });
      } else {
        batch.set(favRef, { 
          eventId, 
          createdAt: new Date().toISOString() 
        });
        batch.update(eventRef, { favoriteCount: increment(1) });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/favorites/${eventId}`);
    }
  };

  const handleSeedData = async () => {
    const sampleEvents = [
      {
        title: "Soirée Afrobeat au Vivina",
        description: "Venez vibrer au rythme de l'Afrobeat avec les meilleurs DJs de Lomé.",
        date: new Date(Date.now() + 86400000).toISOString(),
        location: "Vivina Club",
        city: "Lomé",
        category: "party",
        authorUid: user?.uid,
        createdAt: new Date().toISOString()
      },
      {
        title: "Festival des Arts de Kara",
        description: "Une célébration de la culture Kabyè avec danses traditionnelles et artisanat.",
        date: new Date(Date.now() + 172800000).toISOString(),
        location: "Palais des Congrès",
        city: "Kara",
        category: "culture",
        authorUid: user?.uid,
        createdAt: new Date().toISOString()
      },
      {
        title: "Concert de Toofan à Kpalimé",
        description: "Le groupe mythique Toofan en concert exceptionnel au pied du Mont Agou.",
        date: new Date(Date.now() + 259200000).toISOString(),
        location: "Stade Municipal",
        city: "Kpalimé",
        category: "concert",
        authorUid: user?.uid,
        createdAt: new Date().toISOString()
      }
    ];

    for (const event of sampleEvents) {
      try {
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        if (!response.ok) throw new Error('Failed to add event via API');
      } catch (err) {
        console.error('Error adding event:', err);
      }
    }
    alert("Données initiales ajoutées et notifications envoyées !");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-8 text-center">
        <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-8">
          <Sparkles className="text-emerald-600" size={48} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">TOGO EVENTS</h1>
        <p className="text-gray-500 mb-12 max-w-xs">
          Découvrez les meilleures soirées et événements culturels au Togo.
        </p>
        <button
          onClick={handleLogin}
          className="w-full max-w-xs bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-gray-200 hover:bg-black transition-all"
        >
          Se connecter avec Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white px-6 pt-10 pb-6 sticky top-0 z-40 border-b border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em]">Bienvenue au Togo</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Salut, {user.displayName?.split(' ')[0]} 👋</h1>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
        <CitySelector selectedCity={selectedCity} setSelectedCity={setSelectedCity} />
      </header>

      <main className="px-6 pt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {/* Search AI */}
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2">Besoin d'idées ?</h2>
                  <p className="text-slate-400 text-sm mb-6">Demandez à notre IA de trouver les coins chauds à {selectedCity}.</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Où danser ce soir ?"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (aiResponse) setAiResponse(null);
                      }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white/10 text-white placeholder:text-slate-500"
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={isAiLoading}
                      className="bg-brand-primary text-slate-900 p-3 rounded-2xl hover:bg-emerald-400 transition-colors"
                    >
                      {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                  </div>
                  {aiResponse && (
                    <div className="mt-6 p-5 bg-white/5 rounded-2xl text-sm border border-white/10">
                      <p className="leading-relaxed text-slate-200 whitespace-pre-wrap">{aiResponse.text}</p>
                    </div>
                  )}
                </div>
                <Sparkles className="absolute -right-6 -bottom-6 text-white/5" size={160} />
              </div>

              {/* Featured Events */}
              <section>
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {searchQuery ? 'Résultats de recherche' : 'À ne pas manquer'}
                  </h2>
                  {!searchQuery && (
                    <button onClick={() => setActiveTab('events')} className="text-brand-primary text-xs font-bold uppercase tracking-wider hover:text-brand-secondary transition-colors">Tout voir</button>
                  )}
                </div>

                {/* AI Recommended Places */}
                {searchQuery && (aiResponse?.places?.length > 0 || aiResponse?.grounding?.some((c: any) => c.maps)) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Sparkles size={18} className="text-brand-primary" />
                      Lieux recommandés par l'IA
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiResponse.places?.length > 0 ? (
                        aiResponse.places.map((place: any, i: number) => (
                          <a 
                            key={i}
                            href={place.mapsUrl || '#'}
                            target={place.mapsUrl ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                            className="group block bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300"
                          >
                            <div className="h-48 relative overflow-hidden bg-slate-100">
                              <img 
                                src={place.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/400`} 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/400`;
                                }}
                                alt={place.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                              <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h4 className="font-black text-xl leading-tight mb-1">{place.name}</h4>
                                {place.mapsUrl && (
                                  <div className="flex items-center gap-1 text-xs font-medium text-brand-primary mb-2">
                                    <MapPin size={12} />
                                    <span>Voir sur Google Maps</span>
                                  </div>
                                )}
                                <p className="text-sm text-slate-200 line-clamp-2">{place.description}</p>
                              </div>
                            </div>
                          </a>
                        ))
                      ) : (
                        aiResponse.grounding?.filter((c: any) => c.maps).map((chunk: any, i: number) => (
                          <a 
                            key={i}
                            href={chunk.maps.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300"
                          >
                            <div className="h-40 relative overflow-hidden bg-slate-100">
                              <img 
                                src={`https://picsum.photos/seed/${encodeURIComponent(chunk.maps.title)}/800/400`} 
                                alt={chunk.maps.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                              <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h4 className="font-black text-lg leading-tight mb-1">{chunk.maps.title}</h4>
                                <div className="flex items-center gap-1 text-xs font-medium text-brand-primary">
                                  <MapPin size={12} />
                                  <span>Voir sur Google Maps</span>
                                </div>
                              </div>
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Filtered Events */}
                {filteredEvents.length > 0 ? (
                  <>
                    {searchQuery && <h3 className="text-lg font-bold text-slate-800 mb-4">Événements correspondants</h3>}
                    {filteredEvents.slice(0, searchQuery ? 10 : 3).map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        isFavorite={favorites.includes(event.id)}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </>
                ) : (
                  (!aiResponse || (!aiResponse.places?.length && !aiResponse.grounding?.some((c: any) => c.maps))) && (
                    <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <SearchX size={40} className="text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun résultat</h3>
                      <p className="text-slate-500 max-w-md mx-auto">
                        Nous n'avons trouvé aucun événement pour "{searchQuery}". Essayez avec d'autres mots-clés.
                      </p>
                    </div>
                  )
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'events' && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Événements</h2>
                <button 
                  onClick={() => setIsAddEventOpen(true)}
                  className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-100"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Filters & Sort */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['all', 'culture', 'party', 'concert', 'dance', 'other'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                        selectedCategory === cat
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100"
                          : "bg-white text-gray-400 border border-gray-100 hover:border-emerald-200"
                      )}
                    >
                      {cat === 'all' ? 'Tous' : cat === 'party' ? 'Soirées' : cat === 'culture' ? 'Culture' : cat === 'concert' ? 'Concerts' : cat === 'dance' ? 'Danses (Latines/Afro)' : 'Autres'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="relative flex-1 mr-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="relevance">Pertinence</option>
                    <option value="date">Date</option>
                    <option value="favorites">Populaires</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {isEventsLoading ? (
                  <>
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                  </>
                ) : filteredEvents.length > 0 ? (
                  <>
                    {filteredEvents.map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        isFavorite={favorites.includes(event.id)}
                        onToggleFavorite={handleToggleFavorite}
                        allEvents={events}
                      />
                    ))}
                    {hasMoreEvents && (
                      <button
                        onClick={() => setEventsLimit(prev => prev + 5)}
                        className="w-full py-4 mt-4 bg-white border-2 border-emerald-100 text-emerald-600 font-bold rounded-2xl hover:bg-emerald-50 transition-colors"
                      >
                        Charger plus
                      </button>
                    )}
                  </>
                ) : (
                  <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <CalendarX size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Aucun événement trouvé</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                      Nous n'avons trouvé aucun événement correspondant à vos critères. Essayez de modifier vos filtres ou de chercher dans une autre ville.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'moments' && (
            <motion.div
              key="moments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Moments Direct</h2>
                <button 
                  onClick={() => setIsAddMomentOpen(true)}
                  className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-100"
                >
                  <Video size={20} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isMomentsLoading ? (
                  <>
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                  </>
                ) : moments.map(moment => (
                  <MomentCard key={moment.id} moment={moment} />
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'hotspots' && (
            <motion.div
              key="hotspots"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Hotspots {selectedCity}</h2>
                <button 
                  onClick={async () => {
                    if (!user) {
                      alert("Veuillez vous connecter pour ajouter des hotspots.");
                      return;
                    }
                    const sampleHotspots = [
                      {
                        name: "Bistrot de la Mer",
                        description: "Le meilleur poisson braisé de la côte avec vue sur l'océan.",
                        type: "restaurant",
                        location: "Zone Portuaire",
                        city: "Lomé",
                        rating: 4.8,
                        createdAt: new Date().toISOString()
                      },
                      {
                        name: "Le Patio",
                        description: "Un bar lounge chic pour vos soirées entre amis.",
                        type: "bar",
                        location: "Cité OUA",
                        city: "Lomé",
                        rating: 4.5,
                        createdAt: new Date().toISOString()
                      },
                      {
                        name: "Coco Beach",
                        description: "Détente et cocktails sur le sable fin.",
                        type: "beach",
                        location: "Route d'Aného",
                        city: "Lomé",
                        rating: 4.7,
                        createdAt: new Date().toISOString()
                      }
                    ];
                    try {
                      for (const h of sampleHotspots) {
                        await addDoc(collection(db, 'hotspots'), h);
                      }
                      alert("Hotspots ajoutés !");
                    } catch (err) {
                      handleFirestoreError(err, OperationType.WRITE, 'hotspots');
                    }
                  }}
                  className="bg-emerald-600 text-white p-2 rounded-xl shadow-lg shadow-emerald-100"
                >
                  <Plus size={20} />
                </button>
              </div>
              {isHotspotsLoading ? (
                <div className="grid grid-cols-1 gap-4">
                  <SkeletonHotspotCard />
                  <SkeletonHotspotCard />
                  <SkeletonHotspotCard />
                </div>
              ) : hotspots.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {hotspots.map(hotspot => (
                    <HotspotCard key={hotspot.id} hotspot={hotspot} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                  <MapIcon className="mx-auto text-gray-200 mb-4" size={48} />
                  <p className="text-gray-400 text-sm">Aucun hotspot répertorié pour cette ville.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Mes Favoris</h2>
              </div>
              {events.filter(e => favorites.includes(e.id)).length > 0 ? (
                events.filter(e => favorites.includes(e.id)).map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                  <Heart className="mx-auto text-gray-200 mb-4" size={48} />
                  <p className="text-gray-400 text-sm">Vous n'avez pas encore d'événements favoris.</p>
                  <button 
                    onClick={() => setActiveTab('events')}
                    className="mt-4 text-emerald-600 font-bold text-sm"
                  >
                    Découvrir les événements
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Studio Créatif</h2>
              
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Générateur d'Affiches</h3>
                    <p className="text-xs text-gray-500">Créez des visuels uniques avec Gemini</p>
                  </div>
                </div>
                <button 
                  onClick={() => alert("Fonctionnalité de génération d'affiche bientôt disponible !")}
                  className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm"
                >
                  Essayer maintenant
                </button>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Animation Veo</h3>
                    <p className="text-xs text-gray-500">Animez vos photos en vidéos de 5s</p>
                  </div>
                </div>
                <button 
                  onClick={() => alert("Fonctionnalité Veo bientôt disponible !")}
                  className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold text-sm"
                >
                  Essayer maintenant
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center pt-12"
            >
              <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto mb-4 overflow-hidden border-4 border-white shadow-lg">
                <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">{user.displayName}</h2>
              <p className="text-gray-500 text-sm mb-8">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                  <p className="text-2xl font-black text-emerald-600">{events.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Événements</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                  <p className="text-2xl font-black text-emerald-600">{moments.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Moments</p>
                </div>
              </div>

              {user.email === 'marxist1991@gmail.com' && (
                <button 
                  onClick={handleSeedData}
                  className="bg-gray-100 text-gray-600 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest mb-4"
                >
                  Générer des données de test
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <AddEventModal 
        isOpen={isAddEventOpen} 
        onClose={() => setIsAddEventOpen(false)} 
        selectedCity={selectedCity}
      />

      <AddMomentModal 
        isOpen={isAddMomentOpen} 
        onClose={() => setIsAddMomentOpen(false)} 
        selectedCity={selectedCity}
      />
    </div>
  );
}

function SkeletonEventCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4 animate-pulse">
      <div className="h-48 bg-gray-200"></div>
      <div className="p-4">
        <div className="flex flex-col gap-2 mb-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="mt-4 h-8 bg-gray-100 rounded-xl w-full"></div>
      </div>
    </div>
  );
}

function SkeletonMomentCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse h-48">
      <div className="w-full h-full bg-gray-200"></div>
    </div>
  );
}

function SkeletonHotspotCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4 animate-pulse flex">
      <div className="w-24 h-24 bg-gray-200 shrink-0"></div>
      <div className="p-3 flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    </div>
  );
}
