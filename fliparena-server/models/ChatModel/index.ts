import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema({
  message: {
    type: String,
    require: true,
  },
  wallet: {
    type: String,
    require: true,
  },
  createdAt: {
    type: Number,
  },
});

const ChatModel = mongoose.model("arena_chat", ChatSchema);

export default ChatModel;
