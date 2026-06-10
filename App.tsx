
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateRecipe, generateDishImage, generateSupportingIngredients, generateAudioGuide } from './services/geminiService';
import { Recipe, AppState, SavedRecipe, AppStage } from './types';
import RecipeCard from './components/RecipeCard';

// Helper for audio decoding
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    stage: 'MAIN_INPUT',
    ingredients: '',
    suggestedStaples: [],
    selectedStaples: [],
    recipe: null,
    imageUrl: null,
    isProcessing: false,
    error: null
  });

  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('vibeplate_saved');
    if (stored) {
      try {
        setSavedRecipes(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved recipes", e);
      }
    }
    return () => {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const findSupportingItems = async () => {
    if (!state.ingredients.trim()) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    
    try {
      const suggestions = await generateSupportingIngredients(state.ingredients);
      setState(prev => ({
        ...prev,
        suggestedStaples: suggestions,
        isProcessing: false,
        stage: 'STAPLE_SELECTION'
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "Couldn't brainstorm staples. Try again?" }));
    }
  };

  const handleCookRequest = async () => {
    startCooking();
  };

  const startCooking = async () => {
    setState(prev => ({ ...prev, isProcessing: true, error: null, stage: 'RECIPE_GENERATION' }));
    
    try {
      const recipe = await generateRecipe(state.ingredients, state.selectedStaples);
      setState(prev => ({ ...prev, recipe }));

      try {
        const imageUrl = await generateDishImage(recipe.name);
        setState(prev => ({ ...prev, imageUrl, isProcessing: false, stage: 'RESULT' }));
      } catch (imgErr: any) {
        console.error("Image generation failed:", imgErr);
        setState(prev => ({ ...prev, isProcessing: false, stage: 'RESULT' }));
      }
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "The chef is tired. Please try again.", stage: 'STAPLE_SELECTION' }));
    }
  };

  const toggleStaple = (item: string) => {
    setState(prev => ({
      ...prev,
      selectedStaples: prev.selectedStaples.includes(item)
        ? prev.selectedStaples.filter(i => i !== item)
        : [...prev.selectedStaples, item]
    }));
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsPlaying(false);
      }
      return;
    }

    if (!state.recipe) return;
    
    setIsAudioLoading(true);
    try {
      const base64 = await generateAudioGuide(state.recipe);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioBuffer = await decodeAudioData(
        decodeBase64(base64),
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      
      audioSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error("Audio guide error:", err);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const saveToCollection = () => {
    if (!state.recipe) return;
    const newSaved: SavedRecipe = {
      ...state.recipe,
      id: crypto.randomUUID(),
      imageUrl: state.imageUrl,
      savedAt: Date.now()
    };
    const updated = [newSaved, ...savedRecipes];
    setSavedRecipes(updated);
    localStorage.setItem('vibeplate_saved', JSON.stringify(updated));
  };

  const removeSaved = (id: string) => {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    localStorage.setItem('vibeplate_saved', JSON.stringify(updated));
  };

  const reset = () => {
    if (audioSourceRef.current) audioSourceRef.current.stop();
    setIsPlaying(false);
    setState({
      stage: 'MAIN_INPUT',
      ingredients: '',
      suggestedStaples: [],
      selectedStaples: [],
      recipe: null,
      imageUrl: null,
      isProcessing: false,
      error: null
    });
  };

  const loadSaved = (item: SavedRecipe) => {
    setState({
      stage: 'RESULT',
      ingredients: '',
      suggestedStaples: [],
      selectedStaples: [],
      recipe: item,
      imageUrl: item.imageUrl,
      isProcessing: false,
      error: null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen selection:bg-zinc-900 selection:text-white pb-20 bg-[#fcfcfc]">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">V</span>
            </div>
            <span className="text-xl font-bold text-zinc-900 tracking-tighter">VibePlate</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
            <span className={state.stage === 'MAIN_INPUT' ? 'text-zinc-900' : 'text-zinc-300'}>1. Ingredients</span>
            <div className="w-4 h-[1px] bg-zinc-200"></div>
            <span className={state.stage === 'STAPLE_SELECTION' ? 'text-zinc-900' : 'text-zinc-300'}>2. Pantry</span>
            <div className="w-4 h-[1px] bg-zinc-200"></div>
            <span className={state.stage === 'RESULT' ? 'text-zinc-900' : 'text-zinc-300'}>3. Recipe</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-20">
        
        {state.stage === 'MAIN_INPUT' && (
          <div className="max-w-2xl mx-auto text-center space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-6xl md:text-7xl font-bold text-zinc-900 tracking-tight">
              Craft your <span className="text-zinc-400 italic">plate.</span>
            </h1>
            <p className="text-xl text-zinc-500 font-light leading-relaxed">
              VibePlate generates culinary masterpieces based on your ingredients.
            </p>
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={state.ingredients}
                onChange={(e) => setState(prev => ({ ...prev, ingredients: e.target.value }))}
                placeholder="Salmon, Cabbage, Potatoes..."
                className="w-full h-20 px-10 bg-white border border-zinc-200 rounded-[2.5rem] text-xl outline-none transition-all focus:ring-4 focus:ring-zinc-100 focus:border-zinc-300 shadow-sm"
                onKeyDown={(e) => e.key === 'Enter' && findSupportingItems()}
              />
              <button
                onClick={findSupportingItems}
                disabled={state.isProcessing || !state.ingredients.trim()}
                className="absolute right-3 top-3 bottom-3 px-10 bg-zinc-900 text-white rounded-[2rem] font-semibold transition-all hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-300"
              >
                {state.isProcessing ? 'Analysing...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {state.stage === 'STAPLE_SELECTION' && (
          <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <header className="text-center space-y-4">
              <button onClick={() => setState(prev => ({ ...prev, stage: 'MAIN_INPUT' }))} className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest mb-4">← Main Ingredients</button>
              <h2 className="text-4xl font-bold text-zinc-900">Scan your Pantry</h2>
              <p className="text-zinc-500">Pick supporting items. The AI uses these to style the dish.</p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {state.suggestedStaples.map(item => (
                <button
                  key={item}
                  onClick={() => toggleStaple(item)}
                  className={`p-6 rounded-3xl text-left border transition-all duration-300 ${
                    state.selectedStaples.includes(item)
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl translate-y-[-2px]'
                    : 'bg-white border-zinc-100 text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${state.selectedStaples.includes(item) ? 'bg-white border-white' : 'border-zinc-200'}`}></div>
                  </div>
                  <span className="font-semibold text-sm">{item}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-6 pt-10">
              <button
                onClick={handleCookRequest}
                disabled={state.isProcessing}
                className="px-16 py-6 bg-zinc-900 text-white rounded-[2.5rem] text-xl font-bold shadow-2xl hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all"
              >
                Generate Recipe
              </button>
              <div className="text-center space-y-2">
                <p className="text-xs text-zinc-400 font-medium">AI Visuals powered by Gemini Flash Image.</p>
              </div>
            </div>
          </div>
        )}

        {state.stage === 'RECIPE_GENERATION' && (
          <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-pulse text-center">
            <div className="w-16 h-16 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin"></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-zinc-900">VibePlate is Thinking</h3>
              <p className="text-zinc-400 italic">Rendering gourmet textures and balancing ingredients...</p>
            </div>
          </div>
        )}

        {state.stage === 'RESULT' && state.recipe && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[3rem] bg-zinc-100 shadow-2xl group">
              {state.imageUrl ? (
                <img src={state.imageUrl} alt={state.recipe.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 space-y-4 px-10 text-center">
                  <div className="p-6 bg-white/50 backdrop-blur rounded-[2rem] border border-zinc-100">
                    <span className="text-sm font-bold uppercase tracking-widest block mb-2 text-zinc-400">Visuals Unavailable</span>
                    <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">Image generation encountered an issue. You can still enjoy the recipe and audio guide.</p>
                  </div>
                </div>
              )}
              {state.imageUrl && (
                <div className="absolute top-6 right-6 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                   <span className="text-white text-[10px] font-bold tracking-widest uppercase">Gemini Visuals</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={reset} className="px-8 py-4 bg-white border border-zinc-200 text-zinc-900 rounded-full font-bold hover:border-zinc-900 transition-all">Start Over</button>
              <button 
                onClick={handlePlayAudio} 
                disabled={isAudioLoading}
                className={`px-8 py-4 rounded-full font-bold transition-all flex items-center gap-2 border ${
                  isPlaying ? 'bg-zinc-100 border-zinc-900 text-zinc-900' : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-900'
                }`}
              >
                {isAudioLoading ? (
                  <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isPlaying ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                  </svg>
                )}
                {isPlaying ? 'Stop Audio Guide' : isAudioLoading ? 'Preparing Guide...' : 'Audio Guide'}
              </button>
              <button onClick={saveToCollection} className="px-8 py-4 bg-zinc-900 text-white rounded-full font-bold hover:shadow-xl transition-all">Save to Collection</button>
            </div>

            {state.error && (
              <div className="max-w-md mx-auto text-center p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                <p className="text-zinc-600 text-sm font-medium">{state.error}</p>
              </div>
            )}

            <RecipeCard recipe={state.recipe} />
          </div>
        )}

        {state.stage === 'MAIN_INPUT' && savedRecipes.length > 0 && (
          <section className="mt-40 border-t border-zinc-100 pt-20">
            <h2 className="text-3xl font-bold text-zinc-900 mb-10 tracking-tight">Vibe Collection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {savedRecipes.map(item => (
                <div key={item.id} className="group cursor-pointer bg-white rounded-[2rem] border border-zinc-100 overflow-hidden hover:shadow-2xl transition-all duration-500" onClick={() => loadSaved(item)}>
                  <div className="aspect-video bg-zinc-50 relative overflow-hidden">
                    {item.imageUrl && <img src={item.imageUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />}
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeSaved(item.id); }}
                      className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-8">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-zinc-600 transition-colors">{item.name}</h3>
                    <p className="text-zinc-500 text-sm line-clamp-2 italic">"{item.description}"</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-40 text-center py-20 border-t border-zinc-50">
        <div className="flex flex-col items-center gap-4">
           <div className="flex items-center gap-6 opacity-30 grayscale transition-all hover:grayscale-0 hover:opacity-100">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Gemini 3 Flash</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Gemini 2.5 Image</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Flash TTS</span>
           </div>
           <p className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">VibePlate Culinary Companion &copy; 2025</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
