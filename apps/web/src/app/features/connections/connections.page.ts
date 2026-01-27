import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './connections.page.html',
  styleUrls: ['./connections.page.css'],
})
export class ConnectionsPage implements OnInit {
  ngOnInit() {
    // Component initialization
  }
}
