#!/usr/bin/env python3
"""
Apply analytics migration to Supabase database
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('backend/.env')

def apply_analytics_migration():
    """Apply the analytics tables migration"""

    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
        return False

    print(f"🔗 Connecting to Supabase: {supabase_url}")

    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Read migration file
    migration_file = 'backend/src/database/migrations/20250106000001_create_analytics_tables.sql'

    print(f"📄 Reading migration: {migration_file}")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # Split SQL into individual statements
    # Remove comments and empty lines
    statements = []
    current_statement = []
    in_function = False

    for line in sql_content.split('\n'):
        stripped = line.strip()

        # Skip empty lines and comments
        if not stripped or stripped.startswith('--'):
            continue

        # Track when we're inside a function definition
        if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
            in_function = True

        current_statement.append(line)

        # Check for statement terminator
        if stripped.endswith(';'):
            if in_function and '$$;' in line:
                in_function = False
                statements.append('\n'.join(current_statement))
                current_statement = []
            elif not in_function:
                statements.append('\n'.join(current_statement))
                current_statement = []

    print(f"📋 Found {len(statements)} SQL statements to execute")

    # Execute each statement
    success_count = 0
    for i, statement in enumerate(statements, 1):
        statement = statement.strip()
        if not statement:
            continue

        try:
            # Get a preview of the statement (first 60 chars)
            preview = statement[:60].replace('\n', ' ') + '...'
            print(f"  [{i}/{len(statements)}] Executing: {preview}")

            # Execute using Supabase RPC
            result = supabase.rpc('exec_sql', {'query': statement}).execute()
            success_count += 1
            print(f"  ✅ Success")

        except Exception as e:
            error_msg = str(e)

            # Check if it's just a "relation already exists" error (can be ignored)
            if 'already exists' in error_msg.lower():
                print(f"  ⚠️  Warning: {error_msg}")
                success_count += 1
            else:
                print(f"  ❌ Error: {error_msg}")
                print(f"     Statement: {statement[:200]}...")

                # Ask if we should continue
                response = input("     Continue with remaining statements? (y/n): ")
                if response.lower() != 'y':
                    print("\n⛔ Migration aborted")
                    return False

    print(f"\n✅ Migration completed: {success_count}/{len(statements)} statements executed successfully")
    return True

if __name__ == '__main__':
    print("=" * 60)
    print("Analytics Tables Migration")
    print("=" * 60)
    print()

    if apply_analytics_migration():
        print("\n🎉 Analytics tables created successfully!")
        print("\nThe following features are now available:")
        print("  - Real-time user session tracking")
        print("  - Activity event logging")
        print("  - Live analytics dashboard")
        print("  - Viewer count for content")
    else:
        print("\n❌ Migration failed")
