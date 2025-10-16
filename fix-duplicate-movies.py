#!/usr/bin/env python3
"""
Fix duplicate movies and missing thumbnails
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('backend/.env')

def fix_movies():
    """Fix duplicate movies"""

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
    print("1. Fetching all movies...")
    response = supabase.table('content').select('*').order('created_at', desc=True).execute()

    movies = response.data
    print(f"   Found {len(movies)} movies\n")

    # Find duplicates
    print("2. Finding duplicates...")
    titles = {}
    for movie in movies:
        title = movie['title']
        if title in titles:
            titles[title].append(movie)
        else:
            titles[title] = [movie]

    duplicates = {k: v for k, v in titles.items() if len(v) > 1}

    if duplicates:
        print(f"   Found {len(duplicates)} duplicate titles\n")

        for title, movie_list in duplicates.items():
            print(f"\n   Fixing: {title}")

            # Sort by created_at (oldest first)
            movie_list.sort(key=lambda x: x['created_at'])

            # Keep the OLDEST one (usually the PUBLISHED one with complete data)
            keep_movie = movie_list[0]
            delete_movies = movie_list[1:]

            print(f"     KEEP: ID={keep_movie['id'][:8]}... Status={keep_movie.get('status')} Created={keep_movie.get('created_at')}")

            # Update the kept movie to PUBLISHED if it's not
            if keep_movie.get('status') != 'PUBLISHED':
                print(f"     Updating status to PUBLISHED...")
                supabase.table('content').update({'status': 'PUBLISHED'}).eq('id', keep_movie['id']).execute()

            # Copy thumbnail if missing
            if not keep_movie.get('thumbnail_url') and keep_movie.get('poster_url'):
                print(f"     Adding thumbnail (using poster)...")
                supabase.table('content').update({'thumbnail_url': keep_movie['poster_url']}).eq('id', keep_movie['id']).execute()

            # Delete duplicates
            for dup in delete_movies:
                print(f"     DELETE: ID={dup['id'][:8]}... Status={dup.get('status')} Created={dup.get('created_at')}")

                # Delete associated purchases first
                supabase.table('purchases').delete().eq('content_id', dup['id']).execute()

                # Delete the duplicate content
                supabase.table('content').delete().eq('id', dup['id']).execute()

    else:
        print("   No duplicates found\n")

    # Fix missing thumbnails
    print("\n3. Fixing missing thumbnails...")
    response = supabase.table('content').select('id, title, poster_url, thumbnail_url').is_('thumbnail_url', 'null').execute()

    movies_without_thumbs = response.data

    if movies_without_thumbs:
        print(f"   Found {len(movies_without_thumbs)} movies without thumbnails")

        for movie in movies_without_thumbs:
            if movie.get('poster_url'):
                print(f"     Fixing: {movie['title']}")
                supabase.table('content').update({'thumbnail_url': movie['poster_url']}).eq('id', movie['id']).execute()

    else:
        print("   All movies have thumbnails")

    # Ensure all movies are PUBLISHED
    print("\n4. Ensuring all movies are PUBLISHED...")
    response = supabase.table('content').select('id, title, status').neq('status', 'PUBLISHED').execute()

    non_published = response.data

    if non_published:
        print(f"   Found {len(non_published)} non-PUBLISHED movies")

        for movie in non_published:
            print(f"     Publishing: {movie['title']} (was {movie.get('status')})")
            supabase.table('content').update({'status': 'PUBLISHED'}).eq('id', movie['id']).execute()
    else:
        print("   All movies are PUBLISHED")

    print("\nDone!")
    return True

if __name__ == '__main__':
    print("=" * 80)
    print("Fix Duplicate Movies and Missing Data")
    print("=" * 80)
    print()

    fix_movies()
