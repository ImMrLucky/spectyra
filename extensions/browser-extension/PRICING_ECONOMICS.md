# Pricing Economics: Spectyra Keys Plan

## The Problem

**If users do a ton of conversations, Spectyra loses money.**

### Cost Analysis

**API Costs (per conversation):**
- Average conversation: 1,000-5,000 tokens
- API cost: ~$0.01-0.03 per 1K tokens
- **Cost per conversation: $0.01-0.15**
- With Spectyra optimization (40-65% savings): **$0.005-0.09 per conversation**

**Revenue:**
- Subscription: $19/month

**Break-Even Analysis:**

| Conversations/Month | Cost/Conversation | Total Cost | Revenue | Profit/Loss |
|---------------------|-------------------|------------|---------|-------------|
| 100 | $0.09 | $9 | $19 | **+$10** ✅ |
| 200 | $0.09 | $18 | $19 | **+$1** ⚠️ |
| 300 | $0.09 | $27 | $19 | **-$8** ❌ |
| 500 | $0.09 | $45 | $19 | **-$26** ❌ |
| 1000 | $0.09 | $90 | $19 | **-$71** ❌ |

**Conclusion:** Users doing 200+ conversations/month could cause losses.

## Solutions

### Option 1: Usage Limits (Recommended)

**Tiered Plans with Limits:**

**Free Tier:**
- 50 conversations/month
- After limit: Upgrade or switch to BYOK

**Basic Plan ($9/month):**
- 200 conversations/month
- After limit: $0.05 per conversation overage

**Pro Plan ($19/month):**
- 500 conversations/month
- After limit: $0.05 per conversation overage

**Unlimited Plan ($49/month):**
- Unlimited conversations
- For power users

**Benefits:**
- ✅ Protects against losses
- ✅ Clear pricing tiers
- ✅ Users understand limits
- ✅ Overage revenue

### Option 2: Fair Use Policy

**Unlimited with Fair Use:**
- $19/month "unlimited"
- Fair use: ~200 conversations/month
- Heavy users (>500/month): Auto-upgrade to higher tier
- Abusive users: Switch to BYOK or cancel

**Benefits:**
- ✅ Simple messaging ("unlimited")
- ✅ Protects against abuse
- ✅ Flexible enforcement

**Drawbacks:**
- ❌ Unclear limits
- ❌ Potential user confusion
- ❌ Harder to enforce

### Option 3: Hybrid Model

**Free Tier (BYOK):**
- Users provide their own keys
- Free optimization service
- Users pay OpenAI directly
- No cost to Spectyra

**Paid Tier (Spectyra Keys):**
- Spectyra provides keys
- $19/month
- 200 conversations/month
- After limit: Switch to BYOK or upgrade

**Benefits:**
- ✅ Free tier = no cost to Spectyra
- ✅ Paid tier = controlled costs
- ✅ Users can choose

### Option 4: Usage-Based Pricing

**Pay-as-you-go:**
- $0.10 per conversation
- Includes API costs
- No monthly fee
- Spectyra profit: ~$0.01-0.05 per conversation

**Benefits:**
- ✅ No risk of losses
- ✅ Users pay for what they use
- ✅ Simple pricing

**Drawbacks:**
- ❌ Less predictable revenue
- ❌ Higher per-conversation cost
- ❌ Less attractive than subscription

### Option 5: Dynamic Pricing

**Smart Pricing:**
- Base: $19/month for 200 conversations
- Overage: $0.05 per conversation
- Heavy users (>500/month): Auto-upgrade to $49/month
- Very heavy users (>1000/month): Switch to BYOK

**Benefits:**
- ✅ Protects against losses
- ✅ Fair for all users
- ✅ Automatic upgrades

## Recommended Solution: Tiered Plans with Limits

### Pricing Structure

**Free Tier:**
- 50 conversations/month
- After limit: Upgrade required
- **Cost to Spectyra:** ~$4.50/month max
- **Revenue:** $0
- **Purpose:** Acquisition, trial

