import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Project, GeneratedImage, Settings, Theme, NewProjectImageState } from './types';
import { editImage, editImageWithOpenAI } from './services/geminiService';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB in bytes
const MAX_REFERENCE_IMAGES = 4;

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    useOpenAICompatibleEndpoint: false,
    openaiApiUrl: 'https://api.apicore.ai/v1/images/edits',
    openaiModelId: 'gemini-2.5-flash-image',
    openaiApiKey: '',
};

const THEME_NAMES: Record<Theme, string> = {
  dark: '深色',
  light: '浅色',
  fluorescent: '荧光',
  oceanic: '海洋',
  'crimson-night': '绯红之夜',
  sakura: '樱花',
};


const PHOTOSHOP_SERVER_URL = 'http://localhost:8080';

// --- Helper Functions ---
const fileToImageState = (file: File): Promise<NewProjectImageState> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`文件太大。请上传小于 ${MAX_FILE_SIZE / 1024 / 1024}MB 的图片。`));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64WithPrefix = result;
      const mimeType = result.split(';')[0].split(':')[1];
      resolve({ id: `new_${Date.now()}_${Math.random()}`, file, base64: base64WithPrefix.split(',')[1], mimeType, base64WithPrefix });
    };
    reader.onerror = (error) => reject(error);
  });
};

const formatTimestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

// --- SVG Icon Components ---
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
);
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
);
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.007 1.11-1.226.554-.22 1.197-.22 1.752 0 .549.219 1.02.684 1.11 1.226l.094.549a2.25 2.25 0 0 1-1.683 2.986l-.505.222a2.25 2.25 0 0 0-1.503 1.503l-.222.505a2.25 2.25 0 0 1-2.986 1.683l-.549-.094a1.125 1.125 0 0 0-1.226 1.11l0 1.752c-.219.55.22 1.196 1.226 1.752.542.09.917.56 1.226 1.11l.094.549a2.25 2.25 0 0 1 1.683 2.986l.505.222a2.25 2.25 0 0 0 1.503 1.503l.222.505a2.25 2.25 0 0 1 2.986 1.683l.549.094c.542-.09.917-.56 1.226-1.11l0-1.752c.219-.55-.22-1.196-1.226-1.752a1.125 1.125 0 0 0-1.11-1.226l-.549-.094a2.25 2.25 0 0 1-2.986-1.683l-.505-.222a2.25 2.25 0 0 0-1.503-1.503l-.222-.505a2.25 2.25 0 0 1-1.683-2.986l.094-.549.094-.549Z" /></svg>
);
const LogIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5 0-4.5 16.5" /></svg>
);
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0 8.25 8.25 0 0 0 0-11.667l-3.182-3.182m0 0-4.992 4.992" />
    </svg>
);
const SetAsReferenceIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-5 h-5"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v11.25" />
    </svg>
);
const PhotoshopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
       <path d="M1.201 1.2c-.66 0-1.2.54-1.2 1.2v20.4c0 .66.54 1.2 1.2 1.2h21.6c.66 0 1.2-.54 1.2-1.2V2.4c0-.66-.54-1.2-1.2-1.2H1.201zm3.6 5.4h3.6c2.4 0 3.6 1.2 3.6 3.3s-1.2 3.3-3.6 3.3H4.801V6.6zm3.0 4.5c.96 0 1.2-.6 1.2-1.2s-.24-1.2-1.2-1.2h-1.8v2.4h1.8zm6.6-4.5h3.9c2.4 0 3.9 1.2 3.9 3.6 0 1.2-.36 2.1-.84 2.7.6.36 1.08 1.2 1.08 2.4 0 2.7-1.8 4.2-4.2 4.2h-3.84V6.6zm3.6 4.8c.84 0 1.2-.6 1.2-1.2s-.36-1.2-1.2-1.2h-2.4v2.4h2.4zm.24 4.2c1.2 0 1.44-.6 1.44-1.5s-.24-1.5-1.44-1.5h-2.64v3.0h2.64z" />
    </svg>
);

