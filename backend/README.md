- Virtual environment setup
``` bash
CAUGSA $ python3.8 -m venv .venv
CAUGSA $ source .venv/bin/activate

(.venv)backend $ pip install --upgrade pip
(.venv)backend $ pip install Flask flask-cors mariadb flask-jwt-extended
```