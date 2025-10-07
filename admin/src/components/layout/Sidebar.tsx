'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  HomeIcon,
  FilmIcon,
  UsersIcon,
  CogIcon,
  ChartBarIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Conteúdo', href: '/content', icon: FilmIcon },
  { name: 'Usuários', href: '/users', icon: UsersIcon },
  { name: 'Pagamentos', href: '/payments', icon: CreditCardIcon },
  { name: 'Pedidos', href: '/orders', icon: ClipboardDocumentListIcon },
  { name: 'Métricas', href: '/analytics', icon: ChartBarIcon },
  { name: 'Configurações', href: '/settings', icon: CogIcon },
]

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleNavigation = () => {
    // Close sidebar on mobile when navigation occurs
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="h-full w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 border-b border-dark-700">
          <h1 className="text-xl font-bold text-white">Cine Vision</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavigation}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-300 hover:bg-dark-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" aria-hidden="true" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-dark-700">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 w-full text-left hover:bg-dark-700 rounded-lg p-2 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user ? getUserInitials(user.name) : 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email || 'admin@cinevision.com'}
                </p>
              </div>
              <ChevronDownIcon 
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  showUserMenu ? 'rotate-180' : ''
                }`} 
              />
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-dark-700 border border-dark-600 rounded-lg shadow-lg">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 hover:text-white rounded-lg transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}