// --- UI Components ---
interface ZoomableImageProps { src: string; alt: string; }
const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt }) => {
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const lastPosition = useRef({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.002;
        const newScale = Math.max(1, Math.min(8, transform.scale + scaleAmount));
        
        setTransform(t => ({...t, scale: newScale}));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (transform.scale > 1) {
            isDragging.current = true;
            lastPosition.current = { x: e.clientX, y: e.clientY };
            if(imageRef.current) imageRef.current.style.cursor = 'grabbing';
        }
    };
    
    const handleMouseUp = () => {
        isDragging.current = false;
        if(imageRef.current) imageRef.current.style.cursor = 'grab';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current) {
            const dx = e.clientX - lastPosition.current.x;
            const dy = e.clientY - lastPosition.current.y;
            lastPosition.current = { x: e.clientX, y: e.clientY };
            setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
        }
    };

    const handleZoom = (direction: 'in' | 'out') => {
        const scaleAmount = direction === 'in' ? 0.3 : -0.3;
        const newScale = Math.max(1, Math.min(8, transform.scale + scaleAmount));
        setTransform(t => ({...t, scale: newScale}));
    };

    const handleReset = () => {
        setTransform({ x: 0, y: 0, scale: 1 });
    }

    return (
        <div 
            className="w-full h-full flex flex-col items-center justify-center relative"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            <div className="flex-grow w-full h-full overflow-hidden flex items-center justify-center">
                <img
                    ref={imageRef}
                    src={src}
                    alt={alt}
                    className="max-w-full max-h-full object-contain transition-transform duration-100 ease-linear"
                    style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        cursor: transform.scale > 1 ? 'grab' : 'default',
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    draggable="false"
                />
            </div>
            <div className="absolute bottom-4 right-4 bg-black/50 p-1.5 rounded-lg flex items-center gap-1 text-white">
                <button title="放大" onClick={() => handleZoom('in')} className="p-2 rounded-md hover:bg-white/20"><PlusIcon className="w-4 h-4" /></button>
                <button title="缩小" onClick={() => handleZoom('out')} className="p-2 rounded-md hover:bg-white/20" disabled={transform.scale <= 1}>-</button>
                <button title="重置" onClick={handleReset} className="p-2 rounded-md hover:bg-white/20">Reset</button>
            </div>
        </div>
    );
};

interface ImagePreviewModalProps { imageUrl: string; onClose: () => void; }
const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300" onClick={onClose}>
            <div className="relative w-full h-full max-w-6xl max-h-[95vh] modal-content-animate flex" onClick={(e) => e.stopPropagation()}>
                <ZoomableImage src={imageUrl} alt="Enlarged preview" />
                <button onClick={onClose} className="absolute -top-2 -right-2 bg-themed-secondary text-themed-primary rounded-full p-2 hover:bg-themed-tertiary transition-colors z-10"><CloseIcon className="w-6 h-6" /></button>
            </div>
        </div>
    );
};

