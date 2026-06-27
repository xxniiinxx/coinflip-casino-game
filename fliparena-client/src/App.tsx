import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { ArenaBody } from './components/arena/ArenaBody';
import { PrizePool } from './components/arena/PrizePool';
import { PrizePoolComingSoon, HistoryComingSoon } from './components/placeholders/ComingSoon';
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import "@solana/wallet-adapter-react-ui/styles.css";
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { ToastContainer } from 'react-toastify';
import { ArenaSocketProvider } from './providers/ArenaSocketProvider';
import { ArenaEffectsProvider } from './providers/ArenaEffectsProvider';
import { RPC } from "./lib/constant";

function App() {
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ArenaEffectsProvider>
            <ArenaSocketProvider>
              <ToastContainer />
              <BrowserRouter>
                <div className="App Inter h-full md:h-screen hide_scrollbar">
                  <Header />
                  <Routes>
                    <Route path='/' element={<ArenaBody />} />
                    <Route path='/prize-pool' element={<PrizePool />} />
                    <Route path='/prize-pool-soon' element={<PrizePoolComingSoon />} />
                    <Route path='/history-soon' element={<HistoryComingSoon />} />
                  </Routes>
                </div>
              </BrowserRouter>
            </ArenaSocketProvider>
          </ArenaEffectsProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
