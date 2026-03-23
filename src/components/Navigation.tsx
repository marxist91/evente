import { Home, Calendar, Play, Sparkles, User, Heart, Map as MapIcon, Compass } from 'lucide-react';
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
    { id: 'recommendations', icon: Compass, label: 'Recommandations' },
    { id: 'hotspots', icon: MapIcon, label: 'Hotspots' },
    { id: 'favorites', icon: Heart, label: 'Favoris' },
    { id: 'ai', icon: Sparkles, label: 'Studio' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-white/95 backdrop-blur-xl border border-slate-100 px-4 py-3 rounded-full flex justify-between items-center z-50 shadow-2xl shadow-slate-200/50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all duration-300",
              isActive 
                ? "bg-emerald-50 text-emerald-600" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
            title={tab.label}
          >
            <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(isActive && "scale-110 transition-transform")} />
            {isActive && (
              <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                {tab.label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