interface SettingsModalProps { settings: Settings; onSave: (newSettings: Settings) => void; onClose: () => void; }
const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const handleSave = () => { onSave(localSettings); onClose(); };
    const handleClearKey = () => setLocalSettings(s => ({...s, openaiApiKey: ''}));
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-themed-secondary rounded-lg shadow-xl w-full max-w-md p-6 modal-content-animate text-themed-primary" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4 text-themed-accent">设置</h2>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-themed-secondary mb-2">主题</label>
                        <div className="flex flex-wrap gap-3">
                            {(Object.keys(THEME_NAMES) as Theme[]).map(theme => (
                                <button key={theme} onClick={() => setLocalSettings(s => ({...s, theme}))} className={`px-4 py-2 rounded-md text-sm capitalize transition-all ${localSettings.theme === theme ? 'ring-2 ring-themed-accent bg-themed-accent-active' : 'bg-themed-tertiary hover:opacity-80'}`}>
                                    {THEME_NAMES[theme]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-themed-primary pt-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={localSettings.useOpenAICompatibleEndpoint} onChange={e => setLocalSettings(s => ({ ...s, useOpenAICompatibleEndpoint: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium">使用 OpenAI 兼容端点</span>
                        </label>
                        {localSettings.useOpenAICompatibleEndpoint && (
                            <div className="mt-4 space-y-3 pl-6 border-l-2 border-themed-primary ml-1.5">
                                <div>
                                    <label htmlFor="api-url" className="text-xs text-themed-secondary">API 地址</label>
                                    <input id="api-url" type="text" value={localSettings.openaiApiUrl} onChange={e => setLocalSettings(s => ({...s, openaiApiUrl: e.target.value}))} placeholder="https://..." className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm" />
                                    <p className="mt-1.5 text-xs text-themed-tertiary">必须是兼容 OpenAI 的 <b className="text-themed-secondary">图像编辑</b> API 端点。通常，此 URL 以 <code>/v1/images/edits</code> 结尾。请勿使用聊天端点 (例如 <code>/v1/chat/completions</code>)。</p>
                                </div>
                                <div>
                                    <label htmlFor="model-id" className="text-xs text-themed-secondary">模型 ID</label>
                                    <input id="model-id" type="text" value={localSettings.openaiModelId} onChange={e => setLocalSettings(s => ({...s, openaiModelId: e.target.value}))} placeholder="dall-e-2" className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm" />
                                    <p className="mt-1.5 text-xs text-themed-tertiary">对于自定义服务，模型 ID 必须准确。如果遇到 <code>503 服务不可用</code> 或 <code>无可用渠道</code> 的错误，通常表示此字段为空或模型名称无效。请咨询您的服务提供商以获取正确的模型 ID。</p>
                                </div>
                                <div>
                                    <label htmlFor="api-key" className="text-xs text-themed-secondary">API 密钥</label>
                                    <div className="flex items-center space-x-2"><input id="api-key" type="password" value={localSettings.openaiApiKey} onChange={e => setLocalSettings(s => ({...s, openaiApiKey: e.target.value}))} placeholder="sk-..." className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm" /><button onClick={handleClearKey} className="mt-1 px-2 py-1 text-xs bg-themed-tertiary border border-themed-primary rounded-md hover:border-themed-secondary">清除</button></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-themed-tertiary hover:opacity-80">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white rounded-md btn-secondary">保存</button>
                </div>
            </div>
        </div>
    );
};

const Spinner: React.FC = () => ( <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> );

interface LogPanelProps { logs: string[]; isVisible: boolean; onClose: () => void; onClear: () => void; }
const LogPanel: React.FC<LogPanelProps> = ({ logs, isVisible, onClose, onClear }) => (
    <div className={`fixed bottom-0 left-0 right-0 z-40 bg-themed-secondary/80 backdrop-blur-md shadow-2xl rounded-t-lg log-panel ${isVisible ? 'visible' : ''}`}>
        <div className="log-panel-header flex justify-between items-center">
            <h3 className="font-semibold text-sm text-themed-secondary">运行日志</h3>
            <div className="space-x-2">
                <button onClick={onClear} className="log-panel-button">清除</button>
                <button onClick={onClose} className="log-panel-button">关闭</button>
            </div>
        </div>
        <pre className="p-4 h-full overflow-y-auto custom-scrollbar text-xs text-themed-tertiary whitespace-pre-wrap break-all max-h-[calc(40vh-40px)]">
            {logs.length > 0 ? logs.join('\n') : '暂无日志。'}
        </pre>
    </div>
);

// --- Main App Component ---
export default function App() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [newProjectImages, setNewProjectImages] = useState<NewProjectImageState[]>([]);
    const [combinedReferenceImage, setCombinedReferenceImage] = useState<NewProjectImageState | null>(null);
    const [newProjectStylePrompt, setNewProjectStylePrompt] = useState<string>("");
    const [newProjectModificationPrompt, setNewProjectModificationPrompt] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isConnectingToPS, setIsConnectingToPS] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [logs, setLogs] = useState<string[]>([]);
    const [isLogPanelVisible, setLogPanelVisible] = useState(false);
    const [numToGenerate, setNumToGenerate] = useState<number>(1);
    const [loadingText, setLoadingText] = useState<string>('');

    const addLog = useCallback((message: string) => {
      const logEntry = `[${formatTimestamp()}] ${message}`;
      console.log(message);
      setLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs
    }, []);

    const resetNewProjectForm = useCallback(() => {
        setNewProjectImages([]);
        setCombinedReferenceImage(null);
        setNewProjectStylePrompt("");
        setNewProjectModificationPrompt("");
        addLog("新项目表单已重置。");
    }, [addLog]);

    const reloadDataAndResetView = useCallback(() => {
        addLog("重新加载应用数据...");
        try {
            const savedProjects = localStorage.getItem('style-transfer-projects');
            if (savedProjects) {
                setProjects(JSON.parse(savedProjects));
                addLog(`成功从 localStorage 加载 ${JSON.parse(savedProjects).length} 个项目。`);
            } else {
                setProjects([]);
            }
            
            const savedSettings = localStorage.getItem('ai-image-settings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
                addLog("成功从 localStorage 加载设置。");
            } else {
                setSettings(DEFAULT_SETTINGS);
                addLog("未找到本地设置，使用默认设置。");
            }
        } catch (e) { 
            console.error("Failed to load from localStorage", e);
            addLog(`从 localStorage 加载数据失败: ${e instanceof Error ? e.message : String(e)}`);
        }
        setActiveProjectId(null);
        resetNewProjectForm();
        setLogPanelVisible(false);
        setError(null);
        addLog("应用视图已重置。");

    }, [addLog, resetNewProjectForm]);

    useEffect(() => {
        // This effect runs only once on initial mount to load data.
        reloadDataAndResetView();
    // The dependency array is correct because reloadDataAndResetView is memoized with useCallback.
    }, [reloadDataAndResetView]);

    useEffect(() => {
        try {
            localStorage.setItem('style-transfer-projects', JSON.stringify(projects));
        } catch (e) { 
            console.error("Failed to save projects to localStorage", e); 
            addLog(`保存项目到 localStorage 失败: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [projects, addLog]);
    
    useEffect(() => {
        try {
            localStorage.setItem('ai-image-settings', JSON.stringify(settings));
            document.documentElement.className = `theme-${settings.theme}`;
        } catch (e) { 
            console.error("Failed to save settings to localStorage", e); 
            addLog(`保存设置到 localStorage 失败: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [settings, addLog]);

    useEffect(() => {
        if(error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

    const handleGetFromPhotoshop = async () => {
        addLog("正在从 Photoshop 获取图像...");
        setIsConnectingToPS(true);
        setError(null);
        try {
            const response = await fetch(`${PHOTOSHOP_SERVER_URL}/get_image_from_photoshop`);
            const data = await response.json();

            if (data.status === 'success' && data.imageData) {
                 const blob = await (await fetch(data.imageData)).blob();
                 const file = new File([blob], "from_photoshop.png", { type: "image/png" });
                 const imageState = await fileToImageState(file);
                 setNewProjectImages([imageState]);
                 addLog("成功从 Photoshop 获取图像。");

            } else {
                throw new Error(data.message || "Photoshop 脚本返回一个错误。");
            }
        } catch (err) {
            const errorMsg = "无法连接到 Photoshop。请确保 Photoshop 正在运行，并且集成脚本已启动。";
            setError(errorMsg);
            addLog(`Photoshop 连接失败: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsConnectingToPS(false);
        }
    };
    
    const handleSendToPhotoshop = async (image: GeneratedImage) => {
        addLog(`正在发送图片 ${image.id} 到 Photoshop...`);
        setError(null);
        try {
            const response = await fetch(`${PHOTOSHOP_SERVER_URL}/send_image_to_photoshop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData: image.base64 })
            });
            const data = await response.json();

            if (data.status !== 'success') {
                throw new Error(data.message || "Photoshop 脚本返回一个错误。");
            }
            addLog("图片已成功发送到 Photoshop。");
        } catch (err) {
            const errorMsg = "无法发送到 Photoshop。请确保 Photoshop 正在运行，并且集成脚本已启动。";
            setError(errorMsg);
            addLog(`发送到 Photoshop 失败: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const currentCount = newProjectImages.length;
            const availableSlots = MAX_REFERENCE_IMAGES - currentCount;
            if (files.length > availableSlots) {
                setError(`您最多只能选择 ${MAX_REFERENCE_IMAGES} 张参考图。`);
                addLog(`上传中止: 尝试上传 ${files.length} 张图片，但只剩 ${availableSlots} 个空位。`);
                return;
            }

            addLog(`选择了 ${files.length} 个文件...`);
            setError(null);
            try {
                const imagePromises = Array.from(files).map(fileToImageState);
                const newImages = await Promise.all(imagePromises);
                setNewProjectImages(prev => [...prev, ...newImages]);
                addLog("文件处理成功，预览已更新。");
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "图片处理失败。";
                setError(errorMessage);
                addLog(`文件处理失败: ${errorMessage}`);
            }
        }
        event.target.value = ''; // Allow re-selecting the same file
    };

    const handleRemoveNewProjectImage = (idToRemove: string) => {
        setNewProjectImages(prev => prev.filter(img => img.id !== idToRemove));
    };

    useEffect(() => {
        const combineImages = async () => {
            if (newProjectImages.length === 0) {
                setCombinedReferenceImage(null);
                return;
            }
            if (newProjectImages.length === 1) {
                setCombinedReferenceImage(newProjectImages[0]);
                return;
            }

            setLoadingText("正在合并参考图...");
            addLog(`开始合并 ${newProjectImages.length} 张参考图...`);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setError("无法创建画布来合并图像。");
                addLog("合并失败: 无法获取 Canvas 2D context。");
                setLoadingText("");
                return;
            }
            
            const gridSize = Math.ceil(Math.sqrt(newProjectImages.length));
            const imageSize = 1024 / gridSize;
            canvas.width = 1024;
            canvas.height = 1024;
            ctx.fillStyle = '#111827'; // Match dark theme background
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            try {
                const imagePromises = newProjectImages.map(imgInfo => new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = imgInfo.base64WithPrefix;
                }));

                const loadedImages = await Promise.all(imagePromises);

                loadedImages.forEach((img, index) => {
                    const row = Math.floor(index / gridSize);
                    const col = index % gridSize;
                    ctx.drawImage(img, col * imageSize, row * imageSize, imageSize, imageSize);
                });

                const combinedDataUrl = canvas.toDataURL('image/png');
                setCombinedReferenceImage({
                    id: 'combined',
                    file: { name: 'combined_reference.png' } as File,
                    base64: combinedDataUrl.split(',')[1],
                    mimeType: 'image/png',
                    base64WithPrefix: combinedDataUrl
                });
                addLog("参考图合并成功。");
            } catch (e) {
                setError("加载参考图以进行合并时出错。");
                addLog(`合并失败: ${e instanceof Error ? e.message : String(e)}`);
            } finally {
                setLoadingText("");
            }
        };
        combineImages();
    }, [newProjectImages, addLog]);

    const handleGenerate = async (projectToUpdate?: Project) => {
        const count = numToGenerate;
        addLog(`开始生成任务... (数量: ${count}) ${projectToUpdate ? `(项目ID: ${projectToUpdate.id})` : '(新项目)'}`);
        
        const imageInfo = projectToUpdate?.referenceImage ?? combinedReferenceImage;
        const style = projectToUpdate?.stylePrompt ?? newProjectStylePrompt;
        const modification = projectToUpdate?.modificationPrompt ?? newProjectModificationPrompt;

        if (!imageInfo) { setError("请上传一张参考图片。"); addLog("生成中止: 未上传参考图片。"); return; }
        if (!style.trim()) { setError("请输入您想要的风格。"); addLog("生成中止: 风格描述为空。"); return; }

        setIsLoading(true); setError(null);

        try {
            let allGeneratedImages: GeneratedImage[] = [];
            if (settings.useOpenAICompatibleEndpoint) {
                setLoadingText(`请求 ${count} 张图片...`);
                addLog("使用 OpenAI 兼容端点。");
                const fullDataUrl = projectToUpdate 
                    ? projectToUpdate.referenceImage.base64
                    : combinedReferenceImage!.base64WithPrefix;

                const base64Results = await editImageWithOpenAI(fullDataUrl, style, modification, settings.openaiApiUrl, settings.openaiModelId, settings.openaiApiKey, count, addLog);
                allGeneratedImages = base64Results.map((generatedBase64, i) => ({
                    id: `img_${Date.now()}_${i}`,
                    base64: `data:image/png;base64,${generatedBase64}`
                }));
                setLoadingText(`已完成 ${base64Results.length}/${count}`);
                addLog(`OpenAI API 批量生成了 ${base64Results.length} 张图片。`);

            } else {
                 addLog("使用 Google Gemini API。");
                 const rawBase64 = imageInfo.base64.split(',').pop() || '';
                 
                 for (let i = 0; i < count; i++) {
                    setLoadingText(`生成中 (${i + 1}/${count})`);
                    addLog(`正在生成第 ${i + 1} 张图片...`);
                    const generatedBase64 = await editImage(rawBase64, imageInfo.mimeType, style, modification, addLog);
                    const newImage: GeneratedImage = {
                        id: `img_${Date.now()}_${i}`,
                        base64: `data:image/png;base64,${generatedBase64}`
                    };
                    allGeneratedImages.push(newImage);

                    if (projectToUpdate) {
                        setProjects(prevProjects => prevProjects.map(p =>
                            p.id === projectToUpdate.id ? { ...p, generatedImages: [...p.generatedImages, newImage] } : p
                        ));
                    }
                 }
            }
            
            addLog(`图片生成成功，共 ${allGeneratedImages.length} 张。`);

            if (projectToUpdate) {
                addLog(`向项目 ${projectToUpdate.id} 添加 ${allGeneratedImages.length} 张新图片。`);
                if (settings.useOpenAICompatibleEndpoint) {
                     setProjects(prevProjects => prevProjects.map(p =>
                        p.id === projectToUpdate.id ? { ...p, generatedImages: [...p.generatedImages, ...allGeneratedImages] } : p
                    ));
                }
            } else {
                addLog("创建新项目。");
                const newProject: Project = {
                    id: `proj_${Date.now()}`,
                    referenceImage: {
                        base64: combinedReferenceImage!.base64WithPrefix,
                        name: combinedReferenceImage!.file.name, mimeType: imageInfo.mimeType
                    },
                    stylePrompt: style, modificationPrompt: modification,
                    generatedImages: allGeneratedImages,
                    createdAt: new Date().toISOString()
                };
                setProjects(prevProjects => [newProject, ...prevProjects]);
                setActiveProjectId(newProject.id); 
                resetNewProjectForm();
                setNumToGenerate(1);
                addLog(`新项目 ${newProject.id} 创建成功并设为活动项目。`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "生成图片时发生未知错误。";
            setError(errorMessage);
            addLog(`生成失败: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setLoadingText('');
            addLog("生成任务结束。");
        }
    };
    
    const handleDeleteProject = (projectId: string) => {
        addLog(`请求删除项目: ${projectId}`);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) setActiveProjectId(null);
    }
    
    const handleDeleteGeneratedImage = (projectId: string, imageId: string) => {
        addLog(`请求删除项目 ${projectId} 中的图片 ${imageId}`);
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) return { ...p, generatedImages: p.generatedImages.filter(img => img.id !== imageId) };
            return p;
        }));
    }

    const handleSetAsReference = (projectId: string, image: GeneratedImage) => {
        addLog(`将项目 ${projectId} 的参考图设置为图片 ${image.id}`);
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const mimeTypeMatch = image.base64.match(/data:(.*);base64,/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
                
                return { 
                    ...p, 
                    referenceImage: {
                        base64: image.base64,
                        name: `来自 ${p.id} 的生成图`,
                        mimeType: mimeType,
                    }
                };
            }
            return p;
        }));
    };

    const handleModificationPromptChange = (projectId: string, newPrompt: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modificationPrompt: newPrompt } : p ));
    };

    const handleStylePromptChange = (projectId: string, newPrompt: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, stylePrompt: newPrompt } : p ));
    };
    
    const handleSaveSettings = (newSettings: Settings) => {
        addLog("保存设置。");
        setSettings(newSettings);
    };

    const NumberInput: React.FC<{ value: number; onChange: (value: number) => void; min?: number; max?: number; labelledby: string; }> = ({ value, onChange, min = 1, max = 4, labelledby }) => {
        const increment = () => onChange(Math.min(max, value + 1));
        const decrement = () => onChange(Math.max(min, value - 1));
        return (
            <div className="flex items-center space-x-2 bg-themed-tertiary px-1 py-1 rounded-md">
                <button onClick={decrement} aria-label="减少数量" className="px-2 py-1 bg-themed-secondary rounded-md hover:opacity-80 disabled:opacity-50" disabled={value <= min}>-</button>
                <span aria-labelledby={labelledby} className="font-semibold text-lg w-8 text-center tabular-nums">{value}</span>
                <button onClick={increment} aria-label="增加数量" className="px-2 py-1 bg-themed-secondary rounded-md hover:opacity-80 disabled:opacity-50" disabled={value >= max}>+</button>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex flex-col bg-themed-primary text-themed-primary">
            <header className="bg-themed-secondary/50 backdrop-blur-sm shadow-md p-4 border-b border-themed-primary flex justify-between items-center z-10">
                <div className="w-24"></div> {/* Spacer */}
                <h1 className="text-2xl font-bold text-center text-themed-accent">AI 图像风格转换器</h1>
                <div className="flex items-center space-x-2 w-24 justify-end">
                    <button title="刷新应用" onClick={reloadDataAndResetView} className="p-2 rounded-full hover:bg-themed-tertiary transition-colors text-themed-secondary"><RefreshIcon className="w-5 h-5"/></button>
                    <button title="查看日志" onClick={() => {addLog("打开日志面板。"); setLogPanelVisible(true);}} className="p-2 rounded-full hover:bg-themed-tertiary transition-colors text-themed-secondary"><LogIcon className="w-5 h-5"/></button>
                    <button title="打开设置" onClick={() => {addLog("打开设置。"); setSettingsOpen(true);}} className="p-2 rounded-full hover:bg-themed-tertiary transition-colors text-themed-secondary"><SettingsIcon className="w-5 h-5"/></button>
                </div>
            </header>

            <main className="flex-grow flex flex-col md:flex-row h-[calc(100vh-65px)]">
                <aside className="w-full md:w-1/3 xl:w-1/4 p-4 border-r border-themed-primary flex flex-col gap-6 bg-themed-secondary/30 overflow-y-auto custom-scrollbar">
                    <div className="bg-themed-secondary p-4 rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 border-b border-themed-primary pb-2 flex items-center gap-2"><PlusIcon className="w-5 h-5"/>创建新项目</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-themed-secondary mb-1">1. 上传参考图 (最多 {MAX_REFERENCE_IMAGES} 张)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-themed-primary border-dashed rounded-md">
                                    <div className="space-y-1 text-center w-full">
                                        {combinedReferenceImage ? <img src={combinedReferenceImage.base64WithPrefix} alt="Preview" className="mx-auto h-24 w-auto rounded-md" /> : <svg className="mx-auto h-12 w-12 text-themed-tertiary" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                        <div className="flex text-sm text-themed-tertiary justify-center items-center">
                                          <label htmlFor="file-upload" className={`relative cursor-pointer bg-themed-tertiary rounded-md font-medium text-themed-accent hover:opacity-80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-themed-accent px-2 py-1 ${newProjectImages.length >= MAX_REFERENCE_IMAGES ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                              <span>选择文件</span>
                                              <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} multiple disabled={newProjectImages.length >= MAX_REFERENCE_IMAGES} />
                                          </label>
                                          <p className="pl-1">或拖拽至此</p>
                                        </div>
                                        <p className="text-xs text-themed-tertiary">PNG, JPG, WEBP (小于 4MB)</p>
                                    </div>
                                </div>
                                {newProjectImages.length > 0 && (
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                        {newProjectImages.map(img => (
                                            <div key={img.id} className="relative group aspect-square">
                                                <img src={img.base64WithPrefix} alt={img.file.name} className="w-full h-full object-cover rounded-md" />
                                                <button onClick={() => handleRemoveNewProjectImage(img.id)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CloseIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={handleGetFromPhotoshop}
                                    disabled={isConnectingToPS}
                                    className="mt-2 w-full flex justify-center items-center gap-2 py-2 px-4 border border-themed-primary rounded-md shadow-sm text-sm font-medium text-themed-secondary hover:border-themed-secondary hover:text-themed-primary disabled:opacity-50 disabled:cursor-wait transition-colors"
                                >
                                    {isConnectingToPS ? <><Spinner /> 连接中...</> : <><PhotoshopIcon className="w-5 h-5" /> 从 Photoshop 获取</>}
                                </button>

                            </div>
                            <div>
                                <label htmlFor="style-prompt" className="block text-sm font-medium text-themed-secondary">2. 描述风格</label>
                                <input type="text" id="style-prompt" value={newProjectStylePrompt} onChange={e => setNewProjectStylePrompt(e.target.value)} placeholder="例如: 梵高星空、赛博朋克、水墨画" className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 text-themed-primary focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm"/>
                            </div>
                            <div>
                                <label htmlFor="mod-prompt" className="block text-sm font-medium text-themed-secondary">3. 描述修改内容 (可选)</label>
                                <textarea id="mod-prompt" value={newProjectModificationPrompt} onChange={e => setNewProjectModificationPrompt(e.target.value)} rows={2} placeholder="例如: 把天空变成红色, 给小猫戴上帽子" className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 text-themed-primary focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm resize-none"></textarea>
                            </div>
                            <div>
                                <div className="flex justify-between items-center">
                                    <label id="new-gen-count" className="block text-sm font-medium text-themed-secondary">4. 生成数量</label>
                                    <NumberInput value={numToGenerate} onChange={setNumToGenerate} labelledby="new-gen-count" />
                                </div>
                            </div>
                            <button onClick={() => handleGenerate()} disabled={isLoading || !combinedReferenceImage || !newProjectStylePrompt} className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium btn-primary disabled:bg-themed-disabled disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-themed-accent transition-colors">
                                {isLoading ? <><Spinner /> <span className="ml-2">{loadingText || '正在处理...'}</span></> : '开始生成'}
                            </button>
                        </div>
                    </div>
                    <div className="flex-grow">
                        <h2 className="text-xl font-semibold mb-4">历史记录</h2>
                        <div className="space-y-3">
                            {projects.map(proj => (
                                <div key={proj.id} onClick={() => { setActiveProjectId(proj.id); addLog(`选择项目: ${proj.id}`); }} className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${activeProjectId === proj.id ? 'bg-themed-accent-active ring-2 ring-themed-accent' : 'bg-themed-secondary hover:bg-themed-tertiary'}`}>
                                    <img src={proj.referenceImage.base64} alt="Ref" className="w-14 h-14 rounded-md object-cover mr-4" />
                                    <div className="flex-grow min-w-0"><p className="font-semibold truncate">{proj.stylePrompt}</p><p className="text-xs text-themed-secondary">{new Date(proj.createdAt).toLocaleString()}</p></div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }} className="ml-2 p-1 text-themed-secondary btn-danger-text rounded-full transition-colors"><TrashIcon /></button>
                                </div>
                            ))}
                            {projects.length === 0 && <p className="text-sm text-themed-tertiary text-center py-4">暂无历史项目</p>}
                        </div>
                    </div>
                </aside>
                
                <section className="flex-grow w-full md:w-2/3 xl:w-3/4 p-6 overflow-y-auto custom-scrollbar">
                    {activeProject ? (
                        <div className="space-y-6">
                            <div><h2 className="text-2xl font-bold text-themed-accent mb-2">当前项目: <span className="text-themed-primary">{activeProject.stylePrompt}</span></h2><p className="text-sm text-themed-secondary">创建于 {new Date(activeProject.createdAt).toLocaleString()}</p></div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 bg-themed-secondary p-4 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-3">项目设置</h3>
                                    <div className="space-y-4">
                                        <div><h4 className="font-medium text-themed-secondary mb-2">参考图</h4><img src={activeProject.referenceImage.base64} alt="Reference" className="w-full rounded-lg object-cover" /></div>
                                        <div>
                                            <label htmlFor={`style-prompt-${activeProject.id}`} className="font-medium text-themed-secondary">风格描述</label>
                                            <input
                                                id={`style-prompt-${activeProject.id}`}
                                                type="text"
                                                value={activeProject.stylePrompt}
                                                onChange={e => handleStylePromptChange(activeProject.id, e.target.value)}
                                                className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 text-themed-primary focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm"
                                            />
                                        </div>
                                        <div><label htmlFor={`mod-prompt-${activeProject.id}`} className="font-medium text-themed-secondary">修改内容</label><textarea id={`mod-prompt-${activeProject.id}`} value={activeProject.modificationPrompt} onChange={e => handleModificationPromptChange(activeProject.id, e.target.value)} rows={3} placeholder="例如: 把天空变成红色, 给小猫戴上帽子" className="mt-1 block w-full bg-themed-tertiary border border-themed-primary rounded-md shadow-sm py-2 px-3 text-themed-primary focus:outline-none focus:ring-themed-accent focus:border-themed-accent sm:text-sm resize-none"></textarea></div>
                                        <div>
                                            <div className="flex justify-between items-center">
                                                <label id="active-gen-count" className="font-medium text-themed-secondary">生成数量</label>
                                                <NumberInput value={numToGenerate} onChange={setNumToGenerate} labelledby="active-gen-count" />
                                            </div>
                                        </div>
                                        <button onClick={() => handleGenerate(activeProject)} disabled={isLoading} className="w-full flex justify-center items-center mt-4 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white btn-secondary disabled:bg-themed-disabled disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors">
                                            {isLoading ? <><Spinner /> <span className="ml-2">{loadingText || '正在处理...'}</span></> : '基于此项目再次生成'}
                                        </button>
                                    </div>
                                </div>
                                <div className="lg:col-span-2 bg-themed-secondary p-4 rounded-lg">
                                    <h3 className="text-lg font-semibold mb-3">生成结果 ({activeProject.generatedImages.length})</h3>
                                    {activeProject.generatedImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {activeProject.generatedImages.map(img => (
                                            <div key={img.id} className="relative group aspect-square">
                                                <img src={img.base64} alt="Generated" className="w-full h-full object-cover rounded-md cursor-pointer transition-transform duration-300 group-hover:scale-105" onClick={() => {addLog(`预览图片 ${img.id}`); setPreviewImageUrl(img.base64);}}/>
                                                <div className="absolute top-1 left-1 right-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                     <div className='flex items-center gap-1'>
                                                        <button title="设为参考图" onClick={(e) => { e.stopPropagation(); handleSetAsReference(activeProject.id, img); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-sky-600/80 transition-all pointer-events-auto">
                                                            <SetAsReferenceIcon className="w-4 h-4" />
                                                        </button>
                                                        <button title="发送到 Photoshop" onClick={(e) => { e.stopPropagation(); handleSendToPhotoshop(img); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-blue-800/80 transition-all pointer-events-auto">
                                                            <PhotoshopIcon className="w-4 h-4" />
                                                        </button>
                                                     </div>
                                                     <button title="删除图片" onClick={(e) => { e.stopPropagation(); handleDeleteGeneratedImage(activeProject.id, img.id); }} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-red-600/80 transition-all pointer-events-auto">
                                                         <TrashIcon className="w-4 h-4" />
                                                     </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    ) : ( <p className="text-center text-themed-tertiary mt-8">暂无生成图片</p> )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <svg className="w-24 h-24 text-themed-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <h2 className="mt-4 text-2xl font-semibold text-themed-secondary">欢迎使用 AI 图像风格转换器</h2>
                            <p className="mt-2 text-themed-tertiary">在左侧创建新项目，或选择一个历史项目开始。</p>
                        </div>
                    )}
                </section>
            </main>

            {error && <div className="fixed bottom-5 right-5 bg-themed-danger text-white py-2 px-4 rounded-lg shadow-lg animate-pulse z-50">{error}</div>}
            {previewImageUrl && <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => {addLog("关闭图片预览。"); setPreviewImageUrl(null);}} />}
            {isSettingsOpen && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => {addLog("关闭设置。"); setSettingsOpen(false);}} />}
            <LogPanel logs={logs} isVisible={isLogPanelVisible} onClose={() => {addLog("关闭日志面板。"); setLogPanelVisible(false);}} onClear={() => {addLog("清除日志。"); setLogs([]);}} />
        </div>
    );
}