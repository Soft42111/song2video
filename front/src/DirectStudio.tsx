import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Loader2, PlayCircle, Image as ImageIcon, Video, Music, AlertCircle, Sparkles, Lock, Unlock, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { SogniClient } from '@sogni-ai/sogni-client';


// ─── Default Values ──────────────────────────────────
const DEFAULT_IMAGE_PROMPT = 'Clouds of color, blue skies, dawn glow, epic, visual motion illusion, creative rush, intricate details, breathtaking, amazing, award-winning';
const DEFAULT_STYLE_PROMPT = 'intricate details, breathtaking, amazing, award-winning';
const DEFAULT_NEGATIVE = 'malformation, bad anatomy, bad hands, missing fingers, cropped, low quality, bad quality, jpeg artifacts, watermark';

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];
const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese', 'Arabic', 'Hindi', 'Russian'];

// ─── Cost Estimation (Sogni Pricing) ─────────────────
// 1 Spark = 1 base job (SDXL at 20 steps, 512x512, 1 image)
// Cost scales linearly with: steps, resolution, quantity
function estimateCost(type: string, opts: { quantity: number; steps: number; duration?: number; width?: number; height?: number }) {
    const { quantity, steps, duration = 5, width = 512, height = 512 } = opts;
    const pixelFactor = (width * height) / (512 * 512);

    if (type === 'image') {
        // Base: 1 Spark for SDXL at 20 steps, 512x512
        const baseCost = (steps / 20) * pixelFactor;
        return +(baseCost * quantity).toFixed(2);
    }
    if (type === 'video' || type === 'i2v') {
        // Video costs ~10-50x more than images due to frame rendering
        const frames = duration * 16 + 1; // WAN: duration * 16 + 1
        const baseCost = (frames / 81) * (steps / 20) * pixelFactor * 10;
        return +(baseCost * quantity).toFixed(2);
    }
    if (type === 'song') {
        // Audio: scales with duration and steps
        const baseCost = (duration / 30) * (steps / 8) * 2;
        return +(baseCost * quantity).toFixed(2);
    }
    return 0;
}

// ─── Resolution Options ──────────────────────────────
const IMAGE_RESOLUTIONS = [
    { label: 'Square 512 (1:1)', w: 512, h: 512 },
    { label: 'Landscape 768×512', w: 768, h: 512 },
    { label: 'Portrait 512×768', w: 512, h: 768 },
    { label: 'HD 1024×1024', w: 1024, h: 1024 },
];
const VIDEO_RESOLUTIONS = [
    { label: 'Square 576p (1:1)', w: 576, h: 576 },
    { label: 'Landscape 832×480 (16:9)', w: 832, h: 480 },
    { label: 'Portrait 480×832 (9:16)', w: 480, h: 832 },
    { label: 'HD 1280×720 (16:9)', w: 1280, h: 720 },
];

// ─── Types ───────────────────────────────────────────
interface DirectStudioProps {
    authConfig: any;
    tokenType: 'spark' | 'sogni';
    selectedT2VModel: string;
    selectedI2VModel: string;
    selectedT2IModel: string;
}

type StudioTab = 'image' | 'video' | 'i2v' | 'song';

