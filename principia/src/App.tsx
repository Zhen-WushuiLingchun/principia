import { useState, useEffect, useRef } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from './components/Editor'
import { HandwritingCanvas } from './components/HandwritingCanvas'
import type { BackgroundType } from './components/HandwritingCanvas'
import type { HandwritingCanvasRef } from './components/HandwritingCanvas'
import { Renderer } from './components/Renderer'
import { Download, Settings, PenTool, Type, X, ArrowRightLeft, Sparkles, FileImage, Archive, Clock, BookOpen, Sun, Moon, Trash2, Languages, Image, Scan, Loader2 } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
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
  // 刷新（清屏）功能
  const handleRefresh = () => {
    window.location.reload();
  };
  const [content, setContent] = useState<string>("")
  const [inputMode, setInputMode] = useState<'text' | 'handwriting' | 'image'>('text');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [_ocrTaskId, setOcrTaskId] = useState<string | null>(null);
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
  
  // 检测是否在 Electron 环境中运行
  const isElectron = window.process && window.process.versions && window.process.versions.electron;
  
  // API 基础 URL
  const API_BASE_URL = isElectron ? 'http://localhost:8000' : '';

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check system preference or stored preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Export Options State
  const [exportIncludePDF, setExportIncludePDF] = useState(false);
  const [exportIncludeAnalysis, setExportIncludeAnalysis] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Translation object
  const t = {
    exportOptions: lang === 'en' ? 'Export Options' : '导出选项',
    documentFormat: lang === 'en' ? 'Document Format' : '文档格式',
    latex: lang === 'en' ? 'LaTeX (.tex)' : 'LaTeX (.tex)',
    markdown: lang === 'en' ? 'Markdown (.md)' : 'Markdown (.md)',
    additionalContent: lang === 'en' ? 'Additional Content' : '附加内容',
    includeHandwritingPDF: lang === 'en' ? 'Include Handwriting PDF' : '包含手写 PDF',
    exportCanvasPDF: lang === 'en' ? 'Export your canvas pages as a PDF file.' : '将您的画布页面导出为 PDF 文件。',
    includeAIAnalysis: lang === 'en' ? 'Include AI Analysis & Viz' : '包含 AI 分析和可视化',
    bundleExplanations: lang === 'en' ? 'Bundle explanations (tex) and interactive visualizations (html).' : '打包解释（tex）和交互式可视化（html）。',
    downloadZIP: lang === 'en' ? 'Download ZIP Archive' : '下载 ZIP 压缩包',
    downloadFile: lang === 'en' ? 'Download File' : '下载文件',
    processing: lang === 'en' ? 'Processing...' : '处理中...',
    startWriting: lang === 'en' ? 'Start writing on the left to see the AI analysis...' : '在左侧开始书写以查看 AI 分析...',
    textEditorMode: lang === 'en' ? 'Text Editor Mode' : '文本编辑器模式',
    handwritingMode: lang === 'en' ? 'Handwriting Mode' : '手写模式',
    switchLayoutLeft: lang === 'en' ? 'Switch Layout (Input Left)' : '切换布局（输入在左）',
    switchLayoutRight: lang === 'en' ? 'Switch Layout (Input Right)' : '切换布局（输入在右）',
    apiSettings: lang === 'en' ? 'API Settings' : 'API 设置',
    export: lang === 'en' ? 'Export' : '导出',
    write: lang === 'en' ? 'Write' : '书写',
    type: lang === 'en' ? 'Type' : '输入',
    explain: lang === 'en' ? 'Explain' : '解释',
    switchingFormat: lang === 'en' ? `Switching to ${downloadFormat.toUpperCase()} format will use AI to restructure your document. \n\nThis process will rewrite formatting (headers, lists, etc.) to match ${downloadFormat === 'tex' ? 'LaTeX' : 'Markdown'} standards.\n\nDo you want to proceed?` : `切换到 ${downloadFormat.toUpperCase()} 格式将使用 AI 重构您的文档。\n\n此过程将重写格式（标题、列表等）以匹配 ${downloadFormat === 'tex' ? 'LaTeX' : 'Markdown'} 标准。\n\n是否继续？`
  };

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

  // History State
  const [history, setHistory] = useState<Array<{
    id: string;
    timestamp: number;
    content: string;
    analysisData: Record<string, { explanation: string, visualization: string }>;
    title: string;
  }>>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Formula Table State
  const [isFormulaTableOpen, setIsFormulaTableOpen] = useState(false);
  const [selectedFormulaCategory, setSelectedFormulaCategory] = useState('algebra');

  // Common math formulas organized by category
  const mathFormulas = {
    algebra: {
      name: lang === 'en' ? 'Algebra' : '代数',
      formulas: [
        { name: lang === 'en' ? 'Quadratic Formula' : '二次方程公式', latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
        { name: lang === 'en' ? 'Sum of Squares' : '平方和', latex: "a^2 + b^2 = (a + b)^2 - 2ab" },
        { name: lang === 'en' ? 'Difference of Squares' : '平方差', latex: "a^2 - b^2 = (a - b)(a + b)" },
        { name: lang === 'en' ? 'Binomial Theorem' : '二项式定理', latex: "(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k" },
        { name: lang === 'en' ? 'Sum of Cubes' : '立方和', latex: "a^3 + b^3 = (a + b)(a^2 - ab + b^2)" },
        { name: lang === 'en' ? 'Difference of Cubes' : '立方差', latex: "a^3 - b^3 = (a - b)(a^2 + ab + b^2)" },
        { name: lang === 'en' ? 'Arithmetic Series' : '等差数列求和', latex: "S_n = \\frac{n}{2}(a_1 + a_n) = \\frac{n}{2}[2a_1 + (n-1)d]" },
        { name: lang === 'en' ? 'Geometric Series' : '等比数列求和', latex: "S_n = a_1 \\frac{1 - r^n}{1 - r}, r \\neq 1" },
      ]
    },
    calculus: {
      name: lang === 'en' ? 'Calculus' : '微积分',
      formulas: [
        { name: lang === 'en' ? 'Derivative of x^n' : 'xⁿ的导数', latex: "\\frac{d}{dx} x^n = nx^{n-1}" },
        { name: lang === 'en' ? 'Integral of x^n' : 'xⁿ的积分', latex: "\\int x^n dx = \\frac{x^{n+1}}{n+1} + C" },
        { name: lang === 'en' ? 'Chain Rule' : '链式法则', latex: "\\frac{d}{dx} f(g(x)) = f'(g(x)) \\cdot g'(x)" },
        { name: lang === 'en' ? 'Product Rule' : '乘积法则', latex: "\\frac{d}{dx} [f(x)g(x)] = f'(x)g(x) + f(x)g'(x)" },
        { name: lang === 'en' ? 'Quotient Rule' : '商数法则', latex: "\\frac{d}{dx} \\frac{f(x)}{g(x)} = \\frac{f'(x)g(x) - f(x)g'(x)}{[g(x)]^2}" },
        { name: lang === 'en' ? 'Basic Limit' : '基本极限', latex: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
        { name: lang === 'en' ? 'Derivative of e^x' : '指数函数的导数', latex: "\\frac{d}{dx} e^x = e^x" },
        { name: lang === 'en' ? 'Derivative of ln x' : '对数函数的导数', latex: "\\frac{d}{dx} \\ln x = \\frac{1}{x}" },
      ]
    },
    trigonometry: {
      name: lang === 'en' ? 'Trigonometry' : '三角学',
      formulas: [
        { name: lang === 'en' ? 'Pythagorean Identity' : '勾股定理', latex: "\\sin^2 \\theta + \\cos^2 \\theta = 1" },
        { name: lang === 'en' ? 'Sine Addition' : '正弦加法公式', latex: "\\sin(A + B) = \\sin A \\cos B + \\cos A \\sin B" },
        { name: lang === 'en' ? 'Cosine Addition' : '余弦加法公式', latex: "\\cos(A + B) = \\cos A \\cos B - \\sin A \\sin B" },
        { name: lang === 'en' ? 'Tangent Formula' : '正切公式', latex: "\\tan \\theta = \\frac{\\sin \\theta}{\\cos \\theta}" },
        { name: lang === 'en' ? 'Double Angle Formula (Sine)' : '正弦二倍角公式', latex: "\\sin 2\\theta = 2\\sin \\theta \\cos \\theta" },
        { name: lang === 'en' ? 'Double Angle Formula (Cosine)' : '余弦二倍角公式', latex: "\\cos 2\\theta = \\cos^2 \\theta - \\sin^2 \\theta = 2\\cos^2 \\theta - 1 = 1 - 2\\sin^2 \\theta" },
        { name: lang === 'en' ? 'Tangent Addition' : '正切加法公式', latex: "\\tan(A + B) = \\frac{\\tan A + \\tan B}{1 - \\tan A \\tan B}" },
        { name: lang === 'en' ? 'Cotangent Formula' : '余切公式', latex: "\\cot \\theta = \\frac{\\cos \\theta}{\\sin \\theta} = \\frac{1}{\\tan \\theta}" },
      ]
    },
    physics: {
      name: lang === 'en' ? 'Physics' : '物理学',
      formulas: [
        { name: lang === 'en' ? 'Newton\'s Second Law' : '牛顿第二定律', latex: "F = ma" },
        { name: lang === 'en' ? 'Kinetic Energy' : '动能', latex: "E_k = \\frac{1}{2}mv^2" },
        { name: lang === 'en' ? 'Potential Energy' : '势能', latex: "E_p = mgh" },
        { name: lang === 'en' ? 'Ohm\'s Law' : '欧姆定律', latex: "V = IR" },
        { name: lang === 'en' ? 'Gravitational Force' : '万有引力定律', latex: "F = G \\frac{m_1m_2}{r^2}" },
        { name: lang === 'en' ? 'Work' : '功', latex: "W = Fd \\cos \\theta" },
        { name: lang === 'en' ? 'Power' : '功率', latex: "P = \\frac{W}{t} = Fv" },
        { name: lang === 'en' ? 'Momentum' : '动量', latex: "p = mv" },
        { name: lang === 'en' ? 'Impulse' : '冲量', latex: "J = F\\Delta t = \\Delta p" },
        { name: lang === 'en' ? 'Centripetal Force' : '向心力', latex: "F_c = \\frac{mv^2}{r}" },
      ]
    }
  };

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
      
      // Load history from localStorage
      const savedHistory = localStorage.getItem('principia_history');
      if (savedHistory) {
          try {
              setHistory(JSON.parse(savedHistory));
          } catch (e) {
              console.error("Failed to load history", e);
          }
      }
  }, []);

  // Save history to localStorage
  useEffect(() => {
      localStorage.setItem('principia_history', JSON.stringify(history));
  }, [history]);

  // Callback to update analysis data from Renderer -> InteractiveBadge
  const handleAnalysisUpdate = (id: string, data: { explanation: string, visualization: string }) => {
      setAnalysisData(prev => ({
          ...prev,
          [id]: data
      }));
  };

  const handleRecognize = async (imageData: string, pageIndex?: number) => {
    setIsRecognizing(true);
    setOcrProgress(0);
    setOcrTaskId(null);
    try {
        // Handle legacy single-image recognition (or full canvas fallback)
        const body: OCRRequestBody = { image: imageData };
        if (settings?.vision?.apiKey) {
            body.visionConfig = settings.vision;
        }

        const response = await fetch(`${API_BASE_URL}/api/ocr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error('OCR Failed');
        
        const data = await response.json();
        
        if (data.task_id) {
            setOcrTaskId(data.task_id);
            
            // Start polling for progress
            const pollingInterval = setInterval(async () => {
                try {
                    const progressResponse = await fetch(`${API_BASE_URL}/api/ocr/progress/${data.task_id}`);
                    if (!progressResponse.ok) throw new Error('Failed to get progress');
                    
                    const progressData = await progressResponse.json();
                    setOcrProgress(progressData.progress || 0);
                    
                    if (progressData.status === 'completed' || progressData.status === 'error') {
                        clearInterval(pollingInterval);
                        if (progressData.status === 'error') {
                            throw new Error(progressData.error || 'OCR Failed');
                        }
                    }
                } catch (error) {
                    console.error('Error getting progress:', error);
                    clearInterval(pollingInterval);
                    // 如果获取进度失败，使用假进度条
                    startFakeProgress();
                }
            }, 500); // Poll every 500ms
        } else {
            // 如果没有 task_id，使用假进度条
            startFakeProgress();
        }
        
        // 假进度条函数
        function startFakeProgress() {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 1;
                if (progress <= 95) {
                    setOcrProgress(progress);
                }
            }, 300);
            
            // 保存 interval ID，以便在完成时清除
            const fakeProgressInterval = interval;
            
            // 当 OCR 完成时清除假进度条
            setTimeout(() => {
                clearInterval(fakeProgressInterval);
                setOcrProgress(100);
            }, 6000); // 假设 OCR 过程需要 6 秒
        }
        
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
        setOcrProgress(0);
        setOcrTaskId(null);
    }
  };

  const handleSmartRecognize = async (changedPages: { pageIndex: number; imageData: string }[]) => {
      setIsRecognizing(true);
      setOcrProgress(0);
      setOcrTaskId(null);
      
      // 启动假进度条
      let progress = 0;
      const interval = setInterval(() => {
          progress += 1;
          if (progress <= 95) {
              setOcrProgress(progress);
          }
      }, 300);
      
      try {
          let currentContent = content; // Work on a local copy to chain updates
          
          // Process pages sequentially to maintain order and context
          for (let i = 0; i < changedPages.length; i++) {
              const page = changedPages[i];
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

              const response = await fetch(`${API_BASE_URL}/api/ocr`, {
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
          
          // 清除假进度条
          clearInterval(interval);
          setOcrProgress(100);
          setContent(currentContent);
          
      } catch (error) {
          console.error(error);
          // 清除假进度条
          clearInterval(interval);
          alert("Smart recognition failed. " + (error as Error).message);
      } finally {
          setIsRecognizing(false);
          setOcrProgress(0);
          setOcrTaskId(null);
      }
  };

  const handleFormatSwitch = async (targetFormat: 'tex' | 'md') => {
    if (downloadFormat === targetFormat) return;
    
    // Check if content is empty or default placeholder
    if (!content || content.trim() === "") {
        setDownloadFormat(targetFormat);
        return;
    }

    // Update switchingFormat in the translation object
    const switchingFormat = lang === 'en' ? `Switching to ${targetFormat.toUpperCase()} format will use AI to restructure your document. \n\nThis process will rewrite formatting (headers, lists, etc.) to match ${targetFormat === 'tex' ? 'LaTeX' : 'Markdown'} standards.\n\nDo you want to proceed?` : `切换到 ${targetFormat.toUpperCase()} 格式将使用 AI 重构您的文档。\n\n此过程将重写格式（标题、列表等）以匹配 ${targetFormat === 'tex' ? 'LaTeX' : 'Markdown'} 标准。\n\n是否继续？`;

    const confirmSwitch = window.confirm(switchingFormat);

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

        const response = await fetch(`${API_BASE_URL}/api/convert`, {
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
      // Save to history before exporting
      saveToHistory();
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
              const conversionResponse = await fetch(`${API_BASE_URL}/api/convert`, {
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

  // History functions
  const saveToHistory = () => {
      if (!content.trim()) return;
      
      const newHistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          content: content,
          analysisData: analysisData,
          title: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      };
      
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // Keep only last 50 items
  };

  const loadFromHistory = (item: any) => {
      setContent(item.content);
      setAnalysisData(item.analysisData);
      setIsHistoryOpen(false);
  };

  const deleteFromHistory = (id: string) => {
      setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
      if (window.confirm('确定要清除所有历史记录吗？')) {
          setHistory([]);
      }
  };

  // Formula functions
  const insertFormula = (latex: string) => {
      setContent(prev => prev + '\n\n$$' + latex + '$$');
      setIsFormulaTableOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/50 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsLogoModalOpen(true)} className="outline-none hover:opacity-80 transition-opacity">
            <img src="./favicon.png" alt="Logo" className="w-6 h-6 rounded-full bg-white" />
          </button>
          <span className="font-semibold tracking-tight text-foreground">Principia</span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] uppercase font-bold tracking-wider border border-border hidden sm:inline-block">Alpha</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop Input Mode Switcher (Hidden on Mobile) */}
          {!isMobile && (
              <div className="flex bg-muted rounded-lg p-1 border border-border mr-2">
                 <button 
                    onClick={() => setInputMode('text')}
                    className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'text' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lang === 'en' ? 'Text Editor Mode' : '文本编辑器模式'}
                 >
                    <Type size={14} />
                    <span className="text-[10px] font-medium hidden sm:inline">{lang === 'en' ? 'Text' : '文本'}</span>
                 </button>
                 <button 
                    onClick={() => setInputMode('handwriting')}
                    className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'handwriting' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lang === 'en' ? 'Handwriting Mode' : '手写模式'}
                 >
                    <PenTool size={14} />
                    <span className="text-[10px] font-medium hidden sm:inline">{lang === 'en' ? 'Draw' : '绘图'}</span>
                 </button>
                 <button 
                    onClick={() => setInputMode('image')}
                    className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 ${inputMode === 'image' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    title={lang === 'en' ? 'Image Recognition Mode' : '图像识别模式'}
                 >
                    <Image size={14} />
                    <span className="text-[10px] font-medium hidden sm:inline">{lang === 'en' ? 'Image' : '图像'}</span>
                 </button>
              </div>
          )}

          {!isMobile && <div className="w-px h-4 bg-border mx-1"></div>}

          {!isMobile && (
            <button 
                onClick={toggleLeftHanded}
                className={`p-2 transition-colors rounded-md text-muted-foreground hover:text-foreground ${isLeftHanded ? 'text-blue-400 hover:text-blue-300' : ''}`}
                title={isLeftHanded ? "Switch Layout (Input Right)" : "Switch Layout (Input Left)"}
            >
                <ArrowRightLeft size={16} />
            </button>
          )}

          <button 
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
          >
            <Languages size={16} />
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={lang === 'en' ? 'API Settings' : 'API 设置'}
          >
            <Settings size={16} />
            <span className="text-xs font-medium hidden sm:inline">{lang === 'en' ? 'API Settings' : 'API 设置'}</span>
          </button>
          
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={lang === 'en' ? 'History' : '历史记录'}
          >
            <Clock size={16} />
            <span className="text-xs font-medium hidden sm:inline">{lang === 'en' ? 'History' : '历史记录'}</span>
          </button>
          
          <button 
            onClick={() => setIsFormulaTableOpen(true)}
            className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={lang === 'en' ? 'Formulas' : '公式表格'}
          >
            <BookOpen size={16} />
            <span className="text-xs font-medium hidden sm:inline">{lang === 'en' ? 'Formulas' : '公式表格'}</span>
          </button>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={isDarkMode ? (lang === 'en' ? 'Light Mode' : '浅色模式') : (lang === 'en' ? 'Dark Mode' : '深色模式')}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-xs font-medium hidden sm:inline">{isDarkMode ? (lang === 'en' ? 'Light' : '浅色') : (lang === 'en' ? 'Dark' : '深色')}</span>
          </button>
          
          <div className="flex bg-muted rounded-lg p-0.5 border border-border">
             <button 
                onClick={() => handleFormatSwitch('tex')}
                disabled={isConverting}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${downloadFormat === 'tex' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'} ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                TEX
             </button>
             <button 
                onClick={() => handleFormatSwitch('md')}
                disabled={isConverting}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${downloadFormat === 'md' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'} ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
                MD
             </button>
          </div>

          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors"
            title={lang === 'en' ? 'Export' : '导出'}
          >
            <Download size={14} />
            <span className="hidden sm:inline">{lang === 'en' ? 'Export' : '导出'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* OCR Progress Bar */}
        {isRecognizing && (
          <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full">
              <h3 className="text-xl font-bold text-foreground mb-4 text-center">
                {lang === 'en' ? 'Processing OCR...' : '正在处理OCR...'}
              </h3>
              <div className="w-full bg-muted rounded-full h-4 mb-4">
                <div 
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${ocrProgress}%` }}
                ></div>
              </div>
              <p className="text-zinc-400 text-center text-sm">
                {lang === 'en' ? `Progress: ${ocrProgress}%` : `进度: ${ocrProgress}%`}
              </p>
            </div>
          </div>
        )}
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
                            isDarkMode={isDarkMode}
                        />
                    </div>
                    <div className={`h-full w-full absolute inset-0 bg-background ${mobileViewMode === 'type' ? 'z-10' : 'z-0 invisible'}`}>
                        <Editor value={content} onChange={setContent} />
                    </div>
                    <div className={`h-full w-full absolute inset-0 bg-background ${inputMode === 'image' ? 'z-10' : 'z-0 invisible'}`}>
                        <div className="h-full w-full p-6">
                            <div className="max-w-4xl mx-auto">
                                <h2 className="text-xl font-bold mb-6 text-foreground">{lang === 'en' ? 'Image Recognition' : '图像识别'}</h2>
                                
                                {/* Image Upload */}
                                <div className="mb-8 border border-border rounded-lg p-6 bg-muted/30">
                                    <input 
                                        type="file" 
                                        id="image-upload" 
                                        multiple 
                                        accept="image/*" 
                                        className="hidden"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            // Check if adding new files would exceed the limit
                                            setSelectedImages(prev => {
                                                const total = prev.length + files.length;
                                                if (total > 9) {
                                                    const allowedFiles = files.slice(0, 9 - prev.length);
                                                    alert(lang === 'en' ? `Maximum 9 images allowed. Only ${allowedFiles.length} additional images added.` : `最多允许9张图片。仅添加了${allowedFiles.length}张额外图片。`);
                                                    return [...prev, ...allowedFiles];
                                                }
                                                return [...prev, ...files];
                                            });
                                            
                                            // Generate previews for new files and add to existing list
                                            setImagePreviews(prev => {
                                                const currentCount = prev.length;
                                                const maxAllowed = 9 - currentCount;
                                                const filesToAdd = files.slice(0, maxAllowed);
                                                const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
                                                return [...prev, ...newPreviews];
                                            });
                                        }}
                                    />
                                    <label htmlFor="image-upload" className="cursor-pointer">
                                        <Image size={48} className="mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Click to select images or drag and drop' : '点击选择图片或拖放'}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{lang === 'en' ? `${selectedImages.length}/9 images` : `${selectedImages.length}/9 张图片`}</p>
                                    </label>
                                </div>
                                
                                {/* Image Previews */}
                                {selectedImages.length > 0 && (
                                    <div className="mb-8">
                                        <h3 className="text-sm font-medium text-muted-foreground mb-3">{lang === 'en' ? 'Selected Images' : '已选择的图片'}</h3>
                                        <div className="max-h-80 overflow-y-auto pr-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                {imagePreviews.map((preview, index) => (
                                                    <div key={index} className="relative border border-border rounded-lg overflow-hidden">
                                                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-40 object-cover" />
                                                        <button 
                                                            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background transition-colors"
                                                            onClick={() => {
                                                                const newImages = selectedImages.filter((_, i) => i !== index);
                                                                const newPreviews = imagePreviews.filter((_, i) => i !== index);
                                                                setSelectedImages(newImages);
                                                                setImagePreviews(newPreviews);
                                                            }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Recognition Button */}
                                <div className="flex justify-center">
                                    <button 
                                        onClick={async () => {
                                            if (selectedImages.length === 0) {
                                                alert(lang === 'en' ? 'Please select at least one image' : '请至少选择一张图片');
                                                return;
                                            }
                                            
                                            setIsRecognizing(true);
                                            setOcrProgress(0);
                                            
                                            // Start fake progress
                                            function startFakeProgress() {
                                                let progress = 0;
                                                const interval = setInterval(() => {
                                                    progress += 1;
                                                    if (progress <= 95) {
                                                        setOcrProgress(progress);
                                                    }
                                                }, 300);
                                                
                                                // Save interval ID to clear later
                                                const fakeProgressInterval = interval;
                                                
                                                // Clear fake progress when OCR completes
                                                setTimeout(() => {
                                                    clearInterval(fakeProgressInterval);
                                                    setOcrProgress(100);
                                                }, 6000); // Assume OCR takes 6 seconds
                                            }
                                            
                                            startFakeProgress();
                                            
                                            try {
                                                // Process each image
                                                for (let i = 0; i < selectedImages.length; i++) {
                                                    const file = selectedImages[i];
                                                    const reader = new FileReader();
                                                    
                                                    reader.onload = async (e) => {
                                                        const imageData = e.target?.result as string;
                                                        await handleRecognize(imageData);
                                                    };
                                                    
                                                    reader.readAsDataURL(file);
                                                }
                                            } catch (error) {
                                                console.error('Error recognizing images:', error);
                                                alert(lang === 'en' ? 'Recognition failed' : '识别失败');
                                            } finally {
                                                setIsRecognizing(false);
                                                setOcrProgress(0);
                                            }
                                        }}
                                        disabled={isRecognizing || selectedImages.length === 0}
                                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isRecognizing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                {lang === 'en' ? 'Recognizing...' : '识别中...'}
                                            </>
                                        ) : (
                                            <>
                                                <Scan size={18} />
                                                {lang === 'en' ? 'Recognize Text' : '识别文字'}
                                            </>
                                        )}
                                    </button>
                                </div>
                                
                                {/* Progress Bar */}
                                {isRecognizing && (
                                    <div className="mt-6">
                                        <div className="w-full bg-muted rounded-full h-4 mb-2">
                                            <div 
                                                className="bg-blue-500 h-4 rounded-full transition-all duration-300 ease-in-out" 
                                                style={{ width: `${ocrProgress}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center">
                                            {lang === 'en' ? `Progress: ${ocrProgress}%` : `进度: ${ocrProgress}%`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={`h-full w-full absolute inset-0 bg-background ${mobileViewMode === 'preview' ? 'z-10' : 'z-0 invisible'}`}>
                        <Renderer 
                            content={content} 
                            settings={settings} 
                            analysisData={analysisData}
                            onAnalysisUpdate={handleAnalysisUpdate}
                        />
                    </div>
                </div>
                
                {/* Mobile Bottom Navigation */}
                <div className="h-16 bg-card border-t border-border flex items-center justify-around px-2 shrink-0 z-50 safe-area-bottom">
                    <button 
                        onClick={() => { setMobileViewMode('write'); setInputMode('handwriting'); }}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'write' && inputMode !== 'image' ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <PenTool size={20} />
                        <span className="text-[10px] font-medium">Write</span>
                    </button>
                    <button 
                        onClick={() => { setMobileViewMode('type'); setInputMode('text'); }}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'type' && inputMode !== 'image' ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Type size={20} />
                        <span className="text-[10px] font-medium">Type</span>
                    </button>
                    <button 
                        onClick={() => setInputMode('image')}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${inputMode === 'image' ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Image size={20} />
                        <span className="text-[10px] font-medium">Image</span>
                    </button>
                    <button 
                        onClick={() => setMobileViewMode('preview')}
                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full transition-colors ${mobileViewMode === 'preview' && inputMode !== 'image' ? 'text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
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
                        isDarkMode={isDarkMode}
                    />
                    </div>
                    <div className={`h-full w-full ${inputMode === 'image' ? 'block' : 'hidden'} p-6`}>
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-xl font-bold mb-6 text-foreground">{lang === 'en' ? 'Image Recognition' : '图像识别'}</h2>
                            
                            {/* Image Upload */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-muted-foreground mb-2">{lang === 'en' ? 'Select Images' : '选择图片'}</label>
                                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted transition-colors cursor-pointer">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        className="hidden" 
                                        id="image-upload"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            // Check if adding new files would exceed the limit
                                            setSelectedImages(prev => {
                                                const total = prev.length + files.length;
                                                if (total > 9) {
                                                    const allowedFiles = files.slice(0, 9 - prev.length);
                                                    alert(lang === 'en' ? `Maximum 9 images allowed. Only ${allowedFiles.length} additional images added.` : `最多允许9张图片。仅添加了${allowedFiles.length}张额外图片。`);
                                                    return [...prev, ...allowedFiles];
                                                }
                                                return [...prev, ...files];
                                            });
                                            
                                            // Generate previews for new files and add to existing list
                                            setImagePreviews(prev => {
                                                const currentCount = prev.length;
                                                const maxAllowed = 9 - currentCount;
                                                const filesToAdd = files.slice(0, maxAllowed);
                                                const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
                                                return [...prev, ...newPreviews];
                                            });
                                        }}
                                    />
                                    <label htmlFor="image-upload" className="cursor-pointer">
                                        <Image size={48} className="mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Click to select images or drag and drop' : '点击选择图片或拖放'}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{lang === 'en' ? `${selectedImages.length}/9 images` : `${selectedImages.length}/9 张图片`}</p>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Image Previews */}
                            {selectedImages.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">{lang === 'en' ? 'Selected Images' : '已选择的图片'}</h3>
                                    <div className="max-h-80 overflow-y-auto pr-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative border border-border rounded-lg overflow-hidden">
                                                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-40 object-cover" />
                                                    <button 
                                                        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background transition-colors"
                                                        onClick={() => {
                                                            const newImages = selectedImages.filter((_, i) => i !== index);
                                                            const newPreviews = imagePreviews.filter((_, i) => i !== index);
                                                            setSelectedImages(newImages);
                                                            setImagePreviews(newPreviews);
                                                        }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Recognition Button */}
                            <div className="flex justify-center">
                                <button 
                                    onClick={async () => {
                                        if (selectedImages.length === 0) {
                                            alert(lang === 'en' ? 'Please select at least one image' : '请至少选择一张图片');
                                            return;
                                        }
                                        
                                        setIsRecognizing(true);
                                        setOcrProgress(0);
                                        
                                        // Start fake progress
                                        function startFakeProgress() {
                                            let progress = 0;
                                            const interval = setInterval(() => {
                                                progress += 1;
                                                if (progress <= 95) {
                                                    setOcrProgress(progress);
                                                }
                                            }, 300);
                                            
                                            // Save interval ID to clear later
                                            const fakeProgressInterval = interval;
                                            
                                            // Clear fake progress when OCR completes
                                            setTimeout(() => {
                                                clearInterval(fakeProgressInterval);
                                                setOcrProgress(100);
                                            }, 6000); // Assume OCR takes 6 seconds
                                        }
                                        
                                        startFakeProgress();
                                        
                                        try {
                                            // Process each image
                                            for (let i = 0; i < selectedImages.length; i++) {
                                                const file = selectedImages[i];
                                                const reader = new FileReader();
                                                
                                                reader.onload = async (e) => {
                                                    const imageData = e.target?.result as string;
                                                    await handleRecognize(imageData);
                                                };
                                                
                                                reader.readAsDataURL(file);
                                            }
                                        } catch (error) {
                                            console.error('Error recognizing images:', error);
                                            alert(lang === 'en' ? 'Recognition failed' : '识别失败');
                                        } finally {
                                            setIsRecognizing(false);
                                            setOcrProgress(0);
                                        }
                                    }}
                                    disabled={isRecognizing || selectedImages.length === 0}
                                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isRecognizing ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            {lang === 'en' ? 'Recognizing...' : '识别中...'}
                                        </>
                                    ) : (
                                        <>
                                            <Scan size={18} />
                                            {lang === 'en' ? 'Recognize Text' : '识别文字'}
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {/* Progress Bar */}
                            {isRecognizing && (
                                <div className="mt-4">
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div 
                                            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${ocrProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                        {lang === 'en' ? `Progress: ${ocrProgress}%` : `进度: ${ocrProgress}%`}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>
                
                <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors cursor-col-resize" />
                
                <Panel defaultSize={50} minSize={30} className="h-full">
                    <div className="h-full w-full bg-background overflow-hidden">
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
                    <div className="h-full w-full bg-background overflow-hidden">
                    <Renderer 
                        content={content} 
                        settings={settings} 
                        analysisData={analysisData}
                        onAnalysisUpdate={handleAnalysisUpdate} 
                    />
                    </div>
                </Panel>
                
                <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors cursor-col-resize" />
                
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
                        isDarkMode={isDarkMode}
                    />
                    </div>
                    <div className={`h-full w-full ${inputMode === 'image' ? 'block' : 'hidden'} p-6`}>
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-xl font-bold mb-6 text-foreground">{lang === 'en' ? 'Image Recognition' : '图像识别'}</h2>
                            
                            {/* Image Upload */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-muted-foreground mb-2">{lang === 'en' ? 'Select Images' : '选择图片'}</label>
                                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted transition-colors cursor-pointer">
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        className="hidden" 
                                        id="image-upload"
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            // Check if adding new files would exceed the limit
                                            setSelectedImages(prev => {
                                                const total = prev.length + files.length;
                                                if (total > 9) {
                                                    const allowedFiles = files.slice(0, 9 - prev.length);
                                                    alert(lang === 'en' ? `Maximum 9 images allowed. Only ${allowedFiles.length} additional images added.` : `最多允许9张图片。仅添加了${allowedFiles.length}张额外图片。`);
                                                    return [...prev, ...allowedFiles];
                                                }
                                                return [...prev, ...files];
                                            });
                                            
                                            // Generate previews for new files and add to existing list
                                            setImagePreviews(prev => {
                                                const currentCount = prev.length;
                                                const maxAllowed = 9 - currentCount;
                                                const filesToAdd = files.slice(0, maxAllowed);
                                                const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
                                                return [...prev, ...newPreviews];
                                            });
                                        }}
                                    />
                                    <label htmlFor="image-upload" className="cursor-pointer">
                                        <Image size={48} className="mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">{lang === 'en' ? 'Click to select images or drag and drop' : '点击选择图片或拖放'}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{lang === 'en' ? `${selectedImages.length}/9 images` : `${selectedImages.length}/9 张图片`}</p>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Image Previews */}
                            {selectedImages.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3">{lang === 'en' ? 'Selected Images' : '已选择的图片'}</h3>
                                    <div className="max-h-80 overflow-y-auto pr-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {imagePreviews.map((preview, index) => (
                                                <div key={index} className="relative border border-border rounded-lg overflow-hidden">
                                                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-40 object-cover" />
                                                    <button 
                                                        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background transition-colors"
                                                        onClick={() => {
                                                            const newImages = selectedImages.filter((_, i) => i !== index);
                                                            const newPreviews = imagePreviews.filter((_, i) => i !== index);
                                                            setSelectedImages(newImages);
                                                            setImagePreviews(newPreviews);
                                                        }}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Recognition Button */}
                            <div className="flex justify-center">
                                <button 
                                    onClick={async () => {
                                        if (selectedImages.length === 0) {
                                            alert(lang === 'en' ? 'Please select at least one image' : '请至少选择一张图片');
                                            return;
                                        }
                                        
                                        setIsRecognizing(true);
                                        setOcrProgress(0);
                                        
                                        // Start fake progress
                                        function startFakeProgress() {
                                            let progress = 0;
                                            const interval = setInterval(() => {
                                                progress += 1;
                                                if (progress <= 95) {
                                                    setOcrProgress(progress);
                                                }
                                            }, 300);
                                            
                                            // Save interval ID to clear later
                                            const fakeProgressInterval = interval;
                                            
                                            // Clear fake progress when OCR completes
                                            setTimeout(() => {
                                                clearInterval(fakeProgressInterval);
                                                setOcrProgress(100);
                                            }, 6000); // Assume OCR takes 6 seconds
                                        }
                                        
                                        startFakeProgress();
                                        
                                        try {
                                            // Process each image
                                            for (let i = 0; i < selectedImages.length; i++) {
                                                const file = selectedImages[i];
                                                const reader = new FileReader();
                                                
                                                reader.onload = async (e) => {
                                                    const imageData = e.target?.result as string;
                                                    await handleRecognize(imageData);
                                                };
                                                
                                                reader.readAsDataURL(file);
                                            }
                                        } catch (error) {
                                            console.error('Error recognizing images:', error);
                                            alert(lang === 'en' ? 'Recognition failed' : '识别失败');
                                        } finally {
                                            setIsRecognizing(false);
                                            setOcrProgress(0);
                                        }
                                    }}
                                    disabled={isRecognizing || selectedImages.length === 0}
                                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isRecognizing ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            {lang === 'en' ? 'Recognizing...' : '识别中...'}
                                        </>
                                    ) : (
                                        <>
                                            <Scan size={18} />
                                            {lang === 'en' ? 'Recognize Text' : '识别文字'}
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            {/* Progress Bar */}
                            {isRecognizing && (
                                <div className="mt-4">
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div 
                                            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${ocrProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                        {lang === 'en' ? `Progress: ${ocrProgress}%` : `进度: ${ocrProgress}%`}
                                    </p>
                                </div>
                            )}
                        </div>
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
                        className="bg-background border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setIsExportModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex flex-col gap-6">
                            <div className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                                <Download size={20} className="text-blue-400" />
                                {t.exportOptions}
                            </div>
                            
                            <div className="space-y-4">
                                {/* Format Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">{t.documentFormat}</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setDownloadFormat('tex')}
                                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${downloadFormat === 'tex' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-muted border-muted-foreground/30 text-muted-foreground hover:bg-muted/80'}`}
                                        >
                                            {t.latex}
                                        </button>
                                        <button 
                                            onClick={() => setDownloadFormat('md')}
                                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${downloadFormat === 'md' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-muted border-muted-foreground/30 text-muted-foreground hover:bg-muted/80'}`}
                                        >
                                            {t.markdown}
                                        </button>
                                    </div>
                                </div>

                                {/* Additional Content */}
                                <div className="space-y-3 pt-2">
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted-foreground/30 cursor-pointer hover:bg-muted transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={exportIncludePDF}
                                            onChange={(e) => setExportIncludePDF(e.target.checked)}
                                            className="w-4 h-4 rounded border-muted-foreground/50 bg-muted text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                <FileImage size={16} />
                                                {t.includeHandwritingPDF}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{t.exportCanvasPDF}</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-muted-foreground/30 cursor-pointer hover:bg-muted transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={exportIncludeAnalysis}
                                            onChange={(e) => setExportIncludeAnalysis(e.target.checked)}
                                            className="w-4 h-4 rounded border-muted-foreground/50 bg-muted text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                <Sparkles size={16} />
                                                {t.includeAIAnalysis}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{t.bundleExplanations}</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors w-full mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isExporting ? (
                                    <>{t.processing}</>
                                ) : (
                                    <>
                                        {(exportIncludePDF || exportIncludeAnalysis) ? <Archive size={18} /> : <Download size={18} />}
                                        { (exportIncludePDF || exportIncludeAnalysis) ? t.downloadZIP : t.downloadFile }
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
                                <img src="./favicon.png" alt="Large Logo" className="w-full h-full object-contain rounded-full" />
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

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
            <Portal>
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setIsHistoryOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 text-xl font-bold text-foreground tracking-tight">
                                <Clock size={20} className="text-blue-400" />
                                {lang === 'en' ? 'History' : '历史记录'}
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={clearHistory}
                                    className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                                    title={lang === 'en' ? 'Clear History' : '清除历史'}
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button 
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                    title={lang === 'en' ? 'Close' : '关闭'}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <input 
                                type="text"
                                placeholder={lang === 'en' ? 'Search history...' : '搜索历史...'}
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        
                        <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {history.length === 0 ? (
                                <div className="text-muted-foreground text-center py-8">
                                    {lang === 'en' ? 'No history yet' : '暂无历史记录'}
                                </div>
                            ) : (
                                <div className="space-y-3 pb-4">
                                    {history
                                        .filter(item => item.title.toLowerCase().includes(historySearch.toLowerCase()))
                                        .map((item) => (
                                            <div 
                                                key={item.id}
                                                className="bg-muted/50 border border-border/50 rounded-lg p-4 hover:bg-muted transition-colors"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-sm font-medium text-foreground truncate max-w-[80%]">
                                                        {item.title}
                                                    </h3>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => loadFromHistory(item)}
                                                            className="text-muted-foreground hover:text-blue-400 transition-colors p-1"
                                                            title={lang === 'en' ? 'Load' : '加载'}
                                                        >
                                                            <Sparkles size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteFromHistory(item.id)}
                                                            className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                                                            title={lang === 'en' ? 'Delete' : '删除'}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground mb-2">
                                                    {new Date(item.timestamp).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-muted-foreground line-clamp-2">
                                                    {item.content}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </Portal>
        )}
      </AnimatePresence>

      {/* Formula Table Modal */}
      <AnimatePresence>
        {isFormulaTableOpen && (
            <Portal>
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                    onClick={() => setIsFormulaTableOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-card border border-border p-6 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 text-xl font-bold text-foreground tracking-tight">
                                <BookOpen size={20} className="text-blue-400" />
                                {lang === 'en' ? 'Mathematical Formulas' : '数学公式'}
                            </div>
                            <button 
                                onClick={() => setIsFormulaTableOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                title={lang === 'en' ? 'Close' : '关闭'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex gap-4">
                            {/* Category Sidebar */}
                            <div className="w-48 flex-shrink-0">
                                <div className="space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {Object.entries(mathFormulas).map(([key, category]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedFormulaCategory(key)}
                                            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${selectedFormulaCategory === key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                                        >
                                            {category.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Formula List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh]">
                                <div className="space-y-4 pb-4">
                                    {mathFormulas[selectedFormulaCategory as keyof typeof mathFormulas]?.formulas.map((formula, index) => (
                                        <div 
                                            key={index}
                                            className="bg-muted/50 border border-border/50 rounded-lg p-4 hover:bg-muted transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-sm font-medium text-foreground">
                                                    {formula.name}
                                                </h3>
                                                <button 
                                                    onClick={() => insertFormula(formula.latex)}
                                                    className="text-muted-foreground hover:text-blue-400 transition-colors p-1"
                                                    title={lang === 'en' ? 'Insert Formula' : '插入公式'}
                                                >
                                                    <ArrowRightLeft size={16} />
                                                </button>
                                            </div>
                                            <div className="text-center py-3">
                                                <div className="text-lg text-foreground" dangerouslySetInnerHTML={{ __html: katex.renderToString(formula.latex, { displayMode: true, throwOnError: false, trust: true }) }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </Portal>
        )}
      </AnimatePresence>

      {/* 刷新按钮 */}
      <button
        onClick={handleRefresh}
        className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors z-50"
        title="刷新（清屏）"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  )
}

export default App
