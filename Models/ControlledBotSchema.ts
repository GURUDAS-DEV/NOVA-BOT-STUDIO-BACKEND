import { Schema, model, Types } from "mongoose";

const BotSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: Types.ObjectId, required: true },

  type: {
    type: String,
    enum: ["FREESTYLE", "CONTROLLED"],
    required: true
  },

  entryNodeId: {
    type: Types.ObjectId,
    required: true
  },

  status: {
    type: String,
    enum: ["draft", "active", "paused", "deleted", 'inactive'],
    default: "draft"
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ControlledBotModel = model("ControlledBotStructure", BotSchema);
