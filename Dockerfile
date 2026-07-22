FROM python:3.10-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
# Defect 10: install the same dependency set used by the backend.
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

ENV FLASK_APP=backend.app:create_app
EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
