import os

class HeaderToEnvMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        # Dans WSGI, les en-têtes HTTP sont préfixés par HTTP_ et en majuscules
        principal = environ.get("HTTP_X_MS_CLIENT_PRINCIPAL")
        if principal:
            os.environ["X_MS_CLIENT_PRINCIPAL"] = principal
        return self.app(environ, start_response)
