import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ShieldCheck, Terminal, BotMessageSquare, Server, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Error404: React.FC = () => {
  const [anim, setAnim] = useState<boolean>(false);
  const [glitchClass, setGlitchClass] = useState<string>("");
  const [scanline, setScanline] = useState<boolean>(false);
  const [showAccessPanel, setShowAccessPanel] = useState<boolean>(false);
  const [, setLocation] = useLocation();

  // Trigger animations on mount
  useEffect(() => {
    // Trigger main fade-in animation
    setTimeout(() => setAnim(true), 100);
    
    // Scanline effect
    setTimeout(() => setScanline(true), 800);

    // Glitch effect intervals - more random and professional
    let glitchTimer: NodeJS.Timeout;
    
    const triggerGlitch = () => {
      setGlitchClass("glitch");
      setTimeout(() => setGlitchClass(""), Math.random() * 200 + 50);
      
      // Schedule next glitch
      glitchTimer = setTimeout(triggerGlitch, Math.random() * 5000 + 2000);
    };
    
    // Start the first glitch after 1.5s
    const initialTimer = setTimeout(triggerGlitch, 1500);
    
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(glitchTimer);
    };
  }, []);

  const toggleAccessPanel = () => {
    setShowAccessPanel(!showAccessPanel);
  };

  const openTelegramBot = () => {
    // Get bot username from environment or use default
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
    window.open(`https://t.me/${botUsername}`, '_blank');
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Scanlines overlay */}
      {scanline && (
        <div className="fixed inset-0 pointer-events-none z-50 scanlines opacity-20"></div>
      )}
      
      <div className={`text-center transform transition-all duration-1000 ${anim ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className={`relative ${glitchClass}`}>
          <h1 className="text-9xl font-bold text-white tracking-wider relative z-10 animate-text-flicker">
            <span className="inline-block text-red-600">4</span>
            <span className="inline-block text-white">0</span>
            <span className="inline-block text-red-600">4</span>
          </h1>
          
          {/* Glitch layers */}
          <h1 className="text-9xl font-bold text-blue-500 tracking-wider absolute top-0 left-0 z-0 glitch-layer-1">
            <span>4</span><span>0</span><span>4</span>
          </h1>
          <h1 className="text-9xl font-bold text-red-500 tracking-wider absolute top-0 left-0 z-0 glitch-layer-2">
            <span>4</span><span>0</span><span>4</span>
          </h1>
        </div>
        
        <div className="mt-12 relative z-10">
          <p className="text-xl text-gray-300 mb-6 animate-fade-in tracking-widest uppercase font-light">
            ERROR
          </p>
          
          <div className="max-w-md mx-auto border-t border-gray-700 pt-6 mb-6">
            <p className="animate-fade-in text-gray-400 tracking-wide uppercase text-xs mb-8">
              Resource not found
            </p>
          </div>
          
          {/* Access Control Panel Button */}
          <div className={`transition-all duration-500 ${showAccessPanel ? 'opacity-100' : 'opacity-70'}`}>
            <Button 
              variant={showAccessPanel ? "default" : "outline"} 
              className={`relative backdrop-blur-sm bg-opacity-10 border border-gray-800 hover:bg-gray-800 hover:text-white transition-all
                ${showAccessPanel ? 'bg-primary text-white shadow-glow' : 'bg-gray-900 text-gray-400'}`}
              onClick={toggleAccessPanel}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {showAccessPanel ? 'Hide Access Panel' : 'Show Access Panel'}
            </Button>
          </div>
          
          {/* Admin Access Panel */}
          {showAccessPanel && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto animate-fade-in">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="bg-gray-800 bg-opacity-50 border border-gray-700 hover:bg-gray-700 hover:border-primary transition-all duration-300 flex items-center justify-between group"
                      onClick={() => setLocation('/auth')}
                    >
                      <div className="flex items-center">
                        <Terminal className="mr-2 h-5 w-5 text-primary" />
                        <span>Admin Dashboard</span>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Access administrative features</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="bg-gray-800 bg-opacity-50 border border-gray-700 hover:bg-gray-700 hover:border-primary transition-all duration-300 flex items-center justify-between group"
                      onClick={openTelegramBot}
                    >
                      <div className="flex items-center">
                        <BotMessageSquare className="mr-2 h-5 w-5 text-blue-400" />
                        <span>Telegram Bot</span>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Access Telegram bot interface</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="bg-gray-800 bg-opacity-50 border border-gray-700 hover:bg-gray-700 hover:border-primary transition-all duration-300 flex items-center justify-between group"
                      onClick={() => setLocation('/admin')}
                    >
                      <div className="flex items-center">
                        <Server className="mr-2 h-5 w-5 text-green-400" />
                        <span>Channel Storage</span>
                      </div>
                      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage Telegram channel storage</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Animated digital grid background */}
      <div className="absolute inset-0 overflow-hidden -z-10 grid-bg opacity-30"></div>
      
      {/* Light beams */}
      <div className="absolute h-screen w-screen overflow-hidden -z-5">
        <div className="light-beam light-beam-1"></div>
        <div className="light-beam light-beam-2"></div>
        <div className="light-beam light-beam-3"></div>
      </div>
      
      {/* Dark vignette effect */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none"></div>
    </div>
  );
};

export default Error404;