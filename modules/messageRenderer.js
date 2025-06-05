// modules/messageRenderer.js

// --- Enhanced Rendering Constants ---
const ENHANCED_RENDER_DEBOUNCE_DELAY = 400; // ms, for general blocks during streaming
const DIARY_RENDER_DEBOUNCE_DELAY = 1000; // ms, potentially longer for diary if complex
const enhancedRenderDebounceTimers = new WeakMap(); // For debouncing prettify calls

// Cache for dominant avatar colors
const avatarColorCache = new Map();

// --- Enhanced Rendering Styles (from UserScript) ---
function injectEnhancedStyles() {
    const css = `
            /* Keyframes for animations */
            @keyframes vcp-bubble-background-flow-kf {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            @keyframes vcp-bubble-border-flow-kf {
                0% { background-position: 0% 50%; }
                50% { background-position: 200% 50%; } /* Adjusted for more color travel */
                100% { background-position: 0% 50%; }
            }

            @keyframes vcp-icon-rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes vcp-icon-heartbeat {
                0% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.15); opacity: 0.9; }
                100% { transform: scale(1); opacity: 0.6; }
            }

            @keyframes vcp-toolname-color-flow-kf {
                0% { background-position: 0% 50%; }
                50% { background-position: 150% 50%; } /* Adjusted for smoother flow with 300% background-size */
                100% { background-position: 0% 50%; }
            }

            /* Loading dots animation */
            @keyframes vcp-loading-dots {
              0%, 20% {
                color: rgba(0,0,0,0);
                text-shadow:
                  .25em 0 0 rgba(0,0,0,0),
                  .5em 0 0 rgba(0,0,0,0);
              }
              40% {
                color: currentColor; /* Or a specific color */
                text-shadow:
                  .25em 0 0 rgba(0,0,0,0),
                  .5em 0 0 rgba(0,0,0,0);
              }
              60% {
                text-shadow:
                  .25em 0 0 currentColor, /* Or a specific color */
                  .5em 0 0 rgba(0,0,0,0);
              }
              80%, 100% {
                text-shadow:
                  .25em 0 0 currentColor, /* Or a specific color */
                  .5em 0 0 currentColor; /* Or a specific color */
              }
            }

            .thinking-indicator-dots {
              display: inline-block;
              font-size: 1em; /* Match parent font-size by default */
              line-height: 1; /* Ensure it doesn't add extra height */
              vertical-align: baseline; /* Align with the text */
              animation: vcp-loading-dots 1.4s infinite;
            }

            /* 主气泡样式 - VCP ToolUse */
            .vcp-tool-use-bubble {
                background: linear-gradient(145deg, #3a7bd5 0%, #00d2ff 100%) !important;
                background-size: 200% 200% !important; 
                animation: vcp-bubble-background-flow-kf 20s ease-in-out infinite;
                border-radius: 10px !important;
                padding: 8px 15px 8px 35px !important; 
                color: #ffffff !important;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                margin-bottom: 10px !important;
                position: relative;
                overflow: hidden; 
                line-height: 1.5;
                display: inline-block !important; /* Allow bubble to shrink to content width */
            }

            /* Animated Border for VCP ToolUse */
            .vcp-tool-use-bubble::after {
                content: "";
                position: absolute;
                box-sizing: border-box; 
                top: 0; left: 0; width: 100%; height: 100%;
                border-radius: inherit;
                padding: 2px; /* Border thickness */
                background: linear-gradient(60deg, #76c4f7, #00d2ff, #3a7bd5, #ffffff, #3a7bd5, #00d2ff, #76c4f7);
                background-size: 300% 300%;
                animation: vcp-bubble-border-flow-kf 7s linear infinite;
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                z-index: 0; 
                pointer-events: none;
            }


            /* 内部 code 和 span 的重置 - VCP ToolUse */
            .vcp-tool-use-bubble code,
            .vcp-tool-use-bubble code span,
            .vcp-tool-use-bubble .vcp-tool-label, 
            .vcp-tool-use-bubble .vcp-tool-name-highlight 
             {
                background: none !important; border: none !important;
                padding: 0 !important; margin: 0 !important;
                box-shadow: none !important; color: inherit !important;
                display: inline !important;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
                font-size: 0.95em !important;
                vertical-align: baseline;
                position: relative; 
                z-index: 1;
            }

            /* "VCP-ToolUse:" 标签 */
            .vcp-tool-use-bubble .vcp-tool-label {
                font-weight: bold; color: #f1c40f; margin-right: 6px;
            }

            /* 工具名高亮 - VCP ToolUse */
            .vcp-tool-use-bubble .vcp-tool-name-highlight {
                background: linear-gradient(90deg, #f1c40f, #ffffff, #00d2ff, #f1c40f) !important; 
                background-size: 300% 100% !important; 
                -webkit-background-clip: text !important;
                background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                text-fill-color: transparent !important;
                font-style: normal !important;
                font-weight: bold !important;
                padding: 1px 3px !important; 
                border-radius: 4px !important;
                animation: vcp-toolname-color-flow-kf 4s linear infinite; 
                margin-left: 2px; 
            }

            /* 左上角齿轮图标 - VCP ToolUse */
            .vcp-tool-use-bubble::before {
                content: "⚙️";
                position: absolute;
                top: 8px;
                left: 10px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.75); 
                z-index: 2; 
                animation: vcp-icon-rotate 4s linear infinite;
                transform-origin: center center; 
            }

            /* 隐藏 VCP 气泡内的复制按钮 */
            .vcp-tool-use-bubble code .code-copy { /* This might target <code> inside <pre class="vcp-tool-use-bubble"> */
                display: none !important;
            }
             /* Also hide if copy button is direct child of the bubble (if no inner code element) */
            .vcp-tool-use-bubble > .code-copy {
                display: none !important;
            }
            .vcp-tool-request-bubble > strong { display: none !important; } /* Hide "VCP工具调用:" strong tag if it was ever added */


            /* 女仆日记气泡样式 */
            .maid-diary-bubble {
                background: linear-gradient(145deg, #fdeff2 0%, #fce4ec 100%) !important; 
                background-size: 200% 200% !important; 
                animation: vcp-bubble-background-flow-kf 14s ease-in-out infinite; 
                border-radius: 10px !important;
                padding: 8px 15px 8px 35px !important; 
                color: #5d4037 !important; 
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
                margin-bottom: 10px !important;
                position: relative;
                overflow: hidden; /* Keep for safety, though wrapping should prevent overflow */
                line-height: 1.5;
                /* Styles for the <pre> tag itself to ensure wrapping */
                display: block; /* Or inline-block if shrink-to-fit is desired */
                white-space: normal !important; /* Crucial: Override <pre> default */
                word-break: break-word !important; /* Crucial: Allow long words to break */
                font-family: 'Georgia', 'Times New Roman', serif !important; /* Match inner content font */
            }

            /* Animated Border for Maid Diary */
            .maid-diary-bubble::after {
                content: "";
                position: absolute;
                box-sizing: border-box; 
                top: 0; left: 0; width: 100%; height: 100%;
                border-radius: inherit;
                padding: 2px; /* Border thickness */
                background: linear-gradient(60deg, #f8bbd0, #fce4ec, #e91e63, #ffffff, #e91e63, #fce4ec, #f8bbd0);
                background-size: 300% 300%;
                animation: vcp-bubble-border-flow-kf 20s linear infinite; 
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                z-index: 0; 
                pointer-events: none;
            }

            /* 女仆日记气泡内部 code 和 span 的重置 */
            .maid-diary-bubble code, /* If there's an inner <code> */
            .maid-diary-bubble code span,
            .maid-diary-bubble .maid-label 
            {
                background: none !important; border: none !important;
                padding: 0 !important; margin: 0 !important;
                box-shadow: none !important; color: inherit !important;
                display: block !important; /* Changed for proper wrapping */
                white-space: normal !important; /* Allow text to wrap normally */
                word-break: break-word !important; /* Break words if they are too long */
                font-family: 'Georgia', 'Times New Roman', serif !important; 
                font-size: 0.98em !important;
                vertical-align: baseline;
                position: relative; 
                z-index: 1;
            }
             .maid-diary-bubble .maid-label {
                display: block !important; 
                margin-bottom: 5px !important; 
            }


            /* 女仆日记气泡 "Maid" 标签 */
            .maid-diary-bubble .maid-label {
                font-weight: bold; color: #c2185b; margin-right: 6px; 
                font-family: 'Georgia', 'Times New Roman', serif !important; 
            }

            /* 女仆日记气泡左上角图标 */
            .maid-diary-bubble::before {
                content: "🎀"; 
                position: absolute;
                top: 8px;
                left: 10px;
                font-size: 16px;
                color: rgba(227, 96, 140, 0.85); 
                z-index: 2; 
                animation: vcp-icon-heartbeat 2.5s ease-in-out infinite;
                transform-origin: center center; 
            }

            /* 隐藏女仆日记气泡内的复制按钮 */
            .maid-diary-bubble code .code-copy { /* If copy is inside <code> */
                display: none !important;
            }
            .maid-diary-bubble > .code-copy { /* If copy is direct child of <pre> */
                 display: none !important;
            }

            /* HTML5 音频播放器样式 */
            audio[controls] {
                background: linear-gradient(145deg, #3a7bd5 0%, #00d2ff 100%) !important;
                border: 1px solid #2980b9 !important;
                border-radius: 10px !important;
                padding: 10px 15px !important;
                color: #ffffff !important;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
                margin-bottom: 10px !important;
                display: block;
                width: 350px;
            }
            audio[controls]::-webkit-media-controls-panel {
                background: #ffffff !important;
                border-radius: 9px !important;
                margin: 5px !important;
                padding: 5px !important;
                box-sizing: border-box !important;
            }
            audio[controls]::-webkit-media-controls-play-button,
            audio[controls]::-webkit-media-controls-mute-button,
            audio[controls]::-webkit-media-controls-fullscreen-button,
            audio[controls]::-webkit-media-controls-overflow-button {
                filter: brightness(0.3) contrast(1.5) !important;
            }
            audio[controls]::-webkit-media-controls-current-time-display,
            audio[controls]::-webkit-media-controls-time-remaining-display {
                color: #181818 !important;
                text-shadow: none !important;
            }
            audio[controls]::-webkit-media-controls-timeline {
                background-color:rgb(255, 255, 255) !important;
                border-radius: 4px !important;
                height: 6px !important;
                margin: 0 5px !important;
            }
            audio[controls]::-webkit-media-controls-timeline::-webkit-slider-thumb {
                background-color: #555555 !important;
                border: 1px solid rgba(0, 0, 0, 0.3) !important;
                box-shadow: 0 0 2px rgba(0,0,0,0.3) !important;
                height: 12px !important;
                width: 12px !important;
                border-radius: 50% !important;
            }
            audio[controls]::-webkit-media-controls-timeline::-moz-range-thumb {
                background-color: #555555 !important;
                border: 1px solid rgba(0, 0, 0, 0.3) !important;
                height: 12px !important;
                width: 12px !important;
                border-radius: 50% !important;
            }
            audio[controls]::-webkit-media-controls-timeline::-moz-range-track {
                background-color:rgb(255, 255, 255) !important;
                border-radius: 4px !important;
                height: 6px !important;
            }
            audio[controls]::-webkit-media-controls-volume-slider {
                background-color:rgb(255, 255, 255) !important;
                border-radius: 3px !important;
                height: 4px !important;
                margin: 0 5px !important;
            }
            audio[controls]::-webkit-media-controls-volume-slider::-webkit-slider-thumb {
                background-color: #555555 !important;
                border: 1px solid rgba(0,0,0,0.3) !important;
                height: 10px !important;
                width: 10px !important;
                border-radius: 50% !important;
            }
    `;
    try {
        const existingStyleElement = document.getElementById('vcp-enhanced-ui-styles');
        if (existingStyleElement) {
            existingStyleElement.textContent = css; 
        } else {
            const styleElement = document.createElement('style');
            styleElement.id = 'vcp-enhanced-ui-styles';
            styleElement.textContent = css;
            document.head.appendChild(styleElement);
        }
        console.log('VCPSub Enhanced UI: Styles injected/updated.');
    } catch (error) {
        console.error('VCPSub Enhanced UI: Failed to inject styles:', error);
    }
}

