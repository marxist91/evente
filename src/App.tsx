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
  Map as MapIcon
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
  const [eventsLimit, setEventsLimit] = useState(5);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);

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
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    const path = 'events';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('date', 'asc'),
      limit(eventsLimit + 1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      
      if (eventsData.length > eventsLimit) {
        setHasMoreEvents(true);
        setEvents(eventsData.slice(0, eventsLimit));
      } else {
        setHasMoreEvents(false);
        setEvents(eventsData);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [selectedCity, eventsLimit]);

  // Fetch Moments
  useEffect(() => {
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
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [selectedCity]);

  // Fetch Hotspots
  useEffect(() => {
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
    }, (err) => {
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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-4 sticky top-0 z-40 border-b border-gray-50">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Bienvenue au Togo</p>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Salut, {user.displayName?.split(' ')[0]} 👋</h1>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <LogOut size={18} />
          </button>
        </div>
        <CitySelector selectedCity={selectedCity} setSelectedCity={setSelectedCity} />
      </header>

      <main className="px-6 pt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Search AI */}
              <div className="bg-emerald-900 rounded-3xl p-6 text-white shadow-2xl shadow-emerald-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-2">Besoin d'idées ?</h2>
                  <p className="text-emerald-100 text-sm mb-4">Demandez à notre IA de trouver les coins chauds à {selectedCity}.</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Où danser ce soir ?"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (aiResponse) setAiResponse(null);
                      }}
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:bg-white/20"
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={isAiLoading}
                      className="bg-white text-emerald-900 p-2 rounded-xl"
                    >
                      {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                  </div>
                  {aiResponse && (
                    <div className="mt-4 p-4 bg-white/10 rounded-2xl text-sm border border-white/10">
                      <p className="leading-relaxed">{aiResponse.text}</p>
                      {aiResponse.grounding && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex gap-2 overflow-x-auto">
                          {aiResponse.grounding.map((chunk: any, i: number) => (
                            chunk.maps && (
                              <a 
                                key={i} 
                                href={chunk.maps.uri} 
                                target="_blank" 
                                className="text-[10px] bg-emerald-500/30 px-2 py-1 rounded-full whitespace-nowrap"
                              >
                                📍 {chunk.maps.title || 'Voir sur Maps'}
                              </a>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Sparkles className="absolute -right-4 -bottom-4 text-white/5" size={120} />
              </div>

              {/* Featured Events */}
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {searchQuery ? 'Résultats de recherche' : 'À ne pas manquer'}
                  </h2>
                  {!searchQuery && (
                    <button onClick={() => setActiveTab('events')} className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Tout voir</button>
                  )}
                </div>
                {filteredEvents.length > 0 ? (
                  filteredEvents.slice(0, searchQuery ? 10 : 3).map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      isFavorite={favorites.includes(event.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                ) : (
                  <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">Aucun événement trouvé pour "{searchQuery}".</p>
                  </div>
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
                {filteredEvents.length > 0 ? (
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
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">Aucun événement ne correspond à vos critères.</p>
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
                {moments.map(moment => (
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
              {hotspots.length > 0 ? (
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
