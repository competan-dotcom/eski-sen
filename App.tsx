/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generateDecadeImage } from './services/geminiService';
import PolaroidCard from './components/PolaroidCard';
import { createAlbumPage } from './lib/albumUtils';
import { cn } from './lib/utils';


const DECADES = ['1950 ler', '1960 lar', '1970 ler', '1980 ler', '1990 lar', '2000 ler'];

// Pre-defined positions for a scattered look on desktop
const POSITIONS = [
    { top: '5%', left: '10%', rotate: -10 },
    { top: '15%', left: '70%', rotate: 8 },
    { top: '60%', left: '5%', rotate: 12 },
    { top: '10%', left: '40%', rotate: -3 },
    { top: '45%', left: '65%', rotate: -15 },
    { top: '65%', left: '35%', rotate: 5 },
];

const MOBILE_POSITIONS = [
    { top: '2rem', x: '-10%', rotate: -8 },
    { top: '16rem', x: '10%', rotate: 5 },
    { top: '30rem', x: '-5%', rotate: -3 },
    { top: '44rem', x: '12%', rotate: 10 },
    { top: '58rem', x: '-15%', rotate: -5 },
    { top: '72rem', x: '8%', rotate: 8 },
];


const GHOST_POLAROIDS_CONFIG = [
  { initial: { x: "-150%", y: "-100%", rotate: -30 }, transition: { delay: 0.2 } },
  { initial: { x: "150%", y: "-80%", rotate: 25 }, transition: { delay: 0.4 } },
  { initial: { x: "-120%", y: "120%", rotate: 45 }, transition: { delay: 0.6 } },
  { initial: { x: "180%", y: "90%", rotate: -20 }, transition: { delay: 0.8 } },
  { initial: { x: "0%", y: "-200%", rotate: 0 }, transition: { delay: 0.5 } },
  { initial: { x: "100%", y: "150%", rotate: 10 }, transition: { delay: 0.3 } },
];


type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}
type FeedbackState = 'like' | 'unlike' | null;
type GenerationStyle = 'strict' | 'creative' | 'turkish';

const ThemedLoader = () => (
    <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="text-red-800"
    >
        <style>{`
            .spinner_V8m1 {
                transform-origin: center;
                animation: spinner_zKoa 1.2s linear infinite;
            }
            .spinner_V8m1 circle {
                stroke-linecap: round;
                animation: spinner_YpZS 1.5s ease-in-out infinite;
            }
            @keyframes spinner_zKoa {
                100% { transform: rotate(360deg); }
            }
            @keyframes spinner_YpZS {
                0% { stroke-dasharray: 0 150; stroke-dashoffset: 0; }
                47.5% { stroke-dasharray: 42 150; stroke-dashoffset: -16; }
                95%, 100% { stroke-dasharray: 42 150; stroke-dashoffset: -59; }
            }
        `}</style>
        <g className="spinner_V8m1">
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2"></circle>
        </g>
    </svg>
);


const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-white/10 backdrop-blur-sm border-2 border-black/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [matches, query]);
    return matches;
};

