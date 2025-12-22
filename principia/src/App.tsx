import { useState, useEffect, useRef } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from './components/Editor'
import { HandwritingCanvas } from './components/HandwritingCanvas'
import type { BackgroundType } from './components/HandwritingCanvas'
import type { HandwritingCanvasRef } from './components/HandwritingCanvas'
import { Renderer } from './components/Renderer'
import { Download, Settings, PenTool, Type, X, ArrowRightLeft, Sparkles, FileImage, Archive } from 'lucide-react'
import { saveAs } from 'file-saver'
import { motion, AnimatePresence } from 'framer-motion'
import { Portal } from './components/Portal'
import { SettingsSidebar } from './components/SettingsSidebar'
import jsPDF from 'jspdf'
import JSZip from 'jszip'

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

interface OCRRequestBody {
  image: string;
  visionConfig?: ApiConfig;
  previousContext?: string;
  nextContext?: string;
}

interface ConvertRequestBody {
  content: string;
  targetFormat: 'tex' | 'md';
  reasoningConfig?: ApiConfig;
}

function App() {
  const [content, setContent] = useState<string>("")
  const [inputMode, setInputMode] = useState<'text' | 'handwriting'>('text');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [handwritingData, setHandwritingData] = useState<string>("");
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'tex' | 'md'>('tex');
  const [isConverting, setIsConverting] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [isLeftHanded, setIsLeftHanded] = useState<boolean>(true);
  
  // Handwriting Canvas State Persistence
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('blank');
  const [backgroundSpacing, setBackgroundSpacing] = useState(40);
  const [currentPage, setCurrentPage] = useState(0);

  // Analysis State (Lifted from InteractiveBadge)
  const [analysisData, setAnalysisData] = useState<Record<string, { explanation: string, visualization: string }>>({});

  // Canvas Ref
  const canvasRef = useRef<HandwritingCanvasRef>(null);
  
  // Mobile Support State
  const [isMobile, setIsMobile] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'write' | 'type' | 'preview'>('write');

  // Export Options State
  const [exportIncludePDF, setExportIncludePDF] = useState(false);
  const [exportIncludeAnalysis, setExportIncludeAnalysis] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load language preference
  useEffect(() => {
      const savedLang = localStorage.getItem('principia_lang');
      if (savedLang === 'en' || savedLang === 'zh') {
          setLang(savedLang);
      }
      
      // Load left-handed preference
      const savedLeftHanded = localStorage.getItem('principia_left_handed');
      if (savedLeftHanded !== null) {
          setIsLeftHanded(savedLeftHanded === 'true');
      }
  }, []);

  // Detect Mobile
  useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLangChange = (newLang: 'en' | 'zh') => {
      setLang(newLang);
      localStorage.setItem('principia_lang', newLang);
  };
  
  // Toggle left-handed mode
  const toggleLeftHanded = () => {
      const newLeftHanded = !isLeftHanded;
      setIsLeftHanded(newLeftHanded);
      localStorage.setItem('principia_left_handed', newLeftHanded.toString());
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

  // Callback to update analysis data from Renderer -> InteractiveBadge
  const handleAnalysisUpdate = (id: string, data: { explanation: string, visualization: string }) => {
      setAnalysisData(prev => ({
          ...prev,
          [id]: data
      }));
  };

  const handleRecognize = async (imageData: string, pageIndex?: number) => {
    setIsRecognizing(true);
    try {
        // Handle legacy single-image recognition (or full canvas fallback)
        const body: OCRRequestBody = { image: imageData };
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
        
        // If pageIndex is provided, try to update that specific page section
        if (pageIndex !== undefined) {
            // Find marker for this page
            const pageMarker = `<!-- PAGE ${pageIndex + 1} -->`;
            const nextPageMarker = `<!-- PAGE ${pageIndex + 2} -->`;
            
            let newContent = content;
            if (!newContent.includes(pageMarker)) {
                // If marker doesn't exist, append it
                newContent += `\n\n${pageMarker}\n${data.latex}`;
            } else {
                // Replace content between markers
                const startIndex = newContent.indexOf(pageMarker) + pageMarker.length;
                const endIndex = newContent.indexOf(nextPageMarker);
                
                if (endIndex !== -1) {
                    newContent = newContent.substring(0, startIndex) + `\n${data.latex}\n` + newContent.substring(endIndex);
                } else {
                    // No next marker, replace until end (or maybe just append if we assume last page)
                    // But wait, if we are editing Page 1 and Page 2 exists, we need to find where Page 1 ends.
                    // If no next marker exists, maybe look for any next page marker?
                    // Simple approach: regex to find next "<!-- PAGE \d+ -->"
                    const nextMarkerRegex = /<!-- PAGE \d+ -->/g;
                    nextMarkerRegex.lastIndex = startIndex;
                    const match = nextMarkerRegex.exec(newContent);
                    
                    if (match) {
                        newContent = newContent.substring(0, startIndex) + `\n${data.latex}\n` + newContent.substring(match.index);
                    } else {
                        // Truly the last page
                        newContent = newContent.substring(0, startIndex) + `\n${data.latex}`;
                    }
                }
            }
            setContent(newContent);
        } else {
            // Append text to content (Legacy behavior)
            setContent(prev => prev + '\n\n' + data.latex);
        }
    } catch (error) {
        console.error(error);
        alert("Recognition failed. Please try again. " + (error as Error).message + ". Ensure API Key is set.");
    } finally {
        setIsRecognizing(false);
    }
  };

  const handleSmartRecognize = async (changedPages: { pageIndex: number; imageData: string }[]) => {
      setIsRecognizing(true);
      try {
          let currentContent = content; // Work on a local copy to chain updates
          
          // Process pages sequentially to maintain order and context
          for (const page of changedPages) {
              const { pageIndex, imageData } = page;
              const pageNum = pageIndex + 1;
              const pageMarker = `<!-- PAGE ${pageNum} -->`;
              
              // 1. Determine Context
              let previousContext = "";
              let nextContext = "";
              
              // Find where this page starts in current text
              const markerIndex = currentContent.indexOf(pageMarker);
              if (markerIndex !== -1) {
                  // Previous context is text before the marker
                  previousContext = currentContent.substring(Math.max(0, markerIndex - 200), markerIndex).trim();
              } else {
                  // If marker doesn't exist, context is end of file
                  previousContext = currentContent.substring(Math.max(0, currentContent.length - 200)).trim();
              }
              
              // Find next marker to determine next context
              const nextMarkerRegex = /<!-- PAGE \d+ -->/g;
              nextMarkerRegex.lastIndex = markerIndex !== -1 ? markerIndex + pageMarker.length : currentContent.length;
              const nextMatch = nextMarkerRegex.exec(currentContent);
              
              if (nextMatch) {
                  nextContext = currentContent.substring(nextMatch.index, Math.min(currentContent.length, nextMatch.index + 200)).trim();
                  // Actually we want text AFTER the marker? No, usually next page text starts after marker. 
                  // But nextContext for *this* page is the text of *next* page.
                  // Let's grab text immediately following the *next* marker?
                  // Or better: Next context is effectively the start of the next page's content.
                  const nextContentStart = nextMatch.index + nextMatch[0].length;
                  nextContext = currentContent.substring(nextContentStart, Math.min(currentContent.length, nextContentStart + 200)).trim();
              }

              // 2. Call API
              const body: OCRRequestBody = { 
                  image: imageData,
                  previousContext,
                  nextContext
              };
              if (settings?.vision?.apiKey) {
                  body.visionConfig = settings.vision;
              }

              const response = await fetch('/api/ocr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
              });

              if (!response.ok) throw new Error(`OCR Failed for Page ${pageNum}`);
              const data = await response.json();
              
              // 3. Update Content
              if (markerIndex === -1) {
                  // Append new page
                  currentContent += `\n\n${pageMarker}\n${data.latex}`;
              } else {
                  // Replace existing page content
                  const contentStart = markerIndex + pageMarker.length;
                  
                  // Find end of this page (start of next marker or end of string)
                  let contentEnd = currentContent.length;
                  if (nextMatch) {
                      contentEnd = nextMatch.index;
                  }
                  
                  currentContent = currentContent.substring(0, contentStart) + `\n${data.latex}\n` + currentContent.substring(contentEnd);
              }
          }
          
          setContent(currentContent);
          
      } catch (error) {
          console.error(error);
          alert("Smart recognition failed. " + (error as Error).message);
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
        const body: ConvertRequestBody = { 
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

  const handleExport = async () => {
      setIsExporting(true);
      try {
          const zip = new JSZip();
          const folderName = "principia_export";
          const root = zip.folder(folderName) || zip;

          // 1. Export Main Document
          const mainExt = downloadFormat === 'tex' ? 'tex' : 'md';
          let mainContent = content;
          
          // Check if we need to convert format before exporting
          // Logic:
          // If current downloadFormat is different from the content's inferred format, we should convert.
          // BUT, we don't strictly track content format state (it's just a string).
          // However, the user selects 'downloadFormat' in the modal. 
          // If the user wants to download as 'tex', but the content is currently markdown-ish (or vice versa),
          // we should ideally use the same conversion logic as handleFormatSwitch.
          
          // Wait, handleFormatSwitch changes the editor content directly. 
          // Here we want to export WITHOUT changing the editor content necessarily? 
          // Or should we just assume if they selected 'tex' in export modal, they want 'tex' file.
          // And if the content is not 'tex', we convert it on the fly.
          
          // Let's reuse the API for conversion if needed.
          // We can't easily detect "is this tex or md" perfectly without a flag, 
          // but we can rely on the user's intent. 
          // If they click "Export" and selected "LaTeX", we ensure it is LaTeX.
          
          // Actually, let's just ALWAYS call the convert API if we want to ensure high quality output matching the format?
          // Or better: We assume the Editor content IS the format specified by `downloadFormat` IF the user has been using the switcher.
          // BUT, `downloadFormat` state is shared between the switcher and the export modal.
          // So if `downloadFormat` is 'tex', the editor *should* be displaying tex (or user manually switched).
          
          // The user request is: "When user is in tex, export md OR in md, export tex... let AI rewrite it".
          // This implies we need to know the SOURCE format.
          // Let's assume `downloadFormat` state tracks the CURRENT editor format (since handleFormatSwitch updates it).
          // So if we want to export in a DIFFERENT format than `downloadFormat`, we need a new UI selection in the modal?
          
          // Looking at the UI: 
          // The modal has buttons to set `setDownloadFormat`. 
          // This updates the SAME state that controls the "current mode" of the editor (the toggle in header).
          // So if I open modal and click "Markdown", `downloadFormat` becomes 'md'. 
          // If I was previously in 'tex', this effectively signals a switch.
          
          // PROBLEM: changing `downloadFormat` in the modal currently DOES NOT trigger `handleFormatSwitch` logic (API call).
          // It just changes the string variable. So `content` remains in old format.
          
          // FIX: We need to perform the conversion logic inside `handleExport` if we detect a mismatch or just always to be safe?
          // Or, we should just run the conversion API on the fly based on the `downloadFormat` selected at the moment of export.
          // Let's try to convert `content` to `downloadFormat` using the API, and use the result for export.
          
          // We need a way to know "what format is the content CURRENTLY in?".
          // We can assume it is the OPPOSITE of `downloadFormat` if the user just clicked the other button?
          // No, that's flaky.
          
          // Let's assume: We always ask AI to "Convert/Ensure content is in <downloadFormat>".
          // The API `convert_format` takes `content` and `targetFormat`. 
          
          // Optimization: If the user says "same format, no polish", we can skip API call?
          // User request: "格式相同导出没必要再润色了".
          // So we need to detect if format is same.
          // How? We don't have a reliable `currentFormat` state that tracks the content structure perfectly.
          // BUT, `handleFormatSwitch` sets `downloadFormat`. 
          // If the user hasn't switched format since editing, `downloadFormat` MIGHT reflect the current state.
          // However, user can paste anything.
          
          // Let's rely on the `downloadFormat` state variable.
          // It represents the "intended" mode of the editor (TEX vs MD).
          // If the user selects the SAME format in the export modal as the current `downloadFormat` state,
          // we assume no conversion/polish is needed.
          
          if (downloadFormat !== 'tex' && downloadFormat !== 'md') {
             // Fallback or error? defaulting to 'tex'
          }

          // We need to know what the user SELECTED in the modal.
          // The modal uses `downloadFormat` state to control the selection buttons.
          // So `downloadFormat` IS the target format.
          // We need to know the SOURCE format.
          // We can't know for sure.
          
          // Wait, the user said: "When user is in tex, export md OR in md, export tex... let AI rewrite it".
          // "格式相同导出没必要再润色了".
          // This implies: 
          // 1. We need to track "Current Editor Mode" separate from "Export Target Format".
          // Currently `downloadFormat` serves BOTH roles (which is the root cause of confusion).
          // The header toggle sets `downloadFormat`. The export modal ALSO sets `downloadFormat`.
          // This is bad UX if we want to support "I am in Tex mode, but want to export MD".
          // Because clicking "MD" in modal switches the EDITOR mode too?
          
          // Let's check `handleFormatSwitch`:
          // It calls API `convert`, sets content, AND sets `downloadFormat`.
          // So if I am in Tex, and I open modal and click "MD", `handleFormatSwitch` is NOT called.
          // Just `setDownloadFormat('md')` is called (see line 714 in previous read).
          
          // Ah! The modal buttons do: `onClick={() => setDownloadFormat('tex')}`.
          // This updates the state variable `downloadFormat`.
          // BUT it does NOT trigger the content conversion that `handleFormatSwitch` does.
          // So `content` is still in the old format, but `downloadFormat` is new.
          // This is exactly the "mismatch" we can detect!
          
          // We need a way to know what the "Old" format was.
          // Or we simply check: "Is the content likely Tex or MD?"
          // Regex check?
          // Tex usually has `\section`, `\begin{...}`.
          // MD usually has `# `, `## `, `**`.
          
          // Simple heuristic:
          const hasLatexStructure = /\\(section|begin|documentclass|usepackage)/.test(content);
          const hasMarkdownStructure = /^(# |## |\*\*)/m.test(content);
          
          let sourceFormat = 'md';
          if (hasLatexStructure) sourceFormat = 'tex';
          else if (hasMarkdownStructure) sourceFormat = 'md';
          // Default to md if ambiguous? Or tex?
          
          // User selected `downloadFormat` (Target).
          // If Target != Source, convert.
          // If Target == Source, skip.
          
          let shouldConvert = false;
          if (downloadFormat === 'tex' && sourceFormat !== 'tex') shouldConvert = true;
          if (downloadFormat === 'md' && sourceFormat !== 'md') shouldConvert = true;
          
          if (shouldConvert) {
              const conversionBody: ConvertRequestBody = { 
                  content: content, 
                  targetFormat: downloadFormat 
              };
              if (settings?.reasoning?.apiKey) {
                  conversionBody.reasoningConfig = settings.reasoning;
              }
    
              // Call API to ensure content is in the correct format (and rewritten by AI)
              const conversionResponse = await fetch('/api/convert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(conversionBody)
              });
    
              if (conversionResponse.ok) {
                  const conversionData = await conversionResponse.json();
                  mainContent = conversionData.converted;
              } else {
                  console.warn("Export conversion failed, falling back to raw content");
              }
          }

          if (downloadFormat === 'tex') {
              // Wrap in boilerplate if it's not already full document (API returns body)
              // The API `convert` returns "body content". 
              // So we wrap it.
              mainContent = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\title{Principia Export}
\\author{Generated by AI}
\\date{\\today}

\\begin{document}
\\maketitle

${mainContent}

\\end{document}`;
          }
          root.file(`main.${mainExt}`, mainContent);

          // 2. Export Canvas PDF (if selected)
          if (exportIncludePDF && canvasRef.current) {
              const images = await canvasRef.current.getCanvasImages();
              if (images.length > 0) {
                  // A4 size in mm: 210 x 297
                  // We assume portrait for now or match image ratio
                  const pdf = new jsPDF({
                      orientation: 'p',
                      unit: 'mm',
                      format: 'a4'
                  });

                  for (let i = 0; i < images.length; i++) {
                      if (i > 0) pdf.addPage();
                      const imgProps = pdf.getImageProperties(images[i]);
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                      
                      pdf.addImage(images[i], 'JPEG', 0, 0, pdfWidth, pdfHeight);
                  }
                  
                  const pdfBlob = pdf.output('blob');
                  root.file('handwriting.pdf', pdfBlob);
              }
          }

          // 3. Export Analysis & Visualizations (if selected)
          if (exportIncludeAnalysis) {
              const explanations: string[] = [];
              const vizFolder = root.folder("visualizations");
              
              let index = 1;
              for (const [, data] of Object.entries(analysisData)) {
                  if (data.explanation) {
                      explanations.push(`\\section*{Analysis #${index}}\n\n${data.explanation}\n\n`);
                  }
                  
                  if (data.visualization && vizFolder) {
                      const htmlContent = `
                        <html>
                        <head>
                            <title>Visualization #${index}</title>
                            <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
                            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                            <style>body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; }</style>
                        </head>
                        <body>
                            ${data.visualization}
                        </body>
                        </html>
                      `;
                      vizFolder.file(`viz_${index}.html`, htmlContent);
                  }
                  index++;
              }
              
              if (explanations.length > 0) {
                  const explContent = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\title{AI Explanations}
\\begin{document}
\\maketitle
${explanations.join("\n\\hrule\n")}
\\end{document}`;
                  root.file('explanations.tex', explContent);
              }
          }

          // 4. Generate and Download
          if (exportIncludeAnalysis || exportIncludePDF) {
              // Download Zip
              const blob = await zip.generateAsync({ type: "blob" });
              saveAs(blob, "principia_export.zip");
          } else {
              // Just the main file (Legacy behavior fallback if nothing else selected, but inside zip now for consistency if using this modal?)
              // Wait, user said "if explain not selected... previous config"
              // If we are here, we are using the new logic.
              // If only main file is needed, we can just download main file directly?
              // The user said: "don't select explanation -> previous config" (which means just .tex/.md file).
              // "select -> zip".
              
              // Let's refine:
              if (!exportIncludeAnalysis && !exportIncludePDF) {
                  // Fallback to simple file download
                  const blob = new Blob([mainContent], { type: 'text/plain;charset=utf-8' });
                  saveAs(blob, `principia_export.${mainExt}`);
              } else {
                  const blob = await zip.generateAsync({ type: "blob" });
                  saveAs(blob, "principia_export.zip");
              }
          }

      } catch (error) {
          console.error("Export failed", error);
          alert("Export failed: " + (error as Error).message);
      } finally {
          setIsExporting(false);
          setIsExportModalOpen(false);
      }
  };

  const handleDownloadLogo = () => {
      saveAs("/favicon.png", "Principia_Logo.png");
  };

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-zinc-900 flex items-center justify-between px-4 sm:px-6 bg-black/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsLogoModalOpen(true)} className="outline-none hover:opacity-80 transition-opacity">
            <img src="/favicon.png" alt="Logo" className="w-6 h-6 rounded-full bg-white" />
          </button>
          <span className="font-semibold tracking-tight text-zinc-100">Principia</span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 text-[10px] uppercase font-bold tracking-wider border border-zinc-800 hidden sm:inline-block">Alpha</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Input Mode Switcher (Hidden on Mobile) */}
          {!isMobile && (
              <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 mr-2">
                 <button 
                    onClick={() => setInputMode('text')}
                    className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'text' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Text Editor Mode"
                 >
                    <Type size={14} />
                    <span className="text-[10px] font-medium hidden sm:inline">Text</span>
                 </button>
                 <button 
                    onClick={() => setInputMode('handwriting')}
                    className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'handwriting' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Handwriting Mode"
                 >
                    <PenTool size={14} />
                    <span className="text-[10px] font-medium hidden sm:inline">Draw</span>
                 </button>
              </div>
          )}

          {!isMobile && <div className="w-px h-4 bg-zinc-800 mx-1"></div>}

          {!isMobile && (
            <button 
                onClick={toggleLeftHanded}
                className={`p-2 transition-colors rounded-md text-zinc-500 hover:text-white ${isLeftHanded ? 'text-blue-400 hover:text-blue-300' : ''}`}
                title={isLeftHanded ? "Switch Layout (Input Right)" : "Switch Layout (Input Left)"}
            >
                <ArrowRightLeft size={16} />
            </button>
          )}

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-2 text-zinc-500 hover:text-white transition-colors"
            title="API Settings"
          >
            <Settings size={16} />
            <span className="text-xs font-medium hidden sm:inline">API Settings</span>
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
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {isMobile ? (
            /* Mobile View - Single Pane with Tab Switcher */
            <div className="h-full w-full flex flex-col">
                <div className="flex-1 overflow-hidden relative">
                    <div className={`h-full w-full absolute inset-0 ${mobileViewMode === 'write' ? 'z-10' : 'z-0 invisible'}`}>
                        <HandwritingCanvas 
                            ref={canvasRef}
                            onRecognize={handleRecognize} 
                            onSmartRecognize={handleSmartRecognize}
                            isRecognizing={isRecognizing} 
                            savedData={handwritingData}
                            onSave={setHandwritingData}
                            backgroundType={backgroundType}
                            backgroundSpacing={backgroundSpacing}
                            onBackgroundChange={(type, spacing) => {
                                setBackgroundType(type);
                                setBackgroundSpacing(spacing);
                            }}
                            initialPage={currentPage}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                    <div className={`h-full w-full absolute inset-0 bg-[#0a0a0a] ${mobileViewMode === 'type' ? 'z-10' : 'z-0 invisible'}`}>
                        <Editor value={content} onChange={setContent} />
                    </div>
                    <div className={`h-full w-full absolute inset-0 bg-[#050505] ${mobileViewMode === 'preview' ? 'z-10' : 'z-0 invisible'}`}>
                        <Renderer 
                            content={content} 
                            settings={settings} 
                            analysisData={analysisData}
                            onAnalysisUpdate={handleAnalysisUpdate}
                        />
                    </div>
                </div>
                
                {/* Mobile Bottom Navigation */}
                <div className="h-16 bg-zinc-950 border-t border-zinc-900 flex items-center justify-around px-2 shrink-0 z-50 safe-area-bottom">
                    <button 
                        onClick={() => setMobileViewMode('write')}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'write' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <PenTool size={20} />
                        <span className="text-[10px] font-medium">Write</span>
                    </button>
                    <button 
                        onClick={() => setMobileViewMode('type')}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'type' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Type size={20} />
                        <span className="text-[10px] font-medium">Type</span>
                    </button>
                    <button 
                        onClick={() => setMobileViewMode('preview')}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'preview' ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <div className="relative">
                            <Sparkles size={20} />
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                        </div>
                        <span className="text-[10px] font-medium">Explain</span>
                    </button>
                </div>
            </div>
        ) : (
            /* Desktop View - Split Panes */
            <PanelGroup orientation="horizontal" className="h-full">
            {isLeftHanded ? (
                <>
                <Panel defaultSize={50} minSize={30} className="h-full relative">
                    <div className={`h-full w-full ${inputMode === 'text' ? 'block' : 'hidden'}`}>
                    <Editor value={content} onChange={setContent} />
                    </div>
                    <div className={`h-full w-full ${inputMode === 'handwriting' ? 'block' : 'hidden'}`}>
                    <HandwritingCanvas 
                        ref={canvasRef}
                        onRecognize={handleRecognize} 
                        onSmartRecognize={handleSmartRecognize}
                        isRecognizing={isRecognizing} 
                        savedData={handwritingData}
                        onSave={setHandwritingData}
                        backgroundType={backgroundType}
                        backgroundSpacing={backgroundSpacing}
                        onBackgroundChange={(type, spacing) => {
                            setBackgroundType(type);
                            setBackgroundSpacing(spacing);
                        }}
                        initialPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                    </div>
                </Panel>
                
                <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-blue-500 transition-colors cursor-col-resize" />
                
                <Panel defaultSize={50} minSize={30} className="h-full">
                    <div className="h-full w-full bg-[#050505] overflow-hidden">
                    <Renderer 
                        content={content} 
                        settings={settings}
                        analysisData={analysisData}
                        onAnalysisUpdate={handleAnalysisUpdate} 
                    />
                    </div>
                </Panel>
                </>
            ) : (
                <>
                <Panel defaultSize={50} minSize={30} className="h-full">
                    <div className="h-full w-full bg-[#050505] overflow-hidden">
                    <Renderer 
                        content={content} 
                        settings={settings} 
                        analysisData={analysisData}
                        onAnalysisUpdate={handleAnalysisUpdate}
                    />
                    </div>
                </Panel>
                
                <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-blue-500 transition-colors cursor-col-resize" />
                
                <Panel defaultSize={50} minSize={30} className="h-full relative">
                    <div className={`h-full w-full ${inputMode === 'text' ? 'block' : 'hidden'}`}>
                    <Editor value={content} onChange={setContent} />
                    </div>
                    <div className={`h-full w-full ${inputMode === 'handwriting' ? 'block' : 'hidden'}`}>
                    <HandwritingCanvas 
                        ref={canvasRef}
                        onRecognize={handleRecognize} 
                        onSmartRecognize={handleSmartRecognize}
                        isRecognizing={isRecognizing} 
                        savedData={handwritingData}
                        onSave={setHandwritingData}
                        backgroundType={backgroundType}
                        backgroundSpacing={backgroundSpacing}
                        onBackgroundChange={(type, spacing) => {
                            setBackgroundType(type);
                            setBackgroundSpacing(spacing);
                        }}
                        initialPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                    </div>
                </Panel>
                </>
            )}
            </PanelGroup>
        )}
      </div>

      {/* Settings Sidebar */}
      <SettingsSidebar 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
        lang={lang}
        onLangChange={handleLangChange}
      />

      {/* Export Options Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
            <Portal>
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setIsExportModalOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl max-w-md w-full relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setIsExportModalOpen(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col gap-6">
                            <div className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                <Download size={20} className="text-blue-400" />
                                Export Options
                            </div>
                            
                            <div className="space-y-4">
                                {/* Format Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">Document Format</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setDownloadFormat('tex')}
                                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${downloadFormat === 'tex' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-800/80'}`}
                                        >
                                            LaTeX (.tex)
                                        </button>
                                        <button 
                                            onClick={() => setDownloadFormat('md')}
                                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${downloadFormat === 'md' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-800/80'}`}
                                        >
                                            Markdown (.md)
                                        </button>
                                    </div>
                                </div>

                                {/* Additional Content */}
                                <div className="space-y-3 pt-2">
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={exportIncludePDF}
                                            onChange={(e) => setExportIncludePDF(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                                                <FileImage size={16} />
                                                Include Handwriting PDF
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-0.5">Export your canvas pages as a PDF file.</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={exportIncludeAnalysis}
                                            onChange={(e) => setExportIncludeAnalysis(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                                                <Sparkles size={16} />
                                                Include AI Analysis & Viz
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-0.5">Bundle explanations (tex) and interactive visualizations (html).</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-full font-semibold hover:bg-zinc-200 transition-colors w-full mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isExporting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        {(exportIncludePDF || exportIncludeAnalysis) ? <Archive size={18} /> : <Download size={18} />}
                                        { (exportIncludePDF || exportIncludeAnalysis) ? "Download ZIP Archive" : "Download File" }
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </Portal>
        )}
      </AnimatePresence>

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

                            <a 
                                href="https://github.com/Zhen-WushuiLingchun/principia" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 hover:underline text-sm transition-colors"
                            >
                                https://github.com/Zhen-WushuiLingchun/principia
                            </a>
                            
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
