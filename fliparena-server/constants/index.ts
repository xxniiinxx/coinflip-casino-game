import { PublicKey } from "@solana/web3.js";
import WebSocket from "ws";
type Option<T> = T | null;

export const FLIPARENA_PROGRAM = new PublicKey(
  "472RXUv8zUX7zm4LprxNsFQvAZYEpSGaY9EUE4akCvG6"
);
export const GLOBAL_VAULT_SEED = "coinflip_global_main";
export const GAME_VAULT_SEED = "coinflip_game";
export const MESSAGES_PER_PAGE = 15;

export interface ArenaMatch {
  unit: String;
  mint: String;
  decimal: String;
  amount: String;
  creator: String;
  selection: Boolean;
  finished: Boolean;
  opposite: Option<string>;
  matchPda: String;
  readyToPlay: Boolean;
  createdAt: Number;
  result: Boolean;
  _id: String;
}
export interface SocketClient {
  ws: WebSocket;
}
export interface ChatMessage {
  wallet: String;
  message: String;
  createdAt: number;
}
export const token_list = [
  {
    name: "Solana",
    unit: "SOL",
    selected: true,
    mint: "So11111111111111111111111111111111111111112",
    decimal: 9,
  },
  {
    name: "Solana USDT",
    unit: "USDT",
    selected: false,
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimal: 6,
  },
  {
    name: "Solana USDC",
    unit: "USDC",
    selected: false,
    mint: "4aXbQo8P7qDE9UT2nCKhh6Ju4xC4QHDq7MvVttwkCmaT",
    decimal: 9,
  },
  {
    name: "BONK Coin",
    unit: "BONK",
    selected: false,
    mint: "6Jzy37BXQ12tdGRG2F8p8Dts4UYM2p1dDgWgwXfgUzBG",
    decimal: 9,
  },
];
