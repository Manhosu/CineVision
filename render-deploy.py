#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import requests
import json
import time
import sys

API_KEY = "rnd_YSVYzEamaF7ZQWJFZ4OLAXRnDHrK"
SERVICE_ID = "srv-d3mp4ibipnbc73ctm470"
BASE_URL = "https://api.render.com/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def update_service():
    """Update service build and start commands"""
    print("[*] Updating service configuration...")
    url = f"{BASE_URL}/services/{SERVICE_ID}"
    data = {
        "buildCommand": "npm ci --no-audit --no-fund && npm run build && npm prune --production",
        "startCommand": "npm run start:prod"
    }

    response = requests.patch(url, headers=headers, json=data)
    if response.status_code == 200:
        print("[OK] Service configuration updated successfully!")
        return True
    else:
        print(f"[ERROR] Failed to update service: {response.status_code}")
        print(response.text)
        return False

def trigger_deploy():
    """Trigger a new deploy"""
    print("\n[*] Triggering new deploy...")
    url = f"{BASE_URL}/services/{SERVICE_ID}/deploys"
    data = {"clearCache": "clear"}

    response = requests.post(url, headers=headers, json=data)
    if response.status_code in [200, 201]:
        deploy_data = response.json()
        deploy_id = deploy_data.get("id")
        print(f"[OK] Deploy triggered! Deploy ID: {deploy_id}")
        return deploy_id
    else:
        print(f"[ERROR] Failed to trigger deploy: {response.status_code}")
        print(response.text)
        return None

def get_deploy_status(deploy_id):
    """Get deploy status and logs"""
    url = f"{BASE_URL}/services/{SERVICE_ID}/deploys/{deploy_id}"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        return response.json()
    return None

def monitor_deploy(deploy_id):
    """Monitor deploy progress"""
    print(f"\n[*] Monitoring deploy {deploy_id}...")
    print("=" * 60)

    last_status = None
    attempts = 0
    max_attempts = 60  # 10 minutes max

    while attempts < max_attempts:
        deploy_info = get_deploy_status(deploy_id)

        if deploy_info:
            status = deploy_info.get("status")

            if status != last_status:
                print(f"\n[STATUS] {status}")
                last_status = status

            if status == "live":
                print("\n[OK] Deploy completed successfully!")
                print("[URL] https://cinevisionn.onrender.com")
                return True
            elif status in ["build_failed", "update_failed", "deactivated"]:
                print(f"\n[ERROR] Deploy failed with status: {status}")
                return False

        time.sleep(10)
        attempts += 1
        print(".", end="", flush=True)

    print("\n[TIMEOUT] Timeout waiting for deploy to complete")
    return False

def get_deploy_logs(deploy_id):
    """Get deploy logs"""
    print(f"\n[*] Fetching deploy logs...")
    url = f"{BASE_URL}/services/{SERVICE_ID}/deploys/{deploy_id}/logs"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        logs = response.json()
        print("\n" + "=" * 60)
        print("DEPLOY LOGS:")
        print("=" * 60)
        for log in logs:
            timestamp = log.get("timestamp", "")
            message = log.get("message", "")
            print(f"{timestamp}: {message}")
        return True
    else:
        print(f"[ERROR] Failed to fetch logs: {response.status_code}")
        return False

def main():
    print("Render Deploy Manager - CineVision Backend")
    print("=" * 60)

    # Step 1: Update service configuration
    if not update_service():
        sys.exit(1)

    # Step 2: Trigger deploy
    deploy_id = trigger_deploy()
    if not deploy_id:
        sys.exit(1)

    # Step 3: Monitor deploy
    success = monitor_deploy(deploy_id)

    # Step 4: Get logs
    get_deploy_logs(deploy_id)

    if success:
        print("\n" + "=" * 60)
        print("[SUCCESS] DEPLOY COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("[FAILED] DEPLOY FAILED - Check logs above for details")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
