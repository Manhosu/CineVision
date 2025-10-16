#!/usr/bin/env python3
import requests
import sys

API_KEY = "rnd_YSVYzEamaF7ZQWJFZ4OLAXRnDHrK"
SERVICE_ID = "srv-d3mp4ibipnbc73ctm470"
BASE_URL = "https://api.render.com/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def get_latest_deploy():
    """Get the latest deploy"""
    url = f"{BASE_URL}/services/{SERVICE_ID}/deploys"
    response = requests.get(url, headers=headers, params={"limit": 1})

    if response.status_code == 200:
        deploys = response.json()
        if deploys:
            return deploys[0]["deploy"]
    return None

def get_build_logs(deploy_id):
    """Get build logs using events endpoint"""
    url = f"{BASE_URL}/services/{SERVICE_ID}/events"
    response = requests.get(url, headers=headers, params={"limit": 100})

    if response.status_code == 200:
        events = response.json()
        print("\n" + "=" * 80)
        print(f"BUILD LOGS FOR DEPLOY: {deploy_id}")
        print("=" * 80)

        for event in events:
            timestamp = event.get("timestamp", "")
            event_type = event.get("type", "")
            message = event.get("message", "")

            # Print relevant build events
            if any(keyword in message.lower() for keyword in ["build", "error", "fail", "npm", "nest"]):
                print(f"[{timestamp}] {event_type}: {message}")

        return True
    else:
        print(f"[ERROR] Failed to get events: {response.status_code}")
        return False

def main():
    print("Fetching latest deploy information...")

    deploy = get_latest_deploy()
    if not deploy:
        print("[ERROR] Could not fetch latest deploy")
        sys.exit(1)

    deploy_id = deploy.get("id")
    status = deploy.get("status")
    commit_id = deploy.get("commitId", "")

    print(f"\n[DEPLOY ID] {deploy_id}")
    print(f"[STATUS] {status}")
    print(f"[COMMIT] {commit_id}")

    # Get events/logs
    get_build_logs(deploy_id)

    # Also check service details
    print("\n" + "=" * 80)
    print("CURRENT SERVICE CONFIGURATION:")
    print("=" * 80)

    url = f"{BASE_URL}/services/{SERVICE_ID}"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        service = response.json()
        build_cmd = service.get("serviceDetails", {}).get("envSpecificDetails", {}).get("buildCommand", "")
        start_cmd = service.get("serviceDetails", {}).get("envSpecificDetails", {}).get("startCommand", "")

        print(f"Build Command: {build_cmd}")
        print(f"Start Command: {start_cmd}")

if __name__ == "__main__":
    main()
