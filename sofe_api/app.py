from gevent import monkey
monkey.patch_all()

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import json
import os
import sys
import gevent
from dotenv import load_dotenv  

# Load environment variables
load_dotenv()
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")
print(f"Flask imported successfully")
print(f"gevent version: {gevent.__version__}")

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# OpenRouter API configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def chunk_script(script, chunk_size=10000):
    """Split script into chunks without breaking lines"""
    lines = script.split("\n")
    chunks = []
    current_chunk = []
    current_size = 0

    for line in lines:
        if current_size + len(line) > chunk_size and current_chunk:
            chunks.append("\n".join(current_chunk))
            current_chunk = [line]
            current_size = len(line)
        else:
            current_chunk.append(line)
            current_size += len(line)

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks

@app.route("/")
def index():
    return send_file("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    if not data or "script" not in data:
        return jsonify({"error": "No script provided"}), 400

    script = data["script"]

    if not OPENROUTER_API_KEY:
        return jsonify({"error": "OPENROUTER_API_KEY not configured"}), 500

    print(f"Script size: {len(script)} characters")

    try:
        chunks = chunk_script(script)
        print(f"Split into {len(chunks)} chunk(s)")

        all_results = []
        language = "Unknown"
        is_valid_script = True

        for i, chunk in enumerate(chunks):
            print(f"Analyzing chunk {i+1}/{len(chunks)}...")

            ai_prompt = f"""
You are an AI Web Script Analyzer. Your FIRST task is to determine whether the input is actually a valid programming script or code.

## STEP 1 - VALIDATION:
Carefully check if the input is a real programming script or code written in any language such as:
JavaScript, TypeScript, Python, PHP, HTML, CSS, Ruby, Rust, Go, Lua, Shell, SQL, etc.

If the input is NOT a valid programming script (e.g., it is random text, gibberish, a sentence, a question, or unrelated content), respond ONLY with this exact format:

## Language:
- Not a valid programming script.

## Script Functionality:
- The input does not appear to be a programming script. Please paste actual code for analysis.

## Critical Issues:
- None.

## Warnings:
- None.

## Suggestions:
- Please provide a valid script written in a programming or scripting language.

---

If the input IS a valid programming script, respond in this exact format:

## Language:
- [e.g., JavaScript, Python, PHP, HTML, CSS, Ruby, Rust, Go, Lua, Shell, SQL, etc.]

## Script Functionality:
- Describe what the script does in detail.
- Mention key **functions**, `variable names`, and **logic flow**.

## Critical Issues:
- List functional errors, security risks, or syntax problems.
- Highlight affected **code lines** or `function names` where applicable.
- If none, write: **None found.**

## Warnings:
- Highlight potential bugs or bad practices.
- Reference specific `code blocks` or **methods** where applicable.
- If none, write: **None found.**

## Suggestions:
- Recommend improvements or optimizations.
- Reference specific `function names` or **patterns** to improve.

Rules:
- Use bullet points for all sections
- Use **bold** for important terms, concepts, and language names
- Use `inline code` for file names, variable names, function names, and code snippets
- Add spacing between sections
- Do NOT include any explanations outside the specified format.

Input:
{chunk}
"""

            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "nvidia/nemotron-3-super-120b-a12b:free",
                    "messages": [
                        {"role": "user", "content": ai_prompt}
                    ],
                    "max_tokens": 4096,
                    "temperature": 0.1
                },
                timeout=(10, 570)
            )

            if response.status_code != 200:
                error_msg = response.text
                print(f"OpenRouter error on chunk {i+1}: {response.status_code} - {error_msg}")
                continue

            response_data = response.json()
            print(f"Chunk {i+1} response: {response_data}")

            chunk_output = response_data["choices"][0]["message"]["content"]

            if not chunk_output:
                print(f"Chunk {i+1} returned empty response, skipping")
                continue

            all_results.append(chunk_output)

            # Extract language from first valid chunk only
            if language == "Unknown":
                lines = chunk_output.split("\n")
                for j, line in enumerate(lines):
                    if "Not a valid programming script" in line:
                        is_valid_script = False
                        language = "Not a valid script"
                        break
                    if "## Language:" in line:
                        for next_line in lines[j + 1:]:
                            if next_line.strip():
                                language = next_line.replace("-", "").replace("**", "").strip()
                                break
                        break

        if not all_results:
            print("All chunks returned empty responses")
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500

        # Combine all chunk results
        if len(all_results) == 1:
            ai_output = all_results[0]
        else:
            ai_output = f"## Analysis across {len(chunks)} sections:\n\n" + "\n\n---\n\n".join(all_results)

        print(f"Detected language: {language}")

        return jsonify({
            "result": ai_output,
            "language": language,
            "is_valid_script": is_valid_script
        })

    except requests.exceptions.Timeout:
        print("Request to OpenRouter timed out")
        return jsonify({"error": "Analysis timed out. Please try again."}), 504

    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Analysis failed", "details": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)