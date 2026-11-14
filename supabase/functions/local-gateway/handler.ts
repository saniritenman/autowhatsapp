export function validFile(owner: string, path: unknown) {
  if (typeof path !== 'string') return false;
  const segments = path.split('/');
  return segments.length === 3 && segments[0] === owner &&
    /^[a-f0-9-]{36}$/.test(segments[1]) &&
    /^[A-Za-z0-9._-]+$/.test(segments[2]) &&
    !['.', '..'].includes(segments[2]);
}
function only(value: any, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) {
    throw Error('Invalid fields');
  }
}
export function createGateway(db: any) {
  async function checked(query: any) {
    const result = await query;
    if (result.error) throw Error('Database operation failed');
    return result.data;
  }
  return async function handle(req: Request) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const token = req.headers.get('x-aw-computer-token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return new Response('Unauthorized', { status: 401 });
    try {
      const owner = await checked(db.rpc('aw_computer_owner', { candidate: token }));
      if (!owner) return new Response('Unauthorized', { status: 401 });
      const raw = await req.text();
      if (raw.length > 100000) return new Response('Request too large', { status: 413 });
      const input = JSON.parse(raw);
      if (input.op === 'identity') return Response.json({ data: owner });
      if (input.op === 'file') {
        if (!validFile(owner, input.path)) throw Error('File ownership mismatch');
        const blob = await checked(db.storage.from('autowhatsapp').download(input.path));
        return new Response(blob, { headers: { 'Content-Type': blob.type, 'Cache-Control': 'no-store' } });
      }
      if (input.op === 'rpc') {
        const args = input.args || {};
        let data;
        if (input.name === 'aw_claim_web') {
          if (args.account !== owner) throw Error('Wrong account');
          data = await checked(db.rpc('aw_claim_web', { account: owner }));
        } else if (input.name === 'aw_web_lease') {
          if (args.account !== owner) throw Error('Wrong account');
          data = await checked(db.rpc('aw_web_lease', { account: owner, instance: args.instance }));
        } else if (input.name === 'aw_finish') {
          const job = await checked(db.from('aw_jobs').select('id').eq('id', args.jid).eq('owner_id', owner).eq('payload->>transport', 'web').maybeSingle());
          if (!job) throw Error('Job unavailable');
          if (args.following !== null && !Number.isFinite(Date.parse(args.following))) throw Error('Invalid date');
          data = await checked(db.rpc('aw_finish', { jid: args.jid, following: args.following }));
        } else throw Error('Unsupported RPC');
        return Response.json({ data });
      }
      if (input.op !== 'table') throw Error('Unsupported operation');
      const { table, action, filters = {}, data: values } = input;
      if (!['aw_connections', 'aw_jobs', 'aw_parts', 'aw_schedules'].includes(table)) throw Error('Unsupported table');
      only(filters, ['id', 'job_id', 'ordinal', 'provider_id', 'owner_id', 'instance_id', 'command_id']);
      if (filters.owner_id && filters.owner_id !== owner) throw Error('Wrong owner');
      let query;
      if (table === 'aw_parts') {
        if (action === 'upsert') {
          only(values, ['job_id', 'ordinal']);
          if (!Number.isInteger(values.ordinal) || values.ordinal < 0 || values.ordinal > 1) throw Error('Invalid part');
          const job = await checked(db.from('aw_jobs').select('id').eq('id', values.job_id).eq('owner_id', owner).eq('payload->>transport', 'web').maybeSingle());
          if (!job) throw Error('Wrong job owner');
          return Response.json({ data: await checked(db.from('aw_parts').upsert(values, { onConflict: 'job_id,ordinal', ignoreDuplicates: true })) });
        }
        let lookup = db.from('aw_parts').select('*,aw_jobs!inner(owner_id,payload)').eq('aw_jobs.owner_id', owner).eq('aw_jobs.payload->>transport', 'web');
        for (const [key, value] of Object.entries(filters)) lookup = lookup.eq(key, value);
        const parts = await checked(lookup);
        if (action === 'select') {
          const clean = parts.map(({ aw_jobs, ...part }: any) => part);
          return Response.json({ data: input.single ? clean[0] || null : clean });
        }
        if (action !== 'update' || parts.length !== 1 || !filters.id) throw Error('One part required');
        only(values, ['status', 'provider_id', 'delivery', 'error']);
        query = db.from('aw_parts').update(values).eq('id', parts[0].id);
      } else {
        if (action === 'select') query = db.from(table).select('*').eq('owner_id', owner);
        else if (action === 'update') {
          if (table === 'aw_connections') {
            only(values, ['status', 'qr_data', 'qr_expires_at', 'phone', 'heartbeat_at', 'sending_enabled', 'command', 'lease_until']);
            if (values.qr_data && (!values.qr_data.startsWith('data:image/png;base64,') || values.qr_data.length > 50000)) throw Error('Invalid QR');
            if (values.lease_until && Date.parse(values.lease_until) > Date.now() + 10000) throw Error('Use lease operation');
          } else if (table === 'aw_jobs') {
            only(values, ['status', 'available_at', 'error']);
            if (!filters.id) throw Error('Job id required');
          } else throw Error('Computer cannot edit schedules');
          query = db.from(table).update(values).eq('owner_id', owner);
        } else throw Error('Unsupported action');
        if (table === 'aw_jobs') query = query.eq('payload->>transport', 'web');
        for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      }
      if (action === 'select' && input.single) query = query.maybeSingle();
      return Response.json({ data: await checked(query) });
    } catch {
      return Response.json({ error: { message: 'Computer operation rejected. Check pairing and ownership.' } }, { status: 400 });
    }
  };
}
