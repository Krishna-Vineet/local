import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import logolight from "../assets/logo_light.svg";
import { useIdleTimer } from '../hooks/useIdleTimer';
import IdleTimerRing from '../components/IdleTimerRing';

const PhotoSelection = () => {
    const navigate = useNavigate();
    const { session, setRetakeIndex, setSelectedImages, resetSession } = useBooth();
    const [selectedPoolIndex, setSelectedPoolIndex] = useState(null);

    // 60-second idle timer — resets on any user interaction
    const TIMEOUT = 60;
    const { secondsLeft } = useIdleTimer({
        timeoutSeconds: TIMEOUT,
        onTimeout: () => {
            resetSession();
            navigate('/');
        },
    });

    // Initialize selectedImages if empty
    React.useEffect(() => {
        if (session.selectedImages.length === 0 && session.images.length > 0) {
            setSelectedImages(session.images.slice(0, session.frames));
        }
    }, [session.images, session.frames, session.selectedImages.length]);

    const handleRetake = (index) => {
        setRetakeIndex(index);
        navigate('/capture');
    };

    const handleSelectPool = (index) => {
        setSelectedPoolIndex(index === selectedPoolIndex ? null : index);
    };

    const handleAssignSlot = (slotIndex) => {
        if (selectedPoolIndex === null) return;
        
        const newSelectedImages = [...session.selectedImages];
        newSelectedImages[slotIndex] = session.images[selectedPoolIndex];
        setSelectedImages(newSelectedImages);
        setSelectedPoolIndex(null); // Deselect after assigning
    };

    const handleConfirm = () => {
        navigate('/printselection');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 md:p-10 font-sans py-20">

            {/* Idle countdown ring */}
            <IdleTimerRing secondsLeft={secondsLeft} totalSeconds={TIMEOUT} />

            {/* Header */}
            <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <div className="hidden md:block opacity-0">Placeholder</div>
                <div className="text-center">
                    <h1 className="text-2xl md:text-4xl font-black uppercase tracking-widest text-white">Customize Your Frame</h1>
                    <p className="text-gray-400 mt-2 text-sm md:text-base px-4">Tap a photo on the left, then tap a slot on the right to replace it.</p>
                </div>
                <div className="text-gray-500 text-sm font-semibold">
                    {/* spacer — ring is now fixed top-right */}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row w-full max-w-7xl justify-between items-start gap-10">
                
                {/* Photo Pool (Left) */}
                <div className="flex-1 w-full order-2 lg:order-1">
                    <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-purple-400 md:hidden">1. Pick a Photo</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 bg-gray-900/50 p-4 md:p-6 rounded-3xl border border-white/10">
                        {session.images.map((img, index) => (
                            <div 
                                key={img.id} 
                                onClick={() => handleSelectPool(index)}
                                className={`relative group aspect-[3/4] overflow-hidden rounded-xl border-4 transition-all cursor-pointer ${
                                    selectedPoolIndex === index 
                                    ? "border-purple-500 scale-105 shadow-[0_0_20px_rgba(168,85,247,0.6)] z-10" 
                                    : "border-white/10 hover:border-white/30"
                                }`}
                            >
                                <img src={img.url} alt={`Shot ${index + 1}`} className="w-full h-full object-cover" />
                                
                                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 flex justify-center gap-2 opacity-100">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRetake(index);
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase transition-colors"
                                    >
                                        Retake
                                    </button>
                                </div>
                                
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold border border-white/10">
                                    #{index + 1}
                                </div>

                                {selectedPoolIndex === index && (
                                    <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                        <div className="bg-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg uppercase">
                                            Picked
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Frame Preview (Right) */}
                <div className="flex-shrink-0 w-full lg:w-80 flex flex-col items-center order-1 lg:order-2">
                    <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-purple-400 md:hidden">2. Assign to Slot</h2>
                    <div className="bg-white p-4 md:p-5 rounded-xl shadow-2xl w-full border-4 md:border-8 border-gray-100 font-sans">
                        <div className="flex flex-col gap-2">
                             
                             <div className={`grid ${session.orientation === 'grid' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                {[...Array(session.frames)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => handleAssignSlot(i)}
                                        className={`bg-black aspect-[4/3] w-full border-2 flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                                            selectedPoolIndex !== null 
                                            ? "border-dashed border-purple-400 animate-pulse bg-purple-900/10" 
                                            : "border-gray-200"
                                        }`}
                                    >
                                        {session.selectedImages[i] ? (
                                            <img src={session.selectedImages[i].url} alt={`Slot ${i+1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                                <span className="text-white/20 text-[10px] font-bold uppercase">Slot {i+1}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                             
                             <div className="bg-gray-200 h-8 w-full flex items-center justify-between px-3 mt-2 rounded-sm border border-gray-300">
                                <div className="w-3 h-3 md:w-4 md:h-4 bg-gray-400 rounded-full"></div>
                                <img src={logolight} alt="logo" className="h-4 md:h-5 object-contain" />
                             </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Actions */}
            <div className="mt-16 flex flex-col sm:flex-row gap-4 md:gap-8 w-full sm:w-auto px-6">
                <button 
                    onClick={() => navigate('/frameselection')}
                    className="px-10 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-extrabold text-lg md:text-xl transition-all uppercase tracking-widest border border-white/10"
                >
                    Back
                </button>
                <button 
                    onClick={handleConfirm}
                    className="px-16 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 text-white rounded-full font-extrabold text-lg md:text-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all uppercase tracking-widest"
                >
                    Confirm & Print
                </button>
            </div>

        </div>
    );
};

export default PhotoSelection;
