# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (example: build tools)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc

# Copy the requirements file first to leverage Docker cache
COPY requirements.txt .

# Upgrade pip first
RUN python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple --timeout=600

# Install any needed packages specified in requirements.txt
# RUN pip install --no-cache-dir -r requirements.txt
RUN pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --timeout=600

# Copy the rest of the application code (including wsgi.py)
COPY . .

# Make port 5000 available (Gunicorn will bind to this)
EXPOSE 5000

# Define the command to run Gunicorn
# Adjust the number of workers (-w) based on your server's resources (e.g., 2 * CPU cores + 1)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "-w", "4", "wsgi:app"] 