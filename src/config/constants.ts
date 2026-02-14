export const LOG_EVENT_TYPES = [
    'error',
    'session.created',
    'response.audio.delta',
    'response.output_audio.delta',
    'response.audio_transcript.done',
    'response.output_audio_transcript.done',
    'conversation.item.input_audio_transcription.completed',
    'response.output_item.done',
];

export const DYNAMIC_API_SECRET = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
export const SHOW_TIMING_MATH = false;
export const VOICE = 'sage';
export const RECORD_CALLS = process.env.RECORD === 'true';
export const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
export const OPENAI_TURN_DETECTION = process.env.OPENAI_TURN_DETECTION || 'semantic_vad';
