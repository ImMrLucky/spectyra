# Spectyra — Supabase Email Configuration

## 1. Disable Email Confirmation (recommended)

Users should not need to verify their email to use Spectyra.

1. Go to **Supabase Dashboard** → your project
2. **Authentication** → **Providers** → **Email**
3. Toggle **OFF** "Confirm email"
4. Click **Save**

> Even with this disabled, the code includes a server-side auto-confirm
> fallback (`POST /v1/auth/auto-confirm`) so sign-up works either way.

## 2. Fix the Sender Name ("Supabase Auth" → "Spectyra")

### Option A: Custom SMTP (recommended for production)

1. Go to **Project Settings** → **Authentication** → **SMTP Settings**
2. Toggle **ON** "Enable Custom SMTP"
3. Fill in your SMTP provider details:

| Field | Example (Resend) | Example (SendGrid) |
|-------|-------------------|---------------------|
| Sender email | `noreply@spectyra.ai` | `noreply@spectyra.ai` |
| Sender name | `Spectyra` | `Spectyra` |
| Host | `smtp.resend.com` | `smtp.sendgrid.net` |
| Port | `465` | `587` |
| Username | `resend` | `apikey` |
| Password | *(your API key)* | *(your API key)* |

Recommended services (all have free tiers):
- **Resend** — resend.com (3,000 emails/month free, easy DNS setup)
- **Postmark** — postmarkapp.com (developer-friendly, great deliverability)
- **SendGrid** — sendgrid.com (100 emails/day free)

### Option B: Change Default Sender Name (no custom SMTP)

1. Go to **Project Settings** → **Authentication** → **SMTP Settings**
2. Change **Sender name** to `Spectyra`
3. Change **Sender email** to `noreply@spectyra.ai` (will still route through Supabase)

> Note: Without custom SMTP, the actual sending domain is still Supabase's,
> which may affect deliverability. Custom SMTP with your own domain is
> strongly recommended for production.

## 3. Update Email Templates

Paste the branded templates into the Supabase Dashboard:

1. Go to **Authentication** → **Email Templates**
2. For each template type, paste the corresponding HTML file:

| Template Type | File | Subject Line |
|---------------|------|-------------|
| Confirm signup | `confirm-signup.html` | Welcome to Spectyra — confirm your email |
| Magic Link | `magic-link.html` | Your Spectyra sign-in link |
| Reset Password | `reset-password.html` | Reset your Spectyra password |
| Change Email | `change-email.html` | Confirm your new Spectyra email |
| Invite User | `invite-user.html` | You're invited to join Spectyra |

3. Update the **Subject** field for each template as shown above
4. Click **Save** after each

## DNS Records (if using custom SMTP with spectyra.ai domain)

Add these DNS records to `spectyra.ai` for email deliverability:

- **SPF** — TXT record on root: `v=spf1 include:<your-smtp-provider> ~all`
- **DKIM** — TXT record provided by your SMTP service
- **DMARC** — TXT record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@spectyra.ai`
