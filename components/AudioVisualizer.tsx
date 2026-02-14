import React from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isRecording }) => {
  // Always render container to prevent layout shifts
  return (
    <div className="flex items-center justify-center gap-2 h-16">
      {isRecording ? (
        [...Array(7)].map((_, i) => (
          <div
            key={i}
            className="w-2.5 bg-primary-500 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.4)]"
            style={{
              height: '100%',
              animation: `wave ${0.5 + Math.random() * 0.4}s ease-in-out infinite alternate`,
              animationDelay: `-${Math.random()}s`
            }}
          />
        ))
      ) : (
        <div className="flex gap-2 opacity-20">
            {[...Array(7)].map((_, i) => (
                <div key={i} className="w-2.5 h-3 bg-zinc-700 rounded-full" />
            ))}
        </div>
      )}
      <style>{`
        @keyframes wave {
          0% { height: 20%; opacity: 0.5; }
          100% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AudioVisualizer;