import { ConversationMessage } from '../types.js';

interface PendingCall {
    resolve: (transcript: ConversationMessage[]) => void;
    reject: (error: Error) => void;
}

class CallTrackerService {
    private pending = new Map<string, PendingCall>();
    private lastResult: { callSid: string; transcript: ConversationMessage[] } | null = null;

    waitForCall(callSid: string, timeoutMs = 300000): Promise<ConversationMessage[]> {
        return new Promise((resolve, reject) => {
            this.pending.set(callSid, { resolve, reject });
            const timer = setTimeout(() => {
                if (this.pending.has(callSid)) {
                    this.pending.delete(callSid);
                    reject(new Error(`Call ${callSid} timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);
            // Don't hold the process open just for this timer
            if (timer.unref) timer.unref();
        });
    }

    completeCall(callSid: string, transcript: ConversationMessage[]): void {
        this.lastResult = { callSid, transcript };
        const pending = this.pending.get(callSid);
        if (pending) {
            this.pending.delete(callSid);
            pending.resolve(transcript);
        }
    }

    getLastResult() {
        return this.lastResult;
    }
}

export const callTracker = new CallTrackerService();
