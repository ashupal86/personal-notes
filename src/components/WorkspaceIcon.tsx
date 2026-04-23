import { Folder, Briefcase, Book, Code, Globe, Star, Hash, Hexagon, Component } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  'folder': Folder,
  '📁': Folder,
  'briefcase': Briefcase,
  '💼': Briefcase,
  'book': Book,
  '📚': Book,
  'code': Code,
  '💻': Code,
  'globe': Globe,
  '🌐': Globe,
  'star': Star,
  '⭐': Star,
  'hash': Hash,
  '#': Hash,
  'hexagon': Hexagon,
  'component': Component,
};

interface WorkspaceIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export default function WorkspaceIcon({ icon, size = 16, className = '' }: WorkspaceIconProps) {
  const IconComponent = ICON_MAP[icon?.toLowerCase()] || ICON_MAP[icon] || Folder;
  return <IconComponent size={size} className={className} />;
}
