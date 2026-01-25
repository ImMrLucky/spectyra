import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type OptimizationLevel = 0 | 1 | 2 | 3 | 4;

export interface SliderConfig {
  title: string;
  leftLabel: string;
  rightLabel: string;
  levelNames: string[];
}

const TALK_SLIDER: SliderConfig = {
  title: 'Detail vs Savings',
  leftLabel: 'Most Detailed',
  rightLabel: 'Max Savings',
  levelNames: ['Detailed', 'Balanced+', 'Default', 'Concise', 'Max savings'],
};

const CODE_SLIDER: SliderConfig = {
  title: 'Optimization Level',
  leftLabel: 'Safest (more context)',
  rightLabel: 'Extreme Savings (patch-first)',
  levelNames: ['Safest', 'Balanced+', 'Default', 'Max savings', 'Extreme'],
};

@Component({
  selector: 'app-optimization-slider',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="slider-container card">
      <h3>{{ config.title }}</h3>
      <div class="slider-wrapper">
        <label class="slider-label-left">{{ config.leftLabel }}</label>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          [value]="level"
          (input)="onChange($event)"
          class="slider"
        />
        <label class="slider-label-right">{{ config.rightLabel }}</label>
      </div>
      <div class="slider-value">
        <span class="level-badge">Level {{ level }}: {{ config.levelNames[level] }}</span>
      </div>
    </div>
  `,
  styles: [`
    .slider-container {
      margin-bottom: 20px;
    }
    .slider-wrapper {
      display: flex;
      align-items: center;
      gap: 15px;
      margin: 20px 0;
    }
    .slider-label-left,
    .slider-label-right {
      font-size: 13px;
      color: #666;
      white-space: nowrap;
      min-width: 120px;
    }
    .slider-label-left {
      text-align: right;
    }
    .slider-label-right {
      text-align: left;
    }
    .slider {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: #ddd;
      outline: none;
      -webkit-appearance: none;
    }
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #007bff;
      cursor: pointer;
    }
    .slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #007bff;
      cursor: pointer;
      border: none;
    }
    .slider-value {
      text-align: center;
      margin-top: 10px;
    }
    .level-badge {
      display: inline-block;
      padding: 6px 12px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 4px;
      font-weight: 500;
      font-size: 14px;
    }
  `],
})
export class OptimizationSliderComponent implements OnInit {
  @Input() path: 'talk' | 'code' = 'talk';
  @Input() level: OptimizationLevel = 2;
  @Output() levelChange = new EventEmitter<OptimizationLevel>();

  config: SliderConfig = TALK_SLIDER;

  ngOnInit() {
    this.config = this.path === 'talk' ? TALK_SLIDER : CODE_SLIDER;
  }

  onChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newLevel = parseInt(target.value, 10) as OptimizationLevel;
    this.level = newLevel;
    this.levelChange.emit(newLevel);
  }
}
