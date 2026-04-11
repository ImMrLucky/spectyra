import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './contact.page.html',
  styleUrls: ['./contact.page.scss'],
})
export class ContactPage implements OnInit {
  readonly formAction = 'https://api.web3forms.com/submit';
  readonly accessKey = environment.web3formsAccessKey;
  /** After Web3Forms processes the POST, browser is sent here (full page navigation). */
  redirectAfterSubmit: string;

  showThanks = false;

  constructor(private route: ActivatedRoute) {
    const base = environment.publicSiteUrl.replace(/\/$/, '');
    this.redirectAfterSubmit = `${base}/contact?thanks=1`;
  }

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('thanks');
    this.showThanks = t === '1' || t === 'true';
  }
}