// --- Enhanced Rendering Core Logic ---

/**
 * Ensures that triple backticks for code blocks are followed by a newline.
 * @param {string} text The input string.
 * @returns {string} The processed string with newlines after ``` if they were missing.
 */
function ensureNewlineAfterCodeBlock(text) {
    if (typeof text !== 'string') return text;
    // Replace ``` (possibly with leading spaces) not followed by \n or \r\n with the same ``` (and spaces) followed by \n
    return text.replace(/^(\s*```)(?![\r\n])/gm, '$1\n');
}

/**
 * Ensures that a tilde (~) is followed by a space.
 * @param {string} text The input string.
 * @returns {string} The processed string with spaces after tildes where they were missing.
 */
function ensureSpaceAfterTilde(text) {
    if (typeof text !== 'string') return text;
    // Replace ~ not followed by a space with ~ followed by a space
    return text.replace(/~(?![\s~])/g, '~ ');
}

/**
 * Removes leading whitespace from lines starting with ``` (code block markers).
 * @param {string} text The input string.
 * @returns {string} The processed string.
 */
function removeIndentationFromCodeBlockMarkers(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/^(\s*)(```.*)/gm, '$2');
}

/**
 * Parses VCP tool_name from content.
 * Example: tool_name:「始」SciCalculator「末」
 * @param {string} toolContent - The raw string content of the tool request (text between <<<TOOL_REQUEST>>> and <<<END_TOOL_REQUEST>>>).
 * @returns {string|null} The extracted tool name or null.
 */
function extractVcpToolName(toolContent) {
    const match = toolContent.match(/tool_name:\s*「始」([^「」]+)「末」/);
    return match ? match[1] : null;
}

/**
 * Prettifies a single <pre> code block for DailyNote or VCP ToolUse.
 * @param {HTMLElement} preElement - The <pre> element to prettify.
 * @param {'dailynote' | 'vcptool'} type - The type of block.
 * @param {string} relevantContent - For VCP, it's the text between tool markers. For DailyNote, it's text between diary markers.
 */
function prettifySinglePreElement(preElement, type, relevantContent) {
    if (!preElement || preElement.dataset.vcpPrettified === "true" || preElement.dataset.maidDiaryPrettified === "true") {
        return;
    }

    let targetContentElement = preElement.querySelector('code') || preElement; 

    const copyButton = targetContentElement.querySelector('.code-copy, .fa-copy');
    if (copyButton) {
        copyButton.remove(); // Remove existing copy button
    }
    
    if (type === 'vcptool') {
        preElement.classList.add('vcp-tool-use-bubble');
        const toolName = extractVcpToolName(relevantContent); 

        let newInnerHtml = `<span class="vcp-tool-label">ToolUse:</span>`;
        if (toolName) {
            newInnerHtml += `<span class="vcp-tool-name-highlight">${toolName}</span>`;
        } else {
            newInnerHtml += `<span class="vcp-tool-name-highlight">UnknownTool</span>`; 
        }
        
        targetContentElement.innerHTML = newInnerHtml; 
        preElement.dataset.vcpPrettified = "true";

    } else if (type === 'dailynote') {
        preElement.classList.add('maid-diary-bubble');
        let actualNoteContent = relevantContent.trim(); 
        
        let finalHtml = "";
        const lines = actualNoteContent.split('\n');
        const firstLineTrimmed = lines[0] ? lines[0].trim() : "";

        if (firstLineTrimmed.startsWith('Maid:')) {
            finalHtml = `<span class="maid-label">${lines.shift().trim()}</span>`;
            finalHtml += lines.join('\n');
        } else if (firstLineTrimmed.startsWith('Maid')) { 
            finalHtml = `<span class="maid-label">${lines.shift().trim()}</span>`;
            finalHtml += lines.join('\n');
        } else {
            finalHtml = actualNoteContent; 
        }
        
        targetContentElement.innerHTML = finalHtml.replace(/\n/g, '<br>');
        preElement.dataset.maidDiaryPrettified = "true";
    }
}


/**
 * Processes all relevant <pre> blocks within a message's contentDiv AFTER marked.parse().
 * @param {HTMLElement} contentDiv - The div containing the parsed Markdown.
 */
function processAllPreBlocksInContentDiv(contentDiv) {
    if (!contentDiv) return;

    const allPreElements = contentDiv.querySelectorAll('pre');
    allPreElements.forEach(preElement => {
        if (preElement.dataset.vcpPrettified === "true" || preElement.dataset.maidDiaryPrettified === "true") {
            return; // Already processed
        }

        const codeElement = preElement.querySelector('code'); 
        const blockText = codeElement ? (codeElement.textContent || "") : (preElement.textContent || "");

        // Check for VCP Tool Request
        if (blockText.includes('<<<[TOOL_REQUEST]>>>') && blockText.includes('<<<[END_TOOL_REQUEST]>>>')) {
            const vcpContentMatch = blockText.match(/<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/);
            const actualVcpText = vcpContentMatch ? vcpContentMatch[1].trim() : ""; 
            prettifySinglePreElement(preElement, 'vcptool', actualVcpText);
        } 
        // Check for DailyNote (ensure it's not already processed as VCP)
        else if (blockText.includes('<<<DailyNoteStart>>>') && blockText.includes('<<<DailyNoteEnd>>>') && !preElement.dataset.vcpPrettified) {
            const dailyNoteContentMatch = blockText.match(/<<<DailyNoteStart>>>([\s\S]*?)<<<DailyNoteEnd>>>/); // Corrected closing tag <<<DailyNoteEnd>>>
            const actualDailyNoteText = dailyNoteContentMatch ? dailyNoteContentMatch[1].trim() : ""; 
            prettifySinglePreElement(preElement, 'dailynote', actualDailyNoteText);
        }
    });
}

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 * @property {number} timestamp
 * @property {string} [id] 
 * @property {boolean} [isThinking]
 * @property {Array<{type: string, src: string, name: string}>} [attachments]
 * @property {string} [finishReason] 
 */

/**
 * @typedef {Object} GlobalSettings
 * @property {string} [userName]
 * @property {string} vcpServerUrl
 * @property {string} vcpApiKey
 * @property {string} [userAvatarUrl] // Added for user avatar
 */

/**
 * @typedef {Object} AgentConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [systemPrompt]
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [maxOutputTokens]
 * @property {string} [topicTitle] 
 * @property {Array<Object>} [topics] 
 */

let mainRendererReferences = {
    currentChatHistory: [],
    currentAgentId: null,
    currentTopicId: null, 
    currentAgentAvatarUrl: 'assets/default_avatar.png',
    currentUserAvatarUrl: 'assets/default_user_avatar.png', // Added for user avatar
    globalSettings: {},
    chatMessagesDiv: null,
    electronAPI: null,
    markedInstance: null,
    scrollToBottom: () => {},
    summarizeTopicFromMessages: async () => "",
    openModal: () => {},
    openImagePreviewModal: () => {}, 
    autoResizeTextarea: () => {},
    handleCreateBranch: () => {},
    activeStreamingMessageId: null,
};

function initializeMessageRenderer(refs) {
    mainRendererReferences.currentChatHistory = refs.currentChatHistory;
    mainRendererReferences.currentAgentId = refs.currentAgentId;
    mainRendererReferences.currentTopicId = refs.currentTopicId;
    mainRendererReferences.globalSettings = refs.globalSettings;
    mainRendererReferences.chatMessagesDiv = refs.chatMessagesDiv;
    mainRendererReferences.electronAPI = refs.electronAPI;
    mainRendererReferences.markedInstance = refs.markedInstance;
    mainRendererReferences.scrollToBottom = refs.scrollToBottom;
    mainRendererReferences.summarizeTopicFromMessages = refs.summarizeTopicFromMessages;
    mainRendererReferences.openModal = refs.openModal;
    mainRendererReferences.openImagePreviewModal = refs.openImagePreviewModal; 
    mainRendererReferences.autoResizeTextarea = refs.autoResizeTextarea;
    mainRendererReferences.handleCreateBranch = refs.handleCreateBranch;
    if (refs.currentAgentAvatarUrl) {
        mainRendererReferences.currentAgentAvatarUrl = refs.currentAgentAvatarUrl;
    }
    if (refs.globalSettings && refs.globalSettings.userAvatarUrl) { // Initialize user avatar from global settings
        mainRendererReferences.currentUserAvatarUrl = refs.globalSettings.userAvatarUrl;
    }
    injectEnhancedStyles();
}

function setCurrentAgentId(agentId) {
    mainRendererReferences.currentAgentId = agentId;
}

function setCurrentTopicId(topicId) { 
    mainRendererReferences.currentTopicId = topicId;
}

function setCurrentAgentAvatar(avatarUrl) {
    mainRendererReferences.currentAgentAvatarUrl = avatarUrl || 'assets/default_avatar.png';
}

function setUserAvatar(avatarUrl) { // New function to update user avatar
    mainRendererReferences.currentUserAvatarUrl = avatarUrl || 'assets/default_user_avatar.png';
}


function renderMessage(message, isInitialLoad = false) {
    const { chatMessagesDiv, globalSettings, currentAgentId, currentTopicId, currentAgentAvatarUrl, currentUserAvatarUrl, electronAPI, markedInstance, scrollToBottom } = mainRendererReferences;
    if (!chatMessagesDiv || !electronAPI || !markedInstance) {
        console.error("MessageRenderer: Missing critical references.");
        return null;
    }

    if (!message.id) {
        message.id = `msg_${message.timestamp}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item', message.role);
    messageItem.dataset.timestamp = String(message.timestamp);
    messageItem.dataset.messageId = message.id;

    if (message.role !== 'system' && !message.isThinking) {
        messageItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, messageItem, message);
        });
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('md-content');

    if (message.isThinking) {
        contentDiv.innerHTML = `<span class="thinking-indicator">${message.content || '思考中'}<span class="thinking-indicator-dots">...</span></span>`;
        messageItem.classList.add('thinking');
    } else {
        let processedContent = ensureNewlineAfterCodeBlock(message.content);
        processedContent = ensureSpaceAfterTilde(processedContent);
        processedContent = removeIndentationFromCodeBlockMarkers(processedContent);
        contentDiv.innerHTML = markedInstance.parse(processedContent);
        processAllPreBlocksInContentDiv(contentDiv);

        const imagesInContent = contentDiv.querySelectorAll('img');
        imagesInContent.forEach(img => {
            if (!img.classList.contains('message-attachment-image-thumbnail')) {
                img.style.cursor = 'pointer';
                img.title = `点击在新窗口预览: ${img.alt || img.src}\n右键可复制图片`;
                img.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    mainRendererReferences.electronAPI.openImageInNewWindow(img.src, img.alt || img.src.split('/').pop() || 'AI 图片');
                });
                img.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    mainRendererReferences.electronAPI.showImageContextMenu(img.src);
                });
            }
        });
    }
    
    // --- New structure for QQ-like appearance ---
    if (message.role === 'user' || message.role === 'assistant') {
        const avatarImg = document.createElement('img');
        avatarImg.classList.add('chat-avatar');
        if (message.role === 'user') {
            avatarImg.src = currentUserAvatarUrl;
            avatarImg.alt = (globalSettings.userName || 'User') + ' Avatar';
            avatarImg.onerror = () => { avatarImg.src = 'assets/default_user_avatar.png'; }; // Fallback
        } else { // assistant
            avatarImg.src = currentAgentAvatarUrl;
            const agentNameElem = document.querySelector(`.agent-list li[data-agent-id="${currentAgentId}"] .agent-name`);
            avatarImg.alt = (agentNameElem?.textContent || 'AI') + ' Avatar';
            avatarImg.onerror = () => { avatarImg.src = 'assets/default_avatar.png'; };
        }

        const nameTimeDiv = document.createElement('div');
        nameTimeDiv.classList.add('name-time-block');
        const senderNameDiv = document.createElement('div');
        senderNameDiv.classList.add('sender-name');
        if (message.role === 'user') {
            senderNameDiv.textContent = globalSettings.userName || '你';
        } else { // assistant
            const agentNameElem = document.querySelector(`.agent-list li[data-agent-id="${currentAgentId}"] .agent-name`);
            senderNameDiv.textContent = agentNameElem?.textContent || 'AI';
        }
        nameTimeDiv.appendChild(senderNameDiv);

        if (message.timestamp && !message.isThinking) {
            const timestampDiv = document.createElement('div');
            timestampDiv.classList.add('message-timestamp');
            timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            nameTimeDiv.appendChild(timestampDiv);
        }
        
        const detailsAndBubbleWrapper = document.createElement('div');
        detailsAndBubbleWrapper.classList.add('details-and-bubble-wrapper');
        detailsAndBubbleWrapper.appendChild(nameTimeDiv);
        detailsAndBubbleWrapper.appendChild(contentDiv);

        messageItem.appendChild(avatarImg);
        messageItem.appendChild(detailsAndBubbleWrapper);

    } else { // system messages (keep simpler layout or specific styling)
        messageItem.appendChild(contentDiv); // Just content for system
        messageItem.classList.add('system-message-layout');
    }

    if (message.attachments && message.attachments.length > 0) {
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.classList.add('message-attachments');
        message.attachments.forEach(att => {
            let attachmentElement;
            if (att.type.startsWith('image/')) {
                attachmentElement = document.createElement('img');
                attachmentElement.src = att.src; 
                attachmentElement.alt = `附件图片: ${att.name}`;
                attachmentElement.title = `点击在新窗口预览: ${att.name}`;
                attachmentElement.classList.add('message-attachment-image-thumbnail');
                attachmentElement.onclick = (e) => {
                    e.stopPropagation();
                    mainRendererReferences.electronAPI.openImageInNewWindow(att.src, att.name);
                };
            } else if (att.type.startsWith('audio/')) {
                attachmentElement = document.createElement('audio');
                attachmentElement.src = att.src;
                attachmentElement.controls = true;
            } else if (att.type.startsWith('video/')) {
                attachmentElement = document.createElement('video');
                attachmentElement.src = att.src;
                attachmentElement.controls = true;
                attachmentElement.style.maxWidth = '300px';
            } else {
                attachmentElement = document.createElement('a');
                attachmentElement.href = att.src;
                attachmentElement.textContent = `📄 ${att.name}`;
                attachmentElement.target = '_blank';
                attachmentElement.title = `点击打开文件: ${att.name}`;
                attachmentElement.onclick = (e) => { e.preventDefault(); electronAPI.openPath(att.src.replace('file://', '')); };
            }
            if (attachmentElement) attachmentsContainer.appendChild(attachmentElement);
        });
        contentDiv.appendChild(attachmentsContainer);
    }
    
    chatMessagesDiv.appendChild(messageItem);

    if (!message.isThinking && window.renderMathInElement) {
        window.renderMathInElement(contentDiv, {
            delimiters: [
                {left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false},
                {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}
            ],
            throwOnError: false
        });
    }
    
    if (!isInitialLoad && !message.isThinking) {
        mainRendererReferences.currentChatHistory.push(message);
        if (currentAgentId && currentTopicId) {
             electronAPI.saveChatHistory(currentAgentId, currentTopicId, mainRendererReferences.currentChatHistory);
        }
    } else if (isInitialLoad && message.isThinking) {
        const thinkingMsgIndex = mainRendererReferences.currentChatHistory.findIndex(m => m.id === message.id && m.isThinking);
        if (thinkingMsgIndex > -1) {
            mainRendererReferences.currentChatHistory.splice(thinkingMsgIndex, 1);
        }
        messageItem.remove();
        return null;
    }
    
    scrollToBottom();
    return messageItem;
}

