import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Download, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import 'katex/dist/katex.min.css';
import { Portal } from './Portal';
import { saveAs } from 'file-saver';
import Latex from 'react-latex-next';

// Define Settings Types (repeated here or shared)
interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

interface AppSettings {
    reasoning: ApiConfig;
    vision: ApiConfig;
}

interface InteractiveBadgeProps {
  content: string; // The LaTeX content or context
  title?: string;
  fullContext?: string;
  settings?: AppSettings | null;
}

export function InteractiveBadge({ content, title = "Physics Model Analysis", fullContext, settings }: InteractiveBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [verticalAlign, setVerticalAlign] = useState("-50%");
  const [analysis, setAnalysis] = useState<{ explanation: string, visualization: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setIsLoading(true);
      try {
          const body: any = { context: content, fullContext: fullContext };
          // Attach reasoning config if available
          if (settings?.reasoning?.apiKey) {
              body.reasoningConfig = settings.reasoning;
          }
          // Attach vision config (used for visualization) if available
          if (settings?.vision?.apiKey) {
              body.visionConfig = settings.vision;
          }

          const response = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });
          if (!response.ok) throw new Error("Analysis failed");
          const data = await response.json();
          setAnalysis(data);
      } catch (error) {
          console.error(error);
          setAnalysis({
              explanation: "Failed to load analysis. Error: " + (error as Error).message + ". Please ensure your API Key is correctly configured in settings.",
              visualization: ""
          });
      } finally {
          setIsLoading(false);
      }
    };

    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Calculate vertical alignment based on viewport position
      let alignY = "-50%";
      if (rect.top < 250) {
          // Too close to top
          alignY = "0%";
      } else if (rect.bottom > viewportHeight - 250) {
          // Too close to bottom
          alignY = "-100%";
      }
      setVerticalAlign(alignY);

      setPosition({
        top: rect.top + rect.height / 2 + window.scrollY,
        left: rect.left + window.scrollX
      });

      // Fetch Analysis if not already loaded
      if (!analysis && !isLoading) {
         fetchAnalysis();
      }
    }
  }, [isOpen, analysis, isLoading, content, fullContext]);

  // Close on scroll to avoid detached popup
  useEffect(() => {
     const handleResize = () => { if(isOpen) setIsOpen(false); };
     window.addEventListener('resize', handleResize);
     return () => {
        window.removeEventListener('resize', handleResize);
     };
  }, [isOpen]);

  return (
    <>
      {/* The Pulsing Dot */}
      <motion.button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.7)] cursor-pointer z-10 relative inline-flex ml-2 align-middle",
          !isOpen && "animate-pulse-slow"
        )}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      />

      {/* The Expanded Window */}
      <AnimatePresence>
        {isOpen && (
          <Portal>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: "calc(-100% + 10px)", y: verticalAlign }}
              animate={{ opacity: 1, scale: 1, x: "-100%", y: verticalAlign }}
              exit={{ opacity: 0, scale: 0.9, x: "calc(-100% + 10px)", y: verticalAlign }}
              style={{
                position: 'absolute',
                top: position.top,
                left: position.left - 20, // 20px gap
                transformOrigin: `right ${verticalAlign === "-50%" ? "center" : verticalAlign === "0%" ? "top" : "bottom"}`
              }}
              className="w-96 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-4 z-[9999] text-zinc-100 max-h-[500px] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-green-400">
                  <Info size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => {
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        saveAs(blob, 'equation_fragment.tex');
                     }}
                     className="text-zinc-500 hover:text-green-400 transition-colors" 
                     title="Download Fragment"
                   >
                      <Download size={14} />
                   </button>
                   <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Close">
                      <X size={18} />
                   </button>
                </div>
              </div>
              
              <div className="text-sm text-zinc-400 mb-3 leading-relaxed">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 py-4">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Analyzing with AI...</span>
                    </div>
                ) : analysis ? (
                    <div className="space-y-4">
                        <div className="text-sm text-zinc-300">
                            <Latex>{analysis.explanation}</Latex>
                        </div>
                        {analysis.visualization && (
                            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black relative min-h-[200px]">
                                <iframe 
                                    srcDoc={`
                                        <html>
                                        <head>
                                            <style>body { margin: 0; overflow: hidden; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; }</style>
                                            <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
                                            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                                        </head>
                                        <body>
                                            ${analysis.visualization}
                                        </body>
                                        </html>
                                    `}
                                    className="w-full h-[300px] border-none"
                                    title="Visualization"
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    "Click to load analysis."
                )}
              </div>

              <div className="bg-zinc-900 p-2 rounded-md border border-zinc-800 mb-3 overflow-x-auto text-xs font-mono text-zinc-500 max-h-20 overflow-y-auto">
                 {content}
              </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </>
  );
}