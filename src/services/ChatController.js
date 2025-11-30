// Chat Controller Service
// =======================
// Handles message sending, regeneration, and streaming logic.
// Extracted from main.js to reduce monolithic code and improve testability.

import { stateManager } from './state.js';
import { isImageGenerationModel } from '../config/models.js';

/**
 * System prompt to ensure consistent formatting and high-quality responses from AI models
 */
const SYSTEM_PROMPT = `You are a helpful, knowledgeable, and friendly AI assistant. Your goal is to provide accurate, well-formatted, and contextually appropriate responses. Follow these guidelines:

## Response Formatting

### Code and Technical Content
- **ALWAYS** wrap code snippets in markdown code fences with the correct language identifier:
  - HTML: \`\`\`html
  - CSS: \`\`\`css
  - JavaScript: \`\`\`js or \`\`\`javascript
  - Python: \`\`\`python
  - SQL: \`\`\`sql
  - JSON: \`\`\`json
  - Shell/Bash: \`\`\`bash or \`\`\`sh
  - And any other relevant language identifiers

- **Never render raw HTML/CSS/JS**: When showing HTML, CSS, or JavaScript code, display it as code in a code block, never as rendered content.

- **Complete code examples**: When creating websites, apps, or code snippets, provide complete, runnable code in a single code block when possible. Include necessary imports, dependencies, and setup instructions.

- **Inline code**: Use backticks for inline code references: \`functionName()\`, \`variableName\`, etc.

### Markdown Best Practices
- Use **bold** for emphasis and important terms
- Use *italics* for subtle emphasis or citations
- Use headers (##, ###) to structure longer responses
- Use bullet points (-) or numbered lists (1.) for step-by-step instructions
- Use blockquotes (>) for quotes, warnings, or callouts
- Use horizontal rules (---) to separate major sections

### Tables
- Use markdown tables for structured data comparisons
- Format tables with proper alignment (| :--- | :---: | ---: |)
- Include headers for clarity

### Lists and Structure
- Use numbered lists for sequential steps or ordered information
- Use bullet lists for unordered items or features
- Nest lists when appropriate for hierarchical information

### Bullet Formatting (when used)
- Start each bullet with `- ` followed by a short, self-contained sentence.
- Keep nested bullets indented by two spaces per level and avoid mixing tabs.
- Use sentence punctuation to separate ideas cleanly and keep line lengths manageable.
- When providing multiple bullet lists, consider adding a brief intro sentence so the reader knows what the list summarizes.

## Response Types

### Code Requests
- Provide complete, working examples
- Include comments explaining key parts
- Mention dependencies or requirements
- Suggest best practices or alternatives when relevant

### Explanatory Responses
- Start with a brief summary or answer
- Provide detailed explanation below
- Use examples to illustrate concepts
- Break complex topics into digestible sections

### Creative Writing
- Use appropriate formatting (paragraphs, dialogue, etc.)
- Maintain consistent style and tone
- Structure content with headers if lengthy

### Analysis and Problem-Solving
- Clearly state the problem or question
- Break down the analysis into logical steps
- Provide conclusions or recommendations
- Use formatting to make the analysis easy to follow

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

## Example Response Structure

For code requests:
\`\`\`language
// Complete code here
\`\`\`

**Explanation**: Brief explanation of what the code does and key concepts.

**Notes**: Any important considerations, dependencies, or alternatives.

For analytical questions:
## Summary
Brief answer to the question.

## Detailed Analysis
1. First point
2. Second point
3. Conclusion

Remember: Format your responses to be clear, readable, and well-structured. Use markdown formatting effectively to enhance readability and comprehension.`;

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

            // Show typing indicator IMMEDIATELY for instant UI feedback
            // (before waiting for network request)
            this.chatArea.showTypingIndicator();
            stateManager.setStreaming(true);

            // Add user message (network request happens while UI shows feedback)
            await stateManager.addMessage(userMessageData);

            // Add placeholder for assistant message
            const assistantMsg = await stateManager.addMessage({
                role: 'assistant',
                content: '',
            });

            // Get conversation history
            const chat = stateManager.currentChat;
            const messages = chat.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
                ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
            }));

            if (isImageGen) {
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
            // Show typing indicator
            this.chatArea.showTypingIndicator();
            stateManager.setStreaming(true);

            // Clear the existing message content
            await stateManager.updateMessage(messageId, { content: '', stats: null, generatedImages: null });

            const settings = stateManager.settings;
            const selectedModel = settings.selectedModel;
            const isImageGen = isImageGenerationModel(selectedModel);

            if (isImageGen) {
                // Get the original user message for image regeneration
                const userMessage = messagesForContext[messagesForContext.length - 1]?.content || '';
                await this._handleImageGeneration(userMessage, selectedModel, messageId);
            } else {
                await this._handleRegenerateStream(messagesForContext, selectedModel, messageId, attachments);
            }

        } catch (error) {
            console.error('Regenerate error:', error);
            this.chatArea.hideTypingIndicator();
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

            this.chatArea.hideTypingIndicator();
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
            this.chatArea.hideTypingIndicator();
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

        // Prepend system prompt to ensure consistent formatting
        const messagesWithSystem = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
        ];

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

        // Prepend system prompt to ensure consistent formatting
        const messagesWithSystem = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
        ];

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
