from flask import Flask, Response, request
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
    # Attendre suffisamment longtemps pour que Streamlit soit opérationnel
    time.sleep(10)
    logging.info("Streamlit devrait être opérationnel.")

@app.after_request
def apply_csp(response):
    # Ajoute le header CSP pour autoriser Teams
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.teams.microsoft.com https://*.office.com;"
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def proxy(path):
    streamlit_url = f"http://127.0.0.1:8501/{path}"
    if request.query_string:
        streamlit_url += f"?{request.query_string.decode()}"
    try:
        logging.info("Proxying vers : %s", streamlit_url)
        # Récupère la réponse complète de Streamlit
        r = requests.get(streamlit_url)
        content = r.content
        # Crée une réponse Flask en fixant le Content-Length correctement
        response = Response(content, status=r.status_code)
        for key, value in r.headers.items():
            # Exclut les headers problématiques
            if key.lower() not in ['content-length', 'transfer-encoding']:
                response.headers[key] = value
        # Définit le Content-Length en fonction de la taille réelle du contenu
        response.headers['Content-Length'] = len(content)
        return apply_csp(response)
    except Exception as e:
        logging.error("Erreur lors du proxying : %s", e)
        return f"Erreur de connexion avec Streamlit : {e}", 500

if __name__ == '__main__':
    threading.Thread(target=run_streamlit).start()
    app.run(host="0.0.0.0", port=8000)
