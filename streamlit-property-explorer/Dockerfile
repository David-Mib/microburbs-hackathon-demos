# Container image for hosts that run Docker (e.g. Vercel's container runtime).
# The API key comes from the MICROBURBS_API_KEY environment variable at runtime;
# it is never baked into the image.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY microburbs.py streamlit_app.py ./
COPY .streamlit/config.toml .streamlit/config.toml

# The host sets $PORT; default to 80. sh -c lets $PORT expand in exec form.
CMD ["sh", "-c", "exec streamlit run streamlit_app.py --server.port ${PORT:-80} --server.address 0.0.0.0 --server.headless true --browser.gatherUsageStats false"]