**Basic ($9/month):**
- 200 conversations/month
- Overage: $0.05/conversation
- **Cost to Spectyra:** ~$18/month max (if all 200 used)
- **Revenue:** $9/month
- **Problem:** Could lose money!

**Better Basic ($15/month):**
- 150 conversations/month
- Overage: $0.05/conversation
- **Cost to Spectyra:** ~$13.50/month max
- **Revenue:** $15/month
- **Profit:** ~$1.50/month minimum

**Pro ($29/month):**
- 500 conversations/month
- Overage: $0.05/conversation
- **Cost to Spectyra:** ~$45/month max
- **Revenue:** $29/month
- **Problem:** Could lose money!

**Better Pro ($39/month):**
- 400 conversations/month
- Overage: $0.05/conversation
- **Cost to Spectyra:** ~$36/month max
- **Revenue:** $39/month
- **Profit:** ~$3/month minimum

**Unlimited ($79/month):**
- Unlimited conversations
- For power users
- **Cost to Spectyra:** Variable
- **Revenue:** $79/month
- **Break-even:** ~875 conversations/month

### Revised Pricing (Safe Margins)

| Plan | Price | Limit | Overage | Max Cost | Revenue | Min Profit |
|------|-------|-------|---------|----------|---------|------------|
| Free | $0 | 50 | N/A | $4.50 | $0 | -$4.50 |
| Basic | $15 | 150 | $0.05 | $13.50 | $15 | **+$1.50** |
| Pro | $39 | 400 | $0.05 | $36 | $39 | **+$3** |
| Unlimited | $79 | ∞ | N/A | Variable | $79 | Variable |

## Implementation Strategy

### 1. Track Usage
- Count conversations per user per month
- Store in database
- Reset monthly

### 2. Enforce Limits
- Check limit before each request
- If at limit: Block or charge overage
- Show usage in UI

### 3. Overage Handling
- Option A: Block requests (require upgrade)
- Option B: Charge overage ($0.05/conversation)
- Option C: Auto-upgrade to next tier

### 4. User Communication
- Show usage in extension popup
- Warn at 80% of limit
- Clear messaging about limits
- Easy upgrade path

## Code Changes Needed

### Backend
```typescript
// Track usage per user
interface UserUsage {
  userId: string;
  month: string; // "2026-01"
  conversations: number;
  limit: number;
  plan: 'free' | 'basic' | 'pro' | 'unlimited';
}

// Check before processing
async function checkUsageLimit(userId: string): Promise<boolean> {
  const usage = await getUsage(userId);
  if (usage.conversations >= usage.limit) {
    if (usage.plan === 'unlimited') return true;
    // Block or charge overage
    return false;
  }
  return true;
}
```

### Frontend
```javascript
// Show usage in popup
function displayUsage(usage) {
  const percent = (usage.conversations / usage.limit) * 100;
  if (percent >= 80) {
    showWarning('You\'re at 80% of your monthly limit');
  }
  if (percent >= 100) {
    showUpgradePrompt();
  }
}
```

## Risk Mitigation

### 1. Monitor Heavy Users
- Track users doing >500 conversations/month
- Auto-upgrade or switch to BYOK
- Contact for custom pricing

### 2. Abuse Prevention
- Rate limiting per user
- Detect bot behavior
- Fair use enforcement

### 3. Cost Controls
- Set spending limits per user
- Alert on high usage
- Auto-downgrade if needed

## Recommendation

**Implement Tiered Plans with Safe Margins:**

1. **Free:** 50 conversations (acquisition)
2. **Basic ($15/month):** 150 conversations (safe margin)
3. **Pro ($39/month):** 400 conversations (safe margin)
4. **Unlimited ($79/month):** For power users

**Key Features:**
- ✅ Safe profit margins
- ✅ Clear limits
- ✅ Overage charges
- ✅ Easy upgrades
- ✅ Protects against losses

This ensures Spectyra never loses money while still being attractive to users.
