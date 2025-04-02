from flask import Flask, Response, request, stream_with_context
import subprocess
import threading
import requests
import time
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

def run_streamlit():
    logging.info("Démarrage de Streamlit...")
    subprocess.Popen([
        "streamlit", "run", "main.py",
        "--server.port", "8501",
        "--server.address", "127.0.0.1"
    ])
    # Augmente le délai pour être sûr que Streamlit soit bien démarré
    time.sleep(10)
    logging.info("Streamlit devrait être opérationnel.")

@app.after_request
def apply_csp(response):
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.teams.microsoft.com https://*.office.com;"
    return response

def generate(streamlit_response):
    try:
        for chunk in streamlit_response.iter_content(chunk_size=1024):
            if chunk:
                yield chunk
    except Exception as e:
        yield f"Erreur lors du transfert des données : {e}".encode()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def proxy(path):
    streamlit_url = f"http://127.0.0.1:8501/{path}"
    if request.query_string:
        streamlit_url += f"?{request.query_string.decode()}"
    
    try:
        logging.info(f"Requête proxy vers : {streamlit_url}")
        # Utilise stream=True pour obtenir une réponse en streaming
        streamlit_response = requests.get(streamlit_url, stream=True)
        
        # Crée une réponse Flask en streaming
        response = Response(
            stream_with_context(generate(streamlit_response)),
            status=streamlit_response.status_code
        )
        
        # Copie les headers en ignorant Content-Length et Transfer-Encoding
        for key, value in streamlit_response.headers.items():
            if key.lower() not in ['content-length', 'transfer-encoding']:
                response.headers[key] = value
        
        return apply_csp(response)
    except Exception as e:
        logging.error(f"Erreur de connexion avec Streamlit : {e}")
        return f"Erreur de connexion avec Streamlit : {e}", 500

if __name__ == '__main__':
    threading.Thread(target=run_streamlit).start()
    app.run(host="0.0.0.0", port=8000)
