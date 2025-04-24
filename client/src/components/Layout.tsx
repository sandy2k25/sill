import React, { useState, ReactNode } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Determine active tab
  const getActiveTab = () => {
    if (location.startsWith('/admin')) return 'admin';
    if (location.startsWith('/logs')) return 'logs';
    if (location.startsWith('/auth')) return 'auth';
    return 'player';
  };
  
  const activeTab = getActiveTab();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-darkSecondary py-4 px-6 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <i className="fas fa-play-circle text-primary text-2xl"></i>
            <h1 className="text-xl font-bold">VideoScraperX</h1>
          </div>
          
          {/* Navigation */}
          <nav className="flex space-x-6">
            <Link href="/">
              <a className={`${activeTab === 'player' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors`}>
                <i className="fas fa-play mr-1"></i> Player
              </a>
            </Link>
            
            {/* Only show admin links if authenticated */}
            {isAuthenticated && (
              <>
                <Link href="/admin">
                  <a className={`${activeTab === 'admin' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors`}>
                    <i className="fas fa-cog mr-1"></i> Admin
                  </a>
                </Link>
                <Link href="/logs">
                  <a className={`${activeTab === 'logs' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors`}>
                    <i className="fas fa-list mr-1"></i> Logs
                  </a>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6">
        <div className="container mx-auto">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-darkSecondary py-4 px-6 border-t border-darkAccent">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
          <div>
            VideoScraperX &copy; {new Date().getFullYear()} - All rights reserved
          </div>
          <div className="mt-2 md:mt-0">
            <span>Current Version: 1.2.0</span>
            <span className="mx-2">|</span>
            <a href="#" className="text-primary hover:text-secondary transition-colors">Documentation</a>
            <span className="mx-2">|</span>
            {!isAuthenticated ? (
              <Link href="/auth">
                <a className="text-gray-500 hover:text-gray-400 transition-colors text-xs">·</a>
              </Link>
            ) : (
              <Link href="/">
                <a onClick={() => { window.localStorage.removeItem('admin_auth_token'); window.location.reload(); }} 
                   className="text-gray-400 hover:text-primary transition-colors text-xs">
                  Logout
                </a>
              </Link>
            )}
          </div>
        </div>
      </footer>
      
      {/* Toast Notifications Container - will be populated by useToast hook */}
      <div id="toast-container" className="fixed bottom-4 right-4 z-50"></div>
    </div>
  );
};

export default Layout;
