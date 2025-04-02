from flask import Flask, Response, request
import subprocess
import threading
import requests
import time

app = Flask(__name__)

def run_streamlit():
    subprocess.Popen([
        "streamlit", "run", "main.py",
        "--server.port", "8501",
        "--server.address", "127.0.0.1"
    ])
    # Attendre que Streamlit soit prêt
    time.sleep(5)

@app.after_request
def apply_csp(response):
    # Injecte le header pour permettre l'intégration dans Teams
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.teams.microsoft.com https://*.office.com;"
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def proxy(path):
    streamlit_url = f"http://127.0.0.1:8501/{path}"
    if request.query_string:
        streamlit_url += f"?{request.query_string.decode()}"
    try:
        streamlit_response = requests.get(streamlit_url)
        response = Response(streamlit_response.content, streamlit_response.status_code)
        for key, value in streamlit_response.headers.items():
            # Évite de réinjecter certains headers comme Content-Length pour éviter des conflits
            if key.lower() != 'content-length':
                response.headers[key] = value
        return apply_csp(response)
    except Exception as e:
        return f"Erreur de connexion avec Streamlit : {e}", 500

if __name__ == '__main__':
    threading.Thread(target=run_streamlit).start()
    app.run(host="0.0.0.0", port=8000)
