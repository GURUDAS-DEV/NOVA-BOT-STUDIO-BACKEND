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
   * What user clicks (label / intent)
   * STATIC only — never dynamic
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
