FROM python:3.11-slim

WORKDIR /app

# # Install system dependencies
# RUN apt-get update && apt-get install -y \
#     ffmpeg \
#     && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application files
COPY . .

EXPOSE 3000

# Default command runs the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]

