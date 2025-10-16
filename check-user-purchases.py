#!/usr/bin/env python3
"""
Check user purchases and fix missing ones
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('backend/.env')

def check_and_fix_purchases():
    """Check and fix user purchases"""

    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE credentials not found")
        return False

    print(f"Connecting to Supabase: {supabase_url}\n")

    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Find test user
    print("1. Finding test user...")
    response = supabase.table('users').select('id, email').eq('email', 'cinevision@teste.com').execute()

    if not response.data or len(response.data) == 0:
        print("ERROR: Test user not found")
        return False

    user = response.data[0]
    print(f"   User: {user['email']}")
    print(f"   ID: {user['id']}")

    # Get all PUBLISHED movies
    print("\n2. Fetching all PUBLISHED movies...")
    response = supabase.table('content').select('id, title, status').eq('status', 'PUBLISHED').order('created_at', desc=True).execute()

    all_movies = response.data
    print(f"   Found {len(all_movies)} PUBLISHED movies")

    # Get user's purchases
    print("\n3. Checking user purchases...")
    response = supabase.table('purchases').select('content_id').eq('user_id', user['id']).eq('status', 'paid').execute()

    purchased_ids = [p['content_id'] for p in response.data]
    print(f"   User has {len(purchased_ids)} purchases")

    # Find movies WITHOUT purchases
    missing_purchases = [m for m in all_movies if m['id'] not in purchased_ids and m['title'] != 'Superman']

    if missing_purchases:
        print(f"\n4. Creating {len(missing_purchases)} missing purchases...")

        for movie in missing_purchases:
            print(f"   Creating purchase for: {movie['title']}")

            purchase = {
                'user_id': user['id'],
                'content_id': movie['id'],
                'preferred_delivery': 'site',
                'status': 'paid',
                'amount_cents': 695,
                'currency': 'BRL'
            }

            try:
                supabase.table('purchases').insert(purchase).execute()
                print(f"     OK - Created")
            except Exception as e:
                print(f"     ERROR: {str(e)}")
    else:
        print("\n4. All movies already purchased (except Superman)")

    # Delete Superman purchase if exists
    print("\n5. Removing Superman purchase...")
    superman = next((m for m in all_movies if m['title'] == 'Superman'), None)

    if superman:
        result = supabase.table('purchases').delete().eq('user_id', user['id']).eq('content_id', superman['id']).execute()
        if result.data:
            print(f"   OK - Removed Superman purchase")
        else:
            print(f"   - Superman was not purchased")

    # Show final summary
    print("\n6. Final summary...")
    response = supabase.table('purchases').select('content_id').eq('user_id', user['id']).eq('status', 'paid').execute()

    final_purchased_ids = [p['content_id'] for p in response.data]
    final_movies = [m for m in all_movies if m['id'] in final_purchased_ids]

    print(f"\n   User now has access to {len(final_movies)} movies:")
    for movie in final_movies:
        print(f"     - {movie['title']}")

    return True

if __name__ == '__main__':
    print("=" * 80)
    print("Check and Fix User Purchases")
    print("=" * 80)
    print()

    check_and_fix_purchases()
