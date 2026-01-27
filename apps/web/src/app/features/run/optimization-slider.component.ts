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
  templateUrl: './optimization-slider.component.html',
  styleUrls: ['./optimization-slider.component.css'],
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