function startStreamingMessage(message) {
    const { chatMessagesDiv, scrollToBottom } = mainRendererReferences;
    if (!message || !message.id) {
        console.error("startStreamingMessage: Message or message.id is undefined.", message);
        return null;
    }
    mainRendererReferences.activeStreamingMessageId = message.id;

    let messageItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${message.id}"]`);

    if (!messageItem) {
        console.warn(`startStreamingMessage: Thinking message item with id ${message.id} not found. Rendering placeholder.`);
        const placeholderMessage = { 
            ...message, 
            role: 'assistant', 
            content: '', 
            isThinking: false, 
            timestamp: message.timestamp || Date.now() 
        };
        messageItem = renderMessage(placeholderMessage, false); 

        if (!messageItem) {
           console.error(`startStreamingMessage: Failed to render placeholder for new stream ${message.id}. Aborting stream start.`);
           mainRendererReferences.activeStreamingMessageId = null; 
           return null;
        }
    }
    
    messageItem.classList.add('streaming');
    messageItem.classList.remove('thinking'); 

    const contentDiv = messageItem.querySelector('.md-content');
    if (contentDiv) {
        contentDiv.innerHTML = ''; 
        contentDiv.innerHTML = `<span class="thinking-indicator">正在接收<span class="thinking-indicator-dots">...</span></span>`;
    }
    
    const historyIndex = mainRendererReferences.currentChatHistory.findIndex(m => m.id === message.id);
    if (historyIndex === -1) {
        mainRendererReferences.currentChatHistory.push({ 
            ...message, 
            role: 'assistant', 
            content: '', 
            isThinking: false, 
            timestamp: message.timestamp || Date.now() 
        });
    } else {
        console.warn(`startStreamingMessage: Message ID ${message.id} already found in history. Updating existing entry.`);
        mainRendererReferences.currentChatHistory[historyIndex].isThinking = false;
        mainRendererReferences.currentChatHistory[historyIndex].content = ""; 
        mainRendererReferences.currentChatHistory[historyIndex].timestamp = message.timestamp || Date.now(); 
    }

    scrollToBottom();
    return messageItem;
}

