import React, { createContext, useContext, useEffect, useState } from 'react';

interface ArenaEffectsContextProps {
    confetti: boolean;
    setConfetti: (selection: boolean) => void
}
const ArenaEffectsContext = createContext<ArenaEffectsContextProps | undefined>(undefined);

const ArenaEffectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [confetti, showConfetti] = useState(false);

    const setConfetti = (selection: boolean) => {
        showConfetti(selection);
    }
    
    return (
        <ArenaEffectsContext.Provider value={{ confetti, setConfetti }}>
            {children}
        </ArenaEffectsContext.Provider>
    );
}

const useArenaEffects = () => {
    const context = useContext(ArenaEffectsContext);
    if (!context) {
        throw new Error('useArenaEffects must be used within an ArenaEffectsProvider');
    }
    return context;
};

export { ArenaEffectsProvider, useArenaEffects };
