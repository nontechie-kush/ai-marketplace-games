'use client';

export default function GlobalError({ error, reset }) {
  console.error('[global-error]', error); // shows full stack in Vercel logs
  return (
    <html>
      <body style={{background:'#111',color:'#fff',fontFamily:'Inter,system-ui',padding:'24px'}}>
        <h1>Something broke during server render</h1>
        <p><b>Name:</b> {error?.name || 'Error'}</p>
        <p><b>Message:</b> {error?.message || 'Unknown'}</p>
        {'digest' in error ? <p><b>Digest:</b> {error.digest}</p> : null}
        <button onClick={() => reset()} style={{padding:'8px 12px',marginTop:'12px'}}>Try again</button>
      </body>
    </html>
  );
}
