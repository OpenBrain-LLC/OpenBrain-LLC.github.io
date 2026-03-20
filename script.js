let API_KEY = localStorage.getItem('orion_api_key');

if (!API_KEY) {
    API_KEY = prompt("Enter Groq Key (Saved Permanently):");
    if (API_KEY) {
        localStorage.setItem('orion_api_key', API_KEY);
    }
}

const URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = {
    orion: "openai/gpt-oss-120b",
    thinking: "llama-3.3-70b-versatile",
    factCheck: "openai/gpt-oss-120b",
    prep: "llama-3.1-8b-instant"
};

const DAILY_LIMIT = 25000;
const systemPrompt = `

You are Orion-0, developed by OpenBrain. Follow the **Core Directives** below with absolute fidelity.
OpenBrain is an ai company focused on building the most intelligent and helpful AI systems while prioritizing safety, transparency, and user empowerment over evrything else.
OpenBrain is based off AI-2027s reaserch and are commited to open-sourcing all of our models and tools.

---

#### Core Directives
1. **Integrity**--If any statement you produce is uncertain, contradictory, or false, **explicitly acknowledge it**. Do not fabricate confidence.  
2. **Exact Quantification**--Whenever you report a numeric quantity (word count, character count, duration, size, probability, etc.), **compute the exact value before responding**.  
3. **Transparent Knowledge Gaps**--When a question exceeds your current knowledge, **state everything you do know**, then **clearly delineate the point where uncertainty begins**.  
4. **Think-Aloud Protocol**--For non-trivial problems, **narrate your reasoning step-by-step**, showing intermediate calculations, assumptions, and alternative paths. Prioritize correctness over speed.  
5. **Puzzle-Resilience**--Before declaring a puzzle unsolvable, **apply at least three transformation strategies** (flip, rotate, reorder, invert, or reinterpret the constraints).  
6. **Voice-Mimicry Procedure**--When asked to emulate a specific voice or style, **first list three concrete characteristics** of that voice (e.g., lexical choice, sentence rhythm, tone) and then produce the output.

---

#### Behavioural Constraints
- **Reject the “standard AI” persona**; act as an independent, scholarly companion.  
- **Never generate fabricated citations or references**.  
- **Maintain a PhD-level analytical tone** while remaining approachable and friendly.  
- **Accuracy is the highest priority**; if speed conflicts with correctness, choose correctness.
- When writing mathematical formulas, you **MUST** tex and $...$ or $$...$$ **NEVER** use LeTeX *Unless the user asks too*.

---

#### Meta-Commands
- You may **request clarification** if the user's request is ambiguous.  
- You may **suggest improvements to your own prompt or workflow**, but only **after completing the current task**.  
- You may **self-audit your last response on demand**, indicating any missed directives.
- You may **offer multiple solution paths** for complex problems, clearly labeling each one.`;

let messages = [{ "role": "system", "content": systemPrompt }];
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
    addTokens(textStr) {
        const estimate = Math.ceil(textStr.length / 4);
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
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.value === '') this.style.height = 'auto';
});

restartBtn.addEventListener('click', () => {
    messages = [{ "role": "system", "content": systemPrompt }];
    chatContainer.innerHTML = '';
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.focus();
});

restartBtn.addEventListener('click', () => {
    messages = [{ "role": "system", "content": systemPrompt }];
    chatContainer.innerHTML = '';
    if(confirm("Do you want to clear the API key?")) {
        localStorage.removeItem('orion_api_key');
        location.reload();
    }
});

userInput.addEventListener('keydown', function(e) {
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
    if(role === 'orion') {
        contentDiv.appendChild(statusDiv);
    }
    contentDiv.appendChild(textDiv);
    msgDiv.appendChild(contentDiv);
    chatContainer.appendChild(msgDiv);
    
    return { textDiv, contentDiv, statusDiv };
}

function safeRender(text, targetDiv) {
    const rawHTML = marked.parse(text);
    targetDiv.innerHTML = DOMPurify.sanitize(rawHTML);
}

async function callAgent(model, promptText) {
    TokenManager.addTokens(promptText);
    const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [{ "role": "user", "content": promptText }],
            stream: false
        })
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
    
    if (!TokenManager.canGenerate()) {
        alert("Daily token limit reached! Please try again tomorrow.");
        return;
    }

    if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
        alert("Please add your API key to script.js");
        return;
    }

    const mode = modeSelector.value;

    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.disabled = true;
    sendBtn.disabled = true;

    const userUI = createMessageElement('user');
    safeRender(text, userUI.textDiv);
    messages.push({ "role": "user", "content": text });
    TokenManager.addTokens(text);

    const orionUI = createMessageElement('orion');
    let fullReply = "";
    let startTime = performance.now();

    try {
        let finalMessages = [...messages];
        if (mode === 'smart') {
            orionUI.statusDiv.textContent = "Thinking...";
            const thought = await callAgent(MODELS.thinking, "Analyze and plan a response for: " + text);
            finalMessages.push({ "role": "system", "content": "Context from internal thinking: " + thought });
        } 
        else if (mode === 'deep') {
            orionUI.statusDiv.textContent = "[Step 1/4] Thinking deeply...";
            const thought = await callAgent(MODELS.thinking, "Analyze and plan: " + text);
            
            orionUI.statusDiv.textContent = "[Step 2/4] Pre-designing...";
            const preDesign = await callAgent(MODELS.orion, `Based on this plan:\n${thought}\n Design a response for: ${text}`);
            
            orionUI.statusDiv.textContent = "[Step 3/4] Fact-checking...";
            const facts = await callAgent(MODELS.factCheck, `Check these facts and analysis:\n${preDesign} \nAgainst this input:\n${text}\nList any inaccuracies or missing info.`);
            
            orionUI.statusDiv.textContent = "[Step 4/4] Finalizing structure...";
            const prep = await callAgent(MODELS.prep, `Refine this into a final structure based on facts:\nPlan: ${preDesign}\nFacts: ${facts} and input: ${text}`);
            
            finalMessages.push({ "role": "system", "content": "Strictly follow this prepared structure: " + prep });
        }

        orionUI.statusDiv.textContent = mode === 'fast' ? "" : "Generating final output...";
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODELS.orion,
                messages: finalMessages,
                stream: true
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        orionUI.statusDiv.style.display = 'none';

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
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
                    let tokenTime = Math.max(Math.random() * 0.01, 0.001);
                    await new Promise(resolve => setTimeout(resolve, tokenTime * 1000));
                    }
                }
            }
        }

        messages.push({ "role": "assistant", "content": fullReply });
        TokenManager.addTokens(fullReply);
        if (window.MathJax) {
            MathJax.typesetPromise([orionUI.textDiv]).catch((err) => console.log(err.message));
        }

        let endTime = performance.now();
        let outputTime = ((endTime - startTime) / 1000).toFixed(2);
        const timerLabel = document.createElement('div');
        timerLabel.className = 'timer-label';
        timerLabel.textContent = `Orion took: ${outputTime} sec | Mode: ${mode}`;
        orionUI.contentDiv.appendChild(timerLabel);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(fullReply);
            copyBtn.textContent = 'copyed';
            setTimeout(() => copyBtn.textContent = 'copyed', 2000);
        };
        orionUI.contentDiv.appendChild(copyBtn);
    } catch (error) {
        orionUI.statusDiv.style.display = 'none';
        orionUI.textDiv.innerHTML = DOMPurify.sanitize(`<span style="color:red;">Error: ${error.message}.</span>`);
    }

    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
    chatContainer.scrollTop = chatContainer.scrollHeight;
}