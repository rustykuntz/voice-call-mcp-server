import { WebSocket } from 'ws';

export const endCall = (ws: WebSocket, openAiWs: WebSocket): void => {
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        if (openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close();
        }
    }, 5000);
};
