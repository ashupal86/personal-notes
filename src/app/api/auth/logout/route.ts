/** POST /api/auth/logout — clears the session cookie */
export async function POST() {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Set-Cookie', 'qa_api_key=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}
