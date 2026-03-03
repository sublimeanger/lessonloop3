-- Enable realtime for make_up_waitlist and organisations tables (1.5, 8.1)
ALTER PUBLICATION supabase_realtime ADD TABLE public.make_up_waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organisations;
