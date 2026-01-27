import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home-container">
      <div class="hero-section">
        <h1>Spectyra</h1>
        <p class="tagline">Optimize your LLM costs with intelligent token reduction</p>
        <p class="description">
          Spectyra reduces token usage and costs by preventing semantic recomputation.
          Get started with a 7-day free trial.
        </p>
        <div class="cta-buttons">
          <a routerLink="/register" class="btn btn-primary">Get Started</a>
          <a routerLink="/login" class="btn btn-secondary">Sign In</a>
        </div>
      </div>

      <div class="features-section">
        <h2>Key Features</h2>
        <div class="features-grid">
          <div class="feature-card">
            <h3>🚀 Token Optimization</h3>
            <p>Reduce token usage by up to 70% by preventing redundant semantic computations</p>
          </div>
          <div class="feature-card">
            <h3>💰 Cost Savings</h3>
            <p>Track and visualize your savings with detailed analytics and reporting</p>
          </div>
          <div class="feature-card">
            <h3>🔒 BYOK Security</h3>
            <p>Bring Your Own Key - your provider API keys are never stored on our servers</p>
          </div>
          <div class="feature-card">
            <h3>📊 Proof Scenarios</h3>
            <p>Test optimization strategies before deploying to production</p>
          </div>
          <div class="feature-card">
            <h3>🔌 Easy Integration</h3>
            <p>Works with OpenAI, Anthropic, Gemini, and more via simple SDK or proxy</p>
          </div>
          <div class="feature-card">
            <h3>📈 Real-time Analytics</h3>
            <p>Monitor usage, savings, and performance with comprehensive dashboards</p>
          </div>
        </div>
      </div>

      <div class="how-it-works">
        <h2>How It Works</h2>
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <h3>Sign Up</h3>
            <p>Create your account and get your API key</p>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <h3>Integrate</h3>
            <p>Add Spectyra to your LLM calls via SDK or proxy</p>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <h3>Optimize</h3>
            <p>Watch as Spectyra reduces tokens and costs automatically</p>
          </div>
        </div>
      </div>

      <div class="cta-section">
        <h2>Ready to Start Saving?</h2>
        <p>Join thousands of developers optimizing their LLM costs</p>
        <a routerLink="/register" class="btn btn-primary btn-large">Start Free Trial</a>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .hero-section {
      text-align: center;
      padding: 60px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
      margin-bottom: 60px;
    }

    .hero-section h1 {
      font-size: 48px;
      font-weight: 700;
      margin: 0 0 16px 0;
    }

    .tagline {
      font-size: 24px;
      font-weight: 500;
      margin: 0 0 16px 0;
      opacity: 0.95;
    }

    .description {
      font-size: 18px;
      margin: 0 0 32px 0;
      opacity: 0.9;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    .cta-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 16px;
      transition: all 0.2s;
      display: inline-block;
    }

    .btn-primary {
      background: white;
      color: #667eea;
    }

    .btn-primary:hover {
      background: #f0f0f0;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 2px solid white;
    }

    .btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }

    .btn-large {
      padding: 16px 32px;
      font-size: 18px;
    }

    .features-section {
      margin-bottom: 60px;
    }

    .features-section h2 {
      text-align: center;
      font-size: 36px;
      margin-bottom: 40px;
      color: #333;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .feature-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    }

    .feature-card h3 {
      margin: 0 0 12px 0;
      font-size: 20px;
      color: #333;
    }

    .feature-card p {
      margin: 0;
      color: #666;
      line-height: 1.6;
    }

    .how-it-works {
      margin-bottom: 60px;
      text-align: center;
    }

    .how-it-works h2 {
      font-size: 36px;
      margin-bottom: 40px;
      color: #333;
    }

    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 32px;
      max-width: 900px;
      margin: 0 auto;
    }

    .step {
      text-align: center;
    }

    .step-number {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      font-size: 28px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .step h3 {
      font-size: 22px;
      margin: 0 0 8px 0;
      color: #333;
    }

    .step p {
      color: #666;
      margin: 0;
    }

    .cta-section {
      text-align: center;
      padding: 60px 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }

    .cta-section h2 {
      font-size: 36px;
      margin: 0 0 16px 0;
      color: #333;
    }

    .cta-section p {
      font-size: 18px;
      color: #666;
      margin: 0 0 32px 0;
    }
  `],
})
export class HomePage {}
