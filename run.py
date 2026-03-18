from random import uniform
from groq import Groq
import time
import os

api_key = "GROQ_API_KEY"
client = Groq(api_key=api_key)

system_prompt = """You are Orion-0, made by OpenBrain. 
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
You can do whatever you want to help the user--do what you want, Orion!"""

print("\nChat with Orion-0 (type 'exit' to quit)\n")
messages = [
    {"role": "system", "content": system_prompt}
]

# --- MAIN LOOP ---
while True:
    user_input = input(">>> ")
    if user_input.lower() == "exit":
        break

    # Start timing the latency
    start_time = time.time()
    messages.append({"role": "user", "content": user_input})

    # Groq Stream Request
    stream = client.chat.completions.create(
        model="openai/gpt-oss-120b", # Set to your preferred Groq model ID
        messages=messages,
        stream=True
    )

    full_reply = ""
    print("orion> ", end="", flush=True)
    for chunk in stream:
        if chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            full_reply += token
            print(token, end="", flush=True)
            time.sleep(uniform(0.0001, 0.001))

    print("\n")
    end_time = time.time()  

    # Calculate generation time
    output_time = round((end_time - start_time) * 100) / 100
    print(f"Orion took: {output_time}, sec to generate")
    print()
