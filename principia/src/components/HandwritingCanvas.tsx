import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Eraser, Pencil, RefreshCw, FileImage, Plus, Grid3X3, AlignJustify, Square, Palette, Circle } from 'lucide-react';

const PAGE_HEIGHT = 1200;

// Debounce function to optimize performance
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export interface HandwritingCanvasRef {
  getCanvasImages: () => Promise<string[]>;
}

export type BackgroundType = 'blank' | 'lines' | 'grid';

interface HandwritingCanvasProps {
  onRecognize: (imageData: string, pageIndex?: number) => Promise<void>;
  onSmartRecognize?: (changedPages: { pageIndex: number; imageData: string }[]) => Promise<void>;
  isRecognizing: boolean;
  savedData?: string;
  onSave?: (data: string) => void;
  // New props for state persistence
  backgroundType?: BackgroundType;
  backgroundSpacing?: number;
  onBackgroundChange?: (type: BackgroundType, spacing: number) => void;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

interface Line {
  points: { x: number; y: number }[];
  brushColor: string;
  brushRadius: number;
  isEraser: boolean;
}

export const HandwritingCanvas = forwardRef<HandwritingCanvasRef, HandwritingCanvasProps>(({ 
  onRecognize, 
  onSmartRecognize, 
  isRecognizing, 
  savedData, 
  onSave,
  backgroundType: propBackgroundType = 'blank',
  backgroundSpacing: propBackgroundSpacing = 40,
  onBackgroundChange,
  initialPage = 0,
  onPageChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // State for lines
  const [lines, setLines] = useState<Line[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);

  // Color palette with simplified preset colors
  const colorPalette = [
    "#ffffff", // White (default)
    "#ff4757", // Red
  ];
  
  // Use props for background state if provided, otherwise use local state (though we expect props now)
  const [localBackgroundType, setLocalBackgroundType] = useState<BackgroundType>(propBackgroundType);
  const [localBackgroundSpacing, setLocalBackgroundSpacing] = useState(propBackgroundSpacing);
  
  // Sync local state with props when props change
  useEffect(() => {
    setLocalBackgroundType(propBackgroundType);
  }, [propBackgroundType]);

  useEffect(() => {
    setLocalBackgroundSpacing(propBackgroundSpacing);
  }, [propBackgroundSpacing]);

  // Handler to update background
  const handleBackgroundChange = (type: BackgroundType, spacing: number) => {
    setLocalBackgroundType(type);
    setLocalBackgroundSpacing(spacing);
    if (onBackgroundChange) {
      onBackgroundChange(type, spacing);
    }
  };

  const backgroundType = localBackgroundType;
  const backgroundSpacing = localBackgroundSpacing;
  
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [penRadius, setPenRadius] = useState(2);
  const [eraserRadius, setEraserRadius] = useState(10);
  const [isEraser, setIsEraser] = useState(false);
  const currentRadius = isEraser ? eraserRadius : penRadius;
  const [isPanMode, setIsPanMode] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: PAGE_HEIGHT }); // Initial A4-ish height
  
  // Current page state
  const [currentPage, setCurrentPage] = useState(initialPage);

  
  // Menu visibility states
  const [activeMenu, setActiveMenu] = useState<'none' | 'color' | 'stroke' | 'background'>('none');
  
  // Track last saved data to prevent re-loading own changes
  const lastSavedData = useRef<string>("");
  
  // Track last recognized state (hash or simple line count per page) to optimize requests
  const lastRecognizedState = useRef<{[page: number]: string}>({});

  // Debounced save function to optimize performance
  const debouncedSave = useCallback(
    debounce((data: string) => {
      if (onSave) {
        lastSavedData.current = data;
        onSave(data);
      }
    }, 1000), // 1 second delay
    [onSave]
  );

  // Serialize lines to string (kept for potential future use or debugging)
  // const getSaveData = useCallback(() => {
  //   return JSON.stringify({
  //     lines: lines,
  //     width: dimensions.width,
  //     height: dimensions.height
  //   });
  // }, [lines, dimensions]);

  // Load saved data
  const loadSaveData = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.lines) {
        setLines(parsed.lines);
      }
      if (parsed.width && parsed.height) {
        setDimensions({ width: parsed.width, height: parsed.height });
      }
    } catch (e) {
      console.error("Failed to load save data", e);
    }
  }, []);

  // Redraw canvas whenever lines change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all lines
    const drawLine = (line: Line) => {
      if (line.points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      
      for (let i = 1; i < line.points.length; i++) {
        // Simple smoothing could be added here (quadratic curves)
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = line.brushRadius * 2; // Radius to Width

      if (line.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.brushColor;
      }
      
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset
    };

    lines.forEach(drawLine);
    if (currentLine) drawLine(currentLine);

  }, [lines, currentLine]);

  // Trigger redraw when lines or currentLine changes
  useEffect(() => {
    // We use requestAnimationFrame for better performance
    let animId: number;
    const render = () => {
        redraw();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [redraw]);

  // Update canvas size
  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;
          redraw(); // Redraw after resize
      }
  }, [dimensions, redraw]);


  // Pointer Events for Drawing
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPanMode) return;
    // Capture pointer
    (e.target as Element).setPointerCapture(e.pointerId);
    
    setIsDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentLine({
      points: [{ x, y }],
      brushColor: brushColor,
      brushRadius: currentRadius,
      isEraser: isEraser
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentLine) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentLine(prev => {
        if (!prev) return null;
        return {
            ...prev,
            points: [...prev.points, { x, y }]
        };
    });
    
    // Auto expand check
    if (scrollContainerRef.current) {
        const relativeY = y; // Already relative to canvas top
        // Canvas height might be larger than viewport, we need to check if we are near bottom of canvas
        if (relativeY > dimensions.height - 300) {
             setDimensions(prev => ({
              ...prev,
              height: prev.height + PAGE_HEIGHT
            }));
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
    
    if (currentLine) {
        const newLines = [...lines, currentLine];
        setLines(newLines);
        setCurrentLine(null);
        debouncedSave(JSON.stringify({ lines: newLines, width: dimensions.width, height: dimensions.height }));
    }
  };


  // Helper to get image data for a specific page area
  const getPageImageData = (canvas: HTMLCanvasElement, pageIndex: number, pageHeight: number = PAGE_HEIGHT): string | null => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = pageHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return null;
    
    // 1. Fill background color
    tempCtx.fillStyle = '#0a0a0a'; // Match screen background
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // 2. Draw Background Pattern (Lines/Grid)
    tempCtx.strokeStyle = '#333333';
    tempCtx.lineWidth = 1;
    
    const gridSize = backgroundSpacing;
    const lineHeight = backgroundSpacing;
    const pageStartY = pageIndex * pageHeight;

    if (backgroundType === 'lines') {
        // Calculate first line y-coordinate relative to page top
        // The global y is (k * lineHeight). We want y >= pageStartY.
        // first k such that k * lineHeight >= pageStartY is ceil(pageStartY / lineHeight)
        let startK = Math.ceil(pageStartY / lineHeight);
        if (startK * lineHeight === pageStartY) startK++; // Don't draw on very top edge if it matches exact
        
        for (let yGlobal = startK * lineHeight; yGlobal < pageStartY + pageHeight; yGlobal += lineHeight) {
            const yLocal = yGlobal - pageStartY;
            tempCtx.beginPath();
            tempCtx.moveTo(0, yLocal);
            tempCtx.lineTo(tempCanvas.width, yLocal);
            tempCtx.stroke();
        }
    } else if (backgroundType === 'grid') {
        // Horizontal lines
        let startK = Math.ceil(pageStartY / gridSize);
        if (startK * gridSize === pageStartY) startK++;
        
        for (let yGlobal = startK * gridSize; yGlobal < pageStartY + pageHeight; yGlobal += gridSize) {
            const yLocal = yGlobal - pageStartY;
            tempCtx.beginPath();
            tempCtx.moveTo(0, yLocal);
            tempCtx.lineTo(tempCanvas.width, yLocal);
            tempCtx.stroke();
        }
        
        // Vertical lines (same for all pages)
        for (let x = gridSize; x < tempCanvas.width; x += gridSize) {
            tempCtx.beginPath();
            tempCtx.moveTo(x, 0);
            tempCtx.lineTo(x, tempCanvas.height);
            tempCtx.stroke();
        }
    }

    // 3. Draw strokes from original canvas
    const sourceY = pageIndex * pageHeight;
    
    // Check if sourceY is beyond canvas bounds
    if (sourceY >= canvas.height) return null;
    
    tempCtx.drawImage(
        canvas, 
        0, sourceY, canvas.width, Math.min(pageHeight, canvas.height - sourceY), 
        0, 0, canvas.width, Math.min(pageHeight, canvas.height - sourceY)
    );
    
    return tempCanvas.toDataURL('image/jpeg', 0.8);
  };

  useImperativeHandle(ref, () => ({
      getCanvasImages: async () => {
          if (!canvasRef.current) return [];
          const canvas = canvasRef.current;
          const totalPages = Math.ceil(dimensions.height / PAGE_HEIGHT);
          const images: string[] = [];
          
          for (let i = 0; i < totalPages; i++) {
              const img = getPageImageData(canvas, i, PAGE_HEIGHT);
              if (img) images.push(img);
          }
          return images;
      }
  }));

  // Load saved data on mount or external change
  useEffect(() => {
    // Only load if data exists and is different from what we just saved
    if (savedData && savedData !== lastSavedData.current) {
      loadSaveData(savedData);
      lastSavedData.current = savedData;
    }
  }, [savedData, loadSaveData]);

  // Scroll to initial page on mount
  useEffect(() => {
    if (initialPage > 0 && scrollContainerRef.current) {
        // We need to wait for layout
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    top: initialPage * PAGE_HEIGHT,
                    behavior: 'instant' // Instant restore
                });
            }
        }, 100);
    }
  }, [initialPage]);

  // Track scroll position
  useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const handleScroll = () => {
          const scrollTop = container.scrollTop;
          const page = Math.floor(scrollTop / PAGE_HEIGHT);
          if (page !== currentPage) {
              setCurrentPage(page);
              if (onPageChange) {
                  onPageChange(page);
              }
          }
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPage, onPageChange]);

  // Handle Resize using ResizeObserver
  useEffect(() => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
             setDimensions(prev => {
                 if (Math.abs(prev.width - width) > 1 || prev.height < height) {
                     return {
                         width: width,
                         height: Math.max(prev.height, height)
                     };
                 }
                 return prev;
             });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Multi-touch Logic for Auto-Pan
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
            setIsPanMode(true);
        } else if (e.touches.length === 1 && !isEraser && activeMenu === 'none') {
            setIsPanMode(false);
        }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => {
        container.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isEraser, activeMenu]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.toolbar-container')) {
        setActiveMenu('none');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddPage = () => {
      setDimensions(prev => ({
          ...prev,
          height: prev.height + PAGE_HEIGHT
      }));
      setTimeout(() => {
          if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                  top: scrollContainerRef.current.scrollHeight,
                  behavior: 'smooth'
              });
          }
      }, 100);
  };

  const handleClear = () => {
    setLines([]);
    debouncedSave(JSON.stringify({ lines: [], width: dimensions.width, height: dimensions.height }));
    lastRecognizedState.current = {}; 
  };

  // Background drawing function
  const drawBackground = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set grid/line color
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    const gridSize = backgroundSpacing;
    const lineHeight = backgroundSpacing;
    
    switch (backgroundType) {
      case 'lines':
        for (let y = lineHeight; y < canvas.height; y += lineHeight) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        break;
      case 'grid':
        for (let y = gridSize; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        for (let x = gridSize; x < canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        break;
      case 'blank':
      default:
        break;
    }
  }, [backgroundType, backgroundSpacing]);

  // Update background when backgroundType or dimensions change
  useEffect(() => {
    const backgroundCanvas = document.getElementById('background-canvas') as HTMLCanvasElement;
    if (backgroundCanvas) {
      backgroundCanvas.width = dimensions.width;
      backgroundCanvas.height = dimensions.height;
      drawBackground(backgroundCanvas);
    }
  }, [backgroundType, dimensions, drawBackground]);

  const handleRecognize = async () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current; // Real canvas
    
    // Calculate total pages
    const totalPages = Math.ceil(dimensions.height / PAGE_HEIGHT);
    const changedPages: { pageIndex: number; imageData: string }[] = [];
    
    for (let i = 0; i < totalPages; i++) {
        const pageStart = i * PAGE_HEIGHT;
        const pageEnd = (i + 1) * PAGE_HEIGHT;
        
        const pageLines = lines.filter((line) => {
            return line.points.some((p) => p.y >= pageStart && p.y < pageEnd);
        });
        
        if (pageLines.length === 0) continue; 
        
        const signature = `${pageLines.length}-${pageLines.reduce((acc, l) => acc + l.points.length, 0)}`;
        
        if (lastRecognizedState.current[i] !== signature) {
            const imageData = getPageImageData(canvas, i, PAGE_HEIGHT);
            if (imageData) {
                changedPages.push({ pageIndex: i, imageData });
                lastRecognizedState.current[i] = signature;
            }
        }
    }
    
    if (changedPages.length > 0) {
        if (onSmartRecognize) {
            await onSmartRecognize(changedPages);
        } else {
            const fullImageData = getPageImageData(canvas, 0, dimensions.height);
            if (fullImageData) onRecognize(fullImageData);
        }
    } else {
        if (Object.keys(lastRecognizedState.current).length > 0) {
             lastRecognizedState.current = {};
             handleRecognize();
        }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] border-r border-zinc-900 relative" id="canvas-container">
       <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2 max-w-[95vw] pointer-events-none toolbar-container">
           {/* Main Toolbar */}
           <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-lg border border-zinc-800 backdrop-blur-md shadow-xl overflow-x-auto no-scrollbar pointer-events-auto max-w-full">
              
              <button 
                onClick={() => { setIsPanMode(false); setIsEraser(false); if(brushColor==='#0a0a0a') setBrushColor('#ffffff'); }}
                className={`p-2 rounded-md transition-colors ${!isPanMode && !isEraser ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                title="Pencil"
              >
                <Pencil size={18} />
              </button>
              
              {/* Stroke Width Toggle */}
              <button
                 onClick={() => setActiveMenu(activeMenu === 'stroke' ? 'none' : 'stroke')}
                 className={`p-2 rounded-md transition-all flex items-center gap-1 ${activeMenu === 'stroke' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                 title="Stroke Width"
               >
                  <Circle size={14} fill="currentColor" className="opacity-70" />
                  <span className="text-xs font-mono hidden sm:inline">{currentRadius}</span>
               </button>

              <button 
                onClick={() => { setIsPanMode(false); setIsEraser(true); setBrushColor("#0a0a0a"); }}
                className={`p-2 rounded-md transition-colors ${!isPanMode && isEraser ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                title="Eraser"
              >
                <Eraser size={18} />
              </button>
              
              <div className="w-px h-5 bg-zinc-800 mx-1"></div>

              {/* Color Palette Toggle */}
              <button 
                onClick={() => setActiveMenu(activeMenu === 'color' ? 'none' : 'color')}
                className={`p-2 rounded-md transition-all flex items-center gap-1 ${activeMenu === 'color' ? 'bg-zinc-800' : ''}`}
                title="Color Palette"
              >
                <Palette size={18} className={activeMenu === 'color' ? 'text-white' : 'text-zinc-400'} />
                <div 
                  className="w-3 h-3 rounded-full border border-zinc-600 shadow-sm"
                  style={{ backgroundColor: brushColor === '#0a0a0a' ? '#ffffff' : brushColor }}
                ></div>
              </button>
              
               {/* Background Settings Toggle */}
               <button 
                  onClick={() => setActiveMenu(activeMenu === 'background' ? 'none' : 'background')}
                  className={`p-2 rounded-md transition-all flex items-center gap-1 ${activeMenu === 'background' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  title="Background Settings"
                >
                  {backgroundType === 'blank' && <Square size={18} />}
                  {backgroundType === 'lines' && <AlignJustify size={18} />}
                  {backgroundType === 'grid' && <Grid3X3 size={18} />}
                </button>
              
              <div className="w-px h-5 bg-zinc-800 mx-1"></div>

              <button 
                onClick={handleAddPage}
                className="p-2 text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-800"
                title="Add New Page"
              >
                <Plus size={18} />
              </button>
              <button 
                onClick={handleClear}
                className="p-2 text-zinc-400 hover:text-red-400 transition-colors rounded-md hover:bg-zinc-800"
                title="Clear"
              >
                <RefreshCw size={18} />
              </button>
              
              <div className="w-px h-5 bg-zinc-800 mx-1"></div>
              
              <button
                onClick={handleRecognize}
                disabled={isRecognizing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-xs transition-all ${
                    isRecognizing 
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                }`}
                title="Recognize Handwriting"
              >
                 {isRecognizing ? (
                     <RefreshCw size={14} className="animate-spin" />
                 ) : (
                     <FileImage size={14} />
                 )}
                 <span className="hidden sm:inline">{isRecognizing ? 'Processing...' : 'Recognize'}</span>
                 <span className="sm:hidden">{isRecognizing ? '...' : 'AI'}</span>
              </button>
           </div>
           
           {/* Side Panels (Popups next to toolbar) */}
           <div className="flex flex-col gap-2 pointer-events-auto">
               {activeMenu === 'stroke' && (
                  <div className="bg-zinc-900/95 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3 shadow-xl backdrop-blur-md min-w-[150px] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Stroke Width: {currentRadius}px</div>
                      <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          step="1"
                          value={currentRadius}
                          onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (isEraser) setEraserRadius(val);
                              else setPenRadius(val);
                          }}
                          className="w-full accent-white h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                          <span>1px</span>
                          <span>20px</span>
                      </div>
                  </div>
               )}
               
               {activeMenu === 'color' && (
                   <div className="bg-zinc-900/95 border border-zinc-800 rounded-lg p-2 flex flex-wrap gap-2 shadow-xl backdrop-blur-md max-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200">
                       {colorPalette.map(color => (
                           <button
                               key={color}
                               onClick={() => { 
                                   setBrushColor(color); 
                                   if(isEraser) setIsEraser(false);
                                   // If selecting white/color, ensure we are not in eraser mode
                                   setActiveMenu('none');
                               }}
                               className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${brushColor === color && !isEraser ? 'border-white scale-110' : 'border-transparent'}`}
                               style={{ backgroundColor: color }}
                               title={color}
                           />
                       ))}
                       
                       {/* Custom Color Picker */}
                       <label className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center bg-gradient-to-br from-red-500 via-green-500 to-blue-500 cursor-pointer relative overflow-hidden ${!colorPalette.includes(brushColor) && !isEraser ? 'border-white scale-110' : 'border-transparent'}`} title="Custom Color">
                           <input 
                               type="color" 
                               value={brushColor}
                               onChange={(e) => {
                                   setBrushColor(e.target.value);
                                   if(isEraser) setIsEraser(false);
                               }}
                               className="opacity-0 w-full h-full absolute inset-0 cursor-pointer"
                           />
                       </label>
                   </div>
               )}
               
               {activeMenu === 'background' && (
                   <div className="bg-zinc-900/95 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3 shadow-xl backdrop-blur-md min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Type</div>
                        <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg">
                            <button 
                                onClick={() => handleBackgroundChange('blank', backgroundSpacing)}
                                className={`flex-1 py-1.5 rounded-md flex justify-center transition-colors ${backgroundType === 'blank' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Blank"
                            >
                                <Square size={16} />
                            </button>
                            <button 
                                onClick={() => handleBackgroundChange('lines', backgroundSpacing)}
                                className={`flex-1 py-1.5 rounded-md flex justify-center transition-colors ${backgroundType === 'lines' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Lined"
                            >
                                <AlignJustify size={16} />
                            </button>
                            <button 
                                onClick={() => handleBackgroundChange('grid', backgroundSpacing)}
                                className={`flex-1 py-1.5 rounded-md flex justify-center transition-colors ${backgroundType === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Grid"
                            >
                                <Grid3X3 size={16} />
                            </button>
                        </div>
                        
                        {(backgroundType === 'lines' || backgroundType === 'grid') && (
                            <>
                                <div className="h-px bg-zinc-800 my-1"></div>
                                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Spacing: {backgroundSpacing}px</div>
                                <input 
                                    type="range" 
                                    min="20" 
                                    max="100" 
                                    step="5"
                                    value={backgroundSpacing}
                                    onChange={(e) => handleBackgroundChange(backgroundType, parseInt(e.target.value))}
                                    className="w-full accent-white h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                    <span>20px</span>
                                    <span>100px</span>
                                </div>
                            </>
                        )}
                   </div>
               )}
           </div>
       </div>

       <div 
         ref={scrollContainerRef}
         className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative touch-pan-y ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
         style={{ touchAction: isPanMode ? 'pan-y' : 'none' }}
       >
          <div style={{ height: dimensions.height, width: dimensions.width }} className="relative">
              {/* Page Indicators */}
              {Array.from({ length: Math.ceil(dimensions.height / PAGE_HEIGHT) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="absolute w-full pointer-events-none border-b border-dashed border-zinc-800"
                    style={{ top: (i + 1) * PAGE_HEIGHT, height: 0, left: 0 }}
                  />
              ))}
              
              {/* Page Numbers */}
              {Array.from({ length: Math.ceil(dimensions.height / PAGE_HEIGHT) }).map((_, i) => (
                  <div 
                    key={`num-${i}`} 
                    className="absolute pointer-events-none text-xs text-zinc-600 font-mono font-medium bg-zinc-900/50 px-2 py-1 rounded"
                    style={{ top: (i + 1) * PAGE_HEIGHT - 32, right: 16 }}
                  >
                     {i + 1}
                  </div>
              ))}
              
              {/* Background Canvas */}
              <canvas
                id="background-canvas"
                className="absolute top-0 left-0"
                style={{ backgroundColor: '#0a0a0a' }}
              />
              
              <div className={isPanMode ? 'pointer-events-none' : ''}>
                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0"
                    style={{ touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />
              </div>
          </div>
       </div>
    </div>
  );
});

HandwritingCanvas.displayName = 'HandwritingCanvas';
