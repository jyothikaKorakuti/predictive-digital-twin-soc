/*
# Fix user creation: trigger search_path + admin RLS policies

## Root Cause
The `handle_new_user()` trigger function is SECURITY DEFINER but has no `search_path`
configured. Supabase rejects such functions during auth.signUp, causing the
"Database error saving new user" error. Additionally, RLS policies on `profiles`
only allow `auth.uid() = id`, so an admin cannot set the role on a newly created
user's profile.

## Changes
1. Recreate `handle_new_user()` with `set search_path = public, pg_catalog`
2. Add admin-update policy so admins can update any profile's role
3. Add admin-insert policy so admins can create profiles for invited users
4. Keep existing self-update and self-insert policies intact
*/

-- 1. Recreate handle_new_user with explicit search_path (SECURITY DEFINER requirement)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'analyst')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Add admin policies: admins can update any profile (for role assignment)
-- First drop existing policies to rebuild cleanly
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- SELECT: all authenticated users can see all profiles (needed for Users page)
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO authenticated USING (true);

-- INSERT: users can insert their own profile (trigger does this),
-- and admins can insert profiles for invited users
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_admin"
ON profiles FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- UPDATE: users can update their own profile, admins can update any
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
