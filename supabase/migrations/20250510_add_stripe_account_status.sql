-- Add stripe_account_status to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_status text;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.stripe_account_status IS 'Status of the Stripe account: pending, verified, restricted, or null if not connected';

-- Create an enum type for stripe account status
DO $$ BEGIN
    CREATE TYPE stripe_account_status_enum AS ENUM ('pending', 'verified', 'restricted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
