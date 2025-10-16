#!/usr/bin/env python3
"""
Setup test purchases for cinevision@teste.com user
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

# Load environment variables
load_dotenv('backend/.env')

def setup_test_purchases():
    """Create purchases for test user"""

    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE credentials not found")
        return False

    print(f"Connecting to Supabase: {supabase_url}")

    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Find test user
    print("\n1. Finding test user...")
    response = supabase.table('users').select('id, email').eq('email', 'cinevision@teste.com').execute()

    if not response.data or len(response.data) == 0:
        print("ERROR: Test user not found")
        return False

    user = response.data[0]
    print(f"   User: {user['email']}")
    print(f"   ID: {user['id']}")

    # Get recent movies
    print("\n2. Fetching recent movies...")
    response = supabase.table('content').select('id, title, price_cents').order('created_at', desc=True).limit(10).execute()

    movies = response.data
    print(f"   Found {len(movies)} recent movies")

    # Create purchases
    print("\n3. Creating purchases...")
    created_count = 0
    skipped_count = 0

    for movie in movies:
        # Check if purchase already exists
        existing = supabase.table('purchases').select('id').eq('user_id', user['id']).eq('content_id', movie['id']).execute()

        if existing.data and len(existing.data) > 0:
            print(f"   SKIP: {movie['title']}")
            skipped_count += 1
            continue

        # Create purchase
        try:
            purchase = {
                'user_id': user['id'],
                'content_id': movie['id'],
                'preferred_delivery': 'site',
                'status': 'paid',
                'amount_cents': movie.get('price_cents', 695),
                'currency': 'BRL'
            }

            result = supabase.table('purchases').insert(purchase).execute()

            if result.data:
                print(f"   OK: {movie['title']}")
                created_count += 1
            else:
                print(f"   ERROR: {movie['title']}")

        except Exception as e:
            print(f"   ERROR: {movie['title']} - {str(e)}")

    print(f"\nSummary:")
    print(f"  Created: {created_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total: {len(movies)}")

    return True

if __name__ == '__main__':
    print("=" * 60)
    print("Setup Test Purchases")
    print("=" * 60)
    print()

    if setup_test_purchases():
        print("\nDone! Test user now has access to recent movies.")
    else:
        print("\nFailed to setup test purchases")
