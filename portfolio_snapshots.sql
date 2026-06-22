-- Create portfolio_snapshots table
CREATE TABLE public.portfolio_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_invested NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date) -- Only one snapshot per user per day
);

-- Enable Row Level Security
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own snapshots"
    ON public.portfolio_snapshots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots"
    ON public.portfolio_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots"
    ON public.portfolio_snapshots FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots"
    ON public.portfolio_snapshots FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster querying by user and date
CREATE INDEX idx_portfolio_snapshots_user_date ON public.portfolio_snapshots(user_id, date);
