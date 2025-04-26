import React, { useEffect, useState } from 'react';

const Error404: React.FC = () => {
  const [anim, setAnim] = useState<boolean>(false);
  const [glitchClass, setGlitchClass] = useState<string>("");
  const [scanline, setScanline] = useState<boolean>(false);

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
          
          <div className="max-w-md mx-auto border-t border-gray-700 pt-6">
            <p className="animate-fade-in text-gray-400 tracking-wide uppercase text-xs">
              Resource not found
            </p>
          </div>
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