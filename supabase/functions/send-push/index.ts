import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Send push notification to a user via their registered device tokens.
 *
 * Expected body:
 * {
 *   userId: string,
 *   title: string,
 *   body: string,
 *   data?: Record<string, string>  // e.g. { type: 'new_message', conversationId: '...' }
 * }
 *
 * For production, consider using Firebase Cloud Messaging (FCM) or OneSignal
 * as an intermediary that handles both APNs (iOS) and FCM (Android) delivery.
 * This edge function serves as the trigger point for either approach.
 */
Deno.serve(async (req: Request) => {
  // CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { userId, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'userId, title, and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get the user's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ sent: false, reason: 'token_fetch_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'no_token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results: Array<{ platform: string; success: boolean; error?: string }> = [];

    for (const { token, platform } of tokens) {
      if (platform === 'android') {
        // Send via FCM (Firebase Cloud Messaging)
        const fcmKey = Deno.env.get('FCM_SERVER_KEY');
        if (!fcmKey) {
          results.push({ platform, success: false, error: 'FCM_SERVER_KEY not configured' });
          continue;
        }

        try {
          const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${fcmKey}`,
            },
            body: JSON.stringify({
              to: token,
              notification: { title, body },
              data: data || {},
            }),
          });
          const fcmResult = await fcmResponse.json();
          results.push({ platform, success: fcmResult.success === 1 });
        } catch (err) {
          results.push({ platform, success: false, error: String(err) });
        }
      } else if (platform === 'ios') {
        // Send via APNs (Apple Push Notification service)
        // NOTE: For production, use FCM or OneSignal as an intermediary.
        // Direct APNs requires HTTP/2 + JWT signing with Apple developer keys.
        //
        // Required Supabase secrets:
        //   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID
        //
        // For now, log and skip — integrate with your preferred push service.
        const apnsKeyId = Deno.env.get('APNS_KEY_ID');
        if (!apnsKeyId) {
          results.push({
            platform,
            success: false,
            error: 'APNs not configured — use FCM or OneSignal for iOS push',
          });
          continue;
        }

        // Placeholder for direct APNs integration
        // In production, either:
        // 1. Use FCM's APNs relay (recommended) — just send via FCM with the APNs token
        // 2. Use OneSignal REST API
        // 3. Implement HTTP/2 APNs directly with Deno
        results.push({ platform, success: false, error: 'Direct APNs not yet implemented' });
      }
    }

    return new Response(
      JSON.stringify({ sent: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
