import React from "react";
import { useLocation } from "react-router-dom";

export const PrizePoolComingSoon = () => {
    const location = useLocation();
    const { title, message } = location.state || {};
    
    return <div className='px-3 md:px-4 xl:px-9 py-3 md:py-6 bg-bg-light flex justify-center items-center gap-3 mt-[60px] h-full md:h-[calc(100vh-60px)] overflow-auto'>
        <div className="flex flex-col text-white items-center gap-4">
            <img src="/img/coming.png" alt="" className="w-36"/>
            
            <p className="text-center text-sm text-grey"><span className="text-center text-md text-white">Prize Pool is under development</span> <br/>Soon, you’ll be able to participate in high-stakes FlipArena matches and win big!</p>
            
        </div>
    </div>
}


export const HistoryComingSoon = () => {
    const location = useLocation();
    const { title, message } = location.state || {};
    
    return <div className='px-3 md:px-4 xl:px-9 py-3 md:py-6 bg-bg-light flex justify-center items-center gap-3 mt-[60px] h-full md:h-[calc(100vh-60px)] overflow-auto'>
        <div className="flex flex-col text-white items-center gap-4">
            <img src="/img/coming.png" alt="" className="w-36"/>
            
            <p className="text-center text-sm text-grey"><span className="text-center text-md text-white">Match history is coming soon</span> <br/>You'll soon be able to view detailed logs of your past FlipArena matches and outcomes!</p>
            
        </div>
    </div>
}
