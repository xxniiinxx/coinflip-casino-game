import { useEffect, useState } from "react"
import { FaX } from "react-icons/fa6"
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { errorAlert, } from '../ToastGroup';
import { useArenaSocket } from "../../providers/ArenaSocketProvider";
import { WalletAvatar } from "../Pattern";

interface ArenaMatch {
    unit: String,
    mint: String, 
    decimal: number, 
    amount: number,
    creator: String,
    selection: Boolean,
    finished: Boolean,
    opposite: string,
    matchPda: String,
    readyToPlay: Boolean,
    createdAt: Number,
    result: Boolean,
    index: number,
    process: Boolean,
    _id: String
}
export const AcceptMatchModal = (props: { open: boolean, handleModal: any, index: String }) => {
    const { accepting, matches, acceptMatch, setAcceptingState } = useArenaSocket();
    const wallet = useAnchorWallet();
    const [ matchData, setMatchData ] = useState<ArenaMatch>({
        unit: "",
        mint: "", 
        decimal: 1, 
        amount: 0,
        creator: "",
        selection: false,
        finished: false,
        opposite: "",
        matchPda: "",
        readyToPlay: false,
        createdAt: 0,
        result: false,
        index: 0,
        process: false,
        _id: ""
    })

    useEffect(() => {
        const selectedMatch = matches.find(match => match._id === props.index);
        if (selectedMatch) {
            setMatchData(selectedMatch)
        }
    })

    const handleStep = () => {
        props.handleModal(false);
    }
    const handleAccept = async () => {
        if (wallet) {
            setAcceptingState(true);
            acceptMatch(matchData?.unit, wallet?.publicKey.toBase58(), matchData?.creator, matchData?.mint, matchData?.index, Number(matchData?.amount));
        } else {
            errorAlert("Please connect wallet!");
        }
    }

    return <div className={`fixed z-20 w-screen h-screen top-0 left-0 backdrop-blur-sm bg-bg-light/50 ${props.open ? "flex" : 'hidden'} flex justify-center hide_scrollbar`}>
        <div className="w-full h-fit md:w-fit border border-white/10 rounded-2xl relative bg-bg-light flex flex-col shadow-2xl mt-20">
            <div className="bg-bg-light flex items-center justify-between py-[16px] px-[20px] text-xm text-white rounded-t-2xl absolute w-full border border-b-white/10 border-t-0 border-x-0 top-0 left-0 z-20">
                <p>FlipArena Match</p>
                <FaX className="hover:text-purple cursor-pointer" onClick={() => { handleStep() }} />
            </div>
            <div className="h-full flex flex-col gap-6 sm:gap-16 mt-16 sm:mt-28">
                <div className="flex flex-col sm:flex-row items-center w-full justify-around text-white px-[14px] py-[18px] gap-4 text-xm ">
                    <div className="flex flex-col items-center gap-3 px-4">
                        <div className="w-[40px] sm:w-12 h-[40px] sm:h-12 relative">
                            {
                                matchData?.finished && matchData?.result === matchData?.selection?
                                <WalletAvatar walletAddress={matchData?.creator as string} size={"w-12 h-12"} border={true} color={matchData?.selection ? "border-2 border-green" : "border-2 border-purple"} />:
                                <WalletAvatar walletAddress={matchData?.creator as string} size={"w-12 h-12"} border={!matchData?.finished} color={matchData?.selection ? "border-2 border-green" : "border-2 border-purple"} />
                            }
                            <img src={`/img/${matchData?.selection ? "banner_head" : "banner_tail"}.png`} className={`absolute w-9 top-[-6px] right-[-12px]`} alt="" />
                        </div>
                        <p>{matchData?.creator.slice(0, 4) + "..." + matchData?.creator.slice(matchData?.creator.length - 4, matchData?.creator.length)}</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1">
                        {
                            matchData?.finished?
                                <img src={`/img/${matchData?.result ? "banner_head" : "banner_tail"}.png`} className="w-[100px]" alt="" />:
                                matchData.readyToPlay?<div className={`coin w-[75px] h-[75px] flipping`} >
                                    <img src="/img/banner_head.png" className={`coin-face w-[75px]`} alt="" />
                                    <img src="/img/banner_tail.png" className={`coin-back w-[75px]`} alt="" />
                                </div>: 
                                <div className="w-[75px] h-[75px] rounded-full border-2 border-dashed border-white bg-white/10 mb-10"></div>
                        }
                        {matchData?.readyToPlay? <p className="text-purple text-md">{matchData?.finished?"Finished":"Ready to Flip"}</p>: <></>}
                        <p>Total Pot Value:  {matchData?.amount/Math.pow(10, matchData?.decimal) * 2} {matchData?.unit}</p>
                        <p className="text-[12px] text-grey">Created at {(new Date((matchData?.createdAt as number) * 1000)).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 px-4">
                        {matchData?.opposite === ''? <div className={`w-[40px] sm:w-12 h-[40px] sm:h-12 flex items-center justify-center bg-white/10 rounded-full relative border-2 ${!matchData?.selection ? "border-green" : "border-purple"}`}>
                            <img src={`/img/${!matchData?.selection ? "banner_head" : "banner_tail"}.png`} className={`absolute w-9 top-[-6px] right-[-12px]`} alt="" />
                        </div>:
                        <div className={`w-[40px] sm:w-12 h-[40px] sm:h-12 relative`}>
                            {
                                matchData?.finished && matchData?.result !== matchData?.selection?
                                <WalletAvatar walletAddress={matchData?.opposite} size={"w-12 h-12"} border={true} color={!matchData?.selection ? "border-2 border-green" : "border-2 border-purple"} />:
                                <WalletAvatar walletAddress={matchData?.opposite} size={"w-12 h-12"} border={!matchData?.finished} color={!matchData?.selection ? "border-2 border-green" : "border-2 border-purple"} />
                            }

                            <img src={`/img/${!matchData?.selection ? "banner_head" : "banner_tail"}.png`} className={`absolute w-9 top-[-6px] right-[-12px]`} alt="" />
                        </div>}
                        <p>{matchData?.opposite === ""?"Waiting Opponent": matchData?.opposite?.slice(0, 4) + "..." + matchData?.opposite?.slice(matchData?.opposite?.length - 4, matchData?.opposite?.length)}</p>
                    </div>
                </div>
                <div className="w-full flex justify-end gap-3 text-grey border border-t-white/10 border-b-0 border-x-0 py-[16px] px-[20px]">
                    <button className={`rounded-lg border border-white/10 ${matchData?.readyToPlay || matchData?.creator === wallet?.publicKey.toBase58() || matchData.process || matchData.finished?'w-full':'w-1/2'} mx-auto py-2 text-xm text-center hover:border-purple hover:bg-purple hover:text-white transition`} onClick={() => { handleStep() }}>Close</button>
                    { !matchData?.readyToPlay && wallet?.publicKey.toBase58() !== matchData?.creator && !matchData.process && !matchData.finished? <button className="rounded-lg border border-white/10 w-1/2 mx-auto py-2 text-xm text-center hover:border-purple hover:bg-purple hover:text-white transition" onClick={() => handleAccept()}>Accept</button>: <></> }
                </div>
            </div>
            {accepting? <div className="w-full h-full absolute top-0 left-0 backdrop-blur-sm flex justify-center items-center z-30">
            </div>: <></>}

        </div>
    </div>
}
