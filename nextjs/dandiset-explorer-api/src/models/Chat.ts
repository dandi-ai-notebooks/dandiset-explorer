import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  dandisetId: { type: String, required: true },
  dandisetVersion: { type: String, required: true },
  promptTokens: { type: Number, required: true },
  completionTokens: { type: Number, required: true },
  estimatedCost: { type: Number, required: true },
  messageMetadata: [{
    model: { type: String, required: true },
    timestamp: { type: Number, required: true }
  }],
  timestampCreated: { type: Number, required: true },
  timestampUpdated: { type: Number, required: true },
  chatUrl: { type: String, required: true }
});

export const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
