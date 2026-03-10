from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import json
import os
import sys
from dotenv import load_dotenv  

# Load environment variables
load_dotenv()
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")
print(f"Flask imported successfully")

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# OpenRouter API configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

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

    try:
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
{script}
"""

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemma-3-4b-it:free",
                "messages": [
                    {"role": "user", "content": ai_prompt}
                ]
            }
        )

        if response.status_code != 200:
            error_msg = response.text
            print(f"OpenRouter error: {response.status_code} - {error_msg}")
            return jsonify({"error": "API request failed", "details": error_msg}), 500

        response_data = response.json()
        ai_output = response_data["choices"][0]["message"]["content"]

        # Extract language from response for frontend use
        language = "Unknown"
        is_valid_script = True

        for line in ai_output.split("\n"):
            if "Not a valid programming script" in line:
                is_valid_script = False
                language = "Not a valid script"
                break
            elif "Detected Language:" in line:
                language = line.replace("-", "").replace("**Detected Language:**", "").replace("**", "").strip()
                break

        return jsonify({
            "result": ai_output,
            "language": language,
            "is_valid_script": is_valid_script
        })

    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Analysis failed", "details": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)