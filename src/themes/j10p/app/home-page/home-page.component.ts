import { Component } from '@angular/core';
import { HomePageComponent as BaseComponent } from 'src/app/home-page/home-page.component';

@Component({
  selector: 'ds-home-page',
  styleUrls: ['./home-page.component.scss'],
  templateUrl: './home-page.component.html'
})
export class HomePageComponent extends BaseComponent {}
