from flask import Flask, Response, request
import subprocess
import threading
import requests

app = Flask(__name__)

@app.after_request
def apply_csp(response: Response):
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' https://*.teams.microsoft.com https://*.office.com;"
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def proxy(path):
    # Proxy vers Streamlit
    streamlit_url = f"http://localhost:8501/{path}"
    if request.query_string:
        streamlit_url += f"?{request.query_string.decode()}"

    streamlit_response = requests.get(streamlit_url)
    resp = Response(streamlit_response.content, status=streamlit_response.status_code)
    for k, v in streamlit_response.headers.items():
        resp.headers[k] = v
    return apply_csp(resp)

def run_streamlit():
    subprocess.Popen(["streamlit", "run", "main.py", "--server.port", "8501", "--server.address", "127.0.0.1"])

if __name__ == '__main__':
    threading.Thread(target=run_streamlit).start()
    app.run(host="0.0.0.0", port=8000)
