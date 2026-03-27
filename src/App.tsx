import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
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
  updateDoc,
  getDoc,
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
  Calendar,
  CalendarX,
  SearchX,
  Bell,
  BellOff,
  X,
  ShieldAlert,
  MessageSquare,
  Filter,
  TrendingUp,
  ChevronDown,
  Clock
} from 'lucide-react';

import { Navigation } from './components/Navigation';
import { CitySelector } from './components/CitySelector';
import { TogoCity, TOGO_CITIES, Event, Moment, Hotspot, UserProfile } from './types';
import { generateEventPoster, getEventsInfo, generateVeoVideo, filterEventsWithAI } from './services/ai';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { ErrorBoundary } from './components/ErrorBoundary';

const EventCard = lazy(() => import('./components/EventCard').then(m => ({ default: m.EventCard })));
const MomentCard = lazy(() => import('./components/MomentCard').then(m => ({ default: m.MomentCard })));
const HotspotCard = lazy(() => import('./components/HotspotCard').then(m => ({ default: m.HotspotCard })));
const AddEventModal = lazy(() => import('./components/AddEventModal').then(m => ({ default: m.AddEventModal })));
const AddMomentModal = lazy(() => import('./components/AddMomentModal').then(m => ({ default: m.AddMomentModal })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const FeedbackModal = lazy(() => import('./components/FeedbackModal').then(m => ({ default: m.FeedbackModal })));

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
  const [momentsCityFilter, setMomentsCityFilter] = useState<TogoCity | 'all'>('all');
  const [momentsDateFilter, setMomentsDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [momentsSortFilter, setMomentsSortFilter] = useState<'latest' | 'popular'>('latest');

  useEffect(() => {
    setMomentsLimit(10);
  }, [momentsCityFilter, momentsDateFilter, momentsSortFilter]);

  const [events, setEvents] = useState<Event[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiFilterActive, setIsAiFilterActive] = useState(false);
  const [isAiFiltering, setIsAiFiltering] = useState(false);
  const [aiFilteredEvents, setAiFilteredEvents] = useState<{id: string, reason: string}[] | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'relevance' | 'favorites'>('relevance');
  const [hotspotSortBy, setHotspotSortBy] = useState<'rating' | 'date' | 'popularity'>('date');
  const [eventsLimit, setEventsLimit] = useState(20);
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [momentsLimit, setMomentsLimit] = useState(10);
  const [hasMoreMoments, setHasMoreMoments] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isMomentsLoading, setIsMomentsLoading] = useState(true);
  const [isHotspotsLoading, setIsHotspotsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const userProfileRef = useRef<UserProfile | null>(null);
  const [toastNotification, setToastNotification] = useState<{title: string, message: string} | null>(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const handleLogout = async () => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastLogout: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error updating status on logout:', err);
      }
    }
    auth.signOut();
  };

  const handleToggleNotifications = async () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    const isCurrentlyEnabledForThisCity = userProfile?.notificationsEnabled && userProfile?.notificationCity === selectedCity;
    const newStatus = !isCurrentlyEnabledForThisCity;
    const newCity = newStatus ? selectedCity : null;

    try {
      await setDoc(userRef, {
        notificationsEnabled: newStatus,
        notificationCity: newCity
      }, { merge: true });

      if (newStatus && 'Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleViewEvent = async (event: Event) => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const currentHistory = userProfile?.history || [];
      const currentPreferences = userProfile?.preferences || [];
      
      // Add to history (keep last 20)
      const newHistory = [event.id, ...currentHistory.filter(id => id !== event.id)].slice(0, 20);
      
      // Update preferences (categories of viewed events)
      // We'll keep a simple list of unique categories from the history
      const newPreferences = Array.from(new Set([event.category, ...currentPreferences])).slice(0, 5);
      
      await setDoc(userRef, {
        history: newHistory,
        preferences: newPreferences
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

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

  const sortedHotspots = useMemo(() => {
    let result = [...hotspots];
    
    if (hotspotSortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (hotspotSortBy === 'popularity') {
      // For popularity, we can use rating as a proxy if no reviewsCount exists
      // Or we can sort by name as a fallback if rating is the same
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
    } else if (hotspotSortBy === 'date') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    return result;
  }, [hotspots, hotspotSortBy]);

  const recommendedEvents = useMemo(() => {
    let result = [...events];
    
    // Filter by city is already done by the events listener, but just to be sure
    result = result.filter(e => e.city === selectedCity);
    
    const preferences = userProfile?.preferences || [];
    const history = userProfile?.history || [];
    
    if (preferences.length > 0) {
      // Score events based on preferences and history
      result.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        
        if (preferences.includes(a.category)) scoreA += 10;
        if (preferences.includes(b.category)) scoreB += 10;
        
        // Penalize events already in history so we show new ones
        if (history.includes(a.id)) scoreA -= 5;
        if (history.includes(b.id)) scoreB -= 5;
        
        // If scores are equal, sort by date
        if (scoreA === scoreB) {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (isNaN(timeA) && isNaN(timeB)) return 0;
          if (isNaN(timeA)) return 1;
          if (isNaN(timeB)) return -1;
          return timeA - timeB;
        }
        
        return scoreB - scoreA; // Descending score
      });
    } else {
      // If no preferences, just sort by date
      result.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeA - timeB;
      });
    }
    
    return result;
  }, [events, userProfile, selectedCity]);

  // Sync User Profile
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      
      const syncProfile = async () => {
        try {
          // Check if user already exists to preserve role
          const userDoc = await getDoc(userRef);
          const existingData = userDoc.data();
          const isDefaultAdmin = user.email === 'marxist1991@gmail.com';
          const role = existingData?.role || (isDefaultAdmin ? 'admin' : 'user');

          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || 'Utilisateur',
            email: user.email,
            photoURL: user.photoURL,
            role: role,
            isOnline: true,
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      };
      syncProfile();

      // Heartbeat to keep user online
      const heartbeat = setInterval(async () => {
        try {
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: new Date().toISOString()
          });
        } catch (err) {
          // Ignore heartbeat errors
        }
      }, 60000); // Every minute

      const handleUnload = () => {
        // We can't use async here reliably, but we can try to use navigator.sendBeacon
        // or just accept that it might not work every time.
        // For Firestore, we can't easily use sendBeacon.
        // Let's try to update it.
        updateDoc(userRef, {
          isOnline: false,
          lastLogout: new Date().toISOString()
        }).catch(() => {});
      };

      window.addEventListener('beforeunload', handleUnload);

      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          if (data.forceLogout) {
            // Reset forceLogout flag and sign out
            updateDoc(userRef, { forceLogout: false, isOnline: false, lastLogout: new Date().toISOString() }).then(() => {
              auth.signOut();
            });
          } else {
            setUserProfile(data);
          }
        }
      });

      return () => {
        unsubscribe();
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleUnload);
      };
    } else {
      setUserProfile(null);
    }
  }, [user]);

  // Request Notification Permission
  useEffect(() => {
    if (user && selectedCity) {
      requestNotificationPermission(user.uid, selectedCity);
    }
  }, [user, selectedCity]);

  // Fetch Events
  const isInitialEventsLoad = useRef(true);

  useEffect(() => {
    setIsEventsLoading(true);
    isInitialEventsLoad.current = true;
    const path = 'events';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentProfile = userProfileRef.current;
      if (!isInitialEventsLoad.current && currentProfile?.notificationsEnabled && currentProfile?.notificationCity === selectedCity) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newEvent = change.doc.data() as Event;
            // Only notify if the event was created recently (within last 5 minutes) to avoid old events triggering notifications
            const createdAt = new Date(newEvent.createdAt).getTime();
            const nowTime = new Date().getTime();
            if (nowTime - createdAt < 5 * 60 * 1000) {
              const title = 'Nouvel événement !';
              const message = `${newEvent.title} vient d'être ajouté à ${selectedCity}.`;
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                  body: message,
                  icon: '/favicon.ico'
                });
              } else {
                setToastNotification({ title, message });
                setTimeout(() => setToastNotification(null), 5000);
              }
            }
          }
        });
      }
      isInitialEventsLoad.current = false;

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
    
    const getStartDate = (filter: string) => {
      const now = new Date();
      if (filter === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.toISOString();
      }
      if (filter === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return start.toISOString();
      }
      if (filter === 'month') {
        const start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        return start.toISOString();
      }
      return null;
    };

    let q = query(collection(db, path));

    if (momentsCityFilter !== 'all') {
      q = query(q, where('city', '==', momentsCityFilter));
    }

    const startDate = getStartDate(momentsDateFilter);
    if (startDate) {
      q = query(q, where('createdAt', '>=', startDate));
    }

    if (momentsSortFilter === 'latest') {
      q = query(q, orderBy('createdAt', 'desc'));
    } else {
      q = query(q, orderBy('likesCount', 'desc'));
    }

    q = query(q, limit(momentsLimit + 1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const momentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Moment[];
      
      if (momentsData.length > momentsLimit) {
        setHasMoreMoments(true);
        setMoments(momentsData.slice(0, momentsLimit));
      } else {
        setHasMoreMoments(false);
        setMoments(momentsData);
      }
      setIsMomentsLoading(false);
    }, (err) => {
      setIsMomentsLoading(false);
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [momentsCityFilter, momentsDateFilter, momentsSortFilter, momentsLimit]);

  // Fetch Hotspots
  const isInitialHotspotsLoad = useRef(true);

  useEffect(() => {
    setIsHotspotsLoading(true);
    isInitialHotspotsLoad.current = true;
    const path = 'hotspots';
    const q = query(
      collection(db, path),
      where('city', '==', selectedCity),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const currentProfile = userProfileRef.current;
      if (!isInitialHotspotsLoad.current && currentProfile?.notificationsEnabled && currentProfile?.notificationCity === selectedCity) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newHotspot = change.doc.data() as Hotspot;
            // Only notify if the hotspot was created recently (within last 5 minutes)
            const createdAt = new Date(newHotspot.createdAt).getTime();
            const nowTime = new Date().getTime();
            if (nowTime - createdAt < 5 * 60 * 1000) {
              const title = 'Nouveau hotspot !';
              const message = `${newHotspot.name} vient d'être ajouté à ${selectedCity}.`;
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                  body: message,
                  icon: '/favicon.ico'
                });
              } else {
                setToastNotification({ title, message });
                setTimeout(() => setToastNotification(null), 5000);
              }
            }
          }
        });
      }
      isInitialHotspotsLoad.current = false;

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

  // Upcoming events notification
  useEffect(() => {
    if (!userProfile?.notificationsEnabled || userProfile?.notificationCity !== selectedCity) return;

    const checkUpcomingEvents = () => {
      const now = new Date().getTime();
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      
      events.forEach(event => {
        // Parse event date and time
        // Assuming event.date is YYYY-MM-DD and event.time is HH:MM
        if (!event.date || !event.time) return;
        
        const eventDateTimeStr = `${event.date}T${event.time}`;
        const eventTime = new Date(eventDateTimeStr).getTime();
        
        if (isNaN(eventTime)) return;
        
        const timeDiff = eventTime - now;
        
        // If event starts in less than 2 hours and is in the future
        if (timeDiff > 0 && timeDiff <= twoHoursInMs) {
          const notifiedEvents = JSON.parse(localStorage.getItem('notifiedUpcomingEvents') || '{}');
          
          // Check if we already notified for this event
          if (!notifiedEvents[event.id]) {
            const title = 'Événement imminent !';
            const message = `L'événement "${event.title}" commence dans moins de 2 heures à ${event.city}.`;
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(title, {
                body: message,
                icon: '/favicon.ico'
              });
            } else {
              setToastNotification({ title, message });
              setTimeout(() => setToastNotification(null), 5000);
            }
            
            // Mark as notified
            notifiedEvents[event.id] = true;
            localStorage.setItem('notifiedUpcomingEvents', JSON.stringify(notifiedEvents));
          }
        }
      });
    };

    // Check immediately and then every minute
    checkUpcomingEvents();
    const intervalId = setInterval(checkUpcomingEvents, 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [events, userProfile, selectedCity]);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  useEffect(() => {
    setIsAiFilterActive(false);
    setAiFilteredEvents(null);
  }, [searchQuery, selectedCategory, sortBy, selectedCity]);

  const handleAiFilterToggle = async () => {
    if (isAiFilterActive) {
      setIsAiFilterActive(false);
      return;
    }
    
    setIsAiFilterActive(true);
    setIsAiFiltering(true);
    
    try {
      const res = await filterEventsWithAI(filteredEvents, userProfile, selectedCity, searchQuery);
      setAiFilteredEvents(res.recommendations || []);
    } catch (err) {
      console.error(err);
      setAiFilteredEvents([]);
    } finally {
      setIsAiFiltering(false);
    }
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

  const handleEditEvent = (event: Event) => {
    setEventToEdit(event);
    setIsAddEventOpen(true);
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
      <div className="h-screen flex items-center justify-center bg-[#0B0814]">
        <Loader2 className="animate-spin text-purple-500" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0B0814] p-8 text-center">
        <div className="w-24 h-24 bg-orange-500/20 rounded-3xl flex items-center justify-center mb-8 border border-orange-500/30 shadow-lg shadow-orange-500/20">
          <Sparkles className="text-orange-400" size={48} />
        </div>
        <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">TOGO EVENTS</h1>
        <p className="text-purple-200/70 mb-12 max-w-xs">
          Découvrez les meilleures soirées et événements culturels au Togo.
        </p>
        <button
          onClick={handleLogin}
          className="w-full max-w-xs bg-white/10 border border-white/20 text-white py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/20 hover:bg-white/20 transition-all"
        >
          Se connecter avec Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 text-white">
      {/* Header */}
      <header className="bg-[#0B0814]/80 backdrop-blur-xl px-6 pt-10 pb-6 sticky top-0 z-40 border-b border-white/10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">Bienvenue au Togo</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Salut, {user.displayName?.split(' ')[0]} 👋</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleToggleNotifications}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors border border-white/10",
                userProfile?.notificationsEnabled && userProfile?.notificationCity === selectedCity
                  ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                  : "bg-white/5 text-purple-200/50 hover:bg-white/10"
              )}
              title={userProfile?.notificationsEnabled && userProfile?.notificationCity === selectedCity ? "Désactiver les notifications" : "Activer les notifications pour cette ville"}
            >
              {userProfile?.notificationsEnabled && userProfile?.notificationCity === selectedCity ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-purple-200/50 hover:bg-white/10 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <CitySelector selectedCity={selectedCity} setSelectedCity={setSelectedCity} />
      </header>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="px-6 pt-8">
        <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-500" size={32} /></div>}>
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
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-white shadow-2xl shadow-orange-500/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2">Besoin d'idées ?</h2>
                  <p className="text-purple-200/70 text-sm mb-6">Demandez à notre IA de trouver les coins chauds à {selectedCity}.</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Où danser ce soir ?"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (aiResponse) setAiResponse(null);
                      }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white/10 text-white placeholder:text-purple-200/40 transition-colors"
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={isAiLoading}
                      className="bg-white text-black p-3 rounded-2xl hover:bg-white/90 transition-colors font-semibold shadow-lg shadow-orange-500/20"
                    >
                      {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                  </div>
                  {aiResponse && (
                    <div className="mt-6 p-5 bg-white/5 rounded-2xl text-sm border border-white/10 shadow-inner">
                      <p className="leading-relaxed text-purple-100/90 whitespace-pre-wrap">{aiResponse.text}</p>
                    </div>
                  )}
                </div>
                <Sparkles className="absolute -right-6 -bottom-6 text-orange-500/10" size={160} />
              </div>

              {/* Featured Events */}
              <section>
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    {searchQuery ? 'Résultats de recherche' : 'À ne pas manquer'}
                  </h2>
                  {!searchQuery && (
                    <button onClick={() => setActiveTab('events')} className="text-purple-400 text-xs font-bold uppercase tracking-wider hover:text-purple-300 transition-colors">Tout voir</button>
                  )}
                </div>

                {/* AI Recommended Places */}
                {searchQuery && (aiResponse?.places?.length > 0 || aiResponse?.grounding?.some((c: any) => c.maps)) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Sparkles size={18} className="text-purple-400" />
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
                            className="group block bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 hover:shadow-orange-500/10 transition-all duration-300"
                          >
                            <div className="h-48 relative overflow-hidden bg-white/5">
                              <img 
                                src={place.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/400`} 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${encodeURIComponent(place.name)}/800/400`;
                                }}
                                alt={place.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0814]/90 via-[#0B0814]/40 to-transparent"></div>
                              <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h4 className="font-black text-xl leading-tight mb-1">{place.name}</h4>
                                {place.mapsUrl && (
                                  <div className="flex items-center gap-1 text-xs font-medium text-purple-400 mb-2">
                                    <MapPin size={12} />
                                    <span>Voir sur Google Maps</span>
                                  </div>
                                )}
                                <p className="text-sm text-purple-200/80 line-clamp-2">{place.description}</p>
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
                            className="group block bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 hover:shadow-orange-500/10 transition-all duration-300"
                          >
                            <div className="h-40 relative overflow-hidden bg-white/5">
                              <img 
                                src={`https://picsum.photos/seed/${encodeURIComponent(chunk.maps.title)}/800/400`} 
                                alt={chunk.maps.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0814]/90 via-[#0B0814]/40 to-transparent"></div>
                              <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h4 className="font-black text-lg leading-tight mb-1">{chunk.maps.title}</h4>
                                <div className="flex items-center gap-1 text-xs font-medium text-purple-400">
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
                    {searchQuery && <h3 className="text-lg font-bold text-white mb-4">Événements correspondants</h3>}
                    {filteredEvents.slice(0, searchQuery ? 10 : 3).map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        isFavorite={favorites.includes(event.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onView={handleViewEvent}
                        onEdit={handleEditEvent}
                      />
                    ))}
                  </>
                ) : (
                  (!aiResponse || (!aiResponse.places?.length && !aiResponse.grounding?.some((c: any) => c.maps))) && (
                    <div className="bg-[#1A1525] rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[300px]">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <SearchX size={40} className="text-white/30" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Aucun résultat</h3>
                      <p className="text-white/50 max-w-md mx-auto">
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
                <h2 className="text-2xl font-black text-white tracking-tight">Événements</h2>
                <button 
                  onClick={() => setIsAddEventOpen(true)}
                  className="bg-white text-black p-2 rounded-xl shadow-lg shadow-orange-500/20"
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
                          ? "bg-purple-600 text-white shadow-lg shadow-orange-500/20"
                          : "bg-white/5 text-purple-200/50 border border-white/10 hover:border-purple-500/30"
                      )}
                    >
                      {cat === 'all' ? 'Tous' : cat === 'party' ? 'Soirées' : cat === 'culture' ? 'Culture' : cat === 'concert' ? 'Concerts' : cat === 'dance' ? 'Danses (Latines/Afro)' : 'Autres'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="relative flex-1 mr-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-200/40" size={18} />
                    <input 
                      type="text" 
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all text-white placeholder:text-purple-200/40"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-white [&>option]:bg-[#1A1525]"
                  >
                    <option value="relevance">Pertinence</option>
                    <option value="date">Date</option>
                    <option value="favorites">Populaires</option>
                  </select>
                </div>
                
                <div className="mt-4">
                  <button
                    onClick={handleAiFilterToggle}
                    disabled={isAiFiltering}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all",
                      isAiFilterActive 
                        ? "bg-purple-600 text-white shadow-lg shadow-orange-500/20" 
                        : "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                    )}
                  >
                    {isAiFiltering ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Sparkles size={18} className={isAiFilterActive ? "text-white" : "text-purple-400"} />
                    )}
                    {isAiFilterActive ? "Filtre IA activé" : "Filtrer par IA"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {isEventsLoading || isAiFiltering ? (
                  <>
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                  </>
                ) : isAiFilterActive && aiFilteredEvents ? (
                  aiFilteredEvents.length > 0 ? (
                    aiFilteredEvents.map(aiEvent => {
                      const event = filteredEvents.find(e => e.id === aiEvent.id);
                      if (!event) return null;
                      return (
                        <div key={event.id} className="relative">
                          <EventCard 
                            event={event} 
                            isFavorite={favorites.includes(event.id)}
                            onToggleFavorite={handleToggleFavorite}
                            allEvents={events}
                            onView={handleViewEvent}
                            onEdit={handleEditEvent}
                          />
                          <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-start gap-2">
                            <Sparkles className="text-purple-400 shrink-0 mt-0.5" size={16} />
                            <p className="text-xs text-purple-200/90">{aiEvent.reason}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-[#1A1525] rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[300px]">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <SearchX size={40} className="text-white/30" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Aucun événement trouvé</h3>
                      <p className="text-white/50 max-w-md mx-auto">
                        L'IA n'a trouvé aucun événement correspondant à vos critères.
                      </p>
                    </div>
                  )
                ) : filteredEvents.length > 0 ? (
                  <>
                    {filteredEvents.map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        isFavorite={favorites.includes(event.id)}
                        onToggleFavorite={handleToggleFavorite}
                        allEvents={events}
                        onView={handleViewEvent}
                        onEdit={handleEditEvent}
                      />
                    ))}
                    {hasMoreEvents && (
                      <button
                        onClick={() => setEventsLimit(prev => prev + 5)}
                        className="w-full py-4 mt-4 bg-white/5 border-2 border-white/10 text-purple-400 font-bold rounded-2xl hover:bg-white/10 transition-colors"
                      >
                        Charger plus
                      </button>
                    )}
                  </>
                ) : (
                  <div className="bg-[#1A1525] rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <CalendarX size={40} className="text-white/30" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Aucun événement trouvé</h3>
                    <p className="text-white/50 max-w-md mx-auto">
                      Nous n'avons trouvé aucun événement correspondant à vos critères. Essayez de modifier vos filtres ou de chercher dans une autre ville.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'recommendations' && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight">Pour Vous</h2>
              </div>
              
              <div className="bg-purple-500/10 rounded-2xl p-4 mb-6 border border-purple-500/20 flex items-start gap-3">
                <Sparkles className="text-purple-400 shrink-0 mt-1" size={20} />
                <p className="text-sm text-purple-200/90 leading-relaxed">
                  Ces événements sont recommandés en fonction de vos préférences et de votre historique de navigation à {selectedCity}.
                </p>
              </div>

              <div className="space-y-4">
                {isEventsLoading ? (
                  <>
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                    <SkeletonEventCard />
                  </>
                ) : recommendedEvents.length > 0 ? (
                  <>
                    {recommendedEvents.slice(0, 10).map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        isFavorite={favorites.includes(event.id)}
                        onToggleFavorite={handleToggleFavorite}
                        allEvents={events}
                        onView={handleViewEvent}
                        onEdit={handleEditEvent}
                      />
                    ))}
                  </>
                ) : (
                  <div className="bg-[#1A1525] rounded-3xl p-12 text-center border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                      <CalendarX size={40} className="text-white/30" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Aucune recommandation</h3>
                    <p className="text-white/50 max-w-md mx-auto">
                      Nous n'avons pas encore assez de données pour vous recommander des événements. Explorez l'application pour nous aider à mieux vous connaître !
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
                <h2 className="text-2xl font-black text-white tracking-tight">Moments Direct</h2>
                <button 
                  onClick={() => setIsAddMomentOpen(true)}
                  className="bg-white text-black p-2 rounded-xl shadow-lg shadow-orange-500/20"
                >
                  <Video size={20} />
                </button>
              </div>

              {/* Moments Filters */}
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
                    <button
                      onClick={() => setMomentsSortFilter('latest')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                        momentsSortFilter === 'latest' ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white"
                      )}
                    >
                      <Clock size={14} />
                      Récents
                    </button>
                    <button
                      onClick={() => setMomentsSortFilter('popular')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                        momentsSortFilter === 'popular' ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white"
                      )}
                    >
                      <TrendingUp size={14} />
                      Populaires
                    </button>
                  </div>

                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
                    {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setMomentsDateFilter(filter)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize",
                          momentsDateFilter === filter ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white"
                        )}
                      >
                        {filter === 'all' ? 'Tout' : filter === 'today' ? 'Aujourd\'hui' : filter === 'week' ? 'Semaine' : 'Mois'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" size={16} />
                    <select
                      value={momentsCityFilter}
                      onChange={(e) => setMomentsCityFilter(e.target.value as TogoCity | 'all')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-10 py-3 text-white text-sm font-bold appearance-none focus:ring-2 focus:ring-purple-500/50 transition-all [&>option]:bg-[#1A1525]"
                    >
                      <option value="all">Toutes les villes</option>
                      {TOGO_CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={16} />
                  </div>
                  
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                    <Filter size={16} className="text-purple-400" />
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Filtres</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {isMomentsLoading ? (
                  <>
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                    <SkeletonMomentCard />
                  </>
                ) : moments.length > 0 ? (
                  moments.map(moment => (
                    <MomentCard key={moment.id} moment={moment} />
                  ))
                ) : (
                  <div className="col-span-2 py-20 flex flex-col items-center justify-center text-center">
                    <div className="bg-white/5 p-6 rounded-full mb-4">
                      <Video size={40} className="text-purple-400 opacity-20" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Aucun moment trouvé</h3>
                    <p className="text-sm text-white/50 max-w-[200px]">Essayez de changer vos filtres pour voir plus de contenu.</p>
                  </div>
                )}
              </div>
              {hasMoreMoments && (
                <button
                  onClick={() => setMomentsLimit(prev => prev + 10)}
                  className="w-full py-4 mt-6 bg-white/5 border-2 border-white/10 text-purple-400 font-bold rounded-2xl hover:bg-white/10 transition-colors"
                >
                  Charger plus
                </button>
              )}
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
                <h2 className="text-2xl font-black text-white tracking-tight">Hotspots {selectedCity}</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={hotspotSortBy}
                    onChange={(e) => setHotspotSortBy(e.target.value as any)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-white"
                  >
                    <option value="date">Date d'ajout</option>
                    <option value="rating">Note</option>
                    <option value="popularity">Popularité</option>
                  </select>
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
                      className="bg-white text-black p-2 rounded-xl shadow-lg shadow-orange-500/20"
                    >
                      <Plus size={20} />
                    </button>
                </div>
              </div>
              {isHotspotsLoading ? (
                <div className="grid grid-cols-1 gap-4">
                  <SkeletonHotspotCard />
                  <SkeletonHotspotCard />
                  <SkeletonHotspotCard />
                </div>
              ) : sortedHotspots.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {sortedHotspots.map(hotspot => (
                    <HotspotCard key={hotspot.id} hotspot={hotspot} />
                  ))}
                </div>
              ) : (
                <div className="bg-[#1A1525] rounded-2xl p-12 text-center border border-dashed border-white/10">
                  <MapIcon className="mx-auto text-white/30 mb-4" size={48} />
                  <p className="text-white/50 text-sm">Aucun hotspot répertorié pour cette ville.</p>
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
                <h2 className="text-2xl font-black text-white tracking-tight">Mes Favoris</h2>
              </div>
              {events.filter(e => favorites.includes(e.id)).length > 0 ? (
                events.filter(e => favorites.includes(e.id)).map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                    onView={handleViewEvent}
                    onEdit={handleEditEvent}
                  />
                ))
              ) : (
                <div className="bg-[#1A1525] rounded-2xl p-12 text-center border border-dashed border-white/10">
                  <Heart className="mx-auto text-white/30 mb-4" size={48} />
                  <p className="text-white/50 text-sm">Vous n'avez pas encore d'événements favoris.</p>
                  <button 
                    onClick={() => setActiveTab('events')}
                    className="mt-4 text-purple-400 font-bold text-sm"
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
              <h2 className="text-2xl font-black text-white tracking-tight">Studio Créatif</h2>
              
              <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Générateur d'Affiches</h3>
                    <p className="text-xs text-purple-200/70">Créez des visuels uniques avec Gemini</p>
                  </div>
                </div>
                <button 
                  onClick={() => alert("Fonctionnalité de génération d'affiche bientôt disponible !")}
                  className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm"
                >
                  Essayer maintenant
                </button>
              </div>

              <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-fuchsia-500/20 rounded-xl flex items-center justify-center text-fuchsia-400">
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Animation Veo</h3>
                    <p className="text-xs text-purple-200/70">Animez vos photos en vidéos de 5s</p>
                  </div>
                </div>
                <button 
                  onClick={() => alert("Fonctionnalité Veo bientôt disponible !")}
                  className="w-full bg-fuchsia-600 text-white py-3 rounded-xl font-bold text-sm"
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
              <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-4 overflow-hidden border-4 border-[#1A1525] shadow-lg">
                <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">{user.displayName}</h2>
              <p className="text-purple-200/70 text-sm mb-8">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-2xl font-black text-white">{events.length}</p>
                  <p className="text-[10px] font-bold text-purple-200/50 uppercase tracking-widest">Événements</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-2xl font-black text-white">{moments.length}</p>
                  <p className="text-[10px] font-bold text-purple-200/50 uppercase tracking-widest">Moments</p>
                </div>
              </div>

              <div className="max-w-xs mx-auto space-y-3 mb-8">
                {(userProfile?.role === 'admin' || user.email === 'marxist1991@gmail.com') && (
                  <button 
                    onClick={() => setActiveTab('admin')}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-red-500/20"
                  >
                    <ShieldAlert size={18} />
                    Dashboard Admin
                  </button>
                )}
                
                <button 
                  onClick={() => setIsFeedbackOpen(true)}
                  className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <MessageSquare size={18} />
                  Donner son avis
                </button>
              </div>

              {user.email === 'marxist1991@gmail.com' && (
                <button 
                  onClick={handleSeedData}
                  className="bg-white/10 text-white/70 hover:text-white hover:bg-white/20 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest mb-4 transition-colors"
                >
                  Générer des données de test
                </button>
              )}
            </motion.div>
          )}

          {(userProfile?.role === 'admin' || user?.email === 'marxist1991@gmail.com') && activeTab === 'admin' && (
            <AdminDashboard onBack={() => setActiveTab('profile')} />
          )}
        </AnimatePresence>
        </Suspense>
      </main>

      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-6 right-6 bg-[#1A1525]/90 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl z-50 flex items-start gap-3 border border-white/10"
          >
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
              <Bell className="text-purple-400" size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-1">{toastNotification.title}</h4>
              <p className="text-xs text-purple-200/70 leading-relaxed">{toastNotification.message}</p>
            </div>
            <button 
              onClick={() => setToastNotification(null)}
              className="text-white/50 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <AddEventModal 
          isOpen={isAddEventOpen} 
          onClose={() => {
            setIsAddEventOpen(false);
            setEventToEdit(null);
          }} 
          selectedCity={selectedCity}
          eventToEdit={eventToEdit}
        />

        <AddMomentModal 
          isOpen={isAddMomentOpen} 
          onClose={() => setIsAddMomentOpen(false)} 
          selectedCity={momentsCityFilter !== 'all' ? momentsCityFilter : selectedCity} 
        />

        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
      </Suspense>
    </div>
  );
}

function SkeletonEventCard() {
  return (
    <div className="bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 mb-6 animate-pulse">
      <div className="h-48 bg-white/5"></div>
      <div className="p-5">
        <div className="flex flex-col gap-2 mb-3">
          <div className="h-4 bg-white/10 rounded w-1/3"></div>
          <div className="h-4 bg-white/10 rounded w-1/2"></div>
        </div>
        <div className="h-4 bg-white/10 rounded w-full mb-2"></div>
        <div className="h-4 bg-white/10 rounded w-5/6"></div>
        <div className="mt-4 h-8 bg-white/5 rounded-xl w-full"></div>
      </div>
    </div>
  );
}

function SkeletonMomentCard() {
  return (
    <div className="bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 animate-pulse h-48">
      <div className="w-full h-full bg-white/5"></div>
    </div>
  );
}

function SkeletonHotspotCard() {
  return (
    <div className="bg-[#1A1525] rounded-3xl overflow-hidden shadow-sm border border-white/10 mb-6 animate-pulse flex">
      <div className="w-24 h-24 bg-white/5 shrink-0"></div>
      <div className="p-3 flex-1">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-white/10 rounded w-full mb-1"></div>
        <div className="h-3 bg-white/10 rounded w-3/4"></div>
      </div>
    </div>
  );
}
