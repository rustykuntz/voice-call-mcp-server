import { WebSocket } from 'ws';
import { CallState } from '../../types.js';
import { LOG_EVENT_TYPES, SHOW_TIMING_MATH } from '../../config/constants.js';

/**
 * Service for processing OpenAI events
 */
export class OpenAIEventService {
    private readonly callState: CallState;
    private readonly onEndCallTool: (callId: string | null, args: Record<string, unknown>) => void;
    private readonly onSendAudioToTwilio: (payload: string) => void;
    private readonly onTruncateResponse: () => void;

    /**
     * Create a new OpenAI event processor
     * @param callState The state of the call
     * @param onEndCallTool Callback for model end_call tool invocation
     * @param onSendAudioToTwilio Callback for sending audio to Twilio
     * @param onTruncateResponse Callback for truncating the response
     */
    constructor(
        callState: CallState,
        onEndCallTool: (callId: string | null, args: Record<string, unknown>) => void,
        onSendAudioToTwilio: (payload: string) => void,
        onTruncateResponse: () => void
    ) {
        this.callState = callState;
        this.onEndCallTool = onEndCallTool;
        this.onSendAudioToTwilio = onSendAudioToTwilio;
        this.onTruncateResponse = onTruncateResponse;
    }

    /**
     * Process an OpenAI message
     * @param data The message data
     */
    public processMessage(data: WebSocket.Data): void {
        try {
            const response = JSON.parse(data.toString());

            if (LOG_EVENT_TYPES.includes(response.type)) {
                // console.log(`Received event: ${response.type}`, response);
            }

            this.processEvent(response);
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    }

    /**
     * Process an OpenAI event
     * @param response The event data
     */
    private processEvent(response: any): void {
        switch (response.type) {
        case 'conversation.item.input_audio_transcription.completed':
            this.handleTranscriptionCompleted(response.transcript);
            break;
        case 'response.audio_transcript.done':
        case 'response.output_audio_transcript.done':
            this.handleAudioTranscriptDone(response.transcript);
            break;
        case 'response.audio.delta':
        case 'response.output_audio.delta':
            if (response.delta) {
                this.handleAudioDelta(response);
            }
            break;
        case 'response.output_item.done':
            this.handleOutputItemDone(response.item);
            break;
        case 'input_audio_buffer.speech_started':
            this.onTruncateResponse();
            break;
        }
    }

    /**
     * Handle a transcription completed event
     * @param transcription The transcription text
     */
    private handleTranscriptionCompleted(transcription: string): void {
        if (!transcription) {
            return;
        }

        this.callState.conversationHistory.push({
            role: 'user',
            content: transcription
        });
    }

    /**
     * Handle an audio transcript done event
     * @param transcript The transcript text
     */
    private handleAudioTranscriptDone(transcript: string): void {
        if (!transcript) {
            return;
        }

        this.callState.conversationHistory.push({
            role: 'assistant',
            content: transcript
        });
    }

    /**
     * Handle output item done event
     * @param item The output item
     */
    private handleOutputItemDone(item: any): void {
        if (!item || item.type !== 'function_call' || item.name !== 'end_call') {
            return;
        }

        const args = this.safeParseArgs(item.arguments);
        this.onEndCallTool(item.call_id || null, args);
    }

    /**
     * Parse tool-call arguments
     * @param rawArgs Tool arguments as JSON string
     */
    private safeParseArgs(rawArgs: unknown): Record<string, unknown> {
        if (typeof rawArgs !== 'string' || !rawArgs.trim()) {
            return {};
        }

        try {
            const parsed = JSON.parse(rawArgs);
            if (parsed && typeof parsed === 'object') {
                return parsed as Record<string, unknown>;
            }
            return {};
        } catch {
            return {};
        }
    }

    /**
     * Handle an audio delta event
     * @param response The event data
     */
    private handleAudioDelta(response: any): void {
        this.onSendAudioToTwilio(response.delta);

        if (!this.callState.responseStartTimestampTwilio) {
            this.callState.responseStartTimestampTwilio = this.callState.latestMediaTimestamp;
            if (SHOW_TIMING_MATH) {
                // console.log(`Setting start timestamp for new response: ${this.callState.responseStartTimestampTwilio}ms`);
            }
        }

        if (response.item_id) {
            this.callState.lastAssistantItemId = response.item_id;
        }
    }
}
