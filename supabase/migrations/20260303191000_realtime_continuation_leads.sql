-- Enable realtime for term_continuation_responses and leads tables (4.3, 7.1)
ALTER PUBLICATION supabase_realtime ADD TABLE public.term_continuation_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
