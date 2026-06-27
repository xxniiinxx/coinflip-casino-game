import dotenv from "dotenv";
import { connectMongoDB } from "./config";
import WebSocket from "ws";
import {
  setClusterConfig,
  fetchGlobalVaultStatus,
  initializeGlobalVault,
  fetchMatchStatus,
} from "./services/chainService";
import { MESSAGES_PER_PAGE, ArenaMatch, ChatMessage, SocketClient } from "./constants";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import MatchModel from "./models/MatchModel";
import ChatModel from "./models/ChatModel";
import {
  program,
  refundSol,
  refundToken,
  openMatch,
  acceptMatch,
  settleMatch,
  checkBalance,
} from "./services/chainService";
import { postMatchResult } from "./services/socialNotify";

dotenv.config();
connectMongoDB();

let rpc = process.env.RPC || "";

(async () => {
  setClusterConfig("mainnet-beta", rpc);
  let status = await fetchGlobalVaultStatus();
  console.log("status=====", status);

  if (!status) {
    console.log("Init global auth");

    await initializeGlobalVault();
  }
  status = await fetchGlobalVaultStatus();
})();

export const server = new WebSocket.Server({ port: 8881 });

let connection = new Connection(rpc);
let chatBuffer: ChatMessage[] = [];
let matches: ArenaMatch[] = [];
let clients: SocketClient[] = [];

type Option<T> = T | null;

export const broadcast = (message: object) => {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  });
};

const cancelStaleMatch = async () => {
  try {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;

    let result = await MatchModel.findOne({
      finished: false,
      createdAt: { $lt: fiveMinutesAgo },
    });
    if (result) {
      let status = await fetchMatchStatus(result.matchPda);
      if (status && !status.availableOpposite) {
        await refundSol(result.creator as String, Number(result.amount));
      } else if (status && status.availableOpposite) {
        await refundSol(
          result.creator as String,
          Number(result?.amount),
          result.opposite
        );
      }

      if (result?.opposite !== "") {
        broadcast({
          type: "MATCH_EXPIRED",
          data: {
            _id: result._id,
            creator: result.creator,
            opposite: result.opposite,
          },
        });
      } else {
        broadcast({
          type: "MATCH_EXPIRED",
          data: { _id: result._id, creator: result.creator },
        });
      }

      await result.deleteOne();
      console.log(`${result._id} expired matches deleted.`);
    }
  } catch (error) {
    console.error("Error deleting expired matches:", error);
  }
};

const purgeOldChat = async () => {
  try {
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 5;
    await ChatModel.deleteMany({
      createdAt: { $lt: twoDaysAgo },
    });
  } catch (error) {
    console.log("error when purging chat:", error);
  }
};

const flushChatBuffer = async () => {
  try {
    let pendingMessages = chatBuffer;
    chatBuffer = [];
    for (let index = 0; index < pendingMessages.length; index++) {
      const element = pendingMessages[index];
      const message = new ChatModel({
        message: element.message,
        wallet: element.wallet,
        createdAt: element.createdAt,
      });

      let result = await message.save();
      console.log("save result==>>>", result);
    }
  } catch (error) {
    console.log("Error when saving chat:", error);
  }
};

const runArenaMaintenance = async () => {
  await cancelStaleMatch();
  await flushChatBuffer();
  await purgeOldChat();
};

setInterval(runArenaMaintenance, 5000);

