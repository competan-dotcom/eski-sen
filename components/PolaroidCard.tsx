/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { DraggableCardContainer, DraggableCardBody } from './ui/draggable-card';
import { cn } from '../lib/utils';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';

type ImageStatus = 'pending' | 'done' | 'error';

interface PolaroidCardProps {
    imageUrl?: string;
    caption: string;
    status: ImageStatus;
    error?: string;
    dragConstraintsRef?: React.RefObject<HTMLElement>;
    onShake?: (caption: string) => void;
    onDownload?: (caption: string) => void;
    feedback?: 'like' | 'unlike' | null;
    onFeedback?: (caption: string, feedback: 'like' | 'unlike') => void;
    isMobile?: boolean;
    isDraggable?: boolean;
    className?: string;
}

const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-full text-neutral-500">
        <svg className="animate-spin h-8 w-8 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="font-permanent-marker text-lg mt-4 animate-pulse">Oluşturuluyor...</p>
    </div>
);

const ErrorDisplay = ({ isMobile, error }: { isMobile?: boolean, error?: string }) => {
    // Check for specific non-retryable keywords related to API quotas.
    const isQuotaError = error ? (error.toLowerCase().includes('kota') || error.toLowerCase().includes('quota')) : false;

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-permanent-marker text-lg mt-2 text-red-400">Oluşturma Başarısız</p>
            
            {/* Display the detailed error message from the API to inform the user */}
            {error && (
                <p className="text-xs text-neutral-600 mt-1 max-h-24 overflow-y-auto px-2">
                    {error}
                </p>
            )}

            {/* Only show the "retry" hint if the error is not a non-retryable quota issue */}
            {!isQuotaError && (
                 <p className="text-xs text-neutral-500 mt-2">
                    {isMobile ? 'Yenileme simgesine dokun' : 'Kartı salla'} ve tekrar dene.
                </p>
            )}
        </div>
    );
};

const Placeholder = () => (
    <div className="flex flex-col items-center justify-center h-full text-neutral-500 group-hover:text-neutral-300 transition-colors duration-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="font-permanent-marker text-xl">foto yukle</span>
    </div>
);

const RegeneratingOverlay = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white z-20">
        <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full bg-yellow-400 opacity-75 animate-ping"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="relative h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.899 2.186l-1.42.71a5.002 5.002 0 00-8.479-1.554H10a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.899-2.186l1.42-.71a5.002 5.002 0 008.479 1.554H10a1 1 0 110 2h6a1 1 0 011 1v6a1 1 0 01-1 1z" clipRule="evenodd" />
            </svg>
        </div>
        <p className="font-permanent-marker text-lg mt-4">Yenileniyor...</p>
    </div>
);

