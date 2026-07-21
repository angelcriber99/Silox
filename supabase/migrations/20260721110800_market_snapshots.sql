CREATE TABLE public.market_snapshots (
    ticker text PRIMARY KEY,
    market_date text NOT NULL,
    price numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
