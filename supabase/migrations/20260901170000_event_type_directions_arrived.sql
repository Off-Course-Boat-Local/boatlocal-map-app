-- New event_type value: a guest who tapped "Walking directions" for a
-- place and then physically arrived (GPS proximity — see
-- ARRIVAL_THRESHOLD_METERS in src/components/guest/GuestMapScreen.tsx).
-- Pairs with the existing (previously never-fired) 'directions_requested'
-- value for a real requested->arrived funnel on Admin's Platform analytics
-- and Studio's own Report page.
alter type public.event_type add value 'directions_arrived';
