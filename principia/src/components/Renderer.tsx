import 'katex/dist/katex.min.css';
import katex from 'katex';
import { InteractiveBadge } from './InteractiveBadge';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

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

interface RendererProps {
    content: string;
    settings?: AppSettings | null;
    analysisData?: Record<string, { explanation: string, visualization: string }>;
    onAnalysisUpdate?: (id: string, data: { explanation: string, visualization: string }) => void;
}

export function Renderer({ content, settings, analysisData, onAnalysisUpdate }: RendererProps) {
  // Simple regex to find display math: $$...$$ or \[...\]
  // Captures the delimiters and content
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g);

  // Helper to pre-process LaTeX text commands into Markdown-like or HTML-like for preview
  const preprocessLatexForPreview = (text: string) => {
      let processed = text;
      // Replace \section{...} -> # ...
      processed = processed.replace(/\\section\{([^}]+)\}/g, '# $1');
      // Replace \subsection{...} -> ## ...
      processed = processed.replace(/\\subsection\{([^}]+)\}/g, '## $1');
      // Replace \textbf{...} -> **...**
      processed = processed.replace(/\\textbf\{([^}]+)\}/g, '**$1**');
      // Replace \textit{...} -> *...*
      processed = processed.replace(/\\textit\{([^}]+)\}/g, '*$1*');
      
      // Replace \textcolor{color}{text} -> <font color="color">text</font> to render color using HTML font tag
      processed = processed.replace(/\\textcolor\{([^}]+)\}\{([^}]+)\}/g, '<font color="$1">$2</font>');
      
      // Replace {\color{color} text} -> <font color="color">text</font> (simple case, no nested braces)
      processed = processed.replace(/\{\\color\{([^}]+)\}\s*([^{}]+)\}/g, '<font color="$1">$2</font>');

      // Replace itemize/enumerate basic structure (simple case)
      processed = processed.replace(/\\begin\{itemize\}/g, '').replace(/\\end\{itemize\}/g, '');
      processed = processed.replace(/\\begin\{enumerate\}/g, '').replace(/\\end\{enumerate\}/g, '');
      processed = processed.replace(/\\item\s+/g, '- ');
      
      return processed;
  };

  return (
    <div className="prose prose-invert max-w-none p-8 space-y-6 font-serif h-full overflow-y-auto custom-scrollbar">
      {parts.map((part, index) => {
        if (part.startsWith('$$') || part.startsWith('\\[')) {
          // It's a display equation - simulate "AI Chunking"
          const modelId = `model-${index}`;
          const currentAnalysis = analysisData ? analysisData[modelId] : undefined;

          const latexHtml = katex.renderToString(part.replace(/^\$\$|^\\\[|\$\$$/g, '').replace(/\\\]$/,'').trim(), { displayMode: true, throwOnError: false, trust: true });
          return (
            <div key={index} className="flex items-start group relative my-6 bg-zinc-900/30 p-6 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-all hover:bg-zinc-900/80 hover:shadow-lg">
              <div className="flex-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: latexHtml }} />
              <div className="ml-4 mt-1 shrink-0">
                <InteractiveBadge 
                    id={modelId}
                    content={part} 
                    title={`Physical Model #${Math.ceil((index + 1) / 2)}`} 
                    fullContext={content} 
                    settings={settings}
                    existingAnalysis={currentAnalysis}
                    onAnalysisComplete={onAnalysisUpdate}
                />
              </div>
            </div>
          );
        } else {
          // Text content
          if (!part.trim()) return null;
          
          // Preprocess LaTeX commands for better preview if user is in TEX mode
          const processedText = preprocessLatexForPreview(part);

          return (
             <div key={index} className="space-y-4 text-zinc-300 leading-relaxed text-lg">
                <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[[rehypeKatex, { trust: true, strict: false }], rehypeRaw]}
                    components={{
                        p: ({children}) => <p className="mb-4">{children}</p>
                    }}
                >
                    {processedText}
                </ReactMarkdown>
             </div>
          );
        }
      })}
      
      {parts.length === 0 && (
        <div className="text-zinc-500 italic text-center mt-20">
          Start writing on the left to see the AI analysis...
        </div>
      )}
    </div>
  );
}
