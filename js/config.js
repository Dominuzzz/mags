// js/config.js — Supabase connection
const SUPABASE_URL = 'https://poqjtjltfagaiajsbjhi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcWp0amx0ZmFnYWlhanNiamhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzY0MTQsImV4cCI6MjA5MjYxMjQxNH0.31BZNU-_Zi3opmpUpbDfX8bVRcFxOErSv6guNvSEa1Q';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
