# TSun JWT Token Auto-Updater with GitHub Integration

Automated script to fetch JWT tokens for Free Fire accounts and automatically push them to GitHub repository every 6 hours.

## Features

- ✅ Auto-detects all `accounts_{server}.json` files from the `accounts/` folder
- ✅ Fetches JWT tokens concurrently with retry logic and exponential backoff
- ✅ Automatically pushes updated tokens to GitHub repository
- ✅ Runs continuously with 6-hour refresh intervals
- ✅ Cleans up local token files after successful GitHub upload
- ✅ Supports multiple regions/servers (pk, ind, br, bd, us, etc.)

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure GitHub Personal Access Token

Create a GitHub Personal Access Token with `repo` permissions:
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scope: `repo` (Full control of private repositories)
4. Copy the generated token

Set the token as an environment variable:

**Windows (PowerShell):**
```powershell
$env:GITHUB_TOKEN = "your_github_personal_access_token_here"
```

**Windows (CMD):**
```cmd
set GITHUB_TOKEN=your_github_personal_access_token_here
```

**Linux/Mac:**
```bash
export GITHUB_TOKEN="your_github_personal_access_token_here"
```

**Or use the alternative variable name `GPH`:**
```powershell
$env:GPH = "your_github_personal_access_token_here"
```

### 3. Prepare Account Files

Place your account JSON files in the `accounts/` folder with the naming pattern:
- `accounts_pk.json` → Will create `token_pk.json` on GitHub
- `accounts_ind.json` → Will create `token_ind.json` on GitHub
- `accounts_br.json` → Will create `token_br.json` on GitHub
- `accounts_bd.json` → Will create `token_bd.json` on GitHub
- `accounts_us.json` → Will create `token_us.json` on GitHub

**Account file format:**
```json
[
  {
    "uid": 4293441911,
    "password": "password_here",
    "accountId": "13882506893",
    "accountNickname": "nickname"
  }
]
```

### 4. Run the Script

```bash
python app.py
```

## Configuration

Edit `app.py` to customize:

```python
# Scheduler interval (hours)
SCHEDULE_INTERVAL_HOURS = 6

# Concurrent API requests
MAX_CONCURRENT_REQUESTS = 100

# Retry settings
MAX_RETRIES = 15
INITIAL_DELAY = 5
MAX_DELAY = 120

# GitHub repository settings
GITHUB_REPO_OWNER = "TSun-FreeFire"
GITHUB_REPO_NAME = "TSun-FreeFire-Storage"
GITHUB_BRANCH = "main"
GITHUB_BASE_PATH = "Spam-api"
```

## GitHub File Paths

Tokens are automatically pushed to:
```
https://raw.githubusercontent.com/TSun-FreeFire/TSun-FreeFire-Storage/refs/heads/main/Spam-api/token_{server}.json
```

Example URLs:
- `token_pk.json` → `.../Spam-api/token_pk.json`
- `token_ind.json` → `.../Spam-api/token_ind.json`
- `token_br.json` → `.../Spam-api/token_br.json`

## How It Works

1. **Startup**: Script scans `accounts/` folder for all `accounts_*.json` files
2. **Token Fetching**: For each account file, fetches JWT tokens concurrently from the API
3. **Retry Logic**: Failed requests are retried up to 15 times with exponential backoff
4. **Local Save**: Tokens are temporarily saved to `tokens/token_{server}.json`
5. **GitHub Push**: Updated tokens are pushed to GitHub repository, replacing old content
6. **Cleanup**: Local token files are deleted after successful GitHub push
7. **Sleep**: Script waits 6 hours before the next refresh cycle
8. **Repeat**: Process continues indefinitely

## Error Handling

- **API Failures**: Retries up to 15 times with exponential backoff (5s to 120s delays)
- **GitHub Push Failures**: Retries up to 15 times, keeps local file if all attempts fail
- **Network Issues**: Handles timeouts, connection errors, and JSON decode errors
- **Partial Failures**: Continues processing other regions even if one fails

## Logs

The script provides detailed logging:
- ✅ Success messages for token fetches and GitHub pushes
- ⚠️ Warnings for retries and non-critical errors
- ❌ Error messages for failures
- 💀 Final failure messages after max retries
- 🗑️ Cleanup confirmation messages

## Troubleshooting

**No GitHub token found:**
- Ensure `GITHUB_TOKEN` or `GPH` environment variable is set
- Token must have `repo` permissions

**Files not detected:**
- Ensure files follow naming pattern: `accounts_{server}.json`
- Place files in the `accounts/` folder

**GitHub push fails:**
- Verify token permissions
- Check repository exists and is accessible
- Ensure branch name is correct (default: `main`)

## Notes

- Local `tokens/` folder is used only temporarily and cleaned after GitHub push
- Script runs continuously - use Ctrl+C to stop
- Each region is processed independently
- Failed accounts are logged but don't stop the entire process