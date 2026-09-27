const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://wsorngsyowgxikiepice.supabase.co', 'sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm');

async function test() {
  const { data, error } = await sb.from('bands').select('*').limit(10);
  console.log(data, error);
}
test();
