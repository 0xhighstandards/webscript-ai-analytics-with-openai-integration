from gevent import monkey
monkey.patch_all()

from flask import Flask, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
import requests
import json
import os
import sys
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
CHUNK_SIZE    = 80_000   # bigger chunks = fewer API calls
MAX_SIZE      = 500_000  # hard limit: 500KB
PARALLEL_POOL = 5        # concurrent gevent workers
# ──────────────────────────────────────────────────────────


def chunk_script(script, chunk_size=CHUNK_SIZE):
    """Split script into chunks without breaking lines."""
    lines = script.split("\n")
    chunks = []
    current_chunk = []
    current_size = 0

    for line in lines:
        line_len = len(line) + 1  # +1 for the newline character
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
    """Call OpenRouter API for a single chunk. Returns (index, result_text) or (index, None)."""
    print(f"Analyzing chunk {index + 1}/{total}...")
    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "nvidia/nemotron-3-super-120b-a12b:free",
                "messages": [{"role": "user", "content": build_prompt(chunk)}],
                "max_tokens": 4096,
                "temperature": 0.1,
            },
            timeout=(10, 120),  # reduced timeout: 10s connect, 120s read
        )

        if response.status_code != 200:
            print(f"OpenRouter error on chunk {index + 1}: {response.status_code} - {response.text}")
            return (index, None)

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return (index, content if content else None)

    except requests.exceptions.Timeout:
        print(f"Chunk {index + 1} timed out")
        return (index, None)
    except Exception as e:
        print(f"Chunk {index + 1} error: {e}")
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

    # ── Hard size limit ──────────────────────────────────────
    if len(script) > MAX_SIZE:
        return jsonify({
            "error": f"Script too large ({len(script):,} chars). Maximum allowed is {MAX_SIZE:,} characters."
        }), 413

    print(f"Script size: {len(script):,} characters")

    try:
        chunks = chunk_script(script)
        print(f"Split into {len(chunks)} chunk(s)")

        # ── Parallel processing with gevent ─────────────────
        pool = Pool(PARALLEL_POOL)
        jobs = [
            pool.spawn(call_openrouter, chunk, i, len(chunks))
            for i, chunk in enumerate(chunks)
        ]
        gevent.joinall(jobs, timeout=150)  # wait max 150s for all chunks

        # Collect results in original order
        raw_results = [job.value for job in jobs if job.value is not None]
        ordered = sorted(raw_results, key=lambda x: x[0])  # sort by chunk index
        all_results = [text for _, text in ordered if text]

        if not all_results:
            return jsonify({"error": "AI returned an empty response. Please try again."}), 500

        # ── Detect language from first valid result ──────────
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


# ── Streaming endpoint (optional — use for real-time UI feedback) ──
@app.route("/analyze/stream", methods=["POST"])
def analyze_stream():
    """
    Streams partial results back to the client as each chunk finishes.
    Frontend can listen with EventSource or fetch + ReadableStream.
    """
    data = request.get_json()
    if not data or "script" not in data:
        return jsonify({"error": "No script provided"}), 400

    script = data["script"]

    if not OPENROUTER_API_KEY:
        return jsonify({"error": "OPENROUTER_API_KEY not configured"}), 500

    if len(script) > MAX_SIZE:
        return jsonify({"error": f"Script too large. Max {MAX_SIZE:,} chars."}), 413

    chunks = chunk_script(script)

    def generate():
        pool = Pool(PARALLEL_POOL)
        jobs = [pool.spawn(call_openrouter, chunk, i, len(chunks)) for i, chunk in enumerate(chunks)]

        completed = set()
        while len(completed) < len(jobs):
            for idx, job in enumerate(jobs):
                if idx not in completed and job.ready():
                    completed.add(idx)
                    result = job.value
                    if result:
                        _, text = result
                        payload = json.dumps({
                            "chunk_index": idx,
                            "total_chunks": len(chunks),
                            "text": text,
                        })
                        yield f"data: {payload}\n\n"
            gevent.sleep(0.1)  # small poll interval

        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)