#!/usr/bin/env python3
import requests
import time
import sys

API_KEY = "rnd_YSVYzEamaF7ZQWJFZ4OLAXRnDHrK"
SERVICE_ID = "srv-d3mp4ibipnbc73ctm470"
DEPLOY_ID = "dep-d3mpt4pr0fns738i8deg"
BASE_URL = "https://api.render.com/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

print("=" * 80)
print(f"MONITORING DEPLOY: {DEPLOY_ID}")
print("=" * 80)

last_status = None
attempts = 0
max_attempts = 60  # 10 minutes

while attempts < max_attempts:
    url = f"{BASE_URL}/services/{SERVICE_ID}/deploys/{DEPLOY_ID}"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        deploy = response.json()
        status = deploy.get("status", "unknown")

        if status != last_status:
            print(f"\n[{time.strftime('%H:%M:%S')}] STATUS: {status}")
            last_status = status

            # Show additional info on status changes
            if "finishedAt" in deploy and deploy["finishedAt"]:
                print(f"  Finished at: {deploy['finishedAt']}")

        # Check for completion
        if status == "live":
            print("\n" + "=" * 80)
            print("[SUCCESS] DEPLOY COMPLETED SUCCESSFULLY!")
            print("=" * 80)
            print(f"Service URL: https://cinevisionn.onrender.com")
            print(f"Health Check: https://cinevisionn.onrender.com/api/v1/status")
            sys.exit(0)

        elif status in ["build_failed", "update_failed", "deactivated", "canceled"]:
            print("\n" + "=" * 80)
            print(f"[FAILED] DEPLOY FAILED WITH STATUS: {status}")
            print("=" * 80)

            # Try to get events
            events_url = f"{BASE_URL}/services/{SERVICE_ID}/events"
            events_response = requests.get(events_url, headers=headers, params={"limit": 20})

            if events_response.status_code == 200:
                events = events_response.json()
                print("\nRECENT EVENTS:")
                print("-" * 80)
                for event in events[:10]:
                    msg = event.get("message", "")
                    timestamp = event.get("timestamp", "")
                    if any(k in msg.lower() for k in ["error", "fail", "exit"]):
                        print(f"[{timestamp}] {msg}")

            sys.exit(1)

    else:
        print(f"[ERROR] Failed to get deploy status: {response.status_code}")

    time.sleep(10)
    attempts += 1
    print(".", end="", flush=True)

print("\n[TIMEOUT] Deploy monitoring timed out after 10 minutes")
sys.exit(1)
