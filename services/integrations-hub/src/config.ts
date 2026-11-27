import 'dotenv/config';

function csv(name: string, fallback: string): string[] {
  const raw = process.env[name] || fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 3102),
  pocketbaseUrl: (process.env.POCKETBASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, ''),
  pocketbaseAdminToken: process.env.POCKETBASE_ADMIN_TOKEN || '',
  serviceSecret: process.env.INTEGRATIONS_SERVICE_SECRET || '',
  allowedOrigins: csv('ALLOWED_ORIGINS', '*'),
  quickbooks: {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
    environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    webhookVerifier: process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN || '',
    apiBase(env: 'sandbox' | 'production') {
      return env === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';
    },
  },
  wagepoint: {
    clientId: process.env.WAGEPOINT_CLIENT_ID || '',
    clientSecret: process.env.WAGEPOINT_CLIENT_SECRET || '',
  },
};
