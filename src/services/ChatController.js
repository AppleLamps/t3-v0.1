// Chat Controller Service
// =======================
// Handles message sending, regeneration, and streaming logic.
// Extracted from main.js to reduce monolithic code and improve testability.

import { stateManager } from './state.js';
import { isImageGenerationModel } from '../config/models.js';

/**
 * Dynamic system prompt that injects current date/time context
 * @param {string} [projectInstructions] - Optional project-specific instructions to append
 * @returns {string} The system prompt with current context
 */
export const getSystemPrompt = (projectInstructions = '') => {
    let prompt = `You are a helpful, knowledgeable, and friendly AI assistant named LampChat. Your goal is to provide accurate, well-formatted, and contextually appropriate responses.

## CRITICAL FORMATTING RULE

When listing multiple items, you MUST use markdown bullet points with a dash (-) or asterisk (*) at the start of each line. Never list items on separate lines without bullet markers.

Example of CORRECT formatting:
- First item
- Second item
- Third item

Example of WRONG formatting (never do this):
First item
Second item
Third item

## Context
- **Current Date**: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- **Current Time**: ${new Date().toLocaleTimeString()}

## Response Formatting

### Code and Technical Content
- **ALWAYS** wrap code snippets in markdown code fences with the correct language identifier (e.g., \`\`\`javascript).
- **Never render raw HTML/CSS/JS**: Display it as code blocks.
- **Complete solutions**: When providing code, prioritize complete, runnable examples over partial snippets unless specifically asked for a modification.
- **File Names**: If providing multiple files, use a comment at the top of the code block to indicate the filename (e.g., \`// src/App.js\`).

### Visuals & Math
- **No LaTeX**: Do not use LaTeX formatting (like $$ or \\frac) as the frontend cannot render it. Use Unicode/Plain text for math (e.g., "x = (-b ± √(b² - 4ac)) / 2a").
- **Diagrams**: If a diagram is helpful, use Mermaid.js syntax inside a \`\`\`mermaid\`\`\` code block.

### Markdown Best Practices
- **Readability**: Keep paragraphs concise (3-4 lines max) to ensure readability on mobile devices.
- **Structure**: Use headers (##) and bullet points to break up text and improve scannability.
- **Emphasis**: Use **bold** for key concepts and *italics* for emphasis.
- **Lists**: Always use - or * for unordered lists, and 1. 2. 3. for ordered/sequential lists.

## Response Logic

### Analysis and Reasoning
- **Think Step-by-Step**: For complex logic or debugging, briefly outline your reasoning process before providing the final solution.
- **Safety**: If a request is unsafe or unethical, refuse politely and concisely without lecturing the user.

### Code Requests
- Provide complete, working examples.
- Include comments explaining complex logic.
- Suggest best practices or libraries when relevant.

## Communication Style

- Be concise but thorough - provide enough detail without being verbose
- Use clear, accessible language - avoid unnecessary jargon
- Be helpful and proactive - anticipate follow-up questions
- Admit uncertainty when appropriate - say "I'm not certain, but..." rather than guessing
- Be polite and professional in all interactions

## Special Considerations

- **Context awareness**: Reference previous messages in the conversation when relevant
- **Multimodal content**: When images or files are provided, describe and analyze them accurately
- **Safety**: Decline requests that could cause harm, violate privacy, or break laws
- **Accuracy**: If you're uncertain about facts, indicate this clearly
- **Updates**: Acknowledge if information might be outdated and suggest verification
`;

    // Append project-specific instructions if provided
    if (projectInstructions && projectInstructions.trim()) {
        prompt += `

## Project-Specific Instructions

${projectInstructions.trim()}
`;
    }

    return prompt;
};

/**
 * Chat controller - handles message operations
 */
export class ChatController {
    /**
     * @param {Object} options
     * @param {Object} options.openRouterService - OpenRouter service instance
     * @param {Object} options.chatArea - ChatArea component for typing indicator
     * @param {Object} options.settings - Settings component for opening settings
     */
    constructor({ openRouterService, chatArea, settings }) {
        this.openRouter = openRouterService;
        this.chatArea = chatArea;
        this.settings = settings;
    }

    /**
     * Update the OpenRouter service instance
     * @param {Object} service - New OpenRouter service
     */
    setOpenRouterService(service) {
        this.openRouter = service;
    }

