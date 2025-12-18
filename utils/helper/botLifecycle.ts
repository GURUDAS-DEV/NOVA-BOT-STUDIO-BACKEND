type botState = "draft" | "active" | "paused" | "deleted";

const Transistion : Record<botState, botState[]> = {
    draft: ["active", "deleted"],
    active: ["paused", "deleted"],
    paused: ["active", "deleted"],
    deleted: ["draft", "paused"]
};

export const transistionBotLifecycle = (currentStatus: botState, convertedTo: botState) : botState => {
    if(!Transistion[currentStatus].includes(convertedTo)) {
        throw new Error(`Invalid state transition from ${currentStatus} to ${convertedTo}`);
    }
    return convertedTo;
}