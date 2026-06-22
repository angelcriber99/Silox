-- Tabla de Alertas de Precio
CREATE TABLE public.alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    target_price NUMERIC NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
    triggered BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own alertas" 
    ON public.alertas FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alertas" 
    ON public.alertas FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alertas" 
    ON public.alertas FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alertas" 
    ON public.alertas FOR DELETE 
    USING (auth.uid() = user_id);

-- Para el Cron Job (Service Role Key se saltará las RLS)
