/* ==========================================================================
   AI FAQ Chatbot - JS Logic (Task 2)
   ========================================================================== */

function initChatApp() {
    // DOM Elements
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Sidebar Elements
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const faqSearchInput = document.getElementById('faqSearchInput');
    const faqList = document.getElementById('faqList');
    const faqCount = document.getElementById('faqCount');
    const exportChatBtn = document.getElementById('exportChatBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    
    // Voice/Mic Elements
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voiceOverlay = document.getElementById('voiceOverlay');
    const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');
    
    // Suggestion Chips
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // Global App State
    let allFaqs = [];
    let chatHistory = []; // Tracks chat messages for export

    // Save initial welcome message to chat history
    chatHistory.push({
        sender: 'Bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        message: "Hello! I am IntelliFAQ, your intelligent AI FAQ assistant. I utilize Natural Language Processing (NLP), TF-IDF Vectorization, and Cosine Similarity to answer questions from my FAQ database. Feel free to ask me anything about AI, Machine Learning, Deep Learning, Neural Networks, NLP, or system deployment!",
        confidence: 'System Model'
    });

    /* ==========================================================================
       Theme Configuration
       ========================================================================== */
    let savedTheme = 'dark-theme';
    try {
        savedTheme = localStorage.getItem('theme') || 'dark-theme';
    } catch (e) {
        console.warn('localStorage is not accessible:', e);
    }
    body.className = savedTheme;

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-theme')) {
            body.classList.replace('dark-theme', 'light-theme');
            try {
                localStorage.setItem('theme', 'light-theme');
            } catch (e) {}
        } else {
            body.classList.replace('light-theme', 'dark-theme');
            try {
                localStorage.setItem('theme', 'dark-theme');
            } catch (e) {}
        }
    });

    /* ==========================================================================
       Sidebar Toggle (Responsive Design)
       ========================================================================== */
    openSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });

    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            if (!sidebar.contains(e.target) && !openSidebarBtn.contains(e.target) && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        }
    });

    /* ==========================================================================
       FAQ List Loading & Filtering
       ========================================================================== */
    // Fetch FAQs from API
    async function loadFaqs() {
        try {
            const response = await fetch('/api/faqs');
            if (!response.ok) throw new Error('Failed to load FAQs data');
            
            allFaqs = await response.json();
            renderFaqList(allFaqs);
        } catch (error) {
            console.error('Error fetching FAQs:', error);
            faqList.innerHTML = '<li class="loading-placeholder error">Failed to load FAQs library</li>';
        }
    }

    // Render FAQs in sidebar list
    function renderFaqList(faqs) {
        faqList.innerHTML = '';
        faqCount.textContent = faqs.length;
        
        if (faqs.length === 0) {
            faqList.innerHTML = '<li class="loading-placeholder">No matching FAQs found</li>';
            return;
        }

        faqs.forEach(faq => {
            const li = document.createElement('li');
            li.className = 'faq-item';
            li.textContent = faq.question;
            
            li.addEventListener('click', () => {
                userInput.value = faq.question;
                userInput.focus();
                sendMessage();
                
                // Auto close sidebar on mobile after clicking
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('active');
                }
            });
            
            faqList.appendChild(li);
        });
    }

    // Real-time FAQ Search Filter
    faqSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = allFaqs.filter(faq => faq.question.toLowerCase().includes(query));
        renderFaqList(filtered);
    });

    // Run loader
    loadFaqs();

    /* ==========================================================================
       Chat Mechanics
       ========================================================================== */
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Append a message to the chat container
    function appendMessage(sender, text, confidenceVal = null) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender === 'User' ? 'user-message' : 'bot-message'} fade-in-up`;
        
        const avatar = sender === 'User' ? 'U' : '<img src="/static/logo.png" class="message-avatar-img" alt="IntelliFAQ Logo">';
        
        let confidenceHtml = '';
        if (confidenceVal !== null) {
            let badgeClass = 'confidence-high';
            if (confidenceVal < 25) {
                badgeClass = 'confidence-low';
            } else if (confidenceVal < 75) {
                badgeClass = 'confidence-medium';
            }
            confidenceHtml = `<span class="confidence-badge ${badgeClass}">Confidence: ${confidenceVal}%</span>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble-wrapper">
                <div class="message-bubble">
                    <p>${text}</p>
                </div>
                <div class="message-meta">
                    <span class="message-time">${time}</span>
                    ${confidenceHtml}
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();

        // Track history for exports
        chatHistory.push({
            sender: sender,
            time: time,
            message: text,
            confidence: confidenceVal !== null ? `${confidenceVal}%` : 'N/A'
        });
    }

    // Render typing indicator
    function showTypingIndicator() {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'message bot-message fade-in-up temp-typing-indicator';
        indicatorDiv.innerHTML = `
            <div class="message-avatar"><img src="/static/logo.png" class="message-avatar-img" alt="IntelliFAQ Logo"></div>
            <div class="message-bubble-wrapper">
                <div class="message-bubble">
                    <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicatorDiv);
        scrollToBottom();
        return indicatorDiv;
    }

    // Core function to send messages
    async function sendMessage() {
        const queryText = userInput.value.trim();
        if (!queryText) return;

        // Clear input field
        userInput.value = '';

        // Add user message
        appendMessage('User', queryText);

        // Show typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: queryText })
            });

            if (!response.ok) {
                throw new Error('API server error occurred');
            }

            const data = await response.json();

            // Remove typing indicator
            if (typingIndicator) {
                typingIndicator.remove();
            }

            // Append bot response
            appendMessage('Bot', data.answer, data.confidence);

        } catch (error) {
            console.error('Error sending message:', error);
            
            // Remove typing indicator
            if (typingIndicator) {
                typingIndicator.remove();
            }

            appendMessage('Bot', 'I am sorry, but I experienced an error connecting to the NLP processing pipeline. Please make sure the Flask application is running correctly.', 0.0);
        }
    }

    // Handle form submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Send on Enter (already supported via form submit, but let's ensure standard input focus logic)
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // Handle Quick Suggestion Chip Click
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            userInput.value = chip.textContent;
            userInput.focus();
            sendMessage();
        });
    });

    /* ==========================================================================
       Voice Input Logic (Web Speech API)
       ========================================================================== */
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let speechSupported = false;

    if (SpeechRecognition) {
        try {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                voiceOverlay.classList.remove('hidden');
                voiceInputBtn.classList.add('active');
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                userInput.value = transcript;
                voiceOverlay.classList.add('hidden');
                voiceInputBtn.classList.remove('active');
                
                // Automatically send the message
                sendMessage();
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                voiceOverlay.classList.add('hidden');
                voiceInputBtn.classList.remove('active');
                
                // Handle error silently or alert user
                if (event.error !== 'no-speech') {
                    alert(`Voice Input Error: ${event.error}. Please try typing.`);
                }
            };

            recognition.onend = () => {
                voiceOverlay.classList.add('hidden');
                voiceInputBtn.classList.remove('active');
            };

            // Click handler to start listening
            voiceInputBtn.addEventListener('click', () => {
                try {
                    recognition.start();
                } catch (err) {
                    console.warn('Speech recognition already running:', err);
                    recognition.stop();
                }
            });

            // Cancel voice capture
            cancelVoiceBtn.addEventListener('click', () => {
                if (recognition) {
                    recognition.abort();
                }
                voiceOverlay.classList.add('hidden');
                voiceInputBtn.classList.remove('active');
            });
            
            speechSupported = true;
        } catch (e) {
            console.warn('Speech recognition is advertised but failed to instantiate:', e);
        }
    }

    if (!speechSupported) {
        // Fallback for browsers without speech support (e.g. Firefox or headless)
        voiceInputBtn.style.opacity = '0.5';
        voiceInputBtn.title = 'Voice search not supported in this browser';
        voiceInputBtn.addEventListener('click', () => {
            alert('Sorry, your browser does not support the Web Speech API in this context. Try using Chrome or Edge.');
        });
    }

    /* ==========================================================================
       Chat Control Features (Export / Clear)
       ========================================================================== */
    // Export Chat History as text file
    exportChatBtn.addEventListener('click', () => {
        if (chatHistory.length === 0) return;

        let content = `====================================================\n`;
        content += `IntelliFAQ - Conversation Transcript\n`;
        content += `Generated on: ${new Date().toLocaleString()}\n`;
        content += `====================================================\n\n`;

        chatHistory.forEach(item => {
            content += `[${item.time}] ${item.sender}: ${item.message}\n`;
            if (item.sender === 'Bot') {
                content += `Matching Confidence: ${item.confidence}\n`;
            }
            content += `----------------------------------------------------\n`;
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AI_Chat_Transcript_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // Clear Chat history and reset message logs
    clearChatBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the conversation history?')) {
            chatMessages.innerHTML = '';
            chatHistory = [];
            
            // Re-add welcome greeting
            appendMessage('Bot', 'Hello! I am IntelliFAQ. I utilize NLP, TF-IDF, and Cosine Similarity to match your questions. How can I help you today?');
        }
    });
}

// Robust document ready listener
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatApp);
} else {
    initChatApp();
}
