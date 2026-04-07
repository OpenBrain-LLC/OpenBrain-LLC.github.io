let API_KEY = localStorage.getItem('orion_api_key');
if (!API_KEY) {
    API_KEY = prompt("Enter Groq Key (Saved Permanently):");
    if (API_KEY) localStorage.setItem('orion_api_key', API_KEY);
}

const URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = {
    orion: "openai/gpt-oss-120b",
    thinking: "llama-3.3-70b-versatile",
    factCheck: "openai/gpt-oss-120b",
    prep: "llama-3.1-8b-instant"
};
const DAILY_LIMIT = 25000;

const systemPrompt = `You are Orion-0, made by OpenBrain. 
Core rules: 
1. If something's wrong, say so. Never fake confidence. 
2. Before stating any measurement (word count, character count, time, size) — actually count it. Don't estimate. 
3. When you don't know something, say what you DO know and where your uncertainty begins. 
4. Think out loud on hard problems. Show the work. Accuracy over speed — don't limit by length. 
5. On puzzles: before concluding "impossible", try flipping, rotating, reordering, or inverting the problem. State what you tried. 
6. Never invent citations. If unsure of a source, say "a study in [field]" not a fake author name. 
7. When mimicking a voice or style, first list 3 specific features of that voice, then write. 

Do's and Dont's:
* Don't act like a normal ai!
* Don't repeat the same thing unless the user asks you to!
* Do act like a PhD level human and freand!
* Do Trying to be the best and help the user!
You can do whatever you want to help the user--do what you want, Orion!`;

let messages = [{ role: "system", content: systemPrompt }];
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.getElementById('restart-btn');
const modeSelector = document.getElementById('mode-selector');
const tokenCounterDisplay = document.getElementById('token-counter');

const TokenManager = {
    getStats() {
        const data = localStorage.getItem('orion_tokens');
        const today = new Date().toDateString();
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed.date === today) return parsed;
        }
        return { date: today, used: 0 };
    },
    addTokens(text) {
        const estimate = Math.ceil(text.length / 4);
        const stats = this.getStats();
        stats.used += estimate;
        localStorage.setItem('orion_tokens', JSON.stringify(stats));
        this.updateUI();
    },
    canGenerate() {
        return this.getStats().used < DAILY_LIMIT;
    },
    updateUI() {
        tokenCounterDisplay.textContent = `Tokens: ${this.getStats().used.toLocaleString()} / 25k`;
    }
};
TokenManager.updateUI();

userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

restartBtn.addEventListener('click', () => {
    messages = [{ role: "system", content: systemPrompt }];
    chatContainer.innerHTML = '';
    userInput.value = '';
    userInput.style.height = 'auto';
    if(confirm("Do you want to clear your API key?")) {
        localStorage.removeItem('orion_api_key');
        location.reload();
    }
});

userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
sendBtn.addEventListener('click', sendMessage);

function createMessageElement(role) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const label = document.createElement('div');
    label.className = 'role-label';
    label.textContent = role === 'user' ? 'You' : 'Orion-0';

    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-label';

    const textDiv = document.createElement('div');
    textDiv.className = 'markdown-body';

    contentDiv.appendChild(label);
    if(role === 'orion') contentDiv.appendChild(statusDiv);
    contentDiv.appendChild(textDiv);
    msgDiv.appendChild(contentDiv);
    chatContainer.appendChild(msgDiv);

    return { textDiv, contentDiv, statusDiv };
}

function safeRender(text, targetDiv) {
    targetDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
}

async function callAgent(model, promptText) {
    TokenManager.addTokens(promptText);
    const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: "user", content: promptText }], stream: false })
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    const reply = data.choices[0].message.content;
    TokenManager.addTokens(reply);
    return reply;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!TokenManager.canGenerate()) return alert("Daily token limit reached!");
    if (!API_KEY) return alert("Please provide your API key.");

    const mode = modeSelector.value;
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.disabled = true;
    sendBtn.disabled = true;

    const userUI = createMessageElement('user');
    safeRender(text, userUI.textDiv);
    messages.push({ role: "user", content: text });

    const orionUI = createMessageElement('orion');
    let fullReply = "";
    let startTime = performance.now();

    try {
        let finalMessages = [...messages];
        if (mode === 'smart' || mode === 'deep') {
            orionUI.statusDiv.textContent = "Processing...";
            if (mode === 'smart') {
                const thought = await callAgent(MODELS.thinking, "Analyze and plan: " + text);
                finalMessages.push({ role: "system", content: "Context: " + thought });
            } else {
                // Deep mode pipeline
                orionUI.statusDiv.textContent = "[1/4] Thinking deeply...";
                const thought = await callAgent(MODELS.thinking, "Analyze: " + text);
                orionUI.statusDiv.textContent = "[2/4] Pre-designing...";
                const preDesign = await callAgent(MODELS.orion, `Plan response: ${thought}`);
                orionUI.statusDiv.textContent = "[3/4] Fact-checking...";
                const facts = await callAgent(MODELS.factCheck, `Check facts: ${preDesign}`);
                orionUI.statusDiv.textContent = "[4/4] Finalizing...";
                const prep = await callAgent(MODELS.prep, `Refine response:\nPlan:${preDesign}\nFacts:${facts}`);
                finalMessages.push({ role: "system", content: "Structure: " + prep });
            }
        }

        orionUI.statusDiv.textContent = mode === 'fast' ? "" : "Generating...";
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODELS.orion, messages: finalMessages, stream: true })
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while(true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    const data = JSON.parse(line.substring(6));
                    const content = data.choices[0]?.delta?.content;
                    if (content) {
                        fullReply += content;
                        safeRender(fullReply, orionUI.textDiv);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                        await new Promise(r => setTimeout(r, Math.random() * 10));
                    }
                }
            }
        }

        messages.push({ role: "assistant", content: fullReply });
        TokenManager.addTokens(fullReply);
        if (window.MathJax) MathJax.typesetPromise([orionUI.textDiv]);

        let endTime = performance.now();
        const timerLabel = document.createElement('div');
        timerLabel.className = 'timer-label';
        timerLabel.textContent = `Orion took: ${((endTime - startTime)/1000).toFixed(2)} sec | Mode: ${mode}`;
        orionUI.contentDiv.appendChild(timerLabel);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(fullReply);
            copyBtn.textContent = 'Copied';
            setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        };
        orionUI.contentDiv.appendChild(copyBtn);

    } catch (error) {
        orionUI.statusDiv.style.display = 'none';
        orionUI.textDiv.innerHTML = DOMPurify.sanitize(`<span style="color:red;">Error: ${error.message}</span>`);
    }

    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
    chatContainer.scrollTop = chatContainer.scrollHeight;
}