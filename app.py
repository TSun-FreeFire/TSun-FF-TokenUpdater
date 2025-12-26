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
import os
from pathlib import Path
from datetime import datetime, timedelta
from core.token_fetcher import run_token_fetch, LogCollector
import db

# Load environment variables
load_dotenv()

# Initialize Database
db.init_db()

# Detect serverless environment (Vercel)
IS_SERVERLESS = os.getenv('VERCEL') == '1' or os.getenv('AWS_LAMBDA_FUNCTION_NAME') is not None

app = Flask(__name__)

# Global state
job_state = {
    'status': 'idle',  # idle, running, completed
    'current_run': None,
    'last_run': None,
    'history': [],
    'stats': {},
    'log_collector': LogCollector(),
    'is_serverless': IS_SERVERLESS
}

def load_history():
    """Load run history from database only."""
    # Load from Neon database
    db_history = db.get_history(limit=10)
    if db_history:
        job_state['history'] = db_history
        if db_history:
            job_state['last_run'] = db_history[0]
    else:
        # Initialize empty if no database history
        job_state['history'] = []
        job_state['last_run'] = None


def run_sync_job():
    """Run token fetch synchronously (for serverless environments)."""
    job_state['status'] = 'running'
    job_state['current_run'] = {
        'started_at': datetime.now().isoformat(),
        'run_number': len(job_state['history']) + 1
    }
    job_state['log_collector'].add("🚀 Starting new token fetch run (serverless mode)", "info")
    
    # Save to Database at START
    run_id = db.save_run(
        job_state['current_run']['run_number'], 
        job_state['current_run']['started_at'],
        'running'
    )
    
    def on_region_complete(region_result):
        if run_id:
            db.save_region_result(
                run_id, region_result['region'], region_result['total'], 
                region_result['success'], region_result['failed'], 
                region_result.get('timed_out', 0), region_result['success_rate'], 
                region_result['duration']
            )

    # Run async task with timeout
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Serverless timeout: 50 seconds max
        result = loop.run_until_complete(
            asyncio.wait_for(
                run_token_fetch(job_state['log_collector'], job_state['stats'], on_region_complete), 
                timeout=50
            )
        )
        
        # Update state
        job_state['status'] = 'completed'
        job_state['last_run'] = {
            **job_state['current_run'],
            'completed_at': datetime.now().isoformat(),
            'result': result,
            'elapsed': result.get('elapsed', 0)
        }
        
        # Update run completion in Database
        if run_id:
            db.update_run_completion(run_id, job_state['last_run']['completed_at'], job_state['last_run']['elapsed'])

        # History is managed by database, no need to append to state
        job_state['current_run'] = None
        
        return {'status': 'completed', 'result': result}
        
    except asyncio.TimeoutError:
        job_state['status'] = 'timeout'
        if run_id:
            db.update_run_completion(run_id, datetime.now().isoformat(), 50, 'timeout')
        job_state['log_collector'].add("⏱️ Serverless timeout (50s) - partial results saved", "warning")
        return {'status': 'timeout', 'message': 'Execution timed out after 50s'}
    
    except Exception as e:
        job_state['status'] = 'error'
        if run_id:
            db.update_run_completion(run_id, datetime.now().isoformat(), 0, 'error')
        job_state['log_collector'].add(f"❌ Critical error: {str(e)}", "error")
        return {'status': 'error', 'message': str(e)}
    
    finally:
        loop.close()


def run_async_job():
    """Run token fetch in background thread (for local development)."""
    def async_wrapper():
        job_state['status'] = 'running'
        job_state['current_run'] = {
            'started_at': datetime.now().isoformat(),
            'run_number': len(job_state['history']) + 1
        }
        job_state['log_collector'].add("🚀 Starting new token fetch run", "info")
        
        # Save to Database at START
        run_id = db.save_run(
            job_state['current_run']['run_number'], 
            job_state['current_run']['started_at'],
            'running'
        )
        
        def on_region_complete(region_result):
            if run_id:
                db.save_region_result(
                    run_id, region_result['region'], region_result['total'], 
                    region_result['success'], region_result['failed'], 
                    region_result.get('timed_out', 0), region_result['success_rate'], 
                    region_result['duration']
                )

        # Run async task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                run_token_fetch(job_state['log_collector'], job_state['stats'], on_region_complete)
            )
            
            # Update state
            job_state['status'] = 'completed'
            job_state['last_run'] = {
                **job_state['current_run'],
                'completed_at': datetime.now().isoformat(),
                'result': result,
                'elapsed': result.get('elapsed', 0)
            }
            
            # Update run completion in Database
            if run_id:
                db.update_run_completion(run_id, job_state['last_run']['completed_at'], job_state['last_run']['elapsed'])

            # History is managed by database, no need to append to state
            job_state['current_run'] = None
            
        except Exception as e:
            job_state['status'] = 'error'
            if run_id:
                db.update_run_completion(run_id, datetime.now().isoformat(), 0, 'error')
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
    
    if IS_SERVERLESS:
        # Serverless: execute synchronously and return result
        result = run_sync_job()
        return jsonify(result), 200
    else:
        # Local: execute in background thread
        run_async_job()
        return jsonify({'status': 'started'}), 200


@app.route('/api/status')
def get_status():
    """Get current job status."""
    # Filter out non-serializable objects from stats
    serializable_stats = {k: v for k, v in job_state['stats'].items() if k != 'rate_limit_manager'}
    
    return jsonify({
        'status': job_state['status'],
        'current_run': job_state['current_run'],
        'last_run': job_state['last_run'],
        'stats': serializable_stats,
        'is_serverless': IS_SERVERLESS,
        'mode': 'serverless' if IS_SERVERLESS else 'local'
    })


@app.route('/api/logs')
def stream_logs():
    """Server-Sent Events endpoint for log streaming."""
    if IS_SERVERLESS:
        # Serverless: return current logs as JSON (no streaming)
        return jsonify({
            'logs': job_state['log_collector'].get_recent(100),
            'message': 'Serverless mode - use polling instead of SSE'
        })
    
    # Local: use SSE streaming
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
    """Get run history from database or state."""
    db_history = db.get_history(limit=10)
    if db_history:
        return jsonify({
            'history': db_history,
            'last_run': db_history[0] if db_history else None
        })
        
    return jsonify({
        'history': job_state['history'][-10:],
        'last_run': job_state['last_run']
    })


@app.route('/health')
def health():
    """Enhanced health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "environment": "serverless" if IS_SERVERLESS else "local",
        "github": {
            "configured": bool(os.getenv('GITHUB_TOKEN') or os.getenv('GPH') or os.getenv('VERCEL_GITHUB_TOKEN')),
            "repo": f"{os.getenv('GITHUB_REPO_OWNER', 'TSun-FreeFire')}/{os.getenv('GITHUB_REPO_NAME', 'TSun-FreeFire-Storage')}",
            "path": os.getenv('GITHUB_BASE_PATH', 'Spam-api')
        },
        "api_endpoints": [
            "https://jwt.tsunstudio.pw/v1/auth/saeed",
            "https://tsun-ff-jwt-api.onrender.com/v1/auth/saeed",
            "https://jwt-tsunstudio.onrender.com/v1/auth/saeed"
        ],
        "configuration": {
            "max_concurrent": 100,
            "max_retries": 15,
            "timeout_per_account": "180s",
            "batch_timeout": "1200s"
        },
        "last_run": job_state['last_run']
    })


# Load history on startup
load_history()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)