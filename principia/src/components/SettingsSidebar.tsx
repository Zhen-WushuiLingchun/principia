import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save, Eye, Brain, Languages } from 'lucide-react';

interface ApiConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

interface SettingsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: { reasoning: ApiConfig, vision: ApiConfig }) => void;
    lang: 'en' | 'zh';
    onLangChange: (lang: 'en' | 'zh') => void;
}

const defaultReasoningConfig: ApiConfig = {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat"
};

const defaultVisionConfig: ApiConfig = {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: "",
    model: "gemini-2.0-flash-exp"
};

export function SettingsSidebar({ isOpen, onClose, onSave, lang, onLangChange }: SettingsSidebarProps) {
    const [reasoningConfig, setReasoningConfig] = useState<ApiConfig>(defaultReasoningConfig);
    const [visionConfig, setVisionConfig] = useState<ApiConfig>(defaultVisionConfig);

    // Load from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('the_principia_settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setTimeout(() => {
                  if (parsed.reasoning) setReasoningConfig(parsed.reasoning);
                  if (parsed.vision) setVisionConfig(parsed.vision);
                }, 0);
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    const handleSave = () => {
        const settings = {
            reasoning: reasoningConfig,
            vision: visionConfig
        };
        localStorage.setItem('the_principia_settings', JSON.stringify(settings));
        onSave(settings);
        onClose();
    };

    const t = {
        title: lang === 'en' ? "API Configuration" : "API 配置",
        reasoningTitle: lang === 'en' ? "Explanation API" : "解释 (Explanation) API",
        reasoningDesc: lang === 'en' 
            ? <>Used for physics explanations. Recommend using text processing models from providers like <strong>DeepSeek</strong> or <strong>OpenAI</strong>.</>
            : <>用于物理原理解释。建议使用 <strong>DeepSeek</strong> 或 <strong>OpenAI</strong> 等服务商的文本处理模型。</>,
        visionTitle: lang === 'en' ? "Multimodal API" : "多模态 (Multimodal) API",
        visionDesc: lang === 'en'
            ? <>Used for handwriting recognition and visualization generation. Requires strong <strong>multimodal</strong> capabilities. Recommend providers like <strong>Gemini</strong> or <strong>Doubao</strong>.</>
            : <>用于手写识别和生成可视化模拟。需要强大的<strong>多模态</strong>能力。建议使用 <strong>Gemini</strong> 或 <strong>豆包 (Doubao)</strong> 等服务商。</>,
        baseUrl: lang === 'en' ? "Base URL" : "API 地址 (Base URL)",
        apiKey: lang === 'en' ? "API Key" : "API 密钥 (Key)",
        modelName: lang === 'en' ? "Model Name" : "模型名称 (Model)",
        save: lang === 'en' ? "Save Configuration" : "保存配置"
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl z-[9999] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                            <div className="flex items-center gap-2 text-white font-semibold text-lg">
                                <Settings size={20} />
                                <span>{t.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => onLangChange(lang === 'en' ? 'zh' : 'en')}
                                    className="text-zinc-500 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800"
                                    title="Switch Language"
                                >
                                    <Languages size={18} />
                                </button>
                                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Reasoning API Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-green-400 font-medium border-b border-zinc-800 pb-2">
                                    <Brain size={18} />
                                    <span>{t.reasoningTitle}</span>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    {t.reasoningDesc}
                                </p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.baseUrl}</label>
                                        <input 
                                            type="text" 
                                            value={reasoningConfig.baseUrl}
                                            onChange={e => setReasoningConfig({...reasoningConfig, baseUrl: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                                            placeholder="https://api.deepseek.com/v1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.apiKey}</label>
                                        <input 
                                            type="password" 
                                            value={reasoningConfig.apiKey}
                                            onChange={e => setReasoningConfig({...reasoningConfig, apiKey: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.modelName}</label>
                                        <input 
                                            type="text" 
                                            value={reasoningConfig.model}
                                            onChange={e => setReasoningConfig({...reasoningConfig, model: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 transition-colors"
                                            placeholder="deepseek-chat"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Vision API Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-blue-400 font-medium border-b border-zinc-800 pb-2">
                                    <Eye size={18} />
                                    <span>{t.visionTitle}</span>
                                </div>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    {t.visionDesc}
                                </p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.baseUrl}</label>
                                        <input 
                                            type="text" 
                                            value={visionConfig.baseUrl}
                                            onChange={e => setVisionConfig({...visionConfig, baseUrl: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.apiKey}</label>
                                        <input 
                                            type="password" 
                                            value={visionConfig.apiKey}
                                            onChange={e => setVisionConfig({...visionConfig, apiKey: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="sk-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">{t.modelName}</label>
                                        <input 
                                            type="text" 
                                            value={visionConfig.model}
                                            onChange={e => setVisionConfig({...visionConfig, model: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="gemini-1.5-flash"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
                            <button 
                                onClick={handleSave}
                                className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-zinc-200 transition-colors"
                            >
                                <Save size={18} />
                                {t.save}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
