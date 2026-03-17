import { Home, Calendar, Play, Sparkles, User, Heart, Map as MapIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Accueil' },
    { id: 'events', icon: Calendar, label: 'Événements' },
    { id: 'moments', icon: Play, label: 'Moments' },
    { id: 'hotspots', icon: MapIcon, label: 'Hotspots' },
    { id: 'favorites', icon: Heart, label: 'Favoris' },
    { id: 'ai', icon: Sparkles, label: 'Studio' },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-xl border border-slate-100 px-6 py-3 rounded-3xl flex justify-between items-center z-50 shadow-2xl shadow-slate-200/50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300",
            activeTab === tab.id ? "text-brand-primary scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[9px] font-bold uppercase tracking-widest">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
