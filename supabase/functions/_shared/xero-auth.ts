/**
 * Shared Xero OAuth token management helpers.
 * Follows the same pattern as Google Calendar token refresh in calendar-sync-lesson.
 */

export async function refreshXeroToken(
  supabase: any,
  connectionId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = Deno.env.get('XERO_CLIENT_ID');
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Xero credentials not configured');
    return null;
  }

  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Xero token refresh failed:', errorText);
    await supabase
      .from('xero_connections')
      .update({ sync_status: 'error' })
      .eq('id', connectionId);
    return null;
  }

  const tokens = await response.json();
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

  await supabase
    .from('xero_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, // Xero rotates refresh tokens
      token_expires_at: tokenExpiresAt.toISOString(),
    })
    .eq('id', connectionId);

  return tokens.access_token;
}

export async function getValidXeroToken(
  supabase: any,
  connection: any,
): Promise<string | null> {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    return await refreshXeroToken(supabase, connection.id, connection.refresh_token);
  }

  return connection.access_token;
}
