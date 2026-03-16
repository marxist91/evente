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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === tab.id ? "text-emerald-600" : "text-gray-400"
          )}
        >
          <tab.icon size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
