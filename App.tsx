import React, { useState, useRef, useEffect } from 'react';
import { Mic, Upload, StopCircle, Loader2, ArrowRight, Activity, Volume2, Copy, Check, MessageSquare, AudioWaveform, Globe } from 'lucide-react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import LanguageSelector from './components/LanguageSelector';
import AudioVisualizer from './components/AudioVisualizer';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from './constants';
import { processTranslation } from './services/api';
import { TranslationState } from './types';

const App: React.FC = () => {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    resetRecording,
    setAudioBlob
  } = useAudioRecorder();

  const [sourceLang, setSourceLang] = useState(SOURCE_LANGUAGES[0].code);
  const [targetLang, setTargetLang] = useState(TARGET_LANGUAGES[1].code);
  const [appState, setAppState] = useState<TranslationState>({
    status: 'idle',
    transcript: '',
    translation: '',
    audioUrl: null,
    logs: []
  });
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultAudioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProcess = async () => {
    if (!audioBlob) return;

    setAppState(prev => ({ ...prev, status: 'processing', error: undefined }));

    try {
      const result = await processTranslation({
        audio: audioBlob,
        sourceLang,
        targetLang
      });

      setAppState({
        status: 'completed',
        transcript: result.transcript,
        translation: result.translation,
        audioUrl: result.audio,
        logs: result.logs.split('\n')
      });
    } catch (err) {
      setAppState(prev => ({
        ...prev,
        status: 'error',
        error: "Connection failed."
      }));
    }
  };

  useEffect(() => {
    if (appState.status === 'completed' && appState.audioUrl && resultAudioRef.current) {
        resultAudioRef.current.play().catch(e => console.log("Auto-play blocked"));
    }
  }, [appState.status, appState.audioUrl]);

  const handleReset = () => {
    resetRecording();
    setAppState({
      status: 'idle',
      transcript: '',
      translation: '',
      audioUrl: null,
      logs: []
    });
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyToClipboard = () => {
    if (appState.translation) {
      navigator.clipboard.writeText(appState.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col items-center justify-center font-sans">
      
      {/* Main Content Width */}
      <div className="w-full max-w-5xl">
        
        {/* Header Section */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
             <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
             <span className="text-zinc-500 text-xs font-medium tracking-widest uppercase">System Online</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
            MediSpeak <span className="text-primary-500">AI</span>
          </h1>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto">
            Secure medical translation infrastructure.
            <br />
            Break language barriers instantly.
          </p>
        </header>

        {/* Stats/Language Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Card 1 */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
             <LanguageSelector
                label="Source Language"
                value={sourceLang}
                options={SOURCE_LANGUAGES}
                onChange={setSourceLang}
                disabled={appState.status === 'processing'}
              />
          </div>
           {/* Card 2 */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center">
             <LanguageSelector
                label="Target Language"
                value={targetLang}
                options={TARGET_LANGUAGES}
                onChange={setTargetLang}
                disabled={appState.status === 'processing'}
              />
          </div>
        </div>

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Recording / Control Module (Left) */}
          <div className="md:col-span-5 bg-card border border-border rounded-2xl p-8 flex flex-col relative overflow-hidden group">
            <h2 className="text-white font-semibold text-xl mb-6 flex items-center gap-2">
              <AudioWaveform className="w-5 h-5 text-primary-500" />
              Audio Input
            </h2>

            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              
              {!audioBlob ? (
                <>
                  {isRecording ? (
                    <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
                      <div className="text-5xl font-mono font-bold text-white mb-6 tabular-nums">
                        {formatTime(recordingTime)}
                      </div>
                      
                      <div className="w-full mb-8">
                        <AudioVisualizer isRecording={isRecording} />
                      </div>

                      <button
                        onClick={stopRecording}
                        className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                      >
                        <StopCircle className="w-5 h-5" />
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <button
                        onClick={startRecording}
                        className="group relative w-32 h-32 flex items-center justify-center"
                      >
                        <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl group-hover:bg-primary-500/40 transition-all duration-500"></div>
                        <div className="relative w-24 h-24 bg-card border-2 border-primary-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(232,121,249,0.3)] group-hover:scale-110 transition-transform duration-300">
                           <Mic className="w-10 h-10 text-primary-400 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                      
                      <div className="text-center">
                        <p className="text-zinc-400 font-medium">Click to Record</p>
                        <button 
                           onClick={() => fileInputRef.current?.click()}
                           className="text-primary-500 text-sm font-semibold hover:underline mt-2 flex items-center justify-center gap-1 mx-auto"
                        >
                          <Upload className="w-3 h-3" /> Upload File
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept="audio/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col justify-between">
                   <div className="flex flex-col items-center justify-center flex-1 gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary-500/10 border border-primary-500/50 flex items-center justify-center">
                         <Check className="w-8 h-8 text-primary-500" />
                      </div>
                      <div className="text-center">
                         <div className="text-2xl font-bold text-white mb-1">
                            {audioBlob instanceof File ? 'File Ready' : 'Captured'}
                         </div>
                         <div className="text-zinc-500 font-mono text-sm max-w-[200px] truncate">
                            {audioBlob instanceof File ? audioBlob.name : formatTime(recordingTime)}
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col gap-3 mt-6">
                      <button
                        onClick={handleProcess}
                        disabled={appState.status === 'processing'}
                        className="w-full py-3.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(192,38,211,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {appState.status === 'processing' ? <Loader2 className="animate-spin w-5 h-5" /> : "Translate Audio"}
                      </button>
                      <button
                        onClick={handleReset}
                        className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
                      >
                        Discard
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Module (Right) */}
          <div className="md:col-span-7 bg-card border border-border rounded-2xl p-8 flex flex-col h-full min-h-[450px]">
             <h2 className="text-white font-semibold text-xl mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-500" />
              Live Output
            </h2>

            <div className="flex-1 flex flex-col gap-4 relative">
              
              {(!appState.transcript && !appState.translation) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10">
                    <Globe className="w-24 h-24 mb-4" />
                    <p className="text-xl font-light">Awaiting Data</p>
                 </div>
              )}

              {appState.transcript && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 animate-in slide-in-from-bottom-2 fade-in">
                   <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Original Transcript</div>
                   <p className="text-zinc-300 leading-relaxed text-lg">{appState.transcript}</p>
                </div>
              )}

              {appState.translation && (
                <div className="bg-zinc-900 border border-primary-900/30 rounded-xl p-6 flex-1 flex flex-col animate-in slide-in-from-bottom-4 fade-in">
                   <div className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-3">Translation</div>
                   <p className="text-white text-2xl font-medium leading-relaxed mb-6">{appState.translation}</p>
                   
                   <div className="mt-auto pt-6 border-t border-zinc-800 flex items-center justify-between">
                      {appState.audioUrl && (
                        <button 
                           onClick={() => resultAudioRef.current?.play()}
                           className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white font-medium transition-colors"
                        >
                          <Volume2 className="w-4 h-4" /> Play TTS
                        </button>
                      )}
                      
                      <button 
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copied" : "Copy Text"}
                      </button>
                   </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {appState.error && (
              <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm font-medium text-center">
                Error: {appState.error}
              </div>
            )}
          </div>

        </div>
        
        <footer className="mt-12 text-center">
           <p className="text-zinc-600 text-sm">Developed by Team K.A.C</p>
        </footer>

      </div>

      {appState.audioUrl && (
          <audio ref={resultAudioRef} src={appState.audioUrl} className="hidden" />
      )}
    </div>
  );
};

export default App;