function appendStreamChunk(messageId, chunkData) {
    if (messageId !== mainRendererReferences.activeStreamingMessageId) {
        return;
    }
    const { chatMessagesDiv, markedInstance, scrollToBottom } = mainRendererReferences;
    const messageItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${messageId}"]`);
    if (!messageItem) return;

    const contentDiv = messageItem.querySelector('.md-content'); 
    if (!contentDiv) return;

    let textToAppend = "";
    if (chunkData && chunkData.choices && chunkData.choices.length > 0) {
        const delta = chunkData.choices[0].delta;
        if (delta && delta.content) {
            textToAppend = delta.content;
        }
    } else if (typeof chunkData === 'string') {
        textToAppend = chunkData;
    } else if (chunkData && chunkData.raw) {
        textToAppend = chunkData.raw + (chunkData.error ? ` (解析错误)` : "");
    }

    const messageIndex = mainRendererReferences.currentChatHistory.findIndex(msg => msg.id === messageId);
    let fullCurrentText = "";
    if (messageIndex > -1) {
        mainRendererReferences.currentChatHistory[messageIndex].content += textToAppend;
        fullCurrentText = mainRendererReferences.currentChatHistory[messageIndex].content;
    } else {
        const tempContainer = document.createElement('div');
        let existingText = "";
        const thinkingIndicator = contentDiv.querySelector('.thinking-indicator');
        if (thinkingIndicator && contentDiv.childNodes.length === 1 && contentDiv.firstChild === thinkingIndicator) {
            existingText = ""; 
        } else {
             tempContainer.innerHTML = contentDiv.innerHTML; 
             existingText = tempContainer.textContent || ""; 
        }
        fullCurrentText = existingText + textToAppend;
    }
    
    let processedFullCurrentTextForParse = ensureNewlineAfterCodeBlock(fullCurrentText);
    processedFullCurrentTextForParse = ensureSpaceAfterTilde(processedFullCurrentTextForParse);
    processedFullCurrentTextForParse = removeIndentationFromCodeBlockMarkers(processedFullCurrentTextForParse); 
    contentDiv.innerHTML = markedInstance.parse(processedFullCurrentTextForParse);
    
    if (messageItem) {
        let currentDelay = ENHANCED_RENDER_DEBOUNCE_DELAY;
        if (fullCurrentText.includes("<<<DailyNoteStart>>>") || fullCurrentText.includes("<<<[TOOL_REQUEST]>>>")) {
             currentDelay = DIARY_RENDER_DEBOUNCE_DELAY;
        }

        if (enhancedRenderDebounceTimers.has(messageItem)) {
            clearTimeout(enhancedRenderDebounceTimers.get(messageItem));
        }
        enhancedRenderDebounceTimers.set(messageItem, setTimeout(() => {
            if (document.body.contains(messageItem)) {
                const targetContentDiv = messageItem.querySelector('.md-content');
                if (targetContentDiv) {
                    targetContentDiv.querySelectorAll('pre[data-vcp-prettified="true"], pre[data-maid-diary-prettified="true"]').forEach(pre => {
                        delete pre.dataset.vcpPrettified;
                        delete pre.dataset.maidDiaryPrettified;
                    });
                    let processedFullCurrentTextForDebounceParse = ensureNewlineAfterCodeBlock(fullCurrentText);
                    processedFullCurrentTextForDebounceParse = ensureSpaceAfterTilde(processedFullCurrentTextForDebounceParse);
                    processedFullCurrentTextForDebounceParse = removeIndentationFromCodeBlockMarkers(processedFullCurrentTextForDebounceParse);
                    targetContentDiv.innerHTML = markedInstance.parse(processedFullCurrentTextForDebounceParse);

                    if (window.renderMathInElement) {
                         window.renderMathInElement(targetContentDiv, {
                            delimiters: [
                                {left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false},
                                {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}
                            ], throwOnError: false });
                    }
                    processAllPreBlocksInContentDiv(targetContentDiv);
                }
            }
            enhancedRenderDebounceTimers.delete(messageItem);
        }, currentDelay));
    } else if (contentDiv) { 
         if (window.renderMathInElement) {
             window.renderMathInElement(contentDiv, {
                delimiters: [
                    {left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}
                ], throwOnError: false });
         }
        processAllPreBlocksInContentDiv(contentDiv);
    }
    
    scrollToBottom();
}

