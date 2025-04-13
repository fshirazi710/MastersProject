# Gunicorn configuration file
import multiprocessing
import os 

max_requests = 1000
max_requests_jitter = 50

log_file = "-"

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

worker_class = "uvicorn.workers.UvicornWorker"
workers = (multiprocessing.cpu_count() * 2) + 1