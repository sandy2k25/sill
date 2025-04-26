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
    if (location.startsWith('/home') || location.startsWith('/taah')) return 'player';
    return 'none';
  };
  
  const activeTab = getActiveTab();
  
  // Don't show header and footer on the error page (root path)
  const isErrorPage = location === '/' || location === '/404';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Only show header if not on error page */}
      {!isErrorPage && (
        <header className="bg-darkSecondary py-4 px-6 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <i className="fas fa-play-circle text-primary text-2xl"></i>
              <h1 className="text-xl font-bold">WovIeX</h1>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-6">
              <div className={`${activeTab === 'player' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors cursor-pointer`}
                  onClick={() => window.location.href = '/home'}>
                <i className="fas fa-play mr-1"></i> Player
              </div>
              
              {/* Only show admin links if authenticated */}
              {isAuthenticated && (
                <>
                  <div className={`${activeTab === 'admin' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors cursor-pointer`}
                      onClick={() => window.location.href = '/admin'}>
                    <i className="fas fa-cog mr-1"></i> Admin
                  </div>
                  <div className={`${activeTab === 'logs' ? 'text-primary' : 'text-lightText hover:text-primary'} transition-colors cursor-pointer`}
                      onClick={() => window.location.href = '/logs'}>
                    <i className="fas fa-list mr-1"></i> Logs
                  </div>
                </>
              )}
            </nav>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-grow ${!isErrorPage ? 'p-6' : ''}`}>
        <div className={`${!isErrorPage ? 'container mx-auto' : 'w-full'}`}>
          {children}
        </div>
      </main>

      {/* Only show footer if not on error page */}
      {!isErrorPage && (
        <footer className="bg-darkSecondary py-4 px-6 border-t border-darkAccent">
          <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div>
              WovIeX &copy; {new Date().getFullYear()} - All rights reserved
            </div>
            <div className="mt-2 md:mt-0">
              <span>Current Version: 1.2.0</span>
              <span className="mx-2">|</span>
              <a href="#" className="text-primary hover:text-secondary transition-colors">Documentation</a>
              <span className="mx-2">|</span>
              {!isAuthenticated ? (
                <span 
                  className="text-gray-500 hover:text-gray-400 transition-colors text-xs cursor-pointer" 
                  onClick={() => window.location.href = '/auth'}>
                  ·
                </span>
              ) : (
                <span 
                  onClick={() => { window.localStorage.removeItem('admin_auth_token'); window.location.reload(); }} 
                  className="text-gray-400 hover:text-primary transition-colors text-xs cursor-pointer">
                  Logout
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
      
      {/* Toast Notifications Container - will be populated by useToast hook */}
      <div id="toast-container" className="fixed bottom-4 right-4 z-50"></div>
    </div>
  );
};

export default Layout;