function finalizeStreamedMessage(messageId, finishReason) {
    if (messageId !== mainRendererReferences.activeStreamingMessageId) {
       console.warn(`finalizeStreamedMessage: Received end for inactive/mismatched stream ${messageId}. Current active stream is ${mainRendererReferences.activeStreamingMessageId}.`);
        return;
    }
    mainRendererReferences.activeStreamingMessageId = null; 

    const { chatMessagesDiv, electronAPI, currentAgentId, currentTopicId, scrollToBottom, markedInstance } = mainRendererReferences;
    const messageItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${messageId}"]`);
    if (!messageItem) return;

    messageItem.classList.remove('streaming');
    
    const messageIndex = mainRendererReferences.currentChatHistory.findIndex(msg => msg.id === messageId);
    let finalFullText = "";
    if (messageIndex > -1) {
        const message = mainRendererReferences.currentChatHistory[messageIndex];
        message.finishReason = finishReason;
        finalFullText = message.content;
        
        const nameTimeBlock = messageItem.querySelector('.name-time-block');
        if (nameTimeBlock && !nameTimeBlock.querySelector('.message-timestamp')) {
            const timestampDiv = document.createElement('div');
            timestampDiv.classList.add('message-timestamp');
            timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            nameTimeBlock.appendChild(timestampDiv);
        }

        if (message.role !== 'system' && !messageItem.classList.contains('thinking')) { 
             messageItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, messageItem, message);
            });
        }
        
        if (currentAgentId && currentTopicId) {
            electronAPI.saveChatHistory(currentAgentId, currentTopicId, mainRendererReferences.currentChatHistory);
        }
    }
    
    const contentDiv = messageItem.querySelector('.md-content');
    if (contentDiv) {
        const thinkingIndicator = contentDiv.querySelector('.thinking-indicator');
        if (thinkingIndicator) thinkingIndicator.remove();
        
        let processedFinalFullText = ensureNewlineAfterCodeBlock(finalFullText);
        processedFinalFullText = ensureSpaceAfterTilde(processedFinalFullText);
        processedFinalFullText = removeIndentationFromCodeBlockMarkers(processedFinalFullText); 
        contentDiv.innerHTML = markedInstance.parse(processedFinalFullText); 

        if (window.renderMathInElement) {
             window.renderMathInElement(contentDiv, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}, {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}], throwOnError: false });
        }
        
        if (enhancedRenderDebounceTimers.has(messageItem)) {
            clearTimeout(enhancedRenderDebounceTimers.get(messageItem));
            enhancedRenderDebounceTimers.delete(messageItem);
        }
        contentDiv.querySelectorAll('pre[data-vcp-prettified="true"], pre[data-maid-diary-prettified="true"]').forEach(pre => {
            delete pre.dataset.vcpPrettified;
            delete pre.dataset.maidDiaryPrettified;
        });
        processAllPreBlocksInContentDiv(contentDiv); 
    }

    scrollToBottom();
    console.log(`Streaming finalized for message ${messageId}, reason: ${finishReason}`);
}

