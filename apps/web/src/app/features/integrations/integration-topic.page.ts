import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { INTEGRATION_PAGES_BY_SLUG, type IntegrationPageDefinition } from '@spectyra/integration-metadata';

@Component({
  selector: 'app-integration-topic',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './integration-topic.page.html',
  styleUrls: ['./integrations-shell.scss'],
})
export class IntegrationTopicPage implements OnInit {
  slug = '';
  page: IntegrationPageDefinition | undefined;
  notFound = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    this.page = INTEGRATION_PAGES_BY_SLUG[this.slug];
    this.notFound = !this.page;
  }

  copy(text: string): void {
    void navigator.clipboard.writeText(text);
  }
}
