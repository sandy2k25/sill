import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

const Error404: React.FC = () => {
  const [, setLocation] = useLocation();
  const [anim, setAnim] = useState<boolean>(false);
  const [dots, setDots] = useState<string>("");

  // Animation for dots
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + "." : "");
    }, 500);

    // Trigger fade-in animation
    setTimeout(() => setAnim(true), 100);

    return () => clearInterval(dotInterval);
  }, []);

  // Redirect to auth page on button click
  const handleAdminRedirect = () => {
    setLocation('/auth');
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center">
      <div className={`transform transition-all duration-1000 ${anim ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <h1 className="text-9xl font-bold text-gray-900 tracking-wider">
          <span className="inline-block animate-pulse text-red-600">4</span>
          <span className="inline-block animate-bounce delay-75 text-gray-800">0</span>
          <span className="inline-block animate-pulse delay-150 text-red-600">4</span>
        </h1>
        
        <div className="text-center mt-8">
          <p className="text-2xl text-gray-700 mb-8 animate-fade-in">
            Page not found{dots}
          </p>
          
          <div className="text-gray-500 mb-12 max-w-md mx-auto">
            <p className="animate-fade-in delay-300">
              This page doesn't exist or you don't have permission to access it.
            </p>
          </div>
          
          <button 
            onClick={handleAdminRedirect}
            className="px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            Admin Login
          </button>
        </div>
      </div>

      {/* Animated shapes */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 h-32 w-32 rounded-full bg-red-100 animate-float opacity-50"></div>
        <div className="absolute top-2/3 right-1/4 h-48 w-48 rounded-full bg-gray-100 animate-float-delay opacity-60"></div>
        <div className="absolute bottom-1/4 right-1/3 h-24 w-24 rounded-full bg-red-50 animate-float-slow opacity-40"></div>
      </div>
    </div>
  );
};

export default Error404;