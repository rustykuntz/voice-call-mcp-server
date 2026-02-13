import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TwilioCallService } from '../services/twilio/call.service.js';
import { callTracker } from '../services/call-tracker.js';

export class VoiceCallMcpServer {
    private server: McpServer;
    private twilioCallService: TwilioCallService;
    private twilioCallbackUrl: string;

    constructor(twilioCallService: TwilioCallService, twilioCallbackUrl: string) {
        this.twilioCallbackUrl = twilioCallbackUrl;
        this.twilioCallService = twilioCallService;

        this.server = new McpServer({
            name: 'Voice Call MCP Server',
            version: '1.0.0',
            description: 'MCP server that provides tools for initiating phone calls via Twilio'
        });

        this.registerTools();
        this.registerResources();
        this.registerPrompts();
    }

    private registerTools(): void {
        this.server.tool(
            'trigger-call',
            'Trigger an outbound phone call via Twilio. Blocks until the call completes and returns the full transcript.',
            {
                toNumber: z.string().describe('The phone number to call'),
                callContext: z.string().describe('Context for the call'),
                timeoutMs: z.number().optional().describe('Max wait time in ms (default 300000 = 5 min)')
            },
            async ({ toNumber, callContext, timeoutMs }) => {
                try {
                    const callSid = await this.twilioCallService.makeCall(this.twilioCallbackUrl, toNumber, callContext);
                    const transcript = await callTracker.waitForCall(callSid, timeoutMs || 300000);

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: 'completed',
                                callSid,
                                transcript
                            })
                        }]
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: 'error',
                                message: `Call failed: ${errorMessage}`
                            })
                        }],
                        isError: true
                    };
                }
            }
        );
    }

    private registerResources(): void {
        this.server.resource(
            'get-latest-call',
            new ResourceTemplate('call://transcriptions', { list: undefined }),
            async () => {
                const result = callTracker.getLastResult();
                return {
                    contents: [{
                        text: JSON.stringify(result
                            ? { callSid: result.callSid, transcript: result.transcript, status: 'completed' }
                            : { transcript: [], status: 'no_calls' }
                        ),
                        uri: 'call://transcriptions/latest',
                        mimeType: 'application/json'
                    }]
                };
            }
        );
    }

    private registerPrompts(): void {
        this.server.prompt(
            'make-restaurant-reservation',
            'Create a prompt for making a restaurant reservation by phone',
            {
                restaurantNumber: z.string().describe('The phone number of the restaurant'),
                peopleNumber: z.string().describe('The number of people in the party'),
                date: z.string().describe('Date of the reservation'),
                time: z.string().describe('Preferred time for the reservation')
            },
            ({ restaurantNumber, peopleNumber, date, time }) => {
                return {
                    messages: [{
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `You are calling a restaurant to book a table for ${peopleNumber} people on ${date} at ${time}. Call the restaurant at ${restaurantNumber} from ${process.env.TWILIO_NUMBER}.`
                        }
                    }]
                };
            }
        );
    }

    public async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}
