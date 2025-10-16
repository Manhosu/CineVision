#!/usr/bin/env python3
import requests
import json

API_KEY = "rnd_YSVYzEamaF7ZQWJFZ4OLAXRnDHrK"
SERVICE_ID = "srv-d3mp4ibipnbc73ctm470"
BASE_URL = "https://api.render.com/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

print("=" * 80)
print("FIXING RENDER START COMMAND")
print("=" * 80)

# Update start command
url = f"{BASE_URL}/services/{SERVICE_ID}"
data = {
    "startCommand": "npm run start:prod"
}

print("\n[*] Updating start command to: npm run start:prod")
response = requests.patch(url, headers=headers, json=data)

if response.status_code == 200:
    print("[OK] Start command updated successfully!")

    # Verify the update
    verify_response = requests.get(url, headers=headers)
    if verify_response.status_code == 200:
        service = verify_response.json()
        start_cmd = service.get("serviceDetails", {}).get("envSpecificDetails", {}).get("startCommand", "")
        build_cmd = service.get("serviceDetails", {}).get("envSpecificDetails", {}).get("buildCommand", "")

        print("\n[VERIFIED] Current Configuration:")
        print(f"  Build Command: {build_cmd}")
        print(f"  Start Command: {start_cmd}")

        # Trigger new deploy
        print("\n[*] Triggering new deploy...")
        deploy_url = f"{BASE_URL}/services/{SERVICE_ID}/deploys"
        deploy_data = {"clearCache": "do_not_clear"}

        deploy_response = requests.post(deploy_url, headers=headers, json=deploy_data)
        if deploy_response.status_code in [200, 201]:
            deploy = deploy_response.json()
            deploy_id = deploy.get("id", "")
            print(f"[OK] Deploy triggered successfully! Deploy ID: {deploy_id}")
            print(f"[URL] Monitor at: https://dashboard.render.com/web/{SERVICE_ID}")
        else:
            print(f"[ERROR] Failed to trigger deploy: {deploy_response.status_code}")
            print(deploy_response.text)
else:
    print(f"[ERROR] Failed to update start command: {response.status_code}")
    print(response.text)

print("\n" + "=" * 80)
