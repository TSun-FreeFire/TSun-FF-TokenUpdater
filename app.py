"""
Flask web application for TSun Token Fetcher Dashboard.
Provides a beautiful web interface with real-time updates.
"""

from flask import Flask, render_template, jsonify, Response
from dotenv import load_dotenv
import asyncio
import threading
import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from core.token_fetcher import run_token_fetch, LogCollector

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Global state
job_state = {
    'status': 'idle',  # idle, running, completed
    'current_run': None,
    'last_run': None,
    'history': [],
    'stats': {},
    'log_collector': LogCollector()
}

HISTORY_FILE = Path('data/run_history.json')


def load_history():
    """Load run history from file."""
    HISTORY_FILE.parent.mkdir(exist_ok=True)
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, 'r') as f:
                data = json.load(f)
                job_state['history'] = data.get('runs', [])[-10:]  # Keep last 10
                job_state['last_run'] = data.get('last_run')
        except Exception:
            pass


def save_history():
    """Save run history to file."""
    HISTORY_FILE.parent.mkdir(exist_ok=True)
    try:
        with open(HISTORY_FILE, 'w') as f:
            json.dump({
                'runs': job_state['history'][-10:],
                'last_run': job_state['last_run']
            }, f, indent=2)
    except Exception:
        pass


def run_async_job():
    """Run token fetch in background thread."""
    def async_wrapper():
        job_state['status'] = 'running'
        job_state['current_run'] = {
            'started_at': datetime.now().isoformat(),
            'run_number': len(job_state['history']) + 1
        }
        job_state['stats'] = {
            'completed': 0,
            'total': 0,
            'success': 0,
            'failed': 0,
            'timed_out': 0,
            'current_region': 'Initializing...'
        }
        job_state['log_collector'].add("🚀 Starting new token fetch run", "info")
        
        # Run async task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(run_token_fetch(job_state['log_collector']))
            
            # Update state
            job_state['status'] = 'completed'
            job_state['last_run'] = {
                **job_state['current_run'],
                'completed_at': datetime.now().isoformat(),
                'result': result,
                'elapsed': result.get('elapsed', 0)
            }
            
            # Add to history
            job_state['history'].append(job_state['last_run'])
            save_history()
            
            job_state['current_run'] = None
            
        except Exception as e:
            job_state['status'] = 'error'
            job_state['log_collector'].add(f"❌ Critical error: {str(e)}", "error")
        finally:
            loop.close()
            # Reset to idle after 10 seconds
            time.sleep(10)
            job_state['status'] = 'idle'
    
    thread = threading.Thread(target=async_wrapper, daemon=True)
    thread.start()


@app.route('/')
def dashboard():
    """Render the main dashboard."""
    return render_template('dashboard.html')


@app.route('/api/run', methods=['GET', 'POST'])
def trigger_run():
    """Trigger a token fetch (called by cron or manual button)."""
    if job_state['status'] == 'running':
        return jsonify({'status': 'already_running'}), 409
    
    run_async_job()
    return jsonify({'status': 'started'}), 200


@app.route('/api/status')
def get_status():
    """Get current job status."""
    return jsonify({
        'status': job_state['status'],
        'current_run': job_state['current_run'],
        'last_run': job_state['last_run'],
        'stats': job_state['stats']
    })


@app.route('/api/logs')
def stream_logs():
    """Server-Sent Events endpoint for log streaming."""
    def generate():
        last_count = 0
        while True:
            logs = job_state['log_collector'].get_recent(100)
            current_count = len(logs)
            
            if current_count > last_count:
                # Send new logs
                new_logs = logs[last_count:]
                for log in new_logs:
                    yield f"data: {json.dumps(log)}\n\n"
                last_count = current_count
            
            time.sleep(0.5)  # Poll every 500ms
    
    return Response(generate(), mimetype='text/event-stream')


@app.route('/api/history')
def get_history():
    """Get run history."""
    return jsonify({
        'history': job_state['history'][-10:],
        'last_run': job_state['last_run']
    })


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


# Load history on startup
load_history()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)