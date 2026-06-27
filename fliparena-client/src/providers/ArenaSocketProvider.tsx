import React, { createContext, useContext, useEffect, useState } from 'react';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import { useArenaEffects } from './ArenaEffectsProvider';
import { errorAlert, infoAlert, successAlert } from '../components/ToastGroup';
import { WS_HOST, RPC } from '../lib/constant';

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
    err: Boolean,
    _id: String
}
interface ChatMessage {
    message: string,
    wallet: string,
    createdAt: number
}
interface ArenaSocketContextProps {
    matches: ArenaMatch[];
    opening: boolean,
    accepting: boolean,
    settled: boolean,
    walletStats: {
        totalMatches: number,
        wins: number,
    },
    chatMessages: ChatMessage[],
    hasMore: boolean,
    isScroll: boolean,
    isNew: boolean,
    openMatch: (unit: String, mint: String, decimal: Number, amount: Number, creator: String, selection: Boolean) => void;
    acceptMatch: (unit: String, opposite: string, creator_key: String, mint: String, index: number, amount: number) => void;
    refreshMatches: () => void;
    setOpeningState: (state: boolean) => void;
    setAcceptingState: (state: boolean) => void;
    fetchWalletStats: (address: string) => void;
    sendChat: (wallet: string, message: string) => void,
    loadChat: (page: number) => void
}
const connection = new Connection(RPC);

const ArenaSocketContext = createContext<ArenaSocketContextProps | undefined>(undefined);

const ArenaSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [matches, setMatches] = useState<ArenaMatch[]>([]);
    const [opening, setOpening] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [accepting, setAccepting] = useState(false);
    const [isScroll, setIsScroll] = useState(false);
    const [settled, setSettled] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [hasMore, setHasmore] = useState(true);
    const [walletStats, setWalletStats] = useState({
        totalMatches: 0,
        wins: 0,
    });
    const { setConfetti } = useArenaEffects();
    const wallet = useAnchorWallet()
    useEffect(() => {
        if (!wallet) {
            console.warn("Wallet is not initialized");
            return;
        }
        console.log("wallet:", wallet.publicKey);

        const ws = new WebSocket(WS_HOST);
        setSocket(ws);

        ws.onopen = () => {
            console.log('WebSocket connection established');
            ws.send(JSON.stringify({ type: 'LIST_MATCHES' }));
            ws.send(JSON.stringify({ type: 'GET_WALLET_STATS', data: wallet.publicKey.toBase58() }));
            ws.send(JSON.stringify({ type: 'LOAD_CHAT', page: 1 }))
        };

        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'MATCH_LIST': {
                    console.log("matches==>", message.rooms);
                    setMatches(message.rooms.reverse());
                    break;
                }
                case 'MATCH_OPENED': {
                    try {
                        console.log("start open match: ", message.room);
                        const decodedBufferTx = Buffer.from(message.room, 'base64');
                        const vtx = VersionedTransaction.deserialize(decodedBufferTx);
                        if (!wallet) {
                            errorAlert("Wallet is not initialized!");
                            break;
                        }
                        const signedVtx = await wallet?.signTransaction(vtx);
                        if (!signedVtx) break
                        const serializedTx = signedVtx.serialize();
                        const base64Transaction = Buffer.from(serializedTx).toString("base64");

                        ws.send(JSON.stringify({ type: 'SUBMIT_MATCH_TX', ...message.data, event: 'create', room: base64Transaction }))

                    } catch (error) {
                        setOpening(false);
                        setAccepting(false);
                        console.log("opening error:", error);
                        errorAlert("Error opening match!");
                        break;
                    }

                    break;
                }
                case 'OPPONENT_JOINED': {
                    try {
                        console.log("start accept match:", message.join);
                        const decodedBufferTx = Buffer.from(message.join, 'base64');
                        const vtx = VersionedTransaction.deserialize(decodedBufferTx);
                        if (!wallet) {
                            errorAlert("Wallet is not initialized!");
                            break;
                        }
                        const signedVtx = await wallet?.signTransaction(vtx);
                        if (!signedVtx) break
                        const serializedTx = signedVtx.serialize();
                        const base64Transaction = Buffer.from(serializedTx).toString("base64");
                        ws.send(JSON.stringify({ type: 'SUBMIT_MATCH_TX', ...message.data, join: base64Transaction, event: 'join' }))
                    } catch (error) {
                        setAccepting(false);
                        console.log("Accepting error:", error);
                        errorAlert("Error accepting match!");
                    }
                    break;
                }
                case 'MATCH_ADDED':
                    setMatches((prev) => [message.data, ...prev]);
                    if (wallet.publicKey.toBase58() === message.data.creator) {
                        setOpening(false)
                    }
                    break;
                case 'MATCH_EXPIRED':
                    setMatches((prev) => prev.filter(item =>
                        item._id !== message.data._id
                    ));
                    if (wallet.publicKey.toBase58() == message.data.creator) {
                        infoAlert("Your match has expired!");
                    }

                    if (message.data.opposite) {
                        if (wallet.publicKey.toBase58() == message.data.opposite) {
                            infoAlert(message.data.creator.slice(0, 4) + "..." + message.data.creator.slice(message.data.creator.length - 4, message.data.creator.length) + "'s match has expired!");
                        }
                    }
                    break
                case 'OPPONENT_UPDATED':
                    setMatches((prev) => prev.map(item =>
                        item._id === message.data._id ? { ...item, opposite: message.data.opposite, process: true } : item
                    ));

                    if (wallet.publicKey.toBase58() === message.data.opposite) {
                        setAccepting(false);
                    }
                    break;
                case 'MATCH_SETTLED':
                    const winnerMsg = `You won ${parseFloat(message.data.amount) / Math.pow(10, parseFloat(message.data.decimal)) * 2} ${message.data.unit}`;
                    const loserMsg = `You lost ${parseFloat(message.data.amount) / Math.pow(10, parseFloat(message.data.decimal))} ${message.data.unit}`;

                    setMatches((prev) => prev.map(item =>
                        item._id === message.data._id ? { ...item, finished: true, result: message.data.result, createdAt: Date.now() / 1000 } : item
                    ));
                    if (wallet.publicKey.toBase58() == message.data.creator) {
                        if (message.data.selection === message.data.result) {
                            setConfetti(true);
                            successAlert(winnerMsg);
                        } else {
                            errorAlert(loserMsg);
                        }
                    } else if (wallet.publicKey.toBase58() == message.data.opposite) {
                        if (message.data.selection === message.data.result) {
                            errorAlert(loserMsg)
                        } else {
                            setConfetti(true);
                            successAlert(winnerMsg)
                        }
                    }

                    setSettled(!settled);
                    break;
                case 'WALLET_STATS':
                    setWalletStats({
                        totalMatches: message.data.games,
                        wins: message.data.win,
                    })
                    break;
                case 'ERROR':
                    if (message.matchPda) {
                        setMatches((prev) => prev.map(item =>
                            item.matchPda === message.matchPda ? { ...item, err: true } : item
                        ));
                    }
                    errorAlert(message.data);
                    setOpening(false);
                    setAccepting(false);
                    break
                case 'CHAT_BATCH':
                    if (message.messages.length > 0) {
                        setIsScroll(message.isScroll);
                        if (message.isScroll) {
                            setChatMessages((prev) => [...message.messages, ...prev]);
                        } else {
                            if (message.messages.length === 1) {
                                setIsNew(true)
                                setChatMessages((prev) => [...prev, ...message.messages]);
                            } else {
                                setChatMessages((prev) => [...message.messages]);
                                setIsNew(false)
                            }
                        }
                    } else {
                        setHasmore(false);
                    }

                    break
                case 'PROCESS_UPDATED':
                    if (message.status === "creating") {
                        setMatches((prev) => prev.map(item =>
                            item._id === message._id ? { ...item, process: false } : item
                        ));
                        if (wallet.publicKey.toBase58() === message.creator) {
                            successAlert("Your match was created successfully!");
                        }
                    } else if (message.status === "joining") {
                        setMatches((prev) => prev.map(item =>
                            item._id === message._id ? { ...item, process: false, readyToPlay: true } : item
                        ));
                        if (wallet.publicKey.toBase58() === message.creator) {
                            infoAlert(message.opposite.slice(0, 4) + "..." + message.opposite.slice(message.opposite.length - 4, message.opposite.length) + " joined your match");
                        } else if (wallet.publicKey.toBase58() === message.opposite) {
                            infoAlert("Joined successfully!");
                        }
                    }

                    break
                default: {
                    console.warn('Unknown message type:', message.type);
                }
            }
        };

        ws.onerror = (error) => {
            errorAlert('WebSocket error:' + error);
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
            setOpening(false);
            setAccepting(false);
        };

        return () => ws.close();
    }, [wallet]);

    useEffect(() => {
        setInterval(() => {
            const fiveMinutesAgo: Number = Math.floor(Date.now() / 1000) - 5 * 60;
            if (matches) {
                setMatches((prev) => prev.filter(item =>
                    item.createdAt >= fiveMinutesAgo || !item.finished
                ));
            }

        }, 5000);

    }, [])

    useEffect(() => {
        if (wallet?.publicKey) {
            fetchWalletStats(wallet?.publicKey.toBase58())
        }
    }, [settled]);

    const openMatch = (unit: String, mint: String, decimal: Number, amount: Number, creator: String, selection: Boolean) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket?.send(JSON.stringify({ type: 'OPEN_MATCH', unit, mint, decimal, amount, creator, selection }));
        } else {
            setOpening(false);
            infoAlert("WebSocket connection closed");
        }
    };

    const acceptMatch = (unit: String, opposite: string, creator_key: String, mint: String, index: number, amount: number) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket?.send(JSON.stringify({ type: 'ACCEPT_MATCH', unit, opposite, creator_key, mint, index, amount }));
        } else {
            setAccepting(false);
            infoAlert("WebSocket connection closed");
        }
    };

    const fetchWalletStats = (address: string) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket?.send(JSON.stringify({ type: 'GET_WALLET_STATS', data: address }));
        }
    };

    const setOpeningState = (state: boolean) => {
        setOpening(state);
    }

    const setAcceptingState = (state: boolean) => {
        setAccepting(state);
    }

    const refreshMatches = () => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'LIST_MATCHES' }));
        } else {
            console.warn('WebSocket is not ready');
        }
    };

    const sendChat = (wallet: string, message: string) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket?.send(JSON.stringify({ type: 'CHAT_SEND', data: { wallet, message } }));
        }
    }

    const loadChat = (page: number) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket?.send(JSON.stringify({ type: 'LOAD_CHAT', page }));
        }
    }
    return (
        <ArenaSocketContext.Provider value={{ walletStats, settled, matches, opening, accepting, chatMessages, hasMore, isScroll, isNew, loadChat, openMatch, acceptMatch, refreshMatches, setOpeningState, setAcceptingState, fetchWalletStats, sendChat }}>
            {children}
        </ArenaSocketContext.Provider>
    );
};

const useArenaSocket = () => {
    const context = useContext(ArenaSocketContext);
    if (!context) {
        throw new Error('useArenaSocket must be used within an ArenaSocketProvider');
    }
    return context;
};

export { ArenaSocketProvider, useArenaSocket };
