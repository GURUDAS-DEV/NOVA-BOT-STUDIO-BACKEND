import { Schema, model, Types } from "mongoose";

const BotSchema = new Schema({
  name: { type: String, required: true },
  userId: { type: String, required: true },

  type: {
    type: String,
    enum: ["CONTROLLED"],
    required: true
  },
  platform : {
    type: String,
    enum: ['WhatsApp', 'Telegram', 'Discord', 'Instagram', 'Website'],
    required: true,
    default : 'Website'
  },

  entryNodeId: {
    type: Types.ObjectId,
    required: false,
    default: null
  },

  status: {
    type: String,
    enum: ["draft", "active", "paused", "inactive", "deleted"],
    default: "draft"
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date , default: null },
});

export const ControlledBotModel = model("ControlledBot", BotSchema);
