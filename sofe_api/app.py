from gevent import monkey
monkey.patch_all()

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import json
import os
import sys
import re
import gevent
from gevent.pool import Pool
from dotenv import load_dotenv

load_dotenv()
print(f"Python version: {sys.version}")
print(f"Current working directory: {os.getcwd()}")
print(f"Flask imported successfully")
print(f"gevent version: {gevent.__version__}")

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ─── CONFIG ───────────────────────────────────────────────
CHUNK_SIZE    = 800_000  # ~200k tokens, well within free tier limit
MAX_SIZE      = 800_000  # hard reject anything over 800KB
PARALLEL_POOL = 5        # concurrent gevent workers
MAX_RETRIES   = 3        # retry failed chunks up to 3 times
# ──────────────────────────────────────────────────────────


def chunk_script(script, chunk_size=CHUNK_SIZE):
    """Split script into chunks without breaking lines."""
    lines = script.split("\n")
    chunks = []
    current_chunk = []
    current_size = 0

    for line in lines:
        line_len = len(line) + 1  # +1 for newline
        if current_size + line_len > chunk_size and current_chunk:
            chunks.append("\n".join(current_chunk))
            current_chunk = [line]
            current_size = line_len
        else:
            current_chunk.append(line)
            current_size += line_len

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    return chunks


def build_prompt(chunk):
    return f"""
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


def call_openrouter(chunk, index, total):
    """Call OpenRouter API for a single chunk with retry logic."""
    for attempt in range(MAX_RETRIES):
        try:
            if attempt > 0:
                wait = 2 ** attempt  # 2s, 4s backoff
                print(f"Chunk {index + 1}: retry {attempt}/{MAX_RETRIES - 1} after {wait}s...")
                gevent.sleep(wait)

            print(f"Analyzing chunk {index + 1}/{total} (attempt {attempt + 1})...")

            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "nvidia/nemotron-3-super-120b-a12b:free",
                    "messages": [{"role": "user", "content": build_prompt(chunk)}],
                    "max_tokens": 2048,   # lowered: reduces response time significantly
                    "temperature": 0.1,
                },
                timeout=(10, 120),        # 10s connect, 120s read (was 570s)
            )

            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                if content:
                    content = re.sub(r"##(\w)", r"## \1", content)
                    return (index, content)
                print(f"Chunk {index + 1} returned empty content, retrying...")

            elif response.status_code in (429, 500, 502, 503):
                # Rate limited or server error — retry
                print(f"Chunk {index + 1} got {response.status_code}, retrying...")
                continue

            else:
                # 400 or other non-retryable error
                print(f"Chunk {index + 1} error {response.status_code}: {response.text}")
                return (index, None)

        except requests.exceptions.Timeout:
            print(f"Chunk {index + 1} timed out on attempt {attempt + 1}")
        except Exception as e:
            print(f"Chunk {index + 1} exception: {type(e).__name__}: {e}")

    print(f"Chunk {index + 1} failed after {MAX_RETRIES} attempts")
    return (index, None)


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

    # Hard size limit — reject early instead of hanging
    if len(script) > MAX_SIZE:
        return jsonify({
            "error": f"Script too large ({len(script):,} chars). Maximum is {MAX_SIZE:,} characters."
        }), 413

    print(f"Script size: {len(script):,} characters")

    try:
        chunks = chunk_script(script)
        print(f"Split into {len(chunks)} chunk(s)")

        # ── Fire all chunks in parallel ──────────────────────
        pool = Pool(PARALLEL_POOL)
        jobs = [
            pool.spawn(call_openrouter, chunk, i, len(chunks))
            for i, chunk in enumerate(chunks)
        ]
        gevent.joinall(jobs, timeout=150)  # max 150s total wait

        # Collect and sort results by original chunk order
        raw_results = [job.value for job in jobs if job.value is not None]
        ordered = sorted(raw_results, key=lambda x: x[0])
        all_results = [text for _, text in ordered if text]

        if not all_results:
            print("All chunks returned empty responses")
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500

        # ── Detect language from first result ────────────────
        language = "Unknown"
        is_valid_script = True

        lines = all_results[0].split("\n")
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

        # ── Combine results ──────────────────────────────────
        if len(all_results) == 1:
            ai_output = all_results[0]
        else:
            ai_output = (
                f"## Analysis across {len(chunks)} sections:\n\n"
                + "\n\n---\n\n".join(all_results)
            )

        print(f"Detected language: {language}")

        return jsonify({
            "result": ai_output,
            "language": language,
            "is_valid_script": is_valid_script,
        })

    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Analysis failed", "details": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)