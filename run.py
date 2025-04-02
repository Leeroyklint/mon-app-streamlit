from flask import Flask, Response, request
import subprocess
import threading
import requests
import time
import logging
import socket

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

def wait_for_streamlit(timeout=30):
    """
    Attend que Streamlit soit disponible sur 127.0.0.1:8501.
    """
    start_time = time.time()
    while True:
        try:
            with socket.create_connection(("127.0.0.1", 8501), timeout=2):
                logging.info("Streamlit est opérationnel.")
                return
        except Exception as e:
            if time.time() - start_time > timeout:
                logging.error("Timeout en attendant que Streamlit démarre.")
                raise Exception("Timeout en attendant que Streamlit démarre.")
            time.sleep(1)

def run_streamlit():
    logging.info("Démarrage de Streamlit...")
    subprocess.Popen([
        "streamlit", "run", "main.py",
        "--server.port", "8501",
        "--server.address", "127.0.0.1"
    ])
    # Attend que Streamlit soit disponible
    wait_for_streamlit(timeout=30)
    logging.info("Streamlit devrait être opérationnel.")

@app.after_request
def apply_csp(response):
    # Injection du header CSP pour Teams
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.teams.microsoft.com https://*.office.com;"
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def proxy(path):
    streamlit_url = f"http://127.0.0.1:8501/{path}"
    if request.query_string:
        streamlit_url += f"?{request.query_string.decode()}"
    
    attempts = 0
    max_attempts = 5
    while attempts < max_attempts:
        try:
            logging.info("Proxying request vers : %s", streamlit_url)
            r = requests.get(streamlit_url, timeout=5)
            break
        except requests.exceptions.RequestException as e:
            attempts += 1
            logging.warning("Tentative %d : Erreur de connexion à Streamlit : %s", attempts, e)
            time.sleep(1)
    else:
        logging.error("Streamlit n'est pas disponible après %d tentatives.", max_attempts)
        return "Streamlit n'est pas disponible", 503

    content = r.content
    response = Response(content, status=r.status_code)
    for key, value in r.headers.items():
        # Exclut les headers problématiques
        if key.lower() not in ['content-length', 'transfer-encoding']:
            response.headers[key] = value
    # Définit le Content-Length en fonction du contenu réel
    response.headers['Content-Length'] = len(content)
    return apply_csp(response)

if __name__ == '__main__':
    # Lance Streamlit dans un thread séparé
    threading.Thread(target=run_streamlit).start()
    # Démarre Flask sur le port 8000
    app.run(host="0.0.0.0", port=8000)
