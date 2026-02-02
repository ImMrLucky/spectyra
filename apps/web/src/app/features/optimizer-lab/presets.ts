/**
 * Demo Presets for Optimizer Lab
 * 
 * These presets are designed to produce meaningful savings
 * and demonstrate Spectyra's optimization capabilities.
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
 * A long customer support conversation with:
 * - Repeated context and boilerplate
 * - Multiple turns with similar information
 * - Common phrases that can be encoded
 * 
 * Expected savings: 25-40%
 */
export const CHAT_DEMO_PRESET: DemoPreset = {
  name: 'Customer Support Conversation',
  description: 'Long support chat with repeated context',
  demoType: 'chat',
  optimizationLevel: 'balanced',
  prompt: `You are a helpful customer support assistant for Acme Cloud Services. You help customers with billing, technical issues, and account management. Always be polite, professional, and thorough in your responses.

Previous conversation context:
- Customer: John Smith (john.smith@example.com)
- Account ID: ACM-12345
- Plan: Business Pro ($99/month)
- Support Tier: Premium (24/7 support, priority response)
- Account Status: Active since January 2023
- Payment Method: Visa ending in 4242
- Recent invoices: Jan $99, Feb $99, Mar $99

Conversation History:

[TURN 1]
Customer: Hi, I'm having trouble with my billing. I was charged twice this month.

Support: Hello John! Thank you for reaching out to Acme Cloud Services support. I can see you're on our Business Pro plan ($99/month) with Premium support tier. I'm sorry to hear about the double charge - that's definitely not right. Let me look into your account (ACM-12345) right away.

[TURN 2]
Customer: Yes, please check. I see two charges of $99 on my credit card statement.

Support: I understand your concern about seeing two $99 charges, John. I'm reviewing your account ACM-12345 now. I can confirm you're on the Business Pro plan at $99/month. Looking at your recent invoices from January, February, and March - each showing $99. Let me check the payment processing logs to identify the duplicate charge.

[TURN 3]
Customer: Any updates? This is really frustrating.

Support: I completely understand your frustration, John. For a valued customer like yourself on our Business Pro plan with Premium support, we want to resolve this quickly. I've identified the issue in your account (ACM-12345) - there was indeed a duplicate charge of $99 on March 15th. I'm initiating a refund right now.

[TURN 4]
Customer: When will I see the refund?

Support: Great question, John. For your account ACM-12345, the refund of $99 has been initiated. Since you're paying with your Visa ending in 4242, the refund typically takes 5-7 business days to appear on your statement. As a Business Pro customer with Premium support, you'll also receive an email confirmation within the next hour.

[TURN 5]
Customer: Thanks. Also, can you explain what happened so it doesn't happen again?

Support: Absolutely, John. Here's what happened with your account ACM-12345: Our billing system experienced a brief glitch on March 15th that affected approximately 50 Business Pro customers. This caused duplicate $99 charges for that billing cycle. We've since implemented additional safeguards to prevent this from recurring. As a Premium support customer, you'll be notified proactively if we ever detect any billing anomalies. Is there anything else I can help you with today regarding your Acme Cloud Services account?

[CURRENT TURN]
Customer: No, that explains it. Thanks for the help!

Please provide a closing response that summarizes the resolution and offers any additional assistance.`,
};

/**
 * Code Demo Preset
 * 
 * A coding agent prompt with:
 * - Repeated file contents across context
 * - Large code blocks that can be compressed
 * - Build logs and error messages
 * 
 * Expected savings: 30-50%
 */
export const CODE_DEMO_PRESET: DemoPreset = {
  name: 'Repository Bug Fix',
  description: 'Coding agent with repo context and error logs',
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

File: src/services/auth/tokenGenerator.ts
\`\`\`typescript
import jwt from 'jsonwebtoken';
import { JWTConfig } from '../../config/jwt.config';

interface UserData {
  userId: string;
  email: string;
}

export function generateToken(user: UserData): string {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    JWTConfig.secret,
    { expiresIn: JWTConfig.expiresIn }
  );
}

export function generateRefreshToken(user: UserData): string {
  return jwt.sign(
    { userId: user.userId, email: user.email, type: 'refresh' },
    JWTConfig.refreshSecret,
    { expiresIn: JWTConfig.refreshExpiresIn }
  );
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

Previous context from this conversation:
- We identified that the issue is in tokenValidator.ts
- The validation is checking expiry but may have timezone issues
- Date.now() returns milliseconds, jwt exp is in seconds
- Server logs show discrepancy between expected and actual expiry

Additional file context (repeated for reference):
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
\`\`\`

Note: The tokenValidator.ts file is doing redundant expiry checking since jwt.verify already handles expiry. This could be causing issues if there's clock skew.`,
};