server.on("connection", (ws: WebSocket) => {
  try {
    const client = { ws };
    clients.push(client);
    console.log("connected");

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case "OPEN_MATCH":
            try {
              const { unit, mint, decimal, amount, creator, selection } = data;
              console.log("Creating new match...");
              const balanceCheck = await checkBalance(
                unit === "SOL",
                mint,
                amount * Math.pow(10, decimal),
                creator
              );
              if (!balanceCheck) {
                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    data: "Not enough Balance!",
                  })
                );
                break;
              }
              let index = 13100;
              const result = await MatchModel.findOne({ creator });
              if (result) {
                index = result.index + 1;
              }

              const serializedTx = await openMatch(
                selection,
                creator,
                mint,
                amount,
                decimal,
                unit === "SOL",
                index
              );
              ws.send(
                JSON.stringify({
                  type: "MATCH_OPENED",
                  room: serializedTx?.base64Transaction,
                  data: {
                    unit,
                    mint,
                    decimal,
                    amount: amount * Math.pow(10, decimal),
                    creator,
                    selection,
                    matchPda: serializedTx?.newGame,
                    index: serializedTx?.index,
                  },
                })
              );
            } catch (error) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  data: "Error Creating Transaction!",
                })
              );
            }

            break;
          case "ACCEPT_MATCH": {
            try {
              const { unit, opposite, creator_key, mint, index, amount } = data;
              console.log("building instruction for accept match");
              const balanceCheck = await checkBalance(
                unit === "SOL",
                mint,
                amount,
                opposite
              );
              if (!balanceCheck) {
                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    data: "Not enough Balance!",
                  })
                );
                break;
              }

              const serializedTx = await acceptMatch(
                opposite,
                creator_key,
                mint,
                index
              );

              ws.send(
                JSON.stringify({
                  type: "OPPONENT_JOINED",
                  join: serializedTx?.base64Transaction,
                  data: {
                    opposite,
                    matchPda: serializedTx?.matchPda,
                  },
                })
              );
            } catch (error) {
              console.log(error);

              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  data: "Error Joining Transaction!",
                })
              );
            }
            break;
          }
          case "LIST_MATCHES":
            const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
            console.log("now time===>", fiveMinutesAgo);

            matches = await MatchModel.find({
              createdAt: { $gt: fiveMinutesAgo },
            });
            ws.send(JSON.stringify({ type: "MATCH_LIST", rooms: matches }));
            break;
          case "GET_WALLET_STATS":
            {
              const address = data.data;
              console.log("fetch wallet stats ==>", address);
              const matchHistory = await MatchModel.find({
                $or: [{ creator: address }, { opposite: address }],
              });

              let win = 0;
              for (let index = 0; index < matchHistory.length; index++) {
                const element = matchHistory[index];
                if (
                  address === element.creator &&
                  element.selection === element.result
                ) {
                  win++;
                } else if (
                  address === element.opposite &&
                  element.selection !== element.result
                ) {
                  win++;
                }
              }

              ws.send(
                JSON.stringify({
                  type: "WALLET_STATS",
                  data: { win, games: matchHistory.length },
                })
              );
            }

            break;
          case "CHAT_SEND":
            const messageData = {
              wallet: data.data.wallet,
              message: data.data.message,
              createdAt: Date.now() / 1000,
            };
            chatBuffer.push(messageData);

            broadcast({
              type: "CHAT_BATCH",
              messages: [messageData],
              isScroll: false,
            });
            break;
          case "LOAD_CHAT": {
            let fetchMessages = await ChatModel.find()
              .sort({ createdAt: -1 })
              .skip((data.page - 1) * MESSAGES_PER_PAGE)
              .limit(MESSAGES_PER_PAGE)
              .select("message wallet createdAt -_id");
            let sendMessage = [...fetchMessages.reverse(), ...chatBuffer];
            if (data.page > 1) {
              sendMessage = [...fetchMessages];
            }

            ws.send(
              JSON.stringify({
                type: "CHAT_BATCH",
                messages: sendMessage,
                isScroll: data.page > 1,
              })
            );
            break;
          }
          case "SUBMIT_MATCH_TX": {
            if (data.event === "create") {
              let {
                mint,
                unit,
                decimal,
                amount,
                creator,
                selection,
                matchPda,
                index,
              } = data;
              try {
                console.log("save new match on db...");
                const match = new MatchModel({
                  unit,
                  mint,
                  decimal,
                  amount,
                  creator,
                  selection,
                  result: selection,
                  createdAt: Math.floor(Date.now() / 1000),
                  matchPda,
                  index,
                  process: true,
                });
                let result = await match.save();

                broadcast({ type: "MATCH_ADDED", data: result });
                console.log("saved");

                const decodedBufferTx = Buffer.from(data.room, "base64");
                const vtx = VersionedTransaction.deserialize(decodedBufferTx);

                const preInxSim = await connection.simulateTransaction(vtx);
                console.log("create match simulate result:", preInxSim);
                const signature = await connection.sendTransaction(vtx, {
                  skipPreflight: true,
                });

                await connection.confirmTransaction(signature, "finalized");
                console.log("creating match signature: ", signature);
                const transaction = await connection.getSignatureStatus(
                  signature
                );
                if (
                  transaction.value?.confirmationStatus === "finalized" &&
                  !preInxSim.value.err
                ) {
                  result.process = false;
                  await result.save();
                  broadcast({
                    type: "PROCESS_UPDATED",
                    _id: result._id,
                    creator: result.creator,
                    opposite: result?.opposite,
                    status: "creating",
                  });
                } else if (preInxSim.value.err) {
                  throw new Error("Creating match error!");
                }
              } catch (error) {
                await MatchModel.findOneAndUpdate({ matchPda }, { err: true });

                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    data: "Match Creating Error!",
                    matchPda,
                  })
                );
              }
            } else if (data.event === "join") {
              const { matchPda, opposite } = data;
              const match = await MatchModel.findOneAndUpdate(
                { matchPda },
                { opposite, process: true },
                { update: true }
              );
              if (!match) {
                await MatchModel.findOneAndUpdate({ matchPda }, { err: true });

                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    data: "Joining Match Error!",
                    matchPda,
                  })
                );

                return;
              }
              try {
                console.log("join to match ", data.matchPda);
                broadcast({
                  type: "OPPONENT_UPDATED",
                  data: {
                    _id: match?._id,
                    opposite,
                    creator: match?.creator,
                  },
                });
                const decodedBufferTx = Buffer.from(data.join, "base64");
                const vtx = VersionedTransaction.deserialize(decodedBufferTx);
                const preInxSim = await connection.simulateTransaction(vtx);
                console.log("join match simulate result:", preInxSim);
                const signature = await connection.sendTransaction(vtx, {
                  skipPreflight: true,
                });

                await connection.confirmTransaction(signature, "finalized");
                console.log("join match signature: ", signature);
                const transaction = await connection.getSignatureStatus(
                  signature
                );
                if (
                  transaction.value?.confirmationStatus === "finalized" &&
                  !preInxSim.value.err
                ) {
                  const search = await MatchModel.findOneAndUpdate(
                    { _id: match?._id },
                    { process: false, readyToPlay: true }
                  );
                  broadcast({
                    type: "PROCESS_UPDATED",
                    _id: search?._id,
                    creator: search?.creator,
                    opposite: search?.opposite,
                    status: "joining",
                  });
                } else if (preInxSim.value.err) {
                  throw new Error("Joining Error");
                }
              } catch (error) {
                await MatchModel.findOneAndUpdate({ matchPda }, { err: true });

                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    data: "Joining Match Error!",
                    matchPda,
                  })
                );
                return;
              }
              if (match?.creator && match?.mint) {
                try {
                  let handle_sig = await settleMatch(
                    match?.creator,
                    match?.mint,
                    opposite,
                    match?.index
                  );
                  if (handle_sig) {
                    const transaction = await connection.getSignatureStatus(
                      handle_sig
                    );
                    if (transaction.value?.confirmationStatus === "finalized") {
                      let matchStatus = await fetchMatchStatus(matchPda);
                      console.log("matchStatus ==> ", matchStatus);
                      if (matchStatus && matchStatus.isFinished) {
                        const updateResult = await MatchModel.findOneAndUpdate(
                          { matchPda },
                          {
                            finished: true,
                            result: matchStatus.result,
                            createdAt: Date.now() / 1000,
                          },
                          { update: true }
                        );
                        broadcast({
                          type: "MATCH_SETTLED",
                          data: {
                            _id: updateResult?._id,
                            result: matchStatus.result,
                            creator: updateResult?.creator,
                            selection: updateResult?.selection,
                            amount: updateResult?.amount,
                            decimal: updateResult?.decimal,
                            unit: updateResult?.unit,
                            opposite: updateResult?.opposite,
                          },
                        });
                        const winner =
                          updateResult?.result === updateResult?.selection
                            ? updateResult?.creator
                            : updateResult?.opposite;

                        const loser =
                          updateResult?.result !== updateResult?.selection
                            ? updateResult?.creator
                            : updateResult?.opposite;

                        const tweetContent = `
  🎲 ${
    (parseFloat(updateResult?.amount as string) /
      Math.pow(10, parseFloat(updateResult?.decimal as string))) *
    2
  } ${updateResult?.unit} FlipArena Result: 
  
  🎉 Winner: ${winner?.slice(0, 4)} ... ${winner?.slice(winner.length - 4, winner.length)}  
  ❌ Loser: ${loser?.slice(0, 4)} ... ${loser?.slice(loser.length - 4, loser.length)}
  🔍 Tx ID: https://solscan.io/tx/${handle_sig}
  
  @flipdotis
  `;
                        await postMatchResult(tweetContent);
                      } else {
                        throw new Error("Settling match error!");
                      }
                    }
                  }
                } catch (error) {
                  await MatchModel.findOneAndUpdate({ matchPda }, { err: true });

                  ws.send(
                    JSON.stringify({
                      type: "ERROR",
                      data: "Settling Match Error!",
                      matchPda,
                    })
                  );
                }
              }
            }
          }
          default:
            break;
        }
      } catch (error) {
        console.log("Error triggered when message on", error);
      }
    });

    ws.on("close", () => {
      console.log("websocket closed!");
      clients = clients.filter((client) => client.ws !== ws);
    });
  } catch (error) {
    console.log("Error triggered when socket!", error);
  }
});