function showContextMenu(event, messageItem, message) {
    closeContextMenu(); 
    closeTopicContextMenu(); 

    const { currentChatHistory, currentAgentId, currentTopicId, electronAPI } = mainRendererReferences;

    const menu = document.createElement('div');
    menu.id = 'chatContextMenu';
    menu.classList.add('context-menu');
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;

    if (message.isThinking || messageItem.classList.contains('streaming')) {
        const cancelOption = document.createElement('div');
        cancelOption.classList.add('context-menu-item');
        cancelOption.textContent = message.isThinking ? "强制移除'思考中...'" : "取消回复生成";
        cancelOption.onclick = () => {
            if (message.isThinking) {
                const thinkingMsgIndex = currentChatHistory.findIndex(msg => msg.id === message.id && msg.isThinking);
                if (thinkingMsgIndex > -1) {
                    currentChatHistory.splice(thinkingMsgIndex, 1);
                    if (currentAgentId && currentTopicId) electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
                }
                messageItem.remove();
            } else if (messageItem.classList.contains('streaming')) {
                finalizeStreamedMessage(message.id, 'cancelled_by_user');
            }
            closeContextMenu();
        };
        menu.appendChild(cancelOption);
    } else {
        const isEditing = messageItem.classList.contains('message-item-editing');
        const textarea = isEditing ? messageItem.querySelector('.message-edit-textarea') : null;

        if (!isEditing) {
            const editOption = document.createElement('div');
            editOption.classList.add('context-menu-item');
            editOption.textContent = '编辑消息';
            editOption.onclick = () => {
                toggleEditMode(messageItem, message);
                closeContextMenu();
            };
            menu.appendChild(editOption);
        }

        const copyOption = document.createElement('div');
        copyOption.classList.add('context-menu-item');
        copyOption.textContent = '复制文本';
        copyOption.onclick = () => {
            const textToCopy = message.content.replace(/<img[^>]*>/g, '').trim();
            navigator.clipboard.writeText(textToCopy)
                .then(() => console.log('Message content (without img tags) copied to clipboard.'))
                .catch(err => console.error('Failed to copy message content: ', err));
            closeContextMenu();
        };
        menu.appendChild(copyOption);

        if (isEditing && textarea) {
            const cutOption = document.createElement('div');
            cutOption.classList.add('context-menu-item');
            cutOption.textContent = '剪切文本';
            cutOption.onclick = () => {
                textarea.focus();
                document.execCommand('cut');
                closeContextMenu();
            };
            menu.appendChild(cutOption);

            const pasteOption = document.createElement('div');
            pasteOption.classList.add('context-menu-item');
            pasteOption.textContent = '粘贴文本';
            pasteOption.onclick = async () => {
                textarea.focus();
                try {
                    const text = await window.electronAPI.readTextFromClipboard();
                    if (text) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + text.length;
                        textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    }
                } catch (err) {
                    console.error('Failed to paste text from clipboard:', err);
                }
                closeContextMenu();
            };
            menu.appendChild(pasteOption);
        }

        const createBranchOption = document.createElement('div');
        createBranchOption.classList.add('context-menu-item');
        createBranchOption.textContent = '创建分支';
        createBranchOption.onclick = () => {
            if (typeof mainRendererReferences.handleCreateBranch === 'function') {
                 mainRendererReferences.handleCreateBranch(message);
            } else {
                console.error("handleCreateBranch function is not available in mainRendererReferences.");
            }
            closeContextMenu();
        }; 
        menu.appendChild(createBranchOption); 

        const readModeOption = document.createElement('div');
        readModeOption.classList.add('context-menu-item');
        readModeOption.textContent = '阅读模式';
        readModeOption.onclick = () => {
            const plainTextContent = message.content.replace(/<img[^>]*>/gi, "").replace(/<audio[^>]*>.*?<\/audio>/gi, "").replace(/<video[^>]*>.*?<\/video>/gi, "");
            const windowTitle = `阅读模式: ${message.id.substring(0,12)}...`;
            const currentTheme = localStorage.getItem('theme') || 'dark'; 
            console.log('[MessageRenderer] Attempting to open read mode. Title:', windowTitle, 'Content length:', plainTextContent.length, 'Theme:', currentTheme);
            if (mainRendererReferences.electronAPI && typeof mainRendererReferences.electronAPI.openTextInNewWindow === 'function') {
                mainRendererReferences.electronAPI.openTextInNewWindow(plainTextContent, windowTitle, currentTheme); 
            } else {
                console.error('[MessageRenderer] electronAPI.openTextInNewWindow is not available or not a function!');
                alert('错误：无法调用阅读模式功能。');
            }
            closeContextMenu();
        };
        menu.appendChild(readModeOption);


        const deleteOption = document.createElement('div');
        deleteOption.classList.add('context-menu-item', 'danger-text');
        deleteOption.textContent = '删除消息';
        deleteOption.onclick = async () => {
            if (confirm(`确定要删除此消息吗？\n"${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`)) {
                const messageIndex = currentChatHistory.findIndex(msg => msg.id === message.id);
                if (messageIndex > -1) {
                    currentChatHistory.splice(messageIndex, 1);
                    if (currentAgentId && currentTopicId) await electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
                    messageItem.remove();
                }
            }
            closeContextMenu();
        };

        if (message.role === 'assistant') {
            const regenerateOption = document.createElement('div');
            regenerateOption.classList.add('context-menu-item', 'regenerate-text');
            regenerateOption.textContent = '重新回复';
            regenerateOption.onclick = () => {
                handleRegenerateResponse(message);
                closeContextMenu();
            };
            menu.appendChild(regenerateOption);
        }
        menu.appendChild(deleteOption); 
    }

    document.body.appendChild(menu);
    document.addEventListener('click', closeContextMenuOnClickOutside, true);
}

function closeContextMenu() {
    const existingMenu = document.getElementById('chatContextMenu');
    if (existingMenu) {
        existingMenu.remove();
        document.removeEventListener('click', closeContextMenuOnClickOutside, true);
    }
}
function closeTopicContextMenu() { 
    const existingMenu = document.getElementById('topicContextMenu');
    if (existingMenu) existingMenu.remove();
}

