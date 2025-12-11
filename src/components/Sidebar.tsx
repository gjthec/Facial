import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GoogleUser } from '../types';
import { LogOut } from 'lucide-react';

type NavItem = {
  label: string;
  to: string;
  icon?: React.ReactNode;
};

interface SidebarProps {
  user: GoogleUser;
  navItems: NavItem[];
  onLogout: () => void;
  footer?: React.ReactNode;
}

/**
 * Sidebar reutilizável para páginas autenticadas.
 * Usa classes utilitárias (Tailwind) presentes no projeto.
 */
export const Sidebar: React.FC<SidebarProps> = ({ user, navItems, onLogout, footer }) => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-4">
      <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="Avatar" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user.displayName?.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      </div>

      <nav className="mt-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {footer}

      <button
        onClick={onLogout}
        className="mt-4 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <LogOut className="w-4 h-4" /> Sair
      </button>
    </aside>
  );
};

export default Sidebar;
