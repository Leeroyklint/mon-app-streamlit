import sys
import streamlit.web.cli
from middleware import HeaderToEnvMiddleware

def run_streamlit():
    """
    Configure les arguments et lance Streamlit pour exécuter main.py.
    """
    sys.argv = [
        "streamlit", "run", "main.py",
        "--server.port=8000",
        "--server.address=0.0.0.0"
    ]
    # Lance Streamlit en mode script (cette fonction bloque)
    streamlit.web.cli._main_run_clExplicit("main.py", [])

def wsgi_streamlit_app(environ, start_response):
    """
    Application WSGI minimale qui lance Streamlit.
    Note : run_streamlit() bloque, cette fonction est donc principalement pour le lancement.
    """
    run_streamlit()
    start_response('200 OK', [('Content-Type', 'text/html')])
    return [b"Streamlit terminé"]

# Appliquer le middleware pour copier l'en-tête dans os.environ
wsgi_app = HeaderToEnvMiddleware(wsgi_streamlit_app)