function closeContextMenuOnClickOutside(event) {
    const menu = document.getElementById('chatContextMenu');
    if (menu && !menu.contains(event.target)) {
        closeContextMenu();
    }
}

function toggleEditMode(messageItem, message) {
    const { currentChatHistory, currentAgentId, currentTopicId, electronAPI, markedInstance, autoResizeTextarea } = mainRendererReferences;
    const contentDiv = messageItem.querySelector('.md-content');
    if (!contentDiv) return;

    const existingTextarea = messageItem.querySelector('.message-edit-textarea');
    const existingControls = messageItem.querySelector('.message-edit-controls');

    if (existingTextarea) {
        let originalContentProcessed = ensureNewlineAfterCodeBlock(message.content);
        originalContentProcessed = ensureSpaceAfterTilde(originalContentProcessed);
        contentDiv.innerHTML = markedInstance.parse(originalContentProcessed); 
        if (window.renderMathInElement) {
             window.renderMathInElement(contentDiv, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}, {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}], throwOnError: false });
        }
        processAllPreBlocksInContentDiv(contentDiv); 

        messageItem.classList.remove('message-item-editing'); 
        messageItem.style.maxWidth = ''; 
        messageItem.style.width = '';    
        existingTextarea.remove();
        if (existingControls) existingControls.remove();
        contentDiv.style.display = '';
         // Restore visibility of avatar and nameTimeDiv if they were hidden
        const avatarEl = messageItem.querySelector('.chat-avatar');
        const nameTimeEl = messageItem.querySelector('.name-time-block');
        if(avatarEl) avatarEl.style.display = '';
        if(nameTimeEl) nameTimeEl.style.display = '';
    } else {
        const currentBubbleWidth = contentDiv.offsetWidth; 
        const originalContentHeight = contentDiv.offsetHeight;
        contentDiv.style.display = 'none';
         // Hide avatar and nameTimeDiv during editing for a cleaner look
        const avatarEl = messageItem.querySelector('.chat-avatar');
        const nameTimeEl = messageItem.querySelector('.name-time-block');
        if(avatarEl) avatarEl.style.display = 'none';
        if(nameTimeEl) nameTimeEl.style.display = 'none';

        messageItem.classList.add('message-item-editing'); 
        messageItem.style.width = 'auto';  // Let it adjust, but still constrained by parent max-width
        messageItem.style.maxWidth = 'calc(100% - 40px)'; // Adjust to be less than full chat width


        const textarea = document.createElement('textarea');
        textarea.classList.add('message-edit-textarea');
        textarea.value = message.content;
        textarea.style.minHeight = `${Math.max(originalContentHeight, 50)}px`;
        textarea.style.width = '100%'; 

        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('message-edit-controls');

        const saveButton = document.createElement('button');
        saveButton.textContent = '保存';
        saveButton.onclick = async () => {
            const newContent = textarea.value;
            const messageIndex = currentChatHistory.findIndex(msg => msg.id === message.id); 
            if (messageIndex > -1) {
                currentChatHistory[messageIndex].content = newContent;
                if (currentAgentId && currentTopicId) await electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
                message.content = newContent;
                let newContentProcessed = ensureNewlineAfterCodeBlock(newContent);
                newContentProcessed = ensureSpaceAfterTilde(newContentProcessed);
                contentDiv.innerHTML = markedInstance.parse(newContentProcessed); 
                if (window.renderMathInElement) {
                    window.renderMathInElement(contentDiv, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}, {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}], throwOnError: false });
                }
                processAllPreBlocksInContentDiv(contentDiv); 
            }
            toggleEditMode(messageItem, message); // Call again to revert to display mode
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.onclick = () => {
             toggleEditMode(messageItem, message); // Call again to revert to display mode
        };

        controlsDiv.appendChild(saveButton);
        controlsDiv.appendChild(cancelButton);

        messageItem.appendChild(textarea); 
        messageItem.appendChild(controlsDiv);
        
        if (autoResizeTextarea) autoResizeTextarea(textarea);
        textarea.focus();
        textarea.addEventListener('input', () => autoResizeTextarea(textarea));
        textarea.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); 
                saveButton.click();
            } else if (event.key === 'Escape') {
                cancelButton.click();
            }
        });
    }
}

