FROM python:3.11-slim
WORKDIR /srv
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements.txt
COPY osga ./osga
COPY app ./app
ENV CKPT=/models/best.pt
EXPOSE 8000
# mount your trained checkpoint (+ calibration.json) at /models:  docker run -v $PWD/runs/osga:/models -p 8000:8000 osga-api
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
