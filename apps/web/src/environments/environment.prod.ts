export const environment = {
  production: true,
  apiUrl: 'https://spectyra.up.railway.app/v1',
  supabaseUrl: process.env['SUPABASE_URL'] || '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] || '',
};
