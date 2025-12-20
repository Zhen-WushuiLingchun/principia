import { useRef, useState, useEffect } from 'react';
import CanvasDraw from 'react-canvas-draw';
import { Eraser, Pencil, RefreshCw, FileImage, Plus, Hand } from 'lucide-react';

interface HandwritingCanvasProps {
  onRecognize: (imageData: string) => Promise<void>;
  isRecognizing: boolean;
  savedData?: string;
  onSave?: (data: string) => void;
}

export function HandwritingCanvas({ onRecognize, isRecognizing, savedData, onSave }: HandwritingCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushRadius, setBrushRadius] = useState(2);
  const [isEraser, setIsEraser] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 1200 }); // Initial A4-ish height

  // Load saved data on mount
  useEffect(() => {
    if (savedData && canvasRef.current) {
      canvasRef.current.loadSaveData(savedData, true);
    }
  }, [savedData]);

  // Handle Resize - just width
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('canvas-container');
      if (container) {
        setDimensions(prev => ({
            ...prev,
            width: container.offsetWidth,
        }));
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-expand height when drawing near bottom
  const checkAutoExpand = (e: React.MouseEvent | React.TouchEvent) => {
      if (!scrollContainerRef.current || isPanMode) return;
      
      const container = scrollContainerRef.current;
      const threshold = 300; // Increased threshold for easier expansion
      
      // Calculate cursor Y position relative to the container content
      let clientY = 0;
      if ('touches' in e) {
          clientY = e.touches[0].clientY;
      } else {
          clientY = (e as React.MouseEvent).clientY;
      }
      
      const rect = container.getBoundingClientRect();
      const relativeY = clientY - rect.top + container.scrollTop;
      
      if (relativeY > dimensions.height - threshold) {
          // Expand by another "page" (approx 800px)
          setDimensions(prev => ({
              ...prev,
              height: prev.height + 800
          }));
      }
  };

  const handleAddPage = () => {
      setDimensions(prev => ({
          ...prev,
          height: prev.height + 800
      }));
      // Scroll to new page
      setTimeout(() => {
          if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                  top: scrollContainerRef.current.scrollHeight,
                  behavior: 'smooth'
              });
          }
      }, 100);
  };

  const handleInteractionEnd = () => {
      if (canvasRef.current && onSave) {
          const data = canvasRef.current.getSaveData();
          onSave(data);
      }
  };

  const handleClear = () => {
    canvasRef.current?.clear();
    if (onSave) onSave("");
  };

  const handleRecognize = () => {
    if (canvasRef.current) {
        // Get data URL (it might be transparent, so we might need to composite it over black)
        // CanvasDraw exports a transparent PNG. We want a black background for the AI to see clearly if we write in white.
        const canvas = canvasRef.current.canvas.drawing;
        // const ctx = canvas.getContext('2d');
        
        // Create a temporary canvas to flatten the image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        if (tempCtx) {
            // Fill black background
            tempCtx.fillStyle = '#000000';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw original canvas on top
            tempCtx.drawImage(canvas, 0, 0);
            
            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
            onRecognize(dataUrl);
        }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] border-r border-zinc-900 relative" id="canvas-container">
       <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-zinc-900/80 p-1.5 rounded-lg border border-zinc-800 backdrop-blur-sm">
          <button 
            onClick={() => { setIsPanMode(false); setIsEraser(false); setBrushColor("#ffffff"); setBrushRadius(2); }}
            className={`p-2 rounded-md transition-colors ${!isPanMode && !isEraser ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="Pencil"
          >
            <Pencil size={16} />
          </button>
          <button 
            onClick={() => { setIsPanMode(false); setIsEraser(true); setBrushColor("#0a0a0a"); setBrushRadius(10); }}
            className={`p-2 rounded-md transition-colors ${!isPanMode && isEraser ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="Eraser"
          >
            <Eraser size={16} />
          </button>
          <button 
            onClick={() => setIsPanMode(!isPanMode)}
            className={`p-2 rounded-md transition-colors ${isPanMode ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
            title="Pan/Scroll Mode"
          >
            <Hand size={16} />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1"></div>
          <button 
            onClick={handleAddPage}
            className="p-2 text-zinc-400 hover:text-white transition-colors rounded-md"
            title="Add New Page"
          >
            <Plus size={16} />
          </button>
          <button 
            onClick={handleClear}
            className="p-2 text-zinc-400 hover:text-red-400 transition-colors rounded-md"
            title="Clear"
          >
            <RefreshCw size={16} />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1"></div>
          <button
            onClick={handleRecognize}
            disabled={isRecognizing}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-xs transition-all ${
                isRecognizing 
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
            title="Recognize Handwriting"
          >
             {isRecognizing ? (
                 <RefreshCw size={14} className="animate-spin" />
             ) : (
                 <FileImage size={14} />
             )}
             {isRecognizing ? 'Processing...' : 'Recognize'}
          </button>
       </div>

       <div 
         ref={scrollContainerRef}
         className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative touch-pan-y ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
         style={{ touchAction: isPanMode ? 'pan-y' : 'none' }}
         onMouseUp={handleInteractionEnd}
         onTouchEnd={handleInteractionEnd}
         onMouseMove={checkAutoExpand}
         onTouchMove={checkAutoExpand}
       >
          <div style={{ height: dimensions.height, width: dimensions.width }} className="relative">
              {/* Page Separators Visualization */}
              {Array.from({ length: Math.ceil(dimensions.height / 800) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-full border-b border-dashed border-zinc-800 pointer-events-none flex items-center justify-end pr-4"
                    style={{ top: (i + 1) * 800, left: 0 }}
                  >
                     <span className="text-xs text-zinc-700 font-mono">Page {i + 1} / {i + 2}</span>
                  </div>
              ))}
              
              <div className={isPanMode ? 'pointer-events-none' : ''}>
                <CanvasDraw
                    ref={canvasRef}
                    brushColor={brushColor}
                    brushRadius={brushRadius}
                    lazyRadius={2}
                    canvasWidth={dimensions.width}
                    canvasHeight={dimensions.height}
                    backgroundColor="#0a0a0a"
                    hideGrid={true}
                    className="absolute top-0 left-0"
                />
              </div>
          </div>
       </div>
    </div>
  );
}