// ─── Subcomponents ───────────────────────────────────
function QuantitySelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex gap-2">
            {[1, 4, 8, 16].map(n => (
                <button key={n} onClick={() => onChange(n)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${value === n ? 'bg-[var(--neon-purple)] text-white shadow-[0_0_15px_rgba(157,78,221,0.3)]' : 'bg-[#111] text-gray-500 border border-white/5 hover:bg-[#1a1a1a] hover:text-white'}`}
                >{n}</button>
            ))}
        </div>
    );
}

function CostBadge({ cost, tokenType }: { cost: number; tokenType: string }) {
    return (
        <div className="flex items-center gap-3 bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Est. Cost</span>
            <span className="text-lg font-black text-white">~{cost.toFixed(2)}</span>
            <span className="text-xs text-[var(--neon-cyan)] font-bold uppercase">{tokenType === 'spark' ? 'SPRK' : 'SOGNI'}</span>
        </div>
    );
}

function EnhanceButton({ prompt, type, authConfig, onEnhanced }: {
    prompt: string; type: string; authConfig: any;
    onEnhanced: (text: string) => void;
}) {
    const [loading, setLoading] = useState(false);
    const handleEnhance = async () => {
        if (!prompt.trim()) return;
        if (!authConfig.apiKey && (!authConfig.username || !authConfig.password)) return;
        setLoading(true);
        try {
            const clientConfig: any = { appId: 'sogni-enhance', network: 'fast' };
            if (authConfig.apiKey) clientConfig.apiKey = authConfig.apiKey;
            const client = await SogniClient.createInstance(clientConfig);
            if (!authConfig.apiKey && authConfig.username && authConfig.password) {
                await client.account.login(authConfig.username, authConfig.password);
            }

            const systemInstructions: Record<string, string> = {
                image: 'You are an expert AI image prompt engineer. Expand the prompt into a highly detailed, vivid description optimized for text-to-image AI. Add lighting, composition, colors, textures, atmosphere. Single paragraph. Return ONLY the enhanced prompt.',
                video: 'You are an expert AI video prompt engineer. Expand the prompt into a cinematic description for text-to-video AI. Include camera movements, lighting, atmosphere, temporal flow. Single paragraph. Return ONLY the enhanced prompt.',
                song: 'You are an expert music prompt engineer. Expand the prompt into a detailed music description covering genre, mood, instruments, rhythm, vocal style, production quality. Single paragraph. Return ONLY the enhanced prompt.',
            };

            const completion: any = await (client.projects as any).chatCompletion({
                model: 'qwen3-30b-a3b-gptq-int4',
                messages: [
                    { role: 'system', content: systemInstructions[type] || systemInstructions.image },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1024,
                temperature: 0.8
            });

            let enhanced = completion?.choices?.[0]?.message?.content || '';
            enhanced = enhanced.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            if (enhanced) onEnhanced(enhanced);
        } catch (e) { console.error('Enhance failed:', e); }
        setLoading(false);
    };
    return (
        <button onClick={handleEnhance} disabled={loading || !prompt.trim() || (!authConfig.apiKey && (!authConfig.username || !authConfig.password))}
            className="sogni-btn-ultra !py-2 !px-4 !text-xs gap-1.5 shrink-0 disabled:opacity-40"
            title="Enhance with Sogni Qwen 3.5"
        >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} className="text-[var(--neon-cyan)]" />}
            Enhance
        </button>
    );
}

function PromptField({ value, onChange, placeholder, type, authConfig }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
    type: string; authConfig: any;
}) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="subheader">Prompt</label>
                <EnhanceButton prompt={value} type={type} authConfig={authConfig} onEnhanced={onChange} />
            </div>
            <textarea value={value} onChange={e => onChange(e.target.value)}
                placeholder={placeholder || 'Describe what you want to generate...'}
                className="input-recessed w-full block resize-none h-28" />
        </div>
    );
}

// ─── Main Component ──────────────────────────────────
export default function DirectStudio({ authConfig, tokenType, selectedT2VModel, selectedI2VModel, selectedT2IModel }: DirectStudioProps) {
    const [activeTab, setActiveTab] = useState<StudioTab>('image');
    const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [results, setResults] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ── Image State ──
    const [imgPrompt, setImgPrompt] = useState(DEFAULT_IMAGE_PROMPT);
    const [imgQuantity, setImgQuantity] = useState(1);
    const [imgStyle, setImgStyle] = useState(DEFAULT_STYLE_PROMPT);
    const [imgModel, setImgModel] = useState('');
    const [imgRes, setImgRes] = useState(0);
    const [imgNegative, setImgNegative] = useState(DEFAULT_NEGATIVE);
    const [imgSeedLocked, setImgSeedLocked] = useState(false);
    const [imgSeed, setImgSeed] = useState(42);
    const [imgSteps, setImgSteps] = useState(4);

    // ── Video (T2V) State ──
    const [vidPrompt, setVidPrompt] = useState('');
    const [vidQuantity, setVidQuantity] = useState(1);
    const [vidRes, setVidRes] = useState(0);
    const [vidFps, setVidFps] = useState(16);
    const [vidDuration, setVidDuration] = useState(5);
    const [vidSteps, setVidSteps] = useState(20);
    const [vidStyle, setVidStyle] = useState('');
    const [vidNegative, setVidNegative] = useState(DEFAULT_NEGATIVE);
    const [vidSpeed, setVidSpeed] = useState<'speed' | 'quality'>('speed');

    // ── I2V State ──
    const [i2vPrompt, setI2vPrompt] = useState('');
    const [i2vModel, setI2vModel] = useState('');
    const [i2vQuantity, setI2vQuantity] = useState(1);
    const [i2vRes, setI2vRes] = useState(0);
    const [i2vFps, setI2vFps] = useState(16);
    const [i2vDuration, setI2vDuration] = useState(5);
    const [i2vSteps, setI2vSteps] = useState(20);
    const [i2vStyle] = useState('');
    const [i2vNegative, setI2vNegative] = useState(DEFAULT_NEGATIVE);
    const [i2vSpeed, setI2vSpeed] = useState<'speed' | 'quality'>('speed');
    const [i2vRefImage, setI2vRefImage] = useState<File | null>(null);
    const i2vFileRef = useRef<HTMLInputElement>(null);

    // ── Song State ──
    const [songPrompt, setSongPrompt] = useState('');
    const [songQuantity, setSongQuantity] = useState(1);
    const [songDuration, setSongDuration] = useState(30);
    const [songLyrics, setSongLyrics] = useState(true);
    const [songLyricsText, setSongLyricsText] = useState('');
    const [songLanguage, setSongLanguage] = useState('English');
    const [songTempo, setSongTempo] = useState(120);
    const [songTimeSig, setSongTimeSig] = useState('4/4');
    const [songKey, setSongKey] = useState('C');
    const [songSpeed, setSongSpeed] = useState<'speed' | 'quality'>('speed');
    const [songCreativity, setSongCreativity] = useState(0.7);
    const [songSteps, setSongSteps] = useState(50);
    const [songGuidance, setSongGuidance] = useState(7);
    const [songShift, setSongShift] = useState(0);

    // ── Cost Estimation ──
    const cost = useMemo(() => {
        const imgR = IMAGE_RESOLUTIONS[imgRes] || IMAGE_RESOLUTIONS[0];
        const vidR = VIDEO_RESOLUTIONS[vidRes] || VIDEO_RESOLUTIONS[0];
        const i2vR = VIDEO_RESOLUTIONS[i2vRes] || VIDEO_RESOLUTIONS[0];
        switch (activeTab) {
            case 'image': return estimateCost('image', { quantity: imgQuantity, steps: imgSteps, width: imgR.w, height: imgR.h });
            case 'video': return estimateCost('video', { quantity: vidQuantity, steps: vidSteps, duration: vidDuration, width: vidR.w, height: vidR.h });
            case 'i2v': return estimateCost('i2v', { quantity: i2vQuantity, steps: i2vSteps, duration: i2vDuration, width: i2vR.w, height: i2vR.h });
            case 'song': return estimateCost('song', { quantity: songQuantity, steps: songSteps, duration: songDuration });
            default: return 0;
        }
    }, [activeTab, imgQuantity, imgSteps, imgRes, vidQuantity, vidSteps, vidDuration, vidRes, i2vQuantity, i2vSteps, i2vDuration, i2vRes, songQuantity, songSteps, songDuration]);

    // ── Generation Handler ──
    const handleGenerate = useCallback(async () => {
        if (!authConfig.apiKey && (!authConfig.username || !authConfig.password)) {
            setErrorMsg('Please configure your Sogni Auth in Settings first.');
            setStatus('error');
            return;
        }
        setStatus('generating');
        setErrorMsg('');
        setResults([]);

        try {
            const clientConfig: any = { appId: 'sogni-studio-v2', network: 'fast' };
            if (authConfig.apiKey) clientConfig.apiKey = authConfig.apiKey;
            const client = await SogniClient.createInstance(clientConfig);
            if (!authConfig.apiKey && authConfig.username && authConfig.password) {
                await client.account.login(authConfig.username, authConfig.password);
            }
            await client.projects.waitForModels();

            if (activeTab === 'image') {
                const res = IMAGE_RESOLUTIONS[imgRes] || IMAGE_RESOLUTIONS[0];
                const allResults: { url: string; type: 'image' | 'video' | 'audio' }[] = [];
                for (let i = 0; i < imgQuantity; i++) {
                    const project = await client.projects.create({
                        type: 'image',
                        modelId: imgModel || selectedT2IModel || 'flux1-schnell-fp8',
                        positivePrompt: `${imgPrompt}${imgStyle ? ', ' + imgStyle : ''}`,
                        negativePrompt: imgNegative,
                        numberOfMedia: 1,
                        width: res.w, height: res.h,
                        steps: imgSteps,
                        guidance: 1,
                        seed: imgSeedLocked ? imgSeed : undefined,
                        outputFormat: 'jpg'
                    } as any);
                    const urls = await project.waitForCompletion();
                    urls.forEach((url: string) => allResults.push({ url, type: 'image' }));
                }
                setResults(allResults);
                setStatus('success');

            } else if (activeTab === 'video') {
                const allResults: { url: string; type: 'image' | 'video' | 'audio' }[] = [];
                for (let i = 0; i < vidQuantity; i++) {
                    const project = await client.projects.create({
                        type: 'video',
                        network: 'fast',
                        modelId: selectedT2VModel || 'wan_v2.2-14b-fp8_t2v',
                        positivePrompt: vidPrompt + (vidStyle ? ', ' + vidStyle : ''),
                        negativePrompt: vidNegative,
                        numberOfMedia: 1,
                        duration: vidDuration,
                        fps: vidFps
                    } as any);
                    const urls = await project.waitForCompletion();
                    urls.forEach((url: string) => allResults.push({ url, type: 'video' }));
                }
                setResults(allResults);
                setStatus('success');

            } else if (activeTab === 'i2v') {
                if (!i2vRefImage) {
                    setErrorMsg('Please upload a reference image.');
                    setStatus('error');
                    return;
                }
                const imgBuf = await i2vRefImage.arrayBuffer();
                const allResults: { url: string; type: 'image' | 'video' | 'audio' }[] = [];
                for (let i = 0; i < i2vQuantity; i++) {
                    const project = await client.projects.create({
                        type: 'video',
                        network: 'fast',
                        modelId: i2vModel || selectedI2VModel || 'wan_v2.2-14b-fp8_i2v',
                        positivePrompt: i2vPrompt + (i2vStyle ? ', ' + i2vStyle : ''),
                        negativePrompt: i2vNegative,
                        referenceImage: new Blob([imgBuf]),
                        numberOfMedia: 1,
                        duration: i2vDuration,
                        fps: i2vFps
                    } as any);
                    const urls = await project.waitForCompletion();
                    urls.forEach((url: string) => allResults.push({ url, type: 'video' }));
                }
                setResults(allResults);
                setStatus('success');

            } else if (activeTab === 'song') {
                const allResults: { url: string; type: 'image' | 'video' | 'audio' }[] = [];
                for (let i = 0; i < songQuantity; i++) {
                    const project = await client.projects.create({
                        type: 'audio',
                        modelId: songSpeed === 'quality' ? 'ace_step_1.5_sft' : 'ace_step_1.5_turbo',
                        positivePrompt: songPrompt,
                        numberOfMedia: 1,
                        duration: songDuration,
                        bpm: songTempo,
                        keyscale: `${songKey} major`,
                        timesignature: songTimeSig.split('/')[0],
                        steps: songSteps,
                        creativity: songCreativity,
                        lyrics: songLyrics ? songLyricsText : undefined,
                        language: songLyrics ? songLanguage.toLowerCase().substring(0, 2) : undefined,
                        outputFormat: 'mp3'
                    } as any);
                    const urls = await project.waitForCompletion();
                    urls.forEach((url: string) => allResults.push({ url, type: 'audio' }));
                }
                setResults(allResults);
                setStatus('success');
            }
        } catch (err: any) {
            console.error('[DirectStudio] Error:', err);
            setErrorMsg(err.message || 'Generation failed.');
            setStatus('error');
        }
    }, [activeTab, authConfig, tokenType, imgPrompt, imgQuantity, imgStyle, imgModel, imgRes, imgNegative, imgSeedLocked, imgSeed, imgSteps, selectedT2IModel,
        vidPrompt, vidQuantity, vidRes, vidFps, vidDuration, vidSteps, vidStyle, vidNegative, selectedT2VModel,
        i2vPrompt, i2vModel, i2vQuantity, i2vRes, i2vFps, i2vDuration, i2vSteps, i2vStyle, i2vNegative, i2vRefImage, selectedI2VModel,
        songPrompt, songQuantity, songDuration, songLyrics, songLyricsText]);

    // ── Tab Config ──
    const tabs: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
        { id: 'image', label: 'Image (T2I)', icon: <ImageIcon size={16} /> },
        { id: 'video', label: 'Text→Video', icon: <Video size={16} /> },
        { id: 'i2v', label: 'Image→Video', icon: <PlayCircle size={16} /> },
        { id: 'song', label: 'Song Gen', icon: <Music size={16} /> },
    ];

    const SpeedQualityToggle = ({ value, onChange }: { value: 'speed' | 'quality'; onChange: (v: 'speed' | 'quality') => void }) => (
        <div className="flex gap-2">
            <button onClick={() => onChange('speed')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${value === 'speed' ? 'bg-[var(--neon-cyan)] text-black' : 'bg-[#111] text-gray-500 border border-white/5 hover:text-white'}`}>⚡ Speed</button>
            <button onClick={() => onChange('quality')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${value === 'quality' ? 'bg-[var(--neon-purple)] text-white' : 'bg-[#111] text-gray-500 border border-white/5 hover:text-white'}`}>✨ Quality</button>
        </div>
    );

    return (
        <div className="w-full max-w-5xl ultra-card p-8 md:p-12 mx-auto flex flex-col gap-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-['Geist'] font-bold text-white tracking-tight mb-2">Sogni Studio</h2>
                <p className="text-gray-400">Full-spectrum AI generation — Images, Videos, and Music.</p>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 justify-center flex-wrap border-b border-white/10 pb-4">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStatus('idle'); setResults([]); }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? (tab.id === 'song' ? 'bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-cyan)] text-white' : 'bg-[var(--neon-purple)] text-white shadow-[0_0_20px_rgba(157,78,221,0.3)]') : 'bg-[#111] text-gray-500 border border-white/5 hover:text-white hover:bg-[#1a1a1a]'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════ IMAGE TAB ═══════════ */}
            {activeTab === 'image' && (
                <div className="flex flex-col gap-6">
                    <PromptField value={imgPrompt} onChange={setImgPrompt} placeholder={DEFAULT_IMAGE_PROMPT} type="image" authConfig={authConfig} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="subheader block">Number of Images</label>
                            <QuantitySelector value={imgQuantity} onChange={setImgQuantity} />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Resolution</label>
                            <select value={imgRes} onChange={e => setImgRes(+e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {IMAGE_RESOLUTIONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Style</label>
                            <input type="text" value={imgStyle} onChange={e => setImgStyle(e.target.value)} placeholder="Default style prompt..." className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Model</label>
                            <select value={imgModel} onChange={e => setImgModel(e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                <option value="">Auto (flux-1-schnell)</option>
                                <option value="flux-1-schnell">Flux 1 Schnell</option>
                                <option value="flux-1-dev">Flux 1 Dev</option>
                                <option value="sdxl-1.0">SDXL 1.0</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Steps</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min={1} max={50} value={imgSteps} onChange={e => setImgSteps(+e.target.value)} className="flex-1 accent-[var(--neon-purple)]" />
                                <span className="text-white font-bold text-sm w-8 text-right">{imgSteps}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Seed</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setImgSeedLocked(!imgSeedLocked)}
                                    className={`p-2.5 rounded-xl border transition-all ${imgSeedLocked ? 'bg-[var(--neon-purple)]/20 border-[var(--neon-purple)] text-[var(--neon-purple)]' : 'bg-[#111] border-white/5 text-gray-500'}`}
                                >{imgSeedLocked ? <Lock size={16} /> : <Unlock size={16} />}</button>
                                <input type="number" value={imgSeedLocked ? imgSeed : ''} onChange={e => setImgSeed(+e.target.value)} disabled={!imgSeedLocked} placeholder="Random" className="input-recessed flex-1 disabled:opacity-40" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="subheader block">Avoid (Negative Prompt)</label>
                        <textarea value={imgNegative} onChange={e => setImgNegative(e.target.value)} className="input-recessed w-full resize-none h-20" />
                    </div>
                </div>
            )}

            {/* ═══════════ VIDEO (T2V) TAB ═══════════ */}
            {activeTab === 'video' && (
                <div className="flex flex-col gap-6">
                    <PromptField value={vidPrompt} onChange={setVidPrompt} placeholder="A futuristic city covered in neon lights..." type="video" authConfig={authConfig} />

                    <div className="space-y-2">
                        <label className="subheader block">Imagine</label>
                        <SpeedQualityToggle value={vidSpeed} onChange={setVidSpeed} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="subheader block">Number of Videos</label>
                            <QuantitySelector value={vidQuantity} onChange={setVidQuantity} />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Video Size</label>
                            <select value={vidRes} onChange={e => setVidRes(+e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {VIDEO_RESOLUTIONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Frames Per Second</label>
                            <input type="number" min={8} max={30} value={vidFps} onChange={e => setVidFps(+e.target.value)} className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Duration (seconds)</label>
                            <input type="number" min={1} max={10} value={vidDuration} onChange={e => setVidDuration(+e.target.value)} className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Steps</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min={1} max={50} value={vidSteps} onChange={e => setVidSteps(+e.target.value)} className="flex-1 accent-[var(--neon-purple)]" />
                                <span className="text-white font-bold text-sm w-8 text-right">{vidSteps}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Style</label>
                            <input type="text" value={vidStyle} onChange={e => setVidStyle(e.target.value)} placeholder="Cinematic, anime, realistic..." className="input-recessed" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="subheader block">Avoid (Negative Prompt)</label>
                        <textarea value={vidNegative} onChange={e => setVidNegative(e.target.value)} className="input-recessed w-full resize-none h-20" />
                    </div>
                </div>
            )}

            {/* ═══════════ I2V TAB ═══════════ */}
            {activeTab === 'i2v' && (
                <div className="flex flex-col gap-6">
                    {/* Reference Image Upload */}
                    <div className="space-y-2">
                        <label className="subheader block">Reference Image</label>
                        <div
                            onClick={() => i2vFileRef.current?.click()}
                            className={`dropzone-ultra !min-h-[120px] !rounded-xl cursor-pointer ${i2vRefImage ? '!border-[var(--neon-cyan)]' : ''}`}
                        >
                            <input type="file" ref={i2vFileRef} className="hidden" accept="image/*" onChange={e => setI2vRefImage(e.target.files?.[0] || null)} />
                            {i2vRefImage ? (
                                <div className="flex items-center gap-3 z-10 relative">
                                    <ImageIcon size={24} className="text-[var(--neon-cyan)]" />
                                    <span className="text-white font-bold text-sm">{i2vRefImage.name}</span>
                                    <button onClick={e => { e.stopPropagation(); setI2vRefImage(null); }} className="text-gray-500 hover:text-red-400 text-xs underline ml-2">Remove</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 z-10 relative text-gray-500">
                                    <Upload size={24} />
                                    <span className="text-sm font-bold">Upload reference image (PNG, JPG)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <PromptField value={i2vPrompt} onChange={setI2vPrompt} placeholder="Describe the motion and scene..." type="video" authConfig={authConfig} />

                    <div className="space-y-2">
                        <label className="subheader block">Imagine</label>
                        <SpeedQualityToggle value={i2vSpeed} onChange={setI2vSpeed} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="subheader block">Number of Videos</label>
                            <QuantitySelector value={i2vQuantity} onChange={setI2vQuantity} />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Model</label>
                            <select value={i2vModel} onChange={e => setI2vModel(e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                <option value="">Auto (wan_v2.2-14b-fp8_i2v)</option>
                                <option value="wan_v2.2-14b-fp8_i2v">Wan 2.2 I2V</option>
                                <option value="wan_v2.2-14b-fp8_i2v_lightx2v">Wan 2.2 I2V LightX2V</option>
                                <option value="ltx-2.3">LTX 2.3</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Video Size</label>
                            <select value={i2vRes} onChange={e => setI2vRes(+e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {VIDEO_RESOLUTIONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Frames Per Second</label>
                            <input type="number" min={8} max={30} value={i2vFps} onChange={e => setI2vFps(+e.target.value)} className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Duration (seconds)</label>
                            <input type="number" min={1} max={10} value={i2vDuration} onChange={e => setI2vDuration(+e.target.value)} className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Steps</label>
                            <div className="flex items-center gap-3">
                                <input type="range" min={1} max={50} value={i2vSteps} onChange={e => setI2vSteps(+e.target.value)} className="flex-1 accent-[var(--neon-purple)]" />
                                <span className="text-white font-bold text-sm w-8 text-right">{i2vSteps}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="subheader block">Avoid (Negative Prompt)</label>
                        <textarea value={i2vNegative} onChange={e => setI2vNegative(e.target.value)} className="input-recessed w-full resize-none h-20" />
                    </div>
                </div>
            )}

            {/* ═══════════ SONG GEN TAB ═══════════ */}
            {activeTab === 'song' && (
                <div className="flex flex-col gap-6">
                    <PromptField value={songPrompt} onChange={setSongPrompt} placeholder="Describe music style, genre, mood, instruments..." type="song" authConfig={authConfig} />

                    <div className="space-y-2">
                        <label className="subheader block">Compose</label>
                        <SpeedQualityToggle value={songSpeed} onChange={setSongSpeed} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="subheader block">Quantity</label>
                            <QuantitySelector value={songQuantity} onChange={setSongQuantity} />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Duration (seconds)</label>
                            <input type="number" min={5} max={300} value={songDuration} onChange={e => setSongDuration(+e.target.value)} className="input-recessed" />
                        </div>
                    </div>

                    {/* Lyrics Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="subheader">Lyrics</label>
                            <div className="flex gap-2">
                                <button onClick={() => setSongLyrics(true)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${songLyrics ? 'bg-[var(--neon-purple)] text-white' : 'bg-[#111] text-gray-500 border border-white/5'}`}>ON</button>
                                <button onClick={() => setSongLyrics(false)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!songLyrics ? 'bg-[var(--neon-cyan)] text-black' : 'bg-[#111] text-gray-500 border border-white/5'}`}>Instrumental</button>
                            </div>
                        </div>
                        {songLyrics && (
                            <textarea value={songLyricsText} onChange={e => setSongLyricsText(e.target.value)} placeholder="Enter lyrics here..." className="input-recessed w-full resize-none h-28" />
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="subheader block">Language</label>
                            <select value={songLanguage} onChange={e => setSongLanguage(e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Tempo (BPM)</label>
                            <input type="number" min={40} max={240} value={songTempo} onChange={e => setSongTempo(+e.target.value)} className="input-recessed" />
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Time Signature</label>
                            <select value={songTimeSig} onChange={e => setSongTimeSig(e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {TIME_SIGNATURES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="subheader block">Key</label>
                            <select value={songKey} onChange={e => setSongKey(e.target.value)} className="input-recessed w-full" style={{ appearance: 'auto' }}>
                                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Advanced Settings */}
                    <div>
                        <button onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[var(--neon-purple)] transition-colors py-2"
                        >
                            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Advanced Settings
                        </button>
                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5 mt-2">
                                <div className="space-y-2">
                                    <label className="subheader block">Creativity</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min={0} max={1} step={0.05} value={songCreativity} onChange={e => setSongCreativity(+e.target.value)} className="flex-1 accent-[var(--neon-cyan)]" />
                                        <span className="text-white font-bold text-sm w-10 text-right">{songCreativity.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="subheader block">Steps</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min={10} max={150} value={songSteps} onChange={e => setSongSteps(+e.target.value)} className="flex-1 accent-[var(--neon-purple)]" />
                                        <span className="text-white font-bold text-sm w-8 text-right">{songSteps}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="subheader block">Guidance</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min={1} max={20} step={0.5} value={songGuidance} onChange={e => setSongGuidance(+e.target.value)} className="flex-1 accent-[var(--neon-cyan)]" />
                                        <span className="text-white font-bold text-sm w-8 text-right">{songGuidance}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="subheader block">Shift</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min={-1} max={1} step={0.1} value={songShift} onChange={e => setSongShift(+e.target.value)} className="flex-1 accent-[var(--neon-purple)]" />
                                        <span className="text-white font-bold text-sm w-10 text-right">{songShift.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════ COST + GENERATE ═══════════ */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
                <CostBadge cost={cost} tokenType={tokenType} />

                <button onClick={handleGenerate} disabled={status === 'generating'}
                    className={`sogni-btn-ultra primary px-10 py-4 text-base font-bold gap-2 ${status === 'generating' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
                >
                    {status === 'generating' ? <><Loader2 className="animate-spin" size={20} /> Generating...</> : <><Sparkles size={20} /> Generate</>}
                </button>
            </div>

            {/* ═══════════ ERROR ═══════════ */}
            {status === 'error' && (
                <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 flex items-center gap-3">
                    <AlertCircle size={20} /> {errorMsg}
                </div>
            )}

            {/* ═══════════ RESULTS ═══════════ */}
            {status === 'success' && results.length > 0 && (
                <div className="space-y-4">
                    <h3 className="subheader">Results ({results.length})</h3>
                    <div className={`grid gap-4 ${results.length === 1 ? '' : 'grid-cols-2 lg:grid-cols-4'}`}>
                        {results.map((r, i) => (
                            <div key={i} className="relative rounded-xl border border-white/10 overflow-hidden bg-black flex items-center justify-center">
                                {r.type === 'image' ? (
                                    <img src={r.url} alt={`Result ${i + 1}`} className="max-h-[60vh] object-contain rounded-lg w-full" />
                                ) : r.type === 'video' ? (
                                    <video src={r.url} autoPlay controls loop className="max-h-[60vh] rounded-lg w-full" />
                                ) : (
                                    <audio src={r.url} controls className="w-full p-4" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Model Info */}
            <div className="text-center text-xs text-gray-600 font-mono pt-2 border-t border-white/5">
                {activeTab === 'image' && `Model: ${imgModel || selectedT2IModel || 'flux-1-schnell'}`}
                {activeTab === 'video' && `Model: ${selectedT2VModel || 'wan_v2.2-14b-fp8_t2v'}`}
                {activeTab === 'i2v' && `Model: ${selectedI2VModel || 'wan_v2.2-14b-fp8_i2v'} • LTX 2.3 available`}
                {activeTab === 'song' && `Model: ace_step_1.5_turbo`}
            </div>
        </div>
    );
}
