import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataMapComponent } from './data-map.component';

describe('DataMapComponent', () => {
  let component: DataMapComponent;
  let fixture: ComponentFixture<DataMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
