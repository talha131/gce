#!/bin/bash

# Activate virtual environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Virtual environment not found. Please run 'uv pip install -r requirements.txt' or create a venv first."
    exit 1
fi

# Run the grader
python main.py "$@"
