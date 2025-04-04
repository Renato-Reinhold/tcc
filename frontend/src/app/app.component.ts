import { Component } from '@angular/core';
import { DataMapComponent } from './pages/data-map/data-map.component';

@Component({
  selector: 'app-root',
  imports: [ DataMapComponent ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'frontend';
}
