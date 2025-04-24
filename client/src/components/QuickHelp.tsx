import React from 'react';

const QuickHelp: React.FC = () => {
  return (
    <div className="bg-darkSecondary p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4">Quick Help</h2>
      <div className="space-y-3 text-sm">
        <div>
          <h3 className="font-medium text-primary">How to Play a Video</h3>
          <p className="text-gray-300">Enter the video ID in the search box and click Play.</p>
        </div>
        <div>
          <h3 className="font-medium text-primary">URL Format</h3>
          <p className="text-gray-300">
            Access directly via: <span className="bg-darkAccent px-2 py-1 rounded text-xs">/taah/{'{ID}'}</span>
          </p>
        </div>
        <div>
          <h3 className="font-medium text-primary">Extract URL Only</h3>
          <p className="text-gray-300">
            To get just the URL: <span className="bg-darkAccent px-2 py-1 rounded text-xs">/tahh/{'{ID}'}</span>
          </p>
        </div>
        <div>
          <h3 className="font-medium text-primary">Valid Video IDs</h3>
          <p className="text-gray-300">
            Only numeric IDs are supported (e.g., 41517)
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickHelp;
