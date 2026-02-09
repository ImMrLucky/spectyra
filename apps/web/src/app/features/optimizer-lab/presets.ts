/**
 * Demo Presets for Optimizer Lab
 *
 * These presets are tuned to look like realistic prompts a team might send,
 * not "stress test" mega-prompts. Savings will vary based on how much history,
 * tool output, and repeated context is included.
 */

export interface DemoPreset {
  name: string;
  description: string;
  demoType: 'chat' | 'code';
  prompt: string;
  repoContext?: string;
  optimizationLevel?: 'safe' | 'balanced' | 'aggressive';
}

/**
 * Chat Demo Preset
 *
 * A realistic support thread (moderate repetition + policy boilerplate).
 */
export const CHAT_DEMO_PRESET: DemoPreset = {
  name: 'Customer Support Conversation',
  description: 'Realistic support chat (moderate repetition + policy boilerplate)',
  demoType: 'chat',
  optimizationLevel: 'balanced',
  prompt: `You are a helpful customer support assistant for Acme Cloud Services.

Account context (from CRM):
- Customer: John Smith (john.smith@example.com)
- Account ID: ACM-12345
- Plan: Business Pro ($99/month)
- Payment method: Visa ending in 4242
- Support tier: Premium

Policy reminders (repeat as needed):
- Do not request passwords or full card numbers.
- Refunds typically appear in 5–7 business days.

Conversation so far:

[TURN 1]
Customer: Hi—my card shows two charges for $99 from Acme Cloud this month. Can you help?

Support: Thanks for reaching out, John. I can help. I see account ACM-12345 on Business Pro ($99/month) with Visa ending in 4242. I’m going to check billing events for the duplicate charge. (Please don’t share full card details.)

[TURN 2]
Customer: It’s definitely two separate pending charges. I’m worried it’ll post twice.

Support: Understood. I’m reviewing the last invoice and payment attempt logs for ACM-12345. If it posted twice, we’ll refund immediately. Refunds typically appear in 5–7 business days after processing.

[TURN 3]
Customer: Any update? Also—why did this happen?

Support: I found a duplicate authorization attempt tied to the March invoice. One charge is a pending authorization that should drop off automatically; the other is the actual capture for $99. I can also trigger a proactive refund if both post. Root cause looks like a transient payment gateway retry.

[CURRENT TURN]
Customer: Ok. If both post, can you refund right away and email me confirmation?

Please write a concise closing response that:
- Confirms what we found (authorization vs capture)
- States what we’ll do if both post (refund + confirmation email)
- Restates the 5–7 business day timeline
- Offers next help`,
};

/**
 * Code Demo Preset
 *
 * A realistic “bug fix” prompt: error log + small set of relevant files.
 */
export const CODE_DEMO_PRESET: DemoPreset = {
  name: 'Repository Bug Fix',
  description: 'Coding agent prompt with logs + relevant file excerpts',
  demoType: 'code',
  optimizationLevel: 'balanced',
  prompt: `Fix the authentication bug in the user service. Users are getting 401 errors when their JWT tokens should still be valid.

Error from production logs:
\`\`\`
2024-03-15 10:23:45 ERROR [UserService] Token validation failed
  at validateToken (src/services/auth/tokenValidator.ts:45)
  at authenticate (src/middleware/auth.ts:23)
  at processRequest (src/server.ts:89)
  
Error: JWT expired
Token issued: 2024-03-15 08:00:00
Token expiry: 2024-03-15 09:00:00 (configured: 1 hour)
Current time: 2024-03-15 10:23:45
\`\`\`

Additional error from user reports:
\`\`\`
2024-03-15 10:24:12 ERROR [UserService] Token validation failed
  at validateToken (src/services/auth/tokenValidator.ts:45)
  at authenticate (src/middleware/auth.ts:23)
  at processRequest (src/server.ts:89)
  
Error: JWT expired
Token issued: 2024-03-15 09:30:00
Token expiry: 2024-03-15 10:30:00 (configured: 1 hour)
Current time: 2024-03-15 10:24:12

Note: Token should NOT be expired based on the times shown. 
This suggests a timezone or clock sync issue.
\`\`\`

Requirements:
1. Fix the JWT validation bug
2. Add proper timezone handling
3. Ensure backward compatibility
4. Add tests for the fix`,
  repoContext: `Repository Structure:
\`\`\`
src/
├── services/
│   └── auth/
│       ├── tokenValidator.ts
│       ├── tokenGenerator.ts
│       └── types.ts
├── middleware/
│   ├── auth.ts
│   └── errorHandler.ts
├── config/
│   └── jwt.config.ts
└── server.ts
\`\`\`

File: src/services/auth/tokenValidator.ts
\`\`\`typescript
import jwt from 'jsonwebtoken';
import { JWTConfig } from '../../config/jwt.config';

interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function validateToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, JWTConfig.secret) as TokenPayload;
    
    // Check if token is expired
    const now = Date.now() / 1000;
    if (decoded.exp < now) {
      throw new Error('JWT expired');
    }
    
    return decoded;
  } catch (error) {
    console.error('[TokenValidator] Validation failed:', error);
    throw error;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    const now = Date.now() / 1000;
    return decoded.exp < now;
  } catch {
    return true;
  }
}
\`\`\`

File: src/config/jwt.config.ts
\`\`\`typescript
export const JWTConfig = {
  secret: process.env.JWT_SECRET || 'dev-secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  expiresIn: '1h',
  refreshExpiresIn: '7d',
  issuer: 'acme-auth-service',
  audience: 'acme-api',
};
\`\`\`

File: src/middleware/auth.ts
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import { validateToken } from '../services/auth/tokenValidator';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = await validateToken(token);
    req.user = payload;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Authentication failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
\`\`\`

Note: jwt.verify() already validates expiry. A second manual expiry check can create false expirations when there is clock skew or time unit mismatch.`,
};
