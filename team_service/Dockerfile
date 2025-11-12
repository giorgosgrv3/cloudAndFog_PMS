FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copy *everything* in team_service/ into the container workdir
COPY . .

# Run the FastAPI app on port 8002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]