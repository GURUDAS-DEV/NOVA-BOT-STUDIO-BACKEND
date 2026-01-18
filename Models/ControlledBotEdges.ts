import { Schema, model, Types } from "mongoose";

const EdgeSchema = new Schema({
  botId: {
    type: Types.ObjectId,
    required: true,
    index: true
  },

  fromNodeId: {
    type: Types.ObjectId,
    required: true
  },

  toNodeId: {
    type: Types.ObjectId,
    required: true
  },

  /**
   * Intent emitted by user option
   * NOT dynamic data
   */
  intent: {
    type: String,
    required: true
  },

  order: {
    type: Number,
    required: true
  },

  createdAt: { type: Date, default: Date.now }
});

export const ControlledBotEdgeModel = model("Edge", EdgeSchema);
