# How to Find Your LLM API Keys

## ⚠️ Important: ChatGPT Plus vs API Billing

**Your ChatGPT Plus subscription ($20/month) does NOT cover API usage.**

- ✅ **ChatGPT Plus** = Web UI access (chatgpt.com)
- ❌ **API Usage** = Billed separately based on tokens (pay-as-you-go)

**You will be billed separately for API usage**, even if you have ChatGPT Plus. API usage is typically much cheaper than the subscription for most users.

---

## Finding Your API Keys

### 1. OpenAI (ChatGPT) API Key

**Steps:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in (use same email as ChatGPT if you have an account)
3. Click your profile icon (top right) → "View API keys"
4. Click "Create new secret key"
5. **Copy the key immediately** - you won't see it again!
6. Paste it into Spectyra settings

**Important:**
- You need to add a payment method to use the API
- API usage is billed separately from ChatGPT Plus
- Pricing: ~$0.01-0.03 per 1K tokens (very affordable)

**Direct Link:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

### 2. Anthropic (Claude) API Key

**Steps:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create account
3. Click "API Keys" in the left sidebar
4. Click "Create Key"
5. Give it a name (e.g., "Spectyra")
6. **Copy the key immediately**
7. Paste it into Spectyra settings

**Important:**
- You need to add a payment method
- Pricing: ~$0.003-0.015 per 1K tokens

**Direct Link:** [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

### 3. Google Gemini API Key

**Steps:**
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select a project (or create new)
5. **Copy the key immediately**
6. Paste it into Spectyra settings

**Important:**
- Free tier available (with limits)
- Pricing: ~$0.00025-0.001 per 1K tokens (very cheap)

**Direct Link:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

### 4. Grok (X.AI) API Key

**Steps:**
1. Go to [x.ai](https://x.ai)
2. Sign in with your X/Twitter account
3. Navigate to API settings (if available)
4. Create API key
5. **Copy the key immediately**
6. Paste it into Spectyra settings

**Important:**
- API access may require approval
- Check current pricing on x.ai

**Direct Link:** [x.ai](https://x.ai) (API section)

---

## Quick Reference

| Provider | Website | Key Format | Free Tier? |
|----------|---------|------------|------------|
| **OpenAI** | platform.openai.com | `sk-...` | No (pay-as-you-go) |
| **Anthropic** | console.anthropic.com | `sk-ant-...` | No (pay-as-you-go) |
| **Gemini** | aistudio.google.com | `AIza...` | Yes (with limits) |
| **Grok** | x.ai | Varies | Check website |

---

## Common Questions

### Q: Do I need a separate account for API vs web UI?
**A:** 
- **OpenAI**: Same account, but separate billing
- **Anthropic**: Same account, but separate billing
- **Gemini**: Same Google account
- **Grok**: Same X/Twitter account

### Q: Will my ChatGPT Plus subscription cover API usage?
**A:** **No.** API usage is billed separately. Your $20/month subscription only covers the web UI.

### Q: How much will API usage cost?
**A:** Typically $0.01-0.03 per 1K tokens. A typical conversation might use 1,000-5,000 tokens, costing $0.01-0.15. Much cheaper than you'd expect!

### Q: Can I set spending limits?
**A:** Yes! Most providers let you set monthly spending limits:
- **OpenAI**: platform.openai.com/account/billing/limits
- **Anthropic**: console.anthropic.com/settings/billing
- **Gemini**: Check Google Cloud Console

### Q: Is my API key safe?
**A:** 
- ✅ Keys are stored locally in your browser (never sent to Spectyra servers)
- ✅ Only used to make API calls on your behalf
- ✅ You can revoke keys anytime from the provider's website
- ✅ Never share your keys publicly

---

## Troubleshooting

### "Invalid API Key" Error
- Make sure you copied the entire key (they're long!)
- Check for extra spaces before/after
- Verify the key is active in the provider's dashboard
- Try creating a new key

### "Payment Required" Error
- Add a payment method to your API account
- Check your billing limits
- Verify your account is in good standing

### "Rate Limit" Error
- You've hit your usage limit
- Check your provider's dashboard for limits
- Wait a bit and try again
- Consider upgrading your plan

---

## Need Help?

- **OpenAI Support**: [help.openai.com](https://help.openai.com)
- **Anthropic Support**: [support.anthropic.com](https://support.anthropic.com)
- **Gemini Support**: [support.google.com/aistudio](https://support.google.com/aistudio)
- **Spectyra Support**: [Your support link]
