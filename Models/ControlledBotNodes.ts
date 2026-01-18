import { Schema, model, Types } from "mongoose";

const NodeSchema = new Schema({
  botId: {
    type: Types.ObjectId,
    required: true,
    index: true
  },

  type: {
    type: String,
    enum: ["static", "api", "llm", "end"],
    required: true
  },

  message: {
    type: String,
    required: true
  },

  /**
   * OUTPUT CONFIG
   * Controls what user sees AFTER this node runs
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
    allowEnd: { type: Boolean, required: true }
  },

  /**
   * API EXECUTOR CONFIG
   * Used ONLY when type === "API"
   */
  apiConfig: {
    endpointKey: { type: String, required: false },
    method: {
      type: String,
      enum: ["get"],
      required: false
    },
    timeoutMs: { type: Number, required: false },

    /**
     * Where API response is stored in session (Redis)
     */
    saveResponseAs: { type: String, required: false },

    /**
     * Whether API response should be sent to LLM
     */
    useLLMSanitizer: { type: Boolean, required: false }
  },

  /**
   * LLM CONFIG
   * Used when:
   * - type === "LLM"
   * - OR apiConfig.useLLMSanitizer === true
   */
  llmConfig: {
    systemPrompt: { type: String, required: false },
    temperature: { type: Number, required: false },
    maxTokens: { type: Number, required: false }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const ControlledBotNodeModel = model("Node", NodeSchema);
