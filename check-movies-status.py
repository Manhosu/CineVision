#!/usr/bin/env python3
"""
Check movies status in database
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('backend/.env')

def check_movies():
    """Check movies and their status"""

    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE credentials not found")
        return False

    print(f"Connecting to Supabase: {supabase_url}\n")

    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Get all movies
    print("Fetching all movies...")
    response = supabase.table('content').select('id, title, poster_url, thumbnail_url, status, created_at').order('created_at', desc=True).limit(20).execute()

    movies = response.data
    print(f"Found {len(movies)} movies\n")

    print("=" * 90)
    print(f"{'Title':<40} {'Status':<15} {'Has Poster':<12} {'Has Thumb':<12}")
    print("=" * 90)

    for movie in movies:
        title = movie['title'][:38] if movie['title'] else 'N/A'
        status = movie.get('status', 'N/A')
        has_poster = 'YES' if movie.get('poster_url') else 'NO'
        has_thumb = 'YES' if movie.get('thumbnail_url') else 'NO'

        print(f"{title:<40} {status:<15} {has_poster:<12} {has_thumb:<12}")

    # Check for duplicates
    print("\n\nChecking for duplicate titles...")
    response = supabase.rpc('check_duplicate_titles').execute()

    # Manual check
    titles = {}
    for movie in movies:
        title = movie['title']
        if title in titles:
            titles[title].append(movie['id'])
        else:
            titles[title] = [movie['id']]

    duplicates = {k: v for k, v in titles.items() if len(v) > 1}

    if duplicates:
        print("\nFound duplicates:")
        for title, ids in duplicates.items():
            print(f"\n  '{title}' - {len(ids)} copies:")
            for movie_id in ids:
                movie_data = next(m for m in movies if m['id'] == movie_id)
                print(f"    - ID: {movie_id}")
                print(f"      Status: {movie_data.get('status')}")
                print(f"      Created: {movie_data.get('created_at')}")
    else:
        print("  No duplicates found")

    # Check test user purchases
    print("\n\nChecking test user purchases...")
    response = supabase.table('users').select('id').eq('email', 'cinevision@teste.com').execute()

    if response.data:
        user_id = response.data[0]['id']

        response = supabase.table('purchases').select('id, content_id, status').eq('user_id', user_id).execute()
        purchases = response.data

        print(f"User has {len(purchases)} purchases")

        # Match with movies
        purchased_movie_ids = [p['content_id'] for p in purchases]
        purchased_movies = [m for m in movies if m['id'] in purchased_movie_ids]

        print("\nPurchased movies:")
        for movie in purchased_movies:
            print(f"  - {movie['title']} (Status: {movie.get('status')})")

    return True

if __name__ == '__main__':
    print("=" * 100)
    print("Movie Status Check")
    print("=" * 100)
    print()

    check_movies()
