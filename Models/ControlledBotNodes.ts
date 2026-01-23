import { Schema, model, Types } from "mongoose";

const NodeSchema = new Schema({
  botId: {
    type: Types.ObjectId,
    required: true,
    index: true
  },

  title : {
    type : String,
    required : true
  },
  /**
   * What this node DOES
   */
  executor: {
    type: String,
    enum: ["none", "api", "input", "end"],
    required: true
  },

  /**
   * Message shown BEFORE execution
   */
  message: {
    type: String,
    required: true
  },

  /**
   * INPUT EXECUTOR CONFIG
   * Used only when executor === "input"
   */
  inputConfig: {
    key: { type: String },                 // e.g. "orderId"
    validationRegex: { type: String },     // optional validation
    retryLimit: { type: Number },           // max retries
    nextNodeId: { type: Types.ObjectId }    // REQUIRED: deterministic routing
  },

  /**
   * API EXECUTOR CONFIG
   * Used only when executor === "api"
   */
  apiConfig: {
    endpointKey: { type: String },
    method: {
      type: String,
      enum: ["GET", "POST"]
    },
    timeoutMs: { type: Number },
    nextNodeId: { type: Types.ObjectId, required: false },
    queryParameter : {
      type: Map,
      of: String
    },

    /**
     * Save API result in session (Redis)
     */
    saveResponseAs: { type: String },

    /**
     * Whether API response goes through LLM
     * (LLM only formats/sanitizes, NEVER routes)
     */
    useLLMSanitizer: { type: Boolean, default: false }
  },

  /**
   * OUTPUT CONFIG
   * What user sees AFTER node execution
   */
  output: {
    mode: {
      type: String,
      enum: ["text", "options", "text_and_options"],
      required: true
    },

    optionCount: {
      type: Number,
      min: 0,
      max: 5,
      required: true
    },

    allowGoBack: { type: Boolean, required: true },
    allowEnd: { type: Boolean, required: true },

    /**
     * Custom text to display when executor is "none" and mode is "text"
     */
    customText: { type: String }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ControlledBotNodeModel = model("Node", NodeSchema);