const PolaroidCard: React.FC<PolaroidCardProps> = ({ imageUrl, caption, status, error, dragConstraintsRef, onShake, onDownload, feedback, onFeedback, isMobile, isDraggable, className }) => {
    const [isDeveloped, setIsDeveloped] = useState(false);
    const lastShakeTime = useRef(0);
    const lastVelocity = useRef({ x: 0, y: 0 });
    const isRegenerating = status === 'pending' && (!!imageUrl || !!error);

    // Simplified and more reliable effect for the "developing" animation.
    // It no longer depends on the `onLoad` event, which was unreliable on mobile.
    // Instead, it triggers whenever a new image is ready to be displayed.
    useEffect(() => {
        if (imageUrl && status === 'done') {
            // Immediately set to not-developed to show the chemical overlay for the animation.
            setIsDeveloped(false);

            // Use a short timeout to ensure React renders the initial state
            // before we trigger the animation, making the effect visible.
            const timer = setTimeout(() => {
                setIsDeveloped(true);
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [imageUrl, status]);

    const handleDragStart = () => {
        // Reset velocity on new drag to prevent false triggers from old data
        lastVelocity.current = { x: 0, y: 0 };
    };

    const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (!onShake || isMobile) return;

        const velocityThreshold = 1500; // Require a high velocity to be considered a "shake".
        const shakeCooldown = 2000; // 2 seconds cooldown to prevent spamming.

        const { x, y } = info.velocity;
        const { x: prevX, y: prevY } = lastVelocity.current;
        const now = Date.now();

        // A true "shake" is a rapid movement AND a sharp change in direction.
        // We detect this by checking if the velocity is high and if its direction
        // has reversed from the last frame (i.e., the dot product is negative).
        const magnitude = Math.sqrt(x * x + y * y);
        const dotProduct = (x * prevX) + (y * prevY);

        if (magnitude > velocityThreshold && dotProduct < 0 && (now - lastShakeTime.current > shakeCooldown)) {
            lastShakeTime.current = now;
            onShake(caption);
        }

        lastVelocity.current = { x, y };
    };

    const cardInnerContent = (
        <>
            <div className="w-full bg-neutral-900 shadow-inner flex-grow relative overflow-hidden group">
                {isRegenerating ? (
                    <>
                        {/* Show previous image or error state underneath */}
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt={caption}
                                className="w-full h-full object-cover"
                            />
                        )}
                        {error && !imageUrl && (
                            <ErrorDisplay isMobile={isMobile} error={error} />
                        )}
                        <RegeneratingOverlay />
                    </>
                ) : (
                    <>
                        {status === 'pending' && <LoadingSpinner />}
                        {status === 'error' && <ErrorDisplay isMobile={isMobile} error={error} />}
                        {status === 'done' && imageUrl && (
                             <>
                                <div className={cn(
                                    "absolute top-2 right-2 z-20 flex items-center gap-2 transition-opacity duration-300",
                                    !isMobile && "opacity-0 group-hover:opacity-100",
                                )}>
                                    {onFeedback && (
                                        <>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onFeedback(caption, 'like'); }}
                                                className={cn(
                                                    "p-2 bg-black/50 rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white transition-colors",
                                                    feedback === 'like' && 'bg-green-500/80 hover:bg-green-600/80'
                                                )}
                                                aria-label={`${caption} için beğen`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333V17a1 1 0 001 1h6.364a1 1 0 00.942-.671l1.7-4.25a1 1 0 00-.942-1.329H13V4.5a1.5 1.5 0 00-3 0v5.833H6z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onFeedback(caption, 'unlike'); }}
                                                className={cn(
                                                    "p-2 bg-black/50 rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white transition-colors",
                                                    feedback === 'unlike' && 'bg-red-500/80 hover:bg-red-600/80'
                                                )}
                                                aria-label={`${caption} için beğenme`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667V3a1 1 0 00-1-1H6.636a1 1 0 00-.942.671l-1.7 4.25a1 1 0 00.942 1.329H7V15.5a1.5 1.5 0 003 0V9.667h4z" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                    {onDownload && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent drag from starting on click
                                                onDownload(caption);
                                            }}
                                            className="p-2 bg-black/50 rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
                                            aria-label={`${caption} için fotoğrafı indir`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                    )}
                                    {isMobile && onShake && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onShake(caption);
                                            }}
                                            className="p-2 bg-black/50 rounded-full text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
                                            aria-label={`${caption} için fotoğrafı yeniden oluştur`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.899 2.186l-1.42.71a5.002 5.002 0 00-8.479-1.554H10a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.899-2.186l1.42-.71a5.002 5.002 0 008.479 1.554H10a1 1 0 110 2h6a1 1 0 011 1v6a1 1 0 01-1 1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                
                                {/* The developing chemical overlay - fades out */}
                                <div
                                    className={`absolute inset-0 z-10 bg-[#3a322c] transition-opacity duration-[3500ms] ease-out ${
                                        isDeveloped ? 'opacity-0' : 'opacity-100'
                                    }`}
                                    aria-hidden="true"
                                />
                                
                                {/* The Image - fades in and color corrects */}
                                <img
                                    key={imageUrl}
                                    src={imageUrl}
                                    alt={caption}
                                    className={`w-full h-full object-cover transition-all duration-[4000ms] ease-in-out ${
                                        isDeveloped 
                                        ? 'opacity-100 filter-none' 
                                        : 'opacity-80 filter sepia(1) contrast(0.8) brightness(0.8)'
                                    }`}
                                />
                            </>
                        )}
                        {status === 'done' && !imageUrl && <Placeholder />}
                    </>
                )}
            </div>
            <div className="absolute bottom-4 left-4 right-4 text-center px-2">
                <p className={cn(
                    "font-permanent-marker text-lg truncate",
                    status === 'done' && imageUrl ? 'text-black' : 'text-neutral-800'
                )}>
                    {caption}
                </p>
            </div>
        </>
    );

    return (
        <DraggableCardContainer>
            <DraggableCardBody 
                className={cn(
                    "bg-neutral-100 dark:bg-neutral-100 !p-4 !pb-16 flex flex-col items-center justify-start aspect-[3/4] w-80 max-w-full",
                    className
                )}
                dragConstraintsRef={dragConstraintsRef}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                isDraggable={isDraggable}
            >
                {cardInnerContent}
            </DraggableCardBody>
        </DraggableCardContainer>
    );
};

export default PolaroidCard;