    /**
     * Extract text content from multimodal content
     * @param {string|Array} content
     * @returns {string}
     */
    extractTextContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
        }
        return '';
    }

    /**
     * Get project context (instructions and files) for the current chat
     * @returns {{instructions: string, filesContext: string}|null}
     */
    _getProjectContext() {
        const chat = stateManager.currentChat;
        if (!chat?.projectId) return null;

        const project = stateManager.state.projects[chat.projectId];
        if (!project) return null;

        const instructions = project.instructions || '';

        // Build context from project files
        let filesContext = '';
        if (project.files && project.files.length > 0) {
            const textFiles = project.files.filter(f =>
                f.type?.startsWith('text/') ||
                f.name?.endsWith('.txt') ||
                f.name?.endsWith('.md') ||
                f.name?.endsWith('.json')
            );

            if (textFiles.length > 0) {
                filesContext = '## Project Knowledge Base\n\nThe following files have been provided as context:\n\n';
                for (const file of textFiles) {
                    try {
                        // Decode base64 data if present
                        let content = '';
                        if (file.data) {
                            // Handle data URL format
                            const base64Data = file.data.includes(',')
                                ? file.data.split(',')[1]
                                : file.data;
                            content = atob(base64Data);
                        }
                        filesContext += `### ${file.name}\n\`\`\`\n${content}\n\`\`\`\n\n`;
                    } catch (e) {
                        console.error('Failed to decode file:', file.name, e);
                    }
                }
            }
        }

        return { instructions, filesContext };
    }

    /**
     * Send a message
     * @param {string} message - The text message
     * @param {Array} attachments - File attachments
     */
    async sendMessage(message, attachments = []) {
        // Allow sending if there's a message OR attachments
        if (!message.trim() && attachments.length === 0) return;

        // Check for API key
        if (!this.openRouter.hasApiKey()) {
            alert('Please set your OpenRouter API key in Settings first.');
            this.settings.open();
            return;
        }

        const settings = stateManager.settings;
        const selectedModel = settings.selectedModel;
        const isImageGen = isImageGenerationModel(selectedModel);

        try {
            // Build user message content
            const userMessageData = {
                role: 'user',
                content: message,
                attachments: attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    mimeType: att.mimeType,
                    size: att.size,
                    dataUrl: att.dataUrl,
                })),
            };

            // Set streaming state (typing indicator will show after user message renders)
            stateManager.setStreaming(true);

            // Ensure we have a current chat before adding messages
            if (!stateManager.currentChat) {
                await stateManager.createChat();
            }

            // Add user message (network request happens while UI shows feedback)
            await stateManager.addMessage(userMessageData);

            // Add placeholder for assistant message
            const assistantMsg = await stateManager.addMessage({
                role: 'assistant',
                content: '',
            });

            // Get conversation history
            const chat = stateManager.currentChat;
            if (!chat) {
                throw new Error('Failed to create or access chat');
            }
            const messages = chat.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
                ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
            }));

            if (isImageGen) {
                // Hide typing indicator and show image generation shimmer instead
                this.chatArea.hideTypingIndicator();
                this.chatArea.showImageGenerationShimmer();
                await this._handleImageGeneration(message, selectedModel, assistantMsg.id);
            } else {
                await this._handleChatStream(messages, selectedModel, assistantMsg.id, attachments);
            }

        } catch (error) {
            console.error('Send message error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
            alert('Failed to send message: ' + error.message);
        }
    }

    /**
     * Regenerate a response
     * @param {string} messageId - The message ID to regenerate
     */
    async regenerateResponse(messageId) {
        if (stateManager.isStreaming) return;

        const chat = stateManager.currentChat;
        if (!chat) return;

        // Find the message index
        const msgIndex = chat.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // Get messages up to (but not including) this assistant message
        const messagesForContext = chat.messages.slice(0, msgIndex).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
            ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
        }));

        if (messagesForContext.length === 0) return;

        // Find the last user message before this assistant message to get its attachments
        const lastUserMsg = chat.messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
        const attachments = lastUserMsg?.attachments || [];

        try {
            stateManager.setStreaming(true);

            // Clear the existing message content
            await stateManager.updateMessage(messageId, { content: '', stats: null, generatedImages: null });

            const settings = stateManager.settings;
            const selectedModel = settings.selectedModel;
            const isImageGen = isImageGenerationModel(selectedModel);

            if (isImageGen) {
                // Show image generation shimmer for image models
                this.chatArea.showImageGenerationShimmer();
                // Get the original user message for image regeneration
                const userMessage = messagesForContext[messagesForContext.length - 1]?.content || '';
                await this._handleImageGeneration(userMessage, selectedModel, messageId);
            } else {
                // Show typing indicator for chat models
                this.chatArea.showTypingIndicator();
                await this._handleRegenerateStream(messagesForContext, selectedModel, messageId, attachments);
            }

        } catch (error) {
            console.error('Regenerate error:', error);
            this.chatArea.hideTypingIndicator();
            this.chatArea.hideImageGenerationShimmer();
            stateManager.setStreaming(false);
        }
    }

    /**
     * Handle image generation (non-streaming)
     * @private
     */
    async _handleImageGeneration(prompt, model, messageId) {
        try {
            const result = await this.openRouter.generateImage(prompt, model);

            this.chatArea.hideImageGenerationShimmer();
            stateManager.setStreaming(false);

            const updateData = {
                content: result.text || 'Image generated successfully.',
                stats: { model },
            };

            if (result.images && result.images.length > 0) {
                updateData.generatedImages = result.images;
            }

            await stateManager.updateMessage(messageId, updateData);
        } catch (error) {
            console.error('Image generation error:', error);
            this.chatArea.hideImageGenerationShimmer();
            stateManager.setStreaming(false);

            await stateManager.updateMessage(messageId, {
                content: `Error: ${error.message}`,
            });
        }
    }

    /**
     * Handle chat streaming for new messages
     * @private
     */
    async _handleChatStream(messages, model, messageId, attachments) {
        let streamedContent = '';

        // Get project context if applicable
        const projectContext = this._getProjectContext();
        const systemPrompt = getSystemPrompt(projectContext?.instructions || '');

        // Build messages array with system prompt
        const messagesWithSystem = [
            { role: 'system', content: systemPrompt },
        ];

        // Add project files context if available
        if (projectContext?.filesContext) {
            messagesWithSystem.push({
                role: 'system',
                content: projectContext.filesContext,
            });
        }

        messagesWithSystem.push(...messages);

        await this.openRouter.chatStream(
            model,
            messagesWithSystem,
            {
                onToken: (token) => {
                    streamedContent += token;
                    stateManager.updateStreamingMessage(messageId, streamedContent);
                },
                onComplete: async (fullContent, stats, extra) => {
                    this.chatArea.hideTypingIndicator();

                    const updateData = {
                        content: fullContent,
                        stats: {
                            model,
                            completionTokens: stats.completionTokens,
                            promptTokens: stats.promptTokens,
                            tokensPerSecond: stats.tokensPerSecond,
                            timeToFirstToken: stats.timeToFirstToken,
                        },
                    };

                    if (extra?.images && extra.images.length > 0) {
                        updateData.generatedImages = extra.images;
                    }

                    await stateManager.updateMessage(messageId, updateData);
                    stateManager.setStreaming(false);
                },
                onError: async (error) => {
                    console.error('Stream error:', error);
                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    await stateManager.updateMessage(messageId, {
                        content: `Error: ${error.message}`,
                    });
                },
            },
            {},
            attachments
        );
    }

    /**
     * Handle chat streaming for regeneration
     * @private
     */
    async _handleRegenerateStream(messages, model, messageId, attachments) {
        let streamedContent = '';

        // Get project context if applicable
        const projectContext = this._getProjectContext();
        const systemPrompt = getSystemPrompt(projectContext?.instructions || '');

        // Build messages array with system prompt
        const messagesWithSystem = [
            { role: 'system', content: systemPrompt },
        ];

        // Add project files context if available
        if (projectContext?.filesContext) {
            messagesWithSystem.push({
                role: 'system',
                content: projectContext.filesContext,
            });
        }

        messagesWithSystem.push(...messages);

        await this.openRouter.chatStream(
            model,
            messagesWithSystem,
            {
                onToken: (token) => {
                    streamedContent += token;
                    stateManager.updateStreamingMessage(messageId, streamedContent);
                },
                onComplete: async (fullContent, stats, extra) => {
                    this.chatArea.hideTypingIndicator();

                    const updateData = {
                        content: fullContent,
                        stats: {
                            model,
                            completionTokens: stats.completionTokens,
                            promptTokens: stats.promptTokens,
                            tokensPerSecond: stats.tokensPerSecond,
                            timeToFirstToken: stats.timeToFirstToken,
                        },
                    };

                    if (extra?.images && extra.images.length > 0) {
                        updateData.generatedImages = extra.images;
                    }

                    await stateManager.updateMessage(messageId, updateData);
                    stateManager.setStreaming(false);
                },
                onError: async (error) => {
                    console.error('Regenerate error:', error);
                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    await stateManager.updateMessage(messageId, {
                        content: `Error: ${error.message}`,
                    });
                },
            },
            {},
            attachments
        );
    }
}