function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<'idle' | 'image-uploaded' | 'generating' | 'results-shown'>('idle');
    const [generationStyle, setGenerationStyle] = useState<GenerationStyle>('strict');
    const [fatalError, setFatalError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Record<string, FeedbackState>>({});
    const dragAreaRef = useRef<HTMLDivElement>(null);
    const isMobile = useMediaQuery('(max-width: 768px)');


    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setAppState('image-uploaded');
                setGeneratedImages({}); // Clear previous results
                setFeedback({}); // Clear feedback as well
            };
            reader.readAsDataURL(file);
        }
    };

    const getPromptForDecade = (decade: string): string => {
        switch (generationStyle) {
            case 'strict':
                return `Reimagine the person in this photo in the style of the ${decade}. It is crucial to maintain the person's core facial features and identity as closely as possible. This includes clothing, hairstyle, photo quality, and the overall aesthetic of that decade. The output must be a photorealistic image showing the person clearly.`;
            case 'creative':
                return `Take creative inspiration from the person in this photo to create a new portrait in the style of the ${decade}. The new image should reflect the fashion, hairstyles, and overall atmosphere of that era, with artistic freedom to reinterpret the person's appearance. The output must be a photorealistic image.`;
            case 'turkish':
                return `Reimagine the person in this photo in the style of the ${decade} in Turkey, with a "Turkish style". Incorporate authentic Turkish fashion, hairstyles, and aesthetics from that era. Think about Turkish Yeşilçam movies, popular musicians like Barış Manço or Ajda Pekkan, and everyday life in Turkey during the ${decade}. Maintain the person's core facial features but place them convincingly into a Turkish context of the time. The output must be a photorealistic image showing the person clearly.`;
        }
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;

        setIsLoading(true);
        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        DECADES.forEach(decade => {
            initialImages[decade] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 2; // Process two decades at a time
        const decadesQueue = [...DECADES];

        const processDecade = async (decade: string) => {
            try {
                const prompt = getPromptForDecade(decade);
                const resultUrl = await generateDecadeImage(uploadedImage, prompt);
                setGeneratedImages(prev => ({
                    ...prev,
                    [decade]: { status: 'done', url: resultUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                 if (errorMessage.toLowerCase().includes('kota') || errorMessage.toLowerCase().includes('limit')) {
                    setFatalError(errorMessage);
                }
                setGeneratedImages(prev => ({
                    ...prev,
                    [decade]: { status: 'error', error: errorMessage },
                }));
                console.error(`Failed to generate image for ${decade}:`, err);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (decadesQueue.length > 0) {
                const decade = decadesQueue.shift();
                if (decade) {
                    await processDecade(decade);
                }
            }
        });

        await Promise.all(workers);

        setIsLoading(false);
        setAppState('results-shown');
    };

    const handleRegenerateDecade = async (decade: string) => {
        if (!uploadedImage) return;
        if (fatalError) return; // Do not allow regeneration if there's a fatal error

        if (generatedImages[decade]?.status === 'pending') {
            return;
        }
        
        console.log(`Regenerating image for ${decade}...`);

        setGeneratedImages(prev => ({
            ...prev,
            [decade]: { ...prev[decade], status: 'pending' },
        }));

        try {
            const prompt = getPromptForDecade(decade);
            const resultUrl = await generateDecadeImage(uploadedImage, prompt);
            setGeneratedImages(prev => ({
                ...prev,
                [decade]: { status: 'done', url: resultUrl },
            }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            if (errorMessage.toLowerCase().includes('kota') || errorMessage.toLowerCase().includes('limit')) {
                setFatalError(errorMessage);
            }
            setGeneratedImages(prev => ({
                ...prev,
                [decade]: { status: 'error', error: errorMessage },
            }));
            console.error(`Failed to regenerate image for ${decade}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
        setFatalError(null);
        setFeedback({});
    };

    const handleDownloadIndividualImage = (decade: string) => {
        const image = generatedImages[decade];
        // FIX: Cast image to GeneratedImage to resolve TypeScript error about 'unknown' type.
        const typedImage = image as GeneratedImage;
        if (typedImage && typedImage.status === 'done' && typedImage.url) {
            const link = document.createElement('a');
            link.href = typedImage.url;
            link.download = `eski-sen-${decade}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadAlbum = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                // FIX: Cast image to GeneratedImage to resolve TypeScript error about 'unknown' type.
                .filter(([, image]) => {
                    const typedImage = image as GeneratedImage;
                    return typedImage && typedImage.status === 'done' && typedImage.url;
                })
                .reduce((acc, [decade, image]) => {
                    acc[decade] = (image as GeneratedImage).url!;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length < DECADES.length) {
                alert("Albümü Indirmeden önce lütfen tüm fotoğrafların oluşturulmasını bekleyin.");
                return;
            }

            const albumDataUrl = await createAlbumPage(imageData);

            const link = document.createElement('a');
            link.href = albumDataUrl;
            link.download = 'eski-sen-album.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Failed to create or download album:", error);
            alert("Üzgünüz, albümünüz oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleFeedback = (decade: string, type: 'like' | 'unlike') => {
        setFeedback(prev => {
            const currentFeedback = prev[decade];
            // If clicking the same button again, toggle it off. Otherwise, set the new feedback.
            const newFeedback = currentFeedback === type ? null : type;
            return {
                ...prev,
                [decade]: newFeedback,
            };
        });
    };

    // Fix: Cast 'img' to GeneratedImage to access 'status' property, as Object.values infers it as 'unknown' in this context.
    const showInitialLoader = appState === 'generating' && !Object.values(generatedImages).some(img => (img as GeneratedImage).status !== 'pending');

    return (
        <>
            {fatalError && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-yellow-500 border-4 border-black shadow-2xl rounded-lg p-8 max-w-md w-full text-center flex flex-col items-center gap-4"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="font-permanent-marker text-2xl text-red-800">Üretim Durduruldu</h2>
                        <p className="text-lg text-neutral-800">{fatalError}</p>
                        <button onClick={handleReset} className={`${primaryButtonClasses} mt-4`}>
                            ana sayfa
                        </button>
                    </motion.div>
                </div>
            )}
            <main className="bg-yellow-500 text-black min-h-screen w-full flex flex-col items-center p-4 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
                
                <div className="z-10 text-center mb-6 flex-shrink-0">
                    <h1 className="text-6xl md:text-8xl font-caveat font-bold text-black">eski'sen</h1>
                    <p className="font-permanent-marker text-neutral-800 mt-2 text-xl tracking-wide lowercase">(seni zaman tünelinde bir yolculuga çıkarıyoruz)</p>
                </div>

                <div className="z-10 flex flex-col items-center justify-center w-full flex-1 min-h-0">
                    {appState === 'idle' && (
                        <div className="relative flex flex-col items-center justify-center w-full">
                            {GHOST_POLAROIDS_CONFIG.map((config, index) => (
                                <motion.div
                                    key={index}
                                    className="absolute w-80 h-[26rem] rounded-md p-4 bg-neutral-100/10 blur-sm"
                                    initial={config.initial}
                                    animate={{
                                        x: "0%", y: "0%", rotate: (Math.random() - 0.5) * 20,
                                        scale: 0,
                                        opacity: 0,
                                    }}
                                    transition={{
                                        ...config.transition,
                                        ease: "circOut",
                                        duration: 2,
                                    }}
                                />
                            ))}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 2, duration: 0.8, type: 'spring' }}
                                className="flex flex-col items-center"
                            >
                                <label htmlFor="file-upload" className="cursor-pointer group transform hover:scale-105 transition-transform duration-300">
                                    <PolaroidCard 
                                        caption="polaroid'e tıkla"
                                        status="done"
                                        isDraggable={false}
                                    />
                                </label>
                                <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                                <p className="mt-8 font-permanent-marker text-neutral-800 text-center max-w-xs text-2xl">
                                en güzel fotografını seç!
                                </p>
                            </motion.div>
                        </div>
                    )}

                    {appState === 'image-uploaded' && uploadedImage && (
                        <div className="flex flex-col items-center gap-6">
                            <PolaroidCard 
                                imageUrl={uploadedImage} 
                                caption="fotografın" 
                                status="done"
                                isDraggable={false}
                            />
                             <div className="flex flex-col items-center gap-2 my-2">
                                <div className="bg-black/20 p-1 rounded-full flex items-center text-sm font-permanent-marker">
                                    <button 
                                        onClick={() => setGenerationStyle('strict')}
                                        className={`py-2 px-4 rounded-full transition-colors duration-300 ${generationStyle === 'strict' ? 'bg-white text-black' : 'text-white/80'}`}
                                    >
                                        Birebir Benzerlik
                                    </button>
                                    <button 
                                        onClick={() => setGenerationStyle('creative')}
                                        className={`py-2 px-4 rounded-full transition-colors duration-300 ${generationStyle === 'creative' ? 'bg-white text-black' : 'text-white/80'}`}
                                    >
                                        Yaratıcı Yorum
                                    </button>
                                    <button 
                                        onClick={() => setGenerationStyle('turkish')}
                                        className={`py-2 px-4 rounded-full transition-colors duration-300 ${generationStyle === 'turkish' ? 'bg-white text-black' : 'text-white/80'}`}
                                    >
                                        Turkish Stayl ✨
                                    </button>
                                </div>
                                <p className="font-permanent-marker text-base text-neutral-800 mt-2 text-center h-8">
                                    {generationStyle === 'strict' && "Yüz hatların her fotografta korunur."}
                                    {generationStyle === 'creative' && "Yapay zeka her dönem için seni bastan yorumlar."}
                                    {generationStyle === 'turkish' && "Her dönemin ruhu Türkiye'den ilhamla yansıtılır."}
                                </p>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                                <button onClick={handleReset} className={secondaryButtonClasses}>
                                    Yeniden Dene
                                </button>
                                <button onClick={handleGenerateClick} className={primaryButtonClasses}>
                                    Yolculuga Çık
                                </button>
                            </div>
                        </div>
                    )}

                    {showInitialLoader && (
                        <div className="mt-10 flex flex-col items-center justify-center gap-4 z-20">
                            <ThemedLoader />
                            <p className="font-permanent-marker text-xl text-red-800 text-center">
                                Zaman makinesi ısınıyor...
                            </p>
                        </div>
                    )}

                    {(appState === 'generating' || appState === 'results-shown') && !showInitialLoader && (
                        <div className="flex flex-col flex-1 w-full h-full">
                            <div
                                ref={dragAreaRef}
                                className={cn(
                                    "relative w-full min-h-0 flex-1",
                                    !isMobile && "max-w-5xl mx-auto",
                                    isMobile && "overflow-y-auto overflow-x-hidden hide-scrollbar"
                                )}
                            >
                                {isMobile ? (
                                    <div className="relative h-[100rem] w-full">
                                        {DECADES.map((decade, index) => {
                                            const { top, x, rotate } = MOBILE_POSITIONS[index];
                                            return (
                                                <motion.div
                                                    key={decade}
                                                    className="absolute w-full flex justify-center"
                                                    style={{ top, left: '50%' }}
                                                    initial={{ opacity: 0, y: 40, x: '-50%', rotate: rotate + 10 }}
                                                    animate={{ 
                                                        opacity: 1, 
                                                        y: 0, 
                                                        x: `calc(-50% + ${x})`, 
                                                        rotate: rotate,
                                                        transition: { delay: index * 0.1, duration: 0.6, ease: 'easeOut' }
                                                    }}
                                                >
                                                    <PolaroidCard
                                                        caption={decade}
                                                        status={generatedImages[decade]?.status || 'pending'}
                                                        imageUrl={generatedImages[decade]?.url}
                                                        error={generatedImages[decade]?.error}
                                                        dragConstraintsRef={dragAreaRef}
                                                        onShake={handleRegenerateDecade}
                                                        onDownload={handleDownloadIndividualImage}
                                                        feedback={feedback[decade]}
                                                        onFeedback={handleFeedback}
                                                        isMobile={isMobile}
                                                    />
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    DECADES.map((decade, index) => {
                                        const { top, left, rotate } = POSITIONS[index];
                                        return (
                                            <motion.div
                                                key={decade}
                                                className="absolute cursor-grab active:cursor-grabbing"
                                                style={{ top, left }}
                                                initial={{ opacity: 0, scale: 0.5, y: 100, rotate: 0 }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                    y: 0,
                                                    rotate: rotate,
                                                    transition: {
                                                        delay: index * 0.15,
                                                        duration: 0.5,
                                                        ease: 'easeOut'
                                                    }
                                                }}
                                            >
                                                <PolaroidCard
                                                    caption={decade}
                                                    status={generatedImages[decade]?.status || 'pending'}
                                                    imageUrl={generatedImages[decade]?.url}
                                                    error={generatedImages[decade]?.error}
                                                    dragConstraintsRef={dragAreaRef}
                                                    onShake={handleRegenerateDecade}
                                                    onDownload={handleDownloadIndividualImage}
                                                    feedback={feedback[decade]}
                                                    onFeedback={handleFeedback}
                                                />
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                            
                            <div className="flex-shrink-0 flex items-center justify-center gap-4 py-6 z-20">
                                <button onClick={handleReset} className={secondaryButtonClasses}>
                                    Baştan Başla
                                </button>
                                <button
                                    onClick={handleDownloadAlbum}
                                    className={`${primaryButtonClasses} ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? 'Albümün Hazırlanıyor...' : 'Albümü indir'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                 <footer className="w-full text-center py-2 z-10 flex-shrink-0">
                    <p className="font-caveat text-1xl text-neutral-800">
                        {" "}
                        <a
                            href="https://competanai.carrd.co/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-caveat text-3xl text-red-800 hover:text-red-700 transition-colors duration-200"
                        >
                           © competanai
                        </a>
                    </p>
                </footer>
            </main>
        </>
    );
}

export default App;