async function handleRegenerateResponse(originalAssistantMessage) {
    const { currentChatHistory, currentAgentId, currentTopicId, globalSettings, electronAPI, chatMessagesDiv, scrollToBottom } = mainRendererReferences;

    if (!currentAgentId || !currentTopicId || !originalAssistantMessage || originalAssistantMessage.role !== 'assistant') {
        console.warn('MessageRenderer: Cannot regenerate response, invalid parameters.');
        return;
    }

    const originalMessageIndex = currentChatHistory.findIndex(
        msg => msg.id === originalAssistantMessage.id
    );

    if (originalMessageIndex === -1) {
        console.warn('MessageRenderer: Cannot regenerate, original message not found in history.');
        return;
    }

    const historyForRegeneration = currentChatHistory.slice(0, originalMessageIndex);
    currentChatHistory.splice(originalMessageIndex);

    if (currentAgentId && currentTopicId) {
        try {
            await electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
        } catch (saveError) {
            console.error("MessageRenderer: Failed to save chat history after splice in regenerate:", saveError);
        }
    }

    let currentElementToRemove = chatMessagesDiv.querySelector(`.message-item[data-message-id="${originalAssistantMessage.id}"]`);
    while(currentElementToRemove) {
        const siblingToRemove = currentElementToRemove.nextElementSibling;
        currentElementToRemove.remove();
        currentElementToRemove = siblingToRemove;
    }

    const regenerationThinkingMessage = {
        role: 'assistant', 
        content: '重新生成中...',
        timestamp: Date.now(),
        id: `regen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        isThinking: true 
    };
    
    const thinkingMessageItem = renderMessage(regenerationThinkingMessage, false); 
    if (thinkingMessageItem) {
        thinkingMessageItem.classList.add('thinking'); 
        const thinkingContentDiv = thinkingMessageItem.querySelector('.md-content .thinking-indicator');
        if (thinkingContentDiv) thinkingContentDiv.innerHTML = `重新生成中<span class="thinking-indicator-dots">...</span>`;
    }

    mainRendererReferences.activeStreamingMessageId = regenerationThinkingMessage.id; 

    try {
        const agentConfig = await electronAPI.getAgentConfig(currentAgentId);
        
        let messagesForVCP = await Promise.all(historyForRegeneration.map(async msg => {
            let vcpAttachments = [];
            if (msg.attachments && msg.attachments.length > 0) {
                vcpAttachments = await Promise.all(msg.attachments.map(async att => {
                    console.log('[Regenerate] Processing attachment for VCP:', JSON.stringify(att, (key, value) => {
                        if ((key === 'data' || key === 'extractedText') && typeof value === 'string' && value.length > 200) {
                            return `${value.substring(0, 50)}...[${key}, length: ${value.length}]...${value.substring(value.length - 50)}`;
                        }
                        return value;
                    }, 2));

                    if (att.type.startsWith('image/') || att.type.startsWith('audio/')) {
                        try {
                            const internalPath = att.src; 
                            console.log(`[Regenerate] Calling getFileAsBase64 for: ${internalPath}`);
                            const base64Result = await electronAPI.getFileAsBase64(internalPath);
                            if (base64Result && base64Result.error) {
                                console.error(`[Regenerate] Error from getFileAsBase64 for ${att.name} (internal: ${internalPath}):`, base64Result.error);
                                return { ...att, error: `Regen failed to load data: ${base64Result.error}` };
                            } else if (typeof base64Result === 'string') {
                                console.log(`[Regenerate] Successfully got Base64 for ${att.name} (internal: ${internalPath}), length: ${base64Result.length}`);
                                return { ...att, data: base64Result };
                            }
                            console.warn(`[Regenerate] getFileAsBase64 returned unexpected data for ${att.name} (internal: ${internalPath}):`,
                                (typeof base64Result === 'string' && base64Result.length > 200)
                                    ? `${base64Result.substring(0,50)}...[String, length: ${base64Result.length}]`
                                    : base64Result
                            );
                            return { ...att, error: "Regen failed: Unexpected Base64 result" };
                        } catch (error) {
                            console.error(`[Regenerate] Exception during getBase64 for ${att.name} (internal: ${att.src}):`, error);
                            return { ...att, error: `Regen Base64 Exception: ${error.message}` };
                        }
                    } else if (att.type.startsWith('text/') || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(att.type) || /\.(txt|md|log|js|json|html|css|py)$/i.test(att.name) ) {
                         try {
                            const internalPath = att.src;
                            console.log(`[Regenerate] Calling getTextContent for: ${internalPath}, type: ${att.type}`);
                            const textResult = await electronAPI.getTextContent(internalPath, att.type);
                            if (textResult && textResult.error) {
                                console.error(`[Regenerate] Error from getTextContent for ${att.name} (internal: ${internalPath}):`, textResult.error);
                                return { ...att, error: `Regen failed to extract text: ${textResult.error}` };
                            } else if (typeof textResult.textContent === 'string') {
                                console.log(`[Regenerate] Successfully got text for ${att.name}, length: ${textResult.textContent.length}`);
                                return { ...att, extractedText: textResult.textContent };
                            }
                             console.warn(`[Regenerate] getTextContent returned unexpected data for ${att.name} (internal: ${internalPath}):`, textResult);
                            return { ...att, error: "Regen failed: Unexpected text result" };
                        } catch (error) {
                            console.error(`[Regenerate] Exception during getTextContent for ${att.name} (internal: ${att.src}):`, error);
                            return { ...att, error: `Regen Text Exception: ${error.message}` };
                        }
                    }
                    return att; 
                }));
            }

            if (msg.role === 'user') {
                let userPrimaryText = msg.content || "";
                const mediaParts = [];
                const documentStrings = [];
                let documentIndex = 1;

                vcpAttachments.forEach(att => {
                    if (att.error) {
                        console.warn(`[Regenerate] Skipping attachment ${att.name} for VCP processing due to error: ${att.error}`);
                        return;
                    }
                    if (att.type.startsWith('image/') && att.data) {
                        mediaParts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.data}` } });
                    } else if (att.type.startsWith('audio/') && att.data) {
                        mediaParts.push({ type: 'audio_url', audio_url: { url: `data:${att.type};base64,${att.data}` } });
                    } else if (att.extractedText) {
                        documentStrings.push(`[文档${documentIndex}-${att.name}：${att.extractedText}]`);
                        documentIndex++;
                    }
                });

                let combinedTextContent = userPrimaryText;
                if (documentStrings.length > 0) {
                    if (combinedTextContent.length > 0) {
                        combinedTextContent += "\n\n";
                    }
                    combinedTextContent += documentStrings.join("\n");
                }
                
                const finalContentForVCP = [{ type: 'text', text: combinedTextContent }];
                finalContentForVCP.push(...mediaParts);
                return { role: msg.role, content: finalContentForVCP };
            }
            return { role: msg.role, content: msg.content }; 
        }));

        if (agentConfig.systemPrompt) {
            const systemPromptContent = agentConfig.systemPrompt.replace(/\{\{AgentName\}\}/g, agentConfig.name || currentAgentId);
            messagesForVCP.unshift({ role: 'system', content: systemPromptContent });
        }

        const modelConfigForVCP = {
            model: agentConfig.model,
            temperature: parseFloat(agentConfig.temperature),
            ...(agentConfig.maxOutputTokens && { max_tokens: parseInt(agentConfig.maxOutputTokens) }),
            stream: agentConfig.streamOutput === true || agentConfig.streamOutput === 'true'
        };
        
        const vcpResult = await electronAPI.sendToVCP(
            globalSettings.vcpServerUrl,
            globalSettings.vcpApiKey,
            messagesForVCP,
            modelConfigForVCP,
            regenerationThinkingMessage.id 
        );

        if (modelConfigForVCP.stream) {
            if (vcpResult.streamingStarted) {
                startStreamingMessage({ ...regenerationThinkingMessage, content: "" }); 
            } else if (vcpResult.streamError) { 
                const thinkingItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${regenerationThinkingMessage.id}"]`);
                if(thinkingItem) thinkingItem.remove();
                if (mainRendererReferences.activeStreamingMessageId === regenerationThinkingMessage.id) {
                    mainRendererReferences.activeStreamingMessageId = null;
                }
                 renderMessage({ role: 'system', content: `VCP 流错误 (重新生成): ${vcpResult.streamError}`, timestamp: Date.now() });
            } else {
                 throw new Error("Streaming for regeneration was expected but did not start correctly.");
            }
        } else { 
            const thinkingItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${regenerationThinkingMessage.id}"]`);
            if(thinkingItem) thinkingItem.remove();

            if (vcpResult.error) {
                renderMessage({ role: 'system', content: `VCP错误 (重新生成): ${vcpResult.error}`, timestamp: Date.now() });
            } else if (vcpResult.choices && vcpResult.choices.length > 0) {
                const assistantMessageContent = vcpResult.choices[0].message.content;
                renderMessage({ role: 'assistant', content: assistantMessageContent, timestamp: Date.now() });
            } else {
                renderMessage({ role: 'system', content: 'VCP返回了未知格式的响应 (重新生成)。', timestamp: Date.now() });
            }
            if (currentAgentId && currentTopicId) await electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
            scrollToBottom();
        }

    } catch (error) {
        console.error('MessageRenderer: Error regenerating response:', error);
        const thinkingItem = chatMessagesDiv.querySelector(`.message-item[data-message-id="${regenerationThinkingMessage.id}"]`);
        if(thinkingItem) thinkingItem.remove();
        if (mainRendererReferences.activeStreamingMessageId === regenerationThinkingMessage.id) {
            mainRendererReferences.activeStreamingMessageId = null;
        }
        const historyIdx = currentChatHistory.findIndex(m => m.id === regenerationThinkingMessage.id);
        if (historyIdx > -1) currentChatHistory.splice(historyIdx, 1);
        
        renderMessage({ role: 'system', content: `错误 (重新生成): ${error.message}`, timestamp: Date.now() });
        if (currentAgentId && currentTopicId) await electronAPI.saveChatHistory(currentAgentId, currentTopicId, currentChatHistory);
        scrollToBottom();
    }
}

window.messageRenderer = {
    initializeMessageRenderer,
    setCurrentAgentId,
    setCurrentTopicId,
    setCurrentAgentAvatar,
    setUserAvatar, // Expose new function
    renderMessage,
    startStreamingMessage,
    appendStreamChunk,
    finalizeStreamedMessage
};