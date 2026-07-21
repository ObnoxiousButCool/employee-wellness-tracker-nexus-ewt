FROM python:3.10-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir \
    "Flask>=2.2.2" \
    "Flask-Bcrypt>=1.0.1" \
    "Flask-Cors>=3.0.10" \
    "Flask-SQLAlchemy>=3.0.2" \
    "psycopg2-binary>=2.9.5"

COPY backend /app/backend

ENV FLASK_APP=backend.app:create_app
EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
