import { useState, useEffect } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from './components/Editor'
import { HandwritingCanvas } from './components/HandwritingCanvas'
import { Renderer } from './components/Renderer'
import { Download, Share2, Settings, PenTool, Type, X } from 'lucide-react'
import { saveAs } from 'file-saver'
import { motion, AnimatePresence } from 'framer-motion'
import { Portal } from './components/Portal'
import { SettingsSidebar } from './components/SettingsSidebar'

// Define Config Types to match SettingsSidebar
interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

interface AppSettings {
    reasoning: ApiConfig;
    vision: ApiConfig;
}

function App() {
  const [content, setContent] = useState<string>("")
  const [inputMode, setInputMode] = useState<'text' | 'handwriting'>('text');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [handwritingData, setHandwritingData] = useState<string>("");
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'tex' | 'md'>('tex');
  const [isConverting, setIsConverting] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  
  // Load language preference
  useEffect(() => {
      const savedLang = localStorage.getItem('principia_lang');
      if (savedLang === 'en' || savedLang === 'zh') {
          setLang(savedLang);
      }
  }, []);

  const handleLangChange = (newLang: 'en' | 'zh') => {
      setLang(newLang);
      localStorage.setItem('principia_lang', newLang);
  };
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load settings on mount
  useEffect(() => {
      const savedSettings = localStorage.getItem('the_principia_settings');
      if (savedSettings) {
          try {
              setSettings(JSON.parse(savedSettings));
          } catch (e) {
              console.error("Failed to load settings", e);
          }
      }
  }, []);

  const handleRecognize = async (imageData: string) => {
    setIsRecognizing(true);
    try {
        const body: any = { image: imageData };
        // Attach vision config if available
        if (settings?.vision?.apiKey) {
            body.visionConfig = settings.vision;
        }

        const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error('OCR Failed');
        
        const data = await response.json();
        // Append text to content
        setContent(prev => prev + '\n\n' + data.latex);
        
        // Switch back to text mode optionally, or stay in handwriting
        // setInputMode('text');
    } catch (error) {
        console.error(error);
        alert("Recognition failed. Please try again. " + (error as Error).message + ". Ensure API Key is set.");
    } finally {
        setIsRecognizing(false);
    }
  };

  const handleFormatSwitch = async (targetFormat: 'tex' | 'md') => {
    if (downloadFormat === targetFormat) return;
    
    // Check if content is empty or default placeholder
    if (!content || content.trim() === "") {
        setDownloadFormat(targetFormat);
        return;
    }

    const confirmMessage = lang === 'en'
        ? `Switching to ${targetFormat.toUpperCase()} format will use AI to restructure your document. \n\nThis process will rewrite formatting (headers, lists, etc.) to match ${targetFormat === 'tex' ? 'LaTeX' : 'Markdown'} standards.\n\nDo you want to proceed?`
        : `切换到 ${targetFormat.toUpperCase()} 格式将使用 AI 重构您的文档。\n\n此过程将重写格式（标题、列表等）以匹配 ${targetFormat === 'tex' ? 'LaTeX' : 'Markdown'} 标准。\n\n是否继续？`;

    const confirmSwitch = window.confirm(confirmMessage);

    if (!confirmSwitch) return;

    setIsConverting(true);
    try {
        const body: any = { 
            content: content, 
            targetFormat: targetFormat 
        };
        // Attach reasoning config if available
        if (settings?.reasoning?.apiKey) {
            body.reasoningConfig = settings.reasoning;
        }

        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error("Conversion failed");
        
        const data = await response.json();
        setContent(data.converted);
        setDownloadFormat(targetFormat);
        
    } catch (error) {
        console.error(error);
        alert("Format conversion failed. Please try again. " + (error as Error).message + ". Ensure API Key is set.");
    } finally {
        setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (downloadFormat === 'tex') {
        const texContent = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\title{Principia Export}
\\author{Generated by AI}
\\date{\\today}

\\begin{document}
\\maketitle

${content}

\\end{document}
`;
        const blob = new Blob([texContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'principia_export.tex');
    } else {
        // Markdown Export
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'principia_export.md');
    }
  };

  const handleDownloadLogo = () => {
      saveAs("/favicon.png", "Principia_Logo.png");
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsLogoModalOpen(true)} className="outline-none hover:opacity-80 transition-opacity">
            <img src="/favicon.png" alt="Logo" className="w-6 h-6 rounded-full bg-white" />
          </button>
          <span className="font-semibold tracking-tight text-zinc-100">Principia</span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 text-[10px] uppercase font-bold tracking-wider border border-zinc-800">Alpha</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 mr-2">
             <button 
                onClick={() => setInputMode('text')}
                className={`p-1.5 rounded-md transition-all ${inputMode === 'text' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Text Mode"
             >
                <Type size={14} />
             </button>
             <button 
                onClick={() => setInputMode('handwriting')}
                className={`p-1.5 rounded-md transition-all ${inputMode === 'handwriting' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Handwriting Mode"
             >
                <PenTool size={14} />
             </button>
          </div>
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <Share2 size={16} />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-2 text-zinc-500 hover:text-white transition-colors"
            title="API Settings"
          >
            <Settings size={16} />
            <span className="text-xs font-medium">API Settings</span>
          </button>
          
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
             <button 
                onClick={() => handleFormatSwitch('tex')}
                disabled={isConverting}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${downloadFormat === 'tex' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'} ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                TEX
             </button>
             <button 
                onClick={() => handleFormatSwitch('md')}
                disabled={isConverting}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${downloadFormat === 'md' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'} ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                MD
             </button>
          </div>

          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* @ts-expect-error - direction is required but missing in types */}
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={50} minSize={30} className="h-full">
             {inputMode === 'text' ? (
                <Editor value={content} onChange={setContent} />
             ) : (
                <HandwritingCanvas 
                    onRecognize={handleRecognize} 
                    isRecognizing={isRecognizing} 
                    savedData={handwritingData}
                    onSave={setHandwritingData}
                />
             )}
          </Panel>
          
          <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-blue-500 transition-colors cursor-col-resize" />
          
          <Panel defaultSize={50} minSize={30} className="h-full">
            <div className="h-full w-full bg-[#050505] overflow-hidden">
              <Renderer content={content} settings={settings} />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Settings Sidebar */}
      <SettingsSidebar 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
        lang={lang}
        onLangChange={handleLangChange}
      />

      {/* Logo Modal */}
      <AnimatePresence>
        {isLogoModalOpen && (
            <Portal>
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setIsLogoModalOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setIsLogoModalOpen(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-xl font-bold text-white tracking-tight">The Principia</div>
                            <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                                <img src="/favicon.png" alt="Large Logo" className="w-full h-full object-contain rounded-full" />
                            </div>
                            
                            <button 
                                onClick={handleDownloadLogo}
                                className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-semibold hover:bg-zinc-200 transition-colors w-full justify-center"
                            >
                                <Download size={18} />
                                Download Logo
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </Portal>